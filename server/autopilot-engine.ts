import { storage } from "./storage";
import { openai, FAST_MODEL, HIGH_MODEL } from "./openai";

let isRunning = false;

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
    const cost = tokens * 0.00001;
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

export async function executeAutopilotRun(runId: number, vertical: string, language: string, minQuality: number, budgetCap: number): Promise<void> {
  if (isRunning) throw new Error("An autopilot run is already in progress");
  isRunning = true;

  try {
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
    const bookTitle = topicResult.title || `${vertical.charAt(0).toUpperCase() + vertical.slice(1)} Mastery Guide`;

    await storage.updateAutopilotRun(runId, { bookTitle, currentStep: "Creating project" });

    const project = await storage.createProject({
      title: bookTitle,
      authorName: topicResult.authorName || "Sergio A. Delgado",
      vertical,
      targetLanguage: language,
    });

    await storage.updateAutopilotRun(runId, { projectId: project.id, currentStep: "Trend analysis" });
    await storage.updateProject(project.id, { status: "trend_analysis" });

    const trendResult = await runPipelineStep(project.id, "Trend Analysis", FAST_MODEL, async () => {
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
      projectId: project.id,
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
    await storage.updateProject(project.id, { greenlightScore: trendResult.greenlightScore, status: "draft" });

    const currentProject = await storage.getProject(project.id);
    if (currentProject && currentProject.estimatedCost >= budgetCap) {
      await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Budget cap reached after trend analysis", completedAt: new Date(), totalTokens: currentProject.totalTokens, estimatedCost: currentProject.estimatedCost });
      return;
    }

    await storage.updateAutopilotRun(runId, { currentStep: "Generating outline" });
    await storage.updateProject(project.id, { status: "outlining" });

    const outlineResult = await runPipelineStep(project.id, "Book Outline + DNA", HIGH_MODEL, async () => {
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
      projectId: project.id,
      corePromise: outlineResult.corePromise,
      readerAvatar: outlineResult.readerAvatar,
      toneRules: outlineResult.toneRules,
      transformationArc: outlineResult.transformationArc,
      frameworkSummary: outlineResult.frameworkSummary,
    });

    const chapterPromises = (outlineResult.chapters || []).map((ch: any) =>
      storage.createChapter({
        projectId: project.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        blueprint: ch.blueprint,
        status: "pending",
      })
    );
    await Promise.all(chapterPromises);
    await storage.updateProject(project.id, { chapterCount: outlineResult.chapters?.length || 0, status: "writing" });

    const allChapters = await storage.getChapters(project.id);
    const dna = await storage.getBookDna(project.id);

    for (const chapter of allChapters) {
      const proj = await storage.getProject(project.id);
      if (proj && proj.estimatedCost >= budgetCap) {
        await storage.updateAutopilotRun(runId, { status: "stopped", currentStep: "Budget cap reached", completedAt: new Date(), totalTokens: proj.totalTokens, estimatedCost: proj.estimatedCost });
        return;
      }

      await storage.updateAutopilotRun(runId, { currentStep: `Writing Ch.${chapter.chapterNumber}: ${chapter.title}` });
      await storage.updateChapter(chapter.id, { status: "generating" });

      const systemPrompt = dna
        ? `You are a professional author writing in the ${vertical} niche.
Book: "${bookTitle}"
Core Promise: ${dna.corePromise}
Reader Avatar: ${dna.readerAvatar}
Tone Rules: ${dna.toneRules}
Framework: ${dna.frameworkSummary}
Write in ${language}.`
        : `You are a professional author writing a ${vertical} book titled "${bookTitle}". Write in ${language}.`;

      const chapterContent = await runPipelineStep(project.id, `Chapter ${chapter.chapterNumber}: ${chapter.title}`, HIGH_MODEL, async () => {
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
        const proj2 = await storage.getProject(project.id);
        await storage.updateAutopilotRun(runId, {
          status: "stopped",
          currentStep: `Quality below threshold (${qualityScore} < ${minQuality}) at Ch.${chapter.chapterNumber}`,
          completedAt: new Date(),
          totalTokens: proj2?.totalTokens || 0,
          estimatedCost: proj2?.estimatedCost || 0,
        });
        await storage.updateProject(project.id, { qualityScore, wordCount: (proj2?.wordCount || 0) + wordCount });
        return;
      }

      const updatedChapters = await storage.getChapters(project.id);
      const totalWords = updatedChapters.reduce((sum, c) => sum + c.wordCount, 0);
      const completedChapters = updatedChapters.filter(c => c.status === "complete");
      const avgQuality = completedChapters.length > 0
        ? completedChapters.reduce((sum, c) => sum + (c.qualityScore || 0), 0) / completedChapters.length
        : 0;
      await storage.updateProject(project.id, {
        wordCount: totalWords,
        qualityScore: avgQuality,
        status: updatedChapters.every(c => c.status === "complete") ? "editing" : "writing",
      });
    }

    await storage.updateAutopilotRun(runId, { currentStep: "Generating marketing" });
    await storage.updateProject(project.id, { status: "marketing" });

    const marketingResult = await runPipelineStep(project.id, "Marketing Suite", FAST_MODEL, async () => {
      const completion = await openai.chat.completions.create({
        model: FAST_MODEL,
        messages: [{
          role: "system",
          content: "You are a book marketing expert. Respond ONLY with valid JSON.",
        }, {
          role: "user",
          content: `Generate a complete marketing suite for the book "${bookTitle}" in the ${vertical} niche.

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
      projectId: project.id,
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

    await storage.updateProject(project.id, { status: "complete" });

    const finalProject = await storage.getProject(project.id);
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
