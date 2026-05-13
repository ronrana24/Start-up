"use client";

import type { Coordinates, Order, OrderDeliveryAddress } from "@domain/order";
import { cn } from "@presentation/lib/cn";
import { useEffect, useMemo, useRef, useState } from "react";

type LatLngLiteral = { lat: number; lng: number };
type GoogleLatLng = { lat: () => number; lng: () => number };
type GoogleMap = {
  panTo: (position: LatLngLiteral) => void;
  fitBounds: (bounds: unknown, padding?: number) => void;
};
type GoogleAdvancedMarker = HTMLElement & {
  map: GoogleMap | null;
  position: LatLngLiteral | null;
};
type GoogleDirectionsRenderer = {
  setDirections: (result: GoogleDirectionsResult) => void;
  setMap: (map: GoogleMap | null) => void;
};
type GoogleDirectionsService = {
  route: (
    request: Record<string, unknown>,
    callback: (result: GoogleDirectionsResult | null, status: string) => void,
  ) => void;
};
type GoogleGeocoderResult = {
  geometry?: { location?: GoogleLatLng };
};
type GoogleGeocoder = {
  geocode: (
    request: { address: string },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ) => void;
};
type GooglePolyline = {
  setMap: (map: GoogleMap | null) => void;
  setPath: (path: LatLngLiteral[]) => void;
};
type GoogleDirectionsLeg = {
  distance?: { value?: number };
  duration?: { value?: number };
};
type GoogleDirectionsResult = {
  routes: Array<{ legs?: GoogleDirectionsLeg[] }>;
};
type GoogleMapsApi = {
  maps: {
    DirectionsRenderer: new (
      options: Record<string, unknown>,
    ) => GoogleDirectionsRenderer;
    DirectionsService: new () => GoogleDirectionsService;
    Geocoder: new () => GoogleGeocoder;
    LatLngBounds: new () => { extend: (position: LatLngLiteral) => void };
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMap;
    marker: {
      AdvancedMarkerElement: new (
        options: Record<string, unknown>,
      ) => GoogleAdvancedMarker;
    };
    Polyline: new (options: Record<string, unknown>) => GooglePolyline;
    TravelMode: {
      DRIVING: unknown;
    };
  };
};

type GoogleMapsWindow = Window & {
  google?: GoogleMapsApi;
  __groveGoogleMapsReady?: () => void;
  __groveGoogleMapsPromise?: Promise<GoogleMapsApi>;
};

export type LiveRouteMetrics = {
  distanceText: string;
  durationText: string;
  distanceMeters: number;
  durationSeconds: number;
  source: "google" | "estimated";
  updatedAt: number;
};

