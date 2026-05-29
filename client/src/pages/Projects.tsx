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
import { Plus, Search, Trash2, BookOpen, ArrowRight, Hexagon, Music, Clock } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { AlertCircle } from "lucide-react";
import { formatNumber, formatScore, scoreColor, statusLabel, VERTICAL_LABELS, STATUS_GLOW } from "@/lib/utils";
import { formatReadTime } from "@/lib/reading";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

interface EnrichedProject extends Project {
  totalChapters: number;
  completedChapters: number;
  hasTrend: boolean;
  hasCover: boolean;
  hasMarketing: boolean;
  chaptersWithAudio: number;
}

function getLivePct(p: EnrichedProject): number {
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
import { PROJECT_STATUSES, VERTICALS } from "@shared/schema";


export default function Projects() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterVertical, setFilterVertical] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: projects = [], isLoading, error } = useQuery<EnrichedProject[]>({ queryKey: ["/api/projects"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Project terminated" });
      setDeleteId(null);
    },
  });

  const filtered = projects.filter(p => {
    const matchSearch = search === "" || p.title.toLowerCase().includes(search.toLowerCase());
    const matchVertical = filterVertical === "all" || p.vertical === filterVertical;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchVertical && matchStatus;
  });

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load projects</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-6 overflow-y-auto h-full aurora-bg-animated">
      <Helmet>
        <title>Projects — Lexora</title>
        <meta name="description" content="Manage your book manuscripts — create, track progress, and navigate through your publishing pipeline." />
      </Helmet>
      <div className="flex items-end justify-between gap-3 md:gap-4 flex-wrap animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Hexagon className="h-3 w-3 text-purple-500/50" />
            <span className="text-[9px] font-mono font-bold text-muted-foreground/40 tracking-[0.2em] uppercase">PROJECTS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">Book <span className="shimmer-text">Projects</span></h1>
          <p className="text-muted-foreground/50 text-[11px] font-mono mt-1 hidden sm:block">{projects.length} in-progress manuscripts · Completed books move to Library</p>
        </div>
        <Link href="/projects/new">
          <Button data-testid="button-new-project" size="sm" className="neon-glow text-white border-0 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.6)] hover:scale-105 transition-all duration-300 h-9 md:h-10 text-[12px] md:text-sm">
            <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" /> New Project
          </Button>
        </Link>
      </div>

      <div className="line-glow" />

      <div className="flex items-center gap-2 md:gap-3 flex-wrap animate-fade-in-up stagger-2">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
          <Input placeholder="Search..." className="pl-9 h-9 md:h-10 bg-white/[0.03] border-border/20 font-mono text-[12px] md:text-sm focus:border-purple-500/40 transition-colors" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>
        <Select value={filterVertical} onValueChange={setFilterVertical}>
          <SelectTrigger className="w-32 md:w-44 h-9 md:h-10 bg-white/[0.03] border-border/20 font-mono text-[11px] md:text-[12px]" data-testid="select-vertical-filter"><SelectValue placeholder="All Verticals" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verticals</SelectItem>
            {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-28 md:w-40 h-9 md:h-10 bg-white/[0.03] border-border/20 font-mono text-[11px] md:text-[12px]" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl bg-muted/20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative animate-float">
            <div className="absolute inset-0 neon-glow opacity-20 blur-3xl rounded-full scale-150" />
            <BookOpen className="h-12 w-12 text-purple-500/30 relative" />
          </div>
          <p className="font-bold text-lg mt-5 tracking-tight">No manuscripts found</p>
          <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
            {search || filterVertical !== "all" || filterStatus !== "all" ? "Adjust search filters" : "Initialize your first project"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project, idx) => {
            const pct = getLivePct(project);
            return (
              <div key={project.id} className={`group relative animate-fade-in-up stagger-${Math.min(idx + 1, 6)}`} data-testid={`project-card-${project.id}`}>
                <Link href={`/projects/${project.id}`}>
                  <Card className="h-full cursor-pointer border-border/15 bg-card/30 hover:border-purple-500/25 transition-all duration-500 card-hover-lift overflow-hidden">
                    {project.hasCover && (
                      <div className="relative w-full h-28 overflow-hidden">
                        <img
                          src={`/api/projects/${project.id}/cover-image`}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="cover-gradient-overlay" />
                        <div className="absolute bottom-2 left-3">
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-mono text-white/80 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_GLOW[project.status] || "bg-zinc-500"}`} />
                            {statusLabel(project.status)}
                          </span>
                        </div>
                      </div>
                    )}
                    <CardContent className={`${project.hasCover ? "pt-3" : "pt-5"} pb-4 space-y-4`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm tracking-tight line-clamp-2 group-hover:text-purple-300 transition-colors">{project.title}</h3>
                          <p className="text-[10px] font-mono text-muted-foreground/40 mt-1 uppercase tracking-wider">{VERTICAL_LABELS[project.vertical] || project.vertical}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/15 group-hover:text-purple-400/50 group-hover:translate-x-1 transition-all duration-300 shrink-0 mt-0.5" />
                      </div>

                      {!project.hasCover && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/50">
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_GLOW[project.status] || "bg-zinc-500"}`} />
                              {statusLabel(project.status)}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground/40">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-[3px] progress-gradient" />
                        </div>
                      )}

                      {project.hasCover && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground/40">{pct}% complete</span>
                          </div>
                          <Progress value={pct} className="h-[3px] progress-gradient" />
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { v: formatNumber(project.wordCount), l: "WORDS" },
                          { v: formatScore(project.qualityScore), l: "QUAL", c: scoreColor(project.qualityScore) },
                          { v: project.chapterCount.toString(), l: "CH" },
                        ].map(({ v, l, c }) => (
                          <div key={l} className="bg-white/[0.03] border border-border/15 rounded-lg py-2 text-center">
                            <div className={`text-[11px] font-bold font-mono ${c || ""}`}>{v}</div>
                            <div className="text-[8px] font-mono text-muted-foreground/30 mt-0.5 tracking-widest">{l}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {project.wordCount > 0 && (
                          <Badge variant="outline" className="text-[9px] font-mono border-border/20 text-muted-foreground/50 bg-white/[0.02]" data-testid={`badge-readtime-${project.id}`}>
                            <Clock className="h-2.5 w-2.5 mr-1" />{formatReadTime(project.wordCount)} read
                          </Badge>
                        )}
                        {project.chaptersWithAudio > 0 && (
                          <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/30 text-cyan-400 bg-cyan-500/5">
                            <Music className="h-2.5 w-2.5 mr-1" />{project.chaptersWithAudio}/{project.completedChapters} with audio
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <Button
                  size="icon" variant="ghost"
                  className="absolute top-3 right-3 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-red-400"
                  onClick={(e) => { e.preventDefault(); setDeleteId(project.id); }}
                  data-testid={`button-delete-${project.id}`}
                  aria-label="Delete project"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="border-red-500/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="tracking-tight">Terminate Project</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/60">This permanently deletes the project, all chapters, marketing assets, and run logs.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/30">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Terminate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
