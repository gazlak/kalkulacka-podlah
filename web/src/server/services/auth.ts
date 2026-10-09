import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { LoginResult, MailPreview, TokenCheck } from "@/lib/api/client";
import { passwordSchema } from "@/lib/schemas";
import type { User } from "@/lib/types";
import { config } from "../config";
import { hashPassword, randomToken, sha256, verifyPassword } from "../crypto";
import type { Ctx } from "../ctx";
import type { Db } from "../db";
import { sessions, tokens, users } from "../db/schema";
import { badRequest } from "../errors";
import { toUser } from "../mappers";
import { inviteMail, resetMail } from "../mail/templates";

type UserRow = typeof users.$inferSelect;

/* ---------- relace ---------- */

export async function createSession(db: Db, userId: string, remember: boolean) {
  const token = randomToken();
  const ttl = remember ? config.sessionRememberMs : config.sessionShortMs;
  const expiresAt = new Date(Date.now() + ttl);
  await db.insert(sessions).values({ hash: sha256(token), userId, expiresAt });
  return { token, expiresAt, remember };
}

export async function destroySession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.hash, sha256(token)));
}

/** Uživatel z relace (jen aktivní účty, neexpirovaná relace). */
export async function userBySession(db: Db, token: string | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const [row] = await db
    .select({ u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.hash, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row && row.u.status === "aktivní" ? row.u : null;
}

/* ---------- přihlášení ---------- */

const BAD_CREDENTIALS = "Nesprávný e-mail nebo heslo.";

export async function login(
  db: Db,
  input: { email: string; password: string; remember: boolean },
): Promise<{ result: LoginResult; session?: Awaited<ReturnType<typeof createSession>> }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return { result: { ok: false, error: "Vyplňte e-mail i heslo." } };

  const [u] = await db.select().from(users).where(eq(users.email, email));
  if (u?.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
    return { result: { ok: false, error: "locked", lockedUntil: u.lockedUntil.getTime() } };
  }
  const valid = await verifyPassword(u?.passwordHash ?? null, input.password);
  if (!u || u.status === "pozván") return { result: { ok: false, error: BAD_CREDENTIALS } };

  if (!valid) {
    // atomicky: počítadlo +1, při dosažení limitu zámek
    const [r] = await db
      .update(users)
      .set({
        failedAttempts: sql`CASE WHEN ${users.failedAttempts} + 1 >= ${config.maxAttempts} THEN 0 ELSE ${users.failedAttempts} + 1 END`,
        lockedUntil: sql`CASE WHEN ${users.failedAttempts} + 1 >= ${config.maxAttempts} THEN now() + ${config.lockMs / 1000} * interval '1 second' ELSE ${users.lockedUntil} END`,
      })
      .where(eq(users.id, u.id))
      .returning({ failed: users.failedAttempts, lockedUntil: users.lockedUntil });
    if (r.lockedUntil && r.lockedUntil.getTime() > Date.now()) {
      return { result: { ok: false, error: "locked", lockedUntil: r.lockedUntil.getTime() } };
    }
    return { result: { ok: false, error: `${BAD_CREDENTIALS} Zbývá pokusů: ${config.maxAttempts - r.failed}.` } };
  }
  if (u.status === "blokován") return { result: { ok: false, error: "Účet je zablokovaný. Kontaktujte správce." } };

  await db.update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, u.id));
  const session = await createSession(db, u.id, input.remember);
  return { result: { ok: true, user: toUser({ ...u, failedAttempts: 0, lockedUntil: null }) }, session };
}

/* ---------- tokeny (reset hesla, pozvánka) ---------- */

async function issueToken(db: Db, type: "reset" | "invite", userId: string, ttlMs: number): Promise<string> {
  const token = randomToken();
  // starší nepoužité tokeny stejného typu přestanou platit
  await db.delete(tokens).where(and(eq(tokens.userId, userId), eq(tokens.type, type)));
  await db.insert(tokens).values({ hash: sha256(token), type, userId, expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function sendSafely(ctx: Ctx, msg: Parameters<Ctx["mailer"]["send"]>[0]): Promise<boolean> {
  try {
    await ctx.mailer.send(msg);
    return true;
  } catch (e) {
    console.error("[mail] odeslání selhalo:", (e as Error).message);
    return false;
  }
}

/** Vždy bez odpovědi – výsledek nesmí prozradit, zda účet existuje. */
export async function requestReset(ctx: Ctx, email: string): Promise<null> {
  const [u] = await ctx.db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (u && u.status === "aktivní") {
    const token = await issueToken(ctx.db, "reset", u.id, config.resetTtlMs);
    void sendSafely(ctx, resetMail(u.email, `${config.appUrl()}/reset/${token}`));
  }
  return null;
}

async function findToken(db: Db, token: string, type: "reset" | "invite") {
  const [row] = await db
    .select({ t: tokens, u: users })
    .from(tokens)
    .innerJoin(users, eq(users.id, tokens.userId))
    .where(and(eq(tokens.hash, sha256(token)), eq(tokens.type, type)));
  return row ?? null;
}

export async function checkToken(db: Db, token: string, type: "reset" | "invite"): Promise<TokenCheck> {
  const row = await findToken(db, token, type);
  if (!row || row.t.usedAt) return { ok: false, error: "Odkaz je neplatný." };
  if (row.t.expiresAt.getTime() < Date.now()) return { ok: false, error: "Platnost odkazu vypršela." };
  return { ok: true, email: row.u.email };
}

/** Atomicky spotřebuje token; vrací uživatele, nebo null (neplatný/použitý/expirovaný). */
async function consumeToken(db: Db, token: string, type: "reset" | "invite") {
  const [t] = await db
    .update(tokens)
    .set({ usedAt: new Date() })
    .where(and(eq(tokens.hash, sha256(token)), eq(tokens.type, type), isNull(tokens.usedAt), gt(tokens.expiresAt, new Date())))
    .returning({ userId: tokens.userId });
  return t?.userId ?? null;
}

function checkPassword(pw: string) {
  const p = passwordSchema.safeParse(pw);
  if (!p.success) throw badRequest(p.error.issues[0].message);
}

export async function resetPassword(db: Db, token: string, password: string): Promise<void> {
  checkPassword(password);
  const userId = await consumeToken(db, token, "reset");
  if (!userId) throw badRequest("Odkaz je neplatný.");
  await db.update(users).set({ passwordHash: await hashPassword(password), failedAttempts: 0, lockedUntil: null }).where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function acceptInvite(db: Db, token: string, password: string, name: string): Promise<void> {
  checkPassword(password);
  const userId = await consumeToken(db, token, "invite");
  if (!userId) throw badRequest("Pozvánka není platná.");
  const set: Partial<typeof users.$inferInsert> = { passwordHash: await hashPassword(password), status: "aktivní" };
  if (name.trim()) set.name = name.trim();
  await db.update(users).set(set).where(and(eq(users.id, userId), eq(users.status, "pozván")));
}

export async function sendInvite(ctx: Ctx, u: UserRow): Promise<MailPreview> {
  const token = await issueToken(ctx.db, "invite", u.id, config.inviteTtlMs);
  const ok = await sendSafely(ctx, inviteMail(u.email, `${config.appUrl()}/invite/${token}`));
  if (!ok) throw badRequest("Pozvánku se nepodařilo odeslat – zkuste to znovu.");
  return { to: u.email, subject: "Pozvánka do Kalkulačky schodů", link: "", kind: "invite", expiresInfo: "Odkaz platí 7 dní." };
}

export type { User };
