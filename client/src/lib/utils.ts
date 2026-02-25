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
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-amber-400";
  return "text-red-400";
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

export const PIPELINE_STEPS = ["draft", "trend_analysis", "outlining", "writing", "editing", "marketing", "complete"];

export function getPipelinePct(status: string): number {
  const idx = PIPELINE_STEPS.indexOf(status);
  return idx >= 0 ? Math.round((idx / (PIPELINE_STEPS.length - 1)) * 100) : 0;
}

export const STATUS_GLOW: Record<string, string> = {
  draft: "bg-zinc-500",
  trend_analysis: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]",
  outlining: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.6)]",
  writing: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  editing: "bg-orange-400",
  marketing: "bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.6)]",
  complete: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
  paused: "bg-zinc-500",
};

export const VERTICAL_ICONS: Record<string, string> = {
  money: "💰", fitness: "💪", spirituality: "🧘", career: "🚀",
  education: "📚", relationships: "❤️", health: "🏥", mindset: "🧠",
  parenting: "👨‍👩‍👧", technology: "⚡",
  cooking: "🍳", travel: "✈️", photography: "📷", music: "🎵", writing: "✍️",
  art: "🎨", gardening: "🌱", pets: "🐾", sports: "⚽", gaming: "🎮",
  philosophy: "💭", history: "🏛️", science: "🔬", psychology: "🧩", sociology: "👥",
  politics: "🏛️", law: "⚖️", business: "💼", marketing: "📣", sales: "🤝",
  "real-estate": "🏠", crypto: "₿", ai: "🤖", cybersecurity: "🔒", productivity: "⏱️",
  minimalism: "◻️", sustainability: "♻️", fashion: "👗", beauty: "💄", diy: "🔨",
};

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export const LANGUAGE_LABELS: Record<string, string> = {
  english: "English",
  spanish: "Español",
  portuguese: "Português",
  french: "Français",
  german: "Deutsch",
};

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
  cooking: "Cooking & Recipes",
  travel: "Travel & Adventure",
  photography: "Photography & Visual Arts",
  music: "Music & Audio",
  writing: "Writing & Storytelling",
  art: "Art & Creativity",
  gardening: "Gardening & Botany",
  pets: "Pets & Animal Care",
  sports: "Sports & Athletics",
  gaming: "Gaming & Esports",
  philosophy: "Philosophy & Ethics",
  history: "History & Culture",
  science: "Science & Discovery",
  psychology: "Psychology & Behavior",
  sociology: "Sociology & Society",
  politics: "Politics & Government",
  law: "Law & Justice",
  business: "Business & Entrepreneurship",
  marketing: "Marketing & Branding",
  sales: "Sales & Negotiation",
  "real-estate": "Real Estate & Property",
  crypto: "Crypto & Blockchain",
  ai: "AI & Machine Learning",
  cybersecurity: "Cybersecurity & Privacy",
  productivity: "Productivity & Time Management",
  minimalism: "Minimalism & Simple Living",
  sustainability: "Sustainability & Green Living",
  fashion: "Fashion & Style",
  beauty: "Beauty & Skincare",
  diy: "DIY & Crafts",
};
