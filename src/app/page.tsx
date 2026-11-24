"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import InputForm from "@/components/InputForm";
import ReportView from "@/components/ReportView";
import { DEFAULT_INPUTS } from "@/lib/calc";
import { decodeInputs, encodeInputs } from "@/lib/share";
import type { Inputs } from "@/lib/types";
import { useAnalysis, useCatalogue, whatsappLink } from "@/lib/useAnalysis";

const BRAND_KEY = "solar-roi-installer";

function Home() {
  const params = useSearchParams();
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const { results, loading, error, run } = useAnalysis();
  const catalogue = useCatalogue();
  const fromLink = Boolean(params.get("d"));

  // Admin-set defaults (export rate, installation cost) for new quotes
  useEffect(() => {
    if (fromLink) return;
    const { buybackRate, bosCostPerKw } = catalogue.settings;
    setInputs((i) => ({
      ...i,
      ...(buybackRate !== null ? { buybackRate } : {}),
      ...(bosCostPerKw !== null ? { bosCostPerKw } : {}),
    }));
  }, [catalogue, fromLink]);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load saved branding, or inputs from an "Edit" link
  useEffect(() => {
    const fromLink = params.get("d") ? decodeInputs(params.get("d")!) : null;
    if (fromLink) {
      setInputs({ ...DEFAULT_INPUTS, ...fromLink });
      return;
    }
    try {
      const saved = localStorage.getItem(BRAND_KEY);
      if (saved) setInputs((i) => ({ ...i, installer: { ...i.installer, ...JSON.parse(saved) } }));
    } catch {}
  }, [params]);

  useEffect(() => {
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(inputs.installer));
    } catch {}
  }, [inputs.installer]);

  async function submit() {
    await run(inputs);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-lg text-white">☀</div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-stone-900">Solar ROI Assessor</h1>
              <p className="text-xs text-stone-500">NASA satellite data · NEPRA 2026 net billing · Pakistan</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-600 sm:block">For solar installers & businesses</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[400px_1fr]">
        <aside>
          <InputForm catalogue={catalogue} value={inputs} onChange={setInputs} onSubmit={submit} loading={loading} />
          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </aside>

        <section ref={resultsRef} className="min-w-0 scroll-mt-4">
          {results ? (
            <>
              <div className="no-print mb-4 flex flex-wrap gap-2">
                <a
                  href={`/report?d=${encodeInputs(results.inputs)}`}
                  target="_blank"
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                >
                  Open report / Save PDF
                </a>
                <a
                  href={whatsappLink(results)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Share on WhatsApp
                </a>
              </div>
              <ReportView
                results={results}
                onChooseEquipment={(cat, id) => {
                  const key = cat === "panel" ? "panelBrand" : cat === "inverter" ? "inverterBrand" : "batteryBrand";
                  const next = { ...inputs, [key]: id };
                  setInputs(next);
                  run(next);
                }}
              />
            </>
          ) : (
            <EmptyState />
          )}
        </section>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
      <div className="text-5xl">☀️</div>
      <h2 className="mt-4 text-xl font-semibold text-stone-900">Turn satellite data into a solar sales report</h2>
      <p className="mt-2 max-w-md text-sm text-stone-500">
        Upload a bill or enter usage, pick the location, and get the right system size, roof layout, three options with and without battery,
        payback under NEPRA&apos;s 2026 net billing rules, and a branded report to share on WhatsApp.
      </p>
      <ul className="mt-6 grid gap-2 text-left text-sm text-stone-600 sm:grid-cols-2">
        <li>✓ 20+ years of NASA sunlight & temperature data</li>
        <li>✓ Heat & dust losses for Pakistan&apos;s climate</li>
        <li>✓ On-grid vs hybrid vs full backup</li>
        <li>✓ English & Urdu consultant summary</li>
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
