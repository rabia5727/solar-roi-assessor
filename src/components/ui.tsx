"use client";

import { ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className={inputCls + (suffix ? " pr-16" : "")}
        value={Number.isFinite(value) ? value : ""}
        step={step}
        min={min}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-stone-500">{suffix}</span>
      )}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      className={inputCls}
      value={String(value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ step, title, sub }: { step?: string; title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-800">
        {step && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-white">{step}</span>
        )}
        {title}
      </h3>
      {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
    </div>
  );
}
