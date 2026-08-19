# NOTES — gotchas worth not rediscovering

Append here whenever something costs more than a minute to figure out.

## Environment

- DB user is `vcfo`, not `postgres`. `docker exec vcfo-postgres psql -U vcfo -d vcfo`.
  Connecting as `postgres` fails with `role "postgres" does not exist`.
- Containers `vcfo-postgres` and `vcfo-minio` are already running; `npm run infra:up`
  is idempotent, so re-running is safe.

## Typecheck

- `export interface Foo = Partial<Bar>` is invalid — Next overlays
  `Expected '{', got 'interface'` and `tsc` reports `TS1005`. Use
  `export type Foo = Partial<Bar>`. That parse error in `AppContext.tsx`
  500s every page (providers import it).
- `app/api/_reference-supabase/` has been deleted (Phase 1d). Residual typecheck
  noise is from leftover Supabase stubs (`src/lib/supabase/*`) and missing
  `useInternPortfolio` — not from API routes.
- `_rewrite-from-supabase/` has been deleted; incorporation docs live under
  `src/lib/incorporation-docs/` (storage/share/preview-save).

## Phase 3

- Compliance generation is a system job: call
  `systemGenerateComplianceInstances` / `runComplianceGenerate` from Inngest
  only — it uses `db` without AuthContext inside the repository file.
- Obligation FK rows are upserted from `COMPLIANCE_OBLIGATIONS` on first run.
- Shared email helper: `src/lib/email/send-email.ts` (dispatcher). Transports:
  `send-via-resend.ts` (default) and `send-via-ses.ts` when `EMAIL_PROVIDER=ses`.
  Do not add a second Resend/SES call site — use `sendEmail` / `sendResendEmail`.
- Process emails + dashboard fan-out: `notifyEngagementEvent` /
  `notifyEngagementEventBackground` in `src/lib/email/notify-engagement-event.ts`.
  Wired on checklist submit/review/unlock/deliver, incorp docs share, and
  document-request create. Recipients resolved via
  `src/db/repositories/engagement-recipients.ts`. Without configured From /
  Resend key (or SES identity), sends console-skip (same as welcome).
- **From + Reply-To:** Client → lead process mail is Resend From
  `{sanitized-company-name}@sbctrack.in` (e.g. `Acme Pvt Ltd <acme-pvt-ltd@sbctrack.in>`)
  so Outlook can filter; Reply-To is the client. Lead → client is **not** Resend:
  the app opens compose, then Graph `Mail.Send` from the lead’s linked Outlook mailbox.
- **Outlook Graph:** `AZURE_AD_CLIENT_ID` / `_SECRET` / `_TENANT_ID`. Connect at
  `/api/outlook/connect` or Settings. Tokens in `outlook_connections` (encrypted
  with `AUTH_SECRET`). Not an Auth.js login provider. Staff compose page:
  `/app/{intern|manager|admin}/mail` — Graph send from the signed-in user’s
  mailbox; directory is engagement-scoped (+ intern `reports_to_manager_id`).
- **Resend onboarding sender:** `FROM` with `@resend.dev` can only deliver to
  the Resend account owner. Use explicit `EMAIL_DEV_REDIRECT_TO` /
  `RESEND_DEV_REDIRECT_TO` only for deliberate local testing. Verify a domain
  for real lead delivery.
- **SES flip:** set `EMAIL_PROVIDER=ses`, verify domain in SES (`SES_REGION` /
  `ap-south-1`), leave sandbox via production access request. Keep Resend until
  that works. See `docs/context/AWS-DEPLOY.md` §8.
- Client submit / client document upload → **lead + every project manager**
  via Resend `{company-name}@sbctrack.in` (Reply-To = client). Managers are
  resolved from `engagements.manager_id`, `engagement_managers` membership,
  then intern `reports_to_manager_id` if those are empty. Intern validated Save
  (and “Request manager approval”) on **any bucket** sets
  `reviewSource=lead_manager_request` and emails **managers only** from the
  lead’s Outlook when connected, else Resend. Saving **updated answers** reopens
  review (even after accept) and repeats that email; manager Accept then
  composes to the client again (CC admin + lead). Manager Accept opens Graph
  compose **to the client**, CC firm admins + leads (+ engagement progress CC).
  Review reject / deliver / share / request / unlock / **board-resolution
  finalize** also open in-app compose for Graph send to the client. Lead resolve
  needs `profiles.intern_id` to match `engagements.intern_id`.
- **Board resolution finalize** (`POST .../board-resolution/finalize`) is the
  only release action — it sets `status=finalized`, marks Pre-2
  `deliveredToClientAt` (unlocks Pre-3 signed upload), and
  `notifyEngagementEvent({ event: 'board_resolution_shared' })` for Graph
  compose + in-app Received. Re-clicking Send to client reopens compose
  without duplicating in-app rows. Client GET already hides drafts until
  finalized; the missing piece was notify + sequential-gate delivery, not a
  `shared_with_client` documents-table flag.
