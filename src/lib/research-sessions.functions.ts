// CVSK capture sessions: plan a session, link who spoke (pseudo codes only), walk the
// three-step checklist and upload raw audio to the private research-raw bucket.
//
// Access: session workers (admin, researcher, data steward, and dept coordinators for their
// own departments). RLS on capture_sessions and session_participants enforces the same rule,
// so every table query runs on the caller's user-scoped client.
//
// Privacy: this file never reads consents, participant_identity or withdrawal_events.
// Workers only see the per-session flags from session_clearance(), which never says
// which person is not cleared.
//
// The service-role client is used for storage only (sign an upload, verify the uploaded
// object, remove unlinked copies in that session's folder, sign a playback link), and always
// after the server-side checks above it.
// The bucket has no storage policies, so nothing else can read or write it.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireResearch, type ResearchAccess } from "@/lib/research-access";

export const SESSION_TYPES = [
  "monthly_training",
  "elicitation_circle",
  "on_the_job",
  "lesson_debrief",
  "interview",
  "retrospective",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_STATUSES = ["draft", "ready", "recorded", "on_hold", "closed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PARTICIPANT_ROLES = ["speaker", "interviewee", "facilitator"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

/** Same list as the research-raw bucket's allowed_mime_types. */
export const AUDIO_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
] as const;
export type AudioContentType = (typeof AUDIO_CONTENT_TYPES)[number];

const AUDIO_EXT: Record<AudioContentType, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
};

/** 500 MB, the bucket's file_size_limit (524288000 bytes). */
export const MAX_AUDIO_BYTES = 524_288_000;

/** Why an upload is refused. Never names a person. */
export const GATE_REASONS = [
  "collection_locked",
  "no_speakers",
  "processing_not_cleared",
  "guidance_missing",
  "out_of_scope_missing",
  "on_hold",
  "audio_exists",
] as const;
export type GateReason = (typeof GATE_REASONS)[number];

export const PLAYBACK_SECONDS = 600;

const BUCKET = "research-raw";
const PURPOSE = "research_capture";
const EDITABLE: readonly string[] = ["draft", "ready"];

export type SessionClearance = { speakers: number; processing: boolean; research: boolean };

export type SessionParticipantLink = {
  participantId: string;
  pseudoCode: string;
  role: ParticipantRole;
};

export type CaptureSession = {
  id: string;
  code: string;
  sessionType: SessionType;
  title: string | null;
  department: string | null;
  site: string | null;
  heldAt: string | null;
  studyMonth: number | null;
  notes: string | null;
  status: SessionStatus;
  guidanceVersion: string | null;
  guidanceGivenAt: string | null;
  outOfScopeAttested: boolean;
  hasAudio: boolean;
  audioBytes: number | null;
  audioSha256: string | null;
  audioUploadedAt: string | null;
  durationSec: number | null;
  retentionUntil: string | null;
  createdAt: string;
  updatedAt: string;
  participants: SessionParticipantLink[];
  /** Null when the flags could not be computed for this session. */
  clearance: SessionClearance | null;
};

export type StudySettingsView = {
  collectionUnlocked: boolean;
  departments: string[];
  sites: string[];
  speakerGuidanceVersion: string | null;
  retentionYears: number;
  studyEnd: string | null;
};

export type SessionsAccess = {
  /** Admin, researcher or data steward: every department. */
  allDepartments: boolean;
  /** Departments a dept coordinator may work on. */
  departments: string[];
  canPlayback: boolean;
  /** Data stewards only: they review sessions put on hold (e.g. by a withdrawal). */
  canReview: boolean;
};

/**
 * Active codes only. Whether a code is inactive is never sent to the page: an inactive
 * code can point to a withdrawal, which only consent keepers may know about.
 */
export type ParticipantCode = {
  id: string;
  pseudoCode: string;
  department: string | null;
  site: string | null;
};

