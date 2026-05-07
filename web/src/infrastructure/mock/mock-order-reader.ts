import type {
  OrderListPeriod,
  OrderReader,
} from "@application/ports/order-reader";
import type { Order, OrderId } from "@domain/order";
import { delay } from "@infrastructure/mock/delay";
import {
  getOrderInternal,
  listOrdersInternal,
} from "@infrastructure/mock/mock-order-store";

export function createMockOrderReader(): OrderReader {
  return {
    async listByUser(
      userId: string,
      period: OrderListPeriod = "this_month",
    ): Promise<Order[]> {
      void period;
      await delay(220);
      return listOrdersInternal(userId);
    },
    async getById(orderId: OrderId, userId: string): Promise<Order | null> {
      await delay(180);
      return getOrderInternal(orderId, userId);
    },
  };
}
