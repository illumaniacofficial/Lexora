import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Star, ShoppingBag, ArrowLeft, Volume2, AlertCircle, Sparkles, Send, CheckCircle2, Lightbulb } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, VERTICAL_ICONS, formatScore, scoreColor } from "@/lib/utils";
import { VERTICALS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import BookReader from "@/components/book-reader";
import type { NarrationState } from "@/components/audio-mini-player";
import AudioMiniPlayer from "@/components/audio-mini-player";
import { useNarration } from "@/App";

interface StoreBook {
  id: number;
  title: string;
  authorName: string;
  vertical: string;
  hasCover: boolean;
  wordCount: number;
  chapterCount: number;
  qualityScore: number | null;
  shortBlurb: string | null;
  mediumBlurb: string | null;
}

interface StoreBookDetail extends StoreBook {
  coverImageUrl: string | null;
  chapters: { id: number; chapterNumber: number; title: string; content: string | null; wordCount: number; status: string }[];
}

export default function Storefront() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [showReader, setShowReader] = useState(false);
  const [narrationState, setNarrationState] = useState<NarrationState | null>(null);
  const { requestNavigateToPage } = useNarration();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [requestName, setRequestName] = useState("");
  const [requestGenre, setRequestGenre] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const { toast } = useToast();

  const submitRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/${token}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readerName: requestName.trim() || "Anonymous",
          genre: requestGenre,
          description: requestDescription.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      setRequestSubmitted(true);
      setRequestName("");
      setRequestGenre("");
      setRequestDescription("");
      toast({ title: "Request sent!", description: "The author will review your book suggestion." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send request", description: err.message, variant: "destructive" });
    },
  });

  const { data: storeData, isLoading, error } = useQuery<{ books: StoreBook[]; inviteLabel: string }>({
    queryKey: ["/api/store", token],
    queryFn: async () => {
      const res = await fetch(`/api/store/${token}`);
      if (!res.ok) throw new Error("Invalid or expired invite link");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: bookDetail, isLoading: bookLoading } = useQuery<StoreBookDetail>({
    queryKey: ["/api/store", token, "book", selectedBookId],
    queryFn: async () => {
      const res = await fetch(`/api/store/${token}/book/${selectedBookId}`);
      if (!res.ok) throw new Error("Book not found");
      return res.json();
    },
    enabled: !!selectedBookId && !!token,
  });

  const categories = storeData?.books
    ? Array.from(new Set(storeData.books.map(b => b.vertical))).sort()
    : [];

  const filteredBooks = storeData?.books
    ? activeCategory === "all"
      ? storeData.books
      : storeData.books.filter(b => b.vertical === activeCategory)
    : [];

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <Helmet><title>Invalid Invite — Lexora</title></Helmet>
        <div className="text-center max-w-sm">
          <AlertCircle className="h-16 w-16 text-red-400/40 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">Invite Not Found</h1>
          <p className="text-sm text-stone-400">This invite link is invalid or has expired. Please ask the author for a new one.</p>
        </div>
      </div>
    );
  }

  if (selectedBookId && bookDetail) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <Helmet><title>{bookDetail.title} — Lexora Store</title></Helmet>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <button
            onClick={() => { setSelectedBookId(null); setShowReader(false); }}
            className="flex items-center gap-2 text-sm text-stone-400 hover:text-purple-300 transition-colors mb-5 md:mb-8 group"
            data-testid="button-back-to-store"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Back to store
          </button>

          <div className="flex flex-col md:flex-row gap-5 md:gap-8">
            {bookDetail.coverImageUrl && (
              <div className="shrink-0 flex justify-center md:justify-start">
                <div className="w-40 h-60 md:w-56 md:h-80 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(147,51,234,0.15)] border border-purple-500/10">
                  <img src={bookDetail.coverImageUrl} alt={bookDetail.title} className="w-full h-full object-cover" data-testid="img-book-cover" />
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{VERTICAL_ICONS[bookDetail.vertical] || "📖"}</span>
                <Badge variant="outline" className="text-[9px] font-mono border-purple-500/20 text-purple-400">
                  {VERTICAL_LABELS[bookDetail.vertical] || bookDetail.vertical}
                </Badge>
                {bookDetail.qualityScore && (
                  <Badge variant="outline" className={`text-[9px] font-mono border-emerald-500/20 ${scoreColor(bookDetail.qualityScore)}`}>
                    <Star className="h-2.5 w-2.5 mr-1" /> {formatScore(bookDetail.qualityScore)}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" data-testid="text-book-title">{bookDetail.title}</h1>
              <p className="text-sm text-stone-400 font-mono mb-4">by {bookDetail.authorName || "Unknown Author"}</p>

              {bookDetail.mediumBlurb ? (
                <p className="text-sm text-stone-300 leading-relaxed mb-4" data-testid="text-book-blurb">{bookDetail.mediumBlurb}</p>
              ) : bookDetail.shortBlurb ? (
                <p className="text-sm text-stone-300 leading-relaxed mb-4" data-testid="text-book-blurb">{bookDetail.shortBlurb}</p>
              ) : null}

              <div className="flex items-center gap-4 text-xs font-mono text-stone-500 mb-6">
                <span>{bookDetail.wordCount.toLocaleString()} words</span>
                <span>{bookDetail.chapters.length} chapters</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  onClick={() => setShowReader(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-mono text-sm px-6 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                  data-testid="button-read-book"
                >
                  <BookOpen className="h-4 w-4 mr-2" /> Read Book
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReader(true)}
                  className="border-purple-500/20 text-purple-300 hover:bg-purple-500/10 font-mono text-sm"
                  data-testid="button-listen-book"
                >
                  <Volume2 className="h-4 w-4 mr-2" /> Listen with AI
                </Button>
              </div>

              <div className="mt-8 border-t border-stone-800 pt-6">
                <h3 className="text-xs font-mono text-stone-500 uppercase tracking-wider mb-3">Chapters</h3>
                <div className="space-y-1.5">
                  {bookDetail.chapters.map(ch => (
                    <div key={ch.id} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-lg hover:bg-stone-800/50 transition-colors">
                      <span className="text-xs font-mono text-stone-500 w-6">{ch.chapterNumber}.</span>
                      <span className="text-stone-300 flex-1 truncate">{ch.title}</span>
                      <span className="text-[10px] font-mono text-stone-600">{ch.wordCount.toLocaleString()} w</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showReader && bookDetail.chapters.length > 0 && (
          <BookReader
            title={bookDetail.title}
            authorName={bookDetail.authorName || "Unknown Author"}
            chapters={bookDetail.chapters as any}
            coverImageUrl={bookDetail.coverImageUrl}
            onClose={() => setShowReader(false)}
            onStartNarration={(narration) => setNarrationState(narration)}
          />
        )}

        {narrationState && !showReader && (
          <AudioMiniPlayer
            narration={narrationState}
            onClose={() => setNarrationState(null)}
            onUpdateNarration={(updated) => setNarrationState(updated)}
            onTitleClick={(globalIdx) => {
              if (globalIdx !== undefined) requestNavigateToPage(globalIdx);
              setShowReader(true);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Helmet>
        <title>Lexora Store — Browse Books</title>
        <meta name="description" content="Browse and read published books from Lexora." />
      </Helmet>

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-500/5 rounded-full blur-[100px]" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-[10px] font-mono text-purple-400/60 uppercase tracking-[0.3em]">Lexora</span>
            <Sparkles className="h-4 w-4 text-purple-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">Book Collection</span>
          </h1>
          <p className="text-stone-400 text-sm max-w-md mx-auto">
            {storeData?.inviteLabel || "Browse and read our published books with AI-powered narration"}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-12 md:pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-80 rounded-xl bg-stone-800/50" />)}
          </div>
        ) : !storeData?.books.length ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 text-stone-700 mx-auto mb-4" />
            <p className="text-lg font-medium text-stone-400">No books available yet</p>
            <p className="text-xs text-stone-600 mt-1">Check back later for new releases</p>
          </div>
        ) : (
          <>
            {categories.length > 1 && (
              <div className="flex items-center gap-2 mb-6 flex-wrap" data-testid="store-category-filters">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                    activeCategory === "all"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-stone-800/50 text-stone-400 border border-stone-700/50 hover:border-stone-600 hover:text-stone-300"
                  }`}
                  data-testid="filter-all"
                >
                  All ({storeData.books.length})
                </button>
                {categories.map(cat => {
                  const count = storeData.books.filter(b => b.vertical === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 flex items-center gap-1.5 ${
                        activeCategory === cat
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-stone-800/50 text-stone-400 border border-stone-700/50 hover:border-stone-600 hover:text-stone-300"
                      }`}
                      data-testid={`filter-${cat}`}
                    >
                      <span>{VERTICAL_ICONS[cat] || "📖"}</span>
                      <span>{VERTICAL_LABELS[cat] || cat}</span>
                      <span className="text-[9px] opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBooks.map(book => (
              <button
                key={book.id}
                onClick={() => setSelectedBookId(book.id)}
                className="text-left group cursor-pointer"
                data-testid={`store-book-${book.id}`}
              >
                <Card className="bg-stone-900/50 border-stone-800/50 hover:border-purple-500/20 transition-all duration-300 overflow-hidden h-full">
                  {book.hasCover && (
                    <div className="relative w-full aspect-[3/4] overflow-hidden">
                      <img
                        src={`/api/projects/${book.id}/cover-image`}
                        alt={book.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        data-testid={`img-store-cover-${book.id}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="font-bold text-sm text-white line-clamp-2 drop-shadow-lg">{book.title}</h3>
                        <p className="text-[10px] text-stone-300/70 font-mono mt-0.5">{book.authorName || "Unknown Author"}</p>
                      </div>
                      {book.qualityScore && (
                        <div className="absolute top-2.5 right-2.5">
                          <Badge variant="outline" className="text-[9px] font-mono border-amber-500/30 text-amber-300 backdrop-blur-sm bg-black/40">
                            <Star className="h-2.5 w-2.5 mr-0.5" /> {formatScore(book.qualityScore)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                  <CardContent className={`pb-4 ${book.hasCover ? "pt-3" : "pt-5"}`}>
                    {!book.hasCover && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{VERTICAL_ICONS[book.vertical] || "📖"}</span>
                          <Badge variant="outline" className="text-[8px] font-mono border-stone-700 text-stone-500">
                            {VERTICAL_LABELS[book.vertical] || book.vertical}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-sm text-white line-clamp-2 mb-1 group-hover:text-purple-300 transition-colors">{book.title}</h3>
                        <p className="text-[10px] text-stone-500 font-mono mb-2">{book.authorName || "Unknown Author"}</p>
                      </>
                    )}
                    {book.shortBlurb && (
                      <p className="text-[11px] text-stone-400 leading-relaxed line-clamp-3 mb-3">{book.shortBlurb}</p>
                    )}
                    <div className="flex items-center gap-3 text-[9px] font-mono text-stone-600 pt-2 border-t border-stone-800/50">
                      <span>{(book.wordCount || 0).toLocaleString()} words</span>
                      <span>{book.chapterCount} ch</span>
                      {book.hasCover && (
                        <span className="ml-auto text-purple-400/50 flex items-center gap-1">
                          <Volume2 className="h-2.5 w-2.5" /> AI Narrator
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
          </>
        )}

        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent pointer-events-none" />
          <div className="relative max-w-xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-4">
                <Lightbulb className="h-5 w-5 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Request a Book</h2>
              <p className="text-sm text-stone-400 max-w-sm mx-auto">
                Have an idea for a book you'd love to read? Let the author know what you're looking for.
              </p>
            </div>

            {requestSubmitted ? (
              <Card className="bg-stone-900/50 border-emerald-500/20" data-testid="request-success">
                <CardContent className="py-10 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-1">Request Sent!</h3>
                  <p className="text-sm text-stone-400 mb-6">Thank you for your suggestion. The author will review it soon.</p>
                  <Button
                    variant="outline"
                    onClick={() => setRequestSubmitted(false)}
                    className="border-stone-700 text-stone-300 hover:bg-stone-800 text-sm"
                    data-testid="button-request-another"
                  >
                    Submit Another Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-stone-900/50 border-stone-800/50" data-testid="request-form-card">
                <CardContent className="pt-6 pb-6 space-y-4">
                  <div>
                    <label className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-1.5 block">Your Name (optional)</label>
                    <Input
                      value={requestName}
                      onChange={(e) => setRequestName(e.target.value)}
                      placeholder="Anonymous"
                      className="bg-stone-800/50 border-stone-700/50 text-white placeholder:text-stone-600 focus-visible:ring-purple-500/30"
                      data-testid="input-request-name"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-1.5 block">Genre / Category *</label>
                    <Select value={requestGenre} onValueChange={setRequestGenre}>
                      <SelectTrigger
                        className="bg-stone-800/50 border-stone-700/50 text-white focus:ring-purple-500/30"
                        data-testid="select-request-genre"
                      >
                        <SelectValue placeholder="Select a genre..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {VERTICALS.map(v => (
                          <SelectItem key={v} value={v}>
                            {VERTICAL_ICONS[v] || "📖"} {VERTICAL_LABELS[v] || v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mb-1.5 block">What kind of book would you like? *</label>
                    <Textarea
                      value={requestDescription}
                      onChange={(e) => setRequestDescription(e.target.value.slice(0, 1000))}
                      placeholder="Describe the type of book you're looking for — topic, style, what problems it should solve, or any specific ideas..."
                      rows={4}
                      className="bg-stone-800/50 border-stone-700/50 text-white placeholder:text-stone-600 focus-visible:ring-purple-500/30 resize-none"
                      data-testid="textarea-request-description"
                    />
                    <p className="text-[10px] font-mono text-stone-600 mt-1 text-right">{requestDescription.length}/1000</p>
                  </div>
                  <Button
                    onClick={() => submitRequest.mutate()}
                    disabled={!requestGenre || !requestDescription.trim() || submitRequest.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-mono text-sm shadow-[0_0_20px_rgba(147,51,234,0.2)] disabled:opacity-40"
                    data-testid="button-submit-request"
                  >
                    {submitRequest.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="h-3.5 w-3.5" /> Send Request
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="mt-16 text-center border-t border-stone-800/50 pt-8">
          <p className="text-[10px] font-mono text-stone-700">Powered by Lexora</p>
        </div>
      </div>
    </div>
  );
}
