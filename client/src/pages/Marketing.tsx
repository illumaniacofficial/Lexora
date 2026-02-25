import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, BookOpen, ChevronRight, Mail, Calendar, Target, DollarSign } from "lucide-react";
import { VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import type { Project, MarketingAsset } from "@shared/schema";

interface ProjectWithMarketing extends Project {
  hasMarketing: boolean;
}

export default function Marketing() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const projectsWithMarketing = projects.filter(p => p.status === "marketing" || p.status === "complete");

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-pink-100 dark:bg-pink-900/30">
          <Megaphone className="h-5 w-5 text-pink-600 dark:text-pink-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Marketing Suite</h1>
          <p className="text-muted-foreground text-sm">Complete marketing assets for your published books</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Target, label: "Hook Generator", desc: "30 social media hooks per book", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
          { icon: Mail, label: "Email Sequences", desc: "5-part launch email campaigns", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
          { icon: Calendar, label: "Social Calendar", desc: "30-day content schedules", color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
          { icon: DollarSign, label: "Pricing Matrix", desc: "Optimized across all formats", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
        ].map(({ icon: Icon, label, desc, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${color} mb-3`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : projectsWithMarketing.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-lg">No marketing assets yet</p>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
              Complete the writing pipeline on a project to generate its full marketing suite
            </p>
            <Link href="/projects/new">
              <Button className="mt-5">
                <BookOpen className="h-4 w-4 mr-2" /> Start a New Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold">Projects with Marketing Assets ({projectsWithMarketing.length})</h2>
          {projectsWithMarketing.map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="cursor-pointer hover-elevate" data-testid={`marketing-project-${project.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-lg ${VERTICAL_BG[project.vertical] || "bg-muted"}`}>
                      {project.vertical === "money" ? "💰" : project.vertical === "fitness" ? "💪" : project.vertical === "spirituality" ? "🧘" : project.vertical === "career" ? "🚀" : project.vertical === "education" ? "📚" : project.vertical === "relationships" ? "❤️" : project.vertical === "health" ? "🏥" : project.vertical === "mindset" ? "🧠" : project.vertical === "parenting" ? "👨‍👩‍👧" : "⚡"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{project.title}</h3>
                        <Badge variant={project.status === "complete" ? "default" : "secondary"} className="text-xs">
                          {project.status === "complete" ? "Complete" : "Marketing"}
                        </Badge>
                      </div>
                      <p className={`text-xs mt-0.5 ${VERTICAL_ACCENT[project.vertical] || "text-muted-foreground"}`}>
                        {VERTICAL_LABELS[project.vertical] || project.vertical}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Hooks</span>
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email Sequence</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Social Calendar</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Pricing</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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
