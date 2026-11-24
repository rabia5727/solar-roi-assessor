"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Inputs } from "@/lib/types";
import { CITIES } from "@/lib/cities";
import type { Catalogue } from "@/lib/equipment";
import { Card, Field, NumberInput, SectionTitle, Select, TextInput } from "./ui";

const MapPicker = dynamic(() => import("./MapPicker"), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-lg bg-stone-100" />,
});

const FT = 3.28084;

type BillResult = {
  disco: string | null;
  customerName: string | null;
  billingMonth: string | null;
  unitsConsumed: number | null;
  totalAmount: number | null;
  effectiveTariff: number | null;
  sanctionedLoadKw: number | null;
  monthlyHistory: number[] | null;
};

export default function InputForm({
  value,
  onChange,
  onSubmit,
  loading,
  catalogue,
}: {
  catalogue: Catalogue;
  value: Inputs;
  onChange: (v: Inputs) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => onChange({ ...value, [k]: v });
  const setInstaller = (k: keyof Inputs["installer"], v: string) => onChange({ ...value, installer: { ...value.installer, [k]: v } });

  const fileRef = useRef<HTMLInputElement>(null);
  const [billState, setBillState] = useState<{ status: "idle" | "reading" | "done" | "error"; msg?: string }>({ status: "idle" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBrand, setShowBrand] = useState(false);

  async function readBill(file: File) {
    setBillState({ status: "reading" });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-bill", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read bill");
      const b = data as BillResult;
      const known = b.monthlyHistory?.filter((v) => v > 0) ?? [];
      const avg = known.length ? Math.round(known.reduce((a, c) => a + c, 0) / known.length) : b.unitsConsumed;
      onChange({
        ...value,
        customerName: b.customerName || value.customerName,
        monthlyUnits: avg || value.monthlyUnits,
        monthlyHistory: b.monthlyHistory,
        tariff: b.effectiveTariff || value.tariff,
        sanctionedLoadKw: b.sanctionedLoadKw || value.sanctionedLoadKw,
      });
      const parts = [
        b.disco,
        b.billingMonth,
        b.unitsConsumed ? `${b.unitsConsumed} units` : null,
        b.effectiveTariff ? `Rs ${b.effectiveTariff}/unit` : null,
        known.length ? `${known.length} months of history` : null,
      ].filter(Boolean);
      setBillState({ status: "done", msg: `Read: ${parts.join(" · ")}. Check the fields below.` });
    } catch (e) {
      setBillState({ status: "error", msg: (e as Error).message });
    }
  }

  const usingHistory = (value.monthlyHistory?.filter((v) => v > 0).length ?? 0) >= 6;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {/* Bill upload */}
      <Card className="border-amber-200 bg-amber-50/60">
        <SectionTitle step="1" title="Snap the electricity bill" sub="AI reads units, rate, sanctioned load and 12-month history" />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && readBill(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={billState.status === "reading"}
          className="w-full rounded-lg border-2 border-dashed border-amber-400 bg-white px-4 py-4 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
        >
          {billState.status === "reading" ? "Reading bill…" : "Upload bill photo or PDF"}
        </button>
        {billState.msg && (
          <p className={`mt-2 text-xs ${billState.status === "error" ? "text-red-600" : "text-emerald-700"}`}>{billState.msg}</p>
        )}
        <p className="mt-2 text-xs text-stone-500">Or fill in the details manually below.</p>
      </Card>

      {/* Location */}
      <Card>
        <SectionTitle step="2" title="Location" sub="Pick a city, then click the exact spot on the map" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer name">
            <TextInput value={value.customerName} onChange={(v) => set("customerName", v)} placeholder="Optional" />
          </Field>
          <Field label="City">
            <Select
              value={CITIES.some((c) => c.name === value.locationName) ? value.locationName : "custom"}
              onChange={(name) => {
                const c = CITIES.find((x) => x.name === name);
                if (c) onChange({ ...value, locationName: c.name, lat: c.lat, lon: c.lon });
              }}
              options={[
                ...CITIES.map((c) => ({ value: c.name, label: c.name })),
                ...(CITIES.some((c) => c.name === value.locationName) ? [] : [{ value: "custom", label: value.locationName }]),
              ]}
            />
          </Field>
        </div>
        <div className="mt-3">
          <MapPicker
            lat={value.lat}
            lon={value.lon}
            onPick={(lat, lon) => {
              const near = CITIES.reduce((a, c) => (Math.hypot(c.lat - lat, c.lon - lon) < Math.hypot(a.lat - lat, a.lon - lon) ? c : a));
              const close = Math.hypot(near.lat - lat, near.lon - lon) < 0.3;
              onChange({ ...value, lat, lon, locationName: close ? `${near.name} (pinned)` : `${lat.toFixed(3)}, ${lon.toFixed(3)}` });
            }}
          />
          <p className="mt-1 text-xs text-stone-500">
            {value.lat.toFixed(4)}°N, {value.lon.toFixed(4)}°E
          </p>
        </div>
      </Card>

      {/* Usage */}
      <Card>
        <SectionTitle step="3" title="Electricity use" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Average monthly units" hint={usingHistory ? "Using the bill's 12-month history" : undefined}>
            <NumberInput value={value.monthlyUnits} onChange={(v) => onChange({ ...value, monthlyUnits: v, monthlyHistory: null })} suffix="kWh" />
          </Field>
          <Field label="Rate you pay" hint="Total bill ÷ units">
            <NumberInput value={value.tariff} onChange={(v) => set("tariff", v)} step={0.5} suffix="Rs/unit" />
          </Field>
          <Field label="Sanctioned load">
            <NumberInput value={value.sanctionedLoadKw} onChange={(v) => set("sanctionedLoadKw", v)} step={0.5} suffix="kW" />
          </Field>
          <Field label="Essential load (backup)" hint="Fans, lights, fridge, router">
            <NumberInput value={value.essentialLoadKw} onChange={(v) => set("essentialLoadKw", v)} step={0.25} suffix="kW" />
          </Field>
          <div className="col-span-2">
            <Field label="When is electricity mostly used?" hint="Solar you use yourself is worth ~7× more than solar you export">
              <Select
                value={value.daytimeShare}
                onChange={(v) => set("daytimeShare", v)}
                options={[
                  { value: 0.3, label: "Mostly evening & night (working family) — 30% daytime" },
                  { value: 0.45, label: "Mixed household — 45% daytime" },
                  { value: 0.6, label: "Someone home all day / home office — 60% daytime" },
                  { value: 0.75, label: "Shop, office or school — 75% daytime" },
                  { value: 0.85, label: "Factory running day shifts — 85% daytime" },
                ]}
              />
            </Field>
          </div>
          {!usingHistory && (
            <label className="col-span-2 flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={value.seasonal} onChange={(e) => set("seasonal", e.target.checked)} className="accent-amber-600" />
              Higher usage in summer (AC season)
            </label>
          )}
        </div>
      </Card>

      {/* Roof */}
      <Card>
        <SectionTitle step="4" title="Roof" sub="Usable flat roof area, excluding water tanks & stairs" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Length (east–west)">
            <NumberInput value={Math.round(value.roofLengthM * FT)} onChange={(v) => set("roofLengthM", v / FT)} suffix="ft" />
          </Field>
          <Field label="Width (north–south)">
            <NumberInput value={Math.round(value.roofWidthM * FT)} onChange={(v) => set("roofWidthM", v / FT)} suffix="ft" />
          </Field>
        </div>
      </Card>

      {/* Advanced */}
      <Card>
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowAdvanced((s) => !s)}>
          <SectionTitle title="Brands, prices & assumptions" sub="Choose panel, inverter & battery brands, or let the app recommend" />
          <span className="text-stone-400">{showAdvanced ? "−" : "+"}</span>
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-1 gap-3 rounded-lg bg-stone-50 p-3">
              <p className="text-xs text-stone-500">Equipment brands, prices as of {catalogue.asOf}. Leave on Recommended to let the app pick the best value.</p>
              <Field label="Panel brand">
                <Select
                  value={value.panelBrand}
                  onChange={(v) => onChange({ ...value, panelBrand: v, panelPriceOverride: null })}
                  options={[{ value: "auto", label: "Recommended (best value)" }, ...catalogue.panels.map((p) => ({ value: p.id, label: `${p.brand} · ${p.model} · ~Rs ${p.price}/W` }))]}
                />
              </Field>
              {value.panelBrand !== "auto" && (
                <Field label="Your panel price (optional)" hint="Leave empty to use the typical market price">
                  <NumberInput value={value.panelPriceOverride ?? NaN} onChange={(v) => set("panelPriceOverride", Number.isFinite(v) && v > 0 ? v : null)} step={0.5} suffix="Rs/W" />
                </Field>
              )}
              <Field label="Inverter brand">
                <Select
                  value={value.inverterBrand}
                  onChange={(v) => set("inverterBrand", v)}
                  options={[{ value: "auto", label: "Recommended (best value)" }, ...catalogue.inverters.map((p) => ({ value: p.id, label: `${p.brand} (${p.tier})` }))]}
                />
              </Field>
              <Field label="Battery brand">
                <Select
                  value={value.batteryBrand}
                  onChange={(v) => onChange({ ...value, batteryBrand: v, batteryPriceOverride: null })}
                  options={[{ value: "auto", label: "Recommended (best value)" }, ...catalogue.batteries.map((p) => ({ value: p.id, label: `${p.brand} · ${p.model}` }))]}
                />
              </Field>
              {value.batteryBrand !== "auto" && (
                <Field label="Your battery price (optional)" hint="Leave empty to use the typical market price">
                  <NumberInput value={value.batteryPriceOverride ?? NaN} onChange={(v) => set("batteryPriceOverride", Number.isFinite(v) && v > 0 ? v : null)} step={1000} suffix="Rs/kWh" />
                </Field>
              )}
            </div>
            <Field label="Structure, wiring & installation" hint="Elevated structure, cables, breakers, labour, approvals">
              <NumberInput value={value.bosCostPerKw} onChange={(v) => set("bosCostPerKw", v)} step={1000} suffix="Rs/kW" />
            </Field>
            <Field label="Export (buyback) rate" hint="NEPRA net billing 2026 for new users">
              <NumberInput value={value.buybackRate} onChange={(v) => set("buybackRate", v)} step={0.01} suffix="Rs/unit" />
            </Field>
            <Field label="Panel size">
              <NumberInput value={value.panelWatt} onChange={(v) => set("panelWatt", v)} step={5} suffix="W" />
            </Field>
            <Field label="Electricity price rise">
              <NumberInput value={Math.round(value.tariffEscalation * 1000) / 10} onChange={(v) => set("tariffEscalation", v / 100)} step={0.5} suffix="%/yr" />
            </Field>
            <Field label="Discount rate (NPV)">
              <NumberInput value={Math.round(value.discountRate * 1000) / 10} onChange={(v) => set("discountRate", v / 100)} step={0.5} suffix="%/yr" />
            </Field>
            <Field label="Panel tilt" hint="Leave empty for automatic">
              <NumberInput value={value.tiltDeg ?? NaN} onChange={(v) => set("tiltDeg", Number.isFinite(v) ? v : null)} suffix="°" />
            </Field>
          </div>
        )}
      </Card>

      {/* Branding */}
      <Card>
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowBrand((s) => !s)}>
          <SectionTitle title="Your company branding" sub="Appears on the report you send customers" />
          <span className="text-stone-400">{showBrand ? "−" : "+"}</span>
        </button>
        {showBrand && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company name">
              <TextInput value={value.installer.name} onChange={(v) => setInstaller("name", v)} placeholder="e.g. SunPeak Solar" />
            </Field>
            <Field label="Phone / WhatsApp">
              <TextInput value={value.installer.phone} onChange={(v) => setInstaller("phone", v)} placeholder="0300-1234567" />
            </Field>
            <Field label="Logo URL" hint="Link to a PNG/SVG logo">
              <TextInput value={value.installer.logoUrl} onChange={(v) => setInstaller("logoUrl", v)} placeholder="https://…" />
            </Field>
            <Field label="Brand colour">
              <input
                type="color"
                value={value.installer.color}
                onChange={(e) => setInstaller("color", e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border border-stone-300 bg-white"
              />
            </Field>
          </div>
        )}
      </Card>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-stone-800 disabled:opacity-60"
      >
        {loading ? "Fetching NASA satellite data…" : "Calculate solar ROI"}
      </button>
    </form>
  );
}
