"use client";

import type { Equipment } from "@/lib/types";
import { num, rsShort, years } from "@/lib/format";

type Category = "panel" | "inverter" | "battery";

const TIER_STYLE: Record<string, string> = {
  Budget: "bg-red-50 text-red-700",
  Value: "bg-emerald-50 text-emerald-700",
  Standard: "bg-sky-50 text-sky-700",
  Premium: "bg-violet-50 text-violet-700",
};

function Badges({ recommended, selected, tier }: { recommended: boolean; selected: boolean; tier: string }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TIER_STYLE[tier] ?? "bg-stone-100 text-stone-600"}`}>{tier}</span>
      {recommended && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Recommended</span>}
      {selected && !recommended && <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">In this quote</span>}
    </span>
  );
}

function UseButton({ selected, onClick }: { selected: boolean; onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <td className="no-print py-2 pl-2 text-right">
      {selected ? (
        <span className="text-[11px] text-stone-400">Using</span>
      ) : (
        <button onClick={onClick} className="rounded border border-stone-300 px-2 py-0.5 text-[11px] font-medium text-stone-700 hover:bg-stone-100">
          Use
        </button>
      )}
    </td>
  );
}

const th = "py-2 pr-3 text-left font-medium text-stone-500";
const td = "py-2 pr-3 align-top";

export default function EquipmentSection({
  equipment,
  kwp,
  onChoose,
}: {
  equipment: Equipment;
  kwp: number;
  onChoose?: (category: Category, id: string) => void;
}) {
  const panel = equipment.panels.find((p) => p.selected)!;
  const inverter = equipment.inverters.find((p) => p.selected)!;
  const battery = equipment.batteries.find((p) => p.selected)!;
  const rowCls = (selected: boolean) => `border-t border-stone-100 ${selected ? "bg-amber-50/60" : ""}`;

  return (
    <section className="report-card rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-800">Equipment & brand comparison</h3>
        <span className="text-[11px] text-stone-400">Pakistan market prices as of {equipment.asOf}</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Every brand below was run through the same {num(kwp, 2)} kW calculation using its own price, heat loss, ageing and battery life, then ranked by
        25-year value ({equipment.rankedBy} option). When brands are within 0.5% of each other, the one easiest to buy and service is recommended.
      </p>

      {/* Kit summary */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Panels", name: panel.brand, sub: panel.model, auto: equipment.auto.panel },
          { label: "Inverter", name: inverter.brand, sub: `${inverter.warranty} warranty`, auto: equipment.auto.inverter },
          { label: "Battery (if added)", name: battery.brand, sub: battery.model, auto: equipment.auto.battery },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-amber-800">{k.label}</div>
            <div className="mt-0.5 font-semibold text-stone-900">{k.name}</div>
            <div className="text-xs text-stone-500">{k.sub}</div>
            <div className="mt-1 text-[10px] text-stone-400">{k.auto ? "Recommended automatically" : "Chosen manually"}</div>
          </div>
        ))}
      </div>

      {/* Panels */}
      <h4 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-stone-700">Solar panels</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-xs">
          <thead>
            <tr>
              <th className={th}>Brand</th>
              <th className={th}>Rs / watt</th>
              <th className={th}>Panels cost</th>
              <th className={th}>On-grid system</th>
              <th className={th}>Units / year</th>
              <th className={th}>Payback ({equipment.rankedBy})</th>
              <th className={th}>25-yr value</th>
              {onChoose && <th className="no-print" />}
            </tr>
          </thead>
          <tbody>
            {equipment.panels.map((p) => (
              <tr key={p.id} className={rowCls(p.selected)}>
                <td className={td}>
                  <span className="font-medium text-stone-900">{p.brand}</span>
                  <Badges recommended={p.recommended} selected={p.selected} tier={p.tier} />
                  <div className="text-[11px] text-stone-500">
                    {p.model} · {p.warranty}
                  </div>
                  <div className="text-[11px] text-stone-400">{p.note}</div>
                </td>
                <td className={td}>
                  <div className="font-medium">{p.pricePerW}</div>
                  <div className="text-[10px] text-stone-400">
                    {p.priceRange[0]}–{p.priceRange[1]}
                  </div>
                  <div className="text-[10px] text-stone-400">{p.priceSource}</div>
                </td>
                <td className={td}>{rsShort(p.panelCost)}</td>
                <td className={td}>{rsShort(p.systemCost)}</td>
                <td className={td}>{num(p.annualGeneration)}</td>
                <td className={td}>{years(p.paybackYears)}</td>
                <td className={`${td} font-medium`}>{rsShort(p.npv)}</td>
                <UseButton selected={p.selected} onClick={onChoose && (() => onChoose("panel", p.id))} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inverters */}
      <h4 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-stone-700">Inverters (sized for {num(kwp, 1)} kW)</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-xs">
          <thead>
            <tr>
              <th className={th}>Brand</th>
              <th className={th}>On-grid</th>
              <th className={th}>Hybrid</th>
              <th className={th}>Warranty</th>
              <th className={th}>25-yr value</th>
              {onChoose && <th className="no-print" />}
            </tr>
          </thead>
          <tbody>
            {equipment.inverters.map((v) => (
              <tr key={v.id} className={rowCls(v.selected)}>
                <td className={td}>
                  <span className="font-medium text-stone-900">{v.brand}</span>
                  <Badges recommended={v.recommended} selected={v.selected} tier={v.tier} />
                  <div className="text-[11px] text-stone-400">{v.note}</div>
                </td>
                <td className={td}>{rsShort(v.onGridPrice)}</td>
                <td className={td}>
                  {rsShort(v.hybridPrice)}
                  <div className="text-[10px] text-stone-400">{v.priceSource}</div>
                </td>
                <td className={td}>{v.warranty}</td>
                <td className={`${td} font-medium`}>{rsShort(v.npv)}</td>
                <UseButton selected={v.selected} onClick={onChoose && (() => onChoose("inverter", v.id))} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Batteries */}
      <h4 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wide text-stone-700">Lithium batteries</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr>
              <th className={th}>Brand</th>
              <th className={th}>Size needed</th>
              <th className={th}>Cost</th>
              <th className={th}>Rs / kWh</th>
              <th className={th} title="Battery price divided by all the energy it will store over its life">
                Cost per stored unit
              </th>
              <th className={th}>Life</th>
              <th className={th}>25-yr value</th>
              {onChoose && <th className="no-print" />}
            </tr>
          </thead>
          <tbody>
            {equipment.batteries.map((b) => (
              <tr key={b.id} className={rowCls(b.selected)}>
                <td className={td}>
                  <span className="font-medium text-stone-900">{b.brand}</span>
                  <Badges recommended={b.recommended} selected={b.selected} tier={b.tier} />
                  <div className="text-[11px] text-stone-500">
                    {b.model} · {/warranty/i.test(b.warranty) ? b.warranty : `${b.warranty} warranty`}
                  </div>
                  <div className="text-[11px] text-stone-400">{b.note}</div>
                </td>
                <td className={td}>
                  {b.modules} × {num(b.kwh / b.modules, 2)} kWh
                </td>
                <td className={td}>{rsShort(b.cost)}</td>
                <td className={td}>
                  {num(b.pricePerKwh)}
                  <div className="text-[10px] text-stone-400">{b.priceSource}</div>
                </td>
                <td className={td}>Rs {num(b.costPerStoredUnit, 1)}</td>
                <td className={td}>
                  {b.lifeYears} yrs · {num(b.cycles)} cycles
                </td>
                <td className={`${td} font-medium`}>{rsShort(b.npv)}</td>
                <UseButton selected={b.selected} onClick={onChoose && (() => onChoose("battery", b.id))} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
        Panel and battery prices are checked daily against Pakistani dealer price lists and can be set by the admin; confirm with your supplier before purchase. Battery sizes
        shown are for the {equipment.rankedBy === "Full backup" ? "Full backup" : "Hybrid"} option. Specs are typical datasheet values for the most common models.
      </p>
    </section>
  );
}
