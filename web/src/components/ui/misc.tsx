import type { ReactNode } from "react";
import type { CalcStatus } from "@/lib/types";
import { Icon } from "./Icon";

export const statusLabel = (s: string) => s[0].toUpperCase() + s.slice(1);

export function StatusBadge({ status }: { status: CalcStatus }) {
  return <span className={`badge st-${status}`}>{statusLabel(status)}</span>;
}

export function Alert({ kind, children, className }: { kind: "info" | "warn" | "ok" | "err"; children: ReactNode; className?: string }) {
  return (
    <div className={`alert ${kind}${className ? " " + className : ""}`} role={kind === "err" ? "alert" : undefined}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="inbox" className="art" />
      {children}
    </div>
  );
}

export function initials(u: { email: string; profile: { name: string } }): string {
  const n = u.profile.name || u.email || "?";
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

export function Row({ k, sub, v, cls }: { k: ReactNode; sub?: ReactNode; v: ReactNode; cls?: string }) {
  return (
    <div className={`lrow ${cls ?? ""}`}>
      <span className="k">{k}{sub ? <small>{sub}</small> : null}</span>
      <span className="v">{v}</span>
    </div>
  );
}
