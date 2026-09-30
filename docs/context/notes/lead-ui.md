# Project Lead (code role `intern`) workspace UI

Gotchas already paid for once. Append when something costs more than a minute to figure out.

## Intern engagement overview

- No Progress side rail and no equal-weight `internWeightedProgress` %. Overview
  is company name + compact CC (two chips, `+N` popover for the rest) in the same
  `surface` card as the phase list. The 4-node `InternPhaseStepper` was removed —
  it duplicated `InternPhaseTickTrack` on each list row (`InternPhaseStepper.tsx`
  deleted). Overview chrome is intern-only (`InternEngagementOverview`): back
  chevron + serif H1 + inline CC. Four phases are one list surface (full width, not a 4-col row)
  with title-band tick equalizers. Each row is
  node + title (+ Pre-incorporation subtitle on A/B) + that phase’s
  InternPhaseTickTrack + chevron. Card / row click →
  `internOverviewCurrentItemInPhase` (first not-done in that phase, else last)
  via `internEngagementStepPath`. Phase tabs + `{done} of {total}` checklist
  panel are off (`INTERN_PHASE_TABS_ENABLED`);
  persist is kept so tabs restore in one flag. Now strip stays off
  (`INTERN_YOU_ARE_HERE_ENABLED`). When tabs are on: four **tabs** (SPICe+ Part A, Part B,
  Post-incorporation, Registration). One panel of rows for the selected
  phase, all catalog steps clickable. Active tab uses the intern step-page
  underline (`text-brand` + 2px brand bar). Progress for the open tab lives
  in the panel header (`3 of 7 complete` + thin primary bar), not as chips
  under the company name and not as raw `0/7`.
  Last tab is stored per engagement in `localStorage`
  `vcfo.intern.engagementPhaseTab.{engagementId}` (phase id such as
  `pre-inc-phase-1`). Stored value wins; otherwise the current working
  phase; otherwise Part A. Do not use one global tab across companies.
  Intern UI ignores sequential `locked` / `canOpen` for navigation; client portal still
  waits. Intern/staff `patchChecklistItem` is not blocked by sequential lock.
  Intern step pages keep a **phase-scoped** journey rail on the right (`allowLockedOpen`):
  opening a Part A step lists only Part A (`pre-inc-phase-1`), Part B only Part B
  (`pre-inc-phase-2`), Post only post-inc, Registration only registration (+ intern
  Registration sub-headers; FEMA-bucket items nest here). Helper:
  `internOverviewPhaseForItem`. Do not show all four phases on one step page. Forms stay editable.
  Overview phase-tab rows (and Today week-queue rows) use a green tick vs empty circle
  (`InternStepDoneMark`) for the same `gate.kind === 'done'` count as the panel header —
  no Completed/In progress words.
  Now vs Waiting comes from sequential gates: `active` = intern-owned (“Your
  step”), `waiting` = client-owned (“Waiting on the client”). Open step uses
  `internEngagementStepPath`. Helpers: `src/lib/intern-overview-progress.ts`.
  Registration panel rows are grouped under intern-only sub-headers (General,
  Customs, Foreign Trade, Labour, Local Compliance, IP/Brand, FEMA) by matching
  catalog titles; FEMA-bucket items nest here instead of a fifth top-level tab.
  `InternProgressRail` was deleted.

## Intern / staff step workspace

