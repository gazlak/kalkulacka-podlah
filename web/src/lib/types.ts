export type Role = "user" | "admin";
export type UserStatus = "aktivní" | "pozván" | "blokován";
export type CalcStatus = "koncept" | "odesláno" | "přijato" | "zamítnuto";

export interface Profile {
  name: string;
  company: string;
  ico: string;
  phone: string;
  logo: string | null;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  lockedUntil: number | null;
  profile: Profile;
}

export interface Pattern {
  id: number;
  name: string;
  texture: TextureKind;
  tint: string;
  photo: string | null;
  materialPerM2: number;
  wastePct: number;
  laborPerTread: number;
}

export type TextureKind = "planks" | "herringbone" | "parquet" | "stone" | "laminate";

export interface ExtraRate {
  key: string;
  label: string;
  unit: string;
  price: number;
}

export interface Rates {
  riserSurcharge: number;
  transport: number;
  vatDefault: number;
  vatOptions: number[];
  roundTo: number;
  extrasEnabled: boolean;
  extras: ExtraRate[];
}

/** Ceník = vzory + sazby. Uložená kalkulace drží jeho snapshot. */
export interface Pricing {
  patterns: Pattern[];
  rates: Rates;
}

/** Hodnoty polí jsou řetězce, dokud je uživatel edituje (čárka, prázdné pole…). */
export interface StairGroup {
  width: number | string;
  depth: number | string;
  riserHeight: number | string;
  count: number | string;
  coverRiser: boolean;
}

export interface Discount {
  type: "pct" | "czk";
  value: number | string;
}

export interface Job {
  name: string;
  customer: string;
  address: string;
  note: string;
}

export interface Calculation {
  id: string;
  ownerId: string;
  number: string | null;
  createdAt: number;
  updatedAt: number;
  status: CalcStatus;
  sentTo: string | null;
  job: Job;
  groups: StairGroup[];
  patternId: number | null;
  discount: Discount;
  vatRate: number;
  extras: Record<string, number | string>;
  snapshot: Pricing | null;
}

export interface Quote {
  areas: number[];
  totalArea: number;
  treads: number;
  riserTreads: number;
  wastePct: number;
  material: number;
  labor: number;
  risers: number;
  transport: number;
  extras: number;
  subtotal: number;
  discountAmount: number;
  base: number;
  vat: number;
  total: number;
}
