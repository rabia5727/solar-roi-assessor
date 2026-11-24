// The calculation engine. Every number in the report comes from here —
// deterministic formulas, no AI involved.

import type {
  BatteryOption,
  Equipment,
  Inputs,
  InverterOption,
  Layout,
  MonthRow,
  PanelOption,
  Results,
  Scenario,
  ScenarioId,
  SolarData,
} from "./types";
import { DAYS_IN_MONTH, MONTHS, optimalTilt, tiltedIrradiance, winterNoonElevation } from "./solar";
import {
  DEFAULT_CATALOGUE,
  inverterPrice,
  priceKey,
  priceLabel,
  type BatteryBrand,
  type Catalogue,
  type InverterBrand,
  type PanelBrand,
} from "./equipment";

// ---------- Technical assumptions ----------
export const LOSSES = {
  soiling: 0.06, // dust & smog — significant in Pakistan, assumes cleaning every 2–3 weeks
  inverter: 0.03,
  wiring: 0.02,
  mismatch: 0.02,
  shadingAndAging: 0.02, // light-induced degradation, minor shading
  availability: 0.01,
};
const BASE_PR = Object.values(LOSSES).reduce((acc, l) => acc * (1 - l), 1);
const CELL_TEMP_RISE = 20; // °C above daytime air temperature
const PANEL_L = 2.278; // m, ~580 W module (portrait)
const PANEL_W = 1.134;
const SETBACK = 0.6; // m clearance from parapet / edges
const BATTERY_RTE = 0.92;
const BATTERY_CYCLES_PER_YEAR = 300;
const BATTERY_MAX_LIFE = 12; // calendar ageing cap, years
const OM_PER_KW = 1_200; // Rs/kW/year cleaning + upkeep
const OM_ESCALATION = 0.05;
const INVERTER_REPLACEMENT_YEAR = 12;
const REPLACEMENT_PRICE_FACTOR = 0.75; // equipment gets cheaper over time
const GRID_CO2_KG_PER_KWH = 0.45;
const YEARS = 25;

// Typical Pakistani household usage pattern (AC-heavy summers), normalised below
const SEASONAL_RAW = [0.7, 0.7, 0.8, 1.0, 1.25, 1.4, 1.4, 1.35, 1.2, 0.95, 0.7, 0.65];
const SEASONAL = SEASONAL_RAW.map((v) => (v * 12) / SEASONAL_RAW.reduce((a, b) => a + b, 0));

// Used for sizing and as the baseline when a category is on "auto"
const REFERENCE = { panel: "jinko", inverter: "growatt", battery: "pylontech" };

export const DEFAULT_INPUTS: Inputs = {
  customerName: "",
  locationName: "Lahore",
  lat: 31.5204,
  lon: 74.3587,
  monthlyUnits: 600,
  monthlyHistory: null,
  seasonal: true,
  tariff: 55,
  sanctionedLoadKw: 10,
  roofLengthM: 12,
  roofWidthM: 9,
  daytimeShare: 0.45,
  essentialLoadKw: 1.5,
  panelBrand: "auto",
  inverterBrand: "auto",
  batteryBrand: "auto",
  bosCostPerKw: 40_000,
  panelPriceOverride: null,
  batteryPriceOverride: null,
  buybackRate: 8.13,
  tariffEscalation: 0.08,
  discountRate: 0.12,
  panelWatt: 585,
  tiltDeg: null,
  installer: { name: "", phone: "", logoUrl: "", color: "#d97706" },
};

// ---------- Helpers ----------
/** Soft minimum: models that daytime load and the solar curve never line up perfectly */
const softMin = (a: number, b: number, p = 3) => (a <= 0 || b <= 0 ? 0 : 1 / Math.pow(Math.pow(a, -p) + Math.pow(b, -p), 1 / p));

