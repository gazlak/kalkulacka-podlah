import { z } from "zod";
import { readJson, userRoute } from "@/server/http/handler";
import { badRequest } from "@/server/errors";
import { inviteUser, listUsers } from "@/server/services/users";

export const GET = userRoute(({ ctx }) => listUsers(ctx.db), "admin");

export const POST = userRoute(async ({ req, ctx }) => {
  const p = z.object({ email: z.string().max(254), role: z.enum(["user", "admin"]) }).safeParse(await readJson(req));
  if (!p.success) throw badRequest("Neplatný požadavek");
  return inviteUser(ctx, p.data.email, p.data.role);
}, "admin");
