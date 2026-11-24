// Server-only price store.
//
// Three layers, highest priority first:
//   1. manual  — set by an admin in /admin (always wins)
//   2. auto    — found by the daily price check (used while fresh)
//   3. default — the built-in catalogue in equipment.ts (never fails)
//
// Storage: Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set (needed on Vercel),
// otherwise a local JSON file at data/prices.json (fine for running on your own PC).

import { promises as fs } from "fs";
import path from "path";
import {
  BATTERIES,
  DEFAULT_CATALOGUE,
  INVERTERS,
  PANELS,
  priceKey,
  PRICES_AS_OF,
  type Catalogue,
  type PriceInfo,
} from "./equipment";

export type PriceRecord = { value: number; updatedAt: string; source?: string; samples?: number };

export type PriceStore = {
  auto: Record<string, PriceRecord>;
  manual: Record<string, PriceRecord>;
  lastRun: { at: string; ok: boolean; log: string[] } | null;
};

export const AUTO_MAX_AGE_DAYS = 21;
const REDIS_KEY = "solar-roi:prices";
const FILE = path.join(process.cwd(), "data", "prices.json");

const empty = (): PriceStore => ({ auto: {}, manual: {}, lastRun: null });

function redis() {
  // Vercel's Upstash integration may name these KV_REST_API_URL / KV_REST_API_TOKEN
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function storageKind() {
  return redis() ? "Upstash Redis" : "local file (data/prices.json)";
}

async function redisCmd(cmd: string[]) {
  const r = redis()!;
  const res = await fetch(r.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash error ${res.status}`);
  return (await res.json()).result as string | null;
}

export async function readStore(): Promise<PriceStore> {
  try {
    const raw = redis() ? await redisCmd(["GET", REDIS_KEY]) : await fs.readFile(FILE, "utf8");
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

export async function writeStore(store: PriceStore) {
  const raw = JSON.stringify(store, null, 2);
  if (redis()) {
    await redisCmd(["SET", REDIS_KEY, raw]);
    return;
  }
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, raw, "utf8");
  } catch (e) {
    throw new Error(
      `Could not save prices (${(e as Error).message}). On Vercel, add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to save changes.`,
    );
  }
}

const isFresh = (r: PriceRecord | undefined) =>
  !!r && Date.now() - new Date(r.updatedAt).getTime() < AUTO_MAX_AGE_DAYS * 86_400_000;

/** Pick manual → fresh auto → default for one price key. */
export function resolvePrice(store: PriceStore, key: string, fallback: number): { value: number; info: PriceInfo } {
  const m = store.manual[key];
  if (m && m.value > 0) return { value: m.value, info: { source: "manual", updatedAt: m.updatedAt } };
  const a = store.auto[key];
  if (isFresh(a) && a.value > 0)
    return { value: a.value, info: { source: "auto", updatedAt: a.updatedAt, detail: a.source } };
  return { value: fallback, info: { source: "default", updatedAt: null } };
}

/** The catalogue with every price resolved — this is what the calculator uses. */
export function resolveCatalogue(store: PriceStore): Catalogue {
  const priceInfo: Record<string, PriceInfo> = {};
  const use = (key: string, fallback: number) => {
    const r = resolvePrice(store, key, fallback);
    priceInfo[key] = r.info;
    return r.value;
  };
  const widen = (range: [number, number], v: number): [number, number] => [Math.min(range[0], v), Math.max(range[1], v)];

  const panels = PANELS.map((p) => {
    const price = Math.round(use(priceKey.panel(p.id), p.price) * 10) / 10;
    return { ...p, price, priceRange: widen(p.priceRange, price) };
  });
  const batteries = BATTERIES.map((b) => {
    const price = Math.round(use(priceKey.battery(b.id), b.price));
    return { ...b, price, priceRange: widen(b.priceRange, price) };
  });
  const inverters = INVERTERS.map((v) => {
    const onGrid10 = Math.round(use(priceKey.inverterOnGrid(v.id), v.onGrid10));
    const hybrid10 = Math.round(use(priceKey.inverterHybrid(v.id), v.hybrid10));
    return { ...v, onGrid10, hybrid10, onGridRange: widen(v.onGridRange, onGrid10), hybridRange: widen(v.hybridRange, hybrid10) };
  });

  const setting = (key: string) => {
    const m = store.manual[key];
    return m && m.value >= 0 ? m.value : null;
  };

  // "As of" = the newest live/manual price in use, else the catalogue date
  const dates = Object.values(priceInfo)
    .map((i) => i.updatedAt)
    .filter((d): d is string => !!d)
    .sort();
  const newest = dates[dates.length - 1];

  return {
    ...DEFAULT_CATALOGUE,
    asOf: newest ? new Date(newest).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : PRICES_AS_OF,
    panels,
    batteries,
    inverters,
    priceInfo,
    settings: { buybackRate: setting(priceKey.buyback), bosCostPerKw: setting(priceKey.bos) },
  };
}

/** Admin password check. Admin features are off until ADMIN_PASSWORD is set. */
export function checkAdmin(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return { ok: false, status: 503, error: "Admin is disabled. Set ADMIN_PASSWORD in .env.local (or Vercel settings) and restart." };
  if (req.headers.get("x-admin-password") !== pw) return { ok: false, status: 401, error: "Wrong password" };
  return { ok: true };
}
