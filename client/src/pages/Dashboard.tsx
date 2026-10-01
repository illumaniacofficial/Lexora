import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Activity, AlertCircle, ArrowRight, BarChart3, BookOpen, Eye, FileText,
  Lightbulb, Plus, Sparkles, Trash2, TrendingUp, Zap,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatNumber, formatCost, formatScore, VERTICAL_LABELS, VERTICAL_ICONS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, TrendReport, BookRequest } from "@shared/schema";
import { LexoraPageHeader } from "@/components/experience/lexora-page-header";
import { EditorialSection } from "@/components/experience/editorial-section";
import { CreativeMetric } from "@/components/experience/creative-metric";
import { EmptyCreativeState } from "@/components/experience/empty-creative-state";
import { ProjectCoverCard } from "@/components/experience/project-cover-card";

interface DashboardProject extends Project {
  totalChapters: number;
  completedChapters: number;
  hasTrend: boolean;
  hasCover: boolean;
  hasMarketing: boolean;
}

interface DashboardData {
  stats: {
    totalProjects: number;
    completedProjects: number;
    activeProjects: number;
    totalWords: number;
    totalCost: number;
    costThisMonth: number;
    avgQuality: number;
  };
  recentProjects: DashboardProject[];
  recentTrends: TrendReport[];
}

