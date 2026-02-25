# BookForge Studio Supreme

A production-grade AI publishing platform capable of generating complete books, designing covers, producing marketing campaigns, and predicting high-demand topics.

## Architecture

- **Frontend**: React + TypeScript + TailwindCSS, React Query, Wouter routing, Shadcn UI
- **Backend**: Node.js + Express
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.1, gpt-5-mini, gpt-image-1)

## Key Features

1. **Dashboard** — Publishing stats (SQL-aggregated), recent projects, trend reports
2. **Book Projects** — Full pipeline from concept to complete manuscript
3. **Publishing Pipeline** — Step-by-step AI generation:
   - Trend Analysis (market demand, greenlight scores)
   - Book Outline + DNA (core promise, reader avatar, chapter blueprints)
   - Chapter Writing (full chapters with real AI quality evaluation)
   - AI Cover Generation (category-specific designs, cost-tracked via runStep)
   - Marketing Suite (blurbs, hooks, email sequences, social calendar, pricing)
4. **Trend Intelligence** — Market analysis by vertical with demand/competition scoring
5. **Marketing Suite** — View assets across all projects (XSS-sanitized)
6. **Autopilot Mode** — Configure autonomous publishing with budget/quality controls
7. **Book Export** — Download completed books as .txt or .html (with author name, TOC, title page)

## Database Schema

- `projects` — Book projects with status, metrics, settings, and `authorName` field
- `book_dna` — Core promise, reader avatar, tone rules, transformation arc (indexed on projectId)
- `trend_reports` — Market analysis with demand/greenlight scores (indexed on projectId, vertical)
- `chapters` — Individual chapters with content and quality scores (indexed on projectId)
- `run_steps` — AI generation logs with token usage and cost tracking (indexed on projectId)
- `marketing_assets` — Complete marketing suite (indexed on projectId)
- `autopilot_config` — Autonomous publishing configuration

## AI Models Used

- `gpt-5.1` — High quality drafting and revisions
- `gpt-5-mini` — Fast tasks (trend analysis, marketing, outlines)
- `gpt-image-1` — Book cover generation

## Supported Verticals

money, fitness, spirituality, career, education, relationships, health, mindset, parenting, technology

## Supported Languages

english, spanish, portuguese, french, german

## Centralized Frontend Constants (client/src/lib/utils.ts)

- `PIPELINE_STEPS` — Ordered pipeline status array
- `getPipelinePct(status)` — Progress percentage from status
- `STATUS_GLOW` — Neon glow classes per status
- `VERTICAL_ICONS` — Emoji icons per vertical
- `VERTICAL_LABELS` — Human-readable vertical names
- `sanitizeHtml(html)` — XSS sanitization for AI-generated HTML
- `scoreColor(score)` — Dark-only color classes for quality scores

## Input Validation

- `patchProjectSchema` — Validates project PATCH requests
- `trendAnalyzeSchema` — Validates trend analysis requests
- All POST/PATCH routes use Zod schemas from drizzle-zod

## Design System — Futuristic Abstract Artist Aesthetic

- **Dark-first palette**: Deep cosmos background (`--background: 240 15% 5%`), never uses light mode
- **Primary**: Electric purple (`--primary: 270 100% 72%`)
- **Font stack**: Space Grotesk (headings/body), JetBrains Mono (mono/labels), Playfair Display (serif)
- **Neon gradients**: `.neon-glow` (purple→indigo→cyan), `.neon-glow-warm` (pink→purple→indigo), `.neon-glow-cool` (cyan→blue→purple), `.neon-glow-fire` (amber→red→pink), `.neon-glow-nature` (emerald→cyan→indigo)
- **Aurora backgrounds**: `.aurora-bg` (multi-radial gradient overlay on main content), `.aurora-card` (card-level variant)
- **Glassmorphism**: `.glass-panel` (frosted blur + border for header), `.glass-card` (lighter blur for cards)
- **Glow borders**: `.glow-border` (purple), `.glow-border-cyan`, `.glow-border-pink` — subtle box-shadow + border effects
- **Glow text**: `.glow-text`, `.glow-text-cyan`, `.glow-text-pink` — text-shadow effects
- **Mesh backgrounds**: `.mesh-bg` — multi-radial abstract gradient overlay
- **Animations**: `.animate-pulse-glow` (breathing opacity), `.animate-float` (levitation), `.shimmer-text` (gradient text animation)
- **Utility classes**: `.line-glow` (horizontal separator), `.dot-grid` (background pattern), `.stat-orb` (radial glow on stat cards), `.holographic` (multi-color gradient)
- **Status dots**: Neon glow shadows on active statuses (blue, purple, amber, pink, emerald)
- **Mono labels**: 9-10px font-mono uppercase tracking-[0.2em] for section headers
- **Card style**: `border-border/20 bg-card/30` base, hover transitions to purple/pink/cyan borders
- **Interactive surfaces**: `bg-white/[0.02]` hover states, very subtle transparency

## File Structure

```
server/
  index.ts       — Express server entry point with seeding
  routes.ts      — All API routes (/api/projects, /api/trends, etc.)
  storage.ts     — Database abstraction layer (includes deleteChaptersByProject)
  db.ts          — Drizzle + pg pool connection
  openai.ts      — OpenAI client setup
  seed.ts        — Database seeding with demo projects
client/src/
  App.tsx                    — Root app with sidebar layout and routing
  lib/utils.ts               — Centralized constants and helpers
  components/
    app-sidebar.tsx          — Navigation sidebar with neon glow branding
    theme-toggle.tsx         — Minimal (dark-first design)
  pages/
    Dashboard.tsx            — Main dashboard with stat orbs, shimmer headings
    Projects.tsx             — Project grid with glow status dots
    NewProject.tsx           — Create project form with vertical selector
    ProjectDetail.tsx        — Full pipeline view with neon step buttons
    TrendIntelligence.tsx    — Market analysis with cyan accent theme
    Marketing.tsx            — Marketing overview with pink accent theme
    Autopilot.tsx            — Autopilot config with mesh backgrounds
shared/
  schema.ts      — All Drizzle schemas, TypeScript types, DB indexes
```
