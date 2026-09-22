# VCFO Suite — Pre-incorporation Document Pack (Claude Code context)

Feature context for Claude Code. Read this whole file before touching code. Read `CLAUDE-CONTEXT.md` (master context) first if it is in the repo; this file only covers the document pack.

Visual reference (clickable mockup): https://claude.ai/artifact/5GuEssXR8D7uLVBiu6x8es

---

## 1. What we are building

One place to see, preview and download **every document the app generates for pre-incorporation** (SPICe+ Part A + Part B), with a live readiness status per document and deep links to whichever input is missing.

Four surfaces, one data source:

| Surface | Where | What it shows |
|---|---|---|
| **Rail card** | Step workspace, below the phase-scoped journey rail, on SPICe+ Part A and Part B steps only | "Pre-incorporation documents · N of M ready", segmented bar (ready / needs inputs / waiting for release), legend, **Open document pack** button, one "fastest unblock" link |
| **Header button** (narrow fallback) | Beside the step H1, only when the rail is collapsed/hidden (mobile / narrow) | "Document pack" + `ready/total` chip → pack page |
| **Pack page** | New route per shell (see §5) | Summary chips, Part A / Part B / All filter, one row per document: name, source steps, status chip, missing-input links, Preview + Download .docx; **Download ready as .zip** |
| **Overview link** | Engagement overview, on the SPICe+ Part A and Part B phase rows only | "Documents `ready/total`" pill → pack page filtered to that part |
| **Step strip** (Phase 5) | Top of the form on any step that feeds a pack document | "N documents use this step's data · X ready, Y need inputs · Open in document pack" |

Rule that governs everything:
- **Step** = actions that change workflow (edit BR, finalize, request approval, deliver).
- **Pack page** = the ONLY place that previews/downloads generated pre-inc documents.
- **Rail card / strip / overview pill** = status + link. Never a second download button.

---

## 2. Global rules (apply to every phase)

1. **Repository seam is sacred.** Only `src/db/repositories/*` import `db`. Only helpers/repos touch `src/storage/s3.ts`. Views → API routes → repositories taking `AuthContext`.
2. **Roles:** Project Lead (`intern` in code), Manager, Admin, Super Admin (via shell entry). **Client gets 403** on every doc-pack API and has no UI entry. Clients must never see BR drafts or firm working documents.
3. **Board resolution semantics are untouched.** Finalize in Pre-2 is the only release. The pack shows the BR as `waiting-release` until `status=finalized`; the pack NEVER exposes a finalize action or a draft download.
4. **No email, no notifications** from any doc-pack action. Downloads are silent (audit log only, see Phase 2).
5. **Do not edit lifted domain** — `src/data/checklist.ts`, per-step validators, docx generators, compliance math. You may *import and call* generators. If a generator must be refactored to be callable from a new route, keep its output byte-identical (see parity test, Phase 5) and report it.
6. **Do not invent documents or MCA forms.** The registry is seeded only with documents the app already generates today (discovered in Phase 0). Workbook-driven documents come later (§8).
7. **No new table in this feature.** Documents are generated on demand from `checklist_state` + BR row. (Stored versions are a later decision, §8.)
8. **Paths:** use `staffBase` / `adminProjectPath(eng, roleOrBase)` / `useStaffBasePath`. Never hardcode `/app/manager`. Admin and manager share views — build once.
9. **UI language:** never render "intern". Use design tokens (`primary`, status tokens) and existing primitives (`src/components/noir/*`, shadcn `src/components/ui/*`). Status colour on chips/dots only — never row or page fill. Waiting/needs-inputs = coral, ready = teal-green, locked/release = slate. Must work in light + dark.
10. **Sequential gate unaffected.** Leads can open any step; nothing here changes client gating.
11. **Verification gate after every phase:** `npm run typecheck && npm run test && npm run lint`. Fix before moving on. Report deviations honestly.
12. **Commit at every phase** with the message given. Do not stop for permission between phases except at the two ⛔ checkpoints.

---

## 3. Phase 0 — Discovery (read only) ⛔ checkpoint

Read the repo and write `docs/doc-pack/DISCOVERY.md`. Do not change code. Answer:

