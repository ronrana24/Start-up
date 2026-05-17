import { CheckoutScreen } from "@presentation/features/checkout-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Checkout");

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
