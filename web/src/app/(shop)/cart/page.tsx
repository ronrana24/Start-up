import { CartScreen } from "@presentation/features/cart-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Cart");

export default function CartPage() {
  return <CartScreen />;
}
