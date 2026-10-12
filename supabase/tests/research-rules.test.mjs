// Database rules test for the CVSK research tables, run on a real Postgres in memory (PGlite).
//
// Loads the research section and audit_events from 20261011120000, then 20261012150000
// (twice), then 20261012180000 (once inside a single transaction, as a migration runner
// would, and once more to prove it is safe to run twice). Every check runs as the database
// role the app uses: authenticated (with a user id), service_role (the server) or anon.
//
// Run:  cd supabase/tests && npm install --no-package-lock && npm test
// Exits 1 if any check fails.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = process.argv[2] ?? fileURLToPath(new URL("../..", import.meta.url));
const migration = (f) => fs.readFileSync(`${REPO}/supabase/migrations/${f}`, "utf8");
const cut = (s, from, to) => {
  const i = s.indexOf(from);
  const j = to ? s.indexOf(to, i) : s.length;
  if (i < 0 || j < 0) throw new Error(`marker not found: ${from}`);
  return s.slice(i, j);
};

const foundation = migration("20261011120000_security_and_research_foundation.sql");
const research = cut(foundation, "-- 8. Research roles", "-- 9. ai_runs");
const auditEvents = cut(foundation, "CREATE TABLE IF NOT EXISTS public.audit_events", null);
const consentAndCapture = migration("20261012150000_consent_and_capture.sql");
const gateAndAccess = migration("20261012180000_research_gate_and_access.sql");

// ---------------------------------------------------------------------------
// Supabase stand-ins: roles, auth.uid(), auth.users, user_roles/has_role, storage.buckets
// ---------------------------------------------------------------------------
const db = new PGlite();
await db.exec(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TYPE public.app_role AS ENUM ('learner', 'staff', 'admin', 'trainer', 'superadmin');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`);

// A1, A2 admins · R researcher · O consent officer · S data steward · C coordinator (D1)
// D de-identification assistant · X signed in, no research role
const U = {};
for (const n of ["A1", "A2", "R", "O", "S", "C", "D", "X"]) {
  U[n] = crypto.randomUUID();
  await db.query("INSERT INTO auth.users VALUES ($1)", [U[n]]);
}
await db.query(
  "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin'), ($2, 'admin')",
  [U.A1, U.A2],
);

let kind = "earlier";
const tally = { earlier: [0, 0], added: [0, 0] };
const earlier = () => (kind = "earlier");
const added = () => (kind = "added");
const pass = (name, note = "") => {
  tally[kind][0]++;
  console.log(`PASS ${kind === "added" ? "+ " : ""}${name}${note ? ` | ${note}` : ""}`);
};
const fail = (name, why) => {
  tally[kind][1]++;
  console.log(`FAIL ${kind === "added" ? "+ " : ""}${name} -> ${why}`);
};

async function as(who, sql, params = []) {
  const setup =
    who === "service"
      ? "SET ROLE service_role; SELECT set_config('request.jwt.claim.sub', '', false);"
      : who === "anon"
        ? "SET ROLE anon; SELECT set_config('request.jwt.claim.sub', '', false);"
        : `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${U[who]}', false);`;
  await db.exec(setup);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);");
  }
}
async function ok(name, fn, check) {
  try {
    const r = await fn();
    if (check && !check(r)) throw new Error(`check failed: ${JSON.stringify(r?.rows ?? r)}`);
    pass(name);
    return r;
  } catch (e) {
    fail(name, e.message);
  }
}
async function bad(name, fn, re) {
  try {
    const r = await fn();
    fail(name, `no error ${JSON.stringify(r?.rows ?? "")}`);
  } catch (e) {
    if (re && !re.test(e.message)) fail(name, `wrong error: ${e.message}`);
    else pass(name, e.message);
  }
}
const rows = (r) => r.rows;
const one = (r) => r.rows[0];

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------
await db.exec(research);
await db.exec(auditEvents);
await db.exec(consentAndCapture);
await db.exec(consentAndCapture); // idempotent
console.log("20261011120000 (research + audit) and 20261012150000 x2 applied");