// ---------------------------------------------------------------------------
// Untyped table access: these tables are not in the generated types yet.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Res<T> = { data: T | null; error: DbError | null };
interface Query<T> extends PromiseLike<Res<T>> {
  select(cols: string): Query<T>;
  eq(col: string, value: string | number | boolean): Query<T>;
  in(col: string, values: readonly string[]): Query<T>;
  is(col: string, value: null): Query<T>;
  order(col: string, opts: { ascending: boolean; nullsFirst?: boolean }): Query<T>;
  range(from: number, to: number): Query<T>;
  maybeSingle(): PromiseLike<Res<Row>>;
  single(): PromiseLike<Res<Row>>;
}
type Table = {
  select(cols: string): Query<Row[]>;
  insert(rows: Row | Row[]): Query<Row[]>;
  update(patch: Row): Query<Row[]>;
  delete(): Query<Row[]>;
};
type Db = {
  from(
    table:
      | "capture_sessions"
      | "session_participants"
      | "participants"
      | "study_settings"
      | "audit_events",
  ): Table;
  rpc(fn: "session_clearance", args: { _session: string }): PromiseLike<Res<unknown>>;
};

const asDb = (supabase: unknown) => supabase as Db;

function friendly(error: DbError): Error {
  // PGRST205 / 42P01: table missing. PGRST202 / 42883: function missing. Either way the
  // consent-and-capture migration has not been applied yet.
  if (["PGRST205", "42P01", "PGRST202", "42883"].includes(error.code ?? "")) {
    return new Error("SESSIONS_TABLE_MISSING");
  }
  if (error.code === "42501") return new Error("SESSIONS_FORBIDDEN");
  // Message and code only: details can echo row values.
  console.error("[sessions]", error.code, error.message);
  return new Error("SESSIONS_DB_ERROR");
}

function storageError(error: { message: string }): Error {
  if (/bucket/i.test(error.message) && /not.?found/i.test(error.message)) {
    return new Error("SESSIONS_TABLE_MISSING");
  }
  console.error("[sessions] storage", error.message);
  return new Error("SESSIONS_STORAGE_ERROR");
}

async function audit(db: Db, row: Row): Promise<boolean> {
  const { error } = await db.from("audit_events").insert(row);
  if (error) {
    console.warn("[sessions] audit insert failed", error.code, error.message);
    return false;
  }
  return true;
}

const PAGE = 1000; // PostgREST default max-rows

async function fetchAll(page: (from: number, to: number) => PromiseLike<Res<Row[]>>) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw friendly(error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Runs fn over items with at most `limit` calls in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const SESSION_COLS =
  "id, code, session_type, title, department, site, held_at, study_month, notes, status, speaker_guidance_version, speaker_guidance_given_at, out_of_scope_attested, audio_path, audio_bytes, audio_sha256, audio_uploaded_at, duration_sec, retention_until, created_at, updated_at";

function toSession(
  r: Row,
  participants: SessionParticipantLink[],
  clearance: SessionClearance | null,
): CaptureSession {
  const s = (k: string) => (r[k] as string | null) ?? null;
  const n = (k: string) => (r[k] == null ? null : Number(r[k]));
  return {
    id: r.id as string,
    code: r.code as string,
    sessionType: r.session_type as SessionType,
    title: s("title"),
    department: s("department"),
    site: s("site"),
    heldAt: s("held_at"),
    studyMonth: n("study_month"),
    notes: s("notes"),
    status: r.status as SessionStatus,
    guidanceVersion: s("speaker_guidance_version"),
    guidanceGivenAt: s("speaker_guidance_given_at"),
    outOfScopeAttested: Boolean(r.out_of_scope_attested),
    hasAudio: Boolean(r.audio_path),
    audioBytes: n("audio_bytes"),
    audioSha256: s("audio_sha256"),
    audioUploadedAt: s("audio_uploaded_at"),
    durationSec: n("duration_sec"),
    retentionUntil: s("retention_until"),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    participants,
    clearance,
  };
}

function parseClearance(value: unknown): SessionClearance {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    speakers: Number(o.speakers) || 0,
    processing: o.processing === true,
    research: o.research === true,
  };
}

async function clearanceOf(db: Db, sessionId: string): Promise<SessionClearance> {
  const { data, error } = await db.rpc("session_clearance", { _session: sessionId });
  if (error) throw friendly(error);
  return parseClearance(data);
}

async function loadSession(db: Db, sessionId: string): Promise<Row> {
  const { data, error } = await db
    .from("capture_sessions")
    .select(SESSION_COLS)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw friendly(error);
  // Not there, or RLS hides it (another department): same answer either way.
  if (!data) throw new Error("SESSIONS_NOT_FOUND");
  return data;
}

