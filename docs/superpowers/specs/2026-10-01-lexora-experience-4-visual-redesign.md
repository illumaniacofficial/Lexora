# Lexora Experience 4.0 — Visual Redesign Specification

Date: 2026-10-01
Status: Approved visual direction, implementation contract
Branch: `lx-4.0/experience-redesign`

## 1. Goal

Transform Lexora from a dark AI publishing dashboard into a premium creative operating system for stories.

The redesign must make the product feel cinematic, editorial, elegant, focused, and deeply connected to books, worlds, narration, and visual storytelling.

This is not a color refresh. It is a structural visual redesign of the app shell, dashboard, library, project surfaces, editor, reader, audiobook experience, concept lab, and cinema workspace.

Settings is intentionally excluded from the final tightening pass until the primary visual redesign is complete. Existing Settings 4.0 remains usable during the redesign; a dedicated Settings tightening wave begins only after all major visual surfaces have been upgraded.

## 2. Product Identity

Primary positioning:

**Lexora — A creative operating system for stories.**

Experience statement:

**Stories become worlds.**

The interface should communicate that books are the first-class creative object while leaving visual room for:

- books
- audiobooks
- story worlds
- series
- screenplays
- documentaries
- visual development
- cinema

## 3. Visual Principles

### 3.1 Editorial before dashboard

Content, manuscript, covers, characters, and story state must feel more important than UI chrome.

### 3.2 Cinematic depth

Use directional light, shadow, restrained contrast, and layered surfaces instead of loud gradients or neon.

### 3.3 Fewer containers

Do not place every block inside a generic card. Use:

- whitespace
- typography
- dividers
- surface shifts
- image/cover anchors
- subtle elevation

Cards are reserved for actual objects such as projects, providers, assets, and concepts.

### 3.4 Warm luxury palette

Primary colors:

- Obsidian: `#0B090C`
- Deep surface: `#131015`
- Raised surface: `#1A151C`
- Burgundy: `#7E3E51`
- Rose: `#A55B70`
- Antique gold: `#C0A06B`
- Editorial ivory: `#EFE5D9`
- Muted ivory: `#BCAF9F`

Purple and cyan should no longer dominate the primary identity.

### 3.5 Typography roles

- UI: modern clean sans
- Editorial/story surfaces: elegant serif
- Metadata/system labels: restrained mono

Book titles, chapter titles, reader text, and major creative headings should feel editorial rather than technical.

## 4. Global App Shell

### 4.1 Sidebar

Rebuild navigation into a calmer creative workspace rail.

Primary nav:

- Home
- Library
- Projects
- Concept Lab
- Characters
- Worlds
- Research
- Audiobooks
- Cinema
- Portfolio
- Settings

Where a section is not yet implemented as a dedicated route, do not create broken navigation. Preserve existing routes and introduce visible navigation only when corresponding screens exist.

Visual behavior:

- thinner active indicator
- antique-gold/burgundy signal
- less pill-based selection
- subtler hover
- lower visual noise
- book/portal Lexora mark at top

### 4.2 Top bar

Top bar should support orientation and current work rather than decorative chrome.

May show:

- current workspace/project
- command palette
- search
- Copilot
- notifications

Avoid generic dashboard status decoration.

### 4.3 Main surface

Use a continuous obsidian environment with controlled raised regions.

Page backgrounds should feel related but not identical.

## 5. Dashboard 4.0

Dashboard becomes a creative command center.

Primary composition:

### Hero
- contextual greeting
- creative prompt
- current project / continue writing action

Example:
> Good evening, Sergio.
> What world are we building tonight?

### Continue Creating
Large featured project with:
- cover/background
- title
- project type
- progress
- current chapter/state
- Continue Writing
- Open Project

### Recent Worlds
Cover-driven project grid.

### Creative Pulse
Secondary metrics:
- active projects
- words written
- narration progress
- concepts waiting
- continuity alerts

Analytics should remain secondary to creation.

## 6. Library 4.0

Library becomes visually book-centric.

Views:

- Covers
- Editorial Grid
- Compact

Project/book tiles prioritize:

- cover art
- title
- type
- genre
- progress
- last edited
- narration state

Avoid equal-weight text-heavy cards.

## 7. Project Workspace 4.0

Project workspace receives a strong identity header.

Header may include:

- cover
- title
- logline/genre
- status
- progress
- quick actions

Primary project navigation:

- Overview
- Manuscript
- Characters
- World
- Timeline
- Research
- Narration
- Cinema
- Assets
- Publish

Existing route/tab contracts must remain functional.

The story should visually dominate the software controls.

## 8. Manuscript Editor 4.0

Three-column editorial structure:

`Chapter Tree | Manuscript Canvas | Story Intelligence`

### Chapter tree
- compact
- clear hierarchy
- chapter state
- lightweight progress indicators

### Manuscript canvas
- warm editorial surface
- serif typography
- generous line-height
- reduced controls
- high readability
- strong focus mode

### Story intelligence
Contextual actions:
- Scribe: Continue Scene
- Redactor: Editorial Review
- Canon: Check Continuity
- Oracle: Explore Direction
- Architect: Strengthen Structure

Avoid generic “AI” labels where named Lexora creative roles already exist.

## 9. Concept Lab 4.0

Concept Lab should feel experimental and creative.

