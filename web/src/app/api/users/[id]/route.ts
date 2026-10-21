import { userRoute } from "@/server/http/handler";
import { deleteUser, lookupUser } from "@/server/services/users";

export const GET = userRoute(({ ctx, user, params }) => lookupUser(ctx.db, user, params.id));
export const DELETE = userRoute(({ ctx, user, params }) => deleteUser(ctx.db, user, params.id), "admin");
