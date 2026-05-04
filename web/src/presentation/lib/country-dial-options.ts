/** Dial codes without +; national digit hints for UX only — backend validates full E.164. */
export type CountryDialOption = {
  iso: string;
  dial: string;
  flag: string;
  /** Max digits for local number (excludes country code). */
  nationalMax: number;
};

/** India first; extend as needed. */
export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { iso: "IN", dial: "91", flag: "🇮🇳", nationalMax: 10 },
  // { iso: "US", dial: "1", flag: "🇺🇸", nationalMax: 10 },
  // { iso: "GB", dial: "44", flag: "🇬🇧", nationalMax: 10 },
  // { iso: "AE", dial: "971", flag: "🇦🇪", nationalMax: 9 },
  // { iso: "SG", dial: "65", flag: "🇸🇬", nationalMax: 8 },
  // { iso: "AU", dial: "61", flag: "🇦🇺", nationalMax: 9 },
  // { iso: "DE", dial: "49", flag: "🇩🇪", nationalMax: 11 },
  // { iso: "FR", dial: "33", flag: "🇫🇷", nationalMax: 9 },
  // { iso: "CA", dial: "1", flag: "🇨🇦", nationalMax: 10 },
];

export const DEFAULT_COUNTRY_ISO = "IN";

export function findCountryByIso(iso: string): CountryDialOption | undefined {
  return COUNTRY_DIAL_OPTIONS.find((c) => c.iso === iso);
}

export function findCountryByDial(dial: string): CountryDialOption | undefined {
  return COUNTRY_DIAL_OPTIONS.find((c) => c.dial === dial);
}

export function buildE164FromParts(dialCode: string, nationalDigits: string): string {
  const national = nationalDigits.replace(/\D/g, "");
  const dial = dialCode.replace(/\D/g, "");
  return `+${dial}${national}`;
}

export function buildE164FromIsoAndNational(
  iso: string,
  nationalDigits: string,
): string {
  const c = findCountryByIso(iso);
  if (!c) {
    const ind = findCountryByIso(DEFAULT_COUNTRY_ISO);
    return ind
      ? buildE164FromParts(ind.dial, nationalDigits)
      : `+91${nationalDigits.replace(/\D/g, "")}`;
  }
  return buildE164FromParts(c.dial, nationalDigits);
}

export function validateGoogleRegistrationPhone(
  iso: string,
  nationalDigits: string,
): string | null {
  const c = findCountryByIso(iso);
  if (!c) return "Select a country";
  const d = nationalDigits.replace(/\D/g, "");
  if (c.iso === "IN" && d.length !== 10) {
    return "Enter a 10-digit mobile number";
  }
  if (d.length < 8) {
    return "Enter a valid phone number";
  }
  if (d.length > c.nationalMax) {
    return "Number is too long";
  }
  return null;
}
