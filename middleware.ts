import { NextRequest, NextResponse } from "next/server";

const AUTH_SERVICE_URL = process.env.AMAN_AUTH_SERVICE_URL || "http://localhost:8000";

// Protected route prefixes
const PROTECTED_PATHS = [
  "/dashboard",
  "/workspace",
  "/chat",
  "/settings",
];

const API_PROTECTED_PATHS = [
  "/api/agent",
  "/api/crawl",
  "/api/amancrawl",
];

function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_PATHS.some((p) => pathname.startsWith(p)) ||
    API_PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  );
}

function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/pricing",
    "/about",
    "/amancrawl",
  ];
  // Public if it's an exact match or is a sub-page of a public product page
  return (
    publicPaths.includes(pathname) ||
    pathname.startsWith("/amancrawl/")
  );
}

async function verifySession(
  token: string
): Promise<{ user: Record<string, unknown>; scopes: string[] } | null> {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.user;
    const scopes = getScopesForPlan(user.plan || "free");
    return { user, scopes };
  } catch {
    return null;
  }
}

function getScopesForPlan(plan: string): string[] {
  const scopeMap: Record<string, string[]> = {
    free: [
      "memory",
      "artifacts",
      "rag",
      "documents",
      "crawl:search",
      "crawl:scrape",
      "crawl:map",
    ],
    pro: [
      "memory",
      "artifacts",
      "rag",
      "agents",
      "mcp",
      "documents",
      "crawl:search",
      "crawl:crawl",
      "crawl:scrape",
      "crawl:map",
      "crawl:extract",
      "crawl:pdf",
    ],
    team: [
      "memory",
      "artifacts",
      "rag",
      "agents",
      "mcp",
      "documents",
      "crawl:search",
      "crawl:crawl",
      "crawl:scrape",
      "crawl:map",
      "crawl:extract",
      "crawl:browser",
      "crawl:pdf",
    ],
    enterprise: [
      "memory",
      "artifacts",
      "rag",
      "agents",
      "mcp",
      "documents",
      "crawl:search",
      "crawl:crawl",
      "crawl:scrape",
      "crawl:map",
      "crawl:extract",
      "crawl:browser",
      "crawl:pdf",
    ],
  };
  return scopeMap[plan] || scopeMap.free;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip middleware for static files and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("aman_session")?.value ?? null;
  const platform =
    req.headers.get("x-aman-platform") ??
    (pathname.startsWith("/amancrawl") ? "Context-OS Crawl" : "Context-OS Memory");

  // ── Verify session if token exists ────────────────────────────────────
  let session: { user: Record<string, unknown>; scopes: string[] } | null =
    null;
  if (token) {
    session = await verifySession(token);
  }

  // ── Build auth context header ─────────────────────────────────────────
  const authContext = {
    authenticated: !!session,
    user: session?.user ?? null,
    platform,
    session_token: token,
    scopes: session?.scopes ?? [],
  };

  const headers = new Headers(req.headers);
  headers.set("x-auth-context", JSON.stringify(authContext));
  headers.set("x-aman-platform", platform);

  // ── Handle expired / invalid token ────────────────────────────────────
  if (token && !session) {
    // Token was provided but is invalid/expired
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "unauthenticated",
          message: "Session expired. Please sign in again.",
          action: "refresh_token",
        },
        { status: 401, headers }
      );
    }
    // Redirect to login with return path
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("aman_session");
    return res;
  }

  // ── Protected routes: block unauthenticated ───────────────────────────
  if (isProtectedPath(pathname) && !session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "unauthenticated",
          message: "Please sign in to continue.",
          action: "redirect_to_login",
        },
        { status: 401, headers }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Pass through with auth context ────────────────────────────────────
  return NextResponse.next({ headers });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workspace/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/api/agent/:path*",
    "/api/crawl/:path*",
    "/api/amancrawl/:path*",
    "/amancrawl/:path*",
  ],
};
