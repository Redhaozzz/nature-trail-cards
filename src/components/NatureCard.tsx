"use client";

import { forwardRef } from "react";
import { CardContent, getCategoryEmoji } from "@/types";

interface NatureCardProps {
  card: CardContent;
}

const NatureCard = forwardRef<HTMLDivElement, NatureCardProps>(({ card }, ref) => {
  const emoji = getCategoryEmoji(card.species.iconic_taxon_name);

  return (
    <div
      ref={ref}
      className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg max-w-[400px] w-full mx-auto"
      style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
    >
      {/* Photo — aspect-ratio 16:9 */}
      {card.species.photo_url ? (
        <img
          src={`/api/proxy-image?url=${encodeURIComponent(card.species.photo_url)}`}
          alt={card.species.common_name}
          className="w-full aspect-video object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="w-full aspect-video bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-6xl">
          {emoji}
        </div>
      )}

      {/* Body */}
      <div className="px-5 sm:px-7 pt-4 sm:pt-6 pb-5 sm:pb-7">
        {/* Title */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[1.5rem] sm:text-[1.75rem]">{emoji}</span>
          <span className="text-[1.25rem] sm:text-[1.375rem] font-black text-[#2d3436] dark:text-gray-100 min-w-0 truncate">
            {card.species.common_name}
          </span>
        </div>
        <p className="text-[0.8125rem] text-[#b2bec3] dark:text-gray-400 italic mb-3 sm:mb-5">
          {card.species.common_name !== card.species.scientific_name &&
            `${card.species.common_name} · `}
          {card.species.scientific_name}
        </p>

        {/* Description */}
        <p className="text-[0.9375rem] text-[#2d3436] dark:text-gray-100 leading-[1.8]">{card.description}</p>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-5 sm:px-7 py-3 bg-[#fafafa] dark:bg-gray-700/50 border-t border-[#f0f0f0] dark:border-gray-700 text-[0.75rem] text-[#b2bec3] dark:text-gray-400">
        <span className="truncate mr-2">📍 {card.place_name.split(",")[0]}</span>
        <span className="shrink-0">{card.month}月观测 {card.species.observations_count} 次</span>
      </div>
    </div>
  );
});

NatureCard.displayName = "NatureCard";

export default NatureCard;
