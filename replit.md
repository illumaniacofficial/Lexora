# Lexora

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
   - Book Outline + DNA (core promise, reader avatar, chapter blueprints) — uses project description/prompt for creative direction
   - Chapter Writing (full chapters with real AI quality evaluation)
   - AI Cover Generation (category-specific designs, custom prompt + "styles to avoid" fields, cost-tracked via runStep)
   - Marketing Suite (blurbs, hooks, email sequences, social calendar, pricing)
4. **Trend Intelligence** — Market analysis by vertical with demand/competition scoring
5. **Marketing Suite** — Chronological log of all books (with marketing + in-pipeline), per-project expandable marketing content: hooks, email sequences, social calendar, pricing matrix, blurbs (XSS-sanitized)
6. **Library** — Completed books collection with search bar, vertical filters, sort options (rank/title/words/quality/date), top-5 featured cards with rank badges, and clickable link list for the rest
7. **Autopilot Mode** — Fully autonomous book publishing: AI generates topic, runs full pipeline (trend analysis → outline → chapters → marketing), with budget/quality auto-stop controls and run history tracking
8. **Book Export** — Download completed books as .pdf (rich book format with title page, TOC, chapter title pages, page numbers), .txt, or .html
9. **Full-Screen Book Reader** — Immersive book experience with paper textures, spine shadows, page edge effects, page flip animations, keyboard navigation, TOC jump, font size controls (XS–2XL), 6 page themes (Parchment/Cream/White/Sepia/Dark/Midnight), progress tracking, and landscape two-page spread mode with a book spine
10. **AI Narrator** — ElevenLabs TTS narration with 8 voice options (Sergio professional/cloned, George, Brian, Lily, Sarah, Alice, Daniel); auto-advances pages when reading finishes (toggleable); plays inside full-screen reader and continues in a floating mini-player after closing the book with play/pause, replay, next-page controls, and auto-advance to next page on completion; client-side audio cache + next-page prefetching for seamless transitions; server-side TTS cache (50 entries, 10min TTL) for instant replays; admin-only audiobook download (.mp3) from project export section
11. **Cancel Generation** — Cancel button on chapters stuck in "generating" status, resets to "pending" via PATCH endpoint with project ownership validation
12. **Chat Studio** — Conversational AI book architect page for planning, structuring, and writing books step by step. Supports all genres (fiction and non-fiction). Persistent conversations with message history. Markdown rendering for AI responses.

## Database Schema

- `projects` — Book projects with status, metrics, settings, `authorName`, `description` (book idea/prompt), `coverPrompt`, and `coverAvoidStyles` fields
- `book_dna` — Core promise, reader avatar, tone rules, transformation arc (indexed on projectId)
- `trend_reports` — Market analysis with demand/greenlight scores (indexed on projectId, vertical)
- `chapters` — Individual chapters with content and quality scores (indexed on projectId)
- `run_steps` — AI generation logs with token usage and cost tracking (indexed on projectId)
- `marketing_assets` — Complete marketing suite (indexed on projectId)
- `autopilot_config` — Autonomous publishing configuration
- `autopilot_runs` — Run history with status, current step, tokens, cost, error tracking
- `app_settings` — Platform settings (author defaults, AI model, chapter word target, auto-cover/marketing, TTS voice, storefront title, export format)
- `chat_conversations` — Chat Studio conversations with title and optional project link
- `chat_messages` — Chat messages (user/assistant roles) with conversation reference

## AI Models Used

- `gpt-5.1` — High quality drafting and revisions
- `gpt-5-mini` — Fast tasks (trend analysis, marketing, outlines)
- `gpt-image-1` — Book cover generation (1024x1536 portrait format, hyper-realistic prompt)

## Supported Genres / Verticals (61 total)

**Fiction**: sci-fi, fantasy, horror, romance, thriller, mystery, literary-fiction, dystopian, erotica, comedy, adventure, young-adult, children, drama, western, novel

**Memoir & Biography**: memoir, biography, true-crime, poetry

**Self-Help & Lifestyle**: money, fitness, spirituality, career, education, relationships, health, mindset, parenting, productivity, minimalism

