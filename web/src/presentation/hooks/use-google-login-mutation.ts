"use client";

import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { useMutation } from "@tanstack/react-query";

export function useGoogleLoginMutation() {
  const deps = useAppDependencies();
  return useMutation({
    mutationFn: (idToken: string) => deps.authGateway.loginWithGoogle(idToken),
  });
}
