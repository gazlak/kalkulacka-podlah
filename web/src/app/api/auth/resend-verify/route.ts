import { z } from "zod";
import { HttpError } from "@/server/errors";
import { clientIp, readJson, route } from "@/server/http/handler";
import { rateLimited } from "@/server/ratelimit";
import { resendVerify } from "@/server/services/auth";

export const POST = route("none", async ({ req, ctx }) => {
  if (rateLimited(`verify:${clientIp(req)}`, 10, 60 * 60_000)) throw new HttpError(429, "Příliš mnoho pokusů, zkuste to později.");
  const p = z.object({ email: z.string().max(200) }).safeParse(await readJson(req));
  return p.success ? resendVerify(ctx, p.data.email) : null;
});
