"use client";

import { Button } from "@presentation/components/ui/button";
import { Input } from "@presentation/components/ui/input";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import { useAuthStore } from "@presentation/state/auth-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminLogin } from "./admin-api";

export function AdminLoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const roles = useAuthStore((s) => s.roles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && roles?.includes("ADMIN")) {
      router.replace("/admin");
    }
  }, [isAuthenticated, roles, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const session = await adminLogin({
        email: email.trim().toLowerCase(),
        password,
      });
      setSession(session);
      router.push("/admin");
    } catch (err) {
      setError(domainErrorMessage(err, "Admin login failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-catalog-surface px-4 py-10 text-catalog-text">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-catalog-border bg-card shadow-sm">
        <div className="h-1 bg-catalog-green" />
        <form className="space-y-5 p-6 sm:p-8" onSubmit={onSubmit}>
          <header>
            <p className="text-xs font-bold uppercase tracking-wide text-catalog-green">
              PackRush Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-catalog-text">
              Sign in to operations
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-catalog-text-muted">
              Use your admin email and password. OTP login is only for buyer
              accounts.
            </p>
          </header>

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            required
          />

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
