"""Email/password auth helpers backed by Postgres."""

from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from services.postgres_store import _connect, postgres_enabled


def _hash_password(password: str, salt: str) -> str:
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return base64.b64encode(derived).decode("utf-8")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_user_with_password(
    settings: Any,
    *,
    email: str,
    password: str,
    username: str | None = None,
    full_name: str | None = None,
) -> dict[str, Any]:
    if not postgres_enabled(settings):
        raise ValueError("Postgres is not configured.")

    normalized_email = email.strip().lower()
    normalized_username = username.strip().lower() if username else None

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (normalized_email,))
            if cur.fetchone():
                raise ValueError("An account with this email already exists.")

            cur.execute(
                """
                INSERT INTO users (email, username, status, is_email_verified)
                VALUES (%s, %s, 'active', FALSE)
                RETURNING id::text, email, username, created_at
                """,
                (normalized_email, normalized_username),
            )
            user = cur.fetchone()
            user_id = user["id"]

            cur.execute(
                """
                INSERT INTO user_profiles (user_id, full_name, onboarding_completed)
                VALUES (%s, %s, FALSE)
                ON CONFLICT (user_id) DO NOTHING
                """,
                (user_id, full_name or normalized_email.split("@")[0]),
            )

            salt = secrets.token_hex(16)
            password_hash = _hash_password(password, salt)
            cur.execute(
                """
                INSERT INTO auth_identities (
                    user_id, provider, provider_user_id, password_hash, password_salt, password_updated_at
                )
                VALUES (%s, 'password', %s, %s, %s, NOW())
                """,
                (user_id, normalized_email, password_hash, salt),
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
            return user


def authenticate_user(
    settings: Any,
    *,
    email: str,
    password: str,
) -> dict[str, Any] | None:
    if not postgres_enabled(settings):
        raise ValueError("Postgres is not configured.")

    normalized_email = email.strip().lower()

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.id::text AS id,
                    u.email,
                    u.username,
                    u.status,
                    u.plan,
                    p.full_name,
                    ai.password_hash,
                    ai.password_salt
                FROM users u
                JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'password'
                LEFT JOIN user_profiles p ON p.user_id = u.id
                WHERE u.email = %s
                LIMIT 1
                """,
                (normalized_email,),
            )
            user = cur.fetchone()
            if not user or user["status"] != "active":
                return None

            expected_hash = _hash_password(password, user["password_salt"])
            if not secrets.compare_digest(expected_hash, user["password_hash"]):
                return None

            cur.execute(
                "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = %s",
                (user["id"],),
            )
            conn.commit()
            return user


def create_session(
    settings: Any,
    *,
    user_id: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
    days_valid: int = 14,
) -> dict[str, Any]:
    if not postgres_enabled(settings):
        raise ValueError("Postgres is not configured.")

    raw_token = secrets.token_urlsafe(48)
    refresh_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    refresh_token_hash = _hash_token(refresh_token)
    expires_at = datetime.now(UTC) + timedelta(days=days_valid)

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_sessions (
                    user_id, session_token_hash, refresh_token_hash, user_agent, ip_address, expires_at, last_seen_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING id::text, expires_at
                """,
                (user_id, token_hash, refresh_token_hash, user_agent, ip_address, expires_at),
            )
            session = cur.fetchone()
            conn.commit()

    return {
        "session_id": session["id"],
        "access_token": raw_token,
        "refresh_token": refresh_token,
        "expires_at": session["expires_at"],
    }


def get_user_from_token(settings: Any, token: str) -> dict[str, Any] | None:
    if not postgres_enabled(settings) or not token:
        return None

    token_hash = _hash_token(token)

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.id::text AS id,
                    u.email,
                    u.username,
                    u.status,
                    u.plan,
                    p.full_name,
                    s.id::text AS session_id
                FROM user_sessions s
                JOIN users u ON u.id = s.user_id
                LEFT JOIN user_profiles p ON p.user_id = u.id
                WHERE s.session_token_hash = %s
                  AND s.revoked_at IS NULL
                  AND s.expires_at > NOW()
                LIMIT 1
                """,
                (token_hash,),
            )
            user = cur.fetchone()
            if not user:
                return None

            cur.execute(
                "UPDATE user_sessions SET last_seen_at = NOW() WHERE id = %s",
                (user["session_id"],),
            )
            conn.commit()
            return user


def refresh_session(
    settings: Any,
    *,
    refresh_token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
    days_valid: int = 14,
) -> dict[str, Any] | None:
    if not postgres_enabled(settings) or not refresh_token:
        return None

    refresh_token_hash = _hash_token(refresh_token)
    new_access_token = secrets.token_urlsafe(48)
    new_refresh_token = secrets.token_urlsafe(48)
    new_access_hash = _hash_token(new_access_token)
    new_refresh_hash = _hash_token(new_refresh_token)
    expires_at = datetime.now(UTC) + timedelta(days=days_valid)

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_sessions
                SET
                    session_token_hash = %s,
                    refresh_token_hash = %s,
                    expires_at = %s,
                    user_agent = COALESCE(%s, user_agent),
                    ip_address = COALESCE(%s, ip_address),
                    last_seen_at = NOW()
                WHERE refresh_token_hash = %s
                  AND revoked_at IS NULL
                  AND expires_at > NOW()
                RETURNING id::text, user_id::text, expires_at
                """,
                (
                    new_access_hash,
                    new_refresh_hash,
                    expires_at,
                    user_agent,
                    ip_address,
                    refresh_token_hash,
                ),
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return None
            conn.commit()

    return {
        "session_id": row["id"],
        "user_id": row["user_id"],
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "expires_at": row["expires_at"],
    }


def revoke_session_by_token(settings: Any, *, token: str) -> bool:
    if not postgres_enabled(settings) or not token:
        return False

    token_hash = _hash_token(token)

    with _connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_sessions
                SET revoked_at = NOW(), last_seen_at = NOW()
                WHERE revoked_at IS NULL
                  AND (
                    session_token_hash = %s
                    OR refresh_token_hash = %s
                  )
                RETURNING id::text
                """,
                (token_hash, token_hash),
            )
            row = cur.fetchone()
            conn.commit()
            return bool(row)
