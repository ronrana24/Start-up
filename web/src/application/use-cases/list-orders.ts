import type { AppDependencies } from "@application/app-dependencies";
import type { OrderListPeriod } from "@application/ports/order-reader";
import type { Order } from "@domain/order";

export async function listOrders(
  deps: AppDependencies,
  userId: string,
  period: OrderListPeriod = "this_month",
): Promise<Order[]> {
  return deps.orderReader.listByUser(userId, period);
}