added();
// Live-like state: collection opened under the earlier rule (an admin, two dates only).
await ok(
  "earlier rule let an admin open collection with two dates",
  () =>
    as(
      "A1",
      "UPDATE public.study_settings SET ethics_approved_at = '2026-10-01', mou_signed_at = '2026-10-01', collection_unlocked = true WHERE id = 1 RETURNING collection_unlocked",
    ),
  (r) => one(r)?.collection_unlocked === true,
);
await ok("new migration applies inside one transaction", async () => {
  try {
    await db.exec(`BEGIN;\n${gateAndAccess}\nCOMMIT;`);
  } catch (e) {
    await db.exec("ROLLBACK;").catch(() => {});
    throw e;
  }
});
await ok("new migration applies a second time", () => db.exec(gateAndAccess));
await ok(
  "migration locks collection opened under the earlier rule",
  () => db.query("SELECT collection_unlocked FROM public.study_settings WHERE id = 1"),
  (r) => one(r).collection_unlocked === false,
);
await ok(
  "that lock is audited as a platform change, once",
  () =>
    db.query(
      "SELECT details FROM public.audit_events WHERE action = 'study.collection_lock' AND object_type = 'study_settings'",
    ),
  (r) => r.rows.length === 1 && r.rows[0].details.by_app_user === false,
);

// ---------------------------------------------------------------------------
// Research team and separation of duties
// ---------------------------------------------------------------------------
const grant = (by, who, role, dept = null) =>
  as(by, "INSERT INTO public.research_members (user_id, role, department) VALUES ($1, $2, $3)", [
    U[who],
    role,
    dept,
  ]);

earlier();
await ok("admin grants researcher", () => grant("A1", "R", "researcher"));
await ok("admin grants consent officer", () => grant("A1", "O", "consent_officer"));
await ok("other admin grants steward", () => grant("A2", "S", "data_steward"));
await ok("admin grants coordinator", () => grant("A1", "C", "dept_coordinator", "D1"));
await bad(
  "researcher cannot also be consent officer",
  () => grant("A1", "R", "consent_officer"),
  /researcher cannot/,
);
await bad(
  "officer cannot also be researcher",
  () => grant("A1", "O", "researcher"),
  /cannot also be the researcher/,
);
await bad(
  "admin cannot self-grant keeper role",
  () => grant("A1", "A1", "data_steward"),
  /another admin/,
);
await ok(
  "steward sees whole team",
  () => as("S", "SELECT count(*)::int n FROM public.research_members"),
  (r) => one(r).n === 4,
);
await ok(
  "researcher sees only own row",
  () => as("R", "SELECT count(*)::int n FROM public.research_members"),
  (r) => one(r).n === 1,
);

added();
await ok("admin grants de-identification assistant", () => grant("A1", "D", "deid_assistant"));
await ok(
  "the new role works with has_research_role",
  () => as("D", "SELECT public.has_research_role($1, 'deid_assistant') ok", [U.D]),
  (r) => one(r).ok === true,
);
await bad(
  "researcher cannot also be de-identification assistant",
  () => grant("A1", "R", "deid_assistant"),
  /researcher cannot/,
);
await bad(
  "de-identification assistant cannot also be researcher",
  () => grant("A1", "D", "researcher"),
  /cannot also be the researcher/,
);
await bad(
  "admin cannot self-grant de-identification assistant",
  () => grant("A1", "A1", "deid_assistant"),
  /another admin/,
);
await bad(
  "admin cannot move someone's steward role onto own account",
  () =>
    as(
      "A1",
      "UPDATE public.research_members SET user_id = $1 WHERE user_id = $2 AND role = 'data_steward'",
      [U.A1, U.S],
    ),
  /another admin/,
);

