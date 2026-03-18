import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Library as LibraryIcon, Search, ArrowRight, Crown, BookOpen, Star, Filter,
  ArrowUpDown, Hexagon, AlertCircle, Trophy, Medal, Share2, Copy, Trash2, Link as LinkIcon, Eye, Plus, Loader2,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, VERTICAL_ICONS, formatScore, scoreColor } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import BookReader from "@/components/book-reader";
import { useNarration } from "@/App";
import type { Project, InviteToken, Chapter } from "@shared/schema";

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
  const [showInvites, setShowInvites] = useState(() => window.location.hash === "#invites");
  const [inviteLabel, setInviteLabel] = useState("");
  const [readerBook, setReaderBook] = useState<{ id: number; title: string; authorName: string; coverImageUrl?: string | null } | null>(null);
  const [readerChapters, setReaderChapters] = useState<Chapter[]>([]);
  const [loadingReaderId, setLoadingReaderId] = useState<number | null>(null);
  const { toast } = useToast();
  const { startNarration } = useNarration();

  useEffect(() => {
    if (window.location.hash === "#invites") {
      setShowInvites(true);
    }
  }, []);

  const openReader = useCallback(async (book: LibraryBook) => {
    setLoadingReaderId(book.id);
    try {
      const res = await apiRequest("GET", `/api/projects/${book.id}`);
      const data = await res.json();
      const chapters: Chapter[] = (data.chapters || []).filter((c: Chapter) => c.status === "complete" && c.content);
      if (chapters.length === 0) {
        toast({ title: "No chapters available", description: "This book has no completed chapters to read." });
        return;
      }
      setReaderChapters(chapters);
      setReaderBook({ id: book.id, title: book.title, authorName: book.authorName, coverImageUrl: data.project?.coverImageUrl || `/api/projects/${book.id}/cover-image` });
    } catch {
      toast({ title: "Failed to load book", description: "Could not load chapters for reading." });
    } finally {
      setLoadingReaderId(null);
    }
  }, [toast]);

  const { data: books = [], isLoading, error } = useQuery<LibraryBook[]>({ queryKey: ["/api/library"] });
  const { data: invites = [] } = useQuery<InviteToken[]>({ queryKey: ["/api/invites"] });

  const createInviteMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest("POST", "/api/invites", { label: label || "Reader Invite" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invites"] });
      setInviteLabel("");
      toast({ title: "Invite created", description: "Share the link with your readers" });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/invites/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/invites"] }); },
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/store/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Invite link copied to clipboard" });
  };

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
    <div className="p-8 space-y-7 overflow-y-auto h-full aurora-bg-animated">
      <Helmet>
        <title>Library — Lexora</title>
        <meta name="description" content="Your completed book library — browse, search, and explore published manuscripts ranked by quality." />
      </Helmet>
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-emerald-500/50" />
          <span className="text-[9px] font-mono font-bold text-emerald-400/60 tracking-[0.2em] uppercase">LIBRARY</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">Published <span className="shimmer-text">Library</span></h1>
            <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Your completed books, ranked by quality</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInvites(!showInvites)}
            className="border-purple-500/20 text-purple-300 hover:bg-purple-500/10 hover:scale-105 transition-all duration-300 font-mono text-[11px] h-8"
            data-testid="button-toggle-invites"
          >
            <Share2 className="h-3.5 w-3.5 mr-1.5" /> {showInvites ? "Hide" : "Invites"} {invites.length > 0 && `(${invites.length})`}
          </Button>
        </div>
      </div>

      {showInvites && (
        <Card className="border-purple-500/15 bg-purple-500/[0.03] glass-card-premium animate-fade-in-up">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Share2 className="h-3 w-3 text-purple-400" />
              <span className="text-[9px] font-mono text-purple-400/60 uppercase tracking-[0.2em]">Reader Invites</span>
            </div>
            <p className="text-[11px] text-muted-foreground/50 mb-4">Create invite links to share your book collection as a storefront. Readers can browse, read, and listen with AI narration.</p>
            <div className="flex gap-2 mb-4">
              <Input
                value={inviteLabel}
                onChange={e => setInviteLabel(e.target.value)}
                placeholder="Label (e.g., Beta Readers, Marketing Team)"
                className="bg-white/[0.03] border-border/20 text-sm font-mono placeholder:text-muted-foreground/25 flex-1"
                data-testid="input-invite-label"
              />
              <Button
                onClick={() => createInviteMutation.mutate(inviteLabel)}
                disabled={createInviteMutation.isPending}
                className="neon-glow text-white border-0 font-mono text-[11px] h-9 px-4 hover:scale-105 transition-transform"
                data-testid="button-create-invite"
              >
                {createInviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                Create
              </Button>
            </div>
            {invites.length > 0 && (
              <div className="space-y-2">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-border/10 group hover:border-purple-500/15 transition-all duration-300" data-testid={`invite-${inv.id}`}>
                    <LinkIcon className="h-3.5 w-3.5 text-purple-400/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate">{inv.label}</p>
                      <p className="text-[9px] font-mono text-muted-foreground/30 truncate">{window.location.origin}/store/{inv.token}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/30 shrink-0">
                      <Eye className="h-3 w-3" /> {inv.viewCount}
                    </div>
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => copyInviteLink(inv.token)}
                      className="h-7 w-7 text-muted-foreground/40 hover:text-purple-300"
                      data-testid={`button-copy-invite-${inv.id}`} aria-label="Copy invite link"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => deleteInviteMutation.mutate(inv.id)}
                      className="h-7 w-7 text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-invite-${inv.id}`} aria-label="Delete invite"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="line-glow" />

      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up stagger-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
          <Input
            data-testid="input-library-search"
            placeholder="Search by title, author, vertical, keyword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white/[0.03] border-border/20 text-sm font-mono placeholder:text-muted-foreground/25 focus-visible:ring-purple-500/30"
          />
        </div>
        <div className="flex gap-2">
          <Select value={verticalFilter} onValueChange={setVerticalFilter}>
            <SelectTrigger className="w-44 bg-white/[0.03] border-border/20 text-[12px] font-mono" data-testid="select-vertical-filter">
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
            <SelectTrigger className="w-36 bg-white/[0.03] border-border/20 text-[12px] font-mono" data-testid="select-sort">
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
        <Card className="border-border/20 bg-card/30 glass-card-premium">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative animate-float">
              <div className="absolute inset-0 neon-glow opacity-20 blur-2xl rounded-full scale-150" />
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
        <Card className="border-border/20 bg-card/30 glass-card-premium">
          <CardContent className="flex flex-col items-center justify-center py-14">
            <Search className="h-10 w-10 text-muted-foreground/20 animate-float" />
            <p className="font-bold mt-4 tracking-tight">No matches found</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="animate-fade-in-up stagger-3">
            <h2 className="text-[9px] font-mono font-bold text-emerald-400/50 tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
              <Star className="h-3 w-3" /> FEATURED ({top5.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {top5.map((book, idx) => (
                <Link key={book.id} href={`/projects/${book.id}`}>
                  <Card
                    className={`cursor-pointer bg-card/30 transition-all duration-300 group h-full overflow-hidden card-hover-lift animate-fade-in-up stagger-${Math.min(idx + 1, 6)} ${getRankBorder(book.rank)} ${book.rank <= 3 ? "glass-card-premium" : ""}`}
                    data-testid={`library-featured-${book.id}`}
                  >
                    {book.hasCover && (
                      <div className="relative w-full aspect-[2/3] max-h-56 overflow-hidden rounded-t-xl -mt-0 -mx-0">
                        <img
                          src={`/api/projects/${book.id}/cover-image`}
                          alt={`Cover for ${book.title}`}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          data-testid={`img-cover-${book.id}`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                        <div className="absolute top-2.5 left-2.5">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold font-mono backdrop-blur-md ${
                            book.rank === 1 ? "neon-glow-fire shadow-[0_0_12px_rgba(245,158,11,0.3)]" : book.rank <= 3 ? "neon-glow" : "bg-card/70 border border-border/20"
                          }`}>
                            {book.rank <= 3 ? getRankIcon(book.rank) : <span className="text-muted-foreground/50">#{book.rank}</span>}
                          </div>
                        </div>
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                          {book.publishedToStore && (
                            <Badge variant="outline" className="text-[9px] font-mono border-purple-500/30 text-purple-300 backdrop-blur-md bg-card/50">
                              STOREFRONT
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/30 text-emerald-400 backdrop-blur-md bg-card/50">
                            COMPLETE
                          </Badge>
                        </div>
                      </div>
                    )}
                    <CardContent className={`pb-5 ${book.hasCover ? "pt-3" : "pt-5"}`}>
                      {!book.hasCover && (
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
                            {book.publishedToStore && (
                              <Badge variant="outline" className="text-[9px] font-mono border-purple-500/20 text-purple-300">
                                STOREFRONT
                              </Badge>
                            )}
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
                      <Button
                        size="sm"
                        className="w-full mt-3 neon-glow-nature text-white border-0 font-mono text-[10px] h-8 hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-shadow"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openReader(book); }}
                        disabled={loadingReaderId === book.id}
                        data-testid={`button-read-library-${book.id}`}
                      >
                        {loadingReaderId === book.id ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Eye className="h-3 w-3 mr-1.5" />}
                        READ BOOK
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {rest.length > 0 && (
            <div className="animate-fade-in-up stagger-5">
              <h2 className="text-[9px] font-mono font-bold text-muted-foreground/40 tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> ALL BOOKS ({rest.length} more)
              </h2>
              <Card className="border-border/15 bg-card/30 overflow-hidden glass-card-premium">
                <div className="divide-y divide-border/10">
                  {rest.map((book) => (
                    <Link key={book.id} href={`/projects/${book.id}`}>
                      <div
                        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-purple-500/[0.03] transition-all duration-300 group"
                        data-testid={`library-book-${book.id}`}
                      >
                        {book.hasCover ? (
                          <div className="h-10 w-7 rounded overflow-hidden shrink-0 border border-border/15">
                            <img src={`/api/projects/${book.id}/cover-image`} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card/50 border border-border/15 text-[10px] font-mono font-bold text-muted-foreground/40">
                            #{book.rank}
                          </div>
                        )}
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
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2.5 text-[10px] font-mono text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10 shrink-0"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openReader(book); }}
                          disabled={loadingReaderId === book.id}
                          data-testid={`button-read-list-${book.id}`}
                        >
                          {loadingReaderId === book.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Eye className="h-3 w-3 mr-1" /> Read</>}
                        </Button>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-purple-400/50 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {readerBook && (
        <BookReader
          title={readerBook.title}
          authorName={readerBook.authorName || "Unknown Author"}
          chapters={readerChapters}
          coverImageUrl={readerBook.coverImageUrl}
          onClose={() => { setReaderBook(null); setReaderChapters([]); }}
          onStartNarration={startNarration}
        />
      )}
    </div>
  );
}
