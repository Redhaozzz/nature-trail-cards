"use client";

import { useState, useEffect, useRef } from "react";
import type L from "leaflet";

interface Observation {
  id: number;
  lat: number;
  lng: number;
}

interface ObservationMapProps {
  taxonId: number;
  lat: number;
  lng: number;
}

export default function ObservationMap({ taxonId, lat, lng }: ObservationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch observations from iNaturalist
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&lat=${lat}&lng=${lng}&radius=3&per_page=50&order_by=observed_on`
        );
        const data = await res.json();
        if (cancelled) return;
        const obs: Observation[] = (data.results || [])
          .filter((r: { location?: string }) => r.location)
          .map((r: { id: number; location: string }) => {
            const [olat, olng] = r.location.split(",").map(Number);
            return { id: r.id, lat: olat, lng: olng };
          });
        setObservations(obs);
      } catch (err) {
        console.error("Failed to fetch observations:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taxonId, lat, lng]);

  // Initialize map once observations are loaded
  useEffect(() => {
    if (loading || !containerRef.current || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const Leaf = leaflet.default || leaflet;

      const map = Leaf.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 12);

      Leaf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
      }).addTo(map);

      // Add observation markers
      observations.forEach((obs) => {
        Leaf.circleMarker([obs.lat, obs.lng], {
          radius: 5,
          color: "#00b894",
          fillColor: "#00b894",
          fillOpacity: 0.7,
          weight: 1,
        }).addTo(map);
      });

      // Fit bounds if observations exist
      if (observations.length > 0) {
        const bounds = Leaf.latLngBounds(
          observations.map((o) => [o.lat, o.lng] as [number, number])
        );
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading, observations, lat, lng]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center" style={{ height: "clamp(150px, 25dvh, 200px)" }}>
        <span className="text-sm text-gray-400 dark:text-gray-500">加载观察点位...</span>
      </div>
    );
  }

  if (observations.length === 0) {
    return (
      <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center" style={{ height: "clamp(80px, 15dvh, 120px)" }}>
        <span className="text-sm text-gray-400 dark:text-gray-500">附近暂无观察记录</span>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
        🗺️ 附近 {observations.length} 个观察记录
      </p>
      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden"
        style={{ height: "clamp(150px, 25dvh, 200px)" }}
      />
    </div>
  );
}
