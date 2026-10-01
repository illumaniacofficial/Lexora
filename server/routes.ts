import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openai, FAST_MODEL, HIGH_MODEL, IMAGE_MODEL, OPENAI_CONFIGURED } from "./openai";
import { buildConsistencyContext, type ContinuityExtras } from "./consistency";
import { runEditorialBoard, humanizeChapter, runBetaReaders } from "./editorial";
import { deriveStyleProfile, buildStyleContext } from "./style";
import { extractStoryEntities } from "./graph";
import { analyzePacing, generateInlineCompletion } from "./pacing";
import { analyzeCompetitor, optimizeKdp, forecastTrends } from "./market";
import { computeRevenueForecast, generateAbVariants, aggregatePortfolioAnalytics } from "./analytics";
import { insertProjectSchema, insertAutopilotConfigSchema, insertInviteTokenSchema, insertMarketingAssetSchema, insertBrandKitSchema, LANGUAGES, VERTICALS } from "@shared/schema";
import { buildEpub } from "./epub";
import { buildDocx } from "./docx";
import { buildMobi } from "./mobi";
import { readerHasBookAccess } from "./storeAccess";
import { getConfig } from "./config/env";
import crypto from "crypto";
import { generateLaunchPlan, type LaunchItem } from "./launch";
import { generateAudiobook, generateAudioTrailer, generateVideoTrailer, DEFAULT_NARRATOR_VOICE, synthText } from "./media";
import { executeAutopilotRun, isAutopilotRunning, requestAutopilotStop, parseStrategy, selectNextVertical } from "./autopilot-engine";
import { notify } from "./notify";
import { saveDbSeed } from "./seed";
import { z } from "zod";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { estimateCost } from "./cost";
import { ensurePropertyForProject } from "./core/propertyService";
import { scribeChat, buildScribeContext } from "./core/scribe";
import { drawTriad, getTriadDeckStats } from "./core/triadEngine";
import { hashArtifactContent } from "./core/artifacts";
import { isOllamaAvailable, ollamaChat } from "./core/ollama";
import { captureContinuityForApprovedChapter, archiveContinuityForChapter } from "./core/continuityService";
import { buildChapterDraftInstructions } from "./core/chapterCraft";
import { captureBookArchitectureArtifact, captureRedactorReviewArtifact, captureCanonicalChapterArtifact } from "./core/canonService";

const FICTION_GENRES = new Set([
  "sci-fi", "fantasy", "horror", "romance", "thriller", "mystery",
  "literary-fiction", "dystopian", "erotica", "comedy", "adventure",
  "young-adult", "children", "drama", "western", "novel",
]);

function isFiction(vertical: string): boolean {
  return FICTION_GENRES.has(vertical);
}

