import type { Api } from "./client";
import { httpApi } from "./http";
import { mockApi } from "./mock";

/** NEXT_PUBLIC_API=mock (výchozí) | http (fetch('/api/…') nad Route Handlery). */
function select(): Api {
  const mode = process.env.NEXT_PUBLIC_API ?? "mock";
  if (mode === "mock") return mockApi;
  if (mode === "http") return httpApi;
  throw new Error(`API režim „${mode}“ je neznámý`);
}

export const api: Api = select();
export type { Api } from "./client";
