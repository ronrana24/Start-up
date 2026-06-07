"use client";

import type { Coordinates, Order, OrderDeliveryAddress } from "@domain/order";
import { cn } from "@presentation/lib/cn";
import { useEffect, useMemo, useRef, useState } from "react";

export type LiveRouteMetrics = {
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  source: "mappls" | "estimated";
  updatedAt: number;
};

const DEFAULT_CENTER = { lat: 30.6708488, lng: 76.8277375 };
const MAP_SCRIPT_ID = "mappls-map-js";
const ROUTE_DEBOUNCE_MS = 350;

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

function destinationAddress(order: Order): string {
  return addressLabel(order.deliveryAddress);
}

export function riderCoordinateLabel(location?: Coordinates | null): string {
  if (!location) return "Waiting for rider location";
  const heading = normalizedHeading(location.heading);
  return heading == null
    ? `Rider at ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
    : `Rider at ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} - heading ${Math.round(heading)} deg`;
}

export function deliveryDirectionsUrl(order: Order): string {
  const destination = order.deliveryAddress?.coordinates
    ? `${order.deliveryAddress.coordinates.lat},${order.deliveryAddress.coordinates.lng}`
    : destinationAddress(order);
  return `https://mappls.com/dir?daddr=${encodeURIComponent(destination)}`;
}

function normalizedHeading(heading?: number | null): number | null {
  if (typeof heading !== "number" || !Number.isFinite(heading)) return null;
  return ((heading % 360) + 360) % 360;
}

function haversineMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusMeters = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusMeters * Math.asin(Math.sqrt(h));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function estimatedMetrics(
  rider: Coordinates,
  destination: Coordinates,
): LiveRouteMetrics {
  const roadDistanceMeters = haversineMeters(rider, destination) * 1.28;
  const durationSeconds = Math.max(
    180,
    Math.round((roadDistanceMeters / 1000 / 24) * 3600),
  );
  return {
    distanceText: formatDistance(roadDistanceMeters),
    durationText: formatDuration(durationSeconds),
    distanceMeters: roadDistanceMeters,
    durationSeconds,
    source: "estimated",
    updatedAt: Date.now(),
  };
}

function loadMapplsSDK(token: string): Promise<any> {
  const win = window as any;
  if (win.mappls) return Promise.resolve(win.mappls);
  if (win.__mapplsPromise) return win.__mapplsPromise;

  win.__mapplsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAP_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => {
        setTimeout(() => resolve(win.mappls), 500);
      });
      return;
    }

    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    script.src = `https://apis.mappls.com/advancedmaps/api/${token}/map_sdk?layer=vector&v=3.0`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const plugins = document.createElement("script");
      plugins.src = `https://apis.mappls.com/advancedmaps/api/${token}/map_sdk_plugins?v=3.0&libraries=direction,search`;
      plugins.async = true;
      plugins.defer = true;
      plugins.onload = () => resolve(win.mappls);
      plugins.onerror = () => reject(new Error("Mappls Plugins could not load"));
      document.head.appendChild(plugins);
    };
    script.onerror = () => reject(new Error("Mappls Maps could not load"));
    document.head.appendChild(script);
  });

  return win.__mapplsPromise;
}

function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(element.style, styles);
}

function riderMarkerContent(heading?: number | null): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-label", "Rider live location");
  applyStyles(wrapper, {
    height: "34px",
    position: "relative",
    transform: `rotate(${normalizedHeading(heading) ?? 0}deg)`,
    transformOrigin: "center",
    width: "34px",
  });

  const body = document.createElement("div");
  applyStyles(body, {
    alignItems: "center",
    background: "#0f5132",
    border: "3px solid #ffffff",
    borderRadius: "999px",
    boxShadow: "0 10px 24px rgba(15, 81, 50, 0.28)",
    display: "flex",
    height: "28px",
    justifyContent: "center",
    left: "3px",
    position: "absolute",
    top: "3px",
    width: "28px",
  });

  const arrow = document.createElement("div");
  applyStyles(arrow, {
    borderBottom: "10px solid #ffffff",
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    height: "0",
    transform: "translateY(-1px)",
    width: "0",
  });

  body.appendChild(arrow);
  wrapper.appendChild(body);
  return wrapper;
}

function destinationMarkerContent(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-label", "Delivery location");
  applyStyles(wrapper, {
    alignItems: "center",
    background: "#dc2626",
    border: "3px solid #ffffff",
    borderRadius: "999px",
    boxShadow: "0 10px 24px rgba(220, 38, 38, 0.24)",
    display: "flex",
    height: "30px",
    justifyContent: "center",
    width: "30px",
  });

  const dot = document.createElement("div");
  applyStyles(dot, {
    background: "#ffffff",
    borderRadius: "999px",
    height: "8px",
    width: "8px",
  });
  wrapper.appendChild(dot);
  return wrapper;
}

