"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BATTERIES, INVERTERS, PANELS, priceKey, type Catalogue, type PriceInfo } from "@/lib/equipment";
import type { PriceStore } from "@/lib/priceStore";

type AdminData = {
  store: PriceStore;
  resolved: Catalogue;
  storage: string;
  sources: { name: string; url: string; kind: string }[];
};

type Row = { key: string; label: string; sub?: string; unit: string; def: number | null; step: number };

const PW_KEY = "solar-roi-admin-pw";

// Prices the daily check looks for (others are admin-only)
const AUTO_KEYS = new Set([
  ...PANELS.map((p) => priceKey.panel(p.id)),
  ...["pylontech", "dyness", "inverex-li", "goodwe-lynx"].map(priceKey.battery),
]);

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 2 }));

const GROUPS: { title: string; note: string; rows: Row[] }[] = [
  {
    title: "Solar panels",
    note: "Price per watt. Checked automatically every day.",
    rows: PANELS.map((p) => ({ key: priceKey.panel(p.id), label: p.brand, sub: p.model, unit: "Rs/W", def: p.price, step: 0.5 })),
  },
  {
    title: "Lithium batteries",
    note: "Price per module. Checked automatically every day (5 kWh-class modules only).",
    rows: BATTERIES.map((b) => ({ key: priceKey.battery(b.id), label: b.brand, sub: `${b.model} · ${b.moduleKwh} kWh module`, unit: "Rs", def: b.price, step: 1000 })),
  },
  {
    title: "Inverters",
    note: "Price of a ~10 kW unit (smaller/larger systems are scaled). Set manually: prices vary too much by model to check automatically.",
    rows: INVERTERS.flatMap((v) => [
      { key: priceKey.inverterOnGrid(v.id), label: v.brand, sub: "On-grid, 10 kW", unit: "Rs", def: v.onGrid10, step: 5000 },
      { key: priceKey.inverterHybrid(v.id), label: v.brand, sub: "Hybrid, 10 kW", unit: "Rs", def: v.hybrid10, step: 5000 },
    ]),
  },
  {
    title: "Defaults for new quotes",
    note: "Pre-filled in the calculator form. Users can still change them per quote.",
    rows: [
      { key: priceKey.buyback, label: "NEPRA export (buyback) rate", sub: "Net billing, new users", unit: "Rs/unit", def: 8.13, step: 0.01 },
      { key: priceKey.bos, label: "Structure, wiring & installation", sub: "Per kW installed", unit: "Rs/kW", def: 40000, step: 1000 },
    ],
  },
];

