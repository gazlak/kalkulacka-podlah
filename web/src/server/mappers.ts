import type { Calculation, Pattern, Rates, User } from "@/lib/types";
import type { schema } from "./db";

type UserRow = typeof schema.users.$inferSelect;
type CalcRow = typeof schema.calculations.$inferSelect;
type PatternRow = typeof schema.patterns.$inferSelect;
type RatesRow = typeof schema.rates.$inferSelect;

export const fileUrl = (id: string | null) => (id ? `/api/files/${id}` : null);
export const FILE_URL_RE = /^\/api\/files\/([0-9a-f]{64})$/;

export const toUser = (u: UserRow): User => ({
  id: u.id,
  email: u.email,
  role: u.role,
  status: u.status,
  lockedUntil: u.lockedUntil && u.lockedUntil.getTime() > Date.now() ? u.lockedUntil.getTime() : null,
  profile: { name: u.name, company: u.company, ico: u.ico, phone: u.phone, logo: fileUrl(u.logoFileId) },
});

export const toCalc = (c: CalcRow): Calculation => ({
  id: c.id,
  ownerId: c.ownerId,
  number: c.number,
  createdAt: c.createdAt.getTime(),
  updatedAt: c.updatedAt.getTime(),
  status: c.status,
  sentTo: c.sentTo,
  job: c.job,
  groups: c.groups,
  patternId: c.patternId,
  discount: c.discount,
  vatRate: c.vatRate,
  extras: c.extras,
  snapshot: c.snapshot,
});

export const toPattern = (p: PatternRow): Pattern => ({
  id: p.id, name: p.name, texture: p.texture, tint: p.tint, photo: fileUrl(p.photoFileId),
  materialPerM2: p.materialPerM2, wastePct: p.wastePct, laborPerTread: p.laborPerTread,
});

export const toRates = (r: RatesRow): Rates => ({
  riserSurcharge: r.riserSurcharge, transport: r.transport, vatDefault: r.vatDefault, vatOptions: r.vatOptions,
  roundTo: r.roundTo, extrasEnabled: r.extrasEnabled, extras: r.extras,
});
