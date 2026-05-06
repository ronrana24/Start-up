import type { ProductId } from "@domain/product";

export type CartLine = {
  productId: ProductId;
  quantity: number;
  title: string;
  unitPriceCents: number;
  currency?: "USD" | "INR";
  pricingSource?: "BASE" | "BULK" | "SPECIAL";
  originalUnitPriceCents?: number | null;
  specialPricingLabel?: string | null;
  imageUrl: string;
};

export function cartLineTotalCents(line: CartLine): number {
  return line.unitPriceCents * line.quantity;
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + cartLineTotalCents(line), 0);
}
