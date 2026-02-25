import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, BookOpen, ArrowRight, Mail, Calendar, Target, DollarSign, Hexagon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { AlertCircle } from "lucide-react";
import { VERTICAL_LABELS, VERTICAL_ICONS } from "@/lib/utils";
import type { Project } from "@shared/schema";

const featureCards = [
  { icon: Target, label: "Hook Generator", desc: "30 social media hooks", glow: "neon-glow" },
  { icon: Mail, label: "Email Sequences", desc: "5-part launch campaigns", glow: "neon-glow-cool" },
  { icon: Calendar, label: "Social Calendar", desc: "30-day content schedules", glow: "neon-glow-nature" },
  { icon: DollarSign, label: "Pricing Matrix", desc: "Optimized formats", glow: "neon-glow-fire" },
];

export default function Marketing() {
  const { data: projects = [], isLoading, error } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const projectsWithMarketing = projects.filter(p => p.status === "marketing" || p.status === "complete");

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load marketing data</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-7 overflow-y-auto h-full">
      <Helmet><title>Marketing Suite — BookForge Studio</title></Helmet>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-pink-500/50" />
          <span className="text-[9px] font-mono font-bold text-pink-400/60 tracking-[0.2em] uppercase">MARKETING</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tighter">Marketing <span className="shimmer-text">Suite</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Complete marketing assets for your books</p>
      </div>

      <div className="line-glow" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
      ) : projectsWithMarketing.length === 0 ? (
        <Card className="border-border/20 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 neon-glow-warm opacity-20 blur-2xl rounded-full" />
              <Megaphone className="h-12 w-12 text-pink-500/30 relative" />
            </div>
            <p className="font-bold text-lg mt-5 tracking-tight">No marketing assets yet</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1 text-center max-w-sm">Complete the writing pipeline to generate marketing</p>
            <Link href="/projects/new">
              <Button className="mt-5 neon-glow-warm text-white border-0 font-mono text-[12px]">
                <BookOpen className="h-4 w-4 mr-2" /> START PROJECT
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="font-bold text-sm tracking-tight font-mono text-muted-foreground/60">With Marketing ({projectsWithMarketing.length})</h2>
          {projectsWithMarketing.map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="cursor-pointer border-border/20 bg-card/30 hover:border-pink-500/15 transition-all duration-300 group" data-testid={`marketing-project-${project.id}`}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glow-border-pink bg-card/50 text-lg">
                      {VERTICAL_ICONS[project.vertical] || "\u{1F4D6}"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-bold text-sm tracking-tight group-hover:text-pink-300 transition-colors">{project.title}</h3>
                        <Badge variant="outline" className={`text-[10px] font-mono border-border/30 ${project.status === "complete" ? "text-emerald-400" : "text-pink-400"}`}>
                          {project.status === "complete" ? "COMPLETE" : "MARKETING"}
                        </Badge>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5 uppercase tracking-wider">{VERTICAL_LABELS[project.vertical] || project.vertical}</p>
                      <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-muted-foreground/30 flex-wrap">
                        <span className="flex items-center gap-1"><Target className="h-3 w-3 text-purple-400/40" /> Hooks</span>
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-cyan-400/40" /> Emails</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-emerald-400/40" /> Social</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-amber-400/40" /> Pricing</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/15 group-hover:text-pink-400/50 transition-colors shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
