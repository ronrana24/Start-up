import type { AppDependencies } from "@application/app-dependencies";
import type {
  PlaceOrderInput,
  PlaceOrderResult,
} from "@application/ports/order-writer";
import { DomainError } from "@domain/errors";

export async function placeOrder(
  deps: AppDependencies,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  if (input.lines.length === 0) {
    throw new DomainError("INVALID_INPUT", "Cart is empty");
  }
  if (!input.userId) {
    throw new DomainError("UNAUTHORIZED", "User is required");
  }
  return deps.orderWriter.placeOrder(input);
}
