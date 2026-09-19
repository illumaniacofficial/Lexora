# Wave 01 Progress Report

Status: FOUNDATION IMPLEMENTATION IN PROGRESS
Safety: main untouched; work isolated to revival/wave-01-foundation
Baseline archive: archive/replit-import-2026-09-19

## Implemented

### Preservation
- frozen archive branch created from imported baseline
- revival branch created
- draft PR opened; no merge

### Canonical architecture
- Master Product & Architecture Specification
- Wave 01 execution contract
- existing capability reuse map

### Provider/runtime foundation
- validated provider-neutral server config
- standard OpenAI env names with temporary Replit env compatibility only inside the adapter
- production SESSION_SECRET enforcement
- configurable private-studio / commerce / runtime modes
- central DATABASE_URL validation
- OpenAI client no longer directly reads Replit-specific env variables

### Private studio hardening
- Stripe webhook removed from server startup
- Stripe schema/backfill/webhook initialization removed from startup
- public storefront blocked for non-admin sessions in private-studio mode
- checkout/payment modules are lazy-loaded only if commerce is explicitly enabled
- legacy reader-access evaluation moved to a provider-neutral module
- admin bootstrap no longer creates admin/lexora2026
- first-boot admin credentials now come from ADMIN_USERNAME / ADMIN_INITIAL_PASSWORD
- response bodies removed from API logs to avoid manuscript/auth/research leakage
- active Replit Vite plugins removed from vite.config.ts

### Core skeleton
Added typed contracts for:
- permanent Directors
- local/cloud/hybrid runtime descriptors
- model-routing policy
- immutable/versioned creative artifacts
- chapter continuity preflight/postflight state
- Property/IP classification
- multi-genre/topic/audience metadata
- Creative Target Contract
- series/franchise intent
- Concept Lab dossiers
- The Triad (WHO / WHAT / HOW)
- Boardroom sessions
- Studio Review

## Intentionally NOT changed yet

- existing book/chapter database schema
- existing generation outputs
- translation pipeline
- audio caching/persistence
- EPUB/DOCX/MOBI/ZIP exporters
- chapter version records
- series records
- cover generator behavior
- Autopilot internals
- visual design
- full local database/sync implementation
- package.json/package-lock dependency removal
- historical commerce tables

Stripe/Replit packages remain installed for now so package-lock is not invalidated before local verification. Their active runtime pathways have been hibernated.

## Verification still required before merge

Run locally on the revival branch:
1. npm ci
2. npm run check
3. npm run build
4. boot with current development database
5. verify existing admin login
6. verify existing project/library/project-detail reads
7. verify chapter data
8. verify translation edition reads
9. verify audio reuse/cache paths
10. verify export generation
11. verify private storefront returns disabled response for non-admin
12. verify no Stripe/Replit initialization occurs at boot

Do not merge until these pass.

## Next implementation wave

Wave 01B/02 should connect the contracts to real product behavior:
- additive Property/IP persistence
- multi-genre metadata persistence while retaining legacy vertical
- Scribe project-context service
- chapter preflight/postflight continuity persistence
- Artifact Vault persistence
- local runtime registry / Ollama adapter
- Concept Lab backend objects
- then minimal workflow UI changes required to use them

