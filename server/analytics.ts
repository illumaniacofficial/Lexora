import { openai, FAST_MODEL } from "./openai";
import type { Project, BookDna, MarketingAsset, RunStep, AnalyticsEvent } from "@shared/schema";

export interface ForecastAssumptions {
  listPrice: number;
  royaltyRate: number;
  monthlyUnits: number;
  monthlyGrowth: number;
  months: number;
  platformFeePerUnit: number;
}

export interface ForecastMonth {
  month: number;
  units: number;
  gross: number;
  royalty: number;
  cumulative: number;
}

export interface ForecastScenario {
  name: string;
  multiplier: number;
  totalRoyalty: number;
  totalUnits: number;
  months: ForecastMonth[];
}

export interface RevenueProjection {
  scenarios: ForecastScenario[];
  baseTotalRoyalty: number;
  baseTotalUnits: number;
  perUnitRoyalty: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function normalizeAssumptions(raw: Partial<ForecastAssumptions>): ForecastAssumptions {
  return {
    listPrice: clamp(Number(raw.listPrice) || 0, 0, 1000),
    royaltyRate: clamp(Number(raw.royaltyRate) || 0, 0, 1),
    monthlyUnits: clamp(Math.round(Number(raw.monthlyUnits) || 0), 0, 1_000_000),
    monthlyGrowth: clamp(Number(raw.monthlyGrowth) || 0, -1, 5),
    months: clamp(Math.round(Number(raw.months) || 12), 1, 60),
    platformFeePerUnit: clamp(Number(raw.platformFeePerUnit) || 0, 0, 1000),
  };
}

function buildScenario(name: string, multiplier: number, a: ForecastAssumptions): ForecastScenario {
  const perUnitRoyalty = Math.max(0, a.listPrice * a.royaltyRate - a.platformFeePerUnit);
  const months: ForecastMonth[] = [];
  let cumulative = 0;
  let totalUnits = 0;
  for (let m = 1; m <= a.months; m++) {
    const units = Math.round(a.monthlyUnits * multiplier * Math.pow(1 + a.monthlyGrowth, m - 1));
    const royalty = round2(units * perUnitRoyalty);
    const gross = round2(units * a.listPrice);
    cumulative = round2(cumulative + royalty);
    totalUnits += units;
    months.push({ month: m, units, gross, royalty, cumulative });
  }
  return {
    name,
    multiplier,
    totalRoyalty: cumulative,
    totalUnits,
    months,
  };
}

export function computeRevenueForecast(raw: Partial<ForecastAssumptions>): {
  assumptions: ForecastAssumptions;
  projections: RevenueProjection;
} {
  const a = normalizeAssumptions(raw);
  const perUnitRoyalty = round2(Math.max(0, a.listPrice * a.royaltyRate - a.platformFeePerUnit));
  const scenarios = [
    buildScenario("Conservative", 0.6, a),
    buildScenario("Base", 1.0, a),
    buildScenario("Optimistic", 1.6, a),
  ];
  const base = scenarios[1];
  return {
    assumptions: a,
    projections: {
      scenarios,
      baseTotalRoyalty: base.totalRoyalty,
      baseTotalUnits: base.totalUnits,
      perUnitRoyalty,
    },
  };
}

export interface AbVariant {
  text: string;
  appealScore: number;
  ctr: number;
  rationale: string;
}

const AB_TEST_LABELS: Record<string, string> = {
  title: "book title",
  blurb: "back-cover blurb / description",
  cover: "cover art-direction concept",
};

function bookDnaContext(bookDna?: BookDna | null): string {
  if (!bookDna) return "";
  const parts: string[] = [];
  if (bookDna.corePromise) parts.push(`Core promise: ${bookDna.corePromise}`);
  if (bookDna.readerAvatar) parts.push(`Reader avatar: ${bookDna.readerAvatar}`);
  if (bookDna.transformationArc) parts.push(`Transformation: ${bookDna.transformationArc}`);
  return parts.length ? `\n\nBook DNA:\n${parts.join("\n")}` : "";
}

export async function generateAbVariants(
  project: Project,
  bookDna: BookDna | null | undefined,
  marketing: MarketingAsset | null | undefined,
  testType: string,
): Promise<{ result: { testType: string; variants: AbVariant[] }; tokens: number }> {
  const label = AB_TEST_LABELS[testType] || AB_TEST_LABELS.title;
  const currentRef =
    testType === "blurb"
      ? marketing?.shortBlurb || marketing?.mediumBlurb || ""
      : testType === "cover"
        ? project.coverPrompt || ""
        : project.title;

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [{
      role: "system",
      content: "You are a direct-response book marketer running A/B tests. You generate distinct variants and score each one's likely market appeal. Respond ONLY with valid JSON.",
    }, {
      role: "user",
      content: `Generate A/B test variants for the ${label} of "${project.title}" by ${project.authorName} in the "${project.vertical}" niche.${bookDnaContext(bookDna)}
${currentRef ? `\nCurrent version: """${String(currentRef).slice(0, 600)}"""` : ""}

Produce 4 distinct, high-quality variants. Score each on likely market appeal.
Return JSON with:
- variants: array of EXACTLY 4 objects {
    "text": "<the variant ${label}>",
    "appealScore": <integer 0-100, estimated reader appeal>,
    "ctr": <number, estimated click-through rate as a percentage, e.g. 4.2>,
    "rationale": "<one sentence on why this variant works>"
  }
Make the variants genuinely different in angle/tone. ${testType === "title" ? "Keep titles concise and punchy." : ""}${testType === "cover" ? "Each variant's text should be a concise cover art-direction concept (imagery, color palette, typography mood) that could be handed to a cover designer." : ""}`,
    }],
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const rawVariants: any[] = Array.isArray(parsed.variants) ? parsed.variants : [];
  const variants: AbVariant[] = rawVariants
    .map((v) => ({
      text: typeof v.text === "string" ? v.text.trim() : "",
      appealScore: clamp(Math.round(Number(v.appealScore) || 0), 0, 100),
      ctr: round2(clamp(Number(v.ctr) || 0, 0, 100)),
      rationale: typeof v.rationale === "string" ? v.rationale : "",
    }))
    .filter(v => v.text.length > 0)
    .slice(0, 4);
  if (variants.length === 0) {
    throw new Error("AI returned no usable variants. Please try again.");
  }
  variants.sort((a, b) => b.appealScore - a.appealScore);

  return { result: { testType, variants }, tokens: completion.usage?.total_tokens || 0 };
}

export interface PortfolioAnalytics {
  totals: {
    books: number;
    completedBooks: number;
    words: number;
    cost: number;
    tokens: number;
    reads: number;
    listens: number;
    avgQuality: number;
  };
  monthly: {
    month: string;
    books: number;
    words: number;
    cost: number;
    reads: number;
    listens: number;
  }[];
  topBooks: { id: number; title: string; reads: number; listens: number; words: number }[];
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function aggregatePortfolioAnalytics(
  projects: Project[],
  runSteps: RunStep[],
  events: AnalyticsEvent[],
): PortfolioAnalytics {
  const completedBooks = projects.filter(p => p.status === "complete").length;
  const words = projects.reduce((s, p) => s + (p.wordCount || 0), 0);
  const cost = round2(projects.reduce((s, p) => s + (p.estimatedCost || 0), 0));
  const tokens = projects.reduce((s, p) => s + (p.totalTokens || 0), 0);
  const qualityScores = projects.map(p => p.qualityScore).filter((v): v is number => v != null);
  const avgQuality = qualityScores.length
    ? round2(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
    : 0;

  const readEvents = events.filter(e => e.eventType === "read");
  const listenEvents = events.filter(e => e.eventType === "listen");
  const reads = readEvents.reduce((s, e) => s + (e.value || 1), 0);
  const listens = listenEvents.reduce((s, e) => s + (e.value || 1), 0);

  const monthMap = new Map<string, PortfolioAnalytics["monthly"][number]>();
  const ensureMonth = (key: string) => {
    let row = monthMap.get(key);
    if (!row) {
      row = { month: key, books: 0, words: 0, cost: 0, reads: 0, listens: 0 };
      monthMap.set(key, row);
    }
    return row;
  };
  for (const p of projects) {
    if (p.status === "complete" && p.updatedAt) {
      const row = ensureMonth(monthKey(new Date(p.updatedAt)));
      row.books += 1;
      row.words += p.wordCount || 0;
    }
  }
  for (const s of runSteps) {
    if (s.createdAt) {
      const row = ensureMonth(monthKey(new Date(s.createdAt)));
      row.cost = round2(row.cost + (s.costEstimate || 0));
    }
  }
  for (const e of readEvents) {
    if (e.createdAt) ensureMonth(monthKey(new Date(e.createdAt))).reads += e.value || 1;
  }
  for (const e of listenEvents) {
    if (e.createdAt) ensureMonth(monthKey(new Date(e.createdAt))).listens += e.value || 1;
  }
  const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const perBook = new Map<number, { reads: number; listens: number }>();
  for (const e of events) {
    if (e.projectId == null) continue;
    const row = perBook.get(e.projectId) || { reads: 0, listens: 0 };
    if (e.eventType === "read") row.reads += e.value || 1;
    if (e.eventType === "listen") row.listens += e.value || 1;
    perBook.set(e.projectId, row);
  }
  const topBooks = projects
    .map(p => ({
      id: p.id,
      title: p.title,
      reads: perBook.get(p.id)?.reads || 0,
      listens: perBook.get(p.id)?.listens || 0,
      words: p.wordCount || 0,
    }))
    .sort((a, b) => (b.reads + b.listens) - (a.reads + a.listens))
    .slice(0, 8);

  return {
    totals: {
      books: projects.length,
      completedBooks,
      words,
      cost,
      tokens,
      reads,
      listens,
      avgQuality,
    },
    monthly,
    topBooks,
  };
}
