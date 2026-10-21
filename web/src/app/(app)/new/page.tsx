"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { setPendingDraft } from "@/lib/draft";

/** Vytvoří nepersistovaný koncept; do úložiště se uloží až po první změně. */
export default function NewCalcPage() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.calculations.draft().then((d) => {
      d.job.name = "Kalkulace " + fmtDate(Date.now());
      setPendingDraft(d);
      router.replace(`/wizard/${d.id}/1`);
    });
  }, [router]);

  return null;
}
