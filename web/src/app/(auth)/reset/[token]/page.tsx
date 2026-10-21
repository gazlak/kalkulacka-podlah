"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { PasswordFields } from "@/components/auth/PasswordFields";
import { Alert } from "@/components/ui/misc";
import { useUi } from "@/components/ui/UiProvider";
import { api } from "@/lib/api";
import { fieldErrors, setPasswordSchema } from "@/lib/schemas";

export default function ResetPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { toast } = useUi();
  const check = useQuery({ queryKey: ["token", "reset", token], queryFn: () => api.auth.checkToken(token, "reset") });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!check.data) return null;
  if (!check.data.ok) {
    return (
      <div className="auth">
        <AuthBrand title="Nový odkaz je potřeba" />
        <div className="card">
          <Alert kind="err">{check.data.error} Odkazy pro obnovení hesla platí 1 hodinu.</Alert>
          <Link className="btn primary block" href="/forgot">Vyžádat nový odkaz</Link>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = setPasswordSchema.safeParse({ pw, pw2 });
    if (!r.success) return setErrors(fieldErrors(r.error));
    await api.auth.resetPassword(token, pw);
    toast("Heslo bylo změněno, můžete se přihlásit");
    router.replace("/login");
  }

  return (
    <div className="auth">
      <AuthBrand title="Nové heslo" sub={`Účet: ${check.data.email}`} />
      <div className="card">
        <form onSubmit={submit} noValidate>
          <PasswordFields pw={pw} pw2={pw2} onPw={setPw} onPw2={setPw2} errors={errors} pwLabel="Nové heslo" />
          <button className="btn primary block" type="submit">Uložit heslo</button>
        </form>
      </div>
    </div>
  );
}
