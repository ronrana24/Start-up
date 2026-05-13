"use client";

import type { CreateUserAddressInput } from "@application/ports/user-profile-gateway";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import {
  isIndianE164,
  validateBusinessName,
  validateGstInOptional,
} from "@presentation/lib/onboarding-validation";
import { useCompleteOnboardingMutation } from "@presentation/hooks/use-complete-onboarding-mutation";
import { useAuthStore } from "@presentation/state/auth-store";
import { useOnboardingStore } from "@presentation/state/onboarding-store";
import { State } from "country-state-city";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  OnboardingAddressStep,
  getInitialAddressForm,
  type AddressFormState,
} from "@presentation/features/onboarding/onboarding-address-step";
import {
  OnboardingBusinessStep,
  type BusinessFormState,
} from "@presentation/features/onboarding/onboarding-business-step";
import { OnboardingStepper } from "@presentation/features/onboarding/onboarding-stepper";
import { OnboardingSuccessStep } from "@presentation/features/onboarding/onboarding-success-step";
import { OnboardingWelcomeStep } from "@presentation/features/onboarding/onboarding-welcome-step";

const defaultBusiness: BusinessFormState = {
  businessName: "",
  businessType: "FOOD_AND_BEVERAGE",
  gstNumber: "",
};

export function OnboardingScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const phone = useAuthStore((s) => s.phone);
  const completed = useAuthStore((s) => s.isOnboardingCompleted);
  const markOnboardingCompleted = useAuthStore(
    (s) => s.markOnboardingCompleted,
  );
  const complete = useOnboardingStore((s) => s.complete);
  const onboardingMutation = useCompleteOnboardingMutation();

  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<BusinessFormState>(defaultBusiness);
  const [address, setAddress] = useState<AddressFormState>(() =>
    getInitialAddressForm(),
  );
  const [businessErrors, setBusinessErrors] = useState<
    Partial<Record<"businessName" | "gstNumber", string>>
  >({});

  useEffect(() => {
    if (hasCheckedSession && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hasCheckedSession, isAuthenticated, router]);

  useEffect(() => {
    if (completed) {
      router.replace("/");
    }
  }, [completed, router]);

  function buildProfilePayload() {
    const payload: {
      businessName: string;
      businessType: BusinessFormState["businessType"];
      gstNumber?: string | null;
    } = {
      businessName: business.businessName.trim(),
      businessType: business.businessType,
    };
    const gst = business.gstNumber.trim();
    if (gst) {
      payload.gstNumber = gst.toUpperCase();
    }
    return payload;
  }

  function buildAddressPayload(): CreateUserAddressInput {
    const india = isIndianE164(phone);
    const stateName = india
      ? (State.getStatesOfCountry("IN").find(
          (s) => s.isoCode === address.stateIso,
        )?.name ?? "")
      : address.stateText.trim();
    const cityName = india ? address.cityName.trim() : address.cityText.trim();
    if (!address.pinnedLocation) {
      throw new Error("Pin your exact delivery location on the map");
    }
    return {
      line1: address.line1.trim(),
      ...(address.line2.trim() ? { line2: address.line2.trim() } : {}),
      city: cityName,
      state: stateName,
      pincode: address.pincode.trim(),
      latitude: address.pinnedLocation.latitude,
      longitude: address.pinnedLocation.longitude,
      locationAccuracyMeters:
        address.pinnedLocation.locationAccuracyMeters ?? null,
      locationSource: address.pinnedLocation.locationSource,
      isDefault: true,
    };
  }

  async function handleAddressSubmit() {
    onboardingMutation.reset();
    try {
      await onboardingMutation.mutateAsync({
        profile: buildProfilePayload(),
        address: buildAddressPayload(),
      });
      setStep(3);
    } catch {
      /* surfaced via mutation.error */
    }
  }

  const submitError = onboardingMutation.isError
    ? domainErrorMessage(
        onboardingMutation.error,
        "Could not save your details",
      )
    : null;

  function handleBusinessNext() {
    const name = business.businessName.trim();
    const nameErr = validateBusinessName(name);
    const gstErr = validateGstInOptional(business.gstNumber);
    if (nameErr || gstErr) {
      setBusinessErrors({
        ...(nameErr ? { businessName: nameErr } : {}),
        ...(gstErr ? { gstNumber: gstErr } : {}),
      });
      return;
    }
    setBusinessErrors({});
    onboardingMutation.reset();
    setStep(2);
  }

  function handleFinish() {
    markOnboardingCompleted();
    complete();
    router.push("/catalog");
  }

  const showStepper = step < 3;

  if (!hasCheckedSession || !isAuthenticated || completed) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-page px-4">
        <div className="h-28 w-full max-w-sm animate-pulse rounded-card border border-default bg-card shadow-soft" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-page">
      <div className="flex flex-1 flex-col px-4 py-8">
        {showStepper ? (
          <OnboardingStepper activeIndex={step} total={3} />
        ) : null}

        <div className="flex flex-1 flex-col justify-center pt-2">
          {step === 0 ? (
            <OnboardingWelcomeStep onNext={() => setStep(1)} />
          ) : null}

          {step === 1 ? (
            <OnboardingBusinessStep
              value={business}
              onChange={(next) => {
                setBusiness(next);
                setBusinessErrors({});
              }}
              onNext={handleBusinessNext}
              onBack={() => setStep(0)}
              fieldErrors={businessErrors}
            />
          ) : null}

          {step === 2 ? (
            <OnboardingAddressStep
              phone={phone}
              value={address}
              onChange={setAddress}
              onBack={() => {
                onboardingMutation.reset();
                setStep(1);
              }}
              onSubmit={handleAddressSubmit}
              isSubmitting={onboardingMutation.isPending}
              submitError={submitError}
              onClearSubmitError={() => onboardingMutation.reset()}
            />
          ) : null}

          {step === 3 ? (
            <OnboardingSuccessStep onFinish={handleFinish} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
