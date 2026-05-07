"use client";

import type { Coordinates, Order, OrderDeliveryAddress } from "@domain/order";
import { Card } from "@presentation/components/ui/card";
import { LinkButton } from "@presentation/components/ui/link-button";
import { useOrderTrackingQuery } from "@presentation/hooks/use-order-tracking-query";
import { useOrdersQuery } from "@presentation/hooks/use-orders-query";
import { cn } from "@presentation/lib/cn";
import { useAuthStore } from "@presentation/state/auth-store";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const REFRESH_SECONDS = 15;

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

function distanceKm(
  a?: Coordinates | null,
  b?: Coordinates | null,
): number | null {
  if (!a || !b) return null;
  const earthKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function etaLabel(order: Order, distance: number | null): string {
  if (order.status === "delivered") return "Delivered";
  if (order.status !== "shipped") return "Assigning";
  if (distance == null) return "Updating";
  const minutes = Math.max(8, Math.round((distance / 18) * 60));
  return `${minutes} min`;
}

function mapQuery(order: Order): string {
  const riderLocation = order.rider?.currentLocation;
  if (riderLocation) return `${riderLocation.lat},${riderLocation.lng}`;
  return addressLabel(order.deliveryAddress);
}

function directionsHref(order: Order): string {
  const riderLocation = order.rider?.currentLocation;
  const destination = order.deliveryAddress?.coordinates
    ? `${order.deliveryAddress.coordinates.lat},${order.deliveryAddress.coordinates.lng}`
    : addressLabel(order.deliveryAddress);
  const params = new URLSearchParams({
    api: "1",
    destination,
  });
  if (riderLocation) {
    params.set("origin", `${riderLocation.lat},${riderLocation.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function TrackingMap({ order }: { order: Order }) {
  const query = encodeURIComponent(mapQuery(order));
  const mapSrc = `https://maps.google.com/maps?q=${query}&z=13&output=embed`;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-catalog-border bg-card shadow-sm">
      <div className="relative h-72 bg-catalog-surface">
        <iframe
          src={mapSrc}
          title="Order tracking map"
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" />
        <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/60 bg-white/90 px-3 py-2 text-xs font-bold text-catalog-text shadow-sm backdrop-blur">
          Google map
        </div>
        <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
              Rider
            </p>
            <p className="mt-1 truncate text-xs font-bold text-catalog-text">
              {order.rider?.currentLocation
                ? "Live location active"
                : "Waiting for rider GPS"}
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
        href={directionsHref(order)}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center justify-center text-sm font-black text-catalog-green"
      >
        Open route in Google Maps
      </Link>
    </section>
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
    <section className="flex items-center gap-3 rounded-[1.5rem] border border-catalog-border bg-card p-4 shadow-sm">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-catalog-green-muted text-base font-black text-catalog-green">
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
        <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
          Your rider
        </p>
        <h2 className="truncate text-base font-black text-catalog-text">
          {rider.name}
        </h2>
        <p className="text-xs font-semibold text-catalog-text-muted">
          {rider.phone}
        </p>
      </div>
      <Link
        href={phoneHref(rider.phone)}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-catalog-green px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-catalog-green-hover"
      >
        Call
      </Link>
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
  const distance = distanceKm(
    order.rider?.currentLocation,
    order.deliveryAddress?.coordinates,
  );
  const distanceLabel =
    distance == null ? "Updating" : `${distance.toFixed(1)} km`;

  return (
    <div className="space-y-4">
      <TrackingMap order={order} />

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-catalog-border bg-card p-3 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
            ETA
          </p>
          <p className="mt-1 text-sm font-black text-catalog-text">
            {etaLabel(order, distance)}
          </p>
        </div>
        <div className="rounded-2xl border border-catalog-border bg-card p-3 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-catalog-text-muted">
            Distance
          </p>
          <p className="mt-1 text-sm font-black text-catalog-text">
            {distanceLabel}
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
  );
}

export function OrdersTrackingHubScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.userId);
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
  } = useOrderTrackingQuery(selectedOrderId, userId);
  const selectedOrder = selectedDetail ?? selectedSummary;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-heading">Tracking</h1>
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
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded bg-secondary-bg" />
        <div className="h-12 animate-pulse rounded-full bg-secondary-bg" />
        <div className="h-72 animate-pulse rounded-[1.75rem] bg-secondary-bg" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={String(index)}
              className="h-20 animate-pulse rounded-2xl bg-secondary-bg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col gap-4 bg-catalog-surface text-catalog-text">
      <div className="px-1">
        <h1 className="text-2xl font-black tracking-tight text-catalog-text">
          Track orders
        </h1>
        <p className="mt-1 text-sm text-catalog-text-muted">
          Live rider location, ETA, and order updates.
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <p className="text-secondary">No orders yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Start shopping
          </Link>
        </Card>
      ) : (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-1 pb-1">
            {sorted.map((order) => {
              const active = order.id === selectedOrderId;
              return (
                <button
                  key={order.id}
                  type="button"
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-xs font-black transition-colors",
                    active
                      ? "border-catalog-green bg-catalog-green text-white shadow-sm"
                      : "border-catalog-border bg-card text-catalog-text hover:bg-catalog-green-muted hover:text-catalog-green",
                  )}
                  onClick={() => setChosenOrderId(order.id)}
                >
                  {shortOrderId(order.id)}
                </button>
              );
            })}
          </div>

          {selectedPending && !selectedOrder ? (
            <div className="h-72 animate-pulse rounded-[1.75rem] bg-secondary-bg" />
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
