import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BookOpen, FileText, DollarSign, Eye, Headphones, Star, BarChart3, TrendingUp,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatNumber, formatCost } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";

interface AnalyticsData {
  totals: {
    books: number;
    completedBooks: number;
    words: number;
    cost: number;
    tokens: number;
    reads: number;
    listens: number;
    avgQuality: number;
  };
  monthly: { month: string; books: number; words: number; cost: number; reads: number; listens: number }[];
  topBooks: { id: number; title: string; reads: number; listens: number; words: number }[];
}

const TIME_RANGES = [
  { key: "3", label: "3M" },
  { key: "6", label: "6M" },
  { key: "12", label: "12M" },
  { key: "all", label: "All" },
] as const;

export default function Analytics() {
  const [range, setRange] = useState<string>("12");
  const { data, isLoading, error } = useQuery<AnalyticsData>({ queryKey: ["/api/analytics"] });

  const monthly = (() => {
    if (!data) return [];
    if (range === "all") return data.monthly;
    const n = parseInt(range);
    return data.monthly.slice(-n);
  })();

  const totals = data?.totals;

  const metricCards = [
    { label: "Books", value: totals ? formatNumber(totals.books) : "0", sub: totals ? `${totals.completedBooks} complete` : "", icon: BookOpen, tone: "text-purple-300" },
    { label: "Words", value: totals ? formatNumber(totals.words) : "0", sub: "total written", icon: FileText, tone: "text-cyan-300" },
    { label: "Cost", value: totals ? formatCost(totals.cost) : "$0", sub: "AI spend", icon: DollarSign, tone: "text-amber-300" },
    { label: "Reads", value: totals ? formatNumber(totals.reads) : "0", sub: "storefront opens", icon: Eye, tone: "text-emerald-300" },
    { label: "Audio Listens", value: totals ? formatNumber(totals.listens) : "0", sub: "narration plays", icon: Headphones, tone: "text-pink-300" },
    { label: "Avg Quality", value: totals ? totals.avgQuality.toFixed(1) : "0", sub: "across portfolio", icon: Star, tone: "text-violet-300" },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain" data-testid="analytics-scroll-region">
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 pb-24 md:pb-28 space-y-6">
      <Helmet>
        <title>Portfolio Analytics - Lexora</title>
        <meta name="description" content="Track books, words, AI cost, reads, and audio listens across your entire Lexora publishing portfolio." />
      </Helmet>

      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-b border-border/15 bg-background/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-foreground" data-testid="text-analytics-title">
              <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-emerald-300" /> Portfolio Analytics
            </h1>
            <p className="text-[10px] md:text-[11px] font-mono text-muted-foreground/50 mt-1">
              Cross-portfolio performance — production, engagement, and AI spend over time.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-card/60 border border-border/20 rounded-lg p-1 overflow-x-auto max-w-full">
            {TIME_RANGES.map(r => (
              <Button
                key={r.key}
                size="sm"
                variant="ghost"
                className={`h-7 shrink-0 text-[10px] font-mono px-3 ${range === r.key ? "bg-emerald-500/20 text-emerald-200" : "text-muted-foreground/50"}`}
                onClick={() => setRange(r.key)}
                data-testid={`button-range-${r.key}`}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <Card className="border-red-500/20 bg-red-500/5"><CardContent className="py-10 text-center">
          <p className="text-[12px] font-mono text-red-300">Failed to load analytics</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {metricCards.map(m => (
              <Card key={m.label} className="border-border/20 bg-card/30" data-testid={`card-metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-4">
                  <m.icon className={`h-4 w-4 ${m.tone}`} />
                  <p className={`text-xl font-bold mt-2 ${m.tone}`} data-testid={`text-metric-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>{m.value}</p>
                  <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground/40 mt-0.5">{m.label}</p>
                  <p className="text-[9px] font-mono text-muted-foreground/30 mt-0.5">{m.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border/20 bg-card/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-cyan-300">
                  <TrendingUp className="h-4 w-4" /> Production Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthly.length === 0 ? (
                  <div className="h-64 flex items-center justify-center"><p className="text-[11px] font-mono text-muted-foreground/40">No data yet</p></div>
                ) : (
                  <div className="w-full overflow-x-auto pb-1">
                    <div className="h-64 min-w-[560px] sm:min-w-0 w-full" data-testid="chart-production">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <RechartsTooltip contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar yAxisId="left" dataKey="books" name="Books" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="right" dataKey="words" name="Words" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/20 bg-card/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-emerald-300">
                  <Eye className="h-4 w-4" /> Engagement & Spend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthly.length === 0 ? (
                  <div className="h-64 flex items-center justify-center"><p className="text-[11px] font-mono text-muted-foreground/40">No data yet</p></div>
                ) : (
                  <div className="w-full overflow-x-auto pb-1">
                    <div className="h-64 min-w-[560px] sm:min-w-0 w-full" data-testid="chart-engagement">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickFormatter={(v) => `$${v.toFixed(0)}`} />
                        <RechartsTooltip contentStyle={{ background: "rgba(10,10,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line yAxisId="left" type="monotone" dataKey="reads" name="Reads" stroke="#34d399" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="listens" name="Listens" stroke="#f472b6" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="cost" name="Cost ($)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/20 bg-card/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-1.5 text-purple-300">
                <Star className="h-4 w-4" /> Top Books by Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data || data.topBooks.length === 0 ? (
                <div className="py-8 text-center"><p className="text-[11px] font-mono text-muted-foreground/40">No books yet</p></div>
              ) : (
                <div className="space-y-1.5">
                  {data.topBooks.map((b, i) => (
                    <div key={b.id} className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 gap-y-1.5 p-2.5 rounded-lg border border-border/20 bg-card/40" data-testid={`row-topbook-${b.id}`}>
                      <span className="text-[11px] font-mono text-muted-foreground/40 w-5">{i + 1}</span>
                      <span className="text-[12px] text-foreground/85 min-w-0 truncate">{b.title}</span>
                      <span className="col-start-2 sm:col-start-auto text-[10px] font-mono text-emerald-300 flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(b.reads)}</span>
                      <span className="col-start-2 sm:col-start-auto text-[10px] font-mono text-pink-300 flex items-center gap-1"><Headphones className="h-3 w-3" />{formatNumber(b.listens)}</span>
                      <span className="col-start-2 sm:col-start-auto text-[10px] font-mono text-cyan-300/70 flex items-center gap-1 sm:w-20 sm:justify-end"><FileText className="h-3 w-3" />{formatNumber(b.words)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </div>
  );
}
