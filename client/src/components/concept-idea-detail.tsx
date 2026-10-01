import { useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Loader2, Rocket, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IdeaRow {
  id: string;
  status: string;
  sourceType?: string;
  propertyId?: string | null;
  source?: Record<string, any>;
  dossier?: Record<string, any>;
}

interface IdeaDetailResponse {
  dossier: IdeaRow;
  property?: {
    id: string;
    workingTitle: string;
    status: string;
    format: string;
  } | null;
  handoff?: Record<string, any>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-purple-300/65">{title}</div>
      {children}
    </section>
  );
}

function Tags({ values }: { values?: unknown[] }) {
  const items = (Array.isArray(values) ? values : []).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (items.length === 0) return <span className="text-[10px] text-muted-foreground/35">None recorded</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => <Badge key={item} variant="outline" className="text-[8px] font-mono border-border/25 text-muted-foreground/60">{item}</Badge>)}
    </div>
  );
}

export default function ConceptIdeaDetail({
  idea,
  open,
  onOpenChange,
}: {
  idea: IdeaRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const detailUrl = idea ? `/api/concept-lab/dossiers/${idea.id}` : "";
  const { data, isLoading } = useQuery<IdeaDetailResponse>({
    queryKey: [detailUrl],
    enabled: open && Boolean(idea),
  });

  const row = data?.dossier || idea;
  const dossier = (row?.dossier || {}) as Record<string, any>;
  const canDevelop = row?.status === "saved" && row?.sourceType !== "manual-idea" && Boolean(row?.source?.synthesisRunId && row?.source?.directionId);
  const canGreenlight = row?.status === "developing" && row?.sourceType !== "manual-idea";
  const canCreateProject = row?.status === "greenlit" && Boolean(row?.propertyId || data?.property?.id);

  const develop = useMutation({
    mutationFn: async () => {
      if (!row?.source?.synthesisRunId || !row?.source?.directionId) throw new Error("This saved idea is missing its synthesis lineage.");
      const res = await apiRequest("POST", "/api/concept-lab/dossiers/from-direction", {
        synthesisRunId: row.source.synthesisRunId,
        directionId: row.source.directionId,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/concept-lab/ideas"] });
      await queryClient.invalidateQueries({ queryKey: [detailUrl] });
      toast({ title: "Dossier ready", description: "The full concept dossier is now ready for your review." });
    },
    onError: (error: any) => toast({ title: "Could not create dossier", description: error.message, variant: "destructive" }),
  });

  const greenlight = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("Dossier not found");
      const res = await apiRequest("POST", `/api/concept-lab/dossiers/${row.id}/greenlight`, { dossierId: row.id });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/concept-lab/ideas"] });
      await queryClient.invalidateQueries({ queryKey: [detailUrl] });
      toast({ title: "Concept greenlit", description: "The dossier is approved and ready to become a project." });
    },
    onError: (error: any) => toast({ title: "Could not greenlight dossier", description: error.message, variant: "destructive" }),
  });

  const contributions = useMemo(() => Array.isArray(dossier.contributions) ? dossier.contributions : [], [dossier.contributions]);
  const risks = [
    ...(Array.isArray(dossier.risks) ? dossier.risks : []),
    ...(Array.isArray(dossier.intelligence?.redactorConcerns) ? dossier.intelligence.redactorConcerns : []),
  ];
  const research = Array.isArray(dossier.intelligence?.researchRequirements)
    ? dossier.intelligence.researchRequirements
    : [];

  const statusLabel =
    row?.status === "developing" ? "Dossier ready for review"
    : row?.status === "greenlit" ? "Greenlit"
    : row?.status === "saved" ? "Saved idea"
    : row?.status || "Idea";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[96vw] sm:max-w-2xl p-0 bg-background/98 border-border/25">
        <SheetHeader className="px-5 pt-5 pr-12">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <Badge variant="outline" className="text-[8px] font-mono border-purple-500/25 text-purple-300">{statusLabel}</Badge>
            {row?.sourceType && <Badge variant="outline" className="text-[8px] font-mono border-border/25 text-muted-foreground/50">{row.sourceType}</Badge>}
          </div>
          <SheetTitle className="text-xl leading-tight">{dossier.workingTitle || "Untitled idea"}</SheetTitle>
          <SheetDescription className="text-[11px]">
            Full concept intelligence, dossier, director notes, and project handoff.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100dvh-105px)]">
          <div className="px-5 pb-8 pt-4 space-y-5" data-testid="concept-idea-detail">
            {isLoading && <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-purple-400" /></div>}

            {!isLoading && row && (
              <>
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4 space-y-3">
                  <Section title="Generated Idea Summary">
                    <p className="text-[13px] leading-relaxed text-foreground/85">
                      {dossier.identity?.angle || dossier.corePromise || dossier.premise || "No summary recorded."}
                    </p>
                  </Section>
                  {dossier.premise && (
                    <div className="text-[11px] leading-relaxed text-muted-foreground/70">{dossier.premise}</div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Section title="Reader">
                    <p className="text-[11px] text-muted-foreground/70">{dossier.targetReader || dossier.reader?.targetReader || "Not defined"}</p>
                  </Section>
                  <Section title="Core Promise">
                    <p className="text-[11px] text-muted-foreground/70">{dossier.corePromise || dossier.identity?.promise || "Not defined"}</p>
                  </Section>
                  <Section title="Unique Angle">
                    <p className="text-[11px] text-muted-foreground/70">{dossier.uniqueAngle || dossier.identity?.differentiation || "Not defined"}</p>
                  </Section>
                  <Section title="Structure">
                    <p className="text-[11px] text-muted-foreground/70">{dossier.structure?.structuralApproach || dossier.format || "Not defined"}</p>
                  </Section>
                </div>

                <Separator className="bg-border/20" />

                <div className="grid sm:grid-cols-2 gap-4">
                  <Section title="Genres"><Tags values={dossier.genreTags || dossier.content?.genres} /></Section>
                  <Section title="Topics"><Tags values={dossier.topicTags || dossier.content?.topics} /></Section>
                  <Section title="Themes"><Tags values={dossier.themes || dossier.content?.themes} /></Section>
                  <Section title="Tone"><Tags values={dossier.voiceExperience?.tone} /></Section>
                </div>

                {(dossier.intelligence?.oracleFindings || contributions.length > 0) && (
                  <>
                    <Separator className="bg-border/20" />
                    <Section title="Studio Intelligence">
                      {dossier.intelligence?.oracleFindings?.summary && (
                        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
                          <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-cyan-300/65 mb-1">Oracle</div>
                          <p className="text-[10px] leading-relaxed text-cyan-50/70">{dossier.intelligence.oracleFindings.summary}</p>
                        </div>
                      )}
                      <div className="grid gap-2 mt-2">
                        {contributions.map((item: any, index: number) => (
                          <div key={`${item.director || "director"}-${index}`} className="rounded-lg border border-border/20 bg-card/30 p-3">
                            <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-purple-300/60">{item.director || item.role || "Director"}</div>
                            <p className="text-[10px] text-muted-foreground/65 mt-1">{item.summary || item.role || "Contribution recorded."}</p>
                          </div>
                        ))}
                      </div>
                    </Section>
                  </>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <Section title="Risks / Redactor Concerns"><Tags values={risks} /></Section>
                  <Section title="Research Needs"><Tags values={research} /></Section>
                </div>

                <Separator className="bg-border/20" />

                <Section title="Source Lineage">
                  <div className="text-[9px] font-mono text-muted-foreground/45 space-y-1">
                    <p>Dossier ID: {row.id}</p>
                    {row.source?.drawId && <p>Triad draw: {row.source.drawId}</p>}
                    {row.source?.synthesisRunId && <p>Synthesis: {row.source.synthesisRunId}</p>}
                    {row.source?.directionId && <p>Direction: {row.source.directionId}</p>}
                    {(row.propertyId || data?.property?.id) && <p>Property: {row.propertyId || data?.property?.id}</p>}
                    {dossier.projectId && <p>Project: {dossier.projectId}</p>}
                  </div>
                </Section>

                <div className="sticky bottom-0 rounded-xl border border-border/25 bg-background/95 backdrop-blur-xl p-3 flex flex-wrap gap-2">
                  {canDevelop && (
                    <Button onClick={() => develop.mutate()} disabled={develop.isPending} className="h-9 text-[10px] font-mono" data-testid="button-detail-create-dossier">
                      {develop.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
                      Create Dossier
                    </Button>
                  )}
                  {canGreenlight && (
                    <Button onClick={() => greenlight.mutate()} disabled={greenlight.isPending} variant="outline" className="h-9 text-[10px] font-mono border-cyan-500/30 text-cyan-200" data-testid="button-detail-greenlight">
                      {greenlight.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                      Agree & Greenlight
                    </Button>
                  )}
                  {canCreateProject && (
                    <Button onClick={() => setLocation(`/projects/new?dossier=${row.id}`)} className="h-9 text-[10px] font-mono neon-glow text-white" data-testid="button-detail-create-project">
                      <Rocket className="h-3.5 w-3.5 mr-1.5" />
                      Create Project from Dossier
                    </Button>
                  )}
                  {row.sourceType === "manual-idea" && (
                    <p className="text-[9px] font-mono text-muted-foreground/45 self-center">
                      Quick-captured ideas need full Concept Lab development before greenlight.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
