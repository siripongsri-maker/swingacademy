// CVSK consent registry: consent form versions, participants and their identity key,
// consent decisions and withdrawals (migration 20261012150000_consent_and_capture.sql).
//
// Access: consent keepers ONLY (consent_officer, data_steward). Admins and researchers are NOT
// consent keepers and get RESEARCH_FORBIDDEN here, even though they are staff.
// Every query runs on the caller's user-scoped client, so RLS (is_consent_keeper) applies too.
// No service-role client in this file.
//
// Privacy: never log names, contacts or individual decisions, neither in the console nor in
// audit_events details. Error logs carry the Postgres code and message only (details can echo
// row values back).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireResearch } from "@/lib/research-access";

export const CONSENT_GATES = ["processing", "research", "optional"] as const;
export type ConsentGate = (typeof CONSENT_GATES)[number];

export const CONSENT_METHODS = ["paper", "e_sign", "verbal_recorded"] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const CONSENT_DECISIONS = ["granted", "refused"] as const;
export type ConsentDecision = (typeof CONSENT_DECISIONS)[number];

export const WITHDRAWAL_SCOPES = ["all", "processing", "research", "optional"] as const;
export type WithdrawalScope = (typeof WITHDRAWAL_SCOPES)[number];

export const EXPERIENCE_TIERS = ["high", "low", "manager", "not_applicable"] as const;
export type ExperienceTier = (typeof EXPERIENCE_TIERS)[number];

export const PARTICIPANT_ROLES = [
  "speaker",
  "interviewee",
  "round0_answerer",
  "rater",
  "survey",
  "task",
] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const FORM_STATUSES = ["draft", "approved", "retired"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

/** Derived per gate. Only "granted" means cleared (same rule as SQL participant_cleared). */
export type GateStatus = "granted" | "refused" | "withdrawn" | "not_recorded" | "form_not_approved";

export const MAX_FORM_ITEMS = 12;
// Starts with a letter, so keys like "__proto__" (dropped by zod records) can never be used.
export const ITEM_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

// ---------------------------------------------------------------------------
// Shared validation (also used by the page for inline checks)
// ---------------------------------------------------------------------------

export const ConsentItemSchema = z.object({
  key: z.string().trim().regex(ITEM_KEY_PATTERN, "bad_key"),
  gate: z.enum(CONSENT_GATES),
  label_th: z.string().trim().min(1, "label_th_required").max(500),
  label_en: z.string().trim().min(1, "label_en_required").max(500),
});
export type ConsentFormItem = z.infer<typeof ConsentItemSchema>;

export const ConsentItemsSchema = z
  .array(ConsentItemSchema)
  .min(1, "too_few_items")
  .max(MAX_FORM_ITEMS, "too_many_items")
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((it, i) => {
      if (seen.has(it.key)) {
        ctx.addIssue({ code: "custom", path: [i, "key"], message: "duplicate_key" });
      }
      seen.add(it.key);
    });
    if (!items.some((it) => it.gate === "processing")) {
      ctx.addIssue({ code: "custom", message: "needs_processing" });
    }
    if (!items.some((it) => it.gate === "research")) {
      ctx.addIssue({ code: "custom", message: "needs_research" });
    }
  });

/** Today's date in Thailand (UTC+7), so an evening entry is not "in the future" on a UTC server. */
export function todayInThailand(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "invalid_date");
/** A real date between 2020-01-01 and today (Thailand). */
const pastDate = isoDate.refine(
  (s) => s >= "2020-01-01" && s <= todayInThailand(),
  "date_out_of_range",
);

/** Trimmed optional text; empty becomes null. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// Types returned to the page
// ---------------------------------------------------------------------------

export type ConsentForm = {
  id: string;
  version: string;
  title: string;
  items: ConsentFormItem[];
  status: FormStatus;
  approvedRef: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type ParticipantConsent = {
  formVersionId: string;
  formVersion: string;
  formStatus: FormStatus | null;
  itemKey: string;
  decision: ConsentDecision;
  method: ConsentMethod;
  givenAt: string;
  paperRef: string | null;
  withdrawnAt: string | null;
};

/** One form version a participant has records on, for corrections and the details view. */
export type SignedForm = {
  formVersionId: string;
  formVersion: string;
  formStatus: FormStatus | null;
  givenAt: string;
  method: ConsentMethod;
  paperRef: string | null;
  decisions: Record<string, ConsentDecision>;
  withdrawnKeys: string[];
};

