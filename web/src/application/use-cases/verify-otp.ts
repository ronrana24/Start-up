import type { AppDependencies } from "@application/app-dependencies";
import type { AuthSession } from "@application/ports/auth-session";
import { DomainError } from "@domain/errors";

export async function verifyOtp(
  deps: AppDependencies,
  phone: string,
  code: string,
): Promise<AuthSession> {
  const normalizedPhone = phone.trim();
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new DomainError("INVALID_OTP", "Enter the 6-digit code");
  }
  const session = await deps.otpGateway.verifyOtp(normalizedPhone, normalizedCode);
  if (!session) {
    throw new DomainError("INVALID_OTP", "Invalid verification code");
  }
  return session;
}
