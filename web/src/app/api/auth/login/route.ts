import { loginSchema } from "@/lib/schemas";
import { HttpError } from "@/server/errors";
import { clientIp, readJson, route, setSessionCookie } from "@/server/http/handler";
import { rateLimited } from "@/server/ratelimit";
import { login } from "@/server/services/auth";

export const POST = route("none", async ({ req, ctx }) => {
  if (rateLimited(`login:${clientIp(req)}`, 60, 15 * 60_000)) throw new HttpError(429, "Příliš mnoho pokusů, zkuste to později.");
  const p = loginSchema.safeParse(await readJson(req));
  if (!p.success) return { ok: false, error: "Vyplňte e-mail i heslo." };
  const { result, session } = await login(ctx.db, p.data);
  if (session) await setSessionCookie(session.token, session.expiresAt, session.remember);
  return result;
});
