import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

/**
 * Fire-and-forget notification creation. Notifications are surfaced in the
 * in-app notification center; failures here must never break core flows
 * (pipeline runs, checkout fulfillment, trend analysis), so all errors are
 * swallowed and logged.
 */
export async function notify(data: InsertNotification): Promise<void> {
  try {
    await storage.createNotification(data);
  } catch (err: any) {
    console.error("Notification create failed (non-fatal):", err?.message || err);
  }
}
