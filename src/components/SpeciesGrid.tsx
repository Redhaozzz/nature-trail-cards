"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Species,
  SelectedLocation,
  TaxonCategory,
  CATEGORY_LABELS,
  getCategoryEmoji,
  matchesCategory,
} from "@/types";

interface SpeciesGridProps {
  location: SelectedLocation;
  onSpeciesSelect: (species: Species[]) => void;
  onBack: () => void;
}

export default function SpeciesGrid({ location, onSpeciesSelect, onBack }: SpeciesGridProps) {
  const [species, setSpecies] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [category, setCategory] = useState<TaxonCategory>("all");

  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    const fetchSpecies = async () => {
      setLoading(true);
      setError("");
      try {
        const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${location.lat}&lng=${location.lng}&radius=5&quality_grade=research&month=${currentMonth}&per_page=50`;
        const res = await fetch(url);
        const data = await res.json();

        const speciesList: Species[] = data.results
          .filter((r: Record<string, unknown>) => {
            const taxon = r.taxon as Record<string, unknown> | undefined;
            return taxon && (taxon.default_photo as Record<string, unknown> | undefined);
          })
          .map((r: Record<string, unknown>) => {
            const taxon = r.taxon as Record<string, unknown>;
            const defaultPhoto = taxon.default_photo as Record<string, unknown>;
            return {
              taxon_id: taxon.id as number,
              name: (taxon.preferred_common_name as string) || (taxon.name as string),
              common_name: (taxon.preferred_common_name as string) || (taxon.name as string),
              scientific_name: taxon.name as string,
              photo_url: (defaultPhoto.medium_url as string) || (defaultPhoto.url as string) || "",
              iconic_taxon_name: (taxon.iconic_taxon_name as string) || "Unknown",
              observations_count: r.count as number,
            };
          });

        setSpecies(speciesList);
      } catch (err) {
        console.error("Failed to fetch species:", err);
        setError("无法加载物种数据，请检查网络连接后重试");
      } finally {
        setLoading(false);
      }
    };

    fetchSpecies();
  }, [location.lat, location.lng, currentMonth]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const filteredSpecies = species.filter((s) => matchesCategory(s.iconic_taxon_name, category));

  const handleGenerate = () => {
    const selected = species.filter((s) => selectedIds.has(s.taxon_id));
    onSpeciesSelect(selected);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🔍</div>
          <p className="text-[#5a4a3a] font-medium">正在搜索附近物种...</p>
          <p className="text-sm text-gray-400 mt-1">{location.name}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={onBack} className="text-[#00b894] font-medium">
            ← 返回选择地点
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-100">
        <div className="p-4 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="text-[#00b894] text-sm font-medium">
              ← 返回
            </button>
            <div className="flex-1 text-center">
              <h2 className="text-base font-bold text-[#5a4a3a]">
                📍 {location.name.split(",")[0]}
              </h2>
              <p className="text-xs text-gray-400">{currentMonth}月 · 发现 {species.length} 种物种</p>
            </div>
            <div className="w-10" />
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(Object.keys(CATEGORY_LABELS) as TaxonCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  category === cat
                    ? "bg-[#00b894] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Species grid */}
      <div className="p-4 max-w-lg mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {filteredSpecies.map((s) => {
            const isSelected = selectedIds.has(s.taxon_id);
            return (
              <button
                key={s.taxon_id}
                onClick={() => toggleSelect(s.taxon_id)}
                className={`bg-white rounded-xl overflow-hidden text-left transition-all ${
                  isSelected
                    ? "ring-2 ring-[#00b894] shadow-md"
                    : "shadow-sm hover:shadow-md"
                }`}
              >
                <div className="relative">
                  <img
                    src={s.photo_url}
                    alt={s.common_name}
                    className="w-full h-28 object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[#00b894] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 text-lg">
                    {getCategoryEmoji(s.iconic_taxon_name)}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-bold text-[#2d3436] truncate">{s.common_name}</p>
                  <p className="text-[10px] text-gray-400 italic truncate">{s.scientific_name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.observations_count} 次观测</p>
                </div>
              </button>
            );
          })}
        </div>

        {filteredSpecies.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-2xl mb-2">🤷</p>
            <p>该类别暂无物种数据</p>
          </div>
        )}
      </div>

      {/* Bottom floating bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom z-20">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-[#00b894] text-white rounded-xl font-medium text-base hover:bg-[#00a884] transition-colors"
            >
              已选 {selectedIds.size} 个物种，生成卡片 ✨
            </button>
            {selectedIds.size < 5 && (
              <p className="text-xs text-gray-400 text-center mt-2">建议选择 5-12 个物种</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
