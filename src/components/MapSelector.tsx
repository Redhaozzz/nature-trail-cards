"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SelectedLocation } from "@/types";
import type L from "leaflet";

interface MapSelectorProps {
  onLocationSelect: (location: SelectedLocation) => void;
}

const DEFAULT_CENTER: [number, number] = [49.274, -122.8];
const DEFAULT_ZOOM = 12;

export default function MapSelector({ onLocationSelect }: MapSelectorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Initialize map (dynamic import to avoid SSR window error)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return;
      const Leaf = leaflet.default || leaflet;

      const map = Leaf.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      Leaf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setMarker({ lat, lng });
        reverseGeocode(lat, lng);

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = Leaf.marker([lat, lng], {
            icon: Leaf.divIcon({
              html: '<div style="font-size:30px">📍</div>',
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: "",
            }),
          }).addTo(map);
        }
      });

      mapInstanceRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=zh,en`
      );
      const data = await res.json();
      const name = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setLocationName(name);
    } catch {
      setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1&accept-language=zh,en`
      );
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setMarker({ lat, lng });
        setLocationName(data[0].display_name);

        mapInstanceRef.current?.flyTo([lat, lng], 13);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else if (mapInstanceRef.current) {
          const Leaf = (await import("leaflet")).default;
          markerRef.current = Leaf.marker([lat, lng], {
            icon: Leaf.divIcon({
              html: '<div style="font-size:30px">📍</div>',
              iconSize: [30, 40],
              iconAnchor: [15, 40],
              className: "",
            }),
          }).addTo(mapInstanceRef.current);
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleConfirm = () => {
    if (marker && locationName) {
      onLocationSelect({ lat: marker.lat, lng: marker.lng, name: locationName });
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Header + Search */}
      <div className="shrink-0 p-3 pb-2 bg-white/80 backdrop-blur-sm z-10">
        <h1 className="text-lg font-bold text-[#5a4a3a] mb-2 text-center">
          🌿 自然探索卡片
        </h1>
        <div className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索步道或公园名称..."
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-[#00b894] text-white rounded-xl text-sm font-medium hover:bg-[#00a884] disabled:opacity-50 transition-colors"
          >
            {searching ? "..." : "搜索"}
          </button>
        </div>
      </div>

      {/* Map — constrained height, touch-action managed */}
      <div
        className="relative z-0 shrink-0"
        style={{ height: "clamp(200px, 50dvh, 400px)" }}
        ref={mapContainerRef}
      />

      {/* Bottom area — always visible */}
      <div className="flex-1 flex flex-col justify-center p-4 bg-white border-t border-gray-100">
        {marker && locationName ? (
          <>
            <p className="text-sm text-gray-600 mb-3 text-center line-clamp-2 px-2">
              📍 {locationName}
            </p>
            <button
              onClick={handleConfirm}
              className="w-full py-3 bg-[#00b894] text-white rounded-xl font-medium text-base hover:bg-[#00a884] transition-colors"
            >
              选择此地点，浏览物种 →
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center">
            👆 在地图上点选或搜索一个地点
          </p>
        )}
      </div>
    </div>
  );
}
