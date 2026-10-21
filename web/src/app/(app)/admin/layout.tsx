"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUi } from "@/components/ui/UiProvider";
import { useSession } from "@/lib/hooks";

/** Guard role admin. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: user } = useSession();
  const router = useRouter();
  const { toast } = useUi();
  const allowed = user?.role === "admin";

  useEffect(() => {
    if (user && !allowed) {
      toast("Tato část je jen pro správce");
      router.replace("/history");
    }
  }, [user, allowed, router, toast]);

  return allowed ? <>{children}</> : null;
}
