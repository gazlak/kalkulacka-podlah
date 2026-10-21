"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChromeContextProvider } from "@/components/chrome/ChromeProvider";
import { TabBar } from "@/components/chrome/TabBar";
import { useSession } from "@/lib/hooks";

// Obrazovky se spodní akční lištou místo tab baru: průvodce, detail kalkulace, PDF.
const HAS_BAR = /^\/(wizard|calc)\//;
const WIDE = /^\/(compare|admin\/(users|patterns))/;

export default function AppLayout({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [top, setTop] = useState<HTMLElement | null>(null);
  const [bar, setBar] = useState<HTMLElement | null>(null);
  const hasBar = HAS_BAR.test(path);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    const cl = document.body.classList;
    cl.toggle("has-bar", !!user && hasBar);
    cl.toggle("has-tabs", !!user && !hasBar);
    return () => cl.remove("has-bar", "has-tabs");
  }, [user, hasBar]);

  if (!user) return null;

  return (
    <ChromeContextProvider value={{ top, bar }}>
      <header className="topbar" ref={setTop} />
      <main id="app" className={WIDE.test(path) ? "wide" : ""}>{children}</main>
      {!hasBar && <TabBar role={user.role} />}
      <div ref={setBar} />
    </ChromeContextProvider>
  );
}
