"use client";

import type { Order } from "@domain/order";
import {
  deliveryDirectionsUrl,
  LiveRouteMap,
  type LiveRouteMetrics,
  riderCoordinateLabel,
} from "@presentation/components/delivery/live-route-map";
import { useState } from "react";

export function LiveDeliveryMap({ order }: { order: Order }) {
  const [metrics, setMetrics] = useState<LiveRouteMetrics | null>(null);
  const rider = order.rider?.currentLocation;

  return (
    <section className="overflow-hidden rounded-lg border border-default bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
        <div>
          <h2 className="text-sm font-black text-heading">Live delivery</h2>
          <p className="text-xs text-secondary">
            {riderCoordinateLabel(rider)}
          </p>
        </div>
        <a
          href={deliveryDirectionsUrl(order)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-primary/25 px-3 py-2 text-xs font-black text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Open Maps
        </a>
      </div>

      <LiveRouteMap order={order} className="h-72" onMetrics={setMetrics} />

      <div className="grid grid-cols-3 divide-x divide-default border-t border-default text-center text-sm">
        <div className="p-3">
          <p className="text-xs font-bold uppercase text-muted">Status</p>
          <p className="mt-1 font-black text-heading">{order.status}</p>
        </div>
        <div className="p-3">
          <p className="text-xs font-bold uppercase text-muted">Distance</p>
          <p className="mt-1 font-black text-heading">
            {metrics?.distanceText ?? "Live"}
          </p>
        </div>
        <div className="p-3">
          <p className="text-xs font-bold uppercase text-muted">ETA</p>
          <p className="mt-1 font-black text-heading">
            {metrics?.durationText ?? "Maps"}
          </p>
        </div>
      </div>
    </section>
  );
}
