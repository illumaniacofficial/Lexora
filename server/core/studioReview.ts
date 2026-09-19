import type { DirectorId } from "./directors";

export interface StudioReviewContribution {
  director: DirectorId;
  applicable: boolean;
  status: "pending" | "approved" | "revision-required" | "not-applicable";
  findings: string[];
  unresolvedCriticalIssues: string[];
  signedAt?: string | null;
}

export interface StudioReview {
  id: string;
  propertyId: string;
  projectId?: number | null;
  contributions: StudioReviewContribution[];
  status: "pending" | "revision-required" | "ready-for-packaging";
  createdAt: string;
  completedAt?: string | null;
}

export function studioReviewReady(review: StudioReview): boolean {
  const applicable = review.contributions.filter((item) => item.applicable);
  return (
    applicable.length > 0 &&
    applicable.every(
      (item) =>
        item.status === "approved" &&
        item.unresolvedCriticalIssues.length === 0,
    )
  );
}
