"use client";

import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { useMutation } from "@tanstack/react-query";

export function useGoogleRegistrationCompleteMutation() {
  const deps = useAppDependencies();
  return useMutation({
    mutationFn: ({
      registrationToken,
      phone,
      code,
    }: {
      registrationToken: string;
      phone: string;
      code: string;
    }) => deps.authGateway.googleComplete(registrationToken, phone, code),
  });
}
