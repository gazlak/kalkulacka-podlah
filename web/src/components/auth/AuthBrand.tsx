import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function AuthBrand({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="auth-brand">
      <div className="logo-mark"><Icon name="stairs" /></div>
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
    </div>
  );
}
