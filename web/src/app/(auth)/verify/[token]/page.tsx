"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { Alert } from "@/components/ui/misc";
import { useUi } from "@/components/ui/UiProvider";
import { api } from "@/lib/api";
import { keys } from "@/lib/hooks";

/** Odkaz z ověřovacího e-mailu: aktivuje účet, přihlásí a pošle do historie kalkulací. */
export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useUi();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // token je jednorázový, v dev režimu by ho StrictMode spotřeboval dvakrát
    started.current = true;
    api.auth.verifyEmail(token).then((r) => {
      if (r.ok) {
        qc.setQueryData(keys.me, r.user);
        toast("E-mail ověřen, účet je aktivní");
        router.replace("/history");
      } else setError(r.error);
    }, (e: Error) => setError(e.message));
  }, [token, qc, router, toast]);

  return (
    <div className="auth">
      <AuthBrand title="Ověření e-mailu" />
      <div className="card">
        {error ? (
          <>
            <Alert kind="err">{error} Nový odkaz pošleme po pokusu o přihlášení.</Alert>
            <Link className="btn primary block" href="/login">Na přihlášení</Link>
          </>
        ) : (
          <p className="muted">Ověřujeme odkaz…</p>
        )}
      </div>
    </div>
  );
}
