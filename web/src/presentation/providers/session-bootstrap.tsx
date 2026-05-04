"use client";

import { DomainError } from "@domain/errors";
import { apiJsonAuthorized } from "@infrastructure/http/http-client";
import { useAuthStore } from "@presentation/state/auth-store";
import { useEffect } from "react";

type ApiUser = {
  id: string;
  phone: string | null;
  role: "BUYER" | "ADMIN" | "RIDER";
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

function readApiMode(): "mock" | "http" {
  const raw = process.env.NEXT_PUBLIC_API_MODE?.toLowerCase();
  return raw === "http" ? "http" : "mock";
}

function readApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
}

export function SessionBootstrap() {
  const setSession = useAuthStore((s) => s.setSession);
  const markSessionChecked = useAuthStore((s) => s.markSessionChecked);

  useEffect(() => {
    if (readApiMode() !== "http") {
      markSessionChecked();
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const user = unwrapBody(
          await apiJsonAuthorized<ApiUser | ApiEnvelope<ApiUser>>(
            readApiBaseUrl(),
            "/api/users/me",
            {
              method: "GET",
              accessToken: null,
            },
          ),
        );
        if (cancelled) return;
        setSession({
          accessToken: null,
          userId: user.id,
          phone: user.phone,
          role: user.role,
        });
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
  }, [markSessionChecked, setSession]);

  return null;
}
