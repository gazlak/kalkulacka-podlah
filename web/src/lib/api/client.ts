/* Rozhraní API klienta. Dnes ho implementuje mock nad localStorage (./mock),
 * zítra stejné rozhraní implementuje fetch('/api/…') nad Route Handlers + PostgreSQL. */
import type { Calculation, CalcStatus, Pattern, Pricing, Profile, Rates, Role, User } from "../types";

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; error: string; lockedUntil?: number };

export type TokenCheck = { ok: true; email: string } | { ok: false; error: string };

export interface MailPreview {
  to: string;
  subject: string;
  /** Odkaz v aplikaci (jen v mocku se zobrazuje jako „otevřít odkaz (demo)“). */
  link: string;
  kind: "reset" | "invite";
  expiresInfo: string;
}

export interface SendMailInput {
  to: string;
  subject: string;
  body: string;
}

export interface PatternPatch {
  name: string;
  materialPerM2: number;
  wastePct: number;
  laborPerTread: number;
  /** undefined = beze změny, null = výchozí textura, string = data URL fotky */
  photo?: string | null;
}

export interface Api {
  auth: {
    me(): Promise<User | null>;
    login(input: { email: string; password: string; remember: boolean }): Promise<LoginResult>;
    logout(): Promise<void>;
    requestReset(email: string, simulateExpired: boolean): Promise<MailPreview | null>;
    checkToken(token: string, type: "reset" | "invite"): Promise<TokenCheck>;
    resetPassword(token: string, password: string): Promise<void>;
    acceptInvite(token: string, password: string, name: string): Promise<void>;
  };
  calculations: {
    /** Jen kalkulace, které smí aktuální uživatel vidět (admin všechny). */
    list(): Promise<Calculation[]>;
    get(id: string): Promise<Calculation | null>;
    /** Nová nepersistovaná kalkulace s výchozími hodnotami. */
    draft(): Promise<Calculation>;
    save(c: Calculation): Promise<Calculation>;
    /** Přidělí číslo RRRR-NNNN a uzamkne ceník (snapshot), pokud ještě není. */
    finalize(id: string): Promise<Calculation>;
    /** Přepočet podle aktuálního ceníku. */
    recalc(id: string): Promise<Calculation>;
    setStatus(id: string, status: CalcStatus): Promise<Calculation>;
    duplicate(id: string): Promise<Calculation>;
    send(id: string, mail: SendMailInput): Promise<Calculation>;
  };
  pricing: {
    current(): Promise<Pricing>;
  };
  patterns: {
    list(): Promise<Pattern[]>;
    update(id: number, patch: PatternPatch): Promise<Pattern>;
  };
  rates: {
    get(): Promise<Rates>;
    update(r: Rates): Promise<Rates>;
  };
  users: {
    list(): Promise<User[]>;
    /** Vrací uživatele a náhled pozvánky. */
    invite(email: string, role: Role): Promise<{ user: User; mail: MailPreview }>;
    resendInvite(id: string): Promise<MailPreview>;
    setRole(id: string, role: Role): Promise<User>;
    block(id: string): Promise<User>;
    unblock(id: string): Promise<User>;
    /** Majitelé kalkulací (název firmy v seznamu pro admina). */
    lookup(id: string): Promise<User | null>;
  };
  profile: {
    update(p: Profile): Promise<User>;
  };
  /** Jen mock: vrátí ukázková data. */
  dev?: { reset(): Promise<void> };
}
