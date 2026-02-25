import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import { VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  vertical: z.enum(VERTICALS),
  targetLanguage: z.enum(LANGUAGES),
});

type FormData = z.infer<typeof schema>;

const verticalDescriptions: Record<string, string> = {
  money: "Personal finance, investing, wealth building, passive income",
  fitness: "Exercise, nutrition, body transformation, athletic performance",
  spirituality: "Mindfulness, meditation, life purpose, inner peace",
  career: "Leadership, productivity, entrepreneurship, professional growth",
  education: "Learning strategies, academic success, skill development",
  relationships: "Dating, marriage, family dynamics, social skills",
  health: "Chronic illness, natural remedies, mental wellness, longevity",
  mindset: "Psychology, habits, peak performance, resilience",
  parenting: "Child development, discipline, family balance, education",
  technology: "AI, software, digital transformation, future trends",
};

const verticalIcons: Record<string, string> = {
  money: "💰", fitness: "💪", spirituality: "🧘", career: "🚀",
  education: "📚", relationships: "❤️", health: "🏥", mindset: "🧠",
  parenting: "👨‍👩‍👧", technology: "⚡",
};

const languageLabels: Record<string, string> = {
  english: "English",
  spanish: "Spanish (Español)",
  portuguese: "Portuguese (Português)",
  french: "French (Français)",
  german: "German (Deutsch)",
};

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", vertical: "money", targetLanguage: "english" },
  });

  const selectedVertical = form.watch("vertical");

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/projects", { ...data, status: "draft" }),
    onSuccess: async (res) => {
      const project = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Project created!", description: `"${project.title}" is ready for the pipeline.` });
      setLocation(`/projects/${project.id}`);
    },
    onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">New Book Project</h1>
        </div>
        <p className="text-muted-foreground text-sm">Set up your book project and let AI handle the rest — from trend analysis to complete manuscript and marketing.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Book Details</CardTitle>
              <CardDescription>Define your book's core identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Book Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., The Millionaire Morning: 5 Habits That Changed Everything"
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Language</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-language">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LANGUAGES.map(l => (
                          <SelectItem key={l} value={l}>{languageLabels[l] || l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Market Vertical</CardTitle>
              <CardDescription>Select the niche that best fits your book — this shapes the AI's tone, frameworks, and marketing strategy</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="vertical"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {VERTICALS.map((v) => {
                          const isSelected = field.value === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => field.onChange(v)}
                              data-testid={`vertical-${v}`}
                              className={`flex items-start gap-2.5 p-3 rounded-md border text-left transition-all ${isSelected
                                ? `${VERTICAL_BG[v] || "bg-primary/10 border-primary"} ring-2 ring-primary ring-offset-1`
                                : "border-card-border bg-card hover-elevate"
                                }`}
                            >
                              <span className="text-xl leading-none mt-0.5">{verticalIcons[v] || "📖"}</span>
                              <div>
                                <div className={`text-xs font-semibold leading-tight ${isSelected ? VERTICAL_ACCENT[v] || "" : ""}`}>
                                  {VERTICAL_LABELS[v] || v}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                                  {verticalDescriptions[v] || ""}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 justify-end">
            <Link href="/projects">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-create">
              <Sparkles className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
