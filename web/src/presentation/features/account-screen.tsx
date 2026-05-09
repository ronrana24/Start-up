"use client";

import type {
  CreateUserAddressInput,
  UserAddress,
  UserProfile,
} from "@application/ports/user-profile-gateway";
import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import { LinkButton } from "@presentation/components/ui/link-button";
import { Select } from "@presentation/components/ui/select";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { useAppDependencies } from "@presentation/context/app-dependencies-context";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import {
  MAX_ADDRESS_LINE_LEN,
  MAX_CITY_STATE_LEN,
  validateIndianPincode,
} from "@presentation/lib/onboarding-validation";
import { useAuthStore } from "@presentation/state/auth-store";
import { City, State } from "country-state-city";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type IconProps = { className?: string };

const IN = "IN";

type AddressFormState = CreateUserAddressInput & {
  stateIso: string;
};

type AddressFieldErrors = Partial<
  Record<"line1" | "line2" | "stateIso" | "city" | "pincode", string>
>;

const emptyAddressForm: AddressFormState = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  stateIso: "",
  pincode: "",
  isDefault: false,
};

function StoreIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 9 1.4-5h15.2L21 9" />
      <path d="M5 9v10h14V9" />
      <path d="M9 19v-5h6v5" />
      <path d="M3 9h18" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function LocationIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-7-4.4-7-11a7 7 0 0 1 14 0c0 6.6-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function TruckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 18V6H3v12h2" />
      <path d="M15 18H9" />
      <path d="M14 9h4l3 4v5h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function ReceiptIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 3v18l3-2 2 2 3-2 3 2 2-2 3 2V3Z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function HistoryIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function HeadsetIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v4a2 2 0 0 0 2 2h1v-8H6a2 2 0 0 0-2 2Z" />
      <path d="M20 13v4a2 2 0 0 1-2 2h-1v-8h1a2 2 0 0 1 2 2Z" />
      <path d="M16 19c0 1.1-1.8 2-4 2" />
    </svg>
  );
}

function SignOutIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 17 15 12l-5-5" />
      <path d="M15 12H3" />
      <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
    </svg>
  );
}

function PlusIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function profileFallback(
  phone: string | null,
  userId: string | null,
): UserProfile {
  return {
    id: userId ?? "B2B-PENDING",
    phone,
    email: null,
    name: null,
    businessName: "Wholesale Business",
    businessType: "OTHER",
    gstNumber: null,
    isOnboardingCompleted: false,
    role: "BUYER",
    addresses: [],
  };
}

function businessTypeLabel(type: UserProfile["businessType"]): string {
  if (type === "RESTAURANT") return "Restaurant";
  if (type === "EVENT_PLANNER") return "Event planner";
  return "Other business";
}

function formatBusinessId(id: string): string {
  return `#B2B-${id.slice(-6).toUpperCase()}`;
}

