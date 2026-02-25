import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, TrendingUp, List, PenTool, Megaphone, Image, Play, CheckCircle, Clock,
  Loader2, AlertCircle, BookOpen, Zap, Star, FileText, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { formatScore, scoreColor, statusLabel, VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, Chapter, RunStep, BookDna, MarketingAsset, TrendReport } from "@shared/schema";

interface ProjectDetailData {
  project: Project;
  chapters: Chapter[];
  runSteps: RunStep[];
  bookDna?: BookDna;
  marketing?: MarketingAsset;
  trendReport?: TrendReport;
}

const PIPELINE_STEPS = ["draft", "trend_analysis", "outlining", "writing", "editing", "marketing", "complete"];

function getPct(status: string) {
  const idx = PIPELINE_STEPS.indexOf(status);
  return idx >= 0 ? Math.round((idx / (PIPELINE_STEPS.length - 1)) * 100) : 0;
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-400", trend_analysis: "bg-blue-500", outlining: "bg-purple-500",
  writing: "bg-amber-500", editing: "bg-orange-500", marketing: "bg-pink-500",
  complete: "bg-emerald-500", paused: "bg-slate-400",
};

const verticalIcons: Record<string, string> = {
  money: "\u{1F4B0}", fitness: "\u{1F4AA}", spirituality: "\u{1F9D8}", career: "\u{1F680}",
  education: "\u{1F4DA}", relationships: "\u2764\uFE0F", health: "\u{1F3E5}", mindset: "\u{1F9E0}",
  parenting: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", technology: "\u26A1",
};

