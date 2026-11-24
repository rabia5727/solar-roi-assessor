import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, readStore, resolveCatalogue, storageKind, writeStore } from "@/lib/priceStore";
import { BATTERIES, INVERTERS, PANELS, priceKey } from "@/lib/equipment";
import { SOURCES } from "@/lib/scraper";

export const dynamic = "force-dynamic";

const VALID_KEYS = new Set([
  ...PANELS.map((p) => priceKey.panel(p.id)),
  ...BATTERIES.map((b) => priceKey.battery(b.id)),
  ...INVERTERS.flatMap((v) => [priceKey.inverterOnGrid(v.id), priceKey.inverterHybrid(v.id)]),
  priceKey.buyback,
  priceKey.bos,
]);

export async function GET(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const store = await readStore();
  return NextResponse.json({ store, resolved: resolveCatalogue(store), storage: storageKind(), sources: SOURCES });
}

/** Body: { manual: { "<key>": number | null } } — null clears an override */
export async function PUT(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await req.json()) as { manual?: Record<string, number | null> };
  const store = await readStore();
  const now = new Date().toISOString();
  for (const [key, v] of Object.entries(body.manual ?? {})) {
    if (!VALID_KEYS.has(key)) continue;
    if (v === null || !Number.isFinite(v) || v < 0) delete store.manual[key];
    else store.manual[key] = { value: v, updatedAt: now, source: "admin" };
  }
  try {
    await writeStore(store);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ store, resolved: resolveCatalogue(store) });
}
