/* Čisté výpočetní funkce (bez DOM). Port prototyp/calc.js 1:1.
 *   A = š · (h + v · p) / 10 000 · n
 *   C = ΣA · (1 + r) · c_m + Σn · (c_n + p · c_p) + c_d
 */
import type { Discount, Pattern, Pricing, Quote, Rates, StairGroup } from "./types";

export type Raw = number | string | null | undefined;

export function num(v: Raw): number {
  if (v === null || v === undefined || v === "") return NaN;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : NaN;
}

export function n0(v: Raw): number {
  const n = num(v);
  return isNaN(n) ? 0 : n;
}

export function roundTo(x: number, step = 1): number {
  return Math.round(x / (step || 1)) * (step || 1);
}

/** Plocha jedné skupiny v m²; š=šířka, h=hloubka nášlapu, v=výška podstupnice, p=obkládat podstupnici, n=počet. */
export function groupArea(g: StairGroup): number {
  const p = g.coverRiser ? 1 : 0;
  return (n0(g.width) * (n0(g.depth) + n0(g.riserHeight) * p)) / 10000 * n0(g.count);
}

export function findPattern(pricing: Pricing, patternId: number | null): Pattern | null {
  return pricing.patterns.find((p) => p.id === patternId) ?? null;
}

export function computeExtras(extras: Record<string, Raw> | undefined, rates: Rates): number {
  if (!rates.extrasEnabled || !extras) return 0;
  return (rates.extras ?? []).reduce((sum, e) => sum + n0(extras[e.key]) * n0(e.price), 0);
}

export function computeQuote(
  groups: StairGroup[],
  patternId: number | null,
  pricing: Pricing,
  discount: Discount | undefined,
  vatRate: number,
  extras?: Record<string, Raw>,
): Quote {
  const pat = findPattern(pricing, patternId);
  const rates = pricing.rates;
  const step = rates.roundTo || 1;
  const areas = groups.map(groupArea);
  const totalArea = areas.reduce((a, b) => a + b, 0);
  let treads = 0;
  let riserTreads = 0;
  groups.forEach((g) => {
    const n = n0(g.count);
    treads += n;
    if (g.coverRiser) riserTreads += n;
  });
  const waste = pat ? pat.wastePct / 100 : 0;
  const materialRaw = pat ? totalArea * (1 + waste) * pat.materialPerM2 : 0;
  const material = roundTo(materialRaw, step);
  const labor = pat ? roundTo(treads * pat.laborPerTread, step) : 0;
  const risers = roundTo(riserTreads * rates.riserSurcharge, step);
  const transport = roundTo(rates.transport, step);
  const extrasTotal = roundTo(computeExtras(extras, rates), step);
  const subtotal = material + labor + risers + transport + extrasTotal;
  const d = discount ?? { type: "pct", value: 0 };
  const dv = n0(d.value);
  let discountAmount = d.type === "czk" ? dv : (subtotal * dv) / 100;
  discountAmount = Math.min(subtotal, Math.max(0, roundTo(discountAmount, step)));
  const base = subtotal - discountAmount;
  const vat = roundTo(base * vatRate, step);
  return {
    areas, totalArea, treads, riserTreads,
    wastePct: pat ? pat.wastePct : 0,
    material, labor, risers, transport, extras: extrasTotal,
    subtotal, discountAmount, base, vat, total: base + vat,
  };
}

export function comparePatterns(
  groups: StairGroup[],
  pricing: Pricing,
  discount: Discount | undefined,
  vatRate: number,
  extras?: Record<string, Raw>,
) {
  return pricing.patterns.map((pattern) => ({
    pattern,
    quote: computeQuote(groups, pattern.id, pricing, discount, vatRate, extras),
  }));
}

const czk = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const m2 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });

/** Nezlomitelné mezery místo běžných, aby se cena nelámala na řádku. */
export function formatCZK(x: number): string {
  return czk.format(x).replace(/\s/g, " ");
}
export function formatM2(x: number): string {
  return m2.format(x) + " m²";
}
export function formatPct(v: number): string {
  return pctFmt.format(v * 100) + " %";
}

export type GroupErrors = Partial<Record<"width" | "depth" | "riserHeight" | "count", string>>;

/** Validace polí skupiny; prázdný objekt = OK. */
export function validateGroup(g: StairGroup): GroupErrors {
  const e: GroupErrors = {};
  const fields = [
    ["width", "Šířka"],
    ["depth", "Hloubka nášlapu"],
    ["riserHeight", "Výška podstupnice"],
  ] as const;
  for (const [key, label] of fields) {
    const raw = g[key];
    const v = num(raw);
    if (raw === "" || raw === null || raw === undefined || isNaN(v)) e[key] = "Vyplňte číslo 1–500 cm";
    else if (v < 1 || v > 500) e[key] = `${label} musí být 1–500 cm`;
  }
  const c = num(g.count);
  if (g.count === "" || g.count === null || g.count === undefined || isNaN(c)) e.count = "Vyplňte počet 1–100 ks";
  else if (c !== Math.floor(c)) e.count = "Počet musí být celé číslo";
  else if (c < 1 || c > 100) e.count = "Počet musí být 1–100 ks";
  return e;
}
