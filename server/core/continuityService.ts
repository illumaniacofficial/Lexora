import crypto from "crypto";
import { getConfig } from "../config/env";
import { storage } from "../storage";
import { openai, FAST_MODEL, OPENAI_CONFIGURED } from "../openai";
import { hashArtifactContent } from "./artifacts";
import { isOllamaAvailable, ollamaChat } from "./ollama";
import {
  emptyContinuityState,
  type CanonicalContinuityState,
  type ChapterPostflightDelta,
  type CharacterState,
  type RelationshipState,
  type TimelineEvent,
  type OpenNarrativeLoop,
  type ContinuityObject,
} from "./continuity";
import { ensurePropertyForProject } from "./propertyService";

function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Continuity extractor did not return valid JSON.");
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeDelta(raw: any): ChapterPostflightDelta & { summary: string } {
  return {
    summary: typeof raw?.summary === "string" ? raw.summary : "",
    newFacts: stringArray(raw?.newFacts),
    characterUpdates: Array.isArray(raw?.characterUpdates) ? raw.characterUpdates as CharacterState[] : [],
    relationshipUpdates: Array.isArray(raw?.relationshipUpdates) ? raw.relationshipUpdates as RelationshipState[] : [],
    timelineEvents: Array.isArray(raw?.timelineEvents) ? raw.timelineEvents as TimelineEvent[] : [],
    newOrUpdatedLoops: Array.isArray(raw?.newOrUpdatedLoops) ? raw.newOrUpdatedLoops as OpenNarrativeLoop[] : [],
    continuityObjects: Array.isArray(raw?.continuityObjects) ? raw.continuityObjects as ContinuityObject[] : [],
    secretsRevealed: stringArray(raw?.secretsRevealed),
    foreshadowing: stringArray(raw?.foreshadowing),
    readerPromises: stringArray(raw?.readerPromises),
    worldRuleChanges: stringArray(raw?.worldRuleChanges),
  };
}

async function extractDelta(projectId: number, chapterId: number) {
  const project = await storage.getProject(projectId);
  const chapter = await storage.getChapter(chapterId);
  if (!project || !chapter || chapter.projectId !== projectId) {
    throw new Error("Project/chapter mismatch.");
  }
  if (!chapter.content) throw new Error("Approved chapter has no content.");

  const property = await ensurePropertyForProject(projectId);
  const prompt = `Extract continuity state from this APPROVED chapter. Do not invent anything.

PROPERTY CLASSIFICATION:
${JSON.stringify(property.classification || {})}

TARGET CONTRACT:
${JSON.stringify(property.targetContract || {})}

CHAPTER:
Number: ${chapter.chapterNumber}
Title: ${chapter.title}

CONTENT:
${chapter.content}

Return ONLY one JSON object with exactly these keys:
{
  "summary": "150-300 word factual chapter summary",
  "newFacts": ["only explicit facts established by the chapter"],
  "characterUpdates": [
    {
      "characterId": "stable lowercase slug based on canonical name",
      "name": "canonical name",
      "location": null,
      "physicalState": null,
      "emotionalState": null,
      "knowledge": [],
      "secrets": [],
      "goals": [],
      "unresolvedChanges": []
    }
  ],
  "relationshipUpdates": [
    {
      "fromCharacterId": "slug",
      "toCharacterId": "slug",
      "label": null,
      "trust": null,
      "tension": null,
      "notes": []
    }
  ],
  "timelineEvents": [
    {
      "id": "short-stable-id",
      "order": 0,
      "label": "event",
      "dateOrTime": null,
      "chapterId": ${chapter.id},
      "facts": []
    }
  ],
  "newOrUpdatedLoops": [
    {
      "id": "short-stable-id",
      "question": "open narrative question",
      "openedChapterId": ${chapter.id},
      "pressure": "low|medium|high|critical",
      "status": "open|partially-answered|closed",
      "notes": []
    }
  ],
  "continuityObjects": [
    {
      "id": "short-stable-id",
      "name": "object/clue/location/rule/fact",
      "kind": "object|clue|location|world-rule|fact",
      "state": "current canonical state",
      "introducedChapterId": ${chapter.id},
      "notes": []
    }
  ],
  "secretsRevealed": [],
  "foreshadowing": [],
  "readerPromises": [],
  "worldRuleChanges": []
}

Rules:
- Empty arrays are correct when nothing applies.
- For nonfiction, characters/relationships may be empty and facts/framework progression matter more.
- For children's books, keep state simple and age-appropriate.
- For biography/history, include only claims stated in the approved text; do not upgrade an allegation into fact.
- This is canonical memory extraction, not literary critique.`;

  const config = getConfig();
  let text: string;
  let runtimeId: string;
  let model: string;

  const preferLocal = config.studio.runtimeMode === "off-grid" || config.studio.runtimeMode === "hybrid";
  if (preferLocal && await isOllamaAvailable()) {
    model = config.ollama.model;
    runtimeId = `ollama:${model}`;
    text = await ollamaChat({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "You extract canonical continuity as strict JSON." },
        { role: "user", content: prompt },
      ],
    });
  } else {
    if (config.studio.runtimeMode === "off-grid") {
      throw new Error("Cannot extract continuity in off-grid mode: Ollama is unavailable.");
    }
    if (!OPENAI_CONFIGURED) {
      if (await isOllamaAvailable()) {
        model = config.ollama.model;
        runtimeId = `ollama:${model}`;
        text = await ollamaChat({
          model,
          temperature: 0.1,
          messages: [
            { role: "system", content: "You extract canonical continuity as strict JSON." },
            { role: "user", content: prompt },
          ],
        });
      } else {
        throw new Error("No runtime is available for continuity extraction.");
      }
    } else {
      model = FAST_MODEL;
      runtimeId = `openai:${model}`;
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You extract canonical continuity as strict JSON. Return JSON only." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 5000,
      });
      text = response.choices[0]?.message?.content || "{}";
    }
  }

  return {
    chapter,
    property,
    delta: normalizeDelta(parseJsonObject(text)),
    runtimeId,
    model,
  };
}

