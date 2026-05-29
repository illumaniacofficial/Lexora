import { openai, FAST_MODEL } from "./openai";
import type { StyleFingerprint } from "@shared/schema";

export interface StyleProfile {
  voice: string;
  tone: string;
  sentenceRhythm: string;
  vocabulary: string;
  techniques: string;
  avoid: string;
  summary: string;
}

const clip = (v: any, n: number): string => String(v ?? "").slice(0, n);

export async function deriveStyleProfile(
  sampleText: string,
): Promise<{ profile: StyleProfile; tokens: number }> {
  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a literary style analyst. You distill a writing sample into a reusable style fingerprint that another author could follow to imitate the voice. Respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content: `Analyze the writing style of the following sample and produce a reusable style fingerprint.

SAMPLE (first 6000 chars):
${sampleText.slice(0, 6000)}

Return JSON exactly:
{
  "voice": "<the narrative voice and persona>",
  "tone": "<emotional tone and register>",
  "sentenceRhythm": "<sentence length, cadence, variation, paragraphing habits>",
  "vocabulary": "<diction, complexity, signature words/phrases>",
  "techniques": "<notable literary devices, structure, POV habits>",
  "avoid": "<things this author never or rarely does>",
  "summary": "<2-3 sentence overall description of the style>"
}`,
      },
    ],
    max_completion_tokens: 1024,
    response_format: { type: "json_object" },
  });

  const tokens = completion.usage?.total_tokens || 700;
  const p = JSON.parse(completion.choices[0].message.content || "{}");

  return {
    profile: {
      voice: clip(p.voice, 800),
      tone: clip(p.tone, 600),
      sentenceRhythm: clip(p.sentenceRhythm, 600),
      vocabulary: clip(p.vocabulary, 600),
      techniques: clip(p.techniques, 600),
      avoid: clip(p.avoid, 600),
      summary: clip(p.summary, 600),
    },
    tokens,
  };
}

export function buildStyleContext(fp: StyleFingerprint | undefined | null): string {
  if (!fp || !fp.profile) return "";
  const p = fp.profile as Partial<StyleProfile>;
  const lines = [
    p.voice && `Voice: ${p.voice}`,
    p.tone && `Tone: ${p.tone}`,
    p.sentenceRhythm && `Sentence rhythm: ${p.sentenceRhythm}`,
    p.vocabulary && `Vocabulary & diction: ${p.vocabulary}`,
    p.techniques && `Techniques: ${p.techniques}`,
    p.avoid && `Avoid: ${p.avoid}`,
  ].filter(Boolean);
  if (lines.length === 0) return "";
  return `AUTHOR STYLE FINGERPRINT — "${fp.name}"
Write in this author's voice. Match the following style closely without copying any specific content:
${lines.join("\n")}`;
}
