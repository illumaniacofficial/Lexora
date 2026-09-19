import crypto from "crypto";
import { getConfig } from "../config/env";
import { storage } from "../storage";
import { hashArtifactContent } from "./artifacts";
import type { ConceptContext, ConceptSynthesisResult, TriadDraw } from "./concepts";
import type { TriadDrawRow } from "@shared/schema";
import { fallbackOracleAnalysis } from "./oracleFallback";
import { parseJsonObject } from "./conceptIntelligence";
import { buildDirectorContributions, normalizeConceptDirection } from "./conceptDirections";
import { callConceptRuntime } from "./conceptRuntime";

export async function synthesizeTriadConcept(draw: TriadDraw | TriadDrawRow, context: ConceptContext = {}): Promise<ConceptSynthesisResult> {
  const config = getConfig();
  const oracle = fallbackOracleAnalysis(draw, context, config.studio.runtimeMode);
  const response = await callConceptRuntime(draw, context, oracle);
  let directions = [] as ConceptSynthesisResult["directions"];
  try {
    const parsed = parseJsonObject(response.text);
    directions = (Array.isArray(parsed.directions) ? parsed.directions : [])
      .slice(0, 5)
      .map((item: any, index: number) => normalizeConceptDirection(item, oracle, context, index));
  } catch {
    directions = [];
  }
  if (directions.length < 3) {
    const base = normalizeConceptDirection({}, oracle, context, 0);
    directions = [0, 1, 2].map((index) => ({
      ...base,
      id: crypto.randomUUID(),
      workingTitle: index === 0 ? base.workingTitle : `${base.workingTitle}: ${["Reader Promise", "Structure", "Differentiation"][index - 1]}`,
      oneLinePremise: index === 0 ? base.oneLinePremise : `${base.oneLinePremise} — alternate ${["reader-promise", "structure", "differentiation"][index - 1]} approach.`,
    }));
  }

  const synthesisRunId = crypto.randomUUID();

  const result: ConceptSynthesisResult = {
    drawId: draw.id,
    synthesisRunId,
    context,
    oracle,
    directions,
    contributions: buildDirectorContributions(oracle, directions, response.runtime),
    runtime: response.runtime,
  };

  const run = await storage.createConceptSynthesisRun({
    id: synthesisRunId,
    triadDrawId: draw.id,
    propertyId: null,
    status: "generated",
    context,
    oracleAnalysis: oracle,
    directions,
    contributions: result.contributions,
    runtime: result.runtime,
  });

  await storage.updateTriadDraw(draw.id, { status: "synthesized" });
  await storage.createCreativeArtifactWithAtomicVersion({
    id: crypto.randomUUID(),
    propertyId: null,
    projectId: null,
    chapterId: null,
    type: "concept-synthesis",
    parentArtifactId: null,
    createdBy: "core",
    runtimeId: `${response.runtime.location}:${response.runtime.model}`,
    model: response.runtime.model,
    promptVersion: "wave03-concept-synthesis-v1",
    context: { notes: [`triad-draw:${draw.id}`, `synthesis-run:${run.id}`] },
    content: result,
    contentHash: hashArtifactContent(result),
    estimatedCostUsd: response.runtime.location === "local" ? 0 : null,
    state: "generated",
  });

  return result;
}
