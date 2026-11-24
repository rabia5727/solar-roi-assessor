// Equipment catalogue — Pakistan market prices.
// Prices move every few weeks: update PRICES_AS_OF and the numbers below,
// or override them per report in "Prices & assumptions".
//
// Sources checked Nov 2026: solarrate.pk, jbmssolar.pk, solarcitizen.com.pk,
// alphasolar.com.pk, astonenergy.com.pk, solarpricepakistan.com.pk, enontraders.com.
// Specs are typical datasheet values for the most common models sold in Pakistan.

export const PRICES_AS_OF = "November 2026";

export type Tier = "Budget" | "Value" | "Standard" | "Premium";

export type PanelBrand = {
  id: string;
  brand: string;
  model: string;
  tech: string;
  tier: Tier;
  /** Rs per watt [low, high] and typical */
  priceRange: [number, number];
  price: number;
  /** % per °C (negative) */
  tempCoeff: number;
  /** per year after year 1 */
  degradation: number;
  warranty: string;
  note: string;
  /** How easy to buy & get serviced in Pakistan, 1–3 (used to break near-ties) */
  availability: number;
};

export type InverterBrand = {
  id: string;
  brand: string;
  tier: Tier;
  /** Typical price of a ~10 kW unit, Rs */
  onGrid10: number;
  hybrid10: number;
  onGridRange: [number, number];
  hybridRange: [number, number];
  warranty: string;
  note: string;
  availability: number;
};

export type BatteryBrand = {
  id: string;
  brand: string;
  model: string;
  tier: Tier;
  /** One module */
  moduleKwh: number;
  priceRange: [number, number];
  /** Typical price per module, Rs */
  price: number;
  cycles: number;
  dod: number;
  warranty: string;
  note: string;
  availability: number;
};

export const PANELS: PanelBrand[] = [
  {
    id: "ja",
    brand: "JA Solar",
    model: "DeepBlue 4.0 N-type bifacial",
    tech: "N-type TOPCon",
    tier: "Value",
    priceRange: [38, 44],
    price: 39,
    tempCoeff: -0.0029,
    degradation: 0.004,
    warranty: "12 yr product / 30 yr output",
    note: "Tier-1 at the lowest typical price; very common in Pakistan",
    availability: 3,
  },
  {
    id: "astronergy",
    brand: "Astronergy",
    model: "ASTRO N bifacial",
    tech: "N-type TOPCon",
    tier: "Value",
    priceRange: [37, 41],
    price: 38.5,
    tempCoeff: -0.003,
    degradation: 0.004,
    warranty: "12 yr product / 30 yr output",
    note: "Tier-1 (Chint group), budget-friendly; fewer dealers than the big four",
    availability: 2,
  },
  {
    id: "jinko",
    brand: "Jinko Solar",
    model: "Tiger Neo N-type bifacial",
    tech: "N-type TOPCon",
    tier: "Standard",
    priceRange: [40, 44],
    price: 41,
    tempCoeff: -0.0029,
    degradation: 0.004,
    warranty: "12 yr product / 30 yr output",
    note: "Best-known brand in Pakistan; easy to find and resell",
    availability: 3,
  },
  {
    id: "trina",
    brand: "Trina Solar",
    model: "Vertex N bifacial",
    tech: "N-type TOPCon",
    tier: "Standard",
    priceRange: [39, 43],
    price: 41,
    tempCoeff: -0.0029,
    degradation: 0.004,
    warranty: "12 yr product / 30 yr output",
    note: "Solid tier-1 alternative, similar specs to Jinko",
    availability: 2,
  },
  {
    id: "canadian",
    brand: "Canadian Solar",
    model: "TOPBiHiKu N-type bifacial",
    tech: "N-type TOPCon",
    tier: "Standard",
    priceRange: [41, 45],
    price: 41.5,
    tempCoeff: -0.0029,
    degradation: 0.004,
    warranty: "12 yr product / 30 yr output",
    note: "Strong warranty reputation; slightly higher price",
    availability: 3,
  },
  {
    id: "longi",
    brand: "LONGi",
    model: "Hi-MO X10 (HPBC 2.0)",
    tech: "Back-contact",
    tier: "Premium",
    priceRange: [41, 46],
    price: 42.5,
    tempCoeff: -0.0026,
    degradation: 0.0035,
    warranty: "15 yr product / 30 yr output",
    note: "Highest efficiency, loses less power in heat; best for small roofs",
    availability: 3,
  },
];

