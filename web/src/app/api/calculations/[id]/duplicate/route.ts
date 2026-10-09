import { userRoute } from "@/server/http/handler";
import { duplicateCalc } from "@/server/services/calculations";

export const POST = userRoute(({ ctx, user, params }) => duplicateCalc(ctx.db, user, params.id));
