"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useChromeHosts } from "./ChromeProvider";

/** Spodní sticky lišta s cenou a akcemi (místo tab baru). */
export function ActionBar({ info, price, children }: { info?: ReactNode; price?: ReactNode; children: ReactNode }) {
  const { bar } = useChromeHosts();
  if (!bar) return null;
  return createPortal(
    <div className="actionbar stickybar">
      <div className="inner">
        {(info !== undefined || price !== undefined) && (
          <div className="price">
            <span className="pi">{info}</span>
            <span className="nowrap">Celkem s DPH <strong>{price}</strong></span>
          </div>
        )}
        <div className="btns">{children}</div>
      </div>
    </div>,
    bar,
  );
}

export function BackButton({ href, onClick }: { href?: string; onClick?: () => void }) {
  return href ? (
    <Link className="btn sq" href={href} aria-label="Zpět"><Icon name="back" size="lg" /></Link>
  ) : (
    <button className="btn sq" onClick={onClick} aria-label="Zpět"><Icon name="back" size="lg" /></button>
  );
}