export const INVERTERS: InverterBrand[] = [
  {
    id: "inverex",
    brand: "Inverex",
    tier: "Value",
    onGrid10: 200_000,
    hybrid10: 250_000,
    onGridRange: [180_000, 230_000],
    hybridRange: [200_000, 300_000],
    warranty: "Local warranty, varies by model",
    note: "Pakistani brand, lowest price and nationwide service centres",
    availability: 3,
  },
  {
    id: "growatt",
    brand: "Growatt",
    tier: "Value",
    onGrid10: 250_000,
    hybrid10: 270_000,
    onGridRange: [230_000, 280_000],
    hybridRange: [240_000, 300_000],
    warranty: "5 yr",
    note: "Widest dealer network and spare parts; good value",
    availability: 3,
  },
  {
    id: "goodwe",
    brand: "GoodWe",
    tier: "Standard",
    onGrid10: 240_000,
    hybrid10: 270_000,
    onGridRange: [180_000, 285_000],
    hybridRange: [240_000, 300_000],
    warranty: "5 yr",
    note: "Reliable mid-range; pairs with GoodWe Lynx batteries",
    availability: 2,
  },
  {
    id: "solis",
    brand: "Solis",
    tier: "Standard",
    onGrid10: 250_000,
    hybrid10: 320_000,
    onGridRange: [220_000, 300_000],
    hybridRange: [270_000, 354_000],
    warranty: "5 yr",
    note: "Reliable, popular single-phase hybrid with low-voltage batteries",
    availability: 2,
  },
  {
    id: "huawei",
    brand: "Huawei",
    tier: "Premium",
    onGrid10: 300_000,
    hybrid10: 400_000,
    onGridRange: [280_000, 330_000],
    hybridRange: [315_000, 500_000],
    warranty: "5–10 yr",
    note: "Premium reliability and FusionSolar monitoring app; highest price",
    availability: 3,
  },
];

export const BATTERIES: BatteryBrand[] = [
  {
    id: "pylontech",
    brand: "Pylontech",
    model: "UF5000 / Fidus",
    tier: "Standard",
    moduleKwh: 5.12,
    priceRange: [230_000, 260_000],
    price: 250_000,
    cycles: 6000,
    dod: 0.95,
    warranty: "5–10 yr",
    note: "Most widely compatible battery; proven track record",
    availability: 3,
  },
  {
    id: "dyness",
    brand: "Dyness",
    model: "DL5.0C / PowerBox",
    tier: "Standard",
    moduleKwh: 5.12,
    priceRange: [220_000, 280_000],
    price: 250_000,
    cycles: 6000,
    dod: 0.9,
    warranty: "5–10 yr",
    note: "Neat wall-mount design, works with most hybrid inverters",
    availability: 3,
  },
  {
    id: "inverex-li",
    brand: "Inverex",
    model: "Lithium 5.3 kWh",
    tier: "Standard",
    moduleKwh: 5.3,
    priceRange: [250_000, 360_000],
    price: 300_000,
    cycles: 6000,
    dod: 0.9,
    warranty: "Local warranty",
    note: "Local brand with easy warranty claims and service",
    availability: 3,
  },
  {
    id: "goodwe-lynx",
    brand: "GoodWe",
    model: "Lynx Home (high-voltage)",
    tier: "Premium",
    moduleKwh: 5,
    priceRange: [285_000, 370_000],
    price: 320_000,
    cycles: 6000,
    dod: 0.9,
    warranty: "10 yr",
    note: "Premium high-voltage stack; needs a matching GoodWe HV inverter",
    availability: 1,
  },
  {
    id: "budget-li",
    brand: "Budget LiFePO4",
    model: "Generic / lesser-known brands",
    tier: "Budget",
    moduleKwh: 5.12,
    priceRange: [140_000, 185_000],
    price: 165_000,
    cycles: 3500,
    dod: 0.85,
    warranty: "1–3 yr",
    note: "Cheapest upfront, but shorter life and weaker warranty; not recommended",
    availability: 2,
  },
];

/** Inverter price for a system of `kw`, scaled from the ~10 kW reference price. */
export function inverterPrice(price10: number, kw: number) {
  return price10 * Math.pow(Math.max(kw, 3) / 10, 0.8);
}

// ---------- Live catalogue (prices resolved from admin overrides / scraper / defaults) ----------

export type PriceSource = "manual" | "auto" | "default";

export type PriceInfo = { source: PriceSource; updatedAt: string | null; detail?: string };

export type Catalogue = {
  asOf: string;
  panels: PanelBrand[];
  inverters: InverterBrand[];
  batteries: BatteryBrand[];
  /** keyed by price key, e.g. "panel:ja", "battery:pylontech", "inverter:growatt:onGrid10" */
  priceInfo: Record<string, PriceInfo>;
  settings: { buybackRate: number | null; bosCostPerKw: number | null };
};

export const DEFAULT_CATALOGUE: Catalogue = {
  asOf: PRICES_AS_OF,
  panels: PANELS,
  inverters: INVERTERS,
  batteries: BATTERIES,
  priceInfo: {},
  settings: { buybackRate: null, bosCostPerKw: null },
};

export const priceKey = {
  panel: (id: string) => `panel:${id}`,
  battery: (id: string) => `battery:${id}`,
  inverterOnGrid: (id: string) => `inverter:${id}:onGrid10`,
  inverterHybrid: (id: string) => `inverter:${id}:hybrid10`,
  buyback: "setting:buybackRate",
  bos: "setting:bosCostPerKw",
};

export function priceLabel(info: PriceInfo | undefined) {
  if (!info || info.source === "default") return "typical price";
  const d = info.updatedAt ? new Date(info.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  return info.source === "manual" ? `set by admin ${d}` : `live market price ${d}`;
}
