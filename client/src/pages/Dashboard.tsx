import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, TrendingUp, DollarSign, Star, Plus, ArrowRight, Zap, BarChart3, FileText, Megaphone, Hexagon, Activity, AlertCircle,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatNumber, formatCost, formatScore, statusLabel, VERTICAL_LABELS, scoreColor, STATUS_GLOW } from "@/lib/utils";
import type { Project, TrendReport } from "@shared/schema";

interface DashboardProject extends Project {
  totalChapters: number;
  completedChapters: number;
  hasTrend: boolean;
  hasCover: boolean;
  hasMarketing: boolean;
}

interface DashboardData {
  stats: { totalProjects: number; completedProjects: number; totalWords: number; totalCost: number; avgQuality: number };
  recentProjects: DashboardProject[];
  recentTrends: TrendReport[];
}

function getLivePct(p: DashboardProject): number {
  let done = 0;
  let total = 0;
  total += 1; if (p.hasTrend) done += 1;
  total += 1; if (p.totalChapters > 0) done += 1;
  total += 1; if (p.hasCover) done += 1;
  if (p.totalChapters > 0) {
    total += p.totalChapters;
    done += p.completedChapters;
  } else {
    total += 1;
  }
  total += 1; if (p.hasMarketing) done += 1;
  return Math.round((done / total) * 100);
}

const statConfig = [
  { icon: BookOpen, label: "PROJECTS", glowClass: "neon-glow", textGlow: "glow-text" },
  { icon: FileText, label: "WORDS", glowClass: "neon-glow-cool", textGlow: "glow-text-cyan" },
  { icon: DollarSign, label: "AI SPEND", glowClass: "neon-glow-nature", textGlow: "" },
  { icon: Star, label: "QUALITY", glowClass: "neon-glow-warm", textGlow: "glow-text-pink" },
];

