import type { OrderReader } from "@application/ports/order-reader";
import type {
  OrderWriter,
  PlaceOrderInput,
} from "@application/ports/order-writer";
import type { Order, OrderStatus } from "@domain/order";
import { buildTrackingSteps } from "@infrastructure/mock/order-tracking-factory";
import { apiJsonAuthorized } from "./http-client";

type ApiEnvelope<T> = { data: T };

type ApiAddress = { id: string };
type ApiOrderItem = {
  productId: string;
  quantity: number;
  priceApplied: string | number;
};
type ApiOrder = {
  id: string;
  userId: string;
  status: string;
  totalAmount: string | number;
  createdAt: string;
  items: ApiOrderItem[];
};
type ApiOrderSummary = {
  orderId: string;
  orderAmount: string | number;
  orderDate: string;
  items: Array<{ name: string; status: string }>;
};
type ApiOrdersSummary = { orders: ApiOrderSummary[] };

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function priceToCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

function statusFromApi(status: string): OrderStatus {
  switch (status) {
    case "PLACED":
      return "pending";
    case "CONFIRMED":
      return "confirmed";
    case "PACKED":
      return "packed";
    case "OUT_FOR_DELIVERY":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    default:
      return "pending";
  }
}

function mapOrder(order: ApiOrder, input?: PlaceOrderInput): Order {
  const status = statusFromApi(order.status);
  return {
    id: order.id,
    userId: order.userId,
    createdAt: order.createdAt,
    totalCents: priceToCents(order.totalAmount),
    status,
    trackingSteps: buildTrackingSteps(status),
    lines: order.items.map((item) => {
      const originalLine = input?.lines.find((line) => line.productId === item.productId);
      return {
        productId: item.productId,
        title: originalLine?.title ?? item.productId,
        quantity: item.quantity,
        unitPriceCents: priceToCents(item.priceApplied),
      };
    }),
  };
}

export function createHttpOrderWriter(baseUrl: string): OrderWriter {
  return {
    async placeOrder(input: PlaceOrderInput): Promise<Order> {
      let addressId = input.addressId;
      if (!addressId && input.address) {
        const address = unwrapBody(
          await apiJsonAuthorized<ApiAddress | ApiEnvelope<ApiAddress>>(
            baseUrl,
            "/api/users/me/addresses",
            { method: "POST", body: input.address },
          ),
        );
        addressId = address.id;
      }
      if (!addressId) {
        throw new Error("Delivery address is required");
      }

      const order = unwrapBody(
        await apiJsonAuthorized<ApiOrder | ApiEnvelope<ApiOrder>>(
          baseUrl,
          "/api/orders",
          {
            method: "POST",
            body: {
              addressId,
              deliveryType: input.deliveryType ?? "STANDARD",
              items: input.lines.map((line) => ({
                productId: line.productId,
                quantity: line.quantity,
              })),
            },
          },
        ),
      );
      return mapOrder(order, input);
    },
  };
}

export function createHttpOrderReader(baseUrl: string): OrderReader {
  return {
    async listByUser(userId: string): Promise<Order[]> {
      const body = unwrapBody(
        await apiJsonAuthorized<ApiOrdersSummary | ApiEnvelope<ApiOrdersSummary>>(
          baseUrl,
          "/api/orders",
          { method: "GET" },
        ),
      );
      return body.orders.map((order) => {
        const status = statusFromApi(order.items[0]?.status ?? "PLACED");
        return {
          id: order.orderId,
          userId,
          createdAt: order.orderDate,
          totalCents: priceToCents(order.orderAmount),
          status,
          trackingSteps: buildTrackingSteps(status),
          lines: order.items.map((item, index) => ({
            productId: `${order.orderId}-${index}`,
            title: item.name,
            quantity: 1,
            unitPriceCents: 0,
          })),
        };
      });
    },
    async getById(orderId: string): Promise<Order | null> {
      try {
        return mapOrder(
          unwrapBody(
            await apiJsonAuthorized<ApiOrder | ApiEnvelope<ApiOrder>>(
              baseUrl,
              `/api/orders/${orderId}`,
              { method: "GET" },
            ),
          ),
        );
      } catch {
        return null;
      }
    },
  };
}
