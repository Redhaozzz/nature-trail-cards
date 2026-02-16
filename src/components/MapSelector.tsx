"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SelectedLocation } from "@/types";
import type L from "leaflet";

interface MapSelectorProps {
  onLocationSelect: (location: SelectedLocation) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface SearchHistoryItem {
  name: string;
  lat: number;
  lng: number;
}

const SEARCH_HISTORY_KEY = "search_history";
const MAX_HISTORY = 10;

function getSearchHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addSearchHistory(item: SearchHistoryItem) {
  const history = getSearchHistory().filter(
    (h) => !(h.lat === item.lat && h.lng === item.lng)
  );
  history.unshift(item);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

const DEFAULT_CENTER: [number, number] = [49.274, -122.8];
const DEFAULT_ZOOM = 12;

export default function MapSelector({ onLocationSelect }: MapSelectorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [radius, setRadius] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update radius circle on the map
  const updateCircle = useCallback(async (lat: number, lng: number, r: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const Leaf = (await import("leaflet")).default;
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(r * 1000);
    } else {
      circleRef.current = Leaf.circle([lat, lng], {
        radius: r * 1000,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);
    }
  }, []);

  // Initialize map (dynamic import to avoid SSR window error)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
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

        // Draw radius circle
        setRadius((r) => {
          updateCircle(lat, lng, r);
          return r;
        });
      });

      mapInstanceRef.current = map;
    })();

    return () => {
      cancelled = true;
      circleRef.current = null;
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

  const searchNominatim = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5&accept-language=zh,en`
      );
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSuggestions([]);
      const history = getSearchHistory();
      setSearchHistory(history);
      setShowSuggestions(history.length > 0);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchNominatim(value);
    }, 300);
  };

  const flyToLocation = useCallback(async (lat: number, lng: number) => {
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
    setRadius((r) => {
      updateCircle(lat, lng, r);
      return r;
    });
  }, [updateCircle]);

  const handleSelectSuggestion = useCallback(async (item: NominatimResult) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setSearchQuery(item.display_name.split(",")[0]);
    setSuggestions([]);
    setShowSuggestions(false);
    setMarker({ lat, lng });
    setLocationName(item.display_name);

    addSearchHistory({ name: item.display_name, lat, lng });

    await flyToLocation(lat, lng);
  }, [flyToLocation]);

  const handleSelectHistory = useCallback(async (item: SearchHistoryItem) => {
    setSearchQuery(item.name.split(",")[0]);
    setShowSuggestions(false);
    setMarker({ lat: item.lat, lng: item.lng });
    setLocationName(item.name);

    await flyToLocation(item.lat, item.lng);
  }, [flyToLocation]);

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (marker) {
      updateCircle(marker.lat, marker.lng, newRadius);
    }
  };

  const handleConfirm = () => {
    if (marker && locationName) {
      onLocationSelect({ lat: marker.lat, lng: marker.lng, name: locationName, radius });
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Header + Search */}
      <div className="shrink-0 p-3 pb-2 bg-white/80 dark:bg-gray-900/90 backdrop-blur-sm z-20">
        <h1 className="text-lg font-bold text-[#5a4a3a] dark:text-gray-100 mb-2 text-center">
          🌿 自然探索卡片
        </h1>
        <div className="relative max-w-lg mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              } else if (!searchQuery.trim()) {
                const history = getSearchHistory();
                setSearchHistory(history);
                if (history.length > 0) setShowSuggestions(true);
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="搜索步道或公园名称..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 text-sm"
          />
          {showSuggestions && (suggestions.length > 0 || (!searchQuery.trim() && searchHistory.length > 0)) && (
            <ul className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 overflow-hidden z-50 max-h-[240px] overflow-y-auto">
              {suggestions.length > 0
                ? suggestions.map((item) => (
                    <li
                      key={item.place_id}
                      onMouseDown={() => handleSelectSuggestion(item)}
                      className="px-3 py-2.5 text-sm text-[#2d3436] dark:text-gray-200 hover:bg-green-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-b-0"
                    >
                      <span className="text-gray-400 mr-1.5">📍</span>
                      {item.display_name}
                    </li>
                  ))
                : searchHistory.map((item, idx) => (
                    <li
                      key={`history-${idx}`}
                      onMouseDown={() => handleSelectHistory(item)}
                      className="px-3 py-2.5 text-sm text-[#2d3436] dark:text-gray-200 hover:bg-green-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-b-0"
                    >
                      <span className="text-gray-400 mr-1.5">🕐</span>
                      {item.name.split(",")[0]}
                    </li>
                  ))}
            </ul>
          )}
        </div>
      </div>

      {/* Map — constrained height, touch-action managed */}
      <div
        className="relative z-0 shrink-0"
        style={{ height: "clamp(200px, 50dvh, 400px)" }}
        ref={mapContainerRef}
      />

      {/* Bottom area — always visible */}
      <div className="flex-1 flex flex-col justify-center p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        {marker && locationName ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 text-center line-clamp-2 px-2">
              📍 {locationName}
            </p>
            {/* Radius buttons */}
            <div className="mb-3 px-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">搜索半径</p>
              <div className="flex gap-2">
                {[
                  { label: "100m", value: 0.1 },
                  { label: "300m", value: 0.3 },
                  { label: "500m", value: 0.5 },
                  { label: "1km", value: 1 },
                  { label: "2km", value: 2 },
                  { label: "3km", value: 3 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleRadiusChange(opt.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      radius === opt.value
                        ? "bg-[#00b894] text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleConfirm}
              className="w-full py-3 bg-[#00b894] text-white rounded-xl font-medium text-base hover:bg-[#00a884] transition-colors"
            >
              选择此范围（{radius >= 1 ? `${radius}km` : `${radius * 1000}m`}），浏览物种 →
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
            👆 在地图上点选或搜索一个地点
          </p>
        )}
      </div>
    </div>
  );
}
