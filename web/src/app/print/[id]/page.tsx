import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdfSheet } from "@/components/calc/PdfSheet";
import { patternOf, pricingOf, quoteOf } from "@/lib/quote";
import { getDb } from "@/server/db";
import { calculations, users } from "@/server/db/schema";
import { toCalc, toUser } from "@/server/mappers";
import { inlineImage, inlinePattern, verifyPrintKey } from "@/server/pdf";
import { currentPricing } from "@/server/services/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Interní tisková stránka pro serverové PDF; přístup jen s podepsaným krátkodobým klíčem. */
export default async function PrintPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> }) {
  const { id } = await params;
  const { k } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyPrintKey(id, k)) notFound();

  const db = getDb();
  const [row] = await db.select().from(calculations).where(eq(calculations.id, id));
  if (!row) notFound();
  const [ownerRow] = await db.select().from(users).where(eq(users.id, row.ownerId));
  const calc = toCalc(row);
  const owner = toUser(ownerRow).profile;
  const pricing = calc.snapshot ?? (await currentPricing(db));
  const pat = patternOf(calc, pricing);
  if (!calc.number || !pat) notFound();

  return (
    <PdfSheet
      calc={calc}
      pattern={await inlinePattern(db, pat)}
      quote={quoteOf(calc, pricing)}
      rates={pricingOf(calc, pricing).rates}
      owner={{ ...owner, logo: await inlineImage(db, owner.logo) }}
    />
  );
}
