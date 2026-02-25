import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Star, ShoppingBag, ArrowLeft, Volume2, AlertCircle, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, VERTICAL_ICONS, formatScore, scoreColor } from "@/lib/utils";
import BookReader from "@/components/book-reader";
import type { NarrationState } from "@/components/audio-mini-player";
import AudioMiniPlayer from "@/components/audio-mini-player";

interface StoreBook {
  id: number;
  title: string;
  authorName: string;
  vertical: string;
  coverImageUrl: string | null;
  wordCount: number;
  chapterCount: number;
  qualityScore: number | null;
  shortBlurb: string | null;
  mediumBlurb: string | null;
}

interface StoreBookDetail extends StoreBook {
  chapters: { id: number; chapterNumber: number; title: string; content: string | null; wordCount: number; status: string }[];
}

export default function Storefront() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [showReader, setShowReader] = useState(false);
  const [narrationState, setNarrationState] = useState<NarrationState | null>(null);

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

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <Helmet><title>Invalid Invite — BookForge Studio</title></Helmet>
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
        <Helmet><title>{bookDetail.title} — BookForge Store</title></Helmet>
        <div className="max-w-4xl mx-auto p-6">
          <button
            onClick={() => { setSelectedBookId(null); setShowReader(false); }}
            className="flex items-center gap-2 text-sm text-stone-400 hover:text-purple-300 transition-colors mb-8 group"
            data-testid="button-back-to-store"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Back to store
          </button>

          <div className="flex flex-col md:flex-row gap-8">
            {bookDetail.coverImageUrl && (
              <div className="shrink-0">
                <div className="w-56 h-80 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(147,51,234,0.15)] border border-purple-500/10">
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

              <h1 className="text-3xl font-bold tracking-tight mb-1" data-testid="text-book-title">{bookDetail.title}</h1>
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

              <div className="flex gap-3">
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
                  <Volume2 className="h-4 w-4 mr-2" /> Listen with AI Narrator
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
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Helmet>
        <title>BookForge Store — Browse Books</title>
        <meta name="description" content="Browse and read published books from BookForge Studio Supreme." />
      </Helmet>

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-500/5 rounded-full blur-[100px]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-[10px] font-mono text-purple-400/60 uppercase tracking-[0.3em]">BookForge Studio</span>
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

      <div className="max-w-5xl mx-auto px-6 pb-16">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {storeData.books.map(book => (
              <button
                key={book.id}
                onClick={() => setSelectedBookId(book.id)}
                className="text-left group cursor-pointer"
                data-testid={`store-book-${book.id}`}
              >
                <Card className="bg-stone-900/50 border-stone-800/50 hover:border-purple-500/20 transition-all duration-300 overflow-hidden h-full">
                  {book.coverImageUrl && (
                    <div className="relative w-full aspect-[3/4] overflow-hidden">
                      <img
                        src={book.coverImageUrl}
                        alt={book.title}
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
                  <CardContent className={`pb-4 ${book.coverImageUrl ? "pt-3" : "pt-5"}`}>
                    {!book.coverImageUrl && (
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
                      <span>{book.wordCount.toLocaleString()} words</span>
                      <span>{book.chapterCount} ch</span>
                      {book.coverImageUrl && (
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
        )}

        <div className="mt-16 text-center border-t border-stone-800/50 pt-8">
          <p className="text-[10px] font-mono text-stone-700">Powered by BookForge Studio Supreme</p>
        </div>
      </div>
    </div>
  );
}
