# Lexora Revival — Master Product & Architecture Specification

Status: Canonical foundation draft
Branch: revival/wave-01-foundation
Product mode: Private single-owner creative/publishing intelligence studio
Primary rule: Reuse and strengthen existing capabilities before replacing them.

## 1. Product thesis

Lexora is a private creative intelligence and publishing operating system. Its first native output is books, but its data model and creative memory must support future expansion into audiobooks, translations, documentaries, screenplays, feature films, prestige television, serialized drama/telenovelas, podcasts, graphic adaptations, and franchise development.

The system must adapt its craft, tone, rigor, and workflow to the target reader and format. A children's book, cookbook, celebrity biography, literary novel, cultural history, romance, thriller, fashion book, music history, business guide, documentary source book, memoir, reference work, or experimental hybrid must not be forced through the same creative rubric.

Cloud improves the team; cloud never owns the team. Meaningful writing, planning, editorial work, memory access, and Boardroom collaboration must remain available offline through local agents when internet access is unavailable or intentionally disabled.

## 2. Core product laws

1. Build from the existing repo. Do not rewrite working capabilities without a documented reason.
2. Preserve creative work. Rejected, superseded, alternate, and abandoned generations are archived/versioned rather than silently deleted.
3. Canon is explicit. Accepted project truth is distinct from drafts, branches, translations, and adaptations.
4. The target reader defines quality. Each property creates a Creative Target Contract before generation.
5. Market intelligence informs creation but does not replace creative judgment.
6. Scribe creates; Redactor independently judges. No author-agent self-approval.
7. Covers are generated late, after manuscript/theme intelligence exists.
8. Before each new chapter, Scribe refreshes from canonical state, accepted prior chapters, character state, timeline, open loops, and relevant retrieved passages.
9. Every chapter updates continuity memory after acceptance.
10. Local-first continuity is mandatory. Loss of signal must not remove the team or manuscript.
11. Expensive cloud work is explicit, cost-aware, and never auto-fired after reconnection without approval.
12. Visual redesign is deferred unless UI changes are required for workflow, state, navigation, offline status, approvals, or new capabilities.
13. Final packaging begins only after Studio Review confirms the creative work is ready.
14. No system claim such as “100% unique” or “guaranteed bestseller.” Originality, market, and adaptation assessments are evidence-based with confidence and limitations.

## 3. Permanent studio roles

### Core Mind
Owns orchestration, project state, model routing, budget, artifacts, memory, queues, sync, agent handoffs, permissions, workflow gates, and recovery.

### Oracle — Intelligence & Creative Strategy
Owns market intelligence, trends, demographics, genres/subgenres, topics, audiobook signals, seasonal/evergreen opportunities, competition, audience psychology, concept lab, market gaps, positioning, and concept dossiers. Oracle should enter with prepared opportunities rather than an empty chat prompt.

### Scribe — Creative Studio Director
Owns creative planning, Book Genome, outlines, chapter blueprints, drafting, rewrites, world/character architecture, nonfiction framework design, co-writing, and project-context chat. Existing Chat Studio is merged into Scribe.

Scribe is adaptive by craft profile: children's storyteller, investigative biographer, fashion historian, cookbook educator, commercial novelist, cultural critic, music journalist, thriller author, etc.

### Redactor — Editorial Director
Independent from Scribe. Owns developmental editing, continuity, pacing, line quality, repetition, voice drift, dialogue differentiation, AI-generic-pattern review, resonance, reader promise, chapter acceptance, and revision directives.

### Scholar — Research & Verification
Owns source library, claims, evidence quality, citation/status tracking, chronology, fact verification, disputed claims, research packs, and knowledge-heavy work.

### Frame — Adaptation & Media Director
Owns adaptation intelligence across feature film, limited series, multi-season series, telenovela/serialized drama, documentary, docuseries, podcast, audio drama, graphic adaptation, stage, and future formats. Frame stays lightweight or inactive when the property does not benefit from adaptation planning.

### Lingua — Translation & Cultural Localization
Owns multilingual edition branching, translation memory, terminology, voice preservation, cultural localization, back-checking, and edition QA.

