import type { ConceptContext, OracleConceptAnalysis, TriadDraw } from "./concepts";
import type { TriadDrawRow } from "@shared/schema";
import { drawCards, inferConceptFormat, inferConceptSeriesIntent, marketEvidenceFor, slugifyConcept } from "./conceptIntelligence";

export function fallbackOracleAnalysis(draw: TriadDraw | TriadDrawRow, context: ConceptContext, runtimeMode: string): OracleConceptAnalysis {
  const format = inferConceptFormat(draw, context);
  const { who, what, how } = drawCards(draw);
  const genre = context.genre || what.label || "general";
  return {
    targetReader: context.audience || (format === "children" ? "children and the adults reading with them" : "readers aligned with the supplied concept context"),
    readerProblemOrDesire: context.purpose || `A reader wants a ${format} work that turns ${what.label} into a meaningful experience.`,
    emotionalPromise: context.tone || `Curiosity, recognition, and a satisfying transformation around ${what.label}.`,
    format,
    genres: [{ id: slugifyConcept(genre, "general"), label: genre, weight: 1 }],
    subgenres: [],
    topics: [...new Set([context.topic, ...(what.tags || [])].filter(Boolean) as string[])].slice(0, 8),
    themes: [...new Set([context.purpose, ...(what.tags || [])].filter(Boolean) as string[])].slice(0, 8),
    differentiationAngle: "Transform the literal card collision through audience fit, reader promise, and format expectations rather than mashing labels together.",
    familiarityOrTropeRisks: ["Treating card labels literally may make the concept generic."],
    competitionSignals: [],
    evergreenPotential: "Depends on whether the core reader promise survives beyond the novelty hook.",
    seriesPotential: inferConceptSeriesIntent(context, draw) === "standalone" ? "Standalone unless the engine supports recurrence." : "Has series potential.",
    productionComplexity: ["history", "biography", "documentary-source"].includes(format) ? "high" : "medium",
    researchRequirements: format === "fiction" || format === "children" || format === "poetry" ? [] : ["Validate factual and market claims before manuscript development."],
    estimatedAiProductionCostClass: runtimeMode === "connected" ? "low" : "free",
    evidenceLevel: context.marketObjective ? "low" : "none",
    confidence: context.audience || context.format || context.genre ? "medium" : "low",
    marketEvidenceStatus: marketEvidenceFor(context, runtimeMode),
    risks: ["No live market validation was performed."],
    unansweredQuestions: ["Which comparable titles should Oracle inspect when live evidence is available?"],
    summary: `${who.label} × ${what.label} × ${how.label} should become a reader-appropriate ${format} concept, not a literal mashup.`,
  };
}
