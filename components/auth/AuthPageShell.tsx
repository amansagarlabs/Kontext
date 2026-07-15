"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Zap } from "lucide-react";

export default function AuthPageShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(230,125,43,0.12),transparent_34%),linear-gradient(180deg,#f7f2ea_0%,#f1e8dc_100%)] text-[#201510] dark:bg-[radial-gradient(circle_at_top,rgba(230,125,43,0.16),transparent_34%),linear-gradient(180deg,#231915_0%,#1a120f_100%)] dark:text-white">
      <div className="relative isolate min-h-screen overflow-hidden px-5 py-5 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.6),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(230,125,43,0.08),transparent_24%)] opacity-90 dark:bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(230,125,43,0.14),transparent_24%)] dark:opacity-100" />

        <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col">
          <header className="flex items-center justify-between gap-4 pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#e5d8c9] bg-[#fffdfa]/85 px-3 py-2 text-sm font-medium text-[#7a5b49] shadow-[0_10px_24px_-18px_rgba(64,43,24,0.18)] backdrop-blur transition hover:border-[#d7bfa6] hover:text-[#201510] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e67d2b]/40 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300 dark:shadow-[0_10px_24px_-18px_rgba(0,0,0,0.5)] dark:hover:border-white/20 dark:hover:text-white dark:focus-visible:ring-[#e67d2b]/30"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#e5d8c9] bg-[#fffdfa]/85 px-4 py-2 text-sm font-semibold text-[#201510] shadow-[0_10px_24px_-18px_rgba(64,43,24,0.18)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:shadow-[0_10px_24px_-18px_rgba(0,0,0,0.5)]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e67d2b] text-white">
                <Zap className="h-4 w-4" />
              </span>
              AmanAgent Lab
            </Link>
          </header>

          <div className="flex flex-1 items-center justify-center py-10 sm:py-12">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
