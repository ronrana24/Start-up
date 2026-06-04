"use client";

import { Button } from "@presentation/components/ui/button";
import { cn } from "@presentation/lib/cn";
import { useEffect, useRef, useState } from "react";

export type PinnedDeliveryLocation = {
  latitude: number;
  longitude: number;
  locationAccuracyMeters?: number | null;
  locationSource: string;
};

const DEFAULT_CENTER = { lat: 30.6708488, lng: 76.8277375 };
const MAP_SCRIPT_ID = "mappls-map-js";

function loadMapplsSDK(token: string): Promise<any> {
  const win = window as any;
  if (win.mappls) return Promise.resolve(win.mappls);
  if (win.__mapplsPromise) return win.__mapplsPromise;

  win.__mapplsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAP_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => {
        // Assume plugins load shortly after
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
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (typeof args[0] === "string" && args[0].includes("Plugin fail to load")) {
          return;
        }
        originalConsoleError(...args);
      };

      const plugins = document.createElement("script");
      plugins.src = `https://apis.mappls.com/advancedmaps/api/${token}/map_sdk_plugins?v=3.0&libraries=search`;
      plugins.async = true;
      plugins.defer = true;
      plugins.onload = () => {
        console.error = originalConsoleError;
        resolve(win.mappls);
      };
      plugins.onerror = () => {
        console.error = originalConsoleError;
        reject(new Error("Mappls Plugins could not load"));
      };
      document.head.appendChild(plugins);
    };
    script.onerror = () => reject(new Error("Mappls Maps could not load"));
    document.head.appendChild(script);
  });

  return win.__mapplsPromise;
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
  const token = process.env.NEXT_PUBLIC_MAPPLS_TOKEN?.trim();
  const [mapplsApi, setMapplsApi] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(
    token ? null : "Mappls API token is missing.",
  );
  const [searchValue, setSearchValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const onClearErrorRef = useRef(onClearError);

  useEffect(() => {
    onChangeRef.current = onChange;
    onClearErrorRef.current = onClearError;
  }, [onChange, onClearError]);

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

  function placePin(
    location: PinnedDeliveryLocation,
    options: { notify: boolean; zoom?: number; message?: string },
  ) {
    if (markerRef.current) {
      if (typeof markerRef.current.setPosition === 'function') {
        markerRef.current.setPosition({ lat: location.latitude, lng: location.longitude });
      } else if (typeof markerRef.current.setLngLat === 'function') {
        markerRef.current.setLngLat({ lat: location.latitude, lng: location.longitude });
      }
    } else if (mapRef.current && mapplsApi) {
       let marker;
       try {
         marker = new mapplsApi.Marker({
           map: mapRef.current,
           draggable: true,
           position: { lat: location.latitude, lng: location.longitude }
         });
       } catch (e) {
         // Fallback if Mapbox-style is expected
         marker = new mapplsApi.Marker({
           draggable: true,
           position: { lat: location.latitude, lng: location.longitude }
         });
         if (typeof marker.addTo === 'function') marker.addTo(mapRef.current);
       }
       markerRef.current = marker;

       markerRef.current.on("dragend", (e: any) => {
         const pos = e.target.getPosition ? e.target.getPosition() : (e.target.getLngLat ? e.target.getLngLat() : null);
         if (!pos) return;
         placePin({
           latitude: pos.lat,
           longitude: pos.lng,
           locationSource: "map_pin"
         }, { notify: true, message: "Delivery pin adjusted." });
       });
    }

    if (mapRef.current) {
      mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
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
    if (!mapplsApi || !mapContainerRef.current || mapRef.current) return;

    const initialCenter = value ? { lat: value.latitude, lng: value.longitude } : { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
    
    // Initialize Mappls Map
    const map = new mapplsApi.Map("location-picker-map-container", {
      center: initialCenter,
      zoom: value ? 17 : 12,
      fullscreenControl: true,
    });

    mapRef.current = map;

    // Wait for map load
    map.on("load", () => {
      let marker;
      try {
        marker = new mapplsApi.Marker({
          map: map,
          draggable: true,
          position: initialCenter,
        });
      } catch (e) {
        marker = new mapplsApi.Marker({
          draggable: true,
          position: initialCenter,
        });
        if (typeof marker.addTo === 'function') marker.addTo(map);
      }

      markerRef.current = marker;

      marker.on("dragend", (e: any) => {
        const pos = e.target.getPosition ? e.target.getPosition() : (e.target.getLngLat ? e.target.getLngLat() : null);
        if (!pos) return;
        placePin({
          latitude: pos.lat,
          longitude: pos.lng,
          locationSource: "map_pin"
        }, { notify: true, message: "Delivery pin adjusted." });
      });

      map.on("click", (e: any) => {
        if (!e.lngLat) return;
        placePin({
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
          locationSource: "map_pin"
        }, { notify: true, zoom: 17, message: "Delivery pin selected." });
      });
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        // Depending on version, map.remove() might be available
        if (typeof mapRef.current.remove === "function") {
          mapRef.current.remove();
        }
        mapRef.current = null;
      }
    };
  }, [mapplsApi]);

  useEffect(() => {
    if (value && mapRef.current && markerRef.current) {
      placePin(value, { notify: false });
    }
  }, [value]);

  function locateAddress() {
    const query = searchValue.trim() || addressLabel.trim();
    if (!query || !mapplsApi?.search) {
      setStatus("Enter address details before locating on the map. (Or search plugin is missing)");
      return;
    }
    setStatus("Locating address on map...");
    
    mapplsApi.search({
      keyword: query,
      callback: (results: any) => {
        if (results && results.length > 0) {
          const loc = results[0];
          // Mappls search returns eLoc or coordinates
          if (loc.latitude && loc.longitude) {
            placePin({
              latitude: Number(loc.latitude),
              longitude: Number(loc.longitude),
              locationSource: "search"
            }, { notify: true, zoom: 17, message: "Delivery pin placed near the address." });
            setSearchValue(loc.placeName || query);
          } else {
            setStatus("Address matched, but no coordinates found.");
          }
        } else {
          setStatus("Could not locate this address. Search nearby and place the pin manually.");
        }
      }
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
          <input
            className="min-h-11 rounded-lg border border-input-border bg-input-bg px-3 py-1 text-heading w-full"
            placeholder={addressLabel || "Search building, shop, or landmark"}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                locateAddress();
              }
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={locateAddress}
            disabled={!mapplsApi}
          >
            Locate address
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={useCurrentLocation}
            disabled={locating || !mapplsApi}
          >
            {locating ? "Locating..." : "Use current"}
          </Button>
        </div>
      </div>

      <div className="relative h-72 bg-secondary-bg">
        <div id="location-picker-map-container" ref={mapContainerRef} className="h-full w-full" />
        {loadError ? (
          <div className="absolute inset-0 flex flex-col justify-center gap-2 bg-secondary-bg px-4">
            <p className="text-sm font-black text-heading">{loadError}</p>
            <p className="text-xs text-secondary">
              Make sure NEXT_PUBLIC_MAPPLS_TOKEN is set in your environment.
            </p>
          </div>
        ) : null}
        {!loadError && !mapplsApi ? (
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
