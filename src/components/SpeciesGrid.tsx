"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type L from "leaflet";
import {
  Species,
  SelectedLocation,
  TaxonCategory,
  CATEGORY_LABELS,
  getCategoryEmoji,
  matchesCategory,
} from "@/types";

// 10-color palette for species markers
const MARKER_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#e84393", "#00b894", "#6c5ce7",
];

interface ObsPoint {
  lat: number;
  lng: number;
}

interface SpeciesGridProps {
  location: SelectedLocation;
  onSpeciesSelect: (species: Species[]) => void;
  onBack: () => void;
  initialSpecies?: Species[];
  initialSelectedIds?: number[];
  onSpeciesLoaded?: (species: Species[], selectedIds: number[]) => void;
}

export default function SpeciesGrid({
  location,
  onSpeciesSelect,
  onBack,
  initialSpecies,
  initialSelectedIds,
  onSpeciesLoaded,
}: SpeciesGridProps) {
  const [species, setSpecies] = useState<Species[]>(initialSpecies || []);
  const [loading, setLoading] = useState(!initialSpecies);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(initialSelectedIds || [])
  );
  const [category, setCategory] = useState<TaxonCategory>("all");
  const [mapExpanded, setMapExpanded] = useState(true);

  // Observation map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const markersRef = useRef<Map<number, L.CircleMarker[]>>(new Map());
  const obsCache = useRef<Map<number, ObsPoint[]>>(new Map());
  const fetchingRef = useRef<Set<number>>(new Set());
  // Track color assignment order
  const colorAssignment = useRef<Map<number, number>>(new Map());
  const nextColorIdx = useRef(0);

  const currentMonth = new Date().getMonth() + 1;

  // Get assigned color for a taxon id
  const getColor = useCallback((taxonId: number) => {
    if (!colorAssignment.current.has(taxonId)) {
      colorAssignment.current.set(taxonId, nextColorIdx.current % MARKER_COLORS.length);
      nextColorIdx.current++;
    }
    return MARKER_COLORS[colorAssignment.current.get(taxonId)!];
  }, []);

  // Initialize Leaflet map
  // Ref callback to initialize map when container mounts
  const initMap = useCallback(
    (node: HTMLDivElement | null) => {
      // Cleanup previous
      if (mapRef.current && !node) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
        return;
      }
      if (!node || mapRef.current) return;
      mapContainerRef.current = node;

      (async () => {
        const leaflet = await import("leaflet");
        if (!node.isConnected) return; // DOM removed during async
        const Leaf = leaflet.default || leaflet;
        leafletRef.current = Leaf;

        const map = Leaf.map(node, {
          zoomControl: false,
          attributionControl: false,
        }).setView([location.lat, location.lng], 14);

        Leaf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
        }).addTo(map);

        // Center marker
        Leaf.circleMarker([location.lat, location.lng], {
          radius: 6,
          color: "#5a4a3a",
          fillColor: "#5a4a3a",
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);

        // Radius circle
        Leaf.circle([location.lat, location.lng], {
          radius: location.radius * 1000,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "4 4",
        }).addTo(map);

        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 50);

        // Re-add markers for already selected species
        selectedIds.forEach((id) => {
          const cached = obsCache.current.get(id);
          if (cached) {
            addMarkersToMap(id, cached, Leaf, map);
          }
        });
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.lat, location.lng, location.radius]
  );

  // Add circle markers for a species to the map
  const addMarkersToMap = useCallback((taxonId: number, points: ObsPoint[], Leaf: typeof L, map: L.Map) => {
    const color = getColor(taxonId);
    const circles: L.CircleMarker[] = [];
    points.forEach((p) => {
      const cm = Leaf.circleMarker([p.lat, p.lng], {
        radius: 5,
        color,
        fillColor: color,
        fillOpacity: 0.7,
        weight: 1,
      }).addTo(map);
      circles.push(cm);
    });
    markersRef.current.set(taxonId, circles);
  }, [getColor]);

  // Remove markers for a species from the map
  const removeMarkersFromMap = useCallback((taxonId: number) => {
    const circles = markersRef.current.get(taxonId);
    if (circles) {
      circles.forEach((c) => c.remove());
      markersRef.current.delete(taxonId);
    }
  }, []);

  // Fetch observations for a species and add markers
  // Only works for iNat/both species (GBIF-only taxon_ids won't match iNat)
  const fetchObservations = useCallback(async (taxonId: number, source?: string) => {
    // Skip GBIF-only species — their taxon_id is a GBIF speciesKey, not an iNat taxon_id
    if (source === "gbif") return;

    // Skip if already cached or in-flight
    if (obsCache.current.has(taxonId) || fetchingRef.current.has(taxonId)) {
      if (obsCache.current.has(taxonId) && mapRef.current && leafletRef.current) {
        removeMarkersFromMap(taxonId);
        addMarkersToMap(taxonId, obsCache.current.get(taxonId)!, leafletRef.current, mapRef.current);
      }
      return;
    }

    fetchingRef.current.add(taxonId);
    try {
      const res = await fetch(
        `https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&lat=${location.lat}&lng=${location.lng}&radius=${location.radius}&per_page=30&only_id=false&fields=location`
      );
      const data = await res.json();
      const points: ObsPoint[] = (data.results || [])
        .filter((r: { location?: string }) => r.location)
        .map((r: { location: string }) => {
          const [olat, olng] = r.location.split(",").map(Number);
          return { lat: olat, lng: olng };
        });
      obsCache.current.set(taxonId, points);

      if (mapRef.current && leafletRef.current) {
        addMarkersToMap(taxonId, points, leafletRef.current, mapRef.current);
      }
    } catch (err) {
      console.error(`Failed to fetch observations for taxon ${taxonId}:`, err);
    } finally {
      fetchingRef.current.delete(taxonId);
    }
  }, [location.lat, location.lng, location.radius, addMarkersToMap, removeMarkersFromMap]);

  useEffect(() => {
    if (initialSpecies) return;

    const fetchSpecies = async () => {
      setLoading(true);
      setError("");
      try {
        const url = `/api/species?lat=${location.lat}&lng=${location.lng}&radius=${location.radius}&month=${currentMonth}`;
        const res = await fetch(url);
        const data = await res.json();
        const results = data.results || [];
        setSpecies(results);
        onSpeciesLoaded?.(results, []);
      } catch (err) {
        console.error("Failed to fetch species:", err);
        setError("无法加载物种数据，请检查网络连接后重试");
      } finally {
        setLoading(false);
      }
    };

    fetchSpecies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.lat, location.lng, location.radius, currentMonth]);

  const toggleSelect = useCallback((id: number, source?: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        removeMarkersFromMap(id);
      } else {
        next.add(id);
        fetchObservations(id, source);
      }
      return next;
    });
  }, [fetchObservations, removeMarkersFromMap]);

  const filteredSpecies = species.filter((s) => matchesCategory(s.iconic_taxon_name, category));

  const handleGenerate = () => {
    const selected = species.filter((s) => selectedIds.has(s.taxon_id));
    onSpeciesLoaded?.(species, Array.from(selectedIds));
    onSpeciesSelect(selected);
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="text-center px-6">
          <div className="text-4xl mb-4 animate-bounce">🔍</div>
          <p className="text-[#5a4a3a] dark:text-gray-100 font-medium">正在搜索附近物种（iNat + GBIF）...</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{location.name}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[100dvh] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={onBack} className="text-[#00b894] font-medium min-h-[2.75rem]">
            ← 返回选择地点
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden lg:flex-row">
      {/* Desktop sidebar with map — hidden on mobile */}
      <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 lg:shrink-0 lg:border-r border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <button onClick={onBack} className="text-[#00b894] text-sm font-medium min-h-[2.75rem] flex items-center mb-3">
            ← 返回选择地点
          </button>
          <h2 className="text-lg font-bold text-[#5a4a3a] dark:text-gray-100 truncate">
            📍 {location.name.split(",")[0]}
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{currentMonth}月 · 发现 {species.length} 种物种</p>
        </div>
        <div className="flex-1 min-h-0 p-4">
          <p className="text-xs font-medium text-[#5a4a3a] dark:text-gray-100 mb-2">🗺️ 观察分布</p>
          <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
            <div ref={initMap} style={{ height: "280px" }} />
            {selectedIds.size > 0 && (
              <div className="bg-white dark:bg-gray-800 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 max-h-32 overflow-y-auto">
                {Array.from(selectedIds).map((id) => {
                  const sp = species.find((s) => s.taxon_id === id);
                  if (!sp) return null;
                  const color = getColor(id);
                  return (
                    <div key={id} className="flex items-center gap-1.5 text-[10px] text-[#2d3436] dark:text-gray-100">
                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate max-w-[6rem]">{sp.common_name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header — sticky, shrink-0 */}
        <div className="shrink-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-10 border-b border-gray-100 dark:border-gray-700">
          <div className="p-3 sm:p-4 max-w-5xl mx-auto">
            {/* Mobile header */}
            <div className="flex items-center gap-3 mb-2 lg:hidden">
              <button onClick={onBack} className="text-[#00b894] text-sm font-medium min-h-[2.75rem] min-w-[2.75rem] flex items-center">
                ← 返回
              </button>
              <div className="flex-1 text-center min-w-0">
                <h2 className="text-base font-bold text-[#5a4a3a] dark:text-gray-100 truncate">
                  📍 {location.name.split(",")[0]}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">{currentMonth}月 · 发现 {species.length} 种物种</p>
              </div>
              <div className="w-10 shrink-0" />
            </div>

            {/* Category filter — horizontal scroll on mobile, flex-wrap on desktop */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto lg:overflow-visible lg:flex-wrap pb-1 scrollbar-hide -mx-3 px-3 sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0">
              {(Object.keys(CATEGORY_LABELS) as TaxonCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[2rem] ${
                    category === cat
                      ? "bg-[#00b894] text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
        </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: selectedIds.size > 0 ? "calc(5rem + var(--safe-bottom))" : "0" }}>
        {/* Observation distribution map — mobile only */}
        <div className="lg:hidden max-w-lg mx-auto px-3 sm:px-4 pt-3">
          <button
            onClick={() => setMapExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5a4a3a] dark:text-gray-100 mb-2 min-h-[2rem]"
          >
            <span className={`transition-transform ${mapExpanded ? "rotate-90" : ""}`}>▶</span>
            🗺️ 观察分布
          </button>
          {mapExpanded && (
            <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm mb-1">
              <div ref={initMap} style={{ height: "clamp(150px, 25dvh, 200px)" }} />
              {/* Legend */}
              {selectedIds.size > 0 && (
                <div className="bg-white dark:bg-gray-800 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1">
                  {Array.from(selectedIds).map((id) => {
                    const sp = species.find((s) => s.taxon_id === id);
                    if (!sp) return null;
                    const color = getColor(id);
                    return (
                      <div key={id} className="flex items-center gap-1.5 text-[10px] text-[#2d3436] dark:text-gray-100">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate max-w-[6rem]">{sp.common_name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Species grid */}
        <div className="p-3 sm:p-4 max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {filteredSpecies.map((s) => {
              const isSelected = selectedIds.has(s.taxon_id);
              return (
                <button
                  key={s.taxon_id}
                  onClick={() => toggleSelect(s.taxon_id, s.source)}
                  className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden text-left transition-all duration-200 ${
                    isSelected
                      ? "ring-2 ring-[#00b894] shadow-md scale-[1.02]"
                      : "shadow-sm hover:shadow-lg hover:scale-[1.02]"
                  }`}
                >
                  <div className="relative">
                    {s.photo_url ? (
                      <img
                        src={s.photo_url}
                        alt={s.common_name}
                        className="w-full aspect-[4/3] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-3xl">
                        {getCategoryEmoji(s.iconic_taxon_name)}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-[#00b894] rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 text-lg">
                      {getCategoryEmoji(s.iconic_taxon_name)}
                    </span>
                    {/* Source badge */}
                    <div className="absolute bottom-1 left-1 flex gap-0.5">
                      {(s.source === "inaturalist" || s.source === "both") && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[#74ac00] flex items-center justify-center text-[7px] text-white font-bold leading-none">i</span>
                      )}
                      {(s.source === "gbif" || s.source === "both") && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[#f7a727] flex items-center justify-center text-[7px] text-white font-bold leading-none">G</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-bold text-[#2d3436] dark:text-gray-100 truncate">{s.common_name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 italic truncate">{s.scientific_name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{s.observations_count} 次观测</p>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredSpecies.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-2xl mb-2">🤷</p>
              <p>该类别暂无物种数据</p>
            </div>
          )}
        </div>
      </div>

        {/* Bottom floating bar — fixed with safe-area padding */}
        {selectedIds.size > 0 && (
          <div className="shrink-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-3 sm:p-4 z-20" style={{ paddingBottom: "calc(0.75rem + var(--safe-bottom))" }}>
            <div className="max-w-2xl mx-auto flex items-center gap-4">
              <button
                onClick={handleGenerate}
                className="flex-1 py-3 min-h-[2.75rem] bg-[#00b894] text-white rounded-xl font-medium text-base hover:bg-[#00a884] transition-colors"
              >
                已选 {selectedIds.size} 个物种，生成卡片 ✨
              </button>
              {selectedIds.size < 5 && (
                <p className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 shrink-0">建议选择 5-12 个</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
