"use client";

import { createContext, useContext, type ReactNode } from "react";

interface Hosts {
  top: HTMLElement | null;
  bar: HTMLElement | null;
}
export const ChromeContext = createContext<Hosts>({ top: null, bar: null });
export const useChromeHosts = () => useContext(ChromeContext);

export function ChromeContextProvider({ value, children }: { value: Hosts; children: ReactNode }) {
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}
