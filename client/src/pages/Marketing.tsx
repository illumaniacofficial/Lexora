import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, BookOpen, ArrowRight, Mail, Calendar, Target, DollarSign } from "lucide-react";
import { VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import type { Project } from "@shared/schema";

const featureCards = [
  { icon: Target, label: "Hook Generator", desc: "30 social media hooks per book", gradient: "from-purple-500 to-violet-600" },
  { icon: Mail, label: "Email Sequences", desc: "5-part launch email campaigns", gradient: "from-blue-500 to-cyan-500" },
  { icon: Calendar, label: "Social Calendar", desc: "30-day content schedules", gradient: "from-emerald-500 to-green-600" },
  { icon: DollarSign, label: "Pricing Matrix", desc: "Optimized across all formats", gradient: "from-amber-500 to-orange-500" },
];

const verticalIcons: Record<string, string> = {
  money: "\u{1F4B0}", fitness: "\u{1F4AA}", spirituality: "\u{1F9D8}", career: "\u{1F680}",
  education: "\u{1F4DA}", relationships: "\u2764\uFE0F", health: "\u{1F3E5}", mindset: "\u{1F9E0}",
  parenting: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", technology: "\u26A1",
};

export default function Marketing() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const projectsWithMarketing = projects.filter(p => p.status === "marketing" || p.status === "complete");

  return (
    <div className="p-8 space-y-7 overflow-y-auto h-full">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-md">
          <Megaphone className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing Suite</h1>
          <p className="text-muted-foreground text-sm">Complete marketing assets for your published books</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {featureCards.map(({ icon: Icon, label, desc, gradient }) => (
          <Card key={label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group">
            <CardContent className="pt-5 pb-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm mb-3`}>
                <Icon className="h-4.5 w-4.5 text-white" />
              </div>
              <p className="text-sm font-bold tracking-tight">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : projectsWithMarketing.length === 0 ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 flex items-center justify-center mb-5">
              <Megaphone className="h-7 w-7 text-pink-500" />
            </div>
            <p className="font-semibold text-lg">No marketing assets yet</p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
              Complete the writing pipeline on a project to generate its full marketing suite
            </p>
            <Link href="/projects/new">
              <Button className="mt-5 shadow-sm">
                <BookOpen className="h-4 w-4 mr-2" /> Start a New Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="font-bold text-lg tracking-tight">Projects with Marketing Assets ({projectsWithMarketing.length})</h2>
          {projectsWithMarketing.map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="cursor-pointer border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group" data-testid={`marketing-project-${project.id}`}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3.5">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                      {verticalIcons[project.vertical] || "\u26A1"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{project.title}</h3>
                        <Badge variant={project.status === "complete" ? "default" : "secondary"} className="text-[11px]">
                          {project.status === "complete" ? "Complete" : "Marketing"}
                        </Badge>
                      </div>
                      <p className={`text-[11px] mt-0.5 font-medium ${VERTICAL_ACCENT[project.vertical] || "text-muted-foreground"}`}>
                        {VERTICAL_LABELS[project.vertical] || project.vertical}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1.5"><Target className="h-3 w-3 text-purple-500" /> Hooks</span>
                        <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-blue-500" /> Emails</span>
                        <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-emerald-500" /> Social</span>
                        <span className="flex items-center gap-1.5"><DollarSign className="h-3 w-3 text-amber-500" /> Pricing</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0 mt-1" />
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
