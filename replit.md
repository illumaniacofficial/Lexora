# BookForge Studio Supreme

A production-grade AI publishing platform capable of generating complete books, designing covers, producing marketing campaigns, and predicting high-demand topics.

## Architecture

- **Frontend**: React + TypeScript + TailwindCSS, React Query, Wouter routing, Shadcn UI
- **Backend**: Node.js + Express
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.1, gpt-5-mini, gpt-image-1)

## Key Features

1. **Dashboard** — Publishing stats, recent projects, trend reports
2. **Book Projects** — Full pipeline from concept to complete manuscript
3. **Publishing Pipeline** — Step-by-step AI generation:
   - Trend Analysis (market demand, greenlight scores)
   - Book Outline + DNA (core promise, reader avatar, chapter blueprints)
   - Chapter Writing (full chapters, ~1500-2000 words each)
   - AI Cover Generation (category-specific designs)
   - Marketing Suite (blurbs, hooks, email sequences, social calendar, pricing)
4. **Trend Intelligence** — Market analysis by vertical with demand/competition scoring
5. **Marketing Suite** — View assets across all projects
6. **Autopilot Mode** — Configure autonomous publishing with budget/quality controls

## Database Schema

- `projects` — Book projects with status, metrics, and settings
- `book_dna` — Core promise, reader avatar, tone rules, transformation arc
- `trend_reports` — Market analysis with demand/greenlight scores
- `chapters` — Individual chapters with content and quality scores
- `run_steps` — AI generation logs with token usage and cost tracking
- `marketing_assets` — Complete marketing suite (blurbs, hooks, email, social)
- `autopilot_config` — Autonomous publishing configuration

## AI Models Used

- `gpt-5.1` — High quality drafting and revisions
- `gpt-5-mini` — Fast tasks (trend analysis, marketing, outlines)
- `gpt-image-1` — Book cover generation

## Supported Verticals

money, fitness, spirituality, career, education, relationships, health, mindset, parenting, technology

## Supported Languages

english, spanish, portuguese, french, german

## Design System

- **Primary palette**: Violet/indigo (`--primary: 252 85% 60%` light, `255 80% 68%` dark)
- **Font**: Inter with OpenType features cv02/03/04/11, tight letter-spacing on headings
- **Gradients**: `premium-gradient` (violet→purple→pink) for icon backgrounds, `premium-gradient-subtle` for card accents
- **Glass effect**: `glass-card` class with backdrop-blur for header
- **Status dots**: Colored circles (`bg-emerald-500`, `bg-amber-500`, etc.) paired with text labels
- **Vertical color system**: `VERTICAL_LABELS`, `VERTICAL_BG`, `VERTICAL_ACCENT` maps in `client/src/lib/utils.ts`
- **Shadows**: CSS custom properties `--shadow-sm` through `--shadow-2xl` with dark mode variants
- **Cards**: `border-border/50 shadow-sm` base, `hover:shadow-md hover:border-primary/20` on interactive cards

## File Structure

```
server/
  index.ts       — Express server entry point with seeding
  routes.ts      — All API routes (/api/projects, /api/trends, etc.)
  storage.ts     — Database abstraction layer
  db.ts          — Drizzle + pg pool connection
  openai.ts      — OpenAI client setup
  seed.ts        — Database seeding with demo projects
client/src/
  App.tsx                    — Root app with sidebar layout and routing
  components/
    app-sidebar.tsx          — Navigation sidebar
    theme-toggle.tsx         — Dark/light mode toggle
  pages/
    Dashboard.tsx            — Main dashboard with stats
    Projects.tsx             — Project list with filters
    NewProject.tsx           — Create project form
    ProjectDetail.tsx        — Full pipeline view per project
    TrendIntelligence.tsx    — Market analysis dashboard
    Marketing.tsx            — Marketing assets overview
    Autopilot.tsx            — Autopilot configuration
shared/
  schema.ts      — All Drizzle schemas and TypeScript types
```
