import type { DirectorId } from "./directors";

export type BoardroomPhase =
  | "independent-position"
  | "challenge"
  | "rebuttal"
  | "core-synthesis"
  | "publisher-decision"
  | "closed";

export interface BoardroomPosition {
  director: DirectorId;
  position: string;
  reasoningSummary: string[];
  risks: string[];
  confidence: "low" | "medium" | "high";
  revisedFromPriorRound?: boolean;
}

export interface BoardroomSession {
  id: string;
  propertyId?: string | null;
  projectId?: number | null;
  agenda: string;
  participants: DirectorId[];
  phase: BoardroomPhase;
  rounds: Array<{
    number: number;
    positions: BoardroomPosition[];
  }>;
  synthesis?: {
    consensus: string[];
    disagreements: string[];
    highConfidenceFindings: string[];
    lowConfidenceAssumptions: string[];
    options: string[];
  };
  publisherDecision?: {
    decision: string;
    rationale?: string | null;
    decidedAt: string;
  };
  createdAt: string;
  closedAt?: string | null;
}
