import { registerSchema } from "@/lib/schemas";
import { badRequest, HttpError } from "@/server/errors";
import { clientIp, readJson, route } from "@/server/http/handler";
import { rateLimited } from "@/server/ratelimit";
import { register } from "@/server/services/auth";

export const POST = route("none", async ({ req, ctx }) => {
  if (rateLimited(`register:${clientIp(req)}`, 10, 60 * 60_000)) throw new HttpError(429, "Příliš mnoho pokusů, zkuste to později.");
  const body = (await readJson(req)) as Record<string, unknown> | null;
  const p = registerSchema.safeParse({ ...body, pw: body?.password, pw2: body?.password, terms: true });
  if (!p.success) throw badRequest(p.error.issues[0].message);
  return register(ctx, { company: p.data.company, ico: p.data.ico, name: p.data.name, email: p.data.email, password: p.data.pw });
});