export type ParticipantIdentity = {
  fullName: string;
  contact: string | null;
  note: string | null;
};

export type Participant = {
  id: string;
  pseudoCode: string;
  department: string | null;
  site: string | null;
  experienceTier: ExperienceTier | null;
  roles: ParticipantRole[];
  active: boolean;
  createdAt: string;
  identity: ParticipantIdentity | null;
  /** When the most recent withdrawal was recorded (any scope), or null if never. */
  lastWithdrawalAt: string | null;
  /** Latest decision per item key, across form versions. */
  consents: ParticipantConsent[];
  signedForms: SignedForm[];
  gates: Record<ConsentGate, GateStatus>;
  /** The approved form version the gate statuses are based on (null if none). */
  basisForm: { id: string; version: string } | null;
};

export type WithdrawalEvent = {
  id: string;
  participantId: string;
  pseudoCode: string | null;
  scope: WithdrawalScope;
  recordedAt: string;
  note: string | null;
  sessionsPutOnHold: number;
};

// ---------------------------------------------------------------------------
// Database access (tables are not in the generated types yet)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Res<T> = PromiseLike<{ data: T | null; error: DbError | null }>;
interface Query extends Res<Row[]> {
  select(cols: string): Query;
  eq(col: string, value: string | number | boolean): Query;
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): Query;
  range(from: number, to: number): Query;
  maybeSingle(): Res<Row>;
  single(): Res<Row>;
}
type Table = {
  select(cols: string): Query;
  insert(rows: Row | Row[]): Query;
  update(values: Row): Query;
  upsert(rows: Row | Row[], opts: { onConflict: string }): Query;
};
type ConsentDb = {
  from(
    table:
      | "consent_form_versions"
      | "participants"
      | "participant_identity"
      | "consents"
      | "withdrawal_events"
      | "study_settings"
      | "audit_events",
  ): Table;
  rpc(
    fn: "apply_withdrawal",
    args: { _participant: string; _scope: WithdrawalScope; _note: string | null },
  ): Res<number>;
};

const dbOf = (supabase: unknown) => supabase as ConsentDb;

/** Consent keepers only. Never "admin": admins cannot read consent decisions. */
const keeperOnly = requireResearch("consent_keeper");

function friendly(error: DbError, where: string): Error {
  // PGRST205 (PostgREST 12+) / 42P01: table missing; PGRST202 / 42883: function missing.
  if (["PGRST205", "42P01", "PGRST202", "42883"].includes(error.code ?? "")) {
    return new Error("CONSENT_TABLE_MISSING");
  }
  if (error.code === "42501") return new Error("CONSENT_FORBIDDEN");
  if (error.code === "23505") return new Error("CONSENT_DUPLICATE");
  if (error.code === "23503") return new Error("CONSENT_NOT_FOUND");
  console.error(`[consent] ${where}`, error.code, error.message);
  return new Error("CONSENT_DB_ERROR");
}

async function audit(
  db: ConsentDb,
  action: string,
  objectType: string,
  objectId: string,
  details: Row,
) {
  const { error } = await db.from("audit_events").insert({
    action,
    object_type: objectType,
    object_id: objectId,
    purpose: "research_consent",
    details,
  });
  if (error) console.warn("[consent] audit insert failed", action, error.code, error.message);
}

const PAGE = 1000; // PostgREST default max-rows

async function selectAll(make: (from: number, to: number) => Query, where: string) {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) throw friendly(error, where);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const str = (r: Row, k: string) => (r[k] as string | null | undefined) ?? null;

function parseItems(raw: unknown): ConsentFormItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((it): ConsentFormItem[] => {
    if (!it || typeof it !== "object") return [];
    const o = it as Row;
    const gate = o.gate as ConsentGate;
    if (typeof o.key !== "string" || !(CONSENT_GATES as readonly string[]).includes(gate))
      return [];
    return [
      {
        key: o.key,
        gate,
        label_th: typeof o.label_th === "string" ? o.label_th : "",
        label_en: typeof o.label_en === "string" ? o.label_en : "",
      },
    ];
  });
}

