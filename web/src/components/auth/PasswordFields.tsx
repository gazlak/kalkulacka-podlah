"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/Field";

/** Nové heslo + potvrzení s měřičem délky (min. 8 znaků). */
export function PasswordFields({
  pw, pw2, onPw, onPw2, errors, pwLabel = "Heslo",
}: {
  pw: string;
  pw2: string;
  onPw: (v: string) => void;
  onPw2: (v: string) => void;
  errors: { pw?: string; pw2?: string };
  pwLabel?: string;
}) {
  const [blurErr, setBlurErr] = useState("");
  const n = pw.length;
  const err = errors.pw || (n >= 8 ? "" : blurErr);
  return (
    <>
      <Field label={pwLabel} htmlFor="pw" error={err}>
        <Input
          type="password" id="pw" name="pw" autoComplete="new-password" value={pw} error={err}
          onChange={(e) => { onPw(e.target.value); if (e.target.value.length >= 8) setBlurErr(""); }}
          onBlur={() => setBlurErr(pw && pw.length < 8 ? "Heslo musí mít alespoň 8 znaků" : "")}
        />
        <div className="pwmeter"><i className={n >= 8 ? "ok" : ""} style={{ width: `${Math.min(100, (n / 8) * 100)}%` }} /></div>
        <div className="hint pwcount">{n >= 8 ? `Délka v pořádku (${n} znaků)` : `Min. 8 znaků (${n}/8)`}</div>
      </Field>
      <Field label="Heslo znovu" htmlFor="pw2" error={errors.pw2}>
        <Input type="password" id="pw2" name="pw2" autoComplete="new-password" value={pw2} error={errors.pw2} onChange={(e) => onPw2(e.target.value)} />
      </Field>
    </>
  );
}
