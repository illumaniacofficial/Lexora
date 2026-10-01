const SHORT_FUNCTION_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "if", "in", "is", "it", "of", "on", "or", "so", "the", "to", "up", "we",
  "a", "al", "de", "del", "el", "en", "es", "la", "las", "lo", "los", "o", "por", "que", "se", "un", "una", "y",
]);

function normalizeWord(word: string): string {
  return word
    .replace(/^[“”"'‘’([{¿¡]+/, "")
    .replace(/[”"'’)]}]+$/, "")
    .trim();
}

function syllableEstimate(word: string): number {
  const clean = normalizeWord(word).toLowerCase();
  if (!clean) return 1;

  if (/^\d+(?:[.,:]\d+)*$/.test(clean)) {
    // Numbers are usually spoken more slowly than their character count implies.
    return Math.max(1, Math.min(8, Math.ceil(clean.replace(/\D/g, "").length * 0.8)));
  }

  if (/^[A-Z0-9]{2,8}$/.test(normalizeWord(word))) {
    // Acronyms/initialisms frequently get spelled out.
    return Math.min(8, clean.length);
  }

  const latin = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

  if (!latin) return Math.max(1, Math.ceil(clean.length / 3));

  const groups = latin.match(/[aeiouy]+/g)?.length || 1;
  const silentEAdjustment =
    latin.length > 3 && /e$/.test(latin) && !/(le|ye)$/.test(latin) ? 1 : 0;
  return Math.max(1, groups - silentEAdjustment);
}

function spokenWeight(word: string): number {
  const clean = normalizeWord(word);
  const lower = clean.toLowerCase();
  const syllables = syllableEstimate(clean);

  // Base speaking time is driven more by syllables than raw character count.
  let weight = 0.72 + syllables * 0.82 + Math.min(clean.length, 18) * 0.025;

  if (SHORT_FUNCTION_WORDS.has(lower)) weight *= 0.72;

  // Common punctuation creates audible pauses. Sentence endings matter much
  // more than commas, and ellipses/dashes tend to be longer dramatic pauses.
  if (/[…]{1,}$/.test(word) || /\.\.\.$/.test(word)) weight += 2.35;
  else if (/[!?]$/.test(word)) weight += 1.95;
  else if (/\.$/.test(word)) weight += 1.65;
  else if (/[;:]$/.test(word)) weight += 1.0;
  else if (/[,]$/.test(word)) weight += 0.62;
  else if (/[—–]$/.test(word)) weight += 0.9;

  if (/[)"'”’»]$/.test(word)) weight += 0.12;
  return Math.max(0.42, weight);
}

export function buildCumulativeWeights(words: string[]): Float32Array {
  const cumul = new Float32Array(words.length + 1);
  cumul[0] = 0;
  for (let i = 0; i < words.length; i++) {
    cumul[i + 1] = cumul[i] + spokenWeight(words[i]);
  }
  return cumul;
}

export function wordIndexFromProgress(pct: number, cumul: Float32Array): number {
  if (cumul.length <= 1) return 0;
  const clamped = Math.max(0, Math.min(1, pct));
  const total = cumul[cumul.length - 1];
  if (total <= 0) return 0;

  const target = clamped * total;
  let lo = 0;
  let hi = cumul.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumul[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function wordIndexFromAudioTime(
  currentTime: number,
  duration: number,
  cumul: Float32Array,
): number {
  if (!Number.isFinite(duration) || duration <= 0 || cumul.length <= 1) return 0;

  // MP3/TTS output often contains a small amount of encoder/voice lead-in and
  // trailing silence. Removing a bounded amount keeps highlighting from
  // jumping ahead before speech starts and lagging after the final word.
  const lead = Math.min(0.28, Math.max(0.05, duration * 0.012));
  const tail = Math.min(0.22, Math.max(0.04, duration * 0.009));
  const speechDuration = Math.max(0.05, duration - lead - tail);
  const speechTime = Math.max(0, Math.min(speechDuration, currentTime - lead));
  const progress = speechTime / speechDuration;

  return wordIndexFromProgress(progress, cumul);
}
