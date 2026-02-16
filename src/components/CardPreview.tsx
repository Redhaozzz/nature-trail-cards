"use client";

import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { CardContent } from "@/types";
import NatureCard from "./NatureCard";

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
      });
      const link = document.createElement("a");
      link.download = `${card.species.common_name}-nature-card.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
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
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-gray-100">
        <div className="p-4 max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-[#5a4a3a] text-center mb-1">
            🌿 自然探索卡片
          </h1>
          <p className="text-xs text-gray-400 text-center">
            {placeName.split(",")[0]} · {month}月 · {cards.length} 张卡片
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onBack}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← 重新选择
            </button>
            <button
              onClick={downloadAll}
              className="flex-1 py-2 bg-[#00b894] text-white rounded-xl text-sm font-medium hover:bg-[#00a884] transition-colors"
            >
              保存全部图片 📥
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="p-4 max-w-lg mx-auto space-y-6">
        {cards.map((card) => (
          <div key={card.species.taxon_id}>
            <NatureCard
              ref={(el) => setCardRef(card.species.taxon_id, el)}
              card={card}
            />
            <button
              onClick={() => downloadCard(card)}
              className="mt-2 w-full max-w-[400px] mx-auto block py-2 text-sm text-[#00b894] hover:bg-green-50 rounded-xl transition-colors"
            >
              保存此卡片为图片 📥
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
