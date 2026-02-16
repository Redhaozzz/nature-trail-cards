"use client";

import { useState } from "react";
import { AppStep, SelectedLocation, Species, CardContent } from "@/types";
import MapSelector from "@/components/MapSelector";
import SpeciesGrid from "@/components/SpeciesGrid";
import GeneratingView from "@/components/GeneratingView";
import CardPreview from "@/components/CardPreview";

interface SpeciesCache {
  location: SelectedLocation;
  species: Species[];
  selectedIds: number[];
}

export default function Home() {
  const [step, setStep] = useState<AppStep>("select-location");
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<Species[]>([]);
  const [cards, setCards] = useState<CardContent[]>([]);
  const [speciesCache, setSpeciesCache] = useState<SpeciesCache | null>(null);

  const handleLocationSelect = (loc: SelectedLocation) => {
    setLocation(loc);
    setStep("select-species");
  };

  const handleSpeciesSelect = (species: Species[]) => {
    setSelectedSpecies(species);
    setStep("generating");
  };

  const handleCardsGenerated = (generatedCards: CardContent[]) => {
    setCards(generatedCards);
    setStep("preview");
  };

  const handleBackToLocation = () => {
    setLocation(null);
    setSelectedSpecies([]);
    setCards([]);
    setStep("select-location");
  };

  const handleBackToSpecies = () => {
    setCards([]);
    setStep("select-species");
  };

  switch (step) {
    case "select-location":
      return <MapSelector onLocationSelect={handleLocationSelect} />;

    case "select-species": {
      const cacheMatch =
        speciesCache &&
        speciesCache.location.lat === location!.lat &&
        speciesCache.location.lng === location!.lng &&
        speciesCache.location.radius === location!.radius;
      return (
        <SpeciesGrid
          location={location!}
          onSpeciesSelect={handleSpeciesSelect}
          onBack={handleBackToLocation}
          initialSpecies={cacheMatch ? speciesCache!.species : undefined}
          initialSelectedIds={cacheMatch ? speciesCache!.selectedIds : undefined}
          onSpeciesLoaded={(species, selectedIds) =>
            setSpeciesCache({ location: location!, species, selectedIds })
          }
        />
      );
    }

    case "generating":
      return (
        <GeneratingView
          species={selectedSpecies}
          location={location!}
          onComplete={handleCardsGenerated}
          onBack={handleBackToSpecies}
        />
      );

    case "preview":
      return (
        <CardPreview
          cards={cards}
          placeName={location!.name}
          onBack={handleBackToSpecies}
        />
      );
  }
}
