"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActionBar, BackButton } from "@/components/chrome/ActionBar";
import { TopBar } from "@/components/chrome/TopBar";
import { CalcSheets } from "@/components/calc/CalcSheets";
import { CalcView } from "@/components/calc/CalcView";
import { Icon } from "@/components/ui/Icon";
import { useUi } from "@/components/ui/UiProvider";
import { formatCZK, formatM2 } from "@/lib/calc";
import { usePricing } from "@/lib/hooks";
import { patternOf, quoteOf } from "@/lib/quote";
import { useCalcActions } from "@/lib/useCalcActions";
import { useCalcDraft } from "@/lib/useCalcDraft";
import { allValid } from "@/lib/wizard";

export default function CalcPage() {
  const { id } = useParams<{ id: string }>();
  return <CalcDetail key={id} id={id} />;
}

function CalcDetail({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useUi();
  const draft = useCalcDraft(id);
  const act = useCalcActions(draft);
  const pricing = usePricing();
  const c = draft.calc;
  const valid = !!c && allValid(c);

  useEffect(() => {
    if (draft.load === "missing") {
      toast("Kalkulace nenalezena");
      router.replace("/history");
    } else if (c) {
      if (draft.readOnly && !valid) {
        toast("Rozpracovaná kalkulace podlaháře ještě není dokončená");
        router.replace("/history");
      } else if (!draft.readOnly && (!c.number || !valid)) {
        router.replace(`/wizard/${id}/1`);
      }
    }
  }, [draft.load, draft.readOnly, c, valid, id, router, toast]);

  if (!c || !pricing.data || !valid || (!c.number && !draft.readOnly)) return null;
  const q = quoteOf(c, pricing.data);
  const pat = patternOf(c, pricing.data);

  return (
    <>
      <TopBar title={`Kalkulace ${c.number || "(koncept)"}`} back="/history" />
      <CalcView draft={draft} act={act} current={pricing.data} inWizard={false} />
      <ActionBar info={formatM2(q.totalArea) + (pat ? ` · ${pat.name}` : "")} price={pat ? formatCZK(q.total) : "—"}>
        <BackButton href="/history" />
        {draft.readOnly ? (
          <button className="btn primary" onClick={act.pdf}><Icon name="pdf" />Zobrazit PDF</button>
        ) : (
          <>
            <button className="btn sq" onClick={() => act.setMoreOpen(true)} aria-label="Další akce"><Icon name="more" size="lg" /></button>
            <button className="btn primary" onClick={act.save}>Uložit změny</button>
          </>
        )}
      </ActionBar>
      <CalcSheets draft={draft} act={act} current={pricing.data} inWizard={false} />
    </>
  );
}
