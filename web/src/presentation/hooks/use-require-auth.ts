"use client";

import { useAuthStore } from "@presentation/state/auth-store";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireAuth(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const isOnboardingCompleted = useAuthStore((s) => s.isOnboardingCompleted);
  const roles = useAuthStore((s) => s.roles);
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
      !roles?.includes("ADMIN") &&
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
    roles,
    router,
  ]);

  return (
    hasCheckedSession &&
    isAuthenticated &&
    (roles?.includes("ADMIN") || isOnboardingCompleted || pathname === "/onboarding")
  );
}
