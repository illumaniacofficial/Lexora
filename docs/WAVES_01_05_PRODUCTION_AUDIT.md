# Lexora Waves 01-05 — Production Audit

Audit baseline: `85399b9b9f6cfd8c214b2d600a94813b38f8e997`  
Production platform: Railway  
Production service: Lexora  
Production mode: private studio, connected runtime

## Result

Waves 01-05 are present in the production branch and the live Railway deployment is built from the same commit as the audited branch baseline.

The audit distinguishes three categories:

- **Implemented/live** — functionality promised for Waves 01-05 and present in production code.
- **Scaffolded by design** — contracts intentionally introduced in early waves for later activation.
- **Deferred by the original wave contracts** — future product work and not a missing Waves 01-05 deliverable.

## Wave 01 — Foundation

Implemented/live:
- provider-neutral configuration and standard OpenAI environment names
- production session-secret enforcement
- private-studio and commerce feature flags
- Stripe/storefront startup hibernation
- Director/runtime/artifact/property/continuity contracts
- additive Revival schema
- Property/IP and multi-value classification model
- Boardroom and Studio Review contracts for later activation

Historical note: `WAVE_01_REPORT.md` describes the state at the time that branch was still isolated. Later waves completed and deployed the operational pieces it listed as next work.

## Wave 02 — Operational Core

Implemented/live:
- additive Property/IP persistence around legacy projects
- Artifact Vault persistence and atomic artifact versioning
- Scribe project-aware context
- Scribe response artifacts
- chapter drafting with project/canon/continuity context
- approved-chapter continuity postflight and canonical continuity snapshots
- invalidation/archive path after edits and rewrites
- Ollama local runtime adapter
- Concept Lab backend and UI foundation

## Wave 03 — Concept Intelligence

Implemented/live:
- Triad WHO / WHAT / HOW
- Pure Chaos
- Intelligent Draw
- Forbidden Combination
- context weighting
- Oracle analysis/fallback behavior
- structured Concept Directions
- Oracle / Scribe / Redactor / Core contribution ledger
- Concept Dossier lineage and greenlight flow
- deterministic Wave 03 regression gate

## Wave 04 — Production Runtime & Reliability

Implemented/live:
- single full-stack Node production service
- persistent PostgreSQL through Railway
- background outline generation with HTTP 202
- outline schema validation
- atomic outline commit
- stale-cache prevention
- restart recovery for interrupted workflows
- safe seed behavior on non-empty production databases
- responsive project workspace tabs
- outline blueprint review / expand-all behavior
- background chapter work that survives navigation

Railway runtime evidence on the audited deployment:
- deployment status SUCCESS
- production boot on port 8080
- private-studio connected mode
- seed skipped because production already contained projects
- project reads returned 200
- Artifact Vault endpoint returned 200
- runtime-status endpoint returned 200
- restart recovery detected and repaired one interrupted chapter job without deleting saved work

## Wave 05 — Studio OS / Canon

Implemented/live:
- Canon top-level project workspace
- visible Property/IP and Book Genome context
- editable Creative Target Contract
- canonical memory / continuity visibility
- project Artifact Vault with state controls
- canonical book-architecture artifacts
- Redactor review artifacts
- owner-approved canonical manuscript artifacts
- stale canon retirement after edits/revisions
- persistent Concept Lab Idea Library
- generated-direction save
- manual quick capture
- search/tags/favorites/archive
- deterministic Wave 05 regression gate

Wave 05 additions now included in production:
- project-aware Lexora Copilot
- non-reflowing desktop Copilot overlay
- mobile floating Copilot chat bubble and popup
- Lexora Publishing Platform branding
- reviewed multi-genre project creation
- smart genre inference while completing the project brief
- explicit user review before detected genres are added
- full reviewed genre blend persisted into Property/Canon classification

## Intentionally not counted as missing

These were explicitly deferred beyond Wave 05:
- persistent Boardroom sessions/challenge/rebuttal workflow
- Studio Review sign-off records and packaging gate
- cross-property global Artifact Vault library
- Scholar evidence ledger
- Press 2.0
- Lingua 2.0 translation memory/localized canon
- full offline local database and conflict-safe synchronization
- Frame adaptation branches
- full Audio Studio / Narrator Lab / Podcast Studio

Those belong to Wave 06 and later.

## Permanent pre-Wave-06 gate

`npm run verify:revival` statically checks the essential Waves 01-05 invariants without requiring a database, API key, or AI call.

CI runs:
1. TypeScript
2. Wave 03 regression
3. Wave 05 regression
4. Waves 01-05 production integrity
5. Production build

No Wave 06 merge should be accepted if this gate fails.
