"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Folder,
  Globe,
  HelpCircle,
  ImagePlus,
  Loader2,
  LogOut,
  Moon,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  MessageSquare,
  LayoutGrid,
  Code2,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import MessageList from "@/components/chat/MessageList";
import ModelPicker from "@/components/chat/ModelPicker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AgentNavigation } from "@/components/ui/agent-navigation";
import { Message, Model } from "@/components/chat/types";
import type {
  AuthUser,
  PipelineEvent,
  PipelineStepId,
  RecentConversation,
  UploadResponse,
} from "@/lib/types";
import { clearAuthSession, loadAuthUser } from "@/lib/auth";
import {
  clearDocument,
  clearPipelineSteps,
  getOrCreateConversationId,
  loadDocument,
  loadPipelineSteps,
  resetConversationId,
  saveDocument,
  savePipelineSteps,
  setConversationId,
} from "@/lib/storage";
import {
  checkBackendHealth,
  fetchConversationMessages,
  fetchRecentConversations,
  streamChat,
  uploadPdf,
  visualizePipeline,
} from "@/services/api";

const SUGGESTIONS = [
  "Summarize this file for me",
  "What is this file about?",
  "List the key points from the document",
  "Give me a short explanation in simple words",
];

type AttachmentStatus = "uploading" | "processing" | "uploaded" | "error";

type Attachment = {
  id: string;
  name: string;
  status: AttachmentStatus;
  detail?: string;
};

type BackendState = {
  backendOk: boolean | null;
  zillizOk: boolean | null;
  openrouterOk: boolean | null;
  postgresOk: boolean | null;
  postgresMode: string;
  postgresDatabase: string;
  postgresHost: string;
};

type ServiceTone = "neutral" | "success" | "warning" | "error";

type ServiceItem = {
  label: string;
  value: string;
  tone: ServiceTone;
};

type SourceItem = {
  id: string;
  title: string;
  domain: string;
  description: string;
  url?: string;
  sourceType: string;
};

type ProvenanceBlock = {
  id: string;
  title: string;
  body: string;
};

type ResourceCandidate = {
  title: string;
  url: string;
  sourceType: string;
  domain: string;
  description?: string;
};

type QuickAction = {
  id:
    | "attach"
    | "recent"
    | "create-image"
    | "thinking"
    | "deep-research"
    | "web-search"
    | "more"
    | "projects";
  label: string;
  icon: string;
  chevron?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "attach", label: "Add files, images, or links", icon: "paperclip" },
  // { id: "recent", label: "Recent files", icon: "file", chevron: true },
  // { id: "create-image", label: "Create image", icon: "image" },
  { id: "thinking", label: "Thinking", icon: "spark" },
  { id: "deep-research", label: "Deep research", icon: "search" },
  { id: "web-search", label: "Web search", icon: "globe" },
  // { id: "more", label: "More", icon: "more", chevron: true },
  // { id: "projects", label: "Projects", icon: "folder", chevron: true },
];

const SUMMARY_PROMPT_PATTERN =
  /\b(summarize|summary|summarise|what is this pdf about|explain this pdf)\b/i;
