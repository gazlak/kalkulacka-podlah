import { describe, expect, it } from "vitest";
import { comparePatterns, computeQuote, formatCZK, groupArea, num, validateGroup } from "./calc";
import { SEED_PATTERNS, SEED_RATES } from "./api/mock/seed";
import type { Pricing, StairGroup } from "./types";

const pricing: Pricing = { patterns: SEED_PATTERNS, rates: SEED_RATES };
const g = (over: Partial<StairGroup> = {}): StairGroup => ({
  width: 100, depth: 30, riserHeight: 18, count: 10, coverRiser: true, ...over,
});

describe("kontrolní příklad z README", () => {
  it("100×30, podstupnice 18, 10 ks, vzor 1 → 17 887 Kč", () => {
    const q = computeQuote([g()], 1, pricing, { type: "pct", value: 0 }, 0.21);
    expect(q.base).toBe(14783);
    expect(q.vat).toBe(3104);
    expect(q.total).toBe(17887);
  });
  it("bez obkladu podstupnice → 9 927 Kč bez DPH (README)", () => {
    const q = computeQuote([g({ coverRiser: false })], 1, pricing, { type: "pct", value: 0 }, 0.21);
    expect(q.base).toBe(9927);
    expect(q.total).toBe(12012);
  });
});

describe("výpočty", () => {
  it("plocha skupiny", () => {
    expect(groupArea(g())).toBeCloseTo(4.8, 5);
    expect(groupArea(g({ coverRiser: false }))).toBeCloseTo(3, 5);
  });
  it("sleva v Kč a v % nepřekročí mezisoučet", () => {
    const a = computeQuote([g()], 1, pricing, { type: "czk", value: 999999 }, 0.21);
    expect(a.base).toBe(0);
    const b = computeQuote([g()], 1, pricing, { type: "pct", value: 10 }, 0.21);
    expect(b.discountAmount).toBe(Math.round(b.subtotal * 0.1));
    expect(b.total).toBe(b.base + b.vat);
  });
  it("příplatky se počítají jen když jsou zapnuté", () => {
    const off = computeQuote([g()], 1, pricing, undefined, 0.21, { edges: 10 });
    expect(off.extras).toBe(0);
    const on = computeQuote([g()], 1, { ...pricing, rates: { ...SEED_RATES, extrasEnabled: true } }, undefined, 0.21, { edges: 10 });
    expect(on.extras).toBe(1800);
  });
  it("porovnání vrací 6 vzorů", () => {
    expect(comparePatterns([g()], pricing, undefined, 0.21)).toHaveLength(6);
  });
  it("zaokrouhlení na 10 Kč", () => {
    const q = computeQuote([g()], 1, { ...pricing, rates: { ...SEED_RATES, roundTo: 10 } }, undefined, 0.21);
    expect(q.total % 10).toBe(0);
  });
});

describe("pomocné funkce", () => {
  it("num parsuje čárku a mezery", () => {
    expect(num("1 234,5")).toBe(1234.5);
    expect(num("")).toBeNaN();
    expect(num("abc")).toBeNaN();
  });
  it("validateGroup", () => {
    expect(validateGroup(g())).toEqual({});
    expect(validateGroup(g({ width: "" })).width).toBeDefined();
    expect(validateGroup(g({ width: 501 })).width).toBeDefined();
    expect(validateGroup(g({ count: 1.5 })).count).toBe("Počet musí být celé číslo");
    expect(validateGroup(g({ count: 101 })).count).toBeDefined();
  });
  it("formatCZK", () => {
    expect(formatCZK(17887).replace(/\s/g, " ")).toBe("17 887 Kč");
  });
});
