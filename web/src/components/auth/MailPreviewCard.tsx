import Link from "next/link";
import type { MailPreview } from "@/lib/api/client";
import { MailBox } from "@/components/calc/MailBox";

/** Náhled e-mailu (jen mock – skutečný e-mail pošle server). */
export function MailPreviewCard({ mail }: { mail: MailPreview }) {
  const reset = mail.kind === "reset";
  return (
    <div className="card">
      <h3 className="mb">Demo: náhled e-mailu</h3>
      <MailBox to={mail.to} subject={mail.subject}>
        <p>Dobrý den,</p>
        {reset ? (
          <p>pro nastavení nového hesla klepněte na odkaz. <b>{mail.expiresInfo}</b></p>
        ) : (
          <p>byli jste pozváni do aplikace Kalkulačka schodů. Pro dokončení registrace nastavte heslo (min. 8 znaků):</p>
        )}
        <p><Link href={mail.link}>{reset ? "Nastavit nové heslo" : "Dokončit registraci"}</Link></p>
        <p className="muted">{reset ? "Pokud jste o změnu nežádali, tento e-mail ignorujte." : mail.expiresInfo}</p>
      </MailBox>
      <Link className="btn primary block" href={mail.link}>Otevřít odkaz (demo)</Link>
    </div>
  );
}
