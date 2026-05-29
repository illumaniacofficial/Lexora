import { openai, FAST_MODEL, HIGH_MODEL } from "./openai";
import { estimateCost } from "./cost";
import type { Project, Chapter, BookDna } from "@shared/schema";

function clampScore(raw: any, min: number, max: number, fallback: number): number {
  const n = parseFloat(raw);
  if (isNaN(n)) return fallback;
  const clamped = Math.max(min, Math.min(max, n));
  return Math.round(clamped * 10) / 10;
}

function bookContextBlock(project: Project, dna: BookDna | undefined, fiction: boolean): string {
  if (dna) {
    return `Book: "${project.title}" (${fiction ? `${project.vertical} ${fiction ? "fiction" : ""}` : `${project.vertical} non-fiction`})
Core Promise: ${dna.corePromise}
Reader Avatar: ${dna.readerAvatar}
Tone Rules: ${dna.toneRules}
Framework: ${dna.frameworkSummary}
Transformation Arc: ${dna.transformationArc}`;
  }
  return `Book: "${project.title}" — a ${project.vertical} ${fiction ? "novel" : "book"}.`;
}

export interface EditorialReviewer {
  role: string;
  score: number;
  summary: string;
  suggestions: { excerpt: string; issue: string; fix: string }[];
}

export interface EditorialBoardResult {
  reviewers: EditorialReviewer[];
  overallScore: number;
}

const REVIEWER_ROLES = [
  {
    role: "Developmental Editor",
    focus: "big-picture structure, pacing, stakes, character/argument arc, scene purpose, and whether the chapter earns its place in the book.",
  },
  {
    role: "Line Editor",
    focus: "sentence-level craft: prose rhythm, word choice, clarity, redundancy, clichés, filler, and voice consistency.",
  },
  {
    role: "Continuity Editor",
    focus: "internal consistency with the rest of the book: names, facts, timeline, terminology, established tone, and unresolved threads.",
  },
  {
    role: "Fact Checker",
    focus: "plausibility and internal accuracy of claims, references, and logic stated in the chapter (flag anything that reads as unsupported or contradictory, without consulting external sources).",
  },
];