### Press — Packaging, Publishing & Audio
Owns late-stage title/subtitle finalization, cover DNA and directions, metadata, keywords/categories, export, publication checklist, audiobook assembly/mastering, pronunciation dictionaries, and publishing packages.

### Atlas — Catalog Intelligence
Owns catalog performance, production cost, publishing outcomes, series opportunities, experiments, long-term pattern analysis, and feedback to Oracle.

## 4. Director spotlight

Core assigns project-specific weights. Not all directors dominate every project.

Examples:
- Children's picture book: Scribe + Redactor lead; Oracle/Press support; Scholar as needed.
- Celebrity biography: Scholar + Scribe + Redactor lead; Oracle/Press support.
- Cookbook: Scribe + Scholar lead; Redactor/Press support; Frame optional.
- Thriller series: Scribe + Redactor lead; Oracle + Frame strong support.
- Spanish edition: Lingua leads with Scribe/Redactor review.

## 5. Canonical property hierarchy

Property
- canonical concept
- Creative Target Contract
- IP Bible
- series/franchise intent
- genre/topic/audience graph
- Books
  - Book Genome
  - outline
  - chapters
  - editorial decisions
  - research
  - audio
  - exports
- Editions
  - language/localization memory
  - translated chapters
  - localized audio/metadata
- Adaptation branches
  - film
  - series
  - documentary
  - telenovela
  - other future media

Book canon and adaptation canon must be separate. Adaptations may compress/reorder/merge material without overwriting the literary master.

## 6. Metadata model

Replace single-genre thinking with multi-value metadata:
- format
- primary genre
- secondary genres
- subgenres
- topics
- themes
- audience
- age band
- tone
- craft profiles
- maturity profile
- market position
- series/franchise intent
- adaptation potential
- language

Genre should behave as a graph/taxonomy rather than one flat required value.

Series intent options:
- standalone
- standalone with series potential
- planned series
- limited series
- open-ended series
- anthology
- shared universe
- serial
- spin-off
- companion collection

## 7. Creative Target Contract

Every project defines what excellence means for its audience before drafting.

Possible dimensions:
- target reader
- age/reading level
- desired feelings
- desired knowledge/transformation
- tone
- structure expectations
- research standard
- maturity boundaries
- pacing
- usability
- emotional promise
- aftereffect
- genre conventions to honor or intentionally break

Redactor judges the work against this contract, not a universal “literary” standard.

## 8. Craft Profiles

Craft profiles are composable instructions/quality rubrics, not hardcoded one-off prompts.

Examples:
children's-picture-book, early-reader, middle-grade, YA, romance, thriller, horror, literary-fiction, commercial-fiction, biography, memoir, history, music, fashion, culture, cookbook, business, educational, documentary, reference, poetry, lifestyle.

A project may combine profiles with weights.

## 9. Concept Lab

Entry methods:
- Start with my idea
- Ask Oracle
- Opportunity Radar
- The Triad
- Reverse-engineer a market
- Saved concepts

### The Triad
Three-draw creative constraint engine:
1. WHO
2. WHAT
3. HOW

Modes:
- Pure Chaos
- Intelligent Draw (Oracle-weighted)
- Forbidden Combination

Rule: no discard before synthesis. Oracle/Scribe/Redactor must first attempt a serious coherent concept.

Support Lock & Draw and rare wildcard constraints.
All draws are saved as artifacts.

## 10. Originality system

Do not promise global uniqueness. Build evidence-based originality review:
- internal catalog similarity
- title similarity
- character-name collision
- trope density
- premise familiarity
- setting familiarity
- structure novelty
- market saturation

Include a Name Forge using cultural/era/phonetic/context constraints and internal-catalog collision checks.

## 11. Scribe chapter continuity loop

Before chapter N:
- Book Genome
- IP/series bible
- accepted outline
- chapter blueprint
- accepted chapter summaries
- relevant retrieved passages
- most recent full text
- character state
- relationship state
- timeline
- locations
- objects/clues
- open narrative loops
- research packet
- Redactor directives
- style/craft profile

Scribe performs a preflight:
- must continue
- must not contradict
- open loops available
- character state entering chapter

