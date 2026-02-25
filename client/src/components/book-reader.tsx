import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, List, Minus, Plus, Palette, Volume2, Loader2, Play, Pause, RotateCcw, SkipForward, Columns2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarkdownRenderer, stripMarkdown } from "@/components/markdown-renderer";
import { VOICE_OPTIONS, type NarratorVoice, type NarrationState } from "@/components/audio-mini-player";
import { apiRequest } from "@/lib/queryClient";
import type { Chapter } from "@shared/schema";

interface BookReaderProps {
  title: string;
  authorName: string;
  chapters: Chapter[];
  coverImageUrl?: string | null;
  onClose: () => void;
  onStartNarration?: (narration: NarrationState) => void;
}

type PageContent =
  | { type: "cover"; title: string; author: string; coverUrl?: string | null }
  | { type: "toc"; chapters: { number: number; title: string }[] }
  | { type: "chapter-title"; chapterNumber: number; chapterTitle: string }
  | { type: "text"; chapterNumber: number; chapterTitle: string; text: string; pageInChapter: number; totalPagesInChapter: number };

type PageTheme = "parchment" | "cream" | "white" | "sepia" | "dark" | "midnight";

const THEMES: Record<PageTheme, { bg: string; text: string; accent: string; headerText: string; heading: string; divider: string; label: string; gradient: string; edgeShadow: string; spineShadow: string }> = {
  parchment: {
    bg: "bg-[#f8f4eb]", text: "text-stone-700", accent: "text-stone-400", headerText: "text-stone-800", heading: "text-stone-800", divider: "bg-amber-800/20", label: "Parchment",
    gradient: "linear-gradient(135deg, #faf6ed 0%, #f2ecda 50%, #ede6d0 100%)",
    edgeShadow: "rgba(139,119,90,0.15)", spineShadow: "rgba(120,100,70,0.12)",
  },
  cream: {
    bg: "bg-[#fffdf5]", text: "text-stone-600", accent: "text-stone-400", headerText: "text-stone-800", heading: "text-stone-800", divider: "bg-stone-300", label: "Cream",
    gradient: "linear-gradient(135deg, #fffef8 0%, #fdfbf0 50%, #faf7e8 100%)",
    edgeShadow: "rgba(160,150,130,0.1)", spineShadow: "rgba(140,130,110,0.08)",
  },
  white: {
    bg: "bg-white", text: "text-gray-700", accent: "text-gray-400", headerText: "text-gray-900", heading: "text-gray-900", divider: "bg-gray-200", label: "White",
    gradient: "linear-gradient(135deg, #ffffff 0%, #fafafa 50%, #f5f5f5 100%)",
    edgeShadow: "rgba(0,0,0,0.06)", spineShadow: "rgba(0,0,0,0.04)",
  },
  sepia: {
    bg: "bg-[#f0e6d2]", text: "text-amber-900", accent: "text-amber-700/50", headerText: "text-amber-950", heading: "text-amber-950", divider: "bg-amber-800/25", label: "Sepia",
    gradient: "linear-gradient(135deg, #f2e8d4 0%, #ece0c8 50%, #e5d8bc 100%)",
    edgeShadow: "rgba(139,110,70,0.18)", spineShadow: "rgba(120,90,50,0.14)",
  },
  dark: {
    bg: "bg-[#1e1e1e]", text: "text-stone-300", accent: "text-stone-500", headerText: "text-stone-100", heading: "text-stone-100", divider: "bg-stone-700", label: "Dark",
    gradient: "linear-gradient(135deg, #222222 0%, #1e1e1e 50%, #1a1a1a 100%)",
    edgeShadow: "rgba(0,0,0,0.3)", spineShadow: "rgba(0,0,0,0.25)",
  },
  midnight: {
    bg: "bg-[#0d1117]", text: "text-blue-200/80", accent: "text-blue-400/40", headerText: "text-blue-100", heading: "text-blue-100", divider: "bg-blue-800/30", label: "Midnight",
    gradient: "linear-gradient(135deg, #0f1419 0%, #0d1117 50%, #0b0f14 100%)",
    edgeShadow: "rgba(0,0,0,0.4)", spineShadow: "rgba(0,0,0,0.35)",
  },
};

const FONT_SIZES = [
  { label: "XS", value: 12 },
  { label: "S", value: 14 },
  { label: "M", value: 16 },
  { label: "L", value: 18 },
  { label: "XL", value: 20 },
  { label: "2XL", value: 24 },
];

