import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { requireDatabaseUrl } from "./config/env";

const pool = new Pool({ connectionString: requireDatabaseUrl() });
export const db = drizzle(pool, { schema });
