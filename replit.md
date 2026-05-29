# Lexora

## Overview
Lexora is a production-grade AI publishing platform designed to automate and streamline the entire book publishing process. It can generate complete books, design covers, produce marketing campaigns, and predict high-demand topics. The platform aims to empower authors and publishers by leveraging advanced AI to accelerate content creation and market analysis, significantly reducing the time and cost associated with traditional publishing. Its vision is to become the leading AI-driven solution for high-volume, quality content production in the publishing industry.

## User Preferences
I prefer iterative development with frequent, small updates.
I like clear and concise communication, focusing on the problem and proposed solution.
Please ask for my approval before making any major architectural changes or adding new, significant dependencies.
I prefer to see code changes in small, reviewable chunks.
Do not make changes to the folder `shared/`.
Do not make changes to the file `client/src/lib/utils.ts`.

## System Architecture
Lexora employs a modern web architecture with a clear separation of concerns.

**Frontend**:
- Built with React, TypeScript, and TailwindCSS for a robust and maintainable UI.
- Utilizes React Query for data fetching and caching, Wouter for routing, and Shadcn UI for component styling.
- Design System: "Futuristic Abstract Artist Aesthetic" featuring a dark-first palette, electric purple primary color, Space Grotesk/JetBrains Mono/Playfair Display fonts, neon gradients, aurora backgrounds, glassmorphism effects, glow borders, and various animations (pulse, float, shimmer, fade-in-up, count-up).
- UI/UX decisions include a full-screen immersive book reader with page flip animations, themes, and an AI narrator.
- **VoiceSelector Component**: Searchable dropdown with voice filtering (free vs. premium), used in Settings page and book reader for intuitive voice selection across 17 voice options.
- Accessibility: Implemented `aria-label` for icons, `sr-only` for labels, and `data-testid` for interactive elements.
- SEO: Uses `react-helmet-async` for per-page titles and meta descriptions.

**Backend**:
- Powered by Node.js and Express, providing a scalable API layer.
- Handles AI integrations, database interactions, and business logic.

**Database**:
- PostgreSQL is used as the relational database.
- Drizzle ORM facilitates database interactions, defining schemas for projects, book DNA, trend reports, chapters, run steps, marketing assets, autopilot configurations, chat conversations, and application settings.

**AI Integration**:
- Leverages OpenAI models (gpt-5.1, gpt-5-mini, gpt-image-1) via Replit AI Integrations for various tasks.
- Specific AI handling for fiction (character arcs, plot structure, 15-25 chapters, 2000-3000 words/chapter) vs. non-fiction (frameworks, exercises, 8-12 chapters, 1500-2000 words/chapter).

**Core Features**:
- **Dashboard**: Provides publishing statistics and trend reports.
- **Book Projects & Publishing Pipeline**: Manages the entire book creation process from trend analysis, outline generation, chapter writing, AI cover generation, to marketing suite creation.
- **Trend Intelligence**: Offers market analysis with demand and competition scoring across 61 genres/verticals.
- **Marketing Suite**: Generates blurbs, hooks, email sequences, social calendars, and pricing matrices.
- **Library**: Stores completed books with search, filter, and sort functionalities.
- **Autopilot Mode**: Autonomous book publishing, including topic generation and full pipeline execution with budget/quality controls.
- **Book Export**: Supports .pdf, .txt, and .html formats.
- **AI Narrator**: Integrates ElevenLabs TTS with 12 premium voices (Sergio, Sergio Instant, George, Brian, Lily, Sarah, Alice, Daniel, Ryan, Emma, Chris, Jessica) and 5 free browser voices (Alloy, Echo, Fable, Onyx, Nova). Voice selection via searchable dropdown with free/premium filtering on Settings page and reader pages. Client-side audio caching and server-side TTS caching for seamless narration. Per-voice disk-based caching saves audio files so switching voices doesn't waste credits. Word-level highlighting syncs with audio playback progress, with theme-aware styling (purple highlight for dark themes, light purple for light themes) and throttled auto-scroll. Continuous reading mode auto-advances pages.
- **Book Reader Intro/Outro**: Narrates the book title, author name, and chapter count before chapter 1 (intro page). After the last chapter, narrates a thank-you outro with Lexora branding.
- **Per-Voice Audio Caching**: Audio files stored in voice-specific folders (`uploads/audio/{voiceId}/project-{id}-chapter-{id}.mp3`). TTS page-level audio cached to disk (`uploads/audio/tts-cache/{voiceId}/`). Existing files served instantly without regenerating.
- **Editing Stage**: Provides an inline chapter editor with save/cancel, timestamps, and status management. REGEN blocked when project is complete.
- **Chat Studio**: A conversational AI interface for planning and writing books.
- **Pacing & Tension Analyzer**: A "Pacing" tab on the project page that uses AI (FAST_MODEL) to score tension and pacing per completed chapter, renders an SVG tension/pacing curve, and flags slow/rushed chapters with rationale. Persisted as a `chapter_analyses` row with `kind="pacing_curve"` (chapterId null). Requires at least 2 completed chapters.
- **Live AI Co-Writer**: Inline co-writing inside the chapter editor (editing stage). "Continue from cursor" and "Rewrite selection" actions (HIGH_MODEL) produce a suggestion preview with accept/reject; accepting splices the text into the draft, saved via the existing edit path. The editor is locked read-only while a suggestion is pending so captured cursor/selection offsets stay valid. Blocked when the project is complete.
- **Competitor Teardown**: A "Market" tab on the project page. Author optionally pastes a competing title/description (or leaves blank to analyze the niche), and AI (FAST_MODEL) returns competitor strengths/weaknesses, market gaps, positioning, differentiators, and a recommended lead angle. Persisted as a `market_reports` row with `kind="competitor_teardown"`.
- **KDP Keyword & Category Optimizer**: Also on the "Market" tab. Generates exactly 7 buyer-intent keywords and 2 winnable Amazon browse categories (with rationale) from Book DNA + vertical via AI (FAST_MODEL). Persisted as `market_reports` with `kind="kdp_optimizer"`. Frontend gates the run until an outline exists.
- **Trend Forecasting & Alerts**: A "Demand Forecast & Alerts" section on Trend Intelligence. `GET /api/trends/forecast` is deterministic (no AI cost) — it groups historical `trend_reports` by vertical, computes a linear demand slope over time, projects next-cycle demand, and classifies each vertical as `act-now` / `rising` / `cooling` / `stable` / `insufficient-data`. "Act now" + "rising" verticals surface as alerts. Forecast cache is invalidated after running a new trend analysis.

