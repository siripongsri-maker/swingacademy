import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Add server-only values here, e.g.:
    //   databaseUrl: process.env.DATABASE_URL,
    //   stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  };
}

// AI provider config. Defaults reproduce the original Lovable AI Gateway
// setup, so nothing changes until one of these env vars is set:
//   AI_BASE_URL     OpenAI-compatible base URL (e.g. a self-hosted Thai model later)
//   AI_API_KEY      key for AI_BASE_URL (falls back to LOVABLE_API_KEY on the Lovable gateway only)
//   AI_TEXT_MODEL   chat model for knowledge tools
//   AI_AUDIO_MODEL  model that accepts audio input (capture transcription)
//   AI_IMAGE_MODEL  image generation model
export const DEFAULT_AI_BASE_URL = "https://ai.gateway.lovable.dev/v1";
export const DEFAULT_AI_TEXT_MODEL = "google/gemini-3-flash-preview";
export const DEFAULT_AI_AUDIO_MODEL = "google/gemini-3-flash-preview";
export const DEFAULT_AI_IMAGE_MODEL = "google/gemini-2.5-flash-image";
const LOVABLE_GATEWAY_HOST = "ai.gateway.lovable.dev";

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function getAiConfig() {
  const baseUrl = (readEnv("AI_BASE_URL") ?? DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("AI_BASE_URL is not a valid URL.");
  }
  const baseUrlHost = parsed.host;
  const isLovableGateway = parsed.protocol === "https:" && baseUrlHost === LOVABLE_GATEWAY_HOST;
  // Never send the Lovable key to a different host, or over plain http.
  const apiKey =
    readEnv("AI_API_KEY") ?? (isLovableGateway ? readEnv("LOVABLE_API_KEY") : undefined);
  return {
    baseUrl,
    baseUrlHost,
    isLovableGateway,
    apiKey,
    apiKeyEnvName: isLovableGateway ? "AI_API_KEY or LOVABLE_API_KEY" : "AI_API_KEY",
    textModel: readEnv("AI_TEXT_MODEL") ?? DEFAULT_AI_TEXT_MODEL,
    audioModel: readEnv("AI_AUDIO_MODEL") ?? DEFAULT_AI_AUDIO_MODEL,
    imageModel: readEnv("AI_IMAGE_MODEL") ?? DEFAULT_AI_IMAGE_MODEL,
  };
}

export type AiConfig = ReturnType<typeof getAiConfig>;
