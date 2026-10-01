/**
 * Waves 01-05 production integrity guard.
 *
 * Static deterministic checks only: no DATABASE_URL and no AI/network calls.
 * Purpose: keep the Revival foundation intact as later waves add new systems.
 */
import fs from "fs";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) console.log(`  PASS  ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const read = (path: string) => fs.readFileSync(path, "utf8");
const exists = (path: string) => fs.existsSync(path);

const env = read("server/config/env.ts");
const serverIndex = read("server/index.ts");
const routes = read("server/routes.ts");
const storage = read("server/storage.ts");
const revivalSchema = read("server/revival-schema.ts");
const runtime = read("server/core/runtime.ts");
const directors = read("server/core/directors.ts");
const artifacts = read("server/core/artifacts.ts");
const property = read("server/core/property.ts");
const propertyService = read("server/core/propertyService.ts");
const scribe = read("server/core/scribe.ts");
const continuity = read("server/core/continuity.ts");
const continuityService = read("server/core/continuityService.ts");
const ollama = read("server/core/ollama.ts");
const boardroom = read("server/core/boardroom.ts");
const studioReview = read("server/core/studioReview.ts");
const triad = read("server/core/triadEngine.ts");
const conceptLab = read("client/src/pages/ConceptLab.tsx");
const projectDetail = read("client/src/pages/ProjectDetail.tsx");
const newProject = read("client/src/pages/NewProject.tsx");
const app = read("client/src/App.tsx");
const copilot = read("client/src/components/lexora-copilot.tsx");
const canon = read("client/src/components/canon-workspace.tsx");
const queryClient = read("client/src/lib/queryClient.ts");
const seed = read("server/seed.ts");
const html = read("client/index.html");

console.log("Lexora Revival Waves 01-05 production integrity\n");

// -------------------------------------------------------------------------
// Wave 01 — Foundation
// -------------------------------------------------------------------------
console.log("Wave 01 — Foundation");

check(
  "provider-neutral config accepts standard OpenAI env names and isolates legacy bridge",
  env.includes("OPENAI_API_KEY") &&
    env.includes("OPENAI_BASE_URL") &&
    env.includes("AI_INTEGRATIONS_OPENAI_API_KEY") &&
    env.includes("usingLegacyReplitEnv"),
);

check(
  "production SESSION_SECRET requires at least 32 characters",
  env.includes("env.SESSION_SECRET.length < 32") &&
    env.includes("SESSION_SECRET must be set to a strong value of at least 32 characters"),
);

check(
  "private studio and commerce flags are centralized and commerce defaults off",
  env.includes("LEXORA_PRIVATE_STUDIO") &&
    env.includes("LEXORA_COMMERCE_ENABLED") &&
    env.includes("commerceEnabled: envBool(env.LEXORA_COMMERCE_ENABLED, false)"),
);

check(
  "Stripe is not initialized from server startup",
  !/stripe/i.test(serverIndex),
);

check(
  "commerce endpoints fail closed unless explicitly enabled",
  routes.includes("if (!config.studio.commerceEnabled)") &&
    routes.includes('return res.status(410).json({ error: "Commerce is disabled in private studio mode" })'),
);

check(
  "core runtime/director/artifact/property/continuity contracts remain present",
  ["server/core/runtime.ts","server/core/directors.ts","server/core/artifacts.ts","server/core/property.ts","server/core/continuity.ts"].every(exists) &&
    runtime.includes("AgentTaskRequest") &&
    directors.includes("DIRECTOR_IDS") &&
    artifacts.includes("CreativeArtifact") &&
    property.includes("PropertyClassification") &&
    continuity.includes("CanonicalContinuityState"),
);

check(
  "Boardroom and Studio Review contracts remain scaffolded for Wave 06",
  exists("server/core/boardroom.ts") &&
    exists("server/core/studioReview.ts") &&
    boardroom.includes("BoardroomSession") &&
    studioReview.includes("StudioReview"),
);

check(
  "Wave 01 architecture documentation remains present",
  exists("docs/ARCHITECTURE_CURRENT.md") &&
    exists("docs/ARCHITECTURE_TARGET.md") &&
    exists("docs/CAPABILITY_REUSE_MAP.md"),
);

check(
  "revival schema remains additive for Property, Artifact Vault, continuity, and concepts",
  revivalSchema.includes("CREATE TABLE IF NOT EXISTS studio_properties") &&
    revivalSchema.includes("CREATE TABLE IF NOT EXISTS property_projects") &&
    revivalSchema.includes("CREATE TABLE IF NOT EXISTS creative_artifacts") &&
    revivalSchema.includes("CREATE TABLE IF NOT EXISTS continuity_snapshots") &&
    revivalSchema.includes("CREATE TABLE IF NOT EXISTS concept_dossiers"),
);

// -------------------------------------------------------------------------
// Wave 02 — Operational Core
// -------------------------------------------------------------------------
console.log("\nWave 02 — Operational Core");

check(
  "legacy projects are wrapped non-destructively in Property/IP records",
  propertyService.includes("ensurePropertyForProject") &&
    propertyService.includes("createStudioPropertyWithProjectLink") &&
    propertyService.includes("legacyVertical"),
);

check(
  "Scribe builds project-aware context from Property, Genome, chapters, series, and continuity",
  scribe.includes("buildScribeContext") &&
    scribe.includes("BOOK GENOME / LEGACY BOOK DNA") &&
    scribe.includes("SERIES / IP BIBLE") &&
    scribe.includes("CANONICAL CONTINUITY STATE") &&
    scribe.includes("RECENT ACCEPTED TEXT"),
);

check(
  "Scribe responses are versioned into the Artifact Vault",
  scribe.includes("createCreativeArtifactWithAtomicVersion") &&
    scribe.includes('type: "scribe-chat-response"') &&
    scribe.includes('createdBy: "scribe"'),
);

check(
  "chapter drafting consumes Scribe/Property/continuity context",
  routes.includes("buildScribeContext(projectId)") &&
    routes.includes("loadContinuityExtras(project)") &&
    routes.includes("buildChapterDraftInstructions"),
);

check(
  "approved chapters create continuity deltas and rebuild canonical snapshots",
  continuityService.includes("captureContinuityForApprovedChapter") &&
    continuityService.includes('type: "continuity-delta"') &&
    continuityService.includes("rebuildContinuitySnapshot") &&
    routes.includes("captureContinuityForApprovedChapter(projectId, chapterId)"),
);

check(
  "edits/revisions retire stale continuity before rebuilding",
  continuityService.includes("archiveContinuityForChapter") &&
    routes.includes("archiveContinuityForChapter(projectId, chapterId)"),
);

check(
  "Ollama local runtime adapter remains available for hybrid/off-grid work",
  ollama.includes("isOllamaAvailable") &&
    ollama.includes("getOllamaRuntimeDescriptor") &&
    ollama.includes("ollamaChat") &&
    scribe.includes('config.studio.runtimeMode === "off-grid"'),
);

check(
  "Artifact Vault storage uses atomic version allocation",
  storage.includes("createCreativeArtifactWithAtomicVersion") &&
    storage.includes("artifactStreams"),
);

check(
  "Concept Lab backend and UI remain wired",
  routes.includes('/api/concept-lab/triad/draw') &&
    routes.includes('/api/concept-lab/triad/synthesize') &&
    conceptLab.includes('data-testid="page-concept-lab"'),
);

// -------------------------------------------------------------------------
// Wave 03 — Concept Intelligence
// -------------------------------------------------------------------------
console.log("\nWave 03 — Concept Intelligence");

check(
  "Triad supports Pure Chaos, Intelligent Draw, and Forbidden Combination",
  triad.includes('"pure-chaos"') &&
    triad.includes('"intelligent-draw"') &&
    triad.includes('"forbidden-combination"') &&
    conceptLab.includes('id: "pure-chaos"') &&
    conceptLab.includes('id: "intelligent-draw"') &&
    conceptLab.includes('id: "forbidden-combination"'),
);

check(
  "Concept synthesis records Oracle/Scribe/Redactor/Core contributions",
  routes.includes("/api/concept-lab/triad/synthesize") &&
    conceptLab.includes("oraclePosition") &&
    conceptLab.includes("scribeRationale") &&
    conceptLab.includes("redactorChallenge"),
);

check(
  "Concept Dossiers preserve lineage and explicit greenlight flow",
  routes.includes("/api/concept-lab/dossiers/from-direction") &&
    routes.includes("/greenlight") &&
    conceptLab.includes("Create Concept Dossier"),
);

check(
  "Wave 03 deterministic regression suite remains present",
  exists("scripts/verify-wave03.ts"),
);

// -------------------------------------------------------------------------
// Wave 04 — Runtime / Reliability
// -------------------------------------------------------------------------
console.log("\nWave 04 — Runtime & Reliability");

check(
  "outline generation returns immediately and continues as a server job",
  routes.includes("OutlineGenerationJob") &&
    routes.includes('res.status(202).json({ projectId: id, status: "outlining", started: true })') &&
    routes.includes("void runOutlineGenerationJob(id, job)"),
);

check(
  "outline result validates before atomic DNA/chapter commit",
  routes.includes("outlineResultSchema.parse") &&
    routes.includes("storage.commitOutline(projectId"),
);

check(
  "workflow restart recovery preserves saved data and repairs transient states",
  routes.includes("Recovered interrupted workflows after restart") &&
    routes.includes("The saved project data is safe; retry this step when ready."),
);

check(
  "project reads disable stale HTTP/browser caching",
  routes.includes('Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate') &&
    queryClient.includes('cache: "no-store"') &&
    queryClient.includes('"Cache-Control": "no-cache"'),
);

check(
  "project workspace tabs remain horizontally scrollable and outline blueprints reviewable",
  projectDetail.includes('data-testid="project-workspace-tab-scroll"') &&
    projectDetail.includes('data-testid="outline-generation-status"') &&
    projectDetail.includes('data-testid="button-toggle-all-outline-blueprints"') &&
    projectDetail.includes("Outline Blueprint"),
);

check(
  "seed boot path never overwrites a non-empty production database",
  seed.includes("skipping seed to preserve existing data") &&
    seed.includes("Database already has"),
);

// -------------------------------------------------------------------------
// Wave 05 — Studio OS / Canon + later Wave 05 additions
// -------------------------------------------------------------------------
console.log("\nWave 05 — Studio OS / Canon");

check(
  "Canon workspace is a top-level project surface",
  projectDetail.includes('value="canon"') &&
    projectDetail.includes('data-testid="tab-canon"') &&
    canon.includes("Creative Target Contract") &&
    canon.includes("Canonical Memory") &&
    canon.includes("Artifact Vault"),
);

check(
  "canonical artifacts support supersede/accept/archive/reject lifecycle",
  storage.includes('eq(creativeArtifacts.state, "canonical")') &&
    storage.includes('.set({ state: "superseded" })') &&
    canon.includes("Make Canon") &&
    canon.includes("Accept") &&
    canon.includes("Archive") &&
    canon.includes("Reject"),
);

check(
  "Idea Library saves generated and manual ideas without forced greenlight",
  conceptLab.includes("Idea Library") &&
    conceptLab.includes('data-testid="button-quick-save-idea"') &&
    conceptLab.includes('button-save-direction-') &&
    routes.includes("/api/concept-lab/ideas/from-direction") &&
    routes.includes('sourceType: "manual-idea"'),
);

check(
  "Copilot is project-aware and persists conversations",
  app.includes("LexoraCopilot") &&
    copilot.includes("projectIdFromLocation") &&
    copilot.includes("/api/chat/conversations") &&
    copilot.includes("conversations are saved"),
);

check(
  "Copilot does not reflow desktop and uses a mobile floating bubble",
  copilot.includes('data-testid="button-open-copilot-bubble"') &&
    copilot.includes("md:w-[390px]") &&
    copilot.includes("md:translate-x-full") &&
    app.includes("hidden md:inline-flex"),
);

check(
  "new project creation supports reviewed multi-genre blends with one primary",
  newProject.includes('name="genres"') &&
    newProject.includes('data-testid="genre-detection-review"') &&
    newProject.includes('data-testid="selected-genre-blend"') &&
    newProject.includes('button-primary-genre-') &&
    routes.includes("/api/projects/suggest-genres") &&
    routes.includes("additionalGenres: genres"),
);

check(
  "Lexora Publishing Platform branding no longer identifies product as AI Publishing Platform",
  html.includes("<title>Lexora — Publishing Platform</title>") &&
    !html.includes("AI Publishing Platform"),
);

check(
  "Wave 05 deterministic regression suite remains present",
  exists("scripts/verify-wave05.ts"),
);

console.log(`\n${failures === 0 ? "ALL WAVES 01-05 INTEGRITY CHECKS PASSED" : `${failures} WAVES 01-05 CHECK(S) FAILED`}`);
if (failures > 0) process.exit(1);
