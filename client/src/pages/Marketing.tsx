import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, BookOpen, ArrowRight, Mail, Calendar, Target, DollarSign, Hexagon, AlertCircle, ChevronDown, ChevronUp, Clock, CheckCircle, PenTool } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { VERTICAL_LABELS, VERTICAL_ICONS, sanitizeHtml } from "@/lib/utils";
import type { Project, MarketingAsset } from "@shared/schema";

const featureCards = [
  { icon: Target, label: "Hook Generator", desc: "30 social media hooks", glow: "neon-glow" },
  { icon: Mail, label: "Email Sequences", desc: "5-part launch campaigns", glow: "neon-glow-cool" },
  { icon: Calendar, label: "Social Calendar", desc: "30-day content schedules", glow: "neon-glow-nature" },
  { icon: DollarSign, label: "Pricing Matrix", desc: "Optimized formats", glow: "neon-glow-fire" },
];

interface ProjectWithMarketing {
  project: Project;
  marketing: MarketingAsset | null;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    complete: "text-emerald-400 border-emerald-500/20",
    marketing: "text-pink-400 border-pink-500/20",
    writing: "text-blue-400 border-blue-500/20",
    outlining: "text-cyan-400 border-cyan-500/20",
    trend_analysis: "text-amber-400 border-amber-500/20",
    draft: "text-muted-foreground/50 border-border/30",
    paused: "text-orange-400 border-orange-500/20",
    editing: "text-violet-400 border-violet-500/20",
  };
  return styles[status] || "text-muted-foreground/50 border-border/30";
}

function statusIcon(status: string) {
  if (status === "complete") return <CheckCircle className="h-3 w-3 text-emerald-400" />;
  if (status === "marketing") return <Megaphone className="h-3 w-3 text-pink-400" />;
  if (status === "writing") return <PenTool className="h-3 w-3 text-blue-400" />;
  return <Clock className="h-3 w-3 text-muted-foreground/40" />;
}

