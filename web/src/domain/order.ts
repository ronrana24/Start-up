export type OrderId = string;

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered";

export type TrackingStep = {
  key: string;
  label: string;
  done: boolean;
  completedAt?: string;
};

export type OrderLine = {
  productId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
};

export type Order = {
  id: OrderId;
  userId: string;
  lines: OrderLine[];
  createdAt: string;
  totalCents: number;
  status: OrderStatus;
  trackingSteps: TrackingStep[];
};
