import { readJson, userRoute } from "@/server/http/handler";
import { badRequest } from "@/server/errors";
import { statusSchema } from "@/lib/schemas";
import { setCalcStatus } from "@/server/services/calculations";

export const POST = userRoute(async ({ req, ctx, user, params }) => {
  const p = statusSchema.safeParse(((await readJson(req)) as { status?: unknown })?.status);
  if (!p.success) throw badRequest("Neplatný stav");
  return setCalcStatus(ctx.db, user, params.id, p.data);
});
