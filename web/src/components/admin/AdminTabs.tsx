"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["users", "Uživatelé"], ["patterns", "Vzory"], ["rates", "Sazby"]] as const;

export function AdminTabs() {
  const path = usePathname();
  return (
    <>
      <h1 className="large-title">Správa</h1>
      <div className="seg full mb no-print" role="tablist">
        {TABS.map(([k, label]) => {
          const on = path === `/admin/${k}`;
          return (
            <Link key={k} href={`/admin/${k}`} role="tab" className={on ? "on" : undefined} aria-selected={on}>
              {label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
