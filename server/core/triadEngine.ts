import crypto from "crypto";
import type { ConceptContext, TriadCard, TriadDraw, TriadMode, TriadAxis } from "./concepts";

const WHO: TriadCard[] = [
  { id: "who-businessman", axis: "who", label: "Businessman", text: "A very serious businessman", tags: ["adult", "business", "city", "status"], source: "curated" },
  { id: "who-retired-astronomer", axis: "who", label: "Retired Astronomer", text: "A retired astronomer who no longer looks at the sky", tags: ["elder", "science", "grief", "mystery"], source: "curated" },
  { id: "who-teen-mortician", axis: "who", label: "Teen Mortician", text: "A teenager raised in the family funeral home", tags: ["teen", "death", "coming-of-age", "dark"], source: "curated" },
  { id: "who-fashion-archivist", axis: "who", label: "Fashion Archivist", text: "A luxury fashion archivist who remembers every garment", tags: ["fashion", "culture", "memory", "adult"], source: "curated" },
  { id: "who-baby-dragon", axis: "who", label: "Baby Dragon", text: "A nervous baby dragon", tags: ["children", "fantasy", "gentle", "school"], source: "curated" },
  { id: "who-lost-sock", axis: "who", label: "Lost Sock", text: "A sock that has lost its pair", tags: ["children", "object", "family", "funny"], source: "curated" },
  { id: "who-former-hacker", axis: "who", label: "Former Hacker", text: "An elderly former hacker trying to live quietly", tags: ["technology", "elder", "thriller", "secret"], source: "curated" },
  { id: "who-costume-designer", axis: "who", label: "Forgotten Costume Designer", text: "A forgotten Hollywood costume designer", tags: ["biography", "fashion", "film", "history"], source: "curated" },
  { id: "who-single-dad-chef", axis: "who", label: "Single Dad", text: "A single father learning to cook from scratch", tags: ["food", "family", "adult", "practical"], source: "curated" },
  { id: "who-underground-dj", axis: "who", label: "Underground DJ", text: "An underground DJ whose scene disappeared before anyone documented it", tags: ["music", "culture", "history", "nightlife"], source: "curated" },
  { id: "who-newly-single-40", axis: "who", label: "Starting Over at 40", text: "A newly single person over forty rebuilding daily life", tags: ["lifestyle", "adult", "self-development", "food"], source: "curated" },
  { id: "who-only-child-town", axis: "who", label: "Only Child in Town", text: "The only child born in a town for twenty-four years", tags: ["fiction", "mystery", "community", "speculative"], source: "curated" },
];

const WHAT: TriadCard[] = [
  { id: "what-halloween-scary", axis: "what", label: "Scary for Halloween", text: "Everyone thinks they are scary on Halloween", tags: ["halloween", "seasonal", "fear", "misunderstood"], source: "curated" },
  { id: "what-forgotten-recipe", axis: "what", label: "Forgotten Recipe", text: "A forgotten family recipe hides more than ingredients", tags: ["food", "family", "memory", "mystery"], source: "curated" },
  { id: "what-unfinished-movie", axis: "what", label: "Unfinished Movie", text: "An unfinished movie nobody can explain", tags: ["film", "mystery", "archive"], source: "curated" },
  { id: "what-missing-fashion-collection", axis: "what", label: "Missing Collection", text: "A missing fashion collection resurfaces piece by piece", tags: ["fashion", "mystery", "history"], source: "curated" },
  { id: "what-first-day-school", axis: "what", label: "First Day of School", text: "The first day of school feels impossible", tags: ["children", "school", "fear", "growth"], source: "curated" },
  { id: "what-grief-objects", axis: "what", label: "Inherited Objects", text: "Grief is carried through the objects someone left behind", tags: ["grief", "memory", "family", "objects"], source: "curated" },
  { id: "what-song-no-recording", axis: "what", label: "Impossible Song", text: "A song exists that nobody remembers recording", tags: ["music", "mystery", "memory"], source: "curated" },
  { id: "what-cook-for-one", axis: "what", label: "Cook for One", text: "Learn to cook well for one person without wasting food", tags: ["food", "practical", "lifestyle"], source: "curated" },
  { id: "what-nightlife-fashion", axis: "what", label: "Nightlife Changed Fashion", text: "How underground nightlife changed mainstream fashion", tags: ["music", "fashion", "culture", "history"], source: "curated" },
  { id: "what-impossible-inheritance", axis: "what", label: "Impossible Inheritance", text: "An inheritance comes with one impossible condition", tags: ["family", "mystery", "money", "fiction"], source: "curated" },
  { id: "what-town-false-memory", axis: "what", label: "Shared False Memory", text: "An entire town remembers an event that never happened", tags: ["mystery", "speculative", "community", "memory"], source: "curated" },
  { id: "what-family-different", axis: "what", label: "Families Look Different", text: "Learning that families can look different and still feel like home", tags: ["children", "family", "belonging"], source: "curated" },
];

