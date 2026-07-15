/** API types shared across components — keeps upload/chat contracts in one place. */

export type UploadResponse = {
  doc_id: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  page_count: number;
  uploaded_at: string;
  stored_path: string;
  pipeline_step: string;
};

export type PipelineStepId =
  | "upload"
  | "extract"
  | "chunk"
  | "tokenize"
  | "embed"
  | "milvus"
  | "ready";

export type StepStatus = "pending" | "running" | "done" | "error";

export type PipelineStepState = {
  id: PipelineStepId;
  label: string;
  status: StepStatus;
  duration_ms?: number;
  data?: Record<string, unknown>;
};

export type PipelineEvent = {
  type: "step" | "complete" | "error";
  id?: PipelineStepId;
  status?: StepStatus;
  label?: string;
  duration_ms?: number;
  data?: Record<string, unknown>;
  metrics?: Record<string, number>;
  doc_id?: string;
  message?: string;
};

export type RetrievedChunk = {
  chunk_index: number;
  page: number;
  text: string;
  preview: string;
  similarity: number | null;
  distance: number | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  retrieval?: {
    retrieval_ms: number;
    chunks: RetrievedChunk[];
  };
  metrics?: {
    retrieval_ms: number;
    llm_ms: number;
    total_ms: number;
    model: string;
  };
};

export type ChatStreamEvent = {
  type: "status" | "retrieval" | "token" | "done" | "error";
  content?: string;
  message?: string;
  retrieval_ms?: number;
  top_k?: number;
  chunks?: RetrievedChunk[];
  llm_ms?: number;
  total_ms?: number;
  model?: string;
  answer_length?: number;
  web_sources?: Array<{
    title: string;
    url: string;
    content?: string;
    score?: number | null;
  }>;
};

export type RecentConversation = {
  id: string;
  title: string;
  updated_at: string;
  last_message_at?: string | null;
  message_count: number;
  last_message?: string | null;
};

export type StoredConversationMessage = {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  created_at: string;
};

export type AuthUser = {
  id: string;
  email: string;
  username?: string | null;
  full_name?: string | null;
  name?: string;
  avatar_url?: string | null;
  plan: "free" | "pro" | "team" | "enterprise";
  created_at?: string;
  platforms?: ("Kontext Memory" | "Kontext Crawl" | "AmanAgentLab" | "AmanCrawl")[];
  workspaces?: AuthWorkspace[];
};

export type AuthWorkspace = {
  id: string;
  name: string;
  platform: "Kontext Memory" | "Kontext Crawl" | "AmanAgentLab" | "AmanCrawl";
  last_active: string;
};

export type AuthSession = {
  session_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export type AuthContext = {
  authenticated: boolean;
  user: AuthUser | null;
  platform: string;
  session_token: string | null;
  scopes: string[];
};

export type AuthError = {
  error: "unauthenticated" | "forbidden";
  message: string;
  action: "redirect_to_login" | "refresh_token" | "upgrade_plan";
  missing_scope?: string;
};
