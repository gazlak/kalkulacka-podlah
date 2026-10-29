import type { ReactNode } from "react";

/** Nadpis auth obrazovky; logo nese rozvržení `(auth)/layout.tsx`. */
export function AuthBrand({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="auth-head">
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}
