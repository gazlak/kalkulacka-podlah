import { notFound } from "@/server/errors";
import { userRoute } from "@/server/http/handler";
import { getCalc } from "@/server/services/calculations";
import { badRequest } from "@/server/errors";

export const GET = userRoute(async ({ ctx, user, params }) => {
  const calc = await getCalc(ctx.db, user, params.id);
  if (!calc) throw notFound("Kalkulace nenalezena");
  if (!calc.number) throw badRequest("Kalkulace není uložena");
  const pdf = await ctx.renderPdf(calc);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kalkulace-${calc.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
