// Minimal Gemini client (server-only). Set GEMINI_API_KEY in .env.local.
// Free key: https://aistudio.google.com/apikey

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function gemini(parts: Part[], opts: { json?: boolean; temperature?: number } = {}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}
