import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import pg from "pg";
import { getConfig, requireDatabaseUrl } from "./config/env";

const config = getConfig();
const databaseUrl = requireDatabaseUrl();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    adminId?: string;
    readerId?: number;
    role?: "admin" | "reader";
  }
}

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const sessionPool = new pg.Pool({ connectionString: databaseUrl });

async function ensureSessionTable() {
  await sessionPool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    ) WITH (OIDS=FALSE);
  `);
  await sessionPool.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
}

ensureSessionTable().catch(console.error);

const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({
      pool: sessionPool,
      tableName: "session",
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
    },
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Request logs intentionally omit response bodies. Manuscript, auth, research,
// and generated content must not be copied into production logs.
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;

  res.on("finish", () => {
    if (!requestPath.startsWith("/api")) return;
    const duration = Date.now() - start;
    log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
  });

  next();
});

(async () => {
  const { seedDatabase } = await import("./seed");
  await seedDatabase().catch(console.error);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (config.production) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  httpServer.listen(
    {
      port: config.port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(
        `serving on port ${config.port} [${config.studio.runtimeMode}]${config.studio.privateMode ? " private-studio" : ""}`,
      );
    },
  );
})();
