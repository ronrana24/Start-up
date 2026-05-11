"use client";

import type { Order, OrderDeliveryAddress } from "@domain/order";
import {
  deliveryDirectionsUrl,
  LiveRouteMap,
  type LiveRouteMetrics,
  riderCoordinateLabel,
} from "@presentation/components/delivery/live-route-map";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { Card } from "@presentation/components/ui/card";
import { LinkButton } from "@presentation/components/ui/link-button";
import { useOrderTrackingQuery } from "@presentation/hooks/use-order-tracking-query";
import { useOrdersQuery } from "@presentation/hooks/use-orders-query";
import { cn } from "@presentation/lib/cn";
import { createDeliverySocket } from "@presentation/lib/delivery-realtime";
import { queryKeys } from "@presentation/query-keys";
import { useAuthStore } from "@presentation/state/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const REFRESH_SECONDS = 15;

type RiderLocationPayload = {
  orderId?: string;
  location?: {
    lat?: number;
    lng?: number;
    heading?: number | null;
  };
};

function isRiderLocationPayload(value: unknown): value is RiderLocationPayload {
  if (!value || typeof value !== "object") return false;
  const location = (value as RiderLocationPayload).location;
  return (
    !!location &&
    typeof location.lat === "number" &&
    typeof location.lng === "number" &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  );
}