function addressSummary(address: UserAddress): string {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

function AccountRow({
  href,
  icon,
  title,
  subtitle,
  trailing,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 border-b border-default/50 p-4 last:border-b-0 hover:bg-secondary-bg/70"
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-heading group-hover:text-primary">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <ChevronRightIcon className="h-4 w-4 text-muted" />
      </div>
    </Link>
  );
}

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-default bg-card shadow-sm">
      <div className="border-b border-default/50 bg-secondary-bg/70 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-default/50 bg-secondary-bg/70 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 min-h-5 break-words text-sm font-semibold text-heading">
        {value}
      </p>
    </div>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const deps = useAppDependencies();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const phone = useAuthStore((s) => s.phone);
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearSession = useAuthStore((s) => s.clearSession);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressForm, setAddressForm] =
    useState<AddressFormState>(emptyAddressForm);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressFieldErrors, setAddressFieldErrors] =
    useState<AddressFieldErrors>({});
  const [addressSaving, setAddressSaving] = useState(false);

  useEffect(() => {
    if (!hasCheckedSession || !isAuthenticated) return;
    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setProfileError(null);
      try {
        const next = await deps.userProfileGateway.getProfile(accessToken);
        if (cancelled) return;
        setProfile(next);
        setAddresses(next.addresses ?? []);
      } catch (error) {
        if (cancelled) return;
        setProfile(profileFallback(phone, userId));
        setProfileError(domainErrorMessage(error, "Could not load profile"));
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    deps.userProfileGateway,
    hasCheckedSession,
    isAuthenticated,
    phone,
    userId,
  ]);

  const effectiveProfile = useMemo(
    () => profile ?? profileFallback(phone, userId),
    [phone, profile, userId],
  );
  const indianStates = useMemo(() => State.getStatesOfCountry(IN), []);
  const addressCities = useMemo(() => {
    if (!addressForm.stateIso) return [];
    return City.getCitiesOfState(IN, addressForm.stateIso);
  }, [addressForm.stateIso]);

  if (!hasCheckedSession) {
    return (
      <div className="space-y-3">
        <MobilePageHeader title="Account" fallbackHref="/" />
        <div className="h-28 animate-pulse rounded-xl bg-secondary-bg" />
        <div className="h-40 animate-pulse rounded-xl bg-secondary-bg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-4">
        <MobilePageHeader title="Account" fallbackHref="/" />
        <Card>
          <p className="text-sm text-secondary">
            Sign in with your phone to manage your account, saved addresses, and
            orders.
          </p>
          <LinkButton href="/login" className="mt-4" fullWidth>
            Sign in
          </LinkButton>
        </Card>
      </div>
    );
  }

  function updateAddressField<K extends keyof AddressFormState>(
    key: K,
    value: AddressFormState[K],
  ) {
    setAddressForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "stateIso") {
        const selectedState = indianStates.find(
          (state) => state.isoCode === String(value),
        );
        next.state = selectedState?.name ?? "";
        next.city = "";
      }
      return next;
    });
    setAddressFieldErrors({});
    setAddressError(null);
  }

  function validateAddressForm(): string | null {
    const errors: AddressFieldErrors = {};
    const line1 = addressForm.line1.trim();
    const line2 = addressForm.line2?.trim() ?? "";
    const city = addressForm.city.trim();

    if (!line1) {
      errors.line1 = "Street address is required";
    } else if (line1.length > MAX_ADDRESS_LINE_LEN) {
      errors.line1 = `Street address must be ${MAX_ADDRESS_LINE_LEN} characters or less`;
    }
    if (line2.length > MAX_ADDRESS_LINE_LEN) {
      errors.line2 = `Line 2 must be ${MAX_ADDRESS_LINE_LEN} characters or less`;
    }
    if (!addressForm.stateIso || !addressForm.state.trim()) {
      errors.stateIso = "Select a state";
    }
    if (!city) {
      errors.city = "Select a city";
    } else if (city.length > MAX_CITY_STATE_LEN) {
      errors.city = `City must be ${MAX_CITY_STATE_LEN} characters or less`;
    }
    if (!validateIndianPincode(addressForm.pincode)) {
      errors.pincode = "Enter a valid 6-digit PIN code";
    }

    setAddressFieldErrors(errors);
    return Object.keys(errors).length > 0
      ? "Please complete the required address fields."
      : null;
  }

  async function submitAddress(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateAddressForm();
    if (validation) {
      setAddressError(validation);
      return;
    }

    setAddressSaving(true);
    setAddressError(null);
    try {
      const created = await deps.userProfileGateway.createAddress(accessToken, {
        line1: addressForm.line1.trim(),
        line2: addressForm.line2?.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode.trim(),
        isDefault: addressForm.isDefault || addresses.length === 0,
      });
      setAddresses((current) => {
        const rest = created.isDefault
          ? current.map((address) => ({ ...address, isDefault: false }))
          : current;
        return [created, ...rest];
      });
      setAddressForm(emptyAddressForm);
      setAddressFieldErrors({});
      setAddressFormOpen(false);
    } catch (error) {
      setAddressError(domainErrorMessage(error, "Could not add address"));
    } finally {
      setAddressSaving(false);
    }
  }

  return (
    <div className="relative flex w-full min-w-0 flex-col gap-0 text-catalog-text">
      <MobilePageHeader title="Account" fallbackHref="/" />

      <section className="-mx-4 border-b border-catalog-border/60 bg-card p-4 sm:mx-0 sm:mt-2 sm:rounded-xl sm:border">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-catalog-green/20 bg-catalog-input text-catalog-green">
            <StoreIcon className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight text-catalog-text">
              {loadingProfile
                ? "Loading business..."
                : effectiveProfile.businessName}
            </h1>
            <p className="mt-1 text-xs text-catalog-text-muted">
              ID: {formatBusinessId(effectiveProfile.id)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-catalog-green/20 bg-catalog-green-muted px-2 py-0.5 text-[10px] font-bold text-catalog-green">
                Verified Business
              </span>
              <span className="rounded-full border border-catalog-border bg-catalog-surface px-2 py-0.5 text-[10px] font-bold text-catalog-text-muted">
                Read-only profile
              </span>
            </div>
          </div>
        </div>
        {profileError ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-heading">
            {profileError}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-4 px-0 py-4">
        <SectionShell title="Business Profile">
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            <ReadOnlyField
              label="Business name"
              value={effectiveProfile.businessName}
            />
            <ReadOnlyField
              label="Business type"
              value={businessTypeLabel(effectiveProfile.businessType)}
            />
            <ReadOnlyField
              label="Phone"
              value={effectiveProfile.phone ?? "Not available"}
            />
            <ReadOnlyField
              label="GST number"
              value={effectiveProfile.gstNumber || "Not added"}
            />
          </div>
        </SectionShell>

        <SectionShell title="Ordering & Logistics">
          <AccountRow
            href="/orders/history"
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-catalog-blue-light/40 text-catalog-blue">
                <HistoryIcon className="h-4 w-4" />
              </span>
            }
            title="Order History"
            subtitle="Review past orders, reorder, and download invoices"
          />
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 border-b border-default/50 p-4 text-left hover:bg-secondary-bg/70"
            onClick={() => setAddressFormOpen((open) => !open)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-catalog-blue-light/40 text-catalog-blue">
                <LocationIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">
                  Saved Addresses
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted">
                  {addresses.length} delivery{" "}
                  {addresses.length === 1 ? "location" : "locations"}
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-primary">
              <PlusIcon className="h-4 w-4" />
              Add
            </span>
          </button>
          <div className="space-y-3 p-4">
            {addresses.length > 0 ? (
              addresses.map((address) => (
                <div
                  key={address.id}
                  className="rounded-lg border border-default/60 bg-secondary-bg/70 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-heading">
                      {address.line1}
                    </p>
                    {address.isDefault ? (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] leading-relaxed text-secondary">
                    {addressSummary(address)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-default px-3 py-4 text-center text-xs text-muted">
                No saved addresses yet.
              </p>
            )}

            {addressFormOpen ? (
              <form
                className="space-y-3 rounded-xl border border-catalog-green/20 bg-primary-light/30 p-3"
                onSubmit={submitAddress}
              >
                <Input
                  label="Street / building *"
                  value={addressForm.line1}
                  onChange={(e) => updateAddressField("line1", e.target.value)}
                  placeholder="Street, building, unit"
                  error={addressFieldErrors.line1}
                  required
                />
                <Input
                  label="Line 2 (optional)"
                  value={addressForm.line2 ?? ""}
                  onChange={(e) => updateAddressField("line2", e.target.value)}
                  placeholder="Suite, floor, landmark"
                  error={addressFieldErrors.line2}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    label="State *"
                    name="stateIso"
                    value={addressForm.stateIso}
                    onChange={(e) =>
                      updateAddressField("stateIso", e.target.value)
                    }
                    error={addressFieldErrors.stateIso}
                    required
                  >
                    <option value="">Select state</option>
                    {indianStates.map((state) => (
                      <option key={state.isoCode} value={state.isoCode}>
                        {state.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="City *"
                    name="city"
                    value={addressForm.city}
                    onChange={(e) => updateAddressField("city", e.target.value)}
                    disabled={!addressForm.stateIso}
                    error={addressFieldErrors.city}
                    required
                  >
                    <option value="">
                      {addressForm.stateIso
                        ? "Select city"
                        : "Select state first"}
                    </option>
                    {addressCities.map((city, index) => (
                      <option
                        key={`${city.name}-${city.latitude ?? ""}-${city.longitude ?? ""}-${index}`}
                        value={city.name}
                      >
                        {city.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  label="PIN code *"
                  value={addressForm.pincode}
                  onChange={(e) =>
                    updateAddressField("pincode", e.target.value)
                  }
                  placeholder="560001"
                  inputMode="numeric"
                  maxLength={6}
                  error={addressFieldErrors.pincode}
                  required
                />
                <label className="flex items-center gap-2 text-xs font-medium text-heading">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-default text-primary focus:ring-primary/30"
                    checked={Boolean(addressForm.isDefault)}
                    onChange={(e) =>
                      updateAddressField("isDefault", e.target.checked)
                    }
                  />
                  Make this the default delivery address
                </label>
                {addressError ? (
                  <p className="text-xs text-red-600" role="alert">
                    {addressError}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setAddressFormOpen(false);
                      setAddressError(null);
                      setAddressFieldErrors({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={addressSaving}
                  >
                    {addressSaving ? "Saving..." : "Save address"}
                  </Button>
                </div>
              </form>
            ) : null}

            {/* <div className="flex items-center gap-3 rounded-lg border border-default/60 bg-secondary-bg/70 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-catalog-blue-light/40 text-catalog-blue">
                <TruckIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-heading">
                  Delivery Preferences
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  Receiving counter, instant delivery, and same-day windows
                </p>
              </div>
            </div> */}
          </div>
        </SectionShell>

        <SectionShell title="Billing & Finance">
          <AccountRow
            href="/orders/history"
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-catalog-green-muted text-catalog-green">
                <ReceiptIcon className="h-4 w-4" />
              </span>
            }
            title="Invoices & Statements"
            subtitle="Open order history to download invoice PDFs"
            trailing={
              effectiveProfile.gstNumber ? (
                <span className="h-2 w-2 rounded-full bg-primary" />
              ) : null
            }
          />
        </SectionShell>

        <div className="space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/contact"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-default bg-card text-xs font-semibold text-heading shadow-sm hover:bg-secondary-bg"
            >
              <HeadsetIcon className="h-4 w-4 text-catalog-blue" />
              Support
            </Link>
            <button
              type="button"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-default bg-card text-xs font-semibold text-heading shadow-sm hover:bg-secondary-bg"
              onClick={() => {
                void deps.authGateway.logout().finally(() => {
                  clearSession();
                  router.push("/login");
                });
              }}
            >
              <SignOutIcon className="h-4 w-4 text-red-500" />
              Log out
            </button>
          </div>
          <div className="flex justify-center gap-3 text-[10px] text-muted">
            <Link href="/privacy" className="hover:text-primary">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-primary">
              Terms of Service
            </Link>
            <span>·</span>
            <span>v0.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
