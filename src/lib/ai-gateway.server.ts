import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AiConfig } from "@/lib/config.server";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

/**
 * OpenAI-compatible provider for the configured AI_BASE_URL (see getAiConfig).
 * On the Lovable gateway it keeps the Lovable auth and run-id headers; any other
 * host gets a standard `Authorization: Bearer <AI_API_KEY>` header.
 */
export function createAiGatewayProvider(
  ai: Pick<AiConfig, "baseUrl" | "apiKey" | "isLovableGateway">,
  initialRunId?: string,
) {
  if (!ai.apiKey) throw new Error("AI gateway is not configured (missing API key).");
  const apiKey = ai.apiKey;
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) runId = nextRunId;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  const provider = createOpenAICompatible({
    name: ai.isLovableGateway ? "lovable" : "ai",
    baseURL: ai.baseUrl,
    ...(ai.isLovableGateway
      ? {
          headers: {
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        }
      : { apiKey }),
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (ai.isLovableGateway && runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input as RequestInfo, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
  });

  return Object.assign(provider, {
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  });
}
