## 1. Investigate the "Internal Server Error"

I checked `https://swingacademy.life` and every visible page returns HTTP 200 (home, /courses, /paths, /resources, /staff → /staff/dashboard, /staff/admin). The only 500s in server logs are bot probes hitting `/api/gql`, `/api/graphql`, `/api` — not real app routes.

To actually fix it, I need one of:
- a screenshot of the error page, **or**
- the exact URL / the action that triggered it (e.g. "I clicked Sign in", "I refreshed /staff/users")

I'll proceed with the other three tasks below; please drop the URL or screenshot in your next message and I'll patch the 500.

## 2. Polish the PrEP demo course (the canonical mockup)

Treat `prep-101` (the PrEP course in `seed-data.json`) as the showcase. Fill out every field so the rest of the app has rich defaults to display:

- Full bilingual title, tagline, summary, learning outcomes (6–8 items)
- Complete lesson list (~6 lessons mixing video / reading / quiz, realistic minutes)
- Reassurance tags, glossary keys, facilitator, funder, level, rating, learners
- Hero/cover already wired; add a `resources` array (downloadable PDF placeholders) and a `transcript` snippet per video lesson
- A polished sample certificate entry tied to the demo learner

Trim or hide other half-empty mock courses so the course grid showcases the polished one first.

## 3. Staff tools: slide & recording upload (UI now, storage wired)

New staff route: **`/staff/knowledge/upload`** (or extend the existing `staff.knowledge.tsx`):

- Course selector → Lesson selector
- Two upload zones:
  - **Slides** — accepts `.pdf`, `.ppt`, `.pptx` (drag-and-drop)
  - **Recording** — accepts video file upload OR external URL (YouTube / Vimeo / direct mp4); a "Record later" placeholder card explains in-browser recording is planned
- Optional title, description, language (TH/EN), visibility (draft / published)
- Files go to existing `training-attachments` storage bucket via a `createServerFn` (auth-gated with `requireSupabaseAuth`); metadata stored in a new `lesson_attachments` table with proper RLS + GRANTs
- List view of already-uploaded slides/recordings per course with delete

In-browser recording (mic/camera) is **not** built now — it's a labeled "Coming soon" card so the UI is ready for the future.

## 4. Unified login page with Learner / Staff tabs + tutorial

New public route **`/auth`** replacing the current modal-only flow:

- Tabs: **"ผู้เรียน / Learner"** (default) and **"เจ้าหน้าที่ / Staff"**
- Both tabs share the same Supabase email/password + Google sign-in form
- Role distinction is enforced server-side via a `user_roles` table (`learner` | `staff` | `admin`) using the canonical `has_role()` SECURITY DEFINER pattern — no role on profiles
- After sign-in:
  - Learner → `/dashboard`
  - Staff/admin → `/staff/dashboard`
  - Wrong tab for the account → friendly inline message, no redirect loop
- Existing `SignInModal` becomes a thin wrapper that links to `/auth`
- Google OAuth via `lovable.auth.signInWithOAuth("google", ...)` (managed broker); enable Google provider in the same turn

### Step-by-step tutorial

First-visit onboarding overlay (driver.js-style, no extra dep — small custom component):

- 4 steps for **Learners**: pick language → browse courses → start a course → earn certificate
- 4 steps for **Staff**: dashboard overview → upload knowledge (slides/video) → manage trainings → manage users
- "Skip" + "Don't show again" stored in `localStorage`
- Launchable any time from a "?" help button in the header

## 5. Backend changes (one migration)

```text
user_roles (id, user_id → auth.users, role app_role, unique(user_id, role))
  + has_role(uuid, app_role) SECURITY DEFINER
  + RLS: user reads own roles; service_role full

lesson_attachments (id, course_id, lesson_id, kind: 'slides'|'video'|'video_url',
                    storage_path nullable, external_url nullable,
                    title, description, language, published, uploaded_by)
  + RLS: authenticated staff/admin manage; anyone reads where published=true
```

All public-schema tables get explicit `GRANT` + RLS in the same migration.

## 6. Technical notes

- `createServerFn` for all uploads / role checks; no Supabase Edge Functions
- `/auth` and `/staff/*` stay outside `_authenticated/` because role-based routing is handled inside the page (staff area shows its own login CTA if signed out as learner)
- Tutorial is pure client component, lazy-loaded — no SSR cost
- PrEP polish is data-only (`seed-data.json`); no schema impact
- I'll verify by visiting `/auth`, `/courses/prep-101`, and `/staff/knowledge` after each change

## Files I'll touch

- `src/data/seed-data.json` — flesh out PrEP, demo cert
- `src/routes/auth.tsx` — new login page with tabs
- `src/routes/staff.knowledge.tsx` — slide + video upload UI
- `src/lib/lesson-attachments.functions.ts` — server fns for upload/list/delete
- `src/lib/roles.functions.ts` — has_role helper + role lookup
- `src/components/onboarding-tour.tsx` — tutorial overlay
- `src/components/site-header.tsx` — "?" help button, link Sign in → `/auth`
- `src/components/sign-in-modal.tsx` — slim down or redirect to `/auth`
- One Supabase migration for `user_roles` + `lesson_attachments`
