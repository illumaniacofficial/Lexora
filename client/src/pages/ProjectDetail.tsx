import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, TrendingUp, List, PenTool, Megaphone, Image, Play, CheckCircle, Clock, X,
  Loader2, AlertCircle, BookOpen, Zap, Star, FileText, RefreshCw, ChevronDown, ChevronUp, Download, User, Hexagon, Eye, FileDown, Volume2,
  Save, Edit3, Check, Music, ArrowRight, Globe, Wand2,
  ClipboardCheck, Users, Sparkles, Gauge, MessageSquareQuote, Activity, TextCursorInput,
  Target, Search, Tag, Crosshair,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { cn, formatScore, scoreColor, statusLabel, VERTICAL_LABELS, STATUS_GLOW, VERTICAL_ICONS, sanitizeHtml } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportBookPdf, TRIM_SIZES } from "@/lib/export-book";
import { useToast } from "@/hooks/use-toast";
import BookReader from "@/components/book-reader";
import { useNarration } from "@/App";
import { MarkdownRendererDark, stripMarkdown } from "@/components/markdown-renderer";
import type { Project, Chapter, RunStep, BookDna, MarketingAsset, TrendReport, ChapterAnalysis, Series, StyleFingerprint, StoryEntity, MarketReport, RevenueForecast, AbTest, CoverVariant, BrandKit, ExportJob } from "@shared/schema";
import { Network, Library, Fingerprint, Plus, Trash2, DollarSign, FlaskConical, Trophy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

interface ProjectDetailData {
  project: Project;
  chapters: Chapter[];
  runSteps: RunStep[];
  bookDna?: BookDna;
  marketing?: MarketingAsset;
  trendReport?: TrendReport;
  chapterAnalyses?: ChapterAnalysis[];
  storyEntities?: StoryEntity[];
  marketReports?: MarketReport[];
  revenueForecasts?: RevenueForecast[];
  abTests?: AbTest[];
  series?: Series;
  styleFingerprint?: StyleFingerprint;
  coverVariants?: CoverVariant[];
  exportJobs?: ExportJob[];
  brandKit?: BrandKit;
}

interface ForecastMonthData { month: number; units: number; gross: number; royalty: number; cumulative: number }
interface ForecastScenarioData { name: string; multiplier: number; totalRoyalty: number; totalUnits: number; months: ForecastMonthData[] }
interface RevenueProjectionData { scenarios: ForecastScenarioData[]; baseTotalRoyalty: number; baseTotalUnits: number; perUnitRoyalty: number }
interface ForecastAssumptionsData { listPrice: number; royaltyRate: number; monthlyUnits: number; monthlyGrowth: number; months: number; platformFeePerUnit: number }
interface AbVariantData { text: string; appealScore: number; ctr: number; rationale: string }

interface EntityProfile { description?: string; role?: string; traits?: string }
interface EntityRelationship { to: string; relation: string }
interface SeriesBible { summary?: string; characters?: string; world?: string; timeline?: string; notes?: string }

interface EditorialBoardData {
  reviewers: { role: string; score: number; summary: string; suggestions: { excerpt: string; issue: string; fix: string }[] }[];
  overallScore: number;
}
interface HumanizerData {
  beforeScore: number;
  afterScore: number;
  signals: string[];
  summary: string;
}
interface BetaReadersData {
  readers: { persona: string; rating: number; quote: string; liked: string; critique: string }[];
  avgRating: number;
}


function StepStatus({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-muted-foreground/30" />;
}

function scoreToneClass(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.75) return "text-emerald-400";
  if (pct >= 0.5) return "text-amber-400";
  return "text-red-400";
}

function aiScoreToneClass(score: number): string {
  if (score <= 33) return "text-emerald-400";
  if (score <= 66) return "text-amber-400";
  return "text-red-400";
}

function EditorialPanel({
  analyses, isProjectComplete,
  onRunBoard, onRunHumanize, onRunBeta,
  boardPending, humanizePending, betaPending,
}: {
  analyses: ChapterAnalysis[];
  isProjectComplete: boolean;
  onRunBoard: () => void;
  onRunHumanize: () => void;
  onRunBeta: () => void;
  boardPending: boolean;
  humanizePending: boolean;
  betaPending: boolean;
}) {
  const latest = (kind: string) => analyses.find(a => a.kind === kind);
  const board = latest("editorial_board")?.data as EditorialBoardData | undefined;
  const humanizer = latest("humanizer")?.data as HumanizerData | undefined;
  const beta = latest("beta_readers")?.data as BetaReadersData | undefined;
  const tsLabel = (kind: string) => {
    const a = latest(kind);
    return a?.createdAt ? new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  };

  return (
    <div className="px-4 pb-4 border-t border-cyan-500/15">
      <Tabs defaultValue="board" className="mt-3">
        <TabsList className="bg-card/40 border border-border/20 h-8">
          <TabsTrigger value="board" className="text-[9px] font-mono px-2 h-6" data-testid="tab-editorial-board">
            <ClipboardCheck className="h-2.5 w-2.5 mr-1" /> BOARD
          </TabsTrigger>
          <TabsTrigger value="humanize" className="text-[9px] font-mono px-2 h-6" data-testid="tab-editorial-humanize">
            <Sparkles className="h-2.5 w-2.5 mr-1" /> HUMANIZE
          </TabsTrigger>
          <TabsTrigger value="beta" className="text-[9px] font-mono px-2 h-6" data-testid="tab-editorial-beta">
            <Users className="h-2.5 w-2.5 mr-1" /> BETA READERS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-muted-foreground/50">
              {board ? `Last run ${tsLabel("editorial_board")}` : "Run a specialist editorial review of this chapter."}
            </span>
            <Button
              size="sm" variant="outline"
              className="h-6 text-[9px] font-mono border-cyan-500/20 text-cyan-400 hover:border-cyan-500/40 px-2"
              onClick={onRunBoard} disabled={boardPending}
              data-testid="button-run-editorial-board"
            >
              {boardPending ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : <ClipboardCheck className="h-2.5 w-2.5 mr-0.5" />}
              {board ? "Re-run" : "Run Review"}
            </Button>
          </div>
          {board ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gauge className="h-3 w-3 text-cyan-400" />
                <span className="text-[10px] font-mono text-muted-foreground/60">Overall</span>
                <span className={cn("text-[12px] font-bold font-mono", scoreToneClass(board.overallScore, 10))} data-testid="text-board-overall">
                  {board.overallScore.toFixed(1)}/10
                </span>
              </div>
              {board.reviewers.map((rev, i) => (
                <div key={i} className="border border-border/20 rounded-lg p-2.5 bg-card/30" data-testid={`reviewer-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold tracking-tight">{rev.role}</span>
                    <span className={cn("text-[11px] font-bold font-mono", scoreToneClass(rev.score, 10))}>{rev.score.toFixed(1)}/10</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 leading-relaxed mb-1.5">{rev.summary}</p>
                  <div className="space-y-1.5">
                    {rev.suggestions.map((s, j) => (
                      <div key={j} className="text-[9px] font-mono border-l-2 border-cyan-500/20 pl-2">
                        {s.excerpt && <p className="text-cyan-400/60 italic">"{s.excerpt}"</p>}
                        <p className="text-red-400/70">{s.issue}</p>
                        <p className="text-emerald-400/70">→ {s.fix}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/40 font-mono py-3 text-center">No review yet.</p>
          )}
        </TabsContent>

        <TabsContent value="humanize" className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-muted-foreground/50">
              {humanizer ? `Last run ${tsLabel("humanizer")}` : "Score AI-ness and rewrite to sound natural."}
            </span>
            <Button
              size="sm" variant="outline"
              className="h-6 text-[9px] font-mono border-purple-500/20 text-purple-400 hover:border-purple-500/40 px-2"
              onClick={onRunHumanize} disabled={humanizePending || isProjectComplete}
              data-testid="button-run-humanize"
            >
              {humanizePending ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5 mr-0.5" />}
              {humanizer ? "Re-humanize" : "Humanize"}
            </Button>
          </div>
          {isProjectComplete && (
            <p className="text-[9px] font-mono text-amber-400/60 mb-2">Revert the book to editing to humanize chapters.</p>
          )}
          {humanizer ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-[8px] font-mono text-muted-foreground/40">BEFORE</p>
                  <p className={cn("text-[14px] font-bold font-mono", aiScoreToneClass(humanizer.beforeScore))} data-testid="text-humanize-before">{humanizer.beforeScore}</p>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-[8px] font-mono text-muted-foreground/40">AFTER</p>
                  <p className={cn("text-[14px] font-bold font-mono", aiScoreToneClass(humanizer.afterScore))} data-testid="text-humanize-after">{humanizer.afterScore}</p>
                </div>
                <span className="text-[8px] font-mono text-muted-foreground/40">AI-pattern score (0 = human, 100 = robotic)</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70">{humanizer.summary}</p>
              {humanizer.signals?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {humanizer.signals.map((sig, i) => (
                    <Badge key={i} variant="outline" className="text-[8px] font-mono border-amber-500/20 bg-amber-500/5 text-amber-400/80">{sig}</Badge>
                  ))}
                </div>
              )}
              <p className="text-[8px] font-mono text-muted-foreground/30">The chapter draft has been rewritten and saved.</p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/40 font-mono py-3 text-center">Not humanized yet.</p>
          )}
        </TabsContent>

        <TabsContent value="beta" className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-muted-foreground/50">
              {beta ? `Last run ${tsLabel("beta_readers")}` : "Get reactions from synthetic reader personas."}
            </span>
            <Button
              size="sm" variant="outline"
              className="h-6 text-[9px] font-mono border-pink-500/20 text-pink-400 hover:border-pink-500/40 px-2"
              onClick={onRunBeta} disabled={betaPending}
              data-testid="button-run-beta-readers"
            >
              {betaPending ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : <Users className="h-2.5 w-2.5 mr-0.5" />}
              {beta ? "Re-run" : "Run Readers"}
            </Button>
          </div>
          {beta ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="h-3 w-3 text-pink-400" />
                <span className="text-[10px] font-mono text-muted-foreground/60">Average</span>
                <span className="text-[12px] font-bold font-mono text-pink-400" data-testid="text-beta-avg">{beta.avgRating.toFixed(1)}/5</span>
              </div>
              {beta.readers.map((r, i) => (
                <div key={i} className="border border-border/20 rounded-lg p-2.5 bg-card/30" data-testid={`beta-reader-${i}`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground/60 line-clamp-1">{r.persona}</span>
                    <span className="text-[11px] font-bold font-mono text-pink-400 shrink-0">{r.rating.toFixed(1)}★</span>
                  </div>
                  <p className="text-[10px] italic text-foreground/80 flex gap-1">
                    <MessageSquareQuote className="h-3 w-3 text-pink-400/50 shrink-0 mt-0.5" /> {r.quote}
                  </p>
                  {r.liked && <p className="text-[9px] font-mono text-emerald-400/70 mt-1">+ {r.liked}</p>}
                  {r.critique && <p className="text-[9px] font-mono text-red-400/70">− {r.critique}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/40 font-mono py-3 text-center">No reader feedback yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChapterCard({ chapter, onGenerate, isGenerating, onCancel, isCancelling, projectId, isEditingMode, isProjectComplete, onSaveEdit, isSavingEdit, editingChapterId, onStartEdit, onCancelEdit, onGenerateAudio, isGeneratingAudio, mostRecentEditId, onRevise, isRevising, revisingChapterId, onStartRevise, onCancelRevise, analyses, onRunBoard, onRunHumanize, onRunBeta, boardPending, humanizePending, betaPending, onInlineAi }: {
  chapter: Chapter;
  onGenerate: (id: number) => void;
  isGenerating: boolean;
  onCancel: (id: number) => void;
  isCancelling: boolean;
  projectId: number;
  isEditingMode: boolean;
  isProjectComplete: boolean;
  onSaveEdit: (id: number, content: string) => void;
  isSavingEdit: boolean;
  editingChapterId: number | null;
  onStartEdit: (id: number) => void;
  onCancelEdit: () => void;
  onGenerateAudio: (id: number) => void;
  isGeneratingAudio: boolean;
  mostRecentEditId: number | null;
  onRevise: (id: number, instruction: string) => void;
  isRevising: boolean;
  revisingChapterId: number | null;
  onStartRevise: (id: number) => void;
  onCancelRevise: () => void;
  analyses: ChapterAnalysis[];
  onRunBoard: (id: number) => void;
  onRunHumanize: (id: number) => void;
  onRunBeta: (id: number) => void;
  boardPending: boolean;
  humanizePending: boolean;
  betaPending: boolean;
  onInlineAi: (id: number, payload: { action: "continue" | "rewrite"; before: string; after: string; selection: string; instruction: string }) => Promise<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [showEditorial, setShowEditorial] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [cowriteInstruction, setCowriteInstruction] = useState("");
  const [cowriteBusy, setCowriteBusy] = useState<"continue" | "rewrite" | null>(null);
  const [suggestion, setSuggestion] = useState<{ text: string; mode: "continue" | "rewrite"; selStart: number; selEnd: number } | null>(null);

  const isEditing = editingChapterId === chapter.id;
  const isRevisingThis = revisingChapterId === chapter.id;

  const startRevising = (e: React.MouseEvent) => {
    e.stopPropagation();
    setReviseInstruction("");
    onStartRevise(chapter.id);
    setExpanded(true);
  };

  const submitRevise = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRevise(chapter.id, reviseInstruction.trim());
  };

  const cancelRevise = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancelRevise();
    setReviseInstruction("");
  };

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(chapter.content || "");
    onStartEdit(chapter.id);
    setExpanded(true);
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveEdit(chapter.id, editContent);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancelEdit();
    setEditContent("");
    setSuggestion(null);
    setCowriteInstruction("");
  };

  const runCowrite = async (action: "continue" | "rewrite") => {
    const ta = editTextareaRef.current;
    const selStart = ta ? ta.selectionStart : editContent.length;
    const selEnd = ta ? ta.selectionEnd : editContent.length;
    setSuggestion(null);
    setCowriteBusy(action);
    try {
      const before = editContent.slice(0, action === "rewrite" ? selStart : selStart);
      const selection = action === "rewrite" ? editContent.slice(selStart, selEnd) : "";
      const after = editContent.slice(action === "rewrite" ? selEnd : selStart);
      const text = await onInlineAi(chapter.id, {
        action,
        before,
        after,
        selection,
        instruction: cowriteInstruction.trim(),
      });
      setSuggestion({ text, mode: action, selStart, selEnd: action === "rewrite" ? selEnd : selStart });
    } catch {
      /* error toast surfaced by caller */
    } finally {
      setCowriteBusy(null);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    let next: string;
    if (suggestion.mode === "rewrite") {
      next = editContent.slice(0, suggestion.selStart) + suggestion.text + editContent.slice(suggestion.selEnd);
    } else {
      const head = editContent.slice(0, suggestion.selStart);
      const tail = editContent.slice(suggestion.selStart);
      const sep = head.length === 0 || /\s$/.test(head) ? "" : "\n\n";
      next = head + sep + suggestion.text + tail;
    }
    setEditContent(next);
    setSuggestion(null);
  };

  const isLastEdited = mostRecentEditId === chapter.id;
  const lastEditedLabel = chapter.lastEditedAt ? new Date(chapter.lastEditedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden bg-card/30 hover:border-purple-500/15 transition-all duration-300",
      isLastEdited ? "border-amber-500/30 ring-1 ring-amber-500/10" : "border-border/20"
    )} data-testid={`chapter-${chapter.id}`}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold font-mono",
          isLastEdited ? "bg-amber-500/15 border border-amber-500/25 text-amber-300" : "bg-purple-500/10 border border-purple-500/20 text-purple-300"
        )}>
          {chapter.chapterNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-bold tracking-tight truncate">{chapter.title}</p>
              {isLastEdited && (
                <Badge variant="outline" className="text-[8px] font-mono border-amber-500/20 bg-amber-500/5 text-amber-400 shrink-0">
                  LAST EDITED
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {chapter.status === "complete" ? (
                <>
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                    {chapter.wordCount.toLocaleString()} w
                  </Badge>
                  {chapter.audioUrl && (
                    <a href={`/api/projects/${projectId}/chapters/${chapter.id}/audio`} download onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-6 text-[9px] font-mono border-cyan-500/20 text-cyan-400 hover:border-cyan-500/40 px-1.5" data-testid={`button-download-chapter-audio-${chapter.id}`} aria-label="Download chapter audio">
                        <Music className="h-2.5 w-2.5 mr-0.5" /> MP3
                      </Button>
                    </a>
                  )}
                  {!chapter.audioUrl && (
                    <Button
                      size="sm" variant="outline"
                      className="h-6 text-[9px] font-mono border-purple-500/20 text-purple-400 hover:border-purple-500/40 px-1.5"
                      onClick={(e) => { e.stopPropagation(); onGenerateAudio(chapter.id); }}
                      disabled={isGeneratingAudio}
                      data-testid={`button-gen-audio-${chapter.id}`}
                      aria-label="Generate chapter audio"
                    >
                      {isGeneratingAudio ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Volume2 className="h-2.5 w-2.5 mr-0.5" />}
                      GEN MP3
                    </Button>
                  )}
                  {isEditingMode ? (
                    <Button
                      size="sm" variant="outline"
                      className="h-6 text-[9px] font-mono border-amber-500/20 text-amber-400 hover:border-amber-500/40 px-1.5"
                      onClick={startEditing}
                      data-testid={`button-edit-chapter-${chapter.id}`}
                      aria-label="Edit chapter"
                    >
                      <Edit3 className="h-2.5 w-2.5 mr-0.5" /> EDIT
                    </Button>
                  ) : !isProjectComplete ? (
                    <>
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[9px] font-mono border-border/30 hover:border-amber-500/30 hover:text-amber-300 px-1.5"
                        onClick={(e) => { e.stopPropagation(); onGenerate(chapter.id); }}
                        disabled={isGenerating}
                        data-testid={`button-regenerate-chapter-${chapter.id}`}
                        aria-label="Regenerate chapter"
                      >
                        <RefreshCw className="h-2.5 w-2.5 mr-0.5" /> REGEN
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-6 text-[9px] font-mono border-purple-500/20 text-purple-400 hover:border-purple-500/40 hover:text-purple-300 px-1.5"
                        onClick={startRevising}
                        data-testid={`button-revise-chapter-${chapter.id}`}
                        aria-label="Revise chapter with AI"
                      >
                        <Wand2 className="h-2.5 w-2.5 mr-0.5" /> REVISE
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm" variant="outline"
                    className={cn(
                      "h-6 text-[9px] font-mono px-1.5",
                      showEditorial ? "border-cyan-500/40 text-cyan-300 bg-cyan-500/10" : "border-cyan-500/20 text-cyan-400 hover:border-cyan-500/40"
                    )}
                    onClick={(e) => { e.stopPropagation(); setShowEditorial(v => !v); setExpanded(true); }}
                    data-testid={`button-editorial-chapter-${chapter.id}`}
                    aria-label="Editorial review tools"
                  >
                    <ClipboardCheck className="h-2.5 w-2.5 mr-0.5" /> EDITORIAL
                  </Button>
                </>
              ) : chapter.status === "generating" ? (
                <>
                  <Badge variant="outline" className="text-[10px] font-mono border-purple-500/20">
                    <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin text-purple-400" /> Writing...
                  </Badge>
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-[10px] font-mono border-red-500/20 text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                    onClick={(e) => { e.stopPropagation(); onCancel(chapter.id); }}
                    disabled={isCancelling}
                    data-testid={`button-cancel-chapter-${chapter.id}`}
                    aria-label="Cancel generation"
                  >
                    {isCancelling ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5 mr-1" />}
                    CANCEL
                  </Button>
                </>
              ) : (
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[10px] font-mono border-border/30 hover:border-purple-500/30 hover:text-purple-300"
                  onClick={(e) => { e.stopPropagation(); onGenerate(chapter.id); }}
                  disabled={isGenerating}
                  data-testid={`button-generate-chapter-${chapter.id}`}
                >
                  <Play className="h-2.5 w-2.5 mr-1" /> WRITE
                </Button>
              )}
              {chapter.qualityScore && (
                <span className={`text-[10px] font-bold font-mono ${scoreColor(chapter.qualityScore)}`}>
                  {formatScore(chapter.qualityScore)}
                </span>
              )}
              {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {chapter.blueprint && (
              <p className="text-[10px] text-muted-foreground/40 line-clamp-1 font-mono flex-1">{chapter.blueprint}</p>
            )}
            {lastEditedLabel && (
              <span className="text-[8px] font-mono text-amber-500/40 shrink-0">edited {lastEditedLabel}</span>
            )}
          </div>
        </div>
      </div>
      {expanded && isEditing && (
        <div className="px-4 pb-4 border-t border-amber-500/15">
          <div className="flex items-center justify-between mt-3 mb-2">
            <span className="text-[9px] font-mono text-amber-400/60 uppercase tracking-wider">Editing Chapter {chapter.chapterNumber}</span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm" variant="outline"
                className="h-6 text-[9px] font-mono border-border/30 text-muted-foreground hover:text-foreground px-2"
                onClick={cancelEdit}
                data-testid={`button-cancel-edit-${chapter.id}`}
              >
                <X className="h-2.5 w-2.5 mr-0.5" /> Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-[9px] font-mono bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 px-2"
                onClick={saveEdit}
                disabled={isSavingEdit}
                data-testid={`button-save-edit-${chapter.id}`}
              >
                {isSavingEdit ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : <Save className="h-2.5 w-2.5 mr-0.5" />}
                Save
              </Button>
            </div>
          </div>
          <Textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            readOnly={cowriteBusy !== null || suggestion !== null}
            className={cn(
              "min-h-[300px] text-[12px] bg-card/50 border-amber-500/15 font-mono resize-y focus:border-amber-500/30 leading-relaxed",
              (cowriteBusy !== null || suggestion !== null) && "opacity-80 cursor-not-allowed",
            )}
            data-testid={`textarea-edit-chapter-${chapter.id}`}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[8px] font-mono text-muted-foreground/30">
              {editContent.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words
            </p>
          </div>
          <div className="mt-2 rounded-md border border-violet-500/20 bg-violet-500/5 p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3 w-3 text-violet-400" />
              <span className="text-[9px] font-mono text-violet-300/80 uppercase tracking-wider">AI Co-Writer</span>
            </div>
            <input
              value={cowriteInstruction}
              onChange={(e) => setCowriteInstruction(e.target.value)}
              placeholder="Optional direction (e.g. raise the tension, add sensory detail)…"
              className="w-full mb-2 rounded bg-card/50 border border-violet-500/15 px-2 py-1 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-violet-500/40"
              data-testid={`input-cowrite-instruction-${chapter.id}`}
            />
            <div className="flex items-center gap-1.5">
              <Button
                size="sm" variant="outline"
                className="h-6 text-[9px] font-mono border-violet-500/25 text-violet-300 hover:bg-violet-500/15 px-2"
                disabled={cowriteBusy !== null}
                onClick={() => runCowrite("continue")}
                data-testid={`button-cowrite-continue-${chapter.id}`}
              >
                {cowriteBusy === "continue" ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : <ArrowRight className="h-2.5 w-2.5 mr-0.5" />}
                Continue from cursor
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-6 text-[9px] font-mono border-violet-500/25 text-violet-300 hover:bg-violet-500/15 px-2"
                disabled={cowriteBusy !== null}
                onClick={() => runCowrite("rewrite")}
                data-testid={`button-cowrite-rewrite-${chapter.id}`}
              >
                {cowriteBusy === "rewrite" ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5 mr-0.5" />}
                Rewrite selection
              </Button>
              <span className="text-[8px] font-mono text-muted-foreground/30 ml-auto">
                {cowriteBusy ? "thinking…" : "place cursor or select text"}
              </span>
            </div>
            {suggestion && (
              <div className="mt-2 rounded border border-violet-500/30 bg-card/60 p-2" data-testid={`panel-cowrite-suggestion-${chapter.id}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TextCursorInput className="h-3 w-3 text-violet-400" />
                  <span className="text-[8px] font-mono text-violet-300/70 uppercase tracking-wider">
                    {suggestion.mode === "continue" ? "Suggested continuation" : "Suggested rewrite"}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{suggestion.text}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Button
                    size="sm"
                    className="h-6 text-[9px] font-mono bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 border border-violet-500/30 px-2"
                    onClick={acceptSuggestion}
                    data-testid={`button-cowrite-accept-${chapter.id}`}
                  >
                    <Check className="h-2.5 w-2.5 mr-0.5" /> Accept
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className="h-6 text-[9px] font-mono border-border/30 text-muted-foreground hover:text-foreground px-2"
                    onClick={() => setSuggestion(null)}
                    data-testid={`button-cowrite-reject-${chapter.id}`}
                  >
                    <X className="h-2.5 w-2.5 mr-0.5" /> Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {expanded && !isEditing && isRevisingThis && (
        <div className="px-4 pb-4 border-t border-purple-500/15">
          <div className="flex items-center justify-between mt-3 mb-2">
            <span className="text-[9px] font-mono text-purple-400/60 uppercase tracking-wider flex items-center gap-1">
              <Wand2 className="h-2.5 w-2.5" /> Revise Chapter {chapter.chapterNumber} with AI
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm" variant="outline"
                className="h-6 text-[9px] font-mono border-border/30 text-muted-foreground hover:text-foreground px-2"
                onClick={cancelRevise}
                disabled={isRevising}
                data-testid={`button-cancel-revise-${chapter.id}`}
              >
                <X className="h-2.5 w-2.5 mr-0.5" /> Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-[9px] font-mono bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 px-2"
                onClick={submitRevise}
                disabled={isRevising}
                data-testid={`button-submit-revise-${chapter.id}`}
              >
                {isRevising ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5 mr-0.5" />}
                {isRevising ? "Revising…" : "Revise"}
              </Button>
            </div>
          </div>
          <Textarea
            value={reviseInstruction}
            onChange={(e) => setReviseInstruction(e.target.value)}
            disabled={isRevising}
            placeholder="Optional instruction — e.g. 'make the opening more dramatic', 'rename the mentor to Elias', 'tighten the middle section'. Leave blank for a general polish."
            className="min-h-[80px] text-[12px] bg-card/50 border-purple-500/15 font-mono resize-y focus:border-purple-500/30 leading-relaxed"
            data-testid={`textarea-revise-chapter-${chapter.id}`}
          />
          <p className="text-[8px] font-mono text-muted-foreground/30 mt-1">
            The AI rewrites this chapter, staying consistent with the rest of the book. The current draft will be replaced.
          </p>
        </div>
      )}
      {expanded && !isEditing && !isRevisingThis && showEditorial && (
        <EditorialPanel
          analyses={analyses}
          isProjectComplete={isProjectComplete}
          onRunBoard={() => onRunBoard(chapter.id)}
          onRunHumanize={() => onRunHumanize(chapter.id)}
          onRunBeta={() => onRunBeta(chapter.id)}
          boardPending={boardPending}
          humanizePending={humanizePending}
          betaPending={betaPending}
        />
      )}
      {expanded && !isEditing && !isRevisingThis && !showEditorial && chapter.content && (
        <div className="px-4 pb-4 border-t border-border/15">
          <ScrollArea className="h-52 mt-3">
            <MarkdownRendererDark content={chapter.content} />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function ContinuityPanel({
  projectId, project, entities, series, styleFingerprint, hasChapters, onChanged,
}: {
  projectId: number;
  project: Project;
  entities: StoryEntity[];
  series?: Series;
  styleFingerprint?: StyleFingerprint;
  hasChapters: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [newStyleName, setNewStyleName] = useState("");
  const [newStyleSample, setNewStyleSample] = useState("");
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityType, setNewEntityType] = useState("character");
  const [newEntityDesc, setNewEntityDesc] = useState("");

  const { data: seriesList = [] } = useQuery<(Series & { bookCount: number })[]>({ queryKey: ["/api/series"] });
  const { data: styleList = [] } = useQuery<StyleFingerprint[]>({ queryKey: ["/api/style-fingerprints"] });

  const onError = (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" });

  const assignMutation = useMutation({
    mutationFn: (patch: { seriesId?: number | null; styleFingerprintId?: number | null }) =>
      apiRequest("PATCH", `/api/projects/${projectId}`, patch),
    onSuccess: () => { onChanged(); },
    onError,
  });
  const createSeriesMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/series", { title: newSeriesTitle.trim() }),
    onSuccess: async (res: any) => {
      const created = await res.json();
      setNewSeriesTitle("");
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      assignMutation.mutate({ seriesId: created.id });
      toast({ title: "Series created" });
    },
    onError,
  });
  const createStyleMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/style-fingerprints", { name: newStyleName.trim(), sampleText: newStyleSample.trim() }),
    onSuccess: async (res: any) => {
      const created = await res.json();
      setNewStyleName(""); setNewStyleSample("");
      queryClient.invalidateQueries({ queryKey: ["/api/style-fingerprints"] });
      assignMutation.mutate({ styleFingerprintId: created.id });
      toast({ title: "Style fingerprint created" });
    },
    onError,
  });
  const bibleMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/series/${series!.id}/bible`),
    onSuccess: () => { onChanged(); queryClient.invalidateQueries({ queryKey: ["/api/series"] }); toast({ title: "Series bible generated" }); },
    onError,
  });
  const extractMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/extract-graph`),
    onSuccess: () => { onChanged(); toast({ title: "Graph extracted" }); },
    onError,
  });
  const addEntityMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/entities`, {
      name: newEntityName.trim(), type: newEntityType, profile: { description: newEntityDesc.trim() },
    }),
    onSuccess: () => { setNewEntityName(""); setNewEntityDesc(""); onChanged(); toast({ title: "Entity added" }); },
    onError,
  });
  const deleteEntityMutation = useMutation({
    mutationFn: (eid: number) => apiRequest("DELETE", `/api/entities/${eid}`),
    onSuccess: () => { onChanged(); },
    onError,
  });

  const bible = (series?.bible as SeriesBible | null) || null;
  const styleProfile = (styleFingerprint?.profile as Record<string, any> | null) || null;

  return (
    <div className="space-y-3" data-testid="panel-continuity">
      {/* Series */}
      <Card className="border-border/20 bg-card/30 glow-border">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Library className="h-3.5 w-3.5 text-purple-400/70" />
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Series / Saga</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={project.seriesId ? String(project.seriesId) : "none"}
              onValueChange={(v) => assignMutation.mutate({ seriesId: v === "none" ? null : parseInt(v) })}
            >
              <SelectTrigger className="h-8 text-[11px] font-mono bg-card/50" data-testid="select-series">
                <SelectValue placeholder="No series" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No series</SelectItem>
                {seriesList.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.title} ({s.bookCount})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newSeriesTitle}
              onChange={(e) => setNewSeriesTitle(e.target.value)}
              placeholder="New series title…"
              className="h-8 text-[11px] font-mono bg-card/50"
              data-testid="input-new-series"
            />
            <Button
              size="sm" variant="outline" className="h-8 text-[10px] font-mono shrink-0"
              disabled={!newSeriesTitle.trim() || createSeriesMutation.isPending}
              onClick={() => createSeriesMutation.mutate()}
              data-testid="button-create-series"
            >
              {createSeriesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
          </div>
          {series && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-muted-foreground/50">Shared bible for "{series.title}"</p>
                <Button
                  size="sm" variant="outline" className="h-7 text-[10px] font-mono"
                  disabled={bibleMutation.isPending}
                  onClick={() => bibleMutation.mutate()}
                  data-testid="button-generate-bible"
                >
                  {bibleMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                  {bible ? "Regenerate" : "Generate"} Bible
                </Button>
              </div>
              {bible && (
                <div className="space-y-1.5">
                  {([["Summary", bible.summary], ["Characters", bible.characters], ["World", bible.world], ["Timeline", bible.timeline], ["Notes", bible.notes]] as [string, string | undefined][])
                    .filter(([, v]) => v).map(([label, v]) => (
                      <div key={label} className="bg-white/[0.02] border border-border/15 rounded-lg px-3 py-2">
                        <p className="text-[8px] font-mono font-bold uppercase tracking-[0.2em] text-purple-400/50 mb-1">{label}</p>
                        <p className="text-[12px] leading-relaxed text-muted-foreground/75 whitespace-pre-wrap">{v}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Style fingerprint */}
      <Card className="border-border/20 bg-card/30 glow-border-cyan">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5 text-cyan-400/70" />
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Author Style Fingerprint</p>
          </div>
          <Select
            value={project.styleFingerprintId ? String(project.styleFingerprintId) : "none"}
            onValueChange={(v) => assignMutation.mutate({ styleFingerprintId: v === "none" ? null : parseInt(v) })}
          >
            <SelectTrigger className="h-8 text-[11px] font-mono bg-card/50" data-testid="select-style">
              <SelectValue placeholder="No style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default voice</SelectItem>
              {styleList.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {styleProfile && (
            <div className="bg-white/[0.02] border border-border/15 rounded-lg px-3 py-2 space-y-1">
              {Object.entries(styleProfile).filter(([, v]) => v && typeof v === "string").slice(0, 6).map(([k, v]) => (
                <p key={k} className="text-[11px] leading-relaxed text-muted-foreground/70">
                  <span className="text-cyan-400/60 font-mono uppercase text-[8px] tracking-wider mr-1.5">{k}</span>{String(v)}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-2 pt-1 border-t border-border/15">
            <p className="text-[10px] font-mono text-muted-foreground/50 pt-2">Create from sample text</p>
            <Input
              value={newStyleName}
              onChange={(e) => setNewStyleName(e.target.value)}
              placeholder="Fingerprint name…"
              className="h-8 text-[11px] font-mono bg-card/50"
              data-testid="input-style-name"
            />
            <Textarea
              value={newStyleSample}
              onChange={(e) => setNewStyleSample(e.target.value)}
              placeholder="Paste 200+ characters of representative prose…"
              className="text-[11px] font-mono bg-card/50 min-h-[80px]"
              data-testid="input-style-sample"
            />
            <Button
              size="sm" variant="outline" className="h-8 text-[10px] font-mono w-full"
              disabled={!newStyleName.trim() || newStyleSample.trim().length < 200 || createStyleMutation.isPending}
              onClick={() => createStyleMutation.mutate()}
              data-testid="button-create-style"
            >
              {createStyleMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Fingerprint className="h-3 w-3 mr-1" />}
              Derive Fingerprint
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Character & world graph */}
      <Card className="border-border/20 bg-card/30 glow-border-pink">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-3.5 w-3.5 text-pink-400/70" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Character & World Graph ({entities.length})</p>
            </div>
            <Button
              size="sm" variant="outline" className="h-7 text-[10px] font-mono"
              disabled={!hasChapters || extractMutation.isPending}
              onClick={() => extractMutation.mutate()}
              data-testid="button-extract-graph"
            >
              {extractMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Extract
            </Button>
          </div>

          {entities.length > 0 && (
            <div className="space-y-1.5">
              {entities.map((e) => {
                const p = (e.profile as EntityProfile | null) || {};
                const rels = (e.relationships as EntityRelationship[] | null) || [];
                return (
                  <div key={e.id} className="bg-white/[0.02] border border-border/15 rounded-lg px-3 py-2" data-testid={`entity-${e.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[8px] font-mono border-pink-500/30 text-pink-300/70 capitalize shrink-0">{e.type}</Badge>
                        <span className="text-[12px] font-bold tracking-tight truncate">{e.name}</span>
                      </div>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground/40 hover:text-red-400"
                        onClick={() => deleteEntityMutation.mutate(e.id)}
                        data-testid={`button-delete-entity-${e.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {p.description && <p className="text-[11px] leading-relaxed text-muted-foreground/70 mt-1">{p.description}</p>}
                    {p.role && <p className="text-[10px] text-muted-foreground/45 mt-0.5"><span className="font-mono uppercase text-[8px] mr-1">role</span>{p.role}</p>}
                    {rels.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {rels.map((r, i) => (
                          <span key={i} className="text-[9px] font-mono text-cyan-400/50 bg-cyan-500/5 border border-cyan-500/15 rounded px-1.5 py-0.5">{r.to}: {r.relation}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2 pt-1 border-t border-border/15">
            <p className="text-[10px] font-mono text-muted-foreground/50 pt-2">Add manually</p>
            <div className="flex items-center gap-2">
              <Select value={newEntityType} onValueChange={setNewEntityType}>
                <SelectTrigger className="h-8 text-[11px] font-mono bg-card/50 w-[120px] shrink-0" data-testid="select-entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["character", "location", "item", "faction", "concept"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                placeholder="Name…"
                className="h-8 text-[11px] font-mono bg-card/50"
                data-testid="input-entity-name"
              />
            </div>
            <Textarea
              value={newEntityDesc}
              onChange={(e) => setNewEntityDesc(e.target.value)}
              placeholder="Description (optional)…"
              className="text-[11px] font-mono bg-card/50 min-h-[56px]"
              data-testid="input-entity-desc"
            />
            <Button
              size="sm" variant="outline" className="h-8 text-[10px] font-mono w-full"
              disabled={!newEntityName.trim() || addEntityMutation.isPending}
              onClick={() => addEntityMutation.mutate()}
              data-testid="button-add-entity"
            >
              {addEntityMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              Add Entity
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PacingPoint { chapterNumber: number; title: string; tension: number; pacing: number; flag: "slow" | "rushed" | "balanced"; rationale: string }

function pacingFlagTone(flag: string) {
  if (flag === "slow") return { color: "text-blue-300", dot: "#60a5fa", border: "border-blue-500/30", bg: "bg-blue-500/10", label: "SLOW" };
  if (flag === "rushed") return { color: "text-orange-300", dot: "#fb923c", border: "border-orange-500/30", bg: "bg-orange-500/10", label: "RUSHED" };
  return { color: "text-emerald-300", dot: "#34d399", border: "border-emerald-500/30", bg: "bg-emerald-500/10", label: "BALANCED" };
}

function PacingCurve({ points }: { points: PacingPoint[] }) {
  const W = 1000, H = 280, padX = 40, padY = 30;
  const n = points.length;
  const x = (i: number) => n <= 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1);
  const y = (v: number) => padY + ((100 - Math.max(0, Math.min(100, v))) * (H - padY * 2)) / 100;
  const poly = (key: "tension" | "pacing") => points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none" role="img" aria-label="Tension and pacing curve">
      {[0, 25, 50, 75, 100].map(g => (
        <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="currentColor" className="text-border/20" strokeWidth={1} strokeDasharray="3 4" />
      ))}
      <polyline points={poly("tension")} fill="none" stroke="#a78bfa" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={poly("pacing")} fill="none" stroke="#22d3ee" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 5" />
      {points.map((p, i) => (
        <circle key={p.chapterNumber} cx={x(i)} cy={y(p.tension)} r={4} fill={pacingFlagTone(p.flag).dot} stroke="#0a0a0f" strokeWidth={1.5}>
          <title>{`Ch.${p.chapterNumber} — tension ${p.tension}, pacing ${p.pacing} (${p.flag})`}</title>
        </circle>
      ))}
    </svg>
  );
}

function PacingPanel({ analysis, onAnalyze, isPending, canAnalyze, chapterCount }: {
  analysis: ChapterAnalysis | null;
  onAnalyze: () => void;
  isPending: boolean;
  canAnalyze: boolean;
  chapterCount: number;
}) {
  const raw = analysis?.data as any;
  const result = (raw?.result ?? raw) as { chapters?: PacingPoint[]; summary?: string } | undefined;
  const points = result?.chapters || [];
  const flagged = points.filter(p => p.flag !== "balanced");
  return (
    <div className="space-y-4">
      <Card className="border-border/20 bg-card/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-violet-300">
                <Activity className="h-4 w-4" /> Pacing & Tension Curve
              </CardTitle>
              <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
                AI maps tension and pacing across completed chapters to flag slow or rushed stretches.
              </p>
            </div>
            <Button
              size="sm"
              className="h-7 text-[10px] font-mono bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 border border-violet-500/30 px-2.5 shrink-0"
              onClick={onAnalyze}
              disabled={isPending || !canAnalyze}
              data-testid="button-analyze-pacing"
            >
              {isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />}
              {analysis ? "Re-analyze" : "Analyze Pacing"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!canAnalyze ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Gauge className="h-9 w-9 text-violet-500/30" />
              <p className="text-[11px] font-mono text-muted-foreground/40 mt-3">
                Write at least 2 chapters to analyze pacing ({chapterCount} done).
              </p>
            </div>
          ) : !analysis ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-9 w-9 text-violet-500/30" />
              <p className="text-[11px] font-mono text-muted-foreground/40 mt-3">
                Run an analysis to see the tension & pacing curve.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {result?.summary && (
                <p className="text-[11px] font-mono text-foreground/70 leading-relaxed" data-testid="text-pacing-summary">{result.summary}</p>
              )}
              <div className="rounded-lg border border-border/20 bg-card/40 p-3">
                <div className="flex items-center gap-4 mb-2">
                  <span className="flex items-center gap-1.5 text-[9px] font-mono text-violet-300/80"><span className="inline-block w-4 h-0.5 bg-[#a78bfa]" /> Tension</span>
                  <span className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-300/80"><span className="inline-block w-4 h-0.5 bg-[#22d3ee]" style={{ borderTop: "2px dashed #22d3ee", background: "transparent" }} /> Pacing</span>
                </div>
                <PacingCurve points={points} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  {flagged.length > 0 ? `${flagged.length} chapter(s) flagged` : "All chapters well-paced"}
                </p>
                {points.map(p => {
                  const tone = pacingFlagTone(p.flag);
                  return (
                    <div key={p.chapterNumber} className={cn("flex items-start gap-2.5 p-2.5 rounded-lg border", tone.border, tone.bg)} data-testid={`row-pacing-${p.chapterNumber}`}>
                      <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 mt-0.5 w-10">Ch.{p.chapterNumber}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono text-foreground/80 truncate">{p.title}</span>
                          <Badge variant="outline" className={cn("text-[8px] font-mono px-1.5 py-0 h-4", tone.border, tone.color)}>{tone.label}</Badge>
                          <span className="text-[8px] font-mono text-muted-foreground/40">T:{p.tension} · P:{p.pacing}</span>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5 leading-relaxed">{p.rationale}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CompetitorTeardownData {
  competitors: { name: string; strengths: string; weaknesses: string }[];
  marketGaps: string[];
  positioning: string;
  differentiators: string[];
  recommendedAngle: string;
}
interface KdpOptimizationData {
  keywords: string[];
  categories: { name: string; rationale: string }[];
  summary: string;
}

const fmtMoney = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function ForecasterPanel({ projectId, latest, onChanged }: {
  projectId: number;
  latest?: RevenueForecast;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const saved = latest?.assumptions as ForecastAssumptionsData | undefined;
  const [listPrice, setListPrice] = useState(String(saved?.listPrice ?? 9.99));
  const [royaltyRate, setRoyaltyRate] = useState(String((saved?.royaltyRate ?? 0.7) * 100));
  const [monthlyUnits, setMonthlyUnits] = useState(String(saved?.monthlyUnits ?? 150));
  const [monthlyGrowth, setMonthlyGrowth] = useState(String((saved?.monthlyGrowth ?? 0.08) * 100));
  const [months, setMonths] = useState(String(saved?.months ?? 12));
  const [platformFee, setPlatformFee] = useState(String(saved?.platformFeePerUnit ?? 0.5));

  const projection = latest?.projections as RevenueProjectionData | undefined;

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/revenue-forecast`, {
      assumptions: {
        listPrice: parseFloat(listPrice) || 0,
        royaltyRate: (parseFloat(royaltyRate) || 0) / 100,
        monthlyUnits: parseInt(monthlyUnits) || 0,
        monthlyGrowth: (parseFloat(monthlyGrowth) || 0) / 100,
        months: parseInt(months) || 12,
        platformFeePerUnit: parseFloat(platformFee) || 0,
      },
    }),
    onSuccess: () => { onChanged(); toast({ title: "Revenue forecast updated" }); },
    onError: (e: any) => toast({ title: "Forecast failed", description: e.message, variant: "destructive" }),
  });

  const chartData = (() => {
    if (!projection) return [];
    const base = projection.scenarios.find(s => s.name === "Base");
    const low = projection.scenarios.find(s => s.name === "Conservative");
    const high = projection.scenarios.find(s => s.name === "Optimistic");
    const len = base?.months.length || 0;
    return Array.from({ length: len }, (_, i) => ({
      month: `M${i + 1}`,
      Conservative: low?.months[i]?.cumulative ?? 0,
      Base: base?.months[i]?.cumulative ?? 0,
      Optimistic: high?.months[i]?.cumulative ?? 0,
    }));
  })();

  const inputs: { label: string; value: string; set: (v: string) => void; testId: string; suffix?: string }[] = [
    { label: "List Price", value: listPrice, set: setListPrice, testId: "input-list-price", suffix: "$" },
    { label: "Royalty Rate", value: royaltyRate, set: setRoyaltyRate, testId: "input-royalty-rate", suffix: "%" },
    { label: "Units / Month", value: monthlyUnits, set: setMonthlyUnits, testId: "input-monthly-units" },
    { label: "Growth / Month", value: monthlyGrowth, set: setMonthlyGrowth, testId: "input-monthly-growth", suffix: "%" },
    { label: "Months", value: months, set: setMonths, testId: "input-months" },
    { label: "Platform Fee / Unit", value: platformFee, set: setPlatformFee, testId: "input-platform-fee", suffix: "$" },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border/20 bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-emerald-300">
            <DollarSign className="h-4 w-4" /> Royalty & Revenue Forecaster
          </CardTitle>
          <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
            Model royalties across conservative, base, and optimistic scenarios. Deterministic — no AI credits used.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {inputs.map(inp => (
              <div key={inp.testId} className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">{inp.label}{inp.suffix ? ` (${inp.suffix})` : ""}</label>
                <Input
                  type="number"
                  value={inp.value}
                  onChange={e => inp.set(e.target.value)}
                  className="h-8 text-[12px] font-mono bg-card/40 border-border/30"
                  data-testid={inp.testId}
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            className="h-8 text-[10px] font-mono bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-500/30"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid="button-run-forecast"
          >
            {mutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <DollarSign className="h-3 w-3 mr-1" />}
            {projection ? "Recalculate Forecast" : "Run Forecast"}
          </Button>

          {projection && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {projection.scenarios.map(s => (
                  <div key={s.name} className="rounded-lg border border-border/20 bg-card/40 p-3" data-testid={`card-scenario-${s.name.toLowerCase()}`}>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40">{s.name}</p>
                    <p className="text-lg font-bold text-emerald-300 mt-1" data-testid={`text-royalty-${s.name.toLowerCase()}`}>{fmtMoney(s.totalRoyalty)}</p>
                    <p className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">{s.totalUnits.toLocaleString()} units</p>
                  </div>
                ))}
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-emerald-400/60">Royalty / Unit</p>
                  <p className="text-lg font-bold text-emerald-300 mt-1">${projection.perUnitRoyalty.toFixed(2)}</p>
                </div>
              </div>

              <div className="h-64 w-full" data-testid="chart-forecast">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradOpt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => fmtMoney(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="Optimistic" stroke="#34d399" fill="url(#gradOpt)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="Base" stroke="#a78bfa" fill="url(#gradBase)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="Conservative" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AbLabPanel({ projectId, tests, onChanged }: {
  projectId: number;
  tests: AbTest[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [testType, setTestType] = useState<"title" | "blurb" | "cover">("title");

  const genMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/ab-test`, { testType }),
    onSuccess: () => { onChanged(); toast({ title: "Variants generated" }); },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });
  const winnerMutation = useMutation({
    mutationFn: ({ testId, winnerIndex }: { testId: number; winnerIndex: number }) =>
      apiRequest("POST", `/api/projects/${projectId}/ab-test/${testId}/winner`, { winnerIndex }),
    onSuccess: () => { onChanged(); toast({ title: "Winner applied to your book" }); },
    onError: (e: any) => toast({ title: "Apply failed", description: e.message, variant: "destructive" }),
  });

  const typeLabel: Record<string, string> = { title: "Title", blurb: "Blurb", cover: "Cover" };

  return (
    <div className="space-y-4">
      <Card className="border-border/20 bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-cyan-300">
            <FlaskConical className="h-4 w-4" /> A/B Test Lab
          </CardTitle>
          <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
            Generate and score competing variants, then apply the winner directly to your book.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={testType} onValueChange={(v) => setTestType(v as any)}>
              <SelectTrigger className="h-8 w-36 text-[11px] font-mono bg-card/40 border-border/30" data-testid="select-ab-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="blurb">Blurb</SelectItem>
                <SelectItem value="cover">Cover</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 text-[10px] font-mono bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border border-cyan-500/30"
              onClick={() => genMutation.mutate()}
              disabled={genMutation.isPending}
              data-testid="button-generate-variants"
            >
              {genMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FlaskConical className="h-3 w-3 mr-1" />}
              Generate Variants
            </Button>
          </div>
        </CardContent>
      </Card>

      {tests.length === 0 ? (
        <Card className="border-border/20 bg-card/30"><CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground/40 text-[11px] font-mono">No A/B tests yet — generate variants to start.</p>
        </CardContent></Card>
      ) : (
        tests.map(test => {
          const variants = (Array.isArray(test.variants) ? test.variants : []) as AbVariantData[];
          return (
            <Card key={test.id} className="border-border/20 bg-card/30" data-testid={`card-abtest-${test.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-[11px] font-mono text-foreground/70 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/30 text-cyan-300">{typeLabel[test.testType] || test.testType}</Badge>
                    <span className="text-muted-foreground/40">
                      {test.createdAt ? new Date(test.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {variants.map((v, i) => {
                  const isWinner = test.winnerIndex === i;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-3 space-y-1.5",
                        isWinner ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/20 bg-card/40"
                      )}
                      data-testid={`variant-${test.id}-${i}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[12px] text-foreground/85 leading-relaxed flex-1">{v.text}</p>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[13px] font-bold text-cyan-300">{v.appealScore}</span>
                          <span className="text-[8px] font-mono text-muted-foreground/40">appeal</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground/55 leading-snug flex-1">{v.rationale}</p>
                        <span className="text-[9px] font-mono text-muted-foreground/45 shrink-0">CTR {v.ctr}%</span>
                      </div>
                      <div>
                        {isWinner ? (
                          <Badge className="text-[8px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 gap-1">
                            <Trophy className="h-2.5 w-2.5" /> Applied Winner
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[9px] font-mono text-emerald-300/70 hover:text-emerald-200 hover:bg-emerald-500/10 px-2"
                            onClick={() => winnerMutation.mutate({ testId: test.id, winnerIndex: i })}
                            disabled={winnerMutation.isPending}
                            data-testid={`button-pick-winner-${test.id}-${i}`}
                          >
                            <Trophy className="h-2.5 w-2.5 mr-1" /> Pick as Winner
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function BusinessPanel({ projectId, forecasts, tests, onChanged }: {
  projectId: number;
  forecasts: RevenueForecast[];
  tests: AbTest[];
  onChanged: () => void;
}) {
  return (
    <Tabs defaultValue="forecaster" className="w-full">
      <TabsList className="bg-card/40 border border-border/20 h-8">
        <TabsTrigger value="forecaster" className="text-[9px] font-mono px-2 h-6" data-testid="tab-business-forecaster">
          <DollarSign className="h-3 w-3 mr-1" /> Forecaster
        </TabsTrigger>
        <TabsTrigger value="ablab" className="text-[9px] font-mono px-2 h-6" data-testid="tab-business-ablab">
          <FlaskConical className="h-3 w-3 mr-1" /> A/B Lab
        </TabsTrigger>
      </TabsList>
      <TabsContent value="forecaster" className="mt-3">
        <ForecasterPanel projectId={projectId} latest={forecasts[0]} onChanged={onChanged} />
      </TabsContent>
      <TabsContent value="ablab" className="mt-3">
        <AbLabPanel projectId={projectId} tests={tests} onChanged={onChanged} />
      </TabsContent>
    </Tabs>
  );
}

function MarketPanel({ projectId, reports, hasOutline, onChanged }: {
  projectId: number;
  reports: MarketReport[];
  hasOutline: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [competitorInput, setCompetitorInput] = useState("");

  const teardownReport = reports.find(r => r.kind === "competitor_teardown");
  const kdpReport = reports.find(r => r.kind === "kdp_optimizer");
  const teardown = teardownReport?.data as CompetitorTeardownData | undefined;
  const kdp = kdpReport?.data as KdpOptimizationData | undefined;
  const tsLabel = (r?: MarketReport) =>
    r?.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

  const teardownMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/competitor-teardown`, { competitorInput: competitorInput.trim() || undefined }),
    onSuccess: () => { onChanged(); toast({ title: "Competitor teardown ready" }); },
    onError: (e: any) => toast({ title: "Teardown failed", description: e.message, variant: "destructive" }),
  });
  const kdpMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/kdp-optimizer`),
    onSuccess: () => { onChanged(); toast({ title: "KDP optimization ready" }); },
    onError: (e: any) => toast({ title: "KDP optimization failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card className="border-border/20 bg-card/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-orange-300">
                <Crosshair className="h-4 w-4" /> Competitor Teardown
              </CardTitle>
              <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
                AI maps competing titles, finds market gaps, and sharpens your positioning.
              </p>
            </div>
            {teardownReport && (
              <span className="text-[9px] font-mono text-muted-foreground/40">Last run {tsLabel(teardownReport)}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={competitorInput}
            onChange={e => setCompetitorInput(e.target.value)}
            placeholder="Optional: paste a competing book's title + description, or a market note to benchmark against. Leave blank to analyze the niche generally."
            className="min-h-[72px] text-[12px] font-mono bg-card/40 border-border/30 resize-none"
            data-testid="input-competitor"
          />
          <Button
            size="sm"
            className="h-8 text-[10px] font-mono bg-orange-500/20 text-orange-200 hover:bg-orange-500/30 border border-orange-500/30"
            onClick={() => teardownMutation.mutate()}
            disabled={teardownMutation.isPending}
            data-testid="button-run-teardown"
          >
            {teardownMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Crosshair className="h-3 w-3 mr-1" />}
            {teardown ? "Re-run Teardown" : "Run Teardown"}
          </Button>

          {teardown && (
            <div className="space-y-3 pt-1">
              {teardown.recommendedAngle && (
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-orange-400/60 mb-1">Recommended Angle</p>
                  <p className="text-[12px] text-foreground/80 leading-relaxed" data-testid="text-recommended-angle">{teardown.recommendedAngle}</p>
                </div>
              )}
              {teardown.positioning && (
                <div>
                  <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1.5">Positioning</p>
                  <p className="text-[12px] text-muted-foreground/75 leading-relaxed">{teardown.positioning}</p>
                </div>
              )}
              {teardown.competitors?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Competitors</p>
                  {teardown.competitors.map((c, i) => (
                    <div key={i} className="border border-border/20 rounded-lg p-2.5 bg-card/30" data-testid={`competitor-${i}`}>
                      <p className="text-[11px] font-bold tracking-tight mb-1">{c.name}</p>
                      <p className="text-[10px] font-mono text-emerald-400/70">+ {c.strengths}</p>
                      <p className="text-[10px] font-mono text-red-400/70">− {c.weaknesses}</p>
                    </div>
                  ))}
                </div>
              )}
              {teardown.marketGaps?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Target className="h-3 w-3 text-red-400/60" />
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Market Gaps</p>
                  </div>
                  <div className="space-y-1.5">
                    {teardown.marketGaps.map((g, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-[11px]">
                        <span className="shrink-0 flex h-4 w-4 mt-0.5 items-center justify-center rounded bg-red-500/10 border border-red-500/20 text-[8px] font-mono font-bold text-red-400">{i + 1}</span>
                        <span className="text-muted-foreground/70 leading-snug">{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {teardown.differentiators?.length > 0 && (
                <div>
                  <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1.5">Differentiators</p>
                  <div className="flex flex-wrap gap-1.5">
                    {teardown.differentiators.map((d, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-mono border-border/20 bg-orange-500/5 text-orange-300/70">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/20 bg-card/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-cyan-300">
                <Search className="h-4 w-4" /> KDP Keyword & Category Optimizer
              </CardTitle>
              <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
                7 buyer-intent keywords and 2 winnable Amazon categories tuned for discoverability.
              </p>
            </div>
            {kdpReport && (
              <span className="text-[9px] font-mono text-muted-foreground/40">Last run {tsLabel(kdpReport)}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            size="sm"
            className="h-8 text-[10px] font-mono bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border border-cyan-500/30"
            onClick={() => kdpMutation.mutate()}
            disabled={kdpMutation.isPending || !hasOutline}
            data-testid="button-run-kdp"
          >
            {kdpMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
            {kdp ? "Re-run Optimizer" : "Run Optimizer"}
          </Button>
          {!hasOutline && (
            <p className="text-[9px] font-mono text-amber-400/60">Generate the book outline first to optimize KDP metadata.</p>
          )}

          {kdp && (
            <div className="space-y-3 pt-1">
              {kdp.summary && (
                <p className="text-[12px] text-muted-foreground/75 leading-relaxed" data-testid="text-kdp-summary">{kdp.summary}</p>
              )}
              {kdp.keywords?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="h-3 w-3 text-cyan-400/60" />
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">7 Keywords</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {kdp.keywords.map((k, i) => (
                      <span key={i} className="text-[10px] bg-cyan-500/5 border border-cyan-500/15 text-cyan-300/80 rounded-full px-2.5 py-1 font-mono" data-testid={`kdp-keyword-${i}`}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {kdp.categories?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Best Categories</p>
                  {kdp.categories.map((c, i) => (
                    <div key={i} className="border border-border/20 rounded-lg p-2.5 bg-card/30" data-testid={`kdp-category-${i}`}>
                      <p className="text-[11px] font-mono text-cyan-300/90 mb-1">{c.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed">{c.rationale}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const projectId = parseInt(id!);
  const [showReader, setShowReader] = useState(false);
  const [showCoverFull, setShowCoverFull] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [audiobookLoading, setAudiobookLoading] = useState(false);
  const [coverText, setCoverText] = useState("");
  const [coverAvoid, setCoverAvoid] = useState("");
  const [showOutlineConfirm, setShowOutlineConfirm] = useState(false);
  const [priceInput, setPriceInput] = useState<string>("");
  const { startNarration } = useNarration();

  const { data, isLoading, isFetching, error, refetch } = useQuery<ProjectDetailData>({
    queryKey: ["/api/projects", projectId],
    refetchInterval: 5000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const trendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/trend-analysis`),
    onSuccess: () => { invalidate(); toast({ title: "Trend analysis complete" }); },
    onError: (e: any) => toast({ title: "Analysis failed", description: e.message, variant: "destructive" }),
  });
  const outlineMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/generate-outline`),
    onSuccess: () => { invalidate(); toast({ title: "Outline generated" }); },
    onError: (e: any) => toast({ title: "Outline failed", description: e.message, variant: "destructive" }),
  });
  const chapterMutation = useMutation({
    mutationFn: (chapterId: number) => apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/generate`),
    onSuccess: () => { invalidate(); toast({ title: "Chapter written" }); },
    onError: (e: any) => toast({ title: "Chapter failed", description: e.message, variant: "destructive" }),
  });
  const marketingMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/generate-marketing`),
    onSuccess: () => { invalidate(); toast({ title: "Marketing generated" }); },
    onError: (e: any) => toast({ title: "Marketing failed", description: e.message, variant: "destructive" }),
  });
  const coverMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/generate-cover`, {
      coverPrompt: coverText || undefined,
      avoidStyles: coverAvoid || undefined,
    }),
    onSuccess: () => { invalidate(); toast({ title: "Cover generated" }); },
    onError: (e: any) => toast({ title: "Cover failed", description: e.message, variant: "destructive" }),
  });
  const [variantCount, setVariantCount] = useState("2");
  const coverVariantsMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/cover-variants`, {
      count: parseInt(variantCount, 10),
      coverPrompt: coverText || undefined,
      avoidStyles: coverAvoid || undefined,
    }),
    onSuccess: () => { invalidate(); toast({ title: "Cover variants generated" }); },
    onError: (e: any) => toast({ title: "Variants failed", description: e.message, variant: "destructive" }),
  });
  const selectVariantMutation = useMutation({
    mutationFn: (variantId: number) => apiRequest("POST", `/api/projects/${projectId}/cover-variants/${variantId}/select`),
    onSuccess: () => { invalidate(); toast({ title: "Cover applied" }); },
    onError: (e: any) => toast({ title: "Apply failed", description: e.message, variant: "destructive" }),
  });
  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: number) => apiRequest("DELETE", `/api/projects/${projectId}/cover-variants/${variantId}`),
    onSuccess: () => { invalidate(); toast({ title: "Variant removed" }); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });
  const { data: brandKits } = useQuery<BrandKit[]>({ queryKey: ["/api/brand-kits"] });
  const brandKitMutation = useMutation({
    mutationFn: (brandKitId: number | null) => apiRequest("PATCH", `/api/projects/${projectId}`, { brandKitId }),
    onSuccess: () => { invalidate(); toast({ title: "Brand kit updated" }); },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const [trimSizeId, setTrimSizeId] = useState("6x9");
  const cancelChapterMutation = useMutation({
    mutationFn: (chapterId: number) => apiRequest("PATCH", `/api/projects/${projectId}/chapters/${chapterId}/cancel`),
    onSuccess: () => { invalidate(); toast({ title: "Generation cancelled", description: "Chapter reset to pending" }); },
    onError: (e: any) => toast({ title: "Cancel failed", description: e.message, variant: "destructive" }),
  });
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const editChapterMutation = useMutation({
    mutationFn: ({ chapterId, content }: { chapterId: number; content: string }) =>
      apiRequest("PATCH", `/api/projects/${projectId}/chapters/${chapterId}/edit`, { content }),
    onSuccess: () => { setEditingChapterId(null); invalidate(); toast({ title: "Chapter saved" }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
  const [revisingChapterId, setRevisingChapterId] = useState<number | null>(null);
  const reviseChapterMutation = useMutation({
    mutationFn: ({ chapterId, instruction }: { chapterId: number; instruction: string }) =>
      apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/revise`, { instruction }),
    onSuccess: () => { setRevisingChapterId(null); invalidate(); toast({ title: "Chapter revised", description: "The AI rewrote this chapter." }); },
    onError: (e: any) => toast({ title: "Revision failed", description: e.message, variant: "destructive" }),
  });
  const editorialBoardMutation = useMutation({
    mutationFn: (chapterId: number) => apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/editorial-board`),
    onSuccess: () => { invalidate(); toast({ title: "Editorial board review complete" }); },
    onError: (e: any) => toast({ title: "Review failed", description: e.message, variant: "destructive" }),
  });
  const humanizeMutation = useMutation({
    mutationFn: (chapterId: number) => apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/humanize`),
    onSuccess: () => { invalidate(); toast({ title: "Chapter humanized", description: "The draft was rewritten to sound more natural." }); },
    onError: (e: any) => toast({ title: "Humanize failed", description: e.message, variant: "destructive" }),
  });
  const betaReadersMutation = useMutation({
    mutationFn: (chapterId: number) => apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/beta-readers`),
    onSuccess: () => { invalidate(); toast({ title: "Beta reader feedback ready" }); },
    onError: (e: any) => toast({ title: "Beta readers failed", description: e.message, variant: "destructive" }),
  });
  const pacingMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/analyze-pacing`),
    onSuccess: () => { invalidate(); toast({ title: "Pacing analyzed", description: "Tension & pacing curve updated." }); },
    onError: (e: any) => toast({ title: "Pacing analysis failed", description: e.message, variant: "destructive" }),
  });
  const runInlineAi = useCallback(async (chapterId: number, payload: { action: "continue" | "rewrite"; before: string; after: string; selection: string; instruction: string }) => {
    try {
      const res = await apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/inline-ai`, payload);
      const json = await res.json();
      return json.suggestion as string;
    } catch (e: any) {
      toast({ title: "Co-writer failed", description: e.message, variant: "destructive" });
      throw e;
    }
  }, [projectId, toast]);
  const markCompleteMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/projects/${projectId}/mark-complete`),
    onSuccess: () => { invalidate(); toast({ title: "Book marked as complete!", description: "Your book is now in the Library" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const revertToEditingMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/projects/${projectId}/revert-to-editing`),
    onSuccess: () => { invalidate(); toast({ title: "Reverted to editing" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const setPriceMutation = useMutation({
    mutationFn: (priceUsd: number) => apiRequest("PATCH", `/api/projects/${projectId}`, { priceUsd }),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ["/api/library"] }); toast({ title: "Price updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const toggleStorefrontMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/projects/${projectId}/toggle-storefront`),
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ["/api/library"] }); toast({ title: project?.publishedToStore ? "Removed from Storefront" : "Published to Storefront!" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const [generatingAudioChapterId, setGeneratingAudioChapterId] = useState<number | null>(null);
  const generateChapterAudio = useCallback(async (chapterId: number) => {
    setGeneratingAudioChapterId(chapterId);
    try {
      await apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/generate-audio`);
      invalidate();
      toast({ title: "Chapter audio saved", description: "MP3 ready for download" });
    } catch (err: any) {
      toast({ title: "Audio generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingAudioChapterId(null);
    }
  }, [projectId, toast]);

  const exportPdf = useCallback(async (printMode = false) => {
    if (!data?.project) return;
    const completed = (data.chapters || []).filter(c => c.status === "complete" && c.content);
    if (completed.length === 0) return;
    setPdfLoading(true);
    try {
      await exportBookPdf(
        { id: data.project.id, title: data.project.title, authorName: data.project.authorName, coverImageUrl: data.project.coverImageUrl },
        data.chapters || [],
        trimSizeId,
        printMode,
      );
      toast({ title: printMode ? "Print PDF exported" : "PDF exported" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  }, [data, toast]);

  const downloadAudiobook = useCallback(async () => {
    if (!data?.project) return;
    setAudiobookLoading(true);
    try {
      const res = await fetch("/api/tts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: data.project.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        throw new Error(err.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "audiobook.mp3";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Audiobook downloaded" });
    } catch (err: any) {
      toast({ title: "Audiobook download failed", description: err.message, variant: "destructive" });
    } finally {
      setAudiobookLoading(false);
    }
  }, [data, toast]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-5">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-44 rounded-xl bg-muted/20" />
        <Skeleton className="h-80 rounded-xl bg-muted/20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load project</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
        <Link href="/projects"><Button className="mt-4 neon-glow text-white border-0" data-testid="button-back-projects-error">Back to Projects</Button></Link>
      </div>
    );
  }

  if (!data?.project) {
    return (
      <div className="p-8 text-center py-20">
        <p className="text-muted-foreground/60 font-mono">Project not found</p>
        <Link href="/projects"><Button className="mt-4 neon-glow text-white border-0">Back to Projects</Button></Link>
      </div>
    );
  }

  const { project, chapters, runSteps, bookDna, marketing, trendReport } = data;
  const storyEntities = data.storyEntities || [];
  const analysesByChapter = (data.chapterAnalyses || []).reduce<Record<number, ChapterAnalysis[]>>((acc, a) => {
    if (a.chapterId == null) return acc;
    (acc[a.chapterId] ||= []).push(a);
    return acc;
  }, {});
  const pacingAnalysis = (data.chapterAnalyses || []).find(a => a.chapterId == null && a.kind === "pacing_curve") || null;
  const completedChapters = chapters.filter(c => c.status === "complete");
  const isEditingMode = project.status === "editing";
  const mostRecentEditId = (() => {
    const edited = chapters.filter(c => c.lastEditedAt);
    if (edited.length === 0) return null;
    edited.sort((a, b) => new Date(b.lastEditedAt!).getTime() - new Date(a.lastEditedAt!).getTime());
    return edited[0].id;
  })();
  const pct = (() => {
    let done = 0, total = 0;
    total += 1; if (!!trendReport) done += 1;
    total += 1; if (chapters.length > 0) done += 1;
    total += 1; if (!!project.coverImageUrl) done += 1;
    if (chapters.length > 0) { total += chapters.length; done += completedChapters.length; } else { total += 1; }
    total += 1; if (!!marketing) done += 1;
    return Math.round((done / total) * 100);
  })();
  const anyRunning = trendMutation.isPending || outlineMutation.isPending || chapterMutation.isPending || marketingMutation.isPending || coverMutation.isPending;

  const pipelineActions = [
    { label: "Trend Analysis", step: "1", done: !!trendReport, action: () => trendMutation.mutate(), loading: trendMutation.isPending, icon: TrendingUp, glow: "neon-glow-cool" },
    { label: "Gen Outline", step: "2", done: chapters.length > 0, action: () => { if (chapters.length > 0) { setShowOutlineConfirm(true); } else { outlineMutation.mutate(); } }, loading: outlineMutation.isPending, icon: List, glow: "neon-glow" },
    { label: "AI Cover", step: "3", done: !!project.coverImageUrl, action: () => coverMutation.mutate(), loading: coverMutation.isPending, icon: Image, glow: "neon-glow-warm" },
    { label: "Write Chs", step: "4", done: completedChapters.length === chapters.length && chapters.length > 0, action: () => { const p = chapters.filter(c => c.status === "pending"); if (p.length > 0) { chapterMutation.mutate(p[0].id); } else if (chapters.length > 0) { chapterMutation.mutate(chapters[0].id); } }, loading: chapterMutation.isPending, icon: PenTool, glow: "neon-glow-fire" },
    { label: "Marketing", step: "5", done: !!marketing, action: () => marketingMutation.mutate(), loading: marketingMutation.isPending, icon: Megaphone, glow: "neon-glow-nature" },
  ];

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <Helmet>
        <title>{project.title} — Lexora</title>
        <meta name="description" content={`${project.title} by ${project.authorName || "Unknown Author"} — ${statusLabel(project.status)} in ${VERTICAL_LABELS[project.vertical] || project.vertical}.`} />
      </Helmet>
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-muted-foreground/50 hover:text-purple-400 font-mono text-[11px]" data-testid="button-back-projects">
            <ArrowLeft className="h-4 w-4 mr-1" /> PROJECTS
          </Button>
        </Link>
        <span className="text-muted-foreground/20">/</span>
        <span className="font-mono text-[11px] truncate max-w-xs text-muted-foreground/50">{project.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/20 bg-card/30 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-[1px] neon-glow opacity-40" />
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl glow-border bg-card/50 text-xl">
                  {VERTICAL_ICONS[project.vertical] || "\u{1F4D6}"}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold tracking-tighter leading-tight">{project.title}</h1>
                  {project.authorName && (
                    <p className="text-[11px] text-muted-foreground/50 mt-1 flex items-center gap-1.5 font-mono">
                      <User className="h-3 w-3 text-purple-400/50" /> {project.authorName}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-purple-400/60 uppercase tracking-wider">{VERTICAL_LABELS[project.vertical] || project.vertical}</span>
                    <span className="text-muted-foreground/15">\u2022</span>
                    <span className="text-[10px] font-mono text-muted-foreground/40 capitalize">{project.targetLanguage}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {anyRunning && <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />}
                  <Button size="icon" variant="ghost" onClick={() => { invalidate(); refetch(); }} data-testid="button-refresh" className="h-8 w-8 text-muted-foreground/40 hover:text-purple-400" aria-label="Refresh project data">
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/60">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_GLOW[project.status] || "bg-zinc-500"}`} />
                    {statusLabel(project.status)}
                    {project.greenlightScore && (
                      <Badge variant="outline" className="text-[10px] font-mono ml-2 border-border/30">GL {formatScore(project.greenlightScore)}</Badge>
                    )}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/40">{pct}%</span>
                </div>
                <Progress value={pct} className="h-[3px]" />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-5">
                {[
                  { label: "WORDS", value: project.wordCount.toLocaleString() },
                  { label: "CH", value: `${completedChapters.length}/${project.chapterCount || chapters.length}` },
                  { label: "QUAL", value: project.qualityScore ? formatScore(project.qualityScore) : "\u2014", color: scoreColor(project.qualityScore) },
                  { label: "GL", value: project.greenlightScore ? formatScore(project.greenlightScore) : "\u2014" },
                  { label: "COST", value: project.estimatedCost > 0 ? `$${project.estimatedCost.toFixed(3)}` : "$0" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/[0.02] border border-border/15 rounded-lg py-2.5 text-center">
                    <div className={`text-[12px] font-bold font-mono ${color || ""}`}>{value}</div>
                    <div className="text-[8px] font-mono text-muted-foreground/30 mt-0.5 tracking-widest">{label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {pipelineActions.map(({ label, step, done, action, loading, icon: Icon, glow }) => (
              <button
                key={label}
                onClick={action}
                disabled={loading || anyRunning}
                data-testid={`pipeline-step-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center text-[10px] font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${done
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:border-amber-500/20 hover:bg-amber-500/[0.03] hover:text-amber-300"
                  : "border-border/20 bg-card/20 hover:border-purple-500/20 hover:bg-purple-500/[0.03] text-muted-foreground/60"}`}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                ) : done ? (
                  <div className="relative">
                    <CheckCircle className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                    <RefreshCw className="absolute -bottom-1 -right-1.5 h-2.5 w-2.5 text-muted-foreground/40" />
                  </div>
                ) : (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${glow} shadow-lg`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <span className="leading-tight tracking-wider uppercase">{done ? `↻ ${label}` : `${step}. ${label}`}</span>
              </button>
            ))}
          </div>

          {isEditingMode && (
            <Card className="border-amber-500/20 bg-amber-500/[0.03] overflow-hidden" data-testid="editing-mode-banner">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Edit3 className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold tracking-tight text-amber-300">Editing Mode</p>
                      <p className="text-[10px] text-muted-foreground/50 font-mono">
                        {mostRecentEditId ? `Last edited: Ch ${chapters.find(c => c.id === mostRecentEditId)?.chapterNumber || "?"}` : "Click EDIT on any chapter to make changes"}
                        {" · "}{completedChapters.length}/{chapters.length} chapters complete
                      </p>
                    </div>
                  </div>
                  <Button
                    className="neon-glow-nature text-white border-0 font-mono text-[11px] h-9 px-5"
                    onClick={() => markCompleteMutation.mutate()}
                    disabled={markCompleteMutation.isPending || completedChapters.length < chapters.length}
                    data-testid="button-mark-complete"
                  >
                    {markCompleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                    MARK AS COMPLETE
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {project.status === "complete" && (
            <Card className="border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden" data-testid="complete-banner">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold tracking-tight text-emerald-300">Book Complete</p>
                      <p className="text-[10px] text-muted-foreground/50 font-mono">
                        This book is published in your Library
                        {project.publishedToStore && " · Live on Storefront"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className={project.publishedToStore
                        ? "border-purple-500/30 text-purple-300 font-mono text-[11px] h-9 hover:border-purple-500/50 hover:bg-purple-500/10"
                        : "border-purple-500/20 text-purple-400 font-mono text-[11px] h-9 hover:border-purple-500/40 hover:bg-purple-500/5"
                      }
                      onClick={() => toggleStorefrontMutation.mutate()}
                      disabled={toggleStorefrontMutation.isPending}
                      data-testid="button-toggle-storefront"
                    >
                      {toggleStorefrontMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1.5" />}
                      {project.publishedToStore ? "ON STOREFRONT" : "ADD TO STOREFRONT"}
                    </Button>
                    {project.publishedToStore && (
                      <div className="flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 h-9">
                        <span className="text-[10px] font-mono text-amber-300/70">$</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={(project.priceUsd || 0) > 0 ? String(project.priceUsd) : ""}
                          placeholder="Free"
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="h-7 w-16 border-0 bg-transparent px-0 text-[11px] font-mono focus-visible:ring-0"
                          data-testid="input-book-price"
                        />
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 px-2 text-[10px] font-mono text-amber-300 hover:bg-amber-500/10"
                          onClick={() => {
                            const v = parseFloat(priceInput);
                            setPriceMutation.mutate(isNaN(v) || v < 0 ? 0 : v);
                          }}
                          disabled={setPriceMutation.isPending}
                          data-testid="button-save-price"
                        >
                          {setPriceMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set Price"}
                        </Button>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="border-amber-500/20 text-amber-400 font-mono text-[11px] h-9 hover:border-amber-500/40 hover:bg-amber-500/5"
                      onClick={() => revertToEditingMutation.mutate()}
                      disabled={revertToEditingMutation.isPending}
                      data-testid="button-revert-editing"
                    >
                      {revertToEditingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Edit3 className="h-3.5 w-3.5 mr-1.5" />}
                      REVERT TO EDITING
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="chapters">
            <TabsList className="h-10 bg-card/30 border border-border/20">
              <TabsTrigger value="chapters" data-testid="tab-chapters" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-purple-300">
                <BookOpen className="h-3 w-3" /> Chapters ({chapters.length})
              </TabsTrigger>
              <TabsTrigger value="dna" data-testid="tab-dna" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-cyan-300">
                <Zap className="h-3 w-3" /> DNA
              </TabsTrigger>
              <TabsTrigger value="marketing" data-testid="tab-marketing" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-pink-300">
                <Megaphone className="h-3 w-3" /> Marketing
              </TabsTrigger>
              <TabsTrigger value="continuity" data-testid="tab-continuity" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-emerald-300">
                <Network className="h-3 w-3" /> Continuity
              </TabsTrigger>
              <TabsTrigger value="market" data-testid="tab-market" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-orange-300">
                <Crosshair className="h-3 w-3" /> Market
              </TabsTrigger>
              <TabsTrigger value="pacing" data-testid="tab-pacing" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-violet-300">
                <Activity className="h-3 w-3" /> Pacing
              </TabsTrigger>
              <TabsTrigger value="business" data-testid="tab-business" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-emerald-300">
                <DollarSign className="h-3 w-3" /> Business
              </TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-amber-300">
                <FileText className="h-3 w-3" /> Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chapters" className="mt-4 space-y-2">
              {chapters.length === 0 ? (
                <Card className="border-border/20 bg-card/30">
                  <CardContent className="flex flex-col items-center justify-center py-14">
                    <div className="relative">
                      <div className="absolute inset-0 neon-glow opacity-20 blur-2xl rounded-full" />
                      <BookOpen className="h-10 w-10 text-purple-500/30 relative" />
                    </div>
                    <p className="font-bold mt-4 tracking-tight">No chapters yet</p>
                    <p className="text-[11px] text-muted-foreground/40 font-mono mt-1">Generate outline first</p>
                    <Button className="mt-5 neon-glow text-white border-0 font-mono text-[11px]" onClick={() => outlineMutation.mutate()} disabled={outlineMutation.isPending} data-testid="button-generate-outline-empty">
                      {outlineMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <List className="h-3.5 w-3.5 mr-1.5" />}
                      GENERATE OUTLINE
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                chapters.map(ch => (
                  <ChapterCard
                    key={ch.id}
                    chapter={ch}
                    onGenerate={(cid) => chapterMutation.mutate(cid)}
                    isGenerating={chapterMutation.isPending}
                    onCancel={(cid) => cancelChapterMutation.mutate(cid)}
                    isCancelling={cancelChapterMutation.isPending}
                    projectId={projectId}
                    isEditingMode={isEditingMode}
                    isProjectComplete={project.status === "complete"}
                    onSaveEdit={(cid, content) => editChapterMutation.mutate({ chapterId: cid, content })}
                    isSavingEdit={editChapterMutation.isPending}
                    editingChapterId={editingChapterId}
                    onStartEdit={(cid) => setEditingChapterId(cid)}
                    onCancelEdit={() => setEditingChapterId(null)}
                    onGenerateAudio={(cid) => generateChapterAudio(cid)}
                    isGeneratingAudio={generatingAudioChapterId === ch.id}
                    mostRecentEditId={mostRecentEditId}
                    onRevise={(cid, instruction) => reviseChapterMutation.mutate({ chapterId: cid, instruction })}
                    isRevising={reviseChapterMutation.isPending && revisingChapterId === ch.id}
                    revisingChapterId={revisingChapterId}
                    onStartRevise={(cid) => setRevisingChapterId(cid)}
                    onCancelRevise={() => setRevisingChapterId(null)}
                    analyses={analysesByChapter[ch.id] || []}
                    onRunBoard={(cid) => editorialBoardMutation.mutate(cid)}
                    onRunHumanize={(cid) => humanizeMutation.mutate(cid)}
                    onRunBeta={(cid) => betaReadersMutation.mutate(cid)}
                    boardPending={editorialBoardMutation.isPending && editorialBoardMutation.variables === ch.id}
                    humanizePending={humanizeMutation.isPending && humanizeMutation.variables === ch.id}
                    betaPending={betaReadersMutation.isPending && betaReadersMutation.variables === ch.id}
                    onInlineAi={runInlineAi}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="dna" className="mt-4">
              {!bookDna ? (
                <Card className="border-border/20 bg-card/30">
                  <CardContent className="flex flex-col items-center justify-center py-14">
                    <Zap className="h-10 w-10 text-cyan-500/30" />
                    <p className="font-bold mt-4 tracking-tight">Book DNA not generated</p>
                    <p className="text-[11px] text-muted-foreground/40 font-mono mt-1">Generate outline to create DNA</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: "Core Promise", value: bookDna.corePromise, glow: "glow-border" },
                    { label: "Reader Avatar", value: bookDna.readerAvatar, glow: "glow-border-cyan" },
                    { label: "Tone & Style", value: bookDna.toneRules, glow: "glow-border-pink" },
                    { label: "Transformation Arc", value: bookDna.transformationArc, glow: "glow-border" },
                    { label: "Framework", value: bookDna.frameworkSummary, glow: "glow-border-cyan" },
                  ].filter(f => f.value).map(({ label, value, glow }) => (
                    <Card key={label} className={`border-border/20 bg-card/30 ${glow}`}>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">{label}</p>
                        <p className="text-sm leading-relaxed text-muted-foreground/80">{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="marketing" className="mt-4">
              {!marketing ? (
                <Card className="border-border/20 bg-card/30">
                  <CardContent className="flex flex-col items-center justify-center py-14">
                    <Megaphone className="h-10 w-10 text-pink-500/30" />
                    <p className="font-bold mt-4 tracking-tight">Marketing not generated</p>
                    <Button className="mt-5 neon-glow-warm text-white border-0 font-mono text-[11px]" onClick={() => marketingMutation.mutate()} disabled={marketingMutation.isPending || chapters.length === 0}>
                      {marketingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5 mr-1.5" />}
                      GENERATE MARKETING
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {marketing.shortBlurb && (
                    <Card className="border-border/20 bg-card/30 glow-border-pink"><CardContent className="pt-4 pb-4">
                      <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-pink-400/50 mb-2">Short Blurb</p>
                      <p className="text-sm leading-relaxed text-muted-foreground/80">{marketing.shortBlurb}</p>
                    </CardContent></Card>
                  )}
                  {marketing.amazonDescription && (
                    <Card className="border-border/20 bg-card/30"><CardContent className="pt-4 pb-4">
                      <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Amazon Description</p>
                      <div className="text-sm leading-relaxed text-muted-foreground/80" dangerouslySetInnerHTML={{ __html: sanitizeHtml(marketing.amazonDescription) }} />
                    </CardContent></Card>
                  )}
                  {marketing.hooks && marketing.hooks.length > 0 && (
                    <Card className="border-border/20 bg-card/30"><CardContent className="pt-4 pb-4">
                      <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Social Hooks</p>
                      <div className="space-y-1.5">
                        {marketing.hooks.map((h, i) => (
                          <div key={i} className="text-sm bg-white/[0.02] border border-border/15 rounded-lg px-3.5 py-2.5">
                            <span className="text-[9px] font-mono text-purple-400/50 font-bold mr-2">#{i + 1}</span>
                            <span className="text-muted-foreground/70">{h}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent></Card>
                  )}
                  {!!marketing.pricingMatrix && (
                    <Card className="border-border/20 bg-card/30"><CardContent className="pt-4 pb-4">
                      <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Pricing Matrix</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(marketing.pricingMatrix as Record<string, any>).map(([format, price]) => (
                          <div key={format} className="bg-white/[0.02] border border-border/15 rounded-lg p-3 text-center">
                            <div className="text-sm font-bold font-mono text-purple-300">{typeof price === "object" ? JSON.stringify(price) : price}</div>
                            <div className="text-[8px] font-mono text-muted-foreground/30 capitalize mt-0.5 tracking-widest">{format}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent></Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="continuity" className="mt-4">
              <ContinuityPanel
                projectId={projectId}
                project={project}
                entities={storyEntities}
                series={data.series}
                styleFingerprint={data.styleFingerprint}
                hasChapters={completedChapters.length > 0}
                onChanged={invalidate}
              />
            </TabsContent>

            <TabsContent value="market" className="mt-4">
              <MarketPanel
                projectId={projectId}
                reports={data.marketReports || []}
                hasOutline={chapters.length > 0}
                onChanged={invalidate}
              />
            </TabsContent>

            <TabsContent value="pacing" className="mt-4">
              <PacingPanel
                analysis={pacingAnalysis}
                onAnalyze={() => pacingMutation.mutate()}
                isPending={pacingMutation.isPending}
                canAnalyze={completedChapters.length >= 2}
                chapterCount={completedChapters.length}
              />
            </TabsContent>

            <TabsContent value="business" className="mt-4">
              <BusinessPanel
                projectId={projectId}
                forecasts={data.revenueForecasts || []}
                tests={data.abTests || []}
                onChanged={invalidate}
              />
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              {runSteps.length === 0 ? (
                <Card className="border-border/20 bg-card/30"><CardContent className="flex items-center justify-center py-14">
                  <p className="text-muted-foreground/40 text-[11px] font-mono">No run steps recorded</p>
                </CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {runSteps.map(step => (
                    <div key={step.id} className="flex items-start gap-3.5 p-3.5 border border-border/20 rounded-xl bg-card/30">
                      <StepStatus status={step.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-[12px] font-bold tracking-tight">{step.stepName}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-mono border-border/30">{step.model}</Badge>
                            {step.status === "complete" && (
                              <span className="text-[10px] font-mono text-emerald-400">{step.tokensUsed.toLocaleString()} tok</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-muted-foreground/40 flex-wrap">
                          {step.durationMs && <span>{(step.durationMs / 1000).toFixed(1)}s</span>}
                          {step.qualityScore && <span className={scoreColor(step.qualityScore)}>Q:{formatScore(step.qualityScore)}</span>}
                          {step.errorMessage && <span className="text-red-400">{step.errorMessage}</span>}
                          <span>{new Date(step.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-5">
          <Card className="border-border/20 bg-card/30 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-mono font-bold tracking-wider uppercase text-muted-foreground/50">
                <Image className="h-3 w-3 inline mr-1.5 text-pink-400/50" /> Cover
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.coverImageUrl ? (
                <div className="space-y-3">
                  <div
                    className="relative rounded-xl overflow-hidden glow-border-pink cursor-pointer group"
                    onClick={() => setShowCoverFull(true)}
                    data-testid="button-view-cover-full"
                  >
                    <img src={project.coverImageUrl} alt="Book cover" className="w-full object-contain rounded-xl bg-card/50 transition-transform group-hover:scale-[1.02]" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-xl">
                      <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <Textarea
                      value={coverText}
                      onChange={(e) => setCoverText(e.target.value)}
                      placeholder="Describe what you want on the cover (e.g., 'a lone astronaut on Mars with Earth in the sky')..."
                      className="min-h-[60px] text-[11px] bg-card/30 border-border/20 font-mono resize-y focus:border-pink-500/30"
                      data-testid="input-cover-prompt"
                    />
                    <Input
                      value={coverAvoid}
                      onChange={(e) => setCoverAvoid(e.target.value)}
                      placeholder="Styles to avoid (e.g., 'cartoon, clipart, neon colors')"
                      className="h-8 text-[11px] bg-card/30 border-border/20 font-mono focus:border-pink-500/30"
                      data-testid="input-cover-avoid"
                    />
                  </div>
                  <Button
                    size="sm" variant="outline"
                    className="w-full border-border/30 font-mono text-[10px] hover:border-pink-500/30"
                    onClick={() => coverMutation.mutate()}
                    disabled={coverMutation.isPending}
                    data-testid="button-regenerate-cover"
                  >
                    {coverMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5 text-pink-400" />}
                    REGENERATE COVER
                  </Button>
                  <Dialog open={showCoverFull} onOpenChange={setShowCoverFull}>
                    <DialogContent className="max-w-3xl w-auto bg-black/95 border-border/20 p-2">
                      <DialogTitle className="sr-only">Book Cover Preview</DialogTitle>
                      <img
                        src={project.coverImageUrl}
                        alt="Book cover full view"
                        className="max-h-[85vh] w-auto object-contain rounded-lg"
                        data-testid="img-cover-full"
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col items-center justify-center aspect-[3/4] rounded-xl bg-white/[0.02] border border-dashed border-border/20">
                    <Image className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-[10px] text-muted-foreground/40 font-mono">No cover</p>
                  </div>
                  <Textarea
                    value={coverText}
                    onChange={(e) => setCoverText(e.target.value)}
                    placeholder="Describe what you want on the cover (e.g., 'a lone astronaut on Mars with Earth in the sky')..."
                    className="min-h-[60px] text-[11px] bg-card/30 border-border/20 font-mono resize-y focus:border-pink-500/30"
                    data-testid="input-cover-prompt"
                  />
                  <Input
                    value={coverAvoid}
                    onChange={(e) => setCoverAvoid(e.target.value)}
                    placeholder="Styles to avoid (e.g., 'cartoon, clipart, neon colors')"
                    className="h-8 text-[11px] bg-card/30 border-border/20 font-mono focus:border-pink-500/30"
                    data-testid="input-cover-avoid"
                  />
                  <Button size="sm" variant="outline" className="w-full border-border/30 font-mono text-[10px] hover:border-pink-500/30" onClick={() => coverMutation.mutate()} disabled={coverMutation.isPending} data-testid="button-generate-cover">
                    {coverMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Zap className="h-3 w-3 mr-1.5 text-pink-400" />}
                    GENERATE
                  </Button>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border/10 space-y-2">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40">Brand Kit</p>
                <Select
                  value={project.brandKitId ? String(project.brandKitId) : "none"}
                  onValueChange={(v) => brandKitMutation.mutate(v === "none" ? null : parseInt(v, 10))}
                >
                  <SelectTrigger className="h-8 text-[11px] bg-card/30 border-border/20 font-mono" data-testid="select-brand-kit">
                    <SelectValue placeholder="No brand kit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No brand kit</SelectItem>
                    {(brandKits || []).map((kit) => (
                      <SelectItem key={kit.id} value={String(kit.id)} data-testid={`option-brand-kit-${kit.id}`}>{kit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[8px] text-muted-foreground/30 font-mono">Brand palette & fonts are applied to cover generation. Manage kits in Settings.</p>
              </div>

              <div className="mt-3 pt-3 border-t border-border/10 space-y-2">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40">Cover Variant Studio</p>
                <div className="flex items-center gap-2">
                  <Select value={variantCount} onValueChange={setVariantCount}>
                    <SelectTrigger className="h-8 w-16 text-[11px] bg-card/30 border-border/20 font-mono" data-testid="select-variant-count">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "4"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm" variant="outline"
                    className="flex-1 border-border/30 font-mono text-[10px] hover:border-pink-500/30"
                    onClick={() => coverVariantsMutation.mutate()}
                    disabled={coverVariantsMutation.isPending}
                    data-testid="button-generate-variants"
                  >
                    {coverVariantsMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5 text-pink-400" />}
                    GENERATE VARIANTS
                  </Button>
                </div>
                {coverVariantsMutation.isPending && (
                  <p className="text-[8px] text-muted-foreground/30 font-mono">Generating {variantCount} variant{variantCount !== "1" ? "s" : ""}… each uses one image credit.</p>
                )}
                {(data.coverVariants && data.coverVariants.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {data.coverVariants.map((variant) => (
                      <div
                        key={variant.id}
                        className={cn(
                          "relative rounded-lg overflow-hidden border group",
                          variant.isSelected ? "border-pink-500/60 glow-border-pink" : "border-border/20",
                        )}
                        data-testid={`cover-variant-${variant.id}`}
                      >
                        <img src={variant.imageUrl} alt="Cover variant" className="w-full aspect-[2/3] object-cover" />
                        {variant.isSelected && (
                          <div className="absolute top-1 left-1 bg-pink-500/90 rounded-full p-0.5">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60">
                          <Button
                            size="sm"
                            className="h-6 text-[9px] font-mono bg-pink-500/80 hover:bg-pink-500 text-white border-0"
                            onClick={() => selectVariantMutation.mutate(variant.id)}
                            disabled={selectVariantMutation.isPending || variant.isSelected}
                            data-testid={`button-select-variant-${variant.id}`}
                          >
                            {variant.isSelected ? "SELECTED" : "USE THIS"}
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-6 text-[9px] font-mono border-border/40 bg-black/40"
                            onClick={() => deleteVariantMutation.mutate(variant.id)}
                            disabled={deleteVariantMutation.isPending}
                            data-testid={`button-delete-variant-${variant.id}`}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {completedChapters.length > 0 && (
            <Card className="border-border/20 bg-card/30 glow-border-nature">
              <CardContent className="pt-5 pb-5">
                <Button
                  className="w-full neon-glow-nature text-white border-0 font-mono text-[11px] h-10"
                  onClick={() => setShowReader(true)}
                  data-testid="button-read-book"
                >
                  <Eye className="h-4 w-4 mr-2" /> READ BOOK
                </Button>
                <p className="text-[9px] text-muted-foreground/30 font-mono mt-2 text-center">{completedChapters.length} chapters · Full-screen reader</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/20 bg-card/30 glow-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-mono font-bold tracking-wider uppercase text-muted-foreground/50">
                <Download className="h-3 w-3 inline mr-1.5 text-purple-400/50" /> Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {completedChapters.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/40 font-mono">Complete a chapter to export</p>
              ) : (
                <>
                  <p className="text-[10px] text-muted-foreground/40 font-mono mb-3">{completedChapters.length}/{chapters.length} chapters ready</p>
                  <Button
                    variant="outline" size="sm"
                    className="w-full justify-start border-border/30 bg-card/20 font-mono text-[10px] hover:border-purple-500/30"
                    onClick={() => exportPdf()}
                    disabled={pdfLoading}
                    data-testid="button-export-pdf"
                  >
                    {pdfLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-2 text-amber-400/60" />}
                    .PDF (Print-Ready)
                  </Button>
                  <div className="flex items-center gap-2 -mt-1">
                    <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider shrink-0">Trim</span>
                    <Select value={trimSizeId} onValueChange={setTrimSizeId}>
                      <SelectTrigger className="h-7 text-[10px] bg-card/30 border-border/20 font-mono" data-testid="select-trim-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIM_SIZES.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-[10px]" data-testid={`option-trim-${t.id}`}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="w-full justify-start border-border/30 bg-card/20 font-mono text-[10px] hover:border-orange-500/30"
                    onClick={() => exportPdf(true)}
                    disabled={pdfLoading}
                    data-testid="button-export-print-pdf"
                  >
                    {pdfLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-2 text-orange-400/60" />}
                    .PDF (Print + Bleed)
                  </Button>
                  <a href={`/api/projects/${projectId}/export?format=epub`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start border-border/30 bg-card/20 font-mono text-[10px] hover:border-purple-500/30" data-testid="button-export-epub">
                      <BookOpen className="h-3.5 w-3.5 mr-2 text-emerald-400/50" /> .EPUB (eReaders)
                    </Button>
                  </a>
                  <a href={`/api/projects/${projectId}/export?format=mobi`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start border-border/30 bg-card/20 font-mono text-[10px] hover:border-purple-500/30" data-testid="button-export-mobi">
                      <BookOpen className="h-3.5 w-3.5 mr-2 text-blue-400/50" /> .MOBI (Kindle)
                    </Button>
                  </a>
                  <a href={`/api/projects/${projectId}/export?format=docx`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start border-border/30 bg-card/20 font-mono text-[10px] hover:border-purple-500/30" data-testid="button-export-docx">
                      <FileText className="h-3.5 w-3.5 mr-2 text-sky-400/50" /> .DOCX (Word)
                    </Button>
                  </a>
                  <a href={`/api/projects/${projectId}/export?format=txt`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start border-border/30 bg-card/20 font-mono text-[10px] hover:border-purple-500/30" data-testid="button-export-txt">
                      <FileText className="h-3.5 w-3.5 mr-2 text-muted-foreground/40" /> .TXT
                    </Button>
                  </a>
                  <a href={`/api/projects/${projectId}/export?format=html`} download>
                    <Button variant="outline" size="sm" className="w-full justify-start border-border/30 bg-card/20 font-mono text-[10px] hover:border-purple-500/30" data-testid="button-export-html">
                      <BookOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground/40" /> .HTML
                    </Button>
                  </a>
                  <div className="pt-2 border-t border-border/10">
                    <Button
                      variant="outline" size="sm"
                      className="w-full justify-start border-purple-500/20 bg-purple-500/5 font-mono text-[10px] hover:border-purple-500/40 text-purple-300"
                      onClick={downloadAudiobook}
                      disabled={audiobookLoading}
                      data-testid="button-download-audiobook"
                    >
                      {audiobookLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Volume2 className="h-3.5 w-3.5 mr-2 text-purple-400" />}
                      .MP3 Audiobook (AI Voice)
                    </Button>
                    <p className="text-[8px] text-muted-foreground/30 font-mono mt-1 ml-1">ElevenLabs · Your voice narration</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {completedChapters.length > 0 && (
            <Card className="border-border/20 bg-card/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-[11px] font-mono font-bold tracking-wider uppercase text-muted-foreground/50 flex items-center justify-between">
                  <span><Music className="h-3 w-3 inline mr-1.5 text-cyan-400/50" />Audio Files</span>
                  <span className="text-[9px] font-normal text-muted-foreground/30">
                    {completedChapters.filter(c => c.audioUrl).length}/{completedChapters.length} generated
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="space-y-0.5 mb-3">
                  {completedChapters.map(chapter => (
                    <div key={chapter.id} className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0">
                      <span className="text-[9px] font-mono text-muted-foreground/30 w-4 shrink-0 text-right">{chapter.chapterNumber}</span>
                      <p className="text-[10px] font-mono text-muted-foreground/60 flex-1 truncate min-w-0">{chapter.title}</p>
                      {chapter.audioUrl ? (
                        <a href={`/api/projects/${projectId}/chapters/${chapter.id}/audio`} download onClick={e => e.stopPropagation()} data-testid={`audio-download-${chapter.id}`}>
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0 border-cyan-500/25 text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/5 shrink-0" aria-label="Download chapter audio">
                            <Download className="h-2.5 w-2.5" />
                          </Button>
                        </a>
                      ) : (
                        <Button size="sm" variant="outline"
                          className="h-6 w-6 p-0 border-purple-500/20 text-purple-400 hover:border-purple-500/40 hover:bg-purple-500/5 shrink-0"
                          onClick={() => generateChapterAudio(chapter.id)}
                          disabled={generatingAudioChapterId === chapter.id}
                          aria-label="Generate chapter audio"
                          data-testid={`audio-gen-${chapter.id}`}
                        >
                          {generatingAudioChapterId === chapter.id
                            ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            : <Zap className="h-2.5 w-2.5" />}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {completedChapters.some(c => c.audioUrl) && (
                  <Button
                    variant="outline" size="sm"
                    className="w-full border-cyan-500/20 bg-cyan-500/5 font-mono text-[10px] hover:border-cyan-500/40 text-cyan-300"
                    onClick={downloadAudiobook}
                    disabled={audiobookLoading}
                    data-testid="button-download-full-audiobook"
                  >
                    {audiobookLoading
                      ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      : <Download className="h-3 w-3 mr-1.5 text-cyan-400" />}
                    Download Full Audiobook
                  </Button>
                )}
                {!completedChapters.some(c => c.audioUrl) && (
                  <p className="text-[9px] text-muted-foreground/30 font-mono text-center">Hit <Zap className="h-2.5 w-2.5 inline text-purple-400" /> on any chapter to generate its MP3</p>
                )}
              </CardContent>
            </Card>
          )}

          {trendReport && (
            <Card className="border-border/20 bg-card/30 glow-border-cyan">
              <CardHeader className="pb-3">
                <CardTitle className="text-[11px] font-mono font-bold tracking-wider uppercase text-muted-foreground/50">
                  <TrendingUp className="h-3 w-3 inline mr-1.5 text-cyan-400/50" /> Trend Report
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base">{VERTICAL_ICONS[trendReport.vertical] || "📊"}</span>
                  <span className="text-[12px] font-mono font-bold text-cyan-300/80 uppercase tracking-wider">{VERTICAL_LABELS[trendReport.vertical] || trendReport.vertical}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {trendReport.summary && (
                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{trendReport.summary}</p>
                )}
                <div className="space-y-2.5">
                  {[
                    { label: "Demand", score: trendReport.demandScore },
                    { label: "Competition", score: trendReport.competitionScore },
                    { label: "Greenlight", score: trendReport.greenlightScore },
                  ].map(({ label, score }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground/40">{label}</span>
                        <span className="text-[10px] font-mono font-bold">{formatScore(score)}</span>
                      </div>
                      <Progress value={score != null ? (score / 10) * 100 : 0} className="h-[3px]" />
                    </div>
                  ))}
                </div>
                {trendReport.painPoints && trendReport.painPoints.length > 0 && (
                  <div>
                    <p className="text-[9px] font-mono font-bold text-muted-foreground/40 mb-2 tracking-widest uppercase">Pain Points</p>
                    <div className="space-y-1.5">
                      {trendReport.painPoints.slice(0, 3).map((p, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground/50 bg-white/[0.02] border border-border/15 rounded-lg px-2.5 py-1.5 font-mono">{p}</div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showReader && (
        <BookReader
          title={project.title}
          authorName={project.authorName || "Unknown Author"}
          chapters={chapters}
          coverImageUrl={project.coverImageUrl}
          onClose={() => setShowReader(false)}
          onStartNarration={startNarration}
        />
      )}

      <AlertDialog open={showOutlineConfirm} onOpenChange={setShowOutlineConfirm}>
        <AlertDialogContent className="glass-panel border-stone-800/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Regenerate Outline?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/60">
              This will delete all {chapters.length} existing chapters and their content. Generated audio will also be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-stone-700 text-stone-300" data-testid="button-cancel-outline-regen">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-outline-regen"
              onClick={() => { setShowOutlineConfirm(false); outlineMutation.mutate(); }}
            >
              Delete Chapters & Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