After drafting/acceptance, postflight extracts:
- new facts
- character changes
- relationship changes
- timeline movement
- locations
- clues/objects
- secrets
- open/closed questions
- foreshadowing
- reader promises
- world rules
- continuity updates

Accepted output becomes canonical input for chapter N+1.

## 12. Artifact Vault

Meaningful generations are immutable/versioned artifacts with:
- artifact ID
- type
- property/book/chapter
- version
- parent artifact
- model/runtime
- prompt version
- context manifest
- created timestamp
- cost
- content hash
- state

States:
generated, reviewing, accepted, canonical, superseded, rejected, archived, published.

“Delete” means archive by default.

## 13. Audio architecture

Keep existing reuse/caching logic and strengthen it.

Active voice roster:
- Sergio signature narrator
- approximately four curated premium voices
- local fallback voice engines where feasible

Generate in stable semantic segments, not monolithic chapters.
Cache key should include text hash, voice ID, voice settings, pronunciation dictionary version, and performance profile.
Accepted segments become canonical and are never regenerated unless the underlying segment changes.

Preserve RAW, EDITED, and MASTER assets.
Add pronunciation dictionary and mastering pipeline.

## 14. Cover workflow

Do not create final covers at initial concept time.

Flow:
concept → Book Genome → outline → manuscript → editorial → thematic extraction → Cover DNA → 3–4 directions → user approval → generation.

Cover DNA should use actual approved content, motifs, settings, emotional promise, visual objects, spoilers-to-avoid, tone, and market expectations.

## 15. Offline/local-first continuity

Operating states:
- Connected
- Hybrid
- Off-grid

Each Director has cloud and local execution profiles. Director identity is independent of a specific model.

Local-first requirements:
- local project store
- local Artifact Vault
- local canonical memory
- local model router
- offline Boardroom
- offline Scribe/Redactor/Frame work
- Scholar can use local sources but must label live verification unavailable
- Oracle can use cached market snapshots but must label them stale
- queued network-required tasks
- explicit approval before expensive queued cloud jobs run after reconnect
- conflict-safe sync preserving branches rather than overwriting work

Add deliberate Blackout Mode to disable outbound network access while keeping local creation active.

## 16. Boardroom

Structured multi-agent conference:
1. independent positions
2. challenge round
3. rebuttal/revision
4. Core synthesis
5. user decision

Persist agenda, participants, positions, disagreements, confidence, final user decision, and rationale.

Support smaller meetings such as Scribe + Redactor or Oracle + Press.

## 17. Studio Review

Mandatory before Press packaging.

Each relevant Director signs off only on its domain:
- Oracle: concept/audience promise delivered
- Scribe: creative intent fulfilled
- Redactor: editorial/reader contract fulfilled
- Scholar: factual obligations resolved
- Frame: adaptation integrity if applicable
- Lingua: edition integrity if applicable
- Core: canonical artifacts and unresolved critical issues

Only after Studio Review does packaging begin.

## 18. Existing capability reuse

Keep and rehouse existing capabilities:
- Book DNA → Book Genome
- Series → IP/series architecture
- chapter versions → Artifact Vault
- graph/entity logic → continuity/canon
- style fingerprints → Scribe voice/craft profiles
- Trend Intelligence + market reports + competitor teardown → Oracle
- pacing/editorial modules → Redactor
- translation pipeline/book editions → Lingua
- EPUB/DOCX/MOBI/ZIP → Press
- audio tracks/cache → Audio Studio
- analytics/revenue experiments → Atlas
- Chat Studio → Scribe
- Autopilot → Core production modes

## 19. Deferred / removed

Remove or hibernate:
- Stripe runtime
- stripe-replit-sync
- storefront purchasing
- reader memberships/orders
- referral commerce
- unnecessary public commerce surfaces

Do not destructively drop historical tables during the first revival wave. First remove runtime/UI dependency, preserve data, and schedule schema cleanup later.

## 20. Engineering philosophy

Build in order:
Skeleton → nervous system → memory → directors → workflows → polish.

Do not spend the first waves on decorative redesign.
Only change UI where required for workflow clarity, navigation, state, approvals, offline indicators, versioning, or new capability access.

