"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Scenario } from "@/lib/types";
import { num, rsShort } from "@/lib/format";

export const SCENARIO_COLORS: Record<string, string> = { grid: "#d97706", hybrid: "#0f766e", backup: "#4338ca" };

const compact = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(1)} Cr`;
  if (a >= 1e5) return `${s}${Math.round(a / 1e5)} L`;
  return `${s}${Math.round(a / 1000)}k`;
};

const axis = { fontSize: 11, fill: "#78716c" };

export function MonthlyEnergyChart({ scenario }: { scenario: Scenario }) {
  const data = scenario.months.map((m) => ({
    month: m.month,
    "Solar generation": Math.round(m.generation),
    "Your usage": Math.round(m.consumption),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
        <Tooltip formatter={(v) => `${num(Number(v))} units`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Solar generation" fill="#f59e0b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="Your usage" fill="#57534e" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashflowChart({ scenarios }: { scenarios: Scenario[] }) {
  const data = scenarios[0].cumulative.map((_, year) => {
    const row: Record<string, number> = { year };
    scenarios.forEach((s) => (row[s.name] = Math.round(s.cumulative[year])));
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="year" tick={axis} tickLine={false} axisLine={false} label={{ value: "Year", position: "insideBottomRight", offset: -2, fontSize: 11, fill: "#78716c" }} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={compact} />
        <Tooltip formatter={(v) => rsShort(Number(v))} labelFormatter={(y) => `Year ${y}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="#a8a29e" strokeDasharray="4 4" />
        {scenarios.map((s) => (
          <Line key={s.id} type="monotone" dataKey={s.name} stroke={SCENARIO_COLORS[s.id]} strokeWidth={2.2} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
