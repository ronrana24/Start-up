import type { AppDependencies } from "@application/app-dependencies";
import type { Order } from "@domain/order";

export async function listOrders(
  deps: AppDependencies,
  userId: string,
): Promise<Order[]> {
  return deps.orderReader.listByUser(userId);
}
