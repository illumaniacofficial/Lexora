export const DIRECTOR_IDS = [
  "core",
  "oracle",
  "scribe",
  "redactor",
  "scholar",
  "frame",
  "lingua",
  "press",
  "atlas",
] as const;

export type DirectorId = (typeof DIRECTOR_IDS)[number];

export type DirectorCapability =
  | "market-intelligence"
  | "concept-development"
  | "planning"
  | "drafting"
  | "editorial"
  | "continuity"
  | "research"
  | "verification"
  | "adaptation"
  | "translation"
  | "localization"
  | "publishing"
  | "audio"
  | "catalog-analysis";

export interface DirectorDefinition {
  id: DirectorId;
  displayName: string;
  mission: string;
  capabilities: DirectorCapability[];
  mayApproveOwnCreativeWork: boolean;
}

export const DIRECTORS: Record<DirectorId, DirectorDefinition> = {
  core: {
    id: "core",
    displayName: "Core Mind",
    mission: "Orchestrate state, memory, routing, cost, queues, and handoffs.",
    capabilities: [],
    mayApproveOwnCreativeWork: false,
  },
  oracle: {
    id: "oracle",
    displayName: "Oracle",
    mission: "Understand markets, audiences, opportunities, and concept positioning.",
    capabilities: ["market-intelligence", "concept-development"],
    mayApproveOwnCreativeWork: false,
  },
  scribe: {
    id: "scribe",
    displayName: "Scribe",
    mission: "Architect and create books with format-aware, audience-aware craft.",
    capabilities: ["concept-development", "planning", "drafting", "continuity"],
    mayApproveOwnCreativeWork: false,
  },
  redactor: {
    id: "redactor",
    displayName: "Redactor",
    mission: "Independently challenge, edit, and approve creative quality.",
    capabilities: ["editorial", "continuity"],
    mayApproveOwnCreativeWork: false,
  },
  scholar: {
    id: "scholar",
    displayName: "Scholar",
    mission: "Protect evidence quality, research integrity, chronology, and claims.",
    capabilities: ["research", "verification"],
    mayApproveOwnCreativeWork: false,
  },
  frame: {
    id: "frame",
    displayName: "Frame",
    mission: "Assess and develop adaptations across documentary, film, television, and other media.",
    capabilities: ["adaptation"],
    mayApproveOwnCreativeWork: false,
  },
  lingua: {
    id: "lingua",
    displayName: "Lingua",
    mission: "Translate and culturally localize while preserving voice and meaning.",
    capabilities: ["translation", "localization"],
    mayApproveOwnCreativeWork: false,
  },
  press: {
    id: "press",
    displayName: "Press",
    mission: "Package, export, narrate, and prepare approved work for publication.",
    capabilities: ["publishing", "audio"],
    mayApproveOwnCreativeWork: false,
  },
  atlas: {
    id: "atlas",
    displayName: "Atlas",
    mission: "Learn from catalog performance, cost, experiments, and long-term outcomes.",
    capabilities: ["catalog-analysis"],
    mayApproveOwnCreativeWork: false,
  },
};
