import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Zap, Target, Lightbulb, Hash, RefreshCw, BarChart3 } from "lucide-react";
import { formatScore, VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VERTICALS } from "@shared/schema";
import type { TrendReport } from "@shared/schema";

function ScoreBar({ label, score, colorClass }: { label: string; score: number | null | undefined; colorClass: string }) {
  const pct = score != null ? (score / 10) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold ${colorClass}`}>{formatScore(score)}/10</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function TrendReportCard({ report }: { report: TrendReport }) {
  const gl = report.greenlightScore || 0;
  const glColor = gl >= 8 ? "text-green-600 dark:text-green-400" : gl >= 6 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const bgClass = VERTICAL_BG[report.vertical] || "bg-muted";
  const accentClass = VERTICAL_ACCENT[report.vertical] || "text-muted-foreground";

  return (
    <Card className="overflow-hidden" data-testid={`trend-report-${report.id}`}>
      <div className={`px-4 py-3 border-b ${bgClass}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className={`text-sm font-semibold ${accentClass}`}>{VERTICAL_LABELS[report.vertical] || report.vertical}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-sm font-bold ${glColor}`}>
              GL {formatScore(report.greenlightScore)}
            </Badge>
          </div>
        </div>
      </div>

      <CardContent className="pt-4 pb-4 space-y-4">
        {report.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
        )}

        <div className="space-y-2.5">
          <ScoreBar label="Demand Score" score={report.demandScore}
            colorClass={report.demandScore && report.demandScore >= 7 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"} />
          <ScoreBar label="Competition (lower = easier)" score={report.competitionScore}
            colorClass={report.competitionScore && report.competitionScore <= 5 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"} />
        </div>

        {report.painPoints && report.painPoints.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pain Points</p>
            </div>
            <div className="space-y-1.5">
              {report.painPoints.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 flex h-4 w-4 mt-0.5 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-[10px] font-bold text-red-600 dark:text-red-400">{i + 1}</span>
                  <span className="text-muted-foreground leading-snug">{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.titleAngles && report.titleAngles.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title Angles</p>
            </div>
            <div className="space-y-1">
              {report.titleAngles.slice(0, 4).map((t, i) => (
                <div key={i} className="text-xs bg-muted/50 rounded px-2.5 py-1.5 text-foreground">{t}</div>
              ))}
            </div>
          </div>
        )}

        {report.nicheTopics && report.nicheTopics.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Niche Opportunities</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.nicheTopics.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {report.keywords && report.keywords.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keywords</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.keywords.map((k, i) => (
                <span key={i} className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-medium">{k}</span>
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
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Trend Intelligence</h1>
          <p className="text-muted-foreground text-sm">AI-powered market analysis for your publishing verticals</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Run Market Analysis
          </CardTitle>
          <CardDescription>Generate AI-powered demand scores, pain point clusters, title angles, and greenlight scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vertical</label>
              <Select value={analyzeVertical} onValueChange={setAnalyzeVertical}>
                <SelectTrigger className="w-52" data-testid="select-analyze-vertical">
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
              <label className="text-xs font-medium text-muted-foreground">Focus Keywords (optional)</label>
              <Input
                placeholder="e.g., passive income, side hustle, financial freedom"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                data-testid="input-keywords"
              />
            </div>
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              data-testid="button-analyze"
            >
              <Zap className="h-4 w-4 mr-2" />
              {analyzeMutation.isPending ? "Analyzing..." : "Run Analysis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold">Analysis Reports ({reports.length})</h2>
        <Select value={selectedVertical} onValueChange={setSelectedVertical}>
          <SelectTrigger className="w-44" data-testid="select-filter-vertical">
            <SelectValue placeholder="All Verticals" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verticals</SelectItem>
            {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {analyzeMutation.isPending && (
        <Card className="border-primary/20">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary animate-spin" />
              <div>
                <p className="font-medium text-sm">Running AI market analysis...</p>
                <p className="text-xs text-muted-foreground">Analyzing trends, pain points, and opportunities for {VERTICAL_LABELS[analyzeVertical]}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-lg">No trend reports yet</p>
            <p className="text-sm text-muted-foreground mt-1">Run your first market analysis above to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {reports.map(r => <TrendReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
