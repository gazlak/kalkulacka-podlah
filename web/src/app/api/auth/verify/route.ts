import { z } from "zod";
import { readJson, route, setSessionCookie } from "@/server/http/handler";
import { verifyEmail } from "@/server/services/auth";

export const POST = route("none", async ({ req, ctx }) => {
  const p = z.object({ token: z.string().max(200) }).safeParse(await readJson(req));
  if (!p.success) return { ok: false, error: "Odkaz je neplatný, použitý nebo vypršel." };
  const { result, session } = await verifyEmail(ctx.db, p.data.token);
  if (session) await setSessionCookie(session.token, session.expiresAt, session.remember);
  return result;
});
