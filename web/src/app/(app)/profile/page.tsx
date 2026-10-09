"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/chrome/TopBar";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useUi } from "@/components/ui/UiProvider";
import { api } from "@/lib/api";
import { keys, useLogout, useSession } from "@/lib/hooks";
import { readImage } from "@/lib/image";
import { fieldErrors, profileSchema } from "@/lib/schemas";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const { data: user } = useSession();
  if (!user) return null;
  return <ProfileForm initial={user.profile} email={user.email} />;
}

function ProfileForm({ initial, email }: { initial: Profile; email: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useUi();
  const logout = useLogout();
  const [p, setP] = useState<Profile>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Profile) => (e: { target: { value: string } }) => setP((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = profileSchema.safeParse(p);
    if (!r.success) return setErrors(fieldErrors(r.error));
    try {
      const u = await api.profile.update(r.data);
      qc.setQueryData(keys.me, u);
      qc.invalidateQueries({ queryKey: ["owners"] });
      qc.invalidateQueries({ queryKey: ["user"] });
      toast("Profil uložen");
      router.push("/history");
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function onLogo(file?: File) {
    if (!file) return;
    try {
      const logo = await readImage(file, 400);
      setP((v) => ({ ...v, logo }));
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <>
      <TopBar />
      <h1 className="large-title">Profil</h1>
      <form onSubmit={submit} noValidate>
        <div className="section-title">Účet a firma</div>
        <div className="card">
          <Field label="E-mail (přihlašovací)" htmlFor="pe">
            <input type="text" id="pe" value={email} disabled />
          </Field>
          <Field label="Jméno" htmlFor="pn" error={errors.name}>
            <Input type="text" id="pn" name="name" value={p.name} onChange={set("name")} autoComplete="name" error={errors.name} />
          </Field>
          <Field label="Firma" htmlFor="pc" error={errors.company}>
            <Input type="text" id="pc" name="company" value={p.company} onChange={set("company")} autoComplete="organization" error={errors.company} />
          </Field>
          <Field label="IČO" htmlFor="pi" hint="8 číslic" error={errors.ico}>
            <Input type="text" id="pi" name="ico" inputMode="numeric" maxLength={8} value={p.ico} onChange={set("ico")} error={errors.ico}
              onBlur={() => {
                const r = profileSchema.shape.ico.safeParse(p.ico);
                setErrors((x) => ({ ...x, ico: r.success ? "" : r.error.issues[0].message }));
              }} />
          </Field>
          <Field label="Telefon" htmlFor="pt" error={errors.phone} flush>
            <Input type="tel" id="pt" name="phone" inputMode="tel" value={p.phone} onChange={set("phone")} autoComplete="tel" error={errors.phone} />
          </Field>
        </div>
        <div className="section-title">Logo</div>
        <div className="card">
          <div className="lbl muted" style={{ fontWeight: 400 }}>Vytiskne se na kalkulaci a v PDF.</div>
          <div className="logo-box mt-2">
            {p.logo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="logo-prev" src={p.logo} alt="Logo firmy" />
                <button type="button" className="btn sm ghost" onClick={() => setP((v) => ({ ...v, logo: null }))}>Odstranit</button>
              </>
            ) : (
              <span className="muted small">Logo není nahráno</span>
            )}
          </div>
          <label className="btn sm tonal mt-2">
            <Icon name="plus" />Nahrát logo
            <input type="file" className="sr" accept="image/*" aria-label="Nahrát logo" onChange={(e) => onLogo(e.target.files?.[0])} />
          </label>
        </div>
        <button className="btn primary block" type="submit">Uložit profil</button>
      </form>
      <button className="btn block mt" type="button" onClick={logout}><Icon name="logout" />Odhlásit se</button>
    </>
  );
}