async function loadContinuityExtras(project: { id: number; seriesId?: number | null }): Promise<ContinuityExtras> {
  const extras: ContinuityExtras = {};
  let projectEntities: any[] = [];
  try {
    projectEntities = await storage.getStoryEntities({ projectId: project.id });
  } catch {
    projectEntities = [];
  }
  if (project.seriesId) {
    try {
      const s = await storage.getSeries(project.seriesId);
      if (s) {
        extras.seriesTitle = s.title;
        extras.seriesBible = (s.bible as any) || null;
      }
    } catch {
      /* ignore */
    }
    // Merge in entities from sibling books in the same series (cross-book continuity).
    try {
      const seriesEntities = await storage.getStoryEntities({ seriesId: project.seriesId });
      const seen = new Set(projectEntities.map((e) => `${e.type}::${String(e.name).toLowerCase()}`));
      for (const e of seriesEntities) {
        const key = `${e.type}::${String(e.name).toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          projectEntities.push(e);
        }
      }
    } catch {
      /* ignore */
    }
  }
  extras.entities = projectEntities;
  return extras;
}

async function loadStyleContext(styleFingerprintId?: number | null): Promise<string> {
  if (!styleFingerprintId) return "";
  try {
    const fp = await storage.getStyleFingerprint(styleFingerprintId);
    return buildStyleContext(fp);
  } catch {
    return "";
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildHtmlExport(title: string, authorName: string, chapters: { chapterNumber: number; title: string; content: string | null }[]): string {
  const chapterHtml = chapters.map(ch => `
    <div class="chapter" style="page-break-before: always;">
      <h2 style="font-size: 1.5em; margin-bottom: 0.3em; color: #333;">Chapter ${ch.chapterNumber}</h2>
      <h3 style="font-size: 1.2em; color: #555; margin-bottom: 2em; font-weight: normal; font-style: italic;">${escapeHtml(ch.title)}</h3>
      ${(ch.content || "").split("\n").map(p => p.trim() ? `<p style="margin-bottom: 1em; text-indent: 1.5em; line-height: 1.8;">${escapeHtml(p)}</p>` : "").join("\n")}
    </div>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
    body { font-family: 'Libre Baskerville', Georgia, serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #222; background: #fff; font-size: 16px; }
    .title-page { text-align: center; padding: 100px 0; }
    .title-page h1 { font-size: 2.5em; margin-bottom: 0.5em; color: #111; }
    .title-page .author { font-size: 1.3em; color: #555; font-style: italic; }
    .toc { page-break-after: always; padding: 40px 0; }
    .toc h2 { font-size: 1.5em; margin-bottom: 1em; }
    .toc ul { list-style: none; padding: 0; }
    .toc li { padding: 0.5em 0; border-bottom: 1px solid #eee; font-size: 1em; }
    @media print { body { padding: 0; } .title-page { padding: 200px 0; } }
  </style>
</head>
<body>
  <div class="title-page">
    <h1>${escapeHtml(title)}</h1>
    <p class="author">by ${escapeHtml(authorName)}</p>
  </div>
  <div class="toc">
    <h2>Table of Contents</h2>
    <ul>
      ${chapters.map(ch => `<li>Chapter ${ch.chapterNumber}: ${escapeHtml(ch.title)}</li>`).join("\n      ")}
    </ul>
  </div>
  ${chapterHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COVER_VERTICAL_HINTS: Record<string, string> = {
  money: "gold and dark blue palette, modern typography",
  fitness: "bold red and white, dynamic typography",
  spirituality: "purple and gold gradients, ethereal typography",
  career: "corporate blue, clean modern design",
  education: "forest green, knowledge symbols",
  relationships: "soft coral and cream",
  health: "teal and white, modern sans-serif",
  mindset: "orange and black, bold typography",
  parenting: "soft yellows and blues",
  technology: "dark with neon accents",
  cooking: "warm kitchen tones, rustic wood textures",
  travel: "vibrant landscapes, compass motifs",
  photography: "monochrome with color accents",
  music: "sound wave patterns, bold gradients",
  writing: "ink and quill motifs, parchment textures",
  art: "paint splatter accents, vivid colors",
  gardening: "botanical illustrations, earthy greens",
  pets: "paw prints, soft pastels",
  sports: "stadium lighting, dynamic action lines",
  gaming: "pixel art accents, neon glows",
  philosophy: "marble textures, deep navy and gold",
  history: "aged parchment, vintage maps, sepia tones",
  science: "molecular structures, lab blue and white",
  psychology: "brain visualization, warm gradients",
  sociology: "interconnected figures, muted earth tones",
  politics: "capitol imagery, red white blue",
  law: "scales of justice, dark leather textures",
  business: "professional polish, power palette",
  marketing: "bright gradients, bold callouts",
  sales: "confident red and black typography",
  "real-estate": "luxury home photography, gold accents",
  crypto: "blockchain patterns, digital gold",
  ai: "neural network visuals, electric blue",
  cybersecurity: "shield motifs, matrix green on black",
  productivity: "clock and checklist motifs, minimalist",
  minimalism: "vast whitespace, single accent color",
  sustainability: "leaf patterns, earth greens",
  fashion: "high-contrast black and white, chic fonts",
  beauty: "soft pink and gold, floral accents",
  diy: "workshop tools, craft paper textures",
  "sci-fi": "space nebulae, holographic chrome text, starships",
  fantasy: "enchanted landscapes, ornate gold filigree, magical glow",
  horror: "ominous shadows, dripping blood red typography, moonlit fog",
  romance: "soft bokeh, flowing fabrics, warm rose and gold",
  thriller: "rain-soaked streets, high contrast shadows, tense red",
  mystery: "foggy alleyways, dark teal and amber, detective aesthetic",
  "literary-fiction": "abstract watercolor art, muted earth tones",
  dystopian: "crumbling cityscapes, ash-grey skies, rebellious red",
  erotica: "silk and satin textures, deep burgundy, intimate soft lighting",
  memoir: "vintage photograph aesthetic, warm sepia and cream",
  biography: "portrait silhouette, classic navy and gold",
  "true-crime": "crime scene tape, noir photography, stark red",
  comedy: "playful illustrations, bold vibrant colors",
  adventure: "vast mountain landscapes, treasure maps",
  "young-adult": "vibrant gradients, swooping motion lines",
  children: "whimsical illustrations, bright primary colors",
  poetry: "watercolor florals, delicate calligraphy, soft pastels",
  drama: "theatrical curtain motifs, deep crimson and gold",
  western: "desert sunset landscapes, leather textures",
  novel: "classic design, rich colors, sophisticated typography",
};

function brandKitToHint(brandKit?: { name?: string; palette?: unknown; fonts?: unknown; logoUrl?: unknown } | null): string {
  if (!brandKit) return "";
  const parts: string[] = [];
  const collect = (val: unknown): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map((v) => String(v)).filter(Boolean);
    if (typeof val === "object") return Object.values(val as Record<string, unknown>).map((v) => String(v)).filter(Boolean);
    if (typeof val === "string") return [val];
    return [];
  };
  const colors = collect(brandKit.palette);
  const fonts = collect(brandKit.fonts);
  if (colors.length) parts.push(`brand color palette: ${colors.slice(0, 6).join(", ")}`);
  if (fonts.length) parts.push(`brand typography style: ${fonts.slice(0, 3).join(", ")}`);
  if (typeof brandKit.logoUrl === "string" && brandKit.logoUrl.trim()) {
    parts.push("reserve a small, clean area (typically near the spine or bottom corner) for an author/publisher logo imprint so the brand mark can sit comfortably without clutter");
  }
  if (!parts.length) return "";
  return ` BRAND KIT (must be honored): ${parts.join("; ")}.`;
}

function buildCoverPrompt(args: {
  project: { title: string; authorName?: string | null; vertical: string; description?: string | null };
  dna?: { corePromise?: string | null; transformationArc?: string | null; frameworkSummary?: string | null } | null;
  trend?: { summary?: string | null; nicheTopics?: string[] | null } | null;
  chapterList: { title: string }[];
  userPrompt: string;
  userAvoid: string;
  brandKit?: { name?: string; palette?: unknown; fonts?: unknown; logoUrl?: unknown } | null;
  variantDirective?: string;
}): string {
  const { project, dna, trend, chapterList, userPrompt, userAvoid, brandKit, variantDirective } = args;
  const contentContext: string[] = [];
  if (project.description) contentContext.push(`Book description: ${project.description}`);
  if (dna?.corePromise) contentContext.push(`Core promise: ${dna.corePromise}`);
  if (dna?.transformationArc) contentContext.push(`Transformation arc: ${dna.transformationArc}`);
  if (dna?.frameworkSummary) contentContext.push(`Framework: ${dna.frameworkSummary}`);
  if (trend?.summary) contentContext.push(`Market context: ${trend.summary.slice(0, 200)}`);
  if (trend?.nicheTopics?.length) contentContext.push(`Niche: ${trend.nicheTopics.slice(0, 2).join("; ")}`);
  if (chapterList.length > 0) {
    const titles = chapterList.slice(0, 6).map((c) => c.title).join(", ");
    contentContext.push(`Key chapters: ${titles}`);
  }
  const bookContext = contentContext.length > 0
    ? `\n\nThis book is specifically about: ${contentContext.join(". ")}. The cover imagery, symbols, and color palette MUST reflect this specific subject matter — not generic category art.`
    : "";
  const colorHint = COVER_VERTICAL_HINTS[project.vertical] || "modern design, premium feel";
  const customSection = userPrompt ? ` Additional creative direction: ${userPrompt}.` : "";
  const avoidSection = userAvoid ? ` IMPORTANT — Do NOT use these styles: ${userAvoid}.` : "";
  const brandSection = brandKitToHint(brandKit);
  const variantSection = variantDirective ? ` VARIANT DIRECTION: ${variantDirective}.` : "";
  const author = project.authorName || "Unknown Author";
  return `Create a hyper-realistic, print-ready book cover for "${project.title}" by ${author}. Color/typography hints: ${colorHint}. Requirements: photorealistic 3D book cover mockup with realistic lighting, shadows, and depth. The title text "${project.title}" must be prominently displayed in elegant, high-contrast typography. The author name "${author}" must appear clearly at the bottom. The design should look like a bestselling ${isFiction(project.vertical) ? "fiction" : "non-fiction"} book you'd find on Amazon — polished, professional, with strong thumbnail readability. Use cinematic lighting, subtle textures, and premium finishes. No real human faces. Portrait orientation (tall book format).${bookContext}${brandSection}${customSection}${avoidSection}${variantSection} CRITICAL: The cover art, imagery, and visual metaphors must be UNIQUE to this specific book's subject matter. Do NOT use generic category imagery — create visuals that could ONLY belong to this particular book.`;
}

async function runStep(projectId: number, stepName: string, model: string, fn: () => Promise<{ result: any; tokens: number; costOverride?: number }>) {
  const step = await storage.createRunStep({
    projectId,
    stepName,
    model,
    status: "running",
    tokensUsed: 0,
    costEstimate: 0,
  });
  const start = Date.now();
  try {
    const { result, tokens, costOverride } = await fn();
    const cost = costOverride ?? estimateCost(tokens, model);
    await storage.updateRunStep(step.id, {
      status: "complete",
      tokensUsed: tokens,
      costEstimate: cost,
      durationMs: Date.now() - start,
    });
    const allSteps = await storage.getRunSteps(projectId);
    const completedSteps = allSteps.filter(s => s.status === "complete");
    const totalTokens = completedSteps.reduce((sum, s) => sum + s.tokensUsed, 0);
    const totalCost = completedSteps.reduce((sum, s) => sum + s.costEstimate, 0);
    await storage.updateProject(projectId, { totalTokens, estimatedCost: totalCost } as any);
    return result;
  } catch (err: any) {
    await storage.updateRunStep(step.id, {
      status: "failed",
      errorMessage: err.message,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

async function evaluateChapterQuality(chapterContent: string, title: string, vertical: string): Promise<number> {
  try {
    const runtime = getConfig();
    const prompt = `Rate this chapter on a scale of 1-10 based on reader fit, clarity, engagement, structure, and writing quality. The chapter is from a ${vertical} book, titled "${title}".

Chapter content (first 2000 chars):
${chapterContent.slice(0, 2000)}

Return ONLY JSON: { "score": <number 1-10>, "reason": "<brief one-sentence justification>" }`;

    let raw: string;
    const preferLocal = runtime.studio.runtimeMode === "off-grid" || runtime.studio.runtimeMode === "hybrid";
    if (preferLocal && await isOllamaAvailable()) {
      raw = await ollamaChat({
        model: runtime.ollama.model,
        temperature: 0.1,
        messages: [
          { role: "system", content: "You are Redactor's lightweight quality evaluator. Return strict JSON only." },
          { role: "user", content: prompt },
        ],
      });
    } else {
      if (runtime.studio.runtimeMode === "off-grid") {
        throw new Error("Cannot evaluate chapter quality in off-grid mode because Ollama is unavailable.");
      }
      const completion = await openai.chat.completions.create({
        model: FAST_MODEL,
        messages: [
          { role: "system", content: "You are a professional book editor and quality evaluator. Respond ONLY with valid JSON." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 256,
        response_format: { type: "json_object" },
      });
      raw = completion.choices[0].message.content || "{}";
    }

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
    const score = parseFloat(parsed.score);
    if (isNaN(score) || score < 1 || score > 10) return 7.0;
    return Math.round(score * 10) / 10;
  } catch {
    return 7.0;
  }
}

function reportContinuityWarning(res: Response, context: string, error: any) {
  const message = error?.message || "Continuity archive failed";
  console.error(`${context}:`, message);
  res.setHeader(
    "X-Lexora-Continuity-Warning",
    encodeURIComponent(`${context}: ${message}`.slice(0, 300)),
  );
}

const trendAnalyzeSchema = z.object({
  vertical: z.string().min(1, "Vertical is required"),
  keywords: z.string().optional().default(""),
});

const studioPropertyCreateSchema = z.object({
  workingTitle: z.string().min(1).max(300),
  canonicalTitle: z.string().max(300).nullable().optional(),
  status: z.string().min(1).optional(),
  format: z.string().min(1).optional(),
  seriesIntent: z.string().min(1).optional(),
  legacyVertical: z.string().nullable().optional(),
  classification: z.record(z.any()).optional(),
  targetContract: z.record(z.any()).optional(),
}).strict();

const studioPropertyPatchSchema = studioPropertyCreateSchema.partial();

const artifactCreateSchema = z.object({
  type: z.string().min(1).max(120),
  chapterId: z.number().int().positive().nullable().optional(),
  parentArtifactId: z.string().nullable().optional(),
  createdBy: z.string().min(1).optional(),
  runtimeId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  promptVersion: z.string().nullable().optional(),
  context: z.record(z.any()).optional(),
  content: z.any(),
  estimatedCostUsd: z.number().min(0).nullable().optional(),
  state: z.string().min(1).optional(),
}).strict();

const continuityBodySchema = z.object({
  state: z.record(z.any()),
  lastAcceptedChapterId: z.number().int().positive().nullable().optional(),
}).strict();

const conceptDossierCreateSchema = z.object({
  propertyId: z.string().nullable().optional(),
  sourceType: z.string().min(1),
  source: z.record(z.any()).optional(),
  dossier: z.record(z.any()),
  status: z.string().optional(),
}).strict();

const triadDrawRequestSchema = z.object({
  mode: z.enum(["pure-chaos", "intelligent-draw", "forbidden-combination"]).optional(),
  contextTags: z.array(z.string()).optional(),
  context: z.object({
    audience: z.string().optional(),
    format: z.string().optional(),
    genre: z.string().optional(),
    topic: z.string().optional(),
    tone: z.string().optional(),
    purpose: z.string().optional(),
    ageBand: z.string().optional(),
    maturity: z.string().optional(),
    seriesIntent: z.string().optional(),
    marketObjective: z.string().optional(),
    language: z.string().optional(),
    additionalNotes: z.string().optional(),
  }).optional(),
  locked: z.record(z.any()).optional(),
  wildcardChance: z.number().min(0).max(1).optional(),
}).strict();

const triadSynthesisRequestSchema = z.object({
  drawId: z.string().min(1),
  context: z.object({
    audience: z.string().optional(),
    format: z.string().optional(),
    genre: z.string().optional(),
    topic: z.string().optional(),
    tone: z.string().optional(),
    purpose: z.string().optional(),
    ageBand: z.string().optional(),
    maturity: z.string().optional(),
    seriesIntent: z.string().optional(),
    marketObjective: z.string().optional(),
    language: z.string().optional(),
    additionalNotes: z.string().optional(),
  }).optional(),
}).strict();

const conceptDossierFromDirectionSchema = z.object({
  synthesisRunId: z.string().min(1),
  directionId: z.string().min(1),
  propertyId: z.string().nullable().optional(),
}).strict();

const conceptDossierGreenlightSchema = z.object({
  dossierId: z.string().min(1),
}).strict();

const savedIdeaFromDirectionSchema = z.object({
  synthesisRunId: z.string().min(1),
  directionId: z.string().min(1),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
}).strict();

const manualSavedIdeaSchema = z.object({
  title: z.string().trim().min(1).max(300),
  premise: z.string().trim().max(5000).optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
}).strict();

const savedIdeaPatchSchema = z.object({
  status: z.enum(["saved", "archived"]).optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
  favorite: z.boolean().optional(),
}).strict();

const conceptDirectionSelectSchema = z.object({
  directionId: z.string().min(1),
}).strict();

const patchProjectSchema = z.object({
  title: z.string().min(1).optional(),
  authorName: z.string().optional(),
  vertical: z.string().optional(),
  targetLanguage: z.string().optional(),
  status: z.string().optional(),
  greenlightScore: z.number().min(0).max(10).nullable().optional(),
  qualityScore: z.number().min(0).max(10).nullable().optional(),
  totalTokens: z.number().int().min(0).optional(),
  estimatedCost: z.number().min(0).optional(),
  wordCount: z.number().int().min(0).optional(),
  chapterCount: z.number().int().min(0).optional(),
  coverImageUrl: z.string().nullable().optional(),
  seriesId: z.number().int().positive().nullable().optional(),
  styleFingerprintId: z.number().int().positive().nullable().optional(),
  brandKitId: z.number().int().positive().nullable().optional(),
  priceUsd: z.number().min(0).max(9999).optional(),
}).strict();

const outlineChapterSchema = z.object({
  chapterNumber: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  blueprint: z.string().trim().min(20).max(6000),
});

const outlineResultSchema = z.object({
  corePromise: z.string().trim().min(1),
  readerAvatar: z.string().trim().min(1),
  toneRules: z.string().trim().min(1),
  transformationArc: z.string().trim().min(1),
  frameworkSummary: z.string().trim().min(1),
  chapters: z.array(outlineChapterSchema).min(1).max(30),
});

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const id = parseInt(value, 10);
  return isNaN(id) || id < 1 ? null : id;
}

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many AI requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: { error: "Too many authentication attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

async function ensureAdminUser() {
  const { admin, production } = getConfig();
  const existing = await storage.getUserByUsername(admin.username);
  const recoveryPassword = process.env.ADMIN_PASSWORD_RESET?.trim();

  if (recoveryPassword && recoveryPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD_RESET must be at least 12 characters.");
  }

  if (existing) {
    if (recoveryPassword) {
      const hashed = await bcrypt.hash(recoveryPassword, 12);
      await storage.updateUserPassword(existing.id, hashed);
      console.warn("Admin password reset from ADMIN_PASSWORD_RESET. Clear the variable after recovery.");
    }
    return;
  }

  const bootstrapPassword = recoveryPassword || admin.initialPassword;
  if (!bootstrapPassword) {
    throw new Error(
      `No admin account exists for "${admin.username}". Set ADMIN_INITIAL_PASSWORD before first boot.`,
    );
  }

  const hashed = await bcrypt.hash(bootstrapPassword, 12);
  await storage.createUser({ username: admin.username, password: hashed });
  console.log(
    `Admin user created (username: ${admin.username})${production ? "" : " for local development"}`,
  );
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.role === "admin" && req.session?.adminId) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}

function requireStoreAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session?.role === "admin" && req.session?.adminId) ||
      (req.session?.role === "reader" && req.session?.readerId)) {
    return next();
  }
  return res.status(401).json({ error: "Store login required" });
}

type WorkspaceRole = "owner" | "editor" | "viewer";
const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 1, editor: 2, owner: 3 };

// Resolve the workspace role of the currently authenticated admin-session user.
// Resolution order: an explicit workspaceMembers row wins; otherwise only the
// bootstrap "admin" account falls back to owner (so existing single-user installs
// keep working). Any other authenticated user without a membership row is treated
// as a viewer — this prevents privilege escalation for removed/unlisted users.
async function getWorkspaceRole(req: Request): Promise<WorkspaceRole | null> {
  const uid = req.session?.adminId;
  if (!uid) return null;
  try {
    const members = await storage.getWorkspaceMembers();
    const member = members.find(m => m.userId === uid);
    if (member && (member.role === "owner" || member.role === "editor" || member.role === "viewer")) {
      return member.role;
    }
    const user = await storage.getUser(uid);
    return user?.username === getConfig().admin.username ? "owner" : "viewer";
  } catch {
    return "viewer";
  }
}

// Gate a route so only members at or above the minimum role may proceed.
function requireRole(minRole: WorkspaceRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const role = await getWorkspaceRole(req);
    if (!role) return res.status(401).json({ error: "Authentication required" });
    if (ROLE_RANK[role] >= ROLE_RANK[minRole]) return next();
    return res.status(403).json({ error: `This action requires ${minRole} access or higher` });
  };
}

// Snapshot the current saved state of a chapter into the version timeline so it
// can be diffed and rolled back to later. Deduplicates against the most recent
// version to avoid noise from no-op saves. Never throws into the request path.
async function captureChapterVersion(chapterId: number, note: string) {
  try {
    const chapter = await storage.getChapter(chapterId);
    if (!chapter) return;
    const versions = await storage.getChapterVersions(chapterId);
    const latest = versions[0];
    if (latest && latest.title === chapter.title && (latest.content || "") === (chapter.content || "")) {
      return;
    }
    await storage.createChapterVersion({
      chapterId,
      projectId: chapter.projectId,
      title: chapter.title,
      content: chapter.content ?? null,
      wordCount: chapter.wordCount,
      versionNote: note,
    });
  } catch (err) {
    console.error("captureChapterVersion failed:", err);
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const config = getConfig();
  await ensureAdminUser();

  // API payloads are live application state. Do not let browser/proxy ETags
  // turn polling into body-less 304 responses that can strand the UI on stale data.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // Long-running chapter writes are detached from the browser request.
  // The token is also a generation epoch: an old/cancelled job may finish at
  // the provider, but it is never allowed to overwrite newer manuscript state.
  type ChapterGenerationJob = { cancelled: boolean; startedAt: number };
  type OutlineGenerationJob = { cancelled: boolean; startedAt: number; previousStatus: string };
  const chapterGenerationJobs = new Map<number, ChapterGenerationJob>();
  const outlineGenerationJobs = new Map<number, OutlineGenerationJob>();

  // In-memory work cannot survive a process restart. Recover only the transient
  // "generating" marker; never touch completed manuscript content.
  try {
    let recoveredChapters = 0;
    let recoveredProjects = 0;
    const transientProjectStates = new Set(["trend_analysis", "outlining", "marketing"]);
    for (const project of await storage.getProjects()) {
      const projectChapters = await storage.getChapters(project.id);
      const projectRunSteps = await storage.getRunSteps(project.id);
      for (const step of projectRunSteps) {
        if (step.status === "running") {
          await storage.updateRunStep(step.id, {
            status: "failed",
            errorMessage: "Interrupted by a service restart. The saved project data is safe; retry this step when ready.",
          });
        }
      }
      for (const chapter of projectChapters) {
        if (chapter.status === "generating") {
          await storage.updateChapter(chapter.id, { status: "pending" });
          recoveredChapters++;
        }
      }

      // A process restart bypasses route-level catch/finally blocks. Derive a
      // stable project state only from durable chapter data; never delete work.
      if (transientProjectStates.has(project.status)) {
        const hasChapters = projectChapters.length > 0;
        const allComplete = hasChapters && projectChapters.every((chapter) => chapter.status === "complete");
        const stableStatus = !hasChapters ? "draft" : allComplete ? "editing" : "writing";
        await storage.updateProject(project.id, { status: stableStatus });
        recoveredProjects++;
      }
    }
    if (recoveredChapters > 0 || recoveredProjects > 0) {
      console.warn(`Recovered interrupted workflows after restart: ${recoveredChapters} chapter job(s), ${recoveredProjects} project workflow(s).`);
    }
  } catch (err: any) {
    console.error("Workflow recovery warning:", err?.message || err);
  }

  // Private Studio mode keeps historical storefront data readable to admins but
  // removes the public storefront surface from normal runtime.
  if (config.studio.privateMode) {
    app.use("/api/store", (req, res, next) => {
      if (req.session?.role === "admin" && req.session?.adminId) return next();
      return res.status(404).json({ error: "Storefront is disabled in private studio mode" });
    });
  }

  // Gate premium chapter audio: files at /uploads/audio/.../project-{id}-chapter-{id}.mp3
  // have predictable paths, so re-check book access before serving for paid books.
  app.get(/^\/uploads\/audio\/.*\.mp3$/, async (req, res, next) => {
    try {
      // Edition (translated) audio is admin-only — block public static access.
      if (/edition-\d+-chapter-\d+\.mp3$/.test(req.path)) {
        if (req.session?.role === "admin" && req.session?.adminId) return next();
        return res.status(401).json({ error: "Authentication required" });
      }
      const m = req.path.match(/project-(\d+)-chapter-\d+\.mp3$/);
      if (!m) return next();
      const project = await storage.getProject(parseInt(m[1], 10));
      if (!project || (project.priceUsd || 0) <= 0) return next();
      const isAdmin = req.session?.role === "admin" && !!req.session?.adminId;
      if (isAdmin) return next();
      const readerId = req.session?.role === "reader" ? req.session.readerId ?? null : null;
      if (await readerHasBookAccess(readerId, project)) return next();
      return res.status(403).json({ error: "Purchase required to access this audio" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Studio media (audiobooks/trailers) is admin-only — block public static access.
  // The admin browser carries a session cookie, so inline <audio>/<video> and the
  // gated /api/media-assets/:id/download route still work for authenticated admins.
  app.get(/^\/uploads\/media\/.*/, (req, res, next) => {
    if (req.session?.role === "admin" && req.session?.adminId) return next();
    return res.status(401).json({ error: "Authentication required" });
  });

  app.use("/uploads", express.static(path.resolve("uploads")));

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.adminId = user.id;
      req.session.role = "admin";
      res.json({ ok: true, username: user.username });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/change-password", authRateLimit, requireAdmin, async (req, res) => {
    try {
      const parsed = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(12).max(128),
      }).safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: "New password must be 12 to 128 characters." });
      }

      const user = await storage.getUser(req.session.adminId!);
      if (!user) {
        return res.status(404).json({ error: "Admin account not found" });
      }

      const currentValid = await bcrypt.compare(parsed.data.currentPassword, user.password);
      if (!currentValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const unchanged = await bcrypt.compare(parsed.data.newPassword, user.password);
      if (unchanged) {
        return res.status(400).json({ error: "Choose a different password" });
      }

      const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
      await storage.updateUserPassword(user.id, hashed);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session?.role === "admin" && req.session?.adminId) {
      return res.json({ authenticated: true, role: "admin" });
    }
    return res.status(401).json({ authenticated: false });
  });

  app.post("/api/storefront-auth/register", async (req, res) => {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      const existing = await storage.getStorefrontReaderByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      const hashed = await bcrypt.hash(password, 12);
      const reader = await storage.createStorefrontReader({
        email,
        password: hashed,
        displayName: displayName || "Reader",
      });
      req.session.readerId = reader.id;
      req.session.role = "reader";
      res.json({ ok: true, displayName: reader.displayName, email: reader.email });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/storefront-auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      const reader = await storage.getStorefrontReaderByEmail(email);
      if (!reader) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(password, reader.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.readerId = reader.id;
      req.session.role = "reader";
      res.json({ ok: true, displayName: reader.displayName, email: reader.email });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/storefront-auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/storefront-auth/me", (req, res) => {
    if (req.session?.role === "reader" && req.session?.readerId) {
      return res.json({ authenticated: true, role: "reader" });
    }
    if (req.session?.role === "admin" && req.session?.adminId) {
      return res.json({ authenticated: true, role: "admin" });
    }
    return res.status(401).json({ authenticated: false });
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const aiPaths = [
      /\/api\/projects\/\d+\/generate-outline/,
      /\/api\/projects\/\d+\/chapters\/\d+\/generate/,
      /\/api\/projects\/\d+\/chapters\/\d+\/revise/,
      /\/api\/projects\/\d+\/chapters\/\d+\/editorial-board/,
      /\/api\/projects\/\d+\/chapters\/\d+\/humanize/,
      /\/api\/projects\/\d+\/chapters\/\d+\/beta-readers/,
      /\/api\/projects\/\d+\/generate-cover/,
      /\/api\/projects\/\d+\/cover-variants$/,
      /\/api\/projects\/\d+\/chapters\/\d+\/generate-audio/,
      /\/api\/projects\/\d+\/generate-audiobook/,
      /\/api\/projects\/\d+\/extract-graph/,
      /\/api\/projects\/\d+\/analyze-pacing/,
      /\/api\/projects\/\d+\/chapters\/\d+\/inline-ai/,
      /\/api\/projects\/\d+\/competitor-teardown/,
      /\/api\/projects\/\d+\/kdp-optimizer/,
      /\/api\/projects\/\d+\/ab-test$/,
      /\/api\/projects\/\d+\/launch-schedule$/,
      /\/api\/series\/\d+\/bible/,
    ];
    if (
      req.path === "/api/tts" ||
      req.path === "/api/fish-tts" ||
      req.path === "/api/autopilot/run" ||
      (req.method === "POST" && req.path === "/api/style-fingerprints") ||
      aiPaths.some(p => p.test(req.path))
    ) {
      return aiRateLimit(req, res, next);
    }
    return next();
  });

  const adminApiPaths = [
    "/api/dashboard", "/api/library", "/api/invites", "/api/projects",
    "/api/trends", "/api/autopilot", "/api/settings", "/api/book-requests",
    "/api/conversations", "/api/elevenlabs", "/api/notifications",
  ];

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/auth/") || req.path.startsWith("/api/storefront-auth/")) {
      return next();
    }
    // Public referral click tracking — fired by anonymous storefront visitors
    // before they log in. Only matches the click sub-path, not admin /api/referrals.
    if (req.method === "POST" && /^\/api\/ref\/[^/]+\/click$/.test(req.path)) {
      return next();
    }
    if (req.path.startsWith("/api/store/")) {
      if (req.session?.role === "reader" || req.session?.role === "admin") {
        return next();
      }
      return res.status(401).json({ error: "Reader login required" });
    }
    if (req.path.startsWith("/api/")) {
      return requireAdmin(req, res, next);
    }
    return next();
  });

  app.get("/api/dashboard", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const allProjects = await storage.getProjects();
      const inProgress = allProjects.filter(p => p.status !== "complete");
      const recentRaw = inProgress.slice(0, 5);
      const recentProjects = await Promise.all(recentRaw.map(async (p) => {
        const chapters = await storage.getChapters(p.id);
        const trend = await storage.getTrendReportByProject(p.id);
        const marketing = await storage.getMarketingAsset(p.id);
        const completedChapters = chapters.filter(c => c.status === "complete").length;
        return {
          ...p,
          totalChapters: chapters.length,
          completedChapters,
          hasTrend: !!trend,
          hasCover: !!p.coverImageUrl,
          hasMarketing: !!marketing,
        };
      }));
      const recentTrends = await storage.getTrendReports();
      res.json({ stats, recentProjects, recentTrends: recentTrends.slice(0, 3) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/library", async (_req, res) => {
    try {
      const allProjects = await storage.getProjects();
      const completed = allProjects.filter(p => p.status === "complete" || p.status === "editing");
      const library = await Promise.all(completed.map(async (project) => {
        const marketing = await storage.getMarketingAsset(project.id);
        const chapterList = await storage.getChapters(project.id);
        const editionList = await storage.getBookEditions(project.id);
        const { coverImageUrl, ...rest } = project;
        return {
          ...rest,
          hasCover: !!coverImageUrl,
          shortBlurb: marketing?.shortBlurb || null,
          chapterCount: chapterList.length,
          completedChapters: chapterList.filter(c => c.status === "complete").length,
          chaptersWithAudio: chapterList.filter(c => !!c.audioUrl).length,
          editionLanguages: editionList.filter(e => e.status === "complete").map(e => e.language),
        };
      }));
      res.json(library);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/invites", async (_req, res) => {
    try {
      const tokens = await storage.getInviteTokens();
      res.json(tokens);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/invites", async (req, res) => {
    try {
      const label = req.body.label || "Reader Invite";
      const token = crypto.randomBytes(16).toString("hex");
      const invite = await storage.createInviteToken({ token, label, isActive: true });
      res.json(invite);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/invites/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid invite ID" });
    try {
      await storage.deleteInviteToken(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/store/:token", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }
      await storage.incrementInviteViewCount(invite.id);
      const allProjects = await storage.getProjects();
      const completed = allProjects.filter(p => p.publishedToStore === true);
      const books = await Promise.all(completed.map(async (project) => {
        const marketing = await storage.getMarketingAsset(project.id);
        const chapterList = await storage.getChapters(project.id);
        return {
          id: project.id,
          title: project.title,
          authorName: project.authorName,
          vertical: project.vertical,
          hasCover: !!project.coverImageUrl,
          wordCount: project.wordCount,
          chapterCount: chapterList.length,
          qualityScore: project.qualityScore,
          shortBlurb: marketing?.shortBlurb || null,
          mediumBlurb: marketing?.mediumBlurb || null,
          priceUsd: project.priceUsd || 0,
        };
      }));
      res.json({ books, inviteLabel: invite.label });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/store/:token/cover/:bookId", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) {
        return res.status(404).json({ error: "Invalid invite" });
      }
      const bookId = parseId(req.params.bookId);
      if (!bookId) return res.status(400).json({ error: "Invalid book ID" });
      const project = await storage.getProject(bookId);
      if (!project || !project.publishedToStore || !project.coverImageUrl) {
        return res.status(404).send();
      }
      const match = project.coverImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        return res.redirect(project.coverImageUrl);
      }
      const ext = match[1];
      const buf = Buffer.from(match[2], "base64");
      res.set("Content-Type", `image/${ext}`);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/store/:token/book/:bookId", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) {
        return res.status(404).json({ error: "Invalid invite" });
      }
      const bookId = parseId(req.params.bookId);
      if (!bookId) return res.status(400).json({ error: "Invalid book ID" });
      const project = await storage.getProject(bookId);
      if (!project || !project.publishedToStore) {
        return res.status(404).json({ error: "Book not found" });
      }
      const chapterList = await storage.getChapters(bookId);
      const marketing = await storage.getMarketingAsset(bookId);

      const isAdmin = req.session?.role === "admin";
      const readerId = req.session?.role === "reader" ? req.session.readerId ?? null : null;
      const hasAccess = isAdmin || (await readerHasBookAccess(readerId, project));
      const locked = (project.priceUsd || 0) > 0 && !hasAccess;

      storage.createAnalyticsEvent({ projectId: bookId, eventType: "read", value: 1, metadata: { token: req.params.token } }).catch(() => {});

      const completed = chapterList.filter(c => c.status === "complete");
      const chapters = completed.map((c, idx) => {
        // Locked premium books expose only a short preview of the first chapter.
        let content = c.content;
        if (locked) {
          content = idx === 0 && c.content ? c.content.slice(0, 600) + "\u2026" : null;
        }
        return {
          id: c.id,
          chapterNumber: c.chapterNumber,
          title: c.title,
          content,
          wordCount: c.wordCount,
          status: c.status,
        };
      });

      res.json({
        id: project.id,
        title: project.title,
        authorName: project.authorName,
        vertical: project.vertical,
        coverImageUrl: project.coverImageUrl,
        wordCount: project.wordCount,
        qualityScore: project.qualityScore,
        shortBlurb: marketing?.shortBlurb || null,
        mediumBlurb: marketing?.mediumBlurb || null,
        priceUsd: project.priceUsd || 0,
        locked,
        hasAccess,
        chapters,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/store/:token/request", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) {
        return res.status(404).json({ error: "Invalid invite" });
      }
      const { readerName, genre, description } = req.body;
      if (!genre || !description) {
        return res.status(400).json({ error: "Genre and description are required" });
      }
      if (typeof description !== "string" || description.length > 1000) {
        return res.status(400).json({ error: "Description must be under 1000 characters" });
      }
      const request = await storage.createBookRequest({
        inviteToken: req.params.token,
        readerName: (readerName && typeof readerName === "string" ? readerName.trim() : "") || "Anonymous",
        genre: genre.trim(),
        description: description.trim(),
      });
      res.status(201).json(request);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Storefront commerce (checkout, memberships, access) ----

  function storeBaseUrl(req: Request): string {
    const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
    return `${proto}://${req.get("host")}`;
  }

  app.get("/api/store/:token/tiers", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) return res.status(404).json({ error: "Invalid invite" });
      const tiers = (await storage.getMembershipTiers()).filter(t => t.isActive);
      res.json(tiers.map(t => ({ id: t.id, name: t.name, priceUsd: t.priceUsd, benefits: t.benefits })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/store/:token/access", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) return res.status(404).json({ error: "Invalid invite" });
      if (req.session?.role === "admin") {
        return res.json({ ownedBookIds: [], activeMembership: true, isAdmin: true });
      }
      const readerId = req.session?.readerId ?? null;
      if (!readerId) return res.json({ ownedBookIds: [], activeMembership: false, isAdmin: false });
      const memberships = await storage.getReaderMemberships(readerId);
      const activeMembership = memberships.some(
        m => m.status === "active" && (!m.currentPeriodEnd || m.currentPeriodEnd.getTime() > Date.now()),
      );
      const orders = await storage.getStorefrontOrders();
      const ownedBookIds = Array.from(new Set(
        orders.filter(o => o.readerId === readerId && o.status === "complete" && o.projectId).map(o => o.projectId as number),
      ));
      res.json({ ownedBookIds, activeMembership, isAdmin: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/store/:token/checkout", async (req, res) => {
    try {
      if (!config.studio.commerceEnabled) {
        return res.status(410).json({ error: "Commerce is disabled in private studio mode" });
      }
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) return res.status(404).json({ error: "Invalid invite" });
      if (req.session?.role !== "reader" || !req.session.readerId) {
        return res.status(401).json({ error: "Reader login required" });
      }
      const rawIds: unknown = req.body?.bookIds ?? (req.body?.bookId != null ? [req.body.bookId] : []);
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return res.status(400).json({ error: "Provide bookId or bookIds" });
      }
      const ids = Array.from(new Set(rawIds.map((x: any) => parseInt(String(x), 10)).filter(n => !isNaN(n) && n > 0)));
      if (ids.length === 0) return res.status(400).json({ error: "Invalid book IDs" });

      const projects = [];
      for (const id of ids) {
        const p = await storage.getProject(id);
        if (!p || !p.publishedToStore) return res.status(404).json({ error: `Book ${id} not available` });
        if ((p.priceUsd || 0) <= 0) return res.status(400).json({ error: `Book "${p.title}" is free` });
        projects.push(p);
      }
      const refCode = typeof req.body?.refCode === "string" ? req.body.refCode.trim().slice(0, 64) : null;
      const { createBookCheckout } = await import("./commerce");
      const url = await createBookCheckout({
        projects,
        readerId: req.session.readerId,
        token: req.params.token,
        baseUrl: storeBaseUrl(req),
        refCode,
      });
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/store/:token/membership-checkout", async (req, res) => {
    try {
      if (!config.studio.commerceEnabled) {
        return res.status(410).json({ error: "Commerce is disabled in private studio mode" });
      }
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) return res.status(404).json({ error: "Invalid invite" });
      if (req.session?.role !== "reader" || !req.session.readerId) {
        return res.status(401).json({ error: "Reader login required" });
      }
      const tierId = parseInt(String(req.body?.tierId), 10);
      if (isNaN(tierId) || tierId < 1) return res.status(400).json({ error: "Invalid tier ID" });
      const tier = (await storage.getMembershipTiers()).find(t => t.id === tierId);
      if (!tier || !tier.isActive) return res.status(404).json({ error: "Tier not found" });
      const { createMembershipCheckout, syncTierStripePrice } = await import("./commerce");
      const priceId = tier.stripePriceId || (await syncTierStripePrice(tier));
      const refCode = typeof req.body?.refCode === "string" ? req.body.refCode.trim().slice(0, 64) : null;
      const url = await createMembershipCheckout({
        tier,
        priceId,
        readerId: req.session.readerId,
        token: req.params.token,
        baseUrl: storeBaseUrl(req),
        refCode,
      });
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/store/:token/checkout/verify", async (req, res) => {
    try {
      if (!config.studio.commerceEnabled) {
        return res.status(410).json({ error: "Commerce is disabled in private studio mode" });
      }
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite || !invite.isActive) return res.status(404).json({ error: "Invalid invite" });
      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).json({ error: "Missing session_id" });
      const { verifyAndFulfillSession } = await import("./commerce");
      const result = await verifyAndFulfillSession(sessionId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/book-requests", async (_req, res) => {
    try {
      const requests = await storage.getBookRequests();
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/book-requests/:id/read", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid request ID" });
      await storage.markBookRequestRead(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/book-requests/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid request ID" });
      await storage.deleteBookRequest(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Admin: membership tiers & storefront orders ----

  app.get("/api/membership-tiers", async (_req, res) => {
    try {
      res.json(await storage.getMembershipTiers());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const tierBodySchema = z.object({
    name: z.string().min(1).max(120),
    priceUsd: z.number().min(0).max(9999),
    benefits: z.array(z.string()).nullable().optional(),
    isActive: z.boolean().optional(),
  }).strict();

  app.post("/api/membership-tiers", async (req, res) => {
    try {
      const data = tierBodySchema.parse(req.body);
      const tier = await storage.createMembershipTier({
        name: data.name,
        priceUsd: data.priceUsd,
        benefits: data.benefits ?? null,
        isActive: data.isActive ?? true,
        stripePriceId: null,
      });
      let synced = tier;
      if (config.studio.commerceEnabled) {
        try {
          const { syncTierStripePrice } = await import("./commerce");
          const priceId = await syncTierStripePrice(tier);
          synced = { ...tier, stripePriceId: priceId };
        } catch (e: any) {
          console.error("Tier Stripe sync failed (saved without price):", e?.message || e);
        }
      }
      res.status(201).json(synced);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/membership-tiers/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid tier ID" });
      const data = tierBodySchema.partial().parse(req.body);
      const updated = await storage.updateMembershipTier(id, data);
      // Re-sync price only when commerce is explicitly enabled.
      if (config.studio.commerceEnabled && data.priceUsd != null && (updated.priceUsd || 0) > 0) {
        try {
          const { syncTierStripePrice } = await import("./commerce");
          const priceId = await syncTierStripePrice(updated);
          if (priceId !== updated.stripePriceId) updated.stripePriceId = priceId;
        } catch (e: any) {
          console.error("Tier Stripe re-sync failed:", e?.message || e);
        }
      }
      res.json(updated);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/orders", async (_req, res) => {
    try {
      res.json(await storage.getStorefrontOrders());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Referral & affiliate program ----

  async function generateReferralCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(6).toString("base64url").slice(0, 8);
      const existing = await storage.getReferralByCode(code);
      if (!existing) return code;
    }
    throw new Error("Could not generate a unique referral code");
  }

  // Public: record a click on a referral link (anonymous visitors).
  app.post("/api/ref/:code/click", async (req, res) => {
    try {
      const code = String(req.params.code || "").trim();
      const referral = await storage.getReferralByCode(code);
      if (!referral) return res.status(404).json({ error: "Unknown referral code" });
      await storage.incrementReferralClick(referral.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: list all referrals.
  app.get("/api/referrals", async (_req, res) => {
    try {
      res.json(await storage.getReferrals());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const referralBodySchema = z.object({
    code: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only").optional(),
    readerId: z.number().int().positive().nullable().optional(),
  }).strict();

  // Admin: create a referral link (auto-generates a code if none supplied).
  app.post("/api/referrals", async (req, res) => {
    try {
      const data = referralBodySchema.parse(req.body || {});
      let code = data.code;
      if (code) {
        const existing = await storage.getReferralByCode(code);
        if (existing) return res.status(409).json({ error: "That referral code is already in use" });
      } else {
        code = await generateReferralCode();
      }
      const created = await storage.createReferral({ code, readerId: data.readerId ?? null });
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: delete a referral.
  app.delete("/api/referrals/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid referral ID" });
      await storage.deleteReferral(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Launch automation ----

  app.get("/api/projects/:id/launch-schedules", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      res.json(await storage.getLaunchSchedules(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const launchGenerateSchema = z.object({
    launchDate: z.string().min(1),
    channels: z.array(z.string().min(1)).max(8).optional(),
  }).strict();

  app.post("/api/projects/:id/launch-schedule", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      if (!projectId) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const body = launchGenerateSchema.parse(req.body || {});
      const launchDate = new Date(body.launchDate);
      if (isNaN(launchDate.getTime())) return res.status(400).json({ error: "Invalid launch date" });

      const dna = await storage.getBookDna(projectId);
      const marketing = await storage.getMarketingAsset(projectId);

      const items = await runStep(
        projectId,
        "Launch Plan",
        FAST_MODEL,
        async () => {
          const { items, tokens } = await generateLaunchPlan({
            project,
            dna,
            marketing,
            launchDate,
            channels: body.channels ?? [],
          });
          return { result: items, tokens };
        },
      );

      const saved = await storage.createLaunchSchedule({
        projectId,
        launchDate,
        items,
        status: "scheduled",
      });
      res.status(201).json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      if (err?.name === "ZodError") return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: err.message });
    }
  });

  // Mark items whose scheduled time has passed as "sent" (simulated dispatch —
  // no live ESP/social posting). Returns the updated schedule.
  app.post("/api/launch-schedules/:id/process", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid schedule ID" });
      const projectId = parseId(req.body?.projectId);
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const schedules = await storage.getLaunchSchedules(projectId);
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });

      const now = Date.now();
      const items = (Array.isArray(schedule.items) ? schedule.items : []) as LaunchItem[];
      let dispatched = 0;
      const updated = items.map(item => {
        if (item.status !== "sent" && new Date(item.scheduledAt).getTime() <= now) {
          dispatched++;
          return { ...item, status: "sent" as const };
        }
        return item;
      });
      const allSent = updated.length > 0 && updated.every(i => i.status === "sent");
      const saved = await storage.updateLaunchSchedule(id, {
        items: updated,
        status: allSent ? "complete" : "scheduled",
      });
      res.json({ schedule: saved, dispatched });
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/launch-schedules/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid schedule ID" });
      const projectId = parseId(String(req.query.projectId ?? ""));
      if (!projectId) return res.status(400).json({ error: "projectId is required" });
      const schedules = await storage.getLaunchSchedules(projectId);
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      await storage.updateLaunchSchedule(id, { status: "cancelled" });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects", async (_req, res) => {
    try {
      const allList = await storage.getProjects();
      const list = allList.filter(p => p.status !== "complete");
      const enriched = await Promise.all(list.map(async (p) => {
        const chapters = await storage.getChapters(p.id);
        const trend = await storage.getTrendReportByProject(p.id);
        const marketing = await storage.getMarketingAsset(p.id);
        const { coverImageUrl, ...rest } = p;
        return {
          ...rest,
          totalChapters: chapters.length,
          completedChapters: chapters.filter(c => c.status === "complete").length,
          hasTrend: !!trend,
          hasCover: !!coverImageUrl,
          hasMarketing: !!marketing,
          chaptersWithAudio: chapters.filter(c => !!c.audioUrl).length,
        };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/suggest-titles", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title || typeof title !== "string" || title.trim().length < 3) {
        return res.status(400).json({ error: "Title is required and must be at least 3 characters" });
      }
      const completion = await openai.chat.completions.create({
        model: FAST_MODEL,
        messages: [{
          role: "system",
          content: "You are a creative book title generator. Generate 5 alternative and compelling book titles based on the given title. Return ONLY a JSON object with a 'titles' array containing exactly 5 strings. No other text.",
        }, {
          role: "user",
          content: `Generate 5 alternative titles similar to or inspired by: "${title.trim()}"`,
        }],
        max_completion_tokens: 500,
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0].message.content || "{}";
      const parsed = JSON.parse(content);
      const suggestions = (parsed.titles || []).filter((t: any) => typeof t === "string" && t.length > 0).slice(0, 5);
      res.json({ suggestions });
    } catch (err: any) {
      console.error("Title suggestion error:", err.message);
      res.status(500).json({ error: "Failed to generate title suggestions" });
    }
  });

  app.post("/api/projects/suggest-genres", async (req, res) => {
    try {
      const input = z.object({
        title: z.string().max(200).optional().default(""),
        description: z.string().max(2000).optional().default(""),
        targetAudience: z.string().max(500).optional().default(""),
        toneStyle: z.string().max(500).optional().default(""),
        keyThemes: z.string().max(800).optional().default(""),
        comparableTitles: z.string().max(500).optional().default(""),
        selectedGenres: z.array(z.enum(VERTICALS)).max(6).optional().default([]),
      }).parse(req.body);

      const context = [
        input.title && `TITLE: ${input.title}`,
        input.description && `BOOK IDEA: ${input.description}`,
        input.targetAudience && `TARGET AUDIENCE: ${input.targetAudience}`,
        input.toneStyle && `TONE / STYLE: ${input.toneStyle}`,
        input.keyThemes && `THEMES / TOPICS: ${input.keyThemes}`,
        input.comparableTitles && `COMPARABLES: ${input.comparableTitles}`,
      ].filter(Boolean).join("\n");

      if (context.trim().length < 24) {
        return res.json({ suggestions: [] });
      }

      const completion = await openai.chat.completions.create({
        model: FAST_MODEL,
        messages: [{
          role: "system",
          content: [
            "You classify books into Lexora genre IDs.",
            "Return ONLY JSON with a genres array of 1 to 5 objects.",
            "Each object must contain genre, confidence (0 to 1), and a short reason.",
            "Use only these exact genre IDs:",
            VERTICALS.join(", "),
            "Choose genres supported by the user's actual concept. Hybrid books may have multiple genres.",
            "Do not automatically honor the currently selected genres; treat them only as context and independently infer the best fit.",
          ].join("\n"),
        }, {
          role: "user",
          content: `${context}\n\nCURRENT USER SELECTIONS: ${input.selectedGenres.join(", ") || "none"}`,
        }],
        max_completion_tokens: 700,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      const allowed = new Set<string>(VERTICALS as readonly string[]);
      const seen = new Set<string>();
      const suggestions = (Array.isArray(parsed.genres) ? parsed.genres : [])
        .map((item: any) => ({
          genre: typeof item?.genre === "string" ? item.genre : "",
          confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
          reason: typeof item?.reason === "string" ? item.reason.trim().slice(0, 180) : "",
        }))
        .filter((item: any) => {
          if (!allowed.has(item.genre) || seen.has(item.genre)) return false;
          seen.add(item.genre);
          return true;
        })
        .slice(0, 5);

      res.json({ suggestions });
    } catch (err: any) {
      console.error("Genre detection error:", err.message);
      res.status(500).json({ error: "Failed to detect genres" });
    }
  });

  // ---- Revival Studio: Properties, Artifacts, Continuity, Concept Lab ----

  app.get("/api/runtime/status", async (_req, res) => {
    const localAvailable = await isOllamaAvailable();
    res.json({
      runtimeMode: config.studio.runtimeMode,
      privateStudio: config.studio.privateMode,
      commerceEnabled: config.studio.commerceEnabled,
      cloudConfigured: config.openai.configured,
      local: {
        provider: "ollama",
        model: config.ollama.model,
        available: localAvailable,
      },
    });
  });

  app.get("/api/properties", async (_req, res) => {
    try {
      res.json(await storage.getStudioProperties());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/properties", async (req, res) => {
    try {
      const data = studioPropertyCreateSchema.parse(req.body);
      const property = await storage.createStudioProperty({
        id: crypto.randomUUID(),
        workingTitle: data.workingTitle,
        canonicalTitle: data.canonicalTitle ?? null,
        status: data.status || "idea",
        format: data.format || "custom",
        seriesIntent: data.seriesIntent || "standalone",
        legacyVertical: data.legacyVertical ?? null,
        classification: data.classification || {},
        targetContract: data.targetContract || {},
      });
      res.status(201).json(property);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getStudioProperty(req.params.id);
      if (!property) return res.status(404).json({ error: "Property not found" });
      const dossiers = await storage.getConceptDossiers(property.id);
      const artifacts = await storage.getCreativeArtifacts({ propertyId: property.id });
      res.json({ property, dossiers, artifacts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/properties/:id", async (req, res) => {
    try {
      const data = studioPropertyPatchSchema.parse(req.body);
      const updated = await storage.updateStudioProperty(req.params.id, data);
      if (!updated) return res.status(404).json({ error: "Property not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/property/ensure", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      res.json(await ensurePropertyForProject(id));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/studio-context", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const property = await ensurePropertyForProject(id);
      const continuity = await storage.getContinuitySnapshot(id);
      const artifacts = await storage.getCreativeArtifacts({ projectId: id });
      res.json({
        property,
        continuity,
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          version: artifact.version,
          parentArtifactId: artifact.parentArtifactId,
          chapterId: artifact.chapterId,
          createdBy: artifact.createdBy,
          runtimeId: artifact.runtimeId,
          model: artifact.model,
          contentHash: artifact.contentHash,
          state: artifact.state,
          createdAt: artifact.createdAt,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/artifacts", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      res.json(await storage.getCreativeArtifacts({ projectId: id }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/artifacts", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const data = artifactCreateSchema.parse(req.body);
      const property = await ensurePropertyForProject(id);
      const artifact = await storage.createCreativeArtifactWithAtomicVersion({
        id: crypto.randomUUID(),
        propertyId: property.id,
        projectId: id,
        chapterId: data.chapterId ?? null,
        type: data.type,
        parentArtifactId: data.parentArtifactId ?? null,
        createdBy: data.createdBy || "user",
        runtimeId: data.runtimeId ?? null,
        model: data.model ?? null,
        promptVersion: data.promptVersion ?? null,
        context: data.context || {},
        content: data.content,
        contentHash: hashArtifactContent(data.content),
        estimatedCostUsd: data.estimatedCostUsd ?? null,
        state: data.state || "generated",
      });
      res.status(201).json(artifact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/artifacts/:id/state", async (req, res) => {
    try {
      const state = z.enum([
        "generated",
        "reviewing",
        "accepted",
        "canonical",
        "superseded",
        "rejected",
        "archived",
        "published",
      ]).parse(req.body?.state);
      const artifact = await storage.updateCreativeArtifactState(req.params.id, state);
      if (!artifact) return res.status(404).json({ error: "Artifact not found" });
      res.json(artifact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/continuity", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      res.json((await storage.getContinuitySnapshot(id)) || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/projects/:id/continuity", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const data = continuityBodySchema.parse(req.body);
      await ensurePropertyForProject(id);
      const snapshot = await storage.upsertContinuitySnapshot({
        projectId: id,
        version: 1,
        state: data.state,
        lastAcceptedChapterId: data.lastAcceptedChapterId ?? null,
      });
      res.json(snapshot);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/concept-lab/triad", async (_req, res) => {
    try {
      res.json({
        deck: getTriadDeckStats(),
        recent: await storage.getTriadDraws(25),
        law: "NO DISCARD BEFORE SYNTHESIS",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/triad/draw", async (req, res) => {
    try {
      const input = triadDrawRequestSchema.parse(req.body || {});
      const draw = drawTriad({
        mode: input.mode,
        contextTags: input.contextTags,
        context: input.context,
        locked: input.locked as any,
        wildcardChance: input.wildcardChance,
      });
      const saved = await storage.createTriadDraw({
        id: draw.id,
        mode: draw.mode,
        whoCard: draw.who,
        whatCard: draw.what,
        howCard: draw.how,
        lockedAxes: draw.lockedAxes,
        wildcards: draw.wildcards,
        status: draw.status,
      });
      res.status(201).json({
        ...saved,
        synthesisRequired: true,
        law: "NO DISCARD BEFORE SYNTHESIS",
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/dossiers", async (req, res) => {
    try {
      const data = conceptDossierCreateSchema.parse(req.body);
      const dossier = await storage.createConceptDossier({
        id: crypto.randomUUID(),
        propertyId: data.propertyId ?? null,
        sourceType: data.sourceType,
        source: data.source || {},
        dossier: data.dossier,
        status: data.status || "candidate",
      });
      res.status(201).json(dossier);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/concept-lab/ideas", async (req, res) => {
    try {
      const includeArchived = String(req.query.includeArchived || "").toLowerCase() === "true";
      const dossiers = await storage.getConceptDossiers();
      const ideas = dossiers.filter((row) =>
        (row.status === "saved" || (includeArchived && row.status === "archived")) &&
        (row.sourceType === "triad" || row.sourceType === "manual-idea"),
      );
      res.json(ideas);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/ideas/from-direction", async (req, res) => {
    try {
      const input = savedIdeaFromDirectionSchema.parse(req.body);
      const run = await storage.getConceptSynthesisRun(input.synthesisRunId);
      if (!run) return res.status(404).json({ error: "Synthesis run not found" });

      const directions = (run.directions as any[]) || [];
      if (!directions.some((item) => item?.id === input.directionId)) {
        return res.status(404).json({ error: "Direction not found in this synthesis run" });
      }

      const existing = (await storage.getConceptDossiers()).find((row) => {
        const source = (row.source || {}) as Record<string, unknown>;
        return source.synthesisRunId === run.id && source.directionId === input.directionId && row.status !== "archived";
      });
      if (existing) return res.json(existing);

      const { dossierFromDirection } = await import("./core/conceptDossierMapping");
      const synthesis = {
        drawId: run.triadDrawId,
        synthesisRunId: run.id,
        context: run.context as any,
        oracle: run.oracleAnalysis as any,
        directions: run.directions as any,
        contributions: run.contributions as any,
        runtime: run.runtime as any,
      };
      const dossier = dossierFromDirection(synthesis, input.directionId);
      const savedAt = new Date().toISOString();
      const created = await storage.createConceptDossier({
        id: dossier.id,
        propertyId: null,
        sourceType: "triad",
        source: { drawId: run.triadDrawId, directionId: input.directionId, synthesisRunId: run.id },
        dossier: {
          ...dossier,
          status: "saved",
          ideaLibrary: {
            savedAt,
            notes: input.notes || "",
            tags: input.tags || [],
            favorite: false,
          },
        },
        status: "saved",
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/ideas", async (req, res) => {
    try {
      const input = manualSavedIdeaSchema.parse(req.body);
      const id = crypto.randomUUID();
      const savedAt = new Date().toISOString();
      const created = await storage.createConceptDossier({
        id,
        propertyId: null,
        sourceType: "manual-idea",
        source: { kind: "manual", capturedAt: savedAt },
        dossier: {
          id,
          workingTitle: input.title,
          premise: input.premise || "",
          status: "saved",
          ideaLibrary: {
            savedAt,
            notes: input.notes || "",
            tags: input.tags || [],
            favorite: false,
          },
        },
        status: "saved",
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/concept-lab/ideas/:id", async (req, res) => {
    try {
      const input = savedIdeaPatchSchema.parse(req.body || {});
      const row = await storage.getConceptDossier(req.params.id);
      if (!row) return res.status(404).json({ error: "Saved idea not found" });
      if (row.status !== "saved" && row.status !== "archived") {
        return res.status(409).json({ error: "Only saved or archived ideas can be edited in the Idea Library." });
      }

      const dossier = (row.dossier || {}) as Record<string, any>;
      const currentLibrary = (dossier.ideaLibrary || {}) as Record<string, any>;
      const nextStatus = input.status || row.status;
      const updated = await storage.updateConceptDossier(row.id, {
        status: nextStatus,
        dossier: {
          ...dossier,
          status: nextStatus,
          ideaLibrary: {
            ...currentLibrary,
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(input.tags !== undefined ? { tags: input.tags } : {}),
            ...(input.favorite !== undefined ? { favorite: input.favorite } : {}),
            ...(nextStatus === "archived" ? { archivedAt: new Date().toISOString() } : { archivedAt: null }),
          },
        },
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/triad/synthesize", async (req, res) => {
    try {
      const input = triadSynthesisRequestSchema.parse(req.body || {});
      const draw = await storage.getTriadDraw(input.drawId);
      if (!draw) return res.status(404).json({ error: "Triad draw not found" });

      const { synthesizeTriadConcept } = await import("./core/conceptSynthesisService");
      const result = await synthesizeTriadConcept(draw, input.context || {});

      await storage.updateConceptSynthesisRun(result.synthesisRunId, {
        status: "completed",
        directions: result.directions,
        contributions: result.contributions,
        runtime: result.runtime,
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/concept-lab/triad/synthesis/:drawId", async (req, res) => {
    try {
      const runs = await storage.getConceptSynthesisRuns({ triadDrawId: req.params.drawId, limit: 1 });
      if (runs.length === 0) return res.status(404).json({ error: "No synthesis found for this draw" });
      res.json(runs[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/triad/synthesis/:id/select", async (req, res) => {
    try {
      const input = conceptDirectionSelectSchema.parse(req.body || {});
      const run = await storage.getConceptSynthesisRun(req.params.id);
      if (!run) return res.status(404).json({ error: "Synthesis run not found" });

      const directions = (run.directions as any[]) || [];
      const selected = directions.find((item) => item?.id === input.directionId);
      if (!selected) return res.status(404).json({ error: "Direction not found in this synthesis run" });

      // Alternatives are preserved as archived records rather than deleted.
      const archivedAlternatives = directions
        .filter((item) => item?.id !== input.directionId)
        .map((item) => ({ directionId: item.id, workingTitle: item.workingTitle, archivedAt: new Date().toISOString() }));

      const updated = await storage.updateConceptSynthesisRun(req.params.id, {
        selectedDirectionId: input.directionId,
        status: "selected",
        runtime: {
          ...(run.runtime as Record<string, unknown>),
          archivedAlternatives,
        },
      });

      res.json({ synthesisRun: updated, selectedDirectionId: input.directionId, archivedAlternatives });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/dossiers/from-direction", async (req, res) => {
    try {
      const input = conceptDossierFromDirectionSchema.parse(req.body);
      const run = await storage.getConceptSynthesisRun(input.synthesisRunId);
      if (!run) return res.status(404).json({ error: "Synthesis run not found" });

      const { dossierFromDirection } = await import("./core/conceptDossierMapping");
      const synthesis = {
        drawId: run.triadDrawId,
        synthesisRunId: run.id,
        context: run.context as any,
        oracle: run.oracleAnalysis as any,
        directions: run.directions as any,
        contributions: run.contributions as any,
        runtime: run.runtime as any,
      };
      const dossier = dossierFromDirection(synthesis, input.directionId);
      const existingSaved = (await storage.getConceptDossiers()).find((row) => {
        const source = (row.source || {}) as Record<string, unknown>;
        return row.status === "saved" &&
          source.synthesisRunId === run.id &&
          source.directionId === input.directionId;
      });

      if (existingSaved) {
        const savedDossier = (existingSaved.dossier || {}) as Record<string, any>;
        const promoted = await storage.updateConceptDossier(existingSaved.id, {
          propertyId: input.propertyId ?? existingSaved.propertyId ?? null,
          status: "developing",
          dossier: {
            ...dossier,
            ideaLibrary: savedDossier.ideaLibrary || null,
            status: "developing",
          },
        });
        return res.json(promoted);
      }

      const created = await storage.createConceptDossier({
        id: dossier.id,
        propertyId: input.propertyId ?? null,
        sourceType: "triad",
        source: { drawId: run.triadDrawId, directionId: input.directionId, synthesisRunId: run.id },
        dossier: dossier,
        status: "developing",
      });

      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/concept-lab/dossiers/:id/greenlight", async (req, res) => {
    try {
      const input = conceptDossierGreenlightSchema.parse(req.body);
      const dossier = await storage.getConceptDossier(input.dossierId);
      if (!dossier) return res.status(404).json({ error: "Dossier not found" });
      if (dossier.sourceType === "manual-idea") {
        return res.status(409).json({ error: "Quick-captured ideas must be developed into a full Concept Dossier before greenlighting." });
      }

      const { createPropertyFromDossier } = await import("./core/conceptPropertyService");
      const property = await createPropertyFromDossier(dossier.dossier as any);

      await storage.updateConceptDossier(input.dossierId, {
        status: "greenlit",
        dossier: { ...(dossier.dossier as Record<string, unknown>), status: "greenlit" },
      });

      res.status(201).json({ property, dossier });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const allowedGenres = new Set<string>(VERTICALS as readonly string[]);
      const requestedGenres = Array.from(new Set(
        (Array.isArray(req.body?.genres) ? req.body.genres : [])
          .filter((genre: unknown): genre is string => typeof genre === "string" && allowedGenres.has(genre)),
      )).slice(0, 6);

      const requestedPrimary = typeof req.body?.vertical === "string" && allowedGenres.has(req.body.vertical)
        ? req.body.vertical
        : requestedGenres[0];

      if (requestedPrimary && !requestedGenres.includes(requestedPrimary)) {
        requestedGenres.unshift(requestedPrimary);
      }

      const data = insertProjectSchema.parse({
        ...req.body,
        vertical: requestedPrimary || req.body?.vertical,
      });
      const project = await storage.createProject(data);

      // Every Project is wrapped in a first-class Property. Keep the legacy
      // primary vertical intact while storing the full reviewed genre blend in Canon.
      const property = await ensurePropertyForProject(project.id);
      const genres = requestedGenres.length > 0 ? requestedGenres : [project.vertical];
      const primaryGenre = genres.includes(project.vertical) ? project.vertical : genres[0];
      const existingClassification = (property.classification || {}) as Record<string, any>;
      await storage.updateStudioProperty(property.id, {
        classification: {
          ...existingClassification,
          primaryGenre: {
            id: primaryGenre,
            label: primaryGenre,
            weight: 1,
          },
          additionalGenres: genres
            .filter((genre) => genre !== primaryGenre)
            .map((genre, index) => ({
              id: genre,
              label: genre,
              weight: Math.max(0.55, 0.9 - index * 0.08),
            })),
          craftProfiles: genres.map((genre, index) => ({
            id: genre,
            label: genre,
            weight: index === 0 ? 1 : Math.max(0.55, 0.9 - index * 0.08),
          })),
        },
      });

      res.status(201).json({ ...project, genres });
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const chapters = await storage.getChapters(id);
      const runSteps = await storage.getRunSteps(id);
      const bookDna = await storage.getBookDna(id);
      const marketing = await storage.getMarketingAsset(id);
      const trendReport = await storage.getTrendReportByProject(id);
      const chapterAnalyses = await storage.getChapterAnalyses(id);
      const storyEntities = await storage.getStoryEntities({ projectId: id });
      const marketReports = await storage.getMarketReports(id);
      const revenueForecasts = await storage.getRevenueForecasts(id);
      const abTests = await storage.getAbTests(id);
      const seriesRef = project.seriesId ? await storage.getSeries(project.seriesId) : undefined;
      const styleFingerprint = project.styleFingerprintId ? await storage.getStyleFingerprint(project.styleFingerprintId) : undefined;
      const coverVariants = await storage.getCoverVariants(id);
      const exportJobs = await storage.getExportJobs(id);
      const brandKit = project.brandKitId ? await storage.getBrandKit(project.brandKitId) : undefined;
      const launchSchedules = await storage.getLaunchSchedules(id);
      const mediaAssets = await storage.getMediaAssets(id);
      const editionList = await storage.getBookEditions(id);
      const editions = await Promise.all(editionList.map(async (e) => ({
        ...e,
        chapters: await storage.getEditionChapters(e.id),
      })));
      const studioProperty = await ensurePropertyForProject(id);
      const continuitySnapshot = await storage.getContinuitySnapshot(id);
      const artifactRows = await storage.getCreativeArtifacts({ projectId: id });
      const artifactSummary = artifactRows.map((artifact) => ({
        id: artifact.id,
        type: artifact.type,
        version: artifact.version,
        chapterId: artifact.chapterId,
        createdBy: artifact.createdBy,
        runtimeId: artifact.runtimeId,
        model: artifact.model,
        state: artifact.state,
        contentHash: artifact.contentHash,
        createdAt: artifact.createdAt,
      }));
      res.json({ project, chapters, runSteps, bookDna, marketing, trendReport, chapterAnalyses, storyEntities, marketReports, revenueForecasts, abTests, series: seriesRef, styleFingerprint, coverVariants, exportJobs, brandKit, launchSchedules, mediaAssets, editions, studioProperty, continuitySnapshot, artifactSummary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/cover-image", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project || !project.coverImageUrl) return res.status(404).send();
      const match = project.coverImageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        return res.redirect(project.coverImageUrl);
      }
      const ext = match[1];
      const buf = Buffer.from(match[2], "base64");
      res.set("Content-Type", `image/${ext}`);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const data = patchProjectSchema.parse(req.body);
      const updated = await storage.updateProject(id, data);
      // Keep this book's extracted entities attached to the series so they
      // participate in cross-book continuity.
      if (Object.prototype.hasOwnProperty.call(data, "seriesId")) {
        try {
          const ents = await storage.getStoryEntities({ projectId: id });
          await Promise.all(ents.map((e) => storage.updateStoryEntity(e.id, { seriesId: data.seriesId ?? null })));
        } catch {
          /* non-fatal */
        }
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id", requireRole("owner"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      await storage.deleteProject(id);
      res.status(204).send();
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================================================================
  // Team workspaces: roles, members, chapter comments, approval gate,
  // and chapter version history with diff + rollback.
  // ===================================================================

  // Current user's workspace role (drives the frontend permission gating).
  app.get("/api/workspace/me", async (req, res) => {
    try {
      const role = await getWorkspaceRole(req);
      if (!role) return res.status(401).json({ error: "Authentication required" });
      res.json({ role });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/workspace/members", async (_req, res) => {
    try {
      const members = await storage.getWorkspaceMembers();
      const users = await Promise.all(members.map(m => storage.getUser(m.userId)));
      const enriched = members.map((m, i) => ({
        ...m,
        username: users[i]?.username ?? "(deleted user)",
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a teammate: creates a login account and a workspace membership row.
  app.post("/api/workspace/members", requireRole("owner"), async (req, res) => {
    try {
      const username = typeof req.body?.username === "string" ? req.body.username.trim().slice(0, 200) : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const role = req.body?.role;
      if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      if (role !== "owner" && role !== "editor" && role !== "viewer") {
        return res.status(400).json({ error: "Role must be owner, editor, or viewer" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: "A user with that username already exists" });
      const hashed = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ username, password: hashed });
      const member = await storage.createWorkspaceMember({ userId: user.id, role });
      res.status(201).json({ ...member, username: user.username });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/workspace/members/:id", requireRole("owner"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid member ID" });
      const role = req.body?.role;
      if (role !== "owner" && role !== "editor" && role !== "viewer") {
        return res.status(400).json({ error: "Role must be owner, editor, or viewer" });
      }
      const updated = await storage.updateWorkspaceMember(id, { role });
      if (!updated) return res.status(404).json({ error: "Member not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/workspace/members/:id", requireRole("owner"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid member ID" });
      await storage.deleteWorkspaceMember(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Chapter comments ---
  app.get("/api/projects/:id/chapters/:chapterId/comments", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      res.json(await storage.getChapterComments(chapterId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Any workspace member (including viewers) can leave a comment.
  app.post("/api/projects/:id/chapters/:chapterId/comments", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 4000) : "";
      if (!body) return res.status(400).json({ error: "Comment body is required" });
      const uid = req.session?.adminId ?? null;
      const author = uid ? await storage.getUser(uid) : undefined;
      const created = await storage.createChapterComment({
        chapterId,
        projectId,
        userId: uid,
        authorName: author?.username ?? "Admin",
        body,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Toggle resolved — editors and owners can resolve threads.
  app.patch("/api/comments/:id", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid comment ID" });
      const resolved = !!req.body?.resolved;
      const updated = await storage.updateChapterComment(id, { resolved });
      if (!updated) return res.status(404).json({ error: "Comment not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/comments/:id", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid comment ID" });
      await storage.deleteChapterComment(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Approval gate (owner only) ---
  app.patch("/api/projects/:id/chapters/:chapterId/approval", requireRole("owner"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      const status = req.body?.approvalStatus;
      if (status !== "approved" && status !== "rejected" && status !== "pending" && status !== "none") {
        return res.status(400).json({ error: "approvalStatus must be approved, rejected, pending, or none" });
      }
      const updated = await storage.updateChapter(chapterId, { approvalStatus: status });

      let continuity: any = null;
      let continuityWarning: string | null = null;
      if (status === "approved") {
        await captureCanonicalChapterArtifact(projectId, chapterId).catch((artifactError: any) => {
          console.error("Canonical manuscript capture failed:", artifactError?.message || artifactError);
        });
      }
      try {
        if (status === "approved") {
          continuity = await captureContinuityForApprovedChapter(projectId, chapterId);
        } else {
          continuity = await archiveContinuityForChapter(projectId, chapterId);
        }
      } catch (continuityError: any) {
        // Approval itself remains authoritative even if postflight extraction
        // cannot run (for example no local/cloud model is available).
        continuityWarning = continuityError?.message || "Continuity postflight failed";
        console.error("Continuity approval postflight:", continuityWarning);
      }

      if (continuityWarning) {
        res.setHeader("X-Lexora-Continuity-Warning", encodeURIComponent(continuityWarning.slice(0, 300)));
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Chapter version history ---
  app.get("/api/projects/:id/chapters/:chapterId/versions", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      res.json(await storage.getChapterVersions(chapterId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Roll back to a prior snapshot. The current state is captured first so the
  // rollback itself is reversible.
  app.post("/api/projects/:id/chapters/:chapterId/versions/:versionId/rollback", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      const versionId = parseId(req.params.versionId);
      if (!projectId || !chapterId || !versionId) return res.status(400).json({ error: "Invalid ID" });
      const project = await storage.getProject(projectId);
      const chapter = await storage.getChapter(chapterId);
      if (!project || !chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Not found" });
      if (project.status === "complete") return res.status(400).json({ error: "Cannot roll back a completed book. Revert to editing first." });
      const version = await storage.getChapterVersion(versionId);
      if (!version || version.chapterId !== chapterId) return res.status(404).json({ error: "Version not found" });

      // Snapshot the current state before overwriting so rollback is reversible.
      await captureChapterVersion(chapterId, "Before rollback");

      const contentChanged =
        chapter.title !== version.title ||
        (chapter.content || "") !== (version.content || "");
      const invalidatedApproval = contentChanged && chapter.approvalStatus === "approved";
      const updated = await storage.updateChapter(chapterId, {
        title: version.title,
        content: version.content,
        wordCount: version.wordCount,
        lastEditedAt: new Date(),
        ...(invalidatedApproval ? { approvalStatus: "none" as const } : {}),
      });
      if (invalidatedApproval) {
        await archiveContinuityForChapter(projectId, chapterId).catch((continuityError: any) => {
          reportContinuityWarning(res, "Continuity archive after version rollback", continuityError);
        });
      }

      const refreshed = await storage.getChapters(projectId);
      const totalWords = refreshed.reduce((s, c) => s + c.wordCount, 0);
      await storage.updateProject(projectId, { wordCount: totalWords });

      await captureChapterVersion(chapterId, "Rolled back");
      res.json(updated);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================================================================
  // Continuity: style fingerprints, series bible, character/world graph
  // ===================================================================

  app.get("/api/style-fingerprints", async (_req, res) => {
    try {
      res.json(await storage.getStyleFingerprints());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/style-fingerprints", async (req, res) => {
    try {
      const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 200) : "";
      const sampleText = typeof req.body?.sampleText === "string" ? req.body.sampleText.trim() : "";
      if (!name) return res.status(400).json({ error: "Name is required" });
      if (sampleText.length < 200) return res.status(400).json({ error: "Provide at least 200 characters of sample text" });
      const { profile } = await deriveStyleProfile(sampleText);
      const created = await storage.createStyleFingerprint({ name, sampleText: sampleText.slice(0, 20000), profile });
      res.status(201).json(created);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/style-fingerprints/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      await storage.deleteStyleFingerprint(id);
      res.status(204).send();
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/series", async (_req, res) => {
    try {
      const list = await storage.getSeriesList();
      const allProjects = await storage.getProjects();
      const withCounts = list.map((s) => ({
        ...s,
        bookCount: allProjects.filter((p) => p.seriesId === s.id).length,
      }));
      res.json(withCounts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/series/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      const s = await storage.getSeries(id);
      if (!s) return res.status(404).json({ error: "Not found" });
      const allProjects = await storage.getProjects();
      const books = allProjects.filter((p) => p.seriesId === id);
      const entities = await storage.getStoryEntities({ seriesId: id });
      res.json({ series: s, books, entities });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series", async (req, res) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 200) : "";
      const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 2000) : "";
      if (!title) return res.status(400).json({ error: "Title is required" });
      const created = await storage.createSeries({ title, description: description || null });
      res.status(201).json(created);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/series/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getSeries(id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const data: { title?: string; description?: string | null; bible?: any } = {};
      if (typeof req.body?.title === "string") data.title = req.body.title.trim().slice(0, 200);
      if (typeof req.body?.description === "string") data.description = req.body.description.trim().slice(0, 2000) || null;
      if (req.body?.bible && typeof req.body.bible === "object") {
        const b = req.body.bible;
        data.bible = {
          summary: String(b.summary ?? "").slice(0, 2000),
          characters: String(b.characters ?? "").slice(0, 4000),
          world: String(b.world ?? "").slice(0, 4000),
          timeline: String(b.timeline ?? "").slice(0, 2000),
          notes: String(b.notes ?? "").slice(0, 2000),
        };
      }
      const updated = await storage.updateSeries(id, data);
      res.json(updated);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/series/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      await storage.deleteSeries(id);
      res.status(204).send();
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/series/:id/bible", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      const s = await storage.getSeries(id);
      if (!s) return res.status(404).json({ error: "Not found" });
      const allProjects = await storage.getProjects();
      const books = allProjects.filter((p) => p.seriesId === id);
      if (books.length === 0) return res.status(400).json({ error: "Assign at least one book to this series first" });

      const bookSummaries: string[] = [];
      for (const b of books) {
        const dna = await storage.getBookDna(b.id);
        const ents = await storage.getStoryEntities({ projectId: b.id });
        const entLine = ents.slice(0, 20).map((e) => `${e.name} (${e.type})`).join(", ");
        bookSummaries.push(
          `BOOK: "${b.title}" (${b.vertical})${dna?.corePromise ? `\nPremise: ${dna.corePromise}` : ""}${dna?.transformationArc ? `\nArc: ${dna.transformationArc}` : ""}${entLine ? `\nKey entities: ${entLine}` : ""}`,
        );
      }

      const completion = await openai.chat.completions.create({
        model: FAST_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a series bible editor. You consolidate multiple books into a single shared canon used to keep future books consistent. Respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content: `Build a shared series bible for the series "${s.title}"${s.description ? ` — ${s.description}` : ""} from these books:

${bookSummaries.join("\n\n")}

Return JSON exactly:
{
  "summary": "<the series premise and through-line>",
  "characters": "<recurring characters and their roles/relationships across books>",
  "world": "<shared world, settings, rules, terminology>",
  "timeline": "<chronology and how the books connect>",
  "notes": "<continuity rules future books must respect>"
}`,
          },
        ],
        max_completion_tokens: 2048,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      const bible = {
        summary: String(parsed.summary ?? "").slice(0, 2000),
        characters: String(parsed.characters ?? "").slice(0, 4000),
        world: String(parsed.world ?? "").slice(0, 4000),
        timeline: String(parsed.timeline ?? "").slice(0, 2000),
        notes: String(parsed.notes ?? "").slice(0, 2000),
      };
      const updated = await storage.updateSeries(id, { bible });
      res.json(updated);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/extract-graph", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const chapters = await storage.getChapters(id);
      const hasContent = chapters.some((c) => c.status === "complete" && c.content);
      if (!hasContent) return res.status(400).json({ error: "Write at least one chapter before extracting the graph" });

      const { entities, tokens } = await runStep(id, "Extract character & world graph", FAST_MODEL, async () => {
        const out = await extractStoryEntities(project, chapters);
        return { result: out, tokens: out.tokens };
      });

      const existing = await storage.getStoryEntities({ projectId: id });
      const byKey = new Map(existing.map((e) => [`${e.type}::${e.name.toLowerCase()}`, e]));
      for (const e of entities) {
        const key = `${e.type}::${e.name.toLowerCase()}`;
        const prev = byKey.get(key);
        if (prev) {
          await storage.updateStoryEntity(prev.id, { profile: e.profile, relationships: e.relationships });
        } else {
          await storage.createStoryEntity({
            projectId: id,
            seriesId: project.seriesId ?? null,
            type: e.type,
            name: e.name,
            profile: e.profile,
            relationships: e.relationships,
          });
        }
      }
      const refreshed = await storage.getStoryEntities({ projectId: id });
      res.json({ entities: refreshed, extracted: entities.length, tokens });
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/entities", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 160) : "";
      const type = typeof req.body?.type === "string" ? req.body.type.trim().slice(0, 40) : "character";
      if (!name) return res.status(400).json({ error: "Name is required" });
      const created = await storage.createStoryEntity({
        projectId: id,
        seriesId: project.seriesId ?? null,
        type,
        name,
        profile: {
          description: String(req.body?.profile?.description ?? "").slice(0, 600),
          role: String(req.body?.profile?.role ?? "").slice(0, 300),
          traits: String(req.body?.profile?.traits ?? "").slice(0, 400),
        },
        relationships: Array.isArray(req.body?.relationships)
          ? req.body.relationships.slice(0, 8).map((r: any) => ({ to: String(r?.to ?? "").slice(0, 160), relation: String(r?.relation ?? "").slice(0, 240) })).filter((r: any) => r.to)
          : [],
      });
      res.status(201).json(created);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/entities/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      const data: any = {};
      if (typeof req.body?.name === "string") data.name = req.body.name.trim().slice(0, 160);
      if (typeof req.body?.type === "string") data.type = req.body.type.trim().slice(0, 40);
      if (req.body?.profile && typeof req.body.profile === "object") {
        data.profile = {
          description: String(req.body.profile.description ?? "").slice(0, 600),
          role: String(req.body.profile.role ?? "").slice(0, 300),
          traits: String(req.body.profile.traits ?? "").slice(0, 400),
        };
      }
      if (Array.isArray(req.body?.relationships)) {
        data.relationships = req.body.relationships.slice(0, 8).map((r: any) => ({ to: String(r?.to ?? "").slice(0, 160), relation: String(r?.relation ?? "").slice(0, 240) })).filter((r: any) => r.to);
      }
      const updated = await storage.updateStoryEntity(id, data);
      res.json(updated);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/entities/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      await storage.deleteStoryEntity(id);
      res.status(204).send();
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/export", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const format = (req.query.format as string) || "txt";
      const allowedFormats = ["txt", "html", "epub", "docx", "mobi"];
      if (!allowedFormats.includes(format)) {
        return res.status(400).json({ error: "Invalid format. Must be 'txt', 'html', 'epub', 'docx', or 'mobi'" });
      }
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const chapters = await storage.getChapters(id);
      const completedChapters = chapters.filter(c => c.status === "complete" && c.content);
      if (completedChapters.length === 0) {
        return res.status(400).json({ error: "No completed chapters to export" });
      }
      const authorName = project.authorName || "Unknown Author";
      const title = project.title;

      if (format === "epub") {
        const epub = buildEpub({
          title,
          authorName,
          language: project.targetLanguage || "en",
          chapters: completedChapters,
        });
        await storage.createExportJob({ projectId: id, format: "epub", language: project.targetLanguage || "en", status: "complete" });
        res.setHeader("Content-Type", "application/epub+zip");
        res.setHeader("Content-Disposition", `attachment; filename="${slugify(title)}.epub"`);
        return res.send(epub);
      }

      if (format === "docx") {
        const docx = buildDocx({ title, authorName, chapters: completedChapters });
        await storage.createExportJob({ projectId: id, format: "docx", language: project.targetLanguage || "en", status: "complete" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${slugify(title)}.docx"`);
        return res.send(docx);
      }

      if (format === "mobi") {
        const mobi = buildMobi({ title, authorName, chapters: completedChapters });
        await storage.createExportJob({ projectId: id, format: "mobi", language: project.targetLanguage || "en", status: "complete" });
        res.setHeader("Content-Type", "application/x-mobipocket-ebook");
        res.setHeader("Content-Disposition", `attachment; filename="${slugify(title)}.mobi"`);
        return res.send(mobi);
      }

      if (format === "html") {
        const html = buildHtmlExport(title, authorName, completedChapters);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${slugify(title)}.html"`);
        return res.send(html);
      }

      const lines: string[] = [];
      lines.push("=" .repeat(60));
      lines.push("");
      lines.push(title.toUpperCase());
      lines.push("");
      lines.push(`by ${authorName}`);
      lines.push("");
      lines.push("=".repeat(60));
      lines.push("");
      lines.push("");
      lines.push("TABLE OF CONTENTS");
      lines.push("-".repeat(40));
      completedChapters.forEach(ch => {
        lines.push(`  Chapter ${ch.chapterNumber}: ${ch.title}`);
      });
      lines.push("");
      lines.push("");

      completedChapters.forEach(ch => {
        lines.push("=".repeat(60));
        lines.push(`CHAPTER ${ch.chapterNumber}`);
        lines.push(ch.title.toUpperCase());
        lines.push("=".repeat(60));
        lines.push("");
        lines.push(ch.content || "");
        lines.push("");
        lines.push("");
      });

      lines.push("=".repeat(60));
      lines.push("END");
      lines.push("=".repeat(60));

      const content = lines.join("\n");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${slugify(title)}.txt"`);
      res.send(content);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/trend-analysis", requireRole("editor"), async (req, res) => {
    let prevStatus = "draft";
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      prevStatus = project.status;

      await storage.updateProject(id, { status: "trend_analysis" });

      const result = await runStep(id, "Trend Analysis", FAST_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [{
            role: "system",
            content: "You are a market research expert for the publishing industry. Respond ONLY with valid JSON.",
          }, {
            role: "user",
            content: `Analyze the ${project.vertical} vertical for a new book titled "${project.title}". Return JSON with: demandScore (1-10), competitionScore (1-10), greenlightScore (1-10), painPoints (array of 5 strings), titleAngles (array of 5 alternative title angles), nicheTopics (array of 5 micro-niche topics), keywords (array of 8 search keywords), summary (2-3 sentence market brief).`,
          }],
          max_completion_tokens: 8192,
          response_format: { type: "json_object" },
        });
        const content = completion.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);
        const tokens = completion.usage?.total_tokens || 500;
        return { result: parsed, tokens };
      });

      const trendReport = await storage.createTrendReport({
        projectId: id,
        vertical: project.vertical,
        demandScore: result.demandScore,
        competitionScore: result.competitionScore,
        greenlightScore: result.greenlightScore,
        painPoints: result.painPoints,
        titleAngles: result.titleAngles,
        nicheTopics: result.nicheTopics,
        keywords: result.keywords,
        summary: result.summary,
      });

      await storage.updateProject(id, {
        greenlightScore: result.greenlightScore,
        status: "draft",
      });

      res.json(trendReport);
    } catch (err: any) {
      await storage.updateProject(parseId(req.params.id)!, { status: prevStatus }).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  async function runOutlineGenerationJob(projectId: number, job: OutlineGenerationJob): Promise<void> {
    const isCurrent = () => !job.cancelled && outlineGenerationJobs.get(projectId) === job;
    try {
      const project = await storage.getProject(projectId);
      if (!project) throw new Error("Project not found");
      if (!isCurrent()) return;

      const result = await runStep(projectId, "Book Outline + DNA", HIGH_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: HIGH_MODEL,
          reasoning_effort: "high",
          messages: [{
            role: "system",
            content: `You are a professional book architect specializing in the ${project.vertical} ${isFiction(project.vertical) ? "genre" : "niche"}. Respond ONLY with valid JSON.`,
          }, {
            role: "user",
            content: isFiction(project.vertical)
              ? `Create a complete book outline for the ${project.vertical} novel "${project.title}" for ${project.targetLanguage} speaking readers.${project.description ? `\n\nAuthor's creative direction: ${project.description}` : ""}

Return JSON with:
- corePromise: string (the story's central premise and hook)
- readerAvatar: string (target reader description)
- toneRules: string (narrative voice, POV, and style guidelines)
- transformationArc: string (protagonist's arc from beginning to end)
- frameworkSummary: string (the story's thematic framework and central conflict)
- chapters: array of objects with {chapterNumber, title, blueprint (150 word description of plot events, character development, tension points, and scene details for this chapter)}

Generate 15-25 chapters. Each chapter should advance the plot and deepen character arcs. Include rising action, climax, and resolution.`
              : `Create a complete book outline for "${project.title}" in the ${project.vertical} vertical for ${project.targetLanguage} speaking audience.${project.description ? `\n\nAuthor's creative direction: ${project.description}` : ""}

Return JSON with:
- corePromise: string (the book's core transformation promise)
- readerAvatar: string (ideal reader description)
- toneRules: string (writing tone and style rules)
- transformationArc: string (reader journey from problem to solution)
- frameworkSummary: string (the book's unique framework name and description)
- chapters: array of objects with {chapterNumber, title, blueprint (150 word description of what this chapter covers, key points, and exercises)}

Generate 8-12 chapters. Each chapter should have a clear purpose in the transformation journey.`,
          }],
          max_completion_tokens: 8192,
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0].message.content || "{}";
        const parsed = outlineResultSchema.parse(JSON.parse(raw));
        const tokens = completion.usage?.total_tokens || 2000;
        return { result: parsed, tokens };
      });

      if (!isCurrent()) return;

      // Normalize numbering so malformed/duplicate model numbering can never
      // produce a broken chapter sequence in the workspace.
      const newChapters = result.chapters.map((ch: z.infer<typeof outlineChapterSchema>, index: number) => ({
        projectId,
        chapterNumber: index + 1,
        title: ch.title,
        blueprint: ch.blueprint,
        status: "pending" as const,
      }));

      // Keep the old outline intact until every part of the new result has
      // validated, then atomically commit DNA + chapters + project state.
      const committedOutline = await storage.commitOutline(projectId, {
        projectId,
        corePromise: result.corePromise,
        readerAvatar: result.readerAvatar,
        toneRules: result.toneRules,
        transformationArc: result.transformationArc,
        frameworkSummary: result.frameworkSummary,
      }, newChapters);
      await captureBookArchitectureArtifact(
        projectId,
        committedOutline.dna,
        committedOutline.chapters,
        { runtimeId: `openai:${HIGH_MODEL}`, model: HIGH_MODEL },
      ).catch((artifactError: any) => {
        console.warn("Book architecture artifact capture failed:", artifactError?.message || artifactError);
      });
      await storage.createNotification({
        kind: "pipeline",
        title: `Outline ready: ${project.title}`,
        body: `${newChapters.length} chapter blueprints and the Book DNA are ready to review.`,
        link: `/projects/${projectId}`,
        metadata: { projectId, workflow: "outline", chapterCount: newChapters.length },
      }).catch(() => {});
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      console.error(`Outline generation failed for project ${projectId}:`, err?.message || err);
      if (isCurrent()) {
        await storage.updateProject(projectId, { status: job.previousStatus }).catch(() => {});
        const project = await storage.getProject(projectId).catch(() => undefined);
        await storage.createNotification({
          kind: "pipeline",
          title: "Outline generation failed",
          body: project
            ? `${project.title}: ${err?.message || "The outline could not be completed."} Your previous saved outline was preserved.`
            : `The outline could not be completed: ${err?.message || "Unknown error"}`,
          link: `/projects/${projectId}`,
          metadata: { projectId, workflow: "outline", status: "failed" },
        }).catch(() => {});
      }
    } finally {
      if (outlineGenerationJobs.get(projectId) === job) outlineGenerationJobs.delete(projectId);
    }
  }

  app.post("/api/projects/:id/generate-outline", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });

      const existing = outlineGenerationJobs.get(id);
      if (existing && !existing.cancelled) {
        return res.status(202).json({ projectId: id, status: "outlining", alreadyRunning: true });
      }

      const currentChapters = await storage.getChapters(id);
      if (currentChapters.some((chapter) => chapter.status === "generating")) {
        return res.status(409).json({
          error: "A chapter is currently writing. Finish or cancel chapter generation before replacing the outline.",
        });
      }

      const job: OutlineGenerationJob = {
        cancelled: false,
        startedAt: Date.now(),
        previousStatus: project.status === "outlining"
          ? (currentChapters.length > 0 ? "writing" : "draft")
          : project.status,
      };
      outlineGenerationJobs.set(id, job);
      await storage.updateProject(id, { status: "outlining" });

      // Return immediately. The durable project status + normal project polling
      // make this workflow survive navigation and prevent a long browser request.
      res.status(202).json({ projectId: id, status: "outlining", started: true });
      void runOutlineGenerationJob(id, job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  async function runChapterGenerationJob(projectId: number, chapterId: number, job: ChapterGenerationJob): Promise<void> {
    const isCurrent = () => !job.cancelled && chapterGenerationJobs.get(chapterId) === job;
    try {
      const project = await storage.getProject(projectId);
      const chapter = await storage.getChapter(chapterId);
      if (!project || !chapter || chapter.projectId !== projectId) throw new Error("Project or chapter not found");
      if (!isCurrent()) return;

      const priorChapters = await storage.getChapters(projectId);
      const continuityExtras = await loadContinuityExtras(project);
      const legacyConsistencyContext = buildConsistencyContext(priorChapters, chapter.chapterNumber, continuityExtras);
      const scribeContext = await buildScribeContext(projectId);
      const studioProperty = await ensurePropertyForProject(projectId);
      const chapterInstructions = buildChapterDraftInstructions({ project, chapter, property: studioProperty });
      const usingLegacyFallback = scribeContext.contextManifest.notes.some((note) => note.startsWith("legacy-fallback:"));

      const localAvailable = await isOllamaAvailable();
      const useLocalDraft =
        (config.studio.runtimeMode === "off-grid" && localAvailable) ||
        (config.studio.runtimeMode === "hybrid" && localAvailable) ||
        (!config.openai.configured && localAvailable);

      if (config.studio.runtimeMode === "off-grid" && !localAvailable) {
        throw new Error("Cannot draft chapter in off-grid mode because Ollama is unavailable.");
      }

      const draftModel = useLocalDraft ? `ollama:${config.ollama.model}` : HIGH_MODEL;
      const userDraftPrompt = usingLegacyFallback && legacyConsistencyContext
        ? `${legacyConsistencyContext}\n\n---\n\n${chapterInstructions}`
        : chapterInstructions;
      const systemDraftPrompt = `${scribeContext.systemPrompt}\n\nYou are now drafting the next manuscript chapter. Treat the Creative Target Contract as the quality definition for this work.`;

      const result = await runStep(projectId, `Chapter ${chapter.chapterNumber}: ${chapter.title}`, draftModel, async () => {
        if (useLocalDraft) {
          const content = await ollamaChat({
            model: config.ollama.model,
            messages: [
              { role: "system", content: systemDraftPrompt },
              { role: "user", content: userDraftPrompt },
            ],
          });
          const tokens = Math.ceil((systemDraftPrompt.length + userDraftPrompt.length + content.length) / 4);
          return { result: content, tokens };
        }

        const completion = await openai.chat.completions.create({
          model: HIGH_MODEL,
          reasoning_effort: "high",
          messages: [
            { role: "system", content: systemDraftPrompt },
            { role: "user", content: userDraftPrompt },
          ],
          max_completion_tokens: 8192,
        });
        const content = completion.choices[0].message.content || "";
        const tokens = completion.usage?.total_tokens || 3000;
        return { result: content, tokens };
      });

      // Cancellation/newer generation wins even if the provider call already completed.
      if (!isCurrent()) return;

      const wordCount = result.split(/\s+/).filter(Boolean).length;
      const qualityScore = await evaluateChapterQuality(result, chapter.title, project.vertical);
      if (!isCurrent()) return;

      const invalidatedApproval = chapter.approvalStatus === "approved";
      await storage.updateChapter(chapterId, {
        content: result,
        wordCount,
        qualityScore,
        status: "complete",
        ...(invalidatedApproval ? { approvalStatus: "none" as const } : {}),
      });

      if (invalidatedApproval) {
        await archiveContinuityForChapter(projectId, chapterId).catch((continuityError: any) => {
          console.warn("Continuity archive after regeneration:", continuityError?.message || continuityError);
        });
      }
      if (!isCurrent()) return;

      const allChapters = await storage.getChapters(projectId);
      const totalWords = allChapters.reduce((sum, item) => sum + item.wordCount, 0);
      const completedChapters = allChapters.filter((item) => item.status === "complete");
      const avgQuality = completedChapters.length > 0
        ? completedChapters.reduce((sum, item) => sum + (item.qualityScore || 0), 0) / completedChapters.length
        : 0;

      await storage.updateProject(projectId, {
        wordCount: totalWords,
        qualityScore: avgQuality,
        status: allChapters.every((item) => item.status === "complete") ? "editing" : "writing",
      });
      await captureChapterVersion(chapterId, "Generated");
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      console.error(`Chapter generation failed for project ${projectId}, chapter ${chapterId}:`, err?.message || err);
      if (isCurrent()) {
        await storage.updateChapter(chapterId, { status: "pending" }).catch(() => {});
      }
    } finally {
      if (chapterGenerationJobs.get(chapterId) === job) chapterGenerationJobs.delete(chapterId);
    }
  }

  app.post("/api/projects/:id/chapters/:chapterId/generate", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });

      const project = await storage.getProject(projectId);
      const chapter = await storage.getChapter(chapterId);
      if (!project || !chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Not found" });
      if (project.status === "outlining" || outlineGenerationJobs.has(projectId)) {
        return res.status(409).json({ error: "The outline is being rebuilt. Wait for it to finish before writing chapters." });
      }

      const existing = chapterGenerationJobs.get(chapterId);
      if (existing && !existing.cancelled) {
        return res.status(202).json({ chapterId, status: "generating", alreadyRunning: true });
      }

      const job: ChapterGenerationJob = { cancelled: false, startedAt: Date.now() };
      chapterGenerationJobs.set(chapterId, job);
      await storage.updateChapter(chapterId, { status: "generating" });

      // Return before expensive AI work. Navigation/client disconnects no longer
      // determine whether the manuscript job survives.
      res.status(202).json({ chapterId, status: "generating", started: true });
      void runChapterGenerationJob(projectId, chapterId, job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/chapters/:chapterId/cancel", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      if (chapter.status !== "generating") return res.status(400).json({ error: "Chapter is not generating" });

      const job = chapterGenerationJobs.get(chapterId);
      if (job) job.cancelled = true;
      if (chapterGenerationJobs.get(chapterId) === job) chapterGenerationJobs.delete(chapterId);

      await storage.updateChapter(chapterId, { status: "pending" });
      res.json({ success: true, chapterId, status: "pending" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/chapters/:chapterId/edit", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      const { content } = req.body;
      if (typeof content !== "string") return res.status(400).json({ error: "Content is required" });
      const contentChanged = (chapter.content || "") !== content;
      const invalidatedApproval = contentChanged && chapter.approvalStatus === "approved";
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const updated = await storage.updateChapter(chapterId, {
        content,
        wordCount,
        lastEditedAt: new Date(),
        // Editing invalidates a prior approval — send it back through the gate.
        ...(invalidatedApproval ? { approvalStatus: "none" as const } : {}),
      });
      if (invalidatedApproval) {
        await archiveContinuityForChapter(projectId, chapterId).catch((continuityError: any) => {
          reportContinuityWarning(res, "Continuity archive after manual edit", continuityError);
        });
      }
      const allChapters = await storage.getChapters(projectId);
      const totalWords = allChapters.reduce((s, c) => s + (c.id === chapterId ? wordCount : c.wordCount), 0);
      await storage.updateProject(projectId, { wordCount: totalWords });
      if (contentChanged) await captureChapterVersion(chapterId, "Manual edit");
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/chapters/:chapterId/revise", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });

      const project = await storage.getProject(projectId);
      const chapter = await storage.getChapter(chapterId);
      if (!project || !chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Not found" });
      if (project.status === "complete") return res.status(400).json({ error: "Cannot revise chapters of a completed book. Revert to editing first." });
      if (chapter.status !== "complete" || !chapter.content) return res.status(400).json({ error: "Only completed chapters with content can be revised" });

      const instruction = typeof req.body?.instruction === "string" ? req.body.instruction.trim().slice(0, 2000) : "";
      const dna = await storage.getBookDna(projectId);
      const allChapters = await storage.getChapters(projectId);
      const reviseExtras = await loadContinuityExtras(project);
      const consistencyContext = buildConsistencyContext(allChapters, chapter.chapterNumber, reviseExtras);
      const styleContext = await loadStyleContext(project.styleFingerprintId);
      const fiction = isFiction(project.vertical);
      const localAvailable = await isOllamaAvailable();
      const useLocalRevision =
        (config.studio.runtimeMode === "off-grid" && localAvailable) ||
        (config.studio.runtimeMode === "hybrid" && localAvailable) ||
        (!config.openai.configured && localAvailable);

      if (config.studio.runtimeMode === "off-grid" && !localAvailable) {
        return res.status(503).json({ error: "Cannot revise chapter in off-grid mode because Ollama is unavailable." });
      }

      const revisionModel = useLocalRevision ? `ollama:${config.ollama.model}` : HIGH_MODEL;
      const result = await runStep(projectId, `Revise Ch.${chapter.chapterNumber}: ${chapter.title}`, revisionModel, async () => {
        const systemPrompt = (dna
          ? `You are a professional ${fiction ? "fiction author" : "author"} revising a chapter ${fiction ? `for a ${project.vertical} novel` : `in the ${project.vertical} niche`}.
Book: "${project.title}"
Core Promise: ${dna.corePromise}
Reader Avatar: ${dna.readerAvatar}
Tone Rules: ${dna.toneRules}
Framework: ${dna.frameworkSummary}
Transformation Arc: ${dna.transformationArc}
Write in ${project.targetLanguage}.`
          : `You are a professional ${fiction ? "fiction author" : "author"} revising a chapter of a ${project.vertical} ${fiction ? "novel" : "book"} titled "${project.title}". Write in ${project.targetLanguage}.`)
          + (styleContext ? `\n\n${styleContext}` : "");

        const lengthHint = fiction ? "approximately 2000-3000 words" : "approximately 1500-2000 words";
        const userPrompt = `${consistencyContext ? `${consistencyContext}\n\n---\n\n` : ""}You are revising Chapter ${chapter.chapterNumber}: "${chapter.title}".

Blueprint: ${chapter.blueprint}

CURRENT CHAPTER DRAFT:
${chapter.content}

${instruction
  ? `REVISION INSTRUCTION FROM THE AUTHOR:
"${instruction}"

Apply this instruction faithfully. Rewrite the full chapter so the instruction is satisfied while preserving everything that is not affected by it.`
  : `Rewrite and improve this chapter: strengthen prose, pacing, clarity, and impact while preserving the events, facts, characters, and intent of the existing draft.`}

Stay 100% consistent with the rest of the book (names, facts, timeline, terminology, tone, and callbacks established in the story bible above). Keep the chapter ${lengthHint}. Return ONLY the full revised chapter content, no meta-commentary or notes.`;

        let content: string;
        let tokens: number;
        if (useLocalRevision) {
          content = await ollamaChat({
            model: config.ollama.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          tokens = Math.ceil((systemPrompt.length + userPrompt.length + content.length) / 4);
        } else {
          const completion = await openai.chat.completions.create({
            model: HIGH_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_completion_tokens: 8192,
          });
          content = completion.choices[0].message.content || "";
          tokens = completion.usage?.total_tokens || 3000;
        }
        return { result: content, tokens };
      });

      if (!result.trim()) return res.status(500).json({ error: "Revision produced no content" });

      const wordCount = result.trim().split(/\s+/).filter(Boolean).length;
      const qualityScore = await evaluateChapterQuality(result, chapter.title, project.vertical);

      const invalidatedApproval = chapter.approvalStatus === "approved";
      const updated = await storage.updateChapter(chapterId, {
        content: result,
        wordCount,
        qualityScore,
        status: "complete",
        lastEditedAt: new Date(),
        // Revision invalidates a prior approval — send it back through the gate.
        ...(invalidatedApproval ? { approvalStatus: "none" as const } : {}),
      });
      if (invalidatedApproval) {
        await archiveContinuityForChapter(projectId, chapterId).catch((continuityError: any) => {
          reportContinuityWarning(res, "Continuity archive after AI revision", continuityError);
        });
      }

      await captureChapterVersion(chapterId, instruction ? "AI revision" : "AI polish");

      const refreshed = await storage.getChapters(projectId);
      const totalWords = refreshed.reduce((s, c) => s + c.wordCount, 0);
      const completed = refreshed.filter(c => c.status === "complete");
      const avgQuality = completed.length > 0
        ? completed.reduce((s, c) => s + (c.qualityScore || 0), 0) / completed.length
        : 0;
      await storage.updateProject(projectId, { wordCount: totalWords, qualityScore: avgQuality });

      res.json(updated);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/mark-complete", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      if (project.status !== "editing") return res.status(400).json({ error: "Project must be in editing status to mark complete" });
      const chapters = await storage.getChapters(id);
      const allComplete = chapters.length > 0 && chapters.every(c => c.status === "complete");
      if (!allComplete) return res.status(400).json({ error: "All chapters must be complete" });
      const updated = await storage.updateProject(id, { status: "complete" });
      res.json(updated);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/toggle-storefront", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      if (project.status !== "complete" && project.status !== "editing") {
        return res.status(400).json({ error: "Only completed or editing books can be published to the storefront" });
      }
      const chapters = await storage.getChapters(id);
      const hasContent = chapters.some(c => c.status === "complete");
      if (!hasContent && !project.publishedToStore) {
        return res.status(400).json({ error: "Book must have at least one completed chapter to publish to storefront" });
      }
      const updated = await storage.updateProject(id, { publishedToStore: !project.publishedToStore });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/revert-to-editing", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      if (project.status !== "complete") return res.status(400).json({ error: "Project must be complete to revert to editing" });
      const updated = await storage.updateProject(id, { status: "editing" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  async function loadChapterForAnalysis(req: Request, res: Response) {
    const projectId = parseId(String(req.params.id));
    const chapterId = parseId(String(req.params.chapterId));
    if (!projectId || !chapterId) {
      res.status(400).json({ error: "Invalid ID" });
      return null;
    }
    const project = await storage.getProject(projectId);
    const chapter = await storage.getChapter(chapterId);
    if (!project || !chapter || chapter.projectId !== projectId) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
    if (chapter.status !== "complete" || !chapter.content) {
      res.status(400).json({ error: "Only completed chapters with content can be analyzed" });
      return null;
    }
    return { projectId, chapterId, project, chapter };
  }

  app.post("/api/projects/:id/chapters/:chapterId/editorial-board", requireRole("editor"), async (req, res) => {
    try {
      const loaded = await loadChapterForAnalysis(req, res);
      if (!loaded) return;
      const { projectId, chapterId, project, chapter } = loaded;
      const dna = await storage.getBookDna(projectId);
      const allChapters = await storage.getChapters(projectId);
      const consistencyContext = buildConsistencyContext(allChapters, chapter.chapterNumber);
      const fiction = isFiction(project.vertical);

      const board = await runStep(
        projectId,
        `Editorial Board: Ch.${chapter.chapterNumber}`,
        HIGH_MODEL,
        () => runEditorialBoard(project, chapter, dna, consistencyContext, fiction),
      );

      const saved = await storage.createChapterAnalysis({
        projectId,
        chapterId,
        kind: "editorial_board",
        score: board.overallScore,
        data: board,
      });
      await captureRedactorReviewArtifact(
        projectId,
        chapterId,
        board,
        { runtimeId: `openai:${HIGH_MODEL}`, model: HIGH_MODEL },
      ).catch((artifactError: any) => {
        console.warn("Redactor artifact capture failed:", artifactError?.message || artifactError);
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/chapters/:chapterId/beta-readers", requireRole("editor"), async (req, res) => {
    try {
      const loaded = await loadChapterForAnalysis(req, res);
      if (!loaded) return;
      const { projectId, chapterId, project, chapter } = loaded;
      const dna = await storage.getBookDna(projectId);
      const fiction = isFiction(project.vertical);
      const personas = Array.isArray(req.body?.personas)
        ? req.body.personas.filter((p: any) => typeof p === "string")
        : undefined;

      const betaResult = await runStep(
        projectId,
        `Beta Readers: Ch.${chapter.chapterNumber}`,
        FAST_MODEL,
        () => runBetaReaders(project, chapter, dna, fiction, personas),
      );

      const saved = await storage.createChapterAnalysis({
        projectId,
        chapterId,
        kind: "beta_readers",
        score: betaResult.avgRating,
        data: betaResult,
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/chapters/:chapterId/humanize", requireRole("editor"), async (req, res) => {
    try {
      const loaded = await loadChapterForAnalysis(req, res);
      if (!loaded) return;
      const { projectId, chapterId, project, chapter } = loaded;
      if (project.status === "complete") {
        return res.status(400).json({ error: "Cannot humanize chapters of a completed book. Revert to editing first." });
      }
      const dna = await storage.getBookDna(projectId);
      const allChapters = await storage.getChapters(projectId);
      const consistencyContext = buildConsistencyContext(allChapters, chapter.chapterNumber);
      const fiction = isFiction(project.vertical);

      const humanized = await runStep(
        projectId,
        `Humanize: Ch.${chapter.chapterNumber}`,
        HIGH_MODEL,
        () => humanizeChapter(project, chapter, dna, consistencyContext, fiction),
      );

      await captureChapterVersion(chapterId, "Before humanize pass");
      const wordCount = humanized.newContent.trim().split(/\s+/).filter(Boolean).length;
      const qualityScore = await evaluateChapterQuality(humanized.newContent, chapter.title, project.vertical);
      const invalidatedApproval = chapter.approvalStatus === "approved";
      await storage.updateChapter(chapterId, {
        content: humanized.newContent,
        wordCount,
        qualityScore,
        status: "complete",
        lastEditedAt: new Date(),
        ...(invalidatedApproval ? { approvalStatus: "none" as const } : {}),
      });
      if (invalidatedApproval) {
        await archiveContinuityForChapter(projectId, chapterId).catch((continuityError: any) => {
          reportContinuityWarning(res, "Continuity archive after humanize pass", continuityError);
        });
      }
      await captureChapterVersion(chapterId, "After humanize pass");

      const refreshed = await storage.getChapters(projectId);
      const totalWords = refreshed.reduce((s, c) => s + c.wordCount, 0);
      const completed = refreshed.filter(c => c.status === "complete");
      const avgQuality = completed.length > 0
        ? completed.reduce((s, c) => s + (c.qualityScore || 0), 0) / completed.length
        : 0;
      await storage.updateProject(projectId, { wordCount: totalWords, qualityScore: avgQuality });

      const { newContent, ...analysisData } = humanized;
      const saved = await storage.createChapterAnalysis({
        projectId,
        chapterId,
        kind: "humanizer",
        score: humanized.afterScore,
        data: analysisData,
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/analyze-pacing", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      if (!projectId) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const allChapters = await storage.getChapters(projectId);
      const completed = allChapters.filter(c => c.status === "complete" && c.content);
      if (completed.length < 2) {
        return res.status(400).json({ error: "Write at least 2 chapters before analyzing pacing." });
      }
      const dna = await storage.getBookDna(projectId);
      const fiction = isFiction(project.vertical);

      const pacing = await runStep(
        projectId,
        "Pacing & Tension Analysis",
        FAST_MODEL,
        () => analyzePacing(project, completed, dna, fiction),
      );

      const saved = await storage.createChapterAnalysis({
        projectId,
        chapterId: null,
        kind: "pacing_curve",
        data: pacing,
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/chapters/:chapterId/inline-ai", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const project = await storage.getProject(projectId);
      const chapter = await storage.getChapter(chapterId);
      if (!project || !chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Not found" });
      if (project.status === "complete") {
        return res.status(400).json({ error: "Revert the book to editing before co-writing." });
      }

      const action = req.body?.action === "rewrite" ? "rewrite" : "continue";
      const before = typeof req.body?.before === "string" ? req.body.before.slice(0, 12000) : "";
      const after = typeof req.body?.after === "string" ? req.body.after.slice(0, 4000) : "";
      const selection = typeof req.body?.selection === "string" ? req.body.selection.slice(0, 4000) : "";
      const instruction = typeof req.body?.instruction === "string" ? req.body.instruction.trim().slice(0, 1000) : "";
      if (action === "rewrite" && !selection.trim()) {
        return res.status(400).json({ error: "Select some text to rewrite first." });
      }
      if (action === "continue" && !before.trim()) {
        return res.status(400).json({ error: "Nothing to continue from yet." });
      }

      const dna = await storage.getBookDna(projectId);
      const allChapters = await storage.getChapters(projectId);
      const continuityExtras = await loadContinuityExtras(project);
      const consistencyContext = buildConsistencyContext(allChapters, chapter.chapterNumber, continuityExtras);
      const styleContext = await loadStyleContext(project.styleFingerprintId);
      const fiction = isFiction(project.vertical);

      const bookLine = dna
        ? `You are co-writing Chapter ${chapter.chapterNumber} ("${chapter.title}") of "${project.title}", a ${project.vertical} ${fiction ? "novel" : "book"}. Core promise: ${dna.corePromise}. Tone rules: ${dna.toneRules}. Write in ${project.targetLanguage}.`
        : `You are co-writing Chapter ${chapter.chapterNumber} ("${chapter.title}") of "${project.title}", a ${project.vertical} ${fiction ? "novel" : "book"}. Write in ${project.targetLanguage}.`;
      const context = [bookLine, consistencyContext, styleContext].filter(Boolean).join("\n\n");

      const result = await runStep(
        projectId,
        `Co-write (${action}): Ch.${chapter.chapterNumber}`,
        HIGH_MODEL,
        async () => {
          const { suggestion, tokens } = await generateInlineCompletion({
            action, before, selection, after, instruction, context,
          });
          return { result: suggestion, tokens };
        },
      );

      if (!result.trim()) return res.status(500).json({ error: "The co-writer returned no text. Try again." });
      res.json({ suggestion: result });
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/competitor-teardown", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      if (!projectId) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const competitorInput = typeof req.body?.competitorInput === "string" ? req.body.competitorInput.slice(0, 4000) : "";
      const dna = await storage.getBookDna(projectId);

      const teardown = await runStep(
        projectId,
        "Competitor Teardown",
        FAST_MODEL,
        async () => {
          const { result, tokens } = await analyzeCompetitor(project, dna, competitorInput);
          return { result, tokens };
        },
      );

      const saved = await storage.createMarketReport({
        projectId,
        vertical: project.vertical,
        kind: "competitor_teardown",
        data: teardown,
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/kdp-optimizer", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      if (!projectId) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const dna = await storage.getBookDna(projectId);

      const optimization = await runStep(
        projectId,
        "KDP Keyword & Category Optimizer",
        FAST_MODEL,
        async () => {
          const { result, tokens } = await optimizeKdp(project, dna);
          return { result, tokens };
        },
      );

      const saved = await storage.createMarketReport({
        projectId,
        vertical: project.vertical,
        kind: "kdp_optimizer",
        data: optimization,
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/revenue-forecast", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      if (!projectId) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const forecastBody = z.object({
        assumptions: z.object({
          listPrice: z.coerce.number().optional(),
          royaltyRate: z.coerce.number().optional(),
          monthlyUnits: z.coerce.number().optional(),
          monthlyGrowth: z.coerce.number().optional(),
          months: z.coerce.number().optional(),
          platformFeePerUnit: z.coerce.number().optional(),
        }).partial().optional(),
      }).parse(req.body || {});
      const { assumptions, projections } = computeRevenueForecast(forecastBody.assumptions || {});
      const saved = await storage.createRevenueForecast({
        projectId,
        assumptions,
        projections,
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/ab-test", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      if (!projectId) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });
      const { testType } = z.object({
        testType: z.enum(["title", "blurb", "cover"]).default("title"),
      }).parse(req.body || {});
      const dna = await storage.getBookDna(projectId);
      const marketing = await storage.getMarketingAsset(projectId);

      const generated = await runStep(
        projectId,
        `A/B Test — ${testType}`,
        FAST_MODEL,
        async () => {
          const { result, tokens } = await generateAbVariants(project, dna, marketing, testType);
          return { result, tokens };
        },
      );

      const saved = await storage.createAbTest({
        projectId,
        testType,
        variants: generated.variants,
        winnerIndex: null,
      });
      res.json(saved);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/ab-test/:testId/winner", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const testId = parseId(req.params.testId);
      if (!projectId || !testId) return res.status(400).json({ error: "Invalid ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const tests = await storage.getAbTests(projectId);
      const test = tests.find(t => t.id === testId);
      if (!test) return res.status(404).json({ error: "Test not found" });

      const variants = Array.isArray(test.variants) ? (test.variants as any[]) : [];
      const { winnerIndex } = z.object({ winnerIndex: z.coerce.number().int() }).parse(req.body || {});
      if (winnerIndex < 0 || winnerIndex >= variants.length) {
        return res.status(400).json({ error: "Invalid winner index" });
      }

      const updated = await storage.updateAbTest(testId, { winnerIndex });
      const winnerText = typeof variants[winnerIndex]?.text === "string" ? variants[winnerIndex].text : "";

      if (winnerText) {
        if (test.testType === "title") {
          await storage.updateProject(projectId, { title: winnerText });
        } else if (test.testType === "cover") {
          await storage.updateProject(projectId, { coverPrompt: winnerText });
        } else if (test.testType === "blurb") {
          const marketing = await storage.getMarketingAsset(projectId);
          const payload = insertMarketingAssetSchema.parse({
            ...(marketing || {}),
            projectId,
            shortBlurb: winnerText,
          });
          await storage.upsertMarketingAsset(payload);
        }
      }

      res.json(updated);
      saveDbSeed().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/analytics", async (_req, res) => {
    try {
      const projects = await storage.getProjects();
      const events = await storage.getAnalyticsEvents();
      const allRunSteps = (await Promise.all(projects.map(p => storage.getRunSteps(p.id)))).flat();
      const analytics = aggregatePortfolioAnalytics(projects, allRunSteps, events);
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const AUDIO_DIR = path.resolve("uploads/audio");
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  function voiceAudioDir(voiceId: string): string {
    const safeVoice = voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
    const dir = path.join(AUDIO_DIR, safeVoice);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function chapterAudioFilename(projectId: number, chapterId: number): string {
    return `project-${projectId}-chapter-${chapterId}.mp3`;
  }

  // Canonical, text-safe per-voice page asset saved under the book's voice
  // namespace. The text hash is part of the filename so reused audio stays
  // correct even when client-side pagination changes (different font/viewport
  // produce different page slices). This is the "indexed page-level chapter
  // asset" persisted to the book profile and linked via audio_tracks.
  function chapterPageAudioFilename(projectId: number, chapterId: number, pageIndex: number, textHash: string): string {
    return `project-${projectId}-chapter-${chapterId}-page-${pageIndex}-${textHash}.mp3`;
  }

  app.post("/api/projects/:id/chapters/:chapterId/generate-audio", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      if (chapter.status !== "complete" || !chapter.content) return res.status(400).json({ error: "Chapter must be complete with content" });

      const { voice } = req.body || {};
      const voiceId = voice || "fabb918a343d4591b428083a35980dc4";
      const dir = voiceAudioDir(voiceId);
      const filename = chapterAudioFilename(projectId, chapterId);
      const filePath = path.join(dir, filename);

      const safeVoice = voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const audioUrl = `/uploads/audio/${safeVoice}/${filename}`;
        linkChapterAudioTrack({
          projectId, chapterId, pageIndex: null, scope: "chapter",
          voiceId, audioUrl, fileSize: stat.size, wordCount: chapter.wordCount ?? 0,
        }).catch(() => {});
        return res.json({ audioUrl, chapterId, size: stat.size, cached: true });
      }

      const cleanText = (chapter.content || "").replace(/[#*_`~>\[\]()]/g, "");
      if (!cleanText.trim()) return res.status(400).json({ error: "Chapter has no narrable content" });

      const textChunks = chunkText(cleanText);
      const audioChunks: Buffer[] = [];
      for (const chunk of textChunks) {
        const buf = await elevenLabsTTS(chunk, voiceId);
        audioChunks.push(buf);
      }
      if (audioChunks.length === 0) return res.status(400).json({ error: "No audio generated" });

      const combined = Buffer.concat(audioChunks);
      fs.writeFileSync(filePath, combined);

      const audioUrl = `/uploads/audio/${safeVoice}/${filename}`;
      await storage.updateChapter(chapterId, { audioUrl });
      linkChapterAudioTrack({
        projectId, chapterId, pageIndex: null, scope: "chapter",
        voiceId, audioUrl, fileSize: combined.length, wordCount: chapter.wordCount ?? 0,
      }).catch(() => {});

      res.json({ audioUrl, chapterId, size: combined.length });
    } catch (err: any) {
      console.error("Chapter audio generation error:", err.message, err.stack);
      res.status(500).json({ error: "Failed to generate chapter audio" });
    }
  });

  app.get("/api/projects/:id/chapters/:chapterId/audio", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });

      const voiceId = (req.query.voice as string) || "fabb918a343d4591b428083a35980dc4";
      const dir = voiceAudioDir(voiceId);
      const filename = chapterAudioFilename(projectId, chapterId);
      const filePath = path.join(dir, filename);

      if (!fs.existsSync(filePath)) {
        const isDefaultVoice = voiceId === "qJemC2CfKzP2DljOYBYj";
        const isLegacyPath = chapter.audioUrl && chapter.audioUrl.startsWith("/uploads/audio/project-");
        if (isDefaultVoice && isLegacyPath) {
          const legacyPath = path.resolve("." + chapter.audioUrl);
          if (fs.existsSync(legacyPath)) {
            const project = await storage.getProject(projectId);
            const dlName = `${slugify(project?.title || "book")}-ch${chapter.chapterNumber}.mp3`;
            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader("Content-Disposition", `attachment; filename="${dlName}"`);
            return fs.createReadStream(legacyPath).pipe(res);
          }
        }
        return res.status(404).json({ error: "No audio generated for this chapter with this voice" });
      }

      const project = await storage.getProject(projectId);
      const dlName = `${slugify(project?.title || "book")}-ch${chapter.chapterNumber}.mp3`;
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${dlName}"`);
      storage.createAnalyticsEvent({ projectId, eventType: "listen", value: 1, metadata: { chapterId } }).catch(() => {});
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================================================================
  // Localization: translated editions (translate / export / narrate)
  // ===================================================================

  const LANG_BCP47: Record<string, string> = {
    english: "en", spanish: "es", portuguese: "pt", french: "fr", german: "de",
  };
  const LANG_DISPLAY: Record<string, string> = {
    english: "English", spanish: "Spanish", portuguese: "Portuguese", french: "French", german: "German",
  };

  function editionAudioFilename(editionId: number, chapterId: number): string {
    return `edition-${editionId}-chapter-${chapterId}.mp3`;
  }

  // In-process guard against duplicate concurrent translation jobs for the
  // same project+language (closes the read-then-write race in POST /editions).
  const editionJobs = new Set<string>();

  // Translate every completed chapter of a project into the target language,
  // preserving terminology/tone via a shared glossary, then run a QA pass.
  async function translateEdition(projectId: number, editionId: number, sourceLang: string, targetLang: string) {
    const project = await storage.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const dna = await storage.getBookDna(projectId);
    const chapters = (await storage.getChapters(projectId)).filter(c => c.status === "complete" && c.content);
    if (chapters.length === 0) throw new Error("No completed chapters to translate");

    const srcName = LANG_DISPLAY[sourceLang] || sourceLang;
    const tgtName = LANG_DISPLAY[targetLang] || targetLang;

    // 1) Build a terminology glossary so names/terms stay consistent across chapters.
    let glossary = "";
    try {
      glossary = await runStep(projectId, `Translation glossary — ${tgtName}`, FAST_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [{
            role: "system",
            content: `You are a localization lead preparing a translation glossary for translating a book from ${srcName} into ${tgtName}.`,
          }, {
            role: "user",
            content: `Book: "${project.title}" by ${project.authorName || "Unknown"}
${dna ? `Core Promise: ${dna.corePromise}\nTone Rules: ${dna.toneRules}\n` : ""}Chapters: ${chapters.map(c => c.title).join("; ")}

List the key proper nouns, character names, recurring terminology and brand terms that must be translated consistently. For each, give the preferred ${tgtName} rendering (keep names untranslated where appropriate). Output a concise plain-text glossary, one term per line as "source -> target". No commentary.`,
          }],
          max_completion_tokens: 1500,
        });
        const text = completion.choices[0].message.content || "";
        return { result: text, tokens: completion.usage?.total_tokens || 800 };
      });
    } catch {
      glossary = "";
    }

    // 2) Translate each chapter into memory first. Existing translated chapters
    // stay untouched until the entire replacement is ready.
    const translatedChapters: Array<{ chapterNumber: number; title: string; content: string; wordCount: number }> = [];
    for (const ch of chapters) {
      const translated = await runStep(projectId, `Translate Ch ${ch.chapterNumber} — ${tgtName}`, HIGH_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: HIGH_MODEL,
    reasoning_effort: "high",
          messages: [{
            role: "system",
            content: `You are a professional literary translator translating a ${project.vertical} book from ${srcName} into ${tgtName}.
Preserve the author's voice, tone and meaning. Keep Markdown structure (headings, lists, blockquotes) intact. Translate naturally and idiomatically — do not translate word-for-word. Do not add notes or commentary.${glossary ? `\n\nUse this glossary for consistent terminology:\n${glossary}` : ""}`,
          }, {
            role: "user",
            content: `Translate this chapter into ${tgtName}. Return only the translated chapter text.\n\n# ${ch.title}\n\n${ch.content}`,
          }],
          max_completion_tokens: 8192,
        });
        const text = completion.choices[0].message.content || "";
        return { result: text, tokens: completion.usage?.total_tokens || 4000 };
      });

      // Translate the chapter title separately so the TOC reads naturally.
      let translatedTitle = ch.title;
      try {
        const tc = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [{ role: "system", content: `Translate the following book chapter title from ${srcName} into ${tgtName}. Return only the translated title, no quotes.` }, { role: "user", content: ch.title }],
          max_completion_tokens: 100,
        });
        translatedTitle = (tc.choices[0].message.content || ch.title).trim() || ch.title;
      } catch {
        /* fall back to source title */
      }

      const wordCount = translated.split(/\s+/).filter(Boolean).length;
      translatedChapters.push({
        chapterNumber: ch.chapterNumber,
        title: translatedTitle,
        content: translated,
        wordCount,
      });
    }

    // 3) QA pass — terminology/consistency/tone review recorded as a run step.
    try {
      const sample = translatedChapters.slice(0, 3).map(c => `## ${c.title}\n${c.content.slice(0, 1200)}`).join("\n\n");
      await runStep(projectId, `Translation QA — ${tgtName}`, FAST_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [{
            role: "system",
            content: `You are a localization QA reviewer for a ${tgtName} translation. Check terminology consistency, tone fidelity and fluency.`,
          }, {
            role: "user",
            content: `Glossary:\n${glossary || "(none)"}\n\nTranslated sample:\n${sample}\n\nGive a short QA report: terminology consistency, tone match, and any issues to fix. Keep it under 150 words.`,
          }],
          max_completion_tokens: 600,
        });
        const text = completion.choices[0].message.content || "";
        return { result: text, tokens: completion.usage?.total_tokens || 400 };
      });
    } catch {
      /* QA is best-effort */
    }

    // Copy-on-success: one DB transaction replaces the old translated chapter
    // set only after every new chapter exists. A provider failure leaves the
    // previous good edition intact.
    await storage.replaceEditionChapters(editionId, translatedChapters);
  }

  app.post("/api/projects/:id/editions", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      if (!projectId) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Not found" });

      const language = String(req.body?.language || "").toLowerCase();
      if (!LANGUAGES.includes(language as any)) {
        return res.status(400).json({ error: "Invalid language" });
      }
      const sourceLang = (project.targetLanguage || "english").toLowerCase();
      if (language === sourceLang) {
        return res.status(400).json({ error: "Target language matches the book's original language" });
      }
      const completed = (await storage.getChapters(projectId)).filter(c => c.status === "complete" && c.content);
      if (completed.length === 0) {
        return res.status(400).json({ error: "Book has no completed chapters to translate" });
      }

      const jobKey = `${projectId}:${language}`;
      if (editionJobs.has(jobKey)) {
        return res.status(409).json({ error: "Translation already in progress" });
      }

      // Reuse an existing edition for re-translation; otherwise create one.
      const existing = (await storage.getBookEditions(projectId)).find(e => e.language === language);
      let edition = existing;
      if (edition) {
        if (edition.status === "translating") return res.status(409).json({ error: "Translation already in progress" });
        edition = await storage.updateBookEdition(edition.id, { status: "translating" });
      } else {
        edition = await storage.createBookEdition({ projectId, language, status: "translating" });
      }

      editionJobs.add(jobKey);
      res.status(202).json({ edition });

      // Run translation in the background so the request returns promptly.
      (async () => {
        try {
          await translateEdition(projectId, edition!.id, sourceLang, language);
          await storage.updateBookEdition(edition!.id, { status: "complete" });
        } catch (e: any) {
          console.error("Edition translation failed:", e?.message);
          await storage.updateBookEdition(edition!.id, { status: "failed" }).catch(() => {});
        } finally {
          editionJobs.delete(jobKey);
        }
      })();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/editions/:editionId/export", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const editionId = parseId(req.params.editionId);
      if (!projectId || !editionId) return res.status(400).json({ error: "Invalid ID" });
      const format = (req.query.format as string) || "txt";
      const allowedFormats = ["txt", "html", "epub", "docx", "mobi"];
      if (!allowedFormats.includes(format)) {
        return res.status(400).json({ error: "Invalid format" });
      }
      const project = await storage.getProject(projectId);
      const edition = await storage.getBookEdition(editionId);
      if (!project || !edition || edition.projectId !== projectId) return res.status(404).json({ error: "Edition not found" });
      if (edition.status !== "complete") return res.status(409).json({ error: "Edition is not ready to export yet" });
      const editionChapterList = (await storage.getEditionChapters(editionId)).filter(c => c.content);
      if (editionChapterList.length === 0) return res.status(400).json({ error: "No translated chapters to export" });

      const authorName = project.authorName || "Unknown Author";
      const title = project.title;
      const bcp47 = LANG_BCP47[edition.language] || "en";
      const fileBase = `${slugify(title)}-${edition.language}`;

      if (format === "epub") {
        const epub = buildEpub({ title, authorName, language: bcp47, chapters: editionChapterList });
        await storage.createExportJob({ projectId, format: "epub", language: edition.language, status: "complete" });
        res.setHeader("Content-Type", "application/epub+zip");
        res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.epub"`);
        return res.send(epub);
      }
      if (format === "docx") {
        const docx = buildDocx({ title, authorName, chapters: editionChapterList });
        await storage.createExportJob({ projectId, format: "docx", language: edition.language, status: "complete" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.docx"`);
        return res.send(docx);
      }
      if (format === "mobi") {
        const mobi = buildMobi({ title, authorName, chapters: editionChapterList });
        await storage.createExportJob({ projectId, format: "mobi", language: edition.language, status: "complete" });
        res.setHeader("Content-Type", "application/x-mobipocket-ebook");
        res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.mobi"`);
        return res.send(mobi);
      }
      if (format === "html") {
        const html = buildHtmlExport(title, authorName, editionChapterList);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.html"`);
        return res.send(html);
      }

      const lines: string[] = [];
      lines.push("=".repeat(60), "", title.toUpperCase(), "", `by ${authorName}`, "", "=".repeat(60), "", "");
      lines.push("TABLE OF CONTENTS", "-".repeat(40));
      editionChapterList.forEach(ch => lines.push(`  Chapter ${ch.chapterNumber}: ${ch.title}`));
      lines.push("", "");
      editionChapterList.forEach(ch => {
        lines.push("=".repeat(60), `CHAPTER ${ch.chapterNumber}`, ch.title.toUpperCase(), "=".repeat(60), "", ch.content || "", "", "");
      });
      lines.push("=".repeat(60), "END", "=".repeat(60));
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.txt"`);
      res.send(lines.join("\n"));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/editions/:editionId/chapters/:chapterId/generate-audio", requireRole("editor"), async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const editionId = parseId(req.params.editionId);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !editionId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const edition = await storage.getBookEdition(editionId);
      if (!edition || edition.projectId !== projectId) return res.status(404).json({ error: "Edition not found" });
      const chapter = await storage.getEditionChapter(chapterId);
      if (!chapter || chapter.editionId !== editionId) return res.status(404).json({ error: "Chapter not found" });
      if (!chapter.content) return res.status(400).json({ error: "Chapter has no content" });

      const voiceId = (req.body?.voice as string) || DEFAULT_NARRATOR_VOICE;
      const dir = voiceAudioDir(voiceId);
      const filename = editionAudioFilename(editionId, chapterId);
      const filePath = path.join(dir, filename);
      const safeVoice = voiceId.replace(/[^a-zA-Z0-9_-]/g, "");

      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const audioUrl = `/uploads/audio/${safeVoice}/${filename}`;
        if (chapter.audioUrl !== audioUrl) await storage.updateEditionChapter(chapterId, { audioUrl });
        return res.json({ audioUrl, chapterId, size: stat.size, cached: true });
      }

      const combined = await synthText(chapter.content, voiceId);
      if (!combined || combined.length === 0) return res.status(400).json({ error: "No audio generated" });
      fs.writeFileSync(filePath, combined);
      const audioUrl = `/uploads/audio/${safeVoice}/${filename}`;
      await storage.updateEditionChapter(chapterId, { audioUrl });
      res.json({ audioUrl, chapterId, size: combined.length });
    } catch (err: any) {
      console.error("Edition audio generation error:", err.message);
      res.status(500).json({ error: "Failed to generate edition audio" });
    }
  });

  app.get("/api/projects/:id/editions/:editionId/chapters/:chapterId/audio", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const editionId = parseId(req.params.editionId);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !editionId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const edition = await storage.getBookEdition(editionId);
      if (!edition || edition.projectId !== projectId) return res.status(404).json({ error: "Edition not found" });
      const chapter = await storage.getEditionChapter(chapterId);
      if (!chapter || chapter.editionId !== editionId) return res.status(404).json({ error: "Chapter not found" });

      const voiceId = (req.query.voice as string) || DEFAULT_NARRATOR_VOICE;
      const dir = voiceAudioDir(voiceId);
      const filename = editionAudioFilename(editionId, chapterId);
      const filePath = path.join(dir, filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "No audio generated for this chapter with this voice" });

      const project = await storage.getProject(projectId);
      const dlName = `${slugify(project?.title || "book")}-${edition.language}-ch${chapter.chapterNumber}.mp3`;
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${dlName}"`);
      storage.createAnalyticsEvent({ projectId, eventType: "listen", value: 1, metadata: { editionId, chapterId } }).catch(() => {});
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const audiobookSchema = z.object({
    narratorVoice: z.string().min(1).optional(),
    voiceMap: z.record(z.string(), z.string()).optional(),
    includeIntro: z.boolean().optional(),
    musicBed: z.boolean().optional(),
  });
  const trailerSchema = z.object({
    voiceId: z.string().min(1).optional(),
    musicBed: z.boolean().optional(),
  });

  function mergeMeta(asset: { metadata: unknown }, extra: Record<string, unknown>): Record<string, unknown> {
    const base = (asset.metadata && typeof asset.metadata === "object") ? asset.metadata as Record<string, unknown> : {};
    return { ...base, ...extra };
  }

  const MEDIA_ROOT = path.resolve("uploads/media");
  // Resolve a media url (/uploads/media/...) to an absolute path inside MEDIA_ROOT, or null.
  function resolveMediaPath(url: string | null | undefined): string | null {
    if (!url) return null;
    const abs = path.resolve("." + url);
    const rel = path.relative(MEDIA_ROOT, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return abs;
  }
  function removeMediaFile(url: string | null | undefined) {
    const p = resolveMediaPath(url);
    if (p && fs.existsSync(p)) { try { fs.rmSync(p, { force: true }); } catch { /* ignore */ } }
  }
  // Finalize a background media job race-safely: if the asset row was deleted while
  // processing, discard the produced file instead of leaving an orphan.
  async function finalizeMediaAsset(assetId: number, url: string, extraMeta: Record<string, unknown>) {
    const current = await storage.getMediaAsset(assetId);
    if (!current) { removeMediaFile(url); return; }
    await storage.updateMediaAsset(assetId, { status: "ready", url, metadata: mergeMeta(current, extraMeta) });
  }
  async function failMediaAsset(assetId: number, message: string) {
    const current = await storage.getMediaAsset(assetId);
    if (!current) return;
    await storage.updateMediaAsset(assetId, { status: "failed", metadata: mergeMeta(current, { error: message }) });
  }
  // Reject duplicate concurrent renders of the same kind for a project.
  async function hasInflightMedia(projectId: number, kind: string): Promise<boolean> {
    const existing = await storage.getMediaAssets(projectId);
    return existing.some((a) => a.kind === kind && a.status === "processing");
  }

  app.post("/api/projects/:id/audiobook", requireRole("editor"), aiRateLimit, async (req, res) => {
    try {
      const id = parseId(String(req.params.id));
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const parsed = audiobookSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });

      const chapters = await storage.getChapters(id);
      const completed = chapters.filter((c) => c.status === "complete" && c.content);
      if (completed.length === 0) return res.status(400).json({ error: "No completed chapters to narrate" });
      if (await hasInflightMedia(id, "audiobook")) return res.status(409).json({ error: "An audiobook is already rendering for this project" });

      const narratorVoice = parsed.data.narratorVoice || DEFAULT_NARRATOR_VOICE;
      const voiceMap = parsed.data.voiceMap || {};
      const includeIntro = parsed.data.includeIntro ?? true;
      const musicBed = parsed.data.musicBed ?? false;
      const characters = (await storage.getStoryEntities({ projectId: id })).filter((c) => c.type === "character");

      const asset = await storage.createMediaAsset({
        projectId: id, kind: "audiobook", status: "processing",
        metadata: { narratorVoice, voiceMap, includeIntro, musicBed, chapterCount: completed.length },
      });
      res.status(202).json({ asset });

      (async () => {
        try {
          const out = await runStep(id, "audiobook", FAST_MODEL, async () => {
            const r = await generateAudiobook({ project, chapters, narratorVoice, voiceMap, includeIntro, musicBed, characters });
            return { result: r, tokens: r.tokens };
          });
          await finalizeMediaAsset(asset.id, out.url, { durationMs: out.durationMs, fileSize: out.fileSize, chapterCount: out.chapterCount, multiVoice: out.multiVoice });
        } catch (e: any) {
          console.error("Audiobook generation failed:", e.message);
          await failMediaAsset(asset.id, e.message);
        }
      })();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/audio-trailer", requireRole("editor"), aiRateLimit, async (req, res) => {
    try {
      const id = parseId(String(req.params.id));
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const parsed = trailerSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });

      if (await hasInflightMedia(id, "audio_trailer")) return res.status(409).json({ error: "An audio trailer is already rendering for this project" });
      const voiceId = parsed.data.voiceId || DEFAULT_NARRATOR_VOICE;
      const musicBed = parsed.data.musicBed ?? true;
      const marketing = await storage.getMarketingAsset(id);

      const asset = await storage.createMediaAsset({
        projectId: id, kind: "audio_trailer", status: "processing", metadata: { voiceId, musicBed },
      });
      res.status(202).json({ asset });

      (async () => {
        try {
          const out = await runStep(id, "audio_trailer", FAST_MODEL, async () => {
            const r = await generateAudioTrailer({ project, marketing, voiceId, musicBed });
            return { result: r, tokens: r.tokens };
          });
          await finalizeMediaAsset(asset.id, out.url, { script: out.script, durationMs: out.durationMs, fileSize: out.fileSize });
        } catch (e: any) {
          console.error("Audio trailer generation failed:", e.message);
          await failMediaAsset(asset.id, e.message);
        }
      })();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/video-trailer", requireRole("editor"), aiRateLimit, async (req, res) => {
    try {
      const id = parseId(String(req.params.id));
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      const parsed = trailerSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });

      if (await hasInflightMedia(id, "video_trailer")) return res.status(409).json({ error: "A video trailer is already rendering for this project" });
      const voiceId = parsed.data.voiceId || DEFAULT_NARRATOR_VOICE;
      const marketing = await storage.getMarketingAsset(id);

      const asset = await storage.createMediaAsset({
        projectId: id, kind: "video_trailer", status: "processing", metadata: { voiceId },
      });
      res.status(202).json({ asset });

      (async () => {
        try {
          const out = await runStep(id, "video_trailer", FAST_MODEL, async () => {
            const r = await generateVideoTrailer({ project, marketing, voiceId });
            return { result: r, tokens: r.tokens };
          });
          await finalizeMediaAsset(asset.id, out.url, { script: out.script, durationMs: out.durationMs, fileSize: out.fileSize });
        } catch (e: any) {
          console.error("Video trailer generation failed:", e.message);
          await failMediaAsset(asset.id, e.message);
        }
      })();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/media-assets/:id/download", requireAdmin, async (req, res) => {
    try {
      const id = parseId(String(req.params.id));
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      const asset = await storage.getMediaAsset(id);
      if (!asset || !asset.url) return res.status(404).json({ error: "Media asset not found" });
      if (asset.status !== "ready") return res.status(409).json({ error: "Media asset is not ready" });
      const filePath = resolveMediaPath(asset.url);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      const project = await storage.getProject(asset.projectId);
      const ext = path.extname(filePath) || ".bin";
      const dlName = `${slugify(project?.title || "book")}-${asset.kind}${ext}`;
      res.setHeader("Content-Type", ext === ".mp4" ? "video/mp4" : "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${dlName}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/media-assets/:id", async (req, res) => {
    try {
      const id = parseId(String(req.params.id));
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      const asset = await storage.getMediaAsset(id);
      if (!asset) return res.status(404).json({ error: "Media asset not found" });
      removeMediaFile(asset.url);
      await storage.deleteMediaAsset(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/generate-marketing", requireRole("editor"), async (req, res) => {
    let prevStatus = "draft";
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      prevStatus = project.status;

      await storage.updateProject(id, { status: "marketing" });

      const dna = await storage.getBookDna(id);
      const guidanceContext: string[] = [];
      if (project.description) guidanceContext.push(`Book description & author guidance: ${project.description}`);
      if (dna?.readerAvatar) guidanceContext.push(`Target reader: ${dna.readerAvatar}`);
      if (dna?.corePromise) guidanceContext.push(`Core promise: ${dna.corePromise}`);
      if (dna?.toneRules) guidanceContext.push(`Tone & voice: ${dna.toneRules}`);
      if (dna?.transformationArc) guidanceContext.push(`Transformation arc: ${dna.transformationArc}`);
      if (dna?.frameworkSummary) guidanceContext.push(`Framework: ${dna.frameworkSummary}`);
      const guidanceBlock = guidanceContext.length > 0
        ? `\n\nUse this book's specific guidance so the marketing matches the author's intent, stated audience, and tone:\n${guidanceContext.join("\n")}\n\nThe blurbs, hooks, ad angles, and emails MUST speak directly to the stated target audience and adopt the stated tone — not generic category copy.`
        : "";

      const result = await runStep(id, "Marketing Suite", FAST_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [{
            role: "system",
            content: "You are a book marketing expert. Respond ONLY with valid JSON.",
          }, {
            role: "user",
            content: `Generate a complete marketing suite for the book "${project.title}" in the ${project.vertical} niche.${guidanceBlock}

Return JSON with:
- shortBlurb: string (50 words)
- mediumBlurb: string (150 words)
- longBlurb: string (300 words)
- amazonDescription: string (Amazon product description with HTML formatting, 400 words)
- hooks: array of 10 compelling social media hooks
- adAngles: array of 8 ad angles for Facebook/Instagram ads
- emailSequence: array of 5 objects with {subject, preview, day}
- socialCalendar: array of 10 objects with {day, platform, content, format}
- pricingMatrix: object with {ebook, paperback, hardcover, bundle, audiobook} prices
- authorBio: string (professional author bio, 100 words)`,
          }],
          max_completion_tokens: 8192,
          response_format: { type: "json_object" },
        });
        const content = completion.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);
        const tokens = completion.usage?.total_tokens || 3000;
        return { result: parsed, tokens };
      });

      const asset = await storage.upsertMarketingAsset({
        projectId: id,
        shortBlurb: result.shortBlurb,
        mediumBlurb: result.mediumBlurb,
        longBlurb: result.longBlurb,
        amazonDescription: result.amazonDescription,
        hooks: result.hooks,
        adAngles: result.adAngles,
        emailSequence: result.emailSequence,
        socialCalendar: result.socialCalendar,
        pricingMatrix: result.pricingMatrix,
        authorBio: result.authorBio,
      });

      await storage.updateProject(id, { status: "complete" });

      res.json(asset);
    } catch (err: any) {
      await storage.updateProject(parseId(req.params.id)!, { status: prevStatus }).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/generate-cover", requireRole("editor"), async (req, res) => {
    let prevStatus = "draft";
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      prevStatus = project.status;

      const { coverPrompt, avoidStyles } = req.body || {};

      if (coverPrompt || avoidStyles) {
        await storage.updateProject(id, {
          coverPrompt: coverPrompt || project.coverPrompt,
          coverAvoidStyles: avoidStyles || project.coverAvoidStyles,
        });
      }

      const dna = await storage.getBookDna(id);
      const trend = await storage.getTrendReportByProject(id);
      const chapterList = await storage.getChapters(id);
      const brandKit = project.brandKitId ? await storage.getBrandKit(project.brandKitId) : undefined;

      const prompt = buildCoverPrompt({
        project,
        dna,
        trend,
        chapterList,
        userPrompt: coverPrompt || project.coverPrompt || "",
        userAvoid: avoidStyles || project.coverAvoidStyles || "",
        brandKit,
      });

      const imageUrl = await runStep(id, "Cover Generation", IMAGE_MODEL, async () => {
        const completion = await openai.images.generate({
          model: IMAGE_MODEL,
          prompt,
          size: "1024x1536",
          n: 1,
        });

        const imageB64 = (completion.data?.[0] as any)?.b64_json;
        let url = (completion.data?.[0] as any)?.url;

        if (imageB64) {
          url = `data:image/png;base64,${imageB64}`;
        }

        return { result: url, tokens: 1 };
      });

      await storage.updateProject(id, { coverImageUrl: imageUrl });

      res.json({ coverImageUrl: imageUrl });
    } catch (err: any) {
      await storage.updateProject(parseId(req.params.id)!, { status: prevStatus }).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  // --- Cover Variant Studio ---
  const COVER_VARIANT_DIRECTIVES = [
    "bold typographic treatment with a single striking central symbol",
    "atmospheric photographic scene with cinematic depth",
    "minimalist negative-space design with one focal accent",
    "rich illustrative artwork with layered detail and texture",
  ];

  app.post("/api/projects/:id/cover-variants", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });

      const countSchema = z.object({
        count: z.number().int().min(1).max(4).optional(),
        coverPrompt: z.string().optional(),
        avoidStyles: z.string().optional(),
      });
      const { count, coverPrompt, avoidStyles } = countSchema.parse(req.body || {});
      const n = count ?? 2;

      const dna = await storage.getBookDna(id);
      const trend = await storage.getTrendReportByProject(id);
      const chapterList = await storage.getChapters(id);
      const brandKit = project.brandKitId ? await storage.getBrandKit(project.brandKitId) : undefined;

      const userPrompt = coverPrompt || project.coverPrompt || "";
      const userAvoid = avoidStyles || project.coverAvoidStyles || "";

      const created = [];
      for (let i = 0; i < n; i++) {
        const directive = COVER_VARIANT_DIRECTIVES[i % COVER_VARIANT_DIRECTIVES.length];
        const prompt = buildCoverPrompt({
          project,
          dna,
          trend,
          chapterList,
          userPrompt,
          userAvoid,
          brandKit,
          variantDirective: directive,
        });
        const imageUrl = await runStep(id, "Cover Variant", IMAGE_MODEL, async () => {
          const completion = await openai.images.generate({
            model: IMAGE_MODEL,
            prompt,
            size: "1024x1536",
            n: 1,
          });
          const imageB64 = (completion.data?.[0] as any)?.b64_json;
          let url = (completion.data?.[0] as any)?.url;
          if (imageB64) url = `data:image/png;base64,${imageB64}`;
          return { result: url, tokens: 1 };
        });
        const variant = await storage.createCoverVariant({ projectId: id, imageUrl, prompt: directive });
        created.push(variant);
      }

      res.json({ variants: created });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/cover-variants/:variantId/select", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const variantId = parseId(req.params.variantId);
      if (!id || !variantId) return res.status(400).json({ error: "Invalid ID" });
      const variants = await storage.getCoverVariants(id);
      const variant = variants.find(v => v.id === variantId);
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      await storage.selectCoverVariant(id, variantId);
      await storage.updateProject(id, { coverImageUrl: variant.imageUrl });
      res.json({ success: true, coverImageUrl: variant.imageUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id/cover-variants/:variantId", requireRole("editor"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const variantId = parseId(req.params.variantId);
      if (!id || !variantId) return res.status(400).json({ error: "Invalid ID" });
      const variants = await storage.getCoverVariants(id);
      if (!variants.some(v => v.id === variantId)) return res.status(404).json({ error: "Variant not found" });
      await storage.deleteCoverVariant(variantId);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Author Brand Kits ---
  app.get("/api/brand-kits", async (_req, res) => {
    try {
      const kits = await storage.getBrandKits();
      res.json(kits);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/brand-kits", async (req, res) => {
    try {
      const data = insertBrandKitSchema.parse(req.body);
      const kit = await storage.createBrandKit(data);
      if (kit.isDefault) {
        const others = (await storage.getBrandKits()).filter(k => k.id !== kit.id && k.isDefault);
        await Promise.all(others.map(k => storage.updateBrandKit(k.id, { isDefault: false })));
      }
      res.status(201).json(kit);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/brand-kits/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid brand kit ID" });
      const data = insertBrandKitSchema.partial().parse(req.body);
      const existing = await storage.getBrandKit(id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const updated = await storage.updateBrandKit(id, data);
      if (data.isDefault) {
        const others = (await storage.getBrandKits()).filter(k => k.id !== id && k.isDefault);
        await Promise.all(others.map(k => storage.updateBrandKit(k.id, { isDefault: false })));
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/brand-kits/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid brand kit ID" });
      const existing = await storage.getBrandKit(id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      await storage.deleteBrandKit(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/trends", async (req, res) => {
    try {
      const { vertical } = req.query;
      const reports = await storage.getTrendReports(vertical as string | undefined);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/trends/forecast", async (_req, res) => {
    try {
      const reports = await storage.getTrendReports();
      const forecasts = forecastTrends(reports);
      const alerts = forecasts.filter(f => f.alert === "act-now" || f.alert === "rising");
      res.json({ forecasts, alerts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/trends/analyze", async (req, res) => {
    try {
      const { vertical, keywords } = trendAnalyzeSchema.parse(req.body);

      const completion = await openai.chat.completions.create({
        model: FAST_MODEL,
        messages: [{
          role: "system",
          content: "You are a book market intelligence analyst. Respond ONLY with valid JSON.",
        }, {
          role: "user",
          content: `Analyze current market trends for the "${vertical}" book niche${keywords ? ` focusing on: ${keywords}` : ""}.

Return JSON with:
- demandScore (1-10)
- competitionScore (1-10)
- greenlightScore (1-10)
- painPoints (array of 6 specific reader pain points)
- titleAngles (array of 6 high-converting title angles)
- nicheTopics (array of 6 emerging micro-niche opportunities)
- keywords (array of 10 search keywords)
- summary (3-sentence market intelligence brief)`,
        }],
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      const report = await storage.createTrendReport({
        vertical,
        demandScore: parsed.demandScore,
        competitionScore: parsed.competitionScore,
        greenlightScore: parsed.greenlightScore,
        painPoints: parsed.painPoints,
        titleAngles: parsed.titleAngles,
        nicheTopics: parsed.nicheTopics,
        keywords: parsed.keywords,
        summary: parsed.summary,
      });

      const greenlight = Number(parsed.greenlightScore) || 0;
      if (greenlight >= 8) {
        const label = vertical.charAt(0).toUpperCase() + vertical.slice(1);
        await notify({
          kind: "trend",
          title: `High-demand trend: ${label}`,
          body: `Greenlight ${greenlight}/10 — strong opportunity detected in the ${label} vertical.`,
          link: "/trends",
          metadata: { vertical, greenlight },
        });
      }

      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/autopilot", async (_req, res) => {
    try {
      const config = await storage.getAutopilotConfig();
      res.json(config || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/autopilot", async (req, res) => {
    try {
      const data = insertAutopilotConfigSchema.parse(req.body);
      const config = await storage.upsertAutopilotConfig(data);
      res.json(config);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/autopilot/runs", async (_req, res) => {
    try {
      const runs = await storage.getAutopilotRuns();
      res.json(runs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/autopilot/run", async (_req, res) => {
    try {
      if (isAutopilotRunning()) {
        return res.status(409).json({ error: "An autopilot run is already in progress" });
      }

      const config = await storage.getAutopilotConfig();
      if (!config || !config.isActive) {
        return res.status(400).json({ error: "Autopilot is not active. Enable it first." });
      }

      const language = config.targetLanguages?.[0] || "english";
      const strategy = parseStrategy(config.strategyData);
      const vertical = await selectNextVertical(config.vertical, strategy);

      const run = await storage.createAutopilotRun({
        vertical,
        status: "pending",
      });

      executeAutopilotRun(
        run.id,
        vertical,
        language,
        config.minQualityScore,
        config.budgetCapUsd,
        {
          minGreenlight: strategy.guardrails.minGreenlight,
          pauseOnLowQuality: strategy.guardrails.pauseOnLowQuality,
          allowDuplicateVertical: strategy.mode === "portfolio",
        }
      ).catch(async (err) => {
        console.error("Autopilot run failed:", err.message);
        await storage.updateAutopilotRun(run.id, {
          status: "failed",
          errorMessage: err.message,
          completedAt: new Date(),
        }).catch(() => {});
      });

      res.json(run);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/autopilot/stop", async (_req, res) => {
    try {
      const stopped = requestAutopilotStop();
      if (!stopped) {
        return res.status(400).json({ error: "No autopilot run is currently active" });
      }
      res.json({ success: true, message: "Stop signal sent. The run will stop after the current step completes." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Notifications ----
  app.get("/api/notifications", async (_req, res) => {
    try {
      res.json(await storage.getNotifications());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/notifications/digest", async (_req, res) => {
    try {
      const all = await storage.getNotifications();
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const recent = all.filter(n => new Date(n.createdAt).getTime() >= since);
      const unreadCount = all.filter(n => !n.isRead).length;
      const grouped: Record<string, typeof recent> = {};
      for (const n of recent) {
        (grouped[n.kind] ||= []).push(n);
      }
      const kindLabel: Record<string, string> = {
        pipeline: "Pipeline",
        trend: "Trend Alerts",
        sales: "Sales & Launches",
        info: "Updates",
      };
      const lines: string[] = [`Lexora Digest — last 24 hours`, ``];
      if (recent.length === 0) {
        lines.push("No new activity in the last 24 hours.");
      } else {
        for (const kind of Object.keys(grouped)) {
          lines.push(`${kindLabel[kind] || kind.toUpperCase()}:`);
          for (const n of grouped[kind]) {
            lines.push(`  • ${n.title}${n.body ? ` — ${n.body}` : ""}`);
          }
          lines.push("");
        }
      }
      lines.push(`You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} in Lexora.`);
      res.json({
        subject: `Lexora Digest — ${recent.length} update${recent.length === 1 ? "" : "s"} in 24h`,
        body: lines.join("\n"),
        count: recent.length,
        unreadCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/read-all", async (_req, res) => {
    try {
      await storage.markAllNotificationsRead();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid notification ID" });
      await storage.markNotificationRead(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getAppSettings();
      res.json(settings || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const data = req.body;
      const settings = await storage.upsertAppSettings(data);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const ttsCache = new Map<string, { audio: string; ts: number }>();
  const TTS_CACHE_MAX = 50;
  const TTS_CACHE_TTL = 10 * 60 * 1000;

  function ttsCacheKey(text: string, voice: string): string {
    return crypto.createHash("md5").update(`${voice}:${text}`).digest("hex");
  }

  function cleanTtsCache() {
    if (ttsCache.size <= TTS_CACHE_MAX) return;
    const entries = [...ttsCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    const toRemove = entries.slice(0, entries.length - TTS_CACHE_MAX);
    for (const [key] of toRemove) ttsCache.delete(key);
  }

  async function elevenLabsTTS(text: string, voiceId: string): Promise<Buffer> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  app.get("/api/elevenlabs/voices", async (_req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "ElevenLabs not configured" });
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to fetch voices");
      const data = await response.json() as { voices: { voice_id: string; name: string; category: string }[] };
      const voices = (data.voices || []).map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
      }));
      res.json({ voices });
    } catch (err: any) {
      console.error("ElevenLabs voices error:", err.message);
      res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  const TTS_DISK_DIR = path.resolve("uploads/audio/tts-cache");
  fs.mkdirSync(TTS_DISK_DIR, { recursive: true });

  // Convert an absolute path under uploads/ into a public /uploads/... URL.
  function uploadsUrl(absPath: string): string {
    const rel = path.relative(path.resolve("uploads"), absPath).split(path.sep).join("/");
    return `/uploads/${rel}`;
  }

  // Best-effort: associate generated audio with a book's chapter via the
  // audio_tracks table so the audio "sticks" to the book profile and can be
  // discovered/reused later. Never throws into the request path.
  async function linkChapterAudioTrack(opts: {
    projectId: number;
    chapterId: number;
    pageIndex: number | null;
    scope: "page" | "chapter";
    voiceId: string;
    audioUrl: string;
    fileSize?: number | null;
    wordCount?: number;
  }) {
    try {
      const chapter = await storage.getChapter(opts.chapterId);
      if (!chapter || chapter.projectId !== opts.projectId) return;
      await storage.upsertAudioTrack({
        projectId: opts.projectId,
        chapterId: opts.chapterId,
        scope: opts.scope,
        pageIndex: opts.pageIndex,
        voiceId: opts.voiceId,
        audioUrl: opts.audioUrl,
        fileSize: opts.fileSize ?? null,
        wordCount: opts.wordCount ?? 0,
      });
    } catch (err) {
      console.error("linkChapterAudioTrack failed:", err);
    }
  }

  // Parse optional book/chapter/page context from a TTS request body so reader
  // narration can be tied back to the originating book.
  function parseAudioContext(body: any): { projectId: number; chapterId: number; pageIndex: number | null } | null {
    const projectId = parseId(body?.projectId == null ? undefined : String(body.projectId));
    const chapterId = parseId(body?.chapterId == null ? undefined : String(body.chapterId));
    if (!projectId || !chapterId) return null;
    const rawPage = body?.pageIndex;
    const pageIndex = typeof rawPage === "number" && Number.isFinite(rawPage) && rawPage >= 0
      ? Math.floor(rawPage)
      : null;
    return { projectId, chapterId, pageIndex };
  }

  function ttsDiskPath(voiceId: string, textHash: string): string {
    const safeVoice = voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
    const dir = path.join(TTS_DISK_DIR, safeVoice);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${textHash}.mp3`);
  }

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }
      if (text.length > 4000) {
        return res.status(400).json({ error: "Text too long (max 4000 characters)" });
      }
      const trimmed = text.slice(0, 4000);
      const voiceId = voice || "fabb918a343d4591b428083a35980dc4";
      const cacheKey = ttsCacheKey(trimmed, voiceId);
      const ctx = parseAudioContext(req.body);
      const diskFile = ttsDiskPath(voiceId, cacheKey);
      // When the request carries valid book/chapter/page context, persist the
      // audio to a canonical, text-safe page asset under the book's voice
      // namespace (in addition to the generic hash cache). This is what makes
      // reader-generated narration "stick" to the book profile.
      const pageFile = ctx && ctx.pageIndex !== null
        ? path.join(voiceAudioDir(voiceId), chapterPageAudioFilename(ctx.projectId, ctx.chapterId, ctx.pageIndex, cacheKey))
        : null;
      const linkTrack = (fileSize?: number | null) => {
        if (ctx) {
          linkChapterAudioTrack({
            projectId: ctx.projectId,
            chapterId: ctx.chapterId,
            pageIndex: ctx.pageIndex,
            scope: "page",
            voiceId,
            audioUrl: uploadsUrl(pageFile || diskFile),
            fileSize: fileSize ?? null,
            wordCount: trimmed.split(/\s+/).filter(Boolean).length,
          }).catch(() => {});
        }
      };

      const cached = ttsCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < TTS_CACHE_TTL) {
        if (pageFile && !fs.existsSync(pageFile)) {
          try { fs.writeFileSync(pageFile, Buffer.from(cached.audio, "base64")); } catch {}
        }
        linkTrack(pageFile && fs.existsSync(pageFile) ? fs.statSync(pageFile).size : null);
        return res.json({ audio: cached.audio, format: "mp3" });
      }

      // Serve previously saved audio first: canonical page asset, then hash cache.
      if (pageFile && fs.existsSync(pageFile)) {
        const buf = fs.readFileSync(pageFile);
        const base64Audio = buf.toString("base64");
        ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
        linkTrack(buf.length);
        return res.json({ audio: base64Audio, format: "mp3" });
      }

      if (fs.existsSync(diskFile)) {
        const buf = fs.readFileSync(diskFile);
        const base64Audio = buf.toString("base64");
        ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
        if (pageFile) { try { fs.writeFileSync(pageFile, buf); } catch {} }
        linkTrack(buf.length);
        return res.json({ audio: base64Audio, format: "mp3" });
      }

      const audioBuffer = await elevenLabsTTS(trimmed, voiceId);
      const base64Audio = audioBuffer.toString("base64");

      fs.writeFileSync(diskFile, audioBuffer);
      if (pageFile) { try { fs.writeFileSync(pageFile, audioBuffer); } catch {} }
      ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
      cleanTtsCache();
      linkTrack(audioBuffer.length);

      res.json({ audio: base64Audio, format: "mp3" });
    } catch (err: any) {
      console.error("TTS error:", err.message, err.stack);
      const msg = err.message || "";
      if (msg.includes("quota_exceeded") || msg.includes("quota")) {
        return res.status(429).json({ error: "Voice credit quota exceeded. Please try again later or upgrade your ElevenLabs plan." });
      }
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  function chunkText(text: string, maxLen: number = 4000): string[] {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf(". ", maxLen);
      if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf(" ", maxLen);
      if (splitAt < maxLen * 0.3) splitAt = maxLen;
      chunks.push(remaining.slice(0, splitAt + 1).trim());
      remaining = remaining.slice(splitAt + 1).trim();
    }
    return chunks.filter(c => c.length > 0);
  }

  const FISH_TTS_MODEL = "s2.1-pro";
  const FISH_TTS_CACHE_VERSION = "fish-s2.1-pro-v1";
  // Coalesce identical concurrent synthesis requests so mobile retries do not
  // create duplicate Fish generations/charges. Regeneration has its own lane:
  // repeated taps while one regeneration is running share that fresh take.
  const fishTtsInflight = new Map<string, Promise<{ ok: boolean; status: number; error?: string; audio?: Buffer }>>();

  app.post("/api/fish-tts", async (req, res) => {
    try {
      const { text, voice, regenerate } = req.body;
      const shouldRegenerate = regenerate === true;
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }
      const apiKey = process.env.FISH_AUDIO_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "Fish Audio not configured" });

      const trimmed = text.slice(0, 4000);
      const fishVoiceId = `fish_${voice || "default"}`;
      // Include the synthesis engine version so audio generated by older Fish
      // models can never be mistaken for current audiobook audio.
      const cacheKey = ttsCacheKey(trimmed, `${voice || "fish-default"}:${FISH_TTS_CACHE_VERSION}`);
      const ctx = parseAudioContext(req.body);
      const diskFile = ttsDiskPath(fishVoiceId, cacheKey);
      const pageFile = ctx && ctx.pageIndex !== null
        ? path.join(voiceAudioDir(fishVoiceId), chapterPageAudioFilename(ctx.projectId, ctx.chapterId, ctx.pageIndex, cacheKey))
        : null;
      const linkTrack = (fileSize?: number | null) => {
        if (ctx) {
          linkChapterAudioTrack({
            projectId: ctx.projectId,
            chapterId: ctx.chapterId,
            pageIndex: ctx.pageIndex,
            scope: "page",
            voiceId: fishVoiceId,
            audioUrl: uploadsUrl(pageFile || diskFile),
            fileSize: fileSize ?? null,
            wordCount: trimmed.split(/\s+/).filter(Boolean).length,
          }).catch(() => {});
        }
      };

      const cached = ttsCache.get(cacheKey);
      if (!shouldRegenerate && cached && Date.now() - cached.ts < TTS_CACHE_TTL) {
        if (pageFile && !fs.existsSync(pageFile)) {
          try { fs.writeFileSync(pageFile, Buffer.from(cached.audio, "base64")); } catch {}
        }
        linkTrack(pageFile && fs.existsSync(pageFile) ? fs.statSync(pageFile).size : null);
        return res.json({ audio: cached.audio, format: "mp3" });
      }

      // Serve previously saved audio first: canonical page asset, then hash cache.
      if (!shouldRegenerate && pageFile && fs.existsSync(pageFile)) {
        const buf = fs.readFileSync(pageFile);
        const base64Audio = buf.toString("base64");
        ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
        linkTrack(buf.length);
        return res.json({ audio: base64Audio, format: "mp3" });
      }

      if (!shouldRegenerate && fs.existsSync(diskFile)) {
        const buf = fs.readFileSync(diskFile);
        const base64Audio = buf.toString("base64");
        ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
        if (pageFile) { try { fs.writeFileSync(pageFile, buf); } catch {} }
        linkTrack(buf.length);
        return res.json({ audio: base64Audio, format: "mp3" });
      }

      const inflightKey = `${cacheKey}:${shouldRegenerate ? "regenerate" : "normal"}`;
      let generation = fishTtsInflight.get(inflightKey);
      if (!generation) {
        generation = (async () => {
          const response = await fetch("https://api.fish.audio/v1/tts", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "model": FISH_TTS_MODEL,
            },
            body: JSON.stringify({
              text: trimmed,
              reference_id: voice,
              format: "mp3",
              latency: "normal",
              normalize: true,
              chunk_length: 200,
            }),
          });
          if (!response.ok) {
            const error = await response.text().catch(() => "Unknown error");
            return { ok: false, status: response.status, error };
          }
          return { ok: true, status: response.status, audio: Buffer.from(await response.arrayBuffer()) };
        })();
        fishTtsInflight.set(inflightKey, generation);
        generation.finally(() => {
          if (fishTtsInflight.get(inflightKey) === generation) fishTtsInflight.delete(inflightKey);
        }).catch(() => {});
      }

      const generated = await generation;
      if (!generated.ok || !generated.audio) {
        console.error("Fish Audio TTS error:", generated.status, generated.error || "Unknown error");
        return res.status(generated.status || 502).json({ error: `Fish Audio error: ${generated.error || "Unknown error"}` });
      }

      const audioBuffer = generated.audio;
      const base64Audio = audioBuffer.toString("base64");

      fs.writeFileSync(diskFile, audioBuffer);
      if (pageFile) { try { fs.writeFileSync(pageFile, audioBuffer); } catch {} }
      ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
      cleanTtsCache();
      linkTrack(audioBuffer.length);

      res.json({ audio: base64Audio, format: "mp3" });
    } catch (err: any) {
      console.error("Fish Audio TTS error:", err.message);
      res.status(500).json({ error: "Failed to generate Fish Audio speech" });
    }
  });

  app.post("/api/tts/download", async (req, res) => {
    try {
      const { projectId, chapterIds, voice } = req.body;
      if (!projectId) return res.status(400).json({ error: "projectId required" });
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const allChapters = await storage.getChapters(projectId);
      const chapters = chapterIds?.length
        ? allChapters.filter((c) => chapterIds.includes(c.id) && c.status === "complete" && c.content)
        : allChapters.filter((c) => c.status === "complete" && c.content);

      if (chapters.length === 0) return res.status(400).json({ error: "No completed chapters to narrate" });

      const voiceId = voice || "fabb918a343d4591b428083a35980dc4";
      const dir = voiceAudioDir(voiceId);
      const audioChunks: Buffer[] = [];

      for (const chapter of chapters.sort((a, b) => a.chapterNumber - b.chapterNumber)) {
        const filePath = path.join(dir, chapterAudioFilename(projectId, chapter.id));

        // Reuse the chapter's already-saved per-voice audio file when present so
        // we don't re-spend TTS credits regenerating it.
        if (fs.existsSync(filePath)) {
          const reused = fs.readFileSync(filePath);
          const audioUrl = uploadsUrl(filePath);
          if (!chapter.audioUrl) {
            await storage.updateChapter(chapter.id, { audioUrl });
          }
          linkChapterAudioTrack({
            projectId,
            chapterId: chapter.id,
            pageIndex: null,
            scope: "chapter",
            voiceId,
            audioUrl,
            fileSize: reused.length,
            wordCount: chapter.wordCount ?? 0,
          }).catch(() => {});
          audioChunks.push(reused);
          continue;
        }

        const cleanText = (chapter.content || "").replace(/[#*_`~>\[\]()]/g, "");
        if (!cleanText.trim()) continue;
        const textChunks = chunkText(cleanText);
        const chapterBufs: Buffer[] = [];
        for (const chunk of textChunks) {
          chapterBufs.push(await elevenLabsTTS(chunk, voiceId));
        }
        if (chapterBufs.length === 0) continue;

        // Persist the freshly generated chapter audio to the book profile.
        const chapterCombined = Buffer.concat(chapterBufs);
        fs.writeFileSync(filePath, chapterCombined);
        const audioUrl = uploadsUrl(filePath);
        await storage.updateChapter(chapter.id, { audioUrl });
        linkChapterAudioTrack({
          projectId,
          chapterId: chapter.id,
          pageIndex: null,
          scope: "chapter",
          voiceId,
          audioUrl,
          fileSize: chapterCombined.length,
          wordCount: chapter.wordCount ?? 0,
        }).catch(() => {});
        audioChunks.push(chapterCombined);
      }

      if (audioChunks.length === 0) return res.status(400).json({ error: "No audio generated" });

      const combined = Buffer.concat(audioChunks);
      const filename = `${slugify(project.title)}-audiobook.mp3`;
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", combined.length);
      res.send(combined);
    } catch (err: any) {
      console.error("TTS download error:", err.message, err.stack);
      const msg = err.message || "";
      if (msg.includes("quota_exceeded") || msg.includes("quota")) {
        return res.status(429).json({ error: "Voice credit quota exceeded. Please try again later or upgrade your ElevenLabs plan." });
      }
      res.status(500).json({ error: "Failed to generate audiobook" });
    }
  });

  app.get("/api/chat/conversations", async (_req, res) => {
    try {
      const conversations = await storage.getChatConversations();
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chat/conversations", async (req, res) => {
    try {
      const { title, projectId } = req.body;
      const conv = await storage.createChatConversation({
        title: title || "New Conversation",
        projectId: projectId || null,
      });
      res.json(conv);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/chat/conversations/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      await storage.deleteChatConversation(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/chat/conversations/:id/messages", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid ID" });
      const messages = await storage.getChatMessages(id);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/chat/conversations/:id/messages", async (req, res) => {
    try {
      const convId = parseId(req.params.id);
      if (!convId) return res.status(400).json({ error: "Invalid ID" });

      const conv = await storage.getChatConversation(convId);
      if (!conv) return res.status(404).json({ error: "Conversation not found" });

      const { content } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Content is required" });
      }

      const userMsg = await storage.createChatMessage({
        conversationId: convId,
        role: "user",
        content: content.trim(),
      });

      const history = await storage.getChatMessages(convId);
      const chatHistory = history.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      let aiContent: string;
      let scribeRuntime: { runtime: "local" | "cloud"; model: string } | null = null;

      if (conv.projectId) {
        const result = await scribeChat({
          projectId: conv.projectId,
          history: chatHistory,
        });
        aiContent = result.text;
        scribeRuntime = { runtime: result.runtime, model: result.model };
      } else {
        const intakeSystem = {
          role: "system" as const,
          content: `You are Lexora's Scribe intake assistant. This conversation is not linked to a Property yet, so treat ideas as exploration rather than canon. Help the user develop books across fiction and nonfiction, adapt craft to the intended reader, and encourage linking the conversation to a project once a concept becomes real. Be creative, structured, and concise when possible.`,
        };
        const localIntakePreferred =
          config.studio.runtimeMode === "off-grid" ||
          config.studio.runtimeMode === "hybrid";

        if (localIntakePreferred && await isOllamaAvailable()) {
          aiContent = await ollamaChat({
            model: config.ollama.model,
            messages: [intakeSystem, ...chatHistory],
          });
          scribeRuntime = { runtime: "local", model: config.ollama.model };
        } else if (config.studio.runtimeMode === "off-grid") {
          const offlineError = new Error("Lexora is in off-grid mode but the configured Ollama runtime is unavailable.") as Error & { status?: number };
          offlineError.status = 503;
          throw offlineError;
        } else if (!OPENAI_CONFIGURED && await isOllamaAvailable()) {
          aiContent = await ollamaChat({
            model: config.ollama.model,
            messages: [intakeSystem, ...chatHistory],
          });
          scribeRuntime = { runtime: "local", model: config.ollama.model };
        } else if (!OPENAI_CONFIGURED) {
          throw new Error("No available Scribe intake runtime. Configure OpenAI or start Ollama locally.");
        } else {
          const completion = await openai.chat.completions.create({
            model: HIGH_MODEL,
    reasoning_effort: "high",
            messages: [
              intakeSystem,
              ...chatHistory,
            ],
            max_completion_tokens: 8192,
          });
          aiContent = completion.choices[0].message.content || "I couldn't generate a response. Please try again.";
        }
      }

      const aiMsg = await storage.createChatMessage({
        conversationId: convId,
        role: "assistant",
        content: aiContent,
      });

      if (history.length <= 2) {
        const firstLine = content.trim().split("\n")[0].slice(0, 60);
        await storage.updateChatConversation(convId, { title: firstLine || "New Conversation" });
      }

      res.json({
        userMessage: userMsg,
        assistantMessage: aiMsg,
        director: conv.projectId ? "scribe" : "scribe-intake",
        runtime: scribeRuntime?.runtime ?? "cloud",
        model: scribeRuntime?.model ?? HIGH_MODEL,
      });
    } catch (err: any) {
      console.error("Chat error:", err.message);
      res.status(err?.status === 503 ? 503 : 500).json({ error: err.message });
    }
  });

  app.post("/api/admin/seed-from-dev", async (_req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      
      let seedPath = path.join(process.cwd(), "db-seed.json");
      if (!fs.existsSync(seedPath)) {
        seedPath = path.join(process.cwd(), "dist", "db-seed.json");
      }
      if (!fs.existsSync(seedPath)) {
        return res.status(404).json({ error: "No seed file found" });
      }

      const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
      const { db: database } = await import("./db");
      const schema = await import("@shared/schema");

      const orderedTables: [any, any[]][] = [
        [schema.projects, seedData.projects],
        [schema.chapters, seedData.chapters],
        [schema.bookDna, seedData.bookDna],
        [schema.trendReports, seedData.trendReports],
        [schema.marketingAssets, seedData.marketingAssets],
        [schema.runSteps, seedData.runSteps],
        [schema.appSettings, seedData.appSettings],
        [schema.inviteTokens, seedData.inviteTokens],
        [schema.bookRequests, seedData.bookRequests],
        [schema.chatConversations, seedData.chatConversations],
        [schema.chatMessages, seedData.chatMessages],
        [schema.autopilotConfig, seedData.autopilotConfig],
        [schema.autopilotRuns, seedData.autopilotRuns],
      ];

      let totalInserted = 0;
      for (const [table, rows] of orderedTables) {
        if (rows && rows.length > 0) {
          for (const row of rows) {
            try {
              await database.insert(table).values(row).onConflictDoNothing();
              totalInserted++;
            } catch {}
          }
        }
      }

      const seqTables = [
        "projects", "chapters", "book_dna", "trend_reports", "marketing_assets",
        "run_steps", "app_settings", "invite_tokens", "book_requests",
        "chat_conversations", "chat_messages", "autopilot_config", "autopilot_runs",
      ];
      const { sql: sqlTag } = await import("drizzle-orm");
      for (const table of seqTables) {
        try {
          await database.execute(sqlTag.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`));
        } catch {}
      }

      res.json({ success: true, totalInserted });
    } catch (err: any) {
      console.error("Seed error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