function MarketingProjectCard({ project, marketing }: ProjectWithMarketing) {
  const [expanded, setExpanded] = useState(false);
  const createdDate = new Date(project.createdAt);
  const updatedDate = new Date(project.updatedAt);

  return (
    <Card className="border-border/20 bg-card/30 hover:border-pink-500/15 transition-all duration-300 overflow-hidden" data-testid={`marketing-project-${project.id}`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glow-border-pink bg-card/50 text-lg">
            {VERTICAL_ICONS[project.vertical] || "📖"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Link href={`/projects/${project.id}`}>
                <h3 className="font-bold text-sm tracking-tight hover:text-pink-300 transition-colors cursor-pointer">{project.title}</h3>
              </Link>
              <Badge variant="outline" className={`text-[10px] font-mono border-border/30 ${statusBadge(project.status)}`}>
                {project.status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-muted-foreground/40">
              <span className="uppercase tracking-wider">{VERTICAL_LABELS[project.vertical] || project.vertical}</span>
              <span>·</span>
              <span>{createdDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              {project.wordCount > 0 && (
                <>
                  <span>·</span>
                  <span>{project.wordCount.toLocaleString()} words</span>
                </>
              )}
            </div>

            {marketing ? (
              <>
                <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-muted-foreground/30 flex-wrap">
                  {marketing.hooks && marketing.hooks.length > 0 && <span className="flex items-center gap-1"><Target className="h-3 w-3 text-purple-400/40" /> {marketing.hooks.length} Hooks</span>}
                  {!!marketing.emailSequence && <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-cyan-400/40" /> Email Seq</span>}
                  {!!marketing.socialCalendar && <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-emerald-400/40" /> Social Cal</span>}
                  {!!marketing.pricingMatrix && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-amber-400/40" /> Pricing</span>}
                </div>

                {marketing.shortBlurb && (
                  <p className="text-[11px] text-muted-foreground/60 leading-relaxed mt-3 line-clamp-2">{marketing.shortBlurb}</p>
                )}

                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-[10px] font-mono text-purple-400/60 hover:text-purple-300 transition-colors mt-2"
                  data-testid={`toggle-marketing-${project.id}`}
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? "COLLAPSE" : "SHOW DETAILS"}
                </button>

                {expanded && (
                  <div className="mt-4 space-y-3 border-t border-border/10 pt-4">
                    {marketing.mediumBlurb && (
                      <div>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-pink-400/50 mb-1.5">Medium Blurb</p>
                        <p className="text-[12px] text-muted-foreground/70 leading-relaxed">{marketing.mediumBlurb}</p>
                      </div>
                    )}
                    {marketing.amazonDescription && (
                      <div>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-1.5">Amazon Description</p>
                        <div className="text-[12px] text-muted-foreground/70 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(marketing.amazonDescription) }} />
                      </div>
                    )}
                    {marketing.hooks && marketing.hooks.length > 0 && (
                      <div>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Social Hooks</p>
                        <div className="space-y-1">
                          {marketing.hooks.map((h, i) => (
                            <div key={i} className="text-[11px] bg-white/[0.02] border border-border/10 rounded-lg px-3 py-2">
                              <span className="text-[9px] font-mono text-purple-400/50 font-bold mr-2">#{i + 1}</span>
                              <span className="text-muted-foreground/60">{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(marketing.emailSequence) && (
                      <div>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Email Sequence</p>
                        <div className="space-y-1">
                          {(marketing.emailSequence as Array<{ subject?: string; preview?: string; day?: number }>).map((email, i) => (
                            <div key={i} className="text-[11px] bg-white/[0.02] border border-border/10 rounded-lg px-3 py-2">
                              <span className="text-[9px] font-mono text-cyan-400/50 font-bold mr-2">Day {email.day || i + 1}</span>
                              <span className="font-bold text-muted-foreground/70">{email.subject}</span>
                              {email.preview && <p className="text-[10px] text-muted-foreground/40 mt-0.5">{email.preview}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!!marketing.pricingMatrix && (
                      <div>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">Pricing Matrix</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(marketing.pricingMatrix as Record<string, any>).map(([format, price]) => (
                            <div key={format} className="bg-white/[0.02] border border-border/10 rounded-lg p-2.5 text-center">
                              <div className="text-[12px] font-bold font-mono text-purple-300">{typeof price === "object" ? JSON.stringify(price) : price}</div>
                              <div className="text-[8px] font-mono text-muted-foreground/30 capitalize mt-0.5 tracking-widest">{format}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2">
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="outline" className="text-[10px] font-mono h-8 border-pink-500/20 text-pink-400 hover:bg-pink-500/10" data-testid={`link-project-${project.id}`}>
                          View Full Project <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-muted-foreground/30 flex-wrap">
                {project.status === "complete" || project.status === "marketing" ? (
                  <>
                    <span className="text-amber-400/60">Marketing data not yet generated</span>
                    <Link href={`/projects/${project.id}`}>
                      <span className="text-purple-400/60 hover:text-purple-300 transition-colors cursor-pointer underline underline-offset-2">Generate →</span>
                    </Link>
                  </>
                ) : (
                  <span className="text-muted-foreground/40 flex items-center gap-1.5">
                    {statusIcon(project.status)} Pipeline in progress — {project.status.replace("_", " ")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Marketing() {
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const sortedProjects = [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const projectsWithMarketingStatus = sortedProjects.filter(p => p.status === "marketing" || p.status === "complete");
  const projectsInProgress = sortedProjects.filter(p => p.status !== "marketing" && p.status !== "complete");

  const marketingQueries = projectsWithMarketingStatus.map(p => p.id);
  const { data: projectDetails = [], isLoading: detailsLoading } = useQuery<ProjectWithMarketing[]>({
    queryKey: ["/api/marketing-details", marketingQueries],
    queryFn: async () => {
      const results = await Promise.all(
        projectsWithMarketingStatus.map(async (p) => {
          try {
            const res = await fetch(`/api/projects/${p.id}`);
            if (!res.ok) return { project: p, marketing: null };
            const data = await res.json();
            return { project: p, marketing: data.marketing || null };
          } catch {
            return { project: p, marketing: null };
          }
        })
      );
      return results;
    },
    enabled: projectsWithMarketingStatus.length > 0,
  });

  const isLoading = projectsLoading || detailsLoading;

  if (projectsError) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load marketing data</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-7 overflow-y-auto h-full">
      <Helmet>
        <title>Marketing Suite — Lexora</title>
        <meta name="description" content="Complete marketing assets for your books — social hooks, email sequences, pricing matrices, and ad copy." />
      </Helmet>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-pink-500/50" />
          <span className="text-[9px] font-mono font-bold text-pink-400/60 tracking-[0.2em] uppercase">MARKETING</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">Marketing <span className="shimmer-text">Suite</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1 hidden sm:block">Complete marketing assets and book creation log</p>
      </div>

      <div className="line-glow" />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        {featureCards.map(({ icon: Icon, label, desc, glow }) => (
          <Card key={label} className="border-border/20 bg-card/30 hover:border-purple-500/15 transition-all duration-300 overflow-hidden group">
            <CardContent className="pt-5 pb-5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${glow} shadow-lg mb-3`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <p className="text-[12px] font-bold tracking-tight">{label}</p>
              <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl bg-muted/20" />)}
        </div>
      ) : sortedProjects.length === 0 ? (
        <Card className="border-border/20 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 neon-glow-warm opacity-20 blur-2xl rounded-full" />
              <Megaphone className="h-12 w-12 text-pink-500/30 relative" />
            </div>
            <p className="font-bold text-lg mt-5 tracking-tight">No books yet</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1 text-center max-w-sm">Create your first project to start building marketing assets</p>
            <Link href="/projects/new">
              <Button className="mt-5 neon-glow-warm text-white border-0 font-mono text-[12px]" data-testid="button-start-project">
                <BookOpen className="h-4 w-4 mr-2" /> START PROJECT
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {projectsWithMarketingStatus.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm tracking-tight font-mono text-muted-foreground/60">
                  Books with Marketing ({projectsWithMarketingStatus.length})
                </h2>
                <Badge variant="outline" className="text-[9px] font-mono text-emerald-400/60 border-emerald-500/15">
                  <CheckCircle className="h-2.5 w-2.5 mr-1" /> STRATEGIES GENERATED
                </Badge>
              </div>
              {projectDetails.length > 0 ? (
                projectDetails.map(({ project, marketing }) => (
                  <MarketingProjectCard key={project.id} project={project} marketing={marketing} />
                ))
              ) : (
                projectsWithMarketingStatus.map(project => (
                  <MarketingProjectCard key={project.id} project={project} marketing={null} />
                ))
              )}
            </div>
          )}

          {projectsInProgress.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm tracking-tight font-mono text-muted-foreground/60">
                  In Pipeline ({projectsInProgress.length})
                </h2>
                <Badge variant="outline" className="text-[9px] font-mono text-amber-400/60 border-amber-500/15">
                  <Clock className="h-2.5 w-2.5 mr-1" /> IN PROGRESS
                </Badge>
              </div>
              {projectsInProgress.map(project => (
                <MarketingProjectCard key={project.id} project={project} marketing={null} />
              ))}
            </div>
          )}

          <div className="border-t border-border/10 pt-4">
            <p className="text-[10px] font-mono text-muted-foreground/30 text-center">
              {sortedProjects.length} total books · {projectsWithMarketingStatus.length} with marketing · {projectsInProgress.length} in pipeline
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
