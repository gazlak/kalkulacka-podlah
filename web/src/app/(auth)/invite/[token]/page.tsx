"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { PasswordFields } from "@/components/auth/PasswordFields";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/misc";
import { useUi } from "@/components/ui/UiProvider";
import { api } from "@/lib/api";
import { fieldErrors, setPasswordSchema } from "@/lib/schemas";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { toast } = useUi();
  const check = useQuery({ queryKey: ["token", "invite", token], queryFn: () => api.auth.checkToken(token, "invite") });
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!check.data) return null;
  if (!check.data.ok) {
    return (
      <div className="auth">
        <AuthBrand title="Pozvánka" />
        <div className="card">
          <Alert kind="err">{check.data.error} Požádejte správce o novou pozvánku.</Alert>
          <Link className="btn block" href="/login">Na přihlášení</Link>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = setPasswordSchema.safeParse({ pw, pw2 });
    if (!r.success) return setErrors(fieldErrors(r.error));
    await api.auth.acceptInvite(token, pw, name);
    toast("Účet je aktivní, přihlaste se");
    router.replace("/login");
  }

  return (
    <div className="auth">
      <AuthBrand title="Dokončení registrace" sub={<>Nastavte si heslo pro účet <b>{check.data.email}</b>.</>} />
      <div className="card">
        <form onSubmit={submit} noValidate>
          <Field label="Vaše jméno" htmlFor="nm" optional="(volitelné, doplníte v profilu)">
            <Input type="text" id="nm" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <PasswordFields pw={pw} pw2={pw2} onPw={setPw} onPw2={setPw2} errors={errors} />
          <button className="btn primary block" type="submit">Vytvořit účet</button>
        </form>
      </div>
    </div>
  );
}
