"use client";

import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import { Select } from "@presentation/components/ui/select";
import {
  isIndianE164,
  MAX_ADDRESS_LINE_LEN,
  MAX_CITY_STATE_LEN,
  validateIndianPincode,
  validateNonIndianPincode,
} from "@presentation/lib/onboarding-validation";
import { City, State } from "country-state-city";
import { useMemo, useState } from "react";

const IN = "IN";

export type AddressFormState = {
  line1: string;
  line2: string;
  pincode: string;
  /** India: state ISO from country-state-city */
  stateIso: string;
  /** India: city name */
  cityName: string;
  /** Outside India */
  cityText: string;
  stateText: string;
};

const initialAddress: AddressFormState = {
  line1: "",
  line2: "",
  pincode: "",
  stateIso: "",
  cityName: "",
  cityText: "",
  stateText: "",
};

type OnboardingAddressStepProps = {
  phone: string | null;
  value: AddressFormState;
  onChange: (next: AddressFormState) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  onClearSubmitError: () => void;
};

export function getInitialAddressForm(): AddressFormState {
  return { ...initialAddress };
}

export function OnboardingAddressStep({
  phone,
  value,
  onChange,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
  onClearSubmitError,
}: OnboardingAddressStepProps) {
  const isIndia = isIndianE164(phone);

  const inStates = useMemo(() => State.getStatesOfCountry(IN), []);

  const cities = useMemo(() => {
    if (!value.stateIso) return [];
    return City.getCitiesOfState(IN, value.stateIso);
  }, [value.stateIso]);

  const [localErrors, setLocalErrors] = useState<Partial<Record<string, string>>>({});

  function patch<K extends keyof AddressFormState>(key: K, v: AddressFormState[K]) {
    if (submitError) onClearSubmitError();
    const next = { ...value, [key]: v };
    if (key === "stateIso") {
      next.cityName = "";
    }
    onChange(next);
    setLocalErrors({});
  }

  function validate(): boolean {
    const err: Partial<Record<string, string>> = {};
    const line1t = value.line1.trim();
    if (!line1t) {
      err.line1 = "Street address is required";
    } else if (line1t.length > MAX_ADDRESS_LINE_LEN) {
      err.line1 = `Street address must be ${MAX_ADDRESS_LINE_LEN} characters or less`;
    }

    const line2t = value.line2.trim();
    if (line2t.length > MAX_ADDRESS_LINE_LEN) {
      err.line2 = `Line 2 must be ${MAX_ADDRESS_LINE_LEN} characters or less`;
    }

    if (isIndia) {
      if (!value.stateIso) err.stateIso = "Select a state";
      if (!value.cityName) err.city = "Select a city";
      else if (value.cityName.length > MAX_CITY_STATE_LEN) {
        err.city = `City must be ${MAX_CITY_STATE_LEN} characters or less`;
      }
      if (!validateIndianPincode(value.pincode)) {
        err.pincode = "Enter a valid 6-digit PIN code";
      }
    } else {
      const cityT = value.cityText.trim();
      const stateT = value.stateText.trim();
      if (!cityT) err.cityText = "City is required";
      else if (cityT.length > MAX_CITY_STATE_LEN) {
        err.cityText = `City must be ${MAX_CITY_STATE_LEN} characters or less`;
      }
      if (!stateT) err.stateText = "State or region is required";
      else if (stateT.length > MAX_CITY_STATE_LEN) {
        err.stateText = `State or region must be ${MAX_CITY_STATE_LEN} characters or less`;
      }
      if (!validateNonIndianPincode(value.pincode)) {
        err.pincode = "Enter a valid postal code (4–10 characters)";
      }
    }
    setLocalErrors(err);
    return Object.keys(err).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit();
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-heading">Delivery address</h1>
        <p className="mt-1 text-sm text-secondary">
          {isIndia
            ? "We use this for tax and delivery routing in India."
            : "We use this for delivery and order documents."}
        </p>
      </div>

      <Card className="space-y-4 p-5 shadow-sm">
        <Input
          label="Street / building *"
          name="line1"
          value={value.line1}
          onChange={(e) => patch("line1", e.target.value)}
          placeholder="Street, building, unit"
          error={localErrors.line1}
        />
        <Input
          label="Line 2 (optional)"
          name="line2"
          value={value.line2}
          onChange={(e) => patch("line2", e.target.value)}
          placeholder="Suite, floor, landmark"
          error={localErrors.line2}
        />

        {isIndia ? (
          <>
            <Select
              label="State *"
              name="stateIso"
              value={value.stateIso}
              onChange={(e) => patch("stateIso", e.target.value)}
              error={localErrors.stateIso}
            >
              <option value="">Select state</option>
              {inStates.map((s) => (
                <option key={s.isoCode} value={s.isoCode}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              label="City *"
              name="cityName"
              value={value.cityName}
              onChange={(e) => patch("cityName", e.target.value)}
              disabled={!value.stateIso}
              error={localErrors.city}
            >
              <option value="">{value.stateIso ? "Select city" : "Select state first"}</option>
              {cities.map((c, i) => (
                <option
                  key={`${c.name}-${c.latitude ?? ""}-${c.longitude ?? ""}-${i}`}
                  value={c.name}
                >
                  {c.name}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <>
            <Input
              label="City *"
              name="cityText"
              value={value.cityText}
              onChange={(e) => patch("cityText", e.target.value)}
              error={localErrors.cityText}
            />
            <Input
              label="State / region *"
              name="stateText"
              value={value.stateText}
              onChange={(e) => patch("stateText", e.target.value)}
              error={localErrors.stateText}
            />
          </>
        )}

        <Input
          label={isIndia ? "PIN code *" : "Postal code *"}
          name="pincode"
          value={value.pincode}
          onChange={(e) => patch("pincode", e.target.value)}
          inputMode={isIndia ? "numeric" : "text"}
          maxLength={isIndia ? 6 : 10}
          error={localErrors.pincode}
        />
      </Card>

      {submitError ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}
