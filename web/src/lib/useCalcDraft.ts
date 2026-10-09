"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUi } from "@/components/ui/UiProvider";
import { api } from "@/lib/api";
import { getPendingDraft, setPendingDraft } from "@/lib/draft";
import { keys, useSession } from "@/lib/hooks";
import type { Calculation } from "@/lib/types";

type Load = "loading" | "ready" | "missing";

/**
 * Pracovní kopie kalkulace s autosavem. Změny se hned projeví lokálně a ukládají se po řadě přes API.
 * Číslo, snapshot ceníku, stav a odeslání spravuje server – po uložení se přebírají z odpovědi.
 */
export function useCalcDraft(id: string) {
  const qc = useQueryClient();
  const { toast } = useUi();
  const { data: me } = useSession();
  const [calc, setCalc] = useState<Calculation | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [persisted, setPersisted] = useState(false);
  const latest = useRef<Calculation | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let alive = true;
    api.calculations.get(id).then((stored) => {
      if (!alive) return;
      const c = stored ?? getPendingDraft(id);
      if (!c) return setLoad("missing");
      latest.current = c;
      setCalc(c);
      setPersisted(!!stored);
      setLoad("ready");
    });
    return () => { alive = false; };
  }, [id]);

  const replace = useCallback((c: Calculation) => {
    latest.current = c;
    setCalc(c);
  }, []);

  const update = useCallback((mutate: (c: Calculation) => Calculation) => {
    const cur = latest.current;
    if (!cur) return;
    const next = { ...mutate(cur), updatedAt: Date.now() };
    replace(next);
    queue.current = queue.current
      .then(() => api.calculations.save(next))
      .then((r) => {
        setPersisted(true);
        setPendingDraft(null);
        // serverem spravovaná pole
        const merged = { ...latest.current!, number: r.number, snapshot: r.snapshot, status: r.status, sentTo: r.sentTo };
        replace(merged);
        qc.invalidateQueries({ queryKey: keys.calcs });
      })
      .catch((e: Error) => toast(e.message));
  }, [qc, replace, toast]);

  /** Počká na dokončení všech rozdělaných uložení. */
  const flush = useCallback(async () => {
    await queue.current;
  }, []);

  const readOnly = !!calc && !!me && calc.ownerId !== me.id;
  return { calc, load, persisted, readOnly, update, replace, flush };
}

export type CalcDraft = ReturnType<typeof useCalcDraft>;
