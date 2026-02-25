import { db } from "./db";
import { projects } from "@shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}

function escapeStr(s: string): string {
  return s.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

function escapeVal(v: any, colName: string): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'";
    if (typeof v[0] === "string") {
      const items = v.map(s => `"${String(s).replace(/"/g, '\\"')}"`).join(",");
      return `ARRAY[${v.map(s => `'${escapeStr(String(s))}'`).join(",")}]::text[]`;
    }
    return `'${escapeStr(JSON.stringify(v))}'::jsonb`;
  }
  if (typeof v === "object" && v !== null) {
    return `'${escapeStr(JSON.stringify(v))}'::jsonb`;
  }
  return `'${escapeStr(String(v))}'`;
}

const TABLE_MAP: Record<string, string> = {
  projects: "projects",
  bookDna: "book_dna",
  chapters: "chapters",
  trendReports: "trend_reports",
  marketingAssets: "marketing_assets",
  runSteps: "run_steps",
  appSettings: "app_settings",
  inviteTokens: "invite_tokens",
  bookRequests: "book_requests",
  chatConversations: "chat_conversations",
  chatMessages: "chat_messages",
  autopilotConfig: "autopilot_config",
  autopilotRuns: "autopilot_runs",
};

const SEED_ORDER = [
  "projects", "bookDna", "chapters", "trendReports", "marketingAssets",
  "runSteps", "appSettings", "inviteTokens", "bookRequests",
  "chatConversations", "chatMessages", "autopilotConfig", "autopilotRuns",
];

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

    if (existing.length > 0) {
      console.log(`Production has ${existing.length} projects, seed has ${seedProjectCount}. Clearing and re-seeding...`);
      const clearOrder = [...SEED_ORDER].reverse();
      for (const key of clearOrder) {
        const tableName = TABLE_MAP[key];
        try {
          await db.execute(sql.raw(`DELETE FROM "${tableName}"`));
        } catch {}
      }
    }

    let totalInserted = 0;
    let errors = 0;
    for (const key of SEED_ORDER) {
      const tableName = TABLE_MAP[key];
      const rows = seedData[key] || [];
      for (const row of rows) {
        try {
          const cols = Object.keys(row);
          const colsSql = cols.map(c => `"${toSnake(c)}"`).join(", ");
          const valsSql = cols.map(c => escapeVal(row[c], c)).join(", ");
          const query = `INSERT INTO "${tableName}" (${colsSql}) OVERRIDING SYSTEM VALUE VALUES (${valsSql}) ON CONFLICT DO NOTHING`;
          await db.execute(sql.raw(query));
          totalInserted++;
        } catch (e: any) {
          errors++;
          if (errors <= 5) console.error(`Seed error [${tableName}]:`, e.message?.substring(0, 200));
        }
      }
    }

    for (const tableName of Object.values(TABLE_MAP)) {
      try {
        await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1))`));
      } catch {}
    }

    console.log(`Database seeded with ${totalInserted} records (${errors} errors) from db-seed.json`);
  } catch (error) {
    console.error("Seeding error:", error);
  }
}
