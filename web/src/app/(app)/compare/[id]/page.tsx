"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/chrome/TopBar";
import { CompareTable } from "@/components/calc/CompareTable";
import { useUi } from "@/components/ui/UiProvider";
import { formatM2, formatPct, groupArea } from "@/lib/calc";
import { fmtDate } from "@/lib/format";
import { usePricing } from "@/lib/hooks";
import { useCalcDraft } from "@/lib/useCalcDraft";
import { stepValid } from "@/lib/wizard";

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  return <Compare key={id} id={id} />;
}

function Compare({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useUi();
  const draft = useCalcDraft(id);
  const pricing = usePricing();
  const c = draft.calc;

  useEffect(() => {
    if (draft.load === "missing") {
      toast("Kalkulace nenalezena");
      router.replace("/history");
    } else if (c && !stepValid(c, 1)) router.replace(`/wizard/${id}/1`);
  }, [draft.load, c, id, router, toast]);

  if (!c || !pricing.data || !stepValid(c, 1)) return null;
  const back = c.number || draft.readOnly ? `/calc/${id}` : `/wizard/${id}/2`;

  function use(patternId: number) {
    draft.update((x) => ({ ...x, patternId }));
    toast("Vzor změněn");
    router.push(c!.number ? `/calc/${id}` : `/wizard/${id}/4`);
  }

  return (
    <>
      <TopBar title="Porovnání vzorů" back={back} />
      <h1 className="large-title">Porovnání vzorů</h1>
      <CompareHeader draft={draft} />
      <CompareTable calc={c} current={pricing.data} readOnly={draft.readOnly} onUse={use} />
    </>
  );
}

function CompareHeader({ draft }: { draft: ReturnType<typeof useCalcDraft> }) {
  const { data: pricing } = usePricing();
  const c = draft.calc!;
  if (!pricing) return null;
  const area = c.groups.reduce((sum, g) => sum + groupArea(g), 0);
  return (
    <p className="screen-sub">
      {c.job.name} · {formatM2(area)} · DPH {formatPct(c.vatRate)}
      {c.discount.value ? ` · sleva ${c.discount.value}${c.discount.type === "pct" ? " %" : " Kč"}` : ""}
      {c.snapshot ? ` · ceny z ${fmtDate(c.createdAt)}` : ""}
    </p>
  );
}
