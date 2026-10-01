# Lexora — Current Production Architecture

Status: production architecture after Revival Waves 01-05  
Runtime: Railway, private studio  
Application shape: one full-stack Node/Express service plus persistent PostgreSQL

## Runtime

Lexora builds as one Node application. Express serves:
- the React SPA
- `/api/*`
- generated/uploaded assets

The production process is:
- build: `npm run build`
- start: `npm run start`

`PORT` and all credentials/configuration are supplied by the hosting environment.

## Data

Persistent PostgreSQL remains the system of record.

Legacy publishing tables are preserved. Revival adds non-destructive structures for:
- Properties/IP
- project-to-property links
- creative artifacts and artifact streams
- continuity snapshots
- Concept Dossiers
- Triad draws
- concept synthesis runs

Production seeding is fail-safe: if projects already exist, the seed path skips instead of replacing live data.

## Creative runtime

The active creative stack includes:
- Core runtime contracts and model routing
- Oracle concept intelligence
- Scribe project-aware creation/chat
- Redactor review artifacts through Editorial Board
- Property/IP classification and Creative Target Contract
- canonical continuity snapshots
- Artifact Vault
- Concept Lab / Triad / Idea Library
- Canon workspace
- project-aware Copilot

Cloud OpenAI is currently the production runtime. Ollama support exists for hybrid/off-grid execution where a reachable local Ollama runtime is available.

## Project generation

Project creation:
1. project brief
2. reviewed multi-genre classification
3. Property/IP wrapper
4. Book Genome / outline
5. chapter generation with Scribe + continuity context
6. Redactor/editorial review
7. owner approval
8. canonical chapter artifact
9. continuity postflight

Outline and chapter generation run as server-side jobs so the user can navigate away without cancelling work.

## Production safety

- strong production session secret required
- private-studio mode enabled by default
- commerce disabled by default
- Stripe is not initialized at server boot
- project reads use no-store/no-cache semantics
- transient workflow state is repaired after restarts
- canonical artifact versions are preserved instead of overwritten

## Interfaces currently visible

- Dashboard
- Projects
- Project Detail
- Concept Lab
- Trend Intelligence
- Scribe/Chat
- Marketing
- Library
- Settings
- Canon workspace
- Lexora Copilot

Boardroom and Studio Review currently exist as typed contracts only. Their persistent workflows are Wave 06.
