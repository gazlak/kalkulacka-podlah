import { readJson, userRoute } from "@/server/http/handler";
import { badRequest } from "@/server/errors";
import { sendMailSchema } from "@/lib/schemas";
import { sendCalc } from "@/server/services/calculations";

export const POST = userRoute(async ({ req, ctx, user, params }) => {
  const p = sendMailSchema.safeParse(await readJson(req));
  if (!p.success) throw badRequest(p.error.issues[0].message);
  return sendCalc(ctx, user, params.id, p.data);
});
