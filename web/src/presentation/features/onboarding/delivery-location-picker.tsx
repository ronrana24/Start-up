"use client";

import { Button } from "@presentation/components/ui/button";
import { cn } from "@presentation/lib/cn";
import { useEffect, useRef, useState } from "react";

type LatLngLiteral = { lat: number; lng: number };
type GoogleLatLng = { lat: () => number; lng: () => number };
type GoogleMapsListener = { remove: () => void };
type GoogleMapClickEvent = { latLng?: GoogleLatLng };
type GoogleMarkerPosition = GoogleLatLng | LatLngLiteral | null | undefined;
type GoogleMap = {
  addListener: (
    eventName: "click",
    handler: (event: GoogleMapClickEvent) => void,
  ) => GoogleMapsListener;
  panTo: (position: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};
type GoogleAdvancedMarker = {
  addListener: (
    eventName: "dragend",
    handler: () => void,
  ) => GoogleMapsListener;
  map: GoogleMap | null;
  position: GoogleMarkerPosition;
};
type GoogleGeocoderResult = {
  geometry?: { location?: GoogleLatLng };
  formatted_address?: string;
};
type GoogleGeocoder = {
  geocode: (
    request: { address: string },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ) => void;
};
type GoogleAutocompletePlace = {
  displayName?: string;
  formattedAddress?: string;
  location?: GoogleLatLng;
  viewport?: unknown;
  fetchFields: (request: { fields: string[] }) => Promise<void>;
};
type GooglePlacePrediction = {
  toPlace: () => GoogleAutocompletePlace;
};
type GooglePlaceSelectEvent = Event & {
  placePrediction?: GooglePlacePrediction;
};
type GooglePlaceAutocompleteElement = HTMLElement & {
  placeholder?: string;
  addEventListener: (
    eventName: "gmp-select",
    handler: (event: GooglePlaceSelectEvent) => void,
  ) => void;
  removeEventListener: (
    eventName: "gmp-select",
    handler: (event: GooglePlaceSelectEvent) => void,
  ) => void;
};
type GoogleMapsApi = {
  maps: {
    event?: { clearInstanceListeners: (instance: unknown) => void };
    Geocoder: new () => GoogleGeocoder;
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMap;
    marker: {
      AdvancedMarkerElement: new (
        options: Record<string, unknown>,
      ) => GoogleAdvancedMarker;
    };
    places?: {
      PlaceAutocompleteElement: new (
        options: Record<string, unknown>,
      ) => GooglePlaceAutocompleteElement;
    };
  };
};

type GoogleMapsWindow = Window & {
  google?: GoogleMapsApi;
  __groveGoogleMapsReady?: () => void;
  __groveGoogleMapsPromise?: Promise<GoogleMapsApi>;
};

export type PinnedDeliveryLocation = {
  latitude: number;
  longitude: number;
  locationAccuracyMeters?: number | null;
  locationSource: string;
};

const DEFAULT_CENTER = { lat: 30.6708488, lng: 76.8277375 };
const MAP_SCRIPT_ID = "grove-google-maps-js";
const MAP_CALLBACK_NAME = "__groveGoogleMapsReady";
const FALLBACK_MAP_ID = "DEMO_MAP_ID";

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

function toLatLng(location: PinnedDeliveryLocation): LatLngLiteral {
  return { lat: location.latitude, lng: location.longitude };
}

function fromGoogleLatLng(
  location: GoogleLatLng,
  source: string,
  accuracyMeters: number | null = null,
): PinnedDeliveryLocation {
  return {
    latitude: location.lat(),
    longitude: location.lng(),
    locationAccuracyMeters: accuracyMeters,
    locationSource: source,
  };
}

function fromMarkerPosition(
  position: GoogleMarkerPosition,
  source: string,
): PinnedDeliveryLocation | null {
  if (!position) return null;
  const maybeLatLng = position as GoogleLatLng;
  if (
    typeof maybeLatLng.lat === "function" &&
    typeof maybeLatLng.lng === "function"
  ) {
    return fromGoogleLatLng(maybeLatLng, source);
  }

  const literal = position as LatLngLiteral;
  if (!Number.isFinite(literal.lat) || !Number.isFinite(literal.lng)) {
    return null;
  }
  return {
    latitude: literal.lat,
    longitude: literal.lng,
    locationAccuracyMeters: null,
    locationSource: source,
  };
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function isValidPinnedDeliveryLocation(
  location: PinnedDeliveryLocation | null,
): location is PinnedDeliveryLocation {
  return (
    !!location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

export function DeliveryLocationPicker({
  addressLabel,
  value,
  onChange,
  error,
  onClearError,
}: {
  addressLabel: string;
  value: PinnedDeliveryLocation | null;
  onChange: (location: PinnedDeliveryLocation) => void;
  error?: string;
  onClearError?: () => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const [googleMaps, setGoogleMaps] = useState<GoogleMapsApi | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const autocompleteContainerRef = useRef<HTMLDivElement | null>(null);
  const autocompleteElementRef = useRef<GooglePlaceAutocompleteElement | null>(
    null,
  );
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleAdvancedMarker | null>(null);
  const geocoderRef = useRef<GoogleGeocoder | null>(null);
  const onChangeRef = useRef(onChange);
  const onClearErrorRef = useRef(onClearError);

  useEffect(() => {
    onChangeRef.current = onChange;
    onClearErrorRef.current = onClearError;
  }, [onChange, onClearError]);

  useEffect(() => {
    if (!apiKey) {
      setLoadError("Google Maps API key is missing.");
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

  function placePin(
    location: PinnedDeliveryLocation,
    options: { notify: boolean; zoom?: number; message?: string },
  ) {
    const position = toLatLng(location);
    if (markerRef.current) {
      markerRef.current.map = mapRef.current;
      markerRef.current.position = position;
    }
    if (mapRef.current) {
      mapRef.current.panTo(position);
      if (options.zoom) {
        mapRef.current.setZoom(options.zoom);
      }
    }
    if (options.notify) {
      onClearErrorRef.current?.();
      onChangeRef.current(location);
    }
    if (options.message) {
      setStatus(options.message);
    }
  }

  useEffect(() => {
    if (!googleMaps || !mapContainerRef.current || mapRef.current) return;

    const initialCenter = value ? toLatLng(value) : DEFAULT_CENTER;
    const map = new googleMaps.maps.Map(mapContainerRef.current, {
      center: initialCenter,
      zoom: value ? 17 : 12,
      mapId:
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || FALLBACK_MAP_ID,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      gestureHandling: "greedy",
    });
    const marker = new googleMaps.maps.marker.AdvancedMarkerElement({
      map: value ? map : null,
      position: initialCenter,
      gmpDraggable: true,
      title: "Pinned delivery location",
    });

    mapRef.current = map;
    markerRef.current = marker;
    geocoderRef.current = new googleMaps.maps.Geocoder();

    const mapClickListener = map.addListener("click", (event) => {
      if (!event.latLng) return;
      placePin(fromGoogleLatLng(event.latLng, "map_pin"), {
        notify: true,
        zoom: 17,
        message: "Delivery pin selected.",
      });
    });
    const dragListener = marker.addListener("dragend", () => {
      const location = fromMarkerPosition(marker.position, "map_pin");
      if (!location) return;
      placePin(location, {
        notify: true,
        message: "Delivery pin adjusted.",
      });
    });

    return () => {
      mapClickListener.remove();
      dragListener.remove();
      googleMaps.maps.event?.clearInstanceListeners(map);
      googleMaps.maps.event?.clearInstanceListeners(marker);
      marker.map = null;
      mapRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
    };
  }, [googleMaps]);

  useEffect(() => {
    if (value && mapRef.current && markerRef.current) {
      placePin(value, { notify: false });
    }
  }, [value]);

  useEffect(() => {
    const autocompleteHost = autocompleteContainerRef.current;
    if (
      !googleMaps?.maps.places?.PlaceAutocompleteElement ||
      !autocompleteHost ||
      autocompleteElementRef.current
    ) {
      return;
    }

    const autocomplete = new googleMaps.maps.places.PlaceAutocompleteElement(
      {},
    );
    autocomplete.placeholder = "Search building, shop, or landmark";
    autocomplete.className = "block w-full";

    const handleSelect = async (event: GooglePlaceSelectEvent) => {
      const placePrediction = event.placePrediction;
      if (!placePrediction) {
        setStatus("Choose a result from the location suggestions.");
        return;
      }

      const place = placePrediction.toPlace();
      try {
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location", "viewport"],
        });
      } catch {
        setStatus(
          "Could not read this place. Try another result or place the pin manually.",
        );
        return;
      }

      const location = place.location;
      if (!location) {
        setStatus("Choose a result from the location suggestions.");
        return;
      }
      const label = place.formattedAddress ?? place.displayName ?? "";
      if (label) setSearchValue(label);
      placePin(fromGoogleLatLng(location, "places_autocomplete"), {
        notify: true,
        zoom: 17,
        message: "Delivery pin selected from Google Places.",
      });
    };

    autocomplete.addEventListener("gmp-select", handleSelect);
    autocompleteHost.appendChild(autocomplete);
    autocompleteElementRef.current = autocomplete;

    return () => {
      autocomplete.removeEventListener("gmp-select", handleSelect);
      autocomplete.remove();
      autocompleteElementRef.current = null;
    };
  }, [googleMaps]);

  useEffect(() => {
    if (autocompleteElementRef.current) {
      autocompleteElementRef.current.placeholder =
        addressLabel || "Search building, shop, or landmark";
    }
  }, [addressLabel]);

  function locateAddress() {
    const query = searchValue.trim() || addressLabel.trim();
    if (!query || !geocoderRef.current) {
      setStatus("Enter address details before locating on the map.");
      return;
    }
    setStatus("Locating address on map...");
    geocoderRef.current.geocode({ address: query }, (results, response) => {
      const location = results?.[0]?.geometry?.location;
      if (response !== "OK" || !location) {
        setStatus(
          "Could not locate this address. Search nearby and place the pin manually.",
        );
        return;
      }
      placePin(fromGoogleLatLng(location, "geocode"), {
        notify: true,
        zoom: 17,
        message: "Delivery pin placed near the address.",
      });
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("Current location is not available in this browser.");
      return;
    }
    setLocating(true);
    setStatus("Reading current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const location: PinnedDeliveryLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationAccuracyMeters: position.coords.accuracy,
          locationSource: "browser_geolocation",
        };
        placePin(location, {
          notify: true,
          zoom: 17,
          message: "Current location pinned.",
        });
      },
      () => {
        setLocating(false);
        setStatus("Location permission was denied or unavailable.");
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-default bg-card shadow-sm">
      <div className="space-y-3 border-b border-default p-4">
        <div>
          <h2 className="text-sm font-black text-heading">
            Exact delivery pin
          </h2>
          <p className="mt-1 text-xs text-secondary">
            Riders will navigate to this pinned point instead of guessing from
            the street address.
          </p>
        </div>
        <div className="flex w-full flex-col gap-1.5 text-sm">
          <span className="font-medium text-heading">
            Search delivery location
          </span>
          <div
            ref={autocompleteContainerRef}
            className="min-h-11 rounded-lg border border-input-border bg-input-bg px-1 py-1 text-heading [&_gmp-place-autocomplete]:w-full"
          />
          {searchValue ? (
            <p className="text-xs text-secondary">{searchValue}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={locateAddress}
            disabled={!googleMaps}
          >
            Locate address
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={useCurrentLocation}
            disabled={locating || !googleMaps}
          >
            {locating ? "Locating..." : "Use current"}
          </Button>
        </div>
      </div>

      <div className="relative h-72 bg-secondary-bg">
        <div ref={mapContainerRef} className="h-full w-full" />
        {loadError ? (
          <div className="absolute inset-0 flex flex-col justify-center gap-2 bg-secondary-bg px-4">
            <p className="text-sm font-black text-heading">{loadError}</p>
            <p className="text-xs text-secondary">
              Enable Maps JavaScript, Places, and Geocoding for the configured
              map key.
            </p>
          </div>
        ) : null}
        {!loadError && !googleMaps ? (
          <div className="absolute inset-0 animate-pulse bg-secondary-bg" />
        ) : null}
      </div>

      <div className="space-y-2 p-4">
        {isValidPinnedDeliveryLocation(value) ? (
          <div className="rounded-lg border border-primary/20 bg-primary-light px-3 py-2 text-xs font-bold text-primary-dark">
            Pinned at {formatCoordinate(value.latitude)},{" "}
            {formatCoordinate(value.longitude)}
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-bold",
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-default bg-input-bg text-secondary",
            )}
          >
            {error ?? "Place a pin on the map to continue."}
          </div>
        )}
        {status ? <p className="text-xs text-secondary">{status}</p> : null}
      </div>
    </section>
  );
}
