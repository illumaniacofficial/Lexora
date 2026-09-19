/**
 * Wave 03 Concept Intelligence — pure deterministic validation.
 *
 * Runs without DATABASE_URL and without any AI call.
 *
 * Every assertion here is a deterministic invariant. No assertion depends on
 * random variation, sampling frequency, or a weighted card "appearing more
 * often" in a finite sample. Where randomness is inherent (card selection),
 * the draw is driven by an injected RNG so the outcome is fixed, and the
 * weighting/affinity logic is exercised through pure helpers instead.
 */
import {
  drawTriad,
  getTriadDeckStats,
  conceptContextToTags,
  tagScore,
  totalWeight,
  weightedCardForRoll,
  forbiddenHowCard,
  cardAffinityOverlap,
} from "../server/core/triadEngine";
import { fallbackOracleAnalysis } from "../server/core/oracleFallback";
import { normalizeConceptDirection, buildDirectorContributions } from "../server/core/conceptDirections";
import { dossierFromDirection } from "../server/core/conceptDossierMapping";
import { marketEvidenceFor } from "../server/core/conceptIntelligence";
import type { ConceptSynthesisResult, TriadCard, TriadDraw } from "../server/core/concepts";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const BUSINESSMAN: TriadCard = { id: "who-businessman", axis: "who", label: "Businessman", text: "serious businessman", tags: ["adult", "business", "city", "status"], source: "curated" };
const SCARY: TriadCard = { id: "what-halloween-scary", axis: "what", label: "Scary for Halloween", text: "scary halloween", tags: ["halloween", "seasonal", "fear", "misunderstood"], source: "curated" };
const CHILDRENS_HOW: TriadCard = { id: "how-childrens-picture-book", axis: "how", label: "Children's Picture Book", text: "as a picture book", tags: ["children", "picture-book", "gentle"], source: "curated" };

/** Deterministic RNG: always returns the lowest allowed index. */
const firstIndex = (min: number, _max: number) => min;
/** Deterministic RNG: always returns the highest allowed index. */
const lastIndex = (_min: number, max: number) => max - 1;

console.log("Wave 03 deterministic validation\n");

// --- Deck integrity -------------------------------------------------------

const deck = getTriadDeckStats();
check("deck exposes WHO/WHAT/HOW/WILDCARD counts", deck.who > 0 && deck.what > 0 && deck.how > 0 && deck.wildcards > 0, JSON.stringify(deck));

// --- Locked axes remain unchanged (a true invariant) ----------------------

const lockedDrawA = drawTriad({ mode: "pure-chaos", locked: { who: BUSINESSMAN }, randomInt: firstIndex, random: () => 1 });
const lockedDrawB = drawTriad({ mode: "pure-chaos", locked: { who: BUSINESSMAN }, randomInt: lastIndex, random: () => 1 });
check("locked WHO is preserved regardless of RNG path", lockedDrawA.who.id === BUSINESSMAN.id && lockedDrawB.who.id === BUSINESSMAN.id);
check("locked axis is recorded", lockedDrawA.lockedAxes.includes("who") && lockedDrawB.lockedAxes.includes("who"));
check("unlocked axes still resolve to real cards", Boolean(lockedDrawA.what.id && lockedDrawA.how.id));

// --- Pure Chaos does not apply context weighting -------------------------

const chaosNoContext = drawTriad({ mode: "pure-chaos", randomInt: lastIndex, random: () => 1 });
const chaosWithContext = drawTriad({ mode: "pure-chaos", context: { audience: "children", genre: "fantasy", tone: "gentle" }, randomInt: lastIndex, random: () => 1 });
check(
  "pure chaos ignores context weighting",
  chaosNoContext.who.id === chaosWithContext.who.id &&
    chaosNoContext.what.id === chaosWithContext.what.id &&
    chaosNoContext.how.id === chaosWithContext.how.id,
);

// --- Intelligent Draw derives expected context tags ----------------------

