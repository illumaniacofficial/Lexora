/**
 * Wave 05 Studio OS / Canon regression guard.
 *
 * Static deterministic checks only: no DATABASE_URL and no AI calls.
 * This protects the product wiring that turns hidden revival infrastructure
 * into an explicit Scribe -> Redactor -> Canon workflow.
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
const storage = read("server/storage.ts");
const canon = read("server/core/canonService.ts");
const routes = read("server/routes.ts");
const continuity = read("server/core/continuityService.ts");
const workspace = read("client/src/components/canon-workspace.tsx");
const project = read("client/src/pages/ProjectDetail.tsx");

console.log("Wave 05 Canon deterministic validation\n");

check(
  "canonical promotion supersedes prior canonical artifact in the same stream",
  storage.includes('eq(creativeArtifacts.state, "canonical")') &&
    storage.includes('.set({ state: "superseded" })') &&
    storage.includes('.set({ state: "canonical" })'),
);

check(
  "book architecture is persisted as a canonical artifact",
  canon.includes('type: "book-architecture"') &&
    canon.includes("captureBookArchitectureArtifact") &&
    routes.includes("captureBookArchitectureArtifact("),
);

check(
  "Redactor editorial reviews enter the Artifact Vault",
  canon.includes('type: "redactor-review"') &&
    canon.includes('createdBy: "redactor"') &&
    routes.includes("captureRedactorReviewArtifact("),
);

check(
  "owner approval creates canonical chapter manuscript",
  canon.includes('type: "chapter-manuscript"') &&
    canon.includes("captureCanonicalChapterArtifact") &&
    routes.includes("captureCanonicalChapterArtifact(projectId, chapterId)"),
);

check(
  "stale chapter canon is retired when approval is invalidated",
  canon.includes("archiveCanonicalChapterArtifacts") &&
    continuity.includes("archiveCanonicalChapterArtifacts(projectId, chapterId)"),
);

check(
  "Canon workspace exposes editable Creative Target Contract",
  workspace.includes("Creative Target Contract") &&
    workspace.includes("button-save-target-contract") &&
    workspace.includes("/api/properties/"),
);

check(
  "Canon workspace exposes Book Genome and canonical continuity memory",
  workspace.includes("Book Genome") &&
    workspace.includes("Canonical Memory") &&
    workspace.includes("openLoops"),
);

check(
  "Artifact Vault exposes canon/accept/archive/reject controls",
  workspace.includes("Artifact Vault") &&
    workspace.includes("Make Canon") &&
    workspace.includes("Accept") &&
    workspace.includes("Archive") &&
    workspace.includes("Reject"),
);

check(
  "Project Detail exposes Canon as a top-level workspace tab",
  project.includes('value="canon"') &&
    project.includes('data-testid="tab-canon"') &&
    project.includes("<CanonWorkspace"),
);

const conceptLab = read("client/src/pages/ConceptLab.tsx");
check(
  "Concept Lab exposes a persistent Idea Library",
  conceptLab.includes("Idea Library") &&
    conceptLab.includes('data-testid="button-toggle-idea-library"') &&
    routes.includes('/api/concept-lab/ideas'),
);

check(
  "generated concept directions can be saved without greenlighting",
  conceptLab.includes('button-save-direction-') &&
    routes.includes('/api/concept-lab/ideas/from-direction') &&
    routes.includes('status: "saved"'),
);

check(
  "manual ideas can be quick-captured for later",
  conceptLab.includes('data-testid="button-quick-save-idea"') &&
    routes.includes('sourceType: "manual-idea"'),
);


const newProject = read("client/src/pages/NewProject.tsx");

check(
  "new project creation supports a reviewed multi-genre blend",
  newProject.includes('name="genres"') &&
    newProject.includes('data-testid="selected-genre-blend"') &&
    newProject.includes('button-primary-genre-') &&
    newProject.includes('Choose up to 6 genres'),
);

check(
  "genre detection stays review-first instead of silently changing selections",
  newProject.includes('data-testid="genre-detection-review"') &&
    newProject.includes("Suggestions only — review them before adding anything.") &&
    newProject.includes('button-accept-detected-genres') &&
    routes.includes('/api/projects/suggest-genres'),
);

check(
  "reviewed genre blends persist into Property classification while preserving a primary vertical",
  routes.includes("requestedGenres") &&
    routes.includes("primaryGenre:") &&
    routes.includes("additionalGenres: genres") &&
    routes.includes("craftProfiles: genres"),
);


const triadEngine = read("server/core/triadEngine.ts");
const ideaDetail = read("client/src/components/concept-idea-detail.tsx");
const autopilotEngine = read("server/autopilot-engine.ts");
const settingsPage = read("client/src/pages/Settings.tsx");
const openaiGateway = read("server/openai.ts");
const sidebar = read("client/src/components/app-sidebar.tsx");

check(
  "Concept Lab keeps dossier lifecycle visible after promotion",
  routes.includes('row.status === "developing"') &&
    routes.includes('row.status === "greenlit"') &&
    ideaDetail.includes("Dossier ready for review") &&
    ideaDetail.includes("Create Project from Dossier"),
);

check(
  "dossier greenlight returns fresh persisted state and links its Property",
  routes.includes("propertyId: property.id") &&
    routes.includes("updatedDossier") &&
    routes.includes("dossier: updatedDossier"),
);

check(
  "greenlit dossiers hand off into New Project without duplicate Property creation",
  routes.includes('/api/concept-lab/dossiers/:id/handoff') &&
    routes.includes("sourceDossierId") &&
    routes.includes("sourceProperty") &&
    newProject.includes('dossier-project-handoff') &&
    newProject.includes("sourceDossierId"),
);

check(
  "saved Idea Library titles open a full detail surface",
  conceptLab.includes('button-open-idea-') &&
    conceptLab.includes("ConceptIdeaDetail") &&
    ideaDetail.includes("Generated Idea Summary") &&
    ideaDetail.includes("Studio Intelligence") &&
    ideaDetail.includes("Source Lineage"),
);

check(
  "Triad deck has been substantially expanded",
  triadEngine.includes("WHO_EXPANDED") &&
    triadEngine.includes("WHAT_EXPANDED") &&
    triadEngine.includes("HOW_EXPANDED") &&
    triadEngine.includes("WILDCARDS_EXPANDED") &&
    conceptLab.includes("WILDCARDS"),
);

check(
  "each project exposes a safe project-scoped Autopilot control",
  routes.includes('/api/projects/:id/autopilot/start') &&
    routes.includes("targetProjectId: projectId") &&
    routes.includes("requireOwnerApproval: true") &&
    autopilotEngine.includes("awaiting_approval") &&
    project.includes('data-testid="project-autopilot-control"') &&
    project.includes("Finish with Autopilot"),
);

check(
  "custom OpenAI-compatible text provider is encrypted and runtime-switchable",
  openaiGateway.includes("aes-256-gcm") &&
    openaiGateway.includes("custom_ai_provider") &&
    openaiGateway.includes("saveCustomProvider") &&
    openaiGateway.includes("dynamicChat") &&
    settingsPage.includes("Custom AI Provider") &&
    settingsPage.includes("Test Saved Connection"),
);

check(
  "Referrals and Requests remain dormant rather than deleted",
  !sidebar.includes('title: "Referrals"') &&
    !sidebar.includes('title: "Requests"') &&
    appShell.includes('path="/requests"') &&
    appShell.includes('path="/referrals"'),
);

const appShell = read("client/src/App.tsx");
const copilot = read("client/src/components/lexora-copilot.tsx");

check(
  "global Lexora Copilot is docked into the app shell",
  appShell.includes("LexoraCopilot") &&
    appShell.includes('data-testid="button-toggle-copilot"') &&
    appShell.includes("copilotOpen"),
);

check(
  "Copilot automatically links project routes to project-aware chat",
  copilot.includes("projectIdFromLocation") &&
    copilot.includes('location.match(/^\\/projects\\/(\\d+)/)') &&
    copilot.includes("projectId"),
);

check(
  "Copilot includes quick prompts for common book brief fields",
  copilot.includes("500-char Description") &&
    copilot.includes("Target Audience") &&
    copilot.includes("Tone & Style") &&
    copilot.includes("Key Themes") &&
    copilot.includes("Things to Avoid"),
);

check(
  "Copilot persists conversations through existing chat APIs",
  copilot.includes('/api/chat/conversations') &&
    copilot.includes('/messages') &&
    copilot.includes("conversations are saved"),
);

if (failures > 0) {
  console.error(`\nWave 05 validation failed: ${failures} invariant(s) broken.`);
  process.exit(1);
}
console.log("\nWave 05 validation passed.");
