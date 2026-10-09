import { userRoute } from "@/server/http/handler";
import { listPatterns } from "@/server/services/pricing";

export const GET = userRoute(({ ctx }) => listPatterns(ctx.db));