// ---------------------------------------------------------------------------
// Consent forms and the collection lock
// ---------------------------------------------------------------------------
earlier();
await bad(
  "admin cannot create consent form",
  () =>
    as(
      "A1",
      "INSERT INTO public.consent_form_versions (version, title, items) VALUES ('x', 'x', '[]')",
    ),
  /row-level security/,
);
await bad(
  "unlock needs approvals",
  () => as("S", "UPDATE public.study_settings SET collection_unlocked = true WHERE id = 1"),
  /study_settings_unlock_needs_approvals/,
);

added();
await bad(
  "admin cannot open collection, even with every approval",
  () =>
    as(
      "A1",
      "UPDATE public.study_settings SET ethics_ref = 'EC-1', foundation_permission_at = '2026-09-20', collection_unlocked = true WHERE id = 1",
    ),
  /only a data steward can open/,
);
await ok(
  "admin records approvals and settings while locked",
  () =>
    as(
      "A1",
      "UPDATE public.study_settings SET ethics_ref = 'EC-1', ethics_approved_at = '2026-10-01', mou_signed_at = '2026-10-01', foundation_permission_at = '2026-09-20', speaker_guidance_version = 'g1', departments = '{D1,D2}' WHERE id = 1 RETURNING id",
    ),
  (r) => r.rows.length === 1,
);
await bad(
  "blank ethics reference cannot open",
  () =>
    as(
      "S",
      "UPDATE public.study_settings SET ethics_ref = '   ', collection_unlocked = true WHERE id = 1",
    ),
  /study_settings_unlock_needs_approvals/,
);
await bad(
  "missing foundation permission date cannot open",
  () =>
    as(
      "S",
      "UPDATE public.study_settings SET foundation_permission_at = NULL, collection_unlocked = true WHERE id = 1",
    ),
  /study_settings_unlock_needs_approvals/,
);
await bad(
  "no app user (platform tools) cannot open",
  () => as("service", "UPDATE public.study_settings SET collection_unlocked = true WHERE id = 1"),
  /only a data steward can open/,
);

earlier();
await ok(
  "unlock with approvals",
  () =>
    as(
      "S",
      "UPDATE public.study_settings SET collection_unlocked = true WHERE id = 1 RETURNING collection_unlocked",
    ),
  (r) => one(r)?.collection_unlocked === true,
);

added();
await ok(
  "opening is audited with the approvals and who did it",
  () =>
    as(
      "A1",
      "SELECT actor_id, details FROM public.audit_events WHERE action = 'study.collection_open'",
    ),
  (r) =>
    r.rows.length === 1 &&
    r.rows[0].actor_id === U.S &&
    r.rows[0].details.foundation_permission_at === "2026-09-20" &&
    r.rows[0].details.ethics_ref === "EC-1",
);
await bad(
  "admin cannot change approvals while collection is open",
  () => as("A1", "UPDATE public.study_settings SET ethics_ref = 'EC-2' WHERE id = 1"),
  /while collection is open/,
);
await ok(
  "admin still edits other settings while open",
  () => as("A1", "UPDATE public.study_settings SET sites = '{BKK,PTY}' WHERE id = 1 RETURNING id"),
  (r) => r.rows.length === 1,
);
await bad(
  "admin cannot lock collection",
  () => as("A1", "UPDATE public.study_settings SET collection_unlocked = false WHERE id = 1"),
  /only a data steward can lock/,
);
await ok(
  "researcher cannot touch study settings (0 rows)",
  () =>
    as(
      "R",
      "UPDATE public.study_settings SET collection_unlocked = false WHERE id = 1 RETURNING id",
    ),
  (r) => r.rows.length === 0,
);
await ok(
  "no app user (platform tools) can always lock",
  () =>
    as(
      "service",
      "UPDATE public.study_settings SET collection_unlocked = false WHERE id = 1 RETURNING collection_unlocked",
    ),
  (r) => one(r)?.collection_unlocked === false,
);
await ok(
  "steward opens again",
  () =>
    as(
      "S",
      "UPDATE public.study_settings SET collection_unlocked = true WHERE id = 1 RETURNING collection_unlocked",
    ),
  (r) => one(r)?.collection_unlocked === true,
);
await ok(
  "every open and lock is in the audit trail",
  () =>
    as(
      "A1",
      "SELECT action, count(*)::int n FROM public.audit_events WHERE object_type = 'study_settings' GROUP BY action ORDER BY action",
    ),
  (r) =>
    JSON.stringify(rows(r)) ===
    JSON.stringify([
      { action: "study.collection_lock", n: 2 },
      { action: "study.collection_open", n: 2 },
    ]),
);

