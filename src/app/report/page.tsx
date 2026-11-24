"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ReportView from "@/components/ReportView";
import { DEFAULT_INPUTS } from "@/lib/calc";
import { decodeInputs } from "@/lib/share";
import { useAnalysis, whatsappLink } from "@/lib/useAnalysis";

function Report() {
  const params = useSearchParams();
  const d = params.get("d");
  const { results, loading, error, run } = useAnalysis();

  useEffect(() => {
    const inp = d ? decodeInputs(d) : null;
    if (inp) run({ ...DEFAULT_INPUTS, ...inp });
  }, [d, run]);

  if (!d) return <Message text="This report link is incomplete." />;
  if (error) return <Message text={error} />;
  if (loading || !results) return <Message text="Loading NASA satellite data and preparing the report…" />;

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <button onClick={() => window.print()} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800">
          Print / Save as PDF
        </button>
        <a href={whatsappLink(results)} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Share on WhatsApp
        </a>
        <a href={`/?d=${d}`} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50">
          Edit inputs
        </a>
      </div>
      <ReportView results={results} />
      <p className="mt-6 text-center text-[11px] text-stone-400">Generated with Solar ROI Assessor · NASA POWER data</p>
    </div>
  );
}

function Message({ text }: { text: string }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-sm text-stone-600">{text}</div>;
}

export default function Page() {
  return (
    <Suspense>
      <Report />
    </Suspense>
  );
}
