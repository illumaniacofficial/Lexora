import { openai, FAST_MODEL } from "./openai";
import type { Project, Chapter, StoryEntity } from "@shared/schema";

export const ENTITY_TYPES = ["character", "location", "item", "faction", "concept"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface EntityRelationship {
  to: string;
  relation: string;
}

export interface EntityProfile {
  description: string;
  role: string;
  traits: string;
}

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  profile: EntityProfile;
  relationships: EntityRelationship[];
}

const clip = (v: any, n: number): string => String(v ?? "").slice(0, n);

function normalizeType(raw: any): EntityType {
  const t = String(raw ?? "").toLowerCase().trim();
  return (ENTITY_TYPES as readonly string[]).includes(t) ? (t as EntityType) : "concept";
}

export async function extractStoryEntities(
  project: Project,
  chapters: Chapter[],
): Promise<{ entities: ExtractedEntity[]; tokens: number }> {
  const completed = chapters
    .filter((c) => c.status === "complete" && !!c.content)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (completed.length === 0) {
    return { entities: [], tokens: 0 };
  }

  const corpus = completed
    .map((c) => `## Chapter ${c.chapterNumber}: ${c.title}\n${(c.content || "").slice(0, 2500)}`)
    .join("\n\n")
    .slice(0, 16000);

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a story bible archivist. You extract a character & world graph from a book: the people, places, items, factions, and key concepts, plus how they relate. Respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content: `Extract the character & world graph from "${project.title}" (${project.vertical}).

For each significant entity, classify its type as one of: character, location, item, faction, concept. Give a concise description, its role/importance, distinctive traits, and up to 4 relationships to other named entities.

BOOK CONTENT (condensed excerpts):
${corpus}

Return JSON exactly:
{
  "entities": [
    {
      "type": "character|location|item|faction|concept",
      "name": "<canonical name>",
      "profile": { "description": "<1-2 sentences>", "role": "<role/importance>", "traits": "<distinctive traits>" },
      "relationships": [ { "to": "<other entity name>", "relation": "<short relationship description>" } ]
    }
  ]
}
Include up to 30 of the most important entities. Use canonical names consistently.`,
      },
    ],
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const tokens = completion.usage?.total_tokens || 2000;
  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const raw: any[] = Array.isArray(parsed.entities) ? parsed.entities : [];

  const seen = new Set<string>();
  const entities: ExtractedEntity[] = [];
  for (const e of raw) {
    const name = clip(e?.name, 160).trim();
    if (!name) continue;
    const key = `${normalizeType(e?.type)}::${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rels = Array.isArray(e?.relationships) ? e.relationships : [];
    entities.push({
      type: normalizeType(e?.type),
      name,
      profile: {
        description: clip(e?.profile?.description, 600),
        role: clip(e?.profile?.role, 300),
        traits: clip(e?.profile?.traits, 400),
      },
      relationships: rels
        .slice(0, 4)
        .map((r: any) => ({ to: clip(r?.to, 160), relation: clip(r?.relation, 240) }))
        .filter((r: EntityRelationship) => r.to),
    });
    if (entities.length >= 30) break;
  }

  return { entities, tokens };
}

export function buildGraphContext(entities: StoryEntity[]): string {
  if (!entities || entities.length === 0) return "";
  const lines = entities.slice(0, 40).map((e) => {
    const p = (e.profile || {}) as Partial<EntityProfile>;
    const rels = Array.isArray(e.relationships) ? (e.relationships as EntityRelationship[]) : [];
    const relStr = rels
      .slice(0, 5)
      .map((r) => `${r.relation} ${r.to}`)
      .filter(Boolean)
      .join("; ");
    return `- [${e.type}] ${e.name}: ${p.description || ""}${p.role ? ` (role: ${p.role})` : ""}${
      relStr ? ` | relationships: ${relStr}` : ""
    }`;
  });
  return `CHARACTER & WORLD GRAPH
Keep these established entities, traits, and relationships perfectly consistent. Do not rename or contradict them:
${lines.join("\n")}`;
}
