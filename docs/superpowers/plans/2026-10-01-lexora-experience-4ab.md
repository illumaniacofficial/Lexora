# Lexora Experience 4.0A–B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first visibly transformative Lexora Experience 4.0 slice by rebuilding the global shell, navigation, dashboard, and library around the approved editorial-cinematic design system.

**Architecture:** Evolve the existing LX-3.0 tokens instead of introducing a parallel theme, then add focused visual primitives that the shell, dashboard, and library share. Preserve existing data APIs and routes; this phase changes presentation and information hierarchy, not project/manuscript persistence or business logic.

**Tech Stack:** React 18, TypeScript 5.6, Wouter, TanStack Query, Tailwind CSS 3, Radix UI primitives, Lucide React, Framer Motion only where restrained motion materially improves state transitions.

**Spec:** `docs/superpowers/specs/2026-10-01-lexora-experience-4-visual-redesign.md`

## Global Constraints

- Preserve all existing project/manuscript data and API contracts.
- Preserve current auth, reader/bookmark/narration behavior, Concept Lab handoff, and AI provider work.
- Preserve Railway build/start configuration.
- Primary palette: `#0B090C`, `#131015`, `#1A151C`, `#7E3E51`, `#A55B70`, `#C0A06B`, `#EFE5D9`, `#BCAF9F`.
- Purple/cyan must no longer dominate the primary Lexora identity.
- Motion must be restrained and respect `prefers-reduced-motion`.
- Mobile must remain usable at 375px and 430px widths.
- Do not begin the LX-4.1 Settings tightening pass during this plan.
- Do not create broken navigation for routes that do not yet exist.

## Review Focus

1. **Projects with no cover art:** shell/dashboard/library must show a deliberate editorial placeholder, never broken images or empty white boxes.
2. **Very long project titles:** titles must truncate or wrap without pushing controls off-screen at 375px, 768px, and 1440px.
3. **Empty accounts:** dashboard and library must present useful creative empty states instead of blank metric grids.
4. **Large libraries:** cover grid/list switching and scrolling must remain responsive without layout overflow.
5. **Reduced-motion users:** active navigation, cards, and page transitions must remain understandable with animation effectively disabled.

---

## File Structure

### New shared visual components

- `client/src/components/experience/lexora-page-header.tsx` — reusable editorial page heading with kicker, title, description, and action slot.
- `client/src/components/experience/editorial-section.tsx` — low-chrome section boundary for headings and content groups.
- `client/src/components/experience/project-cover-card.tsx` — cover-led project card shared by dashboard/library.
- `client/src/components/experience/creative-metric.tsx` — small, secondary metric display replacing oversized neon stat cards.
- `client/src/components/experience/empty-creative-state.tsx` — consistent empty-state surface.
- `client/src/components/experience/mobile-bottom-nav.tsx` — mobile navigation for routes that already exist.

### Modified files

- `client/src/index.css` — evolve Lexora visual tokens and shared 4.0 utilities.
- `client/src/App.tsx` — global header/shell structure and mobile bottom nav.
- `client/src/components/app-sidebar.tsx` — navigation redesign and legacy neon cleanup.
- `client/src/pages/Dashboard.tsx` — creative command center.
- `client/src/pages/Library.tsx` — cover-first library and view modes.
- `scripts/verify-revival01-05.ts` — preserve production-integrity assertions while allowing the new shell copy.
- `scripts/verify-experience40.ts` — deterministic static checks for the new shell/dashboard/library contracts.
- `package.json` — add `verify:experience40` script.

---

### Task 1: Experience 4.0 visual tokens and shared primitives