**Knowledge & Society**: philosophy, history, science, psychology, sociology, politics, law, technology

**Business & Finance**: business, marketing, sales, real-estate, crypto, ai, cybersecurity

**Creative & Hobbies**: cooking, travel, photography, music, writing, art, gardening, pets, sports, gaming, fashion, beauty, diy, sustainability

## Fiction vs Non-Fiction AI Handling

- Fiction genres use genre-aware prompts: character arcs, plot structure, dialogue, 15-25 chapters, 2000-3000 word chapters
- Non-fiction genres use structured prompts: frameworks, exercises, case studies, 8-12 chapters, 1500-2000 word chapters
- Cover generation adjusts "fiction" vs "non-fiction" in prompt based on genre type
- `isFiction()` helper function in routes.ts determines genre type

## Supported Languages

english, spanish, portuguese, french, german

## Centralized Frontend Constants (client/src/lib/utils.ts)

- `PIPELINE_STEPS` — Ordered pipeline status array
- `getPipelinePct(status)` — Progress percentage from status
- `STATUS_GLOW` — Neon glow classes per status
- `VERTICAL_ICONS` — Emoji icons per vertical (61 genres)
- `VERTICAL_LABELS` — Human-readable vertical names (61 genres)
- `GENRE_GROUPS` — Categorized genre groups for UI display (Fiction, Memoir, Self-Help, Knowledge, Business, Creative)
- `sanitizeHtml(html)` — XSS sanitization for AI-generated HTML
- `scoreColor(score)` — Dark-only color classes for quality scores

## Input Validation & Error Handling

- `patchProjectSchema` — Validates project PATCH requests
- `trendAnalyzeSchema` — Validates trend analysis requests
- All POST/PATCH routes use Zod schemas from drizzle-zod
- `parseId()` helper validates all route param IDs (returns 400 for NaN/invalid)
- Export endpoint validates `format` query param (only `txt`/`html` allowed)
- Pipeline failures revert project status to `prevStatus` (trend analysis, outline, marketing, cover generation) and chapter status to `pending` on generation failure
- Cancel chapter generation: `PATCH /api/projects/:id/chapters/:chapterId/cancel` resets stuck chapters with project ownership validation
- Autopilot duplicate prevention: checks for completed books in vertical before generating new ones
- Book reader persists theme and font size preferences in localStorage with validation/fallback
- `ErrorBoundary` component wraps entire app for React render error recovery
- All pages with `useQuery` have error state UI (AlertCircle + message), including ProjectDetail
- SEO: `react-helmet-async` with per-page `<Helmet>` titles and meta descriptions on all pages (including NewProject)
- Accessibility: `aria-label` on icon-only buttons, `sr-only` on delete labels
- `data-testid` attributes on all interactive and meaningful display elements
- `LANGUAGE_LABELS` centralized in `utils.ts` (shared by NewProject + Autopilot)

## Design System — Futuristic Abstract Artist Aesthetic

- **Dark-first palette**: Deep cosmos background (`--background: 240 15% 5%`), never uses light mode
- **Primary**: Electric purple (`--primary: 270 100% 72%`)
- **Font stack**: Space Grotesk (headings/body), JetBrains Mono (mono/labels), Playfair Display (serif)
- **Neon gradients**: `.neon-glow` (purple→indigo→cyan), `.neon-glow-warm` (pink→purple→indigo), `.neon-glow-cool` (cyan→blue→purple), `.neon-glow-fire` (amber→red→pink), `.neon-glow-nature` (emerald→cyan→indigo)
- **Aurora backgrounds**: `.aurora-bg` (static), `.aurora-bg-animated` (slowly drifting gradient, 20s cycle — used on Dashboard, Projects, Library, Chat empty state)
- **Glassmorphism**: `.glass-panel` (frosted blur + border), `.glass-card` (lighter blur), `.glass-card-premium` (deeper blur + purple-tinted border + inset highlight — used on major cards)
- **Glow borders**: `.glow-border` (purple), `.glow-border-cyan`, `.glow-border-pink` — subtle box-shadow + border effects
- **Gradient border animation**: `.gradient-border-animated` — animated conic gradient border (4s rotation) for featured items
- **Glow text**: `.glow-text`, `.glow-text-cyan`, `.glow-text-pink` — text-shadow effects
- **Mesh backgrounds**: `.mesh-bg` — multi-radial abstract gradient overlay
- **Animations**:
  - `.animate-pulse-glow` (breathing opacity), `.animate-float` (levitation), `.shimmer-text` (gradient text shimmer)
  - `.animate-fade-in-up` + `.stagger-1` through `.stagger-6` — staggered entrance animations on cards and page sections
  - `.animate-count-up` — stat counter pulse animation
  - `.card-hover-lift` — translateY(-4px) + scale(1.01) with purple glow shadow on hover
  - `.typing-dot` — bouncing dot indicator for AI typing states in Chat Studio
  - `.nav-active-bar` — animated left-edge gradient bar for active sidebar nav items
