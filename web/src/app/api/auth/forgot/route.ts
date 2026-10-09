import { z } from "zod";
import { clientIp, readJson, route } from "@/server/http/handler";
import { rateLimited } from "@/server/ratelimit";
import { requestReset } from "@/server/services/auth";

export const POST = route("none", async ({ req, ctx }) => {
  const p = z.object({ email: z.string().max(254) }).safeParse(await readJson(req));
  // odpověď je stejná vždy (i při překročení limitu a neexistujícím účtu)
  if (p.success && !rateLimited(`forgot:${clientIp(req)}`, 10, 60 * 60_000)) await requestReset(ctx, p.data.email);
  return null;
});
