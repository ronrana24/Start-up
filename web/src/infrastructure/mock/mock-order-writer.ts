import type {
  OrderWriter,
  PlaceOrderInput,
  PlaceOrderResult,
} from "@application/ports/order-writer";
import type { Order, OrderLine } from "@domain/order";
import { delay } from "@infrastructure/mock/delay";
import {
  appendOrder,
  newOrderFromLines,
} from "@infrastructure/mock/mock-order-store";

let lastMockOrder: Order | null = null;

export function createMockOrderWriter(): OrderWriter {
  return {
    async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
      await delay(400);
      const lines: OrderLine[] = input.lines.map((l) => ({
        productId: l.productId,
        title: l.title,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      }));
      const order: Order = newOrderFromLines({
        userId: input.userId,
        lines,
        status: "confirmed",
      });
      const partialEligible = order.totalCents > 500_000;
      const paidCents =
        input.paymentOption === "PARTIAL_UPI" && partialEligible
          ? Math.ceil(order.totalCents * 0.2)
          : order.totalCents;
      order.payment = {
        mode:
          input.paymentOption === "PARTIAL_UPI" && partialEligible
            ? "PARTIAL_UPI"
            : "UPI",
        status:
          input.paymentOption === "PARTIAL_UPI" && partialEligible
            ? "PARTIALLY_PAID"
            : "PAID",
        paidCents,
        dueCents: Math.max(0, order.totalCents - paidCents),
        collectionRequired: paidCents < order.totalCents,
        collectionStatus:
          paidCents < order.totalCents ? "PENDING" : "NOT_REQUIRED",
      };
      appendOrder(order);
      lastMockOrder = order;
      return {
        order,
        payment: {
          provider: "razorpay",
          keyId: "rzp_test_demo",
          razorpayOrderId: `order_demo_${order.id}`,
          amountPaise: order.totalCents,
          currency: "INR",
          name: "Dispense.",
          description: "Demo UPI payment",
          demo: true,
        },
      };
    },
    async verifyOrderPayment(): Promise<Order> {
      await delay(200);
      return (
        lastMockOrder ??
        newOrderFromLines({
          userId: "mock-user",
          lines: [],
          status: "confirmed",
        })
      );
    },
    async markOrderPaymentFailed(): Promise<Order | null> {
      await delay(100);
      return null;
    },
  };
}
