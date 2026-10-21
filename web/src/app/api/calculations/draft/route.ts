import { userRoute } from "@/server/http/handler";
import { draftCalc } from "@/server/services/calculations";

export const GET = userRoute(({ ctx, user }) => draftCalc(ctx.db, user));
