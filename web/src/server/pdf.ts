import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chromium, type Browser } from "playwright";
import type { Calculation, Pattern } from "@/lib/types";
import type { Db } from "./db";
import { FILE_URL_RE } from "./mappers";
import { getFile } from "./services/files";

const g = globalThis as unknown as { __browser?: Promise<Browser>; __printSecret?: string };

function browser(): Promise<Browser> {
  g.__browser ??= chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }).then((b) => {
    b.on("disconnected", () => { g.__browser = undefined; });
    return b;
  });
  return g.__browser;
}

/* Chromium otevírá interní stránku /print/<id>; přístup jí dává krátkodobý podepsaný odkaz (ne session). */
const secret = () => (g.__printSecret ??= process.env.PRINT_SECRET ?? randomBytes(32).toString("hex"));
const sign = (id: string, exp: number) => createHmac("sha256", secret()).update(`${id}.${exp}`).digest("base64url");

export const printKey = (id: string, ttlMs = 60_000) => {
  const exp = Date.now() + ttlMs;
  return `${exp}.${sign(id, exp)}`;
};

export function verifyPrintKey(id: string, key: string | undefined): boolean {
  const [exp, sig] = (key ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(id, Number(exp)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** /api/files/<id> → data URL (stránka se renderuje bez cookies a obrázky musí být součástí HTML). */
export async function inlineImage(db: Db, url: string | null): Promise<string | null> {
  const m = url && FILE_URL_RE.exec(url);
  if (!m) return url;
  const f = await getFile(db, m[1]);
  return f ? `data:${f.mime};base64,${f.data.toString("base64")}` : null;
}

export async function inlinePattern(db: Db, p: Pattern): Promise<Pattern> {
  return { ...p, photo: await inlineImage(db, p.photo) };
}

const internalUrl = () => (process.env.INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`).replace(/\/$/, "");

/** PDF kalkulace – Chromium vytiskne stejnou komponentu PdfSheet jako náhled v aplikaci. */
export async function renderCalcPdf(calc: Calculation): Promise<Buffer> {
  const ctx = await (await browser()).newContext({ colorScheme: "light", javaScriptEnabled: false });
  try {
    const page = await ctx.newPage();
    const res = await page.goto(`${internalUrl()}/print/${calc.id}?k=${printKey(calc.id)}`, { waitUntil: "load" });
    if (!res?.ok()) throw new Error(`Tisková stránka vrátila ${res?.status()}`);
    await page.emulateMedia({ media: "print" });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await ctx.close();
  }
}
