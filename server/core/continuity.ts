export interface CharacterState {
  characterId: string;
  name: string;
  location?: string | null;
  physicalState?: string | null;
  emotionalState?: string | null;
  knowledge: string[];
  secrets: string[];
  goals: string[];
  unresolvedChanges: string[];
}

export interface RelationshipState {
  fromCharacterId: string;
  toCharacterId: string;
  label?: string | null;
  trust?: number | null;
  tension?: number | null;
  notes: string[];
}

export interface TimelineEvent {
  id: string;
  order: number;
  label: string;
  dateOrTime?: string | null;
  chapterId?: number | null;
  facts: string[];
}

export interface OpenNarrativeLoop {
  id: string;
  question: string;
  openedChapterId?: number | null;
  pressure: "low" | "medium" | "high" | "critical";
  status: "open" | "partially-answered" | "closed";
  notes: string[];
}

export interface ContinuityObject {
  id: string;
  name: string;
  kind: "object" | "clue" | "location" | "world-rule" | "fact";
  state: string;
  introducedChapterId?: number | null;
  notes: string[];
}

export interface ChapterPreflightContext {
  projectId: number;
  chapterId?: number;
  chapterNumber: number;
  bookGenome: unknown;
  seriesBible?: unknown;
  outline: unknown;
  chapterBlueprint: unknown;
  acceptedChapterSummaries: Array<{ chapterId: number; summary: string }>;
  recentPassages: Array<{ chapterId: number; text: string }>;
  characters: CharacterState[];
  relationships: RelationshipState[];
  timeline: TimelineEvent[];
  openLoops: OpenNarrativeLoop[];
  continuityObjects: ContinuityObject[];
  editorialDirectives: string[];
  researchPacket?: unknown;
  craftProfileIds: string[];
}

export interface ChapterPostflightDelta {
  newFacts: string[];
  characterUpdates: CharacterState[];
  relationshipUpdates: RelationshipState[];
  timelineEvents: TimelineEvent[];
  newOrUpdatedLoops: OpenNarrativeLoop[];
  continuityObjects: ContinuityObject[];
  secretsRevealed: string[];
  foreshadowing: string[];
  readerPromises: string[];
  worldRuleChanges: string[];
}

export interface CanonicalContinuityState {
  approvedChapterIds: number[];
  chapterSummaries: Array<{ chapterId: number; chapterNumber: number; title: string; summary: string }>;
  characters: CharacterState[];
  relationships: RelationshipState[];
  timeline: TimelineEvent[];
  openLoops: OpenNarrativeLoop[];
  continuityObjects: ContinuityObject[];
  acceptedFacts: string[];
  worldRules: string[];
  secretsRevealed: string[];
  foreshadowing: string[];
  readerPromises: string[];
  requiresRebuild?: boolean;
  updatedThroughChapterId?: number | null;
}

export function emptyContinuityState(): CanonicalContinuityState {
  return {
    approvedChapterIds: [],
    chapterSummaries: [],
    characters: [],
    relationships: [],
    timeline: [],
    openLoops: [],
    continuityObjects: [],
    acceptedFacts: [],
    worldRules: [],
    secretsRevealed: [],
    foreshadowing: [],
    readerPromises: [],
    requiresRebuild: false,
    updatedThroughChapterId: null,
  };
}
