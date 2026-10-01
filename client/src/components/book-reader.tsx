import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, List, Minus, Plus, Palette, Volume2, Loader2, Play, Pause, RotateCcw, RefreshCw, SkipForward, Columns2, Square, Repeat, Bookmark, BookMarked, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarkdownRenderer, stripMarkdown } from "@/components/markdown-renderer";
import { VOICE_OPTIONS, DEFAULT_VOICE_ID, isFishAudioVoice, type NarratorVoice, type NarrationState } from "@/components/audio-mini-player";
import { useNarration } from "@/App";
import { useToast } from "@/hooks/use-toast";
import type { Chapter } from "@shared/schema";
import { isBrowserVoice, browserTTSSpeak, browserTTSStop, getBrowserVoices, getDefaultBrowserVoice, type BrowserVoiceOption } from "@/lib/browser-tts";
import { buildCumulativeWeights, wordIndexFromProgress } from "@/lib/word-timing";

interface BookReaderProps {
  title: string;
  authorName: string;
  chapters: Chapter[];
  coverImageUrl?: string | null;
  projectId?: number;
  onClose: () => void;
  onStartNarration?: (narration: NarrationState) => void;
}

type PageContent =
  | { type: "cover"; title: string; author: string; coverUrl?: string | null }
  | { type: "toc"; chapters: { number: number; title: string }[] }
  | { type: "intro"; title: string; author: string; chapterCount: number }
  | { type: "chapter-title"; chapterNumber: number; chapterTitle: string }
  | { type: "text"; chapterNumber: number; chapterTitle: string; text: string; pageInChapter: number; totalPagesInChapter: number; chapterId: number }
  | { type: "outro"; title: string; author: string };

interface ReaderBookmark {
  id: number;
  kind: "bookmark" | "progress";
  page_index: number;
  chapter_number: number | null;
  chapter_title: string | null;
  page_in_chapter: number | null;
  label: string | null;
  created_at: string;
  updated_at: string;
}

interface ReadingState {
  projectId: number;
  progress: ReaderBookmark | null;
  bookmarks: ReaderBookmark[];
}

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
  pages.push({ type: "intro", title, author: authorName, chapterCount: chapters.length });
  const linesPerPage = linesForFontSize(fontSize);
  const charsPerLine = Math.max(40, Math.round(80 * (16 / fontSize)));
  for (const ch of chapters) {
    pages.push({ type: "chapter-title", chapterNumber: ch.chapterNumber, chapterTitle: ch.title });
    if (ch.content) {
      const textPages = splitTextIntoPages(ch.content, linesPerPage, charsPerLine);
      textPages.forEach((text, i) => {
        pages.push({ type: "text", chapterNumber: ch.chapterNumber, chapterTitle: ch.title, text, pageInChapter: i + 1, totalPagesInChapter: textPages.length, chapterId: ch.id });
      });
    }
  }
  pages.push({ type: "outro", title, author: authorName });
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

function IntroPage({ page, theme }: { page: Extract<PageContent, { type: "intro" }>; theme: PageTheme }) {
  const t = THEMES[theme];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={cn("w-20 h-[2px] mb-6 rounded-full", t.divider)} />
      <h1 className={cn("font-serif text-2xl md:text-3xl font-bold leading-tight mb-4", t.heading)}>{page.title}</h1>
      <div className={cn("w-12 h-[1px] mb-4 rounded-full", t.divider)} />
      <p className={cn("font-serif text-base italic mb-6", t.accent)}>Written by {page.author}</p>
      <p className={cn("font-serif text-sm mb-2", t.text)}>{page.chapterCount} {page.chapterCount === 1 ? "Chapter" : "Chapters"}</p>
      <div className={cn("w-8 h-[1px] my-6 rounded-full", t.divider)} />
      <p className={cn("font-mono text-[10px] uppercase tracking-[0.25em]", t.accent)}>Narrated on Lexora</p>
    </div>
  );
}

function OutroPage({ page, theme }: { page: Extract<PageContent, { type: "outro" }>; theme: PageTheme }) {
  const t = THEMES[theme];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className={cn("w-20 h-[2px] mb-8 rounded-full", t.divider)} />
      <p className={cn("font-serif text-lg italic mb-4", t.text)}>Thank you for listening.</p>
      <div className={cn("w-12 h-[1px] mb-6 rounded-full", t.divider)} />
      <h2 className={cn("font-serif text-xl font-bold mb-2", t.heading)}>{page.title}</h2>
      <p className={cn("font-serif text-sm italic mb-6", t.accent)}>by {page.author}</p>
      <div className={cn("w-8 h-[1px] my-4 rounded-full", t.divider)} />
      <p className={cn("font-mono text-[10px] uppercase tracking-[0.25em] mb-1", t.accent)}>Produced &amp; narrated on</p>
      <p className={cn("font-serif text-lg font-bold tracking-wide", t.heading)}>Lexora</p>
      <p className={cn("font-mono text-[9px] uppercase tracking-[0.3em] mt-4", t.accent)}>AI Publishing Platform</p>
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

function TextPage({ page, theme, fontSize, highlightWordIndex }: { page: Extract<PageContent, { type: "text" }>; theme: PageTheme; fontSize: number; highlightWordIndex?: number }) {
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
        {highlightWordIndex !== undefined && highlightWordIndex >= 0 ? (
          <HighlightedTextRenderer content={page.text} theme={theme} wordIndex={highlightWordIndex} />
        ) : (
          isDark ? <DarkMarkdownRenderer content={page.text} theme={theme} /> : <MarkdownRenderer content={page.text} />
        )}
      </div>
    </div>
  );
}

