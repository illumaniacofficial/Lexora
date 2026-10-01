import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Search, BookOpen, Filter, ArrowUpDown, AlertCircle, Share2, Copy, Trash2, Link as LinkIcon, Eye, Plus, Loader2,
  Download, FileText, FileCode, FileDown, Globe, LayoutGrid, Rows3, List,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, formatScore } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportBookPdf, downloadBookFile } from "@/lib/export-book";
import { useToast } from "@/hooks/use-toast";
import BookReader from "@/components/book-reader";
import { useNarration } from "@/App";
import type { Project, InviteToken, Chapter } from "@shared/schema";
import { LexoraPageHeader } from "@/components/experience/lexora-page-header";
import { EmptyCreativeState } from "@/components/experience/empty-creative-state";
import { ProjectCoverCard } from "@/components/experience/project-cover-card";
import { EditorialSection } from "@/components/experience/editorial-section";

type LibraryBook = Omit<Project, "coverImageUrl"> & { hasCover: boolean; shortBlurb: string | null; completedChapters: number; chaptersWithAudio: number; editionLanguages?: string[] };

type SortKey = "rank" | "title" | "words" | "quality" | "date";
type LibraryView = "covers" | "editorial" | "compact";

function ExportMenu({ book, variant }: { book: LibraryBook; variant: "card" | "row" }) {
  const { toast } = useToast();
  const [exportingPdf, setExportingPdf] = useState(false);
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handlePdf = async (e: React.MouseEvent, printMode = false) => {
    stop(e);
    setExportingPdf(true);
    try {
      const res = await apiRequest("GET", `/api/projects/${book.id}`);
      const data = await res.json();
      await exportBookPdf(
        { id: book.id, title: book.title, authorName: book.authorName, coverImageUrl: data.project?.coverImageUrl || `/api/projects/${book.id}/cover-image` },
        data.chapters || [],
        "6x9",
        printMode,
      );
      toast({ title: printMode ? "Print PDF exported" : "PDF exported" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Could not export PDF", variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={stop}>
        {variant === "card" ? (
          <Button
            size="sm" variant="outline"
            className="mt-3 px-2.5 border-border/20 bg-card/40 text-muted-foreground/70 hover:text-purple-300 hover:bg-purple-500/10 font-mono text-[10px] h-8 shrink-0"
            data-testid={`button-export-library-${book.id}`}
          >
            {exportingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          </Button>
        ) : (
          <Button
            size="sm" variant="ghost"
            className="h-7 px-2 text-[10px] font-mono text-muted-foreground/50 hover:text-purple-300 hover:bg-purple-500/10 shrink-0"
            data-testid={`button-export-list-${book.id}`}
          >
            {exportingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-md border-border/30">
        <DropdownMenuItem onClick={(e) => handlePdf(e)} className="text-xs font-mono cursor-pointer" data-testid={`menu-export-pdf-${book.id}`}>
          <FileDown className="h-3.5 w-3.5 mr-2 text-amber-400/70" /> Export PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => handlePdf(e, true)} className="text-xs font-mono cursor-pointer" data-testid={`menu-export-print-pdf-${book.id}`}>
          <FileDown className="h-3.5 w-3.5 mr-2 text-orange-400/70" /> Print PDF (bleed)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { stop(e); downloadBookFile(book.id, "epub"); }} className="text-xs font-mono cursor-pointer" data-testid={`menu-export-epub-${book.id}`}>
          <BookOpen className="h-3.5 w-3.5 mr-2 text-emerald-400/70" /> Export EPUB
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { stop(e); downloadBookFile(book.id, "mobi"); }} className="text-xs font-mono cursor-pointer" data-testid={`menu-export-mobi-${book.id}`}>
          <BookOpen className="h-3.5 w-3.5 mr-2 text-blue-400/70" /> Export MOBI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { stop(e); downloadBookFile(book.id, "docx"); }} className="text-xs font-mono cursor-pointer" data-testid={`menu-export-docx-${book.id}`}>
          <FileText className="h-3.5 w-3.5 mr-2 text-sky-400/70" /> Export DOCX
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { stop(e); downloadBookFile(book.id, "txt"); }} className="text-xs font-mono cursor-pointer" data-testid={`menu-export-txt-${book.id}`}>
          <FileText className="h-3.5 w-3.5 mr-2 text-cyan-400/70" /> Export TXT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { stop(e); downloadBookFile(book.id, "html"); }} className="text-xs font-mono cursor-pointer" data-testid={`menu-export-html-${book.id}`}>
          <FileCode className="h-3.5 w-3.5 mr-2 text-purple-400/70" /> Export HTML
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Library() {
  const [search, setSearch] = useState("");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [view, setView] = useState<LibraryView>("covers");
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
    <div className="lexora-page">
      <Helmet>
        <title>Library — Lexora</title>
        <meta name="description" content="Your Lexora library of completed books, narrated editions, and published worlds." />
      </Helmet>

      <div className="mx-auto max-w-[1480px] space-y-8 px-4 py-6 md:px-8 md:py-9">
        <LexoraPageHeader
          kicker="Library"
          title={<>Your Worlds <span className="text-[#BCAF9F]/45">live here.</span></>}
          description="Browse finished books as covers, editorial editions, or a compact working catalog."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInvites(!showInvites)}
              className="h-9 rounded-full border-[#C0A06B]/15 bg-transparent px-4 text-[#BCAF9F]/65 hover:bg-white/[.03] hover:text-[#EFE5D9]"
              data-testid="button-toggle-invites"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" /> Reader invites {invites.length > 0 ? `(${invites.length})` : ""}
            </Button>
          }
        />

        {showInvites ? (
          <section className="lexora-editorial-surface rounded-[24px] p-5 md:p-6">
            <div className="mb-4">
              <p className="lexora-kicker">Reader access</p>
              <h2 className="lexora-display mt-1 text-xl font-semibold text-[#EFE5D9]">Share your collection</h2>
              <p className="mt-1 text-sm leading-6 text-[#BCAF9F]/50">Create private reader links for beta readers, collaborators, or launch groups.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={inviteLabel}
                onChange={event => setInviteLabel(event.target.value)}
                placeholder="Invite label"
                className="h-10 flex-1 border-[#C0A06B]/10 bg-white/[.025]"
                data-testid="input-invite-label"
              />
              <Button
                onClick={() => createInviteMutation.mutate(inviteLabel)}
                disabled={createInviteMutation.isPending}
                className="h-10 bg-[#7E3E51] text-[#FFF9F2] hover:bg-[#915065]"
                data-testid="button-create-invite"
              >
                {createInviteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Create invite
              </Button>
            </div>
            {invites.length > 0 ? (
              <div className="mt-5 divide-y divide-[#C0A06B]/10 border-y border-[#C0A06B]/10">
                {invites.map(invite => (
                  <div key={invite.id} className="flex items-center gap-3 py-3" data-testid={`invite-${invite.id}`}>
                    <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[#C0A06B]/55" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-[#EFE5D9]">{invite.label}</p>
                      <p className="truncate font-mono text-[9px] text-[#BCAF9F]/30">{window.location.origin}/store/{invite.token}</p>
                    </div>
                    <span className="hidden items-center gap-1 font-mono text-[9px] text-[#BCAF9F]/30 sm:flex"><Eye className="h-3 w-3" />{invite.viewCount}</span>
                    <Button size="icon" variant="ghost" onClick={() => copyInviteLink(invite.token)} className="h-8 w-8 text-[#BCAF9F]/40 hover:text-[#EFE5D9]" data-testid={`button-copy-invite-${invite.id}`} aria-label="Copy invite link"><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteInviteMutation.mutate(invite.id)} className="h-8 w-8 text-[#BCAF9F]/30 hover:text-red-400" data-testid={`button-delete-invite-${invite.id}`} aria-label="Delete invite"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="lexora-divider" />

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#BCAF9F]/30" />
            <Input
              data-testid="input-library-search"
              placeholder="Search titles, authors, genres..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="h-11 border-[#C0A06B]/10 bg-white/[.025] pl-10 text-sm placeholder:text-[#BCAF9F]/28 focus-visible:ring-[#C0A06B]/25"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={verticalFilter} onValueChange={setVerticalFilter}>
              <SelectTrigger className="h-10 w-[150px] border-[#C0A06B]/10 bg-white/[.02] text-[11px]" data-testid="select-vertical-filter">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-[#BCAF9F]/35" />
                <SelectValue placeholder="All genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genres</SelectItem>
                {verticals.map(vertical => <SelectItem key={vertical} value={vertical}>{VERTICAL_LABELS[vertical] || vertical}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={value => setSortBy(value as SortKey)}>
              <SelectTrigger className="h-10 w-[135px] border-[#C0A06B]/10 bg-white/[.02] text-[11px]" data-testid="select-sort">
                <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-[#BCAF9F]/35" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank">By rank</SelectItem>
                <SelectItem value="title">By title</SelectItem>
                <SelectItem value="words">By words</SelectItem>
                <SelectItem value="quality">By quality</SelectItem>
                <SelectItem value="date">By date</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex h-10 items-center rounded-xl border border-[#C0A06B]/10 bg-white/[.02] p-1">
              {([
                ["covers", LayoutGrid, "Covers"],
                ["editorial", Rows3, "Editorial"],
                ["compact", List, "Compact"],
              ] as const).map(([mode, Icon, label]) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setView(mode)}
                  className={`h-8 rounded-lg px-2.5 ${view === mode ? "bg-[#7E3E51]/18 text-[#EFE5D9]" : "text-[#BCAF9F]/40 hover:text-[#EFE5D9]"}`}
                  aria-label={label}
                  data-testid={`library-view-${mode}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[0,1,2,3,4].map(item => <Skeleton key={item} className="aspect-[2/3] rounded-[18px] bg-white/[.035]" />)}
          </div>
        ) : books.length === 0 ? (
          <EmptyCreativeState
            title="Your library is waiting for its first book."
            description="Finish a project and it will arrive here with its cover, reader, narration, and export tools."
            action={<Link href="/projects/new"><Button className="rounded-full bg-[#7E3E51] text-[#FFF9F2] hover:bg-[#915065]"><BookOpen className="mr-2 h-4 w-4" /> Start a project</Button></Link>}
          />
        ) : filtered.length === 0 ? (
          <EmptyCreativeState title="No worlds match that search." description="Try a different title, author, genre, or clear the active filters." icon={Search} />
        ) : view === "covers" ? (
          <EditorialSection eyebrow="Covers" title={`${filtered.length} finished ${filtered.length === 1 ? "world" : "worlds"}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filtered.map(book => (
                <div key={book.id} className="min-w-0">
                  <ProjectCoverCard
                    id={book.id}
                    title={book.title}
                    href={`/projects/${book.id}`}
                    coverUrl={book.hasCover ? `/api/projects/${book.id}/cover-image` : null}
                    status="Complete"
                    genre={VERTICAL_LABELS[book.vertical] || book.vertical}
                    meta={`${book.wordCount.toLocaleString()} words · ${book.chapterCount} chapters`}
                  />
                  <div className="mt-2 flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-8 flex-1 justify-start px-2 text-[10px] text-[#BCAF9F]/55 hover:text-[#EFE5D9]" onClick={() => openReader(book)} disabled={loadingReaderId === book.id} data-testid={`button-read-library-${book.id}`}>
                      {loadingReaderId === book.id ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Eye className="mr-1.5 h-3 w-3" />} Read
                    </Button>
                    <ExportMenu book={book} variant="card" />
                  </div>
                </div>
              ))}
            </div>
          </EditorialSection>
        ) : view === "editorial" ? (
          <EditorialSection eyebrow="Editorial" title="Edition details at a glance">
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map(book => (
                <div key={book.id} className="lexora-editorial-surface rounded-[22px] p-4">
                  <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-4">
                    <ProjectCoverCard
                      id={book.id}
                      title={book.title}
                      href={`/projects/${book.id}`}
                      coverUrl={book.hasCover ? `/api/projects/${book.id}/cover-image` : null}
                      compact
                    />
                    <div className="min-w-0">
                      <p className="lexora-kicker">{VERTICAL_LABELS[book.vertical] || book.vertical}</p>
                      <Link href={`/projects/${book.id}`}><h3 className="lexora-display mt-1 line-clamp-2 text-xl font-semibold text-[#EFE5D9]">{book.title}</h3></Link>
                      <p className="mt-1 text-[11px] text-[#BCAF9F]/45">{book.authorName || "Unknown author"} · #{book.rank}</p>
                    </div>
                  </div>
                  {book.shortBlurb ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#BCAF9F]/55">{book.shortBlurb}</p> : null}
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#C0A06B]/10 pt-3 font-mono text-[9px] text-[#BCAF9F]/35">
                    <span>{book.wordCount.toLocaleString()} words</span>
                    <span>{book.chapterCount} chapters</span>
                    {book.chaptersWithAudio > 0 ? <span>{book.chaptersWithAudio} narrated</span> : null}
                    {book.qualityScore ? <span>★ {formatScore(book.qualityScore)}</span> : null}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-[10px] text-[#BCAF9F]/55 hover:text-[#EFE5D9]" onClick={() => openReader(book)} disabled={loadingReaderId === book.id} data-testid={`button-read-editorial-${book.id}`}><Eye className="mr-1.5 h-3 w-3" /> Read</Button>
                    <ExportMenu book={book} variant="row" />
                  </div>
                </div>
              ))}
            </div>
          </EditorialSection>
        ) : (
          <EditorialSection eyebrow="Compact" title="Working catalog">
            <div className="divide-y divide-[#C0A06B]/10 border-y border-[#C0A06B]/10">
              {filtered.map(book => (
                <div key={book.id} className="flex min-w-0 items-center gap-3 py-3" data-testid={`library-book-${book.id}`}>
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-[#C0A06B]/10">
                    {book.hasCover ? <img src={`/api/projects/${book.id}/cover-image`} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="lexora-cover-placeholder h-full w-full" />}
                  </div>
                  <Link href={`/projects/${book.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#EFE5D9]">{book.title}</p>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-[#BCAF9F]/32">{book.authorName || "Unknown"} · {book.wordCount.toLocaleString()} words · {book.chapterCount} ch</p>
                  </Link>
                  {book.qualityScore ? <span className="hidden font-mono text-[10px] text-[#C0A06B]/60 sm:inline">★ {formatScore(book.qualityScore)}</span> : null}
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-[10px] text-[#BCAF9F]/50 hover:text-[#EFE5D9]" onClick={() => openReader(book)} disabled={loadingReaderId === book.id} data-testid={`button-read-list-${book.id}`}><Eye className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Read</span></Button>
                  <ExportMenu book={book} variant="row" />
                </div>
              ))}
            </div>
          </EditorialSection>
        )}

        <div className="pb-8" />
      </div>

      {readerBook && (
        <BookReader
          title={readerBook.title}
          authorName={readerBook.authorName || "Unknown Author"}
          chapters={readerChapters}
          coverImageUrl={readerBook.coverImageUrl}
          projectId={readerBook.id}
          onClose={() => { setReaderBook(null); setReaderChapters([]); }}
          onStartNarration={startNarration}
        />
      )}
    </div>
  );
}
