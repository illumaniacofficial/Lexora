export function estimateCost(tokens: number, model: string): number {
  if (model.startsWith("ollama:") || model.startsWith("local:")) return 0;
  const rates: Record<string, number> = {
    "gpt-5-mini": 0.0000003,
    "gpt-5.1": 0.000003,
    "gpt-image-1": 0.04,
  };
  return tokens * (rates[model] || 0.000003);
}
