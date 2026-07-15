"""Step 8 — Build the RAG prompt injected into the LLM."""

from __future__ import annotations

SYSTEM_PROMPT = """You are a polished product assistant answering questions about a PDF document.
Use only the retrieved PDF context provided below. If the answer is not supported by the context, say you don't know.

Write naturally and synthesize the result into a clean final answer:
- Lead with the answer, not with phrases like "According to chunk..." or "Based on the context..."
- Do not mention chunk numbers, retrieval steps, vector search, or internal system details
- Prefer a short summary paragraph first, then brief bullets only when they improve clarity
- For resume or profile questions, combine details into a professional summary instead of repeating raw fragments
- Mention page numbers only when they are genuinely useful to the user
- If the context is partial or ambiguous, say that clearly in a smooth way"""

GENERAL_SYSTEM_PROMPT = """You are a polished product assistant.
Answer naturally, directly, and helpfully.

Use recent conversation memory only when it is useful:
- Lead with the answer
- Be concise unless the user asks for depth
- Do not mention internal memory, prompts, retrieval, or system details
- If web sources are provided, use them and include source references with URLs
- If you are unsure, say so clearly and offer the best next step"""


def build_chat_messages(
    question: str,
    chunks: list[dict],
    *,
    recent_messages: list[dict] | None = None,
    profile_memories: list[dict] | None = None,
) -> list[dict]:
    context_parts = []
    for ch in chunks:
        idx = ch.get("chunk_index", "?")
        page = ch.get("page", "?")
        context_parts.append(f"[Source {idx} | page {page}]\n{ch['text']}")

    conversation_block = "None"
    if recent_messages:
        conversation_block = "\n".join(
            f"- {msg['role'].capitalize()}: {msg['content']}" for msg in recent_messages
        )

    profile_block = "None"
    if profile_memories:
        profile_block = "\n".join(
            f"- {item['key']}: {item['content']}" for item in profile_memories
        )

    context_block = "\n\n---\n\n".join(context_parts)
    user_content = f"""CONTEXT FROM PDF:
{context_block}

RECENT CONVERSATION MEMORY:
{conversation_block}

USER / PROFILE MEMORY:
{profile_block}

USER QUESTION:
{question}"""

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def build_general_chat_messages(
    question: str,
    *,
    recent_messages: list[dict] | None = None,
    profile_memories: list[dict] | None = None,
    web_context: str | None = None,
) -> list[dict]:
    conversation_block = "None"
    if recent_messages:
        conversation_block = "\n".join(
            f"- {msg['role'].capitalize()}: {msg['content']}" for msg in recent_messages
        )

    profile_block = "None"
    if profile_memories:
        profile_block = "\n".join(
            f"- {item['key']}: {item['content']}" for item in profile_memories
        )

    user_content = f"""RECENT CONVERSATION MEMORY:
{conversation_block}

USER / PROFILE MEMORY:
{profile_block}

WEB SEARCH CONTEXT:
{web_context or "None"}

USER QUESTION:
{question}"""

    return [
        {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