// ---------------------------------------------------------------------------
// Participants and consent decisions
// ---------------------------------------------------------------------------
earlier();
const items = JSON.stringify([
  { key: "record_audio", gate: "processing" },
  { key: "ai_processing_abroad", gate: "processing" },
  { key: "research_analysis", gate: "research" },
  { key: "model_training", gate: "optional" },
]);
const enrol = (active = true) =>
  as(
    "O",
    "INSERT INTO public.participants (department, active) VALUES ('D1', $1) RETURNING id, pseudo_code",
    [active],
  );
const P1 = (await ok("officer enrols P1", () => enrol()))?.rows[0];
const P2 = (await ok("officer enrols P2", () => enrol()))?.rows[0];
const draft = (
  await as("O", "SELECT id FROM public.consent_form_versions WHERE version = 'v1.0-draft'")
).rows[0].id;
const rec = (who, p, form, decisions, date = "2026-10-05") =>
  as(
    who,
    `INSERT INTO public.consents (participant_id, form_version_id, item_key, decision, method, given_at)
     SELECT $1, $2, k, d, 'paper', $3 FROM jsonb_each_text($4::jsonb) AS t(k, d)
     ON CONFLICT (participant_id, form_version_id, item_key) DO UPDATE SET decision = EXCLUDED.decision,
       method = EXCLUDED.method, given_at = EXCLUDED.given_at, paper_ref = EXCLUDED.paper_ref, taken_by = EXCLUDED.taken_by`,
    [p.id, form, date, JSON.stringify(decisions)],
  );
const ALL = {
  record_audio: "granted",
  ai_processing_abroad: "granted",
  research_analysis: "granted",
  model_training: "granted",
};
await ok("practice record on draft", () => rec("O", P1, draft, ALL));
await bad(
  "draft with practice records cannot be approved",
  () =>
    as(
      "O",
      "UPDATE public.consent_form_versions SET status = 'approved', approved_ref = 'EC-1', approved_at = '2026-10-01' WHERE id = $1",
      [draft],
    ),
  /practice records/,
);
const v1 = (
  await ok("officer creates v1.0", () =>
    as(
      "O",
      "INSERT INTO public.consent_form_versions (version, title, items) VALUES ('v1.0', 'f', $1::jsonb) RETURNING id",
      [items],
    ),
  )
)?.rows[0].id;
await ok(
  "officer approves v1.0",
  () =>
    as(
      "O",
      "UPDATE public.consent_form_versions SET status = 'approved', approved_ref = 'EC-1', approved_at = '2026-10-01' WHERE id = $1 RETURNING id",
      [v1],
    ),
  (r) => r.rows.length === 1,
);
await bad(
  "approved form items locked",
  () => as("O", "UPDATE public.consent_form_versions SET items = '[]' WHERE id = $1", [v1]),
  /cannot change/,
);
await ok("P1 consents on v1.0", () => rec("O", P1, v1, ALL));
await ok("P2 consents on v1.0", () => rec("O", P2, v1, ALL));
await ok(
  "correction keeps history",
  async () => {
    await rec("O", P2, v1, { ...ALL, model_training: "refused" });
    return as("O", "SELECT count(*)::int n FROM public.consent_revisions");
  },
  (r) => one(r).n === 1,
);
await ok(
  "no-op re-save adds no history",
  async () => {
    await rec("O", P2, v1, { ...ALL, model_training: "refused" });
    return as("O", "SELECT count(*)::int n FROM public.consent_revisions");
  },
  (r) => one(r).n === 1,
);
await ok(
  "admin cannot read consents",
  () => as("A1", "SELECT count(*)::int n FROM public.consents"),
  (r) => one(r).n === 0,
);
await ok(
  "researcher cannot read consent history",
  () => as("R", "SELECT count(*)::int n FROM public.consent_revisions"),
  (r) => one(r).n === 0,
);
await bad(
  "researcher cannot call participant_cleared",
  () => as("R", "SELECT public.participant_cleared($1, 'processing')", [P1.id]),
  /permission denied/,
);