**Files:**
- Modify: `client/src/index.css`
- Create: `client/src/components/experience/lexora-page-header.tsx`
- Create: `client/src/components/experience/editorial-section.tsx`
- Create: `client/src/components/experience/creative-metric.tsx`
- Create: `client/src/components/experience/empty-creative-state.tsx`
- Create: `scripts/verify-experience40.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `LexoraPageHeader`, `EditorialSection`, `CreativeMetric`, `EmptyCreativeState`.
- Produces CSS utility hooks: `.lexora-page`, `.lexora-editorial-surface`, `.lexora-kicker`, `.lexora-divider`, `.lexora-cover-placeholder`.
- Consumes: existing Tailwind/Radix/Lucide primitives.

- [ ] **Step 1: Write the failing Experience 4.0 verification checks**

Add deterministic checks in `scripts/verify-experience40.ts` asserting:
- the approved palette values exist in `client/src/index.css`
- all four shared component files exist
- each component exports its named interface
- reduced-motion rules remain present
- no shared 4.0 component introduces `purple-500` or `cyan-400` as primary styling

- [ ] **Step 2: Run the verification script and confirm it fails**

Run: `npx tsx scripts/verify-experience40.ts`

Expected: FAIL because the new shared components do not exist yet.

- [ ] **Step 3: Implement the token evolution**

Update `client/src/index.css` so the canonical visual variables use the exact approved palette and add the shared 4.0 utilities without removing existing compatibility classes that older screens still consume.

- [ ] **Step 4: Implement the four shared primitives**

Create focused, typed components:
- `LexoraPageHeader(props: { kicker?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode })`
- `EditorialSection(props: { title?: ReactNode; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string })`
- `CreativeMetric(props: { label: string; value: ReactNode; detail?: ReactNode; icon?: LucideIcon })`
- `EmptyCreativeState(props: { title: string; description: string; action?: ReactNode; icon?: LucideIcon })`

- [ ] **Step 5: Add the npm verification command**

Add `"verify:experience40": "tsx scripts/verify-experience40.ts"` to `package.json`.

- [ ] **Step 6: Run the focused checks**

Run:
- `npm run verify:experience40`
- `npm run check`

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/index.css client/src/components/experience scripts/verify-experience40.ts package.json
git commit -m "feat: establish Lexora Experience 4.0 visual primitives"
```

---

### Task 2: Rebuild the global shell and desktop navigation

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/app-sidebar.tsx`
- Modify: `scripts/verify-experience40.ts`

**Interfaces:**
- Consumes: Experience 4.0 CSS utilities from Task 1.
- Produces: global shell layout used by all authenticated routes.
- Preserves: `NarrationContext`, `LexoraCopilot`, `NotificationCenter`, route definitions, auth gating.

- [ ] **Step 1: Extend static verification for shell contracts**

Assert:
- sidebar still exposes existing routes only
- app shell includes the phrase `Stories become worlds.`
- sidebar identity uses `/icons/lexora-mark.svg`
- active state styling uses gold/burgundy tokens rather than primary purple neon classes
- narration mini-player hooks remain referenced
- Copilot remains available

- [ ] **Step 2: Run verification and confirm the new shell assertions fail**

Run: `npm run verify:experience40`

Expected: FAIL on the new shell assertions.

- [ ] **Step 3: Rebuild `AppSidebar` visual hierarchy**

Keep the existing working routes, but reorganize visible groups into:
- Create / Library-oriented primary navigation
- Intelligence / operations secondary navigation
- Settings at the bottom

Do not introduce Characters, Worlds, Research, Audiobooks, or Cinema routes until those routes actually exist.

- [ ] **Step 4: Replace legacy neon treatments**

Update:
- waveform color treatment
- active nav indicator
- hover state
- metadata typography
- sidebar background/borders

Preserve narration controls and collapsed-sidebar behavior.

- [ ] **Step 5: Refine `AdminLayout` top bar**

Keep sidebar toggle, Copilot, notifications, and versioning behavior. Change the top bar to provide calm orientation:
- Lexora
- “Stories become worlds.”
- current controls on the right

- [ ] **Step 6: Add reduced-motion-safe shell transitions**

Use CSS transitions only where needed; no new continuous animation.

- [ ] **Step 7: Run checks**

Run:
- `npm run verify:experience40`
- `npm run check`
- `npm run verify:revival`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/App.tsx client/src/components/app-sidebar.tsx scripts/verify-experience40.ts
git commit -m "feat: redesign Lexora global shell"
```

---

### Task 3: Add shared cover-led project card

**Files:**
- Create: `client/src/components/experience/project-cover-card.tsx`
- Modify: `scripts/verify-experience40.ts`

**Interfaces:**
- Produces:
  `ProjectCoverCard(props: { id: number; title: string; coverUrl?: string | null; status?: string; genre?: string; progress?: number; meta?: ReactNode; href: string; compact?: boolean })`
- Consumes: existing project cover URLs and status strings.
- Used by: Dashboard and Library tasks.