const HOW: TriadCard[] = [
  { id: "how-picture-book", axis: "how", label: "Children's Picture Book", text: "As a warm, funny children's picture book", tags: ["children", "illustrated", "gentle", "read-aloud"], source: "curated" },
  { id: "how-psych-mystery", axis: "how", label: "Psychological Mystery", text: "As a psychological mystery where every answer creates a larger question", tags: ["mystery", "adult", "tension"], source: "curated" },
  { id: "how-oral-history", axis: "how", label: "Oral History", text: "As an oral-history style cultural nonfiction book", tags: ["history", "culture", "research", "interviews"], source: "curated" },
  { id: "how-biography-cultural", axis: "how", label: "Biography + Cultural History", text: "As biography blended with cultural history", tags: ["biography", "history", "culture", "research"], source: "curated" },
  { id: "how-workbook", axis: "how", label: "Interactive Workbook", text: "As an interactive workbook with prompts, exercises, and reflection", tags: ["practical", "self-development", "workbook"], source: "curated" },
  { id: "how-found-footage", axis: "how", label: "Found Footage", text: "Through recovered documents, transcripts, and found footage", tags: ["experimental", "mystery", "film"], source: "curated" },
  { id: "how-told-backward", axis: "how", label: "Told Backward", text: "Told backward so causes are discovered after consequences", tags: ["experimental", "fiction", "structure"], source: "curated" },
  { id: "how-20-minute-system", axis: "how", label: "20-Minute System", text: "As a practical twenty-minute system with repeatable routines", tags: ["practical", "food", "business", "self-development"], source: "curated" },
  { id: "how-dark-comedy", axis: "how", label: "Dark Comedy", text: "As a dark comedy that stays emotionally sincere", tags: ["comedy", "adult", "dark"], source: "curated" },
  { id: "how-documentary", axis: "how", label: "Documentary Lens", text: "As evidence-led documentary narrative nonfiction", tags: ["documentary", "research", "history"], source: "curated" },
  { id: "how-audio-first", axis: "how", label: "Audio First", text: "Designed first for the ear, with rhythm, voice, and episodic reveals", tags: ["audio", "serial", "performance"], source: "curated" },
  { id: "how-magical-realism", axis: "how", label: "Magical Realism", text: "Through gentle magical realism where the impossible is treated as ordinary", tags: ["fiction", "literary", "fantasy", "emotion"], source: "curated" },
];

const WILDCARDS = [
  "ONE LOCATION",
  "TWO TIMELINES",
  "NO HUMAN PROTAGONIST",
  "THE READER IS WRONG",
  "AUDIO-FIRST",
  "MAKE IT A SERIES",
  "UNDER 15,000 WORDS",
  "DOCUMENTARY LENS",
  "NO ROMANCE",
  "THE VILLAIN TELLS HALF THE STORY",
];

function randomItem<T>(items: T[], randomInt: RandomInt = defaultRandomInt): T {
  return items[randomInt(0, items.length)];
}

export type RandomInt = (min: number, max: number) => number;

export function defaultRandomInt(min: number, max: number): number {
  return crypto.randomInt(min, max);
}

function normalizeTag(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || null;
}

