"use client";

import { requestOtp } from "@application/use-cases/request-otp";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { useMutation } from "@tanstack/react-query";

export function useRequestOtpMutation() {
  const deps = useAppDependencies();
  return useMutation({
    mutationFn: (phone: string) => requestOtp(deps, phone),
  });
}
