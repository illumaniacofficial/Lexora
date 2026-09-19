import crypto from "crypto";
import type { ConceptSynthesisResult, OperationalConceptDossier } from "./concepts";

export function dossierFromDirection(synthesis: ConceptSynthesisResult, directionId: string): OperationalConceptDossier {
  const direction = synthesis.directions.find((item) => item.id === directionId);
  if (!direction) throw new Error(`Concept direction ${directionId} not found`);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    source: { kind: "triad", drawId: synthesis.drawId },
    workingTitle: direction.workingTitle,
    premise: direction.expandedPremise,
    targetReader: direction.targetReader,
    readerProblemOrDesire: direction.coreConflictOrProblem,
    corePromise: direction.readerPromise,
    uniqueAngle: direction.differentiation,
    format: direction.classification.format,
    genreTags: direction.classification.genres,
    topicTags: direction.classification.topics,
    themes: direction.classification.themes,
    seriesPotential: direction.seriesPotential,
    adaptationPotential: [],
    researchBurden: direction.researchNeeds.length > 2 ? "high" : direction.researchNeeds.length > 0 ? "medium" : "light",
    productionComplexity: synthesis.oracle.productionComplexity,
    originalityNotes: [direction.differentiation],
    risks: direction.risks,
    confidence: direction.confidence,
    status: "developing",
    identity: { premise: direction.expandedPremise, promise: direction.readerPromise, angle: direction.oneLinePremise, differentiation: direction.differentiation },
    reader: {
      targetReader: direction.targetReader,
      ageOrReadingLevel: direction.classification.ageBand ?? null,
      desiredFeelings: direction.tone,
      desiredOutcomeOrTransformation: [direction.readerPromise],
    },
    voiceExperience: {
      tone: direction.tone,
      language: synthesis.context.language || "english",
      pacingExpectations: [direction.structuralApproach],
      usabilityRequirements: direction.researchNeeds,
    },
    content: {
      genres: direction.classification.genres,
      subgenres: direction.classification.subgenres,
      topics: direction.classification.topics,
      themes: direction.classification.themes,
      maturity: direction.classification.maturity ?? null,
    },
    structure: {
      intendedFormat: direction.classification.format,
      structuralApproach: direction.structuralApproach,
      seriesIntent: synthesis.context.seriesIntent || direction.seriesPotential,
    },
    intelligence: {
      oracleFindings: synthesis.oracle,
      redactorConcerns: [direction.redactorChallenge],
      researchRequirements: direction.researchNeeds,
      evidenceLevel: direction.evidenceLevel,
      confidence: direction.confidence,
      marketEvidenceStatus: direction.marketEvidenceStatus,
    },
    decision: {
      selectedDirectionId: direction.id,
      alternativesConsidered: synthesis.directions
        .filter((item) => item.id !== direction.id)
        .map((item) => ({ directionId: item.id, title: item.workingTitle, status: "archived" as const })),
      userDecisionAt: now,
      sourceTriadDrawId: synthesis.drawId,
      sourceArtifactIds: [],
    },
    contributions: synthesis.contributions,
  };
}
