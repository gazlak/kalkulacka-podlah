import { z } from "zod";
import { readJson, route } from "@/server/http/handler";
import { badRequest } from "@/server/errors";
import { acceptInvite } from "@/server/services/auth";

export const POST = route("none", async ({ req, ctx }) => {
  const p = z.object({ token: z.string().max(200), password: z.string().max(200), name: z.string().max(200) }).safeParse(await readJson(req));
  if (!p.success) throw badRequest("Neplatný požadavek");
  await acceptInvite(ctx.db, p.data.token, p.data.password, p.data.name);
});
