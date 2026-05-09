"use client";

import { io, type Socket } from "socket.io-client";

type DeliveryServerEvents = {
  "available-orders.changed": (payload: { reason?: string }) => void;
  "order.created": (payload: unknown) => void;
  "order.assigned": (payload: unknown) => void;
  "order.updated": (payload: unknown) => void;
  "order.status_changed": (payload: unknown) => void;
  "rider.location_updated": (payload: unknown) => void;
  "rider.availability_changed": (payload: unknown) => void;
  "rider.presence_changed": (payload: unknown) => void;
};

type DeliveryClientEvents = {
  "order:subscribe": (payload: { orderId: string }) => void;
};

export type DeliverySocket = Socket<DeliveryServerEvents, DeliveryClientEvents>;

export function createDeliverySocket(accessToken?: string | null) {
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(
    /\/+$/,
    "",
  );
  return io(`${baseUrl}/delivery`, {
    transports: ["websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 20000,
    auth: accessToken ? { token: accessToken } : undefined,
  }) as DeliverySocket;
}