const WEAK_ANSWER_PATTERN =
  /^(i don't know|i do not know|not enough information|no useful answer|i could not find a useful answer)/i;

export default function ChatInterface() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
  const [visualizationOpen, setVisualizationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<UploadResponse | null>(() =>
    loadDocument(),
  );
  const [completedSteps, setCompletedSteps] = useState<Set<PipelineStepId>>(() =>
    loadPipelineSteps(),
  );
  const [backendState, setBackendState] = useState<BackendState>({
    backendOk: null,
    zillizOk: null,
    openrouterOk: null,
    postgresOk: null,
    postgresMode: "local",
    postgresDatabase: "",
    postgresHost: "",
  });
  const [typing, setTyping] = useState(false);
  const [manualStatusMessage, setManualStatusMessage] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [recentChats, setRecentChats] = useState<RecentConversation[]>([]);
  const [recentChatsLoading, setRecentChatsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourceMessage, setSourceMessage] = useState<Message | null>(null);
  const [messageResources, setMessageResources] = useState<Record<number, SourceItem[]>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const serviceMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadJobRef = useRef(0);

  const visibleDocument = hydrated ? uploadedDocument : null;
  const visibleCompletedSteps = hydrated ? completedSteps : new Set<PipelineStepId>();
  const visibleUser: AuthUser | null = hydrated ? loadAuthUser() : null;
  const pipelineReady =
    visibleCompletedSteps.has("ready") || visibleCompletedSteps.has("milvus");
  const hasMessages = messages.length > 0;
  const artifactServiceItem: ServiceItem | null = visibleDocument
    ? {
        label: "Artifact",
        value: visibleDocument.filename,
        tone: pipelineReady ? "success" : "neutral",
      }
    : null;
  const serviceItems: ServiceItem[] = [
    {
      label: "Backend",
      value:
        backendState.backendOk === null
          ? "Initializing"
          : backendState.backendOk
            ? "Connected"
            : "Offline",
      tone:
        backendState.backendOk === null
          ? "neutral"
          : backendState.backendOk
            ? "success"
            : "error",
    },
    {
      label: "Database",
      value:
        backendState.postgresOk === null
          ? "Checking"
          : backendState.postgresOk
            ? `${backendState.postgresMode} · ${backendState.postgresDatabase || "connected"}`
            : "Disconnected",
      tone:
        backendState.postgresOk === null
          ? "neutral"
          : backendState.postgresOk
            ? "success"
            : "error",
    },
    {
      label: "Milvus",
      value:
        backendState.zillizOk === null
          ? "Checking"
          : backendState.zillizOk
            ? "Configured"
            : "Missing",
      tone:
        backendState.zillizOk === null
          ? "neutral"
          : backendState.zillizOk
            ? "success"
            : "warning",
    },
    {
      label: "OpenRouter",
      value:
        backendState.openrouterOk === null
          ? "Checking"
          : backendState.openrouterOk
            ? "Configured"
            : "Missing",
      tone:
        backendState.openrouterOk === null
          ? "neutral"
          : backendState.openrouterOk
            ? "success"
            : "warning",
    },
    ...(artifactServiceItem ? [artifactServiceItem] : []),
  ];
  const connectedCount = serviceItems.filter((item) => item.tone === "success").length;
  const statusMessage =
    manualStatusMessage ??
    (!visibleDocument
      ? backendState.backendOk === null
        ? "Initializing workspace..."
        : backendState.backendOk
          ? "Ask anything, or upload a file, image, or link for hybrid document, web, and model-aware answers."
          : "Backend is not connected yet. Please wait..."
      : attachment?.status === "uploading"
        ? "Uploading your file..."
        : !pipelineReady
          ? "Please wait. We are preparing your artifact for chat..."
          : "Your result is ready. Ask anything from the uploaded file.");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    checkBackendHealth()
      .then((data) => {
        setBackendState({
          backendOk: data.status === "ok",
          zillizOk: data.zilliz_configured,
          openrouterOk: data.openrouter_configured,
          postgresOk: data.postgres_connected,
          postgresMode: data.postgres_mode,
          postgresDatabase: data.postgres_database,
          postgresHost: data.postgres_host,
        });
      })
      .catch(() => {
        setBackendState({
          backendOk: false,
          zillizOk: false,
          openrouterOk: false,
          postgresOk: false,
          postgresMode: "unknown",
          postgresDatabase: "",
          postgresHost: "",
        });
      });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void loadRecentChats();
  }, [hydrated]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setQuickMenuOpen(false);
      }
      if (serviceMenuRef.current && !serviceMenuRef.current.contains(e.target as Node)) {
        setServiceMenuOpen(false);
        setVisualizationOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setQuickMenuOpen(false);
        setServiceMenuOpen(false);
        setVisualizationOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function updateSteps(next: Set<PipelineStepId>) {
    setCompletedSteps(next);
    savePipelineSteps([...next]);
  }

  function addStep(step: PipelineStepId) {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(step);
      savePipelineSteps([...next]);
      return next;
    });
  }

  function clearCurrentArtifact() {
    setAttachment(null);
    setUploadedDocument(null);
    setMessages([]);
    setInput("");
    setInlineError(null);
    setManualStatusMessage("Ask anything, or upload a file, image, or link for hybrid document, web, and model-aware answers.");
    setCompletedSteps(new Set<PipelineStepId>());
    clearDocument();
    clearPipelineSteps();
    resetConversationId();
    setCurrentConversationId(null);
  }

  function handleLogout() {
    clearAuthSession();
    resetConversationId();
    router.replace("/login");
  }

  async function loadRecentChats() {
    setRecentChatsLoading(true);
    try {
      const user = loadAuthUser();
      const items = await fetchRecentConversations(user?.id ?? "local-user");
      setRecentChats(items);
    } catch {
      setRecentChats([]);
    } finally {
      setRecentChatsLoading(false);
    }
  }

  async function openConversation(conversationId: string) {
    setLoadingConversationId(conversationId);
    try {
      const user = loadAuthUser();
      const items = await fetchConversationMessages(conversationId, user?.id ?? "local-user");
      const nextMessages: Message[] = items
        .filter(
          (item): item is typeof item & { role: "user" | "assistant" } =>
            item.role === "user" || item.role === "assistant",
        )
        .map((item, index) => ({
          id: Date.parse(item.created_at) || index + 1,
          role: item.role,
          content: item.content,
        }));
      setMessages(nextMessages);
      setCurrentConversationId(conversationId);
      setConversationId(conversationId);
      setInlineError(null);
    } catch (error) {
      setInlineError(
        error instanceof Error ? error.message : "Could not load conversation history.",
      );
    } finally {
      setLoadingConversationId(null);
    }
  }

  async function runPipeline(doc: UploadResponse, jobId: number) {
    setManualStatusMessage("Please wait. We are preparing your artifact for chat...");
    setAttachment((current) =>
      current ? { ...current, status: "processing", detail: "Processing..." } : current,
    );
    updateSteps(new Set<PipelineStepId>(["upload"]));

    try {
      await visualizePipeline(doc.doc_id, (event: PipelineEvent) => {
        if (uploadJobRef.current !== jobId) return;

        if (event.type === "error") {
          throw new Error(event.message ?? "Pipeline failed");
        }

        if (event.type === "step" && event.id) {
          if (event.status === "done") {
            addStep("upload");
            addStep(event.id);
          }

          const label = event.label ?? event.id;
          const stage =
            event.status === "running"
              ? `${label} in progress. Hold on a minute...`
              : `${label} complete.`;
          setManualStatusMessage(stage);
        }

        if (event.type === "complete") {
          updateSteps(
            new Set<PipelineStepId>([
              "upload",
              "extract",
              "chunk",
              "tokenize",
              "embed",
              "milvus",
              "ready",
            ]),
          );
        }
      });

      if (uploadJobRef.current !== jobId) return;

      setAttachment((current) =>
        current ? { ...current, status: "uploaded", detail: "Ready" } : current,
      );
      setManualStatusMessage("Your result is ready. Ask anything from the uploaded file.");
    } catch (error) {
      if (uploadJobRef.current !== jobId) return;
      const message =
        error instanceof Error ? error.message : "Pipeline processing failed";
      setInlineError(message);
      setAttachment((current) =>
        current ? { ...current, status: "error", detail: "Failed" } : current,
      );
      setManualStatusMessage("Something went wrong while preparing the file.");
    }
  }

  async function handleFileSelection(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    const jobId = Date.now();
    uploadJobRef.current = jobId;
    setInlineError(null);
    setUploadedDocument(null);
    setMessages([]);
    resetConversationId();
    clearDocument();
    clearPipelineSteps();
    setManualStatusMessage("Uploading your file...");
    updateSteps(new Set<PipelineStepId>());
    setAttachment({
      id: String(jobId),
      name: file.name,
      status: "uploading",
      detail: "Uploading...",
    });

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setAttachment({
        id: String(jobId),
        name: file.name,
        status: "error",
        detail: "Supported",
      });
      setInlineError("The current backend upload flow currently supports PDF files only.");
      setManualStatusMessage("Please upload a supported file.");
      return;
    }

    try {
      const uploadedDoc = await uploadPdf(file);
      if (uploadJobRef.current !== jobId) return;

      setUploadedDocument(uploadedDoc);
      saveDocument(uploadedDoc);
      updateSteps(new Set<PipelineStepId>(["upload"]));
      setManualStatusMessage("Upload complete. Preparing your file...");
      await runPipeline(uploadedDoc, jobId);
    } catch (error) {
      if (uploadJobRef.current !== jobId) return;
      const message = error instanceof Error ? error.message : "Upload failed";
      setInlineError(message);
      setAttachment({
        id: String(jobId),
        name: file.name,
        status: "error",
        detail: "Failed",
      });
      setManualStatusMessage("Upload failed. Please try again.");
    }
  }

  async function sendMessage(
    questionOverride?: string,
    options: { appendUser?: boolean } = {},
  ) {
    const appendUser = options.appendUser ?? true;
    const trimmed = (questionOverride ?? input).trim();
    if (!trimmed || typing) return;
    if (uploadedDocument && !pipelineReady) {
      setInlineError("Please wait until your artifact is ready.");
      return;
    }
    if (backendState.openrouterOk === false) {
      setInlineError("OpenRouter is not configured yet.");
      return;
    }

    setInlineError(null);
    setTyping(true);

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: trimmed,
    };
    if (appendUser) {
      setMessages((prev) => [...prev, userMessage]);
    }
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let answer = "";
    let answerSources: NonNullable<import("@/lib/types").ChatStreamEvent["web_sources"]> | undefined;
    try {
      const conversationId = getOrCreateConversationId();
      setCurrentConversationId(conversationId);
      const user = loadAuthUser();
      await streamChat(uploadedDocument?.doc_id ?? null, trimmed, conversationId, (event) => {
        if (event.type === "error") {
          throw new Error(event.message ?? "Chat failed");
        }
        if (event.type === "status" && event.message) {
          setManualStatusMessage(event.message);
        }
        if (event.type === "token" && event.content) {
          answer += event.content;
        }
        if (event.type === "done" && event.web_sources) {
          answerSources = event.web_sources;
        }
      }, user?.id ?? "local-user");

      const assistantMessage = buildAssistantMessage(trimmed, answer);
      const resources = normalizeResourcesFromStream(answerSources, answer);
      const messageResourceItems = resources.map(toSourceItem);
      assistantMessage.resources = resources.map((resource) => ({
        title: resource.title,
        url: resource.url,
        domain: resource.domain,
        sourceType: resource.sourceType,
        description: resource.description,
      }));
      setMessages((prev) => [...prev, assistantMessage]);
      if (messageResourceItems.length) {
        setMessageResources((prev) => ({
          ...prev,
          [assistantMessage.id]: messageResourceItems,
        }));
      }
      void loadRecentChats();
      setManualStatusMessage(
        uploadedDocument
          ? "Your result is ready. Ask anything from the uploaded file."
          : "Ask anything or upload a file, image, or link for hybrid document, web, and model-aware answers.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed";
      setInlineError(message);
      const fallbackMessage = uploadedDocument
        ? "I hit a backend issue while reading the artifact. Please try again."
        : "I hit a backend issue while answering. Please try again.";
      const fallbackAssistant = {
        id: Date.now() + 1,
        role: "assistant" as const,
        content: fallbackMessage,
      };
      setMessages((prev) => [...prev, fallbackAssistant]);
    } finally {
      setTyping(false);
    }
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setManualStatusMessage("Copied to clipboard.");
    } catch {
      setInlineError("Could not copy this message.");
    }
  }

  function editMessage(message: Message) {
    const index = messages.findIndex((item) => item.id === message.id);
    if (index === -1) return;
    const editableIndex =
      message.role === "assistant"
        ? [...messages]
            .slice(0, index)
            .map((item, itemIndex) => ({ item, itemIndex }))
            .reverse()
            .find(({ item }) => item.role === "user")?.itemIndex
        : index;

    if (editableIndex === undefined) return;
    const editableMessage = messages[editableIndex];

    setMessages((prev) => prev.slice(0, editableIndex));
    setInput(editableMessage.content);
    setInlineError(null);
    setManualStatusMessage("Edit your question, then send it again.");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      autoResize();
    });
  }

  function regenerateAnswer(message: Message) {
    const assistantIndex = messages.findIndex((item) => item.id === message.id);
    if (assistantIndex <= 0) return;

    const previousUser = [...messages]
      .slice(0, assistantIndex)
      .reverse()
      .find((item) => item.role === "user");
    if (!previousUser) return;

    setMessages((prev) => prev.slice(0, assistantIndex));
    setInlineError(null);
    setManualStatusMessage("Regenerating answer...");
    void sendMessage(previousUser.content, { appendUser: false });
  }

  function buildSourceItems(message?: Message | null): SourceItem[] {
    if (!message || message.role !== "assistant") return [];
    const storedItems = messageResources[message.id] ?? message.resources?.map(toSourceItem) ?? [];
    if (storedItems.length) return dedupeSourceItems(storedItems);
    return dedupeSourceItems(normalizeResourcesFromStream(undefined, message.content).map(toSourceItem));
  }

  function extractMarkdownLinks(text: string): ResourceCandidate[] {
    const seen = new Set<string>();
    const items: ResourceCandidate[] = [];
    const markdownLinkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    const autoLinkRe = /https?:\/\/[^\s<>"')\]]+/g;

    for (const re of [markdownLinkRe, autoLinkRe]) {
      re.lastIndex = 0;
      for (const match of text.matchAll(re)) {
        const title = match[1] && match[2] ? match[1].trim() : match[0].trim();
        const url = (match[2] ?? match[0]).replace(/[),.]+$/, "");
        if (!url || seen.has(url)) continue;
        seen.add(url);
        let domain = url;
        try {
          domain = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          domain = url;
        }
        items.push({
          title: title || url,
          url,
          domain,
          sourceType: "Link in answer",
          description: title && title !== url ? title : undefined,
        });
      }
    }

    return items;
  }

  function normalizeResourcesFromStream(
    eventSources: NonNullable<import("@/lib/types").ChatStreamEvent["web_sources"]> | undefined,
    answerText: string,
  ): ResourceCandidate[] {
    const seen = new Set<string>();
    const resources: ResourceCandidate[] = [];

    for (const source of eventSources ?? []) {
      if (!source?.url || seen.has(source.url)) continue;
      seen.add(source.url);
      let domain = source.url;
      try {
        domain = new URL(source.url).hostname.replace(/^www\./, "");
      } catch {
        domain = source.url;
      }
      resources.push({
        title: source.title || source.url,
        url: source.url,
        domain,
        sourceType: "Web source",
        description: source.content?.trim() || undefined,
      });
    }

    for (const link of extractMarkdownLinks(answerText)) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      resources.push(link);
    }

    if (uploadedDocument && resources.length === 0) {
      resources.push({
        title: uploadedDocument.filename,
        url: uploadedDocument.stored_path,
        domain: "local artifact",
        sourceType: "Uploaded artifact",
        description: `${uploadedDocument.page_count} pages, ${uploadedDocument.size_human}`,
      });
    }

    return resources;
  }

  function showSources(message?: Message) {
    setSourceMessage(message ?? null);
    setSourcesOpen(true);

    const resources = buildSourceItems(message ?? null);
    setManualStatusMessage(
      resources.length
        ? "Sources opened for this answer."
        : "No source links were attached to this answer.",
    );
  }

  function buildProvenanceBlocks(message?: Message | null): ProvenanceBlock[] {
    if (!message || message.role !== "assistant") return [];

    const selectedAnswer = message.content.trim();
    const clickedAnswer =
      selectedAnswer.length > 220 ? `${selectedAnswer.slice(0, 220)}...` : selectedAnswer;

    return [
      {
        id: "selected-answer",
        title: "Selected answer",
        body: selectedAnswer,
      },
      {
        id: "conversation-context",
        title: "Conversation context",
        body: currentConversationId
          ? `Conversation ${currentConversationId}`
          : "Current thread",
      },
      {
        id: "saved-memory",
        title: "Saved memory",
        body: "Persistent chat context used for this reply",
      },
      {
        id: "model-knowledge",
        title: "Model knowledge",
        body: "Base model reasoning and general knowledge",
      },
      {
        id: "clicked-answer",
        title: "Clicked answer",
        body: clickedAnswer,
      },
    ];
  }

  function openQuickAction(action: QuickAction) {
    setQuickMenuOpen(false);

    if (action.id === "attach") {
      fileInputRef.current?.click();
      return;
    }

    if (action.id === "more" || action.id === "projects") return;

    if (action.id === "create-image") {
      setInput((prev) => prev || "Create an image of ");
      textareaRef.current?.focus();
      return;
    }

    setInput((prev) => prev || `${action.label} `);
    textareaRef.current?.focus();
  }

  function buildAssistantMessage(question: string, answer: string): Message {
    const normalizedAnswer =
      answer.trim() ||
      (uploadedDocument
        ? "I could not find a useful answer in the artifact."
        : "I could not find a useful answer.");
    const looksLikeSummaryRequest = SUMMARY_PROMPT_PATTERN.test(question);
    const isWeakAnswer = WEAK_ANSWER_PATTERN.test(normalizedAnswer);
    const shouldHighlight =
      looksLikeSummaryRequest && !isWeakAnswer && normalizedAnswer.length >= 120;

    return {
      id: Date.now() + 1,
      role: "assistant",
      content: normalizedAnswer,
      emphasis: shouldHighlight ? "highlight" : "default",
      badge: shouldHighlight ? "Best summary" : undefined,
    };
  }

  function toSourceItem(resource: ResourceCandidate): SourceItem {
    return {
      id: resource.url,
      title: resource.title,
      domain: resource.domain,
      description: resource.description || resource.url,
      url: resource.url,
      sourceType: resource.sourceType,
    };
  }

  function dedupeSourceItems(items: SourceItem[]): SourceItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.url ?? item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const visibleSources = buildSourceItems(sourceMessage);
  const provenanceBlocks = buildProvenanceBlocks(sourceMessage);

  return (
    <div className="flex h-full min-h-screen bg-[#11140f] text-white">
      <aside
        className={`group/sidebar hidden flex-col border-r border-white/10 bg-[#0b0e0b] py-3 transition-[width] duration-300 ease-in-out md:flex ${
          sidebarCollapsed ? "w-[72px]" : "w-[280px]"
        }`}
      >
        <div className={`${sidebarCollapsed ? "px-2 pt-3 pb-1" : "px-3 pt-3 pb-1"}`}>
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                  <span className="text-sm font-bold">Ai</span>
                </div>
                <span className="text-base font-semibold text-white">kontext</span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                  aria-label="Search"
                  title="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setInlineError(null);
                    resetConversationId();
                    setCurrentConversationId(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                  aria-label="New chat"
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-1 px-2">
          <SidebarButton
            icon={<MessageSquare className="h-4 w-4" />}
            label="New chat"
            compact={sidebarCollapsed}
            active
            onClick={() => {
              setMessages([]);
              setInlineError(null);
              resetConversationId();
              setCurrentConversationId(null);
            }}
          />
          <SidebarButton
            icon={<LayoutGrid className="h-4 w-4" />}
            label="Search chats"
            compact={sidebarCollapsed}
            onClick={() => setSidebarCollapsed(false)}
          />
          <SidebarButton
            icon={<Folder className="h-4 w-4" />}
            label="Projects"
            compact={sidebarCollapsed}
          />
          <SidebarButton
            icon={<FileText className="h-4 w-4" />}
            label="Library"
            compact={sidebarCollapsed}
          />
          <SidebarButton
            icon={<Code2 className="h-4 w-4" />}
            label="Apps"
            compact={sidebarCollapsed}
          />
          <SidebarButton
            icon={<SlidersHorizontal className="h-4 w-4" />}
            label="More"
            compact={sidebarCollapsed}
          />
        </div>

        <div className={`mt-4 flex-1 overflow-y-auto px-2 ${sidebarCollapsed ? "hidden" : "block"}`}>
            <p className="px-2 text-xs font-semibold text-white">
            Recents
          </p>
          <div className="mt-2 space-y-1">
            {recentChatsLoading ? (
              <SidebarChatSkeleton />
            ) : recentChats.length === 0 ? (
              <p className="px-2 text-xs text-white/45">No saved chats yet.</p>
            ) : (
              recentChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => void openConversation(chat.id)}
                  className={`w-full rounded-xl px-2 py-2 text-left transition ${
                    currentConversationId === chat.id
                    ? "bg-[#212120] text-white"
                    : "text-white/78 hover:bg-[#212120] hover:text-white"
                  }`}
                >
                  <p className="truncate text-sm font-medium">{chat.title}</p>
                  <p className="mt-1 truncate text-xs text-white/45">
                    {loadingConversationId === chat.id
                      ? "Loading..."
                      : chat.last_message || `${chat.message_count} messages`}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto px-2 pt-3 pb-1" ref={userMenuRef}>
          <div
            className="relative"
            onMouseEnter={() => !sidebarCollapsed && setUserMenuOpen(true)}
            onMouseLeave={() => setUserMenuOpen(false)}
          >
            {userMenuOpen && !sidebarCollapsed && (
              <div className="absolute bottom-full left-0 right-0 rounded-xl border border-white/10 bg-[#212120] py-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  <Globe className="h-4 w-4" />
                  Language
                  <ChevronRight className="ml-auto h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  <HelpCircle className="h-4 w-4" />
                  Get help
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  <CreditCard className="h-4 w-4" />
                  Upgrade plan
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Learn more
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
            <div className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-[#212120] px-2 py-2 transition hover:bg-[#2f2f2f] ${
              userMenuOpen ? "border-white/15 bg-[#2f2f2f]" : ""
            }`}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-semibold text-white">
                {visibleUser?.email?.[0]?.toUpperCase() ?? "G"}
              </div>
              {!sidebarCollapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {visibleUser?.full_name || visibleUser?.username || "Guest"}
                  </p>
                  <p className="truncate text-xs text-white/45">
                    Free plan
                  </p>
                </div>
              ) : null}
              {!sidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => {
                    const isDarkNow = document.documentElement.classList.toggle("dark");
                    setIsDark(isDarkNow);
                    localStorage.setItem("theme", isDarkNow ? "dark" : "light");
                  }}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#11140f]">
        <AgentNavigation active="chat" compact />
        <div className="border-b border-white/10 px-4 py-3">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-lg font-semibold text-white">
                Agent chat
                <ChevronDown className="h-4 w-4 text-white/70" />
              </div>
              <div ref={serviceMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setServiceMenuOpen((open) => !open)}
                  aria-expanded={serviceMenuOpen}
                  className="flex items-center gap-3 rounded-full border border-white/10 bg-[#2f2f2f] px-3 py-2 text-sm text-white transition hover:bg-[#3a3a39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <span className="font-medium">Server connected</span>
                  <span className="text-xs text-[#7a5b49] dark:text-slate-400">
                    {connectedCount}/{serviceItems.length}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#7a5b49] transition dark:text-slate-400 ${
                      serviceMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {serviceMenuOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-[#e5d8c9] bg-[#fffdfa] p-2 shadow-[0_18px_42px_-18px_rgba(64,43,24,0.22)] dark:border-white/10 dark:bg-[#242422] dark:shadow-black/40">
                    <div className="border-b border-[#e5d8c9] px-3 py-2 dark:border-white/10">
                      <p className="text-sm font-medium text-[#201510] dark:text-white">Services</p>
                      <p className="text-xs text-[#737373] dark:text-slate-400">
                        Live backend connections and active artifact.
                      </p>
                    </div>
                    <div className="space-y-1 p-2">
                      {serviceItems.map((item) => (
                        <ServiceRow
                          key={item.label}
                          label={item.label}
                          value={item.value}
                          tone={item.tone}
                        />
                      ))}
                    </div>
                    <div className="border-t border-[#e5d8c9] p-2 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setVisualizationOpen((open) => !open)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#201510] transition hover:bg-[#f1e8dc] dark:text-white dark:hover:bg-slate-800"
                      >
                        <span>See visualization</span>
                        <ChevronRight
                          className={`h-4 w-4 text-[#a18672] transition dark:text-slate-500 ${
                            visualizationOpen ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                    </div>
                    {visualizationOpen ? (
                      <div className="border-t border-[#e5d8c9] px-3 py-3 dark:border-white/10">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-[#a18672] dark:text-slate-500">
                          Pipeline Flow
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <VisualizationChip
                            label="Upload"
                            detail={
                              uploadedDocument
                                ? uploadedDocument.filename
                                : "Select PDF"
                            }
                            active={Boolean(uploadedDocument)}
                          />
                          <VisualizationArrow />
                          <VisualizationChip
                            label="Extract"
                            detail="Read pages"
                            active={completedSteps.has("extract")}
                          />
                          <VisualizationArrow />
                          <VisualizationChip
                            label="Chunk"
                            detail="Split text"
                            active={completedSteps.has("chunk")}
                          />
                          <VisualizationArrow />
                          <VisualizationChip
                            label="Tokenize"
                            detail="Count tokens"
                            active={completedSteps.has("tokenize")}
                          />
                          <VisualizationArrow />
                          <VisualizationChip
                            label="Embed"
                            detail="Create vectors"
                            active={completedSteps.has("embed")}
                          />
                          <VisualizationArrow />
                          <VisualizationChip
                            label="Vector DB"
                            detail="Store in Milvus"
                            active={completedSteps.has("milvus")}
                          />
                          <VisualizationArrow />
                          <VisualizationChip
                            label="Answer"
                            detail="Reply in chat"
                            active={completedSteps.has("ready")}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

          </div>
        </div>

        <div className="chat-scrollbar flex flex-1 overflow-y-auto bg-[#11140f] px-4 py-6">
          <div
            className={`mx-auto flex w-full max-w-4xl flex-1 flex-col ${
              hasMessages ? "justify-start" : "items-center justify-center"
            }`}
          >
            <ChatStatus message={statusMessage} error={inlineError} />
            {loadingConversationId ? (
              <ChatThreadSkeleton />
            ) : !hasMessages ? (
              <Welcome
                disabled={Boolean(uploadedDocument && !pipelineReady) || typing}
                onSuggestion={(suggestion) => {
                  setInput(suggestion);
                  textareaRef.current?.focus();
                }}
              />
            ) : (
              <>
                <MessageList
                  messages={messages}
                  isTyping={typing}
                  onCopy={(content) => void copyMessage(content)}
                  onEdit={editMessage}
                  onRegenerate={regenerateAnswer}
                  onSources={showSources}
                />
                <div ref={bottomRef} />
              </>
            )}
          </div>
        </div>

        <div className="bg-[#11140f] px-4 pb-4">
          <div className="mx-auto w-full max-w-[768px] rounded-[22px] border border-white/10 bg-[#1a211d] px-4 py-3 shadow-[0_12px_36px_-24px_rgba(0,0,0,0.8)] transition-colors focus-within:border-[#CAE0DA]/55">
            <div className="mb-4 flex flex-wrap gap-3">
              {visibleDocument ? (
                <ArtifactPreview
                  label={visibleDocument.filename}
                  detail={pipelineReady ? "Ready" : "Processing"}
                  tone={pipelineReady ? "success" : "neutral"}
                  onRemove={clearCurrentArtifact}
                />
              ) : attachment ? (
                <AttachmentChip
                  attachment={attachment}
                  onRemove={() => setAttachment(null)}
                />
              ) : null}
            </div>

            <textarea
              ref={textareaRef}
              id="chat-input"
              name="chat-input"
              rows={1}
              value={input}
              placeholder={
                !uploadedDocument || pipelineReady
                  ? "Ask anything..."
                  : "Preparing your file..."
              }
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              disabled={Boolean(uploadedDocument && !pipelineReady) || typing}
              className="w-full resize-none bg-transparent text-[15px] leading-6 text-white outline-none placeholder:text-white/45 disabled:opacity-50"
              style={{ minHeight: "28px", maxHeight: "140px" }}
            />

            <div className="mt-1.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <div ref={quickMenuRef} className="relative">
                  <button
                    type="button"
                    aria-label="Open quick actions"
                    aria-expanded={quickMenuOpen}
                    onClick={() => setQuickMenuOpen((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-transparent text-lg leading-none text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <QuickActionMenu open={quickMenuOpen} onSelect={openQuickAction} />
                </div>
                <ModelPicker selected={selectedModel} onSelect={setSelectedModel} />
              </div>

              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || Boolean(uploadedDocument && !pipelineReady) || typing}
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f6821f] text-[#17120e] transition hover:bg-[#ff9a3d] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6821f]/60"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              id="file-upload"
              name="file-upload"
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                void handleFileSelection(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </main>

      <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <SheetContent side="right" className="w-full border-l border-white/10 bg-[#151515] p-0 text-white sm:max-w-[460px]">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-white/10 px-5 py-4">
              <SheetTitle className="text-base font-semibold text-white">Resources</SheetTitle>
              <SheetDescription className="text-sm text-white/55">
                Hybrid answer context, model reasoning, and internet links.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {provenanceBlocks.length ? (
                <div className="space-y-5">
                  {provenanceBlocks.map((block) => (
                    <ProvenanceSection key={block.id} title={block.title} body={block.body} />
                  ))}

                  {visibleSources.length ? (
                    <div className="pt-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                        Internet links
                      </p>
                      <div className="mt-3 space-y-3">
                        {visibleSources.map((source) => (
                          <SourceCard key={source.id} source={source} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/55">
                  Select an assistant answer to inspect its resources.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Welcome({
  onSuggestion,
  disabled,
}: {
  onSuggestion: (suggestion: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-medium text-white">What can I help with?</h2>
        <p className="mt-1 text-sm text-white/55">
          Ask anything, or upload a file, image, or link for hybrid document, web, and model-aware answers.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            disabled={disabled}
            className="rounded-xl border border-white/10 bg-[#212120] px-3 py-3 text-left text-sm text-white/65 transition hover:border-white/20 hover:bg-[#2f2f2f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatStatus({
  message,
  error,
}: {
  message: string;
  error: string | null;
}) {
  if (!message && !error) return null;

  return (
    <div className="mb-5 w-full max-w-xl rounded-full border border-white/10 bg-[#212120] px-3 py-2 text-center text-xs text-white/55">
      {error ? (
        <span className="text-red-300">{error}</span>
      ) : (
        <span>{message}</span>
      )}
    </div>
  );
}

function SidebarChatSkeleton() {
  return (
    <div className="space-y-1 px-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl px-2 py-2"
        >
          <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
          <div className="mt-2 h-2.5 w-7/12 animate-pulse rounded-full bg-[#f1e8dc] dark:bg-[#242422]" />
        </div>
      ))}
    </div>
  );
}

function ChatThreadSkeleton() {
  return (
    <div className="w-full space-y-8 pt-6">
      <div className="flex justify-end">
        <div className="h-9 w-48 animate-pulse rounded-2xl bg-[#ead8c8] dark:bg-[#2a2a28]" />
      </div>
      <div className="flex gap-4">
        <div className="h-7 w-7 flex-shrink-0 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-11/12 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
          <div className="h-4 w-10/12 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
          <div className="h-4 w-7/12 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="h-9 w-36 animate-pulse rounded-2xl bg-[#ead8c8] dark:bg-[#2a2a28]" />
      </div>
      <div className="flex gap-4">
        <div className="h-7 w-7 flex-shrink-0 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-9/12 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
          <div className="h-4 w-8/12 animate-pulse rounded-full bg-[#ead8c8] dark:bg-[#2a2a28]" />
        </div>
      </div>
    </div>
  );
}

function SidebarButton({
  icon,
  label,
  active,
  compact = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 items-center justify-center rounded-lg text-sm transition ${
        active
          ? "bg-[#212120] text-white"
          : "text-white/78 hover:bg-[#212120] hover:text-white"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center">{icon}</span>
      {!compact ? <span className="flex-1 text-left">{label}</span> : null}
    </button>
  );
}

function ServiceRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "error";
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : tone === "error"
          ? "bg-red-500/10 text-red-700 dark:text-red-200"
          : "bg-[#f1e8dc] text-[#7a5b49] dark:bg-[#2a2a28] dark:text-slate-300";
  const dotClass =
    tone === "success"
      ? "bg-emerald-400"
      : tone === "warning"
        ? "bg-amber-400"
        : tone === "error"
          ? "bg-red-400"
          : "bg-zinc-500";

  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${classes}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <span className="text-sm text-[#201510] dark:text-white">{label}</span>
      </div>
      <span className="max-w-40 truncate text-sm text-[#737373] dark:text-slate-400">{value}</span>
    </div>
  );
}

function VisualizationChip({
  label,
  detail,
  active,
}: {
  label: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div
      className={`min-w-[92px] rounded-2xl border px-3 py-2 ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/10"
          : "border-[#e0d2c2] bg-white/85 dark:border-white/10 dark:bg-[#242422]/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            active ? "bg-emerald-400" : "bg-zinc-600"
          }`}
        />
        <p className="text-sm font-medium text-[#201510] dark:text-white">{label}</p>
      </div>
      <p className="mt-1 truncate text-[11px] text-[#737373] dark:text-slate-400">{detail}</p>
    </div>
  );
}

function VisualizationArrow() {
  return <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#a18672] dark:text-slate-500" />;
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const statusTone =
    attachment.status === "uploaded"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : attachment.status === "error"
        ? "bg-red-500/15 text-red-700 dark:text-red-300"
        : "bg-[#f1e8dc] text-[#7a5b49] dark:bg-[#2a2a28] dark:text-slate-400";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#e0d2c2] bg-white/85 px-2.5 py-1.5 text-xs text-[#201510] dark:border-white/10 dark:bg-[#242422]/60 dark:text-white">
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f1e8dc] text-[#7a5b49] dark:bg-[#2a2a28] dark:text-slate-300">
        {attachment.status === "uploading" || attachment.status === "processing" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : attachment.status === "uploaded" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
      </div>
      <span className="max-w-44 truncate">{attachment.name}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusTone}`}>
        {attachment.detail ?? attachment.status}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.name}`}
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[#7a5b49] transition hover:bg-[#f1e8dc] hover:text-[#201510] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      >
      <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ArtifactPreview({
  label,
  detail,
  tone,
  onRemove,
}: {
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "error";
  onRemove: () => void;
}) {
  const detailClass =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
      : tone === "warning"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-200"
        : tone === "error"
          ? "bg-red-500/15 text-red-700 dark:text-red-200"
          : "bg-[#f1e8dc] text-[#7a5b49] dark:bg-[#2a2a28] dark:text-slate-400";

  return (
    <div className="group relative w-32 overflow-hidden rounded-xl border border-[#e0d2c2] bg-white/85 shadow-sm shadow-[0_12px_24px_-18px_rgba(64,43,24,0.18)] dark:border-white/10 dark:bg-[#242422]/70 dark:shadow-black/30">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#d8c1ac] bg-white/90 text-[#7a5b49] shadow-sm backdrop-blur transition hover:bg-[#f1e8dc] hover:text-[#201510] dark:border-white/10 dark:bg-[#242422]/90 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="h-24 bg-[#f7f2ea] p-2 dark:bg-[#242422]">
        <div className="h-full rounded-sm border border-[#e5d8c9] bg-white px-1.5 py-1 text-[5px] leading-[1.25] text-[#737373] dark:border-white/10 dark:bg-[#242422] dark:text-slate-300">
          <div className="mb-1 h-1 w-16 rounded bg-[#e0d2c2] dark:bg-slate-700" />
          <div className="space-y-0.5">
            <div className="h-0.5 rounded bg-[#e0d2c2] dark:bg-slate-700" />
            <div className="h-0.5 rounded bg-[#e0d2c2] dark:bg-slate-700" />
            <div className="h-0.5 w-4/5 rounded bg-[#e0d2c2] dark:bg-slate-700" />
            <div className="mt-1 h-0.5 rounded bg-[#e0d2c2] dark:bg-slate-700" />
            <div className="h-0.5 rounded bg-[#e0d2c2] dark:bg-slate-700" />
            <div className="h-0.5 w-3/4 rounded bg-[#e0d2c2] dark:bg-slate-700" />
          </div>
          <div className="mt-3 inline-flex rounded bg-[#e67d2b] px-1 py-0.5 text-[8px] font-bold leading-none text-white dark:text-[#201510]">
            PDF
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#a18672] dark:text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#201510] dark:text-white">
          {label}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${detailClass}`}>
          {detail}
        </span>
      </div>
    </div>
  );
}

function QuickActionMenu({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (action: QuickAction) => void;
}) {
  return (
    <div
      className={`absolute bottom-10 left-0 z-50 w-64 origin-bottom-left overflow-hidden rounded-2xl border border-[#e5d8c9] bg-[#fffdfa] shadow-[0_18px_42px_-18px_rgba(64,43,24,0.22)] transition duration-200 ease-out dark:border-white/10 dark:bg-[#242422] dark:shadow-black/45 ${
        open
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-1 scale-95 opacity-0"
      }`}
    >
      <div className="max-h-[70vh] py-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onSelect(action)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#201510] transition hover:bg-[#f1e8dc] dark:text-white dark:hover:bg-slate-800/80"
          >
            <QuickActionIcon kind={action.icon} />
            <span className="flex-1">{action.label}</span>
            {action.chevron ? (
              <ChevronRight className="h-4 w-4 text-[#a18672] dark:text-slate-500" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickActionIcon({ kind }: { kind: QuickAction["icon"] }) {
  switch (kind) {
    case "paperclip":
      return <Paperclip className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    case "file":
      return <FileText className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    case "image":
      return <ImagePlus className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    case "spark":
      return <Sparkles className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    case "search":
      return <Search className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    case "globe":
      return <Globe className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    case "more":
      return <MoreHorizontal className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    case "folder":
      return <Folder className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
    default:
      return <BrainCircuit className="h-4 w-4 text-[#7a5b49] dark:text-slate-300" />;
  }
}

function ProvenanceSection({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section>
      <p className="text-[12px] font-medium text-white/92">{title}</p>
      <p className="mt-2 text-sm leading-7 text-white/68">{body}</p>
    </section>
  );
}

function SourceCard({ source }: { source: SourceItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1d1d1c] p-4 transition hover:border-white/15 hover:bg-[#232321]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium uppercase tracking-[0.14em] text-white/42">
            {source.domain}
          </p>
          <p className="mt-2 text-sm font-medium text-white/92">{source.title}</p>
        </div>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${source.title}`}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          >
            <ArrowUpRight className="h-4 w-4" />
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/55">
          {source.sourceType}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/55">
          {source.domain}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/70">
        {source.description}
      </p>

      {source.url ? (
        <div className="mt-4">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white transition hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          >
            Open source
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}




