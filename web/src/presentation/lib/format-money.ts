/** Fixed locale avoids SSR hydration mismatches (Node vs browser default locales). */
const MONEY_LOCALE = "en-US";

export function formatMoney(cents: number, currency: string = "USD"): string {
  return new Intl.NumberFormat(MONEY_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
