import { userRoute } from "@/server/http/handler";
import { unblockUser } from "@/server/services/users";

export const POST = userRoute(({ ctx, params }) => unblockUser(ctx.db, params.id), "admin");
