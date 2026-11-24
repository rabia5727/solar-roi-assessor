import { NextRequest, NextResponse } from "next/server";
import { aiEnabled, aiVisionJson } from "@/lib/ai";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // photos are compressed in the browser before upload

const PROMPT = `You are reading a Pakistani electricity bill (LESCO, IESCO, FESCO, GEPCO, MEPCO, PESCO, HESCO, SEPCO, QESCO, TESCO or K-Electric).
Extract the fields below. Return ONLY JSON with exactly these keys:
{
  "disco": string | null,                 // e.g. "LESCO"
  "customerName": string | null,
  "billingMonth": string | null,          // e.g. "Oct 2026"
  "unitsConsumed": number | null,         // units (kWh) for the current billing month
  "totalAmount": number | null,           // total payable within due date, in Rs
  "sanctionedLoadKw": number | null,      // "Sanctioned Load" / "Connected Load" in kW
  "tariffCategory": string | null,        // e.g. "A-1(a) Residential"
  "history": [{ "month": string, "units": number }]  // the monthly units history table if printed (up to 12 months), else []
}
Rules: read numbers exactly as printed; do not guess. If a field is not visible, use null. Months in "history" should be 3-letter English names with year if shown, e.g. "Jul 2026".`;

const MONTH_IDX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "Bill reading needs an AI key. Add GROQ_API_KEY (console.groq.com) or GEMINI_API_KEY (aistudio.google.com) to .env.local and restart." },
      { status: 503 },
    );
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
  const mime = file.type || "image/jpeg";
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    return NextResponse.json({ error: "Upload a photo (JPG/PNG) or PDF of the bill" }, { status: 400 });
  }

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const parsed = await aiVisionJson(PROMPT, mime, data);

    // Map bill history onto calendar months Jan..Dec
    let monthlyHistory: number[] | null = null;
    if (Array.isArray(parsed.history) && parsed.history.length > 0) {
      const arr = new Array(12).fill(0);
      for (const h of parsed.history) {
        const idx = MONTH_IDX[String(h?.month ?? "").trim().slice(0, 3).toLowerCase()];
        const units = Number(h?.units);
        if (idx !== undefined && Number.isFinite(units) && units > 0 && arr[idx] === 0) arr[idx] = units;
      }
      if (arr.filter((v) => v > 0).length >= 3) monthlyHistory = arr;
    }

    const units = Number(parsed.unitsConsumed) || null;
    const amount = Number(parsed.totalAmount) || null;
    return NextResponse.json({
      disco: parsed.disco ?? null,
      customerName: parsed.customerName ?? null,
      billingMonth: parsed.billingMonth ?? null,
      unitsConsumed: units,
      totalAmount: amount,
      effectiveTariff: units && amount ? Math.round((amount / units) * 100) / 100 : null,
      sanctionedLoadKw: Number(parsed.sanctionedLoadKw) || null,
      tariffCategory: parsed.tariffCategory ?? null,
      monthlyHistory,
    });
  } catch (e) {
    return NextResponse.json({ error: `Could not read the bill: ${(e as Error).message}` }, { status: 500 });
  }
}
