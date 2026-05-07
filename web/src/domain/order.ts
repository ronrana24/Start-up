export type OrderId = string;

export type Coordinates = {
  lat: number;
  lng: number;
};

export type OrderStatus =
  | "pending"
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

export type OrderLine = {
  productId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
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
};
