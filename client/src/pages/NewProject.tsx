import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, BookOpen, Check, Hexagon, Wand2, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import { VERTICAL_LABELS, VERTICAL_ICONS, LANGUAGE_LABELS, GENRE_GROUPS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  authorName: z.string().min(1, "Author name is required").max(200),
  description: z.string().max(2000).optional(),
  vertical: z.enum(VERTICALS),
  targetLanguage: z.enum(LANGUAGES),
});

type FormData = z.infer<typeof schema>;

const QUICK_START_TEMPLATES: { id: string; label: string; vertical: FormData["vertical"]; title: string; description: string }[] = [
  {
    id: "wealth",
    label: "Wealth & Money",
    vertical: "money",
    title: "The Wealth Blueprint: Building Lasting Financial Freedom",
    description: "A practical, step-by-step guide to building wealth from scratch — covering budgeting, investing, passive income, and a millionaire mindset for everyday readers.",
  },
  {
    id: "self-help",
    label: "Mindset & Self-Help",
    vertical: "mindset",
    title: "Unbreakable: Master Your Mind and Transform Your Life",
    description: "An actionable self-help book on building mental resilience, daily habits, and unstoppable confidence, with exercises and real-world frameworks.",
  },
  {
    id: "fantasy",
    label: "Epic Fantasy",
    vertical: "fantasy",
    title: "The Ember Crown: A Tale of Magic and Betrayal",
    description: "An epic fantasy novel following a reluctant hero who discovers ancient magic, navigates court intrigue, and must unite warring kingdoms against a rising darkness.",
  },
  {
    id: "thriller",
    label: "Mystery Thriller",
    vertical: "thriller",
    title: "The Silent Witness: A Gripping Psychological Thriller",
    description: "A fast-paced psychological thriller about a detective unraveling a series of impossible crimes, full of twists, red herrings, and a shocking final reveal.",
  },
  {
    id: "romance",
    label: "Contemporary Romance",
    vertical: "romance",
    title: "Second Chances in Summer Bay",
    description: "A heartwarming contemporary romance about two former sweethearts reunited in a coastal town, navigating old wounds, family ties, and the pull of true love.",
  },
];



