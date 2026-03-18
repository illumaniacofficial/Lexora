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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, TrendingUp, List, PenTool, Megaphone, Image, Play, CheckCircle, Clock, X,
  Loader2, AlertCircle, BookOpen, Zap, Star, FileText, RefreshCw, ChevronDown, ChevronUp, Download, User, Hexagon, Eye, FileDown, Volume2,
  Save, Edit3, Check, Music, ArrowRight,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatScore, scoreColor, statusLabel, VERTICAL_LABELS, STATUS_GLOW, VERTICAL_ICONS, sanitizeHtml } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

function ChapterCard({ chapter, onGenerate, isGenerating, onCancel, isCancelling, projectId, isEditingMode, onSaveEdit, isSavingEdit, onGenerateAudio, isGeneratingAudio, mostRecentEditId }: {
  chapter: Chapter;
  onGenerate: (id: number) => void;
  isGenerating: boolean;
  onCancel: (id: number) => void;
  isCancelling: boolean;
  projectId: number;
  isEditingMode: boolean;
  onSaveEdit: (id: number, content: string) => void;
  isSavingEdit: boolean;
  onGenerateAudio: (id: number) => void;
  isGeneratingAudio: boolean;
  mostRecentEditId: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(chapter.content || "");
    setIsEditing(true);
    setExpanded(true);
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveEdit(chapter.id, editContent);
    setIsEditing(false);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
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
                  ) : (
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
                  )}
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

  const exportPdf = useCallback(async () => {
    if (!data?.project) return;
    const completed = (data.chapters || []).filter(c => c.status === "complete" && c.content);
    if (completed.length === 0) return;
    setPdfLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 72;
      const marginTop = 72;
      const marginBottom = 72;
      const contentW = pageW - marginX * 2;
      const lineH = 16;
      const maxY = pageH - marginBottom;

      const addPageNumber = (num: number) => {
        doc.setFont("times", "normal");
        doc.setFontSize(9);
        doc.setTextColor(160, 160, 160);
        doc.text(String(num), pageW / 2, pageH - 36, { align: "center" });
      };

      let pageNum = 1;

      if (data.project.coverImageUrl) {
        try {
          const loadCoverImage = (): Promise<string> => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/jpeg", 0.92));
              };
              img.onerror = () => reject(new Error("Failed to load cover"));
              img.src = data.project.coverImageUrl!;
            });
          };
          const coverDataUrl = await loadCoverImage();
          const coverSize = Math.min(pageW - 72, pageH - 72);
          const coverX = (pageW - coverSize) / 2;
          const coverY = (pageH - coverSize) / 2;
          doc.addImage(coverDataUrl, "JPEG", coverX, coverY, coverSize, coverSize);
          doc.addPage();
          pageNum++;
        } catch {
        }
      }

      doc.setFont("times", "bold");
      doc.setFontSize(28);
      doc.setTextColor(40, 40, 40);
      const titleLines = doc.splitTextToSize(data.project.title, contentW);
      const titleY = pageH / 2 - (titleLines.length * 34) / 2;
      doc.text(titleLines, pageW / 2, titleY, { align: "center" });

      doc.setFont("times", "italic");
      doc.setFontSize(16);
      doc.setTextColor(100, 100, 100);
      doc.text(`by ${data.project.authorName || "Unknown Author"}`, pageW / 2, titleY + titleLines.length * 34 + 20, { align: "center" });

      doc.setDrawColor(180, 160, 130);
      doc.setLineWidth(0.5);
      doc.line(pageW / 2 - 40, titleY - 20, pageW / 2 + 40, titleY - 20);
      doc.line(pageW / 2 - 40, titleY + titleLines.length * 34 + 50, pageW / 2 + 40, titleY + titleLines.length * 34 + 50);

      doc.addPage();
      pageNum++;
      doc.setFont("times", "bold");
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text("Table of Contents", pageW / 2, marginTop + 20, { align: "center" });

      doc.setDrawColor(180, 160, 130);
      doc.line(pageW / 2 - 50, marginTop + 32, pageW / 2 + 50, marginTop + 32);

      let tocY = marginTop + 60;
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      for (const ch of completed) {
        const label = `Chapter ${ch.chapterNumber}: ${ch.title}`;
        const lines = doc.splitTextToSize(label, contentW);
        for (const line of lines) {
          if (tocY > maxY) {
            addPageNumber(pageNum);
            doc.addPage();
            pageNum++;
            tocY = marginTop;
          }
          doc.text(line, marginX, tocY);
          tocY += 18;
        }
        tocY += 4;
      }
      addPageNumber(pageNum);

      for (const ch of completed) {
        doc.addPage();
        pageNum++;

        doc.setFont("times", "normal");
        doc.setFontSize(11);
        doc.setTextColor(160, 160, 160);
        doc.text(`Chapter ${ch.chapterNumber}`, pageW / 2, pageH / 2 - 40, { align: "center" });

        doc.setDrawColor(180, 160, 130);
        doc.line(pageW / 2 - 30, pageH / 2 - 25, pageW / 2 + 30, pageH / 2 - 25);

        doc.setFont("times", "bold");
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        const chTitleLines = doc.splitTextToSize(ch.title, contentW);
        doc.text(chTitleLines, pageW / 2, pageH / 2, { align: "center" });

        addPageNumber(pageNum);

        doc.addPage();
        pageNum++;
        let y = marginTop;

        const paragraphs = (ch.content || "").split(/\n+/).filter(p => p.trim());
        for (const para of paragraphs) {
          const trimmed = para.trim();
          let fontSize = 11;
          let fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal";
          let indent = 24;
          let extraSpacing = 4;
          let textColor: [number, number, number] = [50, 50, 50];

          if (trimmed.startsWith("### ")) {
            fontSize = 13; fontStyle = "bold"; indent = 0; extraSpacing = 6; textColor = [40, 40, 40];
          } else if (trimmed.startsWith("## ")) {
            fontSize = 15; fontStyle = "bold"; indent = 0; extraSpacing = 8; textColor = [35, 35, 35];
          } else if (trimmed.startsWith("# ")) {
            fontSize = 18; fontStyle = "bold"; indent = 0; extraSpacing = 10; textColor = [30, 30, 30];
          } else if (trimmed.startsWith("> ")) {
            fontStyle = "italic"; textColor = [80, 80, 80]; indent = 36;
          } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            indent = 36;
          } else if (trimmed.startsWith("---") || trimmed.startsWith("***")) {
            doc.setDrawColor(180, 160, 130);
            doc.line(pageW / 2 - 30, y, pageW / 2 + 30, y);
            y += 12;
            continue;
          }

          const cleanText = trimmed.replace(/^#+\s*/, "").replace(/^>\s*/, "");
          doc.setFont("times", fontStyle);
          doc.setFontSize(fontSize);
          doc.setTextColor(...textColor);

          const lines = doc.splitTextToSize(cleanText, contentW - indent);
          for (const line of lines) {
            if (y > maxY) {
              addPageNumber(pageNum);
              doc.addPage();
              pageNum++;
              y = marginTop;
            }
            doc.text(line, marginX + indent, y);
            y += lineH;
          }
          y += extraSpacing;
        }
        addPageNumber(pageNum);
      }

      const slug = data.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      doc.save(`${slug}.pdf`);
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
    { label: "Gen Outline", step: "2", done: chapters.length > 0, action: () => outlineMutation.mutate(), loading: outlineMutation.isPending, icon: List, glow: "neon-glow" },
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
                  <ChapterCard key={ch.id} chapter={ch} onGenerate={(cid) => chapterMutation.mutate(cid)} isGenerating={chapterMutation.isPending} onCancel={(cid) => cancelChapterMutation.mutate(cid)} isCancelling={cancelChapterMutation.isPending} />
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
    </div>
  );
}
