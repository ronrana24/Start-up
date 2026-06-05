"use client";

import { useEffect, useRef, useState, useId } from "react";
import { loadMapplsSDK } from "@presentation/lib/mappls-loader";

export function AdminMapViewer({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const token = process.env.NEXT_PUBLIC_MAPPLS_TOKEN?.trim();
  const [mapplsApi, setMapplsApi] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(
    token ? null : "Mappls API token is missing.",
  );
  
  const mapId = "admin-map-viewer-" + useId().replace(/:/g, "");
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

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
    if (!mapplsApi || mapRef.current) return;

    const center = { lat: latitude, lng: longitude };

    // Initialize Mappls Map
    const map = new mapplsApi.Map(mapId, {
      center,
      zoom: 16,
      fullscreenControl: true,
      zoomControl: true,
      scrollWheelZoom: false, // Prevent accidental scrolling while scrolling the page
    });

    mapRef.current = map;

    // Wait for map load
    map.on("load", () => {
      let marker;
      try {
        marker = new mapplsApi.Marker({
          map: map,
          position: center,
          draggable: false, // Map in admin panel is read-only
        });
      } catch (e) {
        marker = new mapplsApi.Marker({
          position: center,
          draggable: false,
        });
        if (typeof marker.addTo === "function") marker.addTo(map);
      }
      markerRef.current = marker;
    });

    return () => {
      if (markerRef.current) {
        if (typeof markerRef.current.remove === "function") markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        if (typeof mapRef.current.remove === "function") {
          mapRef.current.remove();
        }
        mapRef.current = null;
      }
    };
  }, [mapplsApi, mapId]);

  // Handle prop updates gracefully without re-initializing
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    
    const newPos = { lat: latitude, lng: longitude };
    mapRef.current.panTo(newPos);
    
    if (typeof markerRef.current.setPosition === "function") {
      markerRef.current.setPosition(newPos);
    } else if (typeof markerRef.current.setLngLat === "function") {
      markerRef.current.setLngLat(newPos);
    }
  }, [latitude, longitude]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-catalog-border bg-catalog-surface">
      <div id={mapId} className="h-full w-full" />
      
      {loadError ? (
        <div className="absolute inset-0 flex flex-col justify-center gap-2 bg-catalog-surface px-4 text-center">
          <p className="text-sm font-bold text-red-600">{loadError}</p>
        </div>
      ) : null}
      
      {!loadError && !mapplsApi ? (
        <div className="absolute inset-0 animate-pulse bg-catalog-surface" />
      ) : null}
    </div>
  );
}
