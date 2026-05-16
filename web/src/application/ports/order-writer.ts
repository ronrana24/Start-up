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
  paymentOption: "FULL_UPI" | "PARTIAL_UPI";
  orderNotes?: string;
};

export type OrderPaymentCheckout = {
  provider: "razorpay";
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  demo?: boolean;
};

export type PlaceOrderResult = {
  order: Order;
  payment: OrderPaymentCheckout;
};

export type VerifyOrderPaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export interface OrderWriter {
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  verifyOrderPayment(input: VerifyOrderPaymentInput): Promise<Order>;
  markOrderPaymentFailed(input: {
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    errorCode?: string;
    errorDescription?: string;
  }): Promise<Order | null>;
}
