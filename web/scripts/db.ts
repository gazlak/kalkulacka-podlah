/* npm run db:migrate | db:seed | db:reset */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { runMigrations } from "../src/server/migrate";
import * as schema from "../src/server/db/schema";
import { seed } from "../src/server/seed";

const url = process.env.DATABASE_URL ?? "postgres://kalkulacka:kalkulacka@localhost:5432/kalkulacka";
process.env.DATABASE_URL = url;
const cmd = process.argv[2];

async function main() {
  if (cmd === "reset") {
    const pool = new Pool({ connectionString: url });
    await pool.query("DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await pool.end();
  }
  if (cmd === "migrate" || cmd === "reset" || cmd === "seed") await runMigrations(url);
  if (cmd === "seed" || cmd === "reset") {
    const pool = new Pool({ connectionString: url });
    await seed(drizzle(pool, { schema }));
    await pool.end();
  }
}
main().then(() => console.log(`db:${cmd} hotovo`), (e) => { console.error(e); process.exit(1); });
