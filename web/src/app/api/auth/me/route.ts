import { route } from "@/server/http/handler";
import { lookupUser } from "@/server/services/users";

export const GET = route("none", async ({ ctx, user }) => (user ? await lookupUser(ctx.db, user, user.id) : null));
