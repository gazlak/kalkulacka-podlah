"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Role } from "@/lib/types";

export function TabBar({ role }: { role: Role }) {
  const path = usePathname();
  const tab = (href: string, icon: IconName, label: string, on: boolean, cls = "") => (
    <Link href={href} className={`${cls}${on ? " active" : ""}`.trim()} aria-current={on ? "page" : undefined}>
      <span className="pl"><Icon name={icon} size="lg" /></span>
      <span>{label}</span>
    </Link>
  );
  return (
    <nav className="tabbar" aria-label="Hlavní navigace">
      {tab("/history", "list", "Kalkulace", /^\/(history|calc|compare)/.test(path))}
      {tab("/new", "plus", "Nová", false, "fab")}
      {tab("/profile", "user", "Profil", /^\/profile/.test(path))}
      {role === "admin" && tab("/admin/users", "settings", "Správa", /^\/admin/.test(path))}
    </nav>
  );
}
