# Lexora Workflow Reliability Standard

Status: LOCKED for Wave 04 closeout and later waves.

## Core invariants

1. Navigation is never a cancellation signal.
2. A child failure never collapses its parent resource.
3. Reads may retry when transient; writes do not retry unless explicitly idempotent.
4. Paid/provider work is deduplicated before dispatch.
5. Long work returns quickly and exposes durable status.
6. Cancel means the result can no longer mutate canonical state.
7. Older work can never overwrite newer work.
8. Recovery never removes completed manuscript content.
9. Every failure names the failing subsystem and offers a recovery action.
10. Production changes pass TypeScript, regression, and build gates.

## Canonical lifecycle

queued -> running -> complete
                 -> failed -> retry
                 -> cancelled

Existing domain statuses may map onto this lifecycle, but child failures must not become a generic project failure.

## Failure boundaries

- Reader page: playback/generation failure stays on the page.
- Chapter: drafting/revision failure stays on the chapter.
- Edition: translation failure stays on the edition.
- Media asset: render failure stays on the asset.
- Project: only a true project-record/load failure may show a project-level fatal state.

## Long-running work

Long AI/provider work must not depend on the originating HTTP connection.

Already hardened:
- Chapter drafting: detached, deduplicated, cancellation epoch, restart recovery.
- Fish narration: regeneration/cache bypass, bounded retry, concurrent-request coalescing.
- Reader: transient refresh isolation and page-scoped narration fallback.
- Translation/media: existing background status model retained.

Next migrations:
1. Outline generation
2. Marketing generation
3. Trend analysis
4. Chapter revision/humanization/editorial/beta-reader work
5. Chapter/edition audio generation
6. Cover/cover-variant generation
7. Market/KDP/graph/pacing analysis

## Idempotency and cancellation

- GET/read queries: bounded retry allowed.
- Mutations: no automatic client retry.
- Identical paid provider requests: coalesce when safe.
- Explicit regeneration: separate fresh lane; never silently reuse a rejected take.
- Duplicate start while active: return current state instead of dispatching duplicate work.
- Cancellation invalidates the generation token immediately. If the provider cannot be interrupted, the eventual result is discarded.

## Restart recovery

On process boot:
- interrupted chapter generating state -> pending;
- transient project analysis/outlining/marketing state -> stable state inferred from durable chapter data;
- completed manuscript content is never rewritten or deleted.

A future durable job table/queue may replace in-memory epochs, but must preserve these semantics.

## UI contract

Every long operation should expose what is happening, which resource is affected, whether leaving the screen is safe, a specific failure reason, and Retry/Regenerate/Cancel where meaningful.

Avoid generic labels such as "Failed" or "Project failed" for child operations.

## Release gate

Wave 04 production changes must pass:
1. npm ci
2. npm run check
3. npm run verify:wave03
4. npm run build
5. Railway build/start health
6. targeted smoke test for the changed workflow

No destructive database commands, force pushes, blanket cleans, or unreviewed schema changes during a hardening-only release.
