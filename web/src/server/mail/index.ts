import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

export interface Mailer {
  send(m: MailMessage): Promise<void>;
}

/** SMTP z env; bez SMTP_HOST se zprávy jen vypisují do konzole (dev). */
export function createMailer(): Mailer {
  const host = process.env.SMTP_HOST;
  const from = process.env.MAIL_FROM ?? "Kalkulačka schodů <no-reply@kalkulacka.local>";
  if (!host) {
    return {
      async send(m) {
        console.info(`[mail] → ${m.to} | ${m.subject}\n${m.text}`);
      },
    };
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
  return {
    async send(m) {
      await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html, attachments: m.attachments });
    },
  };
}

/** Mailer pro testy: ukládá zprávy do pole. */
export function memoryMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return { sent, async send(m) { sent.push(m); } };
}
