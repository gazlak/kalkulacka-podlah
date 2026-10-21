import { userRoute } from "@/server/http/handler";
import { resendInvite } from "@/server/services/users";

export const POST = userRoute(({ ctx, params }) => resendInvite(ctx, params.id), "admin");
