import type { AppDependencies } from "@application/app-dependencies";
import type { Product } from "@domain/product";

export async function listProducts(
  deps: AppDependencies,
): Promise<Product[]> {
  return deps.productReader.list();
}
