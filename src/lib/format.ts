export const rs = (v: number) => `Rs ${Math.round(v).toLocaleString("en-IN")}`;

/** Pakistani-style short amounts: 4.5 lakh, 1.2 crore */
export const rsShort = (v: number) => {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}Rs ${(a / 1e7).toFixed(2)} crore`;
  if (a >= 1e5) return `${sign}Rs ${(a / 1e5).toFixed(1)} lakh`;
  return `${sign}Rs ${Math.round(a).toLocaleString("en-IN")}`;
};

export const num = (v: number, d = 0) => v.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

export const years = (v: number | null) => (v === null ? "25+ years" : `${v.toFixed(1)} years`);

/** Monthly bill: negative means the export credit is bigger than the bill */
export const bill = (v: number) => (v < 0 ? `Rs 0 (credit ${rsShort(-v)})` : rsShort(v));