1. **Generators:** every docx generator used in pre-incorporation. For each: file path, exported function, input shape, which `checklist_state` step ids/fields it reads, whether it expands per director / per subscriber, output filename pattern.
2. **Pre-2 BR card:** component path, how drafts vs finalized are stored (BR row fields), how finalized docx is produced/downloaded today.
3. **Pre-7 generate panel:** component path, its API route(s), and — critically — **does it persist anything?** (S3 upload, `checklist_state` flag, audit row, notification, marking the step complete). List every side effect.
4. **Step catalog ids:** the real `stepId` for all 12 SPICe+ steps (Part A 1–5, Part B 6–12) and the section-tab ids inside Client Details and Director KYC.
5. **Deep-link support:** can the step page open a specific section tab from the URL (e.g. `?tab=`)? If not, note where tab state lives.
6. **Step page layout files:** where the journey rail is rendered (intern and staff step views), where the H1 row / `PageBackButton` is, and the breakpoint at which the rail hides.
7. **Overview phase rows:** component rendering the four phase rows.
8. **Zip:** is a zip library already a dependency? (`jszip`, `archiver`, etc.)
9. **Existing download pattern:** how other routes stream files (headers, filename, S3 presign vs direct stream).
10. **Audit:** the helper used to write audit events and the naming convention (e.g. `client.invite`).
11. **Bug check:** the intern URL `/app/intern/engagements/sampada-mintup/step/name-application` rendered **Client Details** as the page and current rail step. Find why (route→step mapping, fallback to current step, or stale param) and report. Do not fix yet.

⛔ **Stop here.** Print a short summary of DISCOVERY.md, flag anything that contradicts this file, and wait for confirmation.

Commit: `docs(doc-pack): discovery notes for pre-incorporation document pack`

---

## 4. Phase 1 — Document registry + evaluator (pure, tested)

Create `src/lib/doc-pack/` (pure TS, no `db`, no React):

- `types.ts`
  ```ts
  type DocPart = 'part-a' | 'part-b';
  type DocStatus = 'ready' | 'needs-inputs' | 'waiting-release';
  interface RequiredInput {
    key: string;            // stable id, e.g. 'director.pan'
    label: string;          // user-facing, e.g. 'Director 2 PAN'
    stepId: string;         // real catalog id from Phase 0
    tabId?: string;         // section tab to open
    isPresent(state: ChecklistState, ctx: EntityCtx): boolean;
  }
  interface DocDefinition {
    id: string;             // 'dir-2', 'inc-9', 'moa', 'aoa', 'br' ...
    part: DocPart;
    label: string;          // 'DIR-2 consent'
    sourceStepIds: string[];
    expandsPer?: 'director' | 'subscriber';
    requiredInputs: RequiredInput[];
    releaseGate?: 'br-finalized';
    generate: GeneratorRef; // pointer to existing generator from Phase 0
  }
  interface DocPackItem {
    key: string;            // 'dir-2:director-2'
    docId: string; part: DocPart; label: string;
    status: DocStatus;
    missing: { key: string; label: string; stepId: string; tabId?: string }[];
    sourceStepIds: string[];
  }
  interface DocPackSummary { items: DocPackItem[]; counts: Record<DocStatus, number>; total: number; }
  ```
- `registry.ts` — one `DocDefinition` per document found in Phase 0. Nothing else.
- `evaluate.ts` — `evaluateDocPack(state, brRow, entities): DocPackSummary`. Expands per director/subscriber, checks release gate first (`waiting-release` wins), then required inputs.
- `unblock.ts` — `fastestUnblock(summary, currentStepId?)`: the single missing input that releases the most documents; prefer inputs on the current step. Used by the rail card hint.
- `step-strip.ts` — `docsFedByStep(summary, stepId)` for Phase 5.

Tests `src/lib/doc-pack/__tests__/` (Vitest):
- empty state → nothing ready, BR `waiting-release`
- BR draft vs finalized flips only the BR item
- director 2 missing PAN → only director-2 items `needs-inputs`, director-1 items `ready`
- per-subscriber expansion count matches subscribers
- `fastestUnblock` prefers current-step inputs, then max released docs
- `requiredInputs[].stepId` all exist in `src/data/checklist.ts` (guards against typos)

Commit: `feat(doc-pack): registry and readiness evaluator for pre-incorporation documents`

---

## 5. Phase 2 — Repository + API routes

Repository `src/db/repositories/doc-pack.ts` (or extend the engagement repository if that is the convention):
- `getDocPackInputs(ctx: AuthContext, engagementId)` → `{ checklistState, brRow, entities }`; enforces staff membership (lead/manager/admin/super). Client → throws forbidden.

