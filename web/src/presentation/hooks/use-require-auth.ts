"use client";

import { useAuthStore } from "@presentation/state/auth-store";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireAuth(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const isOnboardingCompleted = useAuthStore((s) => s.isOnboardingCompleted);
  const role = useAuthStore((s) => s.role);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hasCheckedSession) {
      return;
    }
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (
      role !== "ADMIN" &&
      !isOnboardingCompleted &&
      pathname !== "/onboarding"
    ) {
      router.replace("/onboarding");
    }
  }, [
    hasCheckedSession,
    isAuthenticated,
    isOnboardingCompleted,
    pathname,
    role,
    router,
  ]);

  return (
    hasCheckedSession &&
    isAuthenticated &&
    (role === "ADMIN" || isOnboardingCompleted || pathname === "/onboarding")
  );
}
