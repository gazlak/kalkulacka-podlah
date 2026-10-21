import { readJson, userRoute } from "@/server/http/handler";
import { badRequest } from "@/server/errors";
import { updatePattern } from "@/server/services/pricing";
import type { PatternPatch } from "@/lib/api/client";

export const PUT = userRoute(async ({ req, ctx, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw badRequest("Neplatné ID");
  return updatePattern(ctx.db, id, (await readJson(req)) as PatternPatch);
}, "admin");
