import { and, desc, eq, sql } from "drizzle-orm";
import type { SendMailInput } from "@/lib/api/client";
import { calcInputSchema, sendMailSchema, statusSchema } from "@/lib/schemas";
import type { CalcStatus, Calculation } from "@/lib/types";
import type { Actor, Ctx } from "../ctx";
import type { Db } from "../db";
import { calculations, counters, mailLog } from "../db/schema";
import { badRequest, forbidden, notFound } from "../errors";
import { toCalc } from "../mappers";
import { calcMail } from "../mail/templates";
import { currentPricing, getRates } from "./pricing";

const READONLY = "Kalkulace je jen ke čtení";
type Row = typeof calculations.$inferSelect;
const canSee = (a: Actor, c: Row) => a.role === "admin" || c.ownerId === a.id;

export async function listCalcs(db: Db, a: Actor): Promise<Calculation[]> {
  const q = db.select().from(calculations).orderBy(desc(calculations.updatedAt));
  const rows = a.role === "admin" ? await q : await q.where(eq(calculations.ownerId, a.id));
  return rows.map(toCalc);
}

async function find(db: Db, id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select().from(calculations).where(eq(calculations.id, id));
  return r ?? null;
}

export async function getCalc(db: Db, a: Actor, id: string): Promise<Calculation | null> {
  const r = await find(db, id);
  return r && canSee(a, r) ? toCalc(r) : null;
}

async function visible(db: Db, a: Actor, id: string): Promise<Row> {
  const r = await find(db, id);
  if (!r || !canSee(a, r)) throw notFound("Kalkulace nenalezena");
  return r;
}

/** Zápis smí jen vlastník (admin cizí kalkulace jen čte). */
async function writable(db: Db, a: Actor, id: string): Promise<Row> {
  const r = await visible(db, a, id);
  if (r.ownerId !== a.id) throw forbidden(READONLY);
  return r;
}

export async function draftCalc(db: Db, a: Actor): Promise<Calculation> {
  const rates = await getRates(db);
  const now = Date.now();
  return {
    id: crypto.randomUUID(), ownerId: a.id, number: null, createdAt: now, updatedAt: now, status: "koncept", sentTo: null,
    job: { name: "", customer: "", address: "", note: "" },
    groups: [{ width: 100, depth: 28, riserHeight: 17, count: 1, coverRiser: true }],
    patternId: null, discount: { type: "pct", value: 0 }, vatRate: rates.vatDefault, extras: {}, snapshot: null,
  };
}

export async function saveCalc(db: Db, a: Actor, input: unknown): Promise<Calculation> {
  const p = calcInputSchema.safeParse(input);
  if (!p.success) throw badRequest(p.error.issues[0].message);
  const c = p.data;
  const cur = await find(db, c.id);
  if (cur && cur.ownerId !== a.id) throw forbidden(READONLY);
  if (c.patternId !== null) {
    const pr = await currentPricing(db);
    if (!pr.patterns.some((x) => x.id === c.patternId)) throw badRequest("Neznámý vzor");
  }
  const fields = { job: c.job, groups: c.groups, patternId: c.patternId, discount: c.discount, vatRate: c.vatRate, extras: c.extras, updatedAt: new Date() };
  // číslo, snapshot, vlastník, stav a odeslání spravuje server
  const [row] = cur
    ? await db.update(calculations).set(fields).where(eq(calculations.id, c.id)).returning()
    : await db.insert(calculations).values({ id: c.id, ownerId: a.id, ...fields }).returning();
  return toCalc(row);
}

/** Další číslo RRRR-NNNN; atomické (UPSERT s inkrementací řádku roku uvnitř transakce). */
async function nextNumber(tx: Db, year: number): Promise<string> {
  const [r] = await tx
    .insert(counters)
    .values({ year, last: 1 })
    .onConflictDoUpdate({ target: counters.year, set: { last: sql`${counters.last} + 1` } })
    .returning({ last: counters.last });
  return `${year}-${String(r.last).padStart(4, "0")}`;
}

export async function finalizeCalc(db: Db, a: Actor, id: string): Promise<Calculation> {
  await writable(db, a, id);
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(calculations).where(eq(calculations.id, id)).for("update");
    if (r.number) return toCalc(r);
    const number = await nextNumber(tx as unknown as Db, new Date().getFullYear());
    const snapshot = await currentPricing(tx as unknown as Db);
    const [row] = await tx.update(calculations).set({ number, snapshot, updatedAt: new Date() }).where(eq(calculations.id, id)).returning();
    return toCalc(row);
  });
}

export async function recalcCalc(db: Db, a: Actor, id: string): Promise<Calculation> {
  await writable(db, a, id);
  const snapshot = await currentPricing(db);
  const [row] = await db.update(calculations).set({ snapshot, updatedAt: new Date() }).where(eq(calculations.id, id)).returning();
  return toCalc(row);
}

export async function setCalcStatus(db: Db, a: Actor, id: string, status: CalcStatus): Promise<Calculation> {
  const s = statusSchema.safeParse(status);
  if (!s.success) throw badRequest("Neplatný stav");
  await writable(db, a, id);
  const [row] = await db.update(calculations).set({ status: s.data, updatedAt: new Date() }).where(eq(calculations.id, id)).returning();
  return toCalc(row);
}

export async function duplicateCalc(db: Db, a: Actor, id: string): Promise<Calculation> {
  const src = await visible(db, a, id);
  const rates = await getRates(db);
  const [row] = await db
    .insert(calculations)
    .values({
      ownerId: a.id, job: { ...src.job, name: src.job.name + " (kopie)" }, groups: src.groups, patternId: src.patternId,
      discount: src.discount, vatRate: rates.vatDefault, extras: src.extras,
    })
    .returning();
  return toCalc(row);
}

export async function sendCalc(ctx: Ctx, a: Actor, id: string, mail: SendMailInput): Promise<Calculation> {
  const p = sendMailSchema.safeParse(mail);
  if (!p.success) throw badRequest(p.error.issues[0].message);
  const { db } = ctx;
  const r = await writable(db, a, id);
  if (!r.number) throw badRequest("Kalkulace není uložena");
  const to = p.data.to.trim();
  const pdf = await ctx.renderPdf(toCalc(r));
  let ok = true;
  try {
    await ctx.mailer.send(calcMail(to, p.data.subject, p.data.body, pdf, `kalkulace-${r.number}.pdf`));
  } catch (e) {
    ok = false;
    console.error("[mail] odeslání kalkulace selhalo:", (e as Error).message);
  }
  await db.insert(mailLog).values({ calculationId: r.id, userId: a.id, toAddress: to, subject: p.data.subject, ok });
  if (!ok) throw badRequest("E-mail se nepodařilo odeslat. Zkuste to prosím znovu.");
  const [row] = await db
    .update(calculations)
    .set({ sentTo: to, status: "odesláno", updatedAt: new Date() })
    .where(and(eq(calculations.id, id)))
    .returning();
  return toCalc(row);
}