function StatCard({ label, value, sub, index }: { label: string; value: string; sub?: string; index: number }) {
  const cfg = statConfig[index];
  const Icon = cfg.icon;
  return (
    <Card className="relative overflow-hidden border-border/30 bg-card/50 stat-orb group hover:border-purple-500/20 transition-all duration-500">
      <CardContent className="pt-5 pb-5 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${cfg.glowClass} shadow-lg`} />
              <p className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-[0.2em] uppercase">{label}</p>
            </div>
            <p className={`text-3xl font-bold tracking-tighter ${cfg.textGlow}`} data-testid={`stat-${label.toLowerCase()}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground/60 font-mono">{sub}</p>}
          </div>
          <div className="relative">
            <div className={`absolute inset-0 ${cfg.glowClass} opacity-20 blur-xl rounded-full`} />
            <Icon className="h-6 w-6 text-muted-foreground/30 relative" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/70">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_GLOW[status] || "bg-zinc-500"}`} />
      {statusLabel(status)}
    </span>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <Skeleton className="h-12 w-80 bg-muted/30" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-muted/20" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load dashboard</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  const { stats, recentProjects, recentTrends } = data || { stats: { totalProjects: 0, completedProjects: 0, totalWords: 0, totalCost: 0, avgQuality: 0 }, recentProjects: [], recentTrends: [] };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full">
      <Helmet>
        <title>Dashboard — Lexora</title>
        <meta name="description" content="Lexora command center — view project stats, recent manuscripts, trend intel, and quick actions." />
      </Helmet>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-purple-400 animate-pulse-glow" />
            <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.25em] uppercase">COMMAND CENTER</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tighter">Publishing<span className="shimmer-text"> Dashboard</span></h1>
        </div>
        <Link href="/projects/new">
          <Button data-testid="button-new-project" className="neon-glow text-white border-0 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.6)] transition-shadow">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="line-glow" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="PROJECTS" value={stats.totalProjects.toString()} sub={`${stats.completedProjects} complete`} index={0} />
        <StatCard label="WORDS" value={formatNumber(stats.totalWords)} sub="generated" index={1} />
        <StatCard label="AI SPEND" value={formatCost(stats.totalCost)} sub="total cost" index={2} />
        <StatCard label="QUALITY" value={stats.avgQuality > 0 ? `${stats.avgQuality.toFixed(1)}` : "\u2014"} sub="avg score" index={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-border/30 bg-card/40">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <div className="flex items-center gap-3">
                <Hexagon className="h-4 w-4 text-purple-500/60" />
                <CardTitle className="text-sm font-bold tracking-tight">Recent Projects</CardTitle>
              </div>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-muted-foreground/60 hover:text-purple-400 text-[11px] font-mono" data-testid="button-view-all-projects">
                  VIEW ALL <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 neon-glow opacity-20 blur-2xl rounded-full" />
                    <BookOpen className="h-10 w-10 text-purple-500/40 relative" />
                  </div>
                  <p className="text-sm font-semibold mt-4">No projects yet</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1 font-mono">Initialize your first manuscript</p>
                  <Link href="/projects/new">
                    <Button size="sm" data-testid="button-create-first-project" className="mt-5 neon-glow text-white border-0">
                      <Plus className="h-3 w-3 mr-1.5" /> Create
                    </Button>
                  </Link>
                </div>
              ) : (
                recentProjects.map((project) => {
                  const pct = getLivePct(project);
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="group flex items-center gap-4 p-4 rounded-xl border border-border/20 bg-card/30 hover:border-purple-500/20 hover:bg-purple-500/[0.03] transition-all duration-300 cursor-pointer" data-testid={`project-card-${project.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
                            <p className="text-sm font-bold tracking-tight truncate group-hover:text-purple-300 transition-colors">{project.title}</p>
                            <StatusDot status={project.status} />
                          </div>
                          <div className="flex items-center gap-3 mb-2.5">
                            <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">{VERTICAL_LABELS[project.vertical] || project.vertical}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={pct} className="h-[3px] flex-1" />
                            <span className="text-[10px] font-mono text-muted-foreground/40 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-purple-400/60 transition-colors shrink-0" />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-border/30 bg-card/40">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="h-3.5 w-3.5 text-cyan-400/70" />
                <CardTitle className="text-sm font-bold tracking-tight">Trend Intel</CardTitle>
              </div>
              <Link href="/trends">
                <Button variant="ghost" size="sm" className="text-muted-foreground/60 hover:text-cyan-400 text-[11px] font-mono" data-testid="button-analyze-trends">
                  ANALYZE <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentTrends.length === 0 ? (
                <div className="py-8 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-[11px] text-muted-foreground/50 font-mono">No reports</p>
                </div>
              ) : (
                recentTrends.map((report) => (
                  <div key={report.id} className="p-3 rounded-lg border border-border/20 bg-card/30 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-[11px] tracking-tight">{VERTICAL_LABELS[report.vertical] || report.vertical}</span>
                      {report.greenlightScore && (
                        <span className={`text-[11px] font-mono font-bold ${report.greenlightScore >= 7 ? "text-emerald-400 glow-text" : report.greenlightScore >= 5 ? "text-amber-400" : "text-red-400"}`}>
                          GL:{formatScore(report.greenlightScore)}
                        </span>
                      )}
                    </div>
                    {report.summary && <p className="text-muted-foreground/50 leading-relaxed line-clamp-2 text-[10px]">{report.summary}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-purple-500/15 glow-border bg-card/30 overflow-hidden relative">
            <div className="absolute inset-0 mesh-bg opacity-50 pointer-events-none" />
            <CardContent className="pt-5 pb-5 relative">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-3.5 w-3.5 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
                <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.2em] uppercase">QUICK ACTIONS</span>
              </div>
              <div className="space-y-2">
                <Link href="/trends">
                  <Button variant="outline" size="sm" data-testid="button-run-trend-analysis" className="w-full justify-start border-border/30 bg-card/30 hover:border-cyan-500/30 hover:text-cyan-300 text-[12px] font-mono tracking-tight transition-all">
                    <BarChart3 className="h-3.5 w-3.5 mr-2 text-cyan-500/60" /> Run Trend Analysis
                  </Button>
                </Link>
                <Link href="/autopilot">
                  <Button variant="outline" size="sm" data-testid="button-configure-autopilot" className="w-full justify-start border-border/30 bg-card/30 hover:border-purple-500/30 hover:text-purple-300 text-[12px] font-mono tracking-tight transition-all">
                    <Zap className="h-3.5 w-3.5 mr-2 text-purple-500/60" /> Configure Autopilot
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
