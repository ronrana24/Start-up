import type { OrderStatus, TrackingStep } from "@domain/order";

const LABELS: Record<OrderStatus, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

const ORDER: OrderStatus[] = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

export function buildTrackingSteps(status: OrderStatus): TrackingStep[] {
  const idx = ORDER.indexOf(status);
  const base = Date.now();
  return ORDER.map((key, i) => ({
    key,
    label: LABELS[key],
    done: i <= idx,
    completedAt:
      i <= idx ? new Date(base - (idx - i) * 3600000).toISOString() : undefined,
  }));
}
