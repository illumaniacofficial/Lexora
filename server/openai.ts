import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const FAST_MODEL = "gpt-5-mini";
export const HIGH_MODEL = "gpt-5.1";
export const IMAGE_MODEL = "gpt-image-1";