- **Progress bars**: `.progress-gradient` — applies purple→cyan gradient to progress bar indicators
- **Message bubbles**: `.message-bubble-ai` (dark purple gradient + glow shadow), `.message-bubble-user` (lighter purple tint) — used in Chat Studio
- **Utility classes**: `.line-glow`, `.dot-grid`, `.stat-orb`, `.holographic`, `.cover-gradient-overlay` (fade-to-bg for cover images)
- **Status dots**: Neon glow shadows on active statuses
- **Mono labels**: 9-10px font-mono uppercase tracking-[0.2em] for section headers
- **Card style**: `border-border/15 bg-card/30` base, hover transitions with purple/cyan borders, cover thumbnails on project cards
- **Interactive surfaces**: `bg-white/[0.02]` to `bg-white/[0.04]` hover states, button hover:scale-105 effects
- **Cover art**: Project cards show cover thumbnails (h-28 with gradient overlay), Library featured cards use taller aspect ratios (2:3, max-h-56), list items show mini thumbnails (h-10 w-7)

## File Structure

```
server/
  index.ts             — Express server entry point with seeding
  routes.ts            — All API routes (/api/projects, /api/trends, /api/autopilot, /api/chat, etc.)
  storage.ts           — Database abstraction layer (includes deleteChaptersByProject, chat CRUD)
  autopilot-engine.ts  — Autonomous book generation engine (topic → trend → outline → chapters → marketing)
  db.ts                — Drizzle + pg pool connection
  openai.ts            — OpenAI client setup
  seed.ts              — Database seeding with demo projects
client/src/
  App.tsx                    — Root app with sidebar layout, routing, React.lazy code-splitting for all pages
  lib/utils.ts               — Centralized constants and helpers
  components/
    app-sidebar.tsx          — Navigation sidebar with neon glow branding, "Now Playing" narration indicator, "Share & Invites" quick link
    error-boundary.tsx       — Global React error boundary with recovery UI
    markdown-renderer.tsx    — Shared markdown rendering (MarkdownRenderer for light/reader, MarkdownRendererDark for dark UI, stripMarkdown utility)
    book-reader.tsx          — Full-screen immersive book reader with page flip animations, font size, themes, AI narrator, touch swipe navigation, mobile-optimized toolbar, and close buttons on all dropdown panels
    audio-mini-player.tsx    — Floating narration mini-player (persists after closing reader) with play/pause/replay/next
    theme-toggle.tsx         — Minimal (dark-first design)
  pages/
    Dashboard.tsx            — Main dashboard with stat orbs, shimmer headings
    Projects.tsx             — Project grid with glow status dots
    NewProject.tsx           — Create project form with grouped genre selector (Fiction, Non-Fiction categories)
    ProjectDetail.tsx        — Full pipeline view with neon step buttons
    TrendIntelligence.tsx    — Market analysis with cyan accent theme
    Marketing.tsx            — Marketing suite with expandable per-project content (hooks, emails, pricing, blurbs)
    Library.tsx              — Completed books library with search, filters, sorting, top-5 featured cards, ranked link list
    ChatStudio.tsx           — Conversational AI chat for book planning and writing
    Autopilot.tsx            — Autopilot config with mesh backgrounds
    Settings.tsx             — App settings (10 configurable preferences)
shared/
  schema.ts      — All Drizzle schemas, TypeScript types, DB indexes
```
