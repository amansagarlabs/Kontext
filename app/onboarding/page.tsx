"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Braces, Check, Database, FileText, Sparkles } from "lucide-react";

import { ChoiceGroup, Onboarding } from "@/components/ui/onboarding";
import { PaperDither } from "@/components/ui/paper-dither";
import { isAuthenticated, loadAuthUser } from "@/lib/auth";
import { completeOnboarding } from "@/lib/onboarding";
import type { AuthUser, AuthWorkspace } from "@/lib/types";
import { loadWorkspaces, saveWorkspaces } from "@/lib/workspaces";

const choices = {
  role: [
    ["builder", "Builder", "Ship AI features and agent workflows", Braces],
    ["founder", "Founder", "Keep product decisions and research connected", Sparkles],
    ["team", "Team lead", "Give a team one trusted context layer", Bot],
  ],
  goal: [
    ["memory", "Agent memory", "Recall decisions across sessions", Database],
    ["docs", "Docs + artifacts", "Ground answers in your own files", FileText],
    ["agents", "Portable agents", "Connect context through API and MCP", Bot],
  ],
} as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [user] = useState<AuthUser | null>(() => (isAuthenticated() ? loadAuthUser() : null));
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("builder");
  const [goal, setGoal] = useState("memory");
  const [workspaceName, setWorkspaceName] = useState("My workspace");

  useEffect(() => {
    if (!user) router.replace("/login?redirect=/onboarding");
  }, [router, user]);

  if (!user) return null;
  const currentUser = user;

  function finish() {
    const existing = loadWorkspaces(currentUser);
    let workspace = existing[0];
    if (!workspace) {
      workspace = {
        id: crypto.randomUUID(),
        name: workspaceName.trim() || "My workspace",
        platform: "Kontext Memory",
        last_active: new Date().toISOString(),
      } satisfies AuthWorkspace;
      saveWorkspaces(currentUser.id, [workspace]);
    }
    localStorage.setItem(`kontext-onboarding-profile:${currentUser.id}`, JSON.stringify({ role, goal }));
    completeOnboarding(currentUser.id);
    router.push(`/dashboard?workspace=${encodeURIComponent(workspace.id)}`);
    router.refresh();
  }

  return (
    <main className="dark grid min-h-screen bg-[#070707] text-white lg:grid-cols-[0.92fr_1.08fr]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 bg-[#0b0908] lg:block">
        <PaperDither className="absolute inset-0 opacity-90" dark={{ colorBack: "#070707", colorFront: "#ed5d13" }} light={{ colorBack: "#070707", colorFront: "#ed5d13" }} eager maxPixelCount={1000 * 1000} scale={0.72} shape="warp" size={2.4} speed={0.18} type="4x4" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,7,.05),rgba(7,7,7,.2)_45%,#070707_100%)]" />
        <div className="relative z-10 flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-2.5 font-semibold"><span className="size-6 rounded-full bg-[linear-gradient(135deg,#fff5a5,#f6e66c_42%,#f27a28)]" />kontext</div>
          <div className="max-w-lg pb-8"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#f6e879]">Your context, configured</p><h1 className="mt-4 font-heading text-5xl leading-[.95] tracking-[-.06em] xl:text-6xl">Start with memory that belongs to you.</h1><p className="mt-5 max-w-md text-sm leading-7 text-white/50">A workspace keeps memory, artifacts, sources, and agent access inside one clear boundary.</p></div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-10">
        <Onboarding value={step} onValueChange={setStep} totalSteps={3} onComplete={finish} canGoNext={(current) => current !== 3 || Boolean(workspaceName.trim())} className="w-full max-w-[650px] border-white/10 bg-[#0d0d0c] p-6 text-white shadow-2xl sm:p-9">
          <div className="mb-8 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f6e879]">Workspace setup</p><Onboarding.StepIndicator variant="pills" className="w-28" dotClassName="data-[state=active]:bg-[#f6e879] data-[state=completed]:bg-[#f6e879]/60 data-[state=inactive]:bg-white/10" /></div>
          <Onboarding.Step step={1}>
            <Onboarding.Header className="text-left"><h2 className="font-heading text-3xl tracking-[-.05em]">What best describes your work?</h2><p className="mt-2 text-sm text-white/45">This shapes the starting experience. You can change it later.</p></Onboarding.Header>
            <ChoiceCards name="role" items={choices.role} value={role} onChange={setRole} />
          </Onboarding.Step>
          <Onboarding.Step step={2}>
            <Onboarding.Header className="text-left"><h2 className="font-heading text-3xl tracking-[-.05em]">What should Kontext organize first?</h2><p className="mt-2 text-sm text-white/45">Choose the surface you want ready when the workspace opens.</p></Onboarding.Header>
            <ChoiceCards name="goal" items={choices.goal} value={goal} onChange={setGoal} />
          </Onboarding.Step>
          <Onboarding.Step step={3}>
            <Onboarding.Header className="text-left"><h2 className="font-heading text-3xl tracking-[-.05em]">Create your first workspace.</h2><p className="mt-2 text-sm text-white/45">A workspace is the boundary around memory, files, tools, and permissions.</p></Onboarding.Header>
            <label className="mt-8 block text-sm font-medium text-white/70">Workspace name<input autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={80} className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3.5 text-white outline-none focus:border-[#f6e879]/55 focus:ring-2 focus:ring-[#f6e879]/10" /></label>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">{["Private by default", "Sources attached", "MCP-ready context"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.025] px-3 py-3 text-xs text-white/50"><Check className="size-3.5 text-[#f6e879]" />{item}</div>)}</div>
          </Onboarding.Step>
          <Onboarding.Navigation className="mt-9 border-0 p-0 [&_button]:border-white/10 [&_button]:bg-white/[.04] [&_button]:text-white [&_[data-slot=onboarding-next]]:bg-[#f6e879] [&_[data-slot=onboarding-next]]:text-[#171814] [&_[data-slot=onboarding-complete]]:bg-[#f6e879] [&_[data-slot=onboarding-complete]]:text-[#171814]" completeLabel="Create workspace" />
        </Onboarding>
      </section>
    </main>
  );
}

function ChoiceCards({ name, items, value, onChange }: { name: string; items: ReadonlyArray<readonly [string, string, string, React.ComponentType<{ className?: string }>]>; value: string; onChange: (value: string) => void }) {
  return <ChoiceGroup name={name} value={value} onValueChange={onChange} className="mt-7 grid gap-3">{items.map(([id, title, description, Icon]) => <ChoiceGroup.Item key={id} value={id} className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-4 transition hover:bg-white/[.05] data-[state=selected]:border-[#f6e879]/55 data-[state=selected]:bg-[#f6e879]/[.06]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[.05] text-white/45 group-data-[state=selected]:text-[#f6e879]"><Icon className="size-[18px]" /></span><span className="flex-1"><span className="block text-sm font-medium text-white/85">{title}</span><span className="mt-1 block text-xs text-white/35">{description}</span></span><span className="size-4 rounded-full border border-white/20 group-data-[state=selected]:border-[5px] group-data-[state=selected]:border-[#f6e879]" /></ChoiceGroup.Item>)}</ChoiceGroup>;
}
