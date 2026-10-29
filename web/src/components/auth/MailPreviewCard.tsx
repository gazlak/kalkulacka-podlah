import Link from "next/link";
import type { MailPreview } from "@/lib/api/client";
import { Alert } from "@/components/ui/misc";
import { MailBox } from "@/components/calc/MailBox";

/** Náhled e-mailu (jen mock – skutečný e-mail pošle server). */
export function MailPreviewCard({ mail }: { mail: MailPreview }) {
  if (!mail.link) {
    return <Alert kind="ok">E-mail „{mail.subject}“ byl odeslán na {mail.to}. {mail.expiresInfo}</Alert>;
  }
  const text = {
    reset: {
      lead: <>pro nastavení nového hesla klepněte na odkaz. <b>{mail.expiresInfo}</b></>,
      cta: "Nastavit nové heslo",
      foot: "Pokud jste o změnu nežádali, tento e-mail ignorujte.",
    },
    invite: {
      lead: <>byli jste pozváni do aplikace Kalkulačka schodů. Pro dokončení registrace nastavte heslo (min. 8 znaků):</>,
      cta: "Dokončit registraci",
      foot: mail.expiresInfo,
    },
    verify: {
      lead: <>děkujeme za registraci. Účet aktivujete klepnutím na odkaz. <b>{mail.expiresInfo}</b></>,
      cta: "Ověřit e-mail",
      foot: "Pokud jste se neregistrovali, tento e-mail ignorujte.",
    },
  }[mail.kind];
  return (
    <div className="card">
      <h3 className="mb">Demo: náhled e-mailu</h3>
      <MailBox to={mail.to} subject={mail.subject}>
        <p>Dobrý den,</p>
        <p>{text.lead}</p>
        <p><Link href={mail.link}>{text.cta}</Link></p>
        <p className="muted">{text.foot}</p>
      </MailBox>
      <Link className="btn primary block" href={mail.link}>Otevřít odkaz (demo)</Link>
    </div>
  );
}
