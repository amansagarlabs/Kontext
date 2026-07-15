"use client";

import type { ReactNode } from "react";
import {
  Clipboard,
  Copy,
  Edit3,
  Flag,
  RefreshCw,
  Share,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Message } from "@/components/chat/types";

interface Props {
  messages: Message[];
  isTyping: boolean;
  onCopy?: (content: string) => void;
  onEdit?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
  onSources?: (message: Message) => void;
}

export default function MessageList({
  messages,
  isTyping,
  onCopy,
  onEdit,
  onRegenerate,
  onSources,
}: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[768px] flex-col gap-12">
      {messages.map((msg) => (
        (() => {
          const isHighlightedAnswer =
            msg.role === "assistant" && msg.emphasis === "highlight";
          const messageClasses =
            msg.role === "user"
              ? "bg-[#2f2f2f] text-white shadow-none"
              : isHighlightedAnswer
                ? "bg-[#2f2f2f] text-white shadow-none"
                : "bg-[#2f2f2f] text-white shadow-none";

          return (
        <div
          key={msg.id}
          className={`group/message flex w-full gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div className={`flex flex-col ${msg.role === "user" ? "max-w-[72%] items-end" : "w-full items-start"}`}>
            <div
              className={`relative ${
                msg.role === "user"
                  ? "rounded-[22px] px-5 py-3 text-[15px]"
                  : "w-full rounded-[24px] px-20 py-16 text-[16px]"
              } leading-7 ${messageClasses}`}
            >
              {msg.role === "assistant" ? (
                <div className="absolute left-4 top-4">
                  <button
                    type="button"
                    onClick={() => onEdit?.(msg)}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-transparent px-3 text-sm font-semibold text-white transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              ) : null}
              {msg.badge ? (
                <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] font-medium uppercase text-white/70">
                  {msg.badge}
                </div>
              ) : null}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>

            {msg.role === "user" ? (
              <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover/message:opacity-100">
                <MessageActionButton
                  label="Copy question"
                  onClick={() => onCopy?.(msg.content)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </MessageActionButton>
                <MessageActionButton
                  label="Edit question"
                  onClick={() => onEdit?.(msg)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </MessageActionButton>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-white/70 opacity-0 transition group-hover/message:opacity-100">
                <MessageActionButton
                  label="Copy answer"
                  onClick={() => onCopy?.(msg.content)}
                >
                  <Clipboard className="h-3.5 w-3.5" />
                </MessageActionButton>
                <MessageActionButton label="Good response">
                  <ThumbsUp className="h-3.5 w-3.5" />
                </MessageActionButton>
                <MessageActionButton label="Bad response">
                  <ThumbsDown className="h-3.5 w-3.5" />
                </MessageActionButton>
                <MessageActionButton label="Share answer">
                  <Share className="h-3.5 w-3.5" />
                </MessageActionButton>
                <MessageActionButton
                  label="Regenerate answer"
                  onClick={() => onRegenerate?.(msg)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </MessageActionButton>
                <MessageActionButton label="Report answer">
                  <Flag className="h-3.5 w-3.5" />
                </MessageActionButton>
                <button
                  type="button"
                  onClick={() => onSources?.(msg)}
                  className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Sources
                </button>
              </div>
            )}
          </div>
        </div>
          );
        })()
      ))}

      {isTyping && (
        <div className="flex w-full">
          <div className="flex items-center gap-1 rounded-[24px] bg-[#2f2f2f] px-5 py-4">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:300ms]" />
          </div>
        </div>
      )}
    </div>
  );
}

function MessageActionButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
    >
      {children}
    </button>
  );
}

