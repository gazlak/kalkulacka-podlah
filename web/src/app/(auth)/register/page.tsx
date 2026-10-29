"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { MailPreviewCard } from "@/components/auth/MailPreviewCard";
import { PasswordFields } from "@/components/auth/PasswordFields";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Alert } from "@/components/ui/misc";
import { api } from "@/lib/api";
import type { MailPreview } from "@/lib/api/client";
import { useGuestGuard } from "@/lib/hooks";
import { fieldErrors, registerSchema } from "@/lib/schemas";

/** Veřejná registrace podlahářské firmy; účet se aktivuje odkazem z ověřovacího e-mailu (platí 24 hodin). */
export default function RegisterPage() {
  const show = useGuestGuard();
  const [v, setV] = useState({ company: "", ico: "", name: "", email: "" });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ to: string; mail: MailPreview | null } | null>(null);

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFailure("");
    const r = registerSchema.safeParse({ ...v, ico: v.ico.replace(/\s/g, ""), pw, pw2, terms });
    if (!r.success) return setErrors(fieldErrors(r.error));
    setErrors({});
    setBusy(true);
    try {
      const mail = await api.auth.register({ company: r.data.company, ico: r.data.ico, name: r.data.name, email: r.data.email, password: r.data.pw });
      setSent({ to: r.data.email, mail });
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;

  if (sent) {
    return (
      <div className="auth">
        <AuthBrand title="Zkontrolujte e-mail" sub={<>Poslali jsme ověřovací odkaz na <b>{sent.to}</b>.</>} />
        <div className="card">
          <Alert kind="ok">Účet aktivujete klepnutím na odkaz v e-mailu. Odkaz platí 24 hodin.</Alert>
          <Link className="btn ghost block mt-2" href="/login"><Icon name="back" />Na přihlášení</Link>
        </div>
        {sent.mail && <MailPreviewCard mail={sent.mail} />}
      </div>
    );
  }

  return (
    <div className="auth">
      <AuthBrand title="Registrace" sub="Účet pro podlahářskou firmu. Kalkulace uvidíte jen vy." />
      <div className="card">
        <form onSubmit={submit} noValidate>
          <Field label="Firma" htmlFor="rc" error={errors.company}>
            <Input type="text" id="rc" name="company" autoComplete="organization" value={v.company} error={errors.company} onChange={set("company")} />
          </Field>
          <Field label="IČO" htmlFor="ri" optional="(volitelné)" error={errors.ico}>
            <Input type="text" id="ri" name="ico" inputMode="numeric" maxLength={8} value={v.ico} error={errors.ico} onChange={set("ico")} />
          </Field>
          <Field label="Jméno a příjmení" htmlFor="rn" error={errors.name}>
            <Input type="text" id="rn" name="name" autoComplete="name" value={v.name} error={errors.name} onChange={set("name")} />
          </Field>
          <Field label="E-mail" htmlFor="re" error={errors.email}>
            <Input type="email" id="re" name="email" autoComplete="username" inputMode="email" autoCapitalize="none"
              value={v.email} error={errors.email} onChange={set("email")} />
          </Field>
          <PasswordFields pw={pw} pw2={pw2} onPw={setPw} onPw2={setPw2} errors={errors} />
          <div className="field">
            <label className="check terms">
              <span>Souhlasím s obchodními podmínkami a zpracováním osobních údajů</span>
              <input type="checkbox" name="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            </label>
            <div className="err">{errors.terms}</div>
          </div>
          {failure && <Alert kind="err">{failure}</Alert>}
          <button className="btn primary block mt" type="submit" disabled={busy}>Vytvořit účet</button>
        </form>
      </div>
      <p className="auth-alt">Už máte účet? <Link href="/login">Přihlásit se</Link></p>
    </div>
  );
}
