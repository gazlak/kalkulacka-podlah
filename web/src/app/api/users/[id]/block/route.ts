import { userRoute } from "@/server/http/handler";
import { blockUser } from "@/server/services/users";

export const POST = userRoute(({ ctx, user, params }) => blockUser(ctx.db, user, params.id), "admin");
