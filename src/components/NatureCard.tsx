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
      className="bg-white rounded-3xl overflow-hidden shadow-lg max-w-[400px] w-full mx-auto"
      style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
    >
      {/* Photo */}
      <img
        src={`/api/proxy-image?url=${encodeURIComponent(card.species.photo_url)}`}
        alt={card.species.common_name}
        className="w-full h-[280px] object-cover"
        crossOrigin="anonymous"
      />

      {/* Body */}
      <div className="px-7 pt-6 pb-7">
        {/* Title */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[28px]">{emoji}</span>
          <span className="text-[22px] font-black text-[#2d3436]">
            {card.species.common_name}
          </span>
        </div>
        <p className="text-[13px] text-[#b2bec3] italic mb-5">
          {card.species.common_name !== card.species.scientific_name &&
            `${card.species.common_name} · `}
          {card.species.scientific_name}
        </p>

        {/* Recognition */}
        <div className="mb-4">
          <span className="inline-block text-[13px] font-bold text-white bg-[#00b894] px-2.5 py-0.5 rounded-[10px] mb-1.5">
            🔍 怎么认出它
          </span>
          <p className="text-[15px] text-[#2d3436] leading-[1.7]">{card.recognition}</p>
        </div>

        {/* Fun fact */}
        <div className="mb-4">
          <span className="inline-block text-[13px] font-bold text-[#5a4a3a] bg-[#fdcb6e] px-2.5 py-0.5 rounded-[10px] mb-1.5">
            ✨ 有趣的秘密
          </span>
          <p className="text-[15px] text-[#2d3436] leading-[1.7]">{card.fun_fact}</p>
        </div>

        {/* Talk to kid */}
        <div>
          <span className="inline-block text-[13px] font-bold text-white bg-[#fd79a8] px-2.5 py-0.5 rounded-[10px] mb-1.5">
            💬 跟宝宝说
          </span>
          <p className="text-[15px] text-[#2d3436] leading-[1.7]">{card.talk_to_kid}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-7 py-3 bg-[#fafafa] border-t border-[#f0f0f0] text-[12px] text-[#b2bec3]">
        <span>📍 {card.place_name.split(",")[0]}</span>
        <span>{card.month}月观测 {card.species.observations_count} 次</span>
      </div>
    </div>
  );
});

NatureCard.displayName = "NatureCard";

export default NatureCard;
