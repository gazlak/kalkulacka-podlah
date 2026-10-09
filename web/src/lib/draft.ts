import { useSyncExternalStore } from "react";
import type { Calculation } from "./types";

/* Nová kalkulace žije jen v paměti, dokud ji uživatel první změnou neuloží. */
let pending: Calculation | null = null;

export const setPendingDraft = (c: Calculation | null) => { pending = c; };
export const getPendingDraft = (id: string) => (pending && pending.id === id ? pending : null);

/* Zobrazení chyb v průvodci (po pokusu o pokračování nebo přesměrování na nevalidní krok). */
let showErrors = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const requestShowErrors = () => { showErrors = true; emit(); };
export const clearShowErrors = () => { if (showErrors) { showErrors = false; emit(); } };
export function useShowErrors(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => showErrors,
    () => false,
  );
}