- [ ] **Step 1: Add failing verification checks**

Assert:
- `ProjectCoverCard` exists
- missing cover path uses `.lexora-cover-placeholder`
- title region has a bounded wrapping/truncation class
- component accepts `compact`

- [ ] **Step 2: Run focused verification**

Run: `npm run verify:experience40`

Expected: FAIL.

- [ ] **Step 3: Implement `ProjectCoverCard`**

Use:
- cover as visual anchor
- restrained metadata
- warm placeholder when cover missing
- hover/focus treatment with no excessive glow
- accessible link target

- [ ] **Step 4: Run checks**

Run:
- `npm run verify:experience40`
- `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/experience/project-cover-card.tsx scripts/verify-experience40.ts
git commit -m "feat: add cover-led project presentation"
```

---

### Task 4: Transform Dashboard into the creative command center

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`
- Modify: `scripts/verify-experience40.ts`

**Interfaces:**
- Consumes: `LexoraPageHeader`, `EditorialSection`, `CreativeMetric`, `ProjectCoverCard`, `EmptyCreativeState`.
- Preserves: `GET /api/dashboard`, book-request mutations, project links, unread/request behavior.
- Produces: new Dashboard 4.0 composition.

- [ ] **Step 1: Add dashboard verification checks**

Assert the dashboard source includes:
- `Continue Creating`
- `Recent Worlds`
- `Creative Pulse`
- `ProjectCoverCard`
- `EmptyCreativeState`
- no `neon-glow-cool` / `glow-text-cyan` stat configuration

- [ ] **Step 2: Run verification and confirm failure**

Run: `npm run verify:experience40`

Expected: FAIL.

- [ ] **Step 3: Replace the stat-first top layout**

Use the most recently active project as the featured “Continue Creating” hero when available.

Hero requirements:
- project title
- status
- computed completion percentage
- Continue Writing/Open Project action
- cover image if available
- editorial placeholder if not

- [ ] **Step 4: Replace recent-project cards with `ProjectCoverCard`**

Render a cover-led Recent Worlds section. Keep current project links and progress calculations.

- [ ] **Step 5: Reframe metrics as Creative Pulse**

Use `CreativeMetric` for:
- active projects
- words written
- completed projects
- current month cost only if still useful; keep it visually secondary

- [ ] **Step 6: Preserve request/alert workflows**

Do not remove current book-request read/delete actions or error/loading states; restyle them into secondary editorial sections.

- [ ] **Step 7: Add empty-account handling**

When `recentProjects.length === 0`, show `EmptyCreativeState` with a New Project action.

- [ ] **Step 8: Run full checks**

Run:
- `npm run verify:experience40`
- `npm run check`
- `npm run verify:wave03`
- `npm run verify:wave05`
- `npm run verify:revival`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/Dashboard.tsx scripts/verify-experience40.ts
git commit -m "feat: transform dashboard into creative command center"
```

---

### Task 5: Rebuild Library as a cover-first creative library

**Files:**
- Modify: `client/src/pages/Library.tsx`
- Modify: `scripts/verify-experience40.ts`

**Interfaces:**
- Consumes: `LexoraPageHeader`, `EditorialSection`, `ProjectCoverCard`, `EmptyCreativeState`.
- Preserves: existing library queries, search, sorting, filtering, reader links, export actions, completion data.
- Produces: view modes `covers | editorial | compact`.

- [ ] **Step 1: Add library verification checks**

Assert:
- a view-state union containing `covers`, `editorial`, and `compact`
- `ProjectCoverCard` usage
- `EmptyCreativeState`
- search/filter/export functionality remains referenced
- library container avoids fixed-height clipping

- [ ] **Step 2: Run verification and confirm failure**

Run: `npm run verify:experience40`

Expected: FAIL.

- [ ] **Step 3: Implement library heading and controls**

Use `LexoraPageHeader` with:
- “Your Worlds”
- search
- filter/sort
- view selector

Keep existing handlers and data sources.

- [ ] **Step 4: Implement Covers view**

Use `ProjectCoverCard` with cover-led responsive columns.

Required behavior:
- 2 columns where practical on narrow tablet
- more columns at desktop
- no horizontal overflow at 375px

- [ ] **Step 5: Implement Editorial Grid view**

Create a roomier metadata-forward layout using the same project data and actions, not a separate query or duplicated business logic.

