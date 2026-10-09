"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUi } from "@/components/ui/UiProvider";
import { api } from "@/lib/api";
import { requestShowErrors } from "@/lib/draft";
import { keys } from "@/lib/hooks";
import { statusLabel } from "@/components/ui/misc";
import type { SendMailInput } from "@/lib/api/client";
import type { CalcStatus } from "@/lib/types";
import type { CalcDraft } from "./useCalcDraft";
import { allValid, firstInvalidBefore } from "./wizard";

/** Akce nad kalkulací sdílené mezi krokem 4 průvodce a detailem. */
export function useCalcActions(draft: CalcDraft) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast, confirm } = useUi();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const { calc, readOnly } = draft;

  const refreshList = () => qc.invalidateQueries({ queryKey: keys.calcs });

  /** Přidělí číslo a uzamkne ceník (jen vlastník). */
  async function ensureSaved() {
    if (!calc) return;
    if (!draft.persisted) draft.update((c) => c);
    await draft.flush();
    const r = await api.calculations.finalize(calc.id);
    draft.replace(r);
    refreshList();
    return r;
  }

  async function save() {
    if (!calc || readOnly) return;
    const bad = firstInvalidBefore(calc, 4);
    if (bad) {
      requestShowErrors();
      return router.push(`/wizard/${calc.id}/${bad}`);
    }
    try {
      const wasNew = !calc.number;
      const r = await ensureSaved();
      toast(wasNew && r ? `Uloženo jako kalkulace č. ${r.number}` : "Změny uloženy");
      router.push(`/calc/${calc.id}`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function pdf() {
    if (!calc) return;
    if (!allValid(calc)) return toast("Nejprve dokončete kalkulaci");
    try {
      if (!readOnly) await ensureSaved();
      router.push(`/calc/${calc.id}/pdf`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function duplicate() {
    if (!calc) return;
    setMoreOpen(false);
    const n = await api.calculations.duplicate(calc.id);
    refreshList();
    toast("Vytvořena kopie jako koncept – s aktuálním ceníkem");
    router.push(`/wizard/${n.id}/1`);
  }

  async function recalc() {
    if (!calc || readOnly) return;
    setMoreOpen(false);
    const ok = await confirm({
      title: "Přepočítat kalkulaci?",
      text: "Kalkulace se přepočítá podle aktuálního ceníku. Původní ceny se přepíšou.",
      okLabel: "Přepočítat",
    });
    if (!ok) return;
    await draft.flush();
    draft.replace(await api.calculations.recalc(calc.id));
    refreshList();
    toast("Přepočítáno podle aktuálního ceníku");
  }

  async function setStatus(s: CalcStatus) {
    if (!calc || readOnly) return;
    setMoreOpen(false);
    await draft.flush();
    draft.replace(await api.calculations.setStatus(calc.id, s));
    refreshList();
    toast("Stav: " + statusLabel(s).toLowerCase());
  }

  async function openMail() {
    if (!calc || readOnly) return;
    setMoreOpen(false);
    if (!allValid(calc)) return toast("Nejprve dokončete kalkulaci");
    try {
      await ensureSaved();
      setMailOpen(true);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function sendMail(mail: SendMailInput) {
    if (!calc) return;
    draft.replace(await api.calculations.send(calc.id, mail));
    refreshList();
    setMailOpen(false);
    toast(`Kalkulace odeslána na ${mail.to.trim()} (demo)`);
  }

  return { moreOpen, setMoreOpen, mailOpen, setMailOpen, save, pdf, duplicate, recalc, setStatus, openMail, sendMail };
}

export type CalcActions = ReturnType<typeof useCalcActions>;