function StepStatus({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground/40" />;
}

function ChapterCard({ chapter, onGenerate, isGenerating }: {
  chapter: Chapter;
  onGenerate: (id: number) => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm" data-testid={`chapter-${chapter.id}`}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/10 text-xs font-bold text-primary border border-primary/10">
          {chapter.chapterNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold">{chapter.title}</p>
            <div className="flex items-center gap-2">
              {chapter.status === "complete" ? (
                <Badge variant="outline" className="text-[11px] text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400 font-medium">
                  {chapter.wordCount.toLocaleString()} words
                </Badge>
              ) : chapter.status === "generating" ? (
                <Badge variant="outline" className="text-[11px]">
                  <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> Writing...
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] border-border/60"
                  onClick={(e) => { e.stopPropagation(); onGenerate(chapter.id); }}
                  disabled={isGenerating}
                  data-testid={`button-generate-chapter-${chapter.id}`}
                >
                  <Play className="h-2.5 w-2.5 mr-1" /> Write
                </Button>
              )}
              {chapter.qualityScore && (
                <span className={`text-[11px] font-bold ${scoreColor(chapter.qualityScore)}`}>
                  {formatScore(chapter.qualityScore)}
                </span>
              )}
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
          {chapter.blueprint && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{chapter.blueprint}</p>
          )}
        </div>
      </div>
      {expanded && chapter.content && (
        <div className="px-4 pb-4 border-t border-border/40">
          <ScrollArea className="h-52 mt-3">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{chapter.content}</p>
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

  const { data, isLoading, refetch } = useQuery<ProjectDetailData>({
    queryKey: [`/api/projects/${projectId}`],
    refetchInterval: 5000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const trendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/trend-analysis`),
    onSuccess: () => { invalidate(); toast({ title: "Trend analysis complete!" }); },
    onError: (e: any) => toast({ title: "Trend analysis failed", description: e.message, variant: "destructive" }),
  });

  const outlineMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/generate-outline`),
    onSuccess: () => { invalidate(); toast({ title: "Outline generated!", description: "Book DNA and chapter blueprints are ready." }); },
    onError: (e: any) => toast({ title: "Outline generation failed", description: e.message, variant: "destructive" }),
  });

  const chapterMutation = useMutation({
    mutationFn: (chapterId: number) => apiRequest("POST", `/api/projects/${projectId}/chapters/${chapterId}/generate`),
    onSuccess: () => { invalidate(); toast({ title: "Chapter written!" }); },
    onError: (e: any) => toast({ title: "Chapter generation failed", description: e.message, variant: "destructive" }),
  });

  const marketingMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/generate-marketing`),
    onSuccess: () => { invalidate(); toast({ title: "Marketing suite generated!" }); },
    onError: (e: any) => toast({ title: "Marketing generation failed", description: e.message, variant: "destructive" }),
  });

  const coverMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/generate-cover`),
    onSuccess: () => { invalidate(); toast({ title: "Cover generated!" }); },
    onError: (e: any) => toast({ title: "Cover generation failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-5">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!data?.project) {
    return (
      <div className="p-8 text-center py-20">
        <p className="text-muted-foreground">Project not found</p>
        <Link href="/projects"><Button className="mt-4">Back to Projects</Button></Link>
      </div>
    );
  }

  const { project, chapters, runSteps, bookDna, marketing, trendReport } = data;
  const completedChapters = chapters.filter(c => c.status === "complete");
  const pct = getPct(project.status);
  const anyRunning = trendMutation.isPending || outlineMutation.isPending || chapterMutation.isPending || marketingMutation.isPending || coverMutation.isPending;

  const pipelineActions = [
    {
      label: "Trend Analysis",
      step: "1",
      done: !!trendReport,
      action: () => trendMutation.mutate(),
      loading: trendMutation.isPending,
      icon: TrendingUp,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      label: "Generate Outline",
      step: "2",
      done: chapters.length > 0,
      action: () => outlineMutation.mutate(),
      loading: outlineMutation.isPending,
      icon: List,
      gradient: "from-purple-500 to-violet-600",
    },
    {
      label: "Generate Cover",
      step: "3",
      done: !!project.coverImageUrl,
      action: () => coverMutation.mutate(),
      loading: coverMutation.isPending,
      icon: Image,
      gradient: "from-pink-500 to-rose-600",
    },
    {
      label: "Write Chapters",
      step: "4",
      done: completedChapters.length === chapters.length && chapters.length > 0,
      action: () => {
        const pending = chapters.filter(c => c.status === "pending");
        if (pending.length > 0) chapterMutation.mutate(pending[0].id);
      },
      loading: chapterMutation.isPending,
      icon: PenTool,
      gradient: "from-amber-500 to-orange-500",
    },
    {
      label: "Marketing Suite",
      step: "5",
      done: !!marketing,
      action: () => marketingMutation.mutate(),
      loading: marketingMutation.isPending,
      icon: Megaphone,
      gradient: "from-emerald-500 to-green-600",
    },
  ];

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" /> Projects
          </Button>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-medium truncate max-w-xs text-muted-foreground">{project.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border text-2xl ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                  {verticalIcons[project.vertical] || "\u26A1"}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold tracking-tight leading-tight">{project.title}</h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs font-semibold ${VERTICAL_ACCENT[project.vertical] || ""}`}>{VERTICAL_LABELS[project.vertical] || project.vertical}</span>
                    <span className="text-muted-foreground/30 text-xs">\u2022</span>
                    <span className="text-xs text-muted-foreground capitalize">{project.targetLanguage}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {anyRunning && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                  <Button size="icon" variant="ghost" onClick={() => refetch()} data-testid="button-refresh" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${statusColors[project.status] || "bg-slate-400"}`} />
                      {statusLabel(project.status)}
                    </span>
                    {project.greenlightScore && (
                      <Badge variant="outline" className="text-[11px] font-bold">GL {formatScore(project.greenlightScore)}</Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mt-5">
                {[
                  { label: "Words", value: project.wordCount.toLocaleString() },
                  { label: "Chapters", value: `${completedChapters.length}/${project.chapterCount || chapters.length}` },
                  { label: "Quality", value: project.qualityScore ? `${formatScore(project.qualityScore)}` : "\u2014", color: scoreColor(project.qualityScore) },
                  { label: "GL Score", value: project.greenlightScore ? `${formatScore(project.greenlightScore)}` : "\u2014" },
                  { label: "AI Cost", value: project.estimatedCost > 0 ? `$${project.estimatedCost.toFixed(3)}` : "$0" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-muted/40 rounded-lg py-2.5 text-center">
                    <div className={`text-sm font-bold ${color || ""}`}>{value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {pipelineActions.map(({ label, step, done, action, loading, icon: Icon, gradient }) => (
              <button
                key={label}
                onClick={action}
                disabled={loading || anyRunning || done}
                data-testid={`pipeline-step-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center text-[11px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${done ? "border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300" : "border-border/50 bg-card hover:border-primary/20 hover:shadow-sm text-muted-foreground"}`}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : done ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <span className="leading-tight">{step}. {label}</span>
              </button>
            ))}
          </div>

          <Tabs defaultValue="chapters">
            <TabsList className="h-10">
              <TabsTrigger value="chapters" className="text-xs gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Chapters ({chapters.length})
              </TabsTrigger>
              <TabsTrigger value="dna" className="text-xs gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Book DNA
              </TabsTrigger>
              <TabsTrigger value="marketing" className="text-xs gap-1.5">
                <Megaphone className="h-3.5 w-3.5" /> Marketing
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chapters" className="mt-4 space-y-2.5">
              {chapters.length === 0 ? (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="flex flex-col items-center justify-center py-14">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-semibold">No chapters yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Generate the book outline first</p>
                    <Button className="mt-4 shadow-sm" onClick={() => outlineMutation.mutate()} disabled={outlineMutation.isPending}>
                      {outlineMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <List className="h-4 w-4 mr-2" />}
                      Generate Outline
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
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="dna" className="mt-4">
              {!bookDna ? (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="flex flex-col items-center justify-center py-14">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-4">
                      <Zap className="h-6 w-6 text-amber-500" />
                    </div>
                    <p className="font-semibold">Book DNA not generated yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Generate the outline to create the Book DNA</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: "Core Promise", value: bookDna.corePromise },
                    { label: "Reader Avatar", value: bookDna.readerAvatar },
                    { label: "Tone & Style Rules", value: bookDna.toneRules },
                    { label: "Transformation Arc", value: bookDna.transformationArc },
                    { label: "Framework Summary", value: bookDna.frameworkSummary },
                  ].filter(f => f.value).map(({ label, value }) => (
                    <Card key={label} className="border-border/50 shadow-sm">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
                        <p className="text-sm leading-relaxed">{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="marketing" className="mt-4">
              {!marketing ? (
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="flex flex-col items-center justify-center py-14">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 flex items-center justify-center mb-4">
                      <Megaphone className="h-6 w-6 text-pink-500" />
                    </div>
                    <p className="font-semibold">Marketing suite not generated yet</p>
                    <Button className="mt-4 shadow-sm" onClick={() => marketingMutation.mutate()} disabled={marketingMutation.isPending || chapters.length === 0}>
                      {marketingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Megaphone className="h-4 w-4 mr-2" />}
                      Generate Marketing Suite
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {marketing.shortBlurb && (
                    <Card className="border-border/50 shadow-sm"><CardContent className="pt-4 pb-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Short Blurb (50 words)</p>
                      <p className="text-sm leading-relaxed">{marketing.shortBlurb}</p>
                    </CardContent></Card>
                  )}
                  {marketing.amazonDescription && (
                    <Card className="border-border/50 shadow-sm"><CardContent className="pt-4 pb-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Amazon Description</p>
                      <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: marketing.amazonDescription }} />
                    </CardContent></Card>
                  )}
                  {marketing.hooks && marketing.hooks.length > 0 && (
                    <Card className="border-border/50 shadow-sm"><CardContent className="pt-4 pb-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Social Media Hooks</p>
                      <div className="space-y-2">
                        {marketing.hooks.map((h, i) => (
                          <div key={i} className="text-sm bg-muted/40 rounded-lg px-3.5 py-2.5">
                            <span className="text-[10px] text-muted-foreground font-bold mr-2">#{i + 1}</span>{h}
                          </div>
                        ))}
                      </div>
                    </CardContent></Card>
                  )}
                  {marketing.pricingMatrix && (
                    <Card className="border-border/50 shadow-sm"><CardContent className="pt-4 pb-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Pricing Matrix</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {Object.entries(marketing.pricingMatrix as Record<string, any>).map(([format, price]) => (
                          <div key={format} className="bg-muted/40 rounded-lg p-3 text-center">
                            <div className="text-sm font-bold">{typeof price === "object" ? JSON.stringify(price) : price}</div>
                            <div className="text-[10px] text-muted-foreground capitalize mt-0.5 font-medium">{format}</div>
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
                <Card className="border-border/50 shadow-sm"><CardContent className="flex items-center justify-center py-14">
                  <p className="text-muted-foreground text-sm">No run steps yet</p>
                </CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {runSteps.map(step => (
                    <div key={step.id} className="flex items-start gap-3.5 p-3.5 border border-border/50 rounded-xl bg-card shadow-sm">
                      <StepStatus status={step.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{step.stepName}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[11px] font-medium">{step.model}</Badge>
                            {step.status === "complete" && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                                {step.tokensUsed.toLocaleString()} tokens
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                          {step.durationMs && <span className="font-medium">{(step.durationMs / 1000).toFixed(1)}s</span>}
                          {step.qualityScore && <span className={scoreColor(step.qualityScore)}>Q: {formatScore(step.qualityScore)}</span>}
                          {step.errorMessage && <span className="text-destructive font-medium">{step.errorMessage}</span>}
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
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Book Cover</CardTitle>
            </CardHeader>
            <CardContent>
              {project.coverImageUrl ? (
                <div className="rounded-xl overflow-hidden border border-border/50 shadow-md">
                  <img src={project.coverImageUrl} alt="Book cover" className="w-full aspect-[3/4] object-cover" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center aspect-[3/4] rounded-xl bg-gradient-to-br from-muted/50 to-muted border border-dashed border-muted-foreground/20">
                  <Image className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-[11px] text-muted-foreground text-center px-4 font-medium">No cover yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 border-border/60"
                    onClick={() => coverMutation.mutate()}
                    disabled={coverMutation.isPending}
                    data-testid="button-generate-cover"
                  >
                    {coverMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Zap className="h-3 w-3 mr-1.5" />}
                    Generate AI Cover
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {trendReport && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> Trend Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {trendReport.summary && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{trendReport.summary}</p>
                )}
                <div className="space-y-2.5">
                  {[
                    { label: "Demand", score: trendReport.demandScore },
                    { label: "Competition", score: trendReport.competitionScore },
                    { label: "Greenlight", score: trendReport.greenlightScore },
                  ].map(({ label, score }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
                        <span className="text-[11px] font-bold">{formatScore(score)}</span>
                      </div>
                      <Progress value={score != null ? (score / 10) * 100 : 0} className="h-1.5" />
                    </div>
                  ))}
                </div>
                {trendReport.painPoints && trendReport.painPoints.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground mb-2">Key Pain Points</p>
                    <div className="space-y-1.5">
                      {trendReport.painPoints.slice(0, 3).map((p, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">{p}</div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
