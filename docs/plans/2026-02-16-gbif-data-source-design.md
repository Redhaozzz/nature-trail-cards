# GBIF Data Source Integration Design

## Summary
Integrate GBIF as a supplementary species data source alongside iNaturalist. Create a unified `/api/species` backend endpoint that queries both sources concurrently, merges by scientific name (iNat priority), and returns combined results.

## Architecture
- New `/api/species/route.ts` replaces direct frontend iNaturalist calls
- Concurrent requests to iNaturalist + GBIF
- Merge/dedup by `scientific_name`
- iNaturalist data takes priority (better photos, common names)
- GBIF fills in species not found in iNat

## API Details
- iNaturalist: existing species_counts endpoint
- GBIF: occurrence/search with facet=speciesKey, then species/{key} for details
- GBIF bounding box: lat +/- radius/111, lng +/- radius/(111*cos(lat*PI/180))

## Frontend Changes
- SpeciesGrid calls `/api/species` instead of iNaturalist directly
- Source badges on species cards (green=iNat, orange=GBIF, both=dual)