const FORM_COLS = "id, version, title, items, status, approved_ref, approved_at, created_at";

function formFromDb(r: Row): ConsentForm {
  return {
    id: r.id as string,
    version: r.version as string,
    title: (r.title as string) ?? "",
    items: parseItems(r.items),
    status: (r.status as FormStatus) ?? "draft",
    approvedRef: str(r, "approved_ref"),
    approvedAt: str(r, "approved_at"),
    createdAt: r.created_at as string,
  };
}

async function loadForms(db: ConsentDb) {
  const rows = await selectAll(
    (a, b) =>
      db
        .from("consent_form_versions")
        .select(FORM_COLS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(a, b),
    "forms",
  );
  return rows.map(formFromDb);
}

async function participantExists(db: ConsentDb, id: string) {
  const { data, error } = await db
    .from("participants")
    .select("id, pseudo_code")
    .eq("id", id)
    .maybeSingle();
  if (error) throw friendly(error, "participant lookup");
  if (!data) throw new Error("CONSENT_NOT_FOUND");
  return data.pseudo_code as string;
}

// ---------------------------------------------------------------------------
// Derived clearance, mirroring SQL participant_cleared(): take the most recent APPROVED form
// version the person has records on (given_at desc, then approved_at desc); a gate is cleared
// when every item of that gate on that form is granted and not withdrawn.
// ---------------------------------------------------------------------------

type ConsentRow = {
  formVersionId: string;
  itemKey: string;
  decision: ConsentDecision;
  method: ConsentMethod;
  givenAt: string;
  paperRef: string | null;
  withdrawnAt: string | null;
  createdAt: string;
};

const desc = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");

function deriveGates(rows: ConsentRow[], formById: Map<string, ConsentForm>) {
  const onApproved = rows
    .filter((r) => formById.get(r.formVersionId)?.status === "approved")
    .sort(
      (a, b) =>
        desc(a.givenAt, b.givenAt) ||
        desc(
          formById.get(a.formVersionId)?.approvedAt ?? null,
          formById.get(b.formVersionId)?.approvedAt ?? null,
        ) ||
        desc(a.createdAt, b.createdAt),
    );
  const gates = {} as Record<ConsentGate, GateStatus>;

  if (!onApproved.length) {
    // Not cleared. Explain why: a withdrawal on any form shows as withdrawn, records on draft or
    // retired forms show as "form not approved", nothing at all shows as not recorded.
    for (const g of CONSENT_GATES) {
      const ofGate = rows.filter((r) =>
        formById.get(r.formVersionId)?.items.some((it) => it.key === r.itemKey && it.gate === g),
      );
      gates[g] = ofGate.some((r) => r.withdrawnAt)
        ? "withdrawn"
        : rows.length
          ? "form_not_approved"
          : "not_recorded";
    }
    return { gates, basisForm: null };
  }

  const form = formById.get(onApproved[0].formVersionId)!;
  const mine = new Map(
    rows.filter((r) => r.formVersionId === form.id).map((r) => [r.itemKey, r] as const),
  );
  for (const g of CONSENT_GATES) {
    const recs = form.items.filter((it) => it.gate === g).map((it) => mine.get(it.key));
    if (!recs.length)
      gates[g] = "not_recorded"; // the form has no item for this gate
    else if (recs.every((r) => r && r.decision === "granted" && !r.withdrawnAt)) {
      gates[g] = "granted";
    } else if (recs.some((r) => r?.withdrawnAt)) gates[g] = "withdrawn";
    else if (recs.some((r) => r?.decision === "refused")) gates[g] = "refused";
    else gates[g] = "not_recorded";
  }
  return { gates, basisForm: { id: form.id, version: form.version } };
}

// ---------------------------------------------------------------------------
// Consent forms
// ---------------------------------------------------------------------------

export const listConsentForms = createServerFn({ method: "GET" })
  .middleware([keeperOnly])
  .handler(async ({ context }) => {
    const forms = await loadForms(dbOf(context.supabase));
    return { forms };
  });

const SaveFormInput = z
  .object({
    id: uuid.optional(),
    version: z.string().trim().regex(VERSION_PATTERN, "bad_version").optional(),
    title: z.string().trim().min(1).max(200),
    items: ConsentItemsSchema,
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.version) {
      ctx.addIssue({ code: "custom", path: ["version"], message: "version_required" });
    }
  });

