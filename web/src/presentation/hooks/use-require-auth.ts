"use client";

import { useAuthStore } from "@presentation/state/auth-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireAuth(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const router = useRouter();

  useEffect(() => {
    if (hasCheckedSession && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasCheckedSession, isAuthenticated, router]);

  return hasCheckedSession && isAuthenticated;
}