- In-app rows for those events are inserted with `createNotificationsForUsers`
  (server). Client checklist diffs toast + invalidate the bell but do not
  re-persist those kinds (avoids duplicates).

## Stubs

- Stub files `throw` on import by design, so a missing port shows up as a runtime crash
  rather than shipping silently. A `TS2305: has no exported member` error usually means
  "this stub still needs writing", not "the import path is wrong".

## Four-role scoping

- `admin` = firm-wide (old manager unrestricted). `manager` = rows where
  `engagements.manager_id = ctx.userId`, with legacy fallback
  `manager_id IS NULL AND admin_id = ctx.userId`.
- Creating a project as admin requires `managerId` in the POST body; as
  manager, `managerId` is forced to `ctx.userId` and `adminId` stays null.
- Prefer `requireAdminOrManager()` for firm ops (create project, interns,
  KB write/delete, welcome email, audit-log read). Reserve `requireAdmin()`
  for create/list managers APIs.
- Cross-role URLs bounce via middleware segment check — use `staffBase` /
  `adminProjectPath(eng, roleOrBase)`, not hardcoded `/app/manager`.
- Guard narrowing: use `if (guard.ok === false)` so TS sees `error`/`status`.

## LAN / phone access

- Use `npm run dev:lan` (binds `0.0.0.0`) — plain `next dev` is localhost-only.
- Next 15+ blocks cross-origin `/_next/*` (HMR + JS chunks, not HTML/API) unless
  the browser Origin is in `allowedDevOrigins` (`next.config.mjs`). Symptom:
  page opens, login fields/toggles stay dead. LAN ranges are already listed.
- Cloudflare quick tunnels (`*.trycloudflare.com`) are a different origin than
  localhost:3000; the hostname also rotates every `cloudflared tunnel` run.
  Next 16 `isCsrfOriginAllowed` matches hostname only; `*.trycloudflare.com`
  (one label) and `**.trycloudflare.com` are in `next.config.mjs`. Verified
  against Next 16.3. For ngrok/other hosts set `DEV_TUNNEL_HOST` or
  `ALLOWED_DEV_ORIGINS` and **restart** `npm run dev:lan` (`next.config` is
  read at boot). Confirm in DevTools Network: `/_next/static/chunks/*` is
  **200**, not **403** (`Unauthorized` body = origin still blocked).
- **Leave `AUTH_URL` unset** (`AUTH_TRUST_HOST=true`). Auth.js `reqWithEnvURL`
  rewrites the request origin to `AUTH_URL` when it is set, so pinning
  `http://localhost:3000` or a previous trycloudflare hostname breaks login
  on the host you actually opened. Same for `NEXT_PUBLIC_SITE_URL` (emails /
  Outlook callback). Do not paste the rotating tunnel URL into `.env.local`.
- HMR (`/_next/hmr` websocket) may still warn or disconnect through Cloudflare
  even when pages work. Dismiss the overlay; chunks 200 means React hydrated.

## Phase 2 mapping

- Task DB `open|in-progress|done` ↔ app `not-started|in-progress|completed` (other
  StatusCodes write as `open` on the way in).
- Doc request `fulfilled→uploaded`, `cancelled→rejected`; `approved` stored as plain text.
- Notification extras (`kind`, `href`, …) JSON-encoded in `notifications.description`.

## Docs that drift

- `BUILD-STATUS.md` describes the pre-install scaffold and is now partly stale (it claims
  nothing has been installed or run). Trust `docs/context/STATE.md` over it.
- `CLAUDE.md` carries a Next.js block auto-written by `next dev`. Committing it alongside
  other work keeps the tree clean; deleting it just regenerates.

## Multi-client + Super Admin

- Membership table: `engagement_clients` (owner/member). Primary still on
  `engagements.client_user_id` for legacy. SQL:
  `scripts/sql/20260810_multi_client_super_admin.sql`.
- Clients invite peers via `POST /api/engagements/:id/clients` and
  `/app/client/team`. Audited as `client.invite`.
- Clients substitute (self or peer) via
  `POST /api/engagements/:id/clients/substitute` — swaps membership, moves
  primary when replacing owner, welcome email for new accounts, audit
  `client.substitute`. Self-substitute signs the actor out of the portal.
- Client audit: `/app/client/audit` uses scoped `GET /api/audit-logs`.
- `super_admin` may enter every `/app/*` segment (middleware). Home:
  `/app/super/dashboard`. Seed: `super@vcfo.local` / `super123`.

