import type { Api } from "./client";
import { mockApi } from "./mock";

/** NEXT_PUBLIC_API=mock (výchozí) | http (později fetch('/api/…')). */
function select(): Api {
  const mode = process.env.NEXT_PUBLIC_API ?? "mock";
  if (mode === "mock") return mockApi;
  throw new Error(`API režim „${mode}“ zatím není implementován`);
}

export const api: Api = select();
export type { Api } from "./client";
