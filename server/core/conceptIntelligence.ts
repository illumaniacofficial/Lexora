import type { ConceptContext, EvidenceLevel, ConfidenceLevel, MarketEvidenceStatus, TriadDraw } from "./concepts";
import type { PropertyType, SeriesIntent } from "./property";
import type { TriadDrawRow } from "@shared/schema";

export const PROPERTY_FORMATS = new Set([
  "fiction", "nonfiction", "children", "biography", "memoir", "lifestyle", "culture", "history",
  "fashion", "music", "cookbook", "reference", "educational", "photography", "poetry",
  "essay-collection", "journal", "workbook", "devotional", "documentary-source",
  "narrative-journalism", "graphic-story", "anthology", "hybrid", "custom",
]);

export function slugifyConcept(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Concept intelligence response was not valid JSON.");
  }
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

export function confidenceValue(value: unknown, fallback: ConfidenceLevel): ConfidenceLevel {
  return ["low", "medium", "high"].includes(String(value)) ? value as ConfidenceLevel : fallback;
}

export function evidenceValue(value: unknown, fallback: EvidenceLevel): EvidenceLevel {
  return ["none", "low", "moderate", "high"].includes(String(value)) ? value as EvidenceLevel : fallback;
}

export function marketEvidenceFor(context: ConceptContext, runtimeMode: string): MarketEvidenceStatus {
  if (runtimeMode === "off-grid") return "unavailable-offline";
  if (context.marketObjective || context.genre || context.topic) return "user-provided";
  return "not-requested";
}

export function drawCards(draw: TriadDraw | TriadDrawRow) {
  return {
    who: "who" in draw ? draw.who : draw.whoCard,
    what: "what" in draw ? draw.what : draw.whatCard,
    how: "how" in draw ? draw.how : draw.howCard,
  } as {
    who: { tags?: string[]; label: string; text?: string };
    what: { tags?: string[]; label: string; text?: string };
    how: { tags?: string[]; label: string; text?: string };
  };
}

export function inferConceptFormat(draw: TriadDraw | TriadDrawRow, context: ConceptContext): PropertyType {
  const requested = slugifyConcept(context.format, "");
  if (PROPERTY_FORMATS.has(requested)) return requested as PropertyType;
  const { who, what, how } = drawCards(draw);
  const tags = [...(who?.tags || []), ...(what?.tags || []), ...(how?.tags || [])];
  if (tags.includes("children") || slugifyConcept(context.audience, "").includes("child")) return "children";
  if (tags.includes("food")) return "cookbook";
  if (tags.includes("music")) return "music";
  if (tags.includes("fashion")) return "fashion";
  if (tags.includes("history")) return "history";
  if (tags.includes("poetry")) return "poetry";
  if (tags.includes("documentary") || tags.includes("research")) return "documentary-source";
  if (tags.includes("fiction") || tags.includes("fantasy") || tags.includes("mystery")) return "fiction";
  return "nonfiction";
}

export function inferConceptSeriesIntent(context: ConceptContext, draw: TriadDraw | TriadDrawRow): SeriesIntent {
  const requested = slugifyConcept(context.seriesIntent, "");
  if (requested.includes("open")) return "open-ended-series";
  if (requested.includes("limited")) return "limited-series";
  if (requested.includes("planned") || requested.includes("series")) return "planned-series";
  if (draw.wildcards?.some((item) => item.includes("SERIES"))) return "standalone-with-series-potential";
  return "standalone";
}
