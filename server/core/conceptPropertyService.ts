import crypto from "crypto";
import { storage } from "../storage";
import type { OperationalConceptDossier } from "./concepts";
import { slugifyConcept } from "./conceptIntelligence";
import type { PropertyType, SeriesIntent } from "./property";

export async function createPropertyFromDossier(dossier: OperationalConceptDossier) {
  const classification = {
    format: dossier.format,
    primaryGenre: dossier.genreTags[0] ? { id: slugifyConcept(dossier.genreTags[0], "general"), label: dossier.genreTags[0], weight: 1 } : null,
    additionalGenres: dossier.genreTags.slice(1).map((label) => ({ id: slugifyConcept(label, "genre"), label, weight: 0.5 })),
    subgenres: dossier.content.subgenres.map((label) => ({ id: slugifyConcept(label, "subgenre"), label })),
    topics: dossier.topicTags.map((label) => ({ id: slugifyConcept(label, "topic"), label })),
    themes: dossier.themes.map((label) => ({ id: slugifyConcept(label, "theme"), label })),
    audiences: [{ id: slugifyConcept(dossier.targetReader, "reader"), label: dossier.targetReader, weight: 1 }],
    ageBands: dossier.reader.ageOrReadingLevel ? [{ id: slugifyConcept(dossier.reader.ageOrReadingLevel, "age"), label: dossier.reader.ageOrReadingLevel }] : [],
    tones: dossier.voiceExperience.tone.map((label) => ({ id: slugifyConcept(label, "tone"), label })),
    craftProfiles: [{ id: slugifyConcept(dossier.format, "custom"), label: dossier.format, weight: 1 }],
    maturityTags: dossier.content.maturity ? [{ id: slugifyConcept(dossier.content.maturity, "maturity"), label: dossier.content.maturity }] : [],
    marketPositions: [{ id: slugifyConcept(dossier.uniqueAngle, "position"), label: dossier.uniqueAngle }],
    seriesIntent: (dossier.structure.seriesIntent || "standalone") as SeriesIntent,
    language: dossier.voiceExperience.language || "english",
  };

  const targetContract = {
    targetReader: dossier.targetReader,
    readerAgeOrLevel: dossier.reader.ageOrReadingLevel ?? null,
    desiredFeelings: dossier.reader.desiredFeelings,
    desiredKnowledgeOrTransformation: dossier.reader.desiredOutcomeOrTransformation,
    tone: dossier.voiceExperience.tone,
    structureExpectations: [dossier.structure.structuralApproach],
    researchStandard: dossier.researchBurden === "high" ? "high" : dossier.researchBurden === "medium" ? "standard" : "light",
    maturityBoundaries: dossier.content.maturity ? [dossier.content.maturity] : [],
    pacingExpectations: dossier.voiceExperience.pacingExpectations,
    usabilityRequirements: dossier.voiceExperience.usabilityRequirements,
    emotionalPromise: dossier.identity.promise,
    desiredAftereffect: dossier.reader.desiredOutcomeOrTransformation,
    conventionsToHonor: [],
    conventionsToChallenge: dossier.originalityNotes,
    qualityCriteria: [
      { id: "reader-promise", label: "Reader promise", description: "The work fulfills the dossier promise for its target reader.", importance: "critical" },
      { id: "differentiation", label: "Differentiation", description: "The work preserves the dossier's distinct angle.", importance: "important" },
    ],
  };

  return storage.createStudioProperty({
    id: crypto.randomUUID(),
    workingTitle: dossier.workingTitle || "Untitled Concept Property",
    canonicalTitle: null,
    status: "greenlit",
    format: dossier.format as PropertyType,
    seriesIntent: classification.seriesIntent,
    legacyVertical: dossier.genreTags[0] || null,
    classification,
    targetContract,
  });
}