- Checklist step pages (`…/step/{slug}`) use a two-column workspace. Intern: form
  left/center, journey/progress rail **right** (same slot as the old workspace card).
  Admin/manager keep the journey rail on the left plus `StepWorkspaceRail` on the
  right. Intern does **not** render `StepWorkspaceRail` (no Client badge, Next,
  attachments list, Help, or Lead → manager approval inset). Rail buttons move to
  a quiet sticky footer with Save: Request manager approval / Email manager again,
  Mark all complete (legacy), plus the existing Save / Deliver actions. No “Back
  to project” row — intern nav + the in-page H1 locate the step. Pre-2 board
  resolution CTA is a **single** `BoardResolutionStepLink` card in the form-card
  footer (`aboveFooterActions`, above Email manager / Save / Submit) — generate,
  draft, or finalized+pill. Never above the H1/tabs, never a second footer
  button. Pre-7 generate panel renders after the form.
  Intern journey rows: person icon only (neutral = client, blue = project lead),
  kebab → Attachments required (green tick if uploaded + quiet filename; empty
  circle if not; “None” when the step has no file fields). Intern step rail lists
  **only the current intern phase** (Part A on Client Details — never Part A +
  Part B).   Intern step workspace is one composition: H1 full-width, then a row
  of form Surface + phase journey rail so the rail’s top edge matches the form
  card (not the title). The rail is a compact `Surface` (natural height, not a
  viewport slab). Intern step `main` uses normal page scroll like other
  intern pages. Tab-strip chevrons sit in dedicated 36px edge slots, vertically
  centered with labels. Section tabs
  stay one row (`overflow-x`), map vertical wheel to `scrollLeft`, and use
  edge arrows. Intern Client Details (and other intern accordion forms)
  use a single-row underline tab strip; earlier tabs use footer **Next**
  (next heading). The **last** tab is **Submit** (validated persist +
  `internLeadManagerRequestPatch`, then next step in the intern phase or
  the engagement page). Intern forms auto-save drafts (~600ms debounce)
  via the same `updateItem` path as Save; Save is hidden while clean and
  shown while pending, saving, or failed. File fields POST to
  `/api/engagements/:id/milestone-documents` then PATCH the storage path
  immediately. The shell chrome shows a full location trail in the top bar
  (see “Shell location trail”). Intern never shows playbook SLA / “working days”
  duration: `hideTimeline` on `StepDetailContent` is not enough — the journey
  rail still used `StatusBadgeWithTimeline` until `hideTimeline` was passed
  there too. Help/notes that mention working days are filtered.
  Intern engagement surfaces also omit status chips (`hideStatus`): journey rail
  badges, phase-card / Today-queue row pills, step-header StatusDot + label,
  and the Submitted chip in `MilestoneResponseRowSummary`. Phase headers still
  show `{done} of {total}` progress. Client/admin keep timelines and status.
  Staff lock banner “Client submitted this milestone. / unlocked fields are
  editable by the client” was removed globally; field-level lock/unlock icons
  remain.
- App shell chrome is an **L** flush to the viewport: sidebar `top-0 left-0
  bottom-0`, top bar `top-0` from the sidebar’s right edge to the screen
  edge. No floating inset. Sidebar header keeps the VCFO Suite mark (+ wordmark
  when the rail is expanded). The top bar always shows the official SBC lockup
  (`public/sbc-logo-light.png` / `sbc-logo-dark.png`, via `html.dark`) with
  transparent backing — compact mark crop below `sm`. Hover-peek expands the collapsed rail over content
  (200ms leave delay). Footer pin is one compact control (`SidebarPinButton`,
  same on the slim rail) that cycles Auto (hover peek) → Keep open → Keep closed.
  Tooltip names the current pin and the next click. Do **not** restore the old
  dual Keep open / Keep closed buttons when editing `RoleSidebar` motion. `sidebarCollapsed` is derived
  (`mode !== 'open'`). Do **not** call
  `setSidebarCollapsed(true)` on intern project open — that used to rewrite
  Keep open (`open`) to Auto. Intern Clients list expand is visual only
  (`shellDesktopNavExpanded` in `intern-sidebar.ts`): auto + `/app/intern/clients`
  takes rail width; auto + `/app/intern/engagements/…` stays collapsed for
  workspace width; Keep open/closed are never mutated by the route.
  Nav scrollers use
  `.sidebar-scroll` (no visible bar). Search is a tool button, not a fake input.
  CommandPalette is the only type-in search. The top bar trail is the full
  location path (Home › … › leaf). Nested AppShell routes get a compact **Back**
  chevron immediately left of the page H1 (company name, step title, settings
  name, etc.) — `PageBackButton` + `shell-back.ts`. Hide only on the true home
  (intern Today, staff dashboards, client Inbox, role index). Show on every
  other page that has an H1 / PageHeader (Clients, Vault, My work, compliance,
  settings, engagement/project/step, board-resolution). Do not add a second
  “Back to portfolio” on intern engagement. Click is `router.back()` when
  `history.length > 1`, else the parent path. The top bar has no back slot
  (crumbs + search only).
