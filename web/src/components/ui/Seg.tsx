"use client";

import type { ReactNode } from "react";

export interface SegOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

/** Segmentovaný přepínač (stav, typ slevy, DPH…). */
export function Seg<T extends string | number>({
  options, value, onChange, label, full, disabled,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  full?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`seg${full ? " full" : ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={disabled}
          className={o.value === value ? "on" : ""}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