function monthlyConsumption(inp: Inputs): number[] {
  const hist = inp.monthlyHistory;
  if (hist && hist.filter((v) => v > 0).length >= 6) {
    const known = hist.filter((v) => v > 0);
    const avg = known.reduce((a, b) => a + b, 0) / known.length;
    return hist.map((v, i) => (v > 0 ? v : avg * SEASONAL[i]));
  }
  return SEASONAL.map((f) => inp.monthlyUnits * (inp.seasonal ? f : 1));
}

export function roofLayout(inp: Inputs, tiltDeg: number): Layout {
  const beta = (tiltDeg * Math.PI) / 180;
  const elev = Math.max(15, winterNoonElevation(inp.lat)) * (Math.PI / 180);
  const projected = PANEL_L * Math.cos(beta);
  const shadow = (PANEL_L * Math.sin(beta)) / Math.tan(elev);
  const rowPitch = projected + shadow;
  const usableL = inp.roofLengthM - 2 * SETBACK;
  const usableW = inp.roofWidthM - 2 * SETBACK;
  const cols = Math.max(0, Math.floor((usableL + 0.02) / (PANEL_W + 0.02)));
  const rows = usableW >= projected ? Math.floor((usableW - projected) / rowPitch) + 1 : 0;
  return { cols, rows, panelW: PANEL_W, panelL: projected, rowPitch, setback: SETBACK, roofL: inp.roofLengthM, roofW: inp.roofWidthM, maxPanels: cols * rows };
}

function npv(rate: number, flows: number[]) {
  return flows.reduce((acc, f, t) => acc + f / Math.pow(1 + rate, t), 0);
}