- [ ] **Step 6: Implement Compact view**

Preserve current high-density behavior for users with large libraries.

- [ ] **Step 7: Preserve export and reader actions**

All existing PDF/print/EPUB/MOBI/DOCX/TXT actions must remain reachable.

- [ ] **Step 8: Handle empty and no-results states separately**

- empty library → create/import-oriented creative state
- filters/search produce no result → clear-filter/search guidance

- [ ] **Step 9: Run full checks**

Run:
- `npm run verify:experience40`
- `npm run check`
- `npm run verify:wave03`
- `npm run verify:wave05`
- `npm run verify:revival`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/Library.tsx scripts/verify-experience40.ts
git commit -m "feat: rebuild Lexora library around story covers"
```

---

### Task 6: Add mobile navigation for existing routes

**Files:**
- Create: `client/src/components/experience/mobile-bottom-nav.tsx`
- Modify: `client/src/App.tsx`
- Modify: `scripts/verify-experience40.ts`

**Interfaces:**
- Produces: `MobileBottomNav()`
- Consumes: current Wouter location/navigation and only existing routes.
- Preserves: desktop sidebar.

- [ ] **Step 1: Add failing mobile navigation checks**

Assert:
- mobile nav component exists
- it includes Home and Library
- it does not link to unimplemented `/worlds`, `/characters`, `/cinema`, or `/research`
- app shell renders it only below desktop breakpoint
- safe-area bottom padding is present

- [ ] **Step 2: Run verification and confirm failure**

Run: `npm run verify:experience40`

Expected: FAIL.

- [ ] **Step 3: Implement the mobile bottom nav**

Use existing routes only:
- Home → `/`
- Library → `/library`
- Create → `/projects/new`
- Projects → `/projects`
- More → opens or routes to an existing overflow destination without inventing missing pages

- [ ] **Step 4: Mount in `AdminLayout`**

Ensure the main content reserves bottom space on mobile and remains unchanged on desktop.

- [ ] **Step 5: Run checks**

Run:
- `npm run verify:experience40`
- `npm run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/experience/mobile-bottom-nav.tsx client/src/App.tsx scripts/verify-experience40.ts
git commit -m "feat: add Lexora mobile workspace navigation"
```

---

### Task 7: Final 4.0A–B regression and production build gate

**Files:**
- Modify only if a verification issue reveals an Experience 4.0A–B defect.

**Interfaces:**
- Consumes all tasks above.
- Produces a branch-ready 4.0A–B checkpoint.

- [ ] **Step 1: Run all deterministic checks**

Run:
- `npm run verify:experience40`
- `npm run verify:wave03`
- `npm run verify:wave05`
- `npm run verify:revival`
- `npm run check`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS with production client/server bundles generated.

- [ ] **Step 3: Perform responsive visual QA**

Inspect the rendered shell, dashboard, and library at:
- 375px
- 430px
- 768px
- 1024px
- 1440px

Verify:
- no horizontal overflow
- long titles remain contained
- empty-cover placeholders are intentional
- desktop sidebar and mobile bottom nav do not overlap
- dashboard hero remains readable
- library controls remain reachable

- [ ] **Step 4: Verify reduced-motion behavior**

With reduced motion enabled, confirm:
- no continuous animations
- active navigation remains visible
- hover/focus meaning is preserved without motion

- [ ] **Step 5: Commit any QA-only fixes**

```bash
git add <changed-files>
git commit -m "fix: harden Lexora Experience 4.0A-B responsive polish"
```

- [ ] **Step 6: Create the 4.0A–B checkpoint PR**

Open a PR from `lx-4.0/experience-redesign` to `revival/wave-04-emergent-runtime` summarizing:
- global shell redesign
- dashboard creative command center
- cover-first library
- responsive/mobile navigation
- verification results

Do not begin LX-4.1 Settings tightening.

---

## Follow-on Plans

After this plan is complete and verified, create separate implementation plans for:

1. **LX-4.0C–D:** Project Workspace + Manuscript Editor
2. **LX-4.0E:** Concept Lab + Worlds
3. **LX-4.0F:** Reader + Audiobook
4. **LX-4.0G–H:** Cinema + Mobile/Motion/Accessibility completion
5. **LX-4.1:** Settings tightening, only after all LX-4.0 visual waves are complete
