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
  then intern `reports_to_manager_id` if those are empty. Intern **Request
  manager approval**, **Email manager again**, and **Submit** set
  `reviewSource=lead_manager_request` and email **managers only** from the
  lead’s Outlook when connected, else Resend. Intern **autosave** only patches
  `{ responses }` and must **not** repeat that email. Re-requesting after
  accept (Request / Submit) reopens review and emails again; manager Accept then
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
- Intern deliver / Update client portal: no in-page “Delivered to client”
  card (that was `peakEndMoment === 'deliver'`). Success is a green toast with
  stable id `delivered-to-client:{scope}:{item}` plus a Received bell row via
  `notifyEngagementEvent({ event: 'delivered' })`. First deliver still opens
  Graph compose; re-deliver is `inAppOnly` so it does not reopen compose or
  email. Autosave never sends `deliveredToClientAt` and must not fan out.

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
  KB write/delete, welcome email). Reserve `requireAdmin()`
  for create/list managers APIs.
- Audit log is Path A in `listAuditEvents`, not original intern-none RLS.
  Intern (Project Lead): own actor rows always, plus events on assigned
  engagements (`intern_id` + `engagement_leads`). Manager: only those
  engagement ids (`manager_id` + `engagement_managers` + legacy) — not own
  actor on someone else’s client, not unscoped admin noise. Admin /
  super_admin stay firm-wide. Interns read `GET /api/audit-logs`
  (`requireAuth`); `/api/admin/audit-logs` stays admin/manager.
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
- Product/UX briefing for a *different* Claude (features + visual redesign, not
  implementation): `docs/claude-briefing/`. Start with `CLAUDE-CONTEXT.md`.
  `docs/context/UX-AUDIT.md` (2026-08-11) still says Graphite Violet; live brand is
  cool professional blue — trust `globals.css` and the briefing pack.

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
- Status (chips/icons only, never page fill): teal-green done · coral waiting ·
  slate lock · rose/red overdue/error. Never khaki, ochre, or brown — waiting
  used to be muted gold and read as brown; it is now coral. Categorical
  `--accent-amber` is lemon, `--accent-orange` is tangerine (high chroma).
