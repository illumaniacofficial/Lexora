import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Sparkles, Shuffle, Lock, Unlock, Wand2, Triangle, Loader2, ChevronDown, ChevronUp, CheckCircle2, Archive, Boxes, FileText, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface ConceptContext {
  audience: string;
  format: string;
  genre: string;
  topic: string;
  tone: string;
  purpose: string;
  ageBand: string;
  maturity: string;
  seriesIntent: string;
  marketObjective: string;
}

interface ConceptDirection {
  id: string;
  workingTitle: string;
  oneLinePremise: string;
  expandedPremise: string;
  targetReader: string;
  readerPromise: string;
  classification: {
    format: string;
    genres: string[];
    subgenres: string[];
    topics: string[];
    themes: string[];
    audience: string;
    ageBand?: string | null;
    maturity?: string | null;
  };
  tone: string[];
  coreConflictOrProblem: string;
  emotionalEngine: string;
  storyOrContentEngine: string;
  structuralApproach: string;
  differentiation: string;
  seriesPotential: string;
  researchNeeds: string[];
  risks: string[];
  oraclePosition: string;
  scribeRationale: string;
  redactorChallenge: string;
  confidence: string;
  evidenceLevel: string;
  marketEvidenceStatus: string;
}

interface OracleAnalysis {
  targetReader: string;
  readerProblemOrDesire: string;
  emotionalPromise: string;
  format: string;
  differentiationAngle: string;
  marketEvidenceStatus: string;
  confidence: string;
  evidenceLevel: string;
  risks: string[];
  unansweredQuestions: string[];
  summary: string;
}

interface DirectorContribution {
  director: string;
  role: string;
  summary: string;
}

interface ConceptSynthesis {
  drawId: string;
  synthesisRunId: string;
  context: ConceptContext;
  oracle: OracleAnalysis;
  directions: ConceptDirection[];
  contributions: DirectorContribution[];
  runtime: { mode: string; location: string; model: string; marketEvidenceStatus: string };
}

interface ConceptDossierRow {
  id: string;
  status: string;
  dossier: { workingTitle?: string | null };
}

interface CreatedProperty {
  id: string;
  workingTitle: string;
  status: string;
  format: string;
}

const EMPTY_CONTEXT: ConceptContext = {
  audience: "",
  format: "",
  genre: "",
  topic: "",
  tone: "",
  purpose: "",
  ageBand: "",
  maturity: "",
  seriesIntent: "",
  marketObjective: "",
};

function contextPayload(context: ConceptContext) {
  const entries = Object.entries(context).filter(([, value]) => value.trim().length > 0);
  return Object.fromEntries(entries);
}

