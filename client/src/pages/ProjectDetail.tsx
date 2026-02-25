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
  Loader2, AlertCircle, BookOpen, Zap, Star, FileText, RefreshCw, ChevronDown, ChevronUp, Download, User, Hexagon, Activity,
} from "lucide-react";
import { formatScore, scoreColor, statusLabel, VERTICAL_LABELS } from "@/lib/utils";
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

const statusGlow: Record<string, string> = {
  draft: "bg-zinc-500", trend_analysis: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]",
  outlining: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.6)]", writing: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  editing: "bg-orange-400", marketing: "bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.6)]",
  complete: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]", paused: "bg-zinc-500",
};

function StepStatus({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-muted-foreground/30" />;
}

function ChapterCard({ chapter, onGenerate, isGenerating }: {
  chapter: Chapter;
  onGenerate: (id: number) => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border/20 rounded-xl overflow-hidden bg-card/30 hover:border-purple-500/15 transition-all duration-300" data-testid={`chapter-${chapter.id}`}>
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs font-bold font-mono text-purple-300">
          {chapter.chapterNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold tracking-tight">{chapter.title}</p>
            <div className="flex items-center gap-2">
              {chapter.status === "complete" ? (
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                  {chapter.wordCount.toLocaleString()} w
                </Badge>
              ) : chapter.status === "generating" ? (
                <Badge variant="outline" className="text-[10px] font-mono border-purple-500/20">
                  <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin text-purple-400" /> Writing...
                </Badge>
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
          {chapter.blueprint && (
            <p className="text-[10px] text-muted-foreground/40 mt-1 line-clamp-1 font-mono">{chapter.blueprint}</p>
          )}
        </div>
      </div>
      {expanded && chapter.content && (
        <div className="px-4 pb-4 border-t border-border/15">
          <ScrollArea className="h-52 mt-3">
            <p className="text-sm text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">{chapter.content}</p>
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
    mutationFn: () => apiRequest("POST", `/api/projects/${projectId}/generate-cover`),
    onSuccess: () => { invalidate(); toast({ title: "Cover generated" }); },
    onError: (e: any) => toast({ title: "Cover failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-5">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-44 rounded-xl bg-muted/20" />
        <Skeleton className="h-80 rounded-xl bg-muted/20" />
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
  const pct = getPct(project.status);
  const anyRunning = trendMutation.isPending || outlineMutation.isPending || chapterMutation.isPending || marketingMutation.isPending || coverMutation.isPending;

  const pipelineActions = [
    { label: "Trend Analysis", step: "1", done: !!trendReport, action: () => trendMutation.mutate(), loading: trendMutation.isPending, icon: TrendingUp, glow: "neon-glow-cool" },
    { label: "Gen Outline", step: "2", done: chapters.length > 0, action: () => outlineMutation.mutate(), loading: outlineMutation.isPending, icon: List, glow: "neon-glow" },
    { label: "AI Cover", step: "3", done: !!project.coverImageUrl, action: () => coverMutation.mutate(), loading: coverMutation.isPending, icon: Image, glow: "neon-glow-warm" },
    { label: "Write Chs", step: "4", done: completedChapters.length === chapters.length && chapters.length > 0, action: () => { const p = chapters.filter(c => c.status === "pending"); if (p.length > 0) chapterMutation.mutate(p[0].id); }, loading: chapterMutation.isPending, icon: PenTool, glow: "neon-glow-fire" },
    { label: "Marketing", step: "5", done: !!marketing, action: () => marketingMutation.mutate(), loading: marketingMutation.isPending, icon: Megaphone, glow: "neon-glow-nature" },
  ];

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-muted-foreground/50 hover:text-purple-400 font-mono text-[11px]">
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
                  {({money:"\u{1F4B0}",fitness:"\u{1F4AA}",spirituality:"\u{1F9D8}",career:"\u{1F680}",education:"\u{1F4DA}",relationships:"\u2764\uFE0F",health:"\u{1F3E5}",mindset:"\u{1F9E0}",parenting:"\u{1F468}\u200D\u{1F469}\u200D\u{1F467}",technology:"\u26A1"} as Record<string,string>)[project.vertical] || "\u{1F4D6}"}
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
                  <Button size="icon" variant="ghost" onClick={() => refetch()} data-testid="button-refresh" className="h-8 w-8 text-muted-foreground/40 hover:text-purple-400">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/60">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusGlow[project.status] || "bg-zinc-500"}`} />
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
                disabled={loading || anyRunning || done}
                data-testid={`pipeline-step-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center text-[10px] font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${done
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                  : "border-border/20 bg-card/20 hover:border-purple-500/20 hover:bg-purple-500/[0.03] text-muted-foreground/60"}`}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                ) : done ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                ) : (
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${glow} shadow-lg`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <span className="leading-tight tracking-wider uppercase">{step}. {label}</span>
              </button>
            ))}
          </div>

          <Tabs defaultValue="chapters">
            <TabsList className="h-10 bg-card/30 border border-border/20">
              <TabsTrigger value="chapters" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-purple-300">
                <BookOpen className="h-3 w-3" /> Chapters ({chapters.length})
              </TabsTrigger>
              <TabsTrigger value="dna" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-cyan-300">
                <Zap className="h-3 w-3" /> DNA
              </TabsTrigger>
              <TabsTrigger value="marketing" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-pink-300">
                <Megaphone className="h-3 w-3" /> Marketing
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-[11px] gap-1.5 font-mono data-[state=active]:text-amber-300">
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
                    <Button className="mt-5 neon-glow text-white border-0 font-mono text-[11px]" onClick={() => outlineMutation.mutate()} disabled={outlineMutation.isPending}>
                      {outlineMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <List className="h-3.5 w-3.5 mr-1.5" />}
                      GENERATE OUTLINE
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                chapters.map(ch => (
                  <ChapterCard key={ch.id} chapter={ch} onGenerate={(cid) => chapterMutation.mutate(cid)} isGenerating={chapterMutation.isPending} />
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
                      <div className="text-sm leading-relaxed text-muted-foreground/80" dangerouslySetInnerHTML={{ __html: marketing.amazonDescription }} />
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
                <div className="rounded-xl overflow-hidden glow-border-pink">
                  <img src={project.coverImageUrl} alt="Book cover" className="w-full object-contain rounded-xl bg-card/50" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center aspect-[3/4] rounded-xl bg-white/[0.02] border border-dashed border-border/20">
                  <Image className="h-8 w-8 text-muted-foreground/20 mb-3" />
                  <p className="text-[10px] text-muted-foreground/40 font-mono">No cover</p>
                  <Button size="sm" variant="outline" className="mt-3 border-border/30 font-mono text-[10px] hover:border-pink-500/30" onClick={() => coverMutation.mutate()} disabled={coverMutation.isPending} data-testid="button-generate-cover">
                    {coverMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Zap className="h-3 w-3 mr-1.5 text-pink-400" />}
                    GENERATE
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

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
                  <p className="text-[9px] text-muted-foreground/30 font-mono mt-1">Print HTML to PDF</p>
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
    </div>
  );
}
