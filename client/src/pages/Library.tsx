import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Library as LibraryIcon, Search, ArrowRight, Crown, BookOpen, Star, Filter,
  ArrowUpDown, Hexagon, AlertCircle, Trophy, Medal,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, VERTICAL_ICONS, formatScore, scoreColor } from "@/lib/utils";
import type { Project } from "@shared/schema";

type LibraryBook = Project & { shortBlurb: string | null; completedChapters: number };

type SortKey = "rank" | "title" | "words" | "quality" | "date";

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]" />;
  if (rank === 2) return <Trophy className="h-3.5 w-3.5 text-slate-300 drop-shadow-[0_0_4px_rgba(203,213,225,0.5)]" />;
  if (rank === 3) return <Medal className="h-3.5 w-3.5 text-amber-600 drop-shadow-[0_0_4px_rgba(217,119,6,0.5)]" />;
  return null;
}

function getRankBorder(rank: number) {
  if (rank === 1) return "border-amber-500/30 hover:border-amber-400/40";
  if (rank === 2) return "border-slate-400/20 hover:border-slate-300/30";
  if (rank === 3) return "border-amber-700/20 hover:border-amber-600/30";
  return "border-purple-500/15 hover:border-purple-400/25";
}

export default function Library() {
  const [search, setSearch] = useState("");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("rank");

  const { data: books = [], isLoading, error } = useQuery<LibraryBook[]>({ queryKey: ["/api/library"] });

  const ranked = useMemo(() => {
    return [...books].sort((a, b) => {
      const qa = a.qualityScore || 0;
      const qb = b.qualityScore || 0;
      if (qb !== qa) return qb - qa;
      return b.wordCount - a.wordCount;
    }).map((book, idx) => ({ ...book, rank: idx + 1 }));
  }, [books]);

  const filtered = useMemo(() => {
    let result = ranked;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.authorName.toLowerCase().includes(q) ||
        b.vertical.toLowerCase().includes(q) ||
        (b.shortBlurb && b.shortBlurb.toLowerCase().includes(q))
      );
    }
    if (verticalFilter !== "all") {
      result = result.filter(b => b.vertical === verticalFilter);
    }
    switch (sortBy) {
      case "title": result = [...result].sort((a, b) => a.title.localeCompare(b.title)); break;
      case "words": result = [...result].sort((a, b) => b.wordCount - a.wordCount); break;
      case "quality": result = [...result].sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0)); break;
      case "date": result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); break;
      default: break;
    }
    return result;
  }, [ranked, search, verticalFilter, sortBy]);

  const top5 = filtered.slice(0, 5);
  const rest = filtered.slice(5);
  const verticals = [...new Set(books.map(b => b.vertical))];

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load library</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-7 overflow-y-auto h-full">
      <Helmet><title>Library — BookForge Studio</title></Helmet>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-emerald-500/50" />
          <span className="text-[9px] font-mono font-bold text-emerald-400/60 tracking-[0.2em] uppercase">LIBRARY</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tighter">Published <span className="shimmer-text">Library</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Your completed books, ranked by quality</p>
      </div>

      <div className="line-glow" />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
          <Input
            data-testid="input-library-search"
            placeholder="Search by title, author, vertical, keyword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-card/30 border-border/20 text-sm font-mono placeholder:text-muted-foreground/25 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="flex gap-2">
          <Select value={verticalFilter} onValueChange={setVerticalFilter}>
            <SelectTrigger className="w-44 bg-card/30 border-border/20 text-[12px] font-mono" data-testid="select-vertical-filter">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/40" />
              <SelectValue placeholder="All Verticals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verticals</SelectItem>
              {verticals.map(v => (
                <SelectItem key={v} value={v}>
                  {VERTICAL_ICONS[v] || ""} {VERTICAL_LABELS[v] || v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-36 bg-card/30 border-border/20 text-[12px] font-mono" data-testid="select-sort">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/40" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">By Rank</SelectItem>
              <SelectItem value="title">By Title</SelectItem>
              <SelectItem value="words">By Word Count</SelectItem>
              <SelectItem value="quality">By Quality</SelectItem>
              <SelectItem value="date">By Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl bg-muted/20" />)}
        </div>
      ) : books.length === 0 ? (
        <Card className="border-border/20 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 neon-glow opacity-20 blur-2xl rounded-full" />
              <LibraryIcon className="h-12 w-12 text-emerald-500/30 relative" />
            </div>
            <p className="font-bold text-lg mt-5 tracking-tight">Library is empty</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1 text-center max-w-sm">Complete a book through the full pipeline to see it here</p>
            <Link href="/projects/new">
              <Button className="mt-5 neon-glow text-white border-0 font-mono text-[12px]" data-testid="button-start-project">
                <BookOpen className="h-4 w-4 mr-2" /> START A PROJECT
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/20 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-14">
            <Search className="h-10 w-10 text-muted-foreground/20" />
            <p className="font-bold mt-4 tracking-tight">No matches found</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <h2 className="text-[9px] font-mono font-bold text-emerald-400/50 tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
              <Star className="h-3 w-3" /> FEATURED ({top5.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {top5.map((book) => (
                <Link key={book.id} href={`/projects/${book.id}`}>
                  <Card
                    className={`cursor-pointer bg-card/30 transition-all duration-300 group h-full overflow-hidden ${getRankBorder(book.rank)}`}
                    data-testid={`library-featured-${book.id}`}
                  >
                    {book.coverImageUrl && (
                      <div className="relative w-full aspect-[3/2] overflow-hidden rounded-t-xl -mt-0 -mx-0">
                        <img
                          src={book.coverImageUrl}
                          alt={`Cover for ${book.title}`}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          data-testid={`img-cover-${book.id}`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                        <div className="absolute top-2.5 left-2.5">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold font-mono backdrop-blur-sm ${
                            book.rank === 1 ? "neon-glow-fire" : book.rank <= 3 ? "neon-glow" : "bg-card/70 border border-border/20"
                          }`}>
                            {book.rank <= 3 ? getRankIcon(book.rank) : <span className="text-muted-foreground/50">#{book.rank}</span>}
                          </div>
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-400 backdrop-blur-sm bg-card/50">
                            COMPLETE
                          </Badge>
                        </div>
                      </div>
                    )}
                    <CardContent className={`pb-5 ${book.coverImageUrl ? "pt-3" : "pt-5"}`}>
                      {!book.coverImageUrl && (
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold font-mono ${
                              book.rank === 1 ? "neon-glow-fire" : book.rank <= 3 ? "neon-glow" : "bg-card/50 border border-border/20"
                            }`}>
                              {book.rank <= 3 ? getRankIcon(book.rank) : <span className="text-muted-foreground/50">#{book.rank}</span>}
                            </div>
                            <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/20 text-emerald-400">
                              COMPLETE
                            </Badge>
                          </div>
                          <span className="text-lg">{VERTICAL_ICONS[book.vertical] || "📖"}</span>
                        </div>
                      )}

                      <h3 className="font-bold text-sm tracking-tight group-hover:text-purple-300 transition-colors mb-1 line-clamp-2">{book.title}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider mb-2">
                        {book.authorName || "Unknown Author"} · {VERTICAL_LABELS[book.vertical] || book.vertical}
                      </p>

                      {book.shortBlurb && (
                        <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-3 mb-3">{book.shortBlurb}</p>
                      )}

                      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/30 mt-auto pt-2 border-t border-border/10">
                        <span>{book.wordCount.toLocaleString()} words</span>
                        <span>{book.chapterCount} chapters</span>
                        {book.qualityScore && (
                          <span className={scoreColor(book.qualityScore)}>
                            ★ {formatScore(book.qualityScore)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {rest.length > 0 && (
            <div>
              <h2 className="text-[9px] font-mono font-bold text-muted-foreground/40 tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> ALL BOOKS ({rest.length} more)
              </h2>
              <Card className="border-border/20 bg-card/30 overflow-hidden">
                <div className="divide-y divide-border/10">
                  {rest.map((book) => (
                    <Link key={book.id} href={`/projects/${book.id}`}>
                      <div
                        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors group"
                        data-testid={`library-book-${book.id}`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card/50 border border-border/15 text-[10px] font-mono font-bold text-muted-foreground/40">
                          #{book.rank}
                        </div>
                        <span className="text-base shrink-0">{VERTICAL_ICONS[book.vertical] || "📖"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[13px] tracking-tight truncate group-hover:text-purple-300 transition-colors">{book.title}</h4>
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground/30 truncate mt-0.5">
                            {book.authorName || "Unknown"} · {book.wordCount.toLocaleString()} words · {book.chapterCount} ch
                            {book.shortBlurb && ` — ${book.shortBlurb.slice(0, 80)}...`}
                          </p>
                        </div>
                        {book.qualityScore && (
                          <span className={`text-[11px] font-mono font-bold ${scoreColor(book.qualityScore)}`}>
                            ★ {formatScore(book.qualityScore)}
                          </span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-purple-400/50 transition-colors shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
