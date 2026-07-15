/**
 * AmanCrawl API client — web intelligence for AI agents.
 *
 * Includes auth headers from localStorage when user is authenticated.
 * Supports optional AI instructions for advanced scraping/crawling.
 */

import { buildAuthHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ScrapeResult {
  url: string;
  status_code: number;
  title: string;
  description: string;
  headings: { level: string; text: string }[];
  links: { text: string; url: string }[];
  images: { src: string; alt: string }[];
  content_length: number;
  markdown?: string;
  html?: string;
  text?: string;
  ai_instruction?: string;
  provider?: string;
  latency_ms?: number;
}

export interface CrawlResult {
  start_url: string;
  pages_crawled: number;
  pages: {
    url: string;
    title: string;
    status_code: number;
    content_length: number;
    text: string;
  }[];
  ai_instruction?: string;
  provider?: string;
  latency_ms?: number;
}

export interface MapResult {
  start_url: string;
  total_links: number;
  links: string[];
  structure: Record<string, unknown>;
  ai_instruction?: string;
  provider?: string;
  latency_ms?: number;
}

export interface SearchResult {
  query: string;
  results: {
    title: string;
    url: string;
    snippet: string;
  }[];
  ai_instruction?: string;
  provider?: string;
  latency_ms?: number;
  attempted?: { provider: string; error: string; latency_ms: number }[];
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...buildAuthHeaders("Context-OS Crawl"),
  };
}

function errDetail(data: Record<string, unknown>): string {
  const d = data.detail;
  if (typeof d === "string") return d;
  if (d && typeof d === "object") return JSON.stringify(d);
  return "";
}

export interface LimitError {
  error: string;
  resource: string;
  plan: string;
  limit: number;
  used: number;
  remaining: number;
  message: string;
}

export class LimitReachedError extends Error {
  public limitData: LimitError;
  constructor(data: LimitError) {
    super(data.message);
    this.limitData = data;
  }
}

function throwIfLimitError(res: Response, data: Record<string, unknown>): void {
  if (res.status === 429 && data.detail && typeof data.detail === "object") {
    const d = data.detail as Record<string, unknown>;
    if (d.error) {
      throw new LimitReachedError({
        error: d.error as string,
        resource: d.resource as string,
        plan: d.plan as string,
        limit: d.limit as number,
        used: d.used as number,
        remaining: d.remaining as number,
        message: d.message as string,
      });
    }
  }
}

export async function scrapeUrl(
  url: string,
  formats: string[] = ["markdown"],
  instruction?: string,
  signal?: AbortSignal,
): Promise<ScrapeResult> {
  const res = await fetch(`${API_URL}/api/amancrawl/scrape`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url, formats, instruction: instruction || undefined }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throwIfLimitError(res, data);
    throw new Error(errDetail(data) || `Scrape failed (${res.status})`);
  }
  return res.json();
}

export async function crawlSite(
  url: string,
  maxPages: number = 10,
  instruction?: string,
  signal?: AbortSignal,
): Promise<CrawlResult> {
  const res = await fetch(`${API_URL}/api/amancrawl/crawl`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url, max_pages: maxPages, instruction: instruction || undefined }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throwIfLimitError(res, data);
    throw new Error(errDetail(data) || `Crawl failed (${res.status})`);
  }
  return res.json();
}

export async function mapSite(
  url: string,
  instruction?: string,
  signal?: AbortSignal,
): Promise<MapResult> {
  const res = await fetch(`${API_URL}/api/amancrawl/map`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url, instruction: instruction || undefined }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throwIfLimitError(res, data);
    throw new Error(errDetail(data) || `Map failed (${res.status})`);
  }
  return res.json();
}

export async function searchWeb(
  query: string,
  numResults: number = 5,
  instruction?: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const res = await fetch(`${API_URL}/api/amancrawl/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ query, num_results: numResults, instruction: instruction || undefined }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throwIfLimitError(res, data);
    throw new Error(errDetail(data) || `Search failed (${res.status})`);
  }
  return res.json();
}

export async function refinePrompt(
  instruction: string,
  context: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/api/amancrawl/refine-prompt`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ instruction, context }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Refine failed (${res.status})`);
  }
  const data = await res.json();
  return data.refined;
}

// ── AI Agent extraction ──────────────────────────────────────────────────

export interface AgentExtractResult {
  url: string;
  instruction: string;
  result: unknown;
  raw_content: string;
  raw_length: number;
  model: string;
  tokens_used: number;
  error?: string;
  provider?: string;
  latency_ms?: number;
}

export async function agentExtract(
  url: string,
  instruction: string,
  outputFormat: string = "auto",
  model: string = "openai/gpt-4o-mini",
  signal?: AbortSignal,
): Promise<AgentExtractResult> {
  const res = await fetch(`${API_URL}/api/amancrawl/agent/extract`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url, instruction, output_format: outputFormat, model }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throwIfLimitError(res, data);
    throw new Error(errDetail(data) || `Agent extract failed (${res.status})`);
  }
  return res.json();
}
