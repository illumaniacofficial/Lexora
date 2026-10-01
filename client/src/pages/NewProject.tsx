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
import { ArrowLeft, Sparkles, BookOpen, Check, Hexagon, Wand2, Loader2, Star } from "lucide-react";
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
  targetAudience: z.string().max(500).optional(),
  toneStyle: z.string().max(500).optional(),
  keyThemes: z.string().max(800).optional(),
  comparableTitles: z.string().max(500).optional(),
  avoid: z.string().max(500).optional(),
  lengthDepth: z.enum(["auto", "concise", "standard", "comprehensive"]).optional(),
  vertical: z.enum(VERTICALS),
  genres: z.array(z.enum(VERTICALS)).min(1, "Select at least one genre").max(6, "Choose up to 6 genres"),
  targetLanguage: z.enum(LANGUAGES),
  seriesId: z.string().optional(),
  styleFingerprintId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const LENGTH_OPTIONS: { value: NonNullable<FormData["lengthDepth"]>; label: string }[] = [
  { value: "auto", label: "Let AI decide" },
  { value: "concise", label: "Concise — shorter, punchy" },
  { value: "standard", label: "Standard — balanced depth" },
  { value: "comprehensive", label: "Comprehensive — deep & thorough" },
];

const LENGTH_GUIDANCE: Record<string, string> = {
  concise: "Concise and punchy — fewer chapters, tight and to-the-point.",
  standard: "Standard length with balanced depth across chapters.",
  comprehensive: "Comprehensive and thorough — maximum depth, detail, and chapter count.",
};

