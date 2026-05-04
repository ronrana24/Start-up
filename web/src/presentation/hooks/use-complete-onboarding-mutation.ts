"use client";

import { completeOnboarding } from "@application/use-cases/complete-onboarding";
import type { CompleteOnboardingInput } from "@application/use-cases/complete-onboarding";
import { DomainError } from "@domain/errors";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { useAuthStore } from "@presentation/state/auth-store";
import { useMutation } from "@tanstack/react-query";

export function useCompleteOnboardingMutation() {
  const deps = useAppDependencies();

  return useMutation({
    mutationFn: async (input: Omit<CompleteOnboardingInput, "accessToken">) => {
      const { accessToken, isAuthenticated } = useAuthStore.getState();
      if (!isAuthenticated) {
        throw new DomainError("UNAUTHORIZED", "Sign in required");
      }
      return completeOnboarding(deps, { ...input, accessToken });
    },
  });
}
