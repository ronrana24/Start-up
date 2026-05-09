"use client";

import type { Order } from "@domain/order";
import { useEffect, useMemo, useRef, useState } from "react";

const MAP_FRAME_UPDATE_MS = 30000;

function addressLabel(order: Order): string {
  const address = order.deliveryAddress;
  if (!address) return "Delivery address";
  return [
    address.line1,
    address.line2,
    [address.city, address.state, address.pincode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" - ");
}

function destination(order: Order): string {
  const coords = order.deliveryAddress?.coordinates;
  if (coords) return `${coords.lat},${coords.lng}`;
  return addressLabel(order);
}

function directionsUrl(order: Order) {
  const rider = order.rider?.currentLocation;
  const params = new URLSearchParams({
    api: "1",
    destination: destination(order),
    travelmode: "driving",
  });
  if (rider) {
    params.set("origin", `${rider.lat},${rider.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function embedUrl(order: Order, apiKey: string) {
  const rider = order.rider?.currentLocation;
  if (rider) {
    const params = new URLSearchParams({
      key: apiKey,
      origin: `${rider.lat},${rider.lng}`,
      destination: destination(order),
      mode: "driving",
    });
    return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
  }

  const params = new URLSearchParams({
    key: apiKey,
    q: destination(order),
  });
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

function embedMode(url: string | null): "directions" | "place" | null {
  if (!url) return null;
  return url.includes("/directions?") ? "directions" : "place";
}

function useStableEmbedUrl(nextUrl: string | null) {
  const [frameUrl, setFrameUrl] = useState(nextUrl);
  const frameUrlRef = useRef(nextUrl);
  const lastUpdateRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleFrameUrl = (url: string | null, delay: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        frameUrlRef.current = url;
        if (url) {
          lastUpdateRef.current = Date.now();
        }
        setFrameUrl(url);
      }, delay);
    };

    if (!nextUrl) {
      scheduleFrameUrl(null, 0);
      return;
    }

    const now = Date.now();
    const current = frameUrlRef.current;
    const modeChanged = embedMode(current) !== embedMode(nextUrl);
    const canUpdate = now - lastUpdateRef.current >= MAP_FRAME_UPDATE_MS;

    if (!current || modeChanged || canUpdate) {
      scheduleFrameUrl(nextUrl, 0);
      return;
    }

    scheduleFrameUrl(
      nextUrl,
      MAP_FRAME_UPDATE_MS - (now - lastUpdateRef.current),
    );
  }, [nextUrl]);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return frameUrl;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function routeEstimate(order: Order) {
  const rider = order.rider?.currentLocation;
  const destinationCoords = order.deliveryAddress?.coordinates;
  if (!rider || !destinationCoords) {
    return null;
  }
  const km = haversineKm(rider, destinationCoords);
  const routeKm = km * 1.28;
  const minutes = Math.max(3, Math.round((routeKm / 24) * 60));
  return {
    distance: `${routeKm.toFixed(routeKm < 10 ? 1 : 0)} km`,
    eta: `${minutes} min`,
  };
}

export function LiveDeliveryMap({ order }: { order: Order }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const rider = order.rider?.currentLocation;
  const estimate = routeEstimate(order);
  const mapsUrl = directionsUrl(order);
  const nextFrameUrl = useMemo(
    () => (apiKey ? embedUrl(order, apiKey) : null),
    [apiKey, order],
  );
  const frameUrl = useStableEmbedUrl(nextFrameUrl);

  return (
    <section className="overflow-hidden rounded-lg border border-default bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
        <div>
          <h2 className="text-sm font-black text-heading">Live delivery</h2>
          <p className="text-xs text-secondary">
            {rider
              ? `Rider at ${rider.lat.toFixed(5)}, ${rider.lng.toFixed(5)}`
              : "Waiting for rider location"}
          </p>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-primary/25 px-3 py-2 text-xs font-black text-primary transition-colors hover:bg-primary hover:text-white"
        >
          Open Maps
        </a>
      </div>
      {apiKey && frameUrl ? (
        <iframe
          title="Live delivery route"
          src={frameUrl}
          className="h-72 w-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="flex h-72 flex-col justify-center gap-3 bg-secondary-bg px-4">
          <div className="h-2 rounded-full bg-border">
            <div className="h-2 w-2/3 rounded-full bg-primary" />
          </div>
          <p className="text-sm font-semibold text-heading">
            Google Maps preview needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
          </p>
          <p className="text-sm text-secondary">
            The rider app and buyer tracking still share live coordinates and
            can open turn-by-turn directions.
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 divide-x divide-default border-t border-default text-center text-sm">
        <div className="p-3">
          <p className="text-xs font-bold uppercase text-muted">Status</p>
          <p className="mt-1 font-black text-heading">{order.status}</p>
        </div>
        <div className="p-3">
          <p className="text-xs font-bold uppercase text-muted">Distance</p>
          <p className="mt-1 font-black text-heading">
            {estimate?.distance ?? "Live"}
          </p>
        </div>
        <div className="p-3">
          <p className="text-xs font-bold uppercase text-muted">ETA</p>
          <p className="mt-1 font-black text-heading">
            {estimate?.eta ?? "Maps"}
          </p>
        </div>
      </div>
    </section>
  );
}
