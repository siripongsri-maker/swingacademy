// Provenance log for every AI call (public.ai_runs). Rows record which model and
// prompt version produced a draft, so draft vs human-corrected pairs can be built
// later for training our own model.
//
// Privacy: inputs are never stored. We keep a SHA-256 hash and the input length
// only (no raw text, no audio). Outputs are stored because they are the drafts,
// except verbatim copies of the input (capture transcripts), which callers omit.
//
// Best-effort: logAiRun never throws. If the ai_runs migration is not applied yet,
// or RLS rejects the insert, the AI feature still works and we only console.warn.

export type AiRunPurpose =
  | "capture"
  | "knowledge_assist"
  | "knowledge_translate"
  | "creative_assist"
  | "suggest_meta"
  | "talent_summary"
  | "translation_image";

export type AiRunEntry = {
  /** auth user id of the caller; stored as created_by. */
  userId: string;
  purpose: AiRunPurpose;
  objectType?: string | null;
  objectId?: string | null;
  model: string;
  baseUrlHost: string;
  /** Version tag of the system prompt / request template, e.g. "capture-v1". */
  promptVersion: string | null;
  params?: Record<string, unknown> | null;
  /** Raw input to hash. Only the hash and length are stored. */
  inputText?: string;
  inputBytes?: Uint8Array;
  /** Precomputed hash, used when inputText / inputBytes are not given. */
  inputHash?: string | null;
  /** Overrides the length derived from inputText / inputBytes. */
  inputChars?: number | null;
  outputText?: string | null;
  outputJson?: unknown;
  latencyMs?: number | null;
  status: "ok" | "error";
  error?: string | null;
};

// Accepts the user-scoped client from requireSupabaseAuth. ai_runs is not in the
// generated types until the migration is applied, so the insert is untyped.
type AnySupabaseClient = { from: (...args: never[]) => unknown };
type AiRunsTable = {
  from(table: "ai_runs"): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
};

const MAX_ERROR_CHARS = 2000;

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function logAiRun(supabase: AnySupabaseClient, entry: AiRunEntry): Promise<void> {
  try {
    const raw = entry.inputText ?? entry.inputBytes;
    const inputHash = entry.inputHash ?? (raw !== undefined ? await sha256Hex(raw) : null);
    const inputChars =
      entry.inputChars ??
      (entry.inputText !== undefined
        ? entry.inputText.length
        : entry.inputBytes !== undefined
          ? entry.inputBytes.byteLength
          : null);

    const { error } = await (supabase as unknown as AiRunsTable).from("ai_runs").insert({
      created_by: entry.userId,
      purpose: entry.purpose,
      object_type: entry.objectType ?? null,
      object_id: entry.objectId ?? null,
      provider_host: entry.baseUrlHost,
      model: entry.model,
      prompt_version: entry.promptVersion,
      params: entry.params ?? null,
      input_hash: inputHash,
      input_chars: inputChars,
      output_text: entry.outputText ?? null,
      output_json: entry.outputJson ?? null,
      latency_ms: entry.latencyMs != null ? Math.round(entry.latencyMs) : null,
      status: entry.status,
      error: entry.error ? entry.error.slice(0, MAX_ERROR_CHARS) : null,
    });
    if (error) console.warn("[ai_runs] insert skipped:", error.message);
  } catch (err) {
    console.warn("[ai_runs] insert skipped:", err instanceof Error ? err.message : String(err));
  }
}
