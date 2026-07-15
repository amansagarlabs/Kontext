"""
Step 9–10 — OpenRouter chat completions with streaming.

LEARNING: The LLM never sees your whole PDF — only the retrieved chunks we inject.
          Streaming (SSE) sends tokens as they're generated for faster perceived UX.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


async def stream_chat_completion(
    *,
    api_key: str,
    model: str,
    messages: list[dict],
) -> AsyncGenerator[str, None]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Context-OS",
    }
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST", OPENROUTER_URL, headers=headers, json=payload
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                try:
                    err = json.loads(body)
                    msg = err.get("error", {}).get("message", body.decode())
                except Exception:
                    msg = body.decode() or f"OpenRouter error {response.status_code}"
                raise RuntimeError(msg)

            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                text = delta.get("content")
                if text:
                    yield text
