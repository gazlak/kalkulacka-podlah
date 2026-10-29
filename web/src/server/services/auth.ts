import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { LoginResult, MailPreview, RegisterInput, TokenCheck, TokenType } from "@/lib/api/client";
import { passwordSchema } from "@/lib/schemas";
import type { User } from "@/lib/types";
import { config } from "../config";
import { hashPassword, randomToken, sha256, verifyPassword } from "../crypto";
import type { Ctx } from "../ctx";
import type { Db } from "../db";
import { sessions, tokens, users } from "../db/schema";
import { badRequest } from "../errors";
import { toUser } from "../mappers";
import { accountExistsMail, inviteMail, resetMail, verifyMail } from "../mail/templates";

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
  // jen se správným heslem: jinak by šlo zjišťovat, které e-maily čekají na ověření
  if (u.status === "neověřen") return { result: { ok: false, error: "unverified" } };

  await db.update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, u.id));
  const session = await createSession(db, u.id, input.remember);
  return { result: { ok: true, user: toUser({ ...u, failedAttempts: 0, lockedUntil: null }) }, session };
}

/* ---------- tokeny (reset hesla, pozvánka) ---------- */

async function issueToken(db: Db, type: TokenType, userId: string, ttlMs: number): Promise<string> {
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

async function findToken(db: Db, token: string, type: TokenType) {
  const [row] = await db
    .select({ t: tokens, u: users })
    .from(tokens)
    .innerJoin(users, eq(users.id, tokens.userId))
    .where(and(eq(tokens.hash, sha256(token)), eq(tokens.type, type)));
  return row ?? null;
}

export async function checkToken(db: Db, token: string, type: TokenType): Promise<TokenCheck> {
  const row = await findToken(db, token, type);
  if (!row || row.t.usedAt) return { ok: false, error: "Odkaz je neplatný." };
  if (row.t.expiresAt.getTime() < Date.now()) return { ok: false, error: "Platnost odkazu vypršela." };
  return { ok: true, email: row.u.email };
}

/** Atomicky spotřebuje token; vrací uživatele, nebo null (neplatný/použitý/expirovaný). */
async function consumeToken(db: Db, token: string, type: TokenType) {
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

/* ---------- registrace a ověření e-mailu ---------- */

async function sendVerify(ctx: Ctx, u: UserRow) {
  const token = await issueToken(ctx.db, "verify", u.id, config.verifyTtlMs);
  void sendSafely(ctx, verifyMail(u.email, `${config.appUrl()}/verify/${token}`));
}

/**
 * Veřejná registrace podlaháře. Odpověď je vždy stejná, ať e-mail účet má, nebo ne:
 * nový e-mail dostane ověřovací odkaz, neověřený nový odkaz (heslo se nemění) a existující účet upozornění.
 */
export async function register(ctx: Ctx, input: RegisterInput): Promise<null> {
  checkPassword(input.password);
  const email = input.email.trim().toLowerCase();
  const [existing] = await ctx.db.select().from(users).where(eq(users.email, email));
  if (existing) {
    if (existing.status === "neověřen") await sendVerify(ctx, existing);
    else if (existing.status === "aktivní") {
      void sendSafely(ctx, accountExistsMail(email, `${config.appUrl()}/login`, `${config.appUrl()}/forgot`));
    }
    return null;
  }
  const [u] = await ctx.db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(input.password),
      role: "user",
      status: "neověřen",
      name: input.name.trim(),
      company: input.company.trim(),
      ico: input.ico.replace(/\s/g, ""),
    })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (u) await sendVerify(ctx, u);
  return null;
}

/** Jednorázový odkaz z e-mailu: aktivuje neověřený účet a rovnou založí relaci (bez „zapamatovat“). */
export async function verifyEmail(
  db: Db,
  token: string,
): Promise<{ result: LoginResult; session?: Awaited<ReturnType<typeof createSession>> }> {
  const userId = await consumeToken(db, token, "verify");
  if (!userId) return { result: { ok: false, error: "Odkaz je neplatný, použitý nebo vypršel." } };
  const [u] = await db
    .update(users)
    .set({ status: "aktivní" })
    .where(and(eq(users.id, userId), eq(users.status, "neověřen")))
    .returning();
  if (!u) return { result: { ok: false, error: "Účet už je ověřený, přihlaste se." } };
  const session = await createSession(db, u.id, false);
  return { result: { ok: true, user: toUser(u) }, session };
}

/** Nový ověřovací odkaz; neodpovídá, zda účet existuje. */
export async function resendVerify(ctx: Ctx, email: string): Promise<null> {
  const [u] = await ctx.db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (u && u.status === "neověřen") await sendVerify(ctx, u);
  return null;
}

/* ---------- první admin ostré instance ---------- */

/**
 * Prázdná ostrá DB nemá žádný účet. Dokud v ní není admin, založí pozvaného admina s e-mailem z ADMIN_EMAIL
 * a pošle mu pozvánku (heslo si nastaví sám, nikde se nepředává). Když e-mail neodejde (SMTP ještě není),
 * vrátí odkaz, aby ho šlo předat ručně z logu. Vrací null, když admin už existuje.
 */
export async function bootstrapAdmin(ctx: Ctx, email: string): Promise<{ email: string; link: string | null } | null> {
  const [admin] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (admin) return null;
  const normalized = email.trim().toLowerCase();
  const [u] = await ctx.db
    .insert(users)
    .values({ email: normalized, role: "admin", status: "pozván" })
    .onConflictDoUpdate({ target: users.email, set: { role: "admin" } })
    .returning();
  if (u.status !== "pozván") return { email: normalized, link: null }; // existující aktivní účet jen povýšen
  const token = await issueToken(ctx.db, "invite", u.id, config.inviteTtlMs);
  const link = `${config.appUrl()}/invite/${token}`;
  const sent = await sendSafely(ctx, inviteMail(u.email, link));
  return { email: normalized, link: sent ? null : link };
}

export type { User };
