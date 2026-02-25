import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, Shield, DollarSign, Star, Target, BookOpen, Check, Hexagon, Activity, AlertCircle, Play, Loader2, Clock, CheckCircle2, XCircle, StopCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, LANGUAGE_LABELS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import type { AutopilotConfig, AutopilotRun } from "@shared/schema";

const schema = z.object({
  vertical: z.enum(VERTICALS),
  monthlyBookTarget: z.number().min(1).max(20),
  budgetCapUsd: z.number().min(1).max(500),
  minQualityScore: z.number().min(1).max(10),
  targetLanguages: z.array(z.string()).min(1),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;


function ElapsedTime({ since }: { since: string | Date }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const start = new Date(since).getTime();
    const tick = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  return <span className="text-[10px] font-mono text-purple-400/60">{elapsed}</span>;
}

export default function Autopilot() {
  const { toast } = useToast();
  const { data: config, isLoading, error } = useQuery<AutopilotConfig | null>({ queryKey: ["/api/autopilot"] });
  const [polling, setPolling] = useState(false);
  const { data: runs } = useQuery<AutopilotRun[]>({
    queryKey: ["/api/autopilot/runs"],
    refetchInterval: polling ? 2000 : false,
    staleTime: polling ? 0 : Infinity,
  });

  const activeRun = runs?.find(r => r.status === "running" || r.status === "pending");

  useEffect(() => {
    if (activeRun) {
      setPolling(true);
    } else if (polling) {
      setPolling(false);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    }
  }, [activeRun, polling]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { vertical: "money", monthlyBookTarget: 2, budgetCapUsd: 50, minQualityScore: 7, targetLanguages: ["english"], isActive: false },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        vertical: (config.vertical as any) || "money",
        monthlyBookTarget: config.monthlyBookTarget,
        budgetCapUsd: config.budgetCapUsd,
        minQualityScore: config.minQualityScore,
        targetLanguages: config.targetLanguages || ["english"],
        isActive: config.isActive,
      });
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/autopilot", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/autopilot"] }); toast({ title: "Configuration saved" }); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/autopilot/run"),
    onSuccess: () => {
      setPolling(true);
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Autopilot run started", description: "AI is now generating a complete book autonomously." });
    },
    onError: (err: any) => toast({ title: "Failed to start run", description: err.message, variant: "destructive" }),
  });

  const isActive = form.watch("isActive");
  const monthly = form.watch("monthlyBookTarget");
  const budget = form.watch("budgetCapUsd");
  const quality = form.watch("minQualityScore");
  const langs = form.watch("targetLanguages");

  const toggleLanguage = (lang: string) => {
    const current = form.getValues("targetLanguages") || [];
    if (current.includes(lang)) {
      if (current.length > 1) form.setValue("targetLanguages", current.filter(l => l !== lang));
    } else {
      form.setValue("targetLanguages", [...current, lang]);
    }
  };

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
        <p className="font-bold text-lg tracking-tight">Failed to load autopilot config</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "complete": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case "stopped": return <StopCircle className="h-3.5 w-3.5 text-amber-400" />;
      case "running": return <Loader2 className="h-3.5 w-3.5 text-purple-400 animate-spin" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "complete": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "failed": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "stopped": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "running": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      default: return "text-muted-foreground/60 bg-muted/10 border-border/20";
    }
  };

  return (
    <div className="p-8 space-y-7 overflow-y-auto h-full max-w-3xl">
      <Helmet>
        <title>Autopilot — Lexora</title>
        <meta name="description" content="Fully autonomous book publishing — configure targets, budget, quality thresholds, and let AI handle everything." />
      </Helmet>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3 w-3 text-purple-500/50 animate-pulse-glow" />
          <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.2em] uppercase">AUTONOMOUS</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tighter">Autopilot <span className="shimmer-text">Mode</span></h1>
          {isActive ? (
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] shadow-[0_0_8px_rgba(52,211,153,0.3)]">ACTIVE</Badge>
          ) : (
            <Badge variant="secondary" className="font-mono text-[10px] border-border/30">INACTIVE</Badge>
          )}
        </div>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1">Fully autonomous book publishing pipeline</p>
      </div>

      <div className="line-glow" />

      {activeRun && (
        <Card className="border-purple-500/30 bg-purple-500/5 glow-border overflow-hidden relative">
          <div className="absolute inset-0 mesh-bg opacity-20 pointer-events-none" />
          <CardContent className="pt-5 pb-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                <p className="font-bold text-sm tracking-tight text-purple-300">Autopilot Running</p>
              </div>
              <ElapsedTime since={activeRun.createdAt} />
            </div>
            <div className="space-y-2">
              {activeRun.bookTitle && (
                <p className="text-[12px] font-mono text-white/80">
                  <span className="text-muted-foreground/50">Book: </span>{activeRun.bookTitle}
                </p>
              )}
              <p className="text-[12px] font-mono text-white/80">
                <span className="text-muted-foreground/50">Step: </span>
                <span className="text-purple-300 animate-pulse">{activeRun.currentStep || "Initializing..."}</span>
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/40">
                Vertical: {VERTICAL_LABELS[activeRun.vertical] || activeRun.vertical}
              </p>
              {activeRun.estimatedCost > 0 && (
                <p className="text-[10px] font-mono text-muted-foreground/40">
                  Cost so far: ${activeRun.estimatedCost.toFixed(4)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={`border-border/20 bg-card/30 overflow-hidden relative ${isActive ? "glow-border" : ""}`}>
        {isActive && <div className="absolute inset-0 mesh-bg opacity-30 pointer-events-none" />}
        <CardContent className="pt-5 pb-5 relative">
          <div className="flex items-start gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shrink-0 ${isActive ? "neon-glow" : "bg-zinc-700"}`}>
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm tracking-tight">How Autopilot Works</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1 leading-relaxed font-mono">Enable autopilot, configure your settings, then hit "Run Now" to auto-generate a complete book: topic discovery, trend analysis, outline, all chapters, and marketing — fully autonomous.</p>
            </div>
            <Button
              onClick={() => runMutation.mutate()}
              disabled={!isActive || runMutation.isPending || !!activeRun}
              data-testid="button-run-autopilot"
              className="neon-glow text-white border-0 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] font-mono text-[12px] shrink-0"
            >
              {runMutation.isPending || activeRun ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {activeRun ? "RUNNING..." : runMutation.isPending ? "STARTING..." : "RUN NOW"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">
          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-purple-400/70" /> Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-autopilot" />
                    </FormControl>
                    <div>
                      <FormLabel className="text-[12px] font-bold font-mono">{field.value ? "AUTOPILOT ON" : "AUTOPILOT OFF"}</FormLabel>
                      <p className="text-[10px] text-muted-foreground/40 font-mono">{field.value ? "Autonomous generation active" : "No autonomous generation"}</p>
                    </div>
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-cyan-400/70" /> Target Config
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="vertical" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Vertical</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-vertical" className="h-10 bg-card/30 border-border/30 font-mono text-[12px]"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>{VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="monthlyBookTarget" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Monthly Target</FormLabel>
                    <Badge variant="outline" className="font-mono text-[10px] border-border/30">{monthly} books/mo</Badge>
                  </div>
                  <FormControl>
                    <Slider min={1} max={20} step={1} value={[field.value]} onValueChange={([v]) => field.onChange(v)} data-testid="slider-monthly-target" />
                  </FormControl>
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground/30"><span>1</span><span>20</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-amber-400/70" /> Budget & Quality
              </CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Auto-stop when thresholds exceeded</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="budgetCapUsd" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Budget Cap</FormLabel>
                    <Badge variant="outline" className="font-mono text-[10px] border-border/30">${budget}</Badge>
                  </div>
                  <FormControl>
                    <Slider min={5} max={500} step={5} value={[field.value]} onValueChange={([v]) => field.onChange(v)} data-testid="slider-budget" />
                  </FormControl>
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground/30"><span>$5</span><span>$500</span></div>
                </FormItem>
              )} />

              <FormField control={form.control} name="minQualityScore" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Min Quality</FormLabel>
                    <Badge variant="outline" className="font-mono text-[10px] border-border/30">{quality.toFixed(1)}/10</Badge>
                  </div>
                  <FormControl>
                    <Slider min={1} max={10} step={0.5} value={[field.value]} onValueChange={([v]) => field.onChange(v)} data-testid="slider-quality" />
                  </FormControl>
                  <div className="flex justify-between text-[9px] font-mono text-muted-foreground/30"><span>1.0</span><span>10.0</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold tracking-tight">Languages</CardTitle>
              <CardDescription className="text-[10px] font-mono text-muted-foreground/40">Generate books in selected languages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2.5">
                {LANGUAGES.map(lang => {
                  const selected = langs?.includes(lang);
                  return (
                    <button
                      key={lang} type="button" onClick={() => toggleLanguage(lang)} data-testid={`lang-${lang}`}
                      className={`relative px-4 py-2 rounded-xl border text-[12px] font-mono font-bold transition-all ${selected
                        ? "neon-glow text-white border-transparent shadow-lg"
                        : "border-border/30 bg-card/20 hover:border-border/50 text-muted-foreground/60"}`}
                    >
                      {selected && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_6px_rgba(52,211,153,0.5)]">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                      {LANGUAGE_LABELS[lang] || lang}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/20 bg-card/30 glow-border overflow-hidden relative">
            <div className="absolute inset-0 mesh-bg opacity-30 pointer-events-none" />
            <CardContent className="pt-5 pb-5 relative">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">SUMMARY</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: BookOpen, label: "Target", value: `${monthly} books/mo`, glow: "text-purple-400/50" },
                  { icon: DollarSign, label: "Budget", value: `$${budget}/mo`, glow: "text-cyan-400/50" },
                  { icon: Star, label: "Min Quality", value: `${quality.toFixed(1)}/10`, glow: "text-amber-400/50" },
                  { icon: Shield, label: "Languages", value: `${langs?.length || 0} selected`, glow: "text-pink-400/50" },
                ].map(({ icon: Icon, label, value, glow }) => (
                  <div key={label} className="flex items-center gap-2.5 bg-white/[0.02] border border-border/15 rounded-lg px-3 py-2.5">
                    <Icon className={`h-4 w-4 shrink-0 ${glow}`} />
                    <div>
                      <span className="text-[8px] font-mono text-muted-foreground/30 block tracking-widest uppercase">{label}</span>
                      <span className="text-[11px] font-mono font-bold">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-autopilot" className="neon-glow text-white border-0 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] font-mono text-[12px]">
              <Zap className="h-4 w-4 mr-2" />
              {mutation.isPending ? "SAVING..." : "SAVE CONFIG"}
            </Button>
          </div>
        </form>
      </Form>

      {runs && runs.length > 0 && (
        <>
          <div className="line-glow" />
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-3 w-3 text-cyan-500/50" />
              <span className="text-[9px] font-mono font-bold text-cyan-400/60 tracking-[0.2em] uppercase">RUN HISTORY</span>
            </div>
            <div className="space-y-2.5">
              {runs.map(run => (
                <Card key={run.id} className="border-border/20 bg-card/30" data-testid={`autopilot-run-${run.id}`}>
                  <CardContent className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {statusIcon(run.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-mono font-bold truncate">
                            {run.bookTitle || "Generating topic..."}
                          </p>
                          <Badge className={`${statusColor(run.status)} border font-mono text-[9px] shrink-0`}>
                            {run.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-mono text-muted-foreground/40">
                            {VERTICAL_LABELS[run.vertical] || run.vertical}
                          </span>
                          {run.currentStep && run.status === "running" && (
                            <span className="text-[10px] font-mono text-purple-400/70 truncate">
                              {run.currentStep}
                            </span>
                          )}
                          {run.estimatedCost > 0 && (
                            <span className="text-[10px] font-mono text-muted-foreground/30">
                              ${run.estimatedCost.toFixed(4)}
                            </span>
                          )}
                          {run.errorMessage && (
                            <span className="text-[10px] font-mono text-red-400/60 truncate">
                              {run.errorMessage}
                            </span>
                          )}
                          {run.currentStep && run.status === "stopped" && (
                            <span className="text-[10px] font-mono text-amber-400/60 truncate">
                              {run.currentStep}
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-muted-foreground/25 ml-auto shrink-0">
                            {new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