/** Create a new DRAFT version, or update an existing draft. Approved and retired forms are immutable. */
export const saveConsentForm = createServerFn({ method: "POST" })
  .middleware([keeperOnly])
  .inputValidator((i: unknown) => SaveFormInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = dbOf(context.supabase);
    if (data.id) {
      const { data: updated, error } = await db
        .from("consent_form_versions")
        .update({ title: data.title, items: data.items })
        .eq("id", data.id)
        .eq("status", "draft") // atomic guard: never touch approved or retired versions
        .select("id, version");
      if (error) throw friendly(error, "form update");
      if (!updated?.length) {
        const { data: found, error: e2 } = await db
          .from("consent_form_versions")
          .select("id")
          .eq("id", data.id)
          .maybeSingle();
        if (e2) throw friendly(e2, "form lookup");
        throw new Error(found ? "CONSENT_FORM_LOCKED" : "CONSENT_FORM_NOT_FOUND");
      }
      const version = updated[0].version as string;
      await audit(db, "consent_form.update", "consent_form_version", data.id, {
        version,
        items: data.items.length,
      });
      return { id: data.id, version };
    }

    const { data: created, error } = await db
      .from("consent_form_versions")
      .insert({ version: data.version, title: data.title, items: data.items, status: "draft" })
      .select("id, version")
      .single();
    if (error?.code === "23505") throw new Error("CONSENT_FORM_VERSION_TAKEN");
    if (error || !created) throw friendly(error ?? { message: "no row" }, "form insert");
    const id = created.id as string;
    await audit(db, "consent_form.create", "consent_form_version", id, {
      version: created.version,
      items: data.items.length,
    });
    return { id, version: created.version as string };
  });

const ApproveFormInput = z.object({
  id: uuid,
  approvedRef: z.string().trim().min(1).max(120),
  approvedAt: pastDate,
});

/** Draft to approved, with the ethics committee reference and date. */
export const approveConsentForm = createServerFn({ method: "POST" })
  .middleware([keeperOnly])
  .inputValidator((i: unknown) => ApproveFormInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = dbOf(context.supabase);
    const { data: form, error } = await db
      .from("consent_form_versions")
      .select("id, version, status, items")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw friendly(error, "form lookup");
    if (!form) throw new Error("CONSENT_FORM_NOT_FOUND");
    if (form.status !== "draft") throw new Error("CONSENT_FORM_NOT_DRAFT");
    // The stored items must still meet the rules (a draft may have been seeded by SQL).
    if (!ConsentItemsSchema.safeParse(form.items).success) throw new Error("CONSENT_FORM_INVALID");
    // Records on a draft are practice and were promised not to count. SQL participant_cleared()
    // counts every record on an approved form, so approving this draft would silently turn
    // practice records into real consent. Such a draft must be copied to a new draft instead.
    const { data: practice, error: e3 } = await db
      .from("consents")
      .select("form_version_id")
      .eq("form_version_id", data.id)
      .range(0, 0);
    if (e3) throw friendly(e3, "practice lookup");
    if (practice?.length) throw new Error("CONSENT_FORM_HAS_RECORDS");

    const { data: updated, error: e2 } = await db
      .from("consent_form_versions")
      .update({ status: "approved", approved_ref: data.approvedRef, approved_at: data.approvedAt })
      .eq("id", data.id)
      .eq("status", "draft")
      .select("id");
    if (e2) throw friendly(e2, "form approve");
    if (!updated?.length) throw new Error("CONSENT_FORM_NOT_DRAFT");
    await audit(db, "consent_form.approve", "consent_form_version", data.id, {
      version: form.version,
      approved_ref: data.approvedRef,
      approved_at: data.approvedAt,
    });
    return { id: data.id, version: form.version as string };
  });

