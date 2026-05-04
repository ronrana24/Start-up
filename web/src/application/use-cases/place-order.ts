import type { AppDependencies } from "@application/app-dependencies";
import type { PlaceOrderInput } from "@application/ports/order-writer";
import { DomainError } from "@domain/errors";
import type { Order } from "@domain/order";

export async function placeOrder(
  deps: AppDependencies,
  input: PlaceOrderInput,
): Promise<Order> {
  if (input.lines.length === 0) {
    throw new DomainError("INVALID_INPUT", "Cart is empty");
  }
  if (!input.userId) {
    throw new DomainError("UNAUTHORIZED", "User is required");
  }
  return deps.orderWriter.placeOrder(input);
}
