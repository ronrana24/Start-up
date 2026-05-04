import type { Product, ProductId } from "@domain/product";

export interface ProductReader {
  list(): Promise<Product[]>;
  getById(id: ProductId): Promise<Product | null>;
}
