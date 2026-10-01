import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

interface ProjectHeroProps {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  genre?: string | null;
  language?: string | null;
  status?: ReactNode;
  progress?: number;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function ProjectHero({
  title,
  author,
  coverUrl,
  genre,
  language,
  status,
  progress,
  meta,
  actions,
}: ProjectHeroProps) {
  const safeProgress = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <section className="lexora-editorial-surface relative overflow-hidden rounded-[30px]" data-testid="project-hero">
      <div className="grid min-h-[290px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative min-h-[220px] overflow-hidden border-b border-[#C0A06B]/10 lg:border-b-0 lg:border-r">
          {coverUrl ? (
            <>
              <img src={coverUrl} alt={`Cover for ${title}`} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B090C]/68 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#0B090C]/38" />
            </>
          ) : (
            <div className="lexora-cover-placeholder absolute inset-0 flex items-center justify-center">
              <BookOpen className="relative z-10 h-12 w-12 text-[#C0A06B]/45" />
            </div>
          )}
        </div>

        <div className="relative flex min-w-0 flex-col justify-between p-6 md:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(192,160,107,.07),transparent_24rem)]" />
          <div className="relative min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em]">
              {genre ? <span className="text-[#C0A06B]/65">{genre}</span> : null}
              {genre && language ? <span className="text-[#BCAF9F]/20">•</span> : null}
              {language ? <span className="text-[#BCAF9F]/40">{language}</span> : null}
            </div>
            <h1 className="lexora-display mt-4 line-clamp-3 break-words text-4xl font-semibold leading-[.96] text-[#EFE5D9] md:text-5xl xl:text-[3.6rem]">
              {title}
            </h1>
            {author ? <p className="mt-3 text-sm text-[#BCAF9F]/55">by {author}</p> : null}
            {status ? <div className="mt-5">{status}</div> : null}
            {meta ? <div className="mt-6">{meta}</div> : null}
          </div>

          <div className="relative mt-7">
            {safeProgress !== null ? (
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[.12em] text-[#BCAF9F]/35">
                  <span>Project progress</span>
                  <span>{Math.round(safeProgress)}%</span>
                </div>
                <div className="h-px overflow-hidden bg-white/[.08]">
                  <div className="h-full bg-gradient-to-r from-[#7E3E51] to-[#C0A06B]" style={{ width: `${safeProgress}%` }} />
                </div>
              </div>
            ) : null}
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
