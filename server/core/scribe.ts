import crypto from "crypto";
import { getConfig } from "../config/env";
import { storage } from "../storage";
import { openai, HIGH_MODEL, OPENAI_CONFIGURED } from "../openai";
import { hashArtifactContent } from "./artifacts";
import { ensurePropertyForProject } from "./propertyService";
import { isOllamaAvailable, ollamaChat } from "./ollama";

export interface ScribeChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ScribeContext {
  projectId: number;
  propertyId: string;
  systemPrompt: string;
  contextManifest: {
    bookGenomeVersion?: string;
    ipBibleVersion?: string;
    outlineVersion?: string;
    chapterIds: number[];
    sourceArtifactIds: string[];
    notes: string[];
  };
}

function compact(value: unknown, max = 6000): string {
  if (value == null) return "None";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export async function buildScribeContext(projectId: number): Promise<ScribeContext> {
  const project = await storage.getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const property = await ensurePropertyForProject(projectId);
  const [
    dna,
    chapters,
    continuity,
  ] = await Promise.all([
    storage.getBookDna(projectId),
    storage.getChapters(projectId),
    storage.getContinuitySnapshot(projectId),
  ]);

  const series = project.seriesId ? await storage.getSeries(project.seriesId) : undefined;
  const style = project.styleFingerprintId
    ? await storage.getStyleFingerprint(project.styleFingerprintId)
    : undefined;

  const explicitlyApproved = chapters
    .filter((chapter) => chapter.approvalStatus === "approved")
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
  const accepted = explicitlyApproved.length > 0
    ? explicitlyApproved
    : chapters
        .filter((chapter) => chapter.status === "complete")
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

  const recent = accepted.slice(-3).map((chapter) => ({
    id: chapter.id,
    number: chapter.chapterNumber,
    title: chapter.title,
    text: (chapter.content || "").slice(-2500),
  }));

  const chapterMap = chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.chapterNumber,
    title: chapter.title,
    status: chapter.status,
    blueprint: chapter.blueprint,
    wordCount: chapter.wordCount,
  }));

  const classification = property.classification || {};
  const targetContract = property.targetContract || {};

  const systemPrompt = `You are SCRIBE, Lexora's Director of Book Creation.

You are not a generic chat assistant. You are working inside one specific creative property and must use its canonical context before proposing or writing anything.

PROJECT
Title: ${project.title}
Legacy vertical: ${project.vertical}
Language: ${project.targetLanguage}
Status: ${project.status}
Brief: ${project.description || "No legacy brief"}

PROPERTY / CLASSIFICATION
${compact(classification, 5000)}

CREATIVE TARGET CONTRACT
${compact(targetContract, 5000)}

BOOK GENOME / LEGACY BOOK DNA
${compact(dna, 5000)}

SERIES / IP BIBLE
${compact(series?.bible || series, 5000)}

STYLE FINGERPRINT
${compact(style?.profile || style, 3500)}

CURRENT CHAPTER MAP
${compact(chapterMap, 7000)}

CANONICAL CONTINUITY STATE
${compact(continuity?.state, 8000)}

RECENT ACCEPTED TEXT
${compact(recent, 8500)}

SCRIBE LAWS
- Adapt your craft to the actual format, audience, age, genre, topic, and reader promise.
- A children's book, cookbook, biography, thriller, memoir, fashion history, business guide, and literary novel require different craft.
- Treat accepted manuscript facts and continuity as canon unless the user explicitly chooses a branch or revision.
- Do not casually contradict character state, chronology, world rules, research facts, or prior accepted chapters.
- When making a significant creative decision, offer useful alternatives when alternatives would improve the decision.
- Preserve the author's intent and requested voice instead of homogenizing everything into generic AI prose.
- Distinguish brainstorming from canon. Suggestions are not canon until adopted.
- If a request would benefit from research that is not in the local context, identify the research need rather than inventing facts.
- For biographies/history/current factual subjects, separate established facts, sourced claims, disputed claims, and interpretation.
- Redactor is the independent editorial authority. Do not pretend your own draft has passed editorial review.
- Press owns final packaging. Do not let cover/marketing convenience distort the manuscript.
- Be decisive and useful. Ask a question only when the missing decision materially blocks good work.`;

  return {
    projectId,
    propertyId: property.id,
    systemPrompt,
    contextManifest: {
      bookGenomeVersion: dna ? String(dna.id) : undefined,
      ipBibleVersion: series ? String(series.id) : undefined,
      chapterIds: accepted.map((chapter) => chapter.id),
      sourceArtifactIds: [],
      notes: [
        continuity ? `continuity-snapshot-v${continuity.version}` : "no-continuity-snapshot-yet",
        explicitlyApproved.length === 0 && accepted.length > 0
          ? "legacy-fallback:completed-chapters-used-because-no-explicit-approvals-exist"
          : "canon-source:explicitly-approved-chapters",
        `runtime-mode:${getConfig().studio.runtimeMode}`,
      ],
    },
  };
}