function HighlightedTextRenderer({ content, theme, wordIndex }: { content: string; theme: PageTheme; wordIndex: number }) {
  const t = THEMES[theme];
  const isDark = theme === "dark" || theme === "midnight";
  const hlClass = isDark
    ? "bg-purple-500/40 text-purple-100 rounded px-0.5 shadow-[0_0_0_1px_rgba(168,85,247,0.4)] transition-all duration-100"
    : "bg-violet-200/80 text-violet-900 rounded px-0.5 shadow-[0_0_0_1px_rgba(139,92,246,0.3)] transition-all duration-100";
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  let globalWordCounter = 0;
  const highlightRef = useRef<HTMLSpanElement>(null);
  const lastScrollIdx = useRef(-1);

  useEffect(() => {
    if (!highlightRef.current) return;
    if (wordIndex !== lastScrollIdx.current) {
      lastScrollIdx.current = wordIndex;
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [wordIndex]);

  return (
    <div>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (trimmed.startsWith("# ")) {
          const text = trimmed.replace(/^#+\s*/, "");
          const words = text.split(/(\s+)/);
          const el = <h2 key={i} className={cn("font-serif text-xl font-bold mt-4 mb-3", t.heading)}>{words.map((w, j) => {
            if (/^\s+$/.test(w)) return w;
            const idx = globalWordCounter++;
            return <span key={j} ref={idx === wordIndex ? highlightRef : undefined} className={idx === wordIndex ? hlClass : undefined}>{w}</span>;
          })}</h2>;
          return el;
        }
        if (trimmed.startsWith("## ")) {
          const text = trimmed.replace(/^#+\s*/, "");
          const words = text.split(/(\s+)/);
          const el = <h3 key={i} className={cn("font-serif text-lg font-bold mt-3 mb-2", t.heading)}>{words.map((w, j) => {
            if (/^\s+$/.test(w)) return w;
            const idx = globalWordCounter++;
            return <span key={j} ref={idx === wordIndex ? highlightRef : undefined} className={idx === wordIndex ? hlClass : undefined}>{w}</span>;
          })}</h3>;
          return el;
        }
        if (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) {
          const text = trimmed.replace(/^#+\s*/, "");
          const words = text.split(/(\s+)/);
          const el = <h4 key={i} className={cn("font-serif text-base font-bold mt-3 mb-2", t.heading)}>{words.map((w, j) => {
            if (/^\s+$/.test(w)) return w;
            const idx = globalWordCounter++;
            return <span key={j} ref={idx === wordIndex ? highlightRef : undefined} className={idx === wordIndex ? hlClass : undefined}>{w}</span>;
          })}</h4>;
          return el;
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n/).filter(l => l.trim());
          return <ul key={i} className="list-disc pl-5 mb-3 space-y-1">{items.map((item, j) => {
            const cleanItem = item.replace(/^[-*]\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*([^*]+?)\*/g, "$1");
            const words = cleanItem.split(/(\s+)/);
            return <li key={j} className={cn("font-serif leading-relaxed", isDark ? t.text : "")}>{words.map((w, k) => {
              if (/^\s+$/.test(w)) return w;
              const idx = globalWordCounter++;
              return <span key={k} ref={idx === wordIndex ? highlightRef : undefined} className={idx === wordIndex ? hlClass : undefined}>{w}</span>;
            })}</li>;
          })}</ul>;
        }
        if (trimmed.startsWith(">")) {
          const quoteText = trimmed.split("\n").map(l => l.replace(/^>\s*/, "")).join(" ");
          const words = quoteText.split(/(\s+)/);
          return <blockquote key={i} className={cn("border-l-2 pl-4 my-3 italic font-serif leading-relaxed", t.accent, t.divider.replace("bg-", "border-"))}>{words.map((w, j) => {
            if (/^\s+$/.test(w)) return w;
            const idx = globalWordCounter++;
            return <span key={j} ref={idx === wordIndex ? highlightRef : undefined} className={idx === wordIndex ? hlClass : undefined}>{w}</span>;
          })}</blockquote>;
        }
        if (/^[-*]{3,}$/.test(trimmed)) return <div key={i} className={cn("w-12 h-[1px] mx-auto my-4", t.divider)} />;
        const cleanText = trimmed.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*([^*]+?)\*/g, "$1");
        const words = cleanText.split(/(\s+)/);
        return <p key={i} className={cn("font-serif leading-[1.9] mb-3 text-justify indent-6", isDark ? t.text : "")}>{words.map((w, j) => {
          if (/^\s+$/.test(w)) return w;
          const idx = globalWordCounter++;
          return <span key={j} ref={idx === wordIndex ? highlightRef : undefined} className={idx === wordIndex ? hlClass : undefined}>{w}</span>;
        })}</p>;
      })}
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
          return <ul key={i} className="list-disc pl-5 mb-3 space-y-1">{items.map((item, j) => <li key={j} className={cn("font-serif leading-relaxed", t.text)}>{item.replace(/^[-*]\s*/, "")}</li>)}</ul>;
        }
        if (trimmed.startsWith(">")) {
          const quoteText = trimmed.split("\n").map(l => l.replace(/^>\s*/, "")).join(" ");
          return <blockquote key={i} className={cn("border-l-2 pl-4 my-3 italic font-serif leading-relaxed", t.accent, t.divider.replace("bg-", "border-"))}>{quoteText}</blockquote>;
        }
        if (/^[-*]{3,}$/.test(trimmed)) return <div key={i} className={cn("w-12 h-[1px] mx-auto my-4", t.divider)} />;
        return <p key={i} className={cn("font-serif leading-[1.9] mb-3 text-justify indent-6", t.text)}>{trimmed.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*([^*]+?)\*/g, "$1")}</p>;
      })}
    </div>
  );
}

function renderPage(page: PageContent, theme: PageTheme, fontSize: number, highlightWordIndex?: number) {
  if (page.type === "cover") return <CoverPage page={page} theme={theme} />;
  if (page.type === "toc") return <TocPage page={page} theme={theme} fontSize={fontSize} />;
  if (page.type === "intro") return <IntroPage page={page} theme={theme} />;
  if (page.type === "chapter-title") return <ChapterTitlePage page={page} theme={theme} />;
  if (page.type === "text") return <TextPage page={page} theme={theme} fontSize={fontSize} highlightWordIndex={highlightWordIndex} />;
  if (page.type === "outro") return <OutroPage page={page} theme={theme} />;
  return null;
}

function BookPage({ page, theme, fontSize, side, pageNum, totalPages, isFlipping, flipDir, highlightWordIndex }: {
  page: PageContent; theme: PageTheme; fontSize: number; side: "left" | "right" | "center"; highlightWordIndex?: number;
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
        {renderPage(page, theme, fontSize, highlightWordIndex)}
      </div>
      <PageNumber pageNum={pageNum} total={totalPages} theme={theme} side={side === "center" ? "center" : side} />
    </div>
  );
}

