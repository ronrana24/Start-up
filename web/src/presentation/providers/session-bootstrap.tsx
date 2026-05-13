"use client";

import { DomainError } from "@domain/errors";
import { apiJsonAuthorized } from "@infrastructure/http/http-client";
import { useAuthStore } from "@presentation/state/auth-store";
import { useOnboardingStore } from "@presentation/state/onboarding-store";
import { useEffect } from "react";

type ApiUser = {
  id: string;
  phone: string | null;
  role: "BUYER" | "ADMIN" | "RIDER";
  isOnboardingCompleted: boolean;
};

type ApiEnvelope<T> = {
  data: T;
};

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function readApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
}

export function SessionBootstrap() {
  const setSession = useAuthStore((s) => s.setSession);
  const markSessionChecked = useAuthStore((s) => s.markSessionChecked);
  const setOnboardingCompleted = useOnboardingStore((s) => s.setCompleted);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const user = unwrapBody(
          await apiJsonAuthorized<ApiUser | ApiEnvelope<ApiUser>>(
            readApiBaseUrl(),
            "/api/users/me",
            {
              method: "GET",
            },
          ),
        );
        if (cancelled) return;
        setSession({
          accessToken: null,
          userId: user.id,
          phone: user.phone,
          role: user.role,
          isOnboardingCompleted: user.isOnboardingCompleted,
        });
        setOnboardingCompleted(user.isOnboardingCompleted);
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DomainError && error.code === "UNAUTHORIZED")
        ) {
          return;
        }
      } finally {
        if (!cancelled) {
          markSessionChecked();
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [markSessionChecked, setOnboardingCompleted, setSession]);

  return null;
}
