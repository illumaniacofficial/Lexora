import { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, BookOpen, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

function splitTextIntoPages(text: string, linesPerPage: number): string[] {
  const paragraphs = text.split(/\n+/).filter(p => p.trim());
  const pages: string[] = [];
  let currentLines: string[] = [];
  let lineCount = 0;

  for (const para of paragraphs) {
    const estimatedLines = Math.max(1, Math.ceil(para.length / 70));
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

function buildPages(title: string, authorName: string, chapters: Chapter[], coverUrl?: string | null): PageContent[] {
  const pages: PageContent[] = [];
  pages.push({ type: "cover", title, author: authorName, coverUrl });
  pages.push({
    type: "toc",
    chapters: chapters.map(c => ({ number: c.chapterNumber, title: c.title })),
  });

  const linesPerPage = 18;
  for (const ch of chapters) {
    pages.push({ type: "chapter-title", chapterNumber: ch.chapterNumber, chapterTitle: ch.title });
    if (ch.content) {
      const textPages = splitTextIntoPages(ch.content, linesPerPage);
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

function CoverPage({ page }: { page: Extract<PageContent, { type: "cover" }> }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      {page.coverUrl && (
        <div className="mb-8 w-48 h-64 rounded-lg overflow-hidden shadow-2xl">
          <img src={page.coverUrl} alt="Book cover" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="w-16 h-[1px] bg-amber-800/30 mb-8" />
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-stone-800 leading-tight mb-4">{page.title}</h1>
      <div className="w-12 h-[1px] bg-amber-800/20 mb-4" />
      <p className="text-stone-500 font-serif text-lg italic">by {page.author}</p>
    </div>
  );
}

function TocPage({ page }: { page: Extract<PageContent, { type: "toc" }> }) {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <h2 className="font-serif text-2xl font-bold text-stone-800 mb-6 text-center">Table of Contents</h2>
      <div className="w-12 h-[1px] bg-amber-800/20 mx-auto mb-8" />
      <div className="space-y-3 flex-1">
        {page.chapters.map(ch => (
          <div key={ch.number} className="flex items-baseline gap-2">
            <span className="text-stone-400 font-mono text-sm shrink-0 w-8">{ch.number}.</span>
            <span className="text-stone-700 font-serif text-sm flex-1">{ch.title}</span>
            <span className="border-b border-dotted border-stone-300 flex-1 min-w-8 mx-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChapterTitlePage({ page }: { page: Extract<PageContent, { type: "chapter-title" }> }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <span className="font-mono text-xs uppercase tracking-[0.3em] text-stone-400 mb-3">Chapter {page.chapterNumber}</span>
      <div className="w-12 h-[1px] bg-amber-800/20 mb-6" />
      <h2 className="font-serif text-2xl md:text-3xl font-bold text-stone-800 leading-tight">{page.chapterTitle}</h2>
    </div>
  );
}

function TextPage({ page }: { page: Extract<PageContent, { type: "text" }> }) {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="flex items-center justify-between mb-4 text-[10px] font-mono text-stone-400 uppercase tracking-wider">
        <span>Chapter {page.chapterNumber}</span>
        <span>{page.pageInChapter} / {page.totalPagesInChapter}</span>
      </div>
      <div className="w-full h-[1px] bg-stone-200 mb-5" />
      <div className="flex-1 overflow-y-auto pr-2 reader-scroll">
        {page.text.split("\n\n").map((para, i) => {
          const trimmed = para.trim();
          if (trimmed.startsWith("# ")) {
            return <h2 key={i} className="font-serif text-xl font-bold text-stone-800 mt-4 mb-3">{trimmed.replace(/^#+\s*/, "")}</h2>;
          }
          if (trimmed.startsWith("## ")) {
            return <h3 key={i} className="font-serif text-lg font-bold text-stone-800 mt-3 mb-2">{trimmed.replace(/^#+\s*/, "")}</h3>;
          }
          if (trimmed.startsWith("### ")) {
            return <h4 key={i} className="font-serif text-base font-bold text-stone-700 mt-3 mb-2">{trimmed.replace(/^#+\s*/, "")}</h4>;
          }
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const items = trimmed.split(/\n/).filter(l => l.trim());
            return (
              <ul key={i} className="list-disc pl-5 mb-3 space-y-1">
                {items.map((item, j) => (
                  <li key={j} className="font-serif text-sm text-stone-700 leading-relaxed">{item.replace(/^[-*]\s*/, "")}</li>
                ))}
              </ul>
            );
          }
          if (trimmed.startsWith(">")) {
            return (
              <blockquote key={i} className="border-l-2 border-amber-700/30 pl-4 my-3 italic font-serif text-sm text-stone-600 leading-relaxed">
                {trimmed.replace(/^>\s*/, "")}
              </blockquote>
            );
          }
          if (trimmed.startsWith("---") || trimmed.startsWith("***")) {
            return <div key={i} className="w-12 h-[1px] bg-stone-300 mx-auto my-4" />;
          }
          return (
            <p key={i} className="font-serif text-sm text-stone-700 leading-[1.9] mb-3 text-justify indent-6">{trimmed}</p>
          );
        })}
      </div>
    </div>
  );
}

export default function BookReader({ title, authorName, chapters, coverImageUrl, onClose }: BookReaderProps) {
  const completedChapters = chapters.filter(c => c.status === "complete" && c.content);
  const pages = buildPages(title, authorName, completedChapters, coverImageUrl);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"left" | "right">("right");
  const [showToc, setShowToc] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  const page = pages[currentPage];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" ref={containerRef}>
      <div className="absolute inset-0 bg-stone-900/95 backdrop-blur-xl" onClick={onClose} />

      <div className="relative w-full max-w-2xl mx-4 h-[85vh] max-h-[800px] flex flex-col">
        <div className="flex items-center justify-between mb-3 px-2 relative z-10">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowToc(!showToc)}
              className="text-stone-400 hover:text-white h-8 text-xs font-mono"
              data-testid="button-reader-toc"
              aria-label="Table of contents"
            >
              <List className="h-3.5 w-3.5 mr-1.5" /> TOC
            </Button>
            <span className="text-stone-500 font-mono text-[10px]">
              {currentPage + 1} / {pages.length}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-stone-400 hover:text-white h-8 w-8"
            data-testid="button-reader-close"
            aria-label="Close reader"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showToc && (
          <div className="absolute left-0 top-12 z-20 w-72 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl p-4 max-h-[60vh] overflow-y-auto">
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

        <div className="flex-1 flex items-stretch relative">
          <button
            onClick={prev}
            disabled={currentPage === 0}
            className="absolute left-0 top-0 bottom-0 w-16 z-10 flex items-center justify-center text-stone-500 hover:text-white disabled:opacity-0 transition-all duration-200 -ml-14"
            aria-label="Previous page"
            data-testid="button-reader-prev"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>

          <div className="flex-1 relative perspective-[1200px]">
            <div
              className={cn(
                "absolute inset-0 rounded-xl overflow-hidden transition-all duration-300 ease-in-out",
                "bg-[#f8f4eb] shadow-[0_0_60px_rgba(0,0,0,0.5),inset_0_0_30px_rgba(0,0,0,0.05)]",
                isFlipping && flipDirection === "right" && "animate-page-flip-right",
                isFlipping && flipDirection === "left" && "animate-page-flip-left",
              )}
              style={{
                backgroundImage: "linear-gradient(135deg, #faf6ed 0%, #f2ecda 50%, #ede6d0 100%)",
              }}
            >
              <div className="absolute inset-0 pointer-events-none rounded-xl" style={{
                boxShadow: "inset 4px 0 8px rgba(0,0,0,0.04), inset -2px 0 4px rgba(0,0,0,0.02)",
              }} />
              <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none" style={{
                background: "linear-gradient(to right, rgba(0,0,0,0.06), transparent)",
              }} />

              <div className="h-full overflow-hidden">
                {page.type === "cover" && <CoverPage page={page} />}
                {page.type === "toc" && <TocPage page={page} />}
                {page.type === "chapter-title" && <ChapterTitlePage page={page} />}
                {page.type === "text" && <TextPage page={page} />}
              </div>
            </div>
          </div>

          <button
            onClick={next}
            disabled={currentPage === pages.length - 1}
            className="absolute right-0 top-0 bottom-0 w-16 z-10 flex items-center justify-center text-stone-500 hover:text-white disabled:opacity-0 transition-all duration-200 -mr-14"
            aria-label="Next page"
            data-testid="button-reader-next"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </div>

        <div className="flex justify-center gap-1 mt-3 px-2">
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