Header:
> Concept Lab
> Where unfinished ideas become worlds.

Concept artifacts should emphasize:

- premise
- hook
- tone
- genre
- characters
- world seed
- narrative engine
- visual mood
- development state

Primary action:
**Develop Concept**

Concept cards should feel like creative dossiers rather than dashboard cards.

## 10. Reader 4.0

Reader should minimize app chrome.

Reading themes:

- Paper
- Warm
- Ink
- Midnight

Reader behavior:

- edge-to-edge focus
- controls appear contextually
- beautiful serif defaults
- strong chapter hierarchy
- bookmarks
- notes
- search
- narration/read-along

The visual design should make the text the dominant object.

## 11. Audiobook 4.0

Audiobook mode should be a complete listening surface, not just a mini-player.

Include:

- large cover
- book title
- chapter
- narrator
- progress
- playback controls
- 15s back/forward
- speed
- read-along
- queue
- sleep timer where supported

Persistent mini-player remains for cross-app continuity.

## 12. Cinema 4.0

Cinema mode should shift toward visual development while preserving Lexora identity.

Potential surfaces:

- storyboard frames
- scenes
- shots
- characters
- locations
- adaptation notes
- sequence navigation

Do not introduce placeholder functionality presented as working.

## 13. Motion System

Use restrained motion:

- 120ms micro feedback
- 180–240ms panel changes
- gentle crossfade
- subtle lift
- active navigation transition
- reader control reveal

No bouncing, excessive pulse, or decorative glow animation.

Respect `prefers-reduced-motion`.

## 14. Mobile 4.0

Mobile is not a reduced desktop.

Primary bottom navigation:

- Home
- Library
- Create
- Project
- More

Writer prioritizes manuscript and keyboard.

Reader becomes nearly full-screen.

AI/support surfaces should become sheets/drawers instead of squeezed sidebars.

Respect safe areas.

## 15. Component Strategy

Create or refine reusable primitives rather than page-specific visual hacks.

Recommended design-layer components:

- `LexoraPageHeader`
- `EditorialSection`
- `ProjectCoverCard`
- `ProjectHero`
- `CreativeMetric`
- `WorkspaceTabs`
- `EditorialSurface`
- `StoryAction`
- `EmptyCreativeState`
- `MobileBottomNav`

Keep existing behavior where possible and migrate visuals around it.

## 16. CSS / Token Strategy

Centralize visual tokens.

Suggested layers:

- identity tokens
- typography
- surfaces
- motion
- editor/reader themes
- responsive utilities

Do not introduce a second parallel theme system.

Existing LX-3.0 tokens should be evolved rather than abandoned.

## 17. Implementation Waves

### LX-4.0A — Global shell
- sidebar
- header
- global surfaces
- typography
- navigation states
- shared primitives

### LX-4.0B — Dashboard + Library
- creative command center
- continue-creating hero
- recent-worlds grid
- cover-driven library
- view modes

### LX-4.0C — Project Workspace
- project hero
- workspace navigation
- overview hierarchy
- project cards/status

### LX-4.0D — Manuscript Editor
- chapter tree
- manuscript surface
- story intelligence panel
- focus mode polish

### LX-4.0E — Concept Lab + Worlds
- concept dossier visual system
- characters/worldbuilding surfaces
- research presentation

### LX-4.0F — Reader + Audiobook
- reading themes
- reader controls
- audiobook full-screen mode
- read-along polish

### LX-4.0G — Cinema
- visual development workspace
- scenes/shots/storyboards where data exists

### LX-4.0H — Mobile + Motion + Accessibility
- bottom navigation
- mobile writer
- mobile reader
- safe areas
- motion polish
- keyboard/accessibility pass

### LX-4.1 — Settings Tightening
Only after LX-4.0A–H are complete:
- review Settings 4.0 against final design system
- tighten spacing and hierarchy
- improve provider/routing visibility
- reduce form density
- improve mobile settings
- align all settings controls with Lexora 4.0

## 18. Safety / Compatibility

- no destructive project/manuscript schema changes
- no removal of existing user data
- preserve existing routes unless intentionally migrated
- maintain current auth
- maintain reader/bookmark/narration behavior
- maintain Concept Lab and project handoff
- maintain AI provider work
- preserve Railway build/start configuration
- use feature flags only when necessary for risky large-surface replacement

## 19. Verification

Each wave must pass:

- TypeScript
- existing deterministic regression suites
- production integrity suite
- production build
- responsive smoke checks
- visual QA at 375, 430, 768, 1024, 1440 widths
- reduced-motion behavior
- no console-breaking runtime errors

For pages with major visual changes, inspect the rendered screen before calling the wave complete.

## 20. Definition of Done

The redesign is complete when:

- Lexora no longer resembles a generic AI dashboard
- the shell visibly communicates Lexora identity
- dashboard prioritizes creation
- project covers are central visual objects
- library feels book-centric
- manuscript editor feels editorial
- Concept Lab feels distinct and creative
- Reader is visually quiet and text-first
- Audiobook mode feels intentional
- mobile has its own usable layout
- purple/cyan are no longer the primary visual language
- motion is restrained
- no existing creative data is lost
- all CI/build gates are green
- Settings tightening has not been prematurely mixed into the visual redesign
- a separate LX-4.1 Settings pass begins only after LX-4.0A–H are complete
