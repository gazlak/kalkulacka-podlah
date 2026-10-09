/* Mock implementace API nad localStorage (stejná seed data jako prototyp).
 * Serverové chování (autorizace, číslování, snapshot ceníku, blokace) je tu záměrně
 * simulované tak, aby ho později převzal backend beze změny UI. */
import type { Calculation, Pricing, Role, User } from "../../types";
import type { Api, LoginResult, MailPreview } from "../client";
import { SEED_PATTERNS, SEED_RATES, SEED_USERS, seedCalculations } from "./seed";

const DB_KEY = "kp_next_db_v1";
const SESSION_KEY = "kp_next_session_v1";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const DAY = 86400000;

interface StoredUser extends User {
  password: string;
  failedAttempts: number;
}
interface Token {
  type: "reset" | "invite";
  userId: string;
  expires: number;
}
interface Db {
  patterns: Pricing["patterns"];
  rates: Pricing["rates"];
  users: StoredUser[];
  tokens: Record<string, Token>;
  calculations: Calculation[];
}

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const uid = (p: string) => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const wait = () => Promise.resolve();

function seed(): Db {
  return {
    patterns: clone(SEED_PATTERNS),
    rates: clone(SEED_RATES),
    users: SEED_USERS.map((u) => ({
      id: u.id, email: u.email, password: u.password, role: u.role, status: "aktivní" as const,
      failedAttempts: 0, lockedUntil: null, profile: clone(u.profile),
    })),
    tokens: {},
    calculations: seedCalculations(Date.now()),
  };
}

let db: Db | null = null;
function load(): Db {
  if (db) return db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed?.users) return (db = parsed);
    }
  } catch { /* poškozená data */ }
  db = seed();
  save();
  return db;
}
function save(): boolean {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}
function commit() {
  if (!save()) throw new Error("Uložení se nepodařilo (plné úložiště?) – zkuste menší obrázek");
}

/* ---------- session ---------- */
function setSession(userId: string, remember: boolean) {
  clearSession();
  const s = JSON.stringify({ userId, expires: Date.now() + 30 * DAY });
  try { (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, s); } catch { /* ignore */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
function sessionUser(): StoredUser | null {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as { userId: string; expires: number };
    if (!s.expires || s.expires < Date.now()) { clearSession(); return null; }
    const u = load().users.find((x) => x.id === s.userId);
    if (!u || u.status !== "aktivní") { clearSession(); return null; }
    return u;
  } catch {
    return null;
  }
}
function requireUser(): StoredUser {
  const u = sessionUser();
  if (!u) throw new Error("Nepřihlášen");
  return u;
}
function requireAdmin(): StoredUser {
  const u = requireUser();
  if (u.role !== "admin") throw new Error("Jen pro správce");
  return u;
}

const pub = (u: StoredUser): User => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, failedAttempts, ...rest } = u;
  return clone(rest);
};
const canSee = (u: User, c: Calculation) => u.role === "admin" || c.ownerId === u.id;
const currentPricing = (): Pricing => clone({ patterns: load().patterns, rates: load().rates });

function nextNumber(ts: number): string {
  const y = new Date(ts).getFullYear();
  let max = 0;
  for (const c of load().calculations)
    if (c.number?.startsWith(y + "-")) max = Math.max(max, parseInt(c.number.slice(5), 10) || 0);
  return `${y}-${String(max + 1).padStart(4, "0")}`;
}

function makeToken(type: Token["type"], userId: string, ttl: number): string {
  const t = uid("t") + uid("");
  load().tokens[t] = { type, userId, expires: Date.now() + ttl };
  commit();
  return t;
}

function findOwned(id: string): Calculation {
  const u = requireUser();
  const c = load().calculations.find((x) => x.id === id);
  if (!c || !canSee(u, c)) throw new Error("Kalkulace nenalezena");
  return c;
}
/** Zápis smí jen vlastník (admin cizí kalkulace jen čte). */
function findOwnedWritable(id: string): Calculation {
  const c = findOwned(id);
  if (c.ownerId !== requireUser().id) throw new Error("Kalkulace je jen ke čtení");
  return c;
}

function inviteMail(u: StoredUser): MailPreview {
  const tok = makeToken("invite", u.id, 7 * DAY);
  return { to: u.email, subject: "Pozvánka do Kalkulačky schodů", link: `/invite/${tok}`, kind: "invite", expiresInfo: "Odkaz platí 7 dní." };
}

