/* Zod schémata – sdílená s budoucím backendem. */
import { z } from "zod";

export const emailSchema = z.string().trim().regex(/^\S+@\S+\.\S+$/, "Zadejte platný e-mail");

export const passwordSchema = z.string().min(8, "Heslo musí mít alespoň 8 znaků");

export const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  remember: z.boolean().default(false),
});

export const setPasswordSchema = z
  .object({ pw: passwordSchema, pw2: z.string() })
  .refine((v) => v.pw === v.pw2, { path: ["pw2"], message: "Hesla se neshodují" });

export const profileSchema = z.object({
  name: z.string().trim(),
  company: z.string().trim(),
  ico: z.string().trim().refine((v) => v === "" || /^\d{8}$/.test(v), "IČO musí mít přesně 8 číslic"),
  phone: z.string().trim(),
  logo: z.string().nullable(),
});

export const jobSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název zakázky"),
  customer: z.string(),
  address: z.string(),
  note: z.string(),
});

const nonNeg = (msg: string) => z.number({ error: msg }).min(0, msg);

export const patternSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název"),
  materialPerM2: nonNeg("Zadejte cenu ≥ 0"),
  wastePct: z.number({ error: "Prořez musí být 0–100 %" }).min(0, "Prořez musí být 0–100 %").max(100, "Prořez musí být 0–100 %"),
  laborPerTread: nonNeg("Zadejte cenu ≥ 0"),
});

export const ratesFormSchema = z.object({
  riserSurcharge: nonNeg("Zadejte číslo ≥ 0"),
  transport: nonNeg("Zadejte číslo ≥ 0"),
  vatDefault: z.number(),
  roundTo: z.number(),
  extrasEnabled: z.boolean(),
  extras: z.record(z.string(), nonNeg("Zadejte číslo ≥ 0")),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["user", "admin"]),
});

export const sendMailSchema = z.object({
  to: emailSchema.refine(Boolean, "Zadejte platný e-mail zákazníka"),
  subject: z.string(),
  body: z.string(),
});

/** Vrátí mapu pole → první chyba. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!(k in out)) out[k] = i.message;
  }
  return out;
}
