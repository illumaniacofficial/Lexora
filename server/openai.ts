import OpenAI from "openai";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { getConfig } from "./config/env";

const config = getConfig();

export const OPENAI_CONFIGURED = config.openai.configured;
export const FAST_MODEL = config.openai.fastModel;
export const HIGH_MODEL = config.openai.highModel;
export const IMAGE_MODEL = config.openai.imageModel;

const defaultOpenAI = new OpenAI({
  apiKey: config.openai.apiKey || "lexora-offline-no-cloud-key",
  baseURL: config.openai.baseURL,
});

type CustomProviderRow = {
  enabled: boolean;
  name: string;
  base_url: string;
  api_key_ciphertext: string | null;
  fast_model: string;
  writing_model: string;
};

export interface CustomProviderPublic {
  enabled: boolean;
  name: string;
  baseUrl: string;
  fastModel: string;
  writingModel: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
}

let providerCache: { row: CustomProviderRow | null; at: number } | null = null;

function secretKey(): Buffer {
  return crypto.createHash("sha256").update(config.sessionSecret).digest();
}

function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(value: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Stored custom provider key is invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function maskKey(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  try {
    const raw = decryptSecret(ciphertext);
    if (raw.length <= 8) return "••••••••";
    return `${raw.slice(0, 3)}••••••${raw.slice(-4)}`;
  } catch {
    return "••••••••";
  }
}

async function readCustomProvider(force = false): Promise<CustomProviderRow | null> {
  if (!force && providerCache && Date.now() - providerCache.at < 5000) return providerCache.row;
  try {
    const result: any = await db.execute(sql`
      SELECT enabled, name, base_url, api_key_ciphertext, fast_model, writing_model
      FROM custom_ai_provider
      WHERE id = 1
      LIMIT 1
    `);
    const row = (result?.rows?.[0] || result?.[0] || null) as CustomProviderRow | null;
    providerCache = { row, at: Date.now() };
    return row;
  } catch (error: any) {
    // During very early startup the additive schema guard may not have created
    // the provider table yet. Falling back to the configured default is safe.
    if (String(error?.message || "").includes("custom_ai_provider")) return null;
    throw error;
  }
}

function validateBaseUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Custom API base URL must use http or https.");
  }
  return url.toString().replace(/\/$/, "");
}

export async function getCustomProviderPublic(): Promise<CustomProviderPublic> {
  const row = await readCustomProvider();
  return {
    enabled: Boolean(row?.enabled),
    name: row?.name || "Custom API",
    baseUrl: row?.base_url || "",
    fastModel: row?.fast_model || "",
    writingModel: row?.writing_model || "",
    hasApiKey: Boolean(row?.api_key_ciphertext),
    maskedApiKey: maskKey(row?.api_key_ciphertext || null),
  };
}

export async function saveCustomProvider(input: {
  enabled: boolean;
  name: string;
  baseUrl: string;
  apiKey?: string;
  fastModel: string;
  writingModel: string;
}): Promise<CustomProviderPublic> {
  const baseUrl = input.baseUrl.trim() ? validateBaseUrl(input.baseUrl) : "";
  if (input.enabled && !baseUrl) throw new Error("Base URL is required when the custom provider is enabled.");
  if (input.enabled && !input.fastModel.trim()) throw new Error("Fast model ID is required when the custom provider is enabled.");
  if (input.enabled && !input.writingModel.trim()) throw new Error("Writing model ID is required when the custom provider is enabled.");

  const existing = await readCustomProvider(true);
  const encrypted = input.apiKey?.trim()
    ? encryptSecret(input.apiKey.trim())
    : existing?.api_key_ciphertext || null;

  if (input.enabled && !encrypted) throw new Error("API key is required when the custom provider is enabled.");

  await db.execute(sql`
    INSERT INTO custom_ai_provider (
      id, enabled, name, base_url, api_key_ciphertext, fast_model, writing_model, updated_at
    ) VALUES (
      1,
      ${input.enabled},
      ${input.name.trim() || "Custom API"},
      ${baseUrl},
      ${encrypted},
      ${input.fastModel.trim()},
      ${input.writingModel.trim()},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      name = EXCLUDED.name,
      base_url = EXCLUDED.base_url,
      api_key_ciphertext = EXCLUDED.api_key_ciphertext,
      fast_model = EXCLUDED.fast_model,
      writing_model = EXCLUDED.writing_model,
      updated_at = now()
  `);

  providerCache = null;
  return getCustomProviderPublic();
}

async function activeTextProvider(requestedModel: string): Promise<{ client: OpenAI; model: string; runtimeId: string }> {
  const custom = await readCustomProvider();
  if (custom?.enabled && custom.base_url && custom.api_key_ciphertext) {
    const apiKey = decryptSecret(custom.api_key_ciphertext);
    const client = new OpenAI({ apiKey, baseURL: custom.base_url });
    const model = requestedModel === HIGH_MODEL
      ? (custom.writing_model || custom.fast_model)
      : (custom.fast_model || custom.writing_model);
    return { client, model, runtimeId: `custom:${custom.name}:${model}` };
  }
  return { client: defaultOpenAI, model: requestedModel, runtimeId: `openai:${requestedModel}` };
}

export async function isCloudTextConfigured(): Promise<boolean> {
  const custom = await readCustomProvider();
  return Boolean(
    (custom?.enabled && custom.base_url && custom.api_key_ciphertext && custom.fast_model && custom.writing_model) ||
    config.openai.configured,
  );
}

export async function testCustomProvider(): Promise<{ ok: true; model: string; text: string }> {
  const custom = await readCustomProvider(true);
  if (!custom?.base_url || !custom.api_key_ciphertext) throw new Error("Save a Base URL and API key first.");
  const model = custom.fast_model || custom.writing_model;
  if (!model) throw new Error("Save a model ID first.");
  const client = new OpenAI({ apiKey: decryptSecret(custom.api_key_ciphertext), baseURL: custom.base_url });
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Reply with exactly: LEXORA_OK" }],
    max_tokens: 16,
  });
  return {
    ok: true,
    model,
    text: response.choices[0]?.message?.content?.trim() || "",
  };
}

// Dynamic OpenAI-compatible text gateway. Existing Lexora call sites keep the
// standard OpenAI SDK shape, but chat completion requests can be routed at
// runtime to a user-supplied compatible endpoint. Image generation stays on
// the configured OpenAI image provider.
const dynamicChat = {
  completions: {
    create: async (params: any) => {
      const requestedModel = String(params?.model || FAST_MODEL);
      const provider = await activeTextProvider(requestedModel);
      return provider.client.chat.completions.create({ ...params, model: provider.model });
    },
  },
};

export const openai = new Proxy(defaultOpenAI as any, {
  get(target, property, receiver) {
    if (property === "chat") return dynamicChat;
    return Reflect.get(target, property, receiver);
  },
}) as OpenAI;
