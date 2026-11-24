import type { Inputs } from "./types";

// Inputs are encoded into the URL, so a report link works without any database.

export function encodeInputs(inp: Inputs): string {
  const json = JSON.stringify(inp);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeInputs(s: string): Inputs | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Inputs;
  } catch {
    return null;
  }
}
