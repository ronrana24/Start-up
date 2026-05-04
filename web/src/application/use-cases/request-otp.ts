import type { AppDependencies } from "@application/app-dependencies";
import { DomainError } from "@domain/errors";

export async function requestOtp(
  deps: AppDependencies,
  phone: string,
): Promise<void> {
  const normalized = phone.trim();
  if (normalized.length < 8) {
    throw new DomainError("INVALID_INPUT", "Enter a valid phone number");
  }
  await deps.otpGateway.requestOtp(normalized);
}
