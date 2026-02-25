import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, BookOpen, ArrowRight, FolderOpen } from "lucide-react";
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

const statusColors: Record<string, string> = {
  draft: "bg-slate-400",
  trend_analysis: "bg-blue-500",
  outlining: "bg-purple-500",
  writing: "bg-amber-500",
  editing: "bg-orange-500",
  marketing: "bg-pink-500",
  complete: "bg-emerald-500",
  paused: "bg-slate-400",
};

function VerticalIcon({ vertical }: { vertical: string }) {
  const icons: Record<string, string> = {
    money: "\u{1F4B0}", fitness: "\u{1F4AA}", spirituality: "\u{1F9D8}", career: "\u{1F680}",
    education: "\u{1F4DA}", relationships: "\u2764\uFE0F", health: "\u{1F3E5}", mindset: "\u{1F9E0}",
    parenting: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", technology: "\u26A1",
  };
  return <span>{icons[vertical] || "\u{1F4D6}"}</span>;
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
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
            <FolderOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Book Projects</h1>
            <p className="text-muted-foreground text-sm">{projects.length} total projects</p>
          </div>
        </div>
        <Link href="/projects/new">
          <Button data-testid="button-new-project" className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search projects..."
            className="pl-9 h-10 bg-card border-border/60"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={filterVertical} onValueChange={setFilterVertical}>
          <SelectTrigger className="w-44 h-10 bg-card border-border/60" data-testid="select-vertical-filter">
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
          <SelectTrigger className="w-40 h-10 bg-card border-border/60" data-testid="select-status-filter">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center mb-5">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold text-lg">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || filterVertical !== "all" || filterStatus !== "all"
                ? "Try adjusting your filters"
                : "Create your first book project to get started"}
            </p>
            {!search && filterVertical === "all" && filterStatus === "all" && (
              <Link href="/projects/new">
                <Button className="mt-5 shadow-sm">
                  <Plus className="h-4 w-4 mr-2" /> Create Project
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((project) => (
            <div key={project.id} className="group relative" data-testid={`project-card-${project.id}`}>
              <Link href={`/projects/${project.id}`}>
                <Card className="h-full cursor-pointer border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                  <CardContent className="pt-5 pb-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                        <VerticalIcon vertical={project.vertical} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug line-clamp-2 pr-6 group-hover:text-primary transition-colors">{project.title}</h3>
                        <p className={`text-[11px] mt-0.5 font-medium ${VERTICAL_ACCENT[project.vertical] || "text-muted-foreground"}`}>
                          {VERTICAL_LABELS[project.vertical] || project.vertical}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full ${statusColors[project.status] || "bg-slate-400"}`} />
                          {statusLabel(project.status)}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">{getPipelineProgress(project.status)}%</span>
                      </div>
                      <Progress value={getPipelineProgress(project.status)} className="h-1" />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: formatNumber(project.wordCount), label: "words" },
                        { value: formatScore(project.qualityScore), label: "quality", color: scoreColor(project.qualityScore) },
                        { value: project.chapterCount.toString(), label: "chapters" },
                      ].map(({ value, label, color }) => (
                        <div key={label} className="bg-muted/40 rounded-lg py-2 text-center">
                          <div className={`text-xs font-bold ${color || ""}`}>{value}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground capitalize font-medium">{project.targetLanguage}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
