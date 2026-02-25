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
import { ArrowLeft, Sparkles, BookOpen, Check, Hexagon } from "lucide-react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import { VERTICAL_LABELS, VERTICAL_ICONS, LANGUAGE_LABELS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  authorName: z.string().min(1, "Author name is required").max(200),
  vertical: z.enum(VERTICALS),
  targetLanguage: z.enum(LANGUAGES),
});

type FormData = z.infer<typeof schema>;



export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", authorName: "Sergio A. Delgado", vertical: "money", targetLanguage: "english" },
  });

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
    <div className="p-8 max-w-3xl mx-auto overflow-y-auto h-full">
      <Helmet>
        <title>New Manuscript — Lexora</title>
        <meta name="description" content="Initialize a new book manuscript — set your title, author, vertical, and language to start the AI publishing pipeline." />
      </Helmet>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/projects">
          <Button variant="ghost" size="sm" data-testid="button-back" className="text-muted-foreground/60 hover:text-purple-400 font-mono text-[11px]">
            <ArrowLeft className="h-4 w-4 mr-1" /> BACK
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-purple-500/50" />
          <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.2em] uppercase">INITIALIZE</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tighter">New <span className="shimmer-text">Manuscript</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Configure your book and let AI generate the rest</p>
      </div>

      <div className="line-glow mb-8" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          <Card className="border-border/30 bg-card/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight">Manuscript Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Title</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g., The Millionaire Morning: 5 Habits That Changed Everything" className="h-11 bg-card/30 border-border/30 font-mono text-sm focus:border-purple-500/40" data-testid="input-title" /></FormControl>
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
              <CardTitle className="text-sm font-bold tracking-tight">Market Vertical</CardTitle>
              <CardDescription className="text-[11px] font-mono text-muted-foreground/40">Select the niche for AI tone, frameworks, and targeting</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="vertical" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {VERTICALS.map((v) => {
                        const isSelected = field.value === v;
                        return (
                          <button
                            key={v} type="button" onClick={() => field.onChange(v)} data-testid={`vertical-${v}`}
                            className={`relative flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-300 ${isSelected
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
