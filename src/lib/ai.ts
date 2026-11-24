// AI provider wrapper (server-only).
// Uses Groq when GROQ_API_KEY is set, otherwise Gemini when GEMINI_API_KEY is set.
// Groq models change often — override with GROQ_TEXT_MODEL / GROQ_VISION_MODEL.

import { gemini } from "./gemini";

export type Provider = "groq" | "gemini";

export function aiProvider(): Provider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export const aiEnabled = () => aiProvider() !== null;

/** Can the active provider read PDF files directly? (Groq accepts images only.) */
export const aiReadsPdf = () => aiProvider() === "gemini";

type GroqContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];

/** Remove "thinking" blocks some reasoning models put in their answer */
export const stripThinking = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

/** Pull the JSON object out of a reply, even if wrapped in ``` fences or extra text */
export function extractJson(s: string) {
  const clean = stripThinking(s).replace(/```(?:json)?/gi, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI reply contained no JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

async function groq(model: string, content: GroqContent, opts: { json?: boolean; temperature?: number }) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: opts.temperature ?? 0.3,
      max_completion_tokens: 4096,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq error ${res.status} (model ${model}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("Empty response from Groq");
  return stripThinking(text);
}

/** Plain text generation */
export async function aiText(prompt: string, opts: { temperature?: number } = {}) {
  if (aiProvider() === "groq") {
    return groq(process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b", prompt, opts);
  }
  return stripThinking(await gemini([{ text: prompt }], opts));
}

/** Read an image (or PDF, Gemini only) and answer in JSON */
export async function aiVisionJson(prompt: string, mime: string, base64: string) {
  if (aiProvider() === "groq") {
    if (mime === "application/pdf") throw new Error("Please upload a photo or screenshot of the bill (PDFs need a Gemini key).");
    const text = await groq(
      process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b",
      [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
      ],
      { json: true, temperature: 0 },
    );
    return extractJson(text);
  }
  const text = await gemini([{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }], { json: true, temperature: 0 });
  return extractJson(text);
}
