"""
Steps 8–10 — RAG chat with retrieval metadata + OpenRouter streaming (SSE).
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncGenerator

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.config import get_settings
from rag.prompt_builder import build_chat_messages, build_general_chat_messages
from rag.retriever import retrieve_chunks
from services.ag_ui_events import sse
from services.memory_store import (
    get_profile_memories,
    get_recent_messages,
    maybe_store_profile_memory,
    upsert_profile_memory,
    save_message,
)
from services.openrouter import stream_chat_completion
from services.postgres_store import (
    ensure_conversation,
    list_recent_conversations,
    load_conversation_messages,
    postgres_enabled,
    resolve_user_id,
    save_message as save_postgres_message,
    save_retrieval_sources,
)
from services.web_search import format_web_context, search_web, web_search_available

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    doc_id: str | None = Field(default=None)
    question: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str = Field(..., min_length=1, max_length=120)
    user_id: str = Field(default="local-user", min_length=1, max_length=120)

    @field_validator("doc_id", mode="before")
    @classmethod
    def normalize_doc_id(cls, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None


@router.get("/conversations")
async def recent_conversations(
    user_id: str = Query(default="local-user", min_length=1, max_length=120),
    limit: int = Query(default=12, ge=1, le=50),
):
    settings = get_settings()
    if not postgres_enabled(settings):
        return {"items": []}

    resolved_user_id = resolve_user_id(settings, user_id)
    if not resolved_user_id:
        return {"items": []}

    items = list_recent_conversations(
        settings,
        user_id=resolved_user_id,
        limit=limit,
    )
    return {"items": items}


@router.get("/conversations/{conversation_id}/messages")
async def conversation_messages(
    conversation_id: str,
    user_id: str = Query(default="local-user", min_length=1, max_length=120),
):
    settings = get_settings()
    if not postgres_enabled(settings):
        return {"items": []}

    resolved_user_id = resolve_user_id(settings, user_id)
    if not resolved_user_id:
        return {"items": []}

    items = load_conversation_messages(
        settings,
        user_id=resolved_user_id,
        conversation_id=conversation_id,
    )
    return {"items": items}


@router.post("/stream")
async def chat_stream(body: ChatRequest):
    settings = get_settings()

    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OPENROUTER_API_KEY missing in .env — add your key from openrouter.ai",
        )

    return StreamingResponse(
        _chat_event_stream(
            doc_id=body.doc_id.strip() if body.doc_id else None,
            question=body.question.strip(),
            conversation_id=body.conversation_id.strip(),
            user_id=body.user_id.strip() or "local-user",
            settings=settings,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _chat_event_stream(
    *, doc_id: str | None, question: str, conversation_id: str, user_id: str, settings
) -> AsyncGenerator[str, None]:
    pipeline_start = time.perf_counter()
    resolved_user_id = resolve_user_id(settings, user_id) if postgres_enabled(settings) else None

    yield sse("status", {"message": "Searching current conversation..."})
    recent_messages = get_recent_messages(
        settings,
        conversation_id=conversation_id,
        limit=settings.memory_recent_turns,
    )

    yield sse("status", {"message": "Searching saved memory..."})
    profile_memories = get_profile_memories(
        settings,
        user_id=user_id,
        doc_id=doc_id or "general",
        limit=settings.memory_profile_items,
    )

    retrieval = {"retrieval_ms": 0, "top_k": 0, "chunks": []}
    if doc_id:
        yield sse("status", {"message": "Searching artifacts..."})
        try:
            retrieval = retrieve_chunks(settings, doc_id=doc_id, question=question)
        except ValueError as exc:
            yield sse("error", {"message": str(exc)})
            return
        except Exception as exc:
            yield sse("error", {"message": f"Retrieval failed: {exc}"})
            return

        yield sse(
            "retrieval",
            {
                "retrieval_ms": retrieval["retrieval_ms"],
                "top_k": retrieval["top_k"],
                "chunks": retrieval["chunks"],
            },
        )

    web_context = "None"
    web_sources: list[dict] = []
    if not doc_id and web_search_available(settings):
        yield sse("status", {"message": "Searching web..."})
        try:
            web_result = await search_web(settings, question)
            web_context = format_web_context(web_result)
            web_sources = web_result.get("results", [])
            if web_sources:
                upsert_profile_memory(
                    settings,
                    user_id=user_id,
                    doc_id="general",
                    memory_key=f"web:{conversation_id}:{int(time.time())}",
                    content=json.dumps(
                        {
                            "query": question,
                            "summary": web_result.get("summary", ""),
                            "sources": web_sources,
                            "timestamp": web_result.get("timestamp"),
                        }
                    ),
                    source="web_search",
                )
        except Exception as exc:
            yield sse(
                "status",
                {"message": f"Web search unavailable. Continuing without live sources."},
            )

    if doc_id:
        messages = build_chat_messages(
            question,
            retrieval["chunks"],
            recent_messages=recent_messages,
            profile_memories=profile_memories,
        )
    else:
        messages = build_general_chat_messages(
            question,
            recent_messages=recent_messages,
            profile_memories=profile_memories,
            web_context=web_context,
        )
    llm_start = time.perf_counter()
    full_answer: list[str] = []

    yield sse("status", {"message": "Generating answer..."})
    try:
        async for token in stream_chat_completion(
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
            messages=messages,
        ):
            full_answer.append(token)
            yield sse("token", {"content": token})
    except Exception as exc:
        yield sse("error", {"message": str(exc)})
        return

    llm_ms = round((time.perf_counter() - llm_start) * 1000, 2)
    total_ms = round((time.perf_counter() - pipeline_start) * 1000, 2)
    answer_text = "".join(full_answer).strip()

    if resolved_user_id:
        ensure_conversation(
            settings,
            conversation_id=conversation_id,
            user_id=resolved_user_id,
            question=question,
        )
        save_postgres_message(
            settings,
            conversation_id=conversation_id,
            user_id=resolved_user_id,
            role="user",
            content=question,
            metadata={"doc_id": doc_id, "mode": "document" if doc_id else "general"},
        )
        assistant_message_id = save_postgres_message(
            settings,
            conversation_id=conversation_id,
            user_id=resolved_user_id,
            role="assistant",
            content=answer_text,
            metadata={
                "doc_id": doc_id,
                "mode": "document" if doc_id else "general",
                "model": settings.openrouter_model,
                "web_sources": web_sources,
            },
            retrieval_ms=retrieval["retrieval_ms"],
            llm_ms=llm_ms,
            total_ms=total_ms,
        )
        if assistant_message_id and retrieval["chunks"]:
            save_retrieval_sources(
                settings,
                message_id=assistant_message_id,
                sources=retrieval["chunks"],
            )

    save_message(
        settings,
        conversation_id=conversation_id,
        user_id=user_id,
        doc_id=doc_id or "general",
        role="user",
        content=question,
    )
    save_message(
        settings,
        conversation_id=conversation_id,
        user_id=user_id,
        doc_id=doc_id or "general",
        role="assistant",
        content=answer_text,
    )
    maybe_store_profile_memory(
        settings,
        user_id=user_id,
        doc_id=doc_id or "general",
        question=question,
        answer=answer_text,
    )

    yield sse(
        "done",
        {
            "retrieval_ms": retrieval["retrieval_ms"],
            "llm_ms": llm_ms,
            "total_ms": total_ms,
            "model": settings.openrouter_model,
            "answer_length": len("".join(full_answer)),
            "web_sources": web_sources,
        },
    )