Routes (App Router):
| Method | Path | Returns |
|---|---|---|
| GET | `/api/engagements/[id]/doc-pack` | `DocPackSummary` |
| GET | `/api/engagements/[id]/doc-pack/[itemKey]` | the `.docx` (`Content-Disposition: attachment`) — 409 if item not `ready` |
| GET | `/api/engagements/[id]/doc-pack/[itemKey]?preview=1` | preview in whatever form the app already uses for docx preview; if none exists, skip preview and note it |
| GET | `/api/engagements/[id]/doc-pack/zip` | zip of all `ready` items; 409 if none |

- Generation calls the existing generators with inputs from the repo. Filenames: reuse existing patterns from Phase 0; zip name `{company-slug}-pre-incorporation-{yyyy-mm-dd}.zip`.
- Zip: use the existing dependency if Phase 0 found one; otherwise add one small library and state it in the commit body.
- Audit each download: `doc_pack.download` / `doc_pack.download_zip` with item keys. No email, no notification, no `checklist_state` writes.

Tests:
- client role → 403 on all four routes
- lead not assigned to engagement → 403 (cross-tenant)
- manager not owning engagement → 403
- non-ready item download → 409
- ready item returns `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Commit: `feat(doc-pack): staff-only API for pack summary, docx and zip download`

---

## 6. Phase 3 — Pack page + hook

- Hook `useDocPack(engagementId)` (TanStack Query), key `['doc-pack', engagementId]`. Invalidate it wherever step responses save (autosave success) so the rail card updates live — hook into the existing autosave success path, do not add a new autosave.
- Routes:
  - Intern: `/app/intern/engagements/[slug]/documents`
  - Staff: `{staffBase}/projects/[slug]/documents` (one view, shared admin/manager)
  - `?part=part-a|part-b` preselects the filter.
- Page layout (match mockup): `PageBackButton` + H1 "Pre-incorporation documents" + one-line subtitle (company name; "Generated from SPICe+ Part A and Part B. Regenerates on every download."). Summary row: three count chips + **Download ready (N) as .zip**. Filter pills All / SPICe+ Part A / SPICe+ Part B. List rows: name, source steps (mono metadata), status chip, missing-input links, Preview + Download .docx (disabled unless ready).
- Missing-input link → step route for `stepId` with `tabId` (use the deep-link mechanism from Phase 0; if none exists, add a minimal `?tab=` read in the step page — no other step-page changes).
- Waiting-release BR row shows: "Opens once the board resolution is finalized in Draft Board Resolution." with a link to the Pre-2 step. No finalize button here.
- Empty/error states: follow existing empty-state primitive; error copy says what failed and offers retry.
- Add the route to `shellBreadcrumb`: `Home › Clients › {Company} › Pre-incorporation documents`.

Commit: `feat(doc-pack): document pack page for leads and staff`

---

## 7. Phase 4 — Entry points (rail card, narrow button, overview pill)

- `DocPackRailCard` rendered below the journey rail **only when the current step belongs to SPICe+ Part A or Part B**. Content per §1 and mockup: title, `N of M ready` (mono), segmented bar, 3-line legend, primary **Open document pack**, "Fastest unblock" line from `fastestUnblock()` linking to the input.
- Narrow fallback: when the rail is hidden at the Phase 0 breakpoint, show a secondary button beside the H1: "Document pack" + `ready/total` chip. Hidden when the rail is visible — never both.
- Overview: "Documents `ready/total`" pill on the SPICe+ Part A and Part B phase rows only → pack page with `?part=`.
- Build once for intern + staff step views (shared component; intern vs staff paths via existing helpers).
- Do not change the sticky footer, section tabs, or rail steps.

Commit: `feat(doc-pack): rail card, narrow header button and overview entry points`

---

## 8. Phase 5 — Step strip + retire Pre-7 panel ⛔ checkpoint

**5a. Strip (safe):** `DocSourceStrip` at the top of the form on any step where `docsFedByStep` is non-empty: "N documents use this step's data · X ready, Y need inputs · Open in document pack". Status + link only.

**5b. Parity test:** for a seeded engagement, assert each Pre-7 document from the pack API is identical to what the Pre-7 panel produces today (same generator, same inputs → compare extracted text of `word/document.xml`, ignoring timestamps).

⛔ **Stop.** Report: parity result + every Pre-7 panel side effect from Phase 0 (S3 save, `checklist_state` flag, step completion, audit) and where each will live after removal. Wait for confirmation.

**5c. After confirmation:** replace the Pre-7 generate panel with `DocSourceStrip`. Any side effect the owner wants kept moves to the pack route or stays in Pre-7 as a non-download action. **Keep the Pre-2 BR card exactly as is** (editor + finalize are workflow).

Commits:
- `feat(doc-pack): step strip showing which documents a step feeds`
- `test(doc-pack): parity between pack and Pre-7 generate panel`
- `refactor(doc-pack): replace Pre-7 generate panel with document pack strip`

---

## 9. Acceptance criteria

- Lead on any Part A/B step sees the rail card; counts match the pack page.
- Filling a missing field and autosaving updates the rail card without reload.
- Clicking a missing-input link lands on the right step and tab.
- BR appears as `waiting-release` until finalized; after finalize it is `ready` and downloadable; no draft is ever downloadable from the pack.
- Client: no entry point anywhere, all routes 403.
- Admin and manager see the same page under their own prefix; super admin can reach it via shell entry.
- No emails or in-app notifications fired by any pack action.
- Light and dark both readable; status colour only on chips/dots.
- `npm run typecheck && npm run test && npm run lint` green.

---

## 10. Out of scope (later)

- **Workbook-driven documents.** The firm's master Excel workbook defines the full pre-incorporation set. Adding those = new `DocDefinition`s + new generators + any missing inputs added as fields in existing SPICe+ A/B steps (no new steps). Separate task once the workbook is mapped.
- **Stored versions** (`generated_documents` table + S3, download history). Needs a new table + repository + cross-tenant test.
- **Client access** to finalized/shared documents from the pack. Needs an explicit product decision.
- Post-incorporation and Registration document packs.

## 11. Files likely touched (confirm in Phase 0)

New: `src/lib/doc-pack/*`, `src/db/repositories/doc-pack.ts`, `app/api/engagements/[id]/doc-pack/**`, pack page views + routes under intern and staff shells, `DocPackRailCard`, `DocSourceStrip`, `useDocPack`.
Edited (minimal): intern + staff step views (mount card/strip/button), overview phase rows (pill), shell breadcrumb map, step page `?tab=` read (only if missing), Pre-7 step (Phase 5c only).
Do not touch: `src/data/checklist.ts`, validators, docx generator internals, BR finalize/notify code, email dispatcher, gate logic.

---

## 12. Amendments after Phase 0 (owner decisions, 2026-09-22)

Discovery is in `docs/doc-pack/DISCOVERY.md`. These decisions override the sections above where they differ.

1. **Registry follows the current catalog.** Part B = `pre-13`, `pre-14`, `pre-15`, `pre-16`, `pre-7` … `pre-12`. Director inputs point at `pre-15` repeat entries (legacy engagements: `pre-6`). `RequiredInput` carries an optional `directorIndex` for labels ("Director 2 · PAN"); the deep link is step + section only, never an entry.
2. **`tabId` = slug of the section label.** The step page resolves the slug against the sections currently rendered; no match → open the step without selecting a tab. Test: every registry `tabId` exists in at least one ownership variant of its step.
3. **Phase 3 adds `?tab=<slug>`** to the step page: read and select only, no other step-page changes.
4. **No `expandsPer: 'subscriber'`.** Director expansion only, and only for directors the generators can render today (first non-resident, first resident). Others are listed in `DocPackSummary.skippedDirectors`, not invented as items.
5. **Do not retire the Pre-7 panel.** Phase 5c becomes: keep a single "Generate & attach for filing" action in Pre-7 (existing S3 upload, `patchChecklistItem` `*DraftUrl`, audit unchanged); remove only its per-doc download/preview list; add `DocSourceStrip`. Validator untouched. Pack routes stay read-only: no checklist writes.
6. **`releaseGate: 'br-finalized' | 'directors-accepted'`.** `directors-accepted` reads `pre-15.reviewStatus === 'accepted'` (legacy `pre-6`) and surfaces as `waiting-release` with a reason and a link to `pre-15`.
7. **Attached version wins.** For Pre-7 documents the pack serves the stored `*DraftUrl` file when present, else generates on demand. `DocPackItem` gets `source: 'attached' | 'generated'` and `attachedAt?`. Row copy: "Attached to Pre-7 · {date}" or "Generated now".
8. **BR:** the pack never serves a draft, even though the BR download route allows staff draft download.
