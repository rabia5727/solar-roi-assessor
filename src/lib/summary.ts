import type { Results } from "./types";
import { bill, num, pct, rsShort, years } from "./format";

export type Lang = "en" | "ur";

/** The only facts the AI is allowed to use — all pre-calculated. */
export function summaryFacts(r: Results) {
  const s = (id: string) => r.scenarios.find((x) => x.id === id)!;
  const view = (id: string) => {
    const x = s(id);
    return {
      option: x.name,
      batteryKwh: x.batteryKwh,
      cost: rsShort(x.capex),
      avgMonthlyBillBefore: rsShort(x.year1.billBefore / 12),
      avgMonthlyBillAfter: bill(x.year1.billAfter / 12),
      firstYearSavings: rsShort(x.year1.savings),
      payback: years(x.paybackYears),
      savings25Years: rsShort(x.savings25),
      npvTodayMoney: rsShort(x.npv),
      returnPerYear: x.irr === null ? "n/a" : pct(x.irr),
      solarCoversUsage: pct(x.year1.solarShare),
      backupHoursForEssentialLoad: x.batteryKwh > 0 ? num(x.backupHours, 1) : "none",
    };
  };
  return {
    customer: r.inputs.customerName || null,
    location: r.inputs.locationName,
    averageMonthlyUnits: Math.round(r.scenarios[0].months.reduce((a, m) => a + m.consumption, 0) / 12),
    tariffPerUnit: `Rs ${r.inputs.tariff}`,
    exportRatePerUnit: `Rs ${r.inputs.buybackRate}`,
    systemKw: num(r.system.kwp, 2),
    panels: `${r.system.panels} × ${r.inputs.panelWatt} W`,
    tilt: `${r.system.tiltDeg}° facing south`,
    annualGenerationUnits: num(r.system.annualGeneration),
    generationVsUsage: pct(r.system.coverage),
    essentialLoadKw: r.inputs.essentialLoadKw,
    bestOptionByLongTermValue: s(r.bestScenario).name,
    equipment: (() => {
      const e = r.equipment;
      const p = e.panels.find((x) => x.selected)!;
      const v = e.inverters.find((x) => x.selected)!;
      const b = e.batteries.find((x) => x.selected)!;
      return {
        panels: `${p.brand} ${p.model}`,
        panelPrice: `Rs ${p.pricePerW} per watt`,
        inverter: v.brand,
        inverterWarranty: v.warranty,
        battery: `${b.brand} ${b.model}`,
        batteryLife: `${b.lifeYears} years`,
        choseAutomatically: e.auto.panel && e.auto.inverter && e.auto.battery,
        why:
          e.auto.panel && e.auto.inverter && e.auto.battery
            ? "Ranked by 25-year value for this exact system; near-ties go to the brand easiest to buy and service in Pakistan."
            : "Some brands were chosen by the installer; describe them as the equipment in this quote, not as the app's recommendation.",
      };
    })(),
    options: ["grid", "hybrid", "backup"].map(view),
  };
}

export function aiPrompt(facts: ReturnType<typeof summaryFacts>, lang: Lang) {
  return `You are a senior solar energy consultant in Pakistan writing the executive summary of a solar feasibility report for a customer.

FACTS (pre-calculated; these are the ONLY numbers you may use — never calculate, round differently, or invent numbers):
${JSON.stringify(facts, null, 2)}

Context you can explain: since NEPRA's 2026 net billing rules, units exported to the grid earn only the export rate, while every unit bought from the grid costs the full tariff. So using solar power yourself (directly or via a battery) is worth far more than exporting it.

Write:
1. One paragraph: the recommended system and what it will produce.
2. One paragraph comparing the three options in plain words (cost, bill reduction, payback), and which one you recommend and why. If the option with the best long-term value has a much higher upfront cost, mention the trade-off honestly.
3. One sentence naming the recommended equipment brands and why (from "equipment").
4. One short sentence on load-shedding backup.

Rules: 150–220 words total. Plain text, no headings, no markdown, no bullet symbols. Warm, confident, professional; no hype.
${lang === "ur" ? "Write in clear, simple Urdu (Urdu script, NOT Roman Urdu). Keep numbers and 'Rs' exactly as given, and use 'kW' for system size." : "Write in simple English a non-technical homeowner understands."}`;
}

