"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@presentation/lib/cn";

const MAP_SCRIPT_ID = "mappls-map-js";
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 }; // New Delhi

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
      resolve(win.mappls);
    };
    script.onerror = () => reject(new Error("Mappls Maps could not load"));
    document.head.appendChild(script);
  });

  return win.__mapplsPromise;
}

export function HomeMap({ className }: { className?: string }) {
  const token = process.env.NEXT_PUBLIC_MAPPLS_TOKEN?.trim();
  const [mapplsApi, setMapplsApi] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    loadMapplsSDK(token)
      .then((api) => {
        if (!cancelled) setMapplsApi(api);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!mapplsApi || !containerRef.current || mapRef.current) return;

    const map = new mapplsApi.Map("home-map-container", {
      center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
      zoom: 11,
      interactive: true,
      zoomControl: false,
    });

    mapRef.current = map;

    // Add a pulsing marker to simulate an active delivery zone
    map.on("load", () => {
      const el = document.createElement("div");
      el.className = "flex items-center justify-center h-12 w-12";
      el.innerHTML = `
        <div class="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
        <div class="relative h-4 w-4 rounded-full bg-primary border-2 border-white shadow-lg"></div>
      `;
      
      new mapplsApi.Marker({
        element: el,
        position: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
      }).addTo(map);
    });

  }, [mapplsApi]);

  return (
    <div className={cn("relative w-full h-full overflow-hidden bg-secondary-bg", className)}>
      <div id="home-map-container" ref={containerRef} className="absolute inset-0" />
      
      {!token && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary-bg p-6 text-center z-10">
           <p className="text-sm font-bold text-heading">Mappls Token Missing</p>
           <p className="text-xs text-secondary mt-1">Set NEXT_PUBLIC_MAPPLS_TOKEN to view map</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary-bg p-6 text-center z-10">
           <p className="text-sm font-bold text-heading">Failed to load map</p>
           <p className="text-xs text-secondary mt-1">Your Mappls Token might be invalid or dummy. Replace it in .env.local!</p>
        </div>
      )}

      {token && !mapplsApi && !loadError && (
        <div className="absolute inset-0 animate-pulse bg-secondary-bg z-0" />
      )}

      {/* Decorative overlay to blend with the UI */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[inherit]" />
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-xl bg-card/90 backdrop-blur-md p-3 shadow-sm border border-default/50 flex items-center justify-between">
         <div>
            <p className="text-xs font-bold text-heading">Active Delivery Zone</p>
            <p className="text-[10px] text-secondary">Serving New Delhi & NCR</p>
         </div>
         <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(31,122,99,0.8)]" />
      </div>
    </div>
  );
}
