import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Zap, Target, Lightbulb, Hash, Loader2, BarChart3 } from "lucide-react";
import { formatScore, VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VERTICALS } from "@shared/schema";
import type { TrendReport } from "@shared/schema";

function ScoreBar({ label, score, colorClass }: { label: string; score: number | null | undefined; colorClass: string }) {
  const pct = score != null ? (score / 10) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold ${colorClass}`}>{formatScore(score)}/10</span>
      </div>
      <div className="relative">
        <Progress value={pct} className="h-2" />
      </div>
    </div>
  );
}

function TrendReportCard({ report }: { report: TrendReport }) {
  const gl = report.greenlightScore || 0;
  const glColor = gl >= 8 ? "text-emerald-600 dark:text-emerald-400" : gl >= 6 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const glBg = gl >= 8 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" : gl >= 6 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
  const bgClass = VERTICAL_BG[report.vertical] || "bg-muted";
  const accentClass = VERTICAL_ACCENT[report.vertical] || "text-muted-foreground";

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow" data-testid={`trend-report-${report.id}`}>
      <div className={`px-5 py-3.5 border-b ${bgClass}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className={`text-sm font-bold ${accentClass}`}>{VERTICAL_LABELS[report.vertical] || report.vertical}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <Badge variant="outline" className={`text-sm font-bold px-3 py-0.5 ${glColor} ${glBg}`}>
            GL {formatScore(report.greenlightScore)}
          </Badge>
        </div>
      </div>

      <CardContent className="pt-5 pb-5 space-y-5">
        {report.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
        )}

        <div className="space-y-3">
          <ScoreBar label="Demand Score" score={report.demandScore}
            colorClass={report.demandScore && report.demandScore >= 7 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} />
          <ScoreBar label="Competition (lower = easier)" score={report.competitionScore}
            colorClass={report.competitionScore && report.competitionScore <= 5 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"} />
        </div>

        {report.painPoints && report.painPoints.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Target className="h-3.5 w-3.5 text-red-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pain Points</p>
            </div>
            <div className="space-y-1.5">
              {report.painPoints.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="shrink-0 flex h-5 w-5 mt-0.5 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30 text-[10px] font-bold text-red-600 dark:text-red-400">{i + 1}</span>
                  <span className="text-muted-foreground leading-snug">{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.titleAngles && report.titleAngles.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Title Angles</p>
            </div>
            <div className="space-y-1.5">
              {report.titleAngles.slice(0, 4).map((t, i) => (
                <div key={i} className="text-xs bg-muted/50 rounded-lg px-3 py-2 text-foreground font-medium">{t}</div>
              ))}
            </div>
          </div>
        )}

        {report.nicheTopics && report.nicheTopics.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Niche Opportunities</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.nicheTopics.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[11px] font-medium">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {report.keywords && report.keywords.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Hash className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Keywords</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.keywords.map((k, i) => (
                <span key={i} className="text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-1 font-semibold">{k}</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TrendIntelligence() {
  const { toast } = useToast();
  const [selectedVertical, setSelectedVertical] = useState<string>("all");
  const [analyzeVertical, setAnalyzeVertical] = useState("money");
  const [keywords, setKeywords] = useState("");

  const { data: reports = [], isLoading } = useQuery<TrendReport[]>({
    queryKey: ["/api/trends", selectedVertical],
    queryFn: async () => {
      const url = selectedVertical !== "all" ? `/api/trends?vertical=${selectedVertical}` : "/api/trends";
      const res = await fetch(url);
      return res.json();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/trends/analyze", { vertical: analyzeVertical, keywords }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Trend analysis complete!", description: `Market intelligence for ${VERTICAL_LABELS[analyzeVertical] || analyzeVertical} is ready.` });
    },
    onError: (err: any) => toast({ title: "Analysis failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-8 space-y-7 overflow-y-auto h-full">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trend Intelligence</h1>
          <p className="text-muted-foreground text-sm">AI-powered market analysis for your publishing verticals</p>
        </div>
      </div>

      <Card className="border-primary/15 premium-gradient-subtle shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
        <CardHeader className="pb-3 relative">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Run Market Analysis
          </CardTitle>
          <CardDescription>Generate AI-powered demand scores, pain point clusters, and greenlight scores</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Vertical</label>
              <Select value={analyzeVertical} onValueChange={setAnalyzeVertical}>
                <SelectTrigger className="w-52 h-10 bg-background/80 border-border/60" data-testid="select-analyze-vertical">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERTICALS.map(v => (
                    <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-48">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Focus Keywords (optional)</label>
              <Input
                placeholder="e.g., passive income, side hustle, financial freedom"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                data-testid="input-keywords"
                className="h-10 bg-background/80 border-border/60"
              />
            </div>
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              data-testid="button-analyze"
              className="h-10 shadow-sm"
            >
              {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              {analyzeMutation.isPending ? "Analyzing..." : "Run Analysis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-bold text-lg tracking-tight">Analysis Reports ({reports.length})</h2>
        <Select value={selectedVertical} onValueChange={setSelectedVertical}>
          <SelectTrigger className="w-44 h-10 bg-card border-border/60" data-testid="select-filter-vertical">
            <SelectValue placeholder="All Verticals" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verticals</SelectItem>
            {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {analyzeMutation.isPending && (
        <Card className="border-primary/20 premium-gradient-subtle shadow-sm">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-sm">Running AI market analysis...</p>
                <p className="text-xs text-muted-foreground">Analyzing trends, pain points, and opportunities for {VERTICAL_LABELS[analyzeVertical]}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center mb-5">
              <TrendingUp className="h-7 w-7 text-blue-500" />
            </div>
            <p className="font-semibold text-lg">No trend reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">Run your first market analysis above to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {reports.map(r => <TrendReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
