/* Seed data (vymyšlená ukázková data) – převzato z prototyp/data.js. */
import type { Calculation, Pattern, Rates, StairGroup, Discount, Job, CalcStatus } from "../../types";

export const SEED_PATTERNS: Pattern[] = [
  { id: 1, name: "Dub přírodní", texture: "planks", tint: "#c9a266", photo: null, materialPerM2: 1190, wastePct: 10, laborPerTread: 450 },
  { id: 2, name: "Dub bělený", texture: "planks", tint: "#e3d3b6", photo: null, materialPerM2: 1290, wastePct: 10, laborPerTread: 450 },
  { id: 3, name: "Ořech americký", texture: "parquet", tint: "#6b4631", photo: null, materialPerM2: 1690, wastePct: 12, laborPerTread: 520 },
  { id: 4, name: "Rybí kost dub", texture: "herringbone", tint: "#b98a4e", photo: null, materialPerM2: 1890, wastePct: 15, laborPerTread: 650 },
  { id: 5, name: "Vinyl kámen", texture: "stone", tint: "#9a9890", photo: null, materialPerM2: 790, wastePct: 8, laborPerTread: 380 },
  { id: 6, name: "Laminát šedý", texture: "laminate", tint: "#8d9094", photo: null, materialPerM2: 590, wastePct: 8, laborPerTread: 350 },
];

export const SEED_RATES: Rates = {
  riserSurcharge: 250,
  transport: 1500,
  vatDefault: 0.21,
  vatOptions: [0.21, 0.12],
  roundTo: 1,
  extrasEnabled: false,
  extras: [
    { key: "edges", label: "Schodové hrany", unit: "bm", price: 180 },
    { key: "trims", label: "Lišty", unit: "bm", price: 120 },
    { key: "removal", label: "Demontáž starého krytu", unit: "nášlap", price: 90 },
    { key: "leveling", label: "Vyrovnání podkladu", unit: "nášlap", price: 110 },
  ],
};

export interface SeedUser {
  id: string;
  email: string;
  password: string;
  role: "user" | "admin";
  profile: { name: string; company: string; ico: string; phone: string; logo: null };
}

export const SEED_USERS: SeedUser[] = [
  { id: "u1", email: "admin@demo.cz", password: "admin1234", role: "admin",
    profile: { name: "Eva Admínová", company: "Podlahy Admin s.r.o.", ico: "12345678", phone: "+420 601 000 001", logo: null } },
  { id: "u2", email: "novak@demo.cz", password: "heslo1234", role: "user",
    profile: { name: "Jan Novák", company: "Novák – podlahy a schody", ico: "87654321", phone: "+420 602 111 222", logo: null } },
  { id: "u3", email: "svoboda@demo.cz", password: "heslo1234", role: "user",
    profile: { name: "Petr Svoboda", company: "Svoboda Parkety", ico: "11223344", phone: "+420 603 333 444", logo: null } },
];

interface SeedCalc {
  id: string;
  ownerId: string;
  number: string | null;
  daysAgo: number;
  status: CalcStatus;
  sentTo: string | null;
  job: Job;
  groups: StairGroup[];
  patternId: number | null;
  discount: Discount;
  vatRate: number;
}

export const SEED_CALCS: SeedCalc[] = [
  { id: "c1", ownerId: "u2", number: "2026-0039", daysAgo: 12, status: "přijato", sentTo: "dvorak@example.cz",
    job: { name: "Rodinný dům Dvořákovi", customer: "Karel Dvořák", address: "Lipová 12, Brno", note: "" },
    groups: [{ width: 90, depth: 28, riserHeight: 17, count: 12, coverRiser: true }], patternId: 1, discount: { type: "pct", value: 5 }, vatRate: 0.21 },
  { id: "c2", ownerId: "u2", number: "2026-0041", daysAgo: 3, status: "odesláno", sentTo: "horakova@example.cz",
    job: { name: "Byt Horákovi – vstupní schodiště", customer: "Marie Horáková", address: "Nádražní 5, Praha", note: "Zákazník chce tmavší odstín" },
    groups: [{ width: 100, depth: 30, riserHeight: 18, count: 10, coverRiser: true }, { width: 120, depth: 30, riserHeight: 18, count: 2, coverRiser: false }],
    patternId: 3, discount: { type: "czk", value: 500 }, vatRate: 0.21 },
  { id: "c3", ownerId: "u2", number: null, daysAgo: 0, status: "koncept", sentTo: null,
    job: { name: "Rozpracovaná zakázka – Černý", customer: "Tomáš Černý", address: "", note: "" },
    groups: [{ width: 85, depth: 27, riserHeight: 16, count: 14, coverRiser: true }], patternId: null, discount: { type: "pct", value: 0 }, vatRate: 0.21 },
  { id: "c4", ownerId: "u3", number: "2026-0040", daysAgo: 5, status: "zamítnuto", sentTo: "prochazka@example.cz",
    job: { name: "Chata Procházkovi", customer: "Ivan Procházka", address: "Horní Lhota 44", note: "" },
    groups: [{ width: 80, depth: 26, riserHeight: 19, count: 8, coverRiser: true }], patternId: 5, discount: { type: "pct", value: 0 }, vatRate: 0.12 },
  { id: "c5", ownerId: "u1", number: "2026-0038", daysAgo: 20, status: "odesláno", sentTo: "admin-zakaznik@example.cz",
    job: { name: "Showroom – ukázkové schodiště", customer: "Interiéry Plus", address: "Průmyslová 1, Ostrava", note: "" },
    groups: [{ width: 110, depth: 32, riserHeight: 17, count: 6, coverRiser: true }], patternId: 4, discount: { type: "pct", value: 10 }, vatRate: 0.21 },
];

export function seedCalculations(now: number): Calculation[] {
  return SEED_CALCS.map((c) => {
    const { daysAgo, ...rest } = c;
    const t = now - daysAgo * 86400000 - (daysAgo ? 3600000 * 2 : 0);
    return {
      ...structuredClone(rest),
      extras: {},
      createdAt: t,
      updatedAt: t,
      snapshot: c.number ? structuredClone({ patterns: SEED_PATTERNS, rates: SEED_RATES }) : null,
    };
  });
}