async function loadSettings(db: Db): Promise<StudySettingsView> {
  const { data, error } = await db
    .from("study_settings")
    .select(
      "collection_unlocked, departments, sites, speaker_guidance_version, retention_years, study_end",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw friendly(error);
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  // No visible row means collection stays locked.
  return {
    collectionUnlocked: data?.collection_unlocked === true,
    departments: list(data?.departments),
    sites: list(data?.sites),
    speakerGuidanceVersion: (data?.speaker_guidance_version as string | null) ?? null,
    retentionYears: Number(data?.retention_years ?? 5) || 5,
    studyEnd: (data?.study_end as string | null) ?? null,
  };
}

function sessionsAccess(access: ResearchAccess): SessionsAccess {
  const steward = access.roles.includes("data_steward");
  const researcher = access.roles.includes("researcher");
  return {
    allDepartments: access.isAdmin || steward || researcher,
    departments: access.departments,
    canPlayback: access.isAdmin || steward || researcher,
    // Holds usually follow a withdrawal. Only a data steward (a consent keeper, who can see
    // why) reviews them; admins are not consent keepers.
    canReview: steward,
  };
}

/** Department and site must come from the study lists when those lists are set. */
function checkPlace(
  settings: StudySettingsView,
  access: ResearchAccess,
  place: { department?: string; site?: string },
) {
  const { department, site } = place;
  if (department !== undefined) {
    if (settings.departments.length && !settings.departments.includes(department)) {
      throw new Error("SESSIONS_BAD_DEPARTMENT");
    }
    if (!sessionsAccess(access).allDepartments && !access.departments.includes(department)) {
      throw new Error("SESSIONS_DEPARTMENT_NOT_YOURS");
    }
  }
  if (site !== undefined && settings.sites.length && !settings.sites.includes(site)) {
    throw new Error("SESSIONS_BAD_SITE");
  }
}

function gateReasons(
  session: Row,
  settings: StudySettingsView,
  clearance: SessionClearance,
): GateReason[] {
  const reasons: GateReason[] = [];
  if (!settings.collectionUnlocked) reasons.push("collection_locked");
  if (clearance.speakers === 0) reasons.push("no_speakers");
  else if (!clearance.processing) reasons.push("processing_not_cleared");
  if (!session.speaker_guidance_given_at) reasons.push("guidance_missing");
  if (!session.out_of_scope_attested) reasons.push("out_of_scope_missing");
  if (session.status === "on_hold" || session.status === "closed") reasons.push("on_hold");
  if (session.audio_path) reasons.push("audio_exists");
  return reasons;
}

const STORAGE_NAME = /^\d{13}\.[a-z0-9]{2,5}$/;

/**
 * Removes raw audio in a session folder that no session row points to (a second upload,
 * a refused confirm), so nothing sits in the bucket outside retention tracking.
 * Best effort: a failure is logged without paths and never blocks the caller.
 */
async function removeUnlinked(folder: string, names: string[]) {
  const safe = names.filter((n) => STORAGE_NAME.test(n));
  if (!safe.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove(safe.map((n) => `${folder}/${n}`));
  if (error) console.warn("[sessions] could not remove unlinked audio", error.message);
}

/** (study_end, else held_at, else today) + retention_years, as YYYY-MM-DD. */
function retentionUntil(settings: StudySettingsView, heldAt: string | null) {
  const base = settings.studyEnd ?? heldAt ?? new Date().toISOString().slice(0, 10);
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + settings.retentionYears);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const uuid = z.string().uuid();

// Real calendar dates only (2026-02-30 would fail in Postgres).
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "invalid date")
  // A sensible study window, so a typo cannot push retention decades away.
  .refine((s) => s >= "2020-01-01" && s <= "2100-12-31", "date out of range");

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const SessionFields = z.object({
  sessionType: z.enum(SESSION_TYPES),
  title: optText(200),
  department: z.string().trim().min(1).max(120),
  site: z.string().trim().min(1).max(120),
  heldAt: isoDate,
  studyMonth: z
    .number()
    .int()
    .min(1)
    .max(12)
    .nullish()
    .transform((v) => v ?? null),
  notes: optText(2000),
});
export type SessionFieldsInput = z.input<typeof SessionFields>;

const SessionId = z.object({ sessionId: uuid });

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireResearch("session_worker")])
  .handler(async ({ context }) => {
    const db = asDb(context.supabase);
    const [sessionRows, linkRows, settings] = await Promise.all([
      fetchAll((from, to) =>
        db
          .from("capture_sessions")
          .select(SESSION_COLS)
          .order("held_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      // RLS returns links only for sessions the caller can see; pseudo codes only.
      fetchAll((from, to) =>
        db
          .from("session_participants")
          .select("session_id, participant_id, role, participants(pseudo_code)")
          .order("session_id", { ascending: true })
          .order("participant_id", { ascending: true })
          .range(from, to),
      ),
      loadSettings(db),
    ]);

    const links = new Map<string, SessionParticipantLink[]>();
    for (const l of linkRows) {
      const p = l.participants as { pseudo_code?: string } | null;
      const list = links.get(l.session_id as string) ?? [];
      list.push({
        participantId: l.participant_id as string,
        pseudoCode: p?.pseudo_code ?? "?",
        role: l.role as ParticipantRole,
      });
      links.set(l.session_id as string, list);
    }
    for (const list of links.values())
      list.sort((a, b) => a.pseudoCode.localeCompare(b.pseudoCode));

    const clearances = await mapLimit(sessionRows, 8, async (r) => {
      const { data, error } = await db.rpc("session_clearance", { _session: r.id as string });
      if (error) {
        const e = friendly(error);
        if (e.message === "SESSIONS_TABLE_MISSING") throw e;
        return null; // one failed flag does not sink the list
      }
      return parseClearance(data);
    });

    return {
      sessions: sessionRows.map((r, i) =>
        toSession(r, links.get(r.id as string) ?? [], clearances[i]),
      ),
      settings,
      access: sessionsAccess(context.access),
    };
  });

/**
 * Pseudonymous codes for the speaker picker. No identity, no consent data, and only active
 * codes: the active flag itself is never returned, since it can hint at a withdrawal.
 */
export const listParticipantCodes = createServerFn({ method: "GET" })
  .middleware([requireResearch("session_worker")])
  .handler(async ({ context }) => {
    const db = asDb(context.supabase);
    const rows = await fetchAll((from, to) =>
      db
        .from("participants")
        .select("id, pseudo_code, department, site")
        .eq("active", true)
        .order("pseudo_code", { ascending: true })
        .range(from, to),
    );
    const participants: ParticipantCode[] = rows.map((r) => ({
      id: r.id as string,
      pseudoCode: r.pseudo_code as string,
      department: (r.department as string | null) ?? null,
      site: (r.site as string | null) ?? null,
    }));
    return { participants };
  });

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------
export const createSession = createServerFn({ method: "POST" })
  .middleware([requireResearch("session_worker")])
  .inputValidator((i: unknown) => SessionFields.parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    const settings = await loadSettings(db);
    checkPlace(settings, context.access, { department: data.department, site: data.site });
    const { data: row, error } = await db
      .from("capture_sessions")
      .insert({
        session_type: data.sessionType,
        title: data.title,
        department: data.department,
        site: data.site,
        held_at: data.heldAt,
        study_month: data.studyMonth,
        notes: data.notes,
        facilitator_id: context.userId,
      })
      .select("id, code")
      .single();
    if (error) throw friendly(error);
    if (!row) throw new Error("SESSIONS_DB_ERROR");
    await audit(db, {
      action: "session.create",
      object_type: "capture_session",
      object_id: row.id as string,
      purpose: PURPOSE,
      // No title or notes: free text can carry names.
      details: {
        code: row.code,
        session_type: data.sessionType,
        department: data.department,
        site: data.site,
        held_at: data.heldAt,
        study_month: data.studyMonth,
      },
    });
    return { id: row.id as string, code: row.code as string };
  });

export const updateSession = createServerFn({ method: "POST" })
  .middleware([requireResearch("session_worker")])
  .inputValidator((i: unknown) => SessionFields.extend({ sessionId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    const current = await loadSession(db, data.sessionId);
    if (!EDITABLE.includes(current.status as string)) throw new Error("SESSIONS_LOCKED");
    const settings = await loadSettings(db);
    // Only re-check a value that changes, so an older value is not refused after the lists move.
    checkPlace(settings, context.access, {
      department: data.department !== current.department ? data.department : undefined,
      site: data.site !== current.site ? data.site : undefined,
    });
    const patch: Row = {
      session_type: data.sessionType,
      title: data.title,
      department: data.department,
      site: data.site,
      held_at: data.heldAt,
      study_month: data.studyMonth,
      notes: data.notes,
    };
    const changed = Object.keys(patch).filter((k) => (current[k] ?? null) !== patch[k]);
    if (!changed.length) return { id: data.sessionId, changed: 0 };
    const { data: rows, error } = await db
      .from("capture_sessions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .in("status", EDITABLE)
      .select("id");
    if (error) throw friendly(error);
    if (!rows?.length) throw new Error("SESSIONS_LOCKED");
    await audit(db, {
      action: "session.update",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: PURPOSE,
      details: { code: current.code, changed },
    });
    return { id: data.sessionId, changed: changed.length };
  });

const ParticipantsInput = z.object({
  sessionId: uuid,
  participants: z
    .array(z.object({ participantId: uuid, role: z.enum(PARTICIPANT_ROLES) }))
    .max(100)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      for (const p of list) {
        if (seen.has(p.participantId)) {
          ctx.addIssue({ code: "custom", message: "duplicate participant" });
          return;
        }
        seen.add(p.participantId);
      }
    }),
});

/**
 * Replaces the speaker list. Frozen once audio exists (RLS refuses too), and while the
 * session is on hold or closed, so the list a data steward reviews stays as it was.
 */
export const setSessionParticipants = createServerFn({ method: "POST" })
  .middleware([requireResearch("session_worker")])
  .inputValidator((i: unknown) => ParticipantsInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    const session = await loadSession(db, data.sessionId);
    if (session.audio_path) throw new Error("SESSIONS_AUDIO_FROZEN");
    if (!EDITABLE.includes(session.status as string)) throw new Error("SESSIONS_LOCKED");

    const { data: currentRows, error: readErr } = await db
      .from("session_participants")
      .select("participant_id, role")
      .eq("session_id", data.sessionId);
    if (readErr) throw friendly(readErr);
    const current = new Map(
      (currentRows ?? []).map((r) => [r.participant_id as string, r.role as ParticipantRole]),
    );
    const next = new Map(data.participants.map((p) => [p.participantId, p.role]));

    // Newly linked codes must exist and be active.
    const newIds = data.participants
      .filter((p) => !current.has(p.participantId))
      .map((p) => p.participantId);
    if (newIds.length) {
      const { data: found, error } = await db
        .from("participants")
        .select("id, active")
        .in("id", newIds);
      if (error) throw friendly(error);
      if ((found ?? []).length !== newIds.length || (found ?? []).some((p) => p.active === false)) {
        throw new Error("SESSIONS_BAD_PARTICIPANT");
      }
    }

    // No UPDATE grant on links: a role change is a remove plus an add.
    const toRemove = [...current].filter(([id, role]) => next.get(id) !== role).map(([id]) => id);
    const toAdd = data.participants.filter((p) => current.get(p.participantId) !== p.role);

    if (toRemove.length) {
      const { error } = await db
        .from("session_participants")
        .delete()
        .eq("session_id", data.sessionId)
        .in("participant_id", toRemove);
      if (error) throw friendly(error);
    }
    if (toAdd.length) {
      const { error } = await db.from("session_participants").insert(
        toAdd.map((p) => ({
          session_id: data.sessionId,
          participant_id: p.participantId,
          role: p.role,
        })),
      );
      if (error) {
        // Put back what was removed so a failed save does not leave the list half changed.
        if (toRemove.length) {
          const restore = await db.from("session_participants").insert(
            toRemove.map((id) => ({
              session_id: data.sessionId,
              participant_id: id,
              role: current.get(id) ?? "speaker",
            })),
          );
          if (restore.error) console.warn("[sessions] restore links failed", restore.error.code);
        }
        throw friendly(error);
      }
    }

    const byRole = Object.fromEntries(
      PARTICIPANT_ROLES.map((r) => [r, data.participants.filter((p) => p.role === r).length]),
    );
    await audit(db, {
      action: "session.participants_set",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: PURPOSE,
      details: {
        code: session.code,
        total: data.participants.length,
        added: toAdd.length,
        removed: toRemove.length,
        by_role: byRole,
      },
    });
    return { total: data.participants.length };
  });

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------
function checklistOpen(session: Row) {
  return !session.audio_path && EDITABLE.includes(session.status as string);
}

