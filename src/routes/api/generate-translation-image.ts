// Public-but-internal endpoint: generates a hero image for a translation
// using the Lovable AI Gateway and returns a data URL.
// Non-streaming (the editor just needs the final image).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-translation-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { prompt?: string; model?: string } = {};
        try {
          body = (await request.json()) as { prompt?: string };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const model = body.model || "google/gemini-2.5-flash-image";
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

        try {
          const upstream = await fetch(
            "https://ai.gateway.lovable.dev/v1/images/generations",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(reqBody),
            },
          );

          if (!upstream.ok) {
            const text = await upstream.text().catch(() => "");
            console.error("[generate-translation-image] upstream error", upstream.status, text);
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
            return Response.json(
              { error: "No image returned", fallback: true },
              { status: 200 },
            );
          }
          return Response.json({ dataUrl: `data:image/png;base64,${b64}` });
        } catch (err) {
          console.error("[generate-translation-image] fetch failed", err);
          return Response.json(
            { error: (err as Error)?.message || "Service failed", fallback: true },
            { status: 200 },
          );
        }
      },
    },
  },
});
