"use client";

import { useState, useEffect } from "react";
import { Species, CardContent, SelectedLocation } from "@/types";

interface GeneratingViewProps {
  species: Species[];
  location: SelectedLocation;
  existingCards?: CardContent[];
  onComplete: (cards: CardContent[]) => void;
  onBack: () => void;
}

async function fetchWikipediaSummary(taxonId: number): Promise<string> {
  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
    const data = await res.json();
    return data.results?.[0]?.wikipedia_summary || "";
  } catch {
    return "";
  }
}

export default function GeneratingView({
  species,
  location,
  existingCards = [],
  onComplete,
  onBack,
}: GeneratingViewProps) {
  // Build a cache map from existing cards keyed by taxon_id
  const existingCardMap = new Map(existingCards.map((c) => [c.species.taxon_id, c]));

  // Species that already have a cached card
  const cachedCards = species
    .filter((s) => existingCardMap.has(s.taxon_id))
    .map((s) => existingCardMap.get(s.taxon_id)!);

  // Species that need new generation
  const toGenerate = species.filter((s) => !existingCardMap.has(s.taxon_id));

  const [newCards, setNewCards] = useState<CardContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");

  const currentMonth = new Date().getMonth() + 1;

  // All cards shown in preview: cached first, then newly generated
  const allCards = [...cachedCards, ...newCards];

  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      // If nothing new to generate, complete immediately with cached cards
      if (toGenerate.length === 0) {
        onComplete(cachedCards);
        return;
      }

      const results: CardContent[] = [];

      for (let i = 0; i < toGenerate.length; i++) {
        if (cancelled) return;
        setCurrentIndex(i);

        const s = toGenerate[i];
        try {
          // Fetch wikipedia summary
          const wikiSummary = await fetchWikipediaSummary(s.taxon_id);

          // Strip HTML tags from wikipedia summary
          const cleanSummary = wikiSummary.replace(/<[^>]*>/g, "").slice(0, 500);

          // Retry up to 2 times
          let res: Response | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                common_name: s.common_name,
                scientific_name: s.scientific_name,
                iconic_taxon_name: s.iconic_taxon_name,
                wikipedia_summary: cleanSummary,
                place_name: location.name,
                current_month: currentMonth,
              }),
            });
            if (res.ok) break;
            // Wait before retry
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }

          if (!res || !res.ok) throw new Error("Generation failed after retries");

          const data = await res.json();
          const card: CardContent = {
            species: s,
            description: data.description,
            place_name: location.name,
            month: currentMonth,
            lat: location.lat,
            lng: location.lng,
          };
          results.push(card);
          setNewCards([...results]);
        } catch (err) {
          console.error(`Failed to generate card for ${s.common_name}:`, err);
          // Skip this card, continue with others
        }
      }

      if (!cancelled) {
        const finalCards = [...cachedCards, ...results];
        if (finalCards.length > 0) {
          onComplete(finalCards);
        }
      }
    };

    generate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = toGenerate.length === 0
    ? 100
    : Math.round(((currentIndex + 1) / toGenerate.length) * 100);

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="text-center w-full max-w-sm flex flex-col min-h-0">
        <div className="shrink-0">
          <div className="text-4xl sm:text-5xl mb-4 sm:mb-6 animate-pulse">✨</div>
          <h2 className="text-lg sm:text-xl font-bold text-[#5a4a3a] dark:text-gray-100 mb-2">正在生成知识卡片</h2>
          {toGenerate.length > 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
              {currentIndex + 1} / {toGenerate.length} ·{" "}
              {toGenerate[currentIndex]?.common_name || ""}
              {cachedCards.length > 0 && (
                <span className="ml-1 text-green-500">({cachedCards.length} 张已缓存)</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
              全部 {cachedCards.length} 张卡片已从缓存加载
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
            <div
              className="bg-[#00b894] h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Generated cards preview — scrollable */}
        {allCards.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-2">
            {allCards.map((card) => (
              <div
                key={card.species.taxon_id}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-2 text-left"
              >
                <img
                  src={card.species.photo_url}
                  alt={card.species.common_name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <span className="text-sm text-[#2d3436] dark:text-gray-100 font-medium truncate">
                  {card.species.common_name}
                </span>
                <span className="ml-auto text-green-500 text-sm shrink-0">✓</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 shrink-0">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button onClick={onBack} className="text-[#00b894] text-sm font-medium min-h-[2.75rem]">
              ← 返回重新选择
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
