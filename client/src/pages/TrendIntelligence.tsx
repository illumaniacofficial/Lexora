import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Zap, Target, Lightbulb, Hash, Loader2, BarChart3, Hexagon, AlertCircle, ArrowUpDown } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatScore, VERTICAL_LABELS, VERTICAL_ICONS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VERTICALS } from "@shared/schema";
import type { TrendReport } from "@shared/schema";

const FICTION_VERTICALS = new Set([
  "sci-fi", "fantasy", "horror", "romance", "thriller", "mystery", "literary-fiction", "dystopian", "erotica",
  "adventure", "young-adult", "children", "poetry", "drama", "western", "novel", "comedy",
]);

type TrendSortKey = "greenlight" | "demand" | "competition" | "recent";

function ScoreBar({ label, score }: { label: string; score: number | null | undefined }) {
  const pct = score != null ? (score / 10) * 100 : 0;
  const color = score != null && score >= 7 ? "text-emerald-400" : score != null && score >= 5 ? "text-amber-400" : "text-red-400";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">{label}</span>
        <span className={`text-[11px] font-mono font-bold ${color}`}>{formatScore(score)}/10</span>
      </div>
      <Progress value={pct} className="h-[3px]" />
    </div>
  );
}

function TrendReportCard({ report }: { report: TrendReport }) {
  const gl = report.greenlightScore || 0;
  const glColor = gl >= 8 ? "text-emerald-400 glow-text" : gl >= 6 ? "text-amber-400" : "text-red-400";

  return (
    <Card className="border-border/20 bg-card/30 hover:border-purple-500/15 transition-all duration-300" data-testid={`trend-report-${report.id}`}>
      <div className="px-5 py-3.5 border-b border-border/15 aurora-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{VERTICAL_ICONS[report.vertical] || "📊"}</span>
            <div>
              <p className="text-[11px] font-mono font-bold text-purple-300/80 uppercase tracking-wider">{VERTICAL_LABELS[report.vertical] || report.vertical}</p>
              <p className="text-[9px] font-mono text-muted-foreground/30 mt-0.5">
                {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`text-sm font-mono font-bold px-3 py-0.5 border-border/30 ${glColor}`}>
            GL {formatScore(report.greenlightScore)}
          </Badge>
        </div>
      </div>

      <CardContent className="pt-5 pb-5 space-y-5">
        {report.summary && (
          <p className="text-[12px] text-muted-foreground/60 leading-relaxed">{report.summary}</p>
        )}

        <div className="space-y-3">
          <ScoreBar label="Demand" score={report.demandScore} />
          <ScoreBar label="Competition" score={report.competitionScore} />
        </div>

        {report.painPoints && report.painPoints.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Target className="h-3 w-3 text-red-400/60" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Pain Points</p>
            </div>
            <div className="space-y-1.5">
              {report.painPoints.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[11px]">
                  <span className="shrink-0 flex h-4 w-4 mt-0.5 items-center justify-center rounded bg-red-500/10 border border-red-500/20 text-[8px] font-mono font-bold text-red-400">{i + 1}</span>
                  <span className="text-muted-foreground/60 leading-snug">{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.titleAngles && report.titleAngles.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Lightbulb className="h-3 w-3 text-amber-400/60" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Title Angles</p>
            </div>
            <div className="space-y-1.5">
              {report.titleAngles.slice(0, 4).map((t, i) => (
                <div key={i} className="text-[11px] bg-white/[0.02] border border-border/15 rounded-lg px-3 py-2 font-mono text-muted-foreground/70">{t}</div>
              ))}
            </div>
          </div>
        )}

        {report.nicheTopics && report.nicheTopics.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Zap className="h-3 w-3 text-purple-400/60" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Niche Ops</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.nicheTopics.map((t, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] font-mono border-border/20 bg-purple-500/5 text-purple-300/70">{t}</Badge>
              ))}
            </div>
          </div>
        )}

        {report.keywords && report.keywords.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Hash className="h-3 w-3 text-cyan-400/60" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Keywords</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.keywords.map((k, i) => (
                <span key={i} className="text-[10px] bg-cyan-500/5 border border-cyan-500/15 text-cyan-300/70 rounded-full px-2.5 py-1 font-mono">{k}</span>
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
  const [sortBy, setSortBy] = useState<TrendSortKey>("greenlight");
  const [category, setCategory] = useState<"all" | "fiction" | "nonfiction">("all");

  const { data: reports = [], isLoading, error } = useQuery<TrendReport[]>({
    queryKey: ["/api/trends", selectedVertical],
    queryFn: async () => {
      const url = selectedVertical !== "all" ? `/api/trends?vertical=${selectedVertical}` : "/api/trends";
      const res = await fetch(url);
      return res.json();
    },
  });

  const displayReports = useMemo(() => {
    let result = category === "all" ? reports : reports.filter(r =>
      category === "fiction" ? FICTION_VERTICALS.has(r.vertical) : !FICTION_VERTICALS.has(r.vertical)
    );
    const byScore = (key: "demandScore" | "competitionScore" | "greenlightScore") =>
      [...result].sort((a, b) => (b[key] || 0) - (a[key] || 0));
    switch (sortBy) {
      case "demand": result = byScore("demandScore"); break;
      case "competition": result = byScore("competitionScore"); break;
      case "recent": result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      default: result = byScore("greenlightScore");
    }
    return result;
  }, [reports, category, sortBy]);

  const analyzeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/trends/analyze", { vertical: analyzeVertical, keywords }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Analysis complete" });
    },
    onError: (err: any) => toast({ title: "Analysis failed", description: err.message, variant: "destructive" }),
  });

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load trend data</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-7 overflow-y-auto h-full">
      <Helmet>
        <title>Trend Intelligence — Lexora</title>
        <meta name="description" content="AI-powered market intelligence — analyze publishing verticals for demand, competition, and greenlight scores." />
      </Helmet>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-cyan-500/50" />
          <span className="text-[9px] font-mono font-bold text-cyan-400/60 tracking-[0.2em] uppercase">INTELLIGENCE</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">Trend <span className="shimmer-text">Analysis</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1 hidden sm:block">AI-powered market intelligence for publishing verticals</p>
      </div>

      <div className="line-glow" />

      <Card className="border-border/20 bg-card/30 glow-border-cyan overflow-hidden relative">
        <div className="absolute inset-0 mesh-bg opacity-30 pointer-events-none" />
        <CardHeader className="pb-3 relative">
          <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-400/70" />
            Run Market Analysis
          </CardTitle>
          <CardDescription className="text-[11px] font-mono text-muted-foreground/40">Generate demand scores, pain points, and greenlight scores</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 md:gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Vertical</label>
              <Select value={analyzeVertical} onValueChange={setAnalyzeVertical}>
                <SelectTrigger className="w-full sm:w-52 h-9 md:h-10 bg-card/30 border-border/30 font-mono text-[12px]" data-testid="select-analyze-vertical"><SelectValue /></SelectTrigger>
                <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <label className="text-[9px] font-mono font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Keywords (optional)</label>
              <Input placeholder="e.g., passive income, side hustle" value={keywords} onChange={e => setKeywords(e.target.value)} data-testid="input-keywords" className="h-9 md:h-10 bg-card/30 border-border/30 font-mono text-[12px] focus:border-cyan-500/40" />
            </div>
            <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending} data-testid="button-analyze" className="h-9 md:h-10 neon-glow-cool text-white border-0 shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] font-mono text-[12px] w-full sm:w-auto">
              {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              {analyzeMutation.isPending ? "ANALYZING..." : "RUN ANALYSIS"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-bold text-sm tracking-tight font-mono text-muted-foreground/60">Reports ({displayReports.length})</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border/30 bg-card/30 p-0.5" data-testid="filter-category">
            {([
              { key: "all", label: "All" },
              { key: "fiction", label: "Fiction" },
              { key: "nonfiction", label: "Non-Fiction" },
            ] as const).map(c => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-2.5 h-8 rounded-md font-mono text-[10px] uppercase tracking-wider transition-all ${category === c.key ? "bg-cyan-500/20 text-cyan-300" : "text-muted-foreground/40 hover:text-muted-foreground/70"}`}
                data-testid={`button-category-${c.key}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as TrendSortKey)}>
            <SelectTrigger className="w-40 h-9 bg-card/30 border-border/30 font-mono text-[11px]" data-testid="select-sort-trends">
              <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground/40" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="greenlight">Greenlight Score</SelectItem>
              <SelectItem value="demand">Demand Score</SelectItem>
              <SelectItem value="competition">Competition</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedVertical} onValueChange={setSelectedVertical}>
            <SelectTrigger className="w-44 h-9 bg-card/30 border-border/30 font-mono text-[11px]" data-testid="select-filter-vertical"><SelectValue placeholder="All Verticals" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verticals</SelectItem>
              {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {analyzeMutation.isPending && (
        <Card className="border-cyan-500/20 bg-card/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
              <div>
                <p className="font-bold text-sm tracking-tight">Running AI analysis...</p>
                <p className="text-[10px] font-mono text-muted-foreground/40">Scanning {VERTICAL_LABELS[analyzeVertical]}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 rounded-xl bg-muted/20" />)}
        </div>
      ) : displayReports.length === 0 ? (
        <Card className="border-border/20 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 neon-glow-cool opacity-20 blur-2xl rounded-full" />
              <TrendingUp className="h-12 w-12 text-cyan-500/30 relative" />
            </div>
            <p className="font-bold text-lg mt-5 tracking-tight">No reports yet</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1">Run your first analysis above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {displayReports.map(r => <TrendReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
