import type { Order } from "@domain/order";
import type { ProductId } from "@domain/product";
import type { CreateUserAddressInput } from "./user-profile-gateway";

export type PlaceOrderLineInput = {
  productId: ProductId;
  quantity: number;
  unitPriceCents: number;
  title: string;
};

export type PlaceOrderInput = {
  userId: string;
  lines: PlaceOrderLineInput[];
  address?: CreateUserAddressInput;
  addressId?: string;
  deliveryType?: "STANDARD" | "PRIORITY";
};

export interface OrderWriter {
  placeOrder(input: PlaceOrderInput): Promise<Order>;
}
