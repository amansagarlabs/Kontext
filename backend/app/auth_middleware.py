"""
Shared auth middleware — validates sessions, enforces scopes.

Used by both Kontext Memory and Kontext Crawl backends.
Auth context flows from Next.js middleware → x-auth-context header → here.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Callable

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from services.auth_store import get_user_from_token

logger = logging.getLogger("aman.auth")

# ── Scope definitions ──────────────────────────────────────────────────────

AGENTLAB_SCOPES = {
    "memory": "Memory read/write",
    "artifacts": "Artifact read/write",
    "rag": "RAG query",
    "agents": "Agent execution",
    "mcp": "MCP tool call",
    "documents": "Document parsing",
}

CRAWL_SCOPES = {
    "crawl:search": "Web search",
    "crawl:crawl": "Deep crawl",
    "crawl:scrape": "Page scraping",
    "crawl:map": "Site mapping",
    "crawl:extract": "Data extraction",
    "crawl:browser": "Browser automation",
    "crawl:pdf": "PDF processing",
}

ALL_SCOPES = {**AGENTLAB_SCOPES, **CRAWL_SCOPES}

# Default scopes granted per plan
PLAN_SCOPES: dict[str, list[str]] = {
    "free": [
        "memory", "artifacts", "rag", "documents",
        "crawl:search", "crawl:scrape", "crawl:map",
    ],
    "pro": [
        "memory", "artifacts", "rag", "agents", "mcp", "documents",
        "crawl:search", "crawl:crawl", "crawl:scrape", "crawl:map", "crawl:extract", "crawl:pdf",
    ],
    "team": list(ALL_SCOPES.keys()),
    "enterprise": list(ALL_SCOPES.keys()),
}


# ── Auth context dataclass ─────────────────────────────────────────────────

@dataclass
class AuthContext:
    authenticated: bool
    user: dict[str, Any] | None = None
    platform: str = "Kontext Memory"
    session_token: str | None = None
    scopes: list[str] = field(default_factory=list)
    api_key: str | None = None

    @property
    def user_id(self) -> str | None:
        return self.user.get("id") if self.user else None

    @property
    def plan(self) -> str:
        return self.user.get("plan", "free") if self.user else "free"


# ── Token-based auth (cookie / bearer) ────────────────────────────────────

_bearer_scheme = HTTPBearer(auto_error=False)


async def _resolve_user_from_token(token: str) -> dict[str, Any] | None:
    """Look up user from a session token via Postgres."""
    settings = get_settings()
    return get_user_from_token(settings, token)


def _scopes_for_user(user: dict[str, Any]) -> list[str]:
    """Return the scope list for a user's plan."""
    plan = user.get("plan", "free")
    return PLAN_SCOPES.get(plan, PLAN_SCOPES["free"])


# ── Primary dependency: extract auth from x-auth-context header ────────────

async def get_auth_context(request: Request) -> AuthContext:
    """
    Extract auth context from the x-auth-context header (set by Next.js middleware)
    or fall back to bearer token / cookie auth.
    """
    # 1. Try x-auth-context header (set by Next.js middleware)
    raw_header = request.headers.get("x-auth-context")
    if raw_header:
        try:
            ctx = json.loads(raw_header)
            if not ctx.get("authenticated") or not ctx.get("user") or not ctx.get("session_token"):
                return AuthContext(authenticated=False, platform=ctx.get("platform", "Kontext Memory"))
            return AuthContext(
                authenticated=True,
                user=ctx["user"],
                platform=ctx.get("platform", "Kontext Memory"),
                session_token=ctx.get("session_token"),
                scopes=ctx.get("scopes", []),
            )
        except (json.JSONDecodeError, KeyError):
            pass

    # 2. Try bearer token
    auth_header = request.headers.get("authorization", "")
    token = None
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()

    # 3. Try aman_session cookie
    if not token:
        token = request.cookies.get("aman_session")

    if not token:
        return AuthContext(authenticated=False)

    # 4. Validate token against Postgres
    user = await _resolve_user_from_token(token)
    if not user:
        return AuthContext(authenticated=False, session_token=token)

    platform = request.headers.get("x-aman-platform", "Kontext Memory")
    scopes = _scopes_for_user(user)

    return AuthContext(
        authenticated=True,
        user=user,
        platform=platform,
        session_token=token,
        scopes=scopes,
    )


# ── API key auth (for external MCP / agent calls) ─────────────────────────

async def get_api_key(request: Request) -> str | None:
    """Extract API key from X-Aman-API-Key header."""
    return request.headers.get("x-aman-api-key")


# ── Scope-checking dependency factory ──────────────────────────────────────

def require_scope(scope: str):
    """
    Dependency factory — verifies the authenticated user has the required scope.

    Usage:
        @router.post("/scrape")
        async def scrape(ctx = Depends(require_scope("crawl:scrape"))):
            ...
    """
    async def _check(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if not auth.authenticated or not auth.user or not auth.session_token:
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "unauthenticated",
                    "message": "Please sign in to continue.",
                    "action": "redirect_to_login",
                },
            )
        if scope not in auth.scopes:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "forbidden",
                    "message": "Your account does not have permission for this operation.",
                    "missing_scope": scope,
                    "action": "upgrade_plan",
                },
            )
        return auth
    return _check


# ── Lightweight auth check (no scope enforcement, just auth) ───────────────

async def require_auth(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
    """Dependency — rejects unauthenticated requests, no scope check."""
    if not auth.authenticated or not auth.user or not auth.session_token:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "unauthenticated",
                "message": "Please sign in to continue.",
                "action": "redirect_to_login",
            },
        )
    return auth


# ── Operation logger ───────────────────────────────────────────────────────

def log_operation(
    auth: AuthContext,
    operation_type: str,
    platform: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Log an authenticated operation for audit trail."""
    logger.info(
        "operation",
        extra={
            "user_id": auth.user_id,
            "platform": platform or auth.platform,
            "operation_type": operation_type,
            "timestamp": datetime.now(UTC).isoformat(),
            **(extra or {}),
        },
    )


# ── Session expiry check ──────────────────────────────────────────────────

def is_session_expired(expires_at: str | None) -> bool:
    """Check if a session has expired."""
    if not expires_at:
        return True
    try:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        return datetime.now(UTC) > exp
    except (ValueError, TypeError):
        return True
