import type {
  OrderListPeriod,
  OrderReader,
} from "@application/ports/order-reader";
import type {
  OrderPaymentCheckout,
  OrderWriter,
  PlaceOrderInput,
  PlaceOrderResult,
  VerifyOrderPaymentInput,
} from "@application/ports/order-writer";
import type { Order, OrderStatus } from "@domain/order";
import type { Coordinates, OrderDeliveryAddress } from "@domain/order";
import { buildTrackingSteps } from "@infrastructure/mock/order-tracking-factory";
import { apiJsonAuthorized } from "./http-client";

type ApiEnvelope<T> = { data: T };

type ApiAddress = { id: string };
type ApiOrderItem = {
  productId: string;
  quantity: number;
  priceApplied: string | number;
  product?: { name?: string | null } | null;
};
type ApiRider = {
  id: string;
  name: string;
  phone: string;
  photoUrl?: string | null;
  currentLocation?: unknown;
};
type ApiOrder = {
  id: string;
  userId: string;
  status: string;
  totalAmount: string | number;
  paymentMode?: string;
  paymentStatus?: string;
  paidAmount?: string | number;
  dueAmount?: string | number;
  paymentCollectionRequired?: boolean;
  collectionStatus?: string;
  addressSnapshot?: unknown;
  rider?: ApiRider | null;
  createdAt: string;
  items: ApiOrderItem[];
};
type ApiPlaceOrderResponse = {
  order: ApiOrder;
  payment: OrderPaymentCheckout;
};
type ApiOrderSummary = {
  orderId: string;
  orderAmount: string | number;
  orderDate: string;
  paymentMode?: string;
  paymentStatus?: string;
  paidAmount?: string | number;
  dueAmount?: string | number;
  paymentCollectionRequired?: boolean;
  collectionStatus?: string;
  items: Array<{
    productId?: string;
    name: string;
    quantity?: number;
    priceApplied?: string | number;
    status: string;
  }>;
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

function coordinatesFromUnknown(value: unknown): Coordinates | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const rawLat = record.lat ?? record.latitude;
  const rawLng = record.lng ?? record.longitude;
  const rawHeading = record.heading ?? record.bearing;
  const lat = typeof rawLat === "string" ? Number(rawLat) : rawLat;
  const lng = typeof rawLng === "string" ? Number(rawLng) : rawLng;
  const heading =
    typeof rawHeading === "string" ? Number(rawHeading) : rawHeading;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return typeof heading === "number" && Number.isFinite(heading)
    ? { lat, lng, heading }
    : { lat, lng };
}

function deliveryAddressFromUnknown(
  value: unknown,
): OrderDeliveryAddress | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const stringField = (key: string): string | null => {
    const field = record[key];
    return typeof field === "string" && field.trim() ? field : null;
  };
  return {
    line1: stringField("line1"),
    line2: stringField("line2"),
    city: stringField("city"),
    state: stringField("state"),
    pincode: stringField("pincode"),
    coordinates:
      coordinatesFromUnknown(record.coordinates) ??
      coordinatesFromUnknown(value),
  };
}

function statusFromApi(status: string): OrderStatus {
  switch (status) {
    case "PLACED":
      return "pending";
    case "RIDER_ASSIGNED":
      return "assigned";
    case "PICKED_UP":
      return "picked_up";
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
    payment: {
      mode: order.paymentMode ?? "UPI",
      status: order.paymentStatus ?? "PENDING",
      paidCents: priceToCents(order.paidAmount ?? 0),
      dueCents: priceToCents(order.dueAmount ?? 0),
      collectionRequired: Boolean(order.paymentCollectionRequired),
      collectionStatus: order.collectionStatus ?? "NOT_REQUIRED",
    },
    status,
    trackingSteps: buildTrackingSteps(status),
    rider: order.rider
      ? {
          id: order.rider.id,
          name: order.rider.name,
          phone: order.rider.phone,
          photoUrl: order.rider.photoUrl ?? null,
          currentLocation: coordinatesFromUnknown(order.rider.currentLocation),
        }
      : null,
    deliveryAddress: deliveryAddressFromUnknown(order.addressSnapshot),
    lines: order.items.map((item) => {
      const originalLine = input?.lines.find(
        (line) => line.productId === item.productId,
      );
      return {
        productId: item.productId,
        title: item.product?.name ?? originalLine?.title ?? item.productId,
        quantity: item.quantity,
        unitPriceCents: priceToCents(item.priceApplied),
      };
    }),
  };
}

export function createHttpOrderWriter(baseUrl: string): OrderWriter {
  return {
    async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
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

      const result = unwrapBody(
        await apiJsonAuthorized<
          ApiPlaceOrderResponse | ApiEnvelope<ApiPlaceOrderResponse>
        >(baseUrl, "/api/orders", {
          method: "POST",
          body: {
            addressId,
            deliveryType: input.deliveryType ?? "STANDARD",
            paymentOption: input.paymentOption,
            orderNotes: input.orderNotes,
            items: input.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          },
        }),
      );
      return { order: mapOrder(result.order, input), payment: result.payment };
    },
    async verifyOrderPayment(input: VerifyOrderPaymentInput): Promise<Order> {
      const order = unwrapBody(
        await apiJsonAuthorized<ApiOrder | ApiEnvelope<ApiOrder>>(
          baseUrl,
          "/api/payments/razorpay/verify",
          { method: "POST", body: input },
        ),
      );
      return mapOrder(order);
    },
    async markOrderPaymentFailed(input): Promise<Order | null> {
      const order = unwrapBody(
        await apiJsonAuthorized<ApiOrder | null | ApiEnvelope<ApiOrder | null>>(
          baseUrl,
          "/api/payments/razorpay/failure",
          {
            method: "POST",
            body: input,
          },
        ),
      );
      return order ? mapOrder(order) : null;
    },
  };
}

export function createHttpOrderReader(baseUrl: string): OrderReader {
  return {
    async listByUser(
      userId: string,
      period: OrderListPeriod = "this_month",
    ): Promise<Order[]> {
      const params = new URLSearchParams({ period });
      const body = unwrapBody(
        await apiJsonAuthorized<
          ApiOrdersSummary | ApiEnvelope<ApiOrdersSummary>
        >(baseUrl, `/api/orders?${params.toString()}`, { method: "GET" }),
      );
      return body.orders.map((order) => {
        const status = statusFromApi(order.items[0]?.status ?? "PLACED");
        return {
          id: order.orderId,
          userId,
          createdAt: order.orderDate,
          totalCents: priceToCents(order.orderAmount),
          payment: {
            mode: order.paymentMode ?? "UPI",
            status: order.paymentStatus ?? "PENDING",
            paidCents: priceToCents(order.paidAmount ?? 0),
            dueCents: priceToCents(order.dueAmount ?? 0),
            collectionRequired: Boolean(order.paymentCollectionRequired),
            collectionStatus: order.collectionStatus ?? "NOT_REQUIRED",
          },
          status,
          trackingSteps: buildTrackingSteps(status),
          lines: order.items.map((item, index) => ({
            productId: item.productId ?? `${order.orderId}-${index}`,
            title: item.name,
            quantity: item.quantity ?? 1,
            unitPriceCents:
              item.priceApplied == null ? 0 : priceToCents(item.priceApplied),
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
