"use client";

import { verifyOtp } from "@application/use-cases/verify-otp";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { useMutation } from "@tanstack/react-query";

export function useVerifyOtpMutation() {
  const deps = useAppDependencies();
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      verifyOtp(deps, phone, code),
  });
}
