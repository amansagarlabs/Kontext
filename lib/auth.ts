import type { AuthSession, AuthUser } from "@/lib/types";

const AUTH_TOKEN_KEY = "app-agent-auth-token";
const AUTH_USER_KEY = "app-agent-auth-user";
const PLATFORM_KEY = "app-agent-platform";

// ── Client-side helpers (localStorage) ─────────────────────────────────────

export function saveAuthSession(session: AuthSession, user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  // Also set cookie so Next.js middleware can read it server-side
  document.cookie = `aman_session=${session.access_token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function loadAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(PLATFORM_KEY);
  // Delete cookie so middleware knows user is logged out
  document.cookie = "aman_session=; path=/; max-age=0";
}

export function setPlatform(platform: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLATFORM_KEY, platform);
}

export function getPlatform(): string {
  if (typeof window === "undefined") return "Context-OS Memory";
  return localStorage.getItem(PLATFORM_KEY) || "Context-OS Memory";
}

export function isAuthenticated(): boolean {
  return !!getAuthToken() && !!loadAuthUser();
}

// ── Auth context builder (for API calls) ───────────────────────────────────

export function buildAuthHeaders(platform?: string): Record<string, string> {
  const token = getAuthToken();
  const user = loadAuthUser();
  const plat = platform || getPlatform();

  if (!token || !user) return {};

  return {
    "x-auth-context": JSON.stringify({
      authenticated: true,
      user,
      platform: plat,
      session_token: token,
      scopes: user.plan === "enterprise" || user.plan === "team"
        ? ["memory", "artifacts", "rag", "agents", "mcp", "documents", "crawl:search", "crawl:crawl", "crawl:scrape", "crawl:map", "crawl:extract", "crawl:browser", "crawl:pdf"]
        : user.plan === "pro"
        ? ["memory", "artifacts", "rag", "agents", "mcp", "documents", "crawl:search", "crawl:crawl", "crawl:scrape", "crawl:map", "crawl:extract", "crawl:pdf"]
        : ["memory", "artifacts", "rag", "documents", "crawl:search", "crawl:scrape", "crawl:map"],
    }),
  };
}

// ── Server-side session verification ───────────────────────────────────────

const AUTH_SERVICE_URL = process.env.AMAN_AUTH_SERVICE_URL || "http://localhost:8000";

/**
 * Verify a session token server-side. Used in middleware and API routes.
 * Returns the user object if valid, null otherwise.
 */
export async function verifySession(token: string): Promise<{ user: AuthUser; scopes: string[] } | null> {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.user as AuthUser;
    const scopes = getScopesForPlan(user.plan || "free");
    return { user, scopes };
  } catch {
    return null;
  }
}

/**
 * Get scopes for a given plan tier.
 */
export function getScopesForPlan(plan: string): string[] {
  const scopeMap: Record<string, string[]> = {
    free: ["memory", "artifacts", "rag", "documents", "crawl:search", "crawl:scrape", "crawl:map"],
    pro: ["memory", "artifacts", "rag", "agents", "mcp", "documents", "crawl:search", "crawl:crawl", "crawl:scrape", "crawl:map", "crawl:extract", "crawl:pdf"],
    team: ["memory", "artifacts", "rag", "agents", "mcp", "documents", "crawl:search", "crawl:crawl", "crawl:scrape", "crawl:map", "crawl:extract", "crawl:browser", "crawl:pdf"],
    enterprise: ["memory", "artifacts", "rag", "agents", "mcp", "documents", "crawl:search", "crawl:crawl", "crawl:scrape", "crawl:map", "crawl:extract", "crawl:browser", "crawl:pdf"],
  };
  return scopeMap[plan] || scopeMap.free;
}
