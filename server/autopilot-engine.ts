import { storage } from "./storage";
import { openai, FAST_MODEL, HIGH_MODEL } from "./openai";
import { estimateCost } from "./cost";
import { buildConsistencyContext } from "./consistency";

let isRunning = false;
let shouldStop = false;

async function runPipelineStep(
  projectId: number,
  stepName: string,
  model: string,
  fn: () => Promise<{ result: any; tokens: number }>
) {
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
    const durationMs = Date.now() - start;

    await storage.updateRunStep(step.id, {
      status: "complete",
      tokensUsed: tokens,
      costEstimate: cost,
      durationMs,
    });

    const project = await storage.getProject(projectId);
    if (project) {
      await storage.updateProject(projectId, {
        totalTokens: project.totalTokens + tokens,
        estimatedCost: project.estimatedCost + cost,
      });
    }

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

async function evaluateChapterQuality(content: string, title: string, vertical: string): Promise<number> {
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
${content.slice(0, 2000)}

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

async function findIncompleteProject(vertical: string): Promise<{ id: number; title: string; status: string; vertical: string; targetLanguage: string; authorName: string } | null> {
  const allProjects = await storage.getProjects();
  const incomplete = allProjects.find(p =>
    p.vertical === vertical &&
    p.status !== "complete" &&
    p.status !== "paused"
  );
  return incomplete || null;
}

async function hasCompletedBookInVertical(vertical: string): Promise<boolean> {
  const allProjects = await storage.getProjects();
  return allProjects.some(p => p.vertical === vertical && p.status === "complete");
}

function getResumeStep(status: string, hasTrend: boolean, hasChapters: boolean, allChaptersComplete: boolean, hasMarketing: boolean): string {
  if (!hasTrend) return "trend_analysis";
  if (!hasChapters) return "outlining";
  if (!allChaptersComplete) return "writing";
  if (!hasMarketing) return "marketing";
  return "complete";
}

async function runTrendAnalysis(projectId: number, bookTitle: string, vertical: string) {
  await storage.updateProject(projectId, { status: "trend_analysis" });

  const trendResult = await runPipelineStep(projectId, "Trend Analysis", FAST_MODEL, async () => {
    const completion = await openai.chat.completions.create({
      model: FAST_MODEL,
      messages: [{
        role: "system",
        content: "You are a market research expert for the publishing industry. Respond ONLY with valid JSON.",
      }, {
        role: "user",
        content: `Analyze the ${vertical} vertical for a new book titled "${bookTitle}". Return JSON with: demandScore (1-10), competitionScore (1-10), greenlightScore (1-10), painPoints (array of 5 strings), titleAngles (array of 5 alternative title angles), nicheTopics (array of 5 micro-niche topics), keywords (array of 8 search keywords), summary (2-3 sentence market brief).`,
      }],
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0].message.content || "{}";
    return { result: JSON.parse(content), tokens: completion.usage?.total_tokens || 500 };
  });

  await storage.createTrendReport({
    projectId,
    vertical,
    demandScore: trendResult.demandScore,
    competitionScore: trendResult.competitionScore,
    greenlightScore: trendResult.greenlightScore,
    painPoints: trendResult.painPoints,
    titleAngles: trendResult.titleAngles,
    nicheTopics: trendResult.nicheTopics,
    keywords: trendResult.keywords,
    summary: trendResult.summary,
  });
  await storage.updateProject(projectId, { greenlightScore: trendResult.greenlightScore });
}

async function runOutline(projectId: number, bookTitle: string, vertical: string, language: string) {
  await storage.updateProject(projectId, { status: "outlining" });

  const outlineResult = await runPipelineStep(projectId, "Book Outline + DNA", HIGH_MODEL, async () => {
    const completion = await openai.chat.completions.create({
      model: HIGH_MODEL,
      messages: [{
        role: "system",
        content: `You are a professional book architect specializing in the ${vertical} niche. Respond ONLY with valid JSON.`,
      }, {
        role: "user",
        content: `Create a complete book outline for "${bookTitle}" in the ${vertical} vertical for ${language} speaking audience.

Return JSON with:
- corePromise: string (the book's core transformation promise)
- readerAvatar: string (ideal reader description)
- toneRules: string (writing tone and style rules)
- transformationArc: string (reader journey from problem to solution)
- frameworkSummary: string (the book's unique framework name and description)
- chapters: array of objects with {chapterNumber, title, blueprint (150 word description)}

Generate 8-12 chapters.`,
      }],
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0].message.content || "{}";
    return { result: JSON.parse(content), tokens: completion.usage?.total_tokens || 2000 };
  });

  await storage.upsertBookDna({
    projectId,
    corePromise: outlineResult.corePromise,
    readerAvatar: outlineResult.readerAvatar,
    toneRules: outlineResult.toneRules,
    transformationArc: outlineResult.transformationArc,
    frameworkSummary: outlineResult.frameworkSummary,
  });

  const newChapters = (outlineResult.chapters || []).map((ch: any) => ({
    projectId,
    chapterNumber: ch.chapterNumber,
    title: ch.title,
    blueprint: ch.blueprint,
    status: "pending" as const,
  }));
  await storage.replaceOutlineChapters(projectId, newChapters);
  await storage.updateProject(projectId, { chapterCount: outlineResult.chapters?.length || 0, status: "writing" });
}

async function runChapterWriting(projectId: number, bookTitle: string, vertical: string, language: string, runId: number, minQuality: number, budgetCap: number): Promise<boolean> {
  const allChapters = await storage.getChapters(projectId);
  const pendingChapters = allChapters.filter(c => c.status !== "complete");
  const dna = await storage.getBookDna(projectId);

  if (pendingChapters.length === 0) return true;

  await storage.updateProject(projectId, { status: "writing" });

  for (const chapter of pendingChapters) {
    const proj = await storage.getProject(projectId);
    if (proj && proj.estimatedCost >= budgetCap) {
      await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Budget cap reached", completedAt: new Date(), totalTokens: proj.totalTokens, estimatedCost: proj.estimatedCost });
      return false;
    }

    await storage.updateAutopilotRun(runId, { currentStep: `Writing Ch.${chapter.chapterNumber}: ${chapter.title}` });
    await storage.updateChapter(chapter.id, { status: "generating" });

    const priorChapters = await storage.getChapters(projectId);
    const consistencyContext = buildConsistencyContext(priorChapters, chapter.chapterNumber);

    const systemPrompt = dna
      ? `You are a professional author writing in the ${vertical} niche.
Book: "${bookTitle}"
Core Promise: ${dna.corePromise}
Reader Avatar: ${dna.readerAvatar}
Tone Rules: ${dna.toneRules}
Framework: ${dna.frameworkSummary}
Write in ${language}.`
      : `You are a professional author writing a ${vertical} book titled "${bookTitle}". Write in ${language}.`;

    const chapterContent = await runPipelineStep(projectId, `Chapter ${chapter.chapterNumber}: ${chapter.title}`, HIGH_MODEL, async () => {
      const completion = await openai.chat.completions.create({
        model: HIGH_MODEL,
        messages: [{
          role: "system",
          content: systemPrompt,
        }, {
          role: "user",
          content: `${consistencyContext ? `${consistencyContext}\n\n---\n\n` : ""}Write Chapter ${chapter.chapterNumber}: "${chapter.title}"

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
      return { result: completion.choices[0].message.content || "", tokens: completion.usage?.total_tokens || 3000 };
    });

    const wordCount = chapterContent.split(/\s+/).length;
    const qualityScore = await evaluateChapterQuality(chapterContent, chapter.title, vertical);

    await storage.updateChapter(chapter.id, {
      content: chapterContent,
      wordCount,
      qualityScore,
      status: "complete",
    });

    if (qualityScore < minQuality) {
      const proj2 = await storage.getProject(projectId);
      await storage.updateAutopilotRun(runId, {
        status: "stopped",
        currentStep: `Quality below threshold (${qualityScore} < ${minQuality}) at Ch.${chapter.chapterNumber}`,
        completedAt: new Date(),
        totalTokens: proj2?.totalTokens || 0,
        estimatedCost: proj2?.estimatedCost || 0,
      });
      await storage.updateProject(projectId, { qualityScore, wordCount: (proj2?.wordCount || 0) + wordCount });
      return false;
    }

    const updatedChapters = await storage.getChapters(projectId);
    const totalWords = updatedChapters.reduce((sum, c) => sum + c.wordCount, 0);
    const completedChapters = updatedChapters.filter(c => c.status === "complete");
    const avgQuality = completedChapters.length > 0
      ? completedChapters.reduce((sum, c) => sum + (c.qualityScore || 0), 0) / completedChapters.length
      : 0;
    await storage.updateProject(projectId, {
      wordCount: totalWords,
      qualityScore: avgQuality,
      status: updatedChapters.every(c => c.status === "complete") ? "editing" : "writing",
    });
  }

  return true;
}

async function runMarketing(projectId: number, bookTitle: string, vertical: string) {
  await storage.updateProject(projectId, { status: "marketing" });

  const project = await storage.getProject(projectId);
  const dna = await storage.getBookDna(projectId);
  const guidanceContext: string[] = [];
  if (project?.description) guidanceContext.push(`Book description & author guidance: ${project.description}`);
  if (dna?.readerAvatar) guidanceContext.push(`Target reader: ${dna.readerAvatar}`);
  if (dna?.corePromise) guidanceContext.push(`Core promise: ${dna.corePromise}`);
  if (dna?.toneRules) guidanceContext.push(`Tone & voice: ${dna.toneRules}`);
  if (dna?.transformationArc) guidanceContext.push(`Transformation arc: ${dna.transformationArc}`);
  if (dna?.frameworkSummary) guidanceContext.push(`Framework: ${dna.frameworkSummary}`);
  const guidanceBlock = guidanceContext.length > 0
    ? `\n\nUse this book's specific guidance so the marketing matches the author's intent, stated audience, and tone:\n${guidanceContext.join("\n")}\n\nThe blurbs, hooks, ad angles, and emails MUST speak directly to the stated target audience and adopt the stated tone — not generic category copy.`
    : "";

  const marketingResult = await runPipelineStep(projectId, "Marketing Suite", FAST_MODEL, async () => {
    const completion = await openai.chat.completions.create({
      model: FAST_MODEL,
      messages: [{
        role: "system",
        content: "You are a book marketing expert. Respond ONLY with valid JSON.",
      }, {
        role: "user",
        content: `Generate a complete marketing suite for the book "${bookTitle}" in the ${vertical} niche.${guidanceBlock}

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
    return { result: JSON.parse(content), tokens: completion.usage?.total_tokens || 3000 };
  });

  await storage.upsertMarketingAsset({
    projectId,
    shortBlurb: marketingResult.shortBlurb,
    mediumBlurb: marketingResult.mediumBlurb,
    longBlurb: marketingResult.longBlurb,
    amazonDescription: marketingResult.amazonDescription,
    hooks: marketingResult.hooks,
    adAngles: marketingResult.adAngles,
    emailSequence: marketingResult.emailSequence,
    socialCalendar: marketingResult.socialCalendar,
    pricingMatrix: marketingResult.pricingMatrix,
    authorBio: marketingResult.authorBio,
  });

  await storage.updateProject(projectId, { status: "complete" });
}

export async function executeAutopilotRun(runId: number, vertical: string, language: string, minQuality: number, budgetCap: number): Promise<void> {
  if (isRunning) throw new Error("An autopilot run is already in progress");
  isRunning = true;
  shouldStop = false;

  try {
    const existingProject = await findIncompleteProject(vertical);

    let projectId: number;
    let bookTitle: string;

    if (existingProject) {
      projectId = existingProject.id;
      bookTitle = existingProject.title;
      language = existingProject.targetLanguage || language;
      await storage.updateAutopilotRun(runId, {
        status: "running",
        projectId,
        bookTitle,
        currentStep: `Resuming: "${bookTitle}"`,
      });
    } else {
      const alreadyCompleted = await hasCompletedBookInVertical(vertical);
      if (alreadyCompleted) {
        await storage.updateAutopilotRun(runId, {
          status: "complete",
          currentStep: "Skipped — a completed book already exists in this vertical",
          completedAt: new Date(),
        });
        return;
      }

      await storage.updateAutopilotRun(runId, { status: "running", currentStep: "Generating topic" });

      const topicCompletion = await openai.chat.completions.create({
        model: FAST_MODEL,
        messages: [{
          role: "system",
          content: "You are a bestselling book title generator. Respond ONLY with valid JSON.",
        }, {
          role: "user",
          content: `Generate a compelling, market-ready book title and subtitle for the "${vertical}" niche targeting ${language}-speaking readers. The book should address a specific pain point with a clear transformation promise.

Return JSON with: { "title": "<full book title including subtitle>", "authorName": "Sergio A. Delgado" }`,
        }],
        max_completion_tokens: 256,
        response_format: { type: "json_object" },
      });
      const topicResult = JSON.parse(topicCompletion.choices[0].message.content || "{}");
      bookTitle = topicResult.title || `${vertical.charAt(0).toUpperCase() + vertical.slice(1)} Mastery Guide`;

      await storage.updateAutopilotRun(runId, { bookTitle, currentStep: "Creating project" });

      const project = await storage.createProject({
        title: bookTitle,
        authorName: topicResult.authorName || "Sergio A. Delgado",
        vertical,
        targetLanguage: language,
      });

      projectId = project.id;
      await storage.updateAutopilotRun(runId, { projectId });
    }

    const trendReport = await storage.getTrendReportByProject(projectId);
    const chapters = await storage.getChapters(projectId);
    const allChaptersComplete = chapters.length > 0 && chapters.every(c => c.status === "complete");
    const marketing = await storage.getMarketingAsset(projectId);

    const resumeStep = getResumeStep(
      existingProject?.status || "draft",
      !!trendReport,
      chapters.length > 0,
      allChaptersComplete,
      !!marketing,
    );

    if (resumeStep === "complete") {
      await storage.updateProject(projectId, { status: "complete" });
      const finalProject = await storage.getProject(projectId);
      await storage.updateAutopilotRun(runId, {
        status: "complete",
        currentStep: "Already complete",
        completedAt: new Date(),
        totalTokens: finalProject?.totalTokens || 0,
        estimatedCost: finalProject?.estimatedCost || 0,
      });
      return;
    }

    if (shouldStop) {
      await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Stopped by user", completedAt: new Date() });
      return;
    }

    if (resumeStep === "trend_analysis" || !trendReport) {
      await storage.updateAutopilotRun(runId, { currentStep: "Trend analysis" });
      await runTrendAnalysis(projectId, bookTitle, vertical);

      const currentProject = await storage.getProject(projectId);
      if (currentProject && currentProject.estimatedCost >= budgetCap) {
        await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Budget cap reached after trend analysis", completedAt: new Date(), totalTokens: currentProject.totalTokens, estimatedCost: currentProject.estimatedCost });
        return;
      }
    }

    if (shouldStop) {
      const p = await storage.getProject(projectId);
      await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Stopped by user", completedAt: new Date(), totalTokens: p?.totalTokens || 0, estimatedCost: p?.estimatedCost || 0 });
      return;
    }

    if (resumeStep === "trend_analysis" || resumeStep === "outlining" || chapters.length === 0) {
      await storage.updateAutopilotRun(runId, { currentStep: "Generating outline" });
      await runOutline(projectId, bookTitle, vertical, language);
    }

    if (shouldStop) {
      const p = await storage.getProject(projectId);
      await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Stopped by user", completedAt: new Date(), totalTokens: p?.totalTokens || 0, estimatedCost: p?.estimatedCost || 0 });
      return;
    }

    if (!allChaptersComplete) {
      const continued = await runChapterWriting(projectId, bookTitle, vertical, language, runId, minQuality, budgetCap);
      if (!continued) return;
    }

    if (shouldStop) {
      const p = await storage.getProject(projectId);
      await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Stopped by user", completedAt: new Date(), totalTokens: p?.totalTokens || 0, estimatedCost: p?.estimatedCost || 0 });
      return;
    }

    if (!marketing) {
      await storage.updateAutopilotRun(runId, { currentStep: "Generating marketing" });
      await runMarketing(projectId, bookTitle, vertical);
    }

    const finalProject = await storage.getProject(projectId);
    await storage.updateAutopilotRun(runId, {
      status: "complete",
      currentStep: "Done",
      completedAt: new Date(),
      totalTokens: finalProject?.totalTokens || 0,
      estimatedCost: finalProject?.estimatedCost || 0,
    });
  } catch (err: any) {
    await storage.updateAutopilotRun(runId, {
      status: "failed",
      errorMessage: err.message,
      completedAt: new Date(),
    });
    throw err;
  } finally {
    isRunning = false;
  }
}

export function isAutopilotRunning() {
  return isRunning;
}

export function requestAutopilotStop() {
  if (isRunning) {
    shouldStop = true;
    return true;
  }
  return false;
}

export function checkStopRequested(): boolean {
  return shouldStop;
}
