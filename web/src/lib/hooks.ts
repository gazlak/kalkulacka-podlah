"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export const keys = {
  me: ["me"] as const,
  calcs: ["calcs"] as const,
  calc: (id: string) => ["calc", id] as const,
  pricing: ["pricing"] as const,
  users: ["users"] as const,
  user: (id: string) => ["user", id] as const,
  patterns: ["patterns"] as const,
  rates: ["rates"] as const,
};

export function useSession() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.auth.me() });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await api.auth.logout();
    qc.clear();
    qc.setQueryData(keys.me, null);
    router.replace("/login");
  };
}

export function useCalcs() {
  return useQuery({ queryKey: keys.calcs, queryFn: () => api.calculations.list() });
}

export function usePricing() {
  return useQuery({ queryKey: keys.pricing, queryFn: () => api.pricing.current() });
}

export function useOwner(id: string | undefined) {
  return useQuery({ queryKey: keys.user(id ?? ""), queryFn: () => api.users.lookup(id!), enabled: !!id });
}

/** Po jakékoli změně kalkulace obnoví seznam i detail. */
export function useInvalidateCalcs() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: keys.calcs }), qc.invalidateQueries({ queryKey: ["calc"] })]);
}

export { useMutation };

/** Přihlášený uživatel se z login/forgot přesměruje do aplikace. Vrací true, když se smí formulář zobrazit. */
export function useGuestGuard(): boolean {
  const { data: user, isLoading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace("/history");
  }, [user, router]);
  return !isLoading && !user;
}
