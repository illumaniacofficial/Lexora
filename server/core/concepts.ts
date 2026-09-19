export type TriadAxis = "who" | "what" | "how";
export type TriadMode = "pure-chaos" | "intelligent-draw" | "forbidden-combination";

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

export const NO_DISCARD_BEFORE_SYNTHESIS = true;
