import type { AppDependencies } from "@application/app-dependencies";
import { DomainError } from "@domain/errors";
import type { Order, OrderId } from "@domain/order";

export async function getOrder(
  deps: AppDependencies,
  orderId: OrderId,
  userId: string,
): Promise<Order> {
  const order = await deps.orderReader.getById(orderId, userId);
  if (!order) {
    throw new DomainError("NOT_FOUND", "Order not found");
  }
  return order;
}
