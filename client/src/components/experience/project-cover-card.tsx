import type { ReactNode } from "react";
import { Link } from "wouter";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectCoverCardProps {
  id: number;
  title: string;
  coverUrl?: string | null;
  status?: string;
  genre?: string;
  progress?: number;
  meta?: ReactNode;
  href: string;
  compact?: boolean;
}

export function ProjectCoverCard({
  id,
  title,
  coverUrl,
  status,
  genre,
  progress,
  meta,
  href,
  compact = false,
}: ProjectCoverCardProps) {
  const safeProgress = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <Link href={href}>
      <article
        className={cn(
          "group cursor-pointer outline-none",
          compact ? "flex items-center gap-3" : "space-y-3"
        )}
        data-testid={`experience-project-card-${id}`}
      >
        <div
          className={cn(
            "relative overflow-hidden border border-[#C0A06B]/10 bg-[#131015] shadow-[0_24px_55px_-38px_rgba(0,0,0,.95)] transition-[transform,border-color,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:border-[#C0A06B]/24 group-focus-visible:border-[#C0A06B]/45",
            compact ? "h-16 w-11 shrink-0 rounded-lg" : "aspect-[2/3] w-full rounded-[18px]"
          )}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Cover for ${title}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="lexora-cover-placeholder flex h-full w-full items-center justify-center">
              <BookOpen className={cn("relative z-10 text-[#C0A06B]/55", compact ? "h-4 w-4" : "h-8 w-8")} />
            </div>
          )}
          {!compact ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#0B090C]/75 to-transparent" />
              <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/[.08] bg-[#0B090C]/65 text-[#EFE5D9]/60 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </>
          ) : null}
        </div>

        <div className={cn("min-w-0", compact ? "flex-1" : "")}>
          <h3 className={cn(
            "line-clamp-2 font-semibold tracking-[-0.025em] text-[#EFE5D9] transition-colors group-hover:text-white",
            compact ? "text-[13px]" : "lexora-display text-lg leading-tight"
          )}>
            {title}
          </h3>
          {(genre || status) ? (
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[#BCAF9F]/42">
              {[genre, status].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {meta ? <div className="mt-2 text-[11px] text-[#BCAF9F]/50">{meta}</div> : null}
          {safeProgress !== null ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-px flex-1 overflow-hidden bg-white/[.07]">
                <div className="h-full bg-gradient-to-r from-[#7E3E51] to-[#C0A06B]" style={{ width: `${safeProgress}%` }} />
              </div>
              <span className="w-8 text-right font-mono text-[9px] text-[#BCAF9F]/40">{Math.round(safeProgress)}%</span>
            </div>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
