import type { ReactNode } from "react";

/** Auth obrazovky bez lišt, napůl: formulář vlevo, od 860 px vpravo panel s fotkou schodů a logem. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="app" className="split">
      <div className="split-wrap">
        <div className="split-form">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo split-logo" src="/img/kprodukt-logo.png" alt="K-Produkt" />
          {children}
        </div>
        <aside className="split-glow" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="glow-photo" src="/img/login-schody.jpg" alt="" />
          <i /><i /><i /><i />
          <div className="glow-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/kprodukt-logo-dark.png" alt="" />
            <p>Kalkulačka schodů</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
