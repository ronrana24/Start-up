"use client";

import { useAuthStore } from "@presentation/state/auth-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ShopOnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnboardingCompleted = useAuthStore((s) => s.isOnboardingCompleted);
  const role = useAuthStore((s) => s.role);
  const router = useRouter();
  const requiresOnboarding =
    hasCheckedSession &&
    isAuthenticated &&
    role !== "ADMIN" &&
    !isOnboardingCompleted;

  useEffect(() => {
    if (requiresOnboarding) {
      router.replace("/onboarding");
    }
  }, [requiresOnboarding, router]);

  if (requiresOnboarding) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="h-28 w-full max-w-sm animate-pulse rounded-card border border-default bg-card shadow-soft" />
      </main>
    );
  }

  return <>{children}</>;
}
