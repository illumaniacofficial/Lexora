import { z } from "zod";

const runtimeModes = ["connected", "hybrid", "off-grid"] as const;

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  SESSION_SECRET: z.string().optional(),

  ADMIN_USERNAME: z.string().min(1).optional(),
  ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_FAST_MODEL: z.string().optional(),
  OPENAI_HIGH_MODEL: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().optional(),

  // Temporary migration bridge only. Business code should not read these.
  AI_INTEGRATIONS_OPENAI_API_KEY: z.string().optional(),
  AI_INTEGRATIONS_OPENAI_BASE_URL: z.string().url().optional(),

  ELEVENLABS_API_KEY: z.string().optional(),

  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),

  LEXORA_RUNTIME_MODE: z.enum(runtimeModes).optional(),
  LEXORA_PRIVATE_STUDIO: z.string().optional(),
  LEXORA_COMMERCE_ENABLED: z.string().optional(),
});

export type RuntimeMode = (typeof runtimeModes)[number];

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

let cached: ReturnType<typeof buildConfig> | null = null;

function buildConfig() {
  const env = rawSchema.parse(process.env);
  const production = env.NODE_ENV === "production";

  if (production && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
    throw new Error(
      "SESSION_SECRET must be set to a strong value of at least 32 characters in production.",
    );
  }

  const openAiApiKey =
    env.OPENAI_API_KEY || env.AI_INTEGRATIONS_OPENAI_API_KEY || null;
  const openAiBaseUrl =
    env.OPENAI_BASE_URL || env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;

  return {
    nodeEnv: env.NODE_ENV,
    production,
    port: Number.parseInt(env.PORT || "5000", 10),
    databaseUrl: env.DATABASE_URL || null,
    sessionSecret:
      env.SESSION_SECRET ||
      (production ? "" : "lexora-local-dev-only-change-before-production"),

    admin: {
      username: env.ADMIN_USERNAME || "admin",
      initialPassword: env.ADMIN_INITIAL_PASSWORD || null,
    },

    openai: {
      apiKey: openAiApiKey,
      baseURL: openAiBaseUrl,
      fastModel: env.OPENAI_FAST_MODEL || "gpt-5-mini",
      highModel: env.OPENAI_HIGH_MODEL || "gpt-5.1",
      imageModel: env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      configured: Boolean(openAiApiKey),
      usingLegacyReplitEnv:
        !env.OPENAI_API_KEY && Boolean(env.AI_INTEGRATIONS_OPENAI_API_KEY),
    },

    elevenLabs: {
      apiKey: env.ELEVENLABS_API_KEY || null,
      configured: Boolean(env.ELEVENLABS_API_KEY),
    },

    ollama: {
      baseURL: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      model: env.OLLAMA_MODEL || "qwen3.5:4b",
    },

    studio: {
      privateMode: envBool(env.LEXORA_PRIVATE_STUDIO, true),
      commerceEnabled: envBool(env.LEXORA_COMMERCE_ENABLED, false),
      runtimeMode: (env.LEXORA_RUNTIME_MODE || "connected") as RuntimeMode,
    },
  };
}

export function getConfig() {
  if (!cached) cached = buildConfig();
  return cached;
}

export function requireDatabaseUrl(): string {
  const url = getConfig().databaseUrl;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}
