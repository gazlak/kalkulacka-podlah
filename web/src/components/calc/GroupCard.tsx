"use client";

import { formatM2, groupArea, type GroupErrors } from "@/lib/calc";
import { Icon } from "@/components/ui/Icon";
import type { StairGroup } from "@/lib/types";

type Field = "width" | "depth" | "riserHeight" | "count";

export function GroupCard({
  g, index, total, collapsed, errors, onToggle, onChange, onBlur, onCover, onDelete,
}: {
  g: StairGroup;
  index: number;
  total: number;
  collapsed: boolean;
  /** Jen chyby, které se mají zobrazit (po opuštění pole / pokusu o pokračování). */
  errors: GroupErrors;
  onToggle: () => void;
  onChange: (f: Field, v: string) => void;
  onBlur: (f: Field) => void;
  onCover: (v: boolean) => void;
  onDelete: () => void;
}) {
  const i = index;
  const unitField = (f: Exclude<Field, "count">, label: string) => (
    <div className="field">
      <label htmlFor={`g${i}${f}`}>{label}</label>
      <div className="inline-unit">
        <input
          type="text" id={`g${i}${f}`} inputMode="decimal" autoComplete="off" value={String(g[f])}
          className={errors[f] ? "invalid" : undefined} aria-invalid={errors[f] ? true : undefined}
          onChange={(e) => onChange(f, e.target.value)} onBlur={() => onBlur(f)}
        />
        <span>cm</span>
      </div>
      <div className="err">{errors[f]}</div>
    </div>
  );
  const step = (d: number) => {
    const cur = parseFloat(String(g.count).replace(",", "."));
    const v = Math.min(100, Math.max(1, (isNaN(cur) ? 0 : Math.floor(cur)) + d));
    onChange("count", String(v));
  };

  return (
    <div className={`card group-card${collapsed ? " collapsed" : ""}`}>
      <div className="gh">
        <button type="button" className="fold" onClick={onToggle} aria-expanded={!collapsed}>
          <Icon name="chev-d" size="sm" />
          <span>
            <h2>Skupina {i + 1}</h2>
            <span className="sum">{String(g.width)} × {String(g.depth)} cm · {String(g.count)} ks</span>
          </span>
        </button>
        {total > 1 && (
          <button type="button" className="btn sm sq danger" onClick={onDelete} aria-label={`Odstranit skupinu ${i + 1}`}>
            <Icon name="trash" />
          </button>
        )}
      </div>
      <div className="gbody">
        <div className="group-grid">
          {unitField("width", "Šířka")}
          {unitField("depth", "Hloubka nášlapu")}
          {unitField("riserHeight", "Výška podstupnice")}
          <div className="field">
            <label htmlFor={`g${i}count`}>Počet schodů</label>
            <div className="stepper-num">
              <button type="button" onClick={() => step(-1)} aria-label="Ubrat schod"><Icon name="minus" /></button>
              <input
                type="text" id={`g${i}count`} inputMode="numeric" autoComplete="off" value={String(g.count)}
                className={errors.count ? "invalid" : undefined} aria-invalid={errors.count ? true : undefined}
                onChange={(e) => onChange("count", e.target.value)} onBlur={() => onBlur("count")}
              />
              <button type="button" onClick={() => step(1)} aria-label="Přidat schod"><Icon name="plus" /></button>
            </div>
            <div className="err">{errors.count}</div>
          </div>
        </div>
        <label className="check">
          <span>Obkládat podstupnici</span>
          <input type="checkbox" checked={g.coverRiser} onChange={(e) => onCover(e.target.checked)} />
        </label>
        <div className="group-area">
          <span className="muted small">Plocha skupiny</span>
          <span className="chip soft"><span>{formatM2(groupArea(g))}</span></span>
        </div>
      </div>
    </div>
  );
}
