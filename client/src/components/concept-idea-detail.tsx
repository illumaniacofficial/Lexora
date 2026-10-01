import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  FileText,
  GitBranch,
  Loader2,
  Rocket,
  Save,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LANGUAGE_LABELS, VERTICAL_LABELS } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LANGUAGES, VERTICALS, type Language, type Vertical } from "@shared/schema";

interface IdeaRow {
  id: string;
  status: string;
  sourceType?: string;
  propertyId?: string | null;
  source?: Record<string, any>;
  dossier?: Record<string, any>;
}

interface ProjectHandoff {
  dossierId: string;
  propertyId: string | null;
  status: string;
  title: string;
  description: string;
  targetAudience: string;
  toneStyle: string;
  keyThemes: string;
  comparableTitles: string;
  avoid: string;
  genres: Vertical[];
  vertical: Vertical;
  targetLanguage: Language;
  handoffEditedAt?: string | null;
  summary?: {
    oneLine?: string;
    corePromise?: string;
    uniqueAngle?: string;
    oracleSummary?: string;
    format?: string;
  };
}

interface IdeaDetailResponse {
  dossier: IdeaRow;
  property?: {
    id: string;
    workingTitle: string;
    status: string;
    format: string;
  } | null;
  handoff?: ProjectHandoff;
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
  const items = (Array.isArray(values) ? values : []).filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (items.length === 0) {
    return <span className="text-[10px] text-muted-foreground/35">None recorded</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="text-[8px] font-mono border-border/25 text-muted-foreground/60">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/45">{children}</label>;
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
  const [handoffDraft, setHandoffDraft] = useState<ProjectHandoff | null>(null);
  const [genreToAdd, setGenreToAdd] = useState<string>("");

  const detailUrl = idea ? `/api/concept-lab/dossiers/${idea.id}` : "";
  const { data, isLoading } = useQuery<IdeaDetailResponse>({
    queryKey: [detailUrl],
    enabled: open && Boolean(idea),
  });

  const row = data?.dossier || idea;
  const dossier = (row?.dossier || {}) as Record<string, any>;
  const canDevelop =
    row?.status === "saved" &&
    row?.sourceType !== "manual-idea" &&
    Boolean(row?.source?.synthesisRunId && row?.source?.directionId);
  const canGreenlight = row?.status === "developing" && row?.sourceType !== "manual-idea";
  const alreadyProject = Boolean(dossier.projectId);

  useEffect(() => {
    if (!data?.handoff) return;
    setHandoffDraft({ ...data.handoff, genres: [...(data.handoff.genres || [])] });
  }, [data?.dossier?.id, data?.dossier?.status, data?.handoff?.handoffEditedAt]);

  const develop = useMutation({
    mutationFn: async () => {
      if (!row?.source?.synthesisRunId || !row?.source?.directionId) {
        throw new Error("This saved idea is missing its synthesis lineage.");
      }
      const res = await apiRequest("POST", "/api/concept-lab/dossiers/from-direction", {
        synthesisRunId: row.source.synthesisRunId,
        directionId: row.source.directionId,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/concept-lab/ideas"] });
      await queryClient.invalidateQueries({ queryKey: [detailUrl] });
      toast({ title: "Dossier ready", description: "The concept dossier is ready for review." });
    },
    onError: (error: any) =>
      toast({ title: "Could not build dossier", description: error.message, variant: "destructive" }),
  });

  const greenlight = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("Dossier not found");
      const res = await apiRequest("POST", `/api/concept-lab/dossiers/${row.id}/greenlight`, {
        dossierId: row.id,
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/concept-lab/ideas"] });
      await queryClient.invalidateQueries({ queryKey: [detailUrl] });
      toast({ title: "Concept greenlit", description: "This concept is approved for project creation." });
    },
    onError: (error: any) =>
      toast({ title: "Could not greenlight dossier", description: error.message, variant: "destructive" }),
  });

  const handoffPayload = () => {
    if (!handoffDraft) throw new Error("Project handoff is not ready.");
    return {
      title: handoffDraft.title,
      description: handoffDraft.description,
      targetAudience: handoffDraft.targetAudience,
      toneStyle: handoffDraft.toneStyle,
      keyThemes: handoffDraft.keyThemes,
      comparableTitles: handoffDraft.comparableTitles,
      avoid: handoffDraft.avoid,
      genres: handoffDraft.genres,
      vertical: handoffDraft.vertical,
      targetLanguage: handoffDraft.targetLanguage,
    };
  };

  const saveHandoff = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("Dossier not found");
      const res = await apiRequest("PUT", `/api/concept-lab/dossiers/${row.id}/handoff`, handoffPayload());
      return res.json();
    },
    onSuccess: async (payload) => {
      if (payload?.handoff) setHandoffDraft(payload.handoff);
      await queryClient.invalidateQueries({ queryKey: [detailUrl] });
      toast({
        title: "Project handoff saved",
        description: "The Project Creator mapping is saved without rewriting the original dossier.",
      });
    },
    onError: (error: any) =>
      toast({ title: "Could not save handoff", description: error.message, variant: "destructive" }),
  });

  const sendToProjectCreator = useMutation({
    mutationFn: async () => {
      if (!row || row.sourceType === "manual-idea") {
        throw new Error("Develop this quick-captured idea into a full Concept Lab dossier first.");
      }
      if (alreadyProject && dossier.projectId) return { projectId: dossier.projectId as number, dossierId: row.id };

      let status = row.status;
      if (status === "saved") {
        if (!row.source?.synthesisRunId || !row.source?.directionId) {
          throw new Error("This idea is missing its synthesis lineage.");
        }
        const developedRes = await apiRequest("POST", "/api/concept-lab/dossiers/from-direction", {
          synthesisRunId: row.source.synthesisRunId,
          directionId: row.source.directionId,
        });
        const developed = await developedRes.json();
        status = developed.status;
      }

      await apiRequest("PUT", `/api/concept-lab/dossiers/${row.id}/handoff`, handoffPayload());

      if (status !== "greenlit") {
        await apiRequest("POST", `/api/concept-lab/dossiers/${row.id}/greenlight`, { dossierId: row.id });
      }
      return { projectId: null, dossierId: row.id };
    },
    onSuccess: async ({ projectId, dossierId }) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/concept-lab/ideas"] });
      onOpenChange(false);
      setLocation(projectId ? `/projects/${projectId}` : `/projects/new?dossier=${dossierId}`);
    },
    onError: (error: any) =>
      toast({ title: "Could not send to Project Creator", description: error.message, variant: "destructive" }),
  });

  const contributions = useMemo(
    () => (Array.isArray(dossier.contributions) ? dossier.contributions : []),
    [dossier.contributions],
  );
  const risks = [
    ...(Array.isArray(dossier.risks) ? dossier.risks : []),
    ...(Array.isArray(dossier.intelligence?.redactorConcerns)
      ? dossier.intelligence.redactorConcerns
      : []),
  ];
  const research = Array.isArray(dossier.intelligence?.researchRequirements)
    ? dossier.intelligence.researchRequirements
    : [];

  const statusLabel =
    row?.status === "developing"
      ? "Dossier ready"
      : row?.status === "greenlit"
        ? "Greenlit"
        : row?.status === "saved"
          ? "Saved idea"
          : row?.status || "Idea";

  const lifecycleStep = alreadyProject ? 4 : row?.status === "greenlit" ? 3 : row?.status === "developing" ? 2 : 1;

  const addGenre = (genre: Vertical) => {
    if (!handoffDraft || handoffDraft.genres.includes(genre) || handoffDraft.genres.length >= 6) return;
    setHandoffDraft({ ...handoffDraft, genres: [...handoffDraft.genres, genre] });
    setGenreToAdd("");
  };

  const removeGenre = (genre: Vertical) => {
    if (!handoffDraft || handoffDraft.genres.length <= 1) return;
    const next = handoffDraft.genres.filter((item) => item !== genre);
    setHandoffDraft({
      ...handoffDraft,
      genres: next,
      vertical: handoffDraft.vertical === genre ? next[0] : handoffDraft.vertical,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen sm:w-[94vw] sm:max-w-4xl p-0 bg-background/98 border-border/25 overflow-hidden"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="shrink-0 border-b border-border/15 bg-background/95 px-4 sm:px-6 pt-5 pb-4 pr-12 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <Badge variant="outline" className="text-[8px] font-mono border-purple-500/25 text-purple-300">
                {statusLabel}
              </Badge>
              {row?.sourceType && (
                <Badge variant="outline" className="text-[8px] font-mono border-border/25 text-muted-foreground/50">
                  {row.sourceType}
                </Badge>
              )}
              {(row?.propertyId || data?.property?.id) && (
                <Badge variant="outline" className="text-[8px] font-mono border-cyan-500/25 text-cyan-300">
                  PROPERTY LINKED
                </Badge>
              )}
            </div>
            <SheetTitle className="text-xl sm:text-2xl leading-tight pr-2">
              {dossier.workingTitle || handoffDraft?.title || "Untitled idea"}
            </SheetTitle>
            <SheetDescription className="text-[10px] sm:text-[11px]">
              Review the concept, dossier, studio intelligence, and exactly what will be sent into Project Creator.
            </SheetDescription>

            <div className="grid grid-cols-4 gap-1.5 pt-3" data-testid="concept-lifecycle">
              {[
                ["Idea", 1],
                ["Dossier", 2],
                ["Greenlight", 3],
                ["Project", 4],
              ].map(([label, step]) => {
                const active = Number(step) <= lifecycleStep;
                return (
                  <div key={String(label)} className="space-y-1">
                    <div className={`h-1 rounded-full ${active ? "bg-gradient-to-r from-purple-500 to-cyan-400" : "bg-border/25"}`} />
                    <p className={`text-[7px] sm:text-[8px] font-mono uppercase text-center ${active ? "text-foreground/65" : "text-muted-foreground/30"}`}>
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          </SheetHeader>

          <Tabs defaultValue="overview" className="flex flex-1 min-h-0 flex-col">
            <div className="shrink-0 overflow-x-auto border-b border-border/15 bg-card/20 px-3 sm:px-5">
              <TabsList className="h-11 w-max min-w-full justify-start gap-1 rounded-none bg-transparent p-0">
                <TabsTrigger value="overview" className="h-9 text-[9px] sm:text-[10px] font-mono">
                  <BookOpen className="h-3 w-3 mr-1.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="dossier" className="h-9 text-[9px] sm:text-[10px] font-mono">
                  <FileText className="h-3 w-3 mr-1.5" /> Dossier
                </TabsTrigger>
                <TabsTrigger value="intelligence" className="h-9 text-[9px] sm:text-[10px] font-mono">
                  <Brain className="h-3 w-3 mr-1.5" /> Intelligence
                </TabsTrigger>
                <TabsTrigger value="handoff" className="h-9 text-[9px] sm:text-[10px] font-mono">
                  <Rocket className="h-3 w-3 mr-1.5" /> Project Handoff
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 sm:px-6 py-5 pb-28" data-testid="concept-idea-detail">
                {isLoading && (
                  <div className="py-16 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-purple-400" />
                  </div>
                )}

                {!isLoading && row && (
                  <>
                    <TabsContent value="overview" className="mt-0 space-y-5">
                      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.08] via-card/30 to-cyan-500/[0.04] p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <Target className="h-5 w-5 text-purple-300 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-purple-300/65">
                              Generated Idea Summary
                            </p>
                            <p className="text-[14px] sm:text-[15px] leading-relaxed text-foreground/90 mt-2">
                              {dossier.identity?.angle || dossier.corePromise || dossier.premise || "No summary recorded."}
                            </p>
                            {dossier.premise && (
                              <p className="text-[11px] sm:text-[12px] leading-relaxed text-muted-foreground/65 mt-3">
                                {dossier.premise}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        {[
                          ["Target Reader", dossier.targetReader || dossier.reader?.targetReader || "Not defined"],
                          ["Core Promise", dossier.corePromise || dossier.identity?.promise || "Not defined"],
                          ["Unique Angle", dossier.uniqueAngle || dossier.identity?.differentiation || "Not defined"],
                          ["Format / Structure", dossier.structure?.structuralApproach || dossier.format || "Not defined"],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-xl border border-border/20 bg-card/30 p-3.5">
                            <p className="text-[8px] font-mono uppercase tracking-[0.16em] text-muted-foreground/40">{label}</p>
                            <p className="text-[11px] leading-relaxed text-foreground/75 mt-1.5">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <Section title="Genres"><Tags values={dossier.genreTags || dossier.content?.genres} /></Section>
                        <Section title="Themes"><Tags values={dossier.themes || dossier.content?.themes} /></Section>
                        <Section title="Topics"><Tags values={dossier.topicTags || dossier.content?.topics} /></Section>
                        <Section title="Tone"><Tags values={dossier.voiceExperience?.tone} /></Section>
                      </div>
                    </TabsContent>

                    <TabsContent value="dossier" className="mt-0 space-y-5">
                      <Section title="Premise">
                        <div className="rounded-xl border border-border/20 bg-card/30 p-4 text-[12px] leading-relaxed text-foreground/75">
                          {dossier.premise || "No premise recorded."}
                        </div>
                      </Section>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <Section title="Reader Desired Feelings"><Tags values={dossier.reader?.desiredFeelings} /></Section>
                        <Section title="Subgenres"><Tags values={dossier.content?.subgenres} /></Section>
                        <Section title="Risks / Redactor Concerns"><Tags values={risks} /></Section>
                        <Section title="Research Needs"><Tags values={research} /></Section>
                      </div>

                      <Section title="Structure">
                        <div className="rounded-xl border border-border/20 bg-card/30 p-4 text-[11px] leading-relaxed text-muted-foreground/70">
                          {dossier.structure?.structuralApproach || dossier.structure?.intendedFormat || dossier.format || "No structure recorded."}
                        </div>
                      </Section>
                    </TabsContent>

                    <TabsContent value="intelligence" className="mt-0 space-y-5">
                      {dossier.intelligence?.oracleFindings?.summary && (
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4">
                          <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-cyan-300/70 mb-2">Oracle</div>
                          <p className="text-[11px] sm:text-[12px] leading-relaxed text-cyan-50/75">
                            {dossier.intelligence.oracleFindings.summary}
                          </p>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-3">
                        {contributions.map((item: any, index: number) => (
                          <div key={`${item.director || "director"}-${index}`} className="rounded-xl border border-border/20 bg-card/30 p-4">
                            <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-purple-300/60">
                              {item.director || item.role || "Director"}
                            </div>
                            <p className="text-[10px] sm:text-[11px] leading-relaxed text-muted-foreground/65 mt-2">
                              {item.summary || item.role || "Contribution recorded."}
                            </p>
                          </div>
                        ))}
                      </div>

                      <Separator className="bg-border/20" />
                      <Section title="Source Lineage">
                        <div className="rounded-xl border border-border/20 bg-card/20 p-4 text-[9px] font-mono text-muted-foreground/45 space-y-1.5">
                          <p>Dossier: {row.id}</p>
                          {row.source?.drawId && <p>Triad draw: {row.source.drawId}</p>}
                          {row.source?.synthesisRunId && <p>Synthesis: {row.source.synthesisRunId}</p>}
                          {row.source?.directionId && <p>Direction: {row.source.directionId}</p>}
                          {(row.propertyId || data?.property?.id) && <p>Property: {row.propertyId || data?.property?.id}</p>}
                          {dossier.projectId && <p>Project: {dossier.projectId}</p>}
                        </div>
                      </Section>
                    </TabsContent>

                    <TabsContent value="handoff" className="mt-0 space-y-5">
                      {row.sourceType === "manual-idea" ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
                          <p className="text-[11px] text-amber-100/75">
                            Quick-captured ideas need full Concept Lab development before they can be sent to Project Creator.
                          </p>
                        </div>
                      ) : handoffDraft ? (
                        <>
                          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
                            <div className="flex items-start gap-2">
                              <GitBranch className="h-4 w-4 text-cyan-300 mt-0.5" />
                              <div>
                                <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-cyan-300/70">
                                  Project Creator Payload
                                </p>
                                <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 mt-1">
                                  Edit what Lexora should pass forward. These overrides stay separate from the original dossier.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <FieldLabel>Working Title</FieldLabel>
                            <Input
                              value={handoffDraft.title}
                              onChange={(e) => setHandoffDraft({ ...handoffDraft, title: e.target.value })}
                              className="mt-1.5 bg-card/30 border-border/20"
                              data-testid="input-handoff-title"
                            />
                          </div>

                          <div>
                            <FieldLabel>Book Premise / Description</FieldLabel>
                            <Textarea
                              value={handoffDraft.description}
                              onChange={(e) => setHandoffDraft({ ...handoffDraft, description: e.target.value })}
                              className="mt-1.5 min-h-28 bg-card/30 border-border/20 resize-y"
                              data-testid="input-handoff-description"
                            />
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <FieldLabel>Target Audience</FieldLabel>
                              <Textarea
                                value={handoffDraft.targetAudience}
                                onChange={(e) => setHandoffDraft({ ...handoffDraft, targetAudience: e.target.value })}
                                className="mt-1.5 min-h-20 bg-card/30 border-border/20 resize-y"
                              />
                            </div>
                            <div>
                              <FieldLabel>Tone & Style</FieldLabel>
                              <Textarea
                                value={handoffDraft.toneStyle}
                                onChange={(e) => setHandoffDraft({ ...handoffDraft, toneStyle: e.target.value })}
                                className="mt-1.5 min-h-20 bg-card/30 border-border/20 resize-y"
                              />
                            </div>
                            <div>
                              <FieldLabel>Key Themes</FieldLabel>
                              <Textarea
                                value={handoffDraft.keyThemes}
                                onChange={(e) => setHandoffDraft({ ...handoffDraft, keyThemes: e.target.value })}
                                className="mt-1.5 min-h-20 bg-card/30 border-border/20 resize-y"
                              />
                            </div>
                            <div>
                              <FieldLabel>Comparable Titles</FieldLabel>
                              <Textarea
                                value={handoffDraft.comparableTitles}
                                onChange={(e) => setHandoffDraft({ ...handoffDraft, comparableTitles: e.target.value })}
                                className="mt-1.5 min-h-20 bg-card/30 border-border/20 resize-y"
                              />
                            </div>
                          </div>

                          <div>
                            <FieldLabel>Things to Avoid</FieldLabel>
                            <Textarea
                              value={handoffDraft.avoid}
                              onChange={(e) => setHandoffDraft({ ...handoffDraft, avoid: e.target.value })}
                              className="mt-1.5 min-h-20 bg-card/30 border-border/20 resize-y"
                            />
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <FieldLabel>Primary Genre</FieldLabel>
                              <Select
                                value={handoffDraft.vertical}
                                onValueChange={(value) => {
                                  const genre = value as Vertical;
                                  const genres = handoffDraft.genres.includes(genre)
                                    ? handoffDraft.genres
                                    : [genre, ...handoffDraft.genres].slice(0, 6);
                                  setHandoffDraft({ ...handoffDraft, vertical: genre, genres });
                                }}
                              >
                                <SelectTrigger className="mt-1.5 bg-card/30 border-border/20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {handoffDraft.genres.map((genre) => (
                                    <SelectItem key={genre} value={genre}>{VERTICAL_LABELS[genre] || genre}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <FieldLabel>Language</FieldLabel>
                              <Select
                                value={handoffDraft.targetLanguage}
                                onValueChange={(value) =>
                                  setHandoffDraft({ ...handoffDraft, targetLanguage: value as Language })
                                }
                              >
                                <SelectTrigger className="mt-1.5 bg-card/30 border-border/20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {LANGUAGES.map((language) => (
                                    <SelectItem key={language} value={language}>{LANGUAGE_LABELS[language] || language}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <FieldLabel>Genre Blend</FieldLabel>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {handoffDraft.genres.map((genre) => (
                                <button
                                  key={genre}
                                  type="button"
                                  onClick={() => removeGenre(genre)}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[9px] font-mono transition-colors ${genre === handoffDraft.vertical ? "border-amber-400/35 bg-amber-400/10 text-amber-200" : "border-border/25 bg-card/30 text-muted-foreground/65 hover:border-red-500/30"}`}
                                  title={handoffDraft.genres.length > 1 ? "Remove genre" : "At least one genre is required"}
                                >
                                  {genre === handoffDraft.vertical && <Check className="h-3 w-3" />}
                                  {VERTICAL_LABELS[genre] || genre}
                                  {handoffDraft.genres.length > 1 && <X className="h-2.5 w-2.5 opacity-50" />}
                                </button>
                              ))}
                            </div>
                            {handoffDraft.genres.length < 6 && (
                              <Select value={genreToAdd} onValueChange={(value) => addGenre(value as Vertical)}>
                                <SelectTrigger className="mt-2 h-8 bg-card/30 border-border/20 text-[10px]">
                                  <SelectValue placeholder="Add another genre…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {VERTICALS.filter((genre) => !handoffDraft.genres.includes(genre)).map((genre) => (
                                    <SelectItem key={genre} value={genre}>{VERTICAL_LABELS[genre] || genre}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div className="rounded-xl border border-border/20 bg-card/25 p-3 text-[9px] font-mono text-muted-foreground/45">
                            {handoffDraft.handoffEditedAt
                              ? `Handoff last saved ${new Date(handoffDraft.handoffEditedAt).toLocaleString()}`
                              : "Using Lexora's dossier-derived mapping until you save changes."}
                          </div>
                        </>
                      ) : (
                        <div className="py-10 text-center text-[10px] font-mono text-muted-foreground/40">
                          Project handoff is not available yet.
                        </div>
                      )}
                    </TabsContent>
                  </>
                )}
              </div>
            </ScrollArea>
          </Tabs>

          {!isLoading && row && (
            <div className="shrink-0 border-t border-border/20 bg-background/95 backdrop-blur-xl p-3 sm:px-5 flex flex-wrap items-center gap-2">
              {canDevelop && (
                <Button
                  onClick={() => develop.mutate()}
                  disabled={develop.isPending}
                  variant="outline"
                  className="h-9 text-[10px] font-mono"
                  data-testid="button-detail-create-dossier"
                >
                  {develop.isPending
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <FileText className="h-3.5 w-3.5 mr-1.5" />}
                  Build Dossier
                </Button>
              )}

              {canGreenlight && (
                <Button
                  onClick={() => greenlight.mutate()}
                  disabled={greenlight.isPending}
                  variant="outline"
                  className="h-9 text-[10px] font-mono border-cyan-500/30 text-cyan-200"
                  data-testid="button-detail-greenlight"
                >
                  {greenlight.isPending
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                  Agree & Greenlight
                </Button>
              )}

              {handoffDraft && row.sourceType !== "manual-idea" && !alreadyProject && (
                <Button
                  onClick={() => saveHandoff.mutate()}
                  disabled={saveHandoff.isPending}
                  variant="outline"
                  className="h-9 text-[10px] font-mono"
                  data-testid="button-save-project-handoff"
                >
                  {saveHandoff.isPending
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Save Handoff
                </Button>
              )}

              {handoffDraft && row.sourceType !== "manual-idea" && (
                <Button
                  onClick={() => sendToProjectCreator.mutate()}
                  disabled={sendToProjectCreator.isPending}
                  className="h-9 text-[10px] font-mono neon-glow text-white sm:ml-auto"
                  data-testid="button-detail-create-project"
                >
                  {sendToProjectCreator.isPending
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <Rocket className="h-3.5 w-3.5 mr-1.5" />}
                  {alreadyProject ? "Open Project" : row.status === "greenlit" ? "Send to Project Creator" : "Approve & Send to Project Creator"}
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
