"use client";

import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import { PhoneWithCountryField } from "@presentation/components/phone-with-country-field";
import {
  DEFAULT_COUNTRY_ISO,
  buildE164FromIsoAndNational,
  validateGoogleRegistrationPhone,
} from "@presentation/lib/country-dial-options";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import { cn } from "@presentation/lib/cn";
import { useGoogleLoginMutation } from "@presentation/hooks/use-google-login-mutation";
import { useGoogleRegistrationSendOtpMutation } from "@presentation/hooks/use-google-registration-send-otp-mutation";
import { useGoogleRegistrationCompleteMutation } from "@presentation/hooks/use-google-registration-complete-mutation";
import { useAuthStore } from "@presentation/state/auth-store";
import { useOnboardingStore } from "@presentation/state/onboarding-store";
import { GoogleSignInSection } from "@presentation/features/google-sign-in-section";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type FlowMode = "pick" | "google_phone" | "google_otp";

function ShieldTrustIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-10 w-10 shrink-0 text-primary", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function AuthLoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnboardingCompleted = useAuthStore((s) => s.isOnboardingCompleted);
  const [mode, setMode] = useState<FlowMode>("pick");
  const [otp, setOtp] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | null>(
    null,
  );
  const [googleProfileEmail, setGoogleProfileEmail] = useState<string | null>(
    null,
  );
  const [googlePhoneCountryIso, setGooglePhoneCountryIso] =
    useState<string>(DEFAULT_COUNTRY_ISO);
  const [googlePhoneNational, setGooglePhoneNational] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const googleLogin = useGoogleLoginMutation();
  const googleSendOtp = useGoogleRegistrationSendOtpMutation();
  const googleComplete = useGoogleRegistrationCompleteMutation();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(isOnboardingCompleted ? "/" : "/onboarding");
    }
  }, [isAuthenticated, isOnboardingCompleted, router]);

  function goToPick() {
    setMode("pick");
    setOtp("");
    setFormError(null);
    setRegistrationToken(null);
    setGoogleProfileEmail(null);
    setGooglePhoneCountryIso(DEFAULT_COUNTRY_ISO);
    setGooglePhoneNational("");
  }

  async function onGoogleCredential(idToken: string) {
    setFormError(null);
    try {
      const result = await googleLogin.mutateAsync(idToken);
      setGoogleBusy(false);
      if (result.kind === "authenticated") {
        setSession(result.session);
        useOnboardingStore
          .getState()
          .setCompleted(result.session.isOnboardingCompleted);
        router.push(result.session.isOnboardingCompleted ? "/" : "/onboarding");
        return;
      }
      setRegistrationToken(result.registrationToken);
      setGoogleProfileEmail(result.profile.email);
      setGooglePhoneCountryIso(DEFAULT_COUNTRY_ISO);
      setGooglePhoneNational("");
      setMode("google_phone");
    } catch (err) {
      setFormError(domainErrorMessage(err, "Google sign-in failed"));
      setGoogleBusy(false);
    }
  }

  async function onGoogleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!registrationToken) return;
    setFormError(null);
    const invalid = validateGoogleRegistrationPhone(
      googlePhoneCountryIso,
      googlePhoneNational,
    );
    if (invalid) {
      setFormError(invalid);
      return;
    }
    const phoneE164 = buildE164FromIsoAndNational(
      googlePhoneCountryIso,
      googlePhoneNational,
    );
    try {
      await googleSendOtp.mutateAsync({ registrationToken, phone: phoneE164 });
      setMode("google_otp");
    } catch (err) {
      setFormError(domainErrorMessage(err, "Could not send code"));
    }
  }

  async function onGoogleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!registrationToken) return;
    setFormError(null);
    const invalid = validateGoogleRegistrationPhone(
      googlePhoneCountryIso,
      googlePhoneNational,
    );
    if (invalid) {
      setFormError(invalid);
      return;
    }
    const phoneE164 = buildE164FromIsoAndNational(
      googlePhoneCountryIso,
      googlePhoneNational,
    );
    try {
      const session = await googleComplete.mutateAsync({
        registrationToken,
        phone: phoneE164,
        code: otp,
      });
      setSession(session);
      useOnboardingStore.getState().setCompleted(session.isOnboardingCompleted);
      router.push(session.isOnboardingCompleted ? "/" : "/onboarding");
    } catch (err) {
      setFormError(domainErrorMessage(err, "Verification failed"));
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md space-y-6 p-6 sm:p-8">
        <header className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light p-2 ring-1 ring-default">
            <Image
              src="/grove-mark.svg"
              alt="Grove"
              width={40}
              height={40}
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">
            Grove
          </h1>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-secondary">
            Wholesale disposable goods for teams that need reliable quality on
            every delivery.
          </p>
        </header>

        {mode === "pick" ? (
          <div className="flex flex-col gap-3">
            <GoogleSignInSection
              googleBusy={googleBusy}
              setGoogleBusy={setGoogleBusy}
              onCredentialSuccess={(idToken) => {
                void onGoogleCredential(idToken);
              }}
              onCredentialMissing={() => {
                setFormError("Missing Google credential. Try again.");
              }}
              onGoogleSdkError={() => {
                setFormError("Google sign-in was interrupted.");
              }}
            />
            {formError && mode === "pick" ? (
              <p
                className="text-center text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "google_phone" ? (
          <form className="flex flex-col gap-4" onSubmit={onGoogleSendCode}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-heading">
                Verify your mobile
              </h2>
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                onClick={goToPick}
              >
                Cancel
              </button>
            </div>
            {googleProfileEmail ? (
              <p className="text-xs text-secondary">
                Signed in as{" "}
                <span className="font-medium text-heading">
                  {googleProfileEmail}
                </span>
                . Add your business mobile to finish setup.
              </p>
            ) : null}
            <PhoneWithCountryField
              countryIso={googlePhoneCountryIso}
              nationalDigits={googlePhoneNational}
              onCountryIsoChange={setGooglePhoneCountryIso}
              onNationalDigitsChange={setGooglePhoneNational}
              error={formError ?? undefined}
              disabled={googleSendOtp.isPending}
            />
            <Button type="submit" fullWidth disabled={googleSendOtp.isPending}>
              {googleSendOtp.isPending ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : null}

        {mode === "google_otp" ? (
          <form className="flex flex-col gap-4" onSubmit={onGoogleVerify}>
            <Input
              label="One-time code"
              name="otp"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              error={formError ?? undefined}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setMode("google_phone");
                  setOtp("");
                  setFormError(null);
                }}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={googleComplete.isPending}
              >
                {googleComplete.isPending ? "Verifying…" : "Verify"}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="mx-auto flex max-w-sm flex-row items-center justify-center gap-4 border-t border-default pt-6">
          <ShieldTrustIcon />
          <p className="text-left text-xs leading-relaxed text-secondary">
            To protect our B2B relationship, we verify your mobile number before
            you can place orders with us.
          </p>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted">
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="text-primary underline underline-offset-2"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-primary underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
