import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";
import { openai, FAST_MODEL } from "./openai";
import type { Project, Chapter, MarketingAsset, StoryEntity } from "@shared/schema";

const TTS_DISK_DIR = path.resolve("uploads/audio/tts-cache");
const MEDIA_DIR = path.resolve("uploads/media");
fs.mkdirSync(TTS_DISK_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

export const DEFAULT_NARRATOR_VOICE = "fabb918a343d4591b428083a35980dc4";

// Fish Audio reference ids are 32-char hex; ElevenLabs voice ids are short alphanumeric.
export function isFishVoice(voiceId: string): boolean {
  return /^[a-f0-9]{32}$/i.test(voiceId);
}

function safeVoiceId(voiceId: string): string {
  return voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
}

function ttsCacheKey(text: string, voice: string): string {
  return crypto.createHash("md5").update(`${voice}:${text}`).digest("hex");
}

// Mirrors the disk-cache scheme used by /api/tts and /api/fish-tts so synthesized
// chunks are shared with the reader's per-voice cache.
function ttsDiskPath(voiceId: string, hash: string): string {
  const fish = isFishVoice(voiceId);
  const dirName = fish ? `fish_${safeVoiceId(voiceId)}` : safeVoiceId(voiceId);
  const dir = path.join(TTS_DISK_DIR, dirName);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${hash}.mp3`);
}

async function elevenLabsTTS(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
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
  return Buffer.from(await response.arrayBuffer());
}

async function fishAudioTTS(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) throw new Error("FISH_AUDIO_API_KEY not configured");
  const response = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: "mp3",
      latency: "normal",
      normalize: true,
      chunk_length: 200,
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`Fish Audio error ${response.status}: ${errText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export function chunkText(text: string, maxLen: number = 4000): string[] {
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
  return chunks.filter((c) => c.length > 0);
}

function stripForNarration(text: string): string {
  return text.replace(/[#*_`~>\[\]()]/g, "").replace(/\s+/g, " ").trim();
}

// Synthesize a single (<=4000 char) segment, reusing/writing the shared disk cache.
async function synthSegment(text: string, voiceId: string): Promise<Buffer> {
  const clean = text.slice(0, 4000);
  const key = ttsCacheKey(clean, voiceId);
  const file = ttsDiskPath(voiceId, key);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const buf = isFishVoice(voiceId) ? await fishAudioTTS(clean, voiceId) : await elevenLabsTTS(clean, voiceId);
  fs.writeFileSync(file, buf);
  return buf;
}

// Synthesize arbitrary-length text to a single mp3 buffer.
export async function synthText(text: string, voiceId: string): Promise<Buffer> {
  const clean = stripForNarration(text);
  if (!clean) return Buffer.alloc(0);
  const parts: Buffer[] = [];
  for (const chunk of chunkText(clean)) {
    parts.push(await synthSegment(chunk, voiceId));
  }
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// ffmpeg helpers
// ---------------------------------------------------------------------------

function runFfmpeg(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { cwd });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

function ffprobeDurationMs(file: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", file,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const secs = parseFloat(out.trim());
      resolve(isNaN(secs) ? 0 : Math.round(secs * 1000));
    });
  });
}

// Concatenate mp3 buffers into a single re-encoded mp3 file.
async function concatToMp3(buffers: Buffer[], outPath: string, workDir: string): Promise<void> {
  const parts = buffers.filter((b) => b.length > 0);
  if (parts.length === 0) throw new Error("No audio to concatenate");
  const listLines: string[] = [];
  parts.forEach((buf, i) => {
    const p = path.join(workDir, `seg-${i}.mp3`);
    fs.writeFileSync(p, buf);
    listLines.push(`file '${p.replace(/'/g, "'\\''")}'`);
  });
  const listFile = path.join(workDir, "concat.txt");
  fs.writeFileSync(listFile, listLines.join("\n"));
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c:a", "libmp3lame", "-b:a", "128k", outPath]);
}

// Mix a soft ambient music bed under a voice track.
async function mixMusicBed(voicePath: string, outPath: string): Promise<void> {
  const durMs = await ffprobeDurationMs(voicePath);
  const dur = Math.max(1, Math.round(durMs / 1000) + 1);
  await runFfmpeg([
    "-i", voicePath,
    "-f", "lavfi", "-t", String(dur), "-i", "sine=frequency=174:sample_rate=44100",
    "-f", "lavfi", "-t", String(dur), "-i", "sine=frequency=261:sample_rate=44100",
    "-filter_complex",
    "[1][2]amix=inputs=2,tremolo=f=0.15:d=0.6,lowpass=f=700,volume=0.05[bed];" +
    "[0:a]volume=1.0[vox];[vox][bed]amix=inputs=2:duration=first:dropout_transition=0,dynaudnorm[out]",
    "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "128k", outPath,
  ]);
}

function srtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (n: number, l = 2) => n.toString().padStart(l, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`;
}

// Build an SRT caption file distributing total duration across word-grouped lines.
function buildSrt(script: string, totalMs: number, srtPath: string): void {
  const words = script.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += 7) lines.push(words.slice(i, i + 7).join(" "));
  if (lines.length === 0) lines.push(script.slice(0, 60));
  const totalChars = lines.reduce((sum, l) => sum + l.length, 0) || 1;
  let cursor = 0;
  const entries: string[] = [];
  lines.forEach((line, i) => {
    const share = (line.length / totalChars) * totalMs;
    const start = cursor;
    const end = Math.min(totalMs, cursor + share);
    cursor = end;
    entries.push(`${i + 1}\n${srtTime(Math.round(start))} --> ${srtTime(Math.round(end))}\n${line}\n`);
  });
  fs.writeFileSync(srtPath, entries.join("\n"));
}

function projectMediaDir(projectId: number): string {
  const dir = path.join(MEDIA_DIR, String(projectId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lexora-media-"));
}

function relMediaUrl(absPath: string): string {
  const rel = path.relative(path.resolve("uploads"), absPath).split(path.sep).join("/");
  return `/uploads/${rel}`;
}

// ---------------------------------------------------------------------------
// AI helpers (return tokens for cost tracking)
// ---------------------------------------------------------------------------

export interface SpeakerSegment { speaker: string; text: string }

// Split text into windows on paragraph/sentence boundaries so no chapter content
// is dropped before segmentation. Each window stays within the model's input budget.
function windowText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const windows: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen * 0.5) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = rest.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    windows.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) windows.push(rest);
  return windows.filter(Boolean);
}

async function segmentWindow(passage: string, characterNames: string[]): Promise<{ segments: SpeakerSegment[]; tokens: number }> {
  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: "system",
        content: "You segment book prose into an ordered list of speaker turns for a multi-voice audiobook. Narration and unattributed text use speaker \"narrator\". Spoken dialogue uses the speaking character's name when it can be confidently attributed; otherwise \"narrator\". Preserve the original wording exactly and in order. Respond ONLY with valid JSON.",
      },
      {
        role: "user",
        content: `Known characters: ${characterNames.join(", ")}.\n\nReturn JSON: { "segments": [{ "speaker": "narrator"|<character name>, "text": "..." }] } covering the full passage in order.\n\nPassage:\n${passage}`,
      },
    ],
    max_completion_tokens: 4000,
    response_format: { type: "json_object" },
  });
  const tokens = completion.usage?.total_tokens || 0;
  const parsed = JSON.parse(completion.choices[0].message.content || "{}");
  const segs: SpeakerSegment[] = Array.isArray(parsed.segments) ? parsed.segments : [];
  const valid = segs.filter((s) => s && typeof s.text === "string" && s.text.trim());
  return { segments: valid, tokens };
}

async function segmentChapter(content: string, characterNames: string[]): Promise<{ segments: SpeakerSegment[]; tokens: number }> {
  const clean = stripForNarration(content);
  if (characterNames.length === 0) {
    return { segments: [{ speaker: "narrator", text: clean }], tokens: 0 };
  }
  // Process the ENTIRE chapter in ordered windows so no tail content is dropped.
  const windows = windowText(clean, 8000);
  try {
    const all: SpeakerSegment[] = [];
    let tokens = 0;
    for (const w of windows) {
      const { segments, tokens: t } = await segmentWindow(w, characterNames);
      tokens += t;
      // If any window comes back materially short, the segmentation is unreliable —
      // fall back to plain narration of the full chapter to guarantee completeness.
      const wCovered = segments.reduce((sum, s) => sum + s.text.length, 0);
      if (segments.length === 0 || wCovered < w.length * 0.85) {
        return { segments: [{ speaker: "narrator", text: clean }], tokens };
      }
      all.push(...segments);
    }
    if (all.length === 0) return { segments: [{ speaker: "narrator", text: clean }], tokens };
    return { segments: all, tokens };
  } catch {
    return { segments: [{ speaker: "narrator", text: clean }], tokens: 0 };
  }
}

export async function draftTrailerScript(
  project: Project,
  marketing: MarketingAsset | undefined,
  mode: "audio" | "video",
): Promise<{ script: string; tokens: number }> {
  const hook = marketing?.hooks?.[0] || "";
  const blurb = marketing?.shortBlurb || project.description || "";
  const targetWords = mode === "audio" ? "140-160" : "70-90";
  const targetSecs = mode === "audio" ? "about 60 seconds" : "about 30 seconds";
  const completion = await openai.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a world-class book trailer copywriter. Write a spoken-word promo voiceover script — punchy, cinematic, no stage directions, no headings, no quotation marks, just the words to be read aloud.",
      },
      {
        role: "user",
        content: `Write a ${targetSecs} promo voiceover (${targetWords} words) for the book "${project.title}" by ${project.authorName || "the author"}.\nGenre/vertical: ${project.vertical}.\nMarketing hook: ${hook}\nBlurb: ${blurb}\n\nEnd with a short call to action mentioning the title. Return ONLY the script text.`,
      },
    ],
    max_completion_tokens: 2000,
  });
  const tokens = completion.usage?.total_tokens || 0;
  const script = (completion.choices[0].message.content || "").trim().replace(/^["']|["']$/g, "");
  if (!script) throw new Error("Failed to generate trailer script");
  return { script, tokens };
}

// ---------------------------------------------------------------------------
// Public generators
// ---------------------------------------------------------------------------

export interface AudiobookOptions {
  project: Project;
  chapters: Chapter[];
  narratorVoice: string;
  voiceMap: Record<string, string>; // character name -> voiceId
  includeIntro: boolean;
  musicBed: boolean;
  characters: StoryEntity[];
}

export interface AudiobookResult {
  url: string;
  durationMs: number;
  fileSize: number;
  chapterCount: number;
  multiVoice: boolean;
  tokens: number;
}

export async function generateAudiobook(opts: AudiobookOptions): Promise<AudiobookResult> {
  const { project, chapters, narratorVoice, voiceMap, includeIntro, musicBed, characters } = opts;
  const completed = chapters.filter((c) => c.status === "complete" && c.content).sort((a, b) => a.chapterNumber - b.chapterNumber);
  if (completed.length === 0) throw new Error("No completed chapters to narrate");

  const characterNames = characters.map((c) => c.name).filter(Boolean);
  const assignedNames = Object.keys(voiceMap).filter((n) => voiceMap[n] && voiceMap[n] !== narratorVoice);
  const multiVoice = assignedNames.length > 0;
  const resolveVoice = (speaker: string): string => {
    if (!speaker || speaker.toLowerCase() === "narrator") return narratorVoice;
    const hit = assignedNames.find((n) => n.toLowerCase() === speaker.toLowerCase())
      || assignedNames.find((n) => speaker.toLowerCase().includes(n.toLowerCase()));
    return hit ? voiceMap[hit] : narratorVoice;
  };

  const workDir = mkTmpDir();
  let tokens = 0;
  try {
    const buffers: Buffer[] = [];
    if (includeIntro) {
      const introText = `${project.title}. Written by ${project.authorName || "Unknown Author"}. ${completed.length} ${completed.length === 1 ? "chapter" : "chapters"}. Narrated on Lexora.`;
      buffers.push(await synthText(introText, narratorVoice));
    }
    for (const ch of completed) {
      buffers.push(await synthText(`Chapter ${ch.chapterNumber}. ${ch.title}.`, narratorVoice));
      if (multiVoice) {
        const { segments, tokens: t } = await segmentChapter(ch.content || "", characterNames.filter((n) => assignedNames.some((a) => a.toLowerCase() === n.toLowerCase())));
        tokens += t;
        for (const seg of segments) {
          const buf = await synthText(seg.text, resolveVoice(seg.speaker));
          if (buf.length > 0) buffers.push(buf);
        }
      } else {
        buffers.push(await synthText(ch.content || "", narratorVoice));
      }
    }

    const outDir = projectMediaDir(project.id);
    const rawOut = path.join(workDir, "audiobook-raw.mp3");
    await concatToMp3(buffers, rawOut, workDir);

    const finalOut = path.join(outDir, `audiobook-${Date.now()}.mp3`);
    if (musicBed) await mixMusicBed(rawOut, finalOut);
    else fs.copyFileSync(rawOut, finalOut);

    const durationMs = await ffprobeDurationMs(finalOut);
    const fileSize = fs.statSync(finalOut).size;
    return { url: relMediaUrl(finalOut), durationMs, fileSize, chapterCount: completed.length, multiVoice, tokens };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export interface AudioTrailerResult { url: string; script: string; durationMs: number; fileSize: number; tokens: number }

export async function generateAudioTrailer(opts: {
  project: Project; marketing?: MarketingAsset; voiceId: string; musicBed: boolean;
}): Promise<AudioTrailerResult> {
  const { project, marketing, voiceId, musicBed } = opts;
  const { script, tokens } = await draftTrailerScript(project, marketing, "audio");
  const workDir = mkTmpDir();
  try {
    const voiceBuf = await synthText(script, voiceId);
    const rawOut = path.join(workDir, "trailer-raw.mp3");
    fs.writeFileSync(rawOut, voiceBuf);
    const outDir = projectMediaDir(project.id);
    const finalOut = path.join(outDir, `audio-trailer-${Date.now()}.mp3`);
    if (musicBed) await mixMusicBed(rawOut, finalOut);
    else await runFfmpeg(["-i", rawOut, "-c:a", "libmp3lame", "-b:a", "128k", finalOut]);
    const durationMs = await ffprobeDurationMs(finalOut);
    const fileSize = fs.statSync(finalOut).size;
    return { url: relMediaUrl(finalOut), script, durationMs, fileSize, tokens };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export interface VideoTrailerResult { url: string; script: string; durationMs: number; fileSize: number; tokens: number }

async function resolveCoverImage(project: Project, workDir: string): Promise<string> {
  const out = path.join(workDir, "cover.png");
  const url = project.coverImageUrl || "";
  const dataMatch = url.match(/^data:image\/(\w+);base64,(.+)$/);
  if (dataMatch) {
    fs.writeFileSync(out, Buffer.from(dataMatch[2], "base64"));
    return out;
  }
  if (/^https?:\/\//.test(url)) {
    const resp = await fetch(url);
    if (resp.ok) {
      fs.writeFileSync(out, Buffer.from(await resp.arrayBuffer()));
      return out;
    }
  }
  if (url.startsWith("/uploads/")) {
    const local = path.resolve("." + url);
    if (fs.existsSync(local)) return local;
  }
  // Fallback: generated gradient background.
  await runFfmpeg([
    "-f", "lavfi", "-i", "gradients=s=1080x1920:c0=0x1a0b2e:c1=0x4c1d95:duration=1",
    "-frames:v", "1", out,
  ]);
  return out;
}

export async function generateVideoTrailer(opts: {
  project: Project; marketing?: MarketingAsset; voiceId: string;
}): Promise<VideoTrailerResult> {
  const { project, marketing, voiceId } = opts;
  const { script, tokens } = await draftTrailerScript(project, marketing, "video");
  const workDir = mkTmpDir();
  try {
    const voiceBuf = await synthText(script, voiceId);
    const voicePath = path.join(workDir, "voice.mp3");
    fs.writeFileSync(voicePath, voiceBuf);
    const durationMs = await ffprobeDurationMs(voicePath);

    const coverPath = await resolveCoverImage(project, workDir);
    const srtPath = path.join(workDir, "captions.srt");
    buildSrt(script, durationMs, srtPath);

    const outDir = projectMediaDir(project.id);
    const finalOut = path.join(outDir, `video-trailer-${Date.now()}.mp4`);

    const vf = [
      "scale=1080:1920:force_original_aspect_ratio=decrease",
      "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0d0617",
      "subtitles=captions.srt:force_style='FontName=DejaVu Sans,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=120'",
    ].join(",");

    await runFfmpeg([
      "-loop", "1", "-i", coverPath,
      "-i", voicePath,
      "-vf", vf,
      "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest", "-r", "25", finalOut,
    ], workDir);

    const fileSize = fs.statSync(finalOut).size;
    return { url: relMediaUrl(finalOut), script, durationMs, fileSize, tokens };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
