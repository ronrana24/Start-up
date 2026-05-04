import type { Order, OrderId } from "@domain/order";

export interface OrderReader {
  listByUser(userId: string): Promise<Order[]>;
  getById(orderId: OrderId, userId: string): Promise<Order | null>;
}
