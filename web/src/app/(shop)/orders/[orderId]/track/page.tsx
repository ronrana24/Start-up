import { OrderTrackingScreen } from "@presentation/features/order-tracking-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Live Order Tracking");

export default function OrderTrackPage() {
  return <OrderTrackingScreen />;
}
