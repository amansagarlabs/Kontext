"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Globe2,
  Search,
  FileSearch,
  Code2,
  Shield,
  Zap,
  Database,
  FileText,
  GitBranch,
  X,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Square,
} from "lucide-react";

import { AgentNavigation } from "@/components/ui/agent-navigation";
import { PaperDither } from "@/components/ui/paper-dither";
import { ScrollArea } from "@/components/ui/scroll-area";
import SubscriptionModal from "@/components/SubscriptionModal";
import LimitReachedModal from "@/components/LimitReachedModal";
import UsageCounter from "@/components/UsageCounter";
import {
  scrapeUrl,
  crawlSite,
  mapSite,
  searchWeb,
  refinePrompt,
  agentExtract,
  LimitReachedError,
  type ScrapeResult,
  type CrawlResult,
  type MapResult,
  type SearchResult,
  type AgentExtractResult,
  type LimitError,
} from "@/services/amancrawl";
import { isAuthenticated, loadAuthUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

const tabs = [
  { id: "search", label: "Search", icon: Search },
  { id: "scrape", label: "Scrape", icon: FileSearch },
  { id: "agent", label: "Agent", icon: Sparkles },
  { id: "map", label: "Map", icon: Globe2 },
  { id: "crawl", label: "Crawl", icon: Globe2 },
];

const features = [
  {
    icon: Search,
    title: "Search",
    description: "Search the web with AI-powered understanding. Find relevant content across millions of pages.",
  },
  {
    icon: Globe2,
    title: "Crawl",
    description: "Intelligent crawling that respects robots.txt while discovering all important pages on a site.",
  },
  {
    icon: FileText,
    title: "Scrape",
    description: "Extract clean markdown, structured data, or screenshots from any webpage at scale.",
  },
  {
    icon: Globe2,
    title: "Map",
    description: "Discover the full structure of a website. Map all pages and their relationships.",
  },
  {
    icon: Code2,
    title: "API & SDK",
    description: "REST API, TypeScript SDK, Python SDK, and MCP integration for any workflow.",
  },
  {
    icon: Shield,
    title: "Browser Automation",
    description: "Handle JavaScript-heavy sites, SPAs, and dynamic content with headless browser support.",
  },
];

const useCases = [
  {
    title: "RAG Applications",
    description: "Feed clean, structured web data into your retrieval-augmented generation pipeline.",
    icon: Database,
  },
  {
    title: "AI Agents",
    description: "Give your agents the ability to search, browse, and extract information from the web.",
    icon: Zap,
  },
  {
    title: "Topic Research",
    description: "Monitor competitors, track changes, and gather intelligence at scale.",
    icon: Search,
  },
  {
    title: "Content Extraction",
    description: "Turn messy web pages into clean, structured data for analysis and storage.",
    icon: FileText,
  },
];

function friendlyError(e: unknown): string {
  if (!(e instanceof Error)) return "Something went wrong. Please try again.";
  const msg = e.message.toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("econnrefused")) {
    return "Unable to connect to the server. Please check your connection and try again.";
  }
  if (msg.includes("403") || msg.includes("forbidden")) {
    return "This website blocked the request. Try a different URL or use the Search tab instead.";
  }
  if (msg.includes("404") || msg.includes("not found")) {
    return "Page not found. Please check the URL and try again.";
  }
  if (msg.includes("429") || msg.includes("too many")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) {
    return "Server error. The service may be temporarily unavailable. Please try again later.";
  }
  if (msg.includes("timeout")) {
    return "Request timed out. The page may be too slow to respond. Try again or use a different URL.";
  }
  // Return original message for recognized errors
  return e.message || "Something went wrong. Please try again.";
}

// ── Result sub-components (Perplexity-style) ──────────────────────────────

