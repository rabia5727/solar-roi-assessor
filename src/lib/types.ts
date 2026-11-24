export type Installer = {
  name: string;
  phone: string;
  logoUrl: string;
  color: string;
};

export type Inputs = {
  customerName: string;
  locationName: string;
  lat: number;
  lon: number;
  /** Average monthly units (kWh) */
  monthlyUnits: number;
  /** Optional: units for Jan..Dec (from bill history). 0 = unknown */
  monthlyHistory: number[] | null;
  /** Apply typical Pakistani summer/winter usage pattern when no history */
  seasonal: boolean;
  /** Effective rate the customer pays per unit, Rs/kWh */
  tariff: number;
  sanctionedLoadKw: number;
  roofLengthM: number;
  roofWidthM: number;
  /** Share of usage during sunlight hours, 0..1 */
  daytimeShare: number;
  /** Load kept running during load-shedding, kW */
  essentialLoadKw: number;
  /** "auto" = recommended, or a brand id from equipment.ts */
  panelBrand: string;
  inverterBrand: string;
  batteryBrand: string;
  /** Structure, wiring, protection, installation & approvals, Rs per kW */
  bosCostPerKw: number;
  /** Optional price override for an explicitly chosen panel, Rs/W */
  panelPriceOverride: number | null;
  /** Optional price override for an explicitly chosen battery, Rs/kWh */
  batteryPriceOverride: number | null;
  buybackRate: number;
  tariffEscalation: number;
  discountRate: number;
  panelWatt: number;
  /** null = auto (optimal for latitude) */
  tiltDeg: number | null;
  installer: Installer;
};

export type SolarData = {
  lat: number;
  lon: number;
  /** All-sky horizontal irradiance, kWh/m²/day, Jan..Dec */
  ghi: number[];
  /** Mean air temperature at 2 m, °C */
  t2m: number[];
  /** Mean daily max temperature at 2 m, °C */
  t2mMax: number[];
  period: string;
  source: string;
};

export type MonthRow = {
  month: string;
  consumption: number;
  generation: number;
  selfUse: number;
  batteryUse: number;
  exported: number;
  imported: number;
  billBefore: number;
  billAfter: number;
};

export type ScenarioId = "grid" | "hybrid" | "backup";

export type Scenario = {
  id: ScenarioId;
  name: string;
  tagline: string;
  batteryKwh: number;
  capex: number;
  capexBreakdown: { label: string; amount: number }[];
  months: MonthRow[];
  year1: {
    generation: number;
    selfUse: number;
    exported: number;
    imported: number;
    billBefore: number;
    billAfter: number;
    savings: number;
    solarShare: number;
  };
  cashflows: number[];
  cumulative: number[];
  npv: number;
  irr: number | null;
  paybackYears: number | null;
  savings25: number;
  backupHours: number;
  co2Tons25: number;
};

export type Layout = {
  cols: number;
  rows: number;
  panelW: number;
  panelL: number;
  rowPitch: number;
  setback: number;
  roofL: number;
  roofW: number;
  maxPanels: number;
};

export type PanelOption = {
  id: string;
  brand: string;
  model: string;
  tech: string;
  tier: string;
  pricePerW: number;
  priceRange: [number, number];
  priceSource: string;
  warranty: string;
  note: string;
  panelCost: number;
  systemCost: number;
  annualGeneration: number;
  paybackYears: number | null;
  npv: number;
  recommended: boolean;
  selected: boolean;
};

export type InverterOption = {
  id: string;
  brand: string;
  tier: string;
  onGridPrice: number;
  hybridPrice: number;
  priceSource: string;
  warranty: string;
  note: string;
  npv: number;
  recommended: boolean;
  selected: boolean;
};

export type BatteryOption = {
  id: string;
  brand: string;
  model: string;
  tier: string;
  modules: number;
  kwh: number;
  cost: number;
  pricePerKwh: number;
  priceSource: string;
  /** Lifetime cost per unit stored, Rs/kWh */
  costPerStoredUnit: number;
  cycles: number;
  lifeYears: number;
  warranty: string;
  note: string;
  npv: number;
  paybackYears: number | null;
  recommended: boolean;
  selected: boolean;
};

export type Equipment = {
  asOf: string;
  rankedBy: string;
  selected: { panel: string; inverter: string; battery: string };
  auto: { panel: boolean; inverter: boolean; battery: boolean };
  panels: PanelOption[];
  inverters: InverterOption[];
  batteries: BatteryOption[];
};

export type Results = {
  inputs: Inputs;
  solar: SolarData;
  system: {
    panels: number;
    kwp: number;
    tiltDeg: number;
    annualGeneration: number;
    specificYield: number;
    coverage: number;
    performanceRatio: number;
    limitedBy: "roof" | "sanctioned" | "economics";
  };
  layout: Layout;
  monthlyIrradiance: { month: string; horizontal: number; tilted: number; tempLossPct: number }[];
  scenarios: Scenario[];
  bestScenario: ScenarioId;
  equipment: Equipment;
  assumptions: { label: string; value: string }[];
};
