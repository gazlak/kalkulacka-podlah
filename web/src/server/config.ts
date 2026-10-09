export const config = {
  appUrl: () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  isProd: () => process.env.NODE_ENV === "production",
  maxAttempts: 5,
  lockMs: 15 * 60 * 1000,
  resetTtlMs: 60 * 60 * 1000,
  inviteTtlMs: 7 * 24 * 60 * 60 * 1000,
  sessionRememberMs: 30 * 24 * 60 * 60 * 1000,
  sessionShortMs: 12 * 60 * 60 * 1000,
  maxImageBytes: 2 * 1024 * 1024,
};
