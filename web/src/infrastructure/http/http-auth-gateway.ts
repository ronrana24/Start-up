import type { AuthGateway } from "@application/ports/auth-gateway";
import type { AuthSession } from "@application/ports/auth-session";
import { apiJsonPost } from "@infrastructure/http/http-client";

type ApiUser = {
  id: string;
  phone: string | null;
  role: AuthSession["role"];
  isOnboardingCompleted?: boolean;
};
type ApiEnvelope<T> = { data: T };

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function sessionFromUser(accessToken: string | null, user: ApiUser): AuthSession {
  return {
    accessToken,
    userId: user.id,
    phone: user.phone,
    role: user.role,
    isOnboardingCompleted: user.isOnboardingCompleted ?? false,
  };
}

type GoogleLoginApiResponse =
  | {
      message: "authenticated";
      accessToken: string;
      user: ApiUser;
    }
  | {
      message: "needs_phone";
      registrationToken: string;
      profile: { email: string; name?: string; picture?: string };
    };

export function createHttpAuthGateway(baseUrl: string): AuthGateway {
  return {
    async loginWithGoogle(idToken: string) {
      const data = unwrapBody(
        await apiJsonPost<GoogleLoginApiResponse | ApiEnvelope<GoogleLoginApiResponse>>(
          baseUrl,
          "/api/auth/google",
          { idToken },
        ),
      );
      if (data.message === "authenticated") {
        return {
          kind: "authenticated" as const,
          session: sessionFromUser(data.accessToken, data.user),
        };
      }
      return {
        kind: "needs_phone" as const,
        registrationToken: data.registrationToken,
        profile: data.profile,
      };
    },
    async googleSendOtp(
      registrationToken: string,
      phone: string,
    ): Promise<void> {
      await apiJsonPost(baseUrl, "/api/auth/google/send-otp", {
        registrationToken,
        phone,
      });
    },
    async googleComplete(
      registrationToken: string,
      phone: string,
      code: string,
    ): Promise<AuthSession> {
      const body = unwrapBody(
        await apiJsonPost<
          | { accessToken: string; user: ApiUser }
          | ApiEnvelope<{ accessToken: string; user: ApiUser }>
        >(baseUrl, "/api/auth/google/complete", {
          registrationToken,
          phone,
          code,
        }),
      );
      return sessionFromUser(body.accessToken, body.user);
    },
    async logout(): Promise<void> {
      await apiJsonPost(baseUrl, "/api/auth/logout", {});
    },
  };
}