export const confirmSpeakerGuidance = createServerFn({ method: "POST" })
  .middleware([requireResearch("session_worker")])
  .inputValidator((i: unknown) => SessionId.parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    const session = await loadSession(db, data.sessionId);
    if (!checklistOpen(session)) throw new Error("SESSIONS_LOCKED");
    const settings = await loadSettings(db);
    if (!settings.speakerGuidanceVersion) throw new Error("SESSIONS_GUIDANCE_NOT_SET");
    const now = new Date().toISOString();
    const status = session.out_of_scope_attested ? "ready" : (session.status as string);
    const { data: rows, error } = await db
      .from("capture_sessions")
      .update({
        speaker_guidance_version: settings.speakerGuidanceVersion,
        speaker_guidance_given_at: now,
        speaker_guidance_given_by: context.userId,
        status,
        updated_at: now,
      })
      .eq("id", data.sessionId)
      .in("status", EDITABLE)
      .is("audio_path", null)
      .select("id");
    if (error) throw friendly(error);
    if (!rows?.length) throw new Error("SESSIONS_LOCKED");
    await audit(db, {
      action: "session.speaker_guidance",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: PURPOSE,
      details: { code: session.code, version: settings.speakerGuidanceVersion, status },
    });
    return { version: settings.speakerGuidanceVersion, givenAt: now, status };
  });

