import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, User, Globe, Brain, FileText, Image, Megaphone, Volume2, Store, Download, Zap, Hexagon, AlertCircle, Save } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, LANGUAGE_LABELS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import type { AppSettings } from "@shared/schema";
import { VoiceSelector } from "@/components/voice-selector";
import { DEFAULT_VOICE_ID } from "@/components/audio-mini-player";

const schema = z.object({
  defaultAuthorName: z.string().min(1, "Author name is required").max(200),
  defaultVertical: z.string(),
  defaultLanguage: z.string(),
  aiModel: z.string(),
  chapterWordTarget: z.number().min(500).max(10000),
  autoGenerateCover: z.boolean(),
  autoGenerateMarketing: z.boolean(),
  ttsDefaultVoice: z.string(),
  storefrontTitle: z.string().min(1, "Storefront title is required").max(200),
  exportFormat: z.string(),
});

type FormData = z.infer<typeof schema>;

const aiModelOptions = [
  { value: "fast", label: "Fast (GPT-5 Mini)", desc: "Faster, lower cost" },
  { value: "high", label: "High Quality (GPT-5.1)", desc: "Best quality, higher cost" },
];

const exportFormatOptions = [
  { value: "html", label: "HTML" },
  { value: "txt", label: "Plain Text" },
];

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading, error } = useQuery<AppSettings | null>({ queryKey: ["/api/settings"] });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultAuthorName: "Sergio A. Delgado",
      defaultVertical: "money",
      defaultLanguage: "english",
      aiModel: "high",
      chapterWordTarget: 3000,
      autoGenerateCover: true,
      autoGenerateMarketing: true,
      ttsDefaultVoice: DEFAULT_VOICE_ID,
      storefrontTitle: "Lexora Book Collection",
      exportFormat: "html",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        defaultAuthorName: settings.defaultAuthorName,
        defaultVertical: settings.defaultVertical,
        defaultLanguage: settings.defaultLanguage,
        aiModel: settings.aiModel,
        chapterWordTarget: settings.chapterWordTarget,
        autoGenerateCover: settings.autoGenerateCover,
        autoGenerateMarketing: settings.autoGenerateMarketing,
        ttsDefaultVoice: settings.ttsDefaultVoice,
        storefrontTitle: settings.storefrontTitle,
        exportFormat: settings.exportFormat,
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const wordTarget = form.watch("chapterWordTarget");

  if (isLoading) {
    return (
      <div className="p-8 space-y-5">
        <Skeleton className="h-10 w-56 bg-muted/20" />
        <Skeleton className="h-80 rounded-xl bg-muted/20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load settings</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-7 overflow-y-auto h-full max-w-3xl">
      <Helmet>
        <title>Settings — Lexora</title>
        <meta name="description" content="Configure your Lexora publishing platform — defaults, AI models, storefront, and export preferences." />
      </Helmet>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-purple-500/50" />
          <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.2em] uppercase">CONFIGURATION</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">App <span className="shimmer-text">Settings</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Configure defaults and preferences for your publishing pipeline</p>
      </div>

      <div className="line-glow" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-purple-400/70" /> Author Defaults
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Pre-filled when creating new projects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="defaultAuthorName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Author Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10 bg-card/30 border-border/30 font-mono text-sm" data-testid="input-default-author" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="defaultVertical" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Vertical</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-default-vertical" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="defaultLanguage" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Language</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-default-language" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LANGUAGES.map(l => <SelectItem key={l} value={l}>{LANGUAGE_LABELS[l] || l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-cyan-400/70" /> AI Configuration
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Control AI model and generation behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="aiModel" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">AI Model Preference</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-ai-model" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {aiModelOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          <span>{o.label}</span>
                          <span className="text-muted-foreground/40 text-[10px] ml-2">— {o.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="chapterWordTarget" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Chapter Word Target</FormLabel>
                    <Badge variant="outline" className="font-mono text-[10px] border-border/30">{wordTarget.toLocaleString()} words</Badge>
                  </div>
                  <FormControl>
                    <Slider min={500} max={10000} step={250} value={[field.value]} onValueChange={([v]) => field.onChange(v)} data-testid="slider-word-target" />
                  </FormControl>
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground/30"><span>500</span><span>10,000</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400/70" /> Pipeline Automation
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Auto-trigger steps after chapter generation completes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="autoGenerateCover" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-auto-cover" />
                    </FormControl>
                    <div>
                      <FormLabel className="text-[12px] font-bold font-mono flex items-center gap-2">
                        <Image className="h-3 w-3 text-pink-400/60" /> Auto-Generate Cover
                      </FormLabel>
                      <p className="text-[10px] text-muted-foreground/40 font-mono">Automatically create AI cover art when all chapters are written</p>
                    </div>
                  </div>
                </FormItem>
              )} />

              <div className="border-t border-border/10" />

              <FormField control={form.control} name="autoGenerateMarketing" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-auto-marketing" />
                    </FormControl>
                    <div>
                      <FormLabel className="text-[12px] font-bold font-mono flex items-center gap-2">
                        <Megaphone className="h-3 w-3 text-pink-400/60" /> Auto-Generate Marketing
                      </FormLabel>
                      <p className="text-[10px] text-muted-foreground/40 font-mono">Automatically create marketing assets when book is complete</p>
                    </div>
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400/70" /> Narration
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Default voice for AI narrator across all books</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="ttsDefaultVoice" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Narrator Voice</FormLabel>
                  <FormControl>
                    <VoiceSelector value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Store className="h-3.5 w-3.5 text-purple-400/70" /> Storefront
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Customize your public reader storefront</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="storefrontTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Storefront Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-10 bg-card/30 border-border/30 font-mono text-sm" data-testid="input-storefront-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Download className="h-3.5 w-3.5 text-cyan-400/70" /> Export
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Default format when exporting books</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="exportFormat" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Default Export Format</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-export-format" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {exportFormatOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-settings" className="neon-glow text-white border-0 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] font-mono text-[12px]">
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "SAVING..." : "SAVE SETTINGS"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