function linesForFontSize(fontSize: number): number {
  if (fontSize <= 12) return 44;
  if (fontSize <= 14) return 38;
  if (fontSize <= 16) return 32;
  if (fontSize <= 18) return 28;
  if (fontSize <= 20) return 24;
  return 20;
}

function splitTextIntoPages(text: string, linesPerPage: number, charsPerLine: number): string[] {
  const paragraphs = text.split(/\n+/).filter(p => p.trim());
  const pages: string[] = [];
  let currentLines: string[] = [];
  let lineCount = 0;
  for (const para of paragraphs) {
    const estimatedLines = Math.max(1, Math.ceil(para.length / charsPerLine));
    if (lineCount + estimatedLines > linesPerPage && currentLines.length > 0) {
      pages.push(currentLines.join("\n\n"));
      currentLines = [];
      lineCount = 0;
    }
    currentLines.push(para);
    lineCount += estimatedLines + 1;
  }
  if (currentLines.length > 0) pages.push(currentLines.join("\n\n"));
  return pages.length > 0 ? pages : [""];
}

function buildPages(title: string, authorName: string, chapters: Chapter[], coverUrl: string | null | undefined, fontSize: number): PageContent[] {
  const pages: PageContent[] = [];
  pages.push({ type: "cover", title, author: authorName, coverUrl });
  pages.push({ type: "toc", chapters: chapters.map(c => ({ number: c.chapterNumber, title: c.title })) });
  const linesPerPage = linesForFontSize(fontSize);
  const charsPerLine = Math.max(40, Math.round(80 * (16 / fontSize)));
  for (const ch of chapters) {
    pages.push({ type: "chapter-title", chapterNumber: ch.chapterNumber, chapterTitle: ch.title });
    if (ch.content) {
      const textPages = splitTextIntoPages(ch.content, linesPerPage, charsPerLine);
      textPages.forEach((text, i) => {
        pages.push({ type: "text", chapterNumber: ch.chapterNumber, chapterTitle: ch.title, text, pageInChapter: i + 1, totalPagesInChapter: textPages.length });
      });
    }
  }
  return pages;
}

function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(() => typeof window !== "undefined" && window.innerWidth > window.innerHeight && window.innerWidth >= 900);
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth >= 900);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isLandscape;
}

function PageEdges({ side, theme }: { side: "left" | "right"; theme: PageTheme }) {
  const isDark = theme === "dark" || theme === "midnight";
  const t = THEMES[theme];
  if (side === "left") {
    return (
      <>
        <div className="absolute inset-0 pointer-events-none rounded-l-sm rounded-r-none" style={{
          boxShadow: `inset -6px 0 12px ${t.spineShadow}, inset 3px 0 6px ${t.edgeShadow}`,
        }} />
        <div className="absolute right-0 top-0 bottom-0 w-[2px] pointer-events-none" style={{
          background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.08)",
        }} />
        <div className="absolute right-[2px] top-0 bottom-0 w-[1px] pointer-events-none" style={{
          background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)",
        }} />
      </>
    );
  }
  return (
    <>
      <div className="absolute inset-0 pointer-events-none rounded-r-sm rounded-l-none" style={{
        boxShadow: `inset 6px 0 12px ${t.spineShadow}, inset -3px 0 6px ${t.edgeShadow}`,
      }} />
      <div className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none" style={{
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.08)",
      }} />
      <div className="absolute left-[2px] top-0 bottom-0 w-[1px] pointer-events-none" style={{
        background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)",
      }} />
      <div className="absolute right-0 top-2 bottom-2 w-[3px] pointer-events-none" style={{
        background: `linear-gradient(to left, ${t.edgeShadow}, transparent)`,
      }} />
    </>
  );
}

function PaperTexture({ isDark }: { isDark: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
      backgroundImage: isDark
        ? "none"
        : `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`,
    }} />
  );
}

function PageNumber({ pageNum, total, theme, side }: { pageNum: number; total: number; theme: PageTheme; side: "left" | "right" | "center" }) {
  const t = THEMES[theme];
  return (
    <div className={cn("absolute bottom-3 font-mono text-[9px] tracking-wider", t.accent, side === "left" ? "left-6" : side === "right" ? "right-6" : "left-1/2 -translate-x-1/2")}>
      {pageNum} / {total}
    </div>
  );
}

