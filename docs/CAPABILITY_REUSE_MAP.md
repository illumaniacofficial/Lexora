# Existing Capability Reuse Map

Principle: preserve working Lexora capabilities and move them under the new studio architecture instead of rebuilding them.

| Existing capability | New home | Action |
|---|---|---|
| Dashboard | Core / Atlas command view | Keep, later reorganize |
| NewProject form | Concept/IP intake | Extend, do not cosmetically redesign first |
| Trend Intelligence | Oracle | Keep and expand |
| Competitor teardown | Oracle | Keep |
| KDP optimizer | Oracle + Press | Keep |
| Chat Studio | Scribe | Merge contextually |
| Book DNA | Book Genome | Expand |
| Series | Property/IP architecture | Expand |
| Style fingerprints | Scribe voice/craft profiles | Expand |
| Chapters | Scribe | Keep |
| Chapter versions | Artifact Vault | Reuse/expand |
| Story graph/entities | Canon/continuity memory | Reuse |
| Pacing analyzer | Redactor | Keep |
| Editorial services | Redactor | Keep |
| Translation/book editions | Lingua | Keep; strengthen later |
| EPUB/DOCX/MOBI/ZIP | Press | Keep |
| Cover generation/variants | Press | Keep; move late in workflow |
| Audio generation/cache | Press Audio Studio | Keep; strengthen |
| audio_tracks | Artifact/audio provenance | Keep |
| Analytics | Atlas | Keep |
| Revenue forecast | Atlas | Keep for private catalog planning |
| A/B tests | Press/Atlas | Keep |
| Autopilot | Core production modes | Refactor later |
| Notifications | Core activity feed | Keep |
| Stripe sync | Dormant | Remove from active runtime |
| Storefront commerce | Dormant | Hide/disable for private mode |
| Membership/orders/referrals | Dormant | Preserve data, no active development |

## High-value existing work already present

The repository already contains significant assets that directly support the target architecture:
- production book generation and chapter workflows
- database-backed project state
- series data
- translation editions
- per-voice audio caching and persisted audio tracking
- editorial and pacing analysis
- market and competitor analysis
- analytics and cost data
- export formats
- chapter versioning
- workspace role code
- autonomous run state/guardrails

The revival must treat these as inherited assets, not prototypes to casually replace.

## Migration rule

For each feature:
1. identify current source of truth
2. define its new studio owner
3. preserve API/data compatibility
4. introduce adapters/contracts
5. migrate behavior in a later focused wave
6. remove old pathway only after verification
