"use client";

import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { CardContent } from "@/types";
import NatureCard from "./NatureCard";
import ObservationMap from "./ObservationMap";

interface CardPreviewProps {
  cards: CardContent[];
  placeName: string;
  onBack: () => void;
}

export default function CardPreview({ cards, placeName, onBack }: CardPreviewProps) {
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const month = new Date().getMonth() + 1;

  const setCardRef = useCallback((taxonId: number, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(taxonId, el);
    } else {
      cardRefs.current.delete(taxonId);
    }
  }, []);

  const downloadCard = useCallback(async (card: CardContent) => {
    const el = cardRefs.current.get(card.species.taxon_id);
    if (!el) return;

    try {
      const dataUrl = await toPng(el, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
        fetchRequestInit: { mode: "cors" },
        skipFonts: true,
      });
      const link = document.createElement("a");
      link.download = `${card.species.common_name}-nature-card.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err instanceof Error ? err.message : JSON.stringify(err));
    }
  }, []);

  const downloadAll = useCallback(async () => {
    for (const card of cards) {
      await downloadCard(card);
      // Small delay between downloads
      await new Promise((r) => setTimeout(r, 300));
    }
  }, [cards, downloadCard]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Header — shrink-0 */}
      <div className="shrink-0 bg-white dark:bg-gray-800/90 backdrop-blur-sm z-10 border-b border-gray-100 dark:border-gray-700">
        <div className="p-3 sm:p-4 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-center sm:text-left">
              <h1 className="text-lg font-bold text-[#5a4a3a] dark:text-gray-100">
                🌿 自然探索卡片
              </h1>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {placeName.split(",")[0]} · {month}月 · {cards.length} 张卡片
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onBack}
                className="flex-1 sm:flex-none sm:px-4 py-2 min-h-[2.75rem] border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                ← 重新选择
              </button>
              <button
                onClick={downloadAll}
                className="flex-1 sm:flex-none sm:px-4 py-2 min-h-[2.75rem] bg-[#00b894] text-white rounded-xl text-sm font-medium hover:bg-[#00a884] transition-colors"
              >
                保存全部图片 📥
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cards — scrollable area with grid on desktop */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: "var(--safe-bottom)" }}>
        <div className="p-3 sm:p-4 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cards.map((card) => (
              <div key={card.species.taxon_id} className="flex flex-col">
                <NatureCard
                  ref={(el) => setCardRef(card.species.taxon_id, el)}
                  card={card}
                />
                {/* Observation map — shown on all devices, not included in export */}
                <div className="mt-3 w-full">
                  <ObservationMap
                    taxonId={card.species.taxon_id}
                    lat={card.lat}
                    lng={card.lng}
                  />
                </div>
                <button
                  onClick={() => downloadCard(card)}
                  className="mt-2 w-full py-2 min-h-[2.75rem] text-sm text-[#00b894] hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                >
                  保存此卡片为图片 📥
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
