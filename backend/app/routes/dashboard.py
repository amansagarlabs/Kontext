"""
Dashboard API routes — real-time stats for the Context-OS dashboard.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_middleware import AuthContext, require_auth
from app.config import get_settings
from services.memory_store import get_profile_memories, _connect as sqlite_connect
from services.postgres_store import (
    list_recent_conversations,
    postgres_enabled,
    resolve_user_id,
    _connect as pg_connect,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class CrawlUsage(BaseModel):
    used: int = 0
    limit: int = 0
    period: str = "day"


class DashboardStats(BaseModel):
    conversations: int = 0
    memory_entries: int = 0
    artifacts: int = 0
    crawl_jobs: int = 0
    pages_crawled: int = 0
    crawl_scrape: CrawlUsage = CrawlUsage()
    crawl_search: CrawlUsage = CrawlUsage()
    crawl_map: CrawlUsage = CrawlUsage()
    crawl_crawl: CrawlUsage = CrawlUsage()
    errors: list[str] = []


class ConversationItem(BaseModel):
    id: str
    title: str
    updated_at: str
    message_count: int = 0
    last_message: str | None = None


class MemoryItem(BaseModel):
    key: str
    content: str
    source: str
    updated_at: str


def _get_crawl_usage(settings, user_id: str) -> dict[str, dict]:
    """Get crawl usage from Postgres usage_aggregates with correct daily periods."""
    now = datetime.now(timezone.utc)
    resources = {
        "crawl:scrape": "day",
        "crawl:search": "day",
        "crawl:map": "day",
        "crawl:crawl": "month",
    }
    result = {}

    with pg_connect(settings) as conn:
        with conn.cursor() as cur:
            # Get plan limits
            cur.execute("""
                SELECT pl.resource_key, pl.limit_value, pl.limit_period
                FROM plan_limits pl
                JOIN plans p ON p.id = pl.plan_id
                JOIN users u ON u.plan = p.plan_key
                WHERE u.id = %s
            """, (user_id,))
            limits = {row["resource_key"]: row["limit_value"] for row in cur.fetchall()}

            for rk, period in resources.items():
                # Compute correct period start
                if period == "day":
                    period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    if now.month == 12:
                        period_start = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
                    else:
                        period_start = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
                    # For monthly, use start of current month
                    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

                cur.execute("""
                    SELECT COALESCE(SUM(total_quantity), 0) as used
                    FROM usage_aggregates
                    WHERE user_id = %s AND resource_key = %s AND period_start = %s
                """, (user_id, rk, period_start))
                used = cur.fetchone()["used"]

                # Compute reset_at
                if period == "day":
                    reset_at = (now + __import__("datetime").timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    if now.month == 12:
                        reset_at = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
                    else:
                        reset_at = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)

                limit_val = limits.get(rk, 0)
                result[rk] = {
                    "used": used,
                    "limit": limit_val,
                    "period": period,
                    "remaining": max(0, limit_val - used) if limit_val > 0 else -1,
                }

    return result


@router.get("/stats")
async def get_stats(
    platform: str = "both",
    auth: AuthContext = Depends(require_auth),
):
    """Get dashboard stats for the authenticated user.
    platform: 'lab', 'crawl', or 'both'
    """
    settings = get_settings()
    user_id = auth.user_id
    stats = DashboardStats()

    if not user_id:
        return stats

    show_lab = platform in ("lab", "both")
    show_crawl = platform in ("crawl", "both")

    # Count conversations from Postgres (AgentLab)
    if show_lab and postgres_enabled(settings):
        try:
            resolved = resolve_user_id(settings, user_id)
            if resolved:
                conversations = list_recent_conversations(settings, user_id=resolved, limit=50)
                stats.conversations = len(conversations)
        except Exception as e:
            stats.errors.append(f"conversations: {str(e)}")

    # Count memory entries from SQLite (AgentLab)
    if show_lab:
        try:
            memories = get_profile_memories(
                settings,
                user_id=user_id,
                doc_id="general",
                limit=9999,
            )
            stats.memory_entries = len(memories)
        except Exception as e:
            stats.errors.append(f"memory: {str(e)}")

    # Count artifacts (uploaded documents) from Postgres (AgentLab)
    if show_lab and postgres_enabled(settings):
        try:
            with pg_connect(settings) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT COUNT(*) FROM documents WHERE user_id = %s",
                        (user_id,),
                    )
                    row = cur.fetchone()
                    stats.artifacts = row[0] if row else 0
        except Exception as e:
            stats.errors.append(f"artifacts: {str(e)}")

    # Crawl usage from Postgres usage_aggregates (AmanCrawl)
    if show_crawl and postgres_enabled(settings):
        try:
            usage = _get_crawl_usage(settings, user_id)
            if "crawl:scrape" in usage:
                stats.crawl_scrape = CrawlUsage(**usage["crawl:scrape"])
                stats.crawl_jobs = usage["crawl:scrape"]["used"]  # total scrapes = crawl jobs
            if "crawl:search" in usage:
                stats.crawl_search = CrawlUsage(**usage["crawl:search"])
            if "crawl:map" in usage:
                stats.crawl_map = CrawlUsage(**usage["crawl:map"])
            if "crawl:crawl" in usage:
                stats.crawl_crawl = CrawlUsage(**usage["crawl:crawl"])
                stats.pages_crawled = usage["crawl:crawl"]["used"]
        except Exception as e:
            stats.errors.append(f"crawl_usage: {str(e)}")

    return stats.model_dump()


@router.get("/conversations")
async def get_recent_conversations(
    limit: int = 10,
    auth: AuthContext = Depends(require_auth),
):
    """Get recent conversations for the authenticated user."""
    settings = get_settings()
    user_id = auth.user_id

    if not user_id or not postgres_enabled(settings):
        return {"items": []}

    try:
        resolved = resolve_user_id(settings, user_id)
        if not resolved:
            return {"items": []}

        items = list_recent_conversations(settings, user_id=resolved, limit=limit)
        return {"items": items}
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.get("/memories")
async def get_recent_memories(
    limit: int = 10,
    auth: AuthContext = Depends(require_auth),
):
    """Get recent profile memories for the authenticated user."""
    settings = get_settings()
    user_id = auth.user_id

    if not user_id:
        return {"items": []}

    try:
        memories = get_profile_memories(
            settings,
            user_id=user_id,
            doc_id="general",
            limit=limit,
        )
        return {"items": memories}
    except Exception as e:
        return {"items": [], "error": str(e)}
