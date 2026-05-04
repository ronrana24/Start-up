import type { ProductReader } from "@application/ports/product-reader";
import type { Product, ProductId } from "@domain/product";
import { MOCK_PRODUCTS } from "@infrastructure/mock/mock-products";
import { delay } from "@infrastructure/mock/delay";

export function createMockProductReader(): ProductReader {
  return {
    async list(): Promise<Product[]> {
      await delay(280);
      return [...MOCK_PRODUCTS];
    },
    async getById(id: ProductId): Promise<Product | null> {
      await delay(200);
      return MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
    },
  };
}