added();
// P3 agreed to recording and processing but not to research use. P4 is no longer active.
const P3 = (await ok("officer enrols P3", () => enrol()))?.rows[0];
await ok("P3 agrees to processing, declines research use", () =>
  rec("O", P3, v1, { ...ALL, research_analysis: "refused" }),
);
const P4 = (await ok("officer enrols P4 as inactive", () => enrol(false)))?.rows[0];

// ---------------------------------------------------------------------------
// participants.active: consent keepers only
// ---------------------------------------------------------------------------
await bad(
  "researcher cannot read the active flag",
  () => as("R", "SELECT pseudo_code, active FROM public.participants"),
  /permission denied/,
);
await bad(
  "researcher cannot filter on the active flag",
  () => as("R", "SELECT id FROM public.participants WHERE NOT active"),
  /permission denied/,
);
await bad(
  "coordinator cannot read the active flag",
  () => as("C", "SELECT active FROM public.participants"),
  /permission denied/,
);
await ok(
  "researcher still reads pseudonymous columns",
  () => as("R", "SELECT id, pseudo_code, department, site, roles FROM public.participants"),
  (r) => r.rows.length === 4,
);
await ok(
  "speaker picker lists active codes only, without the flag",
  () => as("C", "SELECT * FROM public.active_participant_codes()"),
  (r) =>
    r.rows.length === 3 &&
    !r.rows.some((p) => p.id === P4.id) &&
    r.fields.map((f) => f.name).join(",") === "id,pseudo_code,department,site",
);
await ok(
  "picker results can be filtered by id (server check before linking)",
  () =>
    as("R", "SELECT id FROM public.active_participant_codes() WHERE id = ANY($1::uuid[])", [
      [P1.id, P4.id],
    ]),
  (r) => r.rows.length === 1 && r.rows[0].id === P1.id,
);
await bad(
  "researcher cannot read the flags",
  () => as("R", "SELECT * FROM public.participant_active_flags()"),
  /not allowed/,
);
await bad(
  "admin cannot read the flags",
  () => as("A1", "SELECT * FROM public.participant_active_flags()"),
  /not allowed/,
);
await ok(
  "consent officer reads the flags",
  () => as("O", "SELECT * FROM public.participant_active_flags()"),
  (r) => r.rows.length === 4 && r.rows.find((p) => p.participant_id === P4.id)?.active === false,
);
await ok(
  "data steward reads the flags",
  () => as("S", "SELECT count(*)::int n FROM public.participant_active_flags()"),
  (r) => one(r).n === 4,
);
await bad(
  "de-identification assistant cannot list codes",
  () => as("D", "SELECT * FROM public.active_participant_codes()"),
  /not allowed/,
);
await bad(
  "account without a research role cannot list codes",
  () => as("X", "SELECT * FROM public.active_participant_codes()"),
  /not allowed/,
);
await bad(
  "anon cannot call the picker",
  () => as("anon", "SELECT * FROM public.active_participant_codes()"),
  /permission denied/,
);
await ok(
  "researcher cannot change the flag (0 rows)",
  () =>
    as("R", "UPDATE public.participants SET active = false WHERE id = $1 RETURNING id", [P1.id]),
  (r) => r.rows.length === 0,
);
await ok(
  "consent officer still changes the flag",
  async () => {
    await as("O", "UPDATE public.participants SET active = true WHERE id = $1", [P4.id]);
    return as(
      "O",
      "SELECT active FROM public.participant_active_flags() WHERE participant_id = $1",
      [P4.id],
    );
  },
  (r) => one(r)?.active === true,
);

