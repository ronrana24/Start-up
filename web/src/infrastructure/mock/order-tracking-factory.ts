import type { OrderStatus, TrackingStep } from "@domain/order";

const LABELS: Record<OrderStatus, string> = {
  pending: "Order placed",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Out for delivery",
  delivered: "Delivered",
};

const ORDER: OrderStatus[] = [
  "pending",
  "assigned",
  "picked_up",
  "shipped",
  "delivered",
];

export function buildTrackingSteps(status: OrderStatus): TrackingStep[] {
  const progressStatus =
    status === "confirmed" || status === "packed" ? "pending" : status;
  const idx = Math.max(ORDER.indexOf(progressStatus), 0);
  const base = Date.now();
  return ORDER.map((key, i) => ({
    key,
    label: LABELS[key],
    done: i <= idx,
    completedAt:
      i <= idx ? new Date(base - (idx - i) * 3600000).toISOString() : undefined,
  }));
}