export async function runEditorialBoard(
  project: Project,
  chapter: Chapter,
  dna: BookDna | undefined,
  consistencyContext: string,
  fiction: boolean,
): Promise<{ result: EditorialBoardResult; tokens: number }> {
  const ctx = bookContextBlock(project, dna, fiction);
  const rolesSpec = REVIEWER_ROLES.map(
    (r, i) => `${i + 1}. ${r.role} — focuses on ${r.focus}`,
  ).join("\n");

  const systemPrompt = `You are an elite publishing editorial board reviewing a single chapter. You return rigorous, specific, line-referenced feedback. Respond ONLY with valid JSON.`;

  const userPrompt = `${ctx}

${consistencyContext ? `${consistencyContext}\n\n---\n\n` : ""}You are reviewing Chapter ${chapter.chapterNumber}: "${chapter.title}".

CHAPTER CONTENT:
${(chapter.content || "").slice(0, 9000)}

Provide feedback from FOUR distinct specialist roles:
${rolesSpec}

For each role, give a score from 1-10, a 1-2 sentence summary, and 2-4 concrete suggestions. Each suggestion must quote a short excerpt (a few words) from the chapter that it refers to, name the issue, and give a specific fix.

Return JSON exactly in this shape:
{
  "reviewers": [
    {
      "role": "Developmental Editor",
      "score": <1-10>,
      "summary": "<string>",
      "suggestions": [ { "excerpt": "<short quote>", "issue": "<string>", "fix": "<string>" } ]
    }
    // ...one object per role, in the same order
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: HIGH_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const tokens = completion.usage?.total_tokens || 2000;
  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const rawReviewers: any[] = Array.isArray(parsed.reviewers) ? parsed.reviewers : [];

  const reviewers: EditorialReviewer[] = REVIEWER_ROLES.map((spec) => {
    const match = rawReviewers.find(
      (r) => typeof r?.role === "string" && r.role.toLowerCase().includes(spec.role.split(" ")[0].toLowerCase()),
    ) || {};
    const suggestions = Array.isArray(match.suggestions)
      ? match.suggestions.slice(0, 6).map((s: any) => ({
          excerpt: String(s?.excerpt || "").slice(0, 240),
          issue: String(s?.issue || "").slice(0, 600),
          fix: String(s?.fix || "").slice(0, 600),
        }))
      : [];
    return {
      role: spec.role,
      score: clampScore(match.score, 1, 10, 7),
      summary: String(match.summary || "").slice(0, 600),
      suggestions,
    };
  });

  const overallScore =
    Math.round((reviewers.reduce((s, r) => s + r.score, 0) / reviewers.length) * 10) / 10;

  return { result: { reviewers, overallScore }, tokens };
}

export interface HumanizerResult {
  beforeScore: number;
  afterScore: number;
  signals: string[];
  summary: string;
  newContent: string;
}

async function scoreAiPatterns(
  text: string,
): Promise<{ score: number; signals: string[]; tokens: number }> {
  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an expert at detecting AI-generated writing patterns. Respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content: `Rate how much the following text reads as AI-generated on a 0-100 scale (0 = indistinguishable from a skilled human author, 100 = obviously machine-generated). Consider tells like formulaic transitions, over-balanced sentences, generic phrasing, repetitive cadence, hedging, and listy structure.

TEXT (first 6000 chars):
${text.slice(0, 6000)}

Return JSON: { "score": <0-100>, "signals": ["<short phrase describing a detected AI tell>", ...up to 5] }`,
      },
    ],
    max_completion_tokens: 512,
    response_format: { type: "json_object" },
  });
  const tokens = completion.usage?.total_tokens || 400;
  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const signals = Array.isArray(parsed.signals)
    ? parsed.signals.slice(0, 5).map((s: any) => String(s).slice(0, 200))
    : [];
  return { score: clampScore(parsed.score, 0, 100, 50), signals, tokens };
}

export async function humanizeChapter(
  project: Project,
  chapter: Chapter,
  dna: BookDna | undefined,
  consistencyContext: string,
  fiction: boolean,
): Promise<{ result: HumanizerResult; tokens: number; costOverride: number }> {
  const ctx = bookContextBlock(project, dna, fiction);
  const original = chapter.content || "";

  const before = await scoreAiPatterns(original);

  const systemPrompt = `You are a masterful ghostwriter who rewrites text so it reads as if written by a talented human author. You eliminate AI tells (formulaic transitions, over-balanced sentences, generic phrasing, robotic cadence) while preserving meaning, facts, and intent. Write in ${project.targetLanguage}.`;

  const userPrompt = `${ctx}

${consistencyContext ? `${consistencyContext}\n\n---\n\n` : ""}Rewrite Chapter ${chapter.chapterNumber}: "${chapter.title}" so it sounds naturally human: varied sentence rhythm, specific and vivid language, confident voice, no filler or hedging. Preserve all events, facts, characters, structure, and intent. Stay 100% consistent with the rest of the book (names, facts, timeline, terminology, tone). Keep a similar length.

CURRENT DRAFT:
${original}

Return ONLY the full rewritten chapter content, no meta-commentary.`;

  const completion = await openai.chat.completions.create({
    model: HIGH_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 8192,
  });
  const rewriteTokens = completion.usage?.total_tokens || 3000;
  const newContent = (completion.choices[0].message.content || "").trim();
  if (!newContent) {
    throw new Error("Humanizer produced no content");
  }

  const after = await scoreAiPatterns(newContent);

  const fastTokens = before.tokens + after.tokens;
  const costOverride =
    estimateCost(fastTokens, FAST_MODEL) + estimateCost(rewriteTokens, HIGH_MODEL);

  return {
    result: {
      beforeScore: before.score,
      afterScore: after.score,
      signals: before.signals,
      summary: `AI-pattern score reduced from ${before.score} to ${after.score} after rewriting.`,
      newContent,
    },
    tokens: fastTokens + rewriteTokens,
    costOverride,
  };
}

export interface BetaReader {
  persona: string;
  rating: number;
  quote: string;
  liked: string;
  critique: string;
}

export interface BetaReadersResult {
  readers: BetaReader[];
  avgRating: number;
}

const DEFAULT_PERSONAS = [
  "A devoted superfan of this genre who reads several books a month",
  "A casual reader who picked this up on a recommendation",
  "A skeptical, hard-to-please critic who rarely gives high marks",
  "A busy reader with little patience for slow pacing",
];

export async function runBetaReaders(
  project: Project,
  chapter: Chapter,
  dna: BookDna | undefined,
  fiction: boolean,
  personas?: string[],
): Promise<{ result: BetaReadersResult; tokens: number }> {
  const ctx = bookContextBlock(project, dna, fiction);
  const usePersonas =
    Array.isArray(personas) && personas.length > 0
      ? personas.slice(0, 6).map((p) => String(p).slice(0, 200))
      : DEFAULT_PERSONAS;

  const personaSpec = usePersonas.map((p, i) => `${i + 1}. ${p}`).join("\n");

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You simulate distinct beta readers reacting honestly to a book chapter. Each reader has their own taste and voice. Respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content: `${ctx}

Simulate these beta readers reading Chapter ${chapter.chapterNumber}: "${chapter.title}":
${personaSpec}

CHAPTER CONTENT (first 8000 chars):
${(chapter.content || "").slice(0, 8000)}

For each reader, give: a rating from 1-5 (in their personality), one representative first-person quote reacting to the chapter, one thing they liked, and one critique.

Return JSON exactly:
{
  "readers": [
    { "persona": "<persona description>", "rating": <1-5>, "quote": "<first-person reaction>", "liked": "<string>", "critique": "<string>" }
    // one per persona, same order
  ]
}`,
      },
    ],
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const tokens = completion.usage?.total_tokens || 1500;
  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const rawReaders: any[] = Array.isArray(parsed.readers) ? parsed.readers : [];

  const readers: BetaReader[] = usePersonas.map((persona, i) => {
    const match = rawReaders[i] || {};
    return {
      persona,
      rating: clampScore(match.rating, 1, 5, 3),
      quote: String(match.quote || "").slice(0, 600),
      liked: String(match.liked || "").slice(0, 400),
      critique: String(match.critique || "").slice(0, 400),
    };
  });

  const avgRating =
    Math.round((readers.reduce((s, r) => s + r.rating, 0) / readers.length) * 10) / 10;

  return { result: { readers, avgRating }, tokens };
}
