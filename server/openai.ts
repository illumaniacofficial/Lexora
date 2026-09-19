import OpenAI from "openai";
import { getConfig } from "./config/env";

const config = getConfig();

export const OPENAI_CONFIGURED = config.openai.configured;

// Keep the application bootable in local/off-grid mode even when no cloud key
// is installed. Calls routed to OpenAI will fail until Core's runtime router
// selects an available cloud runtime; the placeholder is never a real secret.
export const openai = new OpenAI({
  apiKey: config.openai.apiKey || "lexora-offline-no-cloud-key",
  baseURL: config.openai.baseURL,
});

export const FAST_MODEL = config.openai.fastModel;
export const HIGH_MODEL = config.openai.highModel;
export const IMAGE_MODEL = config.openai.imageModel;
