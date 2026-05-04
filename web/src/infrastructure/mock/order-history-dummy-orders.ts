import type { Order } from "@domain/order";
import { buildTrackingSteps } from "@infrastructure/mock/order-tracking-factory";

const DEMO_USER_ID = "demo-user";

/**
 * Rich sample orders for development / empty-state previews of order history UI.
 * IDs are synthetic; detail routes may not resolve unless you align with seeded orders.
 */
export const ORDER_HISTORY_DUMMY_ORDERS: Order[] = [
  {
    id: "demo_hist_001",
    userId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    status: "delivered",
    totalCents: 45000,
    trackingSteps: buildTrackingSteps("delivered"),
    lines: [
      {
        productId: "p1",
        title: '10" Heavy Duty Compostable Paper Plates',
        quantity: 8,
        unitPriceCents: 3200,
      },
      {
        productId: "p2",
        title: "Cold brew concentrate",
        quantity: 4,
        unitPriceCents: 1299,
      },
      {
        productId: "p4",
        title: "Daily greens powder",
        quantity: 2,
        unitPriceCents: 2499,
      },
    ],
  },
  {
    id: "demo_hist_002",
    userId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: "shipped",
    totalCents: 12550,
    trackingSteps: buildTrackingSteps("shipped"),
    lines: [
      {
        productId: "p5",
        title: "Ceramic pour-over dripper",
        quantity: 2,
        unitPriceCents: 2899,
      },
      {
        productId: "p6",
        title: "Linen tote",
        quantity: 1,
        unitPriceCents: 4299,
      },
    ],
  },
  {
    id: "demo_hist_003",
    userId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    status: "delivered",
    totalCents: 89025,
    trackingSteps: buildTrackingSteps("delivered"),
    lines: [
      {
        productId: "p3",
        title: "Stainless bottle 750ml",
        quantity: 6,
        unitPriceCents: 3499,
      },
      {
        productId: "p1",
        title: '10" Heavy Duty Compostable Paper Plates',
        quantity: 10,
        unitPriceCents: 2700,
      },
    ],
  },
  {
    id: "demo_hist_004",
    userId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    status: "delivered",
    totalCents: 1899,
    trackingSteps: buildTrackingSteps("delivered"),
    lines: [
      {
        productId: "p2",
        title: "Cold brew concentrate",
        quantity: 1,
        unitPriceCents: 1299,
      },
    ],
  },
  {
    id: "demo_hist_005",
    userId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
    status: "confirmed",
    totalCents: 9999,
    trackingSteps: buildTrackingSteps("confirmed"),
    lines: [
      {
        productId: "p4",
        title: "Daily greens powder",
        quantity: 3,
        unitPriceCents: 2499,
      },
      {
        productId: "p5",
        title: "Ceramic pour-over dripper",
        quantity: 1,
        unitPriceCents: 2899,
      },
    ],
  },
  {
    id: "demo_hist_006",
    userId: DEMO_USER_ID,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    status: "delivered",
    totalCents: 2200,
    trackingSteps: buildTrackingSteps("delivered"),
    lines: [
      {
        productId: "p6",
        title: "Linen tote",
        quantity: 1,
        unitPriceCents: 4299,
      },
    ],
  },
];
