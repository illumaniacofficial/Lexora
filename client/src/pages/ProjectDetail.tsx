import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useCallback } from "react";
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
  Save, Edit3, Check, Music, ArrowRight, Globe,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { cn, formatScore, scoreColor, statusLabel, VERTICAL_LABELS, STATUS_GLOW, VERTICAL_ICONS, sanitizeHtml } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportBookPdf } from "@/lib/export-book";
import { useToast } from "@/hooks/use-toast";
import BookReader from "@/components/book-reader";
import { useNarration } from "@/App";
import { MarkdownRendererDark, stripMarkdown } from "@/components/markdown-renderer";
import type { Project, Chapter, RunStep, BookDna, MarketingAsset, TrendReport } from "@shared/schema";

interface ProjectDetailData {
  project: Project;
  chapters: Chapter[];
  runSteps: RunStep[];
  bookDna?: BookDna;
  marketing?: MarketingAsset;
  trendReport?: TrendReport;
}


function StepStatus({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-muted-foreground/30" />;
}

function ChapterCard({ chapter, onGenerate, isGenerating, onCancel, isCancelling, projectId, isEditingMode, isProjectComplete, onSaveEdit, isSavingEdit, editingChapterId, onStartEdit, onCancelEdit, onGenerateAudio, isGeneratingAudio, mostRecentEditId }: {
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
}) {
  const [expanded, setExpanded] = useState(false);
  const [editContent, setEditContent] = useState("");

  const isEditing = editingChapterId === chapter.id;

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
                  ) : null}
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
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[300px] text-[12px] bg-card/50 border-amber-500/15 font-mono resize-y focus:border-amber-500/30 leading-relaxed"
            data-testid={`textarea-edit-chapter-${chapter.id}`}
          />
          <p className="text-[8px] font-mono text-muted-foreground/30 mt-1">
            {editContent.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words
          </p>
        </div>
      )}
      {expanded && !isEditing && chapter.content && (
        <div className="px-4 pb-4 border-t border-border/15">
          <ScrollArea className="h-52 mt-3">
            <MarkdownRendererDark content={chapter.content} />
          </ScrollArea>
        </div>
      )}
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

  const exportPdf = useCallback(async () => {
    if (!data?.project) return;
    const completed = (data.chapters || []).filter(c => c.status === "complete" && c.content);
    if (completed.length === 0) return;
    setPdfLoading(true);
    try {
      await exportBookPdf(
        { id: data.project.id, title: data.project.title, authorName: data.project.authorName, coverImageUrl: data.project.coverImageUrl },
        data.chapters || [],
      );
      toast({ title: "PDF exported" });
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
                  {marketing.pricingMatrix && (
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
                    onClick={exportPdf}
                    disabled={pdfLoading}
                    data-testid="button-export-pdf"
                  >
                    {pdfLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileDown className="h-3.5 w-3.5 mr-2 text-amber-400/60" />}
                    .PDF (Book Format)
                  </Button>
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
