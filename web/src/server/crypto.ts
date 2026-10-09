import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

export const hashPassword = (pw: string) => hash(pw);

/** Konstantní čas i pro neexistující účet (hash dummy hesla). */
let dummy: Promise<string> | null = null;
export async function verifyPassword(stored: string | null, pw: string): Promise<boolean> {
  if (!stored) {
    dummy ??= hash("dummy-password-for-timing");
    await verify(await dummy, pw).catch(() => false);
    return false;
  }
  return verify(stored, pw).catch(() => false);
}