**Security & Auth**:
- Admin authentication via express-session + connect-pg-simple. Seeded admin user (username: `admin`, password: `lexora2026`). Login page at `/login`, all `/api/*` routes (except `/api/auth/*`, `/api/storefront-auth/*`, `/api/store/*`) require admin session.
- Storefront reader accounts: separate login system under `/api/storefront-auth/*`. Readers can browse/read books but cannot trigger new ElevenLabs audio generation — only cached audio is served, with browser TTS as fallback.
- Helmet security headers applied globally.
- AI rate limiting: 20 requests/minute on generation endpoints (`/api/generate-outline`, `/api/generate-chapter`, `/api/generate-image`, `/api/tts`, `/api/autopilot/run`).
- DB transactions on all upsert operations (bookDna, marketingAssets, autopilotConfig, appSettings) and outline chapter replacement.
- Confirmation dialogs for destructive actions: project deletion, outline regeneration.
- Unified cost estimation in `server/cost.ts` with model-specific rates.
- Logout button in admin sidebar footer.

**Technical Implementations**:
- Input Validation: Uses Zod schemas for all POST/PATCH routes and validates route parameters.
- Error Handling: Includes pipeline failure recovery, generation cancellation, `ErrorBoundary` for React errors, and error state UI for data fetching.
- File Storage: Audio files stored per-voice at `uploads/audio/{voiceId}/project-{id}-chapter-{id}.mp3`. TTS page cache at `uploads/audio/tts-cache/{voiceId}/{hash}.mp3`. Legacy flat paths supported for backward compatibility.

## External Dependencies
- **OpenAI**: Integrated for AI model access (`gpt-5.1`, `gpt-5-mini`, `gpt-image-1`).
- **PostgreSQL**: Used as the primary database.
- **Drizzle ORM**: Object-relational mapper for database interactions.
- **ElevenLabs**: Utilized for Text-to-Speech (TTS) narration.
- **React**: Frontend library.
- **TypeScript**: Superset of JavaScript for type safety.
- **TailwindCSS**: Utility-first CSS framework.
- **React Query**: For data fetching, caching, and state management.
- **Wouter**: A small routing library for React.
- **Shadcn UI**: UI component library.
- **Express**: Web application framework for Node.js.
- **Zod**: TypeScript-first schema declaration and validation library. `shared/schema.ts` and `shared/models/chat.ts` import `zod/v4` to stay type-compatible with drizzle-zod 0.8.x (which emits zod v4 schema types). Frontend form schemas still use the classic `zod` (v3) import via `@hookform/resolvers/zod`.
- **drizzle-zod**: Generates Zod insert schemas from Drizzle tables (v0.8.x). Note: it auto-excludes auto-generated identity columns from insert schemas, so `.omit()` calls must not list `id` for `generatedAlwaysAsIdentity` columns.
- **Schema note — market_reports table**: A flexible `(project_id, vertical, kind, data jsonb)` table reused for multiple market-intelligence outputs via the `kind` discriminator (`competitor_teardown`, `kdp_optimizer`). Service logic lives in `server/market.ts`; reports are loaded into the `GET /api/projects/:id` response as `marketReports` and rendered on the project "Market" tab.
- **Schema note — audio_tracks uniqueness**: Null-safe uniqueness on `(project_id, scope, voice_id, chapter_id, page_index)` uses a `unique(...).nullsNotDistinct()` constraint (Postgres 15+/16). An earlier `coalesce()` expression-based unique index caused the Publish migration generator to emit mismatched operator classes (`operator class "text_ops" does not accept data type integer`), which blocked production publishes; the constraint form emits clean migration SQL. App-level dedup uses a transactional check-then-write in `storage.createAudioTrack`, so no code references the index by name.
- **react-helmet-async**: For managing document head tags.
- **bcryptjs**: Password hashing for admin and reader accounts.
- **express-session + connect-pg-simple**: Session management backed by PostgreSQL.
- **helmet**: Security headers middleware.
- **express-rate-limit**: Rate limiting for AI generation endpoints.