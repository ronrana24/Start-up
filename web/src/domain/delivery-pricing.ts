/**
 * Single source of truth for buyer-facing delivery-fee math. Mirrors the
 * backend rule in `PricingService.deliveryFee`:
 *   STANDARD = flat below threshold, free at/above it.
 *   PRIORITY = STANDARD + flat surcharge.
 *
 * Backend remains authoritative — the values here only drive UI previews so
 * the buyer sees the same totals the server will charge.
 */

export type DeliveryMethod = "STANDARD" | "PRIORITY";

function positiveEnvNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Subtotal at or above which standard delivery becomes free. */
export const FREE_DELIVERY_THRESHOLD_CENTS =
  positiveEnvNumber(process.env.NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD_INR, 500) *
  100;

/** Flat fee charged when subtotal is below the free-delivery threshold. */
export const BELOW_THRESHOLD_DELIVERY_FEE_CENTS =
  positiveEnvNumber(process.env.NEXT_PUBLIC_STANDARD_DELIVERY_FEE_INR, 30) *
  100;

/** Surcharge added on top of the standard fee for PRIORITY delivery. */
export const PRIORITY_DELIVERY_SURCHARGE_CENTS =
  positiveEnvNumber(
    process.env.NEXT_PUBLIC_PRIORITY_DELIVERY_SURCHARGE_INR,
    21,
  ) * 100;

export type DeliveryQuote = {
  /** Standard portion of the fee (0 when above the free threshold). */
  baseFeeCents: number;
  /** Priority surcharge (0 for STANDARD). */
  surchargeCents: number;
  /** What the buyer will actually pay for delivery (base + surcharge). */
  totalCents: number;
};

function standardBaseFeeCents(subtotalCents: number): number {
  if (subtotalCents <= 0) return 0;
  if (subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS) return 0;
  return BELOW_THRESHOLD_DELIVERY_FEE_CENTS;
}

/** Returns the buyer-facing delivery breakdown for a given method + subtotal. */
export function quoteDelivery(
  method: DeliveryMethod,
  subtotalCents: number,
): DeliveryQuote {
  const baseFeeCents = standardBaseFeeCents(subtotalCents);
  const surchargeCents =
    method === "PRIORITY" ? PRIORITY_DELIVERY_SURCHARGE_CENTS : 0;
  return {
    baseFeeCents,
    surchargeCents,
    totalCents: baseFeeCents + surchargeCents,
  };
}

/** Convenience: total delivery fee (in cents) for a method + subtotal. */
export function computeDeliveryFeeCents(
  subtotalCents: number,
  method: DeliveryMethod = "STANDARD",
): number {
  return quoteDelivery(method, subtotalCents).totalCents;
}

/** Returns how much more the buyer needs to add to unlock free standard delivery. */
export function remainingForFreeDeliveryCents(subtotalCents: number): number {
  return Math.max(0, FREE_DELIVERY_THRESHOLD_CENTS - subtotalCents);
}

export function deliveryMethodLabel(method: DeliveryMethod): string {
  return method === "PRIORITY" ? "Priority Delivery" : "Standard Delivery";
}
