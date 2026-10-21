import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/** Aplikuje SQL migrace z ./drizzle (spouští se při startu kontejneru i ručně: npm run db:migrate). */
export async function runMigrations(url = process.env.DATABASE_URL!): Promise<void> {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    await pool.end();
  }
}
