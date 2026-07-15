"use client";

import { useCallback, useRef, useState } from "react";
import type { UploadResponse } from "@/lib/types";
import { uploadPdf } from "@/services/api";

type Props = {
  onUploaded: (doc: UploadResponse) => void;
  disabled?: boolean;
};

export function PdfUpload({ onUploaded, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const result = await uploadPdf(file);
        onUploaded(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [onUploaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || loading) return;
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [disabled, loading, handleFile],
  );

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Upload a file
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Stored locally in{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
          backend/uploads/
        </code>{" "}
        — Step 2
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !loading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
          dragging
            ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
            : "border-zinc-300 dark:border-zinc-700"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.markdown,.csv,.json,.html,.htm,.docx,.py,.js,.jsx,.ts,.tsx,.css,.scss,.sql,.yaml,.yml,.xml,.toml,.ini,.log,.java,.go,.rs,.c,.h,.cpp,.hpp,.sh,.ps1"
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />

        {loading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Uploading…</p>
        ) : (
          <>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Drag & drop a file here, or
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Choose file
            </button>
            <p className="mt-2 text-xs text-zinc-400">Max 20 MB · PDF, DOCX, text, data, web, and source files</p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </section>
  );
}