function irr(flows: number[]): number | null {
  let lo = -0.9,
    hi = 2;
  if (npv(lo, flows) * npv(hi, flows) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo, flows) * npv(mid, flows) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function payback(cumulative: number[]): number | null {
  for (let t = 1; t < cumulative.length; t++) {
    if (cumulative[t] >= 0) {
      const prev = cumulative[t - 1];
      const step = cumulative[t] - prev;
      return t - 1 + (step > 0 ? -prev / step : 0);
    }
  }
  return null;
}

const batteryLife = (b: BatteryBrand) => Math.min(BATTERY_MAX_LIFE, Math.floor(b.cycles / BATTERY_CYCLES_PER_YEAR));

// ---------- Core simulation ----------
type Kit = {
  panel: PanelBrand;
  inverter: InverterBrand;
  battery: BatteryBrand;
  panelPricePerW: number;
  batteryPricePerKwh: number;
};

type Ctx = {
  inp: Inputs;
  cons: number[];
  tilted: number[]; // kWh/m²/day on panel plane
  dayTemp: number[]; // °C
  avgNightDaily: number;
};

const tempFactor = (ctx: Ctx, m: number, panel: PanelBrand) => 1 + panel.tempCoeff * (ctx.dayTemp[m] + CELL_TEMP_RISE - 25);

function genPerKw(ctx: Ctx, panel: PanelBrand) {
  return ctx.tilted.map((t, m) => t * BASE_PR * tempFactor(ctx, m, panel) * DAYS_IN_MONTH[m]);
}

function simulateMonths(ctx: Ctx, gen1: number[], degradation: number, kwp: number, batteryKwh: number, dod: number, year: number): MonthRow[] {
  const { inp, cons } = ctx;
  const degr = Math.pow(1 - degradation, year - 1);
  const tariff = inp.tariff * Math.pow(1 + inp.tariffEscalation, year - 1);
  const battUsable = batteryKwh * dod;
  return MONTHS.map((month, m) => {
    const generation = gen1[m] * kwp * degr;
    const dayLoad = cons[m] * inp.daytimeShare;
    const nightLoad = cons[m] - dayLoad;
    const selfUse = softMin(generation, dayLoad);
    const surplus = generation - selfUse;
    const batteryUse = Math.min(surplus * BATTERY_RTE, nightLoad, battUsable * DAYS_IN_MONTH[m]);
    const exported = Math.max(0, surplus - batteryUse / BATTERY_RTE);
    const imported = Math.max(0, cons[m] - selfUse - batteryUse);
    const billBefore = cons[m] * tariff;
    const billAfter = imported * tariff - exported * inp.buybackRate;
    return { month, consumption: cons[m], generation, selfUse, batteryUse, exported, imported, billBefore, billAfter };
  });
}

function batteryKwhFor(ctx: Ctx, id: ScenarioId, battery: BatteryBrand) {
  if (id === "grid") return 0;
  const half = (ctx.avgNightDaily * 0.5) / battery.dod;
  const full = Math.max(ctx.avgNightDaily, ctx.inp.essentialLoadKw * 6) / battery.dod;
  const modules = (need: number) => Math.max(1, Math.ceil(need / battery.moduleKwh - 0.05));
  const hybridModules = modules(half);
  const n = id === "hybrid" ? hybridModules : Math.max(hybridModules + 1, modules(full));
  return n * battery.moduleKwh;
}

const META: Record<ScenarioId, { name: string; tagline: string }> = {
  grid: { name: "On-grid", tagline: "Lowest cost, no backup during load-shedding" },
  hybrid: { name: "Hybrid", tagline: "Small battery: stores daytime surplus for the evening" },
  backup: { name: "Full backup", tagline: "Large battery: covers nights and load-shedding" },
};

function buildScenario(ctx: Ctx, id: ScenarioId, kwp: number, kit: Kit, panels: number): Scenario {
  const { inp } = ctx;
  const batteryKwh = batteryKwhFor(ctx, id, kit.battery);
  const gen1 = genPerKw(ctx, kit.panel);

  const panelCost = kwp * 1000 * kit.panelPricePerW;
  const inverterCost = inverterPrice(batteryKwh > 0 ? kit.inverter.hybrid10 : kit.inverter.onGrid10, kwp);
  const bosCost = kwp * inp.bosCostPerKw;
  const batteryCost = batteryKwh * kit.batteryPricePerKwh;
  const capex = panelCost + inverterCost + bosCost + batteryCost;
  const capexBreakdown = [
    { label: `${kit.panel.brand} panels (${panels} × ${inp.panelWatt} W)`, amount: panelCost },
    { label: `${kit.inverter.brand} ${batteryKwh > 0 ? "hybrid" : "on-grid"} inverter`, amount: inverterCost },
    { label: "Structure, wiring, installation & approvals", amount: bosCost },
    ...(batteryKwh > 0
      ? [{ label: `${kit.battery.brand} battery (${Math.round(batteryKwh / kit.battery.moduleKwh)} × ${kit.battery.moduleKwh} kWh)`, amount: batteryCost }]
      : []),
  ];

  const life = batteryLife(kit.battery);
  const cashflows = [-capex];
  let months1: MonthRow[] = [];
  let savings25 = 0;
  let solarKwh25 = 0;
  for (let y = 1; y <= YEARS; y++) {
    const months = simulateMonths(ctx, gen1, kit.panel.degradation, kwp, batteryKwh, kit.battery.dod, y);
    if (y === 1) months1 = months;
    const savings = months.reduce((a, r) => a + (r.billBefore - r.billAfter), 0);
    const om = kwp * OM_PER_KW * Math.pow(1 + OM_ESCALATION, y - 1);
    let replacement = 0;
    if (y === INVERTER_REPLACEMENT_YEAR) replacement += inverterCost * REPLACEMENT_PRICE_FACTOR;
    if (batteryKwh > 0 && y % life === 0 && y < YEARS) replacement += batteryCost * REPLACEMENT_PRICE_FACTOR;
    cashflows.push(savings - om - replacement);
    savings25 += savings;
    solarKwh25 += months.reduce((a, r) => a + r.selfUse + r.batteryUse + r.exported, 0);
  }
  const cumulative: number[] = [];
  cashflows.reduce((acc, f, i) => ((cumulative[i] = acc + f), acc + f), 0);

  const sum = (k: keyof MonthRow) => months1.reduce((a, r) => a + (r[k] as number), 0);
  const consumption = sum("consumption");
  return {
    id,
    ...META[id],
    batteryKwh: Math.round(batteryKwh * 100) / 100,
    capex,
    capexBreakdown,
    months: months1,
    year1: {
      generation: sum("generation"),
      selfUse: sum("selfUse") + sum("batteryUse"),
      exported: sum("exported"),
      imported: sum("imported"),
      billBefore: sum("billBefore"),
      billAfter: sum("billAfter"),
      savings: sum("billBefore") - sum("billAfter"),
      solarShare: consumption > 0 ? (sum("selfUse") + sum("batteryUse")) / consumption : 0,
    },
    cashflows,
    cumulative,
    npv: npv(inp.discountRate, cashflows),
    irr: irr(cashflows),
    paybackYears: payback(cumulative),
    savings25,
    backupHours: inp.essentialLoadKw > 0 ? (batteryKwh * kit.battery.dod) / inp.essentialLoadKw : 0,
    co2Tons25: (solarKwh25 * GRID_CO2_KG_PER_KWH) / 1000,
  };
}

function makeKit(inp: Inputs, panel: PanelBrand, inverter: InverterBrand, battery: BatteryBrand): Kit {
  const panelChosen = inp.panelBrand === panel.id;
  const batteryChosen = inp.batteryBrand === battery.id;
  return {
    panel,
    inverter,
    battery,
    panelPricePerW: panelChosen && inp.panelPriceOverride ? inp.panelPriceOverride : panel.price,
    batteryPricePerKwh: batteryChosen && inp.batteryPriceOverride ? inp.batteryPriceOverride : battery.price / battery.moduleKwh,
  };
}

const allScenarios = (ctx: Ctx, kwp: number, kit: Kit, panels: number) =>
  (["grid", "hybrid", "backup"] as ScenarioId[]).map((id) => buildScenario(ctx, id, kwp, kit, panels));

/** Highest NPV; among options within 0.5% of the best, prefer the one easiest to buy & service. */
function recommend<T extends { availability: number }>(runs: { item: T; npv: number }[]): T {
  const top = Math.max(...runs.map((r) => r.npv));
  const near = runs.filter((r) => r.npv >= top - Math.abs(top) * 0.005);
  // stable sort: ties keep catalogue order (most established brand listed first)
  return near.sort((a, b) => b.item.availability - a.item.availability)[0].item;
}

const bestOf = (s: Scenario[]) => s.reduce((a, b) => (b.npv > a.npv ? b : a));

export function calculate(inp: Inputs, solar: SolarData, cat: Catalogue = DEFAULT_CATALOGUE): Results {
  const { panels: PANELS, inverters: INVERTERS, batteries: BATTERIES } = cat;
  const findPanel = (id: string) => PANELS.find((p) => p.id === id);
  const findInverter = (id: string) => INVERTERS.find((p) => p.id === id);
  const findBattery = (id: string) => BATTERIES.find((p) => p.id === id);
  const tiltDeg = inp.tiltDeg ?? optimalTilt(inp.lat);
  const cons = monthlyConsumption(inp);
  const tilted = solar.ghi.map((g, m) => tiltedIrradiance(g, m, inp.lat, tiltDeg));
  const dayTemp = solar.t2m.map((t, m) => (t + solar.t2mMax[m]) / 2);
  const avgNightDaily = cons.reduce((a, c, m) => a + (c * (1 - inp.daytimeShare)) / DAYS_IN_MONTH[m], 0) / 12;
  const ctx: Ctx = { inp, cons, tilted, dayTemp, avgNightDaily };

  const pick = <T,>(id: string, find: (id: string) => T | undefined, ref: string) => (id !== "auto" && find(id)) || find(ref)!;
  const refKit = makeKit(
    inp,
    pick(inp.panelBrand, findPanel, REFERENCE.panel),
    pick(inp.inverterBrand, findInverter, REFERENCE.inverter),
    pick(inp.batteryBrand, findBattery, REFERENCE.battery),
  );

  // --- Sizing: panel count with the best 25-year NPV (on-grid) ---
  const layout = roofLayout(inp, tiltDeg);
  const sanctionedCap = inp.sanctionedLoadKw > 0 ? Math.floor((inp.sanctionedLoadKw * 1000) / inp.panelWatt) : Infinity;
  const maxPanels = Math.max(1, Math.min(layout.maxPanels || 1, sanctionedCap));
  let panels = 1;
  let bestNpv = -Infinity;
  for (let p = 1; p <= maxPanels; p++) {
    const s = buildScenario(ctx, "grid", (p * inp.panelWatt) / 1000, refKit, p);
    if (s.npv > bestNpv + 1) {
      bestNpv = s.npv;
      panels = p;
    }
  }
  const limitedBy: Results["system"]["limitedBy"] =
    panels < maxPanels ? "economics" : maxPanels === sanctionedCap && sanctionedCap < layout.maxPanels ? "sanctioned" : "roof";
  const kwp = (panels * inp.panelWatt) / 1000;

  // --- Which option type wins with the reference kit? Brands are ranked in that option. ---
  const refType = bestOf(allScenarios(ctx, kwp, refKit, panels)).id;
  const batteryType: ScenarioId = refType === "grid" ? "hybrid" : refType;

  // --- Rank brands (each with the other components held at the reference kit) ---
  const panelRuns = PANELS.map((p) => {
    const kit = makeKit(inp, p, refKit.inverter, refKit.battery);
    return { p, kit, s: buildScenario(ctx, refType, kwp, kit, panels), grid: buildScenario(ctx, "grid", kwp, kit, panels) };
  });
  const recPanel = recommend(panelRuns.map((r) => ({ item: r.p, npv: r.s.npv })));

  const inverterRuns = INVERTERS.map((v) => ({ v, s: buildScenario(ctx, refType, kwp, makeKit(inp, refKit.panel, v, refKit.battery), panels) }));
  const recInverter = recommend(
    inverterRuns.filter((r) => !/varies|local/i.test(r.v.warranty)).map((r) => ({ item: r.v, npv: r.s.npv })),
  );

  const batteryRuns = BATTERIES.map((b) => {
    const kit = makeKit(inp, refKit.panel, refKit.inverter, b);
    return { b, kit, s: buildScenario(ctx, batteryType, kwp, kit, panels) };
  });
  const recBattery = recommend(batteryRuns.filter((r) => r.b.tier !== "Budget").map((r) => ({ item: r.b, npv: r.s.npv })));

  // --- Final kit: user's choice, or the recommendation ---
  const finalPanel = (inp.panelBrand !== "auto" && findPanel(inp.panelBrand)) || recPanel;
  const finalInverter = (inp.inverterBrand !== "auto" && findInverter(inp.inverterBrand)) || recInverter;
  const finalBattery = (inp.batteryBrand !== "auto" && findBattery(inp.batteryBrand)) || recBattery;
  const kit = makeKit(inp, finalPanel, finalInverter, finalBattery);

  const scenarios = allScenarios(ctx, kwp, kit, panels);
  const bestScenario = bestOf(scenarios).id;

  const equipment: Equipment = {
    asOf: cat.asOf,
    rankedBy: META[refType].name,
    selected: { panel: finalPanel.id, inverter: finalInverter.id, battery: finalBattery.id },
    auto: { panel: inp.panelBrand === "auto", inverter: inp.inverterBrand === "auto", battery: inp.batteryBrand === "auto" },
    panels: panelRuns.map(({ p, kit: k, s, grid }): PanelOption => ({
      id: p.id,
      brand: p.brand,
      model: p.model,
      tech: p.tech,
      tier: p.tier,
      pricePerW: k.panelPricePerW,
      priceRange: p.priceRange,
      priceSource: priceLabel(cat.priceInfo[priceKey.panel(p.id)]),
      warranty: p.warranty,
      note: p.note,
      panelCost: kwp * 1000 * k.panelPricePerW,
      systemCost: grid.capex,
      annualGeneration: grid.year1.generation,
      paybackYears: s.paybackYears,
      npv: s.npv,
      recommended: p.id === recPanel.id,
      selected: p.id === finalPanel.id,
    })),
    inverters: inverterRuns.map(({ v, s }): InverterOption => ({
      id: v.id,
      brand: v.brand,
      tier: v.tier,
      onGridPrice: inverterPrice(v.onGrid10, kwp),
      hybridPrice: inverterPrice(v.hybrid10, kwp),
      priceSource: priceLabel(cat.priceInfo[priceKey.inverterHybrid(v.id)] ?? cat.priceInfo[priceKey.inverterOnGrid(v.id)]),
      warranty: v.warranty,
      note: v.note,
      npv: s.npv,
      recommended: v.id === recInverter.id,
      selected: v.id === finalInverter.id,
    })),
    batteries: batteryRuns.map(({ b, kit: k, s }): BatteryOption => {
      const kwh = s.batteryKwh;
      const cost = kwh * k.batteryPricePerKwh;
      return {
        id: b.id,
        brand: b.brand,
        model: b.model,
        tier: b.tier,
        modules: Math.round(kwh / b.moduleKwh),
        kwh,
        cost,
        pricePerKwh: k.batteryPricePerKwh,
        priceSource: priceLabel(cat.priceInfo[priceKey.battery(b.id)]),
        costPerStoredUnit: k.batteryPricePerKwh / (b.dod * Math.min(b.cycles, batteryLife(b) * BATTERY_CYCLES_PER_YEAR)),
        cycles: b.cycles,
        lifeYears: batteryLife(b),
        warranty: b.warranty,
        note: b.note,
        npv: s.npv,
        paybackYears: s.paybackYears,
        recommended: b.id === recBattery.id,
        selected: b.id === finalBattery.id,
      };
    }),
  };

  const grid = scenarios[0];
  const annualGeneration = grid.year1.generation;
  const consumption = cons.reduce((a, b) => a + b, 0);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const rsK = (v: number) => `Rs ${Math.round(v).toLocaleString("en-IN")}`;

  return {
    inputs: inp,
    solar,
    system: {
      panels,
      kwp,
      tiltDeg,
      annualGeneration,
      specificYield: annualGeneration / kwp,
      coverage: annualGeneration / consumption,
      performanceRatio: BASE_PR,
      limitedBy,
    },
    layout,
    monthlyIrradiance: MONTHS.map((month, m) => ({
      month,
      horizontal: solar.ghi[m],
      tilted: tilted[m],
      tempLossPct: (1 - tempFactor(ctx, m, finalPanel)) * 100,
    })),
    scenarios,
    bestScenario,
    equipment,
    assumptions: [
      { label: "Solar & weather data", value: `NASA POWER, ${solar.period}` },
      { label: "Panel tilt", value: `${tiltDeg}°, facing south` },
      { label: "System losses (dust, inverter, wiring…)", value: pct(1 - BASE_PR) },
      { label: `Heat loss (${finalPanel.brand})`, value: `${(finalPanel.tempCoeff * 100).toFixed(2)}% per °C` },
      { label: `Panel degradation (${finalPanel.brand})`, value: `${pct(finalPanel.degradation)} per year` },
      { label: "Export rate (NEPRA net billing 2026)", value: `Rs ${inp.buybackRate.toFixed(2)} / unit` },
      { label: "Electricity price rise", value: `${pct(inp.tariffEscalation)} per year` },
      { label: "Discount rate (for NPV)", value: pct(inp.discountRate) },
      { label: `Panel price (${finalPanel.brand})`, value: `Rs ${kit.panelPricePerW} / W` },
      { label: `Battery price (${finalBattery.brand})`, value: `${rsK(kit.batteryPricePerKwh)} / kWh` },
      { label: "Structure, wiring & installation", value: `${rsK(inp.bosCostPerKw)} / kW` },
      { label: "Maintenance", value: `${rsK(OM_PER_KW)} / kW / year` },
      { label: "Inverter replacement", value: `Year ${INVERTER_REPLACEMENT_YEAR}` },
      { label: "Battery replacement", value: `Every ${batteryLife(finalBattery)} years` },
      { label: "Equipment prices as of", value: cat.asOf },
    ],
  };
}
