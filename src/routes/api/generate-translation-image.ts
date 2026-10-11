// Staff-only endpoint: generates a hero image for a translation using the
// configured AI provider (AI_BASE_URL / AI_IMAGE_MODEL) and returns a data URL.
// Non-streaming (the editor just needs the final image).
// Callers must send `Authorization: Bearer <supabase access token>`; this is a
// plain API route, so the serverFn auth attacher does not add it for them.
import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";

const MAX_PROMPT_CHARS = 4000;

// Same token check as requireSupabaseAuth, plus the staff role check from requireStaff.
async function authenticateStaff(request: Request) {
  const { createClient } = await import("@supabase/supabase-js");
  const { STAFF_ROLES } = await import("@/lib/auth-guards");
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error("[generate-translation-image] missing Supabase env");
    return { response: new Response("Server auth is not configured", { status: 500 }) };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: new Response("Unauthorized", { status: 401 }) };
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token) return { response: new Response("Unauthorized", { status: 401 }) };

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return { response: new Response("Unauthorized", { status: 401 }) };

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (roleRows ?? []).map((r) => r.role as string);
  if (roleError || !roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r))) {
    return { response: new Response("Forbidden: staff only", { status: 403 }) };
  }
  return { supabase, userId };
}

export const Route = createFileRoute("/api/generate-translation-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateStaff(request);
        if ("response" in auth) return auth.response;

        // The model is chosen by server config only (AI_IMAGE_MODEL), never by the request.
        let body: { prompt?: unknown } | null = null;
        try {
          body = (await request.json()) as { prompt?: unknown } | null;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const prompt = (typeof body?.prompt === "string" ? body.prompt : "").trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });
        if (prompt.length > MAX_PROMPT_CHARS) {
          return new Response("Prompt is too long", { status: 400 });
        }

        const { getAiConfig } = await import("@/lib/config.server");
        const { logAiRun } = await import("@/lib/ai-runs.server");
        let ai: ReturnType<typeof getAiConfig>;
        try {
          ai = getAiConfig();
        } catch (err) {
          return new Response((err as Error).message, { status: 500 });
        }
        if (!ai.apiKey) return new Response(`Missing ${ai.apiKeyEnvName}`, { status: 500 });

        const model = ai.imageModel;
        const isGemini = model.startsWith("google/");
        const reqBody = isGemini
          ? {
              model,
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }
          : {
              model,
              prompt,
              size: "1024x1024",
              n: 1,
              quality: "low",
            };

        // Provenance: prompt is stored as a hash only, and the image itself is not stored.
        const started = Date.now();
        const logRun = (entry: { status: "ok" | "error"; outputJson?: unknown; error?: string }) =>
          logAiRun(auth.supabase, {
            userId: auth.userId,
            purpose: "translation_image",
            model,
            baseUrlHost: ai.baseUrlHost,
            promptVersion: null,
            params: {
              request: isGemini ? "chat-modalities" : "images",
              size: isGemini ? null : "1024x1024",
            },
            inputText: prompt,
            latencyMs: Date.now() - started,
            ...entry,
          });

        try {
          const upstream = await fetch(`${ai.baseUrl}/images/generations`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ai.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(reqBody),
          });

          if (!upstream.ok) {
            const text = await upstream.text().catch(() => "");
            console.error("[generate-translation-image] upstream error", upstream.status, text);
            await logRun({ status: "error", error: `HTTP ${upstream.status}: ${text}` });
            return Response.json(
              { error: text || "Upstream error", status: upstream.status, fallback: true },
              { status: 200 },
            );
          }
          const json = (await upstream.json()) as {
            data?: Array<{ b64_json?: string }>;
          };
          const b64 = json.data?.[0]?.b64_json;
          if (!b64) {
            console.error("[generate-translation-image] no image in response", JSON.stringify(json).slice(0, 500));
            await logRun({ status: "error", error: "No image returned" });
            return Response.json(
              { error: "No image returned", fallback: true },
              { status: 200 },
            );
          }
          await logRun({
            status: "ok",
            outputJson: { mediaType: "image/png", base64Chars: b64.length },
          });
          return Response.json({ dataUrl: `data:image/png;base64,${b64}` });
        } catch (err) {
          console.error("[generate-translation-image] fetch failed", err);
          await logRun({ status: "error", error: (err as Error)?.message || "Service failed" });
          return Response.json(
            { error: (err as Error)?.message || "Service failed", fallback: true },
            { status: 200 },
          );
        }
      },
    },
  },
});
