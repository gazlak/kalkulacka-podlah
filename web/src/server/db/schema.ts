import { sql } from "drizzle-orm";
import {
  boolean, customType, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uuid,
} from "drizzle-orm/pg-core";
import type { Discount, ExtraRate, Job, Pricing, StairGroup } from "@/lib/types";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  status: text("status", { enum: ["aktivní", "pozván", "blokován"] }).notNull().default("pozván"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: ts("locked_until"),
  name: text("name").notNull().default(""),
  company: text("company").notNull().default(""),
  ico: text("ico").notNull().default(""),
  phone: text("phone").notNull().default(""),
  logoFileId: text("logo_file_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Nahrané obrázky (logo, fotky vzorů); id = SHA-256 obsahu, takže jsou neměnné a snapshot ceníku na ně smí odkazovat navždy. */
export const files = pgTable("files", {
  id: text("id").primaryKey(),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const patterns = pgTable("patterns", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  texture: text("texture", { enum: ["planks", "herringbone", "parquet", "stone", "laminate"] }).notNull(),
  tint: text("tint").notNull(),
  photoFileId: text("photo_file_id"),
  materialPerM2: doublePrecision("material_per_m2").notNull(),
  wastePct: doublePrecision("waste_pct").notNull(),
  laborPerTread: doublePrecision("labor_per_tread").notNull(),
});

/** Jediný řádek (id = 1). */
export const rates = pgTable("rates", {
  id: integer("id").primaryKey().default(1),
  riserSurcharge: doublePrecision("riser_surcharge").notNull(),
  transport: doublePrecision("transport").notNull(),
  vatDefault: doublePrecision("vat_default").notNull(),
  vatOptions: jsonb("vat_options").$type<number[]>().notNull(),
  roundTo: doublePrecision("round_to").notNull(),
  extrasEnabled: boolean("extras_enabled").notNull().default(false),
  extras: jsonb("extras").$type<ExtraRate[]>().notNull(),
});

export const calculations = pgTable("calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  number: text("number").unique(),
  status: text("status", { enum: ["koncept", "odesláno", "přijato", "zamítnuto"] }).notNull().default("koncept"),
  sentTo: text("sent_to"),
  job: jsonb("job").$type<Job>().notNull(),
  groups: jsonb("groups").$type<StairGroup[]>().notNull(),
  patternId: integer("pattern_id"),
  discount: jsonb("discount").$type<Discount>().notNull(),
  vatRate: doublePrecision("vat_rate").notNull(),
  extras: jsonb("extras").$type<Record<string, number | string>>().notNull().default({}),
  snapshot: jsonb("snapshot").$type<Pricing>(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("calculations_owner_idx").on(t.ownerId)]);

/** Číselná řada RRRR-NNNN – jedna společná pro všechny, inkrementace v transakci. */
export const counters = pgTable("counters", {
  year: integer("year").primaryKey(),
  last: integer("last").notNull().default(0),
});

/** Jednorázové tokeny (reset hesla, pozvánka); ukládá se jen hash. */
export const tokens = pgTable("tokens", {
  hash: text("hash").primaryKey(),
  type: text("type", { enum: ["reset", "invite"] }).notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

/** Serverové relace; cookie nese náhodný token, v DB je jeho hash. */
export const sessions = pgTable("sessions", {
  hash: text("hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

/** Záznam o odeslání kalkulace zákazníkovi. */
export const mailLog = pgTable("mail_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  calculationId: uuid("calculation_id").references(() => calculations.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  ok: boolean("ok").notNull(),
  sentAt: ts("sent_at").notNull().default(sql`now()`),
});
