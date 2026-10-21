import { sql } from "drizzle-orm";
import { hashPassword } from "./crypto";
import type { Db } from "./db";
import { calculations, counters, patterns, rates, users } from "./db/schema";
import { SEED_CALCS, SEED_PATTERNS, SEED_RATES, SEED_USERS } from "@/lib/api/mock/seed";

/** Ukázková data jako v mocku (demo účty, ceník, 5 kalkulací). Idempotentní jen na prázdné DB. */
export async function seed(db: Db, now = Date.now()): Promise<void> {
  await db.transaction(async (tx0) => {
    const tx = tx0 as unknown as Db;
    await tx.insert(patterns).values(
      SEED_PATTERNS.map((p) => ({
        id: p.id, name: p.name, texture: p.texture, tint: p.tint, materialPerM2: p.materialPerM2, wastePct: p.wastePct, laborPerTread: p.laborPerTread,
      })),
    ).onConflictDoNothing();
    await tx.insert(rates).values({ id: 1, ...SEED_RATES }).onConflictDoNothing();

    const ids = new Map<string, string>();
    for (const u of SEED_USERS) {
      const [row] = await tx
        .insert(users)
        .values({
          email: u.email, passwordHash: await hashPassword(u.password), role: u.role, status: "aktivní",
          name: u.profile.name, company: u.profile.company, ico: u.profile.ico, phone: u.profile.phone,
        })
        .onConflictDoUpdate({ target: users.email, set: { role: u.role } })
        .returning({ id: users.id });
      ids.set(u.id, row.id);
    }

    const [existing] = await tx.select({ n: sql<number>`count(*)::int` }).from(calculations);
    if (existing.n > 0) return;
    for (const c of SEED_CALCS) {
      const t = new Date(now - c.daysAgo * 86400000 - (c.daysAgo ? 3600000 * 2 : 0));
      await tx.insert(calculations).values({
        ownerId: ids.get(c.ownerId)!, number: c.number, status: c.status, sentTo: c.sentTo, job: c.job, groups: c.groups,
        patternId: c.patternId, discount: c.discount, vatRate: c.vatRate, extras: {},
        snapshot: c.number ? { patterns: SEED_PATTERNS, rates: SEED_RATES } : null, createdAt: t, updatedAt: t,
      });
    }
    // řada čísel pokračuje za nejvyšším seedovaným číslem
    const byYear = new Map<number, number>();
    for (const c of SEED_CALCS) {
      if (!c.number) continue;
      const [y, n] = c.number.split("-").map(Number);
      byYear.set(y, Math.max(byYear.get(y) ?? 0, n));
    }
    for (const [year, last] of byYear) await tx.insert(counters).values({ year, last }).onConflictDoUpdate({ target: counters.year, set: { last } });
  });
}
