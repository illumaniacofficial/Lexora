import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openai, FAST_MODEL, HIGH_MODEL, IMAGE_MODEL } from "./openai";
import { insertProjectSchema, insertAutopilotConfigSchema, insertInviteTokenSchema } from "@shared/schema";
import crypto from "crypto";
import { executeAutopilotRun, isAutopilotRunning, requestAutopilotStop } from "./autopilot-engine";
import { z } from "zod";
import fs from "fs";
import path from "path";

const FICTION_GENRES = new Set([
  "sci-fi", "fantasy", "horror", "romance", "thriller", "mystery",
  "literary-fiction", "dystopian", "erotica", "comedy", "adventure",
  "young-adult", "children", "drama", "western", "novel",
]);

function isFiction(vertical: string): boolean {
  return FICTION_GENRES.has(vertical);
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

function estimateCost(tokens: number, model: string): number {
  const rates: Record<string, number> = {
    "gpt-5-mini": 0.0000003,
    "gpt-5.1": 0.000003,
    "gpt-image-1": 0.04,
  };
  return tokens * (rates[model] || 0.000003);
}

async function runStep(projectId: number, stepName: string, model: string, fn: () => Promise<{ result: any; tokens: number }>) {
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
    const { result, tokens } = await fn();
    const cost = estimateCost(tokens, model);
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
    const completion = await openai.chat.completions.create({
      model: FAST_MODEL,
      messages: [{
        role: "system",
        content: "You are a professional book editor and quality evaluator. Respond ONLY with valid JSON.",
      }, {
        role: "user",
        content: `Rate this chapter on a scale of 1-10 based on: clarity, engagement, actionable value, structure, and writing quality. The chapter is from a ${vertical} book, titled "${title}".

Chapter content (first 2000 chars):
${chapterContent.slice(0, 2000)}

Return JSON with: { "score": <number 1-10>, "reason": "<brief one-sentence justification>" }`,
      }],
      max_completion_tokens: 256,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    const score = parseFloat(parsed.score);
    if (isNaN(score) || score < 1 || score > 10) return 7.0;
    return Math.round(score * 10) / 10;
  } catch {
    return 7.0;
  }
}

const trendAnalyzeSchema = z.object({
  vertical: z.string().min(1, "Vertical is required"),
  keywords: z.string().optional().default(""),
});

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
}).strict();

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) || id < 1 ? null : id;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use("/uploads", express.static(path.resolve("uploads")));

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
      const completed = allProjects.filter(p => p.status === "complete");
      const library = await Promise.all(completed.map(async (project) => {
        const marketing = await storage.getMarketingAsset(project.id);
        const chapterList = await storage.getChapters(project.id);
        const { coverImageUrl, ...rest } = project;
        return {
          ...rest,
          hasCover: !!coverImageUrl,
          shortBlurb: marketing?.shortBlurb || null,
          chapterCount: chapterList.length,
          completedChapters: chapterList.filter(c => c.status === "complete").length,
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
      const completed = allProjects.filter(p => p.status === "complete");
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
        };
      }));
      res.json({ books, inviteLabel: invite.label });
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
      if (!project || project.status !== "complete") {
        return res.status(404).json({ error: "Book not found" });
      }
      const chapterList = await storage.getChapters(bookId);
      const marketing = await storage.getMarketingAsset(bookId);
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
        chapters: chapterList.filter(c => c.status === "complete").map(c => ({
          id: c.id,
          chapterNumber: c.chapterNumber,
          title: c.title,
          content: c.content,
          wordCount: c.wordCount,
          status: c.status,
        })),
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
        };
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.status(201).json(project);
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
      res.json({ project, chapters, runSteps, bookDna, marketing, trendReport });
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
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:id/export", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const format = (req.query.format as string) || "txt";
      if (format !== "txt" && format !== "html") {
        return res.status(400).json({ error: "Invalid format. Must be 'txt' or 'html'" });
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

  app.post("/api/projects/:id/trend-analysis", async (req, res) => {
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

  app.post("/api/projects/:id/generate-outline", async (req, res) => {
    let prevStatus = "draft";
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      prevStatus = project.status;

      await storage.updateProject(id, { status: "outlining" });
      await storage.deleteChaptersByProject(id);

      const result = await runStep(id, "Book Outline + DNA", HIGH_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: HIGH_MODEL,
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
        const content = completion.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);
        const tokens = completion.usage?.total_tokens || 2000;
        return { result: parsed, tokens };
      });

      await storage.upsertBookDna({
        projectId: id,
        corePromise: result.corePromise,
        readerAvatar: result.readerAvatar,
        toneRules: result.toneRules,
        transformationArc: result.transformationArc,
        frameworkSummary: result.frameworkSummary,
      });

      const chapterPromises = (result.chapters || []).map((ch: any) =>
        storage.createChapter({
          projectId: id,
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          blueprint: ch.blueprint,
          status: "pending",
        })
      );
      await Promise.all(chapterPromises);

      await storage.updateProject(id, {
        chapterCount: result.chapters?.length || 0,
        status: "writing",
      });

      res.json({ dna: result, chapters: result.chapters });
    } catch (err: any) {
      await storage.updateProject(parseId(req.params.id)!, { status: prevStatus }).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/chapters/:chapterId/generate", async (req, res) => {
    let activeChapterId: number | null = null;
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });

      const project = await storage.getProject(projectId);
      const chapter = await storage.getChapter(chapterId);
      const dna = await storage.getBookDna(projectId);

      if (!project || !chapter) return res.status(404).json({ error: "Not found" });

      activeChapterId = chapterId;
      await storage.updateChapter(chapterId, { status: "generating" });

      const result = await runStep(projectId, `Chapter ${chapter.chapterNumber}: ${chapter.title}`, HIGH_MODEL, async () => {
        const fiction = isFiction(project.vertical);
        const systemPrompt = dna
          ? `You are a professional ${fiction ? "fiction author" : "author"} writing ${fiction ? `a ${project.vertical} novel` : `in the ${project.vertical} niche`}.
Book: "${project.title}"
Core Promise: ${dna.corePromise}
Reader Avatar: ${dna.readerAvatar}
Tone Rules: ${dna.toneRules}
Framework: ${dna.frameworkSummary}
Transformation Arc: ${dna.transformationArc}
Write in ${project.targetLanguage}.`
          : `You are a professional ${fiction ? "fiction author" : "author"} writing a ${project.vertical} ${fiction ? "novel" : "book"} titled "${project.title}". Write in ${project.targetLanguage}.`;

        const chapterInstructions = fiction
          ? `Write Chapter ${chapter.chapterNumber}: "${chapter.title}"

Blueprint: ${chapter.blueprint}

Write a complete, immersive chapter of approximately 2000-3000 words. Include:
- Vivid scene-setting and sensory details
- Natural dialogue that reveals character
- Rising tension and conflict
- Character development and emotional depth
- A compelling hook ending that pulls readers to the next chapter

Write the full chapter content only, no meta-commentary. Show, don't tell.`
          : `Write Chapter ${chapter.chapterNumber}: "${chapter.title}"

Blueprint: ${chapter.blueprint}

Write a complete, compelling chapter of approximately 1500-2000 words. Include:
- Strong opening hook
- Core concepts with clear explanations
- Practical examples and case studies
- Actionable frameworks or exercises
- Chapter summary and key takeaways

Write the full chapter content only, no meta-commentary.`;

        const completion = await openai.chat.completions.create({
          model: HIGH_MODEL,
          messages: [{
            role: "system",
            content: systemPrompt,
          }, {
            role: "user",
            content: chapterInstructions,
          }],
          max_completion_tokens: 8192,
        });
        const content = completion.choices[0].message.content || "";
        const tokens = completion.usage?.total_tokens || 3000;
        return { result: content, tokens };
      });

      const wordCount = result.split(/\s+/).length;
      const qualityScore = await evaluateChapterQuality(result, chapter.title, project.vertical);

      await storage.updateChapter(chapterId, {
        content: result,
        wordCount,
        qualityScore,
        status: "complete",
      });

      const allChapters = await storage.getChapters(projectId);
      const totalWords = allChapters.reduce((sum, c) => sum + c.wordCount, 0);
      const completedChapters = allChapters.filter(c => c.status === "complete");
      const avgQuality = completedChapters.length > 0
        ? completedChapters.reduce((sum, c) => sum + (c.qualityScore || 0), 0) / completedChapters.length
        : 0;

      await storage.updateProject(projectId, {
        wordCount: totalWords,
        qualityScore: avgQuality,
        status: allChapters.every(c => c.status === "complete") ? "editing" : "writing",
      });

      res.json({ chapterId, wordCount, qualityScore, status: "complete" });
    } catch (err: any) {
      if (activeChapterId) {
        await storage.updateChapter(activeChapterId, { status: "pending" }).catch(() => {});
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/chapters/:chapterId/cancel", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      if (chapter.status !== "generating") return res.status(400).json({ error: "Chapter is not generating" });
      await storage.updateChapter(chapterId, { status: "pending" });
      res.json({ success: true, chapterId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/chapters/:chapterId/edit", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      const { content } = req.body;
      if (typeof content !== "string") return res.status(400).json({ error: "Content is required" });
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const updated = await storage.updateChapter(chapterId, {
        content,
        wordCount,
        lastEditedAt: new Date(),
      });
      const allChapters = await storage.getChapters(projectId);
      const totalWords = allChapters.reduce((s, c) => s + (c.id === chapterId ? wordCount : c.wordCount), 0);
      await storage.updateProject(projectId, { wordCount: totalWords });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/mark-complete", async (req, res) => {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/projects/:id/revert-to-editing", async (req, res) => {
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

  app.post("/api/projects/:id/chapters/:chapterId/generate-audio", async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const chapterId = parseId(req.params.chapterId);
      if (!projectId || !chapterId) return res.status(400).json({ error: "Invalid ID" });
      const chapter = await storage.getChapter(chapterId);
      if (!chapter || chapter.projectId !== projectId) return res.status(404).json({ error: "Chapter not found" });
      if (chapter.status !== "complete" || !chapter.content) return res.status(400).json({ error: "Chapter must be complete with content" });

      const { voice } = req.body || {};
      const voiceId = voice || "qJemC2CfKzP2DljOYBYj";
      const dir = voiceAudioDir(voiceId);
      const filename = chapterAudioFilename(projectId, chapterId);
      const filePath = path.join(dir, filename);

      const safeVoice = voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const audioUrl = `/uploads/audio/${safeVoice}/${filename}`;
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

      const voiceId = (req.query.voice as string) || "qJemC2CfKzP2DljOYBYj";
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
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects/:id/generate-marketing", async (req, res) => {
    let prevStatus = "draft";
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });
      prevStatus = project.status;

      await storage.updateProject(id, { status: "marketing" });

      const result = await runStep(id, "Marketing Suite", FAST_MODEL, async () => {
        const completion = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [{
            role: "system",
            content: "You are a book marketing expert. Respond ONLY with valid JSON.",
          }, {
            role: "user",
            content: `Generate a complete marketing suite for the book "${project.title}" in the ${project.vertical} niche.

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

  app.post("/api/projects/:id/generate-cover", async (req, res) => {
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

      const contentContext: string[] = [];
      if (project.description) contentContext.push(`Book description: ${project.description}`);
      if (dna?.corePromise) contentContext.push(`Core promise: ${dna.corePromise}`);
      if (dna?.transformationArc) contentContext.push(`Transformation arc: ${dna.transformationArc}`);
      if (dna?.frameworkSummary) contentContext.push(`Framework: ${dna.frameworkSummary}`);
      if (trend?.summary) contentContext.push(`Market context: ${trend.summary.slice(0, 200)}`);
      if (trend?.nicheTopics?.length) contentContext.push(`Niche: ${trend.nicheTopics.slice(0, 2).join("; ")}`);
      if (chapterList.length > 0) {
        const titles = chapterList.slice(0, 6).map(c => c.title).join(", ");
        contentContext.push(`Key chapters: ${titles}`);
      }

      const bookContext = contentContext.length > 0
        ? `\n\nThis book is specifically about: ${contentContext.join(". ")}. The cover imagery, symbols, and color palette MUST reflect this specific subject matter — not generic category art.`
        : "";

      const verticalHints: Record<string, string> = {
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

      const colorHint = verticalHints[project.vertical] || "modern design, premium feel";

      const userPrompt = coverPrompt || project.coverPrompt || "";
      const userAvoid = avoidStyles || project.coverAvoidStyles || "";
      const customSection = userPrompt ? ` Additional creative direction: ${userPrompt}.` : "";
      const avoidSection = userAvoid ? ` IMPORTANT — Do NOT use these styles: ${userAvoid}.` : "";

      const imageUrl = await runStep(id, "Cover Generation", IMAGE_MODEL, async () => {
        const completion = await openai.images.generate({
          model: IMAGE_MODEL,
          prompt: `Create a hyper-realistic, print-ready book cover for "${project.title}" by ${project.authorName || "Unknown Author"}. Color/typography hints: ${colorHint}. Requirements: photorealistic 3D book cover mockup with realistic lighting, shadows, and depth. The title text "${project.title}" must be prominently displayed in elegant, high-contrast typography. The author name "${project.authorName || "Unknown Author"}" must appear clearly at the bottom. The design should look like a bestselling ${isFiction(project.vertical) ? "fiction" : "non-fiction"} book you'd find on Amazon — polished, professional, with strong thumbnail readability. Use cinematic lighting, subtle textures, and premium finishes. No real human faces. Portrait orientation (tall book format).${bookContext}${customSection}${avoidSection} CRITICAL: The cover art, imagery, and visual metaphors must be UNIQUE to this specific book's subject matter. Do NOT use generic category imagery — create visuals that could ONLY belong to this particular book.`,
          size: "1024x1536",
          n: 1,
        });

        const imageB64 = (completion.data[0] as any)?.b64_json;
        let url = (completion.data[0] as any)?.url;

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

  app.get("/api/trends", async (req, res) => {
    try {
      const { vertical } = req.query;
      const reports = await storage.getTrendReports(vertical as string | undefined);
      res.json(reports);
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

      const run = await storage.createAutopilotRun({
        vertical: config.vertical,
        status: "pending",
      });

      executeAutopilotRun(
        run.id,
        config.vertical,
        language,
        config.minQualityScore,
        config.budgetCapUsd
      ).catch((err) => {
        console.error("Autopilot run failed:", err.message);
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
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
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
      const voiceId = voice || "qJemC2CfKzP2DljOYBYj";
      const cacheKey = ttsCacheKey(trimmed, voiceId);

      const cached = ttsCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < TTS_CACHE_TTL) {
        return res.json({ audio: cached.audio, format: "mp3" });
      }

      const diskFile = ttsDiskPath(voiceId, cacheKey);
      if (fs.existsSync(diskFile)) {
        const base64Audio = fs.readFileSync(diskFile).toString("base64");
        ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
        return res.json({ audio: base64Audio, format: "mp3" });
      }

      const audioBuffer = await elevenLabsTTS(trimmed, voiceId);
      const base64Audio = audioBuffer.toString("base64");

      fs.writeFileSync(diskFile, audioBuffer);
      ttsCache.set(cacheKey, { audio: base64Audio, ts: Date.now() });
      cleanTtsCache();

      res.json({ audio: base64Audio, format: "mp3" });
    } catch (err: any) {
      console.error("TTS error:", err.message, err.stack);
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

      const voiceId = voice || "qJemC2CfKzP2DljOYBYj";
      const audioChunks: Buffer[] = [];

      for (const chapter of chapters.sort((a, b) => a.chapterNumber - b.chapterNumber)) {
        const cleanText = (chapter.content || "").replace(/[#*_`~>\[\]()]/g, "");
        if (!cleanText.trim()) continue;
        const textChunks = chunkText(cleanText);
        for (const chunk of textChunks) {
          const buf = await elevenLabsTTS(chunk, voiceId);
          audioChunks.push(buf);
        }
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

      const completion = await openai.chat.completions.create({
        model: HIGH_MODEL,
        messages: [
          {
            role: "system",
            content: `You are Lexora, an expert AI book architect and writing partner. You help users plan, structure, and write books across all genres — fiction (sci-fi, fantasy, horror, romance, thriller, mystery, erotica, literary fiction, etc.) and non-fiction (self-help, business, education, etc.).

Your capabilities:
1. Help brainstorm book concepts, titles, and premises
2. Create detailed outlines with chapter breakdowns
3. Develop character profiles, world-building, and plot arcs for fiction
4. Write individual chapters or scenes on request
5. Provide feedback and suggestions on writing style, pacing, and structure
6. Generate book DNA (core promise, reader avatar, tone rules, transformation arc)
7. Help with marketing copy, blurbs, and descriptions

When the user provides a book structure or prompt, follow their guidance precisely. Be creative, detailed, and professional. Format your responses with clear markdown headings and structure when generating outlines or long-form content.

If the user wants to generate an entire book step by step, guide them through: concept → outline → chapter-by-chapter writing. Ask clarifying questions when needed.`,
          },
          ...chatHistory,
        ],
        max_completion_tokens: 8192,
      });

      const aiContent = completion.choices[0].message.content || "I couldn't generate a response. Please try again.";

      const aiMsg = await storage.createChatMessage({
        conversationId: convId,
        role: "assistant",
        content: aiContent,
      });

      if (history.length <= 2) {
        const firstLine = content.trim().split("\n")[0].slice(0, 60);
        await storage.updateChatConversation(convId, { title: firstLine || "New Conversation" });
      }

      res.json({ userMessage: userMsg, assistantMessage: aiMsg });
    } catch (err: any) {
      console.error("Chat error:", err.message);
      res.status(500).json({ error: err.message });
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
