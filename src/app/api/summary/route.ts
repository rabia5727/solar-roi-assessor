import { NextRequest, NextResponse } from "next/server";
import { aiEnabled, aiText } from "@/lib/ai";
import { aiPrompt, type Lang, type summaryFacts } from "@/lib/summary";

export async function POST(req: NextRequest) {
  const { facts, lang } = (await req.json()) as { facts: ReturnType<typeof summaryFacts>; lang: Lang };
  if (!aiEnabled()) return NextResponse.json({ text: null, ai: false });
  try {
    const text = await aiText(aiPrompt(facts, lang === "ur" ? "ur" : "en"), { temperature: 0.4 });
    return NextResponse.json({ text: text.trim(), ai: true });
  } catch (e) {
    // The client falls back to the built-in template summary
    return NextResponse.json({ text: null, ai: false, error: (e as Error).message });
  }
}
