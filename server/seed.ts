import { db } from "./db";
import { projects, bookDna, trendReports, chapters, marketingAssets, runSteps, appSettings, inviteTokens, bookRequests, chatConversations, chatMessages, autopilotConfig, autopilotRuns } from "@shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function seedDatabase() {
  try {
    let seedPath = path.join(process.cwd(), "db-seed.json");
    if (!fs.existsSync(seedPath)) {
      seedPath = path.join(process.cwd(), "dist", "db-seed.json");
    }
    if (!fs.existsSync(seedPath)) {
      console.log("No db-seed.json found, skipping seed");
      return;
    }

    const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
    const seedProjectCount = (seedData.projects || []).length;
    const existing = await db.select().from(projects);

    if (existing.length >= seedProjectCount) return;

    if (existing.length > 0 && existing.length < seedProjectCount) {
      console.log(`Production has ${existing.length} projects, seed has ${seedProjectCount}. Clearing stale data and re-seeding...`);
      const tablesToClear = [
        autopilotRuns, autopilotConfig, chatMessages, chatConversations,
        bookRequests, inviteTokens, appSettings, runSteps,
        marketingAssets, chapters, trendReports, bookDna, projects,
      ];
      for (const table of tablesToClear) {
        try { await db.delete(table); } catch {}
      }
    }

    const orderedTables: [any, any[]][] = [
      [projects, seedData.projects],
      [bookDna, seedData.bookDna],
      [chapters, seedData.chapters],
      [trendReports, seedData.trendReports],
      [marketingAssets, seedData.marketingAssets],
      [runSteps, seedData.runSteps],
      [appSettings, seedData.appSettings],
      [inviteTokens, seedData.inviteTokens],
      [bookRequests, seedData.bookRequests],
      [chatConversations, seedData.chatConversations],
      [chatMessages, seedData.chatMessages],
      [autopilotConfig, seedData.autopilotConfig],
      [autopilotRuns, seedData.autopilotRuns],
    ];

    let totalInserted = 0;
    for (const [table, rows] of orderedTables) {
      if (rows && rows.length > 0) {
        for (const row of rows) {
          try {
            await db.insert(table).values(row).onConflictDoNothing();
            totalInserted++;
          } catch {}
        }
      }
    }

    const seqTables = [
      "projects", "chapters", "book_dna", "trend_reports", "marketing_assets",
      "run_steps", "app_settings", "invite_tokens", "book_requests",
      "chat_conversations", "chat_messages", "autopilot_config", "autopilot_runs",
    ];
    for (const table of seqTables) {
      try {
        await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`));
      } catch {}
    }

    console.log(`Database seeded with ${totalInserted} records from db-seed.json`);
  } catch (error) {
    console.error("Seeding error:", error);
  }
}
