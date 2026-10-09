import { userRoute } from "@/server/http/handler";
import { currentPricing } from "@/server/services/pricing";

export const GET = userRoute(({ ctx }) => currentPricing(ctx.db));