// ---------------------------------------------------------------------------
// Capture sessions and the capture gate
// ---------------------------------------------------------------------------
earlier();
const s1 = (
  await ok("researcher creates session", () =>
    as(
      "R",
      "INSERT INTO public.capture_sessions (session_type, department) VALUES ('monthly_training', 'D1') RETURNING id, code",
    ),
  )
)?.rows[0];
const s2 = (
  await ok("coordinator creates session in own dept", () =>
    as(
      "C",
      "INSERT INTO public.capture_sessions (session_type, department) VALUES ('interview', 'D1') RETURNING id",
    ),
  )
)?.rows[0];
await bad(
  "coordinator cannot create in other dept",
  () =>
    as(
      "C",
      "INSERT INTO public.capture_sessions (session_type, department) VALUES ('interview', 'D2')",
    ),
  /row-level security/,
);
await bad(
  "cannot insert with own id/audio",
  () =>
    as(
      "R",
      "INSERT INTO public.capture_sessions (id, session_type, department, audio_path, status) VALUES (gen_random_uuid(), 'interview', 'D1', 'x', 'on_hold')",
    ),
  /permission denied/,
);
await ok("speakers added", () =>
  as(
    "R",
    "INSERT INTO public.session_participants (session_id, participant_id) VALUES ($1, $2), ($1, $3), ($4, $2)",
    [s1.id, P1.id, P2.id, s2.id],
  ),
);
await bad(
  "ready needs checklist",
  () => as("R", "UPDATE public.capture_sessions SET status = 'ready' WHERE id = $1", [s1.id]),
  /ready needs/,
);
const checklist = (who, s) =>
  as(
    who,
    "UPDATE public.capture_sessions SET speaker_guidance_version = 'g1', speaker_guidance_given_at = now(), out_of_scope_attested = true, status = 'ready' WHERE id = $1 RETURNING status",
    [s.id],
  );
await ok(
  "checklist then ready",
  () => checklist("R", s1),
  (r) => one(r)?.status === "ready",
);
await ok(
  "clearance flags",
  () => as("R", "SELECT public.session_clearance($1) c", [s1.id]),
  (r) => one(r).c.processing === true && one(r).c.research === true && one(r).c.speakers === 2,
);
await bad(
  "worker cannot write audio columns",
  () =>
    as(
      "R",
      "UPDATE public.capture_sessions SET audio_path = 'sessions/' || id || '/1760000000000.mp3', status = 'recorded' WHERE id = $1",
      [s1.id],
    ),
  /permission denied/,
);
await bad(
  "server: wrong path refused",
  () =>
    as(
      "service",
      "UPDATE public.capture_sessions SET audio_path = 'other/x.mp3', status = 'recorded' WHERE id = $1",
      [s1.id],
    ),
  /unexpected audio path/,
);
const attach = (s, status, ms) =>
  as(
    "service",
    `UPDATE public.capture_sessions SET audio_path = 'sessions/' || id || '/${ms}.m4a', audio_bytes = 10, audio_sha256 = 'ab', status = $2 WHERE id = $1 RETURNING status`,
    [s.id, status],
  );
await ok(
  "server: attach when gate holds",
  () => attach(s1, "recorded", 1760000000000),
  (r) => one(r)?.status === "recorded",
);
await bad(
  "audio frozen once linked",
  () => as("service", "UPDATE public.capture_sessions SET audio_bytes = 11 WHERE id = $1", [s1.id]),
  /frozen/,
);
await bad(
  "server: gate unmet and not on hold refused",
  () => attach(s2, "recorded", 1760000000001),
  /capture gate/,
);
await ok(
  "server: gate unmet but put on hold is allowed",
  () => attach(s2, "on_hold", 1760000000001),
  (r) => one(r)?.status === "on_hold",
);
await bad(
  "speaker list frozen once audio exists",
  () =>
    as("R", "DELETE FROM public.session_participants WHERE session_id = $1 RETURNING 1", [
      s1.id,
    ]).then((r) => {
      if (!r.rows.length) throw new Error("0 rows (frozen)");
      return r;
    }),
  /frozen/,
);

