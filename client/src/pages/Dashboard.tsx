import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, TrendingUp, DollarSign, Star, Plus, ArrowRight, Zap, BarChart3, FileText, Megaphone, Sparkles,
} from "lucide-react";
import { formatNumber, formatCost, formatScore, statusLabel, VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT, scoreColor } from "@/lib/utils";
import type { Project, TrendReport } from "@shared/schema";

interface DashboardData {
  stats: { totalProjects: number; completedProjects: number; totalWords: number; totalCost: number; avgQuality: number };
  recentProjects: Project[];
  recentTrends: TrendReport[];
}

const statIcons = [
  { icon: BookOpen, gradient: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
  { icon: FileText, gradient: "from-blue-500 to-cyan-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { icon: DollarSign, gradient: "from-emerald-500 to-green-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { icon: Star, gradient: "from-amber-500 to-orange-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
];

function StatCard({ title, value, sub, index }: { title: string; value: string; sub?: string; index: number }) {
  const { icon: Icon, gradient, bg } = statIcons[index];
  return (
    <Card className="relative overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold tracking-tight" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-slate-400",
    trend_analysis: "bg-blue-500",
    outlining: "bg-purple-500",
    writing: "bg-amber-500",
    editing: "bg-orange-500",
    marketing: "bg-pink-500",
    complete: "bg-emerald-500",
    paused: "bg-slate-400",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${colors[status] || "bg-slate-400"}`} />
      {statusLabel(status)}
    </span>
  );
}

function PipelineProgress({ status }: { status: string }) {
  const steps = ["draft", "trend_analysis", "outlining", "writing", "editing", "marketing", "complete"];
  const idx = steps.indexOf(status);
  const pct = idx >= 0 ? Math.round((idx / (steps.length - 1)) * 100) : 0;
  return <Progress value={pct} className="h-1" />;
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

  if (isLoading) {
    return (
      <div className="p-8 space-y-8">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const { stats, recentProjects, recentTrends } = data || { stats: { totalProjects: 0, completedProjects: 0, totalWords: 0, totalCost: 0, avgQuality: 0 }, recentProjects: [], recentTrends: [] };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Publishing Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your AI-powered publishing command center</p>
        </div>
        <Link href="/projects/new">
          <Button data-testid="button-new-project" className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            New Book Project
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard title="Total Projects" value={stats.totalProjects.toString()} sub={`${stats.completedProjects} completed`} index={0} />
        <StatCard title="Total Words" value={formatNumber(stats.totalWords)} sub="across all manuscripts" index={1} />
        <StatCard title="AI Spend" value={formatCost(stats.totalCost)} sub="total generation cost" index={2} />
        <StatCard title="Avg Quality" value={stats.avgQuality > 0 ? `${stats.avgQuality.toFixed(1)}/10` : "\u2014"} sub="editorial score" index={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                  <BookOpen className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-base font-semibold">Recent Projects</CardTitle>
              </div>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">No projects yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Create your first book project to get started</p>
                  <Link href="/projects/new">
                    <Button size="sm" className="mt-4 shadow-sm">
                      <Plus className="h-3 w-3 mr-1.5" /> Create Project
                    </Button>
                  </Link>
                </div>
              ) : (
                recentProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-border/50 bg-card hover:bg-accent/50 hover:border-border transition-all cursor-pointer group" data-testid={`project-card-${project.id}`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                        {project.vertical === "money" ? "\u{1F4B0}" : project.vertical === "fitness" ? "\u{1F4AA}" : project.vertical === "spirituality" ? "\u{1F9D8}" : project.vertical === "career" ? "\u{1F680}" : project.vertical === "education" ? "\u{1F4DA}" : project.vertical === "relationships" ? "\u2764\uFE0F" : project.vertical === "health" ? "\u{1F3E5}" : project.vertical === "mindset" ? "\u{1F9E0}" : project.vertical === "parenting" ? "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}" : "\u26A1"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{project.title}</p>
                          <ProjectStatusDot status={project.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{VERTICAL_LABELS[project.vertical] || project.vertical}</p>
                        <div className="mt-2.5">
                          <PipelineProgress status={project.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                          {project.wordCount > 0 && <span>{formatNumber(project.wordCount)} words</span>}
                          {project.qualityScore && <span className={scoreColor(project.qualityScore)}>Q: {formatScore(project.qualityScore)}</span>}
                          {project.greenlightScore && <span>GL: {formatScore(project.greenlightScore)}</span>}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors mt-1 shrink-0" />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-sm">
                  <TrendingUp className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-base font-semibold">Trend Intel</CardTitle>
              </div>
              <Link href="/trends">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Analyze <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {recentTrends.length === 0 ? (
                <div className="py-10 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground">No trend reports yet</p>
                  <Link href="/trends">
                    <Button size="sm" variant="outline" className="mt-3">Run Analysis</Button>
                  </Link>
                </div>
              ) : (
                recentTrends.map((report) => (
                  <div key={report.id} className={`p-3 rounded-xl border text-xs ${VERTICAL_BG[report.vertical] || "bg-muted"}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`font-semibold ${VERTICAL_ACCENT[report.vertical] || ""}`}>{VERTICAL_LABELS[report.vertical] || report.vertical}</span>
                      {report.greenlightScore && (
                        <Badge variant="outline" className="text-[11px] h-5 font-bold">
                          {formatScore(report.greenlightScore)} GL
                        </Badge>
                      )}
                    </div>
                    {report.summary && <p className="text-muted-foreground leading-relaxed line-clamp-2">{report.summary}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/15 premium-gradient-subtle shadow-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <CardContent className="pt-5 pb-5 relative">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-bold tracking-tight">Quick Actions</span>
              </div>
              <div className="space-y-2">
                <Link href="/trends">
                  <Button variant="outline" size="sm" className="w-full justify-start bg-background/80 hover:bg-background border-border/60">
                    <BarChart3 className="h-3.5 w-3.5 mr-2 text-primary" /> Run Trend Analysis
                  </Button>
                </Link>
                <Link href="/autopilot">
                  <Button variant="outline" size="sm" className="w-full justify-start bg-background/80 hover:bg-background border-border/60">
                    <Zap className="h-3.5 w-3.5 mr-2 text-primary" /> Configure Autopilot
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
