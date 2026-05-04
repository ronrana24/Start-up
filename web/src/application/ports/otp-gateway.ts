import type { AuthSession } from "@application/ports/auth-session";

export interface OtpGateway {
  requestOtp(phone: string): Promise<void>;
  /** Returns session on success, or null if the code is invalid. */
  verifyOtp(phone: string, code: string): Promise<AuthSession | null>;
}
