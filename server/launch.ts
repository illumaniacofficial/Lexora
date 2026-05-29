import { openai, FAST_MODEL } from "./openai";
import type { Project, BookDna, MarketingAsset } from "@shared/schema";

export interface LaunchItem {
  id: string;
  type: "email" | "social";
  channel: string;
  offsetDays: number;
  scheduledAt: string;
  subject: string | null;
  content: string;
  status: "scheduled" | "sent";
}

function bookDnaContext(dna: BookDna | undefined): string {
  if (!dna) return "";
  const parts: string[] = [];
  if (dna.corePromise) parts.push(`Core promise: ${dna.corePromise}`);
  if (dna.readerAvatar) parts.push(`Reader: ${dna.readerAvatar}`);
  if (dna.transformationArc) parts.push(`Transformation: ${dna.transformationArc}`);
  return parts.length ? `\nBook details:\n${parts.join("\n")}` : "";
}

function clampOffset(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(-30, Math.min(30, v));
}

/**
 * Generates a launch plan (email drip + social posts) for a book, with each item
 * timed relative to the launch date. Deterministic timing is computed here; the
 * model only supplies copy + offsets. Returns items with resolved scheduledAt.
 */
export async function generateLaunchPlan(opts: {
  project: Project;
  dna: BookDna | undefined;
  marketing: MarketingAsset | undefined;
  launchDate: Date;
  channels: string[];
}): Promise<{ items: LaunchItem[]; tokens: number }> {
  const { project, dna, marketing, launchDate, channels } = opts;
  const socialChannels = channels.length ? channels : ["Twitter/X", "Instagram", "LinkedIn"];
  const blurb = marketing?.shortBlurb || marketing?.mediumBlurb || "";

  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a book-launch marketing strategist. You design a coordinated launch campaign of email-drip messages and social posts timed around a launch date. Respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content: `Plan a book launch campaign for "${project.title}" by ${project.authorName || "the author"} in the "${project.vertical}" niche.${bookDnaContext(dna)}${blurb ? `\nBlurb: ${blurb}` : ""}

Social channels available: ${socialChannels.join(", ")}.

Produce a coordinated campaign. Return JSON with:
- emails: array of 4-5 objects { "offsetDays": <integer, negative=before launch, 0=launch day, positive=after>, "subject": "<email subject>", "content": "<2-4 sentence email body>" }
- social: array of 5-7 objects { "offsetDays": <integer>, "channel": "<one of the available channels>", "content": "<post text, platform-appropriate, with hashtags where natural>" }

Spread items across roughly -14 to +7 days around launch. Make announcement build-up before launch, a launch-day push, and follow-up. Keep copy punchy and specific to this book.`,
      },
    ],
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const items: LaunchItem[] = [];
  let seq = 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const resolveDate = (offsetDays: number): string =>
    new Date(launchDate.getTime() + offsetDays * dayMs).toISOString();

  const rawEmails: any[] = Array.isArray(parsed.emails) ? parsed.emails : [];
  for (const e of rawEmails) {
    const content = typeof e?.content === "string" ? e.content.trim() : "";
    if (!content) continue;
    const offsetDays = clampOffset(e?.offsetDays);
    items.push({
      id: `e${++seq}`,
      type: "email",
      channel: "Email",
      offsetDays,
      scheduledAt: resolveDate(offsetDays),
      subject: typeof e?.subject === "string" ? e.subject.trim() : null,
      content,
      status: "scheduled",
    });
  }

  const rawSocial: any[] = Array.isArray(parsed.social) ? parsed.social : [];
  for (const s of rawSocial) {
    const content = typeof s?.content === "string" ? s.content.trim() : "";
    if (!content) continue;
    const offsetDays = clampOffset(s?.offsetDays);
    const channel =
      typeof s?.channel === "string" && socialChannels.includes(s.channel)
        ? s.channel
        : socialChannels[0];
    items.push({
      id: `s${++seq}`,
      type: "social",
      channel,
      offsetDays,
      scheduledAt: resolveDate(offsetDays),
      subject: null,
      content,
      status: "scheduled",
    });
  }

  if (items.length === 0) {
    throw new Error("AI returned no usable launch items. Please try again.");
  }

  items.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return { items, tokens: completion.usage?.total_tokens || 0 };
}
