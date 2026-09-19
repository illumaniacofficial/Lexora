export type TriadAxis = "who" | "what" | "how";
export type TriadMode = "pure-chaos" | "intelligent-draw" | "forbidden-combination";
export type EvidenceLevel = "none" | "low" | "moderate" | "high";
export type ConfidenceLevel = "low" | "medium" | "high";
export type MarketEvidenceStatus = "not-requested" | "cached-only" | "user-provided" | "unavailable-offline" | "live-unavailable";

export interface TriadCard {
  id: string;
  axis: TriadAxis;
  label: string;
  text: string;
  tags: string[];
  audienceConstraints?: string[];
  formatConstraints?: string[];
  source: "curated" | "oracle" | "user";
}

export interface TriadDraw {
  id: string;
  mode: TriadMode;
  who: TriadCard;
  what: TriadCard;
  how: TriadCard;
  lockedAxes: TriadAxis[];
  wildcards: string[];
  createdAt: string;
  status: "drawn" | "synthesized" | "saved" | "greenlit" | "archived";
}

export interface ConceptContext {
  audience?: string;
  format?: string;
  genre?: string;
  topic?: string;
  tone?: string;
  purpose?: string;
  ageBand?: string;
  maturity?: string;
  seriesIntent?: string;
  marketObjective?: string;
  language?: string;
  additionalNotes?: string;
}

export interface OracleConceptAnalysis {
  targetReader: string;
  readerProblemOrDesire: string;
  emotionalPromise: string;
  format: string;
  genres: Array<{ id: string; label: string; weight: number }>;
  subgenres: Array<{ id: string; label: string; weight?: number }>;
  topics: string[];
  themes: string[];
  differentiationAngle: string;
  familiarityOrTropeRisks: string[];
  competitionSignals: string[];
  evergreenPotential: string;
  seriesPotential: string;
  productionComplexity: "low" | "medium" | "high";
  researchRequirements: string[];
  estimatedAiProductionCostClass: "free" | "low" | "standard" | "premium";
  evidenceLevel: EvidenceLevel;
  confidence: ConfidenceLevel;
  marketEvidenceStatus: MarketEvidenceStatus;
  risks: string[];
  unansweredQuestions: string[];
  summary: string;
}

export interface ConceptDirection {
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
  confidence: ConfidenceLevel;
  evidenceLevel: EvidenceLevel;
  marketEvidenceStatus: MarketEvidenceStatus;
}

export interface DirectorContribution {
  director: "oracle" | "scribe" | "redactor" | "core";
  role: string;
  summary: string;
  contribution: Record<string, unknown>;
  confidence?: ConfidenceLevel;
  evidenceLevel?: EvidenceLevel;
}

export interface ConceptSynthesisResult {
  drawId: string;
  synthesisRunId: string;
  context: ConceptContext;
  oracle: OracleConceptAnalysis;
  directions: ConceptDirection[];
  contributions: DirectorContribution[];
  runtime: {
    mode: string;
    location: "local" | "cloud";
    model: string;
    localApiCostUsd: 0;
    marketEvidenceStatus: MarketEvidenceStatus;
  };
}

export interface ConceptDossier {
  id: string;
  source:
    | { kind: "user-idea"; text: string }
    | { kind: "oracle-opportunity"; opportunityId: string }
    | { kind: "triad"; drawId: string }
    | { kind: "market-reverse-engineering"; brief: string };
  workingTitle?: string | null;
  premise: string;
  targetReader: string;
  readerProblemOrDesire?: string | null;
  corePromise?: string | null;
  uniqueAngle: string;
  format: string;
  genreTags: string[];
  topicTags: string[];
  themes: string[];
  seriesPotential: string;
  adaptationPotential: string[];
  estimatedScope?: {
    words?: number;
    chapters?: number;
  };
  researchBurden: "none" | "light" | "medium" | "high";
  productionComplexity: "low" | "medium" | "high";
  originalityNotes: string[];
  risks: string[];
  confidence: "low" | "medium" | "high";
  status: "candidate" | "developing" | "greenlit" | "rejected" | "archived";
}

export interface OperationalConceptDossier extends ConceptDossier {
  identity: {
    premise: string;
    promise: string;
    angle: string;
    differentiation: string;
  };
  reader: {
    targetReader: string;
    ageOrReadingLevel?: string | null;
    desiredFeelings: string[];
    desiredOutcomeOrTransformation: string[];
  };
  voiceExperience: {
    tone: string[];
    language: string;
    pacingExpectations: string[];
    usabilityRequirements: string[];
  };
  content: {
    genres: string[];
    subgenres: string[];
    topics: string[];
    themes: string[];
    maturity?: string | null;
  };
  structure: {
    intendedFormat: string;
    structuralApproach: string;
    seriesIntent: string;
  };
  intelligence: {
    oracleFindings: OracleConceptAnalysis;
    redactorConcerns: string[];
    researchRequirements: string[];
    evidenceLevel: EvidenceLevel;
    confidence: ConfidenceLevel;
    marketEvidenceStatus: MarketEvidenceStatus;
  };
  decision: {
    selectedDirectionId: string;
    alternativesConsidered: Array<{ directionId: string; title: string; status: "archived" | "rejected" | "considered" }>;
    userDecisionAt: string;
    sourceTriadDrawId: string;
    sourceArtifactIds: string[];
  };
  contributions: DirectorContribution[];
}

export const NO_DISCARD_BEFORE_SYNTHESIS = true;