/** Approved to retired. Consents on a retired form no longer count for clearance. */
export const retireConsentForm = createServerFn({ method: "POST" })
  .middleware([keeperOnly])
  .inputValidator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const db = dbOf(context.supabase);
    const { data: updated, error } = await db
      .from("consent_form_versions")
      .update({ status: "retired" })
      .eq("id", data.id)
      .eq("status", "approved")
      .select("id, version");
    if (error) throw friendly(error, "form retire");
    if (!updated?.length) {
      const { data: found, error: e2 } = await db
        .from("consent_form_versions")
        .select("id")
        .eq("id", data.id)
        .maybeSingle();
      if (e2) throw friendly(e2, "form lookup");
      throw new Error(found ? "CONSENT_FORM_NOT_APPROVED" : "CONSENT_FORM_NOT_FOUND");
    }
    const version = updated[0].version as string;
    await audit(db, "consent_form.retire", "consent_form_version", data.id, { version });
    return { id: data.id, version };
  });

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

const PARTICIPANT_COLS =
  "id, pseudo_code, department, site, experience_tier, roles, active, created_at";
const CONSENT_COLS =
  "participant_id, form_version_id, item_key, decision, method, given_at, paper_ref, withdrawn_at, created_at";

const isRole = (r: unknown): r is ParticipantRole =>
  (PARTICIPANT_ROLES as readonly unknown[]).includes(r);
const isTier = (r: unknown): r is ExperienceTier =>
  (EXPERIENCE_TIERS as readonly unknown[]).includes(r);

/** Participants with identity, consents (latest per item) and derived per-gate status. */
export const listParticipants = createServerFn({ method: "GET" })
  .middleware([keeperOnly])
  .handler(async ({ context }) => {
    const db = dbOf(context.supabase);
    const [participantRows, identityRows, consentRows, withdrawalRows, forms, settings] =
      await Promise.all([
        selectAll(
          (a, b) =>
            db
              .from("participants")
              .select(PARTICIPANT_COLS)
              .order("pseudo_code", { ascending: true })
              .range(a, b),
          "participants",
        ),
        selectAll(
          (a, b) =>
            db
              .from("participant_identity")
              .select("participant_id, full_name, contact, note")
              .order("participant_id", { ascending: true })
              .range(a, b),
          "identity",
        ),
        selectAll(
          (a, b) =>
            db.from("consents").select(CONSENT_COLS).order("id", { ascending: true }).range(a, b),
          "consents",
        ),
        selectAll(
          (a, b) =>
            db
              .from("withdrawal_events")
              .select("participant_id, recorded_at")
              .order("id", { ascending: true })
              .range(a, b),
          "withdrawal dates",
        ),
        loadForms(db),
        // Department and site suggestions; not essential, so errors are ignored.
        db.from("study_settings").select("departments, sites").eq("id", 1).maybeSingle(),
      ]);

    const formById = new Map(forms.map((f) => [f.id, f]));
    const identityBy = new Map(
      identityRows.map((r) => [
        r.participant_id as string,
        {
          fullName: (r.full_name as string) ?? "",
          contact: str(r, "contact"),
          note: str(r, "note"),
        } satisfies ParticipantIdentity,
      ]),
    );
    const lastWithdrawalBy = new Map<string, string>();
    for (const r of withdrawalRows) {
      const pid = r.participant_id as string;
      const at = r.recorded_at as string;
      const prev = lastWithdrawalBy.get(pid);
      if (!prev || at > prev) lastWithdrawalBy.set(pid, at);
    }
    const consentsBy = new Map<string, ConsentRow[]>();
    for (const r of consentRows) {
      const pid = r.participant_id as string;
      const list = consentsBy.get(pid) ?? [];
      list.push({
        formVersionId: r.form_version_id as string,
        itemKey: r.item_key as string,
        decision: r.decision as ConsentDecision,
        method: r.method as ConsentMethod,
        givenAt: r.given_at as string,
        paperRef: str(r, "paper_ref"),
        withdrawnAt: str(r, "withdrawn_at"),
        createdAt: r.created_at as string,
      });
      consentsBy.set(pid, list);
    }

    const participants: Participant[] = participantRows.map((r) => {
      const id = r.id as string;
      const rows = consentsBy.get(id) ?? [];
      const formInfo = (fid: string) => {
        const f = formById.get(fid);
        return { formVersion: f?.version ?? "?", formStatus: f?.status ?? null };
      };

      const latest = new Map<string, ConsentRow>();
      for (const c of rows) {
        const prev = latest.get(c.itemKey);
        if (
          !prev ||
          c.givenAt > prev.givenAt ||
          (c.givenAt === prev.givenAt && c.createdAt > prev.createdAt)
        ) {
          latest.set(c.itemKey, c);
        }
      }

      const byForm = new Map<string, SignedForm>();
      for (const c of rows) {
        const s = byForm.get(c.formVersionId) ?? {
          formVersionId: c.formVersionId,
          ...formInfo(c.formVersionId),
          givenAt: c.givenAt,
          method: c.method,
          paperRef: c.paperRef,
          decisions: {},
          withdrawnKeys: [],
        };
        s.decisions[c.itemKey] = c.decision;
        if (c.withdrawnAt) s.withdrawnKeys.push(c.itemKey);
        if (c.givenAt > s.givenAt) {
          s.givenAt = c.givenAt;
          s.method = c.method;
          s.paperRef = c.paperRef;
        }
        byForm.set(c.formVersionId, s);
      }

      const { gates, basisForm } = deriveGates(rows, formById);
      return {
        id,
        pseudoCode: r.pseudo_code as string,
        department: str(r, "department"),
        site: str(r, "site"),
        experienceTier: isTier(r.experience_tier) ? r.experience_tier : null,
        roles: Array.isArray(r.roles) ? r.roles.filter(isRole) : [],
        active: r.active !== false,
        createdAt: r.created_at as string,
        identity: identityBy.get(id) ?? null,
        lastWithdrawalAt: lastWithdrawalBy.get(id) ?? null,
        consents: [...latest.values()]
          .sort((a, b) => a.itemKey.localeCompare(b.itemKey))
          .map((c) => ({
            formVersionId: c.formVersionId,
            ...formInfo(c.formVersionId),
            itemKey: c.itemKey,
            decision: c.decision,
            method: c.method,
            givenAt: c.givenAt,
            paperRef: c.paperRef,
            withdrawnAt: c.withdrawnAt,
          })),
        signedForms: [...byForm.values()].sort((a, b) => desc(a.givenAt, b.givenAt)),
        gates,
        basisForm,
      };
    });

    const s = settings.error ? null : settings.data;
    const list = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return {
      participants,
      options: { departments: list(s?.departments), sites: list(s?.sites) },
    };
  });

