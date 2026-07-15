/**
 * Frontend → Backend API client.
 * WHY: One place for base URL and fetch helpers (upload, chat SSE in later steps).
 */

import type {
  ChatStreamEvent,
  PipelineEvent,
  RecentConversation,
  StoredConversationMessage,
  UploadResponse,
} from "@/lib/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function checkBackendHealth(): Promise<{
  status: string;
  zilliz_configured: boolean;
  openrouter_configured: boolean;
  postgres_connected: boolean;
  postgres_mode: string;
  postgres_database: string;
  postgres_host: string;
  postgres_user?: string;
  postgres_reason?: string;
  step?: number;
}> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Backend unreachable (${res.status})`);
  return res.json();
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : `Upload failed (${res.status})`;
    throw new Error(detail);
  }
  return data as UploadResponse;
}

export async function visualizePipeline(
  docId: string,
  onEvent: (event: PipelineEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/pipeline/${docId}/visualize`, {
    method: "POST",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string" ? data.detail : `Pipeline failed (${res.status})`,
    );
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as PipelineEvent);
      } catch {
        /* skip malformed */
      }
    }
  }
}

export async function streamChat(
  docId: string | null,
  question: string,
  conversationId: string,
  onEvent: (event: ChatStreamEvent) => void,
  userId: string = "local-user",
): Promise<void> {
  const payload: {
    doc_id?: string;
    question: string;
    conversation_id: string;
    user_id: string;
  } = {
    question,
    conversation_id: conversationId,
    user_id: userId,
  };

  if (docId?.trim()) {
    payload.doc_id = docId.trim();
  }

  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string" ? data.detail : `Chat failed (${res.status})`,
    );
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as ChatStreamEvent);
      } catch {
        /* skip */
      }
    }
  }
}

export async function fetchRecentConversations(
  userId = "local-user",
): Promise<RecentConversation[]> {
  const res = await fetch(
    `${API_URL}/api/chat/conversations?user_id=${encodeURIComponent(userId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Recent chats failed (${res.status})`);
  const data = await res.json();
  return (data.items ?? []) as RecentConversation[];
}

export async function fetchConversationMessages(
  conversationId: string,
  userId = "local-user",
): Promise<StoredConversationMessage[]> {
  const res = await fetch(
    `${API_URL}/api/chat/conversations/${encodeURIComponent(
      conversationId,
    )}/messages?user_id=${encodeURIComponent(userId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Conversation history failed (${res.status})`);
  const data = await res.json();
  return (data.items ?? []) as StoredConversationMessage[];
}

export { API_URL };
