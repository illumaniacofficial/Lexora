# Lexora — Product Requirements & Status

## Original Problem Statement
Pull the GitHub repo (https://github.com/illumaniacofficial/Lexora) and build the Lexora app fully, with all workflows functional.

## What Lexora Is
An advanced AI book-publishing platform: generates complete books (fiction & non-fiction),
covers, marketing campaigns, trend intelligence, an immersive reader with AI narration,
analytics, autopilot autonomous publishing, and a reader storefront.

## Tech Stack (original repo)
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + Shadcn UI + Wouter + React Query.
- Backend: Node.js + Express + TypeScript.
- DB: PostgreSQL + Drizzle ORM (40 tables).
- AI: OpenAI (gpt-5.1 / gpt-5-mini / gpt-image-1 / gpt-audio / gpt-4o-mini-transcribe).
- TTS: ElevenLabs (+ Fish Audio), browser TTS fallback.
- Payments: Stripe (Replit-sync) — DISABLED per user request.

## Emergent Environment Adaptation (architecture)
Supervisor programs are fixed (backend=uvicorn@8001 in /app/backend, frontend=yarn start@3000 in /app/frontend).
- `/app` = the Lexora repo root (Node app).
- Node API server runs on 127.0.0.1:8500 (`server/index.ts`, Vite/static serving removed; loads /app/.env via dotenv).
- `/app/backend/server.py` = FastAPI reverse-proxy on :8001 that spawns the Node server and proxies all /api (+ everything) to :8500, with SSE streaming, cookie & X-Forwarded-Proto passthrough.
- `/app/frontend` = Vite dev server on :3000 serving the client (vite.config proxies /uploads + /api → :8500).
- `/app/scripts/ensure_db.sh` = idempotent Postgres bootstrap (init cluster, create DB, drizzle push) — makes restarts self-healing; Node re-seeds demo data from `db-seed.json`.

## Status (2026-06 / build date 2026-09-29)
- ✅ App runs end-to-end. Admin login works (admin/lexora2026).
- ✅ PostgreSQL provisioned, Drizzle schema pushed (40 tables), seeded 210 demo records (5 books).
- ✅ Dashboard, Projects, Library, Trend Intel, Analytics, Marketing, Referrals, Requests, Chat Studio, Autopilot, Settings pages load with real seeded data.
- ✅ Reverse-proxy + session cookies verified through :8001.
- ⏳ Live AI generation pending real OpenAI key (placeholder set so app boots). ElevenLabs/Fish keys pending for premium narration.
- 🚫 Stripe intentionally disabled (ENABLE_STRIPE=false).

## Keys (backend env at /app/.env)
- AI_INTEGRATIONS_OPENAI_API_KEY (+ BASE_URL=https://api.openai.com/v1)
- ELEVENLABS_API_KEY, FISH_AUDIO_API_KEY (optional)

## Backlog / Next
- P0: Add real OpenAI key → test outline/chapter/cover/marketing generation live.
- P1: Add ElevenLabs + Fish keys → test AI narrator with word-highlighting.
- P2: (Optional) Stripe storefront payments (currently disabled).