const IdentityInput = z.object({
  fullName: z.string().trim().min(1).max(200),
  contact: optText(200),
  note: optText(1000),
});

const DetailsInput = z.object({
  department: optText(120),
  site: optText(120),
  experienceTier: z
    .enum(EXPERIENCE_TIERS)
    .nullish()
    .transform((v) => v ?? null),
  roles: z
    .array(z.enum(PARTICIPANT_ROLES))
    .max(PARTICIPANT_ROLES.length)
    .transform((r) => [...new Set(r)]),
});

const CreateParticipantInput = IdentityInput.merge(DetailsInput);

/**
 * Enrol a participant: pseudonymous row first (pseudo_code from the DB), then the identity key.
 * If the identity insert fails the participant row still exists; the result says so and the page
 * offers to retry the identity through updateParticipant.
 */
export const createParticipant = createServerFn({ method: "POST" })
  .middleware([keeperOnly])
  .inputValidator((i: unknown) => CreateParticipantInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = dbOf(context.supabase);
    const { data: created, error } = await db
      .from("participants")
      .insert({
        department: data.department,
        site: data.site,
        experience_tier: data.experienceTier,
        roles: data.roles,
      })
      .select("id, pseudo_code")
      .single();
    if (error || !created) throw friendly(error ?? { message: "no row" }, "participant insert");
    const participantId = created.id as string;
    const pseudoCode = created.pseudo_code as string;

    const { error: idError } = await db.from("participant_identity").insert({
      participant_id: participantId,
      full_name: data.fullName,
      contact: data.contact,
      note: data.note,
    });
    if (idError) console.error("[consent] identity insert failed", idError.code, idError.message);

    // No name, contact or note in the audit trail.
    await audit(db, "participant.enrol", "participant", participantId, {
      pseudo_code: pseudoCode,
      identity_saved: !idError,
    });
    return { participantId, pseudoCode, identitySaved: !idError };
  });