function mergeByKey<T>(existing: T[], updates: T[], key: (item: T) => string): T[] {
  const map = new Map(existing.map((item) => [key(item), item]));
  for (const update of updates) {
    const id = key(update);
    if (!id) continue;
    const prior = map.get(id);
    map.set(id, prior ? ({ ...prior, ...update } as T) : update);
  }
  return [...map.values()];
}

function uniqueStrings(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming].filter(Boolean))];
}

export async function rebuildContinuitySnapshot(projectId: number): Promise<CanonicalContinuityState> {
  const chapters = (await storage.getChapters(projectId))
    .filter((chapter) => chapter.approvalStatus === "approved")
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  const approvedIds = new Set(chapters.map((chapter) => chapter.id));

  const artifacts = await storage.getCreativeArtifacts({ projectId });
  const chosen = new Map<number, any>();
  for (const artifact of artifacts) {
    if (
      artifact.type !== "continuity-delta" ||
      artifact.chapterId == null ||
      !approvedIds.has(artifact.chapterId) ||
      ["archived", "rejected", "superseded"].includes(artifact.state)
    ) continue;
    if (!chosen.has(artifact.chapterId)) chosen.set(artifact.chapterId, artifact);
  }

  const state = emptyContinuityState();
  state.approvedChapterIds = chapters.map((chapter) => chapter.id);

  for (const chapter of chapters) {
    const artifact = chosen.get(chapter.id);
    if (!artifact) {
      state.requiresRebuild = true;
      continue;
    }
    const payload = artifact.content as any;
    const delta = normalizeDelta(payload?.delta || payload || {});

    state.chapterSummaries.push({
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      summary: typeof payload?.summary === "string" ? payload.summary : delta.summary,
    });
    state.characters = mergeByKey(state.characters, delta.characterUpdates, (item) => item.characterId || item.name);
    state.relationships = mergeByKey(
      state.relationships,
      delta.relationshipUpdates,
      (item) => `${item.fromCharacterId}->${item.toCharacterId}`,
    );
    state.timeline = mergeByKey(state.timeline, delta.timelineEvents, (item) => item.id);
    state.openLoops = mergeByKey(state.openLoops, delta.newOrUpdatedLoops, (item) => item.id);
    state.continuityObjects = mergeByKey(state.continuityObjects, delta.continuityObjects, (item) => item.id);
    state.acceptedFacts = uniqueStrings(state.acceptedFacts, delta.newFacts);
    state.worldRules = uniqueStrings(state.worldRules, delta.worldRuleChanges);
    state.secretsRevealed = uniqueStrings(state.secretsRevealed, delta.secretsRevealed);
    state.foreshadowing = uniqueStrings(state.foreshadowing, delta.foreshadowing);
    state.readerPromises = uniqueStrings(state.readerPromises, delta.readerPromises);
    state.updatedThroughChapterId = chapter.id;
  }

  const last = chapters[chapters.length - 1];
  await storage.upsertContinuitySnapshot({
    projectId,
    version: 1,
    state,
    lastAcceptedChapterId: last?.id ?? null,
  });
  return state;
}

export async function captureContinuityForApprovedChapter(projectId: number, chapterId: number) {
  const extracted = await extractDelta(projectId, chapterId);
  const existing = await storage.getCreativeArtifacts({ projectId, chapterId });
  const version = existing.filter((artifact) => artifact.type === "continuity-delta").length + 1;
  const content = {
    chapterNumber: extracted.chapter.chapterNumber,
    title: extracted.chapter.title,
    summary: extracted.delta.summary,
    delta: extracted.delta,
  };

  const artifact = await storage.createCreativeArtifact({
    id: crypto.randomUUID(),
    propertyId: extracted.property.id,
    projectId,
    chapterId,
    type: "continuity-delta",
    version,
    parentArtifactId: null,
    createdBy: "scribe",
    runtimeId: extracted.runtimeId,
    model: extracted.model,
    promptVersion: "continuity-postflight-v1",
    context: {
      chapterIds: [chapterId],
      notes: ["Extracted only after owner approval."],
    },
    content,
    contentHash: hashArtifactContent(content),
    estimatedCostUsd: null,
    state: "accepted",
  });

  const state = await rebuildContinuitySnapshot(projectId);
  return { artifact, state };
}

export async function archiveContinuityForChapter(projectId: number, chapterId: number) {
  const artifacts = await storage.getCreativeArtifacts({ projectId, chapterId });
  for (const artifact of artifacts) {
    if (
      artifact.type === "continuity-delta" &&
      !["archived", "rejected", "superseded"].includes(artifact.state)
    ) {
      await storage.updateCreativeArtifactState(artifact.id, "archived");
    }
  }
  return rebuildContinuitySnapshot(projectId);
}
