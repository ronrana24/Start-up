import { OrdersTrackingHubScreen } from "@presentation/features/orders-tracking-hub-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Order Tracking");

export default function OrdersTrackingHubPage() {
  return <OrdersTrackingHubScreen />;
}
