import { z } from "zod";
import { readJson, route } from "@/server/http/handler";
import { checkToken } from "@/server/services/auth";

export const POST = route("none", async ({ req, ctx }) => {
  const p = z.object({ token: z.string().max(200), type: z.enum(["reset", "invite"]) }).safeParse(await readJson(req));
  return p.success ? checkToken(ctx.db, p.data.token, p.data.type) : { ok: false, error: "Odkaz je neplatný." };
});
