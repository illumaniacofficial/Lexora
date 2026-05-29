import { openai, FAST_MODEL, HIGH_MODEL } from "./openai";
import type { Project, Chapter, BookDna } from "@shared/schema";

function clampInt(raw: any, min: number, max: number, fallback: number): number {
  const n = Math.round(parseFloat(raw));
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const VALID_FLAGS = new Set(["slow", "rushed", "balanced"]);

export interface PacingChapterPoint {
  chapterNumber: number;
  title: string;
  tension: number;
  pacing: number;
  flag: "slow" | "rushed" | "balanced";
  rationale: string;
}

export interface PacingResult {
  chapters: PacingChapterPoint[];
  summary: string;
}

function bookContext(project: Project, dna: BookDna | undefined, fiction: boolean): string {
  if (dna) {
    return `Book: "${project.title}" (${project.vertical} ${fiction ? "fiction" : "non-fiction"})
Core Promise: ${dna.corePromise}
Transformation Arc: ${dna.transformationArc}`;
  }
  return `Book: "${project.title}" — a ${project.vertical} ${fiction ? "novel" : "book"}.`;
}

export async function analyzePacing(
  project: Project,
  chapters: Chapter[],
  dna: BookDna | undefined,
  fiction: boolean,
): Promise<{ result: PacingResult; tokens: number }> {
  const ordered = [...chapters]
    .filter((c) => c.status === "complete" && c.content)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  const digest = ordered
    .map((c) => {
      const body = (c.content || "").replace(/\s+/g, " ").trim();
      const excerpt = body.length > 1100
        ? `${body.slice(0, 700)} […] ${body.slice(-300)}`
        : body;
      return `## Chapter ${c.chapterNumber}: ${c.title} (${c.wordCount} words)
${excerpt}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a story structure analyst. You evaluate the tension and pacing of each chapter across a ${fiction ? "novel" : "book"} and flag sections that drag (too slow) or feel compressed (too rushed). Respond ONLY with valid JSON.`;

  const userPrompt = `${bookContext(project, dna, fiction)}

You are analyzing the pacing and tension arc of the book chapter by chapter.

CHAPTERS:
${digest}

For EACH chapter, return:
- "chapterNumber": the chapter number
- "tension": integer 0-100 — how much dramatic ${fiction ? "tension/stakes/conflict" : "momentum/urgency/engagement"} the chapter carries
- "pacing": integer 0-100 — how fast events/ideas move (0 = crawling, 50 = steady, 100 = breakneck)
- "flag": one of "slow", "rushed", or "balanced" — "slow" if it drags relative to its place in the arc, "rushed" if it compresses too much too fast, otherwise "balanced"
- "rationale": one short sentence (max ~20 words) explaining the flag

Then give a "summary": 2-3 sentences on the overall pacing/tension shape of the book and the biggest structural risk.

Return JSON exactly in this shape:
{
  "chapters": [ { "chapterNumber": <n>, "tension": <0-100>, "pacing": <0-100>, "flag": "slow|rushed|balanced", "rationale": "<string>" } ],
  "summary": "<string>"
}`;

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const tokens = completion.usage?.total_tokens || 2000;
  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const rawPoints: any[] = Array.isArray(parsed.chapters) ? parsed.chapters : [];

  const points: PacingChapterPoint[] = ordered.map((c) => {
    const match = rawPoints.find((p) => Number(p?.chapterNumber) === c.chapterNumber) || {};
    const flagRaw = String(match.flag || "balanced").toLowerCase();
    return {
      chapterNumber: c.chapterNumber,
      title: c.title,
      tension: clampInt(match.tension, 0, 100, 50),
      pacing: clampInt(match.pacing, 0, 100, 50),
      flag: (VALID_FLAGS.has(flagRaw) ? flagRaw : "balanced") as PacingChapterPoint["flag"],
      rationale: String(match.rationale || "").slice(0, 240),
    };
  });

  const summary = String(parsed.summary || "").slice(0, 1200);
  return { result: { chapters: points, summary }, tokens };
}

export interface InlineCompletionParams {
  action: "continue" | "rewrite";
  before: string;
  selection?: string;
  after?: string;
  instruction?: string;
  context: string;
}

export async function generateInlineCompletion(
  params: InlineCompletionParams,
): Promise<{ suggestion: string; tokens: number }> {
  const { action, before, selection, after, instruction, context } = params;

  const systemPrompt = `You are a professional co-writer helping an author draft a chapter inline. ${context}

Match the surrounding prose: voice, tense, point of view, tone, and formatting. Output ONLY the new prose text with no quotation wrapper, no labels, and no meta-commentary.`;

  let userPrompt: string;
  if (action === "rewrite") {
    userPrompt = `Rewrite ONLY the SELECTED passage below. Keep it roughly the same length unless the instruction says otherwise, and make sure it flows naturally with the text before and after it.

TEXT BEFORE SELECTION:
...${before.slice(-1500)}

SELECTED PASSAGE TO REWRITE:
${selection || ""}

TEXT AFTER SELECTION:
${(after || "").slice(0, 800)}...

${instruction ? `INSTRUCTION: ${instruction}\n\n` : ""}Return ONLY the rewritten version of the selected passage.`;
  } else {
    userPrompt = `Continue the chapter from exactly where the text below stops. Write the next 1-3 paragraphs that naturally follow, advancing the scene without repeating what is already written.

TEXT SO FAR:
...${before.slice(-2500)}

${after && after.trim() ? `TEXT THAT COMES LATER (do not overwrite it, lead into it):\n${after.slice(0, 600)}...\n\n` : ""}${instruction ? `INSTRUCTION: ${instruction}\n\n` : ""}Return ONLY the new continuation text.`;
  }

  const completion = await openai.chat.completions.create({
    model: HIGH_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 1200,
  });

  const tokens = completion.usage?.total_tokens || 600;
  const suggestion = (completion.choices[0].message.content || "").trim();
  return { suggestion, tokens };
}
