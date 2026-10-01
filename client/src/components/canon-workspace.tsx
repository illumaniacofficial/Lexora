import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { BookDna, Chapter, ContinuitySnapshot, CreativeArtifactRow, Project, StudioProperty } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Archive,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  FileText,
  Fingerprint,
  GitBranch,
  Library,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";

type WorkspaceRole = "owner" | "editor" | "viewer";

interface RuntimeStatus {
  runtimeMode: string;
  privateStudio: boolean;
  commerceEnabled: boolean;
  cloudConfigured: boolean;
  local: { provider: string; model: string; available: boolean };
}

interface CanonWorkspaceProps {
  projectId: number;
  project: Project;
  property: StudioProperty;
  dna?: BookDna;
  continuity?: ContinuitySnapshot;
  chapters: Chapter[];
  role: WorkspaceRole;
  onChanged: () => void;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function artifactStateClass(state: string) {
  if (state === "canonical" || state === "published") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (state === "accepted") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  if (state === "reviewing") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (state === "rejected" || state === "archived" || state === "superseded") return "border-border/25 bg-card/40 text-muted-foreground/55";
  return "border-purple-500/25 bg-purple-500/10 text-purple-300";
}

function readableType(type: string) {
  return type.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ContractEditor({
  property,
  canEdit,
  onSaved,
}: {
  property: StudioProperty;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const contract = (property.targetContract || {}) as Record<string, any>;
  const [targetReader, setTargetReader] = useState("");
  const [emotionalPromise, setEmotionalPromise] = useState("");
  const [desiredAftereffect, setDesiredAftereffect] = useState("");
  const [tone, setTone] = useState("");
  const [structure, setStructure] = useState("");
  const [researchStandard, setResearchStandard] = useState("standard");

  useEffect(() => {
    setTargetReader(String(contract.targetReader || ""));
    setEmotionalPromise(String(contract.emotionalPromise || ""));
    setDesiredAftereffect(String(contract.desiredAftereffect || contract.desiredKnowledgeOrTransformation || ""));
    setTone(list(contract.tone).join(", "));
    setStructure(list(contract.structureExpectations).join("\n"));
    setResearchStandard(String(contract.researchStandard || "standard"));
  }, [property.id, property.updatedAt]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/properties/${property.id}`, {
      targetContract: {
        ...contract,
        targetReader: targetReader.trim(),
        emotionalPromise: emotionalPromise.trim(),
        desiredAftereffect: desiredAftereffect.trim(),
        tone: tone.split(",").map((item) => item.trim()).filter(Boolean),
        structureExpectations: structure.split("\n").map((item) => item.trim()).filter(Boolean),
        researchStandard,
      },
    }),
    onSuccess: () => {
      toast({ title: "Creative Target Contract saved" });
      onSaved();
    },
    onError: (error: any) => toast({ title: "Could not save target contract", description: error.message, variant: "destructive" }),
  });

  return (
    <Card className="border-cyan-500/20 bg-card/30">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-cyan-400" />
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-200/80">Creative Target Contract</p>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground/45 mt-1">The quality contract Redactor should judge this property against.</p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              className="h-7 text-[9px] font-mono"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-target-contract"
            >
              <Save className="h-3 w-3 mr-1" /> Save Contract
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Target reader</p>
            <Textarea value={targetReader} onChange={(event) => setTargetReader(event.target.value)} disabled={!canEdit} className="min-h-20 text-[11px]" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Emotional promise</p>
            <Textarea value={emotionalPromise} onChange={(event) => setEmotionalPromise(event.target.value)} disabled={!canEdit} className="min-h-20 text-[11px]" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Desired aftereffect</p>
            <Textarea value={desiredAftereffect} onChange={(event) => setDesiredAftereffect(event.target.value)} disabled={!canEdit} className="min-h-20 text-[11px]" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Tone · comma separated</p>
            <Input value={tone} onChange={(event) => setTone(event.target.value)} disabled={!canEdit} className="h-9 text-[11px]" />
            <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45 pt-1">Research standard</p>
            <Select value={researchStandard} onValueChange={setResearchStandard} disabled={!canEdit}>
              <SelectTrigger className="h-9 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="scholarly">Scholarly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/45">Structure expectations · one per line</p>
          <Textarea value={structure} onChange={(event) => setStructure(event.target.value)} disabled={!canEdit} className="min-h-20 text-[11px]" />
        </div>
      </CardContent>
    </Card>
  );
}

function ArtifactCard({
  artifact,
  canEdit,
  onChanged,
}: {
  artifact: CreativeArtifactRow;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const stateMutation = useMutation({
    mutationFn: (state: string) => apiRequest("PATCH", `/api/artifacts/${artifact.id}/state`, { state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", artifact.projectId, "artifacts"] });
      onChanged();
    },
    onError: (error: any) => toast({ title: "Artifact update failed", description: error.message, variant: "destructive" }),
  });

  const contentText = useMemo(() => {
    try {
      return JSON.stringify(artifact.content, null, 2);
    } catch {
      return String(artifact.content || "");
    }
  }, [artifact.content]);

  return (
    <div className="rounded-lg border border-border/20 bg-black/10 overflow-hidden">
      <button
        className="w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02]"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="h-8 w-8 shrink-0 rounded-md border border-purple-500/20 bg-purple-500/[0.07] flex items-center justify-center">
          <FileText className="h-3.5 w-3.5 text-purple-300/75" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold">{readableType(artifact.type)}</p>
            <Badge variant="outline" className={`h-5 text-[8px] font-mono ${artifactStateClass(artifact.state)}`}>{artifact.state}</Badge>
            <span className="text-[9px] font-mono text-muted-foreground/35">v{artifact.version}</span>
            {artifact.chapterId && <span className="text-[9px] font-mono text-muted-foreground/35">chapter #{artifact.chapterId}</span>}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground/40 mt-1">
            {artifact.createdBy} · {artifact.model || artifact.runtimeId || "manual"} · {new Date(artifact.createdAt).toLocaleString()}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
      </button>

      {expanded && (
        <div className="border-t border-border/15 px-3 py-3 space-y-3">
          <ScrollArea className="h-48 rounded-md border border-border/15 bg-black/20 p-2.5">
            <pre className="text-[9px] leading-relaxed font-mono text-muted-foreground/60 whitespace-pre-wrap break-words">{contentText}</pre>
          </ScrollArea>
          {canEdit && (
            <div className="flex flex-wrap gap-1.5">
              {artifact.state !== "canonical" && (
                <Button size="sm" className="h-7 text-[9px] font-mono" onClick={() => stateMutation.mutate("canonical")}>
                  <ShieldCheck className="h-3 w-3 mr-1" /> Make Canon
                </Button>
              )}
              {artifact.state !== "accepted" && artifact.state !== "canonical" && (
                <Button size="sm" variant="outline" className="h-7 text-[9px] font-mono" onClick={() => stateMutation.mutate("accepted")}>
                  <Check className="h-3 w-3 mr-1" /> Accept
                </Button>
              )}
              {!["archived", "superseded"].includes(artifact.state) && (
                <Button size="sm" variant="outline" className="h-7 text-[9px] font-mono" onClick={() => stateMutation.mutate("archived")}>
                  <Archive className="h-3 w-3 mr-1" /> Archive
                </Button>
              )}
              {!["rejected", "canonical"].includes(artifact.state) && (
                <Button size="sm" variant="outline" className="h-7 text-[9px] font-mono text-red-300" onClick={() => stateMutation.mutate("rejected")}>
                  <X className="h-3 w-3 mr-1" /> Reject
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CanonWorkspace({
  projectId,
  project,
  property,
  dna,
  continuity,
  chapters,
  role,
  onChanged,
}: CanonWorkspaceProps) {
  const canEdit = role !== "viewer";
  const { data: artifacts = [] } = useQuery<CreativeArtifactRow[]>({
    queryKey: ["/api/projects", projectId, "artifacts"],
  });
  const { data: runtime } = useQuery<RuntimeStatus>({ queryKey: ["/api/runtime/status"] });

  const classification = (property.classification || {}) as Record<string, any>;
  const state = (continuity?.state || {}) as Record<string, any>;
  const approved = chapters.filter((chapter) => chapter.approvalStatus === "approved");
  const canonicalChapters = artifacts.filter((artifact) => artifact.type === "chapter-manuscript" && artifact.state === "canonical");
  const reviews = artifacts.filter((artifact) => artifact.type === "redactor-review");
  const architecture = artifacts.find((artifact) => artifact.type === "book-architecture" && artifact.state === "canonical");
  const openLoops = Array.isArray(state.openLoops) ? state.openLoops.filter((loop: any) => loop?.status !== "closed") : [];
  const characters = Array.isArray(state.characters) ? state.characters : [];
  const facts = Array.isArray(state.acceptedFacts) ? state.acceptedFacts : [];
  const worldRules = Array.isArray(state.worldRules) ? state.worldRules : [];

  const recentArtifacts = artifacts.slice(0, 30);

  return (
    <div className="space-y-4" data-testid="canon-workspace">
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-card/35 to-purple-500/[0.04]">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <p className="font-bold tracking-tight">Canonical Project Intelligence</p>
                <Badge variant="outline" className="text-[8px] font-mono border-emerald-500/25 text-emerald-300 bg-emerald-500/5">{property.status}</Badge>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/45 mt-1 max-w-3xl">
                This is Lexora's source of truth for the property. Scribe creates, Redactor reviews, you approve, and accepted work becomes canon.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] font-mono">
              <Badge variant="outline" className="border-purple-500/20 text-purple-300">{property.format}</Badge>
              <Badge variant="outline" className="border-cyan-500/20 text-cyan-300">{property.seriesIntent}</Badge>
              <Badge variant="outline" className={runtime?.runtimeMode === "off-grid" ? "border-amber-500/30 text-amber-300" : "border-emerald-500/20 text-emerald-300"}>
                <Cpu className="h-2.5 w-2.5 mr-1" /> {runtime?.runtimeMode || "runtime"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            {[
              ["Approved", `${approved.length}/${chapters.length}`],
              ["Canonical Chapters", String(canonicalChapters.length)],
              ["Redactor Reviews", String(reviews.length)],
              ["Open Loops", String(openLoops.length)],
              ["Vault Artifacts", String(artifacts.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/15 bg-black/10 p-2.5">
                <p className="text-base font-bold font-mono">{value}</p>
                <p className="text-[8px] uppercase tracking-wider font-mono text-muted-foreground/40">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-purple-500/20 bg-card/30">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-3.5 w-3.5 text-purple-400" />
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-purple-200/80">Property / IP Identity</p>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">{property.canonicalTitle || property.workingTitle || project.title}</p>
              <p className="text-[9px] font-mono text-muted-foreground/40 mt-1">Property ID · {property.id}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {classification.primaryGenre?.label && <Badge variant="outline" className="text-[8px]">{classification.primaryGenre.label}</Badge>}
              {list(classification.themes).map((theme) => <Badge key={theme} variant="outline" className="text-[8px]">{theme}</Badge>)}
              {Array.isArray(classification.additionalGenres) && classification.additionalGenres.slice(0, 5).map((genre: any) => (
                <Badge key={genre.id || genre.label} variant="outline" className="text-[8px]">{genre.label || String(genre)}</Badge>
              ))}
            </div>
            {architecture ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-300">Architecture locked in Vault</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Canonical book architecture artifact v{architecture.version} preserves the current Book Genome and outline.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                <p className="text-[9px] font-mono uppercase tracking-wider text-amber-300">Architecture not vaulted yet</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">The next outline generation will automatically preserve it as canon.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 bg-card/30">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-violet-200/80">Book Genome</p>
            </div>
            {dna ? (
              <div className="space-y-2">
                {[
                  ["Core promise", dna.corePromise],
                  ["Reader avatar", dna.readerAvatar],
                  ["Tone rules", dna.toneRules],
                  ["Transformation / character arc", dna.transformationArc],
                  ["Framework / central conflict", dna.frameworkSummary],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-md border border-border/15 bg-black/10 p-2.5">
                    <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/35">{label}</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground/70 mt-1">{value || "Not defined yet."}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-mono text-muted-foreground/45">Generate the outline to create the Book Genome.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ContractEditor property={property} canEdit={canEdit} onSaved={onChanged} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-emerald-500/20 bg-card/30">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-emerald-200/80">Canonical Memory</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Characters", characters.length],
                ["Facts", facts.length],
                ["World Rules", worldRules.length],
                ["Open Loops", openLoops.length],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-md border border-border/15 bg-black/10 p-2.5">
                  <p className="font-mono font-bold">{value}</p>
                  <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/35">{label}</p>
                </div>
              ))}
            </div>
            {characters.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/35">Active character state</p>
                {characters.slice(0, 6).map((character: any) => (
                  <div key={character.characterId || character.name} className="flex items-center justify-between gap-3 rounded-md border border-border/10 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold truncate">{character.name}</p>
                      <p className="text-[9px] font-mono text-muted-foreground/40 truncate">{character.emotionalState || character.location || "tracked in canon"}</p>
                    </div>
                    <Users className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                  </div>
                ))}
              </div>
            )}
            {openLoops.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/35">Open narrative loops</p>
                {openLoops.slice(0, 5).map((loop: any) => (
                  <div key={loop.id || loop.question} className="rounded-md border border-amber-500/15 bg-amber-500/[0.03] px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-4 text-[7px] border-amber-500/20 text-amber-300">{loop.pressure || "open"}</Badge>
                      <p className="text-[9px] text-muted-foreground/65">{loop.question}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!continuity && <p className="text-[10px] font-mono text-muted-foreground/45">Approve a written chapter to begin canonical continuity memory.</p>}
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-card/30">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-blue-400" />
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-200/80">Scribe → Redactor → Canon</p>
            </div>
            {[
              ["Scribe", "Drafts and revises the manuscript. Every approved text state can be preserved as an artifact.", chapters.some((chapter) => chapter.status === "complete")],
              ["Redactor", "Editorial Board creates an independent review artifact for the chapter.", reviews.length > 0],
              ["You", "Owner approval is the canon gate. Approval creates the canonical manuscript artifact.", approved.length > 0],
              ["Core Memory", "Approval extracts continuity facts, character state, timeline, loops and world rules.", !!continuity],
            ].map(([name, description, done]) => (
              <div key={String(name)} className="flex gap-2.5 rounded-md border border-border/15 bg-black/10 p-2.5">
                {done ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" /> : <div className="h-3.5 w-3.5 rounded-full border border-border/30 shrink-0 mt-0.5" />}
                <div>
                  <p className="text-[10px] font-semibold">{name}</p>
                  <p className="text-[9px] text-muted-foreground/45 mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-purple-500/20 bg-card/30">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Library className="h-3.5 w-3.5 text-purple-400" />
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-purple-200/80">Artifact Vault</p>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/45 mt-1">Versions are preserved instead of silently overwritten. Canon promotion supersedes the prior canonical version of the same stream.</p>
            </div>
            <Badge variant="outline" className="self-start text-[8px] font-mono">{artifacts.length} artifacts</Badge>
          </div>

          {recentArtifacts.length > 0 ? (
            <div className="space-y-2">
              {recentArtifacts.map((artifact) => (
                <ArtifactCard key={artifact.id} artifact={artifact} canEdit={canEdit} onChanged={onChanged} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/25 py-8 text-center">
              <Library className="h-7 w-7 mx-auto text-muted-foreground/20" />
              <p className="text-[10px] font-mono text-muted-foreground/45 mt-2">The Vault is empty for this legacy project.</p>
              <p className="text-[9px] font-mono text-muted-foreground/30 mt-1">New outlines, Redactor reviews, approvals and continuity postflights will populate it automatically.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
