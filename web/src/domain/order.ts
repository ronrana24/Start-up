export type OrderId = string;

export type Coordinates = {
  lat: number;
  lng: number;
  heading?: number | null;
};

export type OrderStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered";

export type TrackingStep = {
  key: string;
  label: string;
  done: boolean;
  completedAt?: string;
};

export type OrderLineBatchSegment = {
  batchId: string;
  batchNumber: number;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type OrderLine = {
  productId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  /** Hero image for the ordered product, when the API surfaces it. */
  imageUrl?: string | null;
  /** Sale unit (e.g. "PIECE", "PACK") when available, for buyer clarity. */
  unit?: string | null;
  /** Batch-level split for this line, if the backend split it across batches. */
  batchSegments?: OrderLineBatchSegment[];
  hasMixedBatches?: boolean;
};

export type OrderRider = {
  id: string;
  name: string;
  phone: string;
  photoUrl?: string | null;
  currentLocation?: Coordinates | null;
};

export type OrderDeliveryAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  coordinates?: Coordinates | null;
};

export type OrderPaymentSummary = {
  mode: string;
  status: string;
  paidCents: number;
  dueCents: number;
  collectionRequired: boolean;
  collectionStatus: string;
};

export type DeliveryMethod = "STANDARD" | "PRIORITY";

export type Order = {
  id: OrderId;
  userId: string;
  lines: OrderLine[];
  createdAt: string;
  totalCents: number;
  status: OrderStatus;
  trackingSteps: TrackingStep[];
  rider?: OrderRider | null;
  deliveryAddress?: OrderDeliveryAddress | null;
  payment?: OrderPaymentSummary;
  deliveryType: DeliveryMethod;
  /** Total delivery fee actually charged (base standard fee + any priority surcharge). */
  deliveryFeeCents?: number;
};
