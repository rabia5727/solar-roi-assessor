import { after, NextResponse } from "next/server";
import { readStore, resolveCatalogue } from "@/lib/priceStore";
import { refreshPrices } from "@/lib/scraper";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/** Public: current prices used by the calculator. Starts a background price check if the last one is over a day old. */
export async function GET() {
  const store = await readStore();
  const stale = !store.lastRun || Date.now() - new Date(store.lastRun.at).getTime() > DAY;
  if (stale && process.env.AUTO_PRICE_CHECK !== "off") {
    after(async () => {
      try {
        await refreshPrices();
      } catch {
        // ignored — the admin panel shows the last run's log
      }
    });
  }
  return NextResponse.json(resolveCatalogue(store), { headers: { "cache-control": "no-store" } });
}
