import { userRoute } from "@/server/http/handler";
import { recalcCalc } from "@/server/services/calculations";

export const POST = userRoute(({ ctx, user, params }) => recalcCalc(ctx.db, user, params.id));