added();
// Research-use consent: P3 agreed to processing only.
const s3 = (
  await ok("researcher plans a session with P3 alone", () =>
    as(
      "R",
      "INSERT INTO public.capture_sessions (session_type, department) VALUES ('interview', 'D1') RETURNING id",
    ),
  )
)?.rows[0];
const s4 = (
  await ok("researcher plans a session with P2 and P3", () =>
    as(
      "R",
      "INSERT INTO public.capture_sessions (session_type, department) VALUES ('elicitation_circle', 'D1') RETURNING id",
    ),
  )
)?.rows[0];
await ok("speakers and checklists for both", async () => {
  await as(
    "R",
    "INSERT INTO public.session_participants (session_id, participant_id) VALUES ($1, $2), ($3, $4), ($3, $2)",
    [s3.id, P3.id, s4.id, P2.id],
  );
  await checklist("R", s3);
  return checklist("R", s4);
});
await ok(
  "flags show ready to process but not for research",
  () => as("R", "SELECT public.session_clearance($1) c", [s3.id]),
  (r) => one(r).c.processing === true && one(r).c.research === false,
);
await bad(
  "server: no research consent, audio refused",
  () => attach(s3, "recorded", 1760000000002),
  /capture gate/,
);
await bad(
  "server: one speaker without research consent blocks the session",
  () => attach(s4, "recorded", 1760000000003),
  /capture gate/,
);
await ok(
  "server: no research consent, audio still kept on hold for review",
  () => attach(s3, "on_hold", 1760000000002),
  (r) => one(r)?.status === "on_hold",
);

// ---------------------------------------------------------------------------
// De-identification assistant: recorded sessions only, read only
// ---------------------------------------------------------------------------
await ok(
  "de-identification assistant sees recorded sessions only",
  () => as("D", "SELECT id FROM public.capture_sessions"),
  (r) => r.rows.length === 1 && r.rows[0].id === s1.id,
);
await ok(
  "de-identification assistant gets flags for a session it may play",
  () => as("D", "SELECT public.session_clearance($1) c", [s1.id]),
  (r) => one(r).c.processing === true && one(r).c.research === true,
);
await bad(
  "de-identification assistant gets no flags for a session on hold",
  () => as("D", "SELECT public.session_clearance($1) c", [s3.id]),
  /not allowed/,
);
await bad(
  "de-identification assistant gets no flags for a session without audio",
  () => as("D", "SELECT public.session_clearance($1) c", [s4.id]),
  /not allowed/,
);
await ok(
  "de-identification assistant cannot change a session (0 rows)",
  () =>
    as("D", "UPDATE public.capture_sessions SET notes = 'x' WHERE id = $1 RETURNING id", [s1.id]),
  (r) => r.rows.length === 0,
);
await bad(
  "de-identification assistant cannot plan sessions",
  () =>
    as(
      "D",
      "INSERT INTO public.capture_sessions (session_type, department) VALUES ('interview', 'D1')",
    ),
  /row-level security/,
);
await ok(
  "de-identification assistant sees no speakers, codes or consents",
  () =>
    as(
      "D",
      `SELECT (SELECT count(*) FROM public.session_participants)::int sp,
              (SELECT count(*) FROM public.participants)::int p,
              (SELECT count(*) FROM public.consents)::int c`,
    ),
  (r) => one(r).sp === 0 && one(r).p === 0 && one(r).c === 0,
);

