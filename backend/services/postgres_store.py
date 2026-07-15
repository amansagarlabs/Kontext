"""Postgres-backed MVP persistence for users, conversations, and messages."""

from __future__ import annotations

from typing import Any
from uuid import UUID

try:
    import psycopg
    from psycopg.rows import dict_row
except ModuleNotFoundError:  # pragma: no cover - optional dependency in local dev
    psycopg = None
    dict_row = None


def postgres_enabled(settings) -> bool:
    return bool(settings.database_url and psycopg is not None)


def _connect(settings: Any):
    if psycopg is None or dict_row is None:
        raise RuntimeError(
            "psycopg is not installed. Run `pip install -r requirements.txt` in backend/."
        )
    return psycopg.connect(settings.database_url, row_factory=dict_row)


def check_postgres_connection(settings) -> dict[str, Any]:
    if not postgres_enabled(settings):
        return {
            "connected": False,
            "mode": getattr(settings, "database_mode", "unknown"),
            "database": getattr(settings, "postgres_db", ""),
            "host": getattr(settings, "postgres_host", ""),
            "reason": "Postgres is not configured.",
        }

    try:
        with _connect(settings) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database() AS database, current_user AS user_name")
                row = cur.fetchone() or {}
        return {
            "connected": True,
            "mode": getattr(settings, "database_mode", "unknown"),
            "database": row.get("database", getattr(settings, "postgres_db", "")),
            "host": getattr(settings, "postgres_host", ""),
            "user": row.get("user_name", getattr(settings, "postgres_user", "")),
        }
    except Exception as exc:  # pragma: no cover - operational health check
        return {
            "connected": False,
            "mode": getattr(settings, "database_mode", "unknown"),
            "database": getattr(settings, "postgres_db", ""),
            "host": getattr(settings, "postgres_host", ""),
            "reason": str(exc),
        }


def resolve_user_id(settings, user_hint: str) -> str | None:
    if not postgres_enabled(settings):
        return None

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            try:
                uuid_value = str(UUID(user_hint))
                cur.execute("SELECT id::text FROM users WHERE id = %s", (uuid_value,))
                row = cur.fetchone()
                if row:
                    return row["id"]
            except ValueError:
                pass

            cur.execute(
                """
                SELECT id::text
                FROM users
                WHERE username = %s OR email = %s
                LIMIT 1
                """,
                (user_hint, user_hint),
            )
            row = cur.fetchone()
            if row:
                return row["id"]

            if user_hint != "local-user":
                return None

            cur.execute(
                """
                INSERT INTO users (email, username, status, is_email_verified)
                VALUES (%s, %s, 'active', TRUE)
                RETURNING id::text
                """,
                ("local-user@app-agent.local", "local-user"),
            )
            user = cur.fetchone()
            user_id = user["id"]
            cur.execute(
                """
                INSERT INTO user_profiles (user_id, full_name, onboarding_completed)
                VALUES (%s, %s, TRUE)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id, "Local User"),
            )
            cur.execute(
                """
                INSERT INTO user_roles (user_id, role_id)
                SELECT %s, id FROM roles WHERE role_key = 'user'
                ON CONFLICT DO NOTHING
                """,
                (user_id,),
            )
            conn.commit()
            return user_id


def ensure_conversation(
    settings,
    *,
    conversation_id: str,
    user_id: str,
    question: str,
) -> None:
    if not postgres_enabled(settings):
        return

    title = question.strip()[:80] or "New chat"
    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO conversations (
                    id, user_id, title, conversation_type, status, last_message_at
                )
                VALUES (%s, %s, %s, 'artifact_chat', 'active', NOW())
                ON CONFLICT (id)
                DO UPDATE SET
                    title = COALESCE(conversations.title, EXCLUDED.title),
                    updated_at = NOW(),
                    last_message_at = NOW()
                """,
                (conversation_id, user_id, title),
            )
            conn.commit()


def save_message(
    settings,
    *,
    conversation_id: str,
    user_id: str,
    role: str,
    content: str,
    metadata: dict[str, Any] | None = None,
    retrieval_ms: float | None = None,
    llm_ms: float | None = None,
    total_ms: float | None = None,
) -> str | None:
    if not postgres_enabled(settings):
        return None

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO messages (
                    conversation_id,
                    user_id,
                    role,
                    content,
                    retrieval_ms,
                    llm_ms,
                    total_ms,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id::text
                """,
                (
                    conversation_id,
                    user_id,
                    role,
                    content,
                    retrieval_ms,
                    llm_ms,
                    total_ms,
                    psycopg.types.json.Json(metadata or {}),
                ),
            )
            row = cur.fetchone()
            cur.execute(
                """
                UPDATE conversations
                SET updated_at = NOW(), last_message_at = NOW()
                WHERE id = %s
                """,
                (conversation_id,),
            )
            conn.commit()
            return row["id"] if row else None


def save_retrieval_sources(
    settings,
    *,
    message_id: str,
    sources: list[dict[str, Any]],
) -> None:
    if not postgres_enabled(settings) or not message_id or not sources:
        return

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            for source in sources:
                cur.execute(
                    """
                    INSERT INTO message_retrieval_sources (
                        message_id,
                        source_type,
                        chunk_index,
                        page_number,
                        similarity,
                        preview,
                        source_metadata
                    )
                    VALUES (%s, 'milvus_chunk', %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        message_id,
                        source.get("chunk_index"),
                        source.get("page"),
                        source.get("similarity"),
                        source.get("preview"),
                        psycopg.types.json.Json(
                            {
                                "distance": source.get("distance"),
                                "doc_id": source.get("doc_id"),
                            }
                        ),
                    ),
                )
            conn.commit()


def list_recent_conversations(
    settings,
    *,
    user_id: str,
    limit: int = 12,
) -> list[dict[str, Any]]:
    if not postgres_enabled(settings):
        return []

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.id::text AS id,
                    COALESCE(NULLIF(c.title, ''), 'Untitled chat') AS title,
                    c.updated_at,
                    c.last_message_at,
                    COUNT(m.id)::int AS message_count,
                    MAX(m.content) FILTER (WHERE m.created_at = (
                        SELECT MAX(m2.created_at)
                        FROM messages m2
                        WHERE m2.conversation_id = c.id
                    )) AS last_message
                FROM conversations c
                LEFT JOIN messages m ON m.conversation_id = c.id
                WHERE c.user_id = %s AND c.status <> 'deleted'
                GROUP BY c.id
                ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
            return list(rows)


def load_conversation_messages(
    settings,
    *,
    user_id: str,
    conversation_id: str,
) -> list[dict[str, Any]]:
    if not postgres_enabled(settings):
        return []

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.id::text AS id, m.role, m.content, m.created_at
                FROM messages m
                JOIN conversations c ON c.id = m.conversation_id
                WHERE c.user_id = %s AND c.id = %s
                ORDER BY m.created_at ASC, m.id ASC
                """,
                (user_id, conversation_id),
            )
            rows = cur.fetchall()
            return list(rows)