function SourceBadge({ info, isSetting, hasManual }: { info?: PriceInfo; isSetting: boolean; hasManual: boolean }) {
  const source = isSetting ? (hasManual ? "manual" : "default") : (info?.source ?? "default");
  const style = { manual: "bg-violet-100 text-violet-800", auto: "bg-emerald-100 text-emerald-800", default: "bg-stone-100 text-stone-600" }[source];
  const label = { manual: "Admin", auto: "Live", default: "Default" }[source];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>{label}</span>;
}

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; msg?: string }>({ kind: "idle" });
  const [showLog, setShowLog] = useState(false);

  const call = useCallback(async (method: string, url: string, password: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { "x-admin-password": password, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    return json;
  }, []);

  const load = useCallback(
    async (password: string) => {
      setStatus({ kind: "busy", msg: "Loading…" });
      try {
        const d = (await call("GET", "/api/admin/prices", password)) as AdminData;
        setData(d);
        setEdits({});
        sessionStorage.setItem(PW_KEY, password);
        setStatus({ kind: "idle" });
      } catch (e) {
        setData(null);
        setStatus({ kind: "error", msg: (e as Error).message });
      }
    },
    [call],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      setPw(saved);
      load(saved);
    }
  }, [load]);

  const dirty = useMemo(() => Object.keys(edits).length > 0, [edits]);

  async function save() {
    if (!data) return;
    const manual: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(edits)) manual[k] = v.trim() === "" ? null : Number(v);
    if (Object.values(manual).some((v) => v !== null && (!Number.isFinite(v) || v <= 0))) {
      setStatus({ kind: "error", msg: "Prices must be positive numbers (leave empty to clear)." });
      return;
    }
    setStatus({ kind: "busy", msg: "Saving…" });
    try {
      const d = await call("PUT", "/api/admin/prices", pw, { manual });
      setData({ ...data, ...d });
      setEdits({});
      setStatus({ kind: "ok", msg: "Saved. New quotes use these prices right away." });
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
    }
  }

  async function runCheck() {
    if (!data) return;
    setStatus({ kind: "busy", msg: "Checking price websites… (up to a minute)" });
    try {
      const d = await call("POST", "/api/prices/refresh", pw);
      setData({ ...data, ...d });
      setShowLog(true);
      setStatus({ kind: d.store.lastRun?.ok ? "ok" : "error", msg: d.store.lastRun?.ok ? "Price check finished." : "Price check could not read any site. See log." });
    } catch (e) {
      setStatus({ kind: "error", msg: (e as Error).message });
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <form
          className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pw) return setStatus({ kind: "error", msg: "Enter the admin password" });
            load(pw);
          }}
        >
          <h1 className="text-lg font-semibold text-stone-900">Price admin</h1>
          <p className="mt-1 text-sm text-stone-500">Solar ROI Assessor</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Admin password"
            className="mt-4 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          {status.msg && <p className={`mt-2 text-xs ${status.kind === "error" ? "text-red-600" : "text-stone-500"}`}>{status.msg}</p>}
          <button className="mt-4 w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800">Open</button>
        </form>
      </div>
    );
  }

  const { store, resolved } = data;
  const effective = (key: string): number | null => {
    if (key === priceKey.buyback) return resolved.settings.buybackRate;
    if (key === priceKey.bos) return resolved.settings.bosCostPerKw;
    const [type, id, field] = key.split(":");
    if (type === "panel") return resolved.panels.find((p) => p.id === id)?.price ?? null;
    if (type === "battery") return resolved.batteries.find((p) => p.id === id)?.price ?? null;
    const inv = resolved.inverters.find((p) => p.id === id);
    return inv ? (field === "onGrid10" ? inv.onGrid10 : inv.hybrid10) : null;
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Price admin</h1>
          <p className="text-sm text-stone-500">
            Priority: <b className="text-violet-700">Admin</b> price → <b className="text-emerald-700">Live</b> price from the daily check (if under 21 days old) →{" "}
            <b className="text-stone-600">Default</b>. Saved in {data.storage}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
            Open calculator
          </Link>
          <button
            onClick={() => {
              sessionStorage.removeItem(PW_KEY);
              setData(null);
              setPw("");
            }}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Price check status */}
      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-800">Daily price check</h2>
            <p className="text-sm text-stone-600">
              Last run: {fmtDate(store.lastRun?.at)}{" "}
              {store.lastRun && (
                <span className={store.lastRun.ok ? "text-emerald-700" : "text-red-600"}>{store.lastRun.ok ? "· worked" : "· failed"}</span>
              )}
            </p>
            <p className="text-xs text-stone-500">Sources: {data.sources.map((s) => s.name).join(", ")}</p>
          </div>
          <div className="flex gap-2">
            {store.lastRun && (
              <button onClick={() => setShowLog((s) => !s)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                {showLog ? "Hide log" : "Show log"}
              </button>
            )}
            <button
              onClick={runCheck}
              disabled={status.kind === "busy"}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Run price check now
            </button>
          </div>
        </div>
        {showLog && store.lastRun && (
          <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-stone-50 p-3 text-xs text-stone-700">{store.lastRun.log.join("\n")}</pre>
        )}
      </section>

      {GROUPS.map((g) => (
        <section key={g.title} className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-800">{g.title}</h2>
          <p className="mb-3 text-xs text-stone-500">{g.note}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-500">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Default</th>
                  <th className="py-2 pr-3 font-medium">Live (daily check)</th>
                  <th className="py-2 pr-3 font-medium">Admin price</th>
                  <th className="py-2 pr-3 font-medium">In use</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const auto = store.auto[r.key];
                  const manual = store.manual[r.key];
                  const isSetting = r.key.startsWith("setting:");
                  const edit = edits[r.key];
                  const value = edit ?? (manual ? String(manual.value) : "");
                  const inUse = effective(r.key) ?? r.def;
                  return (
                    <tr key={r.key} className="border-t border-stone-100 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-stone-900">{r.label}</div>
                        {r.sub && <div className="text-xs text-stone-500">{r.sub}</div>}
                      </td>
                      <td className="py-2 pr-3 text-stone-600">{fmt(r.def)}</td>
                      <td className="py-2 pr-3">
                        {auto ? (
                          <>
                            <div className="text-stone-900">{fmt(auto.value)}</div>
                            <div className="text-[11px] text-stone-500">
                              {fmtDate(auto.updatedAt)} · {auto.source}
                            </div>
                          </>
                        ) : (
                          <span className="text-stone-400">{AUTO_KEYS.has(r.key) ? "not found yet" : "manual only"}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={r.step}
                            min={0}
                            value={value}
                            placeholder="—"
                            onChange={(e) => setEdits((x) => ({ ...x, [r.key]: e.target.value }))}
                            className={`w-32 rounded-md border px-2 py-1 text-sm outline-none focus:border-amber-500 ${edit !== undefined ? "border-amber-400 bg-amber-50" : "border-stone-300"}`}
                          />
                          <span className="text-xs text-stone-500">{r.unit}</span>
                          {(manual || edit) && (
                            <button onClick={() => setEdits((x) => ({ ...x, [r.key]: "" }))} className="ml-1 text-xs text-stone-500 underline hover:text-stone-800">
                              clear
                            </button>
                          )}
                        </div>
                        {manual && <div className="mt-0.5 text-[11px] text-stone-500">set {fmtDate(manual.updatedAt)}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-stone-900">{fmt(inUse)}</span>
                          <SourceBadge info={resolved.priceInfo[r.key]} isSetting={isSetting} hasManual={!!manual} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-4 mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className={`text-sm ${status.kind === "error" ? "text-red-600" : status.kind === "ok" ? "text-emerald-700" : "text-stone-500"}`}>
          {status.msg ?? (dirty ? `${Object.keys(edits).length} unsaved change(s)` : "Leave a price empty to use the live or default price.")}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <button onClick={() => setEdits({})} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
              Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty || status.kind === "busy"}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
