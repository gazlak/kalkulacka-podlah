import { validateGroup, type GroupErrors } from "./calc";
import { jobSchema } from "./schemas";
import type { Calculation } from "./types";

export const STEP_LABELS = ["Schody", "Vzor", "Zakázka", "Kalkulace"] as const;

export interface StepErrors {
  groups?: Record<number, GroupErrors>;
  pattern?: string;
  name?: string;
}

/** Chyby daného kroku (1 schody, 2 vzor, 3 zakázka); prázdné = OK. */
export function stepErrors(c: Calculation, s: number): StepErrors {
  if (s === 1) {
    const groups: Record<number, GroupErrors> = {};
    c.groups.forEach((g, i) => {
      const e = validateGroup(g);
      if (Object.keys(e).length) groups[i] = e;
    });
    return Object.keys(groups).length ? { groups } : {};
  }
  if (s === 2) return c.patternId ? {} : { pattern: "Vyberte jeden vzor" };
  if (s === 3) {
    const r = jobSchema.shape.name.safeParse(c.job.name);
    return r.success ? {} : { name: r.error.issues[0].message };
  }
  return {};
}

export const stepValid = (c: Calculation, s: number) => Object.keys(stepErrors(c, s)).length === 0;
export const allValid = (c: Calculation) => [1, 2, 3].every((s) => stepValid(c, s));
/** První nevalidní krok před krokem `before` (nebo null). */
export function firstInvalidBefore(c: Calculation, before: number): number | null {
  for (let s = 1; s < before; s++) if (!stepValid(c, s)) return s;
  return null;
}
