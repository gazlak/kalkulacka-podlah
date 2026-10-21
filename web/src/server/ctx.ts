import type { Calculation } from "@/lib/types";
import { getDb, type Db } from "./db";
import { createMailer, type Mailer } from "./mail";

export interface Actor {
  id: string;
  role: "user" | "admin";
}

/** Závislosti služeb – v provozu skutečné, v testech podstrčené. */
export interface Ctx {
  db: Db;
  mailer: Mailer;
  /** Vyrenderuje PDF kalkulace (Chromium). */
  renderPdf: (calc: Calculation) => Promise<Buffer>;
}

const g = globalThis as unknown as { __ctx?: Ctx };

export function getCtx(): Ctx {
  g.__ctx ??= {
    db: getDb(),
    mailer: createMailer(),
    renderPdf: async (calc) => (await import("./pdf")).renderCalcPdf(calc),
  };
  return g.__ctx;
}
