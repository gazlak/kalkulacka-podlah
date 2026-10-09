import { defineConfig } from "@playwright/test";

/** E2E_API=http (výchozí pro backend) | mock. Server se spouští s odpovídajícím NEXT_PUBLIC_API. */
const api = process.env.E2E_API ?? "mock";
const port = api === "http" ? 3101 : 3100;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 360, height: 780 }, locale: "cs-CZ" },
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { PORT: String(port), NEXT_PUBLIC_API: api, RATE_LIMIT_DISABLED: "1", NEXT_DIST_DIR: `.next-${api}` },
  },
});
