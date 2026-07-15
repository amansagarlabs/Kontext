# 16 June 2026 — Session Updates

## CrewAI Integration (Completed)

- Created `backend/agents/` directory with multi-agent orchestration
- `agents/__init__.py` — Package exports
- `agents/tools.py` — 7 CrewAI tool adapters: JinaReaderTool, Crawl4AITool, LLMScraperTool, ScrapeGraphAITool, WebSearchTool, SiteMapTool
- `agents/crawl_agents.py` — 5 specialized agents (read, crawl, extract, graph, coordinator) + crew factory functions with instruction support
- `agents/flows.py` — `AmanCrawlFlow` with `@start`/`@listen` routing for scrape/crawl/search/map/research
- 4 new API endpoints: `/api/amancrawl/crew/scrape`, `/crew/crawl`, `/crew/research`, `/flow`
- Fixed CrewAI install upgrading Starlette to 1.3.1 breaking FastAPI 0.115.6 — pinned `starlette>=0.36.3,<1.0.0`
- Updated `requirements.txt` with crewai dependencies

## Auth System (Completed)

- `backend/app/auth_middleware.py` — `get_auth_context()`, `require_scope()`, `require_auth()`, `log_operation()`, scope definitions per plan tier (free/pro/team/enterprise)
- `middleware.ts` — Next.js middleware verifying sessions via `/api/auth/me`, injecting `x-auth-context` header, blocking unauthenticated routes
- `lib/auth.ts` — Added `verifySession()`, `buildAuthHeaders()`, `getScopesForPlan()`, `isAuthenticated()`, `setPlatform()`, cookie sync for middleware
- `lib/types.ts` — Extended `AuthUser` with `plan`, `avatar_url`, `platforms`, `workspaces`; added `AuthContext`, `AuthError` types
- `app/routes/amancrawl.py` — All endpoints wired with `require_scope()` / `require_auth()` dependencies + audit logging
- `backend/app/config.py` — Added `aman_jwt_secret`, `aman_session_duration_days`, `aman_api_key_header`, `aman_auth_service_url`
- `.env` — Added auth env vars

## Dashboard (Completed)

- `app/dashboard/page.tsx` — Full dashboard with auth guard, plan-aware features, dark theme
- Sidebar with AgentLab + AmanCrawl sections
- Platform switcher (AgentLab / AmanCrawl / Both)
- Auth chip with user avatar + plan badge
- Stats row, quick actions, workspace grid, artifacts/crawls panels, memory thread
- Plan-based feature gating: Free (limited) → Pro → Team → Enterprise (∞)

## AmanCrawl Page Updates

- Profile avatar in header when authenticated (links to /dashboard)
- Advanced options toggle with AI instruction textarea
- Context-aware placeholders per tool (search/scrape/map/crawl)
- Instructions passed through frontend → service → backend → CrewAI agents

## Bug Fixes

- Login form now reads `?redirect=` query param and redirects after auth
- `saveAuthSession()` sets `aman_session` cookie for Next.js middleware (server-side can't read localStorage)
- `clearAuthSession()` deletes the cookie on logout
- Fixed TypeScript errors in auth types

## Files Created/Modified

### Created
- `backend/agents/__init__.py`
- `backend/agents/tools.py`
- `backend/agents/crawl_agents.py`
- `backend/agents/flows.py`
- `backend/app/auth_middleware.py`
- `middleware.ts`
- `app/dashboard/page.tsx`
- `16-june-updates.md`

### Modified
- `backend/app/routes/amancrawl.py` — Auth + instruction support
- `backend/app/config.py` — Auth env vars
- `backend/requirements.txt` — crewai + starlette pin
- `lib/auth.ts` — Cookie sync + server-side helpers
- `lib/types.ts` — Extended auth types
- `services/amancrawl.ts` — Auth headers + instruction param
- `app/amancrawl/page.tsx` — Profile avatar + advanced options
- `components/auth/AuthForm.tsx` — Redirect query param support
- `app/globals.css` — Pulse animation
- `.env` — Auth env vars
