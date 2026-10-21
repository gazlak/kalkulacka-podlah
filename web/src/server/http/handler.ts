import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { config } from "../config";
import { getCtx, type Actor, type Ctx } from "../ctx";
import { HttpError, forbidden, unauthorized } from "../errors";
import { userBySession } from "../services/auth";

export const SESSION_COOKIE = "kp_session";

export interface Req {
  req: NextRequest;
  ctx: Ctx;
  /** Přihlášený uživatel (u auth: "none" může být null). */
  user: Actor;
  params: Record<string, string>;
}

type Auth = "none" | "user" | "admin";
type Handler<T> = (r: Omit<Req, "user"> & { user: Actor | null }) => Promise<T>;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** Ochrana před CSRF: změny stavu jen ze stejného původu (navíc SameSite=Lax cookie). */
function checkOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw forbidden("Neplatný původ požadavku");
  if (origin && new URL(origin).host !== req.headers.get("host")) throw forbidden("Neplatný původ požadavku");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Neplatný požadavek");
  }
}

/** Obal Route Handleru: autentizace/autorizace, CSRF, JSON odpověď a překlad chyb. */
export function route<T>(auth: Auth, handler: Handler<T>) {
  return async (req: NextRequest, rc: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      checkOrigin(req);
      const ctx = getCtx();
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      const row = auth === "none" && !token ? null : await userBySession(ctx.db, token);
      const user: Actor | null = row ? { id: row.id, role: row.role } : null;
      if (auth !== "none") {
        if (!user) throw unauthorized();
        if (auth === "admin" && user.role !== "admin") throw forbidden("Jen pro správce");
      }
      const out = await handler({ req, ctx, user, params: await rc.params });
      return out instanceof Response ? out : Response.json(out === undefined ? { ok: true } : out);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return Response.json({ error: "Interní chyba serveru" }, { status: 500 });
    }
  };
}

/** Typovaná varianta pro přihlášené. */
export const userRoute = <T,>(h: (r: Req) => Promise<T>, auth: "user" | "admin" = "user") =>
  route(auth, (r) => h(r as Req));

export async function setSessionCookie(token: string, expiresAt: Date, remember: boolean) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: config.isProd(), path: "/",
    ...(remember ? { expires: expiresAt } : {}),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
