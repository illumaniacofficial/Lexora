import { openai, FAST_MODEL } from "./openai";
import type { Project, BookDna, TrendReport } from "@shared/schema";

export interface CompetitorTeardown {
  competitors: { name: string; strengths: string; weaknesses: string }[];
  marketGaps: string[];
  positioning: string;
  differentiators: string[];
  recommendedAngle: string;
}

export interface KdpOptimization {
  keywords: string[];
  categories: { name: string; rationale: string }[];
  summary: string;
}

function bookDnaContext(bookDna?: BookDna | null): string {
  if (!bookDna) return "";
  const parts: string[] = [];
  if (bookDna.corePromise) parts.push(`Core promise: ${bookDna.corePromise}`);
  if (bookDna.readerAvatar) parts.push(`Reader avatar: ${bookDna.readerAvatar}`);
  if (bookDna.transformationArc) parts.push(`Transformation: ${bookDna.transformationArc}`);
  if (bookDna.frameworkSummary) parts.push(`Framework: ${bookDna.frameworkSummary}`);
  return parts.length ? `\n\nBook DNA:\n${parts.join("\n")}` : "";
}

export async function analyzeCompetitor(
  project: Project,
  bookDna: BookDna | null | undefined,
  competitorInput: string,
): Promise<{ result: CompetitorTeardown; tokens: number }> {
  const focus = competitorInput.trim()
    ? `The author is benchmarking against this specific competitor / market input:\n"""${competitorInput.trim().slice(0, 4000)}"""`
    : `No specific competitor was provided — analyze the leading competing titles in this niche generally.`;

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [{
      role: "system",
      content: "You are a publishing market strategist who tears down competing books to find positioning gaps. Respond ONLY with valid JSON.",
    }, {
      role: "user",
      content: `Our book: "${project.title}" by ${project.authorName} in the "${project.vertical}" niche.${bookDnaContext(bookDna)}

${focus}

Produce a competitor teardown and positioning report. Return JSON with:
- competitors: array of 3 objects { "name": "<a realistic competing title or author archetype>", "strengths": "<one sentence>", "weaknesses": "<one sentence gap we can exploit>" }
- marketGaps: array of 5 unmet reader needs in this niche
- positioning: one concise paragraph on how our book should be positioned to win
- differentiators: array of 4 specific ways our book stands apart
- recommendedAngle: one sentence describing the sharpest hook/angle to lead with`,
    }],
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const result: CompetitorTeardown = {
    competitors: Array.isArray(parsed.competitors) ? parsed.competitors.slice(0, 5) : [],
    marketGaps: Array.isArray(parsed.marketGaps) ? parsed.marketGaps : [],
    positioning: typeof parsed.positioning === "string" ? parsed.positioning : "",
    differentiators: Array.isArray(parsed.differentiators) ? parsed.differentiators : [],
    recommendedAngle: typeof parsed.recommendedAngle === "string" ? parsed.recommendedAngle : "",
  };
  return { result, tokens: completion.usage?.total_tokens || 0 };
}

export async function optimizeKdp(
  project: Project,
  bookDna: BookDna | null | undefined,
): Promise<{ result: KdpOptimization; tokens: number }> {
  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [{
      role: "system",
      content: "You are an Amazon KDP discoverability expert who picks high-intent keywords and categories. Respond ONLY with valid JSON.",
    }, {
      role: "user",
      content: `Optimize Amazon KDP metadata for the book "${project.title}" by ${project.authorName} in the "${project.vertical}" niche.${bookDnaContext(bookDna)}

Return JSON with:
- keywords: array of EXACTLY 7 KDP keyword phrases (2-4 words each, buyer search intent, low-to-mid competition)
- categories: array of EXACTLY 2 objects { "name": "<a real Amazon Kindle browse category path, e.g. 'Kindle Store > Kindle eBooks > Business & Money > Entrepreneurship'>", "rationale": "<one sentence on why it fits and is winnable>" }
- summary: one sentence on the overall discoverability strategy`,
    }],
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const result: KdpOptimization = {
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 7) : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories.slice(0, 2) : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
  return { result, tokens: completion.usage?.total_tokens || 0 };
}

export interface VerticalForecast {
  vertical: string;
  reportCount: number;
  currentDemand: number | null;
  forecastDemand: number | null;
  demandTrend: number;
  currentCompetition: number | null;
  currentGreenlight: number | null;
  lastUpdated: string | null;
  alert: "act-now" | "rising" | "cooling" | "stable" | "insufficient-data";
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) * (i - meanX);
  }
  return den === 0 ? 0 : num / den;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function forecastTrends(reports: TrendReport[]): VerticalForecast[] {
  const byVertical = new Map<string, TrendReport[]>();
  for (const r of reports) {
    const list = byVertical.get(r.vertical) || [];
    list.push(r);
    byVertical.set(r.vertical, list);
  }

  const forecasts: VerticalForecast[] = [];
  for (const [vertical, list] of byVertical) {
    const chronological = [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const latest = chronological[chronological.length - 1];
    const demandSeries = chronological
      .map(r => r.demandScore)
      .filter((v): v is number => v != null);

    const currentDemand = latest.demandScore ?? null;
    const currentCompetition = latest.competitionScore ?? null;
    const currentGreenlight = latest.greenlightScore ?? null;
    const slope = demandSeries.length >= 2 ? linearSlope(demandSeries) : 0;
    const forecastDemand =
      currentDemand != null && demandSeries.length >= 2
        ? Math.round(clamp(currentDemand + slope, 0, 10) * 10) / 10
        : currentDemand;

    let alert: VerticalForecast["alert"];
    if (demandSeries.length < 2) {
      alert = "insufficient-data";
    } else if (slope >= 0.4 && (currentCompetition == null || currentCompetition <= 6.5)) {
      alert = "act-now";
    } else if (slope >= 0.2) {
      alert = "rising";
    } else if (slope <= -0.3) {
      alert = "cooling";
    } else {
      alert = "stable";
    }

    forecasts.push({
      vertical,
      reportCount: chronological.length,
      currentDemand,
      forecastDemand,
      demandTrend: Math.round(slope * 100) / 100,
      currentCompetition,
      currentGreenlight,
      lastUpdated: latest.createdAt ? new Date(latest.createdAt).toISOString() : null,
      alert,
    });
  }

  const rank: Record<VerticalForecast["alert"], number> = {
    "act-now": 0, rising: 1, stable: 2, cooling: 3, "insufficient-data": 4,
  };
  forecasts.sort((a, b) => {
    if (rank[a.alert] !== rank[b.alert]) return rank[a.alert] - rank[b.alert];
    return (b.forecastDemand ?? 0) - (a.forecastDemand ?? 0);
  });
  return forecasts;
}
