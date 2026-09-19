import { getConfig } from "../config/env";
import { openai, HIGH_MODEL, OPENAI_CONFIGURED } from "../openai";
import { isOllamaAvailable, ollamaChat } from "./ollama";
import type { ConceptContext, TriadDraw } from "./concepts";
import type { TriadDrawRow } from "@shared/schema";
import type { OracleConceptAnalysis } from "./concepts";

function drawCards(draw: TriadDraw | TriadDrawRow) {
  return {
    who: "who" in draw ? draw.who : draw.whoCard,
    what: "what" in draw ? draw.what : draw.whatCard,
    how: "how" in draw ? draw.how : draw.howCard,
  };
}

export function buildConceptSynthesisPrompt(draw: TriadDraw | TriadDrawRow, context: ConceptContext, oracle: OracleConceptAnalysis): string {
  const { who, what, how } = drawCards(draw);
  return `You are Lexora's combined SCRIBE + REDACTOR concept synthesis workflow.

ORACLE has completed the opportunity analysis. SCRIBE must synthesize 3-5 serious directions. REDACTOR must independently challenge each direction. Do not literally mash cards together. The Creative Target Contract and reader fit outrank literal card interpretation.

TRIAD DRAW:
WHO: ${JSON.stringify(who)}
WHAT: ${JSON.stringify(what)}
HOW: ${JSON.stringify(how)}
WILDCARDS: ${JSON.stringify(draw.wildcards || [])}

USER CONTEXT:
${JSON.stringify(context)}

ORACLE ANALYSIS:
${JSON.stringify(oracle)}

Return ONLY JSON with this exact shape:
{
  "directions": [
    {
      "workingTitle": "", "oneLinePremise": "", "expandedPremise": "", "targetReader": "", "readerPromise": "",
      "classification": { "format": "", "genres": [], "subgenres": [], "topics": [], "themes": [], "audience": "", "ageBand": null, "maturity": null },
      "tone": [], "coreConflictOrProblem": "", "emotionalEngine": "", "storyOrContentEngine": "", "structuralApproach": "",
      "differentiation": "", "seriesPotential": "", "researchNeeds": [], "risks": [], "oraclePosition": "", "scribeRationale": "", "redactorChallenge": "",
      "confidence": "low|medium|high", "evidenceLevel": "none|low|moderate|high"
    }
  ],
  "redactorSummary": ""
}

Rules:
- 3 to 5 directions.
- Weird combinations must become intelligently transformed, reader-appropriate concepts.
- If HOW indicates children's format and WHAT says scary, create gentle/misunderstood/appearance-based concepts, not adult horror.
- Never claim guaranteed bestseller, awards, profit, uniqueness, or deal.
- Use evidence and confidence language only.`;
}

export async function callConceptRuntime(draw: TriadDraw | TriadDrawRow, context: ConceptContext, oracle: OracleConceptAnalysis) {
  const config = getConfig();
  const prompt = buildConceptSynthesisPrompt(draw, context, oracle);
  const system = "You are Lexora's combined Scribe/Redactor structured concept engine. Return strict JSON only.";
  const localPreferred = config.studio.runtimeMode === "off-grid" || config.studio.runtimeMode === "hybrid";

  if (localPreferred && await isOllamaAvailable()) {
    const text = await ollamaChat({ model: config.ollama.model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], temperature: 0.6 });
    return { text, runtime: { mode: config.studio.runtimeMode, location: "local" as const, model: config.ollama.model, localApiCostUsd: 0 as const, marketEvidenceStatus: oracle.marketEvidenceStatus } };
  }
  if (config.studio.runtimeMode === "off-grid") throw new Error("Lexora is in off-grid mode but the configured Ollama runtime is unavailable.");
  if (!OPENAI_CONFIGURED) {
    if (await isOllamaAvailable()) {
      const text = await ollamaChat({ model: config.ollama.model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], temperature: 0.6 });
      return { text, runtime: { mode: config.studio.runtimeMode, location: "local" as const, model: config.ollama.model, localApiCostUsd: 0 as const, marketEvidenceStatus: oracle.marketEvidenceStatus } };
    }
    throw new Error("No available concept synthesis runtime. Configure OpenAI or start Ollama locally.");
  }

  const completion = await openai.chat.completions.create({
    model: HIGH_MODEL,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
  });
  return { text: completion.choices[0]?.message?.content || "{}", runtime: { mode: config.studio.runtimeMode, location: "cloud" as const, model: HIGH_MODEL, localApiCostUsd: 0 as const, marketEvidenceStatus: oracle.marketEvidenceStatus } };
}
