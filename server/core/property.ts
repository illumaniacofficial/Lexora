export const PROPERTY_TYPES = [
  "fiction",
  "nonfiction",
  "children",
  "biography",
  "memoir",
  "lifestyle",
  "culture",
  "history",
  "fashion",
  "music",
  "cookbook",
  "reference",
  "educational",
  "photography",
  "poetry",
  "essay-collection",
  "journal",
  "workbook",
  "devotional",
  "documentary-source",
  "narrative-journalism",
  "graphic-story",
  "anthology",
  "hybrid",
  "custom",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const SERIES_INTENTS = [
  "standalone",
  "standalone-with-series-potential",
  "planned-series",
  "limited-series",
  "open-ended-series",
  "anthology",
  "shared-universe",
  "serial",
  "spin-off",
  "companion-collection",
] as const;

export type SeriesIntent = (typeof SERIES_INTENTS)[number];

export interface WeightedTag {
  id: string;
  label: string;
  weight?: number;
  parentId?: string | null;
}

export interface PropertyClassification {
  format: PropertyType;
  primaryGenre?: WeightedTag | null;
  additionalGenres: WeightedTag[];
  subgenres: WeightedTag[];
  topics: WeightedTag[];
  themes: WeightedTag[];
  audiences: WeightedTag[];
  ageBands: WeightedTag[];
  tones: WeightedTag[];
  craftProfiles: WeightedTag[];
  maturityTags: WeightedTag[];
  marketPositions: WeightedTag[];
  seriesIntent: SeriesIntent;
  language: string;
}

export interface CreativeTargetContract {
  targetReader: string;
  readerAgeOrLevel?: string | null;
  desiredFeelings: string[];
  desiredKnowledgeOrTransformation: string[];
  tone: string[];
  structureExpectations: string[];
  researchStandard?: "none" | "light" | "standard" | "high" | "academic";
  maturityBoundaries: string[];
  pacingExpectations: string[];
  usabilityRequirements: string[];
  emotionalPromise?: string | null;
  desiredAftereffect: string[];
  conventionsToHonor: string[];
  conventionsToChallenge: string[];
  qualityCriteria: Array<{
    id: string;
    label: string;
    description: string;
    importance: "supporting" | "important" | "critical";
  }>;
}

export interface PropertyRecord {
  id: string;
  workingTitle: string;
  canonicalTitle?: string | null;
  classification: PropertyClassification;
  targetContract: CreativeTargetContract;
  status:
    | "idea"
    | "concept"
    | "greenlit"
    | "in-production"
    | "studio-review"
    | "packaging"
    | "published"
    | "archived";
  legacyProjectIds: number[];
  createdAt: string;
  updatedAt: string;
}