function CoverPage({ page, theme }: { page: Extract<PageContent, { type: "cover" }>; theme: PageTheme }) {
  const t = THEMES[theme];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 relative">
      {page.coverUrl && (
        <div className="mb-8 w-48 h-64 rounded-lg overflow-hidden shadow-2xl border border-black/10">
          <img src={page.coverUrl} alt="Book cover" className="w-full h-full object-cover" />
        </div>
      )}
      <div className={cn("w-24 h-[2px] mb-8 rounded-full", t.divider)} />
      <h1 className={cn("font-serif text-3xl md:text-4xl font-bold leading-tight mb-4", t.heading)}>{page.title}</h1>
      <div className={cn("w-16 h-[1px] mb-4 rounded-full", t.divider)} />
      <p className={cn("font-serif text-lg italic", t.accent)}>by {page.author}</p>
    </div>
  );
}

function TocPage({ page, theme, fontSize }: { page: Extract<PageContent, { type: "toc" }>; theme: PageTheme; fontSize: number }) {
  const t = THEMES[theme];
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <h2 className={cn("font-serif text-2xl font-bold mb-6 text-center", t.heading)}>Table of Contents</h2>
      <div className={cn("w-12 h-[1px] mx-auto mb-8", t.divider)} />
      <div className="space-y-3 flex-1 overflow-y-auto reader-scroll">
        {page.chapters.map(ch => (
          <div key={ch.number} className="flex items-baseline gap-2" style={{ fontSize: `${fontSize}px` }}>
            <span className={cn("font-mono shrink-0 w-8", t.accent)} style={{ fontSize: `${fontSize - 2}px` }}>{ch.number}.</span>
            <span className={cn("font-serif flex-1", t.text)}>{ch.title}</span>
            <span className={cn("border-b border-dotted flex-1 min-w-8 mx-2", t.divider.replace("bg-", "border-"))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChapterTitlePage({ page, theme }: { page: Extract<PageContent, { type: "chapter-title" }>; theme: PageTheme }) {
  const t = THEMES[theme];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <span className={cn("font-mono text-xs uppercase tracking-[0.3em] mb-3", t.accent)}>Chapter {page.chapterNumber}</span>
      <div className={cn("w-16 h-[2px] mb-6 rounded-full", t.divider)} />
      <h2 className={cn("font-serif text-2xl md:text-3xl font-bold leading-tight", t.heading)}>{page.chapterTitle}</h2>
    </div>
  );
}

function TextPage({ page, theme, fontSize }: { page: Extract<PageContent, { type: "text" }>; theme: PageTheme; fontSize: number }) {
  const t = THEMES[theme];
  const isDark = theme === "dark" || theme === "midnight";
  return (
    <div className="flex flex-col h-full px-6 sm:px-8 py-4 sm:py-6">
      <div className={cn("flex items-center justify-between mb-3 font-mono uppercase tracking-wider", t.accent)} style={{ fontSize: "10px" }}>
        <span>Chapter {page.chapterNumber}</span>
        <span>{page.pageInChapter} / {page.totalPagesInChapter}</span>
      </div>
      <div className={cn("w-full h-[1px] mb-4", t.divider)} />
      <div className="flex-1 overflow-y-auto pr-1 reader-scroll" style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize <= 14 ? 1.7 : fontSize <= 18 ? 1.8 : 1.9}` }}>
        {isDark ? <DarkMarkdownRenderer content={page.text} theme={theme} /> : <MarkdownRenderer content={page.text} />}
      </div>
    </div>
  );
}

function DarkMarkdownRenderer({ content, theme }: { content: string; theme: PageTheme }) {
  const t = THEMES[theme];
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  return (
    <div>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (trimmed.startsWith("# ")) return <h2 key={i} className={cn("font-serif text-xl font-bold mt-4 mb-3", t.heading)}>{trimmed.replace(/^#+\s*/, "")}</h2>;
        if (trimmed.startsWith("## ")) return <h3 key={i} className={cn("font-serif text-lg font-bold mt-3 mb-2", t.heading)}>{trimmed.replace(/^#+\s*/, "")}</h3>;
        if (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) return <h4 key={i} className={cn("font-serif text-base font-bold mt-3 mb-2", t.heading)}>{trimmed.replace(/^#+\s*/, "")}</h4>;
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n/).filter(l => l.trim());
          return <ul key={i} className="list-disc pl-5 mb-3 space-y-1">{items.map((item, j) => <li key={j} className={cn("font-serif text-sm leading-relaxed", t.text)}>{item.replace(/^[-*]\s*/, "")}</li>)}</ul>;
        }
        if (trimmed.startsWith(">")) {
          const quoteText = trimmed.split("\n").map(l => l.replace(/^>\s*/, "")).join(" ");
          return <blockquote key={i} className={cn("border-l-2 pl-4 my-3 italic font-serif text-sm leading-relaxed", t.accent, t.divider.replace("bg-", "border-"))}>{quoteText}</blockquote>;
        }
        if (/^[-*]{3,}$/.test(trimmed)) return <div key={i} className={cn("w-12 h-[1px] mx-auto my-4", t.divider)} />;
        return <p key={i} className={cn("font-serif text-sm leading-[1.9] mb-3 text-justify indent-6", t.text)}>{trimmed.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*([^*]+?)\*/g, "$1")}</p>;
      })}
    </div>
  );
}

function renderPage(page: PageContent, theme: PageTheme, fontSize: number) {
  if (page.type === "cover") return <CoverPage page={page} theme={theme} />;
  if (page.type === "toc") return <TocPage page={page} theme={theme} fontSize={fontSize} />;
  if (page.type === "chapter-title") return <ChapterTitlePage page={page} theme={theme} />;
  if (page.type === "text") return <TextPage page={page} theme={theme} fontSize={fontSize} />;
  return null;
}

function BookPage({ page, theme, fontSize, side, pageNum, totalPages, isFlipping, flipDir }: {
  page: PageContent; theme: PageTheme; fontSize: number; side: "left" | "right" | "center";
  pageNum: number; totalPages: number; isFlipping: boolean; flipDir: "left" | "right";
}) {
  const t = THEMES[theme];
  const isDark = theme === "dark" || theme === "midnight";
  const roundedClass = side === "left" ? "rounded-l-lg rounded-r-none" : side === "right" ? "rounded-r-lg rounded-l-none" : "rounded-xl";

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden transition-all duration-300 ease-in-out",
        t.bg, roundedClass,
        side === "center" && isDark && "shadow-[0_8px_60px_rgba(0,0,0,0.8)]",
        side === "center" && !isDark && "shadow-[0_8px_60px_rgba(0,0,0,0.4),0_2px_10px_rgba(0,0,0,0.15)]",
        side !== "center" && isDark && "shadow-[0_4px_30px_rgba(0,0,0,0.6)]",
        side !== "center" && !isDark && "shadow-[0_4px_30px_rgba(0,0,0,0.2),0_1px_6px_rgba(0,0,0,0.1)]",
        isFlipping && flipDir === "right" && "animate-page-flip-right",
        isFlipping && flipDir === "left" && "animate-page-flip-left",
      )}
      style={{ backgroundImage: t.gradient }}
    >
      <PaperTexture isDark={isDark} />
      <PageEdges side={side === "center" ? "right" : side} theme={theme} />
      <div className="h-full overflow-hidden flex flex-col relative z-[1]">
        {renderPage(page, theme, fontSize)}
      </div>
      <PageNumber pageNum={pageNum} total={totalPages} theme={theme} side={side === "center" ? "center" : side} />
    </div>
  );
}

export default function BookReader({ title, authorName, chapters, coverImageUrl, onClose, onStartNarration }: BookReaderProps) {
  const completedChapters = chapters.filter(c => c.status === "complete" && c.content);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"left" | "right">("right");
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNarrator, setShowNarrator] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const v = localStorage.getItem("bookforge-reader-fontsize");
      const n = v ? Number(v) : 16;
      return FONT_SIZES.some(s => s.value === n) ? n : 16;
    } catch { return 16; }
  });
  const [theme, setTheme] = useState<PageTheme>(() => {
    try {
      const v = localStorage.getItem("bookforge-reader-theme");
      return v && v in THEMES ? (v as PageTheme) : "parchment";
    } catch { return "parchment"; }
  });
  const [selectedVoice, setSelectedVoice] = useState<NarratorVoice>("alloy");
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [autoNarrate, setAutoNarrate] = useState(false);
  const [dualPage, setDualPage] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAnimRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoNarRef = useRef(false);
  const isLandscape = useIsLandscape();
  const showDual = isLandscape && dualPage;

  const pages = useMemo(
    () => buildPages(title, authorName, completedChapters, coverImageUrl, fontSize),
    [title, authorName, completedChapters, coverImageUrl, fontSize]
  );

  const textPages = useMemo(() =>
    pages
      .filter((p): p is Extract<PageContent, { type: "text" }> => p.type === "text")
      .map(p => ({ chapterNumber: p.chapterNumber, chapterTitle: p.chapterTitle, pageInChapter: p.pageInChapter, totalPagesInChapter: p.totalPagesInChapter, text: p.text })),
    [pages]
  );

  useEffect(() => { autoNarRef.current = autoNarrate; }, [autoNarrate]);

  useEffect(() => {
    try { localStorage.setItem("bookforge-reader-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem("bookforge-reader-fontsize", String(fontSize)); } catch {}
  }, [fontSize]);

  useEffect(() => {
    if (currentPage >= pages.length) setCurrentPage(Math.max(0, pages.length - 1));
  }, [pages.length, currentPage]);

  const goToImmediate = useCallback((pageNum: number) => {
    if (pageNum >= 0 && pageNum < pages.length) {
      setCurrentPage(pageNum);
    }
  }, [pages.length]);

  const goTo = useCallback((pageNum: number) => {
    if (pageNum < 0 || pageNum >= pages.length || isFlipping) return;
    setFlipDirection(pageNum > currentPage ? "right" : "left");
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage(pageNum);
      setIsFlipping(false);
    }, 300);
  }, [currentPage, pages.length, isFlipping]);

  const prev = useCallback(() => {
    if (showDual) goTo(Math.max(0, currentPage - 2));
    else goTo(currentPage - 1);
  }, [goTo, currentPage, showDual]);

  const next = useCallback(() => {
    if (showDual) goTo(Math.min(pages.length - 1, currentPage + 2));
    else goTo(currentPage + 1);
  }, [goTo, currentPage, showDual, pages.length]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize(prev => {
      const sizes = FONT_SIZES.map(s => s.value);
      const idx = sizes.indexOf(prev);
      const newIdx = Math.max(0, Math.min(sizes.length - 1, idx + delta));
      return sizes[newIdx];
    });
  }, []);

  const stopNarration = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (narrationAnimRef.current) cancelAnimationFrame(narrationAnimRef.current);
    setIsNarrating(false);
    setNarrationProgress(0);
  }, []);

  const playPage = useCallback(async (pageIdx: number) => {
    let pg = pages[pageIdx];
    if (pg.type !== "text") {
      let nextIdx = pageIdx + 1;
      while (nextIdx < pages.length && pages[nextIdx].type !== "text") nextIdx++;
      if (nextIdx >= pages.length) return;
      goToImmediate(nextIdx);
      pageIdx = nextIdx;
      pg = pages[pageIdx];
    }
    try {
      setNarrationLoading(true);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (narrationAnimRef.current) cancelAnimationFrame(narrationAnimRef.current);
      setIsNarrating(false);
      setNarrationProgress(0);

      let textToRead = (pg as Extract<PageContent, { type: "text" }>).text;
      let lastPageIdx = pageIdx;
      if (showDual && pageIdx + 1 < pages.length && pages[pageIdx + 1].type === "text") {
        textToRead += "\n\n" + (pages[pageIdx + 1] as Extract<PageContent, { type: "text" }>).text;
        lastPageIdx = pageIdx + 1;
      }

      const cleanText = stripMarkdown(textToRead).slice(0, 4000);
      const response = await apiRequest("POST", "/api/tts", { text: cleanText, voice: selectedVoice });
      const data = await response.json();
      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
      audioRef.current = audio;

      audio.onended = () => {
        setIsNarrating(false);
        setNarrationProgress(100);
        if (narrationAnimRef.current) cancelAnimationFrame(narrationAnimRef.current);
        if (autoNarRef.current) {
          let nextTextIdx = lastPageIdx + 1;
          while (nextTextIdx < pages.length && pages[nextTextIdx].type !== "text") nextTextIdx++;
          if (nextTextIdx < pages.length) {
            goToImmediate(nextTextIdx);
            setTimeout(() => playPage(nextTextIdx), 600);
          }
        }
      };

      const updateProgress = () => {
        if (audio && audio.duration > 0) setNarrationProgress((audio.currentTime / audio.duration) * 100);
        if (!audio.paused) narrationAnimRef.current = requestAnimationFrame(updateProgress);
      };

      await audio.play();
      setIsNarrating(true);
      setNarrationLoading(false);
      narrationAnimRef.current = requestAnimationFrame(updateProgress);
    } catch (err) {
      console.error("TTS error:", err);
      setNarrationLoading(false);
    }
  }, [pages, selectedVoice, goToImmediate, showDual]);

  const playCurrentPage = useCallback(() => playPage(currentPage), [playPage, currentPage]);

  const toggleNarration = useCallback(() => {
    if (isNarrating && audioRef.current) {
      audioRef.current.pause();
      setIsNarrating(false);
    } else if (audioRef.current && audioRef.current.paused && audioRef.current.currentTime > 0) {
      audioRef.current.play();
      setIsNarrating(true);
      const updateProgress = () => {
        if (audioRef.current && audioRef.current.duration > 0) setNarrationProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        if (audioRef.current && !audioRef.current.paused) narrationAnimRef.current = requestAnimationFrame(updateProgress);
      };
      narrationAnimRef.current = requestAnimationFrame(updateProgress);
    } else {
      playCurrentPage();
    }
  }, [isNarrating, playCurrentPage]);

  const handleClose = useCallback(() => {
    const page = pages[currentPage];
    if ((isNarrating || narrationProgress > 0) && page.type === "text" && onStartNarration && textPages.length > 0) {
      const firstPage = textPages[0];
      onStartNarration({
        bookTitle: title, chapterTitle: firstPage.chapterTitle, chapterNumber: firstPage.chapterNumber,
        pageInChapter: firstPage.pageInChapter, totalPagesInChapter: firstPage.totalPagesInChapter,
        text: firstPage.text, voice: selectedVoice, allPages: textPages, currentPageIndex: 0,
      });
    }
    stopNarration();
    onClose();
  }, [currentPage, pages, isNarrating, narrationProgress, onStartNarration, title, selectedVoice, textPages, stopNarration, onClose]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (narrationAnimRef.current) cancelAnimationFrame(narrationAnimRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") handleClose();
      if ((e.key === "=" || e.key === "+") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); adjustFontSize(1); }
      if (e.key === "-" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); adjustFontSize(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, handleClose, adjustFontSize]);

  const page = pages[currentPage];
  const rightPage = showDual && currentPage + 1 < pages.length ? pages[currentPage + 1] : null;
  const t = THEMES[theme];
  const isDark = theme === "dark" || theme === "midnight";
  const currentSizeIdx = FONT_SIZES.findIndex(s => s.value === fontSize);
  const sizeLabel = FONT_SIZES[currentSizeIdx]?.label || "M";
  const isTextPage = page.type === "text";
  const closeAllPanels = () => { setShowToc(false); setShowSettings(false); setShowNarrator(false); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center select-none" ref={containerRef}>
      <div className={cn("absolute inset-0 backdrop-blur-xl", isDark ? "bg-black/95" : "bg-stone-900/95")} onClick={handleClose} />

      <div className={cn("relative mx-4 h-[92vh] flex flex-col", showDual ? "w-full max-w-6xl" : "w-full max-w-3xl")}>
        <div className="flex items-center justify-between mb-2 px-2 relative z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="ghost"
              onClick={() => { closeAllPanels(); setShowToc(!showToc); }}
              className={cn("h-8 text-xs font-mono", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-toc" aria-label="Table of contents"
            >
              <List className="h-3.5 w-3.5 mr-1" /> TOC
            </Button>

            <div className={cn("flex items-center gap-0.5 rounded-lg border px-1", isDark ? "border-stone-700 bg-stone-800/50" : "border-stone-600 bg-stone-800/50")}>
              <button onClick={() => adjustFontSize(-1)} disabled={currentSizeIdx <= 0}
                className="h-7 w-7 flex items-center justify-center text-stone-400 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Decrease font size" data-testid="button-font-decrease"><Minus className="h-3 w-3" /></button>
              <span className="text-[10px] font-mono text-stone-300 w-7 text-center select-none">{sizeLabel}</span>
              <button onClick={() => adjustFontSize(1)} disabled={currentSizeIdx >= FONT_SIZES.length - 1}
                className="h-7 w-7 flex items-center justify-center text-stone-400 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Increase font size" data-testid="button-font-increase"><Plus className="h-3 w-3" /></button>
            </div>

            <Button size="sm" variant="ghost"
              onClick={() => { closeAllPanels(); setShowSettings(!showSettings); }}
              className={cn("h-8 text-xs font-mono", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-theme" aria-label="Change page theme"
            >
              <Palette className="h-3.5 w-3.5 mr-1" /> Theme
            </Button>

            <Button size="sm" variant="ghost"
              onClick={() => { closeAllPanels(); setShowNarrator(!showNarrator); }}
              className={cn("h-8 text-xs font-mono", isNarrating ? "text-purple-300" : isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-narrator" aria-label="AI Narrator"
            >
              <Volume2 className={cn("h-3.5 w-3.5 mr-1", isNarrating && "animate-pulse")} /> Narrator
            </Button>

            {isLandscape && (
              <Button size="sm" variant="ghost"
                onClick={() => setDualPage(!dualPage)}
                className={cn("h-8 text-xs font-mono", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
                data-testid="button-reader-page-layout" aria-label={dualPage ? "Single page" : "Dual page"}
              >
                {dualPage ? <Square className="h-3.5 w-3.5 mr-1" /> : <Columns2 className="h-3.5 w-3.5 mr-1" />}
                {dualPage ? "1-Page" : "2-Page"}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isTextPage && (isNarrating || narrationLoading) && (
              <div className="flex items-center gap-1.5">
                <button onClick={toggleNarration} disabled={narrationLoading}
                  className="h-7 w-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 hover:bg-purple-500/30 transition-all disabled:opacity-50"
                  data-testid="button-narrator-toggle" aria-label={isNarrating ? "Pause" : "Play"}
                >
                  {narrationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isNarrating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <div className="w-16 h-1 bg-stone-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400 rounded-full transition-all duration-200" style={{ width: `${narrationProgress}%` }} />
                </div>
              </div>
            )}
            <span className={cn("font-mono text-[10px]", "text-stone-500")}>
              {currentPage + 1}{showDual && rightPage ? `–${currentPage + 2}` : ""} / {pages.length}
            </span>
            <Button size="icon" variant="ghost" onClick={handleClose}
              className={cn("h-8 w-8", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-close" aria-label="Close reader"><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {showSettings && (
          <div className={cn("absolute left-0 top-11 z-20 w-64 rounded-xl shadow-2xl p-4", "bg-stone-800 border border-stone-700")}>
            <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-3">Page Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(THEMES) as PageTheme[]).map(key => {
                const th = THEMES[key]; const active = key === theme;
                return (
                  <button key={key} onClick={() => setTheme(key)} data-testid={`theme-${key}`}
                    className={cn("flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all text-[10px] font-mono",
                      active ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-stone-600 hover:border-stone-500 text-stone-400")}>
                    <div className={cn("w-8 h-5 rounded", th.bg)} style={{ backgroundImage: th.gradient }} />
                    {th.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-stone-700">
              <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-2">Font Size</p>
              <div className="flex items-center gap-1">
                {FONT_SIZES.map(s => (
                  <button key={s.value} onClick={() => setFontSize(s.value)} data-testid={`fontsize-${s.label}`}
                    className={cn("flex-1 py-1.5 rounded text-[10px] font-mono transition-all",
                      s.value === fontSize ? "bg-amber-500/20 text-amber-200 border border-amber-500/40" : "text-stone-400 hover:text-stone-300 border border-transparent")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showNarrator && (
          <div className={cn("absolute left-0 top-11 z-20 w-72 rounded-xl shadow-2xl p-4", "bg-stone-800 border border-stone-700")}>
            <div className="flex items-center gap-1.5 mb-3">
              <Volume2 className="h-3 w-3 text-purple-400" />
              <p className="text-[10px] font-mono text-purple-400/80 uppercase tracking-wider">AI Narrator</p>
            </div>
            <p className="text-[10px] text-stone-400 mb-3">Choose a voice, then hit play. Narrator auto-turns pages when done.</p>
            <div className="space-y-1.5 mb-3">
              {VOICE_OPTIONS.map(v => (
                <button key={v.value} onClick={() => { setSelectedVoice(v.value); stopNarration(); }} data-testid={`voice-${v.value}`}
                  className={cn("w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between",
                    v.value === selectedVoice ? "border-purple-500/40 bg-purple-500/10 text-purple-200" : "border-stone-600 hover:border-stone-500 text-stone-400")}>
                  <div>
                    <span className="text-[11px] font-mono font-bold">{v.label}</span>
                    <span className="text-[9px] text-stone-500 ml-2">{v.description}</span>
                  </div>
                  {v.value === selectedVoice && <span className="text-purple-400 text-[10px]">●</span>}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 mb-3 cursor-pointer group">
              <input type="checkbox" checked={autoNarrate} onChange={e => setAutoNarrate(e.target.checked)}
                className="accent-purple-500 w-3.5 h-3.5" data-testid="checkbox-auto-narrate" />
              <span className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Auto-read next page</span>
            </label>
            {isTextPage ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={playCurrentPage} disabled={narrationLoading}
                  className="flex-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[11px] font-mono h-8"
                  data-testid="button-narrator-play">
                  {narrationLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Play className="h-3 w-3 mr-1.5" />}
                  {narrationLoading ? "Generating..." : "Read This Page"}
                </Button>
                {isNarrating && (
                  <Button size="icon" variant="ghost" onClick={stopNarration}
                    className="h-8 w-8 text-stone-400 hover:text-red-400"
                    data-testid="button-narrator-stop" aria-label="Stop narration"><X className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-stone-500 italic text-center">Navigate to a text page to enable narration</p>
            )}
          </div>
        )}

        {showToc && (
          <div className={cn("absolute left-0 top-11 z-20 w-72 rounded-xl shadow-2xl p-4 max-h-[60vh] overflow-y-auto", "bg-stone-800 border border-stone-700")}>
            <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-3">Jump to</p>
            {pages.map((p, i) => {
              let label = "";
              if (p.type === "cover") label = "Cover";
              else if (p.type === "toc") label = "Table of Contents";
              else if (p.type === "chapter-title") label = `Ch ${p.chapterNumber}: ${p.chapterTitle}`;
              else return null;
              return (
                <button key={i} onClick={() => { goTo(i); setShowToc(false); }}
                  className={cn("w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors font-serif",
                    i === currentPage ? "bg-amber-900/30 text-amber-200" : "text-stone-300 hover:bg-stone-700")}
                  data-testid={`button-reader-jump-${i}`}>{label}</button>
              );
            })}
          </div>
        )}

        <div className="flex-1 flex items-stretch relative min-h-0">
          <button onClick={prev} disabled={currentPage === 0}
            className={cn("absolute left-0 top-0 bottom-0 w-12 sm:w-16 z-10 flex items-center justify-center disabled:opacity-0 transition-all duration-200 -ml-12 sm:-ml-14",
              isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-500 hover:text-white")}
            aria-label="Previous page" data-testid="button-reader-prev"><ChevronLeft className="h-8 w-8" /></button>

          <div className="flex-1 relative min-h-0">
            {showDual ? (
              <div className="absolute inset-0 flex gap-0">
                <div className="flex-1 h-full relative">
                  <BookPage page={page} theme={theme} fontSize={fontSize} side="left"
                    pageNum={currentPage + 1} totalPages={pages.length}
                    isFlipping={isFlipping} flipDir={flipDirection} />
                </div>
                <div className="w-[3px] relative z-10" style={{
                  background: isDark
                    ? "linear-gradient(to right, rgba(0,0,0,0.6), rgba(255,255,255,0.02), rgba(0,0,0,0.6))"
                    : "linear-gradient(to right, rgba(0,0,0,0.15), rgba(255,255,255,0.3), rgba(0,0,0,0.15))",
                  boxShadow: isDark ? "0 0 12px rgba(0,0,0,0.4)" : "0 0 8px rgba(0,0,0,0.1)",
                }} />
                <div className="flex-1 h-full relative">
                  {rightPage ? (
                    <BookPage page={rightPage} theme={theme} fontSize={fontSize} side="right"
                      pageNum={currentPage + 2} totalPages={pages.length}
                      isFlipping={false} flipDir="right" />
                  ) : (
                    <div className={cn("h-full rounded-r-lg", t.bg, isDark ? "opacity-30" : "opacity-50")} style={{ backgroundImage: t.gradient }} />
                  )}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0">
                <BookPage page={page} theme={theme} fontSize={fontSize} side="center"
                  pageNum={currentPage + 1} totalPages={pages.length}
                  isFlipping={isFlipping} flipDir={flipDirection} />
              </div>
            )}
          </div>

          <button onClick={next} disabled={showDual ? currentPage + 2 >= pages.length : currentPage === pages.length - 1}
            className={cn("absolute right-0 top-0 bottom-0 w-12 sm:w-16 z-10 flex items-center justify-center disabled:opacity-0 transition-all duration-200 -mr-12 sm:-mr-14",
              isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-500 hover:text-white")}
            aria-label="Next page" data-testid="button-reader-next"><ChevronRight className="h-8 w-8" /></button>
        </div>

        <div className="flex justify-center gap-1 mt-2 px-2">
          {pages.length <= 40 ? (
            pages.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className={cn("h-1 rounded-full transition-all duration-200",
                  i === currentPage || (showDual && i === currentPage + 1) ? "w-6 bg-amber-400" : "w-1.5 bg-stone-600 hover:bg-stone-400")}
                aria-label={`Go to page ${i + 1}`} />
            ))
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-1 rounded-full bg-stone-700 flex-1 max-w-48 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 bg-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }} />
              </div>
              <span className="text-stone-500 font-mono text-[10px]">{Math.round(((currentPage + 1) / pages.length) * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
