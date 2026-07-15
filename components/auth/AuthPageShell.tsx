"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Sparkles } from "lucide-react";

import { PaperDither } from "@/components/ui/paper-dither";

export default function AuthPageShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#050505] text-[#f4f3ec] lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <div className="mx-auto grid min-h-screen w-full max-w-[1500px] lg:h-dvh lg:min-h-0 lg:grid-cols-[minmax(440px,0.88fr)_minmax(0,1.12fr)]">
        <section className="relative flex min-h-screen flex-col border-white/10 px-5 py-5 sm:px-8 sm:py-7 lg:h-dvh lg:min-h-0 lg:border-r lg:px-12 lg:py-6 xl:px-16">
          <header className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/60 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e879]/50"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-white"
            >
              <span aria-hidden="true" className="size-6 rounded-full bg-[linear-gradient(135deg,#fff5a5_0%,#f6e66c_42%,#f27a28_100%)] shadow-[0_0_24px_rgba(242,122,40,0.22)]" />
              kontext
            </Link>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center py-8 lg:py-5">
            {children}
          </div>

          <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-white/30 lg:text-left">
            Persistent memory · trusted context
          </p>
        </section>

        <aside className="relative hidden min-h-0 overflow-hidden bg-[#110906] lg:block lg:h-dvh">
          <PaperDither
            className="inset-0"
            dark={{ colorBack: "#080706", colorFront: "#f15a16" }}
            light={{ colorBack: "#080706", colorFront: "#f15a16" }}
            eager
            maxPixelCount={1100 * 1200}
            scale={0.72}
            shape="warp"
            size={2.4}
            speed={0.18}
            type="4x4"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.08)_0%,rgba(5,5,5,0.18)_45%,rgba(5,5,5,0.92)_100%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.18)_0.55px,transparent_0.65px)] [background-size:5px_5px]" />

          <div className="relative z-10 flex h-full min-h-0 flex-col justify-between py-10 pl-5 pr-10 xl:py-14 xl:pl-7 xl:pr-14">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
              <span className="inline-flex items-center gap-2">
                <Sparkles aria-hidden="true" className="size-3.5 text-[#f6e879]" />
                Kontext access
              </span>
              <span>01 / memory</span>
            </div>

            <div className="max-w-2xl pb-8">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f6e879]">Your work, remembered.</p>
              <h2 className="mt-5 max-w-xl text-balance font-heading text-5xl font-medium leading-[0.96] tracking-[-0.06em] text-white xl:text-6xl">
                Start every session with context.
              </h2>
              <p className="mt-6 max-w-lg text-base leading-7 text-white/60">
                Sign in once. Keep documents, decisions, and agent actions connected across every workspace.
              </p>

              <div className="mt-8 grid max-w-xl gap-2 sm:grid-cols-3">
                {["Source linked", "Permission aware", "Always retrievable"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-xs text-white/70 backdrop-blur">
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-[#f6e879]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
