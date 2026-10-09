import type { MailMessage } from "./index";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(inner: string): string {
  return `<!doctype html><html lang="cs"><body style="font-family:system-ui,sans-serif;color:#1d1b19;line-height:1.5">${inner}</body></html>`;
}

export function resetMail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Obnovení hesla – Kalkulačka schodů",
    text: `Dobrý den,\n\npro nastavení nového hesla otevřete odkaz (platí 1 hodinu):\n${link}\n\nPokud jste o změnu nežádali, tento e-mail ignorujte.`,
    html: layout(
      `<p>Dobrý den,</p><p>pro nastavení nového hesla klepněte na odkaz. <b>Odkaz platí 1 hodinu.</b></p>` +
        `<p><a href="${esc(link)}">Nastavit nové heslo</a></p><p style="color:#6b665f">Pokud jste o změnu nežádali, tento e-mail ignorujte.</p>`,
    ),
  };
}

export function inviteMail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Pozvánka do Kalkulačky schodů",
    text: `Dobrý den,\n\nbyli jste pozváni do aplikace Kalkulačka schodů. Registraci dokončíte nastavením hesla (min. 8 znaků):\n${link}\n\nOdkaz platí 7 dní.`,
    html: layout(
      `<p>Dobrý den,</p><p>byli jste pozváni do aplikace Kalkulačka schodů. Pro dokončení registrace nastavte heslo (min. 8 znaků):</p>` +
        `<p><a href="${esc(link)}">Dokončit registraci</a></p><p style="color:#6b665f">Odkaz platí 7 dní.</p>`,
    ),
  };
}

/** Kalkulace zákazníkovi: text upravený podlahářem + PDF v příloze. */
export function calcMail(to: string, subject: string, body: string, pdf: Buffer, filename: string): MailMessage {
  const paragraphs = body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return {
    to,
    subject,
    text: body,
    html: layout(paragraphs),
    attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
  };
}
