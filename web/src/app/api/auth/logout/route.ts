import { cookies } from "next/headers";
import { clearSessionCookie, route, SESSION_COOKIE } from "@/server/http/handler";
import { destroySession } from "@/server/services/auth";

export const POST = route("none", async ({ ctx }) => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await destroySession(ctx.db, token);
  await clearSessionCookie();
});