function DirectionCard({
  direction,
  isSelected,
  isSelecting,
  onSelect,
}: {
  direction: ConceptDirection;
  isSelected: boolean;
  isSelecting: boolean;
  onSelect: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Reader", direction.targetReader],
    ["Promise", direction.readerPromise],
    ["Format", direction.classification?.format || ""],
    ["Structure", direction.structuralApproach],
    ["Differentiation", direction.differentiation],
  ];
  return (
    <Card
      className={cn(
        "bg-card/40 transition-all duration-300",
        isSelected
          ? "border-purple-500/50 shadow-[0_0_25px_-10px_rgba(168,85,247,0.5)]"
          : "border-border/25 hover:border-purple-500/25",
      )}
      data-testid={`card-concept-direction-${direction.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-[15px] font-bold leading-snug">{direction.workingTitle}</CardTitle>
          {isSelected && (
            <Badge variant="outline" className="text-[8px] font-mono border-purple-500/40 text-purple-200 shrink-0">
              SELECTED
            </Badge>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground/70 mt-1">{direction.oneLinePremise}</p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="text-[11px] text-muted-foreground/65 leading-relaxed">{direction.expandedPremise}</div>
        <div className="grid gap-1 text-[10px] text-muted-foreground/55">
          {rows.map(([label, value]) => (
            <span key={label}>
              <span className="text-muted-foreground/40">{label}:</span> {value}
            </span>
          ))}
        </div>
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2">
          <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-cyan-300/60 mb-0.5">Scribe rationale</div>
          <p className="text-[10px] text-cyan-100/70">{direction.scribeRationale}</p>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-2">
          <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-rose-300/60 mb-0.5">Redactor challenge</div>
          <p className="text-[10px] text-rose-100/70">{direction.redactorChallenge}</p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="outline" className="text-[8px] font-mono border-border/30 text-muted-foreground/50">
            {direction.confidence} confidence · {direction.evidenceLevel} evidence
          </Badge>
          <Button
            size="sm"
            variant={isSelected ? "default" : "outline"}
            className="h-7 text-[10px] font-mono shrink-0"
            onClick={onSelect}
            disabled={isSelecting}
            data-testid={`button-select-direction-${direction.id}`}
          >
            {isSelected ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
            {isSelected ? "Selected" : "Select"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConceptFlow({
  selectedDirectionId,
  dossier,
  property,
  isCreatingDossier,
  isGreenlighting,
  onCreateDossier,
  onGreenlight,
}: {
  selectedDirectionId: string | null;
  dossier: ConceptDossierRow | null;
  property: CreatedProperty | null;
  isCreatingDossier: boolean;
  isGreenlighting: boolean;
  onCreateDossier: () => void;
  onGreenlight: () => void;
}) {
  if (!selectedDirectionId) return null;
  return (
    <div className="mt-5 rounded-xl border border-purple-500/25 bg-purple-500/5 px-4 py-4" data-testid="section-concept-flow">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-purple-300/70 mb-3">
        <Boxes className="h-3.5 w-3.5" />
        Greenlight Flow
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onCreateDossier}
          disabled={isCreatingDossier || Boolean(dossier)}
          variant={dossier ? "secondary" : "default"}
          className="gap-2 h-8 text-[11px] neon-glow text-white"
          data-testid="button-create-dossier"
        >
          {isCreatingDossier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          {dossier ? "Dossier Created" : "Create Concept Dossier"}
        </Button>

        {dossier && (
          <Button
            onClick={onGreenlight}
            disabled={isGreenlighting || Boolean(property)}
            variant={property ? "secondary" : "outline"}
            className="gap-2 h-8 text-[11px] border-cyan-500/30 text-cyan-200 hover:border-cyan-500/50"
            data-testid="button-create-property"
          >
            {isGreenlighting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {property ? "Property Created" : "Greenlight → Property"}
          </Button>
        )}
      </div>

      {dossier && (
        <div className="mt-3 text-[10px] font-mono text-muted-foreground/55">
          Dossier: {dossier.dossier?.workingTitle || dossier.id} · status {dossier.status}
        </div>
      )}
      {property && (
        <div className="mt-2 text-[11px] text-cyan-200/80">
          Property created: <span className="font-semibold">{property.workingTitle}</span> ({property.format}, {property.status})
        </div>
      )}
    </div>
  );
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
  const [context, setContext] = useState<ConceptContext>(EMPTY_CONTEXT);
  const [showContext, setShowContext] = useState(false);
  const [synthesis, setSynthesis] = useState<ConceptSynthesis | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ConceptDossierRow | null>(null);
  const [property, setProperty] = useState<CreatedProperty | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

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
        context: contextPayload(context),
      });
      return res.json() as Promise<TriadDraw>;
    },
    onSuccess: (result) => {
      setCurrent(result);
      setSynthesis(null);
      setSelectedDirectionId(null);
      setDossier(null);
      setProperty(null);
      setFlowError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/concept-lab/triad"] });
    },
  });

  const synthesize = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Draw the Triad first");
      const res = await apiRequest("POST", "/api/concept-lab/triad/synthesize", {
        drawId: current.id,
        context: contextPayload(context),
      });
      return res.json() as Promise<ConceptSynthesis>;
    },
    onSuccess: (result) => {
      setSynthesis(result);
      setSelectedDirectionId(null);
      setDossier(null);
      setProperty(null);
      setFlowError(null);
    },
    onError: (error: any) => setFlowError(error?.message || "Synthesis failed"),
  });

  const selectDirection = useMutation({
    mutationFn: async (direction: ConceptDirection) => {
      if (!synthesis) throw new Error("No synthesis to select from");
      const res = await apiRequest(
        "POST",
        `/api/concept-lab/triad/synthesis/${synthesis.synthesisRunId}/select`,
        { directionId: direction.id },
      );
      return res.json() as Promise<unknown>;
    },
    onSuccess: (_result, direction) => {
      setSelectedDirectionId(direction.id);
      setDossier(null);
      setProperty(null);
      setFlowError(null);
    },
    onError: (error: any) => setFlowError(error?.message || "Could not select direction"),
  });

  const createDossier = useMutation({
    mutationFn: async () => {
      if (!synthesis || !selectedDirectionId) throw new Error("Select a direction first");
      const res = await apiRequest("POST", "/api/concept-lab/dossiers/from-direction", {
        synthesisRunId: synthesis.synthesisRunId,
        directionId: selectedDirectionId,
      });
      return res.json() as Promise<ConceptDossierRow>;
    },
    onSuccess: (result) => {
      setDossier(result);
      setFlowError(null);
    },
    onError: (error: any) => setFlowError(error?.message || "Could not create dossier"),
  });

  const greenlightDossier = useMutation({
    mutationFn: async () => {
      if (!dossier) throw new Error("Create a dossier first");
      const res = await apiRequest("POST", `/api/concept-lab/dossiers/${dossier.id}/greenlight`, {
        dossierId: dossier.id,
      });
      const payload = await res.json() as { property: CreatedProperty };
      return payload.property;
    },
    onSuccess: (created) => {
      setProperty(created);
      setFlowError(null);
    },
    onError: (error: any) => setFlowError(error?.message || "Could not create Property"),
  });

  const toggleLock = (axis: Axis) => {
    setLocked((previous) => {
      const next = new Set(previous);
      if (next.has(axis)) next.delete(axis);
      else next.add(axis);
      return next;
    });
  };

  const updateContext = (key: keyof ConceptContext, value: string) => {
    setContext((previous) => ({ ...previous, [key]: value }));
  };

  const contextFieldCount = Object.values(context).filter((value) => value.trim().length > 0).length;

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

        <div className="rounded-xl border border-border/25 bg-card/30 mb-5">
          <button
            type="button"
            onClick={() => setShowContext((previous) => !previous)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            data-testid="button-toggle-concept-context"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-purple-400/70" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-purple-300/70">
                Concept Context
              </span>
              <Badge variant="outline" className="text-[8px] font-mono border-border/30 text-muted-foreground/50">
                {contextFieldCount > 0 ? `${contextFieldCount} set` : "optional"}
              </Badge>
            </div>
            {showContext ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
          </button>

          {showContext && (
            <div className="px-4 pb-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {([
                ["audience", "Audience"],
                ["format", "Format"],
                ["genre", "Genre"],
                ["topic", "Topic"],
                ["tone", "Tone"],
                ["purpose", "Purpose"],
                ["ageBand", "Age band"],
                ["maturity", "Maturity"],
                ["seriesIntent", "Series intent"],
              ] as Array<[keyof ConceptContext, string]>).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40" htmlFor={`concept-context-${key}`}>
                    {label}
                  </label>
                  <Input
                    id={`concept-context-${key}`}
                    value={context[key]}
                    onChange={(event) => updateContext(key, event.target.value)}
                    placeholder={label}
                    className="h-8 mt-1 bg-white/[0.03] border-border/20 text-[12px]"
                    data-testid={`input-concept-context-${key}`}
                  />
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40" htmlFor="concept-context-marketObjective">
                  Market objective
                </label>
                <Textarea
                  id="concept-context-marketObjective"
                  value={context.marketObjective}
                  onChange={(event) => updateContext("marketObjective", event.target.value)}
                  placeholder="What should this concept achieve in the market?"
                  className="mt-1 min-h-[60px] resize-none bg-white/[0.03] border-border/20 text-[12px]"
                  data-testid="input-concept-context-marketObjective"
                />
              </div>
              <p className="sm:col-span-2 lg:col-span-3 text-[10px] text-muted-foreground/45">
                Context weights Intelligent Draw and informs Oracle. Pure Chaos stays broad and random.
              </p>
            </div>
          )}
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
          {current && (
            <Button
              onClick={() => synthesize.mutate()}
              disabled={synthesize.isPending}
              variant="outline"
              className="gap-2 border-purple-500/30 text-purple-200 hover:border-purple-500/50"
              data-testid="button-triad-synthesize"
            >
              {synthesize.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Synthesize
            </Button>
          )}
        </div>

        {flowError && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300" data-testid="text-concept-flow-error">
            {flowError}
          </div>
        )}

        {current && !synthesis && (
          <div className="mt-8 border-t border-border/20 pt-5">
            <div className="flex items-center gap-2 text-[10px] font-mono text-purple-400/60 uppercase tracking-[0.2em]">
              <Wand2 className="h-3.5 w-3.5" />
              Next
            </div>
            <p className="text-sm text-muted-foreground/60 mt-2">
              Synthesize to let Oracle, Scribe, and Redactor turn these cards into 3–5 serious concept directions. Every direction is preserved.
            </p>
          </div>
        )}

        {synthesis && (
          <div className="mt-8 border-t border-border/20 pt-5" data-testid="section-concept-synthesis">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-[10px] font-mono text-purple-400/70 uppercase tracking-[0.2em]">
                <Wand2 className="h-3.5 w-3.5" />
                Concept Directions
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[8px] font-mono border-purple-500/20 text-purple-300/70">
                  {synthesis.runtime?.location === "local" ? "local" : "cloud"} · {synthesis.runtime?.model}
                </Badge>
                <Badge variant="outline" className="text-[8px] font-mono border-border/30 text-muted-foreground/50">
                  evidence: {synthesis.oracle?.marketEvidenceStatus || "not-requested"}
                </Badge>
                <Badge variant="outline" className="text-[8px] font-mono border-border/30 text-muted-foreground/50">
                  {synthesis.directions.length} directions
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-border/25 bg-card/30 px-4 py-3 mb-5">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">Oracle</div>
              <p className="text-[12px] text-muted-foreground/75 leading-relaxed">{synthesis.oracle?.summary}</p>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-3 text-[10px] text-muted-foreground/55">
                <span>Reader: {synthesis.oracle?.targetReader}</span>
                <span>Promise: {synthesis.oracle?.emotionalPromise}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {synthesis.directions.map((direction) => (
                <DirectionCard
                  key={direction.id}
                  direction={direction}
                  isSelected={selectedDirectionId === direction.id}
                  isSelecting={selectDirection.isPending}
                  onSelect={() => selectDirection.mutate(direction)}
                />
              ))}
            </div>

            {selectedDirectionId && (
              <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
                <Archive className="h-3 w-3" />
                Alternatives are archived, never deleted. All directions remain recoverable.
              </div>
            )}

            <ConceptFlow
              selectedDirectionId={selectedDirectionId}
              dossier={dossier}
              property={property}
              isCreatingDossier={createDossier.isPending}
              isGreenlighting={greenlightDossier.isPending}
              onCreateDossier={() => createDossier.mutate()}
              onGreenlight={() => greenlightDossier.mutate()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
