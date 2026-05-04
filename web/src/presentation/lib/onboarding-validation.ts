/** E.164 phone is treated as Indian when it uses country code +91. */
export function isIndianE164(phone: string | null | undefined): boolean {
  return !!phone && phone.startsWith("+91");
}

export function validateIndianPincode(raw: string): boolean {
  return /^[1-9]\d{5}$/.test(raw.trim());
}

/** Matches backend CreateAddressDto pincode pattern for non-India cases. */
export function validateNonIndianPincode(raw: string): boolean {
  const s = raw.trim();
  return s.length >= 4 && s.length <= 10 && /^[0-9A-Za-z\- ]+$/.test(s);
}

/** Mirrors backend UpdateProfileDto GST regex. */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const MAX_BUSINESS_NAME_LEN = 200;
export const MAX_ADDRESS_LINE_LEN = 200;
export const MAX_CITY_STATE_LEN = 100;

/**
 * When GST is left empty, returns null (valid). Otherwise validates format and length.
 */
export function validateGstInOptional(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (s.length !== 15) {
    return "GSTIN must be exactly 15 characters.";
  }
  if (!GSTIN_REGEX.test(s)) {
    return "Enter a valid GSTIN (standard 15-character format).";
  }
  return null;
}

export function validateBusinessName(trimmed: string): string | null {
  if (!trimmed) {
    return "Business name is required.";
  }
  if (trimmed.length > MAX_BUSINESS_NAME_LEN) {
    return `Business name must be ${MAX_BUSINESS_NAME_LEN} characters or less.`;
  }
  return null;
}
