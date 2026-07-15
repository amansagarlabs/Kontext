"use client"

import Link from "next/link"
import { Menu, PanelLeftClose, Sparkles, X } from "lucide-react"
import { useState } from "react"

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

type AgentNavigationProps = {
  active?: "workspace" | "crawl" | "chat"
  compact?: boolean
  onCollapse?: () => void
}

const items = [
  { href: "/dashboard", label: "Workspace", id: "workspace" },
  { href: "/amancrawl", label: "Web", id: "crawl" },
  { href: "/chat", label: "Chat", id: "chat" },
] as const

export function AgentNavigation({ active, compact = false, onCollapse }: AgentNavigationProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[#c8d6d1] bg-[#f7f9f6]/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#11140f]/90">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6821f]">
          <span className="grid size-7 grid-cols-2 gap-[2px] rounded-[7px] bg-[#f6821f] p-[6px]">
            <span className="rounded-[1px] bg-white" /><span className="rounded-[1px] bg-white/45" />
            <span className="rounded-[1px] bg-white/45" /><span className="rounded-[1px] bg-white" />
          </span>
          <span className="text-sm font-semibold tracking-[-0.03em] text-[#18201d] dark:text-white">kontext</span>
          <span className="hidden rounded-full border border-[#a7bdb6] bg-[#CAE0DA] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#31564d] sm:inline">Agent workspace</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Workspace navigation">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className={`rounded-lg px-3 py-2 text-[13px] font-medium transition ${active === item.id ? "bg-[#dceae5] text-[#17211d] dark:bg-[#CAE0DA]/15 dark:text-[#CAE0DA]" : "text-[#65716b] hover:bg-[#e9efec] hover:text-[#17211d] dark:text-white/55 dark:hover:bg-white/5 dark:hover:text-white"}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <AnimatedThemeToggler aria-label="Switch color theme" variant="circle" className="inline-flex size-9 items-center justify-center rounded-lg border border-[#c8d6d1] text-[#52635c] hover:border-[#f6821f] dark:border-white/10 dark:text-white/70" />
          {!compact && <Link href="/chat" className="hidden items-center gap-2 rounded-lg bg-[#18201d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#33423b] sm:flex dark:bg-[#f6821f] dark:text-[#17120e]"><Sparkles className="size-3.5" /> New task</Link>}
          {onCollapse && <button onClick={onCollapse} className="hidden size-9 items-center justify-center rounded-lg border border-[#c8d6d1] text-[#52635c] hover:border-[#f6821f] md:inline-flex dark:border-white/10 dark:text-white/70" aria-label="Collapse navigation"><PanelLeftClose className="size-4" /></button>}
          <button onClick={() => setOpen((value) => !value)} className="inline-flex size-9 items-center justify-center rounded-lg border border-[#c8d6d1] text-[#52635c] md:hidden dark:border-white/10 dark:text-white/70" aria-label="Toggle navigation">{open ? <X className="size-4" /> : <Menu className="size-4" />}</button>
        </div>
      </div>
      {open && <nav className="border-t border-[#c8d6d1] bg-[#f7f9f6] px-4 py-3 md:hidden dark:border-white/10 dark:bg-[#11140f]" aria-label="Mobile workspace navigation"><div className="grid gap-1">{items.map((item) => <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className={`rounded-lg px-3 py-2.5 text-sm font-medium ${active === item.id ? "bg-[#CAE0DA] text-[#17211d]" : "text-[#65716b] dark:text-white/65"}`}>{item.label}</Link>)}</div></nav>}
    </header>
  )
}
