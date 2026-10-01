/**
 * Convert visual/form-style text into something a narrator should actually say.
 * The rendered book is never changed; this is narration-only normalization.
 */
export function normalizeNarrationText(input: string): string {
  return input
    // Fill-in-the-blank lines should be spoken once, not character by character.
    .replace(/[_＿]{3,}/g, " blank ")
    // A blank wrapped in empty parentheses should not sound like punctuation soup.
    .replace(/\(\s*blank\s*\)/gi, " blank ")
    // Normalize repeated whitespace introduced by substitutions while preserving
    // paragraph breaks for natural TTS phrasing.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Avoid awkward spaces before punctuation after a blank replacement.
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