function getLivePct(project: DashboardProject): number {
  let done = 0;
  let total = 0;
  total += 1; if (project.hasTrend) done += 1;
  total += 1; if (project.totalChapters > 0) done += 1;
  total += 1; if (project.hasCover) done += 1;
  if (project.totalChapters > 0) {
    total += project.totalChapters;
    done += project.completedChapters;
  } else {
    total += 1;
  }
  total += 1; if (project.hasMarketing) done += 1;
  return Math.round((done / total) * 100);
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });
  const { data: bookRequests = [] } = useQuery<BookRequest[]>({ queryKey: ["/api/book-requests"] });

  const markRead = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PATCH", `/api/book-requests/${id}/read`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/book-requests"] }),
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/book-requests/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/book-requests"] }),
  });

  if (isLoading) {
    return (
      <div className="lexora-page p-4 md:p-8">
        <div className="mx-auto max-w-[1480px] space-y-8">
          <Skeleton className="h-24 w-full max-w-2xl rounded-2xl bg-white/[.04]" />
          <Skeleton className="h-[360px] rounded-[28px] bg-white/[.035]" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl bg-white/[.03]" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lexora-page flex h-full items-center justify-center p-8 text-center" data-testid="error-state">
        <div>
          <AlertCircle className="mx-auto mb-4 h-9 w-9 text-[#A55B70]/70" />
          <p className="lexora-display text-xl font-semibold text-[#EFE5D9]">The studio could not load.</p>
          <p className="mt-2 text-sm text-[#BCAF9F]/50">Refresh the page to reconnect to your workspace.</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? {
    totalProjects: 0,
    completedProjects: 0,
    activeProjects: 0,
    totalWords: 0,
    totalCost: 0,
    costThisMonth: 0,
    avgQuality: 0,
  };
  const recentProjects = data?.recentProjects ?? [];
  const recentTrends = data?.recentTrends ?? [];
  const featuredProject = recentProjects[0] ?? null;
  const unreadCount = bookRequests.filter((request) => !request.isRead).length;

  return (
    <div className="lexora-page">
      <Helmet>
        <title>Home — Lexora</title>
        <meta name="description" content="Your Lexora creative command center for stories, manuscripts, narration, and publishing." />
      </Helmet>

      <div className="mx-auto max-w-[1480px] space-y-10 px-4 py-6 md:px-8 md:py-9">
        <LexoraPageHeader
          kicker="Creative Command Center"
          title={<>Good evening. <span className="text-[#BCAF9F]/55">What world are we building tonight?</span></>}
          description="Return to the work that matters, explore recent worlds, and keep the machinery of publishing in the background."
          actions={
            <Link href="/projects/new">
              <Button data-testid="button-new-project" className="h-10 rounded-full border border-[#C0A06B]/20 bg-[#7E3E51] px-5 text-[#FFF9F2] hover:bg-[#915065]">
                <Plus className="mr-2 h-4 w-4" /> New project
              </Button>
            </Link>
          }
        />

        <div className="lexora-divider" />

        <EditorialSection
          eyebrow="Continue Creating"
          title={featuredProject ? "Return to your current world" : "Begin your first world"}
        >
          {featuredProject ? (
            <div className="lexora-editorial-surface relative overflow-hidden rounded-[30px]">
              <div className="grid min-h-[340px] md:grid-cols-[minmax(0,1.4fr)_minmax(260px,.6fr)]">
                <div className="relative z-10 flex flex-col justify-end p-6 md:p-9 lg:p-11">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(192,160,107,.08),transparent_28rem)]" />
                  <div className="relative">
                    <div className="mb-6 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#C0A06B]/15 bg-[#C0A06B]/[.04] font-mono text-[9px] uppercase tracking-[.15em] text-[#C0A06B]/70">
                        {VERTICAL_LABELS[featuredProject.vertical] || featuredProject.vertical}
                      </Badge>
                      <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#BCAF9F]/35">{featuredProject.status}</span>
                    </div>
                    <h2 className="lexora-display max-w-3xl text-4xl font-semibold leading-[.98] text-[#EFE5D9] md:text-5xl lg:text-6xl">
                      {featuredProject.title}
                    </h2>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-[#BCAF9F]/55">
                      {featuredProject.completedChapters} of {featuredProject.totalChapters || "—"} chapters complete · {getLivePct(featuredProject)}% through the current creative pipeline.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-2">
                      <Link href={`/projects/${featuredProject.id}`}>
                        <Button className="h-10 rounded-full bg-[#EFE5D9] px-5 text-[#0B090C] hover:bg-white">
                          Continue Writing <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/projects/${featuredProject.id}`}>
                        <Button variant="outline" className="h-10 rounded-full border-[#C0A06B]/15 bg-transparent px-5 text-[#BCAF9F]/75 hover:bg-white/[.03] hover:text-[#EFE5D9]">
                          Open project
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="relative min-h-[260px] overflow-hidden border-t border-[#C0A06B]/10 md:border-l md:border-t-0">
                  {featuredProject.hasCover ? (
                    <>
                      <img
                        src={`/api/projects/${featuredProject.id}/cover-image`}
                        alt={`Cover for ${featuredProject.title}`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0B090C]/15 to-[#0B090C]/65 md:bg-gradient-to-r" />
                    </>
                  ) : (
                    <div className="lexora-cover-placeholder absolute inset-0 flex items-center justify-center">
                      <BookOpen className="relative z-10 h-12 w-12 text-[#C0A06B]/45" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyCreativeState
              title="Your first world is waiting."
              description="Start a project and Lexora will turn this space into your creative launch point."
              action={
                <Link href="/projects/new">
                  <Button className="rounded-full bg-[#7E3E51] text-[#FFF9F2] hover:bg-[#915065]">
                    <Plus className="mr-2 h-4 w-4" /> Create project
                  </Button>
                </Link>
              }
            />
          )}
        </EditorialSection>

        <EditorialSection
          eyebrow="Recent Worlds"
          title="The stories closest to your hands"
          action={
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-[#BCAF9F]/55 hover:text-[#EFE5D9]" data-testid="button-view-all-projects">
                View all <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        >
          {recentProjects.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {recentProjects.slice(0, 6).map((project) => (
                <ProjectCoverCard
                  key={project.id}
                  id={project.id}
                  title={project.title}
                  href={`/projects/${project.id}`}
                  coverUrl={project.hasCover ? `/api/projects/${project.id}/cover-image` : null}
                  status={project.status}
                  genre={VERTICAL_LABELS[project.vertical] || project.vertical}
                  progress={getLivePct(project)}
                  meta={project.totalChapters > 0 ? `${project.completedChapters}/${project.totalChapters} chapters` : "Developing"}
                />
              ))}
            </div>
          ) : (
            <EmptyCreativeState
              title="No recent worlds yet."
              description="Projects you begin will collect here as a visual shelf of the stories you are building."
              action={<Link href="/projects/new"><Button variant="outline">Start a project</Button></Link>}
            />
          )}
        </EditorialSection>

        <EditorialSection eyebrow="Creative Pulse" title="A quiet read on your studio">
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 border-y border-[#C0A06B]/10 py-6 md:grid-cols-4">
            <CreativeMetric icon={Activity} label="Active worlds" value={stats.activeProjects} detail={`${stats.totalProjects} total projects`} />
            <CreativeMetric icon={FileText} label="Words written" value={formatNumber(stats.totalWords)} detail="Across the full library" />
            <CreativeMetric icon={BookOpen} label="Completed" value={stats.completedProjects} detail="Ready or published" />
            <CreativeMetric icon={Sparkles} label="Studio spend" value={formatCost(stats.costThisMonth)} detail={`${formatCost(stats.totalCost)} all time`} />
          </div>
        </EditorialSection>

        <div className="grid gap-8 xl:grid-cols-[1.25fr_.75fr]">
          <EditorialSection
            eyebrow="Signals"
            title="Trend intelligence"
            action={<Link href="/trends"><Button variant="ghost" size="sm" className="text-[#BCAF9F]/50 hover:text-[#EFE5D9]">Explore trends</Button></Link>}
          >
            <div className="divide-y divide-[#C0A06B]/10 border-y border-[#C0A06B]/10">
              {recentTrends.length === 0 ? (
                <div className="py-10 text-sm text-[#BCAF9F]/45">No trend reports yet. Run an analysis when you want market context.</div>
              ) : recentTrends.slice(0, 4).map((report) => (
                <div key={report.id} className="grid gap-2 py-4 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-start">
                  <div className="font-mono text-[10px] uppercase tracking-[.12em] text-[#C0A06B]/55">
                    {VERTICAL_LABELS[report.vertical] || report.vertical}
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-[#BCAF9F]/60">{report.summary || "Trend analysis available."}</p>
                  {report.greenlightScore ? <span className="font-mono text-[10px] text-[#EFE5D9]/60">GL {formatScore(report.greenlightScore)}</span> : null}
                </div>
              ))}
            </div>
          </EditorialSection>

          <EditorialSection eyebrow="Studio Actions" title="Move the work forward">
            <div className="lexora-editorial-surface rounded-[24px] p-3">
              <Link href="/concept-lab">
                <Button variant="ghost" className="h-12 w-full justify-between rounded-xl px-4 text-[#EFE5D9] hover:bg-white/[.03]">
                  <span className="flex items-center gap-3"><Lightbulb className="h-4 w-4 text-[#C0A06B]/70" /> Develop a concept</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#BCAF9F]/30" />
                </Button>
              </Link>
              <Link href="/trends">
                <Button variant="ghost" data-testid="button-run-trend-analysis" className="h-12 w-full justify-between rounded-xl px-4 text-[#EFE5D9] hover:bg-white/[.03]">
                  <span className="flex items-center gap-3"><BarChart3 className="h-4 w-4 text-[#C0A06B]/70" /> Run trend analysis</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#BCAF9F]/30" />
                </Button>
              </Link>
              <Link href="/autopilot">
                <Button variant="ghost" data-testid="button-configure-autopilot" className="h-12 w-full justify-between rounded-xl px-4 text-[#EFE5D9] hover:bg-white/[.03]">
                  <span className="flex items-center gap-3"><Zap className="h-4 w-4 text-[#C0A06B]/70" /> Configure Autopilot</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#BCAF9F]/30" />
                </Button>
              </Link>
            </div>
          </EditorialSection>
        </div>

        {bookRequests.length > 0 ? (
          <EditorialSection
            eyebrow="Reader Requests"
            title="What readers are asking for"
            action={unreadCount > 0 ? <Badge variant="outline" className="border-[#C0A06B]/15 text-[#C0A06B]/70">{unreadCount} new</Badge> : undefined}
          >
            <div className="divide-y divide-[#C0A06B]/10 border-y border-[#C0A06B]/10">
              {bookRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]" data-testid={`book-request-${request.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#EFE5D9]">
                      <span className="mr-2">{VERTICAL_ICONS[request.genre] || "📖"}</span>
                      {VERTICAL_LABELS[request.genre] || request.genre}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#BCAF9F]/55">{request.description}</p>
                    <p className="mt-1 font-mono text-[9px] text-[#BCAF9F]/30">by {request.readerName} · {new Date(request.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!request.isRead ? (
                      <Button size="icon" variant="ghost" onClick={() => markRead.mutate(request.id)} className="h-8 w-8 text-[#C0A06B]/60" data-testid={`button-mark-read-${request.id}`} aria-label="Mark as read">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button size="icon" variant="ghost" onClick={() => deleteRequest.mutate(request.id)} className="h-8 w-8 text-[#BCAF9F]/30 hover:text-red-400" data-testid={`button-delete-request-${request.id}`} aria-label="Delete request">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </EditorialSection>
        ) : null}

        <div className="pb-8" />
      </div>
    </div>
  );
}