const UpdateParticipantInput = z
  .object({
    participantId: uuid,
    details: DetailsInput.extend({ active: z.boolean() }).optional(),
    identity: IdentityInput.optional(),
  })
  .refine((v) => v.details || v.identity, "nothing_to_update");

/** Update department, site, tier, roles, active and/or the identity key (upsert). */
export const updateParticipant = createServerFn({ method: "POST" })
  .middleware([keeperOnly])
  .inputValidator((i: unknown) => UpdateParticipantInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = dbOf(context.supabase);
    const pseudoCode = await participantExists(db, data.participantId);
    const fields: string[] = [];

    if (data.details) {
      const d = data.details;
      const { error } = await db
        .from("participants")
        .update({
          department: d.department,
          site: d.site,
          experience_tier: d.experienceTier,
          roles: d.roles,
          active: d.active,
        })
        .eq("id", data.participantId);
      if (error) throw friendly(error, "participant update");
      fields.push("department", "site", "experience_tier", "roles", "active");
    }

    let identityError: DbError | null = null;
    if (data.identity) {
      const { error } = await db.from("participant_identity").upsert(
        {
          participant_id: data.participantId,
          full_name: data.identity.fullName,
          contact: data.identity.contact,
          note: data.identity.note,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "participant_id" },
      );
      if (error) identityError = error;
      else fields.push("identity");
    }

    if (fields.length) {
      // Field names only, never values.
      await audit(db, "participant.update", "participant", data.participantId, {
        pseudo_code: pseudoCode,
        fields,
      });
    }
    if (identityError) {
      const e = friendly(identityError, "identity upsert");
      if (e.message === "CONSENT_DB_ERROR") throw new Error("CONSENT_IDENTITY_SAVE_FAILED");
      throw e;
    }
    return { participantId: data.participantId, pseudoCode };
  });

// ---------------------------------------------------------------------------
// Consent decisions and withdrawals
// ---------------------------------------------------------------------------

const RecordConsentInput = z
  .object({
    participantId: uuid,
    formVersionId: uuid,
    method: z.enum(CONSENT_METHODS),
    givenAt: pastDate,
    paperRef: optText(200),
    decisions: z
      .record(z.string().regex(ITEM_KEY_PATTERN), z.enum(CONSENT_DECISIONS))
      .refine((d) => {
        const n = Object.keys(d).length;
        return n >= 1 && n <= MAX_FORM_ITEMS;
      }, "bad_decisions"),
    /** Required when the person has withdrawn before: they themselves asked to give consent again. */
    confirmRejoin: z.boolean().optional().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.method === "paper" && !v.paperRef) {
      ctx.addIssue({ code: "custom", path: ["paperRef"], message: "paper_ref_required" });
    }
  });

/**
 * Record (or correct) one person's decisions on one form version. Must cover every item of the
 * form. Draft forms are allowed for practice; only approved forms count for clearance, and a
 * draft with practice records can never be approved (see approveConsentForm).
 * A withdrawal is never overwritten: if any item on this form was withdrawn, this is refused.
 * If the person has withdrawn before (any form), confirmRejoin must be true.
 */
