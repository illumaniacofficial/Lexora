import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, List, Minus, Plus, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { Chapter } from "@shared/schema";

interface BookReaderProps {
  title: string;
  authorName: string;
  chapters: Chapter[];
  coverImageUrl?: string | null;
  onClose: () => void;
}

type PageContent =
  | { type: "cover"; title: string; author: string; coverUrl?: string | null }
  | { type: "toc"; chapters: { number: number; title: string }[] }
  | { type: "chapter-title"; chapterNumber: number; chapterTitle: string }
  | { type: "text"; chapterNumber: number; chapterTitle: string; text: string; pageInChapter: number; totalPagesInChapter: number };

type PageTheme = "parchment" | "cream" | "white" | "sepia" | "dark" | "midnight";

const THEMES: Record<PageTheme, { bg: string; text: string; accent: string; headerText: string; heading: string; divider: string; label: string; gradient: string }> = {
  parchment: {
    bg: "bg-[#f8f4eb]", text: "text-stone-700", accent: "text-stone-400", headerText: "text-stone-800", heading: "text-stone-800", divider: "bg-amber-800/20", label: "Parchment",
    gradient: "linear-gradient(135deg, #faf6ed 0%, #f2ecda 50%, #ede6d0 100%)",
  },
  cream: {
    bg: "bg-[#fffdf5]", text: "text-stone-600", accent: "text-stone-400", headerText: "text-stone-800", heading: "text-stone-800", divider: "bg-stone-300", label: "Cream",
    gradient: "linear-gradient(135deg, #fffef8 0%, #fdfbf0 50%, #faf7e8 100%)",
  },
  white: {
    bg: "bg-white", text: "text-gray-700", accent: "text-gray-400", headerText: "text-gray-900", heading: "text-gray-900", divider: "bg-gray-200", label: "White",
    gradient: "linear-gradient(135deg, #ffffff 0%, #fafafa 50%, #f5f5f5 100%)",
  },
  sepia: {
    bg: "bg-[#f0e6d2]", text: "text-amber-900", accent: "text-amber-700/50", headerText: "text-amber-950", heading: "text-amber-950", divider: "bg-amber-800/25", label: "Sepia",
    gradient: "linear-gradient(135deg, #f2e8d4 0%, #ece0c8 50%, #e5d8bc 100%)",
  },
  dark: {
    bg: "bg-[#1e1e1e]", text: "text-stone-300", accent: "text-stone-500", headerText: "text-stone-100", heading: "text-stone-100", divider: "bg-stone-700", label: "Dark",
    gradient: "linear-gradient(135deg, #222222 0%, #1e1e1e 50%, #1a1a1a 100%)",
  },
  midnight: {
    bg: "bg-[#0d1117]", text: "text-blue-200/80", accent: "text-blue-400/40", headerText: "text-blue-100", heading: "text-blue-100", divider: "bg-blue-800/30", label: "Midnight",
    gradient: "linear-gradient(135deg, #0f1419 0%, #0d1117 50%, #0b0f14 100%)",
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
  if (fontSize <= 12) return 32;
  if (fontSize <= 14) return 26;
  if (fontSize <= 16) return 22;
  if (fontSize <= 18) return 18;
  if (fontSize <= 20) return 15;
  return 12;
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
  if (currentLines.length > 0) {
    pages.push(currentLines.join("\n\n"));
  }
  return pages.length > 0 ? pages : [""];
}

function buildPages(title: string, authorName: string, chapters: Chapter[], coverUrl: string | null | undefined, fontSize: number): PageContent[] {
  const pages: PageContent[] = [];
  pages.push({ type: "cover", title, author: authorName, coverUrl });
  pages.push({
    type: "toc",
    chapters: chapters.map(c => ({ number: c.chapterNumber, title: c.title })),
  });

  const linesPerPage = linesForFontSize(fontSize);
  const charsPerLine = Math.max(40, Math.round(80 * (16 / fontSize)));

  for (const ch of chapters) {
    pages.push({ type: "chapter-title", chapterNumber: ch.chapterNumber, chapterTitle: ch.title });
    if (ch.content) {
      const textPages = splitTextIntoPages(ch.content, linesPerPage, charsPerLine);
      textPages.forEach((text, i) => {
        pages.push({
          type: "text",
          chapterNumber: ch.chapterNumber,
          chapterTitle: ch.title,
          text,
          pageInChapter: i + 1,
          totalPagesInChapter: textPages.length,
        });
      });
    }
  }

  return pages;
}

function CoverPage({ page, theme }: { page: Extract<PageContent, { type: "cover" }>; theme: PageTheme }) {
  const t = THEMES[theme];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      {page.coverUrl && (
        <div className="mb-8 w-48 h-64 rounded-lg overflow-hidden shadow-2xl">
          <img src={page.coverUrl} alt="Book cover" className="w-full h-full object-cover" />
        </div>
      )}
      <div className={cn("w-16 h-[1px] mb-8", t.divider)} />
      <h1 className={cn("font-serif text-3xl md:text-4xl font-bold leading-tight mb-4", t.heading)}>{page.title}</h1>
      <div className={cn("w-12 h-[1px] mb-4", t.divider)} />
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
      <div className={cn("w-12 h-[1px] mb-6", t.divider)} />
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
        {isDark ? (
          <DarkMarkdownRenderer content={page.text} theme={theme} />
        ) : (
          <MarkdownRenderer content={page.text} />
        )}
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
          return (
            <ul key={i} className="list-disc pl-5 mb-3 space-y-1">
              {items.map((item, j) => <li key={j} className={cn("font-serif text-sm leading-relaxed", t.text)}>{item.replace(/^[-*]\s*/, "")}</li>)}
            </ul>
          );
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

export default function BookReader({ title, authorName, chapters, coverImageUrl, onClose }: BookReaderProps) {
  const completedChapters = chapters.filter(c => c.status === "complete" && c.content);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"left" | "right">("right");
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState<PageTheme>("parchment");
  const containerRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(
    () => buildPages(title, authorName, completedChapters, coverImageUrl, fontSize),
    [title, authorName, completedChapters, coverImageUrl, fontSize]
  );

  useEffect(() => {
    if (currentPage >= pages.length) setCurrentPage(Math.max(0, pages.length - 1));
  }, [pages.length, currentPage]);

  const goTo = useCallback((pageNum: number) => {
    if (pageNum < 0 || pageNum >= pages.length || isFlipping) return;
    setFlipDirection(pageNum > currentPage ? "right" : "left");
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage(pageNum);
      setIsFlipping(false);
    }, 300);
  }, [currentPage, pages.length, isFlipping]);

  const prev = useCallback(() => goTo(currentPage - 1), [goTo, currentPage]);
  const next = useCallback(() => goTo(currentPage + 1), [goTo, currentPage]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize(prev => {
      const sizes = FONT_SIZES.map(s => s.value);
      const idx = sizes.indexOf(prev);
      const newIdx = Math.max(0, Math.min(sizes.length - 1, idx + delta));
      return sizes[newIdx];
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") onClose();
      if ((e.key === "=" || e.key === "+") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); adjustFontSize(1); }
      if (e.key === "-" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); adjustFontSize(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose, adjustFontSize]);

  const page = pages[currentPage];
  const t = THEMES[theme];
  const isDark = theme === "dark" || theme === "midnight";
  const currentSizeIdx = FONT_SIZES.findIndex(s => s.value === fontSize);
  const sizeLabel = FONT_SIZES[currentSizeIdx]?.label || "M";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" ref={containerRef}>
      <div className={cn("absolute inset-0 backdrop-blur-xl", isDark ? "bg-black/95" : "bg-stone-900/95")} onClick={onClose} />

      <div className="relative w-full max-w-3xl mx-4 h-[92vh] flex flex-col">
        <div className="flex items-center justify-between mb-2 px-2 relative z-10">
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="ghost"
              onClick={() => { setShowToc(!showToc); setShowSettings(false); }}
              className={cn("h-8 text-xs font-mono", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-toc" aria-label="Table of contents"
            >
              <List className="h-3.5 w-3.5 mr-1.5" /> TOC
            </Button>

            <div className={cn("flex items-center gap-0.5 rounded-lg border px-1", isDark ? "border-stone-700 bg-stone-800/50" : "border-stone-600 bg-stone-800/50")}>
              <button
                onClick={() => adjustFontSize(-1)}
                disabled={currentSizeIdx <= 0}
                className="h-7 w-7 flex items-center justify-center text-stone-400 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Decrease font size" data-testid="button-font-decrease"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-[10px] font-mono text-stone-300 w-7 text-center select-none">{sizeLabel}</span>
              <button
                onClick={() => adjustFontSize(1)}
                disabled={currentSizeIdx >= FONT_SIZES.length - 1}
                className="h-7 w-7 flex items-center justify-center text-stone-400 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Increase font size" data-testid="button-font-increase"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <Button
              size="sm" variant="ghost"
              onClick={() => { setShowSettings(!showSettings); setShowToc(false); }}
              className={cn("h-8 text-xs font-mono", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-theme" aria-label="Change page theme"
            >
              <Palette className="h-3.5 w-3.5 mr-1.5" /> Theme
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className={cn("font-mono text-[10px]", isDark ? "text-stone-500" : "text-stone-500")}>
              {currentPage + 1} / {pages.length}
            </span>
            <Button
              size="icon" variant="ghost"
              onClick={onClose}
              className={cn("h-8 w-8", isDark ? "text-stone-300 hover:text-white" : "text-stone-400 hover:text-white")}
              data-testid="button-reader-close" aria-label="Close reader"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showSettings && (
          <div className={cn("absolute left-0 top-11 z-20 w-64 rounded-xl shadow-2xl p-4", isDark ? "bg-stone-800 border border-stone-700" : "bg-stone-800 border border-stone-700")}>
            <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-3">Page Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(THEMES) as PageTheme[]).map(key => {
                const th = THEMES[key];
                const active = key === theme;
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    data-testid={`theme-${key}`}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all text-[10px] font-mono",
                      active ? "border-amber-500/60 bg-amber-500/10 text-amber-200" : "border-stone-600 hover:border-stone-500 text-stone-400"
                    )}
                  >
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
                  <button
                    key={s.value}
                    onClick={() => setFontSize(s.value)}
                    data-testid={`fontsize-${s.label}`}
                    className={cn(
                      "flex-1 py-1.5 rounded text-[10px] font-mono transition-all",
                      s.value === fontSize ? "bg-amber-500/20 text-amber-200 border border-amber-500/40" : "text-stone-400 hover:text-stone-300 border border-transparent"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showToc && (
          <div className={cn("absolute left-0 top-11 z-20 w-72 rounded-xl shadow-2xl p-4 max-h-[60vh] overflow-y-auto", isDark ? "bg-stone-800 border border-stone-700" : "bg-stone-800 border border-stone-700")}>
            <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-3">Jump to</p>
            {pages.map((p, i) => {
              let label = "";
              if (p.type === "cover") label = "Cover";
              else if (p.type === "toc") label = "Table of Contents";
              else if (p.type === "chapter-title") label = `Ch ${p.chapterNumber}: ${p.chapterTitle}`;
              else return null;
              return (
                <button
                  key={i}
                  onClick={() => { goTo(i); setShowToc(false); }}
                  className={cn(
                    "w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors font-serif",
                    i === currentPage ? "bg-amber-900/30 text-amber-200" : "text-stone-300 hover:bg-stone-700"
                  )}
                  data-testid={`button-reader-jump-${i}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 flex items-stretch relative min-h-0">
          <button
            onClick={prev}
            disabled={currentPage === 0}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-12 sm:w-16 z-10 flex items-center justify-center disabled:opacity-0 transition-all duration-200 -ml-12 sm:-ml-14",
              isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-500 hover:text-white"
            )}
            aria-label="Previous page" data-testid="button-reader-prev"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>

          <div className="flex-1 relative perspective-[1200px] min-h-0">
            <div
              className={cn(
                "absolute inset-0 rounded-xl overflow-hidden transition-all duration-300 ease-in-out",
                t.bg,
                isDark
                  ? "shadow-[0_0_60px_rgba(0,0,0,0.8)]"
                  : "shadow-[0_0_60px_rgba(0,0,0,0.5),inset_0_0_30px_rgba(0,0,0,0.05)]",
                isFlipping && flipDirection === "right" && "animate-page-flip-right",
                isFlipping && flipDirection === "left" && "animate-page-flip-left",
              )}
              style={{ backgroundImage: t.gradient }}
            >
              {!isDark && (
                <>
                  <div className="absolute inset-0 pointer-events-none rounded-xl" style={{
                    boxShadow: "inset 4px 0 8px rgba(0,0,0,0.04), inset -2px 0 4px rgba(0,0,0,0.02)",
                  }} />
                  <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none" style={{
                    background: "linear-gradient(to right, rgba(0,0,0,0.06), transparent)",
                  }} />
                </>
              )}

              <div className="h-full overflow-hidden flex flex-col">
                {page.type === "cover" && <CoverPage page={page} theme={theme} />}
                {page.type === "toc" && <TocPage page={page} theme={theme} fontSize={fontSize} />}
                {page.type === "chapter-title" && <ChapterTitlePage page={page} theme={theme} />}
                {page.type === "text" && <TextPage page={page} theme={theme} fontSize={fontSize} />}
              </div>
            </div>
          </div>

          <button
            onClick={next}
            disabled={currentPage === pages.length - 1}
            className={cn(
              "absolute right-0 top-0 bottom-0 w-12 sm:w-16 z-10 flex items-center justify-center disabled:opacity-0 transition-all duration-200 -mr-12 sm:-mr-14",
              isDark ? "text-stone-500 hover:text-stone-200" : "text-stone-500 hover:text-white"
            )}
            aria-label="Next page" data-testid="button-reader-next"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </div>

        <div className="flex justify-center gap-1 mt-2 px-2">
          {pages.length <= 40 ? (
            pages.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "h-1 rounded-full transition-all duration-200",
                  i === currentPage ? "w-6 bg-amber-400" : "w-1.5 bg-stone-600 hover:bg-stone-400"
                )}
                aria-label={`Go to page ${i + 1}`}
              />
            ))
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-1 rounded-full bg-stone-700 flex-1 max-w-48 relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                />
              </div>
              <span className="text-stone-500 font-mono text-[10px]">{Math.round(((currentPage + 1) / pages.length) * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
