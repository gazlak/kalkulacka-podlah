import { asc, eq } from "drizzle-orm";
import type { PatternPatch } from "@/lib/api/client";
import { patternPatchSchema, ratesSchema } from "@/lib/schemas";
import type { Pattern, Pricing, Rates } from "@/lib/types";
import type { Db } from "../db";
import { patterns, rates } from "../db/schema";
import { badRequest, notFound } from "../errors";
import { toPattern, toRates } from "../mappers";
import { resolveImage } from "./files";

export async function listPatterns(db: Db): Promise<Pattern[]> {
  return (await db.select().from(patterns).orderBy(asc(patterns.id))).map(toPattern);
}

export async function getRates(db: Db): Promise<Rates> {
  const [r] = await db.select().from(rates).where(eq(rates.id, 1));
  if (!r) throw new Error("Sazby nejsou inicializované (spusťte seed)");
  return toRates(r);
}

export async function currentPricing(db: Db): Promise<Pricing> {
  return { patterns: await listPatterns(db), rates: await getRates(db) };
}

export async function updatePattern(db: Db, id: number, patch: PatternPatch): Promise<Pattern> {
  const p = patternPatchSchema.safeParse(patch);
  if (!p.success) throw badRequest(p.error.issues[0].message);
  const [cur] = await db.select().from(patterns).where(eq(patterns.id, id));
  if (!cur) throw notFound("Vzor nenalezen");
  const photoFileId = await resolveImage(db, p.data.photo, cur.photoFileId);
  const [row] = await db
    .update(patterns)
    .set({ name: p.data.name, materialPerM2: p.data.materialPerM2, wastePct: p.data.wastePct, laborPerTread: p.data.laborPerTread, photoFileId })
    .where(eq(patterns.id, id))
    .returning();
  return toPattern(row);
}

export async function updateRates(db: Db, input: Rates): Promise<Rates> {
  const p = ratesSchema.safeParse(input);
  if (!p.success) throw badRequest(p.error.issues[0].message);
  const [row] = await db.update(rates).set(p.data).where(eq(rates.id, 1)).returning();
  return toRates(row);
}
