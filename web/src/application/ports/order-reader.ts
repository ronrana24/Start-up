import type { Order, OrderId } from "@domain/order";

export type OrderListPeriod = "this_month" | "last_3_months" | "all_time";

export interface OrderReader {
  listByUser(userId: string, period?: OrderListPeriod): Promise<Order[]>;
  getById(orderId: OrderId, userId: string): Promise<Order | null>;
}
