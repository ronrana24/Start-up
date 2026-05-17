import { OrderHistoryScreen } from "@presentation/features/order-history-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Order History");

export default function OrderHistoryPage() {
  return <OrderHistoryScreen />;
}
