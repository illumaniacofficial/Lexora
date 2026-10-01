import crypto from "crypto";
import type { BookDna, Chapter } from "@shared/schema";
import { storage } from "../storage";
import { hashArtifactContent } from "./artifacts";
import { ensurePropertyForProject } from "./propertyService";

type ArtifactIdentity = {
  projectId: number;
  chapterId?: number | null;
  type: string;
  content: unknown;
  createdBy: string;
  runtimeId?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  context?: Record<string, unknown>;
};

async function persistCanonicalArtifact(input: ArtifactIdentity) {
  const property = await ensurePropertyForProject(input.projectId);
  const hash = hashArtifactContent(input.content);
  const existing = await storage.getCreativeArtifacts({
    projectId: input.projectId,
    chapterId: input.chapterId ?? undefined,
  });
  const same = existing.find((artifact) =>
    artifact.type === input.type &&
    artifact.contentHash === hash &&
    artifact.chapterId === (input.chapterId ?? null),
  );

  if (same) {
    if (same.state !== "canonical") {
      return (await storage.updateCreativeArtifactState(same.id, "canonical")) || same;
    }
    return same;
  }

  const artifact = await storage.createCreativeArtifactWithAtomicVersion({
    id: crypto.randomUUID(),
    propertyId: property.id,
    projectId: input.projectId,
    chapterId: input.chapterId ?? null,
    type: input.type,
    parentArtifactId: existing.find((item) => item.type === input.type)?.id ?? null,
    createdBy: input.createdBy,
    runtimeId: input.runtimeId ?? null,
    model: input.model ?? null,
    promptVersion: input.promptVersion ?? null,
    context: input.context || {},
    content: input.content,
    contentHash: hash,
    estimatedCostUsd: null,
    state: "accepted",
  });

  return (await storage.updateCreativeArtifactState(artifact.id, "canonical")) || artifact;
}

export async function captureBookArchitectureArtifact(
  projectId: number,
  dna: BookDna | {
    corePromise?: string | null;
    readerAvatar?: string | null;
    toneRules?: string | null;
    transformationArc?: string | null;
    frameworkSummary?: string | null;
    bannedPhrases?: string[] | null;
    keyVocabulary?: string[] | null;
  },
  chapters: Array<Pick<Chapter, "chapterNumber" | "title" | "blueprint">>,
  runtime?: { runtimeId?: string | null; model?: string | null },
) {
  return persistCanonicalArtifact({
    projectId,
    type: "book-architecture",
    createdBy: "scribe",
    runtimeId: runtime?.runtimeId,
    model: runtime?.model,
    promptVersion: "book-architecture-v2",
    context: { chapterCount: chapters.length },
    content: {
      bookGenome: {
        corePromise: dna.corePromise ?? null,
        readerAvatar: dna.readerAvatar ?? null,
        toneRules: dna.toneRules ?? null,
        transformationArc: dna.transformationArc ?? null,
        frameworkSummary: dna.frameworkSummary ?? null,
        bannedPhrases: dna.bannedPhrases ?? [],
        keyVocabulary: dna.keyVocabulary ?? [],
      },
      outline: chapters.map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        blueprint: chapter.blueprint,
      })),
    },
  });
}

export async function captureRedactorReviewArtifact(
  projectId: number,
  chapterId: number,
  review: unknown,
  runtime?: { runtimeId?: string | null; model?: string | null },
) {
  const property = await ensurePropertyForProject(projectId);
  const contentHash = hashArtifactContent(review);
  const prior = await storage.getCreativeArtifacts({ projectId, chapterId });
  const same = prior.find((artifact) => artifact.type === "redactor-review" && artifact.contentHash === contentHash);
  if (same) return same;

  return storage.createCreativeArtifactWithAtomicVersion({
    id: crypto.randomUUID(),
    propertyId: property.id,
    projectId,
    chapterId,
    type: "redactor-review",
    parentArtifactId: prior.find((artifact) => artifact.type === "redactor-review")?.id ?? null,
    createdBy: "redactor",
    runtimeId: runtime?.runtimeId ?? null,
    model: runtime?.model ?? null,
    promptVersion: "editorial-board-v2",
    context: { chapterIds: [chapterId], notes: ["Independent editorial review before canon approval."] },
    content: review,
    contentHash,
    estimatedCostUsd: null,
    state: "reviewing",
  });
}

export async function captureCanonicalChapterArtifact(projectId: number, chapterId: number) {
  const chapter = await storage.getChapter(chapterId);
  if (!chapter || chapter.projectId !== projectId) throw new Error("Chapter not found");
  if (!chapter.content) throw new Error("Chapter has no manuscript content");

  const artifacts = await storage.getCreativeArtifacts({ projectId, chapterId });
  const latestReview = artifacts.find((artifact) => artifact.type === "redactor-review");
  const content = {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    manuscript: chapter.content,
    wordCount: chapter.wordCount,
    qualityScore: chapter.qualityScore,
  };

  return persistCanonicalArtifact({
    projectId,
    chapterId,
    type: "chapter-manuscript",
    createdBy: "scribe",
    promptVersion: "owner-canon-approval-v1",
    context: {
      chapterIds: [chapterId],
      sourceArtifactIds: latestReview ? [latestReview.id] : [],
      notes: latestReview
        ? ["Owner-approved manuscript after Redactor review."]
        : ["Owner-approved manuscript; no Redactor review artifact was available."],
    },
    content,
  });
}

export async function archiveCanonicalChapterArtifacts(projectId: number, chapterId: number) {
  const artifacts = await storage.getCreativeArtifacts({ projectId, chapterId });
  for (const artifact of artifacts) {
    if (artifact.type === "chapter-manuscript" && artifact.state === "canonical") {
      await storage.updateCreativeArtifactState(artifact.id, "archived");
    }
  }
}
