export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  emphasis?: "default" | "highlight";
  badge?: string;
  resources?: MessageResource[];
}

export interface MessageResource {
  title: string;
  url: string;
  domain: string;
  sourceType: string;
  description?: string;
}

export interface Model {
  id: string;
  name: string;
  color: string;
  group?: string;
  caps?: string[];
}

export const MODELS: Model[] = [
  {
    id: "deepseek-v3.2",
    name: "DeepSeek V3.2",
    color: "linear-gradient(135deg,#ff6b6b,#ffa500)",
    group: "Available",
    caps: ["Free", "OpenRouter"],
  },
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    color: "linear-gradient(135deg,#6c63ff,#3ecfcf)",
    group: "Available",
    caps: ["Free", "OpenRouter", "Vision"],
  },
  {
    id: "nvidia-nemotron",
    name: "NVIDIA Nemotron",
    color: "linear-gradient(135deg,#76b900,#1a1a1a)",
    group: "Available",
    caps: ["Free", "OpenRouter"],
  },
  {
    id: "gpt-oss-20b",
    name: "GPT OSS 20B",
    color: "linear-gradient(135deg,#43b89c,#1a6b52)",
    group: "Available",
    caps: ["Open Source", "Free"],
  },
  {
    id: "gpt-oss-120b",
    name: "GPT OSS 120B",
    color: "linear-gradient(135deg,#43b89c,#1a6b52)",
    group: "Available",
    caps: ["Open Source", "Free"],
  },
  {
    id: "grok-4.1-fast",
    name: "Grok 4.1 Fast",
    color: "linear-gradient(135deg,#888,#333)",
    group: "Available",
    caps: ["OpenRouter", "Vision"],
  },
  {
    id: "qwen3-14b",
    name: "Qwen3-14B",
    color: "linear-gradient(135deg,#ff9a3c,#e55)",
    group: "Alibaba",
    caps: ["Open Source", "Free", "Local"],
  },
];