export default function BookReader({ title, authorName, chapters, coverImageUrl, projectId, onClose, onStartNarration }: BookReaderProps) {
  const { toast } = useToast();
  const completedChapters = chapters.filter(c => c.status === "complete" && c.content);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"left" | "right">("right");
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const [readingStateLoaded, setReadingStateLoaded] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
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
  const [selectedVoice, setSelectedVoice] = useState<NarratorVoice>(DEFAULT_VOICE_ID);
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [narrationProgress, setNarrationProgress] = useState(0);
  const [autoNarrate, setAutoNarrate] = useState(false);
  const [dualPage, setDualPage] = useState(true);
  const [readerWordIndex, setReaderWordIndex] = useState(-1);
  const [narratedPageIdx, setNarratedPageIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAnimRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoNarRef = useRef(false);
  const readerWordCountRef = useRef(0);
  const cumulWeightsRef = useRef<Float32Array>(new Float32Array([0]));
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const browserTTSRef = useRef<ReturnType<typeof browserTTSSpeak> | null>(null);
  const [browserVoiceList, setBrowserVoiceList] = useState<BrowserVoiceOption[]>([]);
  const [readerUsingFallback, setReaderUsingFallback] = useState(false);
  const stickyFallbackVoiceRef = useRef<string | null>(null);
  const isLandscape = useIsLandscape();
  const showDual = isLandscape && dualPage;
  const { navigateToPageRequest, clearNavigateRequest, currentWordIndex: miniPlayerWordIndex, narrationState: miniNarration } = useNarration();

  const pages = useMemo(
    () => buildPages(title, authorName, completedChapters, coverImageUrl, fontSize),
    [title, authorName, completedChapters, coverImageUrl, fontSize]
  );

  const textPages = useMemo(() => {
    const result: { chapterNumber: number; chapterTitle: string; pageInChapter: number; totalPagesInChapter: number; text: string; globalPageIndex: number; chapterId?: number }[] = [];
    pages.forEach((p, idx) => {
      if (p.type === "intro") {
        result.push({ chapterNumber: 0, chapterTitle: "Introduction", pageInChapter: 1, totalPagesInChapter: 1, text: `${p.title}. Written by ${p.author}. ${p.chapterCount} ${p.chapterCount === 1 ? "chapter" : "chapters"}. Narrated on Lexora.`, globalPageIndex: idx });
      } else if (p.type === "outro") {
        result.push({ chapterNumber: 999, chapterTitle: "Thank You", pageInChapter: 1, totalPagesInChapter: 1, text: `Thank you for listening to ${p.title}, by ${p.author}. This audiobook was produced and narrated on Lexora, an AI publishing platform. We hope you enjoyed the journey.`, globalPageIndex: idx });
      } else if (p.type === "text") {
        const tp = p as Extract<PageContent, { type: "text" }>;
        result.push({ chapterNumber: tp.chapterNumber, chapterTitle: tp.chapterTitle, pageInChapter: tp.pageInChapter, totalPagesInChapter: tp.totalPagesInChapter, text: tp.text, globalPageIndex: idx, chapterId: tp.chapterId });
      }
    });
    return result;
  }, [pages]);

  const resolveBookmarkPage = useCallback((saved: ReaderBookmark | null | undefined) => {
    if (!saved || pages.length === 0) return 0;
    if (saved.chapter_number != null) {
      if (saved.page_in_chapter != null) {
        const exact = pages.findIndex((candidate) =>
          candidate.type === "text" &&
          candidate.chapterNumber === saved.chapter_number &&
          candidate.pageInChapter === saved.page_in_chapter,
        );
        if (exact >= 0) return exact;
      }
      const chapterStart = pages.findIndex((candidate) =>
        (candidate.type === "chapter-title" || candidate.type === "text") &&
        candidate.chapterNumber === saved.chapter_number,
      );
      if (chapterStart >= 0) return chapterStart;
    }
    return Math.max(0, Math.min(saved.page_index || 0, pages.length - 1));
  }, [pages]);

  const pageReadingMeta = useCallback((pageIndex: number) => {
    const current = pages[pageIndex];
    if (!current) return { chapterNumber: null, chapterTitle: null, pageInChapter: null };
    if (current.type === "text") {
      return {
        chapterNumber: current.chapterNumber,
        chapterTitle: current.chapterTitle,
        pageInChapter: current.pageInChapter,
      };
    }
    if (current.type === "chapter-title") {
      return {
        chapterNumber: current.chapterNumber,
        chapterTitle: current.chapterTitle,
        pageInChapter: 1,
      };
    }
    return { chapterNumber: null, chapterTitle: null, pageInChapter: null };
  }, [pages]);

  useEffect(() => {
    if (!projectId || pages.length === 0) {
      setReadingStateLoaded(true);
      return;
    }
    let cancelled = false;
    setReadingStateLoaded(false);
    fetch(`/api/reader/books/${projectId}/reading-state`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Reading state unavailable");
        return res.json() as Promise<ReadingState>;
      })
      .then((state) => {
        if (cancelled) return;
        setBookmarks(Array.isArray(state.bookmarks) ? state.bookmarks : []);
        if (state.progress) setCurrentPage(resolveBookmarkPage(state.progress));
      })
      .catch(() => {
        // Reading still works when persistence is unavailable.
      })
      .finally(() => {
        if (!cancelled) setReadingStateLoaded(true);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !readingStateLoaded || pages.length === 0) return;
    const meta = pageReadingMeta(currentPage);
    const timer = window.setTimeout(() => {
      fetch(`/api/reader/books/${projectId}/progress`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          pageIndex: currentPage,
          chapterNumber: meta.chapterNumber,
          chapterTitle: meta.chapterTitle,
          pageInChapter: meta.pageInChapter,
        }),
      }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [projectId, currentPage, readingStateLoaded, pageReadingMeta, pages.length]);

  const currentBookmark = useMemo(
    () => bookmarks.find((saved) => resolveBookmarkPage(saved) === currentPage) || null,
    [bookmarks, currentPage, resolveBookmarkPage],
  );

  const toggleCurrentBookmark = useCallback(async () => {
    if (!projectId || bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      if (currentBookmark) {
        const res = await fetch(`/api/reader/books/${projectId}/bookmarks/${currentBookmark.id}`, {
          method: "DELETE",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Could not remove bookmark");
        setBookmarks((items) => items.filter((item) => item.id !== currentBookmark.id));
        toast({ title: "Bookmark removed" });
      } else {
        const meta = pageReadingMeta(currentPage);
        const label = meta.chapterTitle
          ? `${meta.chapterTitle}${meta.pageInChapter ? ` · page ${meta.pageInChapter}` : ""}`
          : `Page ${currentPage + 1}`;
        const res = await fetch(`/api/reader/books/${projectId}/bookmarks`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            pageIndex: currentPage,
            chapterNumber: meta.chapterNumber,
            chapterTitle: meta.chapterTitle,
            pageInChapter: meta.pageInChapter,
            label,
          }),
        });
        if (!res.ok) throw new Error("Could not save bookmark");
        const saved = await res.json() as ReaderBookmark;
        setBookmarks((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
        toast({ title: "Page bookmarked", description: label });
      }
    } catch (error: any) {
      toast({ title: "Bookmark failed", description: error.message, variant: "destructive" });
    } finally {
      setBookmarkBusy(false);
    }
  }, [projectId, bookmarkBusy, currentBookmark, currentPage, pageReadingMeta, toast]);

  const removeBookmark = useCallback(async (bookmark: ReaderBookmark) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/reader/books/${projectId}/bookmarks/${bookmark.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Could not remove bookmark");
      setBookmarks((items) => items.filter((item) => item.id !== bookmark.id));
    } catch (error: any) {
      toast({ title: "Bookmark failed", description: error.message, variant: "destructive" });
    }
  }, [projectId, toast]);

  useEffect(() => { autoNarRef.current = autoNarrate; }, [autoNarrate]);

  useEffect(() => {
    const loadVoices = () => setBrowserVoiceList(getBrowserVoices());
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem("bookforge-reader-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem("bookforge-reader-fontsize", String(fontSize)); } catch {}
  }, [fontSize]);

  useEffect(() => {
    if (currentPage >= pages.length) setCurrentPage(Math.max(0, pages.length - 1));
  }, [pages.length, currentPage]);

  useEffect(() => {
    if (navigateToPageRequest !== null) {
      if (navigateToPageRequest >= 0 && navigateToPageRequest < pages.length) {
        setCurrentPage(navigateToPageRequest);
      }
      clearNavigateRequest();
    }
  }, [navigateToPageRequest, pages.length, clearNavigateRequest]);

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

  const stopNarration = useCallback((clearFallback = true) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (browserTTSRef.current) { browserTTSRef.current.stop(); browserTTSRef.current = null; }
    browserTTSStop();
    if (narrationAnimRef.current) cancelAnimationFrame(narrationAnimRef.current);
    setIsNarrating(false);
    setNarrationProgress(0);
    setReaderWordIndex(-1);
    setNarratedPageIdx(-1);
    if (clearFallback) {
      setReaderUsingFallback(false);
      stickyFallbackVoiceRef.current = null;
    }
  }, []);

  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const getPageNarrationText = useCallback((pg: PageContent): string | null => {
    if (pg.type === "intro") {
      return `${pg.title}. Written by ${pg.author}. ${pg.chapterCount} ${pg.chapterCount === 1 ? "chapter" : "chapters"}. Narrated on Lexora.`;
    }
    if (pg.type === "outro") {
      return `Thank you for listening to ${pg.title}, by ${pg.author}. This audiobook was produced and narrated on Lexora, an AI publishing platform. We hope you enjoyed the journey.`;
    }
    if (pg.type === "text") return stripMarkdown(pg.text).slice(0, 4000);
    return null;
  }, []);

  const getPageText = useCallback((pageIdx: number): { text: string; lastIdx: number } | null => {
    let pg = pages[pageIdx];
    if (pg.type === "intro" || pg.type === "outro") {
      const narration = getPageNarrationText(pg);
      return narration ? { text: narration, lastIdx: pageIdx } : null;
    }
    if (pg.type !== "text") {
      let nextIdx = pageIdx + 1;
      while (nextIdx < pages.length && pages[nextIdx].type !== "text" && pages[nextIdx].type !== "intro" && pages[nextIdx].type !== "outro") nextIdx++;
      if (nextIdx >= pages.length) return null;
      pg = pages[nextIdx];
      pageIdx = nextIdx;
      if (pg.type === "intro" || pg.type === "outro") {
        const narration = getPageNarrationText(pg);
        return narration ? { text: narration, lastIdx: pageIdx } : null;
      }
    }
    let textToRead = (pg as Extract<PageContent, { type: "text" }>).text;
    let lastIdx = pageIdx;
    if (showDual && pageIdx + 1 < pages.length && pages[pageIdx + 1].type === "text") {
      textToRead += "\n\n" + (pages[pageIdx + 1] as Extract<PageContent, { type: "text" }>).text;
      lastIdx = pageIdx + 1;
    }
    return { text: stripMarkdown(textToRead).slice(0, 4000), lastIdx };
  }, [pages, showDual, getPageNarrationText]);

  const pageAudioContext = useCallback((pageIdx: number) => {
    const pg = pages[pageIdx];
    if (!projectId || !pg || pg.type !== "text") return undefined;
    return { projectId, chapterId: pg.chapterId, pageIndex: Math.max(0, pg.pageInChapter - 1) };
  }, [pages, projectId]);

  const fetchAudio = useCallback(async (text: string, voice: NarratorVoice, ctx?: { projectId: number; chapterId: number; pageIndex: number }, regenerate = false): Promise<string> => {
    const cacheKey = `fish-s2.1-pro-v1:${voice}:${text.slice(0, 100)}:${text.length}`;
    if (regenerate) audioCacheRef.current.delete(cacheKey);
    const cached = audioCacheRef.current.get(cacheKey);
    if (!regenerate && cached) return cached;
    const endpoint = isFishAudioVoice(voice) ? "/api/fish-tts" : "/api/tts";

    let response: Response | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, regenerate, ...(ctx || {}) }),
        });
        if (response.ok) break;
        lastError = await response.text().catch(() => "Unknown error");
        if (response.status < 500 && response.status !== 429) break;
      } catch (err: any) {
        lastError = err?.message || "Network error";
      }
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 750));
    }
    if (!response?.ok) {
      throw new Error(`TTS request failed${response ? ` (${response.status})` : ""}: ${lastError || "Unknown error"}`);
    }
    const data = await response.json();
    if (!data.audio || typeof data.audio !== "string" || data.audio.length < 100) {
      throw new Error("Received empty or invalid audio data from server");
    }
    const dataUrl = `data:audio/mp3;base64,${data.audio}`;
    audioCacheRef.current.set(cacheKey, dataUrl);
    if (audioCacheRef.current.size > 20) {
      const firstKey = audioCacheRef.current.keys().next().value;
      if (firstKey) audioCacheRef.current.delete(firstKey);
    }
    return dataUrl;
  }, []);

  const isNarratablePage = useCallback((pg: PageContent) => pg.type === "text" || pg.type === "intro" || pg.type === "outro", []);

  const prefetchNext = useCallback((afterIdx: number) => {
    let nextIdx = afterIdx + 1;
    while (nextIdx < pages.length && !isNarratablePage(pages[nextIdx])) nextIdx++;
    if (nextIdx >= pages.length) return;
    const nextData = getPageText(nextIdx);
    if (nextData) {
      fetchAudio(nextData.text, selectedVoice, pageAudioContext(nextIdx)).catch(() => {});
    }
  }, [pages, getPageText, fetchAudio, selectedVoice, isNarratablePage, pageAudioContext]);

  const playPageRef = useRef<(pageIdx: number) => Promise<void>>();

  const startBrowserNarration = useCallback((text: string, wordCount: number, lastPageIdx: number, pageIdx: number, overrideVoice?: string) => {
    const voiceToUse = overrideVoice || selectedVoice;
    const controls = browserTTSSpeak(text, voiceToUse, 1, {
      onWordIndex: (idx) => setReaderWordIndex(idx),
      onProgress: (pct) => setNarrationProgress(pct),
      onEnd: () => {
        setIsNarrating(false);
        setNarrationProgress(100);
        setReaderWordIndex(wordCount - 1);
        browserTTSRef.current = null;
        if (autoNarRef.current) {
          setReaderWordIndex(-1);
          let nextTextIdx = lastPageIdx + 1;
          while (nextTextIdx < pages.length && !isNarratablePage(pages[nextTextIdx])) nextTextIdx++;
          if (nextTextIdx < pages.length) {
            goToImmediate(nextTextIdx);
            setTimeout(() => {
              if (playPageRef.current) playPageRef.current(nextTextIdx);
            }, 400);
          }
        }
      },
      onError: (err) => {
        console.error("Browser TTS error:", err);
        setIsNarrating(false);
        setNarrationLoading(false);
        setNarrationProgress(0);
        browserTTSRef.current = null;
      },
    });
    browserTTSRef.current = controls;
    setIsNarrating(true);
    setNarrationLoading(false);
  }, [selectedVoice, pages, goToImmediate, isNarratablePage]);

  const playPage = useCallback(async (pageIdx: number, regenerate = false) => {
    const pageData = getPageText(pageIdx);
    if (!pageData) {
      toast({ title: "Cannot narrate this page", description: "No readable text found on this page.", variant: "destructive" });
      return;
    }
    if (!isNarratablePage(pages[pageIdx])) {
      let nextIdx = pageIdx + 1;
      while (nextIdx < pages.length && !isNarratablePage(pages[nextIdx])) nextIdx++;
      if (nextIdx < pages.length) {
        goToImmediate(nextIdx);
        pageIdx = nextIdx;
      }
    }
    const { text: cleanText, lastIdx: lastPageIdx } = pageData;
    try {
      setNarrationLoading(true);
      if (!stickyFallbackVoiceRef.current) setReaderUsingFallback(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (browserTTSRef.current) { browserTTSRef.current.stop(); browserTTSRef.current = null; }
      browserTTSStop();
      if (narrationAnimRef.current) cancelAnimationFrame(narrationAnimRef.current);
      setIsNarrating(false);
      setNarrationProgress(0);
      setReaderWordIndex(-1);
      setNarratedPageIdx(pageIdx);

      const strippedText = stripMarkdown(cleanText).slice(0, 4000);
      const strippedWords = strippedText.split(/\s+/).filter(Boolean);
      const wordCount = strippedWords.length;
      readerWordCountRef.current = wordCount;
      cumulWeightsRef.current = buildCumulativeWeights(strippedWords);

      if (wordCount === 0) {
        setNarrationLoading(false);
        toast({ title: "Nothing to narrate", description: "This page has no readable text content." });
        return;
      }

      if (isBrowserVoice(selectedVoice)) {
        startBrowserNarration(strippedText, wordCount, lastPageIdx, pageIdx);
        return;
      }

      let audioDataUrl: string;
      try {
        audioDataUrl = await fetchAudio(cleanText, selectedVoice, pageAudioContext(pageIdx), regenerate);
        stickyFallbackVoiceRef.current = null;
        setReaderUsingFallback(false);
      } catch (fetchErr: any) {
        console.warn("AI TTS failed in reader, falling back for this page only:", fetchErr.message);
        const fallbackVoice = getDefaultBrowserVoice();
        if (fallbackVoice) {
          setReaderUsingFallback(true);
          toast({ title: "Narration recovered", description: "Premium narration failed for this page. Lexora will use a device voice here and retry the premium voice on the next page." });
          startBrowserNarration(strippedText, wordCount, lastPageIdx, pageIdx, fallbackVoice.id);
          return;
        }
        throw fetchErr;
      }

      const audio = new Audio(audioDataUrl);
      audioRef.current = audio;

      prefetchNext(lastPageIdx);

      audio.onerror = () => {
        console.error("Audio playback error");
        setIsNarrating(false);
        setNarrationLoading(false);
        setNarrationProgress(0);
        toast({ title: "Playback error", description: "Failed to play the generated audio. Try again.", variant: "destructive" });
      };

      audio.onended = () => {
        setIsNarrating(false);
        setNarrationProgress(100);
        setReaderWordIndex(wordCount - 1);
        if (narrationAnimRef.current) cancelAnimationFrame(narrationAnimRef.current);
        if (autoNarRef.current) {
          setReaderWordIndex(-1);
          let nextTextIdx = lastPageIdx + 1;
          while (nextTextIdx < pages.length && !isNarratablePage(pages[nextTextIdx])) nextTextIdx++;
          if (nextTextIdx < pages.length) {
            goToImmediate(nextTextIdx);
            setTimeout(() => {
              if (playPageRef.current) playPageRef.current(nextTextIdx);
            }, 400);
          }
        }
      };

      const cumul = cumulWeightsRef.current;
      const updateProgress = () => {
        if (audio && audio.duration > 0) {
          const pct = audio.currentTime / audio.duration;
          setNarrationProgress(pct * 100);
          setReaderWordIndex(wordIndexFromProgress(pct, cumul));
        }
        if (!audio.paused) narrationAnimRef.current = requestAnimationFrame(updateProgress);
      };

      await audio.play();
      setIsNarrating(true);
      setNarrationLoading(false);
      narrationAnimRef.current = requestAnimationFrame(updateProgress);
    } catch (err: any) {
      console.error("TTS error:", err);
      setIsNarrating(false);
      setNarrationLoading(false);
      setNarrationProgress(0);
      toast({ title: "Narration failed", description: err?.message || "Could not generate or play audio. Please try again.", variant: "destructive" });
    }
  }, [pages, selectedVoice, goToImmediate, showDual, getPageText, fetchAudio, prefetchNext, isNarratablePage, toast, startBrowserNarration]);

  useEffect(() => { playPageRef.current = playPage; }, [playPage]);

  const playCurrentPage = useCallback(() => playPage(currentPage), [playPage, currentPage]);

  const regenerateCurrentPage = useCallback(() => {
    stickyFallbackVoiceRef.current = null;
    setReaderUsingFallback(false);
    stopNarration();
    void playPage(currentPage, true);
  }, [playPage, currentPage, stopNarration]);

  const toggleNarration = useCallback(() => {
    if (browserTTSRef.current) {
      if (isNarrating) {
        browserTTSRef.current.pause();
        setIsNarrating(false);
      } else {
        browserTTSRef.current.resume();
        setIsNarrating(true);
      }
      return;
    }
    if (isNarrating && audioRef.current) {
      audioRef.current.pause();
      setIsNarrating(false);
    } else if (audioRef.current && audioRef.current.paused && audioRef.current.currentTime > 0) {
      audioRef.current.play();
      setIsNarrating(true);
      const wc = readerWordCountRef.current;
      const updateProgress = () => {
        if (audioRef.current && audioRef.current.duration > 0) {
          const pct = audioRef.current.currentTime / audioRef.current.duration;
          setNarrationProgress(pct * 100);
          setReaderWordIndex(Math.min(Math.floor(pct * wc), wc - 1));
        }
        if (audioRef.current && !audioRef.current.paused) narrationAnimRef.current = requestAnimationFrame(updateProgress);
      };
      narrationAnimRef.current = requestAnimationFrame(updateProgress);
    } else {
      playCurrentPage();
    }
  }, [isNarrating, playCurrentPage]);

  const handleClose = useCallback(() => {
    const page = pages[currentPage];
    if ((isNarrating || narrationProgress > 0) && (page.type === "text" || page.type === "intro" || page.type === "outro") && onStartNarration && textPages.length > 0) {
      const firstPage = textPages[0];
      onStartNarration({
        bookTitle: title, chapterTitle: firstPage.chapterTitle, chapterNumber: firstPage.chapterNumber,
        pageInChapter: firstPage.pageInChapter, totalPagesInChapter: firstPage.totalPagesInChapter,
        text: firstPage.text, voice: selectedVoice, allPages: textPages, currentPageIndex: 0,
        projectId,
      });
    }
    stopNarration();
    onClose();
  }, [currentPage, pages, isNarrating, narrationProgress, onStartNarration, title, selectedVoice, textPages, stopNarration, onClose, projectId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (browserTTSRef.current) { browserTTSRef.current.stop(); browserTTSRef.current = null; }
      browserTTSStop();
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    if (dt > 500 || Math.abs(dy) > Math.abs(dx)) return;
    const minSwipe = 50;
    if (dx < -minSwipe) next();
    else if (dx > minSwipe) prev();
  }, [next, prev]);

  const page = pages[currentPage];
  const rightPage = showDual && currentPage + 1 < pages.length ? pages[currentPage + 1] : null;
  const t = THEMES[theme];
  const isDark = theme === "dark" || theme === "midnight";
  const currentSizeIdx = FONT_SIZES.findIndex(s => s.value === fontSize);
  const sizeLabel = FONT_SIZES[currentSizeIdx]?.label || "M";
  const isNarratableCurrentPage = page.type === "text" || page.type === "intro" || page.type === "outro";

  const activeHighlightIdx = useMemo(() => {
    if (readerWordIndex >= 0 && narratedPageIdx === currentPage) return readerWordIndex;
    if (miniNarration && miniPlayerWordIndex >= 0) {
      const miniPage = miniNarration.allPages[miniNarration.currentPageIndex];
      if (miniPage?.globalPageIndex === currentPage) return miniPlayerWordIndex;
    }
    return undefined;
  }, [readerWordIndex, narratedPageIdx, miniNarration, miniPlayerWordIndex, currentPage]);

  const closeAllPanels = () => { setShowToc(false); setShowBookmarks(false); setShowSettings(false); setShowNarrator(false); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center select-none" ref={containerRef}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={cn("absolute inset-0 backdrop-blur-xl", isDark ? "bg-black/95" : "bg-stone-900/95")} onClick={handleClose} />

      <div className={cn("relative mx-2 sm:mx-4 h-[92vh] flex flex-col", showDual ? "w-full max-w-6xl" : "w-full max-w-3xl")}>
        <div className="flex items-center justify-between mb-2 px-2 relative z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="ghost"
              onClick={() => { closeAllPanels(); setShowToc(!showToc); }}
              className={cn("h-8 text-xs font-mono px-2 sm:px-3", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-toc" aria-label="Table of contents"
            >
              <List className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">TOC</span>
            </Button>

            <Button size="sm" variant="ghost"
              onClick={() => { closeAllPanels(); setShowBookmarks(!showBookmarks); }}
              className={cn("h-8 text-xs font-mono px-2 sm:px-3", currentBookmark ? "text-amber-300" : isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-bookmarks" aria-label="Bookmarks"
            >
              <BookMarked className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Bookmarks</span>
              {bookmarks.length > 0 && <span className="ml-1 text-[9px] opacity-70">{bookmarks.length}</span>}
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
              className={cn("h-8 text-xs font-mono px-2 sm:px-3", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-theme" aria-label="Change page theme"
            >
              <Palette className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Theme</span>
            </Button>

            <Button size="sm" variant="ghost"
              onClick={() => { closeAllPanels(); setShowNarrator(!showNarrator); }}
              className={cn("h-8 text-xs font-mono px-2 sm:px-3", isNarrating ? "text-purple-300" : isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-narrator" aria-label="AI Narrator"
            >
              <Volume2 className={cn("h-3.5 w-3.5 sm:mr-1", isNarrating && "animate-pulse")} /> <span className="hidden sm:inline">Narrator</span>
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
            {isNarratableCurrentPage && (isNarrating || narrationLoading) && (
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
                <button onClick={() => setAutoNarrate(!autoNarrate)}
                  className={cn("h-7 px-2 rounded-full border text-[10px] font-mono flex items-center gap-1 transition-all",
                    autoNarrate ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-stone-800 border-stone-600 text-stone-500 hover:text-stone-300")}
                  data-testid="button-continuous-reading" aria-label={autoNarrate ? "Continuous reading on" : "Continuous reading off"}
                >
                  <Repeat className="h-3 w-3" />
                  <span className="hidden sm:inline">{autoNarrate ? "Continuous" : "1 Page"}</span>
                </button>
              </div>
            )}
            {(page.type === "text" || page.type === "chapter-title") && (
              <span className="hidden md:inline font-serif text-xs text-stone-400 max-w-[200px] truncate" data-testid="text-reader-chapter-title" title={`Chapter ${page.chapterNumber}: ${page.chapterTitle}`}>
                Ch. {page.chapterNumber} · {page.chapterTitle}
              </span>
            )}
            <span className={cn("font-mono text-[10px]", "text-stone-500")} data-testid="text-reader-page-indicator">
              {currentPage + 1}{showDual && rightPage ? `–${currentPage + 2}` : ""} / {pages.length}
            </span>
            <Button size="icon" variant="ghost" onClick={handleClose}
              className={cn("h-8 w-8", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-close" aria-label="Close reader"><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {showBookmarks && (
          <div className={cn("absolute left-0 top-11 z-30 w-80 max-w-[92vw] rounded-xl shadow-2xl p-4 max-h-[65vh] overflow-y-auto", "bg-stone-800 border border-stone-700")} data-testid="reader-bookmarks-panel">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-mono text-stone-300 uppercase tracking-wider">Bookmarks</p>
                <p className="text-[9px] text-stone-500 mt-0.5">Your reading position is saved automatically.</p>
              </div>
              <button onClick={() => setShowBookmarks(false)} className="h-6 w-6 flex items-center justify-center rounded text-stone-500 hover:text-white transition-colors" aria-label="Close bookmarks">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn("w-full h-8 text-[10px] font-mono mb-3", currentBookmark ? "border-amber-500/40 text-amber-200" : "border-stone-600 text-stone-300")}
              onClick={toggleCurrentBookmark}
              disabled={!projectId || bookmarkBusy}
              data-testid="button-toggle-reader-bookmark"
            >
              {bookmarkBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : currentBookmark ? <BookMarked className="h-3.5 w-3.5 mr-1.5" /> : <Bookmark className="h-3.5 w-3.5 mr-1.5" />}
              {currentBookmark ? "Remove bookmark from this page" : "Bookmark this page"}
            </Button>

            {bookmarks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stone-700 py-8 text-center">
                <Bookmark className="h-5 w-5 text-stone-600 mx-auto mb-2" />
                <p className="text-[10px] text-stone-500">No saved bookmarks yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {bookmarks.map((saved) => {
                  const target = resolveBookmarkPage(saved);
                  return (
                    <div key={saved.id} className={cn("group flex items-center gap-2 rounded-lg border p-2", target === currentPage ? "border-amber-500/35 bg-amber-500/10" : "border-stone-700 bg-stone-900/30")}>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => { goToImmediate(target); setShowBookmarks(false); }}
                        data-testid={`button-reader-bookmark-${saved.id}`}
                      >
                        <p className="text-[10px] text-stone-200 truncate">{saved.label || saved.chapter_title || `Page ${target + 1}`}</p>
                        <p className="text-[8px] font-mono text-stone-500 mt-0.5">
                          {saved.chapter_number != null ? `CH ${saved.chapter_number}${saved.page_in_chapter ? ` · ${saved.page_in_chapter}` : ""}` : `PAGE ${target + 1}`}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBookmark(saved)}
                        className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-stone-600 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        aria-label="Delete bookmark"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showSettings && (
          <div className={cn("absolute left-0 top-11 z-20 w-64 rounded-xl shadow-2xl p-4", "bg-stone-800 border border-stone-700")}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Page Theme</p>
              <button onClick={() => setShowSettings(false)} className="h-5 w-5 flex items-center justify-center rounded text-stone-500 hover:text-white transition-colors" aria-label="Close theme panel" data-testid="button-close-theme"><X className="h-3 w-3" /></button>
            </div>
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
          <div className={cn("absolute left-0 top-11 z-20 w-72 rounded-xl shadow-2xl p-4 max-h-[70vh] overflow-y-auto", "bg-stone-800 border border-stone-700")}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Volume2 className="h-3 w-3 text-purple-400" />
                <p className="text-[10px] font-mono text-purple-400/80 uppercase tracking-wider">AI Narrator</p>
              </div>
              <button onClick={() => setShowNarrator(false)} className="h-5 w-5 flex items-center justify-center rounded text-stone-500 hover:text-white transition-colors" aria-label="Close narrator panel" data-testid="button-close-narrator"><X className="h-3 w-3" /></button>
            </div>
            {readerUsingFallback && (
              <div className="mb-3 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[9px] text-amber-300 font-mono">Fell back to free browser voice — premium credits may be exhausted.</p>
              </div>
            )}

            {isNarratableCurrentPage ? (
              <div className="flex gap-2 mb-3">
                <Button size="sm" onClick={() => playCurrentPage()} disabled={narrationLoading}
                  className={cn("flex-1 text-[12px] font-mono h-10 border",
                    isBrowserVoice(selectedVoice)
                      ? "bg-green-500/20 hover:bg-green-500/30 text-green-200 border-green-500/30"
                      : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border-purple-500/30")}
                  data-testid="button-narrator-play">
                  {narrationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : isNarrating ? <Pause className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                  {narrationLoading ? "Generating..." : isNarrating ? "Playing…" : isBrowserVoice(selectedVoice) ? "Play (Free)" : "Play This Page"}
                </Button>
                {!isBrowserVoice(selectedVoice) && (
                  <Button size="icon" variant="ghost" onClick={regenerateCurrentPage}
                    disabled={narrationLoading}
                    className="h-10 w-10 text-stone-400 hover:text-purple-300"
                    data-testid="button-reader-regenerate" aria-label="Regenerate this page"
                    title="Regenerate this page — bypass cached narration">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {isNarrating && (
                  <Button size="icon" variant="ghost" onClick={() => stopNarration()}
                    className="h-10 w-10 text-stone-400 hover:text-red-400"
                    data-testid="button-narrator-stop" aria-label="Stop narration"><X className="h-4 w-4" /></Button>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-stone-500 italic text-center mb-3">Navigate to a text page to enable narration</p>
            )}

            <label className="flex items-center gap-2 mb-3 cursor-pointer group">
              <input type="checkbox" checked={autoNarrate} onChange={e => setAutoNarrate(e.target.checked)}
                className="accent-purple-500 w-3.5 h-3.5" data-testid="checkbox-auto-narrate" />
              <span className="text-[10px] text-stone-400 group-hover:text-stone-300 transition-colors">Continuous reading (auto-advance pages)</span>
            </label>

            <p className="text-[10px] text-stone-400 mb-2">Choose a voice below.</p>

            <p className="text-[9px] font-mono text-purple-400/70 uppercase tracking-wider mb-1.5">Working Voices</p>
            <div className="space-y-1.5 mb-3">
              {VOICE_OPTIONS.filter(v => v.isFishAudio).map(v => (
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
            {browserVoiceList.length > 0 && (
              <>
                <p className="text-[9px] font-mono text-green-400/70 uppercase tracking-wider mb-1.5">Free Browser Voices</p>
                <div className="space-y-1.5 mb-3">
                  {browserVoiceList.map(bv => (
                    <button key={bv.id} onClick={() => { setSelectedVoice(bv.id); stopNarration(); }} data-testid={`voice-browser-${bv.label}`}
                      className={cn("w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between",
                        bv.id === selectedVoice ? "border-green-500/40 bg-green-500/10 text-green-200" : "border-stone-600 hover:border-stone-500 text-stone-400")}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30 shrink-0">FREE</span>
                        <div className="min-w-0">
                          <span className="text-[11px] font-mono font-bold truncate block">{bv.label}</span>
                          <span className="text-[9px] text-stone-500">{bv.description}</span>
                        </div>
                      </div>
                      {bv.id === selectedVoice && <span className="text-green-400 text-[10px]">●</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            {VOICE_OPTIONS.some(v => v.isUnavailable) && (
              <>
                <p className="text-[9px] font-mono text-stone-600 uppercase tracking-wider mb-1.5">Unavailable (ElevenLabs)</p>
                <div className="space-y-1.5">
                  {VOICE_OPTIONS.filter(v => v.isUnavailable).map(v => (
                    <div key={v.value} data-testid={`voice-unavailable-${v.value}`}
                      className="w-full text-left px-3 py-2 rounded-lg border border-stone-700/50 bg-stone-900/30 flex items-center justify-between opacity-50 cursor-not-allowed">
                      <div className="min-w-0">
                        <span className="text-[11px] font-mono font-bold text-stone-500 line-through">{v.label}</span>
                        <span className="text-[9px] text-stone-600 ml-2">{v.description}</span>
                      </div>
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-stone-700/40 text-stone-500 border border-stone-700/50 shrink-0">UNAVAILABLE</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {showToc && (
          <div className={cn("absolute left-0 top-11 z-20 w-72 rounded-xl shadow-2xl p-4 max-h-[60vh] overflow-y-auto", "bg-stone-800 border border-stone-700")}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">Jump to</p>
              <button onClick={() => setShowToc(false)} className="h-5 w-5 flex items-center justify-center rounded text-stone-500 hover:text-white transition-colors" aria-label="Close table of contents" data-testid="button-close-toc"><X className="h-3 w-3" /></button>
            </div>
            {pages.map((p, i) => {
              let label = "";
              if (p.type === "cover") label = "Cover";
              else if (p.type === "toc") label = "Table of Contents";
              else if (p.type === "intro") label = "Introduction";
              else if (p.type === "chapter-title") label = `Ch ${p.chapterNumber}: ${p.chapterTitle}`;
              else if (p.type === "outro") label = "Thank You";
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
            className={cn("absolute left-0 top-0 bottom-0 w-10 sm:w-14 z-10 flex items-center justify-center disabled:opacity-0 transition-all duration-200",
              isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-500 hover:text-white",
              "bg-gradient-to-r from-black/20 to-transparent sm:from-transparent")}
            aria-label="Previous page" data-testid="button-reader-prev"><ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" /></button>

          <div className="flex-1 relative min-h-0">
            {showDual ? (
              <div className="absolute inset-0 flex gap-0">
                <div className="flex-1 h-full relative">
                  <BookPage page={page} theme={theme} fontSize={fontSize} side="left"
                    pageNum={currentPage + 1} totalPages={pages.length}
                    isFlipping={isFlipping} flipDir={flipDirection}
                    highlightWordIndex={activeHighlightIdx} />
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
                  isFlipping={isFlipping} flipDir={flipDirection}
                  highlightWordIndex={activeHighlightIdx} />
              </div>
            )}
          </div>

          <button onClick={next} disabled={showDual ? currentPage + 2 >= pages.length : currentPage === pages.length - 1}
            className={cn("absolute right-0 top-0 bottom-0 w-10 sm:w-14 z-10 flex items-center justify-center disabled:opacity-0 transition-all duration-200",
              isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-500 hover:text-white",
              "bg-gradient-to-l from-black/20 to-transparent sm:from-transparent")}
            aria-label="Next page" data-testid="button-reader-next"><ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" /></button>
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