- Browser POSTs multipart to `/api/engagements/:id/milestone-documents`
  (fieldId + file). Server auth + `assertEngagementAccess`, then S3/MinIO under
  prefix `milestone-documents/`.
- Downloads use `/api/milestone-documents/signed-url?path=…` (role-scoped).
- A 404 on upload almost always meant these routes were missing — they must stay
  in sync with `src/lib/milestone-document-storage.ts`.


## Design tokens (cool blue primary)

- **Primary is professional blue** (`--primary` / `--brand` / `--blue-*` ≈ `#2563EB`,
  hover `#1D4ED8`). Buttons, links, focus rings, current-step nodes, progress,
  key CTAs. White label on blue — never navy-on-blue. Do **not** use orange,
  terracotta, peach, or sand as brand or page atmosphere.
- Neutrals: cool slate with a blue undertone (`--background` ≈ `#F8FAFC`, cards
  white, borders `--border` ≈ slate-200). Never beige/cream.
- `--orange-*` / `--gold-*` are **deprecated aliases of `--blue-*`** so leftover
  class names still resolve blue. Prefer `primary` / `blue-*` in new UI.
- Phase washes (journey chips only, ~8–12% chroma): `--phase-pre` sky,
  `--phase-filing` teal, `--phase-post` teal-green, `--phase-fema` indigo,
  `--phase-registration` violet-blue. Helper: `src/lib/phase-colors.ts`.
- Status (chips/icons only, never page fill): teal-green done · muted gold
  waiting · slate lock · rose/red overdue/error.
- Super Admin: tiny `.super-gold-chip` badge only — never a gold CTA theme.
- Shared journey node: `JourneyNode` (blue active pulse, teal check, amber
  clock icon, slate lock). Motion: `.journey-node-pulse`, `.journey-unlock`,
  `.journey-complete`, `.page-fade-up`, `.skeleton-brand`, `.page-atmosphere`
  (faint blue mesh ≤4%).
- Dark mode stays in the same cool blue/slate family — not a brown invert.
- Fonts: Manrope (UI) + Space Grotesk (display via `--font-serif`) + IBM Plex Mono

## Sequential checklist gate

- Steps unlock only after the previous **active catalog** item is terminal-complete
  (`completed` / `not-applicable` / client submit / deliver). Save-draft does not unlock.
- Rejected or unlocked-for-correction steps re-lock everything after them.
- Helper: `src/lib/checklist-step-gate.ts`. Server save path: `patchChecklistItem`.
- Copy: “This opens after {title} is complete.” / “Waiting on the client…” — never “access denied”.
- Overdue badges only on the current (active/waiting) step, never on locked future steps.
- Client **Progress** nav (`/app/client/progress`) was removed; the gated catalog
  now lives as a Create-project-style flowchart on Incorporation. Old `/progress`
  URLs redirect there. Staff progress CC is unrelated to intern overview.

## Intern engagement overview

- No Progress side rail and no equal-weight `internWeightedProgress` %. Overview
  is company name + compact CC (two chips, `+N` popover for the rest),
  InternPhaseStepper (`INTERN_PHASE_STEPPER_ENABLED`: slim nodes + hairline
  connectors, no labels). Overview chrome is intern-only
  (`InternEngagementOverview`): serif H1 + inline CC (no header Surface); four
  phases are one list surface (full width, not a 4-col row) with title-band tick
  equalizers. Each row is
  node + title (+ Pre-incorporation subtitle on A/B) + that phase’s
  InternPhaseTickTrack + chevron. Card / stepper-node click →
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
  Registration panel rows are grouped under intern-only sub-headers (Registrations,
  FEMA, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand) by matching
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
  to project” row — intern nav + the in-page H1 locate the step. Pre-2 “Generate
  draft board resolution” sits in the form-card footer immediately above Save/Next
  (not the H1, not the rail). Pre-7 generate panel renders after the form.
  Intern journey rows: person icon only (neutral = client, blue = project lead),
  kebab → Attachments required (green tick if uploaded + quiet filename; empty
  circle if not; “None” when the step has no file fields). Intern step rail lists
  **only the current intern phase** (Part A on Client Details — never Part A +
  Part B).   Intern step workspace is one composition: H1 above a single form
  surface (scrollable section tabs, fields, attached Save/Next footer). The
  right progress rail is a compact `Surface` card (natural node spacing, not a
  full-viewport slab). Intern step `main` uses normal page scroll like other
  intern pages. Tab-strip chevrons sit in dedicated 36px edge slots, vertically
  centered with labels. Section tabs
  stay one row (`overflow-x`), map vertical wheel to `scrollLeft`, and use
  edge arrows. Intern Client Details (and other intern accordion forms)
  use a single-row underline tab strip; footer Next advances the heading, then
  `internEngagementStepPath` in the same phase, then the engagement page
  (label Done). The shell chrome has
  no page title or breadcrumbs. Intern never shows playbook SLA / “working days”
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
  edge. No floating inset. Logo in the sidebar header; **“VCFO Suite”** stays
  visible when collapsed by moving into the top bar (icons-only rail is too
  narrow for the wordmark). Hover-peek expands the collapsed rail over content
  (200ms leave delay). Footer: **Keep open** / **Keep closed** (mutually
  exclusive; default is auto/hover). Re-expand via the slim-rail Keep open
  pin. `sidebarCollapsed` is derived (`mode !== 'open'`). Do **not** call
  `setSidebarCollapsed(true)` on intern project open — that used to rewrite
  Keep open (`open`) to Auto. Intern Clients list expand is visual only
  (`shellDesktopNavExpanded` in `intern-sidebar.ts`): auto + `/app/intern/clients`
  takes rail width; auto + `/app/intern/engagements/…` stays collapsed for
  workspace width; Keep open/closed are never mutated by the route.
  Nav scrollers use
  `.sidebar-scroll` (no visible bar). Search is a tool button, not a fake input.
  CommandPalette is the only type-in search. No page titles/breadcrumbs in
  the top bar. Nested AppShell routes get a compact **Back** chevron in the
  top bar (left of Search) — `shell-back.ts` / `TopBar`. Hide on sidebar
  primary exact paths (Today, Clients list, Compliance root, …); **show** on
  settings, engagement/project/step, board-resolution. Do not add a second
  “Back to portfolio” on intern engagement. Click is `router.back()` when
  `history.length > 1`, else the parent path.
