import { userRoute } from "@/server/http/handler";
import { listCalcs } from "@/server/services/calculations";

export const GET = userRoute(({ ctx, user }) => listCalcs(ctx.db, user));
