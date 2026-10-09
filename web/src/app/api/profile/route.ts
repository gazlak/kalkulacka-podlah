import { readJson, userRoute } from "@/server/http/handler";
import { updateProfile } from "@/server/services/users";
import type { Profile } from "@/lib/types";

export const PUT = userRoute(async ({ req, ctx, user }) => updateProfile(ctx.db, user, (await readJson(req)) as Profile));
