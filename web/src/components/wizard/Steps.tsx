"use client";

import { useState } from "react";
import { comparePatterns, type GroupErrors } from "@/lib/calc";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { GroupCard } from "@/components/calc/GroupCard";
import { PatternTile } from "@/components/calc/PatternTile";
import { pricingOf } from "@/lib/quote";
import { newGroup } from "@/lib/defaults";
import { stepErrors, stepValid } from "@/lib/wizard";
import type { CalcDraft } from "@/lib/useCalcDraft";
import type { Pricing } from "@/lib/types";

type GField = "width" | "depth" | "riserHeight" | "count";

/** Krok 1: skupiny schodů. */
export function StepStairs({ draft, showErrors }: { draft: CalcDraft; showErrors: boolean }) {
  const c = draft.calc!;
  const [folded, setFolded] = useState<Record<number, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const all = stepErrors(c, 1).groups ?? {};

  const visible = (i: number): GroupErrors => {
    const e = all[i] ?? {};
    const out: GroupErrors = {};
    (Object.keys(e) as GField[]).forEach((f) => {
      if (showErrors || touched[`${i}.${f}`]) out[f] = e[f];
    });
    return out;
  };

  const setField = (i: number, f: GField, v: string) =>
    draft.update((x) => ({ ...x, groups: x.groups.map((g, j) => (j === i ? { ...g, [f]: v } : g)) }));

  return (
    <>
      <h1 className="wiz-title">Schody</h1>
      <p className="lead-text">Začněte rozměry schodů – cenu uvidíte hned dole. Schody stejných rozměrů zadejte jako jednu skupinu.</p>
      {c.groups.map((g, i) => (
        // Skupina nemá stabilní id; kalkulace se při mazání přeindexuje a sbalení se resetuje (jako v prototypu).
        <GroupCard
          key={i} g={g} index={i} total={c.groups.length}
          collapsed={!!folded[i] && !Object.keys(visible(i)).length}
          errors={visible(i)}
          onToggle={() => setFolded((f) => ({ ...f, [i]: !f[i] }))}
          onChange={(f, v) => setField(i, f, v)}
          onBlur={(f) => setTouched((t) => ({ ...t, [`${i}.${f}`]: true }))}
          onCover={(v) => draft.update((x) => ({ ...x, groups: x.groups.map((gg, j) => (j === i ? { ...gg, coverRiser: v } : gg)) }))}
          onDelete={() => {
            setFolded({});
            setTouched({});
            draft.update((x) => ({ ...x, groups: x.groups.filter((_, j) => j !== i) }));
          }}
        />
      ))}
      <button
        className="btn block"
        onClick={() => {
          // dřívější skupiny se sbalí, nová je otevřená
          setFolded(Object.fromEntries(c.groups.map((_, i) => [i, true])));
          draft.update((x) => ({ ...x, groups: [...x.groups, newGroup()] }));
        }}
      >
        <Icon name="plus" />Přidat skupinu
      </button>
    </>
  );
}

/** Krok 2: výběr vzoru. */
export function StepPattern({ draft, current, showErrors }: { draft: CalcDraft; current: Pricing; showErrors: boolean }) {
  const c = draft.calc!;
  const pr = pricingOf(c, current);
  const cmp = stepValid(c, 1) ? comparePatterns(c.groups, pr, c.discount, c.vatRate, c.extras) : null;
  const min = cmp ? Math.min(...cmp.map((x) => x.quote.total)) : null;
  const err = showErrors ? stepErrors(c, 2).pattern : undefined;
  return (
    <>
      <h1 className="wiz-title">Vzor obkladu</h1>
      <p className="lead-text">Cena u vzoru je orientační celek s DPH pro vaše schody.</p>
      <div className="tiles" role="radiogroup" aria-label="Vzor">
        {pr.patterns.map((p, i) => (
          <PatternTile
            key={p.id} pattern={p} selected={c.patternId === p.id}
            total={cmp ? cmp[i].quote.total : null} cheapest={!!cmp && cmp[i].quote.total === min}
            onPick={() => draft.update((x) => ({ ...x, patternId: p.id }))}
          />
        ))}
      </div>
      <div className="err" role="alert">{c.patternId ? "" : err}</div>
    </>
  );
}

/** Krok 3: zakázka. */
export function StepJob({ draft, showErrors }: { draft: CalcDraft; showErrors: boolean }) {
  const c = draft.calc!;
  const [touched, setTouched] = useState(false);
  const err = showErrors || touched ? stepErrors(c, 3).name : undefined;
  const set = (k: keyof typeof c.job) => (v: string) => draft.update((x) => ({ ...x, job: { ...x.job, [k]: v } }));
  return (
    <>
      <h1 className="wiz-title">Zakázka</h1>
      <p className="lead-text">Údaje pro kalkulaci a PDF. Název je předvyplněný, stačí přepsat.</p>
      <div className="card">
        <Field label="Název zakázky *" htmlFor="jn" error={err}>
          <Input type="text" id="jn" name="name" value={c.job.name} error={err} placeholder="např. Rodinný dům Novákovi" autoComplete="off"
            onChange={(e) => set("name")(e.target.value)} onBlur={() => setTouched(true)} />
        </Field>
        <Field label="Zákazník" optional="(volitelné)" htmlFor="jc">
          <Input type="text" id="jc" value={c.job.customer} autoComplete="off" onChange={(e) => set("customer")(e.target.value)} />
        </Field>
        <Field label="Adresa" optional="(volitelné)" htmlFor="ja">
          <Input type="text" id="ja" value={c.job.address} autoComplete="off" onChange={(e) => set("address")(e.target.value)} />
        </Field>
        <Field label="Poznámka" optional="(volitelné)" htmlFor="jt" flush>
          <Textarea id="jt" value={c.job.note} onChange={(e) => set("note")(e.target.value)} />
        </Field>
      </div>
    </>
  );
}
