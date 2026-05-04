import type { AppDependencies } from "@application/app-dependencies";
import type { Order, OrderId } from "@domain/order";
import { getOrder } from "@application/use-cases/get-order";

/**
 * Read-only view of an order for the tracking UI (timeline + summary).
 * Today this delegates to {@link getOrder}; a future version could call a dedicated tracking port.
 */
export async function getOrderTracking(
  deps: AppDependencies,
  orderId: OrderId,
  userId: string,
): Promise<Order> {
  return getOrder(deps, orderId, userId);
}
