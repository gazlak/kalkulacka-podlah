import type { StairGroup } from "./types";

/** Výchozí hodnoty = typické rozměry (zrychlení cíle „do 2 minut“). */
export const newGroup = (): StairGroup => ({ width: 100, depth: 28, riserHeight: 17, count: 1, coverRiser: true });
