import { readJson, userRoute } from "@/server/http/handler";
import { getRates, updateRates } from "@/server/services/pricing";
import type { Rates } from "@/lib/types";

export const GET = userRoute(({ ctx }) => getRates(ctx.db));
export const PUT = userRoute(async ({ req, ctx }) => updateRates(ctx.db, (await readJson(req)) as Rates), "admin");
