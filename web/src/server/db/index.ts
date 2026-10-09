import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/** Společný typ pro node-postgres (provoz) i PGlite (testy). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __pool?: Pool };

export function getDb(): Db {
  if (!g.__pool) {
    g.__pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "postgres://kalkulacka:kalkulacka@localhost:5432/kalkulacka",
      max: 10,
    });
  }
  return drizzle(g.__pool, { schema });
}

export { schema };
