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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, TrendingUp, List, PenTool, Megaphone, Image, Play, CheckCircle, Clock,
  Loader2, AlertCircle, BookOpen, Zap, Star, FileText, RefreshCw,
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

function StepStatus({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function ChapterCard({ chapter, projectId, onGenerate, isGenerating }: {
  chapter: Chapter;
  projectId: number;
  onGenerate: (id: number) => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-md border-card-border" data-testid={`chapter-${chapter.id}`}>
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
          {chapter.chapterNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">{chapter.title}</p>
            <div className="flex items-center gap-2">
              {chapter.status === "complete" ? (
                <Badge variant="outline" className="text-xs text-green-600 border-green-200 dark:border-green-800 dark:text-green-400">
                  {chapter.wordCount.toLocaleString()} words
                </Badge>
              ) : chapter.status === "generating" ? (
                <Badge variant="outline" className="text-xs">
                  <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> Writing...
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); onGenerate(chapter.id); }}
                  disabled={isGenerating}
                  data-testid={`button-generate-chapter-${chapter.id}`}
                >
                  <Play className="h-2.5 w-2.5 mr-1" /> Write
                </Button>
              )}
              {chapter.qualityScore && (
                <span className={`text-xs font-medium ${scoreColor(chapter.qualityScore)}`}>
                  {formatScore(chapter.qualityScore)}
                </span>
              )}
            </div>
          </div>
          {chapter.blueprint && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{chapter.blueprint}</p>
          )}
        </div>
      </div>
      {expanded && chapter.content && (
        <div className="px-3 pb-3 border-t border-card-border">
          <ScrollArea className="h-48 mt-3">
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
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data?.project) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-muted-foreground">Project not found</p>
        <Link href="/projects"><Button className="mt-4">Back to Projects</Button></Link>
      </div>
    );
  }

  const { project, chapters, runSteps, bookDna, marketing, trendReport } = data;
  const completedChapters = chapters.filter(c => c.status === "complete");
  const pct = getPct(project.status);
  const anyRunning = trendMutation.isPending || outlineMutation.isPending || chapterMutation.isPending || marketingMutation.isPending || coverMutation.isPending;

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Projects
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate max-w-xs">{project.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border text-2xl ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                  {project.vertical === "money" ? "💰" : project.vertical === "fitness" ? "💪" : project.vertical === "spirituality" ? "🧘" : project.vertical === "career" ? "🚀" : project.vertical === "education" ? "📚" : project.vertical === "relationships" ? "❤️" : project.vertical === "health" ? "🏥" : project.vertical === "mindset" ? "🧠" : project.vertical === "parenting" ? "👨‍👩‍👧" : "⚡"}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold leading-tight">{project.title}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-medium ${VERTICAL_ACCENT[project.vertical] || ""}`}>{VERTICAL_LABELS[project.vertical] || project.vertical}</span>
                    <span className="text-muted-foreground text-xs">•</span>
                    <span className="text-xs text-muted-foreground capitalize">{project.targetLanguage}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {anyRunning && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                  <Button size="icon" variant="ghost" onClick={() => refetch()} data-testid="button-refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${project.status === "complete" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"}`}>
                      {statusLabel(project.status)}
                    </span>
                    {project.greenlightScore && (
                      <span className="text-xs text-muted-foreground">GL: <span className="font-medium">{formatScore(project.greenlightScore)}</span></span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{pct}% complete</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                {[
                  { label: "Words", value: project.wordCount.toLocaleString() },
                  { label: "Chapters", value: `${completedChapters.length}/${project.chapterCount || chapters.length}` },
                  { label: "Quality", value: project.qualityScore ? `${formatScore(project.qualityScore)}/10` : "—", color: scoreColor(project.qualityScore) },
                  { label: "GL Score", value: project.greenlightScore ? `${formatScore(project.greenlightScore)}/10` : "—" },
                  { label: "AI Cost", value: project.estimatedCost > 0 ? `$${project.estimatedCost.toFixed(3)}` : "$0" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-muted/50 rounded-md p-2 text-center">
                    <div className={`text-sm font-semibold ${color || ""}`}>{value}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              {
                label: "1. Trend Analysis",
                done: !!trendReport,
                action: () => trendMutation.mutate(),
                loading: trendMutation.isPending,
                icon: TrendingUp,
                enabled: true,
              },
              {
                label: "2. Generate Outline",
                done: chapters.length > 0,
                action: () => outlineMutation.mutate(),
                loading: outlineMutation.isPending,
                icon: List,
                enabled: !!trendReport || chapters.length === 0,
              },
              {
                label: "3. Generate Cover",
                done: !!project.coverImageUrl,
                action: () => coverMutation.mutate(),
                loading: coverMutation.isPending,
                icon: Image,
                enabled: true,
              },
              {
                label: "4. Write All Chapters",
                done: completedChapters.length === chapters.length && chapters.length > 0,
                action: () => {
                  const pending = chapters.filter(c => c.status === "pending");
                  if (pending.length > 0) chapterMutation.mutate(pending[0].id);
                },
                loading: chapterMutation.isPending,
                icon: PenTool,
                enabled: chapters.length > 0,
              },
              {
                label: "5. Generate Marketing",
                done: !!marketing,
                action: () => marketingMutation.mutate(),
                loading: marketingMutation.isPending,
                icon: Megaphone,
                enabled: chapters.length > 0,
              },
            ].map(({ label, done, action, loading, icon: Icon, enabled }) => (
              <button
                key={label}
                onClick={action}
                disabled={loading || anyRunning || done}
                data-testid={`pipeline-step-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex flex-col items-center gap-2 p-3 rounded-md border text-center text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${done ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 text-green-700 dark:text-green-300" : "border-card-border bg-card hover-elevate text-muted-foreground"}`}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : done ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Icon className="h-5 w-5" />}
                <span className="leading-tight">{label}</span>
              </button>
            ))}
          </div>

          <Tabs defaultValue="chapters">
            <TabsList>
              <TabsTrigger value="chapters">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Chapters ({chapters.length})
              </TabsTrigger>
              <TabsTrigger value="dna">
                <Zap className="h-3.5 w-3.5 mr-1.5" /> Book DNA
              </TabsTrigger>
              <TabsTrigger value="marketing">
                <Megaphone className="h-3.5 w-3.5 mr-1.5" /> Marketing
              </TabsTrigger>
              <TabsTrigger value="logs">
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Run Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chapters" className="mt-4 space-y-2">
              {chapters.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">No chapters yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Generate the book outline first</p>
                    <Button className="mt-4" onClick={() => outlineMutation.mutate()} disabled={outlineMutation.isPending}>
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
                    projectId={projectId}
                    onGenerate={(cid) => chapterMutation.mutate(cid)}
                    isGenerating={chapterMutation.isPending}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="dna" className="mt-4">
              {!bookDna ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Zap className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">Book DNA not generated yet</p>
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
                    <Card key={label}>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
                        <p className="text-sm leading-relaxed">{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="marketing" className="mt-4">
              {!marketing ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Megaphone className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">Marketing suite not generated yet</p>
                    <Button className="mt-4" onClick={() => marketingMutation.mutate()} disabled={marketingMutation.isPending || chapters.length === 0}>
                      {marketingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Megaphone className="h-4 w-4 mr-2" />}
                      Generate Marketing Suite
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {marketing.shortBlurb && (
                    <Card><CardContent className="pt-4 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Short Blurb (50 words)</p>
                      <p className="text-sm leading-relaxed">{marketing.shortBlurb}</p>
                    </CardContent></Card>
                  )}
                  {marketing.amazonDescription && (
                    <Card><CardContent className="pt-4 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Amazon Description</p>
                      <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: marketing.amazonDescription }} />
                    </CardContent></Card>
                  )}
                  {marketing.hooks && marketing.hooks.length > 0 && (
                    <Card><CardContent className="pt-4 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Social Media Hooks</p>
                      <div className="space-y-2">
                        {marketing.hooks.map((h, i) => (
                          <div key={i} className="text-sm bg-muted/50 rounded px-3 py-2">
                            <span className="text-xs text-muted-foreground mr-2">#{i + 1}</span>{h}
                          </div>
                        ))}
                      </div>
                    </CardContent></Card>
                  )}
                  {marketing.pricingMatrix && (
                    <Card><CardContent className="pt-4 pb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Pricing Matrix</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(marketing.pricingMatrix as Record<string, any>).map(([format, price]) => (
                          <div key={format} className="bg-muted/50 rounded-md p-2 text-center">
                            <div className="text-sm font-bold">{typeof price === "object" ? JSON.stringify(price) : price}</div>
                            <div className="text-[10px] text-muted-foreground capitalize">{format}</div>
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
                <Card><CardContent className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground text-sm">No run steps yet</p>
                </CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {runSteps.map(step => (
                    <div key={step.id} className="flex items-start gap-3 p-3 border rounded-md border-card-border bg-card">
                      <StepStatus status={step.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium">{step.stepName}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{step.model}</Badge>
                            {step.status === "complete" && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {step.tokensUsed.toLocaleString()} tokens
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {step.durationMs && <span>{(step.durationMs / 1000).toFixed(1)}s</span>}
                          {step.qualityScore && <span className={scoreColor(step.qualityScore)}>Quality: {formatScore(step.qualityScore)}</span>}
                          {step.errorMessage && <span className="text-destructive">{step.errorMessage}</span>}
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

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Book Cover</CardTitle>
            </CardHeader>
            <CardContent>
              {project.coverImageUrl ? (
                <div className="rounded-md overflow-hidden border border-card-border">
                  <img src={project.coverImageUrl} alt="Book cover" className="w-full aspect-[3/4] object-cover" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center aspect-[3/4] rounded-md bg-muted border border-dashed border-muted-foreground/30">
                  <Image className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground text-center px-4">No cover yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => coverMutation.mutate()}
                    disabled={coverMutation.isPending}
                    data-testid="button-generate-cover"
                  >
                    {coverMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                    Generate AI Cover
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {trendReport && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" /> Trend Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trendReport.summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{trendReport.summary}</p>
                )}
                <div className="space-y-2">
                  {[
                    { label: "Demand", score: trendReport.demandScore },
                    { label: "Competition", score: trendReport.competitionScore },
                    { label: "Greenlight", score: trendReport.greenlightScore },
                  ].map(({ label, score }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-xs font-medium">{formatScore(score)}</span>
                      </div>
                      <Progress value={score != null ? (score / 10) * 100 : 0} className="h-1.5" />
                    </div>
                  ))}
                </div>
                {trendReport.painPoints && trendReport.painPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Key Pain Points</p>
                    <div className="space-y-1">
                      {trendReport.painPoints.slice(0, 3).map((p, i) => (
                        <div key={i} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">{p}</div>
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
