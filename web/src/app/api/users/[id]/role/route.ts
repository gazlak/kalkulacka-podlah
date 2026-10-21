import { z } from "zod";
import { readJson, userRoute } from "@/server/http/handler";
import { badRequest } from "@/server/errors";
import { setRole } from "@/server/services/users";

export const POST = userRoute(async ({ req, ctx, user, params }) => {
  const p = z.object({ role: z.enum(["user", "admin"]) }).safeParse(await readJson(req));
  if (!p.success) throw badRequest("Neplatná role");
  return setRole(ctx.db, user, params.id, p.data.role);
}, "admin");