export const mockApi: Api = {
  auth: {
    async me() {
      await wait();
      const u = sessionUser();
      return u ? pub(u) : null;
    },
    async login({ email, password, remember }): Promise<LoginResult> {
      await wait();
      const e = email.trim().toLowerCase();
      if (!e || !password) return { ok: false, error: "Vyplňte e-mail i heslo." };
      const u = load().users.find((x) => x.email.toLowerCase() === e);
      if (!u) return { ok: false, error: "Nesprávný e-mail nebo heslo." };
      if (u.lockedUntil && u.lockedUntil > Date.now()) return { ok: false, error: "locked", lockedUntil: u.lockedUntil };
      if (u.status === "blokován") return { ok: false, error: "Účet je zablokovaný. Kontaktujte správce." };
      if (u.status === "pozván") return { ok: false, error: "Registrace ještě není dokončena – použijte odkaz z pozvánky." };
      if (u.password !== password) {
        u.failedAttempts = (u.failedAttempts || 0) + 1;
        if (u.failedAttempts >= MAX_ATTEMPTS) {
          u.lockedUntil = Date.now() + LOCK_MS;
          u.failedAttempts = 0;
          save();
          return { ok: false, error: "locked", lockedUntil: u.lockedUntil };
        }
        save();
        return { ok: false, error: `Nesprávný e-mail nebo heslo. Zbývá pokusů: ${MAX_ATTEMPTS - u.failedAttempts}.` };
      }
      u.failedAttempts = 0;
      u.lockedUntil = null;
      save();
      setSession(u.id, remember);
      return { ok: true, user: pub(u) };
    },
    async logout() {
      clearSession();
    },
    async requestReset(email, simulateExpired) {
      await wait();
      const e = email.trim().toLowerCase();
      const u = load().users.find((x) => x.email.toLowerCase() === e);
      if (!u || u.status !== "aktivní") return null;
      const tok = makeToken("reset", u.id, simulateExpired ? -1000 : 3600000);
      return { to: u.email, subject: "Obnovení hesla – Kalkulačka schodů", link: `/reset/${tok}`, kind: "reset", expiresInfo: "Odkaz platí 1 hodinu." };
    },
    async checkToken(token, type) {
      await wait();
      const k = load().tokens[token];
      if (!k || k.type !== type) return { ok: false, error: "Odkaz je neplatný." };
      if (k.expires < Date.now()) return { ok: false, error: "Platnost odkazu vypršela." };
      const u = load().users.find((x) => x.id === k.userId);
      if (!u) return { ok: false, error: "Odkaz je neplatný." };
      return { ok: true, email: u.email };
    },
    async resetPassword(token, password) {
      const k = load().tokens[token];
      const u = k && load().users.find((x) => x.id === k.userId);
      if (!k || k.type !== "reset" || k.expires < Date.now() || !u) throw new Error("Odkaz je neplatný.");
      u.password = password;
      u.failedAttempts = 0;
      u.lockedUntil = null;
      delete load().tokens[token];
      commit();
    },
    async acceptInvite(token, password, name) {
      const k = load().tokens[token];
      const u = k && load().users.find((x) => x.id === k.userId);
      if (!k || k.type !== "invite" || k.expires < Date.now() || !u) throw new Error("Pozvánka není platná.");
      u.password = password;
      u.status = "aktivní";
      if (name.trim()) u.profile.name = name.trim();
      delete load().tokens[token];
      commit();
    },
  },

  calculations: {
    async list() {
      await wait();
      const u = requireUser();
      return clone(load().calculations.filter((c) => canSee(u, c)));
    },
    async get(id) {
      await wait();
      const u = sessionUser();
      const c = load().calculations.find((x) => x.id === id);
      return u && c && canSee(u, c) ? clone(c) : null;
    },
    async draft() {
      const u = requireUser();
      const now = Date.now();
      return {
        id: uid("c"), ownerId: u.id, number: null, createdAt: now, updatedAt: now, status: "koncept", sentTo: null,
        job: { name: "", customer: "", address: "", note: "" },
        groups: [{ width: 100, depth: 28, riserHeight: 17, count: 1, coverRiser: true }],
        patternId: null, discount: { type: "pct", value: 0 }, vatRate: load().rates.vatDefault, extras: {}, snapshot: null,
      };
    },
    async save(c) {
      const u = requireUser();
      const list = load().calculations;
      const i = list.findIndex((x) => x.id === c.id);
      if (i >= 0) {
        if (list[i].ownerId !== u.id) throw new Error("Kalkulace je jen ke čtení");
        // číslo, snapshot, vlastník a stav spravuje „server“
        list[i] = { ...clone(c), ownerId: u.id, number: list[i].number, snapshot: list[i].snapshot, status: list[i].status, sentTo: list[i].sentTo, createdAt: list[i].createdAt, updatedAt: Date.now() };
      } else {
        list.push({ ...clone(c), ownerId: u.id, number: null, snapshot: null, status: "koncept", sentTo: null, updatedAt: Date.now() });
      }
      commit();
      return clone(list[i >= 0 ? i : list.length - 1]);
    },
    async finalize(id) {
      const c = findOwnedWritable(id);
      if (!c.number) {
        c.number = nextNumber(Date.now());
        c.snapshot = currentPricing();
      }
      c.updatedAt = Date.now();
      commit();
      return clone(c);
    },
    async recalc(id) {
      const c = findOwnedWritable(id);
      c.snapshot = currentPricing();
      c.updatedAt = Date.now();
      commit();
      return clone(c);
    },
    async setStatus(id, status) {
      const c = findOwnedWritable(id);
      c.status = status;
      c.updatedAt = Date.now();
      commit();
      return clone(c);
    },
    async duplicate(id) {
      const src = findOwned(id);
      const u = requireUser();
      const now = Date.now();
      const n: Calculation = {
        ...clone(src), id: uid("c"), ownerId: u.id, number: null, snapshot: null, status: "koncept", sentTo: null,
        createdAt: now, updatedAt: now, vatRate: load().rates.vatDefault,
      };
      n.job.name += " (kopie)";
      load().calculations.push(n);
      commit();
      return clone(n);
    },
    async send(id, mail) {
      const c = findOwnedWritable(id);
      if (!c.number) throw new Error("Kalkulace není uložena");
      c.sentTo = mail.to.trim();
      c.status = "odesláno";
      c.updatedAt = Date.now();
      commit();
      return clone(c);
    },
  },

  pricing: {
    async current() {
      await wait();
      requireUser();
      return currentPricing();
    },
  },

  patterns: {
    async list() {
      await wait();
      requireUser();
      return clone(load().patterns);
    },
    async update(id, patch) {
      requireAdmin();
      const p = load().patterns.find((x) => x.id === id);
      if (!p) throw new Error("Vzor nenalezen");
      p.name = patch.name;
      p.materialPerM2 = patch.materialPerM2;
      p.wastePct = patch.wastePct;
      p.laborPerTread = patch.laborPerTread;
      if (patch.photo !== undefined) p.photo = patch.photo;
      commit();
      return clone(p);
    },
  },

  rates: {
    async get() {
      await wait();
      requireUser();
      return clone(load().rates);
    },
    async update(r) {
      requireAdmin();
      load().rates = clone(r);
      commit();
      return clone(r);
    },
  },

  users: {
    async list() {
      await wait();
      requireAdmin();
      return load().users.map(pub);
    },
    async invite(email, role: Role) {
      requireAdmin();
      const mail = email.trim();
      if (load().users.some((x) => x.email.toLowerCase() === mail.toLowerCase())) throw new Error("Uživatel s tímto e-mailem už existuje");
      const u: StoredUser = {
        id: uid("u"), email: mail, password: "", role, status: "pozván", failedAttempts: 0, lockedUntil: null,
        profile: { name: "", company: "", ico: "", phone: "", logo: null },
      };
      load().users.push(u);
      commit();
      return { user: pub(u), mail: inviteMail(u) };
    },
    async resendInvite(id) {
      requireAdmin();
      const u = load().users.find((x) => x.id === id);
      if (!u) throw new Error("Uživatel nenalezen");
      return inviteMail(u);
    },
    async setRole(id, role) {
      const me = requireAdmin();
      const u = load().users.find((x) => x.id === id);
      if (!u || u.id === me.id) throw new Error("Vlastní roli změnit nelze");
      u.role = role;
      commit();
      return pub(u);
    },
    async block(id) {
      const me = requireAdmin();
      const u = load().users.find((x) => x.id === id);
      if (!u || u.id === me.id) throw new Error("Sebe zablokovat nelze");
      u.status = "blokován";
      commit();
      return pub(u);
    },
    async unblock(id) {
      requireAdmin();
      const u = load().users.find((x) => x.id === id);
      if (!u) throw new Error("Uživatel nenalezen");
      if (u.status === "blokován") u.status = "aktivní";
      u.lockedUntil = null;
      u.failedAttempts = 0;
      commit();
      return pub(u);
    },
    async lookup(id) {
      await wait();
      requireUser();
      const u = load().users.find((x) => x.id === id);
      return u ? pub(u) : null;
    },
  },

  profile: {
    async update(p) {
      const u = requireUser();
      u.profile = clone(p);
      commit();
      return pub(u);
    },
  },

  dev: {
    async reset() {
      db = seed();
      commit();
    },
  },
};
