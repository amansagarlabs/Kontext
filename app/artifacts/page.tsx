"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Database, FileText, MessageSquare } from "lucide-react";

import { ChatPanel } from "@/components/ChatPanel";
import { DocumentInfo } from "@/components/DocumentInfo";
import { PdfUpload } from "@/components/PdfUpload";
import { PipelineVisualizer } from "@/components/PipelineVisualizer";
import { PipelineViewer } from "@/components/PipelineViewer";
import { PaperDither } from "@/components/ui/paper-dither";
import type { PipelineStepId, UploadResponse } from "@/lib/types";
import { loadDocument, loadPipelineSteps, saveDocument, savePipelineSteps } from "@/lib/storage";
import { checkBackendHealth } from "@/services/api";

export default function ArtifactsPage() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [vectorsOk, setVectorsOk] = useState(false);
  const [modelOk, setModelOk] = useState(false);
  const [document, setDocument] = useState<UploadResponse | null>(() => loadDocument());
  const [completedSteps, setCompletedSteps] = useState<Set<PipelineStepId>>(() => loadPipelineSteps());

  useEffect(() => {
    checkBackendHealth().then((status) => {
      setBackendOk(status.status === "ok");
      setVectorsOk(status.zilliz_configured);
      setModelOk(status.openrouter_configured);
    }).catch(() => setBackendOk(false));
  }, []);

  const onUploaded = useCallback((nextDocument: UploadResponse) => {
    const steps = new Set<PipelineStepId>(["upload"]);
    setDocument(nextDocument);
    setCompletedSteps(steps);
    saveDocument(nextDocument);
    savePipelineSteps([...steps]);
  }, []);

  const onStepsUpdate = useCallback((steps: Set<PipelineStepId>) => {
    setCompletedSteps(steps);
    savePipelineSteps([...steps]);
  }, []);

  const pipelineReady = completedSteps.has("ready") || completedSteps.has("milvus");

  return (
    <main className="dark min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-[1280px] px-5 py-7 sm:px-8 lg:px-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"><ArrowLeft className="size-4" />Dashboard</Link>

        <section className="relative mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-[#0d0b08] p-7 lg:p-10">
          <PaperDither className="inset-y-0 right-0 w-[55%] opacity-80" dark={{ colorBack: "#0d0b0800", colorFront: "#e85d18" }} light={{ colorBack: "#0d0b0800", colorFront: "#e85d18" }} eager maxPixelCount={800 * 360} scale={0.7} shape="wave" size={2.2} speed={0.15} type="4x4" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#0d0b08_0%,rgba(13,11,8,.95)_52%,transparent)]" />
          <div className="relative z-10 max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#f6e879]">Context layer / Artifacts</p>
            <h1 className="mt-3 font-heading text-4xl tracking-[-.055em]">Upload, index, and retrieve.</h1>
            <p className="mt-4 text-sm leading-7 text-white/45">Add a PDF, process it into retrieval-ready context, then ask questions with matching source chunks attached.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Status label="API" ready={backendOk} />
              <Status label="Vector store" ready={vectorsOk} />
              <Status label="Answer model" ready={modelOk} />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-5">
            <div className="rounded-[20px] border border-white/10 bg-[#10100f] p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#e85d18]/10 text-[#ee7132]"><FileText className="size-4" /></span><div><h2 className="text-sm font-semibold">Upload artifact</h2><p className="mt-0.5 text-xs text-white/35">Documents, text, data, web, and code · maximum 20 MB</p></div></div>
              <PdfUpload onUploaded={onUploaded} disabled={backendOk === false} />
            </div>
            {document ? <div className="rounded-[20px] border border-white/10 bg-[#10100f] p-5"><DocumentInfo document={document} /></div> : null}
            <div className="rounded-[20px] border border-white/10 bg-[#10100f] p-5"><PipelineViewer completedSteps={completedSteps} /></div>
          </section>

          <section className="space-y-5">
            {document ? (
              <div className="rounded-[20px] border border-white/10 bg-[#10100f] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#f6e879]/10 text-[#f6e879]"><Database className="size-4" /></span><div><h2 className="text-sm font-semibold">Index for retrieval</h2><p className="mt-0.5 text-xs text-white/35">Extract → chunk → embed → vector store</p></div></div>
                <PipelineVisualizer document={document} completedSteps={completedSteps} onStepsUpdate={onStepsUpdate} autoRun />
              </div>
            ) : (
              <EmptyPanel icon={Database} title="Indexing waits for an artifact" copy="Upload a PDF and Kontext will start the extraction and retrieval pipeline here." />
            )}

            {document ? (
              <div className="rounded-[20px] border border-white/10 bg-[#10100f] p-5 sm:p-6"><ChatPanel document={document} pipelineReady={pipelineReady} openrouterConfigured={modelOk} /></div>
            ) : (
              <EmptyPanel icon={MessageSquare} title="Retrieval appears here" copy="After indexing, ask a question and inspect the source chunks used for the answer." />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Status({ label, ready }: { label: string; ready: boolean | null }) {
  return <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-white/50"><span className={`size-1.5 rounded-full ${ready === null ? "bg-white/25" : ready ? "bg-[#f6e879]" : "bg-orange-500"}`} />{label}: {ready === null ? "checking" : ready ? "ready" : "not configured"}</span>;
}

function EmptyPanel({ icon: Icon, title, copy }: { icon: typeof Database; title: string; copy: string }) {
  return <div className="grid min-h-44 place-items-center rounded-[20px] border border-dashed border-white/10 bg-[#10100f] p-8 text-center"><div><Icon className="mx-auto size-5 text-white/20" /><h2 className="mt-3 text-sm font-semibold text-white/65">{title}</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-white/30">{copy}</p></div></div>;
}