const derived = conceptContextToTags({ audience: "children", format: "picture book", tone: "gentle" });
check(
  "concept context derives normalized tags",
  ["children", "gentle", "picture-book"].every((tag) => derived.includes(tag)),
  derived.join(","),
);
check("derived tags are unique", new Set(derived).size === derived.length);
check("empty context derives no tags", conceptContextToTags({}).length === 0);
check("very short values are dropped", !conceptContextToTags({ tone: "ok" }).includes("ok"));

// --- Intelligent Draw weighting is deterministic via pure helper ---------

const whoTagged: TriadCard = { id: "who-tagged", axis: "who", label: "Tagged", text: "tagged card", tags: ["children", "gentle"], source: "curated" };
const whoUntagged: TriadCard = { id: "who-untagged", axis: "who", label: "Untagged", text: "untagged card", tags: ["adult"], source: "curated" };
const weightTags = ["children", "gentle"];

check("tag-matched card outweighs an unmatched card", tagScore(whoTagged, weightTags) > tagScore(whoUntagged, weightTags));
check("empty tag list yields uniform weight", tagScore(whoTagged, []) === tagScore(whoUntagged, []));
check(
  "total weight equals the sum of card weights",
  totalWeight([whoTagged, whoUntagged], weightTags) === tagScore(whoTagged, weightTags) + tagScore(whoUntagged, weightTags),
);
check("weighted roll at 0 selects the first card", weightedCardForRoll([whoTagged, whoUntagged], weightTags, 0).id === whoTagged.id);
check(
  "weighted roll at total-1 selects the final card",
  weightedCardForRoll([whoTagged, whoUntagged], weightTags, totalWeight([whoTagged, whoUntagged], weightTags) - 1).id === whoUntagged.id,
);

// --- Forbidden Combination selects from the low-affinity path ------------

const forbiddenHow = forbiddenHowCard(BUSINESSMAN, SCARY);
const forbiddenAffinity = cardAffinityOverlap(forbiddenHow, BUSINESSMAN) + cardAffinityOverlap(forbiddenHow, SCARY);
const alternativeHow: TriadCard[] = [
  CHILDRENS_HOW,
  { id: "how-howto", axis: "how", label: "How-To Guide", text: "as a how-to", tags: ["practical", "adult"], source: "curated" },
  { id: "how-business-memoir", axis: "how", label: "Business Memoir", text: "as a business memoir", tags: ["business", "adult", "status"], source: "curated" },
];
const bestAlternative = Math.min(
  ...alternativeHow.map((card) => cardAffinityOverlap(card, BUSINESSMAN) + cardAffinityOverlap(card, SCARY)),
);
check("forbidden HOW affinity is no worse than any alternative", forbiddenAffinity <= bestAlternative, `chosen=${forbiddenAffinity} best=${bestAlternative}`);
check("forbidden HOW is a real deck card", Boolean(forbiddenHow.id) && forbiddenHow.axis === "how");

const forbiddenDraw = drawTriad({
  mode: "forbidden-combination",
  locked: { who: BUSINESSMAN, what: SCARY },
  randomInt: firstIndex,
  random: () => 1,
});
check("forbidden draw selects the low-affinity HOW card", forbiddenDraw.how.id === forbiddenHow.id, forbiddenDraw.how.id);
check("forbidden draw honors locked WHO/WHAT", forbiddenDraw.who.id === BUSINESSMAN.id && forbiddenDraw.what.id === SCARY.id);

// --- Oracle fallback returns valid structured output ---------------------

const oracle = fallbackOracleAnalysis(
  { ...forbiddenDraw, how: CHILDRENS_HOW },
  { audience: "children ages 6-8", format: "children" },
  "off-grid",
);
const oracleFieldsOk =
  typeof oracle.targetReader === "string" &&
  typeof oracle.readerProblemOrDesire === "string" &&
  typeof oracle.emotionalPromise === "string" &&
  typeof oracle.format === "string" &&
  Array.isArray(oracle.genres) &&
  Array.isArray(oracle.topics) &&
  Array.isArray(oracle.themes) &&
  Array.isArray(oracle.risks) &&
  Array.isArray(oracle.unansweredQuestions);
