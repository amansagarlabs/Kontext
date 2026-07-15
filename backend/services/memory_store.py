"""Lightweight SQLite-backed memory store for conversations and profile facts."""

from __future__ import annotations

import re
import sqlite3
from datetime import UTC, datetime
from pathlib import Path


PROFILE_TRIGGER_PATTERN = re.compile(
    r"\b(resume|cv|profile|experience|skills|background|who is|about)\b",
    re.IGNORECASE,
)


def _db_path(settings) -> Path:
    return Path(settings.memory_db_path)


def init_memory_store(settings) -> None:
    path = _db_path(settings)
    path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversation_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS profile_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                memory_key TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(user_id, doc_id, memory_key)
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_conversation_messages_lookup
            ON conversation_messages (conversation_id, created_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_profile_memories_lookup
            ON profile_memories (user_id, doc_id, updated_at)
            """
        )
        conn.commit()


def _connect(settings) -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(settings))
    conn.row_factory = sqlite3.Row
    return conn


def save_message(
    settings,
    *,
    conversation_id: str,
    user_id: str,
    doc_id: str,
    role: str,
    content: str,
) -> None:
    timestamp = datetime.now(UTC).isoformat()
    with _connect(settings) as conn:
        conn.execute(
            """
            INSERT INTO conversation_messages (
                conversation_id, user_id, doc_id, role, content, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (conversation_id, user_id, doc_id, role, content, timestamp),
        )
        conn.commit()


def get_recent_messages(
    settings,
    *,
    conversation_id: str,
    limit: int,
) -> list[dict]:
    with _connect(settings) as conn:
        rows = conn.execute(
            """
            SELECT role, content
            FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (conversation_id, limit),
        ).fetchall()

    items = [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]
    return items


def get_profile_memories(
    settings,
    *,
    user_id: str,
    doc_id: str,
    limit: int,
) -> list[dict]:
    with _connect(settings) as conn:
        rows = conn.execute(
            """
            SELECT memory_key, content, source, updated_at
            FROM profile_memories
            WHERE user_id = ? AND doc_id = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT ?
            """,
            (user_id, doc_id, limit),
        ).fetchall()

    return [
        {
            "key": row["memory_key"],
            "content": row["content"],
            "source": row["source"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def maybe_store_profile_memory(
    settings,
    *,
    user_id: str,
    doc_id: str,
    question: str,
    answer: str,
) -> None:
    if not PROFILE_TRIGGER_PATTERN.search(question):
        return

    normalized_answer = answer.strip()
    if not normalized_answer or normalized_answer.lower().startswith("i don't know"):
        return

    memory_key = classify_profile_memory(question)
    upsert_profile_memory(
        settings,
        user_id=user_id,
        doc_id=doc_id,
        memory_key=memory_key,
        content=normalized_answer[:2000],
        source="chat-summary",
    )


def classify_profile_memory(question: str) -> str:
    lowered = question.lower()
    if "experience" in lowered:
        return "experience_summary"
    if "skill" in lowered or "tech" in lowered:
        return "skills_summary"
    if "who is" in lowered or "about" in lowered or "profile" in lowered:
        return "profile_summary"
    return "document_summary"


def upsert_profile_memory(
    settings,
    *,
    user_id: str,
    doc_id: str,
    memory_key: str,
    content: str,
    source: str,
) -> None:
    timestamp = datetime.now(UTC).isoformat()
    with _connect(settings) as conn:
        conn.execute(
            """
            INSERT INTO profile_memories (
                user_id, doc_id, memory_key, content, source, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, doc_id, memory_key)
            DO UPDATE SET
                content = excluded.content,
                source = excluded.source,
                updated_at = excluded.updated_at
            """,
            (user_id, doc_id, memory_key, content, source, timestamp, timestamp),
        )
        conn.commit()
