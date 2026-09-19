import { getConfig } from "../config/env";
import type { ModelRuntimeDescriptor } from "./runtime";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatOptions {
  model?: string;
  messages: OllamaMessage[];
  temperature?: number;
}

function ollamaUrl(path: string): string {
  const base = getConfig().ollama.baseURL.replace(/\/$/, "");
  return `${base}${path}`;
}

export async function isOllamaAvailable(timeoutMs = 1200): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(ollamaUrl("/api/tags"), { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function getOllamaRuntimeDescriptor(): Promise<ModelRuntimeDescriptor> {
  const config = getConfig();
  return {
    id: `ollama:${config.ollama.model}`,
    location: "local",
    provider: "ollama",
    model: config.ollama.model,
    available: await isOllamaAvailable(),
    capabilities: [
      "text-generation",
      "structured-output",
      "translation",
    ],
    estimatedCostClass: "free",
  };
}

export async function ollamaChat(options: OllamaChatOptions): Promise<string> {
  const config = getConfig();
  const response = await fetch(ollamaUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model || config.ollama.model,
      messages: options.messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama request failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const data = await response.json() as {
    message?: { content?: string };
  };

  const content = data.message?.content?.trim();
  if (!content) throw new Error("Ollama returned no message content.");
  return content;
}
