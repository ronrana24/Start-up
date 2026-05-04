import type {
  OrderWriter,
  PlaceOrderInput,
} from "@application/ports/order-writer";
import type { Order, OrderLine } from "@domain/order";
import { delay } from "@infrastructure/mock/delay";
import {
  appendOrder,
  newOrderFromLines,
} from "@infrastructure/mock/mock-order-store";

export function createMockOrderWriter(): OrderWriter {
  return {
    async placeOrder(input: PlaceOrderInput): Promise<Order> {
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
      appendOrder(order);
      return order;
    },
  };
}
