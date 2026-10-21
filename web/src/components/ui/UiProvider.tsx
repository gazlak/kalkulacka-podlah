"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sheet } from "./Sheet";

interface ConfirmOptions {
  title: string;
  text: string;
  okLabel: string;
  danger?: boolean;
}
interface Ui {
  toast: (msg: string) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const v = useContext(UiContext);
  if (!v) throw new Error("UiProvider chybí");
  return v;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false, staleTime: 0 } } }),
  );
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [conf, setConf] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback((text: string) => {
    setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setConf({ ...o, resolve })),
    [],
  );
  const answer = (v: boolean) => {
    conf?.resolve(v);
    setConf(null);
  };

  const ui = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <QueryClientProvider client={client}>
      <UiContext.Provider value={ui}>
        {children}
        <div id="toast" role="status" aria-live="polite">
          {msg && <div key={msg.n}>{msg.text}</div>}
        </div>
        <Sheet open={!!conf} onClose={() => answer(false)}>
          {conf && (
            <>
              <h2>{conf.title}</h2>
              <p className="muted">{conf.text}</p>
              <div className="dlg-foot">
                <button className="btn" onClick={() => answer(false)}>Zrušit</button>
                <button className={`btn ${conf.danger ? "danger fill" : "primary"}`} onClick={() => answer(true)}>
                  {conf.okLabel}
                </button>
              </div>
            </>
          )}
        </Sheet>
      </UiContext.Provider>
    </QueryClientProvider>
  );
}