function shortOrderId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function itemCount(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

function addressLabel(address?: OrderDeliveryAddress | null): string {
  if (!address) return "Delivery destination";
  return [
    address.line1,
    address.line2,
    [address.city, address.state, address.pincode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" - ");
}

function statusLabel(status: Order["status"]): string {
  switch (status) {
    case "pending":
      return "Order placed";
    case "assigned":
      return "Rider assigned";
    case "picked_up":
      return "Picked up";
    case "confirmed":
      return "Confirmed";
    case "packed":
      return "Packed";
    case "shipped":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    default:
      return "Processing";
  }
}

function statusMessage(status: Order["status"]): string {
  switch (status) {
    case "pending":
      return "We are confirming your wholesale order.";
    case "assigned":
      return "A rider has accepted this delivery.";
    case "picked_up":
      return "Your order has been picked up.";
    case "confirmed":
      return "Your order is confirmed and waiting to be packed.";
    case "packed":
      return "Your order is packed and ready for dispatch.";
    case "shipped":
      return "Your rider is on the way.";
    case "delivered":
      return "This order has been delivered.";
    default:
      return "We are updating your order status.";
  }
}

function RefreshCountdown({ status }: { status: Order["status"] }) {
  const [seconds, setSeconds] = useState(REFRESH_SECONDS);

  useEffect(() => {
    if (status === "delivered") return;

    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [status]);

  if (status === "delivered") {
    return (
      <span className="shrink-0 rounded-full bg-catalog-green-muted px-3 py-1 text-[10px] font-black uppercase tracking-wide text-catalog-green">
        Final
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-catalog-green-muted px-3 py-1 text-[10px] font-black uppercase tracking-wide text-catalog-green">
      {seconds > 0 ? `Refresh in ${seconds}s` : "Updating..."}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.31 1.85.53 2.81.66A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function etaLabel(order: Order, metrics: LiveRouteMetrics | null): string {
  if (order.status === "delivered") return "Delivered";
  if (order.status === "pending" || order.status === "confirmed") {
    return "Assigning";
  }
  if (order.status === "assigned" || order.status === "packed") {
    return "Pickup";
  }
  return metrics?.durationText ?? "Updating";
}

function TrackingMap({
  order,
  fullBleed = false,
  onMetrics,
}: {
  order: Order;
  fullBleed?: boolean;
  onMetrics?: (metrics: LiveRouteMetrics | null) => void;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden border border-catalog-border bg-card shadow-sm",
        fullBleed
          ? "rounded-none border-x-0 sm:rounded-[1.75rem] sm:border-x"
          : "rounded-[1.75rem]",
      )}
    >
      <div className="relative">
        <LiveRouteMap
          order={order}
          className={cn(
            fullBleed ? "h-[58svh] min-h-[24rem] sm:h-72 sm:min-h-0" : "h-72",
          )}
          onMetrics={onMetrics}
        />
        <div
          className={cn(
            "absolute inset-x-4 bottom-4 grid grid-cols-2 gap-2",
            fullBleed && "hidden sm:grid",
          )}
        >
          <div className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
              Rider
            </p>
            <p className="mt-1 truncate text-xs font-bold text-catalog-text">
              {riderCoordinateLabel(order.rider?.currentLocation)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
              Destination
            </p>
            <p className="mt-1 truncate text-xs font-bold text-catalog-text">
              {addressLabel(order.deliveryAddress)}
            </p>
          </div>
        </div>
      </div>
      <Link
        href={deliveryDirectionsUrl(order)}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "min-h-11 items-center justify-center text-sm font-black text-catalog-green",
          fullBleed ? "hidden sm:flex" : "flex",
        )}
      >
        Open route in Google Maps
      </Link>
    </section>
  );
}

function OrderSelectorPills({
  orders,
  selectedOrderId,
  onSelect,
}: {
  orders: Order[];
  selectedOrderId?: string;
  onSelect: (orderId: string) => void;
}) {
  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-catalog-border/60 bg-page px-4 py-2 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto pb-1">
        {orders.map((order) => {
          const active = order.id === selectedOrderId;
          return (
            <button
              key={order.id}
              type="button"
              className={cn(
                "shrink-0 snap-start rounded-full border px-4 py-2 text-xs font-black transition-colors",
                active
                  ? "border-catalog-green bg-catalog-green text-white shadow-sm"
                  : "border-catalog-border bg-card text-catalog-text shadow-sm hover:bg-catalog-green-muted hover:text-catalog-green",
              )}
              onClick={() => onSelect(order.id)}
            >
              {shortOrderId(order.id)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RiderCard({ order }: { order: Order }) {
  const rider = order.rider;

  if (!rider) {
    return (
      <section className="rounded-[1.5rem] border border-catalog-border bg-card p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-catalog-text-muted">
          Rider details
        </p>
        <p className="mt-2 text-sm font-bold text-catalog-text">
          Rider will be assigned soon.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-catalog-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-catalog-text-muted">
          Rider details
        </p>
        <span className="rounded-full bg-catalog-green-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-catalog-green">
          Assigned
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-catalog-green-muted text-base font-black text-catalog-green ring-1 ring-catalog-green/15">
          {rider.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={rider.photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initials(rider.name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black text-catalog-text">
            {rider.name}
          </h2>
          <p className="mt-0.5 truncate text-xs font-semibold text-catalog-text-muted">
            {rider.phone}
          </p>
        </div>
        <Link
          href={phoneHref(rider.phone)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-catalog-green px-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-catalog-green-hover sm:px-5"
          aria-label={`Call ${rider.name}`}
        >
          <PhoneIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Call</span>
        </Link>
      </div>
    </section>
  );
}

function TrackingStatus({
  order,
  dataUpdatedAt,
}: {
  order: Order;
  dataUpdatedAt: number;
}) {
  return (
    <section className="rounded-[1.5rem] border border-catalog-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
            Order status
          </p>
          <h2 className="mt-1 text-lg font-black text-catalog-text">
            {statusLabel(order.status)}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-catalog-text-muted">
            {statusMessage(order.status)}
          </p>
        </div>
        <RefreshCountdown
          key={`${order.id}-${order.status}-${dataUpdatedAt}`}
          status={order.status}
        />
      </div>

      <ol className="mt-4 space-y-3">
        {order.trackingSteps.map((step, index) => (
          <li key={step.key} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                step.done
                  ? "bg-catalog-green text-white"
                  : "bg-catalog-input text-catalog-text-muted",
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-catalog-text">
                {step.label}
              </p>
              <p className="text-xs text-catalog-text-muted">
                {step.completedAt
                  ? new Date(step.completedAt).toLocaleString()
                  : "Waiting for update"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TrackingDetails({
  order,
  dataUpdatedAt,
}: {
  order: Order;
  dataUpdatedAt: number;
}) {
  const [routeMetricsState, setRouteMetricsState] = useState<{
    orderId: string;
    metrics: LiveRouteMetrics | null;
  } | null>(null);
  const routeMetrics =
    routeMetricsState?.orderId === order.id ? routeMetricsState.metrics : null;
  const handleRouteMetrics = useCallback(
    (metrics: LiveRouteMetrics | null) => {
      setRouteMetricsState({ orderId: order.id, metrics });
    },
    [order.id],
  );

  return (
    <div className="relative -mx-4 sm:mx-0 sm:space-y-4">
      <div className="sticky top-[7.5rem] z-0 sm:static">
        <TrackingMap order={order} fullBleed onMetrics={handleRouteMetrics} />
      </div>

      <div className="relative z-10 -mt-16 space-y-4 rounded-t-[2rem] bg-catalog-surface/50 px-4 pb-8 pt-4 shadow-[0_-24px_60px_-32px_rgba(15,81,50,0.7)] backdrop-blur sm:mt-4 sm:rounded-none sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:shadow-none sm:backdrop-blur-0">
        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-catalog-border bg-card p-3 text-center shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
              ETA
            </p>
            <p className="mt-1 text-sm font-black text-catalog-text">
              {etaLabel(order, routeMetrics)}
            </p>
          </div>
          <div className="rounded-2xl border border-catalog-border bg-card p-3 text-center shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
              Distance
            </p>
            <p className="mt-1 text-sm font-black text-catalog-text">
              {routeMetrics?.distanceText ?? "Updating"}
            </p>
          </div>
          <div className="rounded-2xl border border-catalog-border bg-card p-3 text-center shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
              Items
            </p>
            <p className="mt-1 text-sm font-black text-catalog-text">
              {itemCount(order)}
            </p>
          </div>
        </section>

        <RiderCard order={order} />
        <TrackingStatus order={order} dataUpdatedAt={dataUpdatedAt} />
      </div>
    </div>
  );
}

export function OrdersTrackingHubScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [chosenOrderId, setChosenOrderId] = useState<string | null>(null);
  const { data, isPending, isError, refetch } = useOrdersQuery(
    isAuthenticated ? userId : null,
    "all_time",
  );

  const sorted = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [data],
  );
  const selectedOrderId =
    chosenOrderId && sorted.some((order) => order.id === chosenOrderId)
      ? chosenOrderId
      : sorted[0]?.id;
  const selectedSummary =
    sorted.find((order) => order.id === selectedOrderId) ?? null;
  const {
    data: selectedDetail,
    dataUpdatedAt: selectedDataUpdatedAt,
    isPending: selectedPending,
    isError: selectedError,
    refetch: refetchSelected,
  } = useOrderTrackingQuery(selectedOrderId, userId);
  const selectedOrder = selectedDetail ?? selectedSummary;

  useEffect(() => {
    if (!selectedOrderId || !userId) return;
    const socket = createDeliverySocket(accessToken);
    const reload = () => {
      void refetch();
      void refetchSelected();
    };
    const applyLocationUpdate = (payload: unknown) => {
      if (
        !isRiderLocationPayload(payload) ||
        payload.orderId !== selectedOrderId
      ) {
        return;
      }

      queryClient.setQueryData<Order | undefined>(
        queryKeys.order(userId, selectedOrderId),
        (current) => {
          if (!current?.rider) return current;
          return {
            ...current,
            rider: {
              ...current.rider,
              currentLocation: {
                lat: payload.location!.lat!,
                lng: payload.location!.lng!,
                heading:
                  typeof payload.location!.heading === "number"
                    ? payload.location!.heading
                    : null,
              },
            },
          };
        },
      );
    };
    socket.emit("order:subscribe", { orderId: selectedOrderId });
    socket.on("order.assigned", reload);
    socket.on("order.updated", reload);
    socket.on("order.status_changed", reload);
    socket.on("rider.location_updated", applyLocationUpdate);
    return () => {
      socket.disconnect();
    };
  }, [
    accessToken,
    queryClient,
    refetch,
    refetchSelected,
    selectedOrderId,
    userId,
  ]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-4">
        <MobilePageHeader title="Track Order" fallbackHref="/" />
        <Card>
          <p className="text-sm text-secondary">
            Sign in to see your orders and track shipments.
          </p>
          <LinkButton href="/login" className="mt-4" fullWidth>
            Sign in
          </LinkButton>
        </Card>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-0">
        <MobilePageHeader title="Track Order" fallbackHref="/" />
        <div className="sticky top-16 z-30 -mx-4 border-b border-catalog-border/60 bg-page px-4 py-2 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <div className="flex gap-2 overflow-hidden pb-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={String(index)}
                className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-secondary-bg"
              />
            ))}
          </div>
        </div>
        <div className="relative -mx-4 sm:mx-0">
          <div className="h-[58svh] min-h-[24rem] animate-pulse bg-secondary-bg sm:h-72 sm:min-h-0 sm:rounded-[1.75rem]" />
          <div className="relative z-10 -mt-16 space-y-4 rounded-t-[2rem] bg-catalog-surface/95 px-4 pb-8 pt-4 shadow-[0_-24px_60px_-32px_rgba(15,81,50,0.7)] sm:mt-4 sm:rounded-none sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:shadow-none">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={String(index)}
                  className="h-20 animate-pulse rounded-2xl bg-secondary-bg"
                />
              ))}
            </div>
            <div className="h-24 animate-pulse rounded-[1.5rem] bg-secondary-bg" />
            <div className="h-48 animate-pulse rounded-[1.5rem] bg-secondary-bg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <MobilePageHeader title="Track Order" fallbackHref="/" />
        <Card>
          <p className="text-secondary">Could not load orders.</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-primary"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-0 text-catalog-text">
      <MobilePageHeader title="Track Order" fallbackHref="/" />

      {sorted.length === 0 ? (
        <div className="mt-4">
          <Card>
            <p className="text-secondary">No orders yet.</p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-semibold text-primary"
            >
              Start shopping
            </Link>
          </Card>
        </div>
      ) : (
        <>
          <OrderSelectorPills
            orders={sorted}
            selectedOrderId={selectedOrderId}
            onSelect={setChosenOrderId}
          />

          {selectedPending && !selectedOrder ? (
            <div className="-mx-4 h-[58svh] min-h-[24rem] animate-pulse bg-secondary-bg sm:mx-0 sm:h-72 sm:min-h-0 sm:rounded-[1.75rem]" />
          ) : selectedError || !selectedOrder ? (
            <Card>
              <p className="text-secondary">Could not load tracking details.</p>
            </Card>
          ) : (
            <TrackingDetails
              order={selectedOrder}
              dataUpdatedAt={selectedDataUpdatedAt}
            />
          )}
        </>
      )}
    </div>
  );
}
