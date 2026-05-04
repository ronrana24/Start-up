"use client";

import { cn } from "@presentation/lib/cn";
import {
  COUNTRY_DIAL_OPTIONS,
  type CountryDialOption,
  findCountryByIso,
} from "@presentation/lib/country-dial-options";

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 8 4 4 4-4" />
    </svg>
  );
}

export type PhoneWithCountryFieldProps = {
  countryIso: string;
  nationalDigits: string;
  onCountryIsoChange: (iso: string) => void;
  onNationalDigitsChange: (digits: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
};

export function PhoneWithCountryField({
  countryIso,
  nationalDigits,
  onCountryIsoChange,
  onNationalDigitsChange,
  label = "Phone number",
  error,
  disabled,
}: PhoneWithCountryFieldProps) {
  const country =
    findCountryByIso(countryIso) ??
    (COUNTRY_DIAL_OPTIONS[0] as CountryDialOption);
  const maxNational = country.nationalMax;

  function handleNationalChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, maxNational);
    onNationalDigitsChange(digits);
  }

  return (
    <div className="flex w-full flex-col gap-2 text-sm">
      {label ? (
        <span className="font-medium leading-snug text-heading">{label}</span>
      ) : null}

      <div
        className={cn(
          "flex min-h-11 w-full items-stretch overflow-hidden rounded-lg border border-input-border transition-[border-color,box-shadow]",
          "focus-within:border-border-focus focus-within:ring-2 focus-within:ring-primary/20",
          error &&
            "border-red-400 focus-within:border-red-400 focus-within:ring-red-200",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <label className="sr-only" htmlFor="phone-country-dial">
          Country code
        </label>
        <div
          className={cn(
            "relative h-11 shrink-0",
            "bg-disabled-bg",
          )}
        >
          <select
            id="phone-country-dial"
            value={country.iso}
            disabled={disabled}
            aria-label="Country code"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              const nextIso = e.target.value;
              onCountryIsoChange(nextIso);
              const nextCountry = findCountryByIso(nextIso);
              if (nextCountry && nationalDigits.length > nextCountry.nationalMax) {
                onNationalDigitsChange(nationalDigits.slice(0, nextCountry.nationalMax));
              }
            }}
            className={cn(
              "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0",
              "disabled:cursor-not-allowed",
            )}
          >
            {COUNTRY_DIAL_OPTIONS.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.flag} +{c.dial} ({c.iso})
              </option>
            ))}
          </select>

          <div
            className="pointer-events-none flex h-full items-center justify-center gap-2 px-2"
            aria-hidden
          >
            <span className="text-lg leading-none">{country.flag}</span>
            <span className="text-xs tabular-nums text-muted">+{country.dial}</span>
            <span className="text-xs font-semibold tabular-nums tracking-wide text-muted">({country.iso})</span>
            <span className="text-muted"><ChevronDown className="h-4 w-4 shrink-0" /></span>
          </div>
        </div>

        <div
          className="w-px shrink-0 self-stretch bg-input-border"
          aria-hidden
        />

        <label className="sr-only" htmlFor="phone-national">
          Mobile number
        </label>
        <input
          id="phone-national"
          name="phone-national"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={country.iso === "IN" ? "9876543210" : "Local number"}
          value={nationalDigits}
          disabled={disabled}
          maxLength={maxNational}
          aria-invalid={error ? true : undefined}
          onChange={(e) => handleNationalChange(e.target.value)}
          className={cn(
            "min-h-11 min-w-0 flex-1 border-0 bg-card px-3.5 text-base tabular-nums tracking-wide text-heading",
            "outline-none ring-0 placeholder:text-input-placeholder focus:ring-0",
            "disabled:cursor-not-allowed",
          )}
        />
      </div>

      {error ? (
        <p className="text-xs leading-relaxed text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