- Checklist file upload is a compact `.milestone-upload-zone` row (~44px, max 88px),
  not a tall centered dropzone. Remarks use `.milestone-form-textarea` (`min-h` 72px /
  3 rows, grows with `field-sizing: content`).
- Checklist fields pair on desktop: `.milestone-form-grid` is 2 columns from `md`.
  Short = text/date/select (phones, emails, yes/no). Full (`grid-column: 1 / -1`) =
  textarea, file, address text, or helper copy longer than ~120 chars. Odd leftover
  shorts stay in one cell (~50%), not stretched. Phone stacks to one column.
  Infer via `getMilestoneFormFieldLayout`; optional `ChecklistField.layout` override.

## Intern form autosave (what keeps a half-filled step alive)

- `useMilestoneResponseFormState`: `allFields` is memoised on `item`. It used to be
  rebuilt every render, which re-created `flushPendingAutoSave` → `clearDebounce`
  → the unmount-flush effect's deps, so that effect's cleanup ran on **every render**:
  it cleared the 600ms debounce before it fired and flushed against refs that had
  not yet synced. One edit + refresh = lost; slow typing = duplicate POSTs of
  partial words. Do not key that effect on callbacks again.
- The flush effect is keyed on `autoSaveEnabled` only and reads the latest flush
  through a ref. It fires on unmount, `visibilitychange → hidden` (tab switch) and
  `pagehide` (refresh / close, with `fetch keepalive` via `updateItem(…, { keepalive })`
  → `patchChecklistItemInDb`). It flushes only if `userEditedRef` is set — otherwise a
  remount posted pre-1 engagement defaults back as answers.
- Draft = `saved ⊕ touched` (`DraftEdits { values, touched }`, `overlayTouchedFields`).
  The step page renders before the full checklist loads (the slim index has no
  answers), so a full snapshot taken then showed empty fields and the next autosave
  diff sent `''` for every server-held field — a wipe. Untouched fields always follow
  `saved`; the diff only ever carries touched fields. `mergeSavedFileFieldsIntoDraft`
  is gone; late file paths arrive through the same rule.
- `engagementsSettled` (AppContext) is true only once the fetched list is **applied**
  to `engagements` state (`appliedEngagementsData === engagementsQuery.data`), not on
  the query's success render. Step / project pages redirect on "settled + no
  engagement", and that one-render gap bounced roughly 1 in 3 hard refreshes of a
  step page to the clients list.

## Intern form error summary

- Intern step pages (`sectionTabs` → intern workspace) hide `FormErrorSummary`
  (“N items need attention”). Per-field required errors still show. Restore:
  `SHOW_INTERN_FORM_ERROR_SUMMARY = true` in
  `src/views/incorporation/MilestoneResponseFormParts.tsx`. Client/manager
  forms are unchanged.

## Intern typecheck seams

- Intern step/overview UI is split across many files. If `tsc` reports missing
  modules (`checklist-step-attachments`, `InternStepDoneMark`,
  `InternSectionHeadingNav`) or extra props (`sectionTabs`, `extraFooterActions`,
  `hideStatus`, `sidebarMode`), the consumers landed without the helpers.
  Restore the helper, then add the props to the source type — do not delete the
  call sites.   `resendManagerEmail` is a `ChecklistItemPatch` extra, not persisted
  `ChecklistItemState`.

## Intern Today + My work

- Today (`/app/intern/today`) is one greeting hero (greeting + inline stats + today’s
  focus) plus week strip, action queue, phase progress, compliance health, waiting-on.
  Stats deep-link into My work with `?focus=`. Helpers: `src/lib/intern-work.ts`.
  Appearance (hero/sidebar/motion) is localStorage `vcfo.shell.appearance`.
