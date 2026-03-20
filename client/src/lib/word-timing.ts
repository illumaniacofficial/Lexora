export function buildCumulativeWeights(words: string[]): Float32Array {
  const cumul = new Float32Array(words.length + 1);
  cumul[0] = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let weight = Math.max(1, w.length * 0.7);
    if (/[.!?…]$/.test(w)) weight += 3.5;
    else if (/[,;:\-—]$/.test(w)) weight += 1.5;
    else if (/[)"'»]$/.test(w)) weight += 0.8;
    cumul[i + 1] = cumul[i] + weight;
  }
  return cumul;
}

export function wordIndexFromProgress(pct: number, cumul: Float32Array): number {
  if (cumul.length <= 1) return 0;
  const total = cumul[cumul.length - 1];
  const target = pct * total;
  let lo = 0;
  let hi = cumul.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumul[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
