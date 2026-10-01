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
    workspace.includes(`/api/properties/${property.id}`),
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

if (failures > 0) {
  console.error(`\nWave 05 validation failed: ${failures} invariant(s) broken.`);
  process.exit(1);
}
console.log("\nWave 05 validation passed.");