function composeGuidance(data: FormData): string | undefined {
  const sections: string[] = [];
  if (data.description?.trim()) sections.push(`CORE IDEA / PROMPT:\n${data.description.trim()}`);
  if (data.targetAudience?.trim()) sections.push(`TARGET AUDIENCE:\n${data.targetAudience.trim()}`);
  if (data.toneStyle?.trim()) sections.push(`TONE & WRITING STYLE:\n${data.toneStyle.trim()}`);
  if (data.keyThemes?.trim()) sections.push(`KEY THEMES / TOPICS TO COVER:\n${data.keyThemes.trim()}`);
  if (data.comparableTitles?.trim()) sections.push(`COMPARABLE / COMPETITOR TITLES:\n${data.comparableTitles.trim()}`);
  if (data.avoid?.trim()) sections.push(`THINGS TO AVOID:\n${data.avoid.trim()}`);
  if (data.genres?.length) sections.push(`GENRE BLEND:\n${data.genres.map((genre) => VERTICAL_LABELS[genre] || genre).join(", ")}`);
  if (data.lengthDepth && data.lengthDepth !== "auto" && LENGTH_GUIDANCE[data.lengthDepth]) {
    sections.push(`DESIRED LENGTH / DEPTH:\n${LENGTH_GUIDANCE[data.lengthDepth]}`);
  }
  if (sections.length === 0) return undefined;
  return sections.join("\n\n");
}

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
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [genreSuggestions, setGenreSuggestions] = useState<Array<{ genre: FormData["vertical"]; confidence: number; reason: string }>>([]);
  const [genreSuggestionsLoading, setGenreSuggestionsLoading] = useState(false);
  const [handoffApplied, setHandoffApplied] = useState(false);
  const dossierId = new URLSearchParams(location.split("?")[1] || "").get("dossier");

  const { data: dossierHandoff, isLoading: dossierHandoffLoading, error: dossierHandoffError } = useQuery<{
    dossierId: string;
    propertyId: string;
    status: string;
    title: string;
    description: string;
    targetAudience: string;
    toneStyle: string;
    keyThemes: string;
    comparableTitles: string;
    avoid: string;
    genres: FormData["vertical"][];
    vertical: FormData["vertical"];
    targetLanguage: FormData["targetLanguage"];
    summary?: { oneLine?: string; corePromise?: string; uniqueAngle?: string; oracleSummary?: string; format?: string };
  }>({
    queryKey: [dossierId ? `/api/concept-lab/dossiers/${dossierId}/handoff` : ""],
    enabled: Boolean(dossierId),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", authorName: "Sergio A. Delgado", description: "", targetAudience: "", toneStyle: "", keyThemes: "", comparableTitles: "", avoid: "", lengthDepth: "auto", vertical: "money", genres: ["money"], targetLanguage: "english", seriesId: "none", styleFingerprintId: "none" },
  });

  const { data: seriesList = [] } = useQuery<{ id: number; title: string; bookCount: number }[]>({ queryKey: ["/api/series"] });
  const { data: styleList = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/style-fingerprints"] });

  useEffect(() => {
    if (!dossierHandoff || handoffApplied) return;
    const genres = dossierHandoff.genres?.length ? dossierHandoff.genres.slice(0, 6) : [dossierHandoff.vertical];
    form.reset({
      title: dossierHandoff.title || "",
      authorName: form.getValues("authorName") || "Sergio A. Delgado",
      description: dossierHandoff.description || "",
      targetAudience: dossierHandoff.targetAudience || "",
      toneStyle: dossierHandoff.toneStyle || "",
      keyThemes: dossierHandoff.keyThemes || "",
      comparableTitles: dossierHandoff.comparableTitles || "",
      avoid: dossierHandoff.avoid || "",
      lengthDepth: "auto",
      vertical: dossierHandoff.vertical || genres[0] || "novel",
      genres,
      targetLanguage: dossierHandoff.targetLanguage || "english",
      seriesId: "none",
      styleFingerprintId: "none",
    });
    setHandoffApplied(true);
  }, [dossierHandoff, handoffApplied, form]);

  const currentTitle = form.watch("title");
  const currentDescription = form.watch("description");
  const currentAudience = form.watch("targetAudience");
  const currentTone = form.watch("toneStyle");
  const currentThemes = form.watch("keyThemes");
  const currentComparables = form.watch("comparableTitles");
  const selectedGenres = form.watch("genres");
  const selectedGenreKey = (selectedGenres || []).join("|");

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

  useEffect(() => {
    const context = [
      currentTitle,
      currentDescription,
      currentAudience,
      currentTone,
      currentThemes,
      currentComparables,
    ].filter(Boolean).join("\n").trim();

    if (context.length < 24) {
      setGenreSuggestions([]);
      return;
    }

    const detectGenres = async () => {
      setGenreSuggestionsLoading(true);
      try {
        const res = await fetch("/api/projects/suggest-genres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: currentTitle,
            description: currentDescription,
            targetAudience: currentAudience,
            toneStyle: currentTone,
            keyThemes: currentThemes,
            comparableTitles: currentComparables,
            selectedGenres,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setGenreSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        }
      } catch (err) {
        console.error("Failed to detect genres:", err);
      } finally {
        setGenreSuggestionsLoading(false);
      }
    };

    const timer = window.setTimeout(detectGenres, 900);
    return () => window.clearTimeout(timer);
  }, [currentTitle, currentDescription, currentAudience, currentTone, currentThemes, currentComparables, selectedGenreKey]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/projects", {
      title: data.title,
      authorName: data.authorName,
      vertical: data.vertical,
      genres: data.genres,
      targetLanguage: data.targetLanguage,
      description: composeGuidance(data),
      status: "draft",
      seriesId: data.seriesId && data.seriesId !== "none" ? parseInt(data.seriesId) : null,
      styleFingerprintId: data.styleFingerprintId && data.styleFingerprintId !== "none" ? parseInt(data.styleFingerprintId) : null,
      sourceDossierId: dossierHandoff?.dossierId || null,
    }),
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
        <meta name="description" content="Initialize a new book manuscript — set your title, author, genres, and language to start the Lexora publishing workflow." />
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
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Configure your book and let Lexora build from your creative direction</p>
      </div>

      <div className="line-glow mb-5 md:mb-8" />

      {dossierId && (
        <Card className="mb-5 border-cyan-500/25 bg-cyan-500/[0.05]" data-testid="dossier-project-handoff">
          <CardContent className="pt-4 pb-4">
            {dossierHandoffLoading ? (
              <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-200/70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading approved Concept Dossier…
              </div>
            ) : dossierHandoffError ? (
              <div className="text-[11px] text-red-300">
                This dossier could not be loaded for project creation. Return to Concept Lab and make sure it is greenlit.
              </div>
            ) : dossierHandoff ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-300" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-cyan-200">Approved Concept Dossier Loaded</span>
                  <span className="text-[9px] font-mono text-muted-foreground/45">Property {dossierHandoff.propertyId}</span>
                </div>
                <p className="text-[12px] text-muted-foreground/70">
                  Lexora prefilled this form from the greenlit dossier. Review or adjust anything before initializing; the new project will stay linked to the same Property and concept lineage.
                </p>
                {dossierHandoff.summary?.oneLine && (
                  <p className="text-[11px] text-cyan-100/65">{dossierHandoff.summary.oneLine}</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

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
                      form.setValue("genres", [tpl.vertical], { shouldValidate: true });
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
              <FormField control={form.control} name="seriesId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Series <span className="text-muted-foreground/30 normal-case">(optional)</span></FormLabel>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-series" className="h-11 bg-card/30 border-border/30 font-mono text-sm"><SelectValue placeholder="No series" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">No series</SelectItem>
                      {seriesList.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="styleFingerprintId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Author Style <span className="text-muted-foreground/30 normal-case">(optional)</span></FormLabel>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-style" className="h-11 bg-card/30 border-border/30 font-mono text-sm"><SelectValue placeholder="Default voice" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Default voice</SelectItem>
                      {styleList.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight">Creative Direction <span className="text-muted-foreground/30 font-normal">(optional)</span></CardTitle>
              <CardDescription className="text-[11px] font-mono text-muted-foreground/40">The more you share, the better the AI matches your intent across outline, chapters, and marketing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="targetAudience" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Target Audience</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Who is this book for? e.g., first-time entrepreneurs in their 20s-30s, busy parents, fans of cozy mysteries..." className="min-h-[70px] bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40 resize-y" data-testid="input-audience" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="toneStyle" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Tone & Writing Style</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="e.g., warm and conversational, fast-paced and punchy, lyrical and literary, authoritative and data-driven..." className="min-h-[70px] bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40 resize-y" data-testid="input-tone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="keyThemes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Key Themes / Topics to Cover</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="The main ideas, topics, plot points, or arguments the book must include..." className="min-h-[80px] bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40 resize-y" data-testid="input-themes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="comparableTitles" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Comparable / Competitor Titles</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="e.g., 'In the style of Atomic Habits meets Deep Work', or comparable novels readers love..." className="min-h-[60px] bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40 resize-y" data-testid="input-comps" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="avoid" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Things to Avoid</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Topics, clichés, tones, or content the AI should steer clear of..." className="min-h-[60px] bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40 resize-y" data-testid="input-avoid" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lengthDepth" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Length & Depth</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-length" className="h-11 bg-card/30 border-border/30 font-mono text-sm"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{LENGTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight">Genres</CardTitle>
              <CardDescription className="text-[11px] font-mono text-muted-foreground/40">
                Blend multiple genres. Lexora keeps one Primary Genre for legacy workflows and stores the complete blend in Canon.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {(genreSuggestionsLoading || genreSuggestions.length > 0) && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-3" data-testid="genre-detection-review">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-purple-300/80">
                        <Sparkles className="h-3.5 w-3.5" />
                        Lexora detected
                      </div>
                      <p className="text-[9px] font-mono text-muted-foreground/40 mt-1">Suggestions only — review them before adding anything.</p>
                    </div>
                    {genreSuggestionsLoading ? <Loader2 className="h-4 w-4 animate-spin text-purple-400/60" /> : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[8px] font-mono border-purple-500/25"
                        onClick={() => {
                          const current = form.getValues("genres");
                          const additions = genreSuggestions.map((item) => item.genre).filter((genre) => !current.includes(genre));
                          const next = [...current, ...additions].slice(0, 6);
                          form.setValue("genres", next, { shouldValidate: true, shouldDirty: true });
                        }}
                        disabled={genreSuggestions.every((item) => selectedGenres.includes(item.genre)) || selectedGenres.length >= 6}
                        data-testid="button-accept-detected-genres"
                      >
                        <Check className="h-3 w-3 mr-1" /> ADD DETECTED
                      </Button>
                    )}
                  </div>
                  {!genreSuggestionsLoading && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {genreSuggestions.map((item) => {
                        const alreadySelected = selectedGenres.includes(item.genre);
                        return (
                          <button
                            key={item.genre}
                            type="button"
                            onClick={() => {
                              if (alreadySelected || selectedGenres.length >= 6) return;
                              form.setValue("genres", [...selectedGenres, item.genre], { shouldValidate: true, shouldDirty: true });
                            }}
                            className={`text-left rounded-lg border p-2.5 transition-all ${alreadySelected
                              ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                              : "border-border/20 bg-card/30 hover:border-purple-500/30 hover:bg-purple-500/[0.05]"}`}
                            data-testid={`detected-genre-${item.genre}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold">{VERTICAL_ICONS[item.genre] || "📖"} {VERTICAL_LABELS[item.genre] || item.genre}</span>
                              <span className="text-[8px] font-mono text-muted-foreground/40">{Math.round(item.confidence * 100)}%</span>
                            </div>
                            <p className="text-[9px] leading-snug text-muted-foreground/45 mt-1">{item.reason}</p>
                            <p className="text-[8px] font-mono mt-1.5 text-purple-300/60">{alreadySelected ? "SELECTED" : "TAP TO ADD"}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <FormField control={form.control} name="genres" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="space-y-6">
                      {GENRE_GROUPS.map((group) => (
                        <div key={group.label}>
                          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-2.5 px-1">{group.label}</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {group.genres.map((v) => {
                              const isSelected = field.value.includes(v);
                              const isPrimary = form.watch("vertical") === v;
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => {
                                    const current = field.value;
                                    if (isSelected) {
                                      if (current.length === 1) {
                                        toast({ title: "Keep at least one genre", description: "Every project needs a primary genre." });
                                        return;
                                      }
                                      const next = current.filter((genre) => genre !== v);
                                      field.onChange(next);
                                      if (form.getValues("vertical") === v) {
                                        form.setValue("vertical", next[0], { shouldValidate: true, shouldDirty: true });
                                      }
                                      return;
                                    }
                                    if (current.length >= 6) {
                                      toast({ title: "Genre blend is full", description: "Choose up to 6 genres for one project." });
                                      return;
                                    }
                                    field.onChange([...current, v]);
                                  }}
                                  data-testid={`genre-${v}`}
                                  className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-300 ${isSelected
                                    ? "border-purple-500/40 bg-purple-500/10 glow-border"
                                    : "border-border/20 bg-card/20 hover:border-border/40 hover:bg-white/[0.02]"}`}
                                >
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 h-4 w-4 rounded-full neon-glow flex items-center justify-center">
                                      <Check className="h-2.5 w-2.5 text-white" />
                                    </div>
                                  )}
                                  <span className="text-lg">{VERTICAL_ICONS[v] || "📖"}</span>
                                  <span className={`pr-4 text-[11px] font-bold tracking-tight ${isSelected ? "text-purple-300" : "text-muted-foreground/70"}`}>
                                    {VERTICAL_LABELS[v] || v}
                                  </span>
                                  {isPrimary && <span className="absolute bottom-1.5 right-2 text-[7px] font-mono text-amber-300/70">PRIMARY</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="rounded-xl border border-border/20 bg-card/20 p-3" data-testid="selected-genre-blend">
                <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/40 mb-2">Selected genre blend · choose the primary</p>
                <div className="flex flex-wrap gap-2">
                  {selectedGenres.map((genre) => {
                    const primary = form.watch("vertical") === genre;
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => form.setValue("vertical", genre, { shouldValidate: true, shouldDirty: true })}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[9px] font-mono transition-all ${primary
                          ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                          : "border-border/25 bg-card/30 text-muted-foreground/60 hover:border-purple-500/30 hover:text-purple-200"}`}
                        data-testid={`button-primary-genre-${genre}`}
                      >
                        {primary ? <Star className="h-3 w-3 fill-current" /> : null}
                        {VERTICAL_LABELS[genre] || genre}
                        {primary ? " · PRIMARY" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
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