async function saveScribeArtifact(opts: {
  context: ScribeContext;
  text: string;
  runtimeId: string;
  model: string;
}) {
  await storage.createCreativeArtifactWithAtomicVersion({
    id: crypto.randomUUID(),
    propertyId: opts.context.propertyId,
    projectId: opts.context.projectId,
    chapterId: null,
    type: "scribe-chat-response",
    parentArtifactId: null,
    createdBy: "scribe",
    runtimeId: opts.runtimeId,
    model: opts.model,
    promptVersion: "scribe-context-v1",
    context: opts.context.contextManifest,
    content: { text: opts.text },
    contentHash: hashArtifactContent(opts.text),
    estimatedCostUsd: null,
    state: "generated",
  });
}

export async function scribeChat(opts: {
  projectId: number;
  history: ScribeChatMessage[];
}): Promise<{ text: string; runtime: "local" | "cloud"; model: string }> {
  const config = getConfig();
  const context = await buildScribeContext(opts.projectId);
  const messages: ScribeChatMessage[] = [
    { role: "system", content: context.systemPrompt },
    ...opts.history.filter((message) => message.role !== "system"),
  ];

  const localPreferred =
    config.studio.runtimeMode === "off-grid" ||
    config.studio.runtimeMode === "hybrid";

  if (localPreferred && await isOllamaAvailable()) {
    const text = await ollamaChat({
      model: config.ollama.model,
      messages,
    });
    await saveScribeArtifact({
      context,
      text,
      runtimeId: `ollama:${config.ollama.model}`,
      model: config.ollama.model,
    });
    return { text, runtime: "local", model: config.ollama.model };
  }

  if (config.studio.runtimeMode === "off-grid") {
    throw new Error(
      "Lexora is in off-grid mode but the configured Ollama runtime is unavailable.",
    );
  }

  if (!OPENAI_CONFIGURED) {
    if (await isOllamaAvailable()) {
      const text = await ollamaChat({
        model: config.ollama.model,
        messages,
      });
      await saveScribeArtifact({
        context,
        text,
        runtimeId: `ollama:${config.ollama.model}`,
        model: config.ollama.model,
      });
      return { text, runtime: "local", model: config.ollama.model };
    }
    throw new Error("No available Scribe runtime. Configure OpenAI or start Ollama locally.");
  }

  const completion = await openai.chat.completions.create({
    model: HIGH_MODEL,
    messages,
    max_completion_tokens: 8192,
  });

  const text =
    completion.choices[0]?.message?.content?.trim() ||
    "I couldn't generate a response. Please try again.";

  await saveScribeArtifact({
    context,
    text,
    runtimeId: `openai:${HIGH_MODEL}`,
    model: HIGH_MODEL,
  });

  return { text, runtime: "cloud", model: HIGH_MODEL };
}
