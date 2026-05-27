import type { AuthSession } from "@application/ports/auth-session";
import type { OtpGateway } from "@application/ports/otp-gateway";
import { DomainError } from "@domain/errors";
import { apiJsonPost } from "@infrastructure/http/http-client";

type ApiUser = {
  id: string;
  phone: string | null;
  roles: AuthSession["roles"];
  isOnboardingCompleted?: boolean;
};
type VerifyOtpBody = {
  accessToken: string;
  user: ApiUser;
};
type ApiEnvelope<T> = { data: T };

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function sessionFromVerifyBody(body: VerifyOtpBody): AuthSession {
  return {
    accessToken: body.accessToken,
    userId: body.user.id,
    phone: body.user.phone,
    roles: body.user.roles,
    isOnboardingCompleted: body.user.isOnboardingCompleted ?? false,
  };
}

export function createHttpOtpGateway(baseUrl: string): OtpGateway {
  return {
    async requestOtp(phone: string): Promise<void> {
      await apiJsonPost<{ expiresInSeconds: number }>(
        baseUrl,
        "/api/auth/send-otp",
        { phone },
      );
    },
    async verifyOtp(phone: string, code: string): Promise<AuthSession | null> {
      try {
        const body = await apiJsonPost<VerifyOtpBody | ApiEnvelope<VerifyOtpBody>>(
          baseUrl,
          "/api/auth/verify-otp",
          { phone, code },
        );
        return sessionFromVerifyBody(unwrapBody(body));
      } catch (e) {
        if (e instanceof DomainError && e.code === "UNAUTHORIZED") {
          return null;
        }
        throw e;
      }
    },
  };
}
