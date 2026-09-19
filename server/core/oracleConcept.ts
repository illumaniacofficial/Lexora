import type { ConceptContext, OracleConceptAnalysis, TriadDraw } from "./concepts";
import type { TriadDrawRow } from "@shared/schema";
import { drawCards, inferConceptFormat, inferConceptSeriesIntent, marketEvidenceFor, slugifyConcept, stringArray } from "./conceptIntelligence";
import { fallbackOracleAnalysis } from "./oracleFallback";

export function normalizeOracleAnalysis(raw: any, draw: TriadDraw | TriadDrawRow, context: ConceptContext, runtimeMode: string): OracleConceptAnalysis {
  const fallback = fallbackOracleAnalysis(draw, context, runtimeMode);
  const genres = Array.isArray(raw?.genres) ? raw.genres : [];
  const normalizedGenres = genres.map((item: any, index: number) => {
    const label = String(item?.label || item?.id || item || "").trim();
    if (!label) return null;
    const weight = Number(item?.weight);
    return { id: slugifyConcept(label, `genre-${index + 1}`), label, weight: Number.isFinite(weight) ? weight : 1 };
  }).filter(Boolean) as OracleConceptAnalysis["genres"];
  return {
    ...fallback,
    targetReader: typeof raw?.targetReader === "string" && raw.targetReader.trim() ? raw.targetReader.trim() : fallback.targetReader,
    readerProblemOrDesire: typeof raw?.readerProblemOrDesire === "string" && raw.readerProblemOrDesire.trim() ? raw.readerProblemOrDesire.trim() : fallback.readerProblemOrDesire,
    emotionalPromise: typeof raw?.emotionalPromise === "string" && raw.emotionalPromise.trim() ? raw.emotionalPromise.trim() : fallback.emotionalPromise,
    format: typeof raw?.format === "string" && raw.format.trim() ? raw.format.trim() : fallback.format,
    genres: normalizedGenres.length ? normalizedGenres : fallback.genres,
    subgenres: Array.isArray(raw?.subgenres) ? raw.subgenres : fallback.subgenres,
    topics: stringArray(raw?.topics).length ? stringArray(raw.topics) : fallback.topics,
    themes: stringArray(raw?.themes).length ? stringArray(raw.themes) : fallback.themes,
    differentiationAngle: typeof raw?.differentiationAngle === "string" && raw.differentiationAngle.trim() ? raw.differentiationAngle.trim() : fallback.differentiationAngle,
    familiarityOrTropeRisks: stringArray(raw?.familiarityOrTropeRisks).length ? stringArray(raw.familiarityOrTropeRisks) : fallback.familiarityOrTropeRisks,
    competitionSignals: stringArray(raw?.competitionSignals),
    evergreenPotential: typeof raw?.evergreenPotential === "string" ? raw.evergreenPotential : fallback.evergreenPotential,
    seriesPotential: typeof raw?.seriesPotential === "string" ? raw.seriesPotential : fallback.seriesPotential,
    productionComplexity: ["low", "medium", "high"].includes(raw?.productionComplexity) ? raw.productionComplexity : fallback.productionComplexity,
    researchRequirements: stringArray(raw?.researchRequirements),
    estimatedAiProductionCostClass: ["free", "low", "standard", "premium"].includes(raw?.estimatedAiProductionCostClass) ? raw.estimatedAiProductionCostClass : fallback.estimatedAiProductionCostClass,
    evidenceLevel: ["none", "low", "moderate", "high"].includes(raw?.evidenceLevel) ? raw.evidenceLevel : fallback.evidenceLevel,
    confidence: ["low", "medium", "high"].includes(raw?.confidence) ? raw.confidence : fallback.confidence,
    marketEvidenceStatus: marketEvidenceFor(context, runtimeMode),
    risks: stringArray(raw?.risks).length ? stringArray(raw.risks) : fallback.risks,
    unansweredQuestions: stringArray(raw?.unansweredQuestions),
    summary: typeof raw?.summary === "string" && raw.summary.trim() ? raw.summary.trim() : fallback.summary,
  };
}

export function oracleSummaryFor(draw: TriadDraw | TriadDrawRow, context: ConceptContext, runtimeMode: string): OracleConceptAnalysis {
  return fallbackOracleAnalysis(draw, context, runtimeMode);
}

export function inferFormatAndSeries(draw: TriadDraw | TriadDrawRow, context: ConceptContext) {
  return { format: inferConceptFormat(draw, context), seriesIntent: inferConceptSeriesIntent(context, draw) };
}
