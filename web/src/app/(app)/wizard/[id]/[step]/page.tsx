"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActionBar, BackButton } from "@/components/chrome/ActionBar";
import { TopBar } from "@/components/chrome/TopBar";
import { CalcSheets } from "@/components/calc/CalcSheets";
import { CalcView, PriceNotice } from "@/components/calc/CalcView";
import { StepJob, StepPattern, StepStairs } from "@/components/wizard/Steps";
import { Icon } from "@/components/ui/Icon";
import { useUi } from "@/components/ui/UiProvider";
import { formatCZK, formatM2 } from "@/lib/calc";
import { clearShowErrors, requestShowErrors, useShowErrors } from "@/lib/draft";
import { fmtTime } from "@/lib/format";
import { usePricing } from "@/lib/hooks";
import { patternOf, quoteOf } from "@/lib/quote";
import { useCalcActions } from "@/lib/useCalcActions";
import { useCalcDraft } from "@/lib/useCalcDraft";
import { STEP_LABELS, firstInvalidBefore, stepErrors } from "@/lib/wizard";

export default function WizardPage() {
  const { id, step } = useParams<{ id: string; step: string }>();
  return <Wizard key={id} id={id} step={step} />;
}

function Wizard({ id, step }: { id: string; step: string }) {
  const router = useRouter();
  const { toast } = useUi();
  const draft = useCalcDraft(id);
  const act = useCalcActions(draft);
  const pricing = usePricing();
  const showErrors = useShowErrors();
  const s = Math.min(4, Math.max(1, parseInt(step, 10) || 1));
  const c = draft.calc;
  const current = pricing.data;

  useEffect(() => {
    if (draft.load === "missing") {
      toast("Kalkulace nenalezena");
      router.replace("/history");
    }
  }, [draft.load, router, toast]);

  // cizí kalkulace se v průvodci neupravují
  useEffect(() => {
    if (c && draft.readOnly) router.replace(`/calc/${id}`);
  }, [c, draft.readOnly, id, router]);

  // nelze přeskočit nevalidní kroky (např. ruční změna URL)
  useEffect(() => {
    if (!c || draft.readOnly) return;
    const bad = firstInvalidBefore(c, s);
    if (bad) {
      requestShowErrors();
      router.replace(`/wizard/${id}/${bad}`);
    }
  }, [c, s, id, router, draft.readOnly]);

  useEffect(() => clearShowErrors, []);

  if (!c || !current || draft.readOnly) return null;
  if (s > 1 && firstInvalidBefore(c, s)) return null;

  const q = quoteOf(c, current);
  const pat = patternOf(c, current);
  const saved = draft.persisted
    ? `${c.number ? "Změny uloženy" : "Koncept uložen"} ${fmtTime(c.updatedAt)}`
    : "Zatím neuloženo";

  function next() {
    const bad = stepErrors(c!, s);
    if (Object.keys(bad).length) {
      requestShowErrors();
      toast("Opravte označená pole");
      return;
    }
    clearShowErrors();
    router.push(`/wizard/${id}/${s + 1}`);
  }
  const back = () => router.push(s === 1 ? "/history" : `/wizard/${id}/${s - 1}`);

  return (
    <>
      <TopBar title={c.number ? "Úprava kalkulace" : "Nová kalkulace"} back="/history" saved={saved} />
      <div className="wiz-head">
        <div className="t"><span>Krok {s} ze 4 · <b>{STEP_LABELS[s - 1]}</b></span></div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={s} aria-label="Postup">
          <i style={{ width: `${s * 25}%` }} />
        </div>
      </div>
      {s < 4 && <PriceNotice draft={draft} current={current} onRecalc={act.recalc} />}
      {s === 1 && <StepStairs draft={draft} showErrors={showErrors} />}
      {s === 2 && <StepPattern draft={draft} current={current} showErrors={showErrors} />}
      {s === 3 && <StepJob draft={draft} showErrors={showErrors} />}
      {s === 4 && <CalcView draft={draft} act={act} current={current} inWizard />}
      <ActionBar
        info={formatM2(q.totalArea) + (pat ? ` · ${pat.name}` : " · vzor zatím nevybrán")}
        price={pat ? formatCZK(q.total) : "—"}
      >
        <BackButton onClick={back} />
        {s === 4 ? (
          <>
            <button className="btn sq" onClick={() => act.setMoreOpen(true)} aria-label="Další akce"><Icon name="more" size="lg" /></button>
            <button className="btn primary" onClick={act.save}>Uložit</button>
          </>
        ) : (
          <button className="btn primary" onClick={next}>Dál</button>
        )}
      </ActionBar>
      {s === 4 && <CalcSheets draft={draft} act={act} current={current} inWizard />}
    </>
  );
}
