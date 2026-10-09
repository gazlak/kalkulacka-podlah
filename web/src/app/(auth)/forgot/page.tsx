"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { Alert } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { MailPreviewCard } from "@/components/auth/MailPreviewCard";
import { api } from "@/lib/api";
import type { MailPreview } from "@/lib/api/client";
import { emailSchema } from "@/lib/schemas";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [mail, setMail] = useState<MailPreview | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p = emailSchema.safeParse(email);
    if (!p.success) return setError(p.error.issues[0].message);
    setError("");
    // Odpověď je stejná, ať účet existuje, nebo ne (e-mail pošle server).
    setMail(await api.auth.requestReset(p.data, false));
    setSent(true);
  }

  return (
    <div className="auth">
      <AuthBrand title="Zapomenuté heslo" sub="Pošleme vám odkaz pro nastavení nového hesla. Odkaz platí 1 hodinu." />
      <div className="card">
        <form onSubmit={submit} noValidate>
          <Field label="E-mail" htmlFor="fe" error={error}>
            <Input type="email" id="fe" name="email" inputMode="email" autoCapitalize="none" value={email} error={error}
              onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button className="btn primary block mt" type="submit">Odeslat odkaz</button>
        </form>
        <Link className="btn ghost block mt-2" href="/login"><Icon name="back" />Zpět na přihlášení</Link>
      </div>
      {sent && (
        <div>
          <Alert kind="ok">Pokud účet s tímto e-mailem existuje, odeslali jsme odkaz pro obnovení hesla.</Alert>
          {mail && <MailPreviewCard mail={mail} />}
        </div>
      )}
    </div>
  );
}