export const recordConsent = createServerFn({ method: "POST" })
  .middleware([keeperOnly])
  .inputValidator((i: unknown) => RecordConsentInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = dbOf(context.supabase);
    const { data: formRow, error } = await db
      .from("consent_form_versions")
      .select("id, version, status, items, approved_at")
      .eq("id", data.formVersionId)
      .maybeSingle();
    if (error) throw friendly(error, "form lookup");
    if (!formRow) throw new Error("CONSENT_FORM_NOT_FOUND");
    if (formRow.status === "retired") throw new Error("CONSENT_FORM_RETIRED");
    // Consent on an approved form cannot predate the ethics approval of that form.
    const approvedAt = str(formRow, "approved_at");
    if (formRow.status === "approved" && approvedAt && data.givenAt < approvedAt) {
      throw new Error("CONSENT_DATE_BEFORE_APPROVAL");
    }
    const keys = parseItems(formRow.items).map((it) => it.key);
    if (!keys.length) throw new Error("CONSENT_FORM_INVALID");

    const given = Object.keys(data.decisions);
    if (given.length !== keys.length || !keys.every((k) => Object.hasOwn(data.decisions, k))) {
      throw new Error("CONSENT_DECISIONS_INCOMPLETE");
    }

    const pseudoCode = await participantExists(db, data.participantId);

    const { data: existing, error: e2 } = await db
      .from("consents")
      .select("item_key, withdrawn_at")
      .eq("participant_id", data.participantId)
      .eq("form_version_id", data.formVersionId);
    if (e2) throw friendly(e2, "consent lookup");
    if ((existing ?? []).some((r) => r.withdrawn_at)) throw new Error("CONSENT_ALREADY_WITHDRAWN");

    // A withdrawal on another form version must not be undone by routine data entry: recording on
    // a newer approved form would clear the person again. Ask for an explicit confirmation.
    const { data: withdrawn, error: e4 } = await db
      .from("withdrawal_events")
      .select("id")
      .eq("participant_id", data.participantId)
      .range(0, 0);
    if (e4) throw friendly(e4, "withdrawal lookup");
    const hadWithdrawal = !!withdrawn?.length;
    if (hadWithdrawal && !data.confirmRejoin) throw new Error("CONSENT_REJOIN_UNCONFIRMED");

    const rows = keys.map((k) => ({
      participant_id: data.participantId,
      form_version_id: data.formVersionId,
      item_key: k,
      decision: data.decisions[k],
      method: data.method,
      given_at: data.givenAt,
      paper_ref: data.paperRef,
      taken_by: context.userId,
    }));
    const { error: e3 } = await db
      .from("consents")
      .upsert(rows, { onConflict: "participant_id,form_version_id,item_key" });
    if (e3) throw friendly(e3, "consent upsert");

    // Counts only: no per-person decisions or rejoin flags in the audit trail (admins read it).
    await audit(db, "consent.record", "participant", data.participantId, {
      form_version_id: data.formVersionId,
      items: rows.length,
    });
    return {
      pseudoCode,
      saved: rows.length,
      formVersion: formRow.version as string,
      formApproved: formRow.status === "approved",
    };
  });

const WithdrawalInput = z.object({
  participantId: uuid,
  scope: z.enum(WITHDRAWAL_SCOPES),
  note: optText(500),
});

/**
 * Calls SQL apply_withdrawal(): marks the consents withdrawn, puts sessions the person spoke in on
 * hold (not for optional-only), logs the event and writes the audit row itself.
 */
export const applyWithdrawal = createServerFn({ method: "POST" })
  .middleware([keeperOnly])
  .inputValidator((i: unknown) => WithdrawalInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = dbOf(context.supabase);
    const pseudoCode = await participantExists(db, data.participantId);
    const { data: held, error } = await db.rpc("apply_withdrawal", {
      _participant: data.participantId,
      _scope: data.scope,
      _note: data.note,
    });
    if (error) throw friendly(error, "apply_withdrawal");
    return { pseudoCode, scope: data.scope, sessionsOnHold: Number(held ?? 0) };
  });

/** The withdrawal log with pseudo codes (no names). */
export const listWithdrawals = createServerFn({ method: "GET" })
  .middleware([keeperOnly])
  .handler(async ({ context }) => {
    const db = dbOf(context.supabase);
    const rows = await selectAll(
      (a, b) =>
        db
          .from("withdrawal_events")
          .select(
            "id, participant_id, scope, recorded_at, note, sessions_put_on_hold, participant:participants(pseudo_code)",
          )
          .order("recorded_at", { ascending: false })
          .order("id", { ascending: true })
          .range(a, b),
      "withdrawals",
    );
    const withdrawals: WithdrawalEvent[] = rows.map((r) => {
      const p = r.participant as { pseudo_code?: string } | null;
      return {
        id: r.id as string,
        participantId: r.participant_id as string,
        pseudoCode: p?.pseudo_code ?? null,
        scope: r.scope as WithdrawalScope,
        recordedAt: r.recorded_at as string,
        note: str(r, "note"),
        sessionsPutOnHold: Number(r.sessions_put_on_hold ?? 0),
      };
    });
    return { withdrawals };
  });