export function conceptContextToTags(context: ConceptContext = {}): string[] {
  const values = [
    context.audience,
    context.format,
    context.genre,
    context.topic,
    context.tone,
    context.purpose,
    context.ageBand,
    context.maturity,
    context.seriesIntent,
    context.marketObjective,
    context.language,
  ];
  const tags = values
    .flatMap((value) => [normalizeTag(value), ...(value || "").toLowerCase().split(/[^a-z0-9]+/)])
    .filter((tag): tag is string => Boolean(tag && tag.length > 2));
  return [...new Set(tags)];
}

export function tagScore(card: TriadCard, tags: string[]): number {
  if (tags.length === 0) return 1;
  return 1 + card.tags.filter((tag) => tags.includes(tag)).length * 3;
}

/**
 * Pure, deterministic counterpart to weightedItem: given a roll in the range
 * [0, totalWeight) it returns the card the weighted draw would select.
 * Exposed so Intelligent Draw weighting can be tested without sampling.
 */
export function weightedCardForRoll(cards: TriadCard[], tags: string[], roll: number): TriadCard {
  const weights = cards.map((card) => tagScore(card, tags));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = Math.max(0, Math.min(roll, total - 1));
  for (let i = 0; i < cards.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return cards[i];
  }
  return cards[cards.length - 1];
}

export function totalWeight(cards: TriadCard[], tags: string[]): number {
  return cards.reduce((sum, card) => sum + tagScore(card, tags), 0);
}

function weightedItem(cards: TriadCard[], tags: string[], randomInt: RandomInt = defaultRandomInt): TriadCard {
  const total = totalWeight(cards, tags);
  return weightedCardForRoll(cards, tags, randomInt(0, Math.max(1, total)));
}

export function cardAffinityOverlap(a: TriadCard, b: TriadCard): number {
  const aTags = new Set(a.tags);
  return b.tags.filter((tag) => aTags.has(tag)).length;
}

function overlap(a: TriadCard, b: TriadCard): number {
  return cardAffinityOverlap(a, b);
}

export function forbiddenHowCard(who: TriadCard, what: TriadCard): TriadCard {
  return [...HOW].sort((a, b) => {
    const scoreA = overlap(a, who) + overlap(a, what);
    const scoreB = overlap(b, who) + overlap(b, what);
    return scoreA - scoreB;
  })[0];
}

function forbiddenHow(who: TriadCard, what: TriadCard): TriadCard {
  return forbiddenHowCard(who, what);
}

export interface DrawTriadOptions {
  mode?: TriadMode;
  contextTags?: string[];
  context?: ConceptContext;
  locked?: Partial<Record<TriadAxis, TriadCard>>;
  wildcardChance?: number;
  /** Injectable integer RNG for deterministic tests. Defaults to crypto. */
  randomInt?: RandomInt;
  /** Injectable unit RNG for deterministic tests. Defaults to Math.random. */
  random?: () => number;
}

export function drawTriad(options: DrawTriadOptions = {}): TriadDraw {
  const mode = options.mode || "pure-chaos";
  const randomInt = options.randomInt || defaultRandomInt;
  const random = options.random || (() => Math.random());
  const tags = [
    ...(options.contextTags || []),
    ...conceptContextToTags(options.context),
  ];
  const locked = options.locked || {};

  const choose = (cards: TriadCard[]) =>
    mode === "intelligent-draw" ? weightedItem(cards, tags, randomInt) : randomItem(cards, randomInt);

  const who = locked.who || choose(WHO);
  const what = locked.what || choose(WHAT);
  const how = locked.how || (mode === "forbidden-combination" ? forbiddenHow(who, what) : choose(HOW));

  const chance = options.wildcardChance ?? 0.05;
  const wildcard = random() < chance ? [randomItem(WILDCARDS, randomInt)] : [];

  return {
    id: crypto.randomUUID(),
    mode,
    who,
    what,
    how,
    lockedAxes: (Object.keys(locked) as TriadAxis[]),
    wildcards: wildcard,
    createdAt: new Date().toISOString(),
    status: "drawn",
  };
}

export function getTriadDeckStats() {
  return {
    who: WHO.length,
    what: WHAT.length,
    how: HOW.length,
    wildcards: WILDCARDS.length,
  };
}
