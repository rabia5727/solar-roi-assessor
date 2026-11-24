// Server-only daily price check.
//
// Reads public price pages, finds per-brand prices, rejects anything that looks wrong,
// and saves the rest as "auto" prices. Admin overrides always win over these.
//
// To add a source: add it to SOURCES. Parsers work on plain text rows, so they survive
// most layout changes. Inverter prices are not scraped — they depend too much on the
// exact model — so they are managed in /admin.

import { BATTERIES, PANELS, priceKey } from "./equipment";
import { readStore, resolvePrice, writeStore, type PriceRecord, type PriceStore } from "./priceStore";

type Kind = "panel" | "battery";

export const SOURCES: { name: string; url: string; kind: Kind }[] = [
  { name: "solarrate.pk", url: "https://solarrate.pk/", kind: "panel" },
  { name: "jbmssolar.pk", url: "https://jbmssolar.pk/", kind: "panel" },
  { name: "alphasolar.com.pk", url: "https://alphasolar.com.pk/lithium-battery-price-in-pakistan/", kind: "battery" },
];

// Brand name patterns, matched against each text row
const PANEL_ALIASES: Record<string, RegExp> = {
  ja: /\bJA\s*Solar\b/i,
  astronergy: /\bAstro\s*-?\s*(?:Energy|nergy|N)\b/i,
  jinko: /\bJinko\b/i,
  trina: /\bTrina\b/i,
  canadian: /\bCanadian\b/i,
  longi: /\bLongi\b/i,
};
const BATTERY_ALIASES: Record<string, RegExp> = {
  pylontech: /\bPylon\s*tech\b/i,
  dyness: /\bDyness\b/i,
  "inverex-li": /\bInverex\b/i,
  "goodwe-lynx": /\bLynx\b/i,
};

// Sanity limits
const PANEL_RS_PER_W: [number, number] = [20, 80];
const BATTERY_RS_PER_KWH: [number, number] = [25_000, 110_000];
const MAX_CHANGE = 0.35; // reject a new price more than 35% away from the current one

export function htmlToRows(html: string): string[] {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<(br|\/tr|\/li|\/p|\/div|\/h[1-6]|\/dt|\/dd)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#\d+;|&[a-z]+;/gi, " ")
    .split("\n")
    .map((r) => r.replace(/[ \t]+/g, " ").trim())
    .filter((r) => r.length > 3);
}

/** Panel price per watt from one row, or null */
export function parsePanelRow(row: string): number | null {
  if (/kwh|inverter|battery/i.test(row)) return null;
  // "Canadian Solar Rs 41.9/W" or "Rs. 39.5 / watt"
  const m = row.match(/Rs\.?\s*([\d]{2}(?:\.\d+)?)\s*\/\s*(?:W|watt)\b/i);
  if (m) return Number(m[1]);
  // Table row: "Jinko N-Type ... 590W | 45 | 29,338 |"
  if (row.includes("|") && /\d{3}\s*W\b/i.test(row)) {
    const cells = row.split("|").map((c) => c.trim());
    for (const c of cells.slice(1)) {
      if (/^\d{2}(?:\.\d+)?$/.test(c)) {
        const v = Number(c);
        if (v >= PANEL_RS_PER_W[0] && v <= PANEL_RS_PER_W[1]) return v;
      }
    }
  }
  return null;
}

/** Battery price per kWh from one row, or null */
export function parseBatteryRow(row: string): number | null {
  const k = row.match(/(\d+(?:\.\d+)?)\s*kwh/i);
  if (!k) return null;
  const kwh = Number(k[1]);
  // Only ~5 kWh modules: the catalogue prices one module, and big units are cheaper per kWh
  if (!(kwh >= 4.5 && kwh <= 6)) return null;
  const prices = [...row.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{5,7})\b/g)]
    .map((x) => Number(x[1].replace(/,/g, "")))
    .filter((v) => v >= 50_000 && v <= 3_000_000);
  if (!prices.length) return null;
  const perKwh = Math.max(...prices) / kwh;
  return perKwh >= BATTERY_RS_PER_KWH[0] && perKwh <= BATTERY_RS_PER_KWH[1] ? perKwh : null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Collect samples per brand from page rows. */
