/** Při startu produkčního serveru aplikuje SQL migrace (drizzle/). V dev: npm run db:migrate. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    const { runMigrations } = await import("./server/migrate");
    await runMigrations();
    console.info("[db] migrace aplikovány");
  }
}