export const attestOutOfScope = createServerFn({ method: "POST" })
  .middleware([requireResearch("session_worker")])
  .inputValidator((i: unknown) => SessionId.parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    const session = await loadSession(db, data.sessionId);
    if (!checklistOpen(session)) throw new Error("SESSIONS_LOCKED");
    const now = new Date().toISOString();
    const status = session.speaker_guidance_given_at ? "ready" : (session.status as string);
    const { data: rows, error } = await db
      .from("capture_sessions")
      .update({
        out_of_scope_attested: true,
        out_of_scope_attested_by: context.userId,
        status,
        updated_at: now,
      })
      .eq("id", data.sessionId)
      .in("status", EDITABLE)
      .is("audio_path", null)
      .select("id");
    if (error) throw friendly(error);
    if (!rows?.length) throw new Error("SESSIONS_LOCKED");
    await audit(db, {
      action: "session.out_of_scope_attested",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: PURPOSE,
      details: { code: session.code, status },
    });
    return { status };
  });

// ---------------------------------------------------------------------------
// Raw audio
// ---------------------------------------------------------------------------
const UploadInput = z.object({
  sessionId: uuid,
  // Accepted for the record of the request only: never used in the storage path or logs,
  // because file names often carry people's names.
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(AUDIO_CONTENT_TYPES),
  bytes: z.number().int().min(1).max(MAX_AUDIO_BYTES),
});

