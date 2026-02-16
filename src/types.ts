export type AppStep = "select-location" | "select-species" | "generating" | "preview";

export type TaxonCategory = "all" | "Aves" | "Mammalia" | "Plantae" | "Insecta" | "other";

export interface SelectedLocation {
  lat: number;
  lng: number;
  name: string;
  radius: number; // km
}

export interface Species {
  taxon_id: number;
  name: string;
  common_name: string;
  scientific_name: string;
  photo_url: string;
  iconic_taxon_name: string;
  observations_count: number;
}

export interface CardContent {
  species: Species;
  description: string;
  place_name: string;
  month: number;
  lat: number;
  lng: number;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  Aves: "🐦",
  Mammalia: "🐿️",
  Plantae: "🌿",
  Insecta: "🐛",
  Reptilia: "🦎",
  Amphibia: "🐸",
  Fungi: "🍄",
  Arachnida: "🕷️",
  Mollusca: "🐌",
  Actinopterygii: "🐟",
};

export const CATEGORY_LABELS: Record<TaxonCategory, string> = {
  all: "全部",
  Aves: "鸟类",
  Mammalia: "哺乳",
  Plantae: "植物",
  Insecta: "昆虫",
  other: "其他",
};

export function getCategoryEmoji(iconicTaxonName: string): string {
  return CATEGORY_EMOJI[iconicTaxonName] || "🔬";
}

export function matchesCategory(iconicTaxonName: string, category: TaxonCategory): boolean {
  if (category === "all") return true;
  if (category === "other") {
    return !["Aves", "Mammalia", "Plantae", "Insecta"].includes(iconicTaxonName);
  }
  return iconicTaxonName === category;
}
