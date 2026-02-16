import { NextRequest, NextResponse } from "next/server";
import type { Species, SpeciesSource } from "@/types";

const FETCH_TIMEOUT = 10000; // 10s timeout for external API calls

function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeout) });
}

// Map GBIF kingdom/class to iNat iconic_taxon_name
function mapGbifTaxonomy(species: {
  kingdom?: string;
  phylum?: string;
  class?: string;
}): string {
  if (species.kingdom === "Plantae") return "Plantae";
  if (species.kingdom === "Fungi") return "Fungi";
  if (species.kingdom === "Animalia") {
    switch (species.class) {
      case "Aves": return "Aves";
      case "Mammalia": return "Mammalia";
      case "Reptilia": return "Reptilia";
      case "Amphibia": return "Amphibia";
      case "Insecta": return "Insecta";
      case "Arachnida": return "Arachnida";
      case "Actinopterygii": return "Actinopterygii";
      default:
        if (species.phylum === "Mollusca") return "Mollusca";
        return "Animalia";
    }
  }
  return "Unknown";
}

// Fetch species from iNaturalist
async function fetchInatSpecies(
  lat: number,
  lng: number,
  radius: number,
  month: number
): Promise<Species[]> {
  const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=${radius}&quality_grade=research&month=${month}&per_page=50`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();

  return (data.results || [])
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
        source: "inaturalist" as SpeciesSource,
      };
    });
}

// Compute GBIF bounding box from center + radius(km)
function gbifBbox(lat: number, lng: number, radius: number) {
  const latR = radius / 111;
  const lngR = radius / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - latR, maxLat: lat + latR, minLng: lng - lngR, maxLng: lng + lngR };
}

// Fetch GBIF species keys via faceted occurrence search
async function fetchGbifSpeciesKeys(
  lat: number,
  lng: number,
  radius: number,
  month: number
): Promise<{ speciesKey: number; count: number }[]> {
  const { minLat, maxLat, minLng, maxLng } = gbifBbox(lat, lng, radius);

  const url =
    `https://api.gbif.org/v1/occurrence/search?` +
    `decimalLatitude=${minLat},${maxLat}&` +
    `decimalLongitude=${minLng},${maxLng}&` +
    `limit=0&facet=speciesKey&facetLimit=100&` +
    `hasCoordinate=true&hasGeospatialIssue=false&month=${month}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();

  const facets = data.facets || [];
  const speciesFacet = facets.find(
    (f: { field: string }) => f.field === "SPECIES_KEY"
  );
  if (!speciesFacet) return [];

  return (speciesFacet.counts || []).map(
    (c: { name: string; count: number }) => ({
      speciesKey: parseInt(c.name, 10),
      count: c.count,
    })
  );
}

// Fetch species detail from GBIF (batched with concurrency limit)
async function fetchGbifSpeciesDetails(
  keys: { speciesKey: number; count: number }[]
): Promise<Species[]> {
  const results: Species[] = [];
  const concurrency = 5;

  for (let i = 0; i < keys.length; i += concurrency) {
    const batch = keys.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async ({ speciesKey, count }) => {
        try {
          const res = await fetchWithTimeout(
            `https://api.gbif.org/v1/species/${speciesKey}`
          );
          if (!res.ok) return null;
          const sp = await res.json();

          if (!sp.scientificName && !sp.canonicalName) return null;

          const scientificName = sp.canonicalName || sp.scientificName;
          const vernacularName = sp.vernacularName || "";

          return {
            taxon_id: speciesKey,
            name: vernacularName || scientificName,
            common_name: vernacularName || scientificName,
            scientific_name: scientificName,
            photo_url: "",
            iconic_taxon_name: mapGbifTaxonomy(sp),
            observations_count: count,
            source: "gbif" as SpeciesSource,
          };
        } catch {
          return null;
        }
      })
    );
    results.push(
      ...(batchResults.filter(Boolean) as Species[])
    );
  }
  return results;
}

