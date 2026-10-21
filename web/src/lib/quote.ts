import { computeQuote, findPattern, n0, num } from "./calc";
import { formatCZK } from "./calc";
import type { Calculation, Pricing, Quote } from "./types";

/** Cena kalkulace: uložená drží snapshot ceníku, koncept používá aktuální. */
export const pricingOf = (c: Calculation, current: Pricing): Pricing => c.snapshot ?? current;

/** Chyba zadané slevy (nebo prázdný řetězec). */
export function discountError(c: Calculation, pricing: Pricing): string {
  const raw = String(c.discount.value ?? "");
  if (raw.trim() === "") return "";
  const v = num(raw);
  if (isNaN(v) || v < 0) return "Zadejte číslo 0 nebo větší";
  if (c.discount.type === "pct" && v > 100) return "Sleva v % musí být 0–100";
  if (c.discount.type === "czk") {
    const sub = computeQuote(c.groups, c.patternId, pricing, { type: "czk", value: 0 }, c.vatRate, c.extras).subtotal;
    if (v > sub) return `Sleva nesmí být vyšší než cena (${formatCZK(sub)})`;
  }
  return "";
}

/** Při chybné slevě se sleva neuplatní. */
export function quoteOf(c: Calculation, current: Pricing): Quote {
  const pr = pricingOf(c, current);
  const discount = discountError(c, pr) ? { type: c.discount.type, value: 0 } : c.discount;
  return computeQuote(c.groups, c.patternId, pr, discount, c.vatRate, c.extras);
}

function priceKey(p: Pricing): string {
  return JSON.stringify([
    p.patterns.map((x) => [x.id, x.name, x.materialPerM2, x.wastePct, x.laborPerTread]),
    p.rates.riserSurcharge, p.rates.transport, p.rates.roundTo, p.rates.extrasEnabled, p.rates.extras,
  ]);
}

/** Ceník se od uložení kalkulace změnil. */
export function priceChanged(c: Calculation, current: Pricing): boolean {
  return !!c.snapshot && priceKey(c.snapshot) !== priceKey(current);
}

export const patternOf = (c: Calculation, current: Pricing) => findPattern(pricingOf(c, current), c.patternId);

export { n0 };