- Checklist file upload is a compact `.milestone-upload-zone` row (~44px, max 88px),
  not a tall centered dropzone. Remarks use `.milestone-form-textarea` (`min-h` 72px /
  3 rows, grows with `field-sizing: content`).
- Checklist fields pair on desktop: `.milestone-form-grid` is 2 columns from `md`.
  Short = text/date/select (phones, emails, yes/no). Full (`grid-column: 1 / -1`) =
  textarea, file, address text, or helper copy longer than ~120 chars. Odd leftover
  shorts stay in one cell (~50%), not stretched. Phone stacks to one column.
  Infer via `getMilestoneFormFieldLayout`; optional `ChecklistField.layout` override.

## Intern Today week queue

- Week queue on `/app/intern/today` is grouped **by company** (A–Z), one InternPhaseCard-style
  card per engagement. Rows match the intern checklist: number, title, StatusPill (dot +
  Completed / In progress), chevron → `internEngagementStepPath`.
- Unlocked work stays visible: **completed + in-progress + awaiting-client**. Locked future
  steps are omitted. Helpers: `internWeekQueueItems` / `groupInternWeekQueueByCompany`.
- Intern **Tasks** (`/app/intern/tasks`) was removed; that URL redirects to Today. Manager/admin
  task UIs are unchanged.

## Intern / lead motion

- Sidebar active item uses Framer `layoutId` (`sidebar-*-active` / `-rail`) with `springSnappy`.
  Client **sub-rows** use a nested pair (`*-client-active` / `*-client-rail`) so the pill slides
  between companies and View all without stealing the parent Clients highlight.
- Lead dashboard motion lives in intern-only surfaces (Today, Clients, Requests, InternClientsNav,
  InternPhaseTabs, InternPhaseStepper, intern journey rail via `allowLockedOpen`). Shared
  Analytics / Compliance / Mail / Audit keep their existing PageTransition only.
- Reuse `src/lib/motion.ts` presets and `MotionActivePill`. Always respect `useReducedMotion`.
  Prefer `m` (LazyMotion) over `motion`.
- `LazyMotion` in `app/providers.tsx` must use `domMax`, not `domAnimation`.
  `m` + `layoutId` is a silent no-op without the layout feature — the sidebar pill
  never slides. `domAnimation` covers fade / stagger / hover / tap only.
- Never put CSS `transform` / `transition-transform` / `active:scale` / Framer
  `whileTap` scale on a node that hosts or wraps a `layoutId` pill. Projection
  uses transform; a competing transform kills the shared-element spring. Press
  feedback on those hosts: color / opacity only. Nested client-row stagger must
  stay opacity-only for the same reason (`y` on the row ancestor isolates pills).

## Intern typecheck seams

- Intern step/overview UI is split across many files. If `tsc` reports missing
  modules (`checklist-step-attachments`, `InternStepDoneMark`,
  `InternSectionHeadingNav`) or extra props (`sectionTabs`, `extraFooterActions`,
  `hideStatus`, `sidebarMode`), the consumers landed without the helpers.
  Restore the helper, then add the props to the source type — do not delete the
  call sites. `resendManagerEmail` is a `ChecklistItemPatch` extra, not persisted
  `ChecklistItemState`.

