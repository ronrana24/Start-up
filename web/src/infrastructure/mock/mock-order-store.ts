import type { Order, OrderId, OrderLine, OrderStatus } from "@domain/order";
import { buildTrackingSteps } from "@infrastructure/mock/order-tracking-factory";

const DEMO_USER_ID = "demo-user";

function seedOrders(): Order[] {
  const now = new Date();
  const iso = (d: number) => new Date(now.getTime() - d).toISOString();
  const lines1: OrderLine[] = [
    {
      productId: "p1",
      title: "Organic trail mix",
      quantity: 2,
      unitPriceCents: 899,
    },
  ];
  const lines2: OrderLine[] = [
    {
      productId: "p3",
      title: "Stainless bottle 750ml",
      quantity: 1,
      unitPriceCents: 3499,
    },
  ];
  return [
    {
      id: "ord_seed_1",
      userId: DEMO_USER_ID,
      lines: lines1,
      createdAt: iso(86400000 * 3),
      totalCents: 1798,
      status: "delivered",
      trackingSteps: buildTrackingSteps("delivered"),
    },
    {
      id: "ord_seed_2",
      userId: DEMO_USER_ID,
      lines: lines2,
      createdAt: iso(86400000),
      totalCents: 3499,
      status: "shipped",
      trackingSteps: buildTrackingSteps("shipped"),
    },
  ];
}

let orders: Order[] = seedOrders();

let idCounter = 1;

export function resetMockOrdersForTests(): void {
  orders = seedOrders();
  idCounter = 1;
}

export function listOrdersInternal(userId: string): Order[] {
  return orders
    .filter((o) => o.userId === userId)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function getOrderInternal(
  orderId: OrderId,
  userId: string,
): Order | null {
  return orders.find((o) => o.id === orderId && o.userId === userId) ?? null;
}

export function appendOrder(order: Order): void {
  orders = [order, ...orders];
}

export function nextOrderId(): OrderId {
  return `ord_${idCounter++}`;
}

export function newOrderFromLines(input: {
  userId: string;
  lines: OrderLine[];
  status?: OrderStatus;
}): Order {
  const totalCents = input.lines.reduce(
    (s, l) => s + l.unitPriceCents * l.quantity,
    0,
  );
  const status = input.status ?? "confirmed";
  return {
    id: nextOrderId(),
    userId: input.userId,
    lines: input.lines,
    createdAt: new Date().toISOString(),
    totalCents,
    status,
    trackingSteps: buildTrackingSteps(status),
  };
}
