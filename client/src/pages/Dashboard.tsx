import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, TrendingUp, DollarSign, Star, Plus, ArrowRight, Zap, BarChart3, FileText, Megaphone,
} from "lucide-react";
import { formatNumber, formatCost, formatScore, statusLabel, VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT, scoreColor } from "@/lib/utils";
import type { Project, TrendReport } from "@shared/schema";

interface DashboardData {
  stats: { totalProjects: number; completedProjects: number; totalWords: number; totalCost: number; avgQuality: number };
  recentProjects: Project[];
  recentTrends: TrendReport[];
}

function StatCard({ title, value, sub, icon: Icon, color }: { title: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-0.5" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-md ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    trend_analysis: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    outlining: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    writing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    editing: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    complete: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    paused: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-muted text-muted-foreground"}`}>
      {statusLabel(status)}
    </span>
  );
}

function PipelineProgress({ status }: { status: string }) {
  const steps = ["draft", "trend_analysis", "outlining", "writing", "editing", "marketing", "complete"];
  const idx = steps.indexOf(status);
  const pct = idx >= 0 ? Math.round((idx / (steps.length - 1)) * 100) : 0;
  return (
    <div className="mt-2">
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const { stats, recentProjects, recentTrends } = data || { stats: { totalProjects: 0, completedProjects: 0, totalWords: 0, totalCost: 0, avgQuality: 0 }, recentProjects: [], recentTrends: [] };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Publishing Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your AI-powered publishing command center</p>
        </div>
        <Link href="/projects/new">
          <Button data-testid="button-new-project">
            <Plus className="h-4 w-4 mr-2" />
            New Book Project
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={stats.totalProjects.toString()}
          sub={`${stats.completedProjects} completed`}
          icon={BookOpen}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="Total Words"
          value={formatNumber(stats.totalWords)}
          sub="across all manuscripts"
          icon={FileText}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="AI Spend"
          value={formatCost(stats.totalCost)}
          sub="total generation cost"
          icon={DollarSign}
          color="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Avg Quality"
          value={stats.avgQuality > 0 ? `${stats.avgQuality.toFixed(1)}/10` : "—"}
          sub="editorial score"
          icon={Star}
          color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <Link href="/projects">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No projects yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create your first book project to get started</p>
                  <Link href="/projects/new">
                    <Button size="sm" className="mt-4">
                      <Plus className="h-3 w-3 mr-1" /> Create Project
                    </Button>
                  </Link>
                </div>
              ) : (
                recentProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="flex items-start gap-3 p-3 rounded-md border border-card-border bg-card hover-elevate cursor-pointer" data-testid={`project-card-${project.id}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-base ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                        {project.vertical === "money" ? "💰" : project.vertical === "fitness" ? "💪" : project.vertical === "spirituality" ? "🧘" : project.vertical === "career" ? "🚀" : project.vertical === "education" ? "📚" : project.vertical === "relationships" ? "❤️" : project.vertical === "health" ? "🏥" : project.vertical === "mindset" ? "🧠" : project.vertical === "parenting" ? "👨‍👩‍👧" : "⚡"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{project.title}</p>
                          <ProjectStatusBadge status={project.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{VERTICAL_LABELS[project.vertical] || project.vertical}</p>
                        <PipelineProgress status={project.status} />
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {project.wordCount > 0 && <span>{formatNumber(project.wordCount)} words</span>}
                          {project.qualityScore && <span className={scoreColor(project.qualityScore)}>Quality: {formatScore(project.qualityScore)}</span>}
                          {project.greenlightScore && <span>Greenlight: {formatScore(project.greenlightScore)}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base">Trend Intelligence</CardTitle>
              <Link href="/trends">
                <Button variant="ghost" size="sm">
                  Analyze <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentTrends.length === 0 ? (
                <div className="py-8 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No trend reports yet</p>
                  <Link href="/trends">
                    <Button size="sm" variant="outline" className="mt-3">Run Analysis</Button>
                  </Link>
                </div>
              ) : (
                recentTrends.map((report) => (
                  <div key={report.id} className={`p-2.5 rounded-md border text-xs ${VERTICAL_BG[report.vertical] || "bg-muted"}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`font-medium ${VERTICAL_ACCENT[report.vertical] || ""}`}>{VERTICAL_LABELS[report.vertical] || report.vertical}</span>
                      {report.greenlightScore && (
                        <Badge variant="outline" className="text-xs h-5">
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

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Quick Actions</span>
              </div>
              <div className="space-y-2">
                <Link href="/trends">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <BarChart3 className="h-3 w-3 mr-2" /> Run Trend Analysis
                  </Button>
                </Link>
                <Link href="/autopilot">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Megaphone className="h-3 w-3 mr-2" /> Configure Autopilot
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
