import type { Order } from "@domain/order";
import type { ProductId } from "@domain/product";

export type PlaceOrderLineInput = {
  productId: ProductId;
  quantity: number;
  unitPriceCents: number;
  title: string;
};

export type PlaceOrderInput = {
  userId: string;
  lines: PlaceOrderLineInput[];
};

export interface OrderWriter {
  placeOrder(input: PlaceOrderInput): Promise<Order>;
}
