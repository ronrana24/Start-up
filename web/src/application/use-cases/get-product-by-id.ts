import type { AppDependencies } from "@application/app-dependencies";
import { DomainError } from "@domain/errors";
import type { Product, ProductId } from "@domain/product";

export async function getProductById(
  deps: AppDependencies,
  id: ProductId,
): Promise<Product> {
  const product = await deps.productReader.getById(id);
  if (!product) {
    throw new DomainError("NOT_FOUND", "Product not found");
  }
  return product;
}
