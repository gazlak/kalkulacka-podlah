import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function MailBox({ to, subject, attach, children }: { to: string; subject: string; attach?: string; children: ReactNode }) {
  return (
    <div className="mail">
      <div className="hd">
        <div><b>Komu:</b> {to}</div>
        <div><b>Předmět:</b> {subject}</div>
      </div>
      {children}
      {attach && <p><span className="attach"><Icon name="pdf" size="sm" />{attach}</span></p>}
    </div>
  );
}