export type UploadGrant =
  | { allowed: false; reasons: GateReason[] }
  | { allowed: true; path: string; token: string; signedUrl: string };

/**
 * Server-side gate for raw audio. Every check is written to audit_events.
 * When it passes, signs a one-off upload to sessions/<id>/<epochMs>.<ext>.
 */
export const createAudioUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireResearch("session_worker")])
  .inputValidator((i: unknown) => UploadInput.parse(i))
  .handler(async ({ data, context }): Promise<UploadGrant> => {
    const db = asDb(context.supabase);
    const session = await loadSession(db, data.sessionId);
    const [settings, clearance] = await Promise.all([
      loadSettings(db),
      clearanceOf(db, data.sessionId),
    ]);
    const reasons = gateReasons(session, settings, clearance);
    const logged = await audit(db, {
      action: "session.gate_check",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: PURPOSE,
      details: {
        allowed: reasons.length === 0,
        reasons,
        content_type: data.contentType,
        bytes: data.bytes,
      },
    });
    if (reasons.length) return { allowed: false, reasons };
    // Fail closed: no audit row, no upload link.
    if (!logged) throw new Error("SESSIONS_AUDIT_FAILED");

    const path = `sessions/${data.sessionId}/${Date.now()}.${AUDIO_EXT[data.contentType]}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw storageError(error ?? { message: "no signed url" });
    return { allowed: true, path, token: signed.token, signedUrl: signed.signedUrl };
  });

const ConfirmInput = z.object({
  sessionId: uuid,
  path: z.string().trim().min(1).max(200),
  sha256: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{64}$/)
    .transform((s) => s.toLowerCase()),
  /** Size of the file the browser hashed; must equal the stored object. */
  bytes: z.number().int().min(1).max(MAX_AUDIO_BYTES),
  durationSec: z
    .number()
    .int()
    .min(1)
    .max(86_400)
    .nullish()
    .transform((v) => v ?? null),
});

const EXTS = [...new Set(Object.values(AUDIO_EXT))].join("|");

/** Links an uploaded object to its session after checking it is the one the server issued. */
export const confirmAudioUpload = createServerFn({ method: "POST" })
  .middleware([requireResearch("session_worker")])
  .inputValidator((i: unknown) => ConfirmInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    // Re-derive the issued shape: sessions/<this session>/<epochMs>.<ext>, nothing else.
    const folder = `sessions/${data.sessionId}`;
    const match = new RegExp(`^${folder}/(\\d{13})\\.(${EXTS})$`).exec(data.path);
    if (!match || Number(match[1]) > Date.now() + 5 * 60_000) {
      throw new Error("SESSIONS_BAD_PATH");
    }
    const name = data.path.slice(folder.length + 1);

    const session = await loadSession(db, data.sessionId); // RLS authorises the caller
    if (session.audio_path) {
      // A second upload for a session that already has audio: drop the extra copy.
      if (session.audio_path !== data.path) await removeUnlinked(folder, [name]);
      throw new Error("SESSIONS_AUDIO_EXISTS");
    }
    // A closed session never takes audio, and is never reopened as "on hold" by an upload
    // that was signed before it was closed.
    if (session.status === "closed") {
      await removeUnlinked(folder, [name]);
      throw new Error("SESSIONS_LOCKED");
    }

    // Only the server can sign uploads into this folder, so an object here was issued by us.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: objects, error: listErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(folder, { limit: 100, search: name });
    if (listErr) throw storageError(listErr);
    const object = (objects ?? []).find((o) => o.name === name);
    if (!object) throw new Error("SESSIONS_UPLOAD_NOT_FOUND");
    const size = Number(object.metadata?.size ?? 0);
    if (!size || size > MAX_AUDIO_BYTES || size !== data.bytes) {
      // Not the file the browser hashed: do not keep it.
      await removeUnlinked(folder, [name]);
      throw new Error("SESSIONS_UPLOAD_SIZE_MISMATCH");
    }
    const mimetype = (object.metadata?.mimetype as string | undefined) ?? null;

    // Anything that changed since the gate check (a withdrawal, a new speaker, a lock) keeps
    // the audio governed but holds the session for a data steward to review.
    const [settings, clearance] = await Promise.all([
      loadSettings(db),
      clearanceOf(db, data.sessionId),
    ]);
    const heldReasons = gateReasons(session, settings, clearance);
    const status: SessionStatus = heldReasons.length ? "on_hold" : "recorded";
    const retention = retentionUntil(settings, (session.held_at as string | null) ?? null);
    const now = new Date().toISOString();

    // Audio columns are writable by the service role only (see the migration's column grants).
    // The caller was authorised above by loadSession under RLS; the database trigger re-checks
    // the capture gate on this write.
    const { data: rows, error } = await asDb(supabaseAdmin)
      .from("capture_sessions")
      .update({
        audio_path: data.path,
        audio_bytes: size,
        audio_sha256: data.sha256,
        audio_uploaded_at: now,
        audio_uploaded_by: context.userId,
        duration_sec: data.durationSec,
        retention_until: retention,
        status,
        updated_at: now,
      })
      .eq("id", data.sessionId)
      .is("audio_path", null)
      // Not "closed": a session closed meanwhile stays closed.
      .in("status", ["draft", "ready", "on_hold"])
      .select("id");
    if (error) {
      // e.g. the database gate refused after a withdrawal landed in between. Keep nothing
      // that is not linked, but never touch the object if the write did go through.
      const latest = await loadSession(db, data.sessionId).catch(() => null);
      if (latest && latest.audio_path !== data.path) await removeUnlinked(folder, [name]);
      throw friendly(error);
    }
    if (!rows?.length) {
      // Lost a race (another upload was linked, or the session was closed). Drop this copy
      // unless it is the very object that got linked (a repeated confirm).
      const latest = await loadSession(db, data.sessionId).catch(() => null);
      if (latest && latest.audio_path !== data.path) await removeUnlinked(folder, [name]);
      throw new Error(latest?.status === "closed" ? "SESSIONS_LOCKED" : "SESSIONS_AUDIO_EXISTS");
    }

    // Any other object left in this folder (a second upload, an abandoned try) is unlinked.
    const { data: others } = await supabaseAdmin.storage.from(BUCKET).list(folder, { limit: 100 });
    await removeUnlinked(
      folder,
      (others ?? []).map((o) => o.name).filter((n) => n !== name),
    );

    await audit(db, {
      action: "session.audio_upload",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: PURPOSE,
      details: {
        code: session.code,
        bytes: size,
        sha256: data.sha256,
        duration_sec: data.durationSec,
        content_type: mimetype,
        status,
        held_reasons: heldReasons,
        retention_until: retention,
      },
    });
    return { status, retentionUntil: retention, bytes: size };
  });

const PlaybackInput = z.object({
  sessionId: uuid,
  purpose: z.string().trim().min(5).max(200),
});

/**
 * Short-lived playback link. Not for dept coordinators. Every link is audited with its purpose.
 * Sessions on hold or closed play only for data stewards (the reviewers), and everyone else
 * also needs every speaker to be cleared for processing right now.
 */
export const getAudioPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireResearch("admin", "researcher", "data_steward")])
  .inputValidator((i: unknown) => PlaybackInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    const session = await loadSession(db, data.sessionId); // RLS authorises the caller
    const path = (session.audio_path as string | null) ?? null;
    if (!path) throw new Error("SESSIONS_NO_AUDIO");
    // The path column is writable under RLS, so only trust the exact shape the server issues,
    // inside this session's folder.
    if (!new RegExp(`^sessions/${data.sessionId}/\\d{13}\\.(${EXTS})$`).test(path)) {
      throw new Error("SESSIONS_BAD_PATH");
    }
    if (!sessionsAccess(context.access).canReview) {
      // On hold (often after a withdrawal) or closed: only the reviewers may listen.
      if (session.status === "on_hold" || session.status === "closed") {
        throw new Error("SESSIONS_ON_HOLD");
      }
      // Consent can change after upload without a hold (e.g. a newer approved form).
      const clearance = await clearanceOf(db, data.sessionId);
      if (!clearance.processing) throw new Error("SESSIONS_NOT_CLEARED");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, PLAYBACK_SECONDS);
    if (error || !signed) throw storageError(error ?? { message: "no signed url" });

    // Fail closed: no audit row, no link.
    const logged = await audit(db, {
      action: "session.audio_access",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: data.purpose,
      details: { code: session.code, expires_in: PLAYBACK_SECONDS, status: session.status },
    });
    if (!logged) throw new Error("SESSIONS_AUDIT_FAILED");
    return {
      url: signed.signedUrl,
      expiresAt: new Date(Date.now() + PLAYBACK_SECONDS * 1000).toISOString(),
    };
  });

// ---------------------------------------------------------------------------
// Review (sessions put on hold, e.g. by a withdrawal)
// ---------------------------------------------------------------------------
const StatusInput = z.object({
  sessionId: uuid,
  status: z.enum(["ready", "closed"]),
  note: z.string().trim().min(5).max(1000),
});

/**
 * Data stewards only: a hold usually follows a withdrawal, and only a consent keeper can see
 * why. Admins are not consent keepers, so they cannot release a hold.
 */
export const setSessionStatus = createServerFn({ method: "POST" })
  .middleware([requireResearch("data_steward")])
  .inputValidator((i: unknown) => StatusInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = asDb(context.supabase);
    const session = await loadSession(db, data.sessionId);
    if (session.status !== "on_hold") throw new Error("SESSIONS_NOT_ON_HOLD");
    // Resuming returns the session to where it really is: "recorded" when audio exists,
    // "ready" only when both checklist steps are done, otherwise "draft".
    const status: SessionStatus =
      data.status === "closed"
        ? "closed"
        : session.audio_path
          ? "recorded"
          : session.speaker_guidance_given_at && session.out_of_scope_attested
            ? "ready"
            : "draft";
    const { data: rows, error } = await db
      .from("capture_sessions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("status", "on_hold")
      .select("id");
    if (error) throw friendly(error);
    if (!rows?.length) throw new Error("SESSIONS_NOT_ON_HOLD");
    await audit(db, {
      action: "session.status_review",
      object_type: "capture_session",
      object_id: data.sessionId,
      purpose: PURPOSE,
      // The page asks reviewers to use pseudo codes, never names, in this note.
      details: { code: session.code, from: "on_hold", to: status, note: data.note },
    });
    return { status };
  });
