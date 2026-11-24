"use client";

import { useEffect, useMemo, useState } from "react";
import type { Results, ScenarioId } from "@/lib/types";
import { bill, num, pct, rs, rsShort, years } from "@/lib/format";
import { summaryFacts, templateSummary, type Lang } from "@/lib/summary";
import { CashflowChart, MonthlyEnergyChart, SCENARIO_COLORS } from "./Charts";
import RoofLayout from "./RoofLayout";
import EquipmentSection from "./EquipmentSection";

function Summary({ results }: { results: Results }) {
  const [lang, setLang] = useState<Lang>("en");
  const [state, setState] = useState<{ text: string; ai: boolean; loading: boolean }>({
    text: templateSummary(results, "en"),
    ai: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fetch("/api/summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ facts: summaryFacts(results), lang }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setState(d.text ? { text: d.text, ai: true, loading: false } : { text: templateSummary(results, lang), ai: false, loading: false });
      })
      .catch(() => !cancelled && setState({ text: templateSummary(results, lang), ai: false, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [results, lang]);

  return (
    <section className="report-card rounded-xl border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-800">
          Consultant summary
          <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-stone-500">
            {state.loading ? "writing…" : state.ai ? "AI-written from the figures below" : "auto-generated"}
          </span>
        </h3>
        <div className="no-print flex overflow-hidden rounded-md border border-stone-300 text-xs">
          {(["en", "ur"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 ${lang === l ? "bg-stone-900 text-white" : "bg-white text-stone-700 hover:bg-stone-50"}`}
            >
              {l === "en" ? "English" : "اردو"}
            </button>
          ))}
        </div>
      </div>
      <div
        dir={lang === "ur" ? "rtl" : "ltr"}
        className={`space-y-3 whitespace-pre-line text-stone-700 ${lang === "ur" ? "font-urdu text-lg leading-[2.2]" : "text-[15px] leading-relaxed"} ${state.loading ? "opacity-60" : ""}`}
      >
        {state.text}
      </div>
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-stone-900">{value}</div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

export default function ReportView({
  results,
  onChooseEquipment,
}: {
  results: Results;
  onChooseEquipment?: (category: "panel" | "inverter" | "battery", id: string) => void;
}) {
  const { system, scenarios, inputs, layout, monthlyIrradiance, solar } = results;
  const [selected, setSelected] = useState<ScenarioId>(results.bestScenario);
  const sel = scenarios.find((s) => s.id === selected)!;
  const best = scenarios.find((s) => s.id === results.bestScenario)!;
  const grid = scenarios[0];
  const brand = inputs.installer.color || "#d97706";
  const date = useMemo(() => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="report-card overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="h-1.5" style={{ background: brand }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest" style={{ color: brand }}>
              Solar feasibility report
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-stone-900">
              {inputs.customerName ? `${inputs.customerName} · ` : ""}
              {inputs.locationName}
            </h2>
            <p className="text-sm text-stone-500">
              {inputs.lat.toFixed(4)}°N, {inputs.lon.toFixed(4)}°E · {date}
            </p>
          </div>
          <div className="text-right">
            {inputs.installer.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={inputs.installer.logoUrl} alt={inputs.installer.name || "Installer logo"} className="ml-auto h-10 max-w-[160px] object-contain" />
            ) : null}
            <div className="mt-1 text-sm font-semibold text-stone-800">{inputs.installer.name || "Solar ROI Assessor"}</div>
            {inputs.installer.phone && <div className="text-xs text-stone-500">{inputs.installer.phone}</div>}
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Recommended system" value={`${num(system.kwp, 2)} kW`} sub={`${system.panels} × ${inputs.panelWatt} W panels, ${system.tiltDeg}° tilt`} />
        <Kpi label="Solar generation" value={`${num(system.annualGeneration)} units/yr`} sub={`${num(system.specificYield)} units per kW · ${pct(system.coverage)} of usage`} />
        <Kpi label={`Payback (${best.name})`} value={years(best.paybackYears)} sub={`On-grid: ${years(grid.paybackYears)}`} />
        <Kpi label="Avg monthly bill" value={bill(best.year1.billAfter / 12)} sub={`from ${rsShort(best.year1.billBefore / 12)} today`} />
        <Kpi label="25-year savings" value={rsShort(best.savings25)} sub={`Investment ${rsShort(best.capex)}`} />
        <Kpi label="CO₂ avoided" value={`${num(best.co2Tons25)} tonnes`} sub="over 25 years" />
      </section>

      <Summary results={results} />

      {/* Scenarios */}
      <section className="report-card rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-800">Compare 3 options</h3>
        <p className="mb-4 text-xs text-stone-500">
          Same {num(system.kwp, 2)} kW of panels. Under NEPRA&apos;s 2026 net billing, exported units earn Rs {inputs.buybackRate}, while grid units cost Rs {inputs.tariff},
          so storing your own solar power has real value.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {scenarios.map((s) => {
            const isBest = s.id === results.bestScenario;
            const active = s.id === selected;
            return (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`relative rounded-lg border p-4 text-left transition ${active ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200 hover:border-stone-400"}`}
              >
                {isBest && (
                  <span className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-white" style={{ background: brand }}>
                    Best value
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SCENARIO_COLORS[s.id] }} />
                  <span className="font-semibold text-stone-900">{s.name}</span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">{s.tagline}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {[
                    ["Investment", rsShort(s.capex)],
                    ["Battery", s.batteryKwh ? `${s.batteryKwh} kWh` : "—"],
                    ["Monthly bill", bill(s.year1.billAfter / 12)],
                    ["Year-1 savings", rsShort(s.year1.savings)],
                    ["Payback", years(s.paybackYears)],
                    ["25-yr value (NPV)", rsShort(s.npv)],
                    ["Return (IRR)", s.irr === null ? "—" : pct(s.irr)],
                    ["Usage met by solar", pct(s.year1.solarShare)],
                    ["Backup in load-shedding", s.batteryKwh ? `${num(s.backupHours, 1)} h @ ${inputs.essentialLoadKw} kW` : "None"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-stone-500">{k}</dt>
                      <dd className="font-medium text-stone-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            );
          })}
        </div>
      </section>

      <EquipmentSection equipment={results.equipment} kwp={system.kwp} onChoose={onChooseEquipment} />

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="report-card rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-800">Monthly solar vs usage</h3>
          <p className="mb-2 text-xs text-stone-500">From NASA satellite data for this exact location ({solar.period})</p>
          <MonthlyEnergyChart scenario={sel} />
        </div>
        <div className="report-card rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-800">25-year cumulative cash flow</h3>
          <p className="mb-2 text-xs text-stone-500">Where a line crosses zero is the payback point</p>
          <CashflowChart scenarios={scenarios} />
        </div>
      </section>

      {/* Roof + capex */}
      <section className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="report-card rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-800">Panel layout</h3>
          <RoofLayout layout={layout} panels={system.panels} />
          <p className="mt-2 text-xs text-stone-500">
            {system.limitedBy === "economics"
              ? "Size chosen for the best 25-year value. More panels would mostly export at the low buyback rate."
              : system.limitedBy === "sanctioned"
                ? "Size capped by the sanctioned load. Apply for a higher load to install more."
                : "Size limited by usable roof area."}
          </p>
        </div>
        <div className="report-card rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-800">Investment: {sel.name}</h3>
          <dl className="space-y-2 text-sm">
            {sel.capexBreakdown.map((c) => (
              <div key={c.label} className="flex justify-between gap-3">
                <dt className="text-stone-600">{c.label}</dt>
                <dd className="font-medium text-stone-900">{rs(c.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-stone-200 pt-2">
              <dt className="font-semibold text-stone-900">Total</dt>
              <dd className="font-semibold text-stone-900">{rs(sel.capex)}</dd>
            </div>
          </dl>
          <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-stone-700">Year-1 energy</h4>
          <dl className="space-y-1.5 text-sm">
            {[
              ["Used directly / from battery", `${num(sel.year1.selfUse)} units`],
              ["Exported to grid", `${num(sel.year1.exported)} units`],
              ["Still bought from grid", `${num(sel.year1.imported)} units`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-stone-600">{k}</dt>
                <dd className="font-medium text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Sun data */}
      <section className="report-card rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-800">Sunlight at this location (NASA POWER)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-stone-500">
                <th className="py-1 text-left font-medium">kWh/m²/day</th>
                {monthlyIrradiance.map((m) => (
                  <th key={m.month} className="py-1 text-right font-medium">
                    {m.month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-stone-800">
              <tr>
                <td className="py-1 text-stone-600">Flat ground</td>
                {monthlyIrradiance.map((m) => (
                  <td key={m.month} className="py-1 text-right">
                    {m.horizontal.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr className="font-semibold">
                <td className="py-1 text-stone-600">On panels ({system.tiltDeg}°)</td>
                {monthlyIrradiance.map((m) => (
                  <td key={m.month} className="py-1 text-right">
                    {m.tilted.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1 text-stone-600">Heat loss</td>
                {monthlyIrradiance.map((m) => (
                  <td key={m.month} className="py-1 text-right text-red-700">
                    −{m.tempLossPct.toFixed(0)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Assumptions */}
      <section className="report-card rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-800">Assumptions</h3>
        <dl className="grid gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
          {results.assumptions.map((a) => (
            <div key={a.label} className="flex justify-between gap-3 border-b border-stone-100 py-1">
              <dt className="text-stone-500">{a.label}</dt>
              <dd className="text-right font-medium text-stone-800">{a.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[11px] leading-relaxed text-stone-500">
          This is a feasibility estimate based on long-term satellite climate data ({solar.source}) and the inputs above. Actual output depends on
          site shading, equipment, installation quality and cleaning. Tariffs and NEPRA regulations may change. A site survey is recommended before purchase.
        </p>
      </section>
    </div>
  );
}