check("oracle fallback returns all required structured fields", oracleFieldsOk);
check("children's + scary resolves to children's format", oracle.format === "children", oracle.format);
check("oracle does not claim guaranteed outcomes", !/guarantee|bestseller|guaranteed profit/i.test(JSON.stringify(oracle)));
check("oracle marks offline market evidence", oracle.marketEvidenceStatus === "unavailable-offline");

// --- Direction normalization returns required fields ---------------------

const direction = normalizeConceptDirection(
  { workingTitle: "The Man Who Never Smiled", oneLinePremise: "A businessman everyone thinks is scary." },
  oracle,
  { audience: "children ages 6-8" },
  0,
);
const directionFieldsOk =
  Boolean(direction.id) &&
  Boolean(direction.workingTitle) &&
  Boolean(direction.oneLinePremise) &&
  Boolean(direction.targetReader) &&
  Boolean(direction.readerPromise) &&
  Boolean(direction.classification?.format) &&
  Array.isArray(direction.tone) &&
  Boolean(direction.structuralApproach) &&
  Boolean(direction.differentiation) &&
  Boolean(direction.oraclePosition) &&
  Boolean(direction.scribeRationale) &&
  Boolean(direction.redactorChallenge);
check("direction normalization returns all required fields", directionFieldsOk);
check("direction inherits oracle market evidence status", direction.marketEvidenceStatus === "unavailable-offline");

// --- Director contribution ledger ----------------------------------------

const contributions = buildDirectorContributions(oracle, [direction], { location: "local", model: "qwen3.5:4b" });
const directors = contributions.map((c) => c.director);
check(
  "contribution ledger records Oracle/Scribe/Redactor/Core",
  ["oracle", "scribe", "redactor", "core"].every((name) => directors.includes(name as any)),
  directors.join(","),
);
check("every contribution has a role and summary", contributions.every((c) => Boolean(c.role && c.summary)));

// --- Dossier mapping preserves lineage ------------------------------------

const synthesis: ConceptSynthesisResult = {
  drawId: "draw-1",
  synthesisRunId: "run-1",
  context: { audience: "children ages 6-8", language: "english" },
  oracle,
  directions: [direction],
  contributions,
  runtime: { mode: "off-grid", location: "local", model: "qwen3.5:4b", localApiCostUsd: 0, marketEvidenceStatus: "unavailable-offline" },
};
const dossier = dossierFromDirection(synthesis, direction.id);
check("dossier preserves selected direction id", dossier.decision.selectedDirectionId === direction.id);
check("dossier preserves source synthesis lineage", dossier.decision.sourceTriadDrawId === "draw-1");
check("dossier decision carries alternatives record", Array.isArray(dossier.decision.alternativesConsidered));
check("dossier carries all four director contributions", dossier.contributions.length === 4);
check("dossier status is developing, not greenlit", dossier.status === "developing");
check("unknown direction id is rejected", (() => {
  try {
    dossierFromDirection(synthesis, "does-not-exist");
    return false;
  } catch {
    return true;
  }
})());

// --- Market evidence fail-closed behavior --------------------------------

check("off-grid evidence is unavailable-offline", marketEvidenceFor({ marketObjective: "bestseller" }, "off-grid") === "unavailable-offline");
check("off-grid evidence stays offline even with no objective", marketEvidenceFor({}, "off-grid") === "unavailable-offline");
check("hybrid evidence with user context is user-provided", marketEvidenceFor({ genre: "fantasy" }, "hybrid") === "user-provided");
check("connected evidence with no context is not-requested", marketEvidenceFor({}, "connected") === "not-requested");

console.log(`\n${failures === 0 ? "ALL WAVE 03 DETERMINISTIC CHECKS PASSED" : `${failures} WAVE 03 CHECK(S) FAILED`}`);
if (failures > 0) process.exit(1);