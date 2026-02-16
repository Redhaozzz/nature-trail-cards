"use client";

import { useState, useCallback, useRef } from "react";
import Map, { Marker, MapRef } from "react-map-gl/mapbox";
import { SelectedLocation } from "@/types";

interface MapSelectorProps {
  onLocationSelect: (location: SelectedLocation) => void;
}

const DEFAULT_CENTER = { lat: 49.274, lng: -122.8, zoom: 12 };

export default function MapSelector({ onLocationSelect }: MapSelectorProps) {
  const mapRef = useRef<MapRef>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=zh,en&types=poi,place,locality,neighborhood`
      );
      const data = await res.json();
      const name = data.features?.[0]?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      return name;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }, []);

  const handleMapClick = useCallback(
    async (e: { lngLat: { lng: number; lat: number } }) => {
      const { lng, lat } = e.lngLat;
      setMarker({ lat, lng });
      const name = await reverseGeocode(lat, lng);
      setLocationName(name);
    },
    [reverseGeocode]
  );

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${token}&limit=1&language=zh,en`
      );
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature) {
        const [lng, lat] = feature.center;
        setMarker({ lat, lng });
        setLocationName(feature.place_name);
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 13, duration: 1500 });
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleConfirm = () => {
    if (marker && locationName) {
      onLocationSelect({
        lat: marker.lat,
        lng: marker.lng,
        name: locationName,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Search bar */}
      <div className="p-4 bg-white/80 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold text-[#5a4a3a] mb-3 text-center">
          🌿 自然探索卡片
        </h1>
        <div className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索步道或公园名称..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-5 py-2.5 bg-[#00b894] text-white rounded-xl text-sm font-medium hover:bg-[#00a884] disabled:opacity-50 transition-colors"
          >
            {searching ? "..." : "搜索"}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          initialViewState={{
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
            zoom: DEFAULT_CENTER.zoom,
          }}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/outdoors-v12"
          onClick={handleMapClick}
          style={{ width: "100%", height: "100%" }}
        >
          {marker && (
            <Marker latitude={marker.lat} longitude={marker.lng} anchor="bottom">
              <div className="text-3xl">📍</div>
            </Marker>
          )}
        </Map>
      </div>

      {/* Bottom bar */}
      {marker && locationName && (
        <div className="p-4 bg-white border-t border-gray-100 safe-area-bottom">
          <p className="text-sm text-gray-600 mb-3 text-center truncate px-4">
            📍 {locationName}
          </p>
          <button
            onClick={handleConfirm}
            className="w-full py-3 bg-[#00b894] text-white rounded-xl font-medium text-base hover:bg-[#00a884] transition-colors"
          >
            选择此地点，浏览物种 →
          </button>
        </div>
      )}
    </div>
  );
}