export function extract(rows: string[], kind: Kind): Record<string, number[]> {
  const aliases = kind === "panel" ? PANEL_ALIASES : BATTERY_ALIASES;
  const out: Record<string, number[]> = {};
  const brandsIn = (row: string) => Object.entries(aliases).filter(([, re]) => re.test(row)).map(([id]) => id);
  const parse = kind === "panel" ? parsePanelRow : parseBatteryRow;
  for (let i = 0; i < rows.length; i++) {
    const ids = brandsIn(rows[i]);
    if (ids.length !== 1) continue; // skip rows mentioning several brands (comparisons, headings)
    let v = parse(rows[i]);
    // Brand and price may sit on separate lines (e.g. brand is a link, price in the next block)
    for (let k = 1; v === null && k <= 2 && i + k < rows.length; k++) {
      if (brandsIn(rows[i + k]).length) break;
      v = parse(rows.slice(i, i + k + 1).join(" "));
    }
    if (v !== null) (out[ids[0]] ??= []).push(v);
  }
  return out;
}

async function fetchPage(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "user-agent": "SolarROIAssessor/1.0 (daily price check, once per day)", accept: "text/html" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

let running: Promise<PriceStore> | null = null;

/** Run the price check and save results. Safe to call concurrently. */
export function refreshPrices(): Promise<PriceStore> {
  running ??= doRefresh().finally(() => (running = null));
  return running;
}

async function doRefresh(): Promise<PriceStore> {
  const log: string[] = [];
  const now = new Date().toISOString();
  const samples: Record<string, { values: number[]; sources: Set<string> }> = {};
  let pagesOk = 0;

  for (const src of SOURCES) {
    try {
      const rows = htmlToRows(await fetchPage(src.url));
      const found = extract(rows, src.kind);
      const n = Object.values(found).reduce((a, v) => a + v.length, 0);
      log.push(`${src.name}: ${n} prices found${n ? ` (${Object.keys(found).join(", ")})` : " — page layout may have changed"}`);
      if (n) pagesOk++;
      for (const [id, vals] of Object.entries(found)) {
        const key = src.kind === "panel" ? priceKey.panel(id) : priceKey.battery(id);
        // batteries: convert Rs/kWh → price per module
        const mod = BATTERIES.find((b) => b.id === id)?.moduleKwh ?? 5;
        const conv = src.kind === "panel" ? vals : vals.map((v) => v * mod);
        samples[key] ??= { values: [], sources: new Set() };
        samples[key].values.push(...conv);
        samples[key].sources.add(src.name);
      }
    } catch (e) {
      log.push(`${src.name}: failed (${(e as Error).message})`);
    }
  }

  const store = await readStore();
  const fallbacks: Record<string, number> = {};
  PANELS.forEach((p) => (fallbacks[priceKey.panel(p.id)] = p.price));
  BATTERIES.forEach((b) => (fallbacks[priceKey.battery(b.id)] = b.price));

  for (const [key, s] of Object.entries(samples)) {
    const m = median(s.values);
    const value = key.startsWith("panel") ? Math.round(m * 10) / 10 : Math.round(m / 1000) * 1000;
    const current = resolvePrice(store, key, fallbacks[key] ?? value).value;
    const change = Math.abs(value - current) / current;
    if (change > MAX_CHANGE) {
      log.push(`Rejected ${key}: ${value} is ${(change * 100).toFixed(0)}% away from current ${current}`);
      continue;
    }
    const rec: PriceRecord = { value, updatedAt: now, source: [...s.sources].join(", "), samples: s.values.length };
    store.auto[key] = rec;
    log.push(`Updated ${key}: ${value} (from ${rec.samples} listing${rec.samples === 1 ? "" : "s"})`);
  }

  store.lastRun = { at: now, ok: pagesOk > 0, log };
  await writeStore(store);
  return store;
}
