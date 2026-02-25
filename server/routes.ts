import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openai, FAST_MODEL, HIGH_MODEL, IMAGE_MODEL } from "./openai";
import { textToSpeech } from "./replit_integrations/audio/client";
import { insertProjectSchema, insertAutopilotConfigSchema } from "@shared/schema";
import { executeAutopilotRun, isAutopilotRunning } from "./autopilot-engine";
import { z } from "zod";

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
  app.get("/api/dashboard", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const recentProjects = (await storage.getProjects()).slice(0, 5);
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
        return {
          ...project,
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

  app.get("/api/projects", async (_req, res) => {
    try {
      const list = await storage.getProjects();
      res.json(list);
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
            content: `You are a professional book architect specializing in the ${project.vertical} niche. Respond ONLY with valid JSON.`,
          }, {
            role: "user",
            content: `Create a complete book outline for "${project.title}" in the ${project.vertical} vertical for ${project.targetLanguage} speaking audience.

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
        const systemPrompt = dna
          ? `You are a professional author writing in the ${project.vertical} niche.
Book: "${project.title}"
Core Promise: ${dna.corePromise}
Reader Avatar: ${dna.readerAvatar}
Tone Rules: ${dna.toneRules}
Framework: ${dna.frameworkSummary}
Transformation Arc: ${dna.transformationArc}
Write in ${project.targetLanguage}.`
          : `You are a professional author writing a ${project.vertical} book titled "${project.title}". Write in ${project.targetLanguage}.`;

        const completion = await openai.chat.completions.create({
          model: HIGH_MODEL,
          messages: [{
            role: "system",
            content: systemPrompt,
          }, {
            role: "user",
            content: `Write Chapter ${chapter.chapterNumber}: "${chapter.title}"

Blueprint: ${chapter.blueprint}

Write a complete, compelling chapter of approximately 1500-2000 words. Include:
- Strong opening hook
- Core concepts with clear explanations
- Practical examples and case studies
- Actionable frameworks or exercises
- Chapter summary and key takeaways

Write the full chapter content only, no meta-commentary.`,
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
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid project ID" });
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Not found" });

      const verticalStyles: Record<string, string> = {
        money: "professional financial book cover, gold and dark blue, modern typography, wealth symbols",
        fitness: "energetic fitness book cover, bold red and white, dynamic typography, athletic imagery",
        spirituality: "serene spiritual book cover, purple and gold gradients, ethereal typography, mindfulness symbols",
        career: "professional career book cover, corporate blue, clean modern design",
        education: "academic book cover, forest green, knowledge symbols, clean design",
        relationships: "warm relationship book cover, soft coral and cream, heart motifs",
        health: "clean health book cover, teal and white, medical cross, modern sans-serif",
        mindset: "motivational book cover, orange and black, bold typography, abstract brain imagery",
        parenting: "warm parenting book cover, soft yellows and blues, family imagery",
        technology: "sleek tech book cover, dark with neon accents, circuit patterns",
      };

      const style = verticalStyles[project.vertical] || "professional book cover, modern design";

      const imageUrl = await runStep(id, "Cover Generation", IMAGE_MODEL, async () => {
        const completion = await openai.images.generate({
          model: IMAGE_MODEL,
          prompt: `Create a professional book cover for "${project.title}". Style: ${style}. The cover should have the title text prominently displayed, look like a bestselling non-fiction book, have thumbnail readability, and be visually striking. No real people. High quality book cover design.`,
          size: "1024x1024",
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

  const ttsVoices = ["alloy", "echo", "fable", "onyx", "nova"] as const;
  type TTSVoice = typeof ttsVoices[number];

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }
      if (text.length > 4000) {
        return res.status(400).json({ error: "Text too long (max 4000 characters)" });
      }
      const selectedVoice: TTSVoice = ttsVoices.includes(voice) ? voice : "alloy";
      const audioBuffer = await textToSpeech(text.slice(0, 4000), selectedVoice, "mp3");
      const base64Audio = audioBuffer.toString("base64");
      res.json({ audio: base64Audio, format: "mp3" });
    } catch (err: any) {
      console.error("TTS error:", err.message);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  return httpServer;
}
