"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Database, Download, Plug, Trash2, Upload } from "lucide-react";

import { PaperDither } from "@/components/ui/paper-dither";
import { deleteMemory, fetchConnectionStatus, fetchRecentMemories, importMemories, type ConnectionStatus, type MemoryItem } from "@/services/dashboard";

export default function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus>({});
  const [message, setMessage] = useState("Loading memory…");
  const fileInput = useRef<HTMLInputElement>(null);

  async function reload() {
    const [memory, status] = await Promise.all([fetchRecentMemories(500), fetchConnectionStatus()]);
    setItems(memory); setConnections(status); setMessage("");
  }
  useEffect(() => { void reload().catch(() => setMessage("Memory service is unavailable.")); }, []);

  function exportData() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "kontext-memory.json"; anchor.click(); URL.revokeObjectURL(url);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(incoming)) throw new Error();
      await importMemories(incoming); await reload(); setMessage(`${incoming.length} memories imported.`);
    } catch { setMessage("Choose a valid Kontext memory JSON file."); }
    event.target.value = "";
  }

  return <main className="dark min-h-screen bg-[#070707] text-white"><div className="mx-auto max-w-[1280px] px-5 py-7 sm:px-8 lg:px-10">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white"><ArrowLeft className="size-4" />Dashboard</Link>
    <section className="relative mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0b08] p-7 lg:p-10"><PaperDither className="inset-y-0 right-0 w-1/2 opacity-75" dark={{ colorBack: "#0d0b0800", colorFront: "#e85d18" }} light={{ colorBack: "#0d0b0800", colorFront: "#e85d18" }} eager maxPixelCount={800 * 360} scale={.72} shape="wave" size={2.2} speed={.15} type="4x4" /><div className="absolute inset-0 bg-[linear-gradient(90deg,#0d0b08_0%,rgba(13,11,8,.94)_55%,transparent)]"/><div className="relative z-10 max-w-2xl"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f6e879]">Context layer / Memory</p><h1 className="mt-3 font-heading text-4xl tracking-[-.055em]">Your portable context memory.</h1><p className="mt-4 text-sm leading-7 text-white/45">Kontext saves durable facts and summaries separately from chat history, then retrieves them before an agent answers. Export it anytime or connect the same layer through API and MCP.</p><div className="mt-6 flex flex-wrap gap-2"><button onClick={exportData} disabled={!items.length} className="inline-flex items-center gap-2 rounded-xl bg-[#f6e879] px-4 py-2.5 text-sm font-semibold text-[#171814] disabled:opacity-40"><Download className="size-4"/>Export JSON</button><button onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm"><Upload className="size-4"/>Import JSON</button><input ref={fileInput} type="file" accept="application/json,.json" onChange={importFile} className="hidden"/></div></div></section>
    {message && <p className="mt-4 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-white/50">{message}</p>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><section className="overflow-hidden rounded-[20px] border border-white/10 bg-[#10100f]"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className="text-sm font-semibold">Saved memory</span><span className="text-xs text-white/35">{items.length} records</span></div>{items.length ? items.map(item => <article key={item.key} className="flex gap-4 border-b border-white/[.06] p-5 last:border-0"><Database className="mt-1 size-4 shrink-0 text-[#f6e879]"/><div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase tracking-[.12em] text-white/35">{item.key} · {item.source}</p><p className="mt-2 text-sm leading-6 text-white/65">{item.content}</p></div><button aria-label={`Delete ${item.key}`} onClick={async()=>{await deleteMemory(item.key); await reload();}} className="size-9 rounded-lg text-white/25 hover:bg-red-400/10 hover:text-red-300"><Trash2 className="mx-auto size-4"/></button></article>) : <div className="p-12 text-center text-sm text-white/35">No durable memory yet. Kontext will save useful facts as you work.</div>}</section>
    <aside className="space-y-4"><div className="rounded-[20px] border border-white/10 bg-[#10100f] p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Plug className="size-4 text-[#f6e879]"/>Storage connections</div><div className="mt-4 space-y-2">{Object.entries(connections).map(([name, value])=><div key={name} className="rounded-xl border border-white/[.08] bg-black/25 p-3"><div className="flex items-center justify-between"><span className="capitalize text-sm text-white/70">{name}</span><span className={value.connected?"text-[10px] uppercase text-[#f6e879]":"text-[10px] uppercase text-white/30"}>{value.connected?"Connected":"Not configured"}</span></div><p className="mt-1 text-xs text-white/30">{value.driver || value.database || value.reason}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-white/30">Configure Postgres and Milvus credentials in the server environment. Secrets are never entered or exposed in this browser.</p></div><div className="rounded-[20px] border border-white/10 bg-[#10100f] p-5"><Bot className="size-5 text-[#e85d18]"/><h2 className="mt-3 text-lg font-semibold">Use with any agent</h2><p className="mt-2 text-sm leading-6 text-white/40">The memory scope is available to authenticated API clients. MCP and agent execution are enabled on plans that include those scopes.</p><Link href="/chat" className="mt-4 inline-flex text-sm text-[#f6e879]">Test memory in chat →</Link></div></aside></div>
  </div></main>;
}
