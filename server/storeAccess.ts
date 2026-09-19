import { storage } from "./storage";
import type { Project } from "@shared/schema";

/**
 * Legacy reader access evaluator retained for migration compatibility.
 * This module intentionally has no Stripe/provider dependency so the private
 * studio can boot without loading commerce code.
 */
export async function readerHasBookAccess(
  readerId: number | null,
  project: Project,
): Promise<boolean> {
  if ((project.priceUsd || 0) <= 0) return true;
  if (!readerId) return false;

  const memberships = await storage.getReaderMemberships(readerId);
  const activeMember = memberships.some(
    (membership) =>
      membership.status === "active" &&
      (!membership.currentPeriodEnd ||
        membership.currentPeriodEnd.getTime() > Date.now()),
  );
  if (activeMember) return true;

  const orders = await storage.getStorefrontOrders();
  return orders.some(
    (order) =>
      order.readerId === readerId &&
      order.projectId === project.id &&
      order.status === "complete",
  );
}
