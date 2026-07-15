"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LogOut, ShieldCheck, Sparkles } from "lucide-react";

import { clearAuthSession, isAuthenticated, loadAuthUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";
import { PaperDither, type DitherShape } from "@/components/ui/paper-dither";

const AVATAR_KEY = "kontext-dither-avatar";

const avatars: Array<{
  id: string;
  label: string;
  shape: DitherShape;
  colorBack: string;
  colorFront: string;
  scale: number;
}> = [
  { id: "signal", label: "Signal", shape: "wave", colorBack: "#090806", colorFront: "#f06418", scale: 0.82 },
  { id: "memory", label: "Memory", shape: "warp", colorBack: "#090806", colorFront: "#f6e879", scale: 0.9 },
  { id: "orbit", label: "Orbit", shape: "swirl", colorBack: "#090806", colorFront: "#8c82ff", scale: 0.74 },
  { id: "source", label: "Source", shape: "ripple", colorBack: "#090806", colorFront: "#67d9bd", scale: 0.86 },
];

export default function ProfilePage() {
  const router = useRouter();
  const [user] = useState<AuthUser | null>(() => (isAuthenticated() ? loadAuthUser() : null));
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    if (typeof window === "undefined") return avatars[0].id;
    return localStorage.getItem(AVATAR_KEY) || avatars[0].id;
  });

  useEffect(() => {
    if (!user) router.replace("/login?redirect=/profile");
  }, [router, user]);

  if (!user) return null;

  const selected = avatars.find((avatar) => avatar.id === selectedAvatar) || avatars[0];
  const displayName = user.full_name || user.username || user.email.split("@")[0];

  function chooseAvatar(id: string) {
    setSelectedAvatar(id);
    localStorage.setItem(AVATAR_KEY, id);
  }

  function signOut() {
    clearAuthSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="dark min-h-screen bg-[#070707] text-white">
      <div className="mx-auto w-full max-w-[1360px] px-5 py-6 sm:px-8 lg:px-10 lg:py-9">
        <header className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.07] hover:text-white">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Dashboard
          </Link>
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.03em]">
            <span aria-hidden="true" className="size-6 rounded-full bg-[linear-gradient(135deg,#fff5a5,#f6e66c_42%,#f27a28)]" />
            kontext
          </Link>
        </header>

        <section className="relative mt-7 overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0a08] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <PaperDither
            className="inset-y-0 right-0 w-[58%] opacity-75"
            dark={{ colorBack: "#0c0a0800", colorFront: selected.colorFront }}
            light={{ colorBack: "#0c0a0800", colorFront: selected.colorFront }}
            eager
            maxPixelCount={900 * 460}
            scale={selected.scale}
            shape={selected.shape}
            size={2.2}
            speed={0.16}
            type="4x4"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#0c0a08_0%,rgba(12,10,8,0.94)_48%,rgba(12,10,8,0.18)_100%)]" />
          <div className="relative z-10 flex max-w-2xl items-center gap-5 sm:gap-7">
            <DitherAvatar avatar={selected} className="size-24 shrink-0 sm:size-32" />
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f6e879]">Personal context</p>
              <h1 className="mt-3 truncate font-heading text-3xl font-medium tracking-[-0.05em] sm:text-5xl">{displayName}</h1>
              <p className="mt-2 truncate text-sm text-white/45">{user.email}</p>
              <span className="mt-4 inline-flex rounded-full border border-[#f6e879]/25 bg-[#f6e879]/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#f6e879]">{user.plan} plan</span>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[20px] border border-white/[0.08] bg-[#10100f] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f6e879]">Dither identity</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Choose your signal</h2>
                <p className="mt-2 text-sm leading-6 text-white/40">Your selected avatar is stored on this device.</p>
              </div>
              <Sparkles aria-hidden="true" className="size-5 text-[#f6e879]" />
            </div>

            <div role="radiogroup" aria-label="Choose a dither avatar" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {avatars.map((avatar) => {
                const active = selectedAvatar === avatar.id;
                return (
                  <button key={avatar.id} type="button" role="radio" aria-checked={active} onClick={() => chooseAvatar(avatar.id)} className={`relative flex flex-col items-center gap-3 rounded-[16px] border p-3 transition ${active ? "border-[#f6e879]/70 bg-[#f6e879]/[0.06]" : "border-white/[0.08] bg-black/25 hover:border-white/20"}`}>
                    <DitherAvatar avatar={avatar} className="size-20" />
                    <span className={`text-xs font-medium ${active ? "text-[#f6e879]" : "text-white/50"}`}>{avatar.label}</span>
                    {active ? <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-[#f6e879] text-[#171814]"><Check aria-hidden="true" className="size-3" /></span> : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[20px] border border-white/[0.08] bg-[#10100f] p-5 sm:p-6">
            <div className="flex items-center gap-2 text-white/70">
              <ShieldCheck aria-hidden="true" className="size-5 text-[#67d9bd]" />
              <h2 className="text-sm font-semibold">Account details</h2>
            </div>
            <dl className="mt-5 divide-y divide-white/[0.07]">
              <ProfileRow label="Full name" value={user.full_name || "Not set"} />
              <ProfileRow label="Username" value={user.username || "Not set"} />
              <ProfileRow label="Email" value={user.email} />
              <ProfileRow label="Plan" value={user.plan} capitalize />
            </dl>
            <button type="button" onClick={signOut} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/60 transition hover:border-red-400/25 hover:bg-red-400/[0.06] hover:text-red-200">
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

function DitherAvatar({ avatar, className }: { avatar: (typeof avatars)[number]; className: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-full border border-white/10 bg-[#080706] ${className}`}>
      <PaperDither
        className="inset-0"
        dark={{ colorBack: avatar.colorBack, colorFront: avatar.colorFront }}
        light={{ colorBack: avatar.colorBack, colorFront: avatar.colorFront }}
        eager
        maxPixelCount={180 * 180}
        scale={avatar.scale}
        shape={avatar.shape}
        size={2}
        speed={0.12}
        type="4x4"
      />
      <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_-18px_30px_rgba(0,0,0,0.35)]" />
    </span>
  );
}

function ProfileRow({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-4 py-3 text-sm">
      <dt className="text-white/35">{label}</dt>
      <dd className={`truncate text-right text-white/75 ${capitalize ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}
