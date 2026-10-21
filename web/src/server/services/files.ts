import { eq } from "drizzle-orm";
import { config } from "../config";
import { sha256 } from "../crypto";
import type { Db } from "../db";
import { files } from "../db/schema";
import { badRequest } from "../errors";
import { FILE_URL_RE } from "../mappers";

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
};

/** Uloží obrázek z data URL (jen PNG/JPEG/WebP do 2 MB, ověřeno podle obsahu) a vrátí id (SHA-256). */
export async function storeDataUrl(db: Db, dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw badRequest("Podporované obrázky: PNG, JPEG, WebP");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > config.maxImageBytes) throw badRequest("Obrázek je příliš velký (max 2 MB)");
  if (!MAGIC[m[1]](buf)) throw badRequest("Soubor není platný obrázek");
  const id = sha256(buf);
  await db.insert(files).values({ id, mime: m[1], data: buf }).onConflictDoNothing();
  return id;
}

/**
 * Vyřeší hodnotu pole s obrázkem z API: undefined/stejná URL = beze změny (vrací `current`),
 * null = smazat, data URL = nový soubor.
 */
export async function resolveImage(db: Db, value: string | null | undefined, current: string | null): Promise<string | null> {
  if (value === undefined) return current;
  if (value === null || value === "") return null;
  const url = FILE_URL_RE.exec(value);
  if (url) {
    const [f] = await db.select({ id: files.id }).from(files).where(eq(files.id, url[1]));
    if (!f) throw badRequest("Neznámý soubor");
    return f.id;
  }
  return storeDataUrl(db, value);
}

export async function getFile(db: Db, id: string) {
  const [f] = await db.select().from(files).where(eq(files.id, id));
  return f ?? null;
}
