"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadAuthUser, isAuthenticated, clearAuthSession } from "@/lib/auth";
import { loadWorkspaces } from "@/lib/workspaces";
import { PaperDither } from "@/components/ui/paper-dither";
import {
  fetchDashboardStats,
  fetchRecentConversations,
  fetchRecentMemories,
  type DashboardStats,
  type ConversationItem,
  type MemoryItem,
} from "@/services/dashboard";
import {
  Search,
  FileSearch,
  Globe2,
  Map,
  Loader2,
  ArrowRight,
  LayoutDashboard,
  User,
  Layers,
  Brain,
  FileText,
  Bot,
  Database,
  Globe,
  RefreshCw,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { AuthUser } from "@/lib/types";

type Platform = "lab" | "crawl" | "both";

const TOOLS = [
  { id: "search", label: "Search", icon: Search, color: "amber", scope: "crawl:search", placeholder: "e.g. open source vector databases 2025" },
  { id: "scrape", label: "Scrape", icon: FileSearch, color: "orange", scope: "crawl:scrape", placeholder: "e.g. https://example.com/products" },
  { id: "map", label: "Map", icon: Map, color: "amber", scope: "crawl:map", placeholder: "e.g. https://docs.crewai.com" },
  { id: "crawl", label: "Crawl", icon: Globe2, color: "orange", scope: "crawl:crawl", placeholder: "e.g. https://docs.crewai.com" },
] as const;

const PLAN_FEATURES = {
  free: { label: "Free", artifacts: 5, crawlJobs: 20, memories: 100, pagesCrawled: 500, workspaces: 1, agents: 0, conversations: 20 },
  pro: { label: "Pro", artifacts: 100, crawlJobs: 500, memories: 5000, pagesCrawled: 20000, workspaces: 10, agents: 5, conversations: 200 },
  team: { label: "Team", artifacts: -1, crawlJobs: -1, memories: -1, pagesCrawled: -1, workspaces: -1, agents: -1, conversations: -1 },
  enterprise: { label: "Enterprise", artifacts: -1, crawlJobs: -1, memories: -1, pagesCrawled: -1, workspaces: -1, agents: -1, conversations: -1 },
} as const;

const POLL_INTERVAL = 30000; // 30 seconds

export default function DashboardPage() {
  const router = useRouter();
  const [user] = useState<AuthUser | null>(() => (isAuthenticated() ? loadAuthUser() : null));
  const [workspaceCount] = useState(() => {
    const currentUser = isAuthenticated() ? loadAuthUser() : null;
    return currentUser ? loadWorkspaces(currentUser).length : 0;
  });
  const [platform, setPlatform] = useState<Platform>("both");
  const [activeTab, setActiveTab] = useState("search");
  const [inputValue, setInputValue] = useState("");
  const [toolLoading, setToolLoading] = useState(false);
  const [toolResult, setToolResult] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);

  // Real data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?redirect=/dashboard");
    }
  }, [router]);

  const loadData = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoadingData(true);
    setFetchErrors([]);
    try {
      const [s, c, m] = await Promise.all([
        fetchDashboardStats(platform).catch((e) => {
          setFetchErrors((prev) => [...prev, `stats: ${e.message}`]);
          return null;
        }),
        platform === "crawl"
          ? Promise.resolve([])
          : fetchRecentConversations(8).catch((e) => {
              setFetchErrors((prev) => [...prev, `conversations: ${e.message}`]);
              return [];
            }),
        platform === "crawl"
          ? Promise.resolve([])
          : fetchRecentMemories(5).catch((e) => {
              setFetchErrors((prev) => [...prev, `memories: ${e.message}`]);
              return [];
            }),
      ]);
      if (s) setStats(s);
      setConversations(c);
      setMemories(m);
      setLastRefresh(new Date());
    } finally {
      setLoadingData(false);
    }
  }, [user, platform]);

  useEffect(() => {
    if (!user) return;
    const id = setTimeout(() => {
      void loadData(true);
    }, 0);
    return () => clearTimeout(id);
  }, [user, loadData]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      void loadData(false);
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [user, loadData]);

  const plan = (user?.plan as keyof typeof PLAN_FEATURES) || "free";
  const features = PLAN_FEATURES[plan];
  const initials = user
    ? (user.full_name || user.email || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";
  const displayName = user?.full_name || user?.username || user?.email?.split("@")[0] || "User";

  const runTool = useCallback(async () => {
    const val = inputValue.trim();
    if (!val || toolLoading) return;
    setToolLoading(true);
    setToolResult(null);
    setToolError(null);
    try {
      const body = activeTab === "search"
        ? { query: val, num_results: 5 }
        : { url: val, formats: ["markdown"], timeout: 30 };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/amancrawl/${activeTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Request failed" }));
        if (res.status === 401) { clearAuthSession(); router.replace("/login?redirect=/dashboard"); return; }
        throw new Error(err.detail || "Request failed");
      }
      setToolResult(JSON.stringify(await res.json(), null, 2));
      void loadData(false);
    } catch (e: unknown) {
      setToolError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setToolLoading(false);
    }
  }, [inputValue, activeTab, toolLoading, router, loadData]);

  if (!user) return null;

  // Filter stats based on platform
  const showConversations = platform !== "crawl";
  const showCrawl = platform !== "lab";

  const revealSection = (id: string) => {
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const openRetrievalTool = (tool: string) => {
    setPlatform("both");
    setActiveTab(tool);
    revealSection("retrieval-tool");
  };

  return (
    <div className="dark flex min-h-screen bg-[#070707] text-white">
      {/* ── SIDEBAR ── */}
      <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0a0a09] py-5 lg:flex">
        <div className="mb-3 border-b border-white/[0.08] px-5 pb-5">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.03em] text-white">
            <span aria-hidden="true" className="size-6 rounded-full bg-[linear-gradient(135deg,#fff5a5,#f6e66c_42%,#f27a28)]" />
            kontext
          </Link>
          <div className="mt-3 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
            <span className="size-1.5 rounded-full bg-[#f6e879] shadow-[0_0_10px_rgba(246,232,121,0.7)]" />
            Workspace operational
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <div className="px-3 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">Workspace</div>
          <SideLink icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active />
          <SideLink icon={<User className="w-4 h-4" />} label="Profile" onClick={() => router.push("/profile")} />
          <SideLink icon={<Layers className="w-4 h-4" />} label="Workspaces" badge={workspaceCount} onClick={() => router.push("/workspaces")} />

          <div className="px-3 pb-1 pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">Context layer</div>
          <SideLink icon={<Brain className="w-4 h-4" />} label="Memory" badge={stats?.memory_entries ?? 0} onClick={() => router.push("/memory")} />
          <SideLink icon={<FileText className="w-4 h-4" />} label="Artifacts" badge={stats?.artifacts ?? 0} onClick={() => router.push("/artifacts")} />
          <SideLink icon={<Bot className="w-4 h-4" />} label="Agents" badge={features.agents} locked={features.agents === 0} onClick={() => router.push("/chat")} />

          <div className="px-3 pb-1 pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">Retrieval tools</div>
          <SideLink icon={<Search className="w-4 h-4" />} label="Search" onClick={() => openRetrievalTool("search")} />
          <SideLink icon={<Globe className="w-4 h-4" />} label="Crawl" onClick={() => openRetrievalTool("crawl")} />
          <SideLink icon={<FileSearch className="w-4 h-4" />} label="Scrape" onClick={() => openRetrievalTool("scrape")} />
          <SideLink icon={<Map className="w-4 h-4" />} label="Map" onClick={() => openRetrievalTool("map")} />
          <SideLink icon={<Database className="w-4 h-4" />} label="Crawl History" badge={stats?.crawl_jobs ?? 0} onClick={() => router.push("/amancrawl")} />
        </nav>

        <div className="mt-auto border-t border-white/[0.08] px-3 pt-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.05]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f6e879] text-[10px] font-bold text-[#171814]">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-medium text-white/85">{displayName}</div>
              <div className="text-[10px] text-white/35">{features.label} plan</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1440px] p-4 sm:p-7 lg:p-8">
        {/* Topbar */}
        <div className="relative mb-6 overflow-hidden rounded-[22px] border border-white/10 bg-[#0d0b08] p-5 sm:p-7">
          <PaperDither
            className="inset-y-0 right-0 w-[58%] opacity-80"
            dark={{ colorBack: "#0d0b0800", colorFront: "#e85d18" }}
            light={{ colorBack: "#0d0b0800", colorFront: "#e85d18" }}
            eager
            maxPixelCount={900 * 420}
            scale={0.72}
            shape="wave"
            size={2.2}
            speed={0.16}
            type="4x4"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#0d0b08_0%,rgba(13,11,8,0.92)_44%,rgba(13,11,8,0.16)_100%)]" />
          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end">
          <div className="flex-1">
            <div className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#f6e879]"><Sparkles className="size-3.5" /> Live context</div>
            <h1 className="font-heading text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">Good to see you, {displayName}.</h1>
            <p className="mt-2 text-sm text-white/45">
              {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · All systems operational
              {lastRefresh && (
                <span className="ml-2 text-[10px] text-white/30">
                  · Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/35 p-1 backdrop-blur">
            {([["lab", "Kontext Memory", "#e67d2b"], ["crawl", "Kontext Crawl", "#c9671d"], ["both", "Both", "#8b7f72"]] as const).map(([p, label, color]) => (
              <button key={p} onClick={() => setPlatform(p)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${platform === p ? "bg-white/10 text-white" : "text-white/45 hover:text-white/80"}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => void loadData(false)} disabled={loadingData} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white/55 transition hover:bg-white/10 hover:text-white" title="Refresh now">
            <RefreshCw className={`size-3.5 ${loadingData ? "animate-spin" : ""}`} /> Refresh
          </button>
          </div>
          </div>
        </div>

        {/* ── FETCH ERRORS ── */}
        {fetchErrors.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <span className="font-medium">Some data couldn&apos;t load:</span>
              <ul className="mt-1 space-y-0.5">
                {fetchErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* ── STATS ── */}
            <div className={`mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 ${showConversations && showCrawl ? "xl:grid-cols-4" : showConversations || showCrawl ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>
          {showConversations && (
            <>
              <StatCard color="#e67d2b" label="Conversations" value={stats?.conversations ?? 0} max={features.conversations} loading={loadingData} />
              <StatCard color="#c9671d" label="Memory entries" value={stats?.memory_entries ?? 0} max={features.memories} loading={loadingData} />
              <StatCard color="#f08a35" label="Artifacts" value={stats?.artifacts ?? 0} max={features.artifacts} loading={loadingData} />
            </>
          )}
          {showCrawl && (
            <>
              <StatCard color="#e67d2b" label="Scrapes today" value={stats?.crawl_scrape?.used ?? 0} max={stats?.crawl_scrape?.limit ?? 0} loading={loadingData} />
              {!showConversations && (
                <>
                  <StatCard color="#c9671d" label="Searches today" value={stats?.crawl_search?.used ?? 0} max={stats?.crawl_search?.limit ?? 0} loading={loadingData} />
                  <StatCard color="#f08a35" label="Maps today" value={stats?.crawl_map?.used ?? 0} max={stats?.crawl_map?.limit ?? 0} loading={loadingData} />
                </>
              )}
              <StatCard color="#e67d2b" label="Crawls this month" value={stats?.crawl_crawl?.used ?? 0} max={stats?.crawl_crawl?.limit ?? 0} loading={loadingData} />
            </>
          )}
        </div>

        {/* ── QUICK TOOL ── */}
        {showCrawl && (
          <div id="retrieval-tool" className="mb-6 scroll-mt-6 rounded-2xl border border-[#e5d8c9] bg-[#fffdfa] p-4 dark:border-white/10 dark:bg-[#111111]">
            <div className="flex gap-1 mb-3 border-b border-[#e5d8c9] dark:border-white/10 pb-2.5">
              {TOOLS.map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === t.id ? "bg-[#fff1e8] text-[#e67d2b]" : "text-[#8b7f72] hover:text-[#201510] dark:hover:text-white/80"}`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runTool()} placeholder={TOOLS.find((t) => t.id === activeTab)?.placeholder} className="flex-1 bg-[#fffdfa] dark:bg-[#090909] border border-[#e5d8c9] dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#e67d2b] transition placeholder:text-[#b49d8b] dark:placeholder:text-white/30" />
              <button onClick={runTool} disabled={toolLoading || !inputValue.trim()} className="px-5 py-2.5 bg-[#e67d2b] text-white rounded-xl text-sm font-semibold transition hover:bg-[#c9671d] disabled:opacity-40 flex items-center gap-2">
                {toolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Run
              </button>
            </div>
            {toolError && <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">{toolError}</div>}
            {toolResult && <pre className="mt-3 p-3 rounded-xl bg-[#fffdfa] dark:bg-[#090909] border border-[#e5d8c9] dark:border-white/10 text-[11px] text-[#666] dark:text-white/60 font-mono max-h-48 overflow-auto whitespace-pre-wrap">{toolResult}</pre>}
          </div>
        )}

        {/* ── TWO COL: Conversations + Memories ── */}
        {showConversations && (
          <div id="context-activity" className="mb-6 grid scroll-mt-6 grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Recent Conversations */}
            <Panel title="Recent Conversations" count={conversations.length} color="#e67d2b" icon={<MessageIcon />}>
              {loadingData ? (
                <LoadingSkeleton rows={4} />
              ) : conversations.length === 0 ? (
                <EmptyState message="No conversations yet" sub="Start a chat to see your history here" />
              ) : (
                conversations.map((c) => (
                <Link key={c.id} href={`/chat?id=${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f1e8dc] dark:hover:bg-white/5 transition border-b border-[#e5d8c9] dark:border-white/10 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-[#fff1e8] flex items-center justify-center shrink-0">
                      <MessageIcon className="w-4 h-4 text-[#e67d2b]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.title || "Untitled"}</div>
                      <div className="text-[11px] text-[#999] dark:text-[#555a6b] mt-0.5">{timeAgo(c.updated_at)}</div>
                    </div>
                  </Link>
                ))
              )}
            </Panel>

            {/* Recent Memories */}
            <Panel title="Recent Memory" count={memories.length} color="#c9671d" icon={<Brain className="w-3.5 h-3.5" />}>
              {loadingData ? (
                <LoadingSkeleton rows={4} />
              ) : memories.length === 0 ? (
                <EmptyState message="No memories yet" sub="Your profile facts will appear here" />
              ) : (
                memories.map((m, i) => (
                  <div key={i} className="flex gap-3 px-4 py-2.5 border-b border-[#e5d8c9] dark:border-white/10 last:border-0">
                    <div className="w-0.5 rounded-full bg-[#e67d2b]/40 shrink-0 mt-1" style={{ minHeight: 32 }} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#666] dark:text-white/70">{m.key.replace(/_/g, " ")}</div>
                      <div className="text-[11px] text-[#999] dark:text-[#555a6b] mt-0.5 line-clamp-2">{m.content}</div>
                      <div className="text-[10px] text-[#bbb] dark:text-[#555a6b] mt-1">{timeAgo(m.updated_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </Panel>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function SideLink({ icon, label, active, badge, locked, onClick }: { icon: React.ReactNode; label: string; active?: boolean; badge?: number | string; locked?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={locked} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition ${active ? "bg-[#f6e879] font-semibold text-[#171814]" : "text-white/45 hover:bg-white/[0.05] hover:text-white/80"} ${locked ? "cursor-not-allowed opacity-35" : ""}`}>
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-black/10 text-[#171814]" : "bg-white/[0.06] text-white/40"}`}>{badge}</span>}
    </button>
  );
}

function StatCard({ color, label, value, max, loading }: { color: string; label: string; value: number; max: number; loading: boolean }) {
  const display = max === -1 ? "∞" : `${value}/${max}`;
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#10100f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="absolute inset-x-0 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, ${color}, transparent 72%)` }} />
      <div className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-white/40">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-white/10" />
      ) : (
        <div className="text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
      )}
      <div className="mt-1 text-[11px] text-white/30">{loading ? "..." : display}</div>
    </div>
  );
}

function Panel({ title, count, color, icon, children }: { title: string; count: number; color: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#10100f]">
      <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</span>
        <span className="ml-auto rounded-full border border-white/[0.08] bg-black/35 px-2 py-0.5 text-[10px] text-white/40">{count}</span>
      </div>
      <div className="max-h-72 overflow-y-auto">{children}</div>
    </div>
  );
}

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded bg-white/10 animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-sm font-medium text-white/70">{message}</div>
      <div className="mt-1 text-[11px] text-white/30">{sub}</div>
    </div>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return <FileText className={className} />;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return dateStr;
  }
}
