import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Sparkles, Shuffle, Lock, Unlock, Wand2, Triangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Axis = "who" | "what" | "how";
type Mode = "pure-chaos" | "intelligent-draw" | "forbidden-combination";

interface TriadCard {
  id: string;
  axis: Axis;
  label: string;
  text: string;
  tags: string[];
  source: string;
}

interface TriadDraw {
  id: string;
  mode: Mode;
  whoCard: TriadCard;
  whatCard: TriadCard;
  howCard: TriadCard;
  lockedAxes: Axis[];
  wildcards: string[];
  status: string;
  createdAt: string;
  synthesisRequired?: boolean;
  law?: string;
}

interface TriadState {
  deck: { who: number; what: number; how: number; wildcards: number };
  recent: TriadDraw[];
  law: string;
}

const modes: Array<{ id: Mode; title: string; description: string }> = [
  { id: "pure-chaos", title: "Pure Chaos", description: "All cards are equally possible." },
  { id: "intelligent-draw", title: "Intelligent Draw", description: "Oracle-weighted once market context is attached." },
  { id: "forbidden-combination", title: "Forbidden", description: "Forces an unlikely combination and makes Scribe earn it." },
];

export default function ConceptLab() {
  const [mode, setMode] = useState<Mode>("pure-chaos");
  const [current, setCurrent] = useState<TriadDraw | null>(null);
  const [locked, setLocked] = useState<Set<Axis>>(new Set());

  const { data } = useQuery<TriadState>({
    queryKey: ["/api/concept-lab/triad"],
  });

  const draw = useMutation({
    mutationFn: async () => {
      const lockedCards: Partial<Record<Axis, TriadCard>> = {};
      if (current) {
        if (locked.has("who")) lockedCards.who = current.whoCard;
        if (locked.has("what")) lockedCards.what = current.whatCard;
        if (locked.has("how")) lockedCards.how = current.howCard;
      }
      const res = await apiRequest("POST", "/api/concept-lab/triad/draw", {
        mode,
        locked: lockedCards,
      });
      return res.json() as Promise<TriadDraw>;
    },
    onSuccess: (result) => {
      setCurrent(result);
      queryClient.invalidateQueries({ queryKey: ["/api/concept-lab/triad"] });
    },
  });

  const toggleLock = (axis: Axis) => {
    setLocked((previous) => {
      const next = new Set(previous);
      if (next.has(axis)) next.delete(axis);
      else next.add(axis);
      return next;
    });
  };

  const cards: Array<{ axis: Axis; label: string; card?: TriadCard }> = [
    { axis: "who", label: "I — WHO", card: current?.whoCard },
    { axis: "what", label: "II — WHAT", card: current?.whatCard },
    { axis: "how", label: "III — HOW", card: current?.howCard },
  ];

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8 py-6 md:py-8" data-testid="page-concept-lab">
      <Helmet>
        <title>Concept Lab | Lexora</title>
      </Helmet>

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-purple-400/70 text-[10px] font-mono uppercase tracking-[0.2em] mb-2">
              <Triangle className="h-3.5 w-3.5" />
              Concept Lab
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">The <span className="shimmer-text">Triad</span></h1>
            <p className="text-sm text-muted-foreground/60 mt-2 max-w-2xl">
              Draw WHO, WHAT, and HOW. The studio must attempt a serious synthesis before a combination can be discarded.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[9px] border-purple-500/20 text-purple-300/70">
            {data?.law || "NO DISCARD BEFORE SYNTHESIS"}
          </Badge>
        </div>

        <div className="grid md:grid-cols-3 gap-2.5 mb-5">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                "text-left rounded-xl border p-3 transition-all",
                mode === item.id
                  ? "border-purple-500/40 bg-purple-500/10"
                  : "border-border/25 bg-card/30 hover:border-purple-500/20"
              )}
              data-testid={`triad-mode-${item.id}`}
            >
              <div className="text-[12px] font-semibold">{item.title}</div>
              <div className="text-[10px] text-muted-foreground/50 mt-1">{item.description}</div>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {cards.map(({ axis, label, card }, index) => {
            const isLocked = locked.has(axis);
            return (
              <Card
                key={axis}
                className={cn(
                  "min-h-[240px] bg-card/40 transition-all duration-300",
                  isLocked ? "border-amber-500/30" : "border-purple-500/20"
                )}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-mono text-[10px] tracking-[0.2em] text-purple-300/60">{label}</CardTitle>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn("h-7 w-7", isLocked ? "text-amber-400" : "text-muted-foreground/40")}
                      onClick={() => toggleLock(axis)}
                      disabled={!card}
                      aria-label={isLocked ? `Unlock ${axis}` : `Lock ${axis}`}
                    >
                      {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col min-h-[165px]">
                  {card ? (
                    <>
                      <div className="text-lg font-bold tracking-tight mb-2">{card.label}</div>
                      <p className="text-[13px] text-muted-foreground/75 leading-relaxed flex-1">{card.text}</p>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {card.tags.slice(0, 5).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[8px] font-mono border-border/30 text-muted-foreground/50">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center text-muted-foreground/25 font-mono text-xs">
                      DRAW TO REVEAL
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {current?.wildcards && current.wildcards.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-amber-400/70 mb-1">Wildcard</div>
            <div className="font-semibold text-amber-200">{current.wildcards.join(" · ")}</div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button
            onClick={() => draw.mutate()}
            disabled={draw.isPending}
            className="gap-2 neon-glow text-white"
            data-testid="button-triad-draw"
          >
            {draw.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : current ? <Shuffle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {current ? "Draw Again" : "Draw the Triad"}
          </Button>
          {current && (
            <div className="text-[10px] font-mono text-muted-foreground/45">
              Lock any card, then draw again to keep it while changing the others.
            </div>
          )}
        </div>

        {current && (
          <div className="mt-8 border-t border-border/20 pt-5">
            <div className="flex items-center gap-2 text-[10px] font-mono text-purple-400/60 uppercase tracking-[0.2em]">
              <Wand2 className="h-3.5 w-3.5" />
              Next
            </div>
            <p className="text-sm text-muted-foreground/60 mt-2">
              Oracle + Scribe synthesis is the next connection: the cards become several coherent concept directions instead of being treated as random words.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
