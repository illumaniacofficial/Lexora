import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, Shield, DollarSign, Star, Target, BookOpen } from "lucide-react";
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
  english: "English", spanish: "Spanish", portuguese: "Portuguese", french: "French", german: "German",
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
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Autopilot Mode</h1>
            {isActive ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">Configure fully autonomous book publishing</p>
        </div>
      </div>

      <Card className={isActive ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">How Autopilot Works</p>
              <p className="text-sm text-muted-foreground mt-1">When active, BookForge automatically runs trend analysis, greenlights topics, generates complete books, and stops if quality drops below your threshold or budget is exceeded. Books are added to your Projects library.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Autopilot Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-autopilot" />
                    </FormControl>
                    <div>
                      <FormLabel className="text-sm font-medium">{field.value ? "Autopilot is ON" : "Autopilot is OFF"}</FormLabel>
                      <p className="text-xs text-muted-foreground">{field.value ? "System will autonomously generate books" : "No autonomous generation will occur"}</p>
                    </div>
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Target Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="vertical" render={({ field }) => (
                <FormItem>
                  <FormLabel>Publishing Vertical</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-vertical">
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
                    <FormLabel>Monthly Book Target</FormLabel>
                    <Badge variant="secondary">{monthly} books/month</Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={1} max={20} step={1}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                      data-testid="slider-monthly-target"
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>1</span><span>20</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Budget & Quality Controls
              </CardTitle>
              <CardDescription>Autopilot will stop automatically if these thresholds are exceeded</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField control={form.control} name="budgetCapUsd" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Monthly Budget Cap</FormLabel>
                    <Badge variant="secondary">${budget}</Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={5} max={500} step={5}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                      data-testid="slider-budget"
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>$5</span><span>$500</span></div>
                </FormItem>
              )} />

              <FormField control={form.control} name="minQualityScore" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Minimum Quality Score</FormLabel>
                    <Badge variant="secondary">{quality.toFixed(1)}/10</Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={1} max={10} step={0.5}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                      data-testid="slider-quality"
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>1.0</span><span>10.0</span></div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Target Languages</CardTitle>
              <CardDescription>Books will be generated in all selected languages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(lang => {
                  const selected = langs?.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      data-testid={`lang-${lang}`}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-all ${selected ? "bg-primary text-primary-foreground border-primary" : "border-card-border bg-card hover-elevate text-muted-foreground"}`}
                    >
                      {languageLabels[lang] || lang}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Configuration Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Target:</span>
                  <span className="font-medium">{monthly} books/month</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Budget:</span>
                  <span className="font-medium">${budget}/month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Min Quality:</span>
                  <span className="font-medium">{quality.toFixed(1)}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Languages:</span>
                  <span className="font-medium">{langs?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-autopilot">
              <Zap className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