// Try to get photo from GBIF occurrence media
async function fetchGbifPhoto(
  speciesKey: number,
  lat: number,
  lng: number,
  radius: number
): Promise<string> {
  try {
    const { minLat, maxLat, minLng, maxLng } = gbifBbox(lat, lng, radius);
    const url =
      `https://api.gbif.org/v1/occurrence/search?` +
      `speciesKey=${speciesKey}&` +
      `decimalLatitude=${minLat},${maxLat}&` +
      `decimalLongitude=${minLng},${maxLng}&` +
      `mediaType=StillImage&limit=1`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return "";
    const data = await res.json();
    const results = data.results || [];
    if (results.length > 0 && results[0].media?.length > 0) {
      return results[0].media[0].identifier || "";
    }
  } catch {
    // ignore
  }
  return "";
}

// Fallback: try iNat taxa autocomplete for photo + common name
async function fetchInatFallback(
  scientificName: string
): Promise<{ photo_url: string; common_name: string }> {
  try {
    const url = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(scientificName)}&per_page=1`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { photo_url: "", common_name: "" };
    const data = await res.json();
    const results = data.results || [];
    if (results.length > 0) {
      const t = results[0];
      return {
        photo_url: t.default_photo?.medium_url || t.default_photo?.url || "",
        common_name: t.preferred_common_name || "",
      };
    }
  } catch {
    // ignore
  }
  return { photo_url: "", common_name: "" };
}

// Merge iNat and GBIF species lists by scientific_name
function mergeSpecies(
  inatList: Species[],
  gbifList: Species[]
): Species[] {
  const merged = new Map<string, Species>();

  // iNat first (priority)
  for (const sp of inatList) {
    merged.set(sp.scientific_name.toLowerCase(), sp);
  }

  // GBIF supplements
  for (const sp of gbifList) {
    const key = sp.scientific_name.toLowerCase();
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      existing.observations_count += sp.observations_count;
      existing.source = "both";
    } else {
      merged.set(key, sp);
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.observations_count - a.observations_count
  );
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = parseFloat(params.get("lat") || "");
  const lng = parseFloat(params.get("lng") || "");
  const radius = parseFloat(params.get("radius") || "5");
  const month = parseInt(params.get("month") || String(new Date().getMonth() + 1), 10);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch from both sources concurrently
    const [inatSpecies, gbifKeys] = await Promise.all([
      fetchInatSpecies(lat, lng, radius, month),
      fetchGbifSpeciesKeys(lat, lng, radius, month),
    ]);

    const gbifSpecies = await fetchGbifSpeciesDetails(gbifKeys);

    // For GBIF-only species, try to find photos and better common names
    const inatNames = new Set(
      inatSpecies.map((s) => s.scientific_name.toLowerCase())
    );
    const gbifOnly = gbifSpecies.filter(
      (sp) => !inatNames.has(sp.scientific_name.toLowerCase())
    );

    // Batch photo+name fetches with proper concurrency control
    const concurrency = 5;
    for (let i = 0; i < gbifOnly.length; i += concurrency) {
      const batch = gbifOnly.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (sp) => {
          // Try GBIF occurrence media first
          let photo = await fetchGbifPhoto(sp.taxon_id, lat, lng, radius);
          if (!photo) {
            // Fallback to iNat taxa autocomplete for photo + common name
            const fallback = await fetchInatFallback(sp.scientific_name);
            photo = fallback.photo_url;
            if (fallback.common_name) {
              sp.common_name = fallback.common_name;
              sp.name = fallback.common_name;
            }
          }
          sp.photo_url = photo;
        })
      );
    }

    const merged = mergeSpecies(inatSpecies, gbifSpecies);

    return NextResponse.json({ results: merged });
  } catch (err) {
    console.error("Species API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch species data" },
      { status: 500 }
    );
  }
}
