"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { Alert } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api";
import { keys, useGuestGuard } from "@/lib/hooks";

function lockText(until: number, now: number) {
  const s = Math.max(0, Math.ceil((until - now) / 1000));
  return `Příliš mnoho neúspěšných pokusů. Přihlášení je zablokované ještě ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}. Správce může účet odblokovat.`;
}

export default function LoginPage() {
  const show = useGuestGuard();
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api.auth.login({ email, password, remember });
    setBusy(false);
    if (r.ok) {
      qc.setQueryData(keys.me, r.user);
      router.replace("/history");
      return;
    }
    if (r.lockedUntil) {
      setNow(Date.now());
      setLockedUntil(r.lockedUntil);
      setError("");
    } else {
      setLockedUntil(null);
      setError(r.error);
    }
  }

  if (!show) return null;
  const lockExpired = lockedUntil !== null && lockedUntil <= now;

  return (
    <div className="auth">
      <AuthBrand title="Kalkulačka schodů" sub="Kalkulace obkladu schodů pro podlahářské firmy" />
      <div className="card">
        <div id="loginErr">
          {lockedUntil !== null && (
            <Alert kind={lockExpired ? "ok" : "err"}>
              {lockExpired ? "Blokace vypršela, můžete se znovu přihlásit." : lockText(lockedUntil, now)}
            </Alert>
          )}
          {error && <Alert kind="err">{error}</Alert>}
        </div>
        <form onSubmit={submit} noValidate>
          <Field label="E-mail" htmlFor="email">
            <Input type="email" id="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Heslo" htmlFor="password">
            <Input type="password" id="password" name="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <label className="check">
            <span>Zapamatovat si mě (30 dní)</span>
            <input type="checkbox" name="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          </label>
          <button className="btn primary block mt" type="submit" disabled={busy}>Přihlásit se</button>
        </form>
        <Link className="btn ghost block mt-2" href="/forgot">Zapomenuté heslo</Link>
      </div>
    </div>
  );
}
