import crypto from "crypto";
import type { ConceptContext, ConceptDirection, DirectorContribution, OracleConceptAnalysis } from "./concepts";
import { confidenceValue, evidenceValue, stringArray } from "./conceptIntelligence";

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeConceptDirection(raw: any, oracle: OracleConceptAnalysis, context: ConceptContext, index: number): ConceptDirection {
  const title = text(raw?.workingTitle, `${oracle.genres[0]?.label || "Concept"} Direction ${index + 1}`);
  const premise = text(raw?.oneLinePremise, `A ${oracle.format} concept built around ${title}.`);
  return {
    id: text(raw?.id, crypto.randomUUID()),
    workingTitle: title,
    oneLinePremise: premise,
    expandedPremise: text(raw?.expandedPremise, premise),
    targetReader: text(raw?.targetReader, oracle.targetReader),
    readerPromise: text(raw?.readerPromise, oracle.emotionalPromise),
    classification: {
      format: text(raw?.classification?.format, oracle.format),
      genres: stringArray(raw?.classification?.genres).length ? stringArray(raw.classification.genres) : oracle.genres.map((item) => item.label),
      subgenres: stringArray(raw?.classification?.subgenres),
      topics: stringArray(raw?.classification?.topics).length ? stringArray(raw.classification.topics) : oracle.topics,
      themes: stringArray(raw?.classification?.themes).length ? stringArray(raw.classification.themes) : oracle.themes,
      audience: text(raw?.classification?.audience, text(raw?.targetReader, oracle.targetReader)),
      ageBand: raw?.classification?.ageBand ?? context.ageBand ?? null,
      maturity: raw?.classification?.maturity ?? context.maturity ?? null,
    },
    tone: stringArray(raw?.tone).length ? stringArray(raw.tone) : [context.tone || oracle.emotionalPromise],
    coreConflictOrProblem: text(raw?.coreConflictOrProblem, oracle.readerProblemOrDesire),
    emotionalEngine: text(raw?.emotionalEngine, oracle.emotionalPromise),
    storyOrContentEngine: text(raw?.storyOrContentEngine, `The work progresses by repeatedly testing this promise: ${oracle.emotionalPromise}.`),
    structuralApproach: text(raw?.structuralApproach, `A ${oracle.format} structure shaped around the target reader's transformation.`),
    differentiation: text(raw?.differentiation, oracle.differentiationAngle),
    seriesPotential: text(raw?.seriesPotential, oracle.seriesPotential),
    researchNeeds: stringArray(raw?.researchNeeds).length ? stringArray(raw.researchNeeds) : oracle.researchRequirements,
    risks: stringArray(raw?.risks).length ? stringArray(raw.risks) : oracle.risks,
    oraclePosition: text(raw?.oraclePosition, oracle.summary),
    scribeRationale: text(raw?.scribeRationale, "Scribe prioritizes the reader contract over literal card text and turns the collision into a coherent reader experience."),
    redactorChallenge: text(raw?.redactorChallenge, `Redactor challenge: prove ${title} is not generic, derivative, structurally weak, or mismatched to its reader.`),
    confidence: confidenceValue(raw?.confidence, oracle.confidence),
    evidenceLevel: evidenceValue(raw?.evidenceLevel, oracle.evidenceLevel),
    marketEvidenceStatus: oracle.marketEvidenceStatus,
  };
}

export function buildDirectorContributions(oracle: OracleConceptAnalysis, directions: ConceptDirection[], runtime: Record<string, unknown>): DirectorContribution[] {
  return [
    {
      director: "oracle",
      role: "Publishing intelligence and reader positioning",
      summary: oracle.summary,
      contribution: { targetReader: oracle.targetReader, differentiationAngle: oracle.differentiationAngle, marketEvidenceStatus: oracle.marketEvidenceStatus, risks: oracle.risks, unansweredQuestions: oracle.unansweredQuestions },
      confidence: oracle.confidence,
      evidenceLevel: oracle.evidenceLevel,
    },
    {
      director: "scribe",
      role: "Creative synthesis and reader experience architecture",
      summary: `Scribe transformed the Triad into ${directions.length} reader-appropriate directions.`,
      contribution: { directionIds: directions.map((direction) => direction.id), structures: directions.map((direction) => direction.structuralApproach) },
    },
    {
      director: "redactor",
      role: "Independent critique and genericness challenge",
      summary: "Redactor challenged premise strength, trope familiarity, reader mismatch, and structural weakness.",
      contribution: { challenges: directions.map((direction) => ({ directionId: direction.id, challenge: direction.redactorChallenge })) },
    },
    {
      director: "core",
      role: "Orchestration, persistence, runtime, and artifact lineage",
      summary: `Core routed synthesis through ${runtime.location}:${runtime.model} and preserved the team contribution ledger.`,
      contribution: runtime,
    },
  ];
}
