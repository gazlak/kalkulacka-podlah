"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useChromeHosts } from "./ChromeProvider";

/** Horní lišta; obsah se přes portál vykreslí do <header class="topbar"> v layoutu. */
export function TopBar({
  title = "Kalkulačka schodů", back, saved, action,
}: { title?: string; back?: string; saved?: string; action?: ReactNode }) {
  const { top } = useChromeHosts();
  if (!top) return null;
  return createPortal(
    <>
      {back && (
        <Link className="icon-btn" href={back} aria-label="Zpět">
          <Icon name="back" size="lg" />
        </Link>
      )}
      <div className={`tt${back ? " has-back" : ""}`}>{title}</div>
      {saved !== undefined && <span className="saved-ind">{saved}</span>}
      {action}
    </>,
    top,
  );
}
