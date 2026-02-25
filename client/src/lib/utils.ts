import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

export function formatCost(n: number) {
  return `$${n.toFixed(2)}`;
}

export function formatScore(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toFixed(1);
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    trend_analysis: "Trend Analysis",
    outlining: "Outlining",
    writing: "Writing",
    editing: "Editing",
    marketing: "Marketing",
    complete: "Complete",
    paused: "Paused",
  };
  return labels[status] || status;
}

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "complete") return "default";
  if (status === "paused") return "secondary";
  return "outline";
}

export const VERTICAL_LABELS: Record<string, string> = {
  money: "Money & Finance",
  fitness: "Fitness & Exercise",
  spirituality: "Spirituality & Mindfulness",
  career: "Career & Leadership",
  education: "Education & Learning",
  relationships: "Relationships & Dating",
  health: "Health & Wellness",
  mindset: "Mindset & Psychology",
  parenting: "Parenting & Family",
  technology: "Technology & Innovation",
};

export const VERTICAL_BG: Record<string, string> = {
  money: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  fitness: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  spirituality: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
  career: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  education: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
  relationships: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800",
  health: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
  mindset: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
  parenting: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
  technology: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800",
};

export const VERTICAL_ACCENT: Record<string, string> = {
  money: "text-amber-700 dark:text-amber-300",
  fitness: "text-red-700 dark:text-red-300",
  spirituality: "text-purple-700 dark:text-purple-300",
  career: "text-blue-700 dark:text-blue-300",
  education: "text-green-700 dark:text-green-300",
  relationships: "text-pink-700 dark:text-pink-300",
  health: "text-teal-700 dark:text-teal-300",
  mindset: "text-indigo-700 dark:text-indigo-300",
  parenting: "text-orange-700 dark:text-orange-300",
  technology: "text-slate-700 dark:text-slate-300",
};