- My work (`/app/intern/tasks`) is List / Board / Timeline of the same classified items
  (steps + filings + pending document requests). Nav badge = needs-action count.
  `groupInternWeekQueueByCompany` still exists for tests; Today no longer renders that grid.
  This week strip maps intern work onto IST days: due/complete dates stay on
  that civil day; overdue or undated open work (waiting, filings, steps) lands
  on **today** so the rail is not empty while Waiting On still has rows. Day
  cells show legend-coloured counts (not truncated labels). Clicking a day
  filters the action queue + waiting list; `?day=YYYY-MM-DD` opens My work.
  Dates go through `ymdFromIsoInIst` — never UTC `slice(0, 10)` on a timestamp.
  My work Timeline is a Mon–Sun CSS grid of cards (`internTimelineGrid`), not
  a 14-column Gantt with overlapping diamonds.
  Intern portfolio includes `engagement.leadIds` (not only primary intern_id).
  Seed upsert must not overwrite `profiles.intern_id` — that unlinks DemoCo.
- Metric top-bar colours use semantic tokens (`primary`, `danger`, `accent-sky`,
  `success`) — never `orange-*` (those still alias blue). Waiting is sky/pink/cyan,
  never khaki or brown.
- Quiet IST clock stays in the hero as `ClientLocaleNowLabel` (1s tick in that
  leaf only). Never call `useClientLocaleNow()` in Today / AppContext — that
  re-rendered the whole intern home every second and froze hover/clicks.
  Today's todos persist on `tasks` (`engagement_id`
  null, `assigned_to` = owner, `step_id` prefix `todo:`) via `/api/todos`. Interns
  see/edit only their own. Manager lists self + leads/co-managers on scoped clients
  plus intern reports; admin/super list firm-wide staff. Mutate is owner-only.
  localStorage `vcfo.intern.focus.{userId}` is cache/fallback (and one-shot migrate).
  Rows mix pinned work `{ id, done, title? }` and typed `{ id, done, custom: true, title }`
  — no 3-item cap; `parseInternFocus` keeps legacy pins. Staff dashboards show a
  grouped open-todos panel (`TeamTodosPanel`). Action queue expanded companies
  persist as `vcfo.intern.queue.expanded.{userId}` (engagement id set; not accordion).
- Intern **Requests** page is gone. `/app/intern/requests` redirects to My work.
  Pending document requests still show on Today / My work (`waiting-request`);
  client Inbox/Documents and staff project Documents still use the data layer.

## Intern Today Waiting On overlap

- Waiting On lives in `LeadSideRail` (318px column). A shrink-0 “Email manager
  again” CTA left ~80px for the left stack; the `shrink-0` kind chip then
  overflowed (visible) into the age pill. Use `InternWorkDenseLayout`: status
  + age wrap as siblings; CTA is `flex: 1 0 100%` so it cannot share pixels
  with those badges. Same row is used for action-queue tasks and My work
  list below `xl`.

## Intern document vault + sidebar order

- Project Lead sidebar order (high-frequency first): Today → My work → Clients
  dropdown → Send email → Docs (Vault, Knowledge Bank) → Updates →
  Compliance calendar, then a thin “Insights” hairline, then Analytics + Audit Log.
  Calendar stays in the work cluster; Analytics + Audit Log are a quieter
  footer pair (same break after Docs on admin/manager). Settings stays in the
  footer. Staff roles that have both Send email and Docs put Send email
  immediately above Docs. Do not set `position` on `.shell-sidebar-skin`.
- Vault is `/app/intern/vault` (shared view `src/views/vault/DocumentVaultPage.tsx`).
  Manager/admin already had `/vault`. Files are grouped by assigned company,
  then phase (pre-inc / post-inc / FEMA / statutory) then checklist step.
  Search matches file name (and company); results show file + company + path.
  CommandPalette (debounced) uses the same Path A `GET /api/documents` and
  `GET /api/knowledge-bank` lists — intern only assigned companies; manager
  their clients; admin all. Click goes to vault/KB with `?q=`.
  Staff/intern milestone POST `/api/engagements/:id/milestone-documents` also
  `createDocument` so the vault index is complete (clients stay storage-only
  in checklist_state). Demo rows: APIs map uuid → `e1`; matching uses
  `engagementIdAliases` so indexed files are not dropped.
  Milestone downloads stay on `/api/milestone-documents/signed-url`. Indexed
  `documents` rows use `GET /api/documents` (AuthContext-scoped, no
  `engagementId`) and `/api/documents/:id/signed-url`. Intern isolation is
  Path A in `listDocuments` / `getDocumentById` (assigned + membership only).
  No extra migration.
