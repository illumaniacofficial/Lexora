# Revival Wave 01 — Foundation Execution Contract

Goal: create the extended skeleton without breaking current book generation, export, translation, audio caching, or existing project data.

This wave is intentionally architectural. No visual redesign.

## A. Safety / preservation

- Work only on branch revival/wave-01-foundation.
- archive/replit-import-2026-09-19 is the untouched imported baseline.
- Do not merge to main in this wave.
- Existing data must remain readable.
- Avoid destructive migrations.
- Preserve shared/schema.ts compatibility until migration plan is explicit.
- No Stripe/storefront schema drops in Wave 01.

## B. First-pass code inspection

Inspect only the files needed to map and modify:
- package.json
- server/index.ts
- server/routes.ts
- server/storage.ts
- server/db.ts
- server/openai.ts
- server/autopilot-engine.ts
- server/editorial.ts
- server/market.ts
- server/analytics.ts
- server/media.ts
- shared/schema.ts
- client/src/App.tsx
- client/src/pages/NewProject.tsx
- client/src/pages/ProjectDetail.tsx
- client/src/pages/ChatStudio.tsx
- client/src/pages/Autopilot.tsx
- client/src/pages/TrendIntelligence.tsx

Do not perform a broad cosmetic repo sweep.

## C. Wave 01 deliverables

### 1. Provider-neutral environment/config layer
Create a central server config module with validation.
Support standard env names:
- DATABASE_URL
- SESSION_SECRET
- OPENAI_API_KEY
- OPENAI_BASE_URL optional
- OPENAI_FAST_MODEL
- OPENAI_HIGH_MODEL
- OPENAI_IMAGE_MODEL
- ELEVENLABS_API_KEY if present
- storage/local runtime flags as needed

Keep temporary backward compatibility with existing Replit OpenAI env names only through the config adapter, not throughout business code.

Production must not silently use a weak fallback SESSION_SECRET.

### 2. Stripe/storefront runtime hibernation
Remove Stripe startup initialization and Replit connector dependency from active runtime.
Do not drop data/tables.
Do not touch unrelated generation behavior.
Public commerce/storefront UI may be hidden/disabled for this private-studio phase.
Document what is dormant versus deleted.

### 3. Core runtime scaffold
Add server/core/ with model-neutral interfaces:
- runtime types
- Director identifiers
- model/provider capability metadata
- execution context
- task request/result
- local/cloud/hybrid mode
- future queue hooks

Do not immediately route all current AI calls through it; introduce the contract first.

### 4. Artifact contract
Add a canonical artifact type/service interface covering:
- ID/type/version/parent
- project/property reference
- context manifest
- hash
- runtime/model
- status
- created/cost metadata

Wave 01 may use current storage tables where possible. Do not force a large DB migration before a mapping is approved.

### 5. Property/IP compatibility design
Implement the minimum non-destructive representation needed so existing projects can later belong to a Property.
If a new table is required, migration must be additive.
Existing projects must behave as before.
Document compatibility behavior for old projects.

### 6. Multi-genre metadata design
Replace the assumption that one vertical is the complete identity of a book.
Keep legacy vertical for compatibility while adding a normalized/additive representation for primary genre, additional genres, topics, themes, audience, age band, format, series intent, and craft profiles.
Do not break existing APIs.

### 7. Scribe integration plan
Map Chat Studio into Scribe rather than deleting chat functionality.
For this wave:
- create Scribe service/role contract
- preserve current chat UI/runtime
- document migration path so subsequent wave can make project-context chat use Scribe
No major UI redesign yet.

### 8. Chapter continuity contract
Define typed structures for:
- chapter preflight context
- chapter postflight extraction
- character state
- relationship state
- timeline changes
- open loops
- facts/world rules
- clue/object ledger

This wave may scaffold these without yet rewriting chapter generation.

### 9. Local-first runtime contract
Introduce explicit runtime mode:
connected | hybrid | off-grid

Add interfaces for:
- local model availability
- cloud model availability
- task capability requirements
- queueable online-only tasks
- stale-data markers

Do not build full sync yet. Build the contract so later agents are not cloud-bound.

### 10. Documentation
Add/update:
- docs/REVIVAL_MASTER_SPEC.md
- docs/ARCHITECTURE_CURRENT.md
- docs/ARCHITECTURE_TARGET.md
- docs/CAPABILITY_REUSE_MAP.md
- docs/WAVE_01_REPORT.md

## D. Explicit non-goals

Do NOT in Wave 01:
- redesign the UI
- build live Oracle trend ingestion
- build The Triad UI
- build full Boardroom
- build screenplay generator
- rebuild audiobook pipeline
- rebuild translation
- drop commerce tables
- rename the product/repo
- rewrite all routes
- migrate every AI call
- change accepted book outputs
- regenerate seed data
- add unnecessary dependencies

## E. Verification

Run:
- npm ci
- npm run check
- npm run build

If database-backed tests/scripts exist, run safe non-destructive verification only.

Confirm:
- app boots with Stripe absent
- private admin auth still works
- existing project list loads
- existing project detail loads
- existing chapter content remains available
- existing translation/edition records remain readable
- existing audio paths/cache logic remain intact
- exports still compile
- no production fallback session secret
- no Replit-only requirement blocks boot except where a feature explicitly still depends on it and is documented

## F. Final report format

Return exactly:
1. BASELINE
2. FILES CHANGED
3. NEW ARCHITECTURE CONTRACTS
4. LEGACY COMPATIBILITY
5. STRIPE/STORE STATUS
6. LOCAL-FIRST STATUS
7. TESTS RUN
8. RISKS / BLOCKERS
9. WAVE 02 READY ITEMS
10. COMMIT SHA

Do not merge.
