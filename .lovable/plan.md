
# Product Knowledge + Knowledge Translation

Two new menus in the Staff Console that let staff capture organizational knowledge and reshape it for different audiences. UI ships first against mock/seed data; database wiring is one swap away.

## Sidebar

Add two entries between **KM Library** and **KT Transfer**:

- `Product Knowledge` (ความรู้ผลิตภัณฑ์) → `/staff/product-knowledge`
- `Knowledge Translation` (แปลความรู้) → `/staff/knowledge-translation`

## Routes

```
src/routes/
  staff.product-knowledge.tsx          List + dashboard + create modal
  staff.product-knowledge.$id.tsx      Detail view (content, attachments, versions, "Use for Translation")
  staff.knowledge-translation.tsx      List of outputs + "+ New translation"
  staff.knowledge-translation.new.tsx  Step builder (asset → audience → format → tone → AI → preview → save)
  staff.knowledge-translation.$id.tsx  Output detail (copy / export / publish toggle)
```

## Product Knowledge — list page

- Header with **+ Create Knowledge** button.
- Dashboard strip (6 small cards): Total assets, Published, Drafts, Archived, Translation Outputs, Top category.
- Search box + filter chips: Category, Audience, Language, Status, Tags.
- Card grid (3-up desktop, 2-up tablet, 1-up mobile) — type icon, title, audience badge, language pill, status tone (draft/published/archived), updated-at, owner avatar.
- Empty state and "no results" state.

### Create Knowledge form (modal)

Single-column, sectioned, autosaved-as-draft feel.

Fields:

- Title (TH + EN tabs)
- Type — `curriculum | sop | toolkit | campaign | health_product | service_guide | partner_resource | research_summary`
- Category (multi-select: health, rights, skills, wellbeing, outreach, digital_safety)
- Product/Service (free text or pick from courses/products seed)
- Target Audience (multi-select chips)
- Key Message (short)
- Full Knowledge Content (markdown textarea, simple)
- Source / Reference
- Tags (chip input)
- Language: TH / EN / Bilingual
- Attachments: PDF, Slide, Image, Video URL — drag/drop area
- Status: Draft / Published / Archived (segmented control)

**AI Assist Card** (right rail in the modal):

- "สรุปให้สั้นลง" → fills Key Message from Full Content
- "แปล TH ↔ EN" → fills opposite-language fields
- "ทำให้อ่านง่าย (plain language)" → rewrites Full Content
- All three call a single server fn `runKnowledgeAssist` → Lovable AI gateway (`google/gemini-3-flash-preview`) with three preset system prompts.

## Product Knowledge — detail page

- Header: title (TH/EN toggle), type/status/lang badges, updated-at.
- Body: Key Message callout, Full Content (markdown rendered), Source.
- Right rail: Attachments list (slides/PDF/image/video URL), Version history (mock array), Tags, Audience.
- Primary CTA: **Use for Translation** → navigates to `/staff/knowledge-translation/new?assetId=…`.
- Secondary: Edit, Archive.

## Knowledge Translation — list

- Table/cards of past outputs: source asset title, audience, format, tone, language, status, updated-at.
- Filters: audience, format, status, language.
- **+ New translation** CTA.

## Knowledge Translation — step builder

Single page, 5 visible steps with sticky preview on the right.

1. **Pick asset** — autocomplete + recent. Pre-filled if `?assetId=` present.
2. **Audience** — picker chips: General Public, Youth, Sex Workers, LGBTQ+ Community, Outreach Workers, Healthcare Providers, Policy Partners.
3. **Format** — Social Caption, Short Article, Learning Card, FAQ, Script, Infographic Text, Slide Outline, Campaign Message, Micro-learning Lesson.
4. **Tone** — Friendly, Empowering, Simple, Professional, Community Voice, Advocacy.
5. **Language** — TH / EN / Bilingual.

Below the steps: **AI Prompt Builder** card:

- Auto-composed instruction textarea (editable), pre-filled with the user's template, e.g.
  > "แปลงความรู้นี้ให้อ่านง่ายสำหรับ [audience] โดยใช้โทน [tone]…"
- Buttons: **Generate**, **Regenerate**.

Right-side **Preview card**: rendered output (markdown), copy-to-clipboard, download as .md/.txt, language pill.

Save bar: Status segmented (Draft / Ready to Publish / Published) + **Save**.

## AI server functions

`src/lib/knowledge-ai.functions.ts` (TanStack `createServerFn`, reads `LOVABLE_API_KEY` inside handler):

- `runKnowledgeAssist({ mode: "summarize" | "translate" | "simplify", text, targetLang? })`
- `translateKnowledge({ assetContent, audience, format, tone, language, instruction })`

Both use AI SDK `generateText` with the Lovable gateway. Validation via Zod. Errors surfaced as user-readable toasts (429/402 special-cased).

## Mock / seed data

New file: `src/data/product-knowledge-seed.json`. 12 assets covering:

PrEP starter pack · HIV self-test how-to · STI screening guide · Sex worker rights pocket card · Mental wellbeing check-in · Outreach safety SOP · Safe-service onboarding · Digital safety toolkit · World AIDS Day campaign kit · Condom + lube product brief · Peer educator FAQ · Partner reporting template.

Each row has the same shape as the form, plus `id`, `createdAt`, `updatedAt`, `versionHistory: [{ v, at, by, note }]`, `ownerId`.

Also seed 4 sample translation outputs.

In-memory store (`src/lib/product-knowledge-store.ts`) wraps the seed in a tiny context with `create / update / list / get / remove` plus `translations.create/list/get`. State persists for the session via `localStorage` so reloads keep changes — clear hook included for QA.

## Future DB shape (commented in seed file, not migrated yet)

```text
knowledge_assets(id, title_th, title_en, type, categories[], product_service,
  audiences[], key_message, content_md, source, tags[], language, status,
  owner_id, created_at, updated_at)
knowledge_attachments(id, asset_id, kind, storage_path|external_url, title)
knowledge_versions(id, asset_id, v, note, by, at, snapshot_json)
knowledge_translations(id, asset_id, audience, format, tone, language,
  instruction, output_md, status, owner_id, created_at, updated_at)
```

When the user is ready, this maps to a single Supabase migration with RLS scoped to `has_role(auth.uid(),'staff' | 'admin')`. Not in this pass.

## UX / visual

- Reuses existing tokens (`warm-*`, `navy-*`, `magenta-*`, `lavender-*`, status tones).
- Card layout, sticky right rails on desktop, stacked on tablet/mobile.
- Toasts via `sonner` for save / publish / AI errors.
- Drag-drop upload zones reuse the pattern from `lesson-upload-card.tsx`.
- No new dependencies (markdown rendered with a tiny `<pre className="prose">` block; can upgrade to `react-markdown` later if needed).

## Acceptance check

After build, manually verify on `/staff/product-knowledge`:
- Sidebar shows both new entries.
- Create Knowledge → fill → Save Draft → appears in list with "Draft" tone.
- Publish toggle flips badge + count on dashboard.
- Detail page renders content + attachments; "Use for Translation" deep-links to builder with asset pre-selected.
- Translation builder: pick audience/format/tone/lang → Generate → preview populates → Save creates an entry in `/staff/knowledge-translation`.
- All filters/search return correct subsets.
- Mobile (375px) and tablet (768px) layouts hold.
