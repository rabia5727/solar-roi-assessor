"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Inputs, Results, SolarData } from "./types";
import { calculate } from "./calc";
import { DEFAULT_CATALOGUE, type Catalogue } from "./equipment";
import { encodeInputs } from "./share";
import { bill, rsShort, years } from "./format";

function validate(inp: Inputs): string | null {
  const checks: [boolean, string][] = [
    [inp.monthlyUnits > 0 || (inp.monthlyHistory?.some((v) => v > 0) ?? false), "Enter monthly units"],
    [inp.tariff > 0, "Enter the rate per unit"],
    [inp.roofLengthM > 2 && inp.roofWidthM > 2, "Enter roof size (at least 7 ft each side)"],
    [inp.bosCostPerKw >= 0, "Enter installation cost"],
    [inp.panelWatt >= 100, "Panel size looks wrong"],
    [Object.values(inp).every((v) => typeof v !== "number" || Number.isFinite(v)), "Some fields are empty"],
  ];
  return checks.find(([ok]) => !ok)?.[1] ?? null;
}

let cataloguePromise: Promise<Catalogue> | null = null;

/** Live prices from /api/prices (admin overrides → daily price check → defaults). Falls back to built-in prices. */
export function loadCatalogue(): Promise<Catalogue> {
  cataloguePromise ??= fetch("/api/prices")
    .then((r) => (r.ok ? r.json() : DEFAULT_CATALOGUE))
    .catch(() => DEFAULT_CATALOGUE);
  return cataloguePromise;
}

export function useCatalogue() {
  const [cat, setCat] = useState<Catalogue>(DEFAULT_CATALOGUE);
  useEffect(() => {
    loadCatalogue().then(setCat);
  }, []);
  return cat;
}

export function useAnalysis() {
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, SolarData>());

  const run = useCallback(async (inp: Inputs) => {
    const invalid = validate(inp);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const key = `${inp.lat.toFixed(1)},${inp.lon.toFixed(1)}`;
      let solar = cache.current.get(key);
      if (!solar) {
        const res = await fetch(`/api/solar?lat=${inp.lat}&lon=${inp.lon}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load solar data");
        solar = data as SolarData;
        cache.current.set(key, solar);
      }
      const catalogue = await loadCatalogue();
      setResults(calculate(inp, { ...solar, lat: inp.lat, lon: inp.lon }, catalogue));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, run };
}

export function reportUrl(inp: Inputs) {
  return `${window.location.origin}/report?d=${encodeInputs(inp)}`;
}

function kitLine(r: Results) {
  const e = r.equipment;
  const name = <T extends { id: string; brand: string }>(list: T[], id: string) => list.find((x) => x.id === id)?.brand ?? "";
  return `${name(e.panels, e.selected.panel)} panels, ${name(e.inverters, e.selected.inverter)} inverter, ${name(e.batteries, e.selected.battery)} battery`;
}

export function whatsappLink(r: Results) {
  const best = r.scenarios.find((s) => s.id === r.bestScenario)!;
  const who = r.inputs.customerName ? ` for ${r.inputs.customerName}` : "";
  const from = r.inputs.installer.name ? `\n— ${r.inputs.installer.name}${r.inputs.installer.phone ? `, ${r.inputs.installer.phone}` : ""}` : "";
  const text =
    `Solar feasibility report${who} (${r.inputs.locationName})\n` +
    `• ${r.system.kwp.toFixed(2)} kW system, ${r.system.panels} panels\n` +
    `• Recommended: ${best.name}, ${rsShort(best.capex)}\n` +
    `• Equipment: ${kitLine(r)}\n` +
    `• Bill: ${rsShort(best.year1.billBefore / 12)} → ${bill(best.year1.billAfter / 12)} per month\n` +
    `• Payback: ${years(best.paybackYears)}\n\n` +
    `Full report: ${reportUrl(r.inputs)}${from}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
