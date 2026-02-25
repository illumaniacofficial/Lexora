import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Sparkles, BookOpen, Check } from "lucide-react";
import { Link } from "wouter";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import { VERTICAL_LABELS, VERTICAL_BG, VERTICAL_ACCENT } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  authorName: z.string().min(1, "Author name is required").max(200),
  vertical: z.enum(VERTICALS),
  targetLanguage: z.enum(LANGUAGES),
});

type FormData = z.infer<typeof schema>;

const verticalDescriptions: Record<string, string> = {
  money: "Personal finance, investing, wealth building",
  fitness: "Exercise, nutrition, body transformation",
  spirituality: "Mindfulness, meditation, life purpose",
  career: "Leadership, productivity, entrepreneurship",
  education: "Learning strategies, skill development",
  relationships: "Dating, marriage, social skills",
  health: "Wellness, natural remedies, longevity",
  mindset: "Psychology, habits, peak performance",
  parenting: "Child development, family balance",
  technology: "AI, software, digital transformation",
};

const verticalIcons: Record<string, string> = {
  money: "\u{1F4B0}", fitness: "\u{1F4AA}", spirituality: "\u{1F9D8}", career: "\u{1F680}",
  education: "\u{1F4DA}", relationships: "\u2764\uFE0F", health: "\u{1F3E5}", mindset: "\u{1F9E0}",
  parenting: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", technology: "\u26A1",
};

const languageLabels: Record<string, string> = {
  english: "English",
  spanish: "Spanish (Espa\u00F1ol)",
  portuguese: "Portuguese (Portugu\u00EAs)",
  french: "French (Fran\u00E7ais)",
  german: "German (Deutsch)",
};

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", authorName: "Sergio A. Delgado", vertical: "money", targetLanguage: "english" },
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
    <div className="p-8 max-w-3xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3.5 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Book Project</h1>
            <p className="text-muted-foreground text-sm">Set up your book and let AI handle the rest</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Book Details</CardTitle>
              <CardDescription>Define your book's core identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Book Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., The Millionaire Morning: 5 Habits That Changed Everything"
                        className="h-11 bg-background border-border/60"
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="authorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Author Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Sergio A. Delgado"
                        className="h-11 bg-background border-border/60"
                        data-testid="input-author"
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
                    <FormLabel className="text-sm font-medium">Primary Language</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-language" className="h-11 bg-background border-border/60">
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

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Market Vertical</CardTitle>
              <CardDescription>Select the niche that shapes AI tone, frameworks, and marketing</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="vertical"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {VERTICALS.map((v) => {
                          const isSelected = field.value === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => field.onChange(v)}
                              data-testid={`vertical-${v}`}
                              className={`relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${isSelected
                                ? `${VERTICAL_BG[v] || "bg-primary/10 border-primary"} ring-2 ring-primary/60 ring-offset-2 ring-offset-background shadow-sm`
                                : "border-border/50 bg-card hover:border-border hover:shadow-sm"
                                }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              )}
                              <span className="text-xl leading-none mt-0.5">{verticalIcons[v] || "\u{1F4D6}"}</span>
                              <div>
                                <div className={`text-xs font-bold leading-tight ${isSelected ? VERTICAL_ACCENT[v] || "" : ""}`}>
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

          <div className="flex items-center gap-3 justify-end pt-2">
            <Link href="/projects">
              <Button variant="outline" type="button" className="border-border/60">Cancel</Button>
            </Link>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-create" className="shadow-sm">
              <Sparkles className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
