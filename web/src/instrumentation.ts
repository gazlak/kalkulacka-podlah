/**
 * Při startu produkčního serveru: SQL migrace (drizzle/), výchozí ceník, když chybí, a dokud v DB není admin,
 * pozvánka pro ADMIN_EMAIL. Demo účty ani ukázkové kalkulace se v provozu nezakládají. V dev: npm run db:migrate.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    const { runMigrations } = await import("./server/migrate");
    await runMigrations();
    console.info("[db] migrace aplikovány");

    const { getCtx } = await import("./server/ctx");
    const { seedPricing } = await import("./server/seed");
    const { bootstrapAdmin } = await import("./server/services/auth");
    const ctx = getCtx();
    await seedPricing(ctx.db);
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (adminEmail) {
      const r = await bootstrapAdmin(ctx, adminEmail);
      if (r?.link) console.info(`[admin] pozvánka pro ${r.email} neodešla e-mailem, odkaz (platí 7 dní, jednorázový): ${r.link}`);
      else if (r) console.info(`[admin] pozvánka pro ${r.email} odeslána e-mailem`);
    }
  }
}
