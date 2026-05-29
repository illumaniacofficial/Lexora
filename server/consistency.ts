import type { Chapter, StoryEntity } from "@shared/schema";
import { buildGraphContext } from "./graph";

const RECENT_EXCERPT_COUNT = 6;
const HEAD_CHARS = 600;
const TAIL_CHARS = 300;

export interface SeriesBible {
  summary?: string;
  characters?: string;
  world?: string;
  timeline?: string;
  notes?: string;
}

export interface ContinuityExtras {
  seriesTitle?: string;
  seriesBible?: SeriesBible | null;
  entities?: StoryEntity[];
}

function buildSeriesBibleBlock(title: string | undefined, bible: SeriesBible | null | undefined): string {
  if (!bible) return "";
  const lines = [
    bible.summary && `Overview: ${bible.summary}`,
    bible.characters && `Recurring characters: ${bible.characters}`,
    bible.world && `World & setting: ${bible.world}`,
    bible.timeline && `Series timeline: ${bible.timeline}`,
    bible.notes && `Continuity notes: ${bible.notes}`,
  ].filter(Boolean);
  if (lines.length === 0) return "";
  return `SERIES BIBLE${title ? ` — "${title}"` : ""}
This book is part of a series. Stay 100% consistent with the shared series canon below across all books:
${lines.join("\n")}`;
}

function buildChapterBibleBlock(
  chapters: Chapter[],
  currentChapterNumber: number | null,
): string {
  const prior = chapters
    .filter(
      (c) =>
        c.status === "complete" &&
        !!c.content &&
        (currentChapterNumber == null || c.chapterNumber < currentChapterNumber),
    )
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (prior.length === 0) return "";

  const recentIds = new Set(prior.slice(-RECENT_EXCERPT_COUNT).map((c) => c.id));

  const lines = prior.map((c) => {
    const base = `Chapter ${c.chapterNumber} — "${c.title}"${c.blueprint ? `\n  Plan: ${c.blueprint.trim()}` : ""}`;
    if (recentIds.has(c.id) && c.content) {
      const text = c.content.trim().replace(/\s+/g, " ");
      const head = text.slice(0, HEAD_CHARS);
      const tail = text.length > HEAD_CHARS + TAIL_CHARS ? ` […] ${text.slice(-TAIL_CHARS)}` : "";
      return `${base}\n  Excerpt: ${head}${tail}`;
    }
    return base;
  });

  return `STORY BIBLE — PREVIOUSLY WRITTEN CHAPTERS
You MUST stay 100% consistent with what has already been written below. Do not contradict or reinvent character names, personalities, facts, terminology, settings, timeline, or the established voice and tone. Honor callbacks and continue naturally from where the story/argument left off.

${lines.join("\n\n")}

END OF STORY BIBLE. Continue with perfect continuity.`;
}

export function buildConsistencyContext(
  chapters: Chapter[],
  currentChapterNumber: number | null,
  extras?: ContinuityExtras,
): string {
  const blocks = [
    buildSeriesBibleBlock(extras?.seriesTitle, extras?.seriesBible),
    extras?.entities && extras.entities.length > 0 ? buildGraphContext(extras.entities) : "",
    buildChapterBibleBlock(chapters, currentChapterNumber),
  ].filter(Boolean);

  return blocks.join("\n\n---\n\n");
}
