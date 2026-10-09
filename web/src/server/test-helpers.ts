import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Actor, Ctx } from "./ctx";
import type { Db } from "./db";
import * as schema from "./db/schema";
import { memoryMailer } from "./mail";
import { seed } from "./seed";

/** Čerstvá in-memory Postgres (PGlite) s migracemi a seed daty – testy služeb bez Dockeru. */
export async function testCtx(): Promise<Ctx & { mailer: ReturnType<typeof memoryMailer>; actor: (email: string) => Promise<Actor> }> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seed(db as unknown as Db);
  const mailer = memoryMailer();
  return {
    db: db as unknown as Db,
    mailer,
    renderPdf: async () => Buffer.from("%PDF-test"),
    async actor(email) {
      const [u] = await db.select().from(schema.users).where((await import("drizzle-orm")).eq(schema.users.email, email));
      return { id: u.id, role: u.role };
    },
  };
}