- Super Admin: tiny `.super-gold-chip` badge only — never a gold CTA theme.
- Shared journey node: `JourneyNode` (blue active pulse, teal check, coral
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
  (`public/sbc-logo.png`) in a white chip — compact mark below `sm`. Hover-peek expands the collapsed rail over content
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
- Quiet IST clock stays in the hero. Today's todos (`vcfo.intern.focus.{userId}`) mix
  pinned work `{ id, done }` and typed rows `{ id, done, custom: true, title }` — no
  3-item cap; `parseInternFocus` keeps legacy pins. Action queue expanded companies
  persist as `vcfo.intern.queue.expanded.{userId}` (engagement id set; not accordion).
- Intern **Requests** page is gone. `/app/intern/requests` redirects to My work.
  Pending document requests still show on Today / My work (`waiting-request`);
  client Inbox/Documents and staff project Documents still use the data layer.

## Announcements (not notifications)

- Announcements are firm-wide news (Finance Act, circulars, process notes). The
  bell is still per-user work alerts (`notifications`).
- Super Admin, Admin, and Project Manager can post. The author's name is stored
  on the row. Project leads and clients can read the same board; they cannot compose.
- Routes: `/app/{role}/announcements`. Navbar megaphone (unread via
  `vcfo.announcements.read.{userId}`) is the in-app list; client inbox still has a
  compact list. Kind + `author_role` on the row (migration 0010).
- Live popup: new posts (compose or RSS ingest) appear for every signed-in role
  within a few seconds (`useAnnouncements` refetches every 4s). The card genies
  into `[data-announcements-bell]` (~1s, Framer `m` + FLIP rects). Reduce-motion
  / appearance `motion === 'none'` skips the genie and just hides. Genie does
  **not** mark read. Already-shown ids live in `vcfo.announcements.popup.{userId}`.
  First visit seeds history and may queue today’s unseen (cap 3). Authors skip
  their own posts. Queue is one-at-a-time. Clicking a megaphone-dropdown row or
  Latest row always reopens the same card (`requestAnnouncementPopup` /
  `vcfo-announcements-show`) even if the id is already in the popup set; close
  still genies to the megaphone. Close the live card with X, backdrop, or Esc
  (no Got it button; no “parks on the megaphone” / queue footer copy). Row click
  still marks read.
- Official RSS/Atom: staff paste a **feed URL** (not a homepage) from an allowlisted
  host (`src/lib/announcements.ts` `OFFICIAL_FEED_HOSTS`). Inngest `announcement-feeds`
  runs once at 06:00 Asia/Kolkata. We do **not** scrape HTML listing or login pages
  (MCA/GST/EPFO portals, Income Tax “What's New”). If a department has no RSS, open
  the circular from the portals directory or post by hand. Tracking junk
  (`utm_source=chatgpt.com`, gclid) is stripped from URLs.
- Portals catalog: `src/lib/announcement-portals.ts`, rendered on the Announcements
  page. LEI renewal uses `ccilindia-lei.co.in` (official LOU), not the ads agent at
  legalentityidentifier.in. The old once-per-IST-day dialog
  (`vcfo.announcements.daily.{userId}.{ymd}`) is only a skip-list on first popup
  init so those users are not replayed.
- Apply schema: `npm run db:migrate` (0009_announcements, 0010_announcement_kind).
- Megaphone dropdown filters All / Important / General. There is no `important`
  kind: Important = `deadline` + `compliance`; General = `general`; All = every
  kind. Unread uses a 3px left primary bar (`.unread-edge`) plus a name-dot;
  same bar replaces the notifications unread dot. Writer CTA goes to
  `/app/{role}/announcements?compose=1`. Storage is still
  `vcfo.announcements.read.{userId}`. Genie target: `[data-announcements-bell]`.

## Intern / lead motion

- Sidebar active item uses Framer `layoutId` (`sidebar-*-active` / `-rail`) with `springSnappy`.
  Client **sub-rows** use a nested pair (`*-client-active` / `*-client-rail`) so the pill slides
  between companies and View all without stealing the parent Clients highlight.
- Lead dashboard motion lives in intern-only surfaces (Today, My work, Clients, InternClientsNav,
  InternPhaseTabs, intern journey rail via `allowLockedOpen`). Shared
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

## Send email compose (To filters + templates)

- Staff page: `/app/{intern|manager|admin}/mail`. To is one compact row:
  chips + name search, with **Team** (reports-to manager) and **Client**
  (engagement company) selects beside the field. Picking a **Client** writes
  that company’s client `profiles.email` into the To field as a visible
  address chip (not a name-only pill). Directory also resolves clients via
  `engagements.client_id` → `profiles.client_id` when `client_user_id` is
  empty. Changing or clearing Client swaps only those auto-added chips.
- Templates reuse `email_templates` (firm-scoped). New column `branding`
  (`sbc` | `plain`) via `0008_email_template_branding.sql`. CRUD:
  `/api/email-templates`. Interns edit/delete **own** rows; admin/manager any.
- Send path: `POST /api/outlook/send` with `templateId` / `branding`. If
  `templateId` is set, branding is loaded from the DB (not trusted from the
  client). `sbc` wraps HTML with `renderEmailDocument({ brand: 'sbc' })`
  (`src/lib/email/compose-branding.ts`). Process-email compose that already
  sends `html` is unchanged. Default untemplated send stays `plain`.
- Directory now returns inactive people too; To defaults to **Active**. Team
  filter uses `profiles.reports_to_manager_id`.

## Intern autosave vs manager-approval email

- Intern draft persist uses the same `POST /checklist` as Save, but only
  `{ responses }`. Do **not** fan out `lead_requested_review` when answers
  change while the step is already awaiting review — that stacked identical
  “manager approval requested” toasts (and emails) on every field debounce.
  Notify only when the PATCH itself includes `reviewSource=lead_manager_request`
  (Request / Submit) or `resendManagerEmail` (Email manager again). Helper:
  `src/lib/email/lead-manager-request-notify.ts`. Email toasts use a stable
  `email-dispatch:…` id so a retry replaces rather than stacks. Undo toast id
  stays `notification-undo` (top-right).

## Notifications live popup

- Inbox-only (the signed-in user’s **received** rows, not firm-wide, not sent
  email). New ids popup one-at-a-time; first visit seeds history so refresh
  does not replay. Storage `vcfo.notifications.popup.{userId}`.
- Poll: notifications query `refetchInterval` 4s (same as announcements).
- Close (X / backdrop / Esc) genies into `[data-notifications-bell-target]`
  via shared `measureGenieDock`. Reduce-motion skips the flight. Landing
  pulses the bell. Auto-popup does **not** mark read. No Got it / parks copy.
- Clicking a received row in the bell panel reopens the card
  (`requestNotificationPopup` / `vcfo-notifications-show`).

## Notifications dismiss / history

- Bell is a **Popover** (click outside or Esc to close). Received row click
  marks read and reopens the live popup. Sent row click expands detail
  **inside the panel**. Unread is `.unread-edge` (left primary bar), not a dot.
- Clear (today / this week / all) **hides from the inbox** via
  `notifications.dismissed_at`. Rows are not deleted. Undo undismisses
  (`dismissed_at = null`). Legacy `action: 'delete'` maps to dismiss.
- **Today** = calendar date in `Asia/Kolkata`. **This week** = Monday 00:00 IST
  through Sunday 23:59 IST (includes today). Clear actions apply to the
  current Received/Sent tab.
- History: `/app/{intern|manager|admin|client|super}/notifications`,
  `GET /api/notifications?history=1`. Apply `0012_notification_dismissed_at`.
- Toast id `notification-undo` (top-right, 7s). Row exit animation 300ms.

## Notifications delete / undo (superseded)

- Hard-delete + re-insert restore was replaced by `dismissed_at`. See
  “Notifications dismiss / history” above.

## Shell sidebar skin vs `fixed`

- `.shell-sidebar-skin` must **not** set `position`. Unlayered `globals.css`
  overrides Tailwind `fixed` on the desktop `aside` (and the mobile sheet),
  so the rail re-enters flow: icons in a horizontal row at the top-left and
  the page drops below a full-height gap. `::before` overlay still works —
  `fixed`/`relative` on the host is already a containing block. Settings
  preview keeps Tailwind `relative` on the sample tile.

## Profile avatars

- `profiles.avatar_object_key` (migration `0011_profile_avatar`) stores the S3
  key `avatars/{userId}/photo`. Run `npm run db:migrate` after pull. Bytes go
  through MinIO/S3 like other uploads; the client only loads
  `/api/account/avatar` (own photo, Auth.js cookie). Outlook copy is
  `POST /api/account/avatar/outlook` using the existing Graph token
  (`User.Read` already on `OUTLOOK_SCOPES`) — not an Auth.js login. Upload
  overwrites Outlook and vice versa; last write wins.

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
  then checklist step / category. Search matches client name or file name.
  Milestone downloads stay on `/api/milestone-documents/signed-url`. Indexed
  `documents` rows use `GET /api/documents` (AuthContext-scoped, no
  `engagementId`) and `/api/documents/:id/signed-url`. Intern isolation is
  Path A in `listDocuments` / `getDocumentById` (assigned + membership only).
  No extra migration.

## Shell location trail + attached search

- Top bar trail is a full path from `shellBreadcrumb` (`shell-crumbs.ts`):
  **Home › …** then every real nested segment. Intern engagement step example:
  `Home › Clients › DemoCo › SPICe+ Part B › Director KYC`. Phase labels come
  from `internOverviewPhaseForItem` / intern overview titles (`SPICe+ Part A/B`,
  Post-incorporation, Registration) — Director KYC is Part B in the catalog.
  Intern Registration also inserts the rail sub-header (General, FEMA, …).
- Home links to the role home (`/app/intern/today`, staff dashboard, client
  Inbox). Every non-leaf crumb is a `Link`. Phase → first catalog step of that
  part (`…/step/{slug}`); company → engagement/project page; Docs → Vault;
  Updates → Announcements. The leaf is `aria-current` (not a link). Separator
  is `›` (ChevronRight), never ASCII `->`.
- Page H1 stays the leaf. `PageBackButton` sits beside the H1 on every AppShell
  page except the true home (Today / dashboards / client Inbox).
- Search sits to the right of crumbs and shrinks (`max-w-xs`) so long trails
  can grow; crumbs scroll horizontally inside the fixed-height top bar rather
  than middle-ellipsis. Cmd/Ctrl+K still focuses the TopBar input. Do not mount
  a second `CommandPalette` in AppShell.

## Intern compliance calendar (no page tabs)

- Intern `/app/intern/compliance` is the statutory calendar only — do not put
  “Statutory calendar / Client filing tracker” pill tabs on that page.
- Client filing tracker stays reachable at `/app/intern/compliance/tracker`
  (header “Filing tracker” link, command palette, crumb parent = Compliance
  calendar). Manager/admin still use the in-page tabs.
- Category chips: “Select all” is first and on by default (empty `mutedActs`).
  No “Clear all”. Date cells use a category tint plus a left color stripe
  (stacked when a day has multiple acts) — not dots under the number.
  Act colours are `--stat-*` in `ACT_SWATCH` (hues ≥45° apart). Do not reuse
  IconChip emerald/teal or rose/pink — those merge on stacked stripes. Multi-act
  days skip the wash and separate stripes with a 1px gap. Clicking a dated cell
  smooth-scrolls `#statutory-agenda-YYYY-MM-DD`.

## Unified sidebar disclosure row

- Clients, Docs, Updates (and any `SidebarNavGroup`) share `SidebarNavDisclosure`
  in `SidebarNavGroup.tsx`. Intern Clients is not a second trigger style.
- Chevron is Lucide `ChevronDown` (stroke, `fill-none`) in
  `.sidebar-nav-disclosure-meta` (`margin-left: auto`). Count badge sits
  immediately before the chevron; My work uses the same badge chip without a
  chevron. Active pill/rail only when that section’s route is current — open
  but inactive groups do not get a rectangular box. Child indent is
  `SidebarNavGroupRail`. Do not set `position` on `.shell-sidebar-skin`.

## Intern Today Waiting On overlap

- Waiting On lives in `LeadSideRail` (318px column). A shrink-0 “Email manager
  again” CTA left ~80px for the left stack; the `shrink-0` kind chip then
  overflowed (visible) into the age pill. Use `InternWorkDenseLayout`: status
  + age wrap as siblings; CTA is `flex: 1 0 100%` so it cannot share pixels
  with those badges. Same row is used for action-queue tasks and My work
  list below `xl`.

## App copy — no instructional chrome

- Do not add helper lines that restate a control (e.g. Sign out: “End this
  session on this device”). PageHeader `subtitle` is for live counts/dates/
  company names, not a second sentence of the H1. Empty states: title only,
  or one short line. Keep `aria-label` / `sr-only`. Do not set `position` on
  `.shell-sidebar-skin`.


