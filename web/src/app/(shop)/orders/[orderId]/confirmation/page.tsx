import { OrderConfirmationScreen } from "@presentation/features/order-confirmation-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Order Confirmation");

export default function OrderConfirmationPage() {
  return <OrderConfirmationScreen />;
}
