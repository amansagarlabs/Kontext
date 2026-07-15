/**
 * Dashboard API client — fetches real user data from the backend.
 */

import { buildAuthHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface CrawlUsage {
  used: number;
  limit: number;
  period: string;
  remaining: number;
}

export interface DashboardStats {
  conversations: number;
  memory_entries: number;
  artifacts: number;
  crawl_jobs: number;
  pages_crawled: number;
  crawl_scrape: CrawlUsage;
  crawl_search: CrawlUsage;
  crawl_map: CrawlUsage;
  crawl_crawl: CrawlUsage;
  errors: string[];
}

export interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
  last_message: string | null;
}

export interface MemoryItem {
  key: string;
  content: string;
  source: string;
  updated_at: string;
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...buildAuthHeaders("Context-OS Memory"),
  };
}

const EMPTY_STATS: DashboardStats = {
  conversations: 0,
  memory_entries: 0,
  artifacts: 0,
  crawl_jobs: 0,
  pages_crawled: 0,
  crawl_scrape: { used: 0, limit: 0, period: "day", remaining: 0 },
  crawl_search: { used: 0, limit: 0, period: "day", remaining: 0 },
  crawl_map: { used: 0, limit: 0, period: "day", remaining: 0 },
  crawl_crawl: { used: 0, limit: 0, period: "month", remaining: 0 },
  errors: [],
};

export async function fetchDashboardStats(platform: "lab" | "crawl" | "both" = "both"): Promise<DashboardStats> {
  const res = await fetch(`${API_URL}/api/dashboard/stats?platform=${platform}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("unauthorized");
    return EMPTY_STATS;
  }
  return res.json();
}

export async function fetchRecentConversations(limit = 10): Promise<ConversationItem[]> {
  const res = await fetch(`${API_URL}/api/dashboard/conversations?limit=${limit}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

export async function fetchRecentMemories(limit = 10): Promise<MemoryItem[]> {
  const res = await fetch(`${API_URL}/api/dashboard/memories?limit=${limit}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}