export function LiveRouteMap({
  order,
  className,
  mapClassName,
  onMetrics,
}: {
  order: Order;
  className?: string;
  mapClassName?: string;
  onMetrics?: (metrics: LiveRouteMetrics | null) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPPLS_TOKEN?.trim();
  const rider = order.rider?.currentLocation ?? null;
  const address = useMemo(() => destinationAddress(order), [order]);
  const providedDestination = order.deliveryAddress?.coordinates ?? null;
  const [mapplsApi, setMapplsApi] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [geocodedDestination, setGeocodedDestination] = useState<{
    address: string;
    coordinates: Coordinates | null;
  } | null>(null);
  const destination =
    providedDestination ??
    (geocodedDestination?.address === address
      ? geocodedDestination.coordinates
      : null);
  const effectiveLoadError = !token ? "Mappls API token is missing." : loadError;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const directionPluginRef = useRef<any>(null);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    loadMapplsSDK(token)
      .then((api) => {
        if (!cancelled) setMapplsApi(api);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Mappls Maps could not load.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!mapplsApi || !containerRef.current || mapRef.current) return;

    const initialCenter = rider ?? destination ?? DEFAULT_CENTER;
    const map = new mapplsApi.Map("live-route-map-container", {
      center: [initialCenter.lng, initialCenter.lat],
      zoom: rider ? 15 : 13,
      fullscreenControl: true,
    });
    mapRef.current = map;
  }, [destination, mapplsApi, rider]);

  useEffect(() => {
    if (!mapplsApi || destination) return;

    let cancelled = false;
    // Simple geocode equivalent using search
    mapplsApi.search({
      keyword: address,
      callback: (results: any) => {
        if (cancelled) return;
        if (results && results.length > 0 && results[0].latitude) {
          setGeocodedDestination({
            address,
            coordinates: { lat: Number(results[0].latitude), lng: Number(results[0].longitude) },
          });
          setRouteMessage(null);
        } else {
          setGeocodedDestination({ address, coordinates: null });
          setRouteMessage("Delivery address could not be located on the map.");
        }
      }
    });

    return () => { cancelled = true; };
  }, [address, destination, mapplsApi]);

  useEffect(() => {
    if (!mapplsApi || !mapRef.current) return;
    const map = mapRef.current;

    if (rider) {
      if (!riderMarkerRef.current) {
        riderMarkerRef.current = new mapplsApi.Marker({
          element: riderMarkerContent(rider.heading),
          position: [rider.lng, rider.lat],
        }).addTo(map);
      } else {
        // Remove old marker to update heading properly
        riderMarkerRef.current.remove();
        riderMarkerRef.current = new mapplsApi.Marker({
          element: riderMarkerContent(rider.heading),
          position: [rider.lng, rider.lat],
        }).addTo(map);
      }
    } else {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.remove();
        riderMarkerRef.current = null;
      }
    }

    if (destination) {
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new mapplsApi.Marker({
          element: destinationMarkerContent(),
          position: [destination.lng, destination.lat],
        }).addTo(map);
      } else {
        destinationMarkerRef.current.setLngLat([destination.lng, destination.lat]);
      }
    } else {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
    }

    if (rider && !destination) map.panTo([rider.lng, rider.lat]);
    if (!rider && destination) map.panTo([destination.lng, destination.lat]);
  }, [destination, mapplsApi, rider]);

  useEffect(() => {
    if (routeTimerRef.current) {
      clearTimeout(routeTimerRef.current);
      routeTimerRef.current = null;
    }

    if (!mapplsApi || !mapRef.current || !rider || !destination) {
      onMetrics?.(null);
      return;
    }

    const estimated = estimatedMetrics(rider, destination);
    onMetrics?.(estimated);
    setRouteMessage("Updating live route...");

    routeTimerRef.current = setTimeout(() => {
      const requestId = ++requestSeqRef.current;
      
      if (directionPluginRef.current) {
        directionPluginRef.current.remove();
      }

      mapplsApi.direction({
        map: mapRef.current,
        start: `${rider.lat},${rider.lng}`,
        end: `${destination.lat},${destination.lng}`,
        profile: "driving",
        callback: (data: any) => {
          if (requestId !== requestSeqRef.current) return;
          if (data && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distanceMeters = route.distance;
            const durationSeconds = route.duration;
            onMetrics?.({
              distanceText: formatDistance(distanceMeters),
              durationText: formatDuration(durationSeconds),
              distanceMeters,
              durationSeconds,
              source: "mappls",
              updatedAt: Date.now(),
            });
            setRouteMessage(null);
          } else {
            onMetrics?.(estimated);
            setRouteMessage("Showing estimated distance; live route is unavailable.");
          }
        }
      }, function(plugin: any) {
        directionPluginRef.current = plugin;
      });

    }, ROUTE_DEBOUNCE_MS);

    return () => {
      if (routeTimerRef.current) {
        clearTimeout(routeTimerRef.current);
        routeTimerRef.current = null;
      }
    };
  }, [destination, mapplsApi, onMetrics, rider]);

  const waitingMessage = !rider
    ? "Waiting for rider GPS"
    : !destination
      ? "Resolving delivery location"
      : routeMessage;

  return (
    <div className={cn("relative overflow-hidden bg-catalog-surface", className)}>
      <div id="live-route-map-container" ref={containerRef} className={cn("h-full min-h-72 w-full", mapClassName)} />

      {effectiveLoadError ? (
        <div className="absolute inset-0 flex flex-col justify-center gap-3 bg-secondary-bg px-4">
          <div className="h-2 rounded-full bg-border">
            <div className="h-2 w-2/3 rounded-full bg-primary" />
          </div>
          <p className="text-sm font-semibold text-heading">
            {effectiveLoadError}
          </p>
          <p className="text-sm text-secondary">
            Live route, ETA, and map-pinned rider movement need the Mappls Map Token.
          </p>
        </div>
      ) : null}

      {token && !effectiveLoadError && !mapplsApi ? (
        <div className="absolute inset-0 animate-pulse bg-secondary-bg" />
      ) : null}

      {token && !effectiveLoadError && waitingMessage ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-[11px] font-black text-heading shadow-sm backdrop-blur">
          {waitingMessage}
        </div>
      ) : null}

      {token && !effectiveLoadError && rider ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-catalog-text shadow-sm backdrop-blur sm:left-auto sm:right-3 sm:max-w-xs">
          {riderCoordinateLabel(rider)}
        </div>
      ) : null}
    </div>
  );
}
