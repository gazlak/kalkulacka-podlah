import { asc, eq } from "drizzle-orm";
import type { MailPreview } from "@/lib/api/client";
import { emailSchema, profileSchema } from "@/lib/schemas";
import type { Profile, Role, User } from "@/lib/types";
import type { Actor, Ctx } from "../ctx";
import type { Db } from "../db";
import { sessions, users } from "../db/schema";
import { badRequest, notFound } from "../errors";
import { toUser } from "../mappers";
import { sendInvite } from "./auth";
import { resolveImage } from "./files";

async function row(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("Uživatel nenalezen");
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw notFound("Uživatel nenalezen");
  return u;
}

export async function listUsers(db: Db): Promise<User[]> {
  return (await db.select().from(users).orderBy(asc(users.createdAt), asc(users.email))).map(toUser);
}

export async function inviteUser(ctx: Ctx, email: string, role: Role): Promise<{ user: User; mail: MailPreview }> {
  const e = emailSchema.safeParse(email);
  if (!e.success) throw badRequest(e.error.issues[0].message);
  if (role !== "user" && role !== "admin") throw badRequest("Neplatná role");
  const addr = e.data.toLowerCase();
  const [dup] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, addr));
  if (dup) throw badRequest("Uživatel s tímto e-mailem už existuje");
  const [u] = await ctx.db.insert(users).values({ email: addr, role, status: "pozván" }).returning();
  return { user: toUser(u), mail: await sendInvite(ctx, u) };
}

export async function resendInvite(ctx: Ctx, id: string): Promise<MailPreview> {
  const u = await row(ctx.db, id);
  if (u.status !== "pozván") throw badRequest("Uživatel už registraci dokončil");
  return sendInvite(ctx, u);
}

export async function setRole(db: Db, me: Actor, id: string, role: Role): Promise<User> {
  if (role !== "user" && role !== "admin") throw badRequest("Neplatná role");
  const u = await row(db, id);
  if (u.id === me.id) throw badRequest("Vlastní roli změnit nelze");
  const [r] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
  return toUser(r);
}

export async function blockUser(db: Db, me: Actor, id: string): Promise<User> {
  const u = await row(db, id);
  if (u.id === me.id) throw badRequest("Sebe zablokovat nelze");
  const [r] = await db.update(users).set({ status: "blokován" }).where(eq(users.id, id)).returning();
  await db.delete(sessions).where(eq(sessions.userId, id));
  return toUser(r);
}

export async function unblockUser(db: Db, id: string): Promise<User> {
  const u = await row(db, id);
  const [r] = await db
    .update(users)
    .set({ status: u.status === "blokován" ? "aktivní" : u.status, lockedUntil: null, failedAttempts: 0 })
    .where(eq(users.id, id))
    .returning();
  return toUser(r);
}

/** Smí si dohledat sebe; admin kohokoli (majitel kalkulace). */
export async function lookupUser(db: Db, a: Actor, id: string): Promise<User | null> {
  if (a.role !== "admin" && a.id !== id) return null;
  try {
    return toUser(await row(db, id));
  } catch {
    return null;
  }
}

/** GDPR: smaže účet včetně kalkulací, relací a tokenů (kaskádově). */
export async function deleteUser(db: Db, me: Actor, id: string): Promise<void> {
  const u = await row(db, id);
  if (u.id === me.id) throw badRequest("Vlastní účet smazat nelze");
  await db.delete(users).where(eq(users.id, id));
}

export async function updateProfile(db: Db, a: Actor, input: Profile): Promise<User> {
  const p = profileSchema.safeParse(input);
  if (!p.success) throw badRequest(p.error.issues[0].message);
  const u = await row(db, a.id);
  const logoFileId = await resolveImage(db, p.data.logo, u.logoFileId);
  const [r] = await db
    .update(users)
    .set({ name: p.data.name, company: p.data.company, ico: p.data.ico, phone: p.data.phone, logoFileId })
    .where(eq(users.id, a.id))
    .returning();
  return toUser(r);
}
