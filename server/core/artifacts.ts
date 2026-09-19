import crypto from "crypto";
import type { DirectorId } from "./directors";

export const ARTIFACT_STATES = [
  "generated",
  "reviewing",
  "accepted",
  "canonical",
  "superseded",
  "rejected",
  "archived",
  "published",
] as const;

export type ArtifactState = (typeof ARTIFACT_STATES)[number];

export interface ArtifactContextManifest {
  bookGenomeVersion?: string;
  ipBibleVersion?: string;
  outlineVersion?: string;
  chapterIds?: number[];
  sourceArtifactIds?: string[];
  researchSourceIds?: string[];
  decisionIds?: string[];
  notes?: string[];
}

export interface CreativeArtifact<TContent = unknown> {
  id: string;
  type: string;
  version: number;
  parentArtifactId?: string | null;
  propertyId?: string | null;
  projectId?: number | null;
  chapterId?: number | null;
  createdBy: DirectorId | "user" | "system";
  runtimeId?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  context: ArtifactContextManifest;
  content: TContent;
  contentHash: string;
  estimatedCostUsd?: number | null;
  state: ArtifactState;
  createdAt: string;
}

export function hashArtifactContent(content: unknown): string {
  return crypto
    .createHash("sha256")
    .update(typeof content === "string" ? content : JSON.stringify(content))
    .digest("hex");
}

export function isRecoverableArtifactState(state: ArtifactState): boolean {
  // Even rejected/superseded artifacts remain recoverable. Archive is not deletion.
  return ARTIFACT_STATES.includes(state);
}
