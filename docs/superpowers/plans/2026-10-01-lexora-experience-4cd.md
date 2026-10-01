# Lexora Experience 4.0C–D Project Workspace + Manuscript Editor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the project detail experience into a story-first workspace and make chapter editing feel like an editorial manuscript environment without changing existing project, chapter, collaboration, narration, export, or AI behavior.

**Architecture:** Keep `ProjectDetail.tsx` as the orchestration layer because it already owns substantial project state and mutations, but extract visual-only primitives for the project hero and workspace tabs. Redesign the chapter surface in place around the existing `ChapterCard` contract so editing, version history, comments, inline AI, audio, revision, and save flows remain intact.

**Tech Stack:** React 18, TypeScript, Wouter, TanStack Query, Tailwind CSS, Radix UI, existing Lexora API contracts.

**Spec:** `docs/superpowers/specs/2026-10-01-lexora-experience-4-visual-redesign.md`

## Global Constraints
- No project/manuscript schema changes.
- Preserve all existing API endpoints and mutation behavior.
- Preserve chapter editing, inline AI, comments, versions, narration/audio, exports, Canon, continuity, marketing, business, studio, language editions, and logs.
- Do not begin LX-4.1 Settings work.
- Do not invent Characters/World/Timeline routes; only relabel or group existing working project surfaces.
- Preserve viewer/editor/owner permissions.
- Mobile layouts must remain usable at 375px.
- Reduced-motion support remains mandatory.

## Review Focus
1. Projects without a cover must still have a deliberate hero identity.
2. Extremely long project and chapter titles must not cause horizontal overflow.
3. Editing a chapter must preserve the current text and save mutation exactly.
4. Viewer role must not gain editing or generation controls through the redesign.
5. Existing project tabs and all export/read/audio actions must remain reachable.

---

### Task 1: Add ProjectHero and WorkspaceTabs primitives

**Files:**
- Create: `client/src/components/experience/project-hero.tsx`
- Create: `client/src/components/experience/workspace-tabs.tsx`
- Modify: `scripts/verify-experience40.ts`

**Interfaces:**
- `ProjectHero({ title, author, coverUrl, genre, language, status, progress, meta, actions })`
- `WorkspaceTabs({ children })` wraps horizontally scrollable Radix TabsList styling.

- [ ] Add failing static checks for both components, cover fallback, bounded title, and no legacy primary purple/cyan styling.
- [ ] Run Experience 4.0 verifier and observe failure.
- [ ] Implement both primitives with 4.0 palette and mobile-safe overflow.
- [ ] Run TypeScript + Experience 4.0 verifier.
- [ ] Commit.

### Task 2: Rebuild Project Workspace header and navigation

**Files:**
- Modify: `client/src/pages/ProjectDetail.tsx`
- Modify: `scripts/verify-experience40.ts`

**Requirements:**
- Replace the generic project summary card with `ProjectHero`.
- Show actual cover when available; editorial placeholder otherwise.
- Preserve progress, quality, chapter, cost, status, language, author, refresh, and running-state information.
- Restyle Project Autopilot as a low-chrome project control.
- Replace the neon pipeline tiles with restrained story-production actions.
- Use `WorkspaceTabs` around all current working project tabs.
- The visible project tab labels may become more editorial, but underlying tab values and content remain unchanged.

- [ ] Add failing checks for ProjectHero, WorkspaceTabs, “Project Workspace”, and removal of the old generic hero treatment.
- [ ] Verify RED.
- [ ] Implement workspace shell.
- [ ] Run full regression + build.
- [ ] Commit.

### Task 3: Transform chapter list into Manuscript Workspace

**Files:**
- Modify: `client/src/pages/ProjectDetail.tsx`
- Modify: `client/src/index.css`
- Modify: `scripts/verify-experience40.ts`

**Requirements:**
- Chapters tab becomes visually titled “Manuscript”.
- Chapter list behaves as the chapter-tree layer on narrow screens and a manuscript list on desktop.
- Completed chapter content uses editorial serif reading typography.
- Editing surface uses warm manuscript canvas styling, generous line-height, and reduced chrome.
- Existing `editContent`, `editTextareaRef`, `onSaveEdit`, inline continue/rewrite, revisions, comments, versions, editorial review, audio actions, and permissions remain unchanged.
- AI actions are reframed as story intelligence where copy can be changed safely.

- [ ] Add failing checks for “Manuscript”, `lexora-manuscript-canvas`, `Story Intelligence`, and preservation of edit/save/inline-AI hooks.
- [ ] Verify RED.
- [ ] Add manuscript CSS utility.
- [ ] Restyle `ChapterCard` and chapter tab content.
- [ ] Run full regression + build.
- [ ] Commit.

### Task 4: Project workspace responsive and consistency pass

**Files:**
- Modify only files revealed by review.

- [ ] Static scan for legacy purple/cyan in the primary Project Workspace and Manuscript surfaces.
- [ ] Review missing covers, long titles, 375px tab scrolling, chapter edit controls, viewer permissions, reader/export/audio access.
- [ ] Fix Important issues only.
- [ ] Run final TypeScript, Experience 4.0, Wave 03, Wave 05, revival integrity, and production build.
- [ ] Update draft PR #12 with 4.0C–D scope and verification.

## Definition of Done
- Project detail no longer opens on a generic dashboard card.
- Project title/cover/status feel like the identity of the workspace.
- Existing project tabs remain functional.
- Chapters visually read as a manuscript workspace.
- Editing has a warm editorial canvas while preserving all mutations.
- Story intelligence actions are visually coherent with 4.0.
- All existing regression gates and production build pass.
