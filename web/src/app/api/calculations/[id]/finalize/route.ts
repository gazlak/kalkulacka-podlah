import { userRoute } from "@/server/http/handler";
import { finalizeCalc } from "@/server/services/calculations";

export const POST = userRoute(({ ctx, user, params }) => finalizeCalc(ctx.db, user, params.id));
