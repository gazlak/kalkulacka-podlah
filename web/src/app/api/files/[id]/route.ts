import { notFound } from "@/server/errors";
import { userRoute } from "@/server/http/handler";
import { getFile } from "@/server/services/files";

export const GET = userRoute(async ({ ctx, params }) => {
  const f = /^[0-9a-f]{64}$/.test(params.id) ? await getFile(ctx.db, params.id) : null;
  if (!f) throw notFound();
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
