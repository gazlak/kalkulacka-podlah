/* HTTP implementace rozhraní Api nad Route Handlery (/api/…). Chyby serveru se mění na Error(message) jako v mocku. */
import type { Calculation, Pricing, Pattern, Rates, User } from "../../types";
import type { Api, LoginResult, MailPreview, TokenCheck } from "../client";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Server není dostupný. Zkontrolujte připojení.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Chyba serveru (${res.status})`);
  return data as T;
}

const get = <T,>(u: string) => request<T>("GET", u);
const post = <T,>(u: string, b?: unknown) => request<T>("POST", u, b ?? {});
const put = <T,>(u: string, b: unknown) => request<T>("PUT", u, b);
const enc = encodeURIComponent;

export const httpApi: Api = {
  auth: {
    me: () => get<User | null>("/api/auth/me"),
    login: (input) => post<LoginResult>("/api/auth/login", input),
    logout: async () => { await post("/api/auth/logout"); },
    requestReset: async (email) => { await post("/api/auth/forgot", { email }); return null; },
    checkToken: (token, type) => post<TokenCheck>("/api/auth/token", { token, type }),
    resetPassword: async (token, password) => { await post("/api/auth/reset", { token, password }); },
    acceptInvite: async (token, password, name) => { await post("/api/auth/invite", { token, password, name }); },
  },
  calculations: {
    list: () => get<Calculation[]>("/api/calculations"),
    get: (id) => get<Calculation | null>(`/api/calculations/${enc(id)}`),
    draft: () => get<Calculation>("/api/calculations/draft"),
    save: (c) => put<Calculation>(`/api/calculations/${enc(c.id)}`, c),
    finalize: (id) => post<Calculation>(`/api/calculations/${enc(id)}/finalize`),
    recalc: (id) => post<Calculation>(`/api/calculations/${enc(id)}/recalc`),
    setStatus: (id, status) => post<Calculation>(`/api/calculations/${enc(id)}/status`, { status }),
    duplicate: (id) => post<Calculation>(`/api/calculations/${enc(id)}/duplicate`),
    send: (id, mail) => post<Calculation>(`/api/calculations/${enc(id)}/send`, mail),
  },
  pricing: { current: () => get<Pricing>("/api/pricing") },
  patterns: {
    list: () => get<Pattern[]>("/api/patterns"),
    update: (id, patch) => put<Pattern>(`/api/patterns/${id}`, patch),
  },
  rates: {
    get: () => get<Rates>("/api/rates"),
    update: (r) => put<Rates>("/api/rates", r),
  },
  users: {
    list: () => get<User[]>("/api/users"),
    invite: (email, role) => post<{ user: User; mail: MailPreview }>("/api/users", { email, role }),
    resendInvite: (id) => post<MailPreview>(`/api/users/${enc(id)}/resend-invite`),
    setRole: (id, role) => post<User>(`/api/users/${enc(id)}/role`, { role }),
    block: (id) => post<User>(`/api/users/${enc(id)}/block`),
    unblock: (id) => post<User>(`/api/users/${enc(id)}/unblock`),
    lookup: (id) => get<User | null>(`/api/users/${enc(id)}`),
  },
  profile: { update: (p) => put<User>("/api/profile", p) },
};
