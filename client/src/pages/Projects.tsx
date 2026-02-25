import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, BookOpen, ChevronRight, Filter } from "lucide-react";
import { formatNumber, formatScore, scoreColor, statusLabel, VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";
import { PROJECT_STATUSES, VERTICALS } from "@shared/schema";

const PIPELINE_STEPS = ["draft", "trend_analysis", "outlining", "writing", "editing", "marketing", "complete"];

function getPipelineProgress(status: string) {
  const idx = PIPELINE_STEPS.indexOf(status);
  return idx >= 0 ? Math.round((idx / (PIPELINE_STEPS.length - 1)) * 100) : 0;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || "bg-muted text-muted-foreground"}`}>
      {statusLabel(status)}
    </span>
  );
}

function VerticalIcon({ vertical }: { vertical: string }) {
  const icons: Record<string, string> = {
    money: "💰", fitness: "💪", spirituality: "🧘", career: "🚀",
    education: "📚", relationships: "❤️", health: "🏥", mindset: "🧠",
    parenting: "👨‍👩‍👧", technology: "⚡",
  };
  return <span>{icons[vertical] || "📖"}</span>;
}

export default function Projects() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterVertical, setFilterVertical] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Project deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const filtered = projects.filter(p => {
    const matchSearch = search === "" || p.title.toLowerCase().includes(search.toLowerCase());
    const matchVertical = filterVertical === "all" || p.vertical === filterVertical;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchVertical && matchStatus;
  });

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Book Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{projects.length} total projects</p>
        </div>
        <Link href="/projects/new">
          <Button data-testid="button-new-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search projects..."
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={filterVertical} onValueChange={setFilterVertical}>
          <SelectTrigger className="w-44" data-testid="select-vertical-filter">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Verticals" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verticals</SelectItem>
            {VERTICALS.map(v => (
              <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {PROJECT_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-lg">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || filterVertical !== "all" || filterStatus !== "all"
                ? "Try adjusting your filters"
                : "Create your first book project to get started"}
            </p>
            {!search && filterVertical === "all" && filterStatus === "all" && (
              <Link href="/projects/new">
                <Button className="mt-5">
                  <Plus className="h-4 w-4 mr-2" /> Create Project
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <div key={project.id} className="group relative" data-testid={`project-card-${project.id}`}>
              <Link href={`/projects/${project.id}`}>
                <Card className="h-full cursor-pointer hover-elevate transition-all">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-lg ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                        <VerticalIcon vertical={project.vertical} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 pr-6">{project.title}</h3>
                        <p className={`text-xs mt-0.5 ${VERTICAL_ACCENT[project.vertical] || "text-muted-foreground"}`}>
                          {VERTICAL_LABELS[project.vertical] || project.vertical}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <StatusBadge status={project.status} />
                        <span className="text-xs text-muted-foreground">{getPipelineProgress(project.status)}%</span>
                      </div>
                      <Progress value={getPipelineProgress(project.status)} className="h-1.5" />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded-md py-1.5">
                        <div className="text-xs font-semibold">{formatNumber(project.wordCount)}</div>
                        <div className="text-[10px] text-muted-foreground">words</div>
                      </div>
                      <div className="bg-muted/50 rounded-md py-1.5">
                        <div className={`text-xs font-semibold ${scoreColor(project.qualityScore)}`}>{formatScore(project.qualityScore)}</div>
                        <div className="text-[10px] text-muted-foreground">quality</div>
                      </div>
                      <div className="bg-muted/50 rounded-md py-1.5">
                        <div className="text-xs font-semibold">{project.chapterCount}</div>
                        <div className="text-[10px] text-muted-foreground">chapters</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground capitalize">{project.targetLanguage}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                onClick={(e) => { e.preventDefault(); setDeleteId(project.id); }}
                data-testid={`button-delete-${project.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its chapters, marketing assets, and run logs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