function SearchResultsList({ result, showAll }: { result: SearchResult; showAll?: boolean }) {
  const items = showAll ? result.results : result.results.slice(0, 8);
  return (
    <div>
      <p className="mb-3 text-xs text-[#666666] dark:text-white/50">
        {result.results.length} results for &quot;{result.query}&quot;
      </p>
      <ScrollArea maxHeight="32rem" className="pr-2">
        <div className="space-y-2">
          {items.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-[#e5e7eb] bg-white p-3 transition hover:border-[#fa5a19]/30 hover:shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:border-[#fa5a19]/30"
            >
              <div className="flex items-start gap-3">
                <Image
                  src={`https://www.google.com/s2/favicons?domain=${new URL(r.url).hostname}&sz=32`}
                  alt=""
                  width={16}
                  height={16}
                  className="mt-0.5 h-4 w-4 rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#201510] group-hover:text-[#fa5a19] dark:text-white dark:group-hover:text-[#fa5a19]">
                    {r.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#999999] dark:text-white/40">
                    {new URL(r.url).hostname}
                  </p>
                  {r.snippet && (
                    <p className="mt-1.5 text-xs leading-relaxed text-[#666666] dark:text-white/60">
                      {r.snippet}
                    </p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ScrapeResultView({ result }: { result: ScrapeResult }) {
  const [expanded, setExpanded] = useState(false);
  const content = result.markdown || result.text || "";
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#fa5a19]" />
        <span className="text-sm font-semibold text-[#201510] dark:text-white">
          {result.title || "Scraped Content"}
        </span>
        <span className="rounded-full bg-[#f3eee7] px-2 py-0.5 text-[10px] text-[#999999] dark:bg-white/5 dark:text-white/40">
          {result.content_length?.toLocaleString()} chars
        </span>
      </div>
      {result.description && (
        <p className="mb-3 text-xs text-[#666666] dark:text-white/50">{result.description}</p>
      )}
      {result.headings && result.headings.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {result.headings.slice(0, 8).map((h, i) => (
            <span key={i} className="rounded-full bg-[#e5e7eb] px-2 py-0.5 text-[10px] text-[#666666] dark:bg-white/10 dark:text-white/50">
              {h.text}
            </span>
          ))}
        </div>
      )}
      <div className={`relative rounded-xl border border-[#e5e7eb] bg-[#faf7f2] p-4 dark:border-white/10 dark:bg-white/5 ${!expanded ? "max-h-[16rem] overflow-hidden" : ""}`}>
        <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-[#666666] dark:text-white/70">
          {content.slice(0, expanded ? 10000 : 2000)}
        </pre>
        {!expanded && content.length > 2000 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#faf7f2] to-transparent pt-8 dark:from-[#0a0a0a]">
            <button
              onClick={() => setExpanded(true)}
              className="mx-auto flex items-center gap-1 text-xs font-medium text-[#fa5a19] hover:underline"
            >
              Read more <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CrawlResultView({ result }: { result: CrawlResult }) {
  return (
    <div>
      <p className="mb-3 text-xs text-[#666666] dark:text-white/50">
        {result.pages_crawled} pages crawled from {result.start_url}
      </p>
      <ScrollArea maxHeight="32rem" className="pr-2">
        <div className="space-y-2">
          {result.pages.map((page) => (
            <a
              key={page.url}
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-[#e5e7eb] bg-white p-3 transition hover:border-[#fa5a19]/30 dark:border-white/10 dark:bg-white/5 dark:hover:border-[#fa5a19]/30"
            >
              <div className="flex items-start gap-3">
                <Globe2 className="mt-0.5 h-4 w-4 text-[#fa5a19]/60" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#201510] group-hover:text-[#fa5a19] dark:text-white">
                    {page.title || page.url}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#999999] dark:text-white/40">
                    {page.url}
                  </p>
                  <p className="mt-1 text-[10px] text-[#666666] dark:text-white/40">
                    {page.content_length.toLocaleString()} chars
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function MapResultView({ result, showAll }: { result: MapResult; showAll?: boolean }) {
  const links = showAll ? result.links : result.links.slice(0, 30);
  return (
    <div>
      <p className="mb-3 text-xs text-[#666666] dark:text-white/50">
        {result.total_links} links discovered from {result.start_url}
      </p>
      <ScrollArea maxHeight="32rem" className="pr-2">
        <div className="space-y-1">
          {links.map((link) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#666666] transition hover:bg-[#f3eee7] hover:text-[#fa5a19] dark:text-white/50 dark:hover:bg-white/5"
            >
              <span className="h-1 w-1 rounded-full bg-[#fa5a19]/40" />
              <span className="truncate">{link}</span>
            </a>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function AgentResultView({ result }: { result: AgentExtractResult }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#fa5a19]" />
        <span className="text-sm font-semibold text-[#201510] dark:text-white">
          Agent Extraction
        </span>
        <span className="rounded-full bg-[#f3eee7] px-2 py-0.5 text-[10px] text-[#999999] dark:bg-white/5 dark:text-white/40">
          {result.tokens_used} tokens
        </span>
      </div>
      {result.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#e5e7eb] bg-[#1a1a1a] p-4 dark:border-white/10">
          <pre className="max-h-[20rem] overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-white/70">
            <code>{typeof result.result === "string" ? result.result : JSON.stringify(result.result, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

type SourceLink = {
  title: string;
  url: string;
  note?: string;
};

type AmanCrawlResultValue =
  | ScrapeResult
  | CrawlResult
  | MapResult
  | SearchResult
  | AgentExtractResult
  | { answer: string; raw: ScrapeResult | CrawlResult | MapResult | SearchResult | AgentExtractResult; provider?: string; latency_ms?: number };

function safeHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

function friendlyLinkLabel(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const tail = segments.at(-1) || parsed.hostname;
    return decodeURIComponent(tail.replace(/[-_]+/g, " "));
  } catch {
    return rawUrl;
  }
}

function extractLinksFromText(text: string): SourceLink[] {
  const seen = new Set<string>();
  const items: SourceLink[] = [];

  const add = (url: string, title?: string) => {
    const cleaned = url.trim();
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    items.push({
      title: title || friendlyLinkLabel(cleaned),
      url: cleaned,
      note: safeHostname(cleaned),
    });
  };

  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  for (const match of text.matchAll(markdownLinkPattern)) {
    add(match[2], match[1]);
  }

  const bareUrlPattern = /(https?:\/\/[^\s)<>"'`]+[^\s)<>"'`,.!?;:])/g;
  for (const match of text.matchAll(bareUrlPattern)) {
    add(match[1]);
  }

  return items;
}

function toSourceLinks(value: unknown): SourceLink[] {
  if (!value || typeof value !== "object") return [];

  if ("results" in value && Array.isArray((value as SearchResult).results)) {
    return (value as SearchResult).results.map((item) => ({
      title: item.title || friendlyLinkLabel(item.url),
      url: item.url,
      note: item.snippet || safeHostname(item.url),
    }));
  }

  if ("pages" in value && Array.isArray((value as CrawlResult).pages)) {
    return (value as CrawlResult).pages.map((page) => ({
      title: page.title || friendlyLinkLabel(page.url),
      url: page.url,
      note: `${page.content_length.toLocaleString()} chars`,
    }));
  }

  if ("links" in value && Array.isArray((value as MapResult).links)) {
    const links = (value as MapResult).links;
    if (links.length > 0 && typeof links[0] === "string") {
      return (links as string[]).map((url) => ({
        title: friendlyLinkLabel(url),
        url,
        note: safeHostname(url),
      }));
    }
  }

  if ("links" in value && Array.isArray((value as ScrapeResult).links)) {
    return (value as ScrapeResult).links.map((item) => ({
      title: item.text || friendlyLinkLabel(item.url),
      url: item.url,
      note: safeHostname(item.url),
    }));
  }

  if ("url" in value && typeof (value as AgentExtractResult).url === "string") {
    const url = (value as AgentExtractResult).url;
    return [{ title: friendlyLinkLabel(url), url, note: safeHostname(url) }];
  }

  return [];
}

function getResultLinks(resultValue: AmanCrawlResultValue | null): SourceLink[] {
  if (!resultValue) return [];

  if ("raw" in resultValue && resultValue.raw) {
    const rawLinks = toSourceLinks(resultValue.raw);
    if (rawLinks.length > 0) return rawLinks;
  }

  if ("answer" in resultValue && typeof resultValue.answer === "string") {
    const answerLinks = extractLinksFromText(resultValue.answer);
    if (answerLinks.length > 0) return answerLinks;
  }

  return toSourceLinks(resultValue);
}

function ResultChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-2.5 py-1 text-[10px] font-medium text-[#666666] dark:border-white/10 dark:bg-white/5 dark:text-white/50">
      <span className="uppercase tracking-[0.18em] text-[#a18672] dark:text-white/30">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function SourceCards({ items, emptyLabel = "No sources available." }: { items: SourceLink[]; emptyLabel?: string }) {
  if (!items.length) {
    return <p className="text-sm text-[#999999] dark:text-white/40">{emptyLabel}</p>;
  }

  return (
    <ScrollArea maxHeight="24rem" className="pr-2">
      <div className="space-y-2">
        {items.map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-2xl border border-[#e5e7eb] bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-[#fa5a19]/30 hover:shadow-[0_10px_24px_-16px_rgba(250,90,25,0.45)] dark:border-white/10 dark:bg-white/5 dark:hover:border-[#fa5a19]/30"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff2ea] text-[11px] font-semibold text-[#fa5a19] dark:bg-[#fa5a19]/15">
                {safeHostname(item.url).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#201510] group-hover:text-[#fa5a19] dark:text-white dark:group-hover:text-[#fa5a19]">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[#999999] dark:text-white/40">
                  {safeHostname(item.url)}
                </p>
                {item.note && (
                  <p className="mt-1 text-xs leading-5 text-[#666666] dark:text-white/55">
                    {item.note}
                  </p>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function AmanCrawlPage() {
  const [activeTab, setActiveTab] = useState("scrape");
  const reduceMotion = useReducedMotion();
  const [url, setUrl] = useState("https://example.com");
  const [showPromoBanner, setShowPromoBanner] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AmanCrawlResultValue | null>(null);
  const [user, setUser] = useState<AuthUser | null>(() => (isAuthenticated() ? loadAuthUser() : null));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState("");
  const [copied, setCopied] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitData, setLimitData] = useState<LimitError | null>(null);
  const [usageRefreshTrigger, setUsageRefreshTrigger] = useState(0);
  const [resultTab, setResultTab] = useState<"answer" | "links" | "raw">("answer");
  const [showFullAnswer, setShowFullAnswer] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Pro features that require upgrade
  const PRO_FEATURES: Record<string, string> = {
    crawl: "Deep Crawl",
  };

  function checkPlan(tab: string): boolean {
    const required = PRO_FEATURES[tab];
    if (!required) return true;
    const plan = user?.plan || "free";
    if (plan === "free") {
      setBlockedFeature(required);
      setShowSubscriptionModal(true);
      return false;
    }
    return true;
  }

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    // Search tab: don't modify (it's a query, not a URL)
    if (activeTab === "search") return trimmed;
    // Already has protocol
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // Auto-add https://
    return `https://${trimmed}`;
  }

  function validateUrl(raw: string): string {
    if (activeTab === "search") return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      if (!url.hostname.includes(".")) return "Invalid domain";
      return "";
    } catch {
      return "Invalid URL";
    }
  }

  async function handleSubmit() {
    if (!url.trim()) return;
    if (!checkPlan(activeTab)) return;

    // Auto-detect URL pasted in search tab → switch to scrape
    const isUrl = /^https?:\/\//i.test(url.trim()) || (/^[a-z0-9-]+\.[a-z]{2,}/i.test(url.trim()) && !url.trim().includes(" "));
    if (activeTab === "search" && isUrl) {
      setActiveTab("scrape");
    }

    const effectiveTab = (activeTab === "search" && isUrl) ? "scrape" : activeTab;
    const err = validateUrl(url);
    if (err && effectiveTab !== "search") { setUrlError(err); return; }
    setUrlError("");
    const fullUrl = effectiveTab === "search" ? url.trim() : normalizeUrl(url);

    // Abort any previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    setResultTab("answer");
    setShowFullAnswer(false);
    setCopied(false);
    try {
      const instr = instruction.trim() || undefined;
      const signal = controller.signal;
      if (effectiveTab === "scrape") {
        setResult(await scrapeUrl(fullUrl, ["markdown"], instr, signal));
      } else if (activeTab === "agent") {
        setResult(await agentExtract(fullUrl, instr || "Extract all meaningful content as structured JSON", "auto", "openai/gpt-4o-mini", signal));
      } else if (activeTab === "crawl") {
        setResult(await crawlSite(fullUrl, 10, instr, signal));
      } else if (effectiveTab === "map") {
        setResult(await mapSite(fullUrl, instr, signal));
      } else if (effectiveTab === "search") {
        setResult(await searchWeb(fullUrl, 5, instr, signal));
      }
      setUsageRefreshTrigger((t) => t + 1);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Request stopped");
      } else if (e instanceof LimitReachedError) {
        setLimitData(e.limitData);
        setShowLimitModal(true);
      } else {
        setError(friendlyError(e));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f4] text-[#1b2420] dark:bg-[#11140f] dark:text-white">
      {/* ── Promo Banner ──────────────────────────────────────────────── */}
      {showPromoBanner && (
        <div className="relative bg-[#fa5a19] px-4 py-2.5 text-center text-sm font-medium text-white">
          <span>Introducing AmanCrawl — The web intelligence layer for AI agents.</span>
          <Link href="#pricing" className="ml-2 underline underline-offset-2 hover:text-white/80">
            Try it now →
          </Link>
          <button
            type="button"
            onClick={() => setShowPromoBanner(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <AgentNavigation active="crawl" />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-[#2d2f27] bg-[#090a08] px-4 pb-16 pt-14 text-[#f3f1e8] sm:px-8 lg:px-12 lg:pb-20">
        <div className="absolute inset-0 bg-[linear-gradient(118deg,#080907_0%,#0d120a_42%,#25140b_76%,#160d08_100%)]" />
        <PaperDither
          className="inset-0 opacity-70"
          dark={{ colorBack: "#00000000", colorFront: "#536a1e" }}
          light={{ colorBack: "#00000000", colorFront: "#6f7428" }}
          maxPixelCount={1500 * 900}
          scale={0.76}
          shape="ripple"
          size={2}
          speed={0.16}
          type="4x4"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_32%,rgba(238,91,28,0.38),transparent_22%),linear-gradient(90deg,rgba(5,6,4,0.52),rgba(8,9,6,0.14)_58%,rgba(61,24,10,0.22))]" />
        <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(rgba(4,5,3,0.9)_0.65px,transparent_0.8px)] [background-size:4px_4px]" />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div aria-label="Web memory tools" className="mx-auto mb-10 flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-[#11120f]/90 p-1.5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur" role="tablist">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <motion.button
                  aria-selected={active}
                  className={`relative flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e879] ${active ? "text-[#171814]" : "text-[#a8ada4] hover:text-white"}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                >
                  {active ? <motion.span className="absolute inset-0 rounded-full bg-[#f6e879]" layoutId="crawl-active-tool" transition={{ type: "spring", stiffness: 360, damping: 30 }} /> : null}
                  <motion.span
                    animate={active && !reduceMotion ? { rotate: [0, -8, 8, 0], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
                    className="relative z-10"
                    transition={{ duration: 0.45 }}
                  >
                    <tab.icon aria-hidden="true" className="size-4" />
                  </motion.span>
                  <span className="relative z-10">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#f6e879]/35 bg-[#f6e879]/5 px-3 py-1.5 text-xs font-medium text-[#f6e879]">
            <span className="size-1.5 rounded-full bg-[#f6e879] shadow-[0_0_12px_rgba(246,232,121,0.9)]" />
            Built for agent loops.
          </div>

          <h1 className="text-balance text-5xl font-medium tracking-[-0.06em] text-[#f3f1e8] sm:text-6xl lg:text-7xl">
            Give your agents a <span className="text-[#f4782b]">live web memory.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#b2b7ae]">
            Search, extract, map, and ground an answer in sources your team can inspect.
          </p>

          {/* ── Input Bar ──────────────────────────────────────────────── */}
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="rounded-2xl border border-white/10 bg-[#11120f]/92 p-2 shadow-[0_24px_65px_-35px_rgba(0,0,0,0.95)] backdrop-blur">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <AnimatePresence mode="wait" initial={false}>
                  {tabs.filter((tab) => tab.id === activeTab).map((tab) => (
                    <motion.span
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      className="text-[#f6e879]"
                      exit={{ opacity: 0, rotate: 12, scale: 0.86 }}
                      initial={{ opacity: 0, rotate: -12, scale: 0.86 }}
                      key={tab.id}
                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    >
                      <tab.icon aria-hidden="true" className="size-5" />
                    </motion.span>
                  ))}
                </AnimatePresence>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
                  placeholder={activeTab === "search" ? "Search the web..." : "https://example.com"}
                  className={`w-full bg-transparent text-base text-[#f3f1e8] outline-none placeholder:text-[#747a70] ${urlError ? "text-red-400" : ""}`}
                />
              </div>

              {urlError && (
                <p className="mt-2 px-2 text-xs text-red-500 dark:text-red-400">{urlError}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 px-2">
                {/* Advanced toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e879] ${
                    showAdvanced
                      ? "bg-[#26352d] text-[#cae0da]"
                      : "text-[#8d938a] hover:bg-white/5 hover:text-[#d8dbd2]"
                  }`}
                  type="button"
                >
                  {/* Settings/sliders icon */}
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="2" y1="4" x2="14" y2="4" />
                    <line x1="2" y1="8" x2="14" y2="8" />
                    <line x1="2" y1="12" x2="14" y2="12" />
                    <circle cx="5" cy="4" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="10" cy="8" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                  {showAdvanced ? "Less options" : "More options"}
                </button>

                {loading ? (
                  <button
                    aria-label="Stop web memory request"
                    onClick={handleStop}
                    className="ml-auto flex size-10 items-center justify-center rounded-xl bg-[#ef4444] text-white transition-[background-color,transform] hover:bg-[#dc2626] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    title="Stop"
                    type="button"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    aria-label={`Run ${activeTab}`}
                    onClick={handleSubmit}
                    className="ml-auto flex size-10 items-center justify-center rounded-xl bg-[#f4782b] text-white transition-[background-color,transform] hover:bg-[#ff8c42] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e879]"
                    type="button"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Advanced options panel */}
              {showAdvanced && (
                <div className="mt-3 border-t border-white/10 px-4 pt-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-[#b4b9b0]">
                      Optional guidance
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#7f857c]">
                      optional
                    </span>
                  </div>
                  <p className="mb-3 text-[11px] leading-4 text-[#858b82]">
                    {activeTab === "scrape" && "Tell the AI agent what data to extract from this page — e.g. \"Extract all product names, prices, and image URLs\""}
                    {activeTab === "agent" && "Describe what to extract and transform — e.g. \"Extract all job postings as JSON with title, company, salary, and location\""}
                    {activeTab === "crawl" && "Describe what content to focus on — e.g. \"Crawl all blog posts but skip category pages and tag pages\""}
                    {activeTab === "map" && "Specify what types of pages to discover — e.g. \"Map all pages under /docs/ and /api/ paths\""}
                    {activeTab === "search" && "Refine what you're looking for — e.g. \"Find official documentation, not blog posts or forum threads\""}
                  </p>
                  <div className="relative">
                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder={
                        activeTab === "scrape"
                          ? "e.g. Extract all product names, prices, ratings, and image URLs from the listing page"
                          : activeTab === "crawl"
                          ? "e.g. Crawl only /blog/* pages, extract article titles and published dates, skip pagination beyond page 3"
                          : activeTab === "map"
                          ? "e.g. Map all internal links but exclude /login, /signup, and /admin paths"
                          : "e.g. Search for recent benchmark comparisons of vector databases, prefer official sources over blog posts"
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-[#f3f1e8] outline-none placeholder:text-[#6f756c] focus:border-[#f4782b]/60"
                    />
                    {/* Refine Prompt Button */}
                    {instruction.trim().split(/\s+/).filter(Boolean).length > 5 && (
                      <button
                        onClick={async () => {
                          setRefining(true);
                          try {
                            const refined = await refinePrompt(instruction, activeTab);
                            setInstruction(refined);
                          } catch {
                            // Keep original on error
                          } finally {
                            setRefining(false);
                          }
                        }}
                        disabled={refining}
                        className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-[#fa5a19]/30 bg-[#fa5a19]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#fa5a19] transition hover:bg-[#fa5a19]/20 disabled:opacity-50 dark:border-[#fa5a19]/40 dark:bg-[#fa5a19]/15 dark:text-[#fa5a19] dark:hover:bg-[#fa5a19]/25"
                      >
                        {refining ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {refining ? "Refining..." : "Refine Prompt"}
                      </button>
                    )}
                  </div>
                  {instruction.trim() && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#3ddc84]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#3ddc84]" />
                      This note will guide the result
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Usage Counter ─────────────────────────────────────────────── */}
      {user && (
        <section className="px-6 pb-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-5xl">
            <UsageCounter
              resources={["crawl:scrape", "crawl:search", "crawl:map", "crawl:crawl"]}
              horizontal
              refreshTrigger={usageRefreshTrigger}
              onUpgrade={() => setShowSubscriptionModal(true)}
            />
          </div>
        </section>
      )}

      {/* ── Visual Demo ───────────────────────────────────────────────── */}
      <section className="px-6 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-[#e5e7eb] bg-white p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 rounded-t-2xl border-b border-[#e5e7eb] bg-[#faf7f2] px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#e5e7eb] dark:bg-white/10" />
                <span className="h-3 w-3 rounded-full bg-[#e5e7eb] dark:bg-white/10" />
                <span className="h-3 w-3 rounded-full bg-[#e5e7eb] dark:bg-white/10" />
              </div>
              <div className="flex-1 text-center text-xs text-[#a18672] dark:text-white/40">
                {loading
                  ? `${activeTab}ing...`
                  : error
                    ? "Error"
                    : result
                      ? `${activeTab} complete`
                      : "Ready"
                }
              </div>
              {/* Copy Result Button */}
              {result && !loading && (
                <button
                  onClick={() => {
                    const text = JSON.stringify(result, null, 2);
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[#666] transition hover:bg-[#e5e7eb] hover:text-[#333] dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
                >
                  {copied ? <Check className="h-3 w-3 text-[#3ddc84]" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>

            {/* Content — Perplexity-style results */}
            <div className="p-4">
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              ) : loading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-[#666666] dark:text-white/50">
                    <Loader2 className="h-4 w-4 animate-spin text-[#fa5a19]" />
                    <span>{activeTab}ing...</span>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[#e5e7eb] dark:bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-[#e5e7eb] dark:bg-white/10" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[#e5e7eb] dark:bg-white/10" />
                  </div>
                </div>
              ) : result ? (
                <div>
                  {/* Result Tabs */}
                  <div className="mb-4 flex items-center gap-1 border-b border-[#e5e7eb] dark:border-white/10">
                    <div className="mr-3 hidden text-[10px] text-[#999999] dark:text-white/30 sm:block">
                      Answer = readable summary. Links = extracted URLs. Raw = full response.
                    </div>
                    {(["answer", "links", "raw"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setResultTab(tab)}
                        className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium capitalize transition ${
                          resultTab === tab
                          ? "border-[#fa5a19] text-[#fa5a19]"
                          : "border-transparent text-[#666666] hover:text-[#201510] dark:text-white/50 dark:hover:text-white/80"
                        }`}
                      >
                        {tab === "answer" && <Sparkles className="h-3.5 w-3.5" />}
                        {tab === "links" && <Globe2 className="h-3.5 w-3.5" />}
                        {tab === "raw" && <Code2 className="h-3.5 w-3.5" />}
                        {tab === "answer" ? "Answer" : tab === "links" ? "Links" : "Raw JSON"}
                      </button>
                    ))}
                    {/* Provider badge */}
                    {result.provider && (
                      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[#999999] dark:text-white/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        via {result.provider}
                        {result.latency_ms ? ` · ${result.latency_ms}ms` : ""}
                      </div>
                    )}
                  </div>

                  {/* Tab: Answer */}
                  {resultTab === "answer" && (
                    <div>
                      {/* AI Answer */}
                      {"answer" in result && (result as { answer: string | null }).answer ? (
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#fa5a19]" />
                            <span className="text-sm font-semibold text-[#201510] dark:text-white">Human answer</span>
                            {result.provider && (
                              <span className="rounded-full bg-[#f3eee7] px-2 py-0.5 text-[10px] text-[#999999] dark:bg-white/5 dark:text-white/40">
                                {result.provider}
                              </span>
                            )}
                          </div>
                          <div className="relative rounded-2xl border border-[#fa5a19]/20 bg-gradient-to-br from-[#fff7f2] to-[#fff2ea] shadow-[0_16px_40px_-24px_rgba(250,90,25,0.45)] dark:from-[#fa5a19]/5 dark:to-[#fa5a19]/10">
                            <ScrollArea
                              maxHeight={showFullAnswer ? "28rem" : "13rem"}
                              className="rounded-2xl"
                            >
                              <div className="p-5">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#201510] dark:text-white/90">
                                  {(result as { answer: string }).answer}
                                </p>
                                {(result as { answer: string }).answer.length > 500 && (
                                  <button
                                    onClick={() => setShowFullAnswer((v) => !v)}
                                    className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#fa5a19]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#fa5a19] shadow-sm transition hover:border-[#fa5a19]/40 hover:bg-[#fff7f2] dark:bg-white/5"
                                  >
                                    {showFullAnswer ? "Show less" : "Read more"}
                                    <ArrowRight className={`h-3 w-3 transition-transform ${showFullAnswer ? "rotate-180" : ""}`} />
                                  </button>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                          {/* Source links below answer */}
                          {getResultLinks(result).length > 0 && (
                            <div className="mt-4">
                              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[#a18672] dark:text-white/40">
                                Sources
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {getResultLinks(result)
                                  .slice(0, 5)
                                  .map((source) => (
                                    <a
                                      key={source.url}
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-[10px] text-[#666666] transition hover:border-[#fa5a19] hover:text-[#fa5a19] dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:border-[#fa5a19]"
                                    >
                                      <span className="max-w-[12rem] truncate">{source.title}</span>
                                    </a>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : /* No AI answer — show direct results */
                      "results" in result ? (
                        <SearchResultsList result={result as SearchResult} />
                      ) : "markdown" in result ? (
                        <ScrapeResultView result={result as ScrapeResult} />
                      ) : "pages_crawled" in result ? (
                        <CrawlResultView result={result as CrawlResult} />
                      ) : "total_links" in result ? (
                        <MapResultView result={result as MapResult} />
                      ) : "result" in result ? (
                        <AgentResultView result={result as AgentExtractResult} />
                      ) : null}
                    </div>
                  )}

                  {/* Tab: Links */}
                  {resultTab === "links" && (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-[#666666] dark:text-white/50">
                          Links extracted from answer or source JSON, shown as readable cards.
                        </p>
                        <span className="text-xs text-[#999999] dark:text-white/40">
                          {getResultLinks(result).length} links
                        </span>
                      </div>
                      {(() => {
                        const sourceItems = getResultLinks(result);
                        return sourceItems.length > 0 ? (
                          <SourceCards items={sourceItems} emptyLabel="No links available for this result." />
                        ) : (
                          <p className="text-sm text-[#999999] dark:text-white/40">No links available for this result.</p>
                        );
                      })()}
                    </div>
                  )}

                  {/* Tab: Raw JSON */}
                  {resultTab === "raw" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#201510] dark:text-white">Raw JSON</p>
                            <p className="text-xs text-[#666666] dark:text-white/50">
                              The full response, kept readable and easy to copy.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-[#faf7f2] px-3 py-1.5 text-[10px] font-medium text-[#666666] transition hover:border-[#fa5a19]/30 hover:text-[#201510] dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:text-white"
                          >
                            {copied ? <Check className="h-3 w-3 text-[#3ddc84]" /> : <Copy className="h-3 w-3" />}
                            {copied ? "Copied" : "Copy raw"}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {"provider" in result && result.provider && <ResultChip label="Provider" value={result.provider} />}
                          {"latency_ms" in result && result.latency_ms && <ResultChip label="Latency" value={`${result.latency_ms}ms`} />}
                          {"answer" in result && (result as { answer?: string }).answer && <ResultChip label="Includes" value="Answer" />}
                          {"raw" in result && <ResultChip label="Mode" value="AI-guided" />}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#e5e7eb] bg-[#1a1a1a] p-4 dark:border-white/10">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/40">JSON</span>
                          <span className="text-[10px] text-white/30">Scrollable preview</span>
                        </div>
                        <ScrollArea maxHeight="34rem" orientation="both" className="rounded-lg">
                          <pre className="whitespace-pre font-mono text-xs leading-5 text-white/70">
                            <code>{JSON.stringify(result, null, 2)}</code>
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex gap-1">
                    <span className="h-3 w-3 rounded-full bg-[#e5e7eb] dark:bg-white/10" />
                    <span className="h-3 w-3 rounded-full bg-[#e5e7eb] dark:bg-white/10" />
                    <span className="h-3 w-3 rounded-full bg-[#e5e7eb] dark:bg-white/10" />
                  </div>
                  <p className="text-sm text-[#a18672] dark:text-white/40">
                    Enter a URL or search query to get started
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" className="border-t border-[#e5e7eb] bg-[#faf7f2] px-6 py-20 sm:px-8 lg:px-12 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fa5a19]">Features</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#201510] sm:text-4xl dark:text-white">
              Everything you need for web intelligence
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#666666] dark:text-white/70">
              From search to structured extraction — AmanCrawl gives your AI agents the ability to understand the web.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-[#e5e7eb] bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:hover:shadow-none"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#fa5a19]/10 text-[#fa5a19] transition group-hover:bg-[#fa5a19] group-hover:text-white">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#201510] dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#666666] dark:text-white/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ─────────────────────────────────────────────────── */}
      <section id="use-cases" className="px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fa5a19]">Use Cases</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#201510] sm:text-4xl dark:text-white">
              Built for AI developers
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#666666] dark:text-white/70">
              Whether you&apos;re building RAG apps, AI agents, or research tools — AmanCrawl provides the web intelligence layer.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="group rounded-2xl border border-[#e5e7eb] bg-white p-8 transition-all duration-200 hover:-translate-y-1 hover:border-[#fa5a19]/25 hover:shadow-[0_16px_40px_-12px_rgba(250,90,25,0.15)] dark:border-white/10 dark:bg-white/5 dark:hover:border-[#fa5a19]/30 dark:hover:shadow-none"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fa5a19] text-white transition group-hover:scale-110">
                  <useCase.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-[#201510] dark:text-white">{useCase.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#666666] dark:text-white/70">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code Example ──────────────────────────────────────────────── */}
      <section className="border-t border-[#e5e7eb] bg-[#faf7f2] px-6 py-20 sm:px-8 lg:px-12 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fa5a19]">Developer-first</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#201510] sm:text-4xl dark:text-white">
                Simple API, powerful results
              </h2>
              <p className="mt-4 text-base leading-7 text-[#666666] dark:text-white/70">
                AmanCrawl provides a clean REST API, TypeScript SDK, Python SDK, and MCP integration.
                Start scraping in minutes with just a few lines of code.
              </p>
              <div className="mt-6 flex gap-3">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 rounded-full bg-[#fa5a19] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e04a10]"
                >
                  Read the docs
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#201510] transition hover:bg-[#f7f2ea] dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                >
                  <GitBranch className="h-4 w-4" />
                  View source
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e5e7eb] bg-[#1a1a1a] p-6 font-mono text-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,0.3)] dark:border-white/10 dark:shadow-none">
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span className="rounded bg-white/10 px-2 py-0.5">TypeScript</span>
                <span className="rounded bg-white/10 px-2 py-0.5">Python</span>
              </div>
              <pre className="mt-4 overflow-x-auto text-white/80">
                <code>{`import { AmanCrawl } from '@amancrawl/sdk';

const client = new AmanCrawl({
  apiKey: process.env.AMANCRAWL_API_KEY,
});

// Scrape a webpage
const result = await client.scrape({
  url: 'https://example.com',
  formats: ['markdown', 'json'],
});

console.log(result.markdown);
// # Page Title
// Content extracted...

console.log(result.json);
// { title: "...", content: "..." }`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-[#201510] sm:text-5xl dark:text-white">
            Start building with{" "}
            <span className="text-[#fa5a19]">web intelligence</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#666666] dark:text-white/70">
            Get started with AmanCrawl for free. Scrape up to 1,000 pages per month.
            No credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-[#fa5a19] px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#e04a10]"
            >
              Start for free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-8 py-3.5 text-base font-medium text-[#201510] transition hover:bg-[#f7f2ea] dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e5e7eb] px-6 py-12 sm:px-8 lg:px-12 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fa5a19] text-white">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-[#201510] dark:text-white">Context-OS</span>
          </div>
          <div className="flex gap-6 text-sm text-[#666666] dark:text-white/50">
            <Link href="/" className="hover:text-[#201510] dark:hover:text-white">Home</Link>
            <Link href="/docs" className="hover:text-[#201510] dark:hover:text-white">Docs</Link>
            <Link href="https://github.com" className="hover:text-[#201510] dark:hover:text-white">GitHub</Link>
          </div>
          <p className="text-xs text-[#999999] dark:text-white/30">© 2026 Context-OS. All rights reserved.</p>
        </div>
      </footer>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        feature={blockedFeature}
        currentPlan={user?.plan || "free"}
        onUpgrade={() => setUser(loadAuthUser())}
      />

      {/* Limit Reached Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitData={limitData}
        currentPlan={user?.plan || "free"}
        onUpgrade={() => setShowSubscriptionModal(true)}
      />
    </main>
  );
}