const DEFAULT_CENTER = { lat: 30.6708488, lng: 76.8277375 };
const MAP_SCRIPT_ID = "grove-google-maps-js";
const MAP_CALLBACK_NAME = "__groveGoogleMapsReady";
const FALLBACK_MAP_ID = "DEMO_MAP_ID";
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
  const rider = order.rider?.currentLocation;
  const destination = order.deliveryAddress?.coordinates
    ? `${order.deliveryAddress.coordinates.lat},${order.deliveryAddress.coordinates.lng}`
    : destinationAddress(order);
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });
  if (rider) {
    params.set("origin", `${rider.lat},${rider.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function normalizedHeading(heading?: number | null): number | null {
  if (typeof heading !== "number" || !Number.isFinite(heading)) return null;
  return ((heading % 360) + 360) % 360;
}

function asLatLng(location: Coordinates): LatLngLiteral {
  return { lat: location.lat, lng: location.lng };
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

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  const win = window as GoogleMapsWindow;
  if (win.google?.maps) {
    return Promise.resolve(win.google);
  }
  if (win.__groveGoogleMapsPromise) {
    return win.__groveGoogleMapsPromise;
  }

  win.__groveGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(
      MAP_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(win.google!));
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps could not load")),
      );
      return;
    }

    win.__groveGoogleMapsReady = () => {
      resolve(win.google!);
      delete win.__groveGoogleMapsReady;
    };

    const params = new URLSearchParams({
      key: apiKey,
      callback: MAP_CALLBACK_NAME,
      libraries: "places,marker",
      loading: "async",
      v: "weekly",
    });

    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps could not load"));
    document.head.appendChild(script);
  });

  return win.__groveGoogleMapsPromise;
}

function applyStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
) {
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

function routeMetricsFromResult(
  result: GoogleDirectionsResult,
): LiveRouteMetrics | null {
  const legs = result.routes[0]?.legs ?? [];
  if (!legs.length) return null;

  const distanceMeters = legs.reduce(
    (sum: number, leg) => sum + (leg.distance?.value ?? 0),
    0,
  );
  const durationSeconds = legs.reduce(
    (sum: number, leg) => sum + (leg.duration?.value ?? 0),
    0,
  );
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;

  return {
    distanceText: formatDistance(distanceMeters),
    durationText: formatDuration(durationSeconds),
    distanceMeters,
    durationSeconds,
    source: "google",
    updatedAt: Date.now(),
  };
}

function fitTwoPoints(
  googleMaps: GoogleMapsApi,
  map: GoogleMap,
  rider: Coordinates,
  destination: Coordinates,
) {
  const bounds = new googleMaps.maps.LatLngBounds();
  bounds.extend(asLatLng(rider));
  bounds.extend(asLatLng(destination));
  map.fitBounds(bounds, 64);
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
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const rider = order.rider?.currentLocation ?? null;
  const address = useMemo(() => destinationAddress(order), [order]);
  const providedDestination = order.deliveryAddress?.coordinates ?? null;
  const [googleMaps, setGoogleMaps] = useState<GoogleMapsApi | null>(null);
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
  const missingApiKey = !apiKey;
  const effectiveLoadError = missingApiKey
    ? "Google Maps API key is missing."
    : loadError;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const riderMarkerRef = useRef<GoogleAdvancedMarker | null>(null);
  const destinationMarkerRef = useRef<GoogleAdvancedMarker | null>(null);
  const directionsRendererRef = useRef<GoogleDirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<GoogleDirectionsService | null>(null);
  const geocoderRef = useRef<GoogleGeocoder | null>(null);
  const fallbackPolylineRef = useRef<GooglePolyline | null>(null);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then((api) => {
        if (!cancelled) setGoogleMaps(api);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Google Maps could not load.");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!googleMaps || !containerRef.current || mapRef.current) return;

    const initialCenter = rider ?? destination ?? DEFAULT_CENTER;
    const map = new googleMaps.maps.Map(containerRef.current, {
      center: asLatLng(initialCenter),
      zoom: rider ? 15 : 13,
      mapId:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || FALLBACK_MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      gestureHandling: "greedy",
    });

    mapRef.current = map;
    directionsServiceRef.current = new googleMaps.maps.DirectionsService();
    geocoderRef.current = new googleMaps.maps.Geocoder();
    directionsRendererRef.current = new googleMaps.maps.DirectionsRenderer({
      map,
      preserveViewport: false,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#0f5132",
        strokeOpacity: 0.95,
        strokeWeight: 6,
      },
    });
  }, [destination, googleMaps, rider]);

  useEffect(() => {
    if (!googleMaps || !geocoderRef.current || destination) return;

    let cancelled = false;
    geocoderRef.current.geocode(
      { address },
      (results: GoogleGeocoderResult[] | null, status: string) => {
        if (cancelled) return;
        const location = results?.[0]?.geometry?.location;
        if (status === "OK" && location) {
          setGeocodedDestination({
            address,
            coordinates: { lat: location.lat(), lng: location.lng() },
          });
          setRouteMessage(null);
        } else {
          setGeocodedDestination({ address, coordinates: null });
          setRouteMessage("Delivery address could not be located on the map.");
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [address, destination, googleMaps]);

  useEffect(() => {
    if (!googleMaps || !mapRef.current) return;
    const map = mapRef.current;

    if (rider) {
      const position = asLatLng(rider);
      if (!riderMarkerRef.current) {
        riderMarkerRef.current =
          new googleMaps.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title: "Rider live location",
            zIndex: 20,
          });
        riderMarkerRef.current.replaceChildren(
          riderMarkerContent(rider.heading),
        );
      } else {
        riderMarkerRef.current.map = map;
        riderMarkerRef.current.position = position;
        riderMarkerRef.current.replaceChildren(
          riderMarkerContent(rider.heading),
        );
      }
    } else {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.map = null;
      }
    }

    if (destination) {
      const position = asLatLng(destination);
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current =
          new googleMaps.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title: "Delivery location",
            zIndex: 10,
          });
        destinationMarkerRef.current.replaceChildren(
          destinationMarkerContent(),
        );
      } else {
        destinationMarkerRef.current.map = map;
        destinationMarkerRef.current.position = position;
      }
    } else {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.map = null;
      }
    }

    if (rider && !destination) map.panTo(asLatLng(rider));
    if (!rider && destination) map.panTo(asLatLng(destination));
  }, [destination, googleMaps, rider]);

  useEffect(() => {
    if (routeTimerRef.current) {
      clearTimeout(routeTimerRef.current);
      routeTimerRef.current = null;
    }

    if (!googleMaps || !mapRef.current || !rider || !destination) {
      onMetrics?.(null);
      return;
    }

    const estimated = estimatedMetrics(rider, destination);
    onMetrics?.(estimated);
    setRouteMessage("Updating live route...");

    routeTimerRef.current = setTimeout(() => {
      const requestId = ++requestSeqRef.current;
      directionsServiceRef.current?.route(
        {
          origin: asLatLng(rider),
          destination: asLatLng(destination),
          travelMode: googleMaps.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
          },
        },
        (result: GoogleDirectionsResult | null, status: string) => {
          if (requestId !== requestSeqRef.current) return;

          if (status === "OK" && result) {
            fallbackPolylineRef.current?.setMap(null);
            fallbackPolylineRef.current = null;
            directionsRendererRef.current?.setDirections(result);
            const metrics = routeMetricsFromResult(result);
            onMetrics?.(metrics ?? estimated);
            setRouteMessage(null);
            return;
          }

          directionsRendererRef.current?.setMap(null);
          directionsRendererRef.current?.setMap(mapRef.current);
          if (!fallbackPolylineRef.current) {
            fallbackPolylineRef.current = new googleMaps.maps.Polyline({
              map: mapRef.current,
              path: [asLatLng(rider), asLatLng(destination)],
              geodesic: true,
              strokeColor: "#0f5132",
              strokeOpacity: 0.75,
              strokeWeight: 4,
            });
          } else {
            fallbackPolylineRef.current.setMap(mapRef.current);
            fallbackPolylineRef.current.setPath([
              asLatLng(rider),
              asLatLng(destination),
            ]);
          }
          fitTwoPoints(googleMaps, mapRef.current!, rider, destination);
          onMetrics?.(estimated);
          setRouteMessage(
            "Showing estimated distance; live route is unavailable.",
          );
        },
      );
    }, ROUTE_DEBOUNCE_MS);

    return () => {
      if (routeTimerRef.current) {
        clearTimeout(routeTimerRef.current);
        routeTimerRef.current = null;
      }
    };
  }, [destination, googleMaps, onMetrics, rider]);

  const waitingMessage = !rider
    ? "Waiting for rider GPS"
    : !destination
      ? "Resolving delivery location"
      : routeMessage;

  return (
    <div
      className={cn("relative overflow-hidden bg-catalog-surface", className)}
    >
      <div
        ref={containerRef}
        className={cn("h-full min-h-72 w-full", mapClassName)}
      />

      {effectiveLoadError ? (
        <div className="absolute inset-0 flex flex-col justify-center gap-3 bg-secondary-bg px-4">
          <div className="h-2 rounded-full bg-border">
            <div className="h-2 w-2/3 rounded-full bg-primary" />
          </div>
          <p className="text-sm font-semibold text-heading">
            {effectiveLoadError}
          </p>
          <p className="text-sm text-secondary">
            Live route, ETA, and map-pinned rider movement need the Google Maps
            JavaScript API key.
          </p>
        </div>
      ) : null}

      {apiKey && !effectiveLoadError && !googleMaps ? (
        <div className="absolute inset-0 animate-pulse bg-secondary-bg" />
      ) : null}

      {apiKey && !effectiveLoadError && waitingMessage ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-[11px] font-black text-heading shadow-sm backdrop-blur">
          {waitingMessage}
        </div>
      ) : null}

      {apiKey && !effectiveLoadError && rider ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-catalog-text shadow-sm backdrop-blur sm:left-auto sm:right-3 sm:max-w-xs">
          {riderCoordinateLabel(rider)}
        </div>
      ) : null}
    </div>
  );
}
