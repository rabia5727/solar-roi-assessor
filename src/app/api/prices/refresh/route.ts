import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, readStore, resolveCatalogue } from "@/lib/priceStore";
import { refreshPrices } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily schedule (Vercel Cron sends "Authorization: Bearer <CRON_SECRET>") */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await refreshPrices();
  return NextResponse.json({ ok: store.lastRun?.ok, log: store.lastRun?.log });
}

/** "Run price check now" button in /admin */
export async function POST(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    await refreshPrices();
    const store = await readStore();
    return NextResponse.json({ store, resolved: resolveCatalogue(store) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
