"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet, SheetList } from "@/components/ui/Sheet";
import { useOwner } from "@/lib/hooks";
import { priceChanged } from "@/lib/quote";
import { fieldErrors, sendMailSchema } from "@/lib/schemas";
import type { CalcActions } from "@/lib/useCalcActions";
import type { CalcDraft } from "@/lib/useCalcDraft";
import type { Pricing } from "@/lib/types";

function SheetRow({ icon, label, onClick, href }: { icon: IconName; label: string; onClick?: () => void; href?: string }) {
  const inner = <span className="lead"><Icon name={icon} /><span className="k">{label}</span></span>;
  return href ? <Link className="lrow" href={href}>{inner}</Link> : <button type="button" className="lrow" onClick={onClick}>{inner}</button>;
}

/** Sheet „Akce“ (⋯) a sheet odeslání e-mailem. */
export function CalcSheets({
  draft, act, current, inWizard,
}: { draft: CalcDraft; act: CalcActions; current: Pricing; inWizard: boolean }) {
  const { calc, readOnly } = draft;
  if (!calc) return null;
  return (
    <>
      <Sheet open={act.moreOpen} onClose={() => act.setMoreOpen(false)}>
        <h2>Akce</h2>
        <SheetList>
          <SheetRow icon="pdf" label={readOnly ? "Zobrazit PDF" : "Stáhnout PDF"} onClick={() => { act.setMoreOpen(false); act.pdf(); }} />
          {!readOnly && <SheetRow icon="mail" label="Odeslat e-mailem" onClick={act.openMail} />}
          {!readOnly && !inWizard && <SheetRow icon="edit" label="Upravit kalkulaci" href={`/wizard/${calc.id}/1`} />}
          <SheetRow icon="copy" label={readOnly ? "Duplikovat do mých" : "Duplikovat"} onClick={act.duplicate} />
          <SheetRow icon="compare" label="Porovnat vzory" href={`/compare/${calc.id}`} />
          {!readOnly && priceChanged(calc, current) && (
            <SheetRow icon="refresh" label="Přepočítat podle aktuálního ceníku" onClick={act.recalc} />
          )}
          {!readOnly && calc.number && (
            <>
              <SheetRow icon="status" label="Označit jako přijato" onClick={() => act.setStatus("přijato")} />
              <SheetRow icon="x" label="Označit jako zamítnuto" onClick={() => act.setStatus("zamítnuto")} />
            </>
          )}
        </SheetList>
      </Sheet>
      <Sheet open={act.mailOpen} onClose={() => act.setMailOpen(false)}>
        <MailForm draft={draft} act={act} />
      </Sheet>
    </>
  );
}

function MailForm({ draft, act }: { draft: CalcDraft; act: CalcActions }) {
  const c = draft.calc!;
  const owner = useOwner(c.ownerId).data?.profile;
  const [to, setTo] = useState(c.sentTo ?? "");
  const [subject, setSubject] = useState(`Kalkulace obkladu schodiště č. ${c.number}`);
  const [body, setBody] = useState(
    `Dobrý den,\n\nv příloze zasíláme kalkulaci obkladu schodiště (${c.job.name}).\nV případě dotazů nás neváhejte kontaktovat.\n\nS pozdravem\n${owner?.name ?? ""}\n${owner?.company ?? ""}${owner?.phone ? "\n" + owner.phone : ""}`,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = sendMailSchema.safeParse({ to, subject, body });
    if (!r.success) return setErrors(fieldErrors(r.error));
    await act.sendMail(r.data);
  }

  return (
    <>
      <h2>Odeslat kalkulaci e-mailem</h2>
      <form onSubmit={submit} noValidate>
        <Field label="E-mail zákazníka" htmlFor="mt" error={errors.to}>
          <Input type="email" id="mt" name="to" inputMode="email" autoCapitalize="none" value={to} error={errors.to}
            onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Předmět" htmlFor="ms">
          <Input type="text" id="ms" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Text zprávy" htmlFor="mb">
          <Textarea id="mb" name="body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <p><span className="attach"><Icon name="pdf" size="sm" />Kalkulace-{c.number}.pdf</span></p>
        <p className="small muted">Prototyp e-mail neodešle – jen změní stav kalkulace na „Odesláno“.</p>
        <div className="dlg-foot">
          <button type="button" className="btn" onClick={() => act.setMailOpen(false)}>Zrušit</button>
          <button type="submit" className="btn primary"><Icon name="send" />Odeslat</button>
        </div>
      </form>
    </>
  );
}
