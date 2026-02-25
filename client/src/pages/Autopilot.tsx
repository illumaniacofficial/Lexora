import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, Shield, DollarSign, Star, Target, BookOpen, Check } from "lucide-react";
import { VERTICAL_LABELS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VERTICALS, LANGUAGES } from "@shared/schema";
import type { AutopilotConfig } from "@shared/schema";

const schema = z.object({
  vertical: z.enum(VERTICALS),
  monthlyBookTarget: z.number().min(1).max(20),
  budgetCapUsd: z.number().min(1).max(500),
  minQualityScore: z.number().min(1).max(10),
  targetLanguages: z.array(z.string()).min(1),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const languageLabels: Record<string, string> = {
  english: "English", spanish: "Espa\u00F1ol", portuguese: "Portugu\u00EAs", french: "Fran\u00E7ais", german: "Deutsch",
};

export default function Autopilot() {
  const { toast } = useToast();
  const { data: config, isLoading } = useQuery<AutopilotConfig | null>({ queryKey: ["/api/autopilot"] });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vertical: "money",
      monthlyBookTarget: 2,
      budgetCapUsd: 50,
      minQualityScore: 7,
      targetLanguages: ["english"],
      isActive: false,
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot"] });
      toast({ title: "Autopilot settings saved!" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
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
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-7 overflow-y-auto h-full max-w-3xl">
      <div className="flex items-center gap-3.5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-md ${isActive ? "premium-gradient" : "bg-gradient-to-br from-slate-400 to-slate-500"}`}>
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Autopilot Mode</h1>
            {isActive ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold text-[11px]">Active</Badge>
            ) : (
              <Badge variant="secondary" className="font-bold text-[11px]">Inactive</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">Configure fully autonomous book publishing</p>
        </div>
      </div>

      <Card className={`border-border/50 shadow-sm overflow-hidden relative ${isActive ? "border-primary/20" : ""}`}>
        {isActive && <div className="absolute inset-0 premium-gradient-subtle pointer-events-none" />}
        <CardContent className="pt-5 pb-5 relative">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shrink-0">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm tracking-tight">How Autopilot Works</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">When active, BookForge automatically runs trend analysis, greenlights topics, generates complete books, and stops if quality drops below your threshold or budget is exceeded.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Autopilot Status
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
                      <FormLabel className="text-sm font-bold">{field.value ? "Autopilot is ON" : "Autopilot is OFF"}</FormLabel>
                      <p className="text-[11px] text-muted-foreground">{field.value ? "System will autonomously generate books" : "No autonomous generation will occur"}</p>
                    </div>
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Target Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="vertical" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Publishing Vertical</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-vertical" className="h-10 bg-background border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VERTICALS.map(v => <SelectItem key={v} value={v}>{VERTICAL_LABELS[v] || v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="monthlyBookTarget" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">Monthly Book Target</FormLabel>
                    <Badge variant="secondary" className="font-bold text-[11px]">{monthly} books/month</Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={1} max={20} step={1}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                      data-testid="slider-monthly-target"
                    />
                  </FormControl>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium"><span>1</span><span>20</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Budget & Quality Controls
              </CardTitle>
              <CardDescription>Autopilot will stop automatically if these thresholds are exceeded</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="budgetCapUsd" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">Monthly Budget Cap</FormLabel>
                    <Badge variant="secondary" className="font-bold text-[11px]">${budget}</Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={5} max={500} step={5}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                      data-testid="slider-budget"
                    />
                  </FormControl>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium"><span>$5</span><span>$500</span></div>
                </FormItem>
              )} />

              <FormField control={form.control} name="minQualityScore" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium">Minimum Quality Score</FormLabel>
                    <Badge variant="secondary" className="font-bold text-[11px]">{quality.toFixed(1)}/10</Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={1} max={10} step={0.5}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                      data-testid="slider-quality"
                    />
                  </FormControl>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-medium"><span>1.0</span><span>10.0</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Target Languages</CardTitle>
              <CardDescription>Books will be generated in all selected languages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2.5">
                {LANGUAGES.map(lang => {
                  const selected = langs?.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      data-testid={`lang-${lang}`}
                      className={`relative px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${selected ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border/60 bg-card hover:border-border hover:shadow-sm text-muted-foreground"}`}
                    >
                      {selected && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                      {languageLabels[lang] || lang}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm premium-gradient-subtle">
            <CardContent className="pt-5 pb-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Configuration Summary</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { icon: BookOpen, label: "Target", value: `${monthly} books/month` },
                  { icon: DollarSign, label: "Budget", value: `$${budget}/month` },
                  { icon: Star, label: "Min Quality", value: `${quality.toFixed(1)}/10` },
                  { icon: Shield, label: "Languages", value: `${langs?.length || 0} selected` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2.5 bg-background/60 rounded-lg px-3 py-2.5">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="text-[10px] text-muted-foreground block">{label}</span>
                      <span className="text-xs font-bold">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-autopilot" className="shadow-sm">
              <Zap className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