// ---------------------------------------------------------------------------
// Withdrawal and review
// ---------------------------------------------------------------------------
earlier();
await ok(
  "withdrawal puts sessions on hold",
  () => as("O", "SELECT public.apply_withdrawal($1, 'processing', 'note') n", [P1.id]),
  (r) => one(r).n === 2,
);
await ok(
  "audit points at withdrawal event, not person",
  () =>
    as(
      "A1",
      "SELECT object_type, object_id FROM public.audit_events WHERE action = 'consent.withdrawal'",
    ),
  (r) =>
    r.rows.length === 1 &&
    r.rows[0].object_type === "withdrawal_event" &&
    r.rows[0].object_id !== P1.id,
);
await ok(
  "P1 no longer cleared",
  () => as("R", "SELECT public.session_clearance($1) c", [s1.id]),
  (r) => one(r).c.processing === false,
);
await bad(
  "withdrawn consent cannot be undone",
  () =>
    as(
      "O",
      "UPDATE public.consents SET withdrawn_at = NULL WHERE participant_id = $1 AND withdrawn_at IS NOT NULL",
      [P1.id],
    ),
  /withdrawn consent cannot change/,
);
await bad(
  "researcher cannot release hold",
  () => as("R", "UPDATE public.capture_sessions SET status = 'recorded' WHERE id = $1", [s1.id]),
  /only a data steward/,
);
await bad(
  "admin cannot release hold",
  () => as("A1", "UPDATE public.capture_sessions SET status = 'recorded' WHERE id = $1", [s1.id]),
  /only a data steward/,
);
await bad(
  "researcher cannot close",
  () => as("R", "UPDATE public.capture_sessions SET status = 'closed' WHERE id = $1", [s2.id]),
  /only a data steward/,
);

added();
await ok(
  "de-identification assistant loses a session once it is on hold",
  () => as("D", "SELECT count(*)::int n FROM public.capture_sessions"),
  (r) => one(r).n === 0,
);

earlier();
await ok(
  "steward releases hold",
  () =>
    as(
      "S",
      "UPDATE public.capture_sessions SET status = 'recorded' WHERE id = $1 RETURNING status",
      [s1.id],
    ),
  (r) => one(r)?.status === "recorded",
);

added();
await ok(
  "de-identification assistant sees it again after release",
  () => as("D", "SELECT count(*)::int n FROM public.capture_sessions"),
  (r) => one(r).n === 1,
);

earlier();
await ok(
  "steward closes",
  () =>
    as("S", "UPDATE public.capture_sessions SET status = 'closed' WHERE id = $1 RETURNING status", [
      s2.id,
    ]),
  (r) => one(r)?.status === "closed",
);
await ok(
  "officer retires v1.0",
  () =>
    as(
      "O",
      "UPDATE public.consent_form_versions SET status = 'retired' WHERE id = $1 RETURNING status",
      [v1],
    ),
  (r) => one(r)?.status === "retired",
);
await ok(
  "retired form cannot be reopened (0 rows)",
  () =>
    as(
      "O",
      "UPDATE public.consent_form_versions SET status = 'approved' WHERE id = $1 RETURNING id",
      [v1],
    ),
  (r) => r.rows.length === 0,
);
await bad(
  "no new consent on retired form",
  () => rec("O", P2, v1, { ...ALL, model_training: "granted" }),
  /retired/,
);
await ok(
  "withdrawal still works on retired form",
  () => as("O", "SELECT public.apply_withdrawal($1, 'all', 'x') n", [P2.id]),
  (r) => typeof one(r).n === "number",
);
await bad(
  "researcher cannot withdraw",
  () => as("R", "SELECT public.apply_withdrawal($1, 'all', 'x')", [P2.id]),
  /not allowed/,
);

const [ep, ef] = tally.earlier;
const [ap, af] = tally.added;
console.log(`\nEarlier rules: ${ep} passed, ${ef} failed`);
console.log(`New rules:     ${ap} passed, ${af} failed`);
process.exit(ef + af ? 1 : 0);
