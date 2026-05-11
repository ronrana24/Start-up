"use client";

import { DownloadOrderInvoiceButton } from "@presentation/components/order/download-order-invoice-button";
import { LiveDeliveryMap } from "@presentation/components/delivery/live-delivery-map";
import type { Order } from "@domain/order";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { Card } from "@presentation/components/ui/card";
import { LinkButton } from "@presentation/components/ui/link-button";
import { useRequireAuth } from "@presentation/hooks/use-require-auth";
import { useOrderTrackingQuery } from "@presentation/hooks/use-order-tracking-query";
import { createDeliverySocket } from "@presentation/lib/delivery-realtime";
import { formatMoney } from "@presentation/lib/format-money";
import { queryKeys } from "@presentation/query-keys";
import { useAuthStore } from "@presentation/state/auth-store";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

const LOCATION_CACHE_UPDATE_MS = 8000;
const LOCATION_REFETCH_MS = 30000;

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

function TrackingPageHeader() {
  return (
    <MobilePageHeader title="Track Order" fallbackHref="/orders/tracking" />
  );
}

export function OrderTrackingScreen() {
  const ready = useRequireAuth();
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;
  const userId = useAuthStore((s) => s.userId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const lastLocationCacheUpdateRef = useRef(0);
  const lastLocationRefetchRef = useRef(0);
  const locationRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { data, isPending, isError, refetch } = useOrderTrackingQuery(
    orderId,
    userId,
  );

  useEffect(() => {
    if (!orderId || !userId) return;
    const socket = createDeliverySocket(accessToken);
    const reloadNow = () => {
      void refetch();
    };
    const applyLocationUpdate = (payload: unknown) => {
      if (!isRiderLocationPayload(payload) || payload.orderId !== orderId) {
        return;
      }

      const now = Date.now();
      const queryKey = queryKeys.order(userId, orderId);
      if (
        now - lastLocationCacheUpdateRef.current >=
        LOCATION_CACHE_UPDATE_MS
      ) {
        lastLocationCacheUpdateRef.current = now;
        queryClient.setQueryData<Order | undefined>(queryKey, (current) => {
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
        });
      }

      const elapsed = now - lastLocationRefetchRef.current;
      if (elapsed >= LOCATION_REFETCH_MS) {
        lastLocationRefetchRef.current = now;
        void refetch();
        return;
      }

      if (!locationRefetchTimerRef.current) {
        locationRefetchTimerRef.current = setTimeout(() => {
          locationRefetchTimerRef.current = null;
          lastLocationRefetchRef.current = Date.now();
          void refetch();
        }, LOCATION_REFETCH_MS - elapsed);
      }
    };

    socket.emit("order:subscribe", { orderId });
    socket.on("order.assigned", reloadNow);
    socket.on("order.status_changed", reloadNow);
    socket.on("rider.location_updated", applyLocationUpdate);
    return () => {
      if (locationRefetchTimerRef.current) {
        clearTimeout(locationRefetchTimerRef.current);
        locationRefetchTimerRef.current = null;
      }
      socket.disconnect();
    };
  }, [accessToken, orderId, queryClient, refetch, userId]);

  if (!ready) {
    return null;
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <TrackingPageHeader />
        <div className="h-48 animate-pulse rounded-xl bg-secondary-bg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <TrackingPageHeader />
        <Card>
          <p className="text-secondary">Order not found.</p>
          <Link
            href="/orders/history"
            className="mt-3 text-sm font-semibold text-primary"
          >
            Back to history
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TrackingPageHeader />
      <p className="px-1 font-mono text-sm text-secondary">{data.id}</p>
      <LiveDeliveryMap order={data} />
      <Card>
        <ol className="space-y-4">
          {data.trackingSteps.map((step, i) => (
            <li key={step.key} className="flex gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? "bg-success-bg text-success"
                    : "bg-disabled-bg text-disabled-text"
                }`}
              >
                {i + 1}
              </div>
              <div>
                <p className="font-semibold text-heading">{step.label}</p>
                {step.completedAt ? (
                  <p className="text-xs text-muted">
                    {new Date(step.completedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-muted">Pending</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-secondary">Order total</span>
          <span className="font-semibold text-heading">
            {formatMoney(data.totalCents)}
          </span>
        </div>
        <DownloadOrderInvoiceButton
          order={data}
          fullWidth
          className="mt-4 min-h-10 rounded-lg"
        />
      </Card>
      <LinkButton href="/orders/history" variant="secondary" fullWidth>
        Order history
      </LinkButton>
    </div>
  );
}