export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", authorName: "Sergio A. Delgado", description: "", vertical: "money", targetLanguage: "english" },
  });

  const currentTitle = form.watch("title");

  useEffect(() => {
    if (currentTitle.length < 5) {
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setSuggestionsLoading(true);
      try {
        const res = await fetch("/api/projects/suggest-titles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: currentTitle }),
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [currentTitle]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/projects", { ...data, status: "draft" }),
    onSuccess: async (res) => {
      const project = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Project initialized", description: `"${project.title}" is ready.` });
      setLocation(`/projects/${project.id}`);
    },
    onError: () => toast({ title: "Initialization failed", variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto overflow-y-auto h-full">
      <Helmet>
        <title>New Manuscript — Lexora</title>
        <meta name="description" content="Initialize a new book manuscript — set your title, author, vertical, and language to start the AI publishing pipeline." />
      </Helmet>
      <div className="flex items-center gap-3 mb-5 md:mb-8">
        <Link href="/projects">
          <Button variant="ghost" size="sm" data-testid="button-back" className="text-muted-foreground/60 hover:text-purple-400 font-mono text-[11px]">
            <ArrowLeft className="h-4 w-4 mr-1" /> BACK
          </Button>
        </Link>
      </div>

      <div className="mb-5 md:mb-8">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <Hexagon className="h-3 w-3 text-purple-500/50" />
          <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.2em] uppercase">INITIALIZE</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">New <span className="shimmer-text">Manuscript</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Configure your book and let AI generate the rest</p>
      </div>

      <div className="line-glow mb-5 md:mb-8" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          <Card className="border-purple-500/20 bg-card/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400/70" /> Quick-Start Templates
              </CardTitle>
              <CardDescription className="text-[11px] font-mono text-muted-foreground/40">Pre-fill the form with a proven genre starting point</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {QUICK_START_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      form.setValue("title", tpl.title, { shouldValidate: true });
                      form.setValue("vertical", tpl.vertical, { shouldValidate: true });
                      form.setValue("description", tpl.description, { shouldValidate: true });
                      toast({ title: "Template applied", description: tpl.label });
                    }}
                    className="text-left p-3 rounded-xl bg-purple-500/[0.04] border border-purple-500/20 hover:border-purple-400/40 hover:bg-purple-500/10 transition-all group"
                    data-testid={`button-template-${tpl.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{VERTICAL_ICONS[tpl.vertical] || "📖"}</span>
                      <span className="text-[11px] font-mono font-bold text-purple-300/80 group-hover:text-purple-200 truncate">{tpl.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 leading-snug line-clamp-2">{tpl.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight">Manuscript Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Title</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g., The Millionaire Morning: 5 Habits That Changed Everything" className="h-11 bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40" data-testid="input-title" /></FormControl>
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-purple-400/60">
                        <Wand2 className="h-3 w-3" />
                        <span>SUGGESTED TITLES</span>
                      </div>
                      <div className="space-y-1.5">
                        {suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => field.onChange(suggestion)}
                            className="w-full text-left px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all text-[11px] font-mono text-purple-300/80 hover:text-purple-200 truncate"
                            data-testid={`suggestion-title-${idx}`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestionsLoading && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-purple-400/40">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generating suggestions...</span>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="authorName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Author</FormLabel>
                  <FormControl><Input {...field} placeholder="Author name" className="h-11 bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40" data-testid="input-author" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Book Idea / Prompt <span className="text-muted-foreground/30">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe your book idea, target audience, key topics, or any specific direction you want the AI to follow..."
                      className="min-h-[100px] bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40 resize-y"
                      data-testid="input-description"
                    />
                  </FormControl>
                  <p className="text-[9px] font-mono text-muted-foreground/30 mt-1">This guides the AI when generating your outline, chapters, and marketing</p>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="targetLanguage" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Language</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-language" className="h-11 bg-card/30 border-border/30 font-mono text-sm"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l}>{LANGUAGE_LABELS[l] || l}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight">Genre / Vertical</CardTitle>
              <CardDescription className="text-[11px] font-mono text-muted-foreground/40">Select the genre for AI tone, structure, and targeting</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="vertical" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="space-y-6">
                      {GENRE_GROUPS.map((group) => (
                        <div key={group.label}>
                          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2.5 px-1">{group.label}</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {group.genres.map((v) => {
                              const isSelected = field.value === v;
                              return (
                                <button
                                  key={v} type="button" onClick={() => field.onChange(v)} data-testid={`vertical-${v}`}
                                  className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-300 ${isSelected
                                    ? "border-purple-500/40 bg-purple-500/10 glow-border"
                                    : "border-border/20 bg-card/20 hover:border-border/40 hover:bg-white/[0.02]"}`}
                                >
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full neon-glow flex items-center justify-center">
                                      <Check className="h-2.5 w-2.5 text-white" />
                                    </div>
                                  )}
                                  <span className="text-lg">{VERTICAL_ICONS[v] || "\u{1F4D6}"}</span>
                                  <span className={`text-[11px] font-bold tracking-tight ${isSelected ? "text-purple-300" : "text-muted-foreground/70"}`}>
                                    {VERTICAL_LABELS[v] || v}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 justify-end pt-2">
            <Link href="/projects"><Button variant="outline" type="button" className="border-border/30 font-mono text-[12px]">Cancel</Button></Link>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-create" className="neon-glow text-white border-0 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] font-mono text-[12px]">
              <Sparkles className="h-4 w-4 mr-2" />
              {mutation.isPending ? "INITIALIZING..." : "INITIALIZE PROJECT"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
