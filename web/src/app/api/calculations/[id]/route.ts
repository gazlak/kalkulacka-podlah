import { readJson, userRoute } from "@/server/http/handler";
import { getCalc, saveCalc } from "@/server/services/calculations";

export const GET = userRoute(async ({ ctx, user, params }) => getCalc(ctx.db, user, params.id));

export const PUT = userRoute(async ({ req, ctx, user, params }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  return saveCalc(ctx.db, user, { ...body, id: params.id });
});