export function templateSummary(r: Results, lang: Lang): string {
  const f = summaryFacts(r);
  const [g, h, b] = f.options;
  const best = f.options.find((o) => o.option === f.bestOptionByLongTermValue)!;
  if (lang === "ur") {
    return [
      `${f.location} میں ماہانہ تقریباً ${f.averageMonthlyUnits} یونٹ استعمال کے لیے ہم ${f.systemKw} kW سولر سسٹم (${f.panels} پینل، ${r.system.tiltDeg} ڈگری جنوب رُخ) تجویز کرتے ہیں۔ ناسا کے طویل مدتی سیٹلائٹ ڈیٹا کے مطابق یہ سسٹم سالانہ تقریباً ${f.annualGenerationUnits} یونٹ بجلی بنائے گا۔`,
      `آن گرڈ سسٹم کی لاگت ${g.cost} ہے، اوسط ماہانہ بل ${g.avgMonthlyBillBefore} سے کم ہو کر ${g.avgMonthlyBillAfter} رہ جائے گا اور یہ ${g.payback} میں اپنی قیمت پوری کر لے گا۔ ہائبرڈ (${h.batteryKwh} kWh بیٹری) کی لاگت ${h.cost} اور واپسی ${h.payback} ہے، جبکہ فل بیک اپ (${b.batteryKwh} kWh) کی لاگت ${b.cost} اور واپسی ${b.payback} ہے۔ نیپرا کے 2026 کے نیٹ بلنگ قوانین کے بعد گرڈ کو بیچی گئی بجلی صرف ${f.exportRatePerUnit} فی یونٹ میں جاتی ہے جبکہ خریدی گئی بجلی ${f.tariffPerUnit} کی پڑتی ہے، اس لیے اپنی سولر بجلی خود استعمال کرنا زیادہ فائدہ مند ہے۔ 25 سال کی مجموعی قدر کے لحاظ سے ${best.option} بہترین آپشن ہے۔`,
      `${f.equipment.choseAutomatically ? "تجویز کردہ سامان" : "اس کوٹیشن میں شامل سامان"}: ${f.equipment.panels} پینل، ${f.equipment.inverter} انورٹر، اور ${f.equipment.battery} بیٹری۔${f.equipment.choseAutomatically ? " یہ برانڈز اس سسٹم کے لیے 25 سال کی بہترین قدر کی بنیاد پر منتخب کیے گئے ہیں۔" : ""}`,
      `لوڈشیڈنگ کے دوران فل بیک اپ آپشن ${f.essentialLoadKw} kW ضروری لوڈ کو تقریباً ${b.backupHoursForEssentialLoad} گھنٹے چلا سکتا ہے۔`,
    ].join("\n\n");
  }
  return [
    `For ${f.customer ? `${f.customer}'s property` : "a property"} in ${f.location} using about ${f.averageMonthlyUnits} units a month, we recommend a ${f.systemKw} kW system (${f.panels} panels, tilted ${f.tilt}). NASA's long-term satellite data shows it will produce about ${f.annualGenerationUnits} units a year.`,
    `The on-grid option costs ${g.cost}, brings the average monthly bill down from ${g.avgMonthlyBillBefore} to ${g.avgMonthlyBillAfter}, and pays for itself in ${g.payback}. Adding a ${h.batteryKwh} kWh battery (Hybrid, ${h.cost}) pays back in ${h.payback}; Full backup with ${b.batteryKwh} kWh (${b.cost}) pays back in ${b.payback}. Under NEPRA's 2026 net billing rules, exported units earn only ${f.exportRatePerUnit} while units you buy cost ${f.tariffPerUnit}, so storing your own solar power for the evening pays off. Over 25 years, ${best.option} gives the best overall value (${best.npvTodayMoney} in today's money).`,
    f.equipment.choseAutomatically
      ? `Recommended equipment: ${f.equipment.panels} panels, a ${f.equipment.inverter} inverter and ${f.equipment.battery} batteries, chosen for the best 25-year value for this system.`
      : `Equipment in this quote: ${f.equipment.panels} panels, a ${f.equipment.inverter} inverter and ${f.equipment.battery} batteries.`,
    `During load-shedding, Full backup can keep ${f.essentialLoadKw} kW of essential load running for about ${b.backupHoursForEssentialLoad} hours.`,
  ].join("\n\n");
}
