"use client";

import { useEffect, useRef, useState } from "react";
import { MODELS, Model } from "@/components/chat/types";

interface Props {
  selected: Model | null;
  onSelect: (m: Model) => void;
}

export default function ModelPicker({ selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const current = selected ?? MODELS[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const grouped = MODELS.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  ).reduce<Record<string, Model[]>>((acc, m) => {
    const group = m.group ?? "Available";
    (acc[group] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-full border border-white/10 bg-transparent px-2.5 text-xs text-white/80 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
      >
        <ModelDot color={current.color} />
        <span className="max-w-32 truncate">{current.name}</span>
        <span className="text-[10px] leading-none text-white/45">v</span>
      </button>

      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-72 rounded-[22px] border border-white/10 bg-[#212120] p-2 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.75)]">
          <div className="px-1 pb-2 pt-1">
            <p className="text-[10px] uppercase text-white/45">
              Model
            </p>
          </div>
          <input
            id="model-search"
            name="model-search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models..."
            className="mb-2 h-9 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25"
          />
          {Object.entries(grouped).map(([group, models]) => (
            <div key={group} className="mb-2">
              <p className="mb-1 px-1 text-[10px] uppercase text-white/45">
                {group}
              </p>
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-white/10 ${
                    m.id === current.id
                      ? "bg-white/10 text-white"
                      : "text-white/65"
                  }`}
                >
                  <ModelDot color={m.color} />
                  <span className="flex-1 text-left">{m.name}</span>
                  <span className="flex gap-1">
                    {m.caps?.map((cap) => (
                      <span
                        key={cap}
                        className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/70"
                      >
                        {cap}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModelDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}
