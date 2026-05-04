"use client";

import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { useMutation } from "@tanstack/react-query";

export function useGoogleRegistrationSendOtpMutation() {
  const deps = useAppDependencies();
  return useMutation({
    mutationFn: ({
      registrationToken,
      phone,
    }: {
      registrationToken: string;
      phone: string;
    }) => deps.authGateway.googleSendOtp(registrationToken, phone),
  });
}
