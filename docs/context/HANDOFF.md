# HANDOFF — where the work stands (read after STATE.md)

Last updated: 2026-10-14. Written so a fresh session (any account, any tool)
can pick up without the old chat history.

## The owner and how they work

- Owner: Prithish (SBC / VCFO Suite). Tests on **localhost only**, logged in as
  the Routeware client (`prithish@sbcllp.in`), and sends screenshots of what
  to change. Messages are short; read the screenshot carefully.
- **Do not commit or push unless asked.** Everything below is uncommitted.
- **Do not start a second `next dev`.** The owner runs `npm run dev` on :3000.
- Goal for the client portal: a professional, institutional CA/finance
  product a client understands at a glance. Tight margins, no empty space,
  colour only where it identifies something, every button works.
- Feedback already given (do not regress):
  - no dropdowns for phase steps — they open in place, on screen;
  - every opened view names where it goes back to ("Back to home", "Back to phases");
  - status colours: completed green, your turn blue (primary), with the team amber, upcoming grey;
  - no content expanding beside a narrow column, no `overflow-hidden` clipping;
  - `--ink` is a SURFACE token — never `text-ink` for text; use `text-foreground` / `text-muted-foreground`;
  - dark mode must stay readable (`.dark [data-role="client"]` overrides the pinned light surface);
  - floating buttons must not cover dashboard content.
- Keep as-is unless asked: compliance calendar page, `ClientTimeline`, the
  VCFO-by-SBC logo, Ask VCFO behaviour (bot face deferred). Do not copy the
  packed HTML prototype's look.

## Functional reference: the v7 prototype (owner, 2026-10-14)

`C:\Users\Prithish Sai Reddy\Downloads\vcfo-client-portal-prototype-v7-preview.html`
(11 MB, one file). Use it for **what each screen lets the client do**, not
for its look. The screens are JSON inside `<script type="application/json"
id="pf">` → `.text["s/home/v7c_*.dc.html"]` etc.; `routes.js` in the same map
lists every screen. Each component's behaviour and sample data sit in its
`<script type="text/x-dc">` block. Home = greeting (+ Report), Needs from you
(Upload / Fill / Correct / Sign tabs), Who holds it now (You / SBC / MCA),
Important alerts (15 / 30 days, Fix), What SBC is doing, Timeline, Steps by
phase; sidebar team rows carry WhatsApp / Call / Email / Teams; nav shows
counts (Updates 3, Incorporation 6/14, Documents 6).

## Local environment gotchas

- **Docker Desktop must be running** before `npm run dev`. If it is not,
  Postgres is down and login fails with "We couldn't sign you in" — the server
  log shows `ECONNREFUSED`. Fix: start Docker Desktop, `npm run infra:up`.
- PowerShell: no `&&`. Tests: `npx vitest run <files>`; typecheck `npx tsc --noEmit -p .`.
- Last gate (2026-10-14, after WhatsApp parity): typecheck 0 errors; full
  `npx vitest run --testTimeout=60000` 172 files / 1563 tests green (docx /
  zip / Ask-publish tests exceed the 5 s default while `next dev` runs);
  `npm run lint` 5 errors, all in the untracked `ClientTimeline.tsx` /
  `src/lib/client-timeline.ts` (another session's work, not touched).
- **Gate re-run 2026-10-14 (continuation session): all three green.**
  typecheck 0; full `npx vitest run --testTimeout=60000` 171 files /
  1560 tests; `npm run lint` **0 errors** / 171 warnings. Those 5 lint errors
  are fixed: the "Request a timeline change" dialog's backdrop is now a real
  `<button aria-label="Close">` (click-outside stays keyboard-reachable, and
  the inner panel no longer needs `stopPropagation`), Escape closes the
  dialog, and one `let from` in `client-timeline.ts` became `const`.

## Session 2026-10-26 — Ask VCFO DIN lookup, step 1 (branch `ask-vcfo-rag`, uncommitted)

Owner: typing a DIN in the chat should return the director's **live** details
(not stored data), like Surepass / Karza / Signzy / Zoop do.

- **Road**: staff shells only. `pipeline.ts` step 3a, after the rate limit and
  before the guard: `findDinInMessage` → `getDinProvider().lookup` →
  `directorLookupAnswer` (deterministic, keyFacts visual, source + IST fetch
  time as the citation). **No model call**: rule 9 (DPDP) forbids sending a
  DIN or director name to the model. `withoutDirectorLookups` drops DIN turns
  from the history later model calls receive.
- **Providers** (`src/lib/director-lookup/`): `off` (default — reply points
  to MCA → Master Data → View Director Master Data) and `mock` (DINs 99999901
  active, 99999902 deactivated for KYC; never in production). No paid vendor
  yet: owner to choose. Why MCA itself is not a source:
  `docs/context/notes/director-lookup.md`.
- Tests: `director-lookup.test.ts` (11) + 2 pipeline tests. Ask suite 26 files
  / 203 green; tsc 0; eslint 0 on touched files.
- **Next**: pick a vendor and get a trial key → one provider that maps its JSON;
  a DB cache (one paid call per DIN per day); audit row per lookup.

## Session 2026-10-26 — "no updates for two days": the timer was never running

Owner asked whether the sites were quiet or the tool broken. Evidence: every
row's `created_at` matched a manual "Check now" run; no Inngest dev server on
:8288; the dev log had no cron runs. Started `npm run inngest:dev` (background)
and registered the app; documented in `notes/ask-feeds.md` and in the job's
comment. A manual check on 26 Oct (a Sunday after a weekend) found 1 new DGFT
trade notice and the next 10 of the Telangana backlog; every other portal listed
only items already held. Also confirmed to the owner, from the database, which
website each stored update came from (CBIC, incometax.gov.in, e-Gazette and RBI
are the four that are not literally on the PDF; owner to decide).

## Session 2026-10-24 — the portal list, one road for every update (branch `ask-vcfo-rag`)

Owner: resume the portals in the PDF's order; every update must reach the
manager first; the Announcements page's portal links need a few changes.

- **PDF order and state** (text extracted from the owner's PDF, scratch
  `owner-pdf/portals.pdf`): Income Tax ✓ (e-filing news), MCA ✓ (new today,
  below), GST ✓ (portal news + CBIC), PF ✓, ESIC ✓, Professional Tax ✓
  (Telangana announcements), IEC/DGFT ✓. RBI FEMA stays as an extra.
- **MCA via the Gazette of India.** `mca-egazette.ts`: e-Gazette "Search by
  Ministry" click-through in headless Chrome (`withBrowserPage` added to
  `browser-fetch.ts`), results table → items, PDF by gazette id (plain
  download, text layer present). October 2026 held two gazettes, both the
  ministry's own staff matters, which the filter drops — so the first live
  run says "listed 0". The server log line gives the raw count.
- **One road only.** The Announcements page's "Official RSS feeds" box (staff
  could pull any allow-listed RSS straight onto the board, no review) is
  gone, and the 6 am `announcement-feeds` cron is no longer registered in
  `app/api/inngest/route.ts`. The API routes under `/api/announcements/sources`
  still exist but nothing calls them. In its place `WatchedSourcesPanel`
  lists the watched portals with a link to the role's review queue
  (`GET /api/ask/admin/feeds` now also answers managers).
- **Official portals directory** (`announcement-portals.ts`): "Circular"
  links now point at the pages on the owner's list — GST law list on the GST
  portal (was a CBIC Hindi page), MCA ebooks notifications, Income Tax
  notifications page, EPFO home and ESIC circulars (were empty), Telangana
  portal home (was the 2021 PT GO page), DGFT Regulatory Updates hub.
- Tests: `feeds-mca-egazette.test.ts`; `announcements.test.ts` PF row
  expectation updated.
- Seen while testing: the owner (as the real manager) is approving items —
  the board already shows approved DGFT / RBI / CBIC updates.

## Session 2026-10-23 (late) — the owner's portals, read from the portals themselves

Owner: the GST row's "Open source" went to taxinformation.cbic.gov.in, but the
PDF lists services.gst.gov.in; "check those and from respective portals only
I want those updates". Findings and what was built (details and the per-portal
table in `docs/context/notes/ask-feeds.md`):

- **GST portal.** The listed page (…/gstlaw/gstlawlist) is a page of links
  whose own text sends you to CBIC for notifications — CBIC stays, relabelled
  to say so. The portal's own "News and Updates" (advisories: GSTR-9/9C
  enabled, e-invoicing for RCM, Council FAQs, multistate registration…) is now
  read too: `gst-portal.ts`. The host serves an F5 anti-robot challenge to
  programs; `browser-fetch.ts` drives headless Chrome (Playwright) and
  returns the page's own JSON call. Local: installed Chrome. Production: the
  alpine image has no browser — `ASK_FEEDS_BROWSER` + `apk add chromium`
  (documented); until then that one watcher reports "needs a browser".
  `playwright` added to `serverExternalPackages`.
- **Income Tax.** incometaxindia.gov.in refuses programs *and* headless
  Chrome. The department's e-filing portal (incometax.gov.in … latest-news)
  lists the same CBDT notifications/circulars with PDFs on the same host:
  `income-tax.ts`. Live: 7 items (Notifications 133, 134, 121, 120, 114 of
  2026, Circular 07/2026 due-date extension, Notification 3 of 2026).
- **Telangana Commercial Taxes.** Announcements list has PDFs but no dates:
  `tgct.ts` dates an item the day it is first seen and says so in the title;
  tenders/vacancies skipped. Live: 10 (jurisdiction reorganisation GOs,
  TGST rule amendments). Profession Tax GO page: nothing since 2021.
- **DGFT.** The listed "Regulatory Updates" hub links four tables; trade
  notices added (same table shape). Live: 10 trade notices.
- **MCA** still refuses everything (manual drop; e-Gazette by id works, its
  listing needs a session).
- Poll endpoint accepts `{ feedIds }` to check chosen sources.
- `FeedAct` gained 'Professional Tax' (also mapped in
  `src/lib/regulatory/notify.ts` — tsc enforces both).
- Tests: `feeds-owner-portals.test.ts` (GST portal JSON, Income Tax rows,
  Telangana list). Scratch: `owner-portals-e2e.mjs <feedIds…>` runs chosen
  watchers as the demo admin.
- The queue now holds ~62 pending real updates for the manager.

## Session 2026-10-23 (night) — Ask VCFO opened to managers (branch `ask-vcfo-rag`)

Owner: "I need that chatbot in Pranay's portal also, it is not there." Farhath's
spec had locked managers out on purpose (ASK-VCFO-CONTEXT §0.2: manager → 403).
The owner reversed that; Project Leads stay locked out.

- One list decides everything: `ASK_ROLES` in `src/lib/ask/access.ts` now
  includes `manager`. The launcher mount, `useAskStatus`, `requireAsk` on
  every `/api/ask/*` route, the pipeline and the conversation store all read it.
- A manager uses the **staff shell** (`defaultShellForRole('manager') === 'admin'`,
  `shellAllowedForRole` allows only `admin`). Scope is **not** firm-wide: the
  staff tools load through `listEngagements(ctx)` / `listChecklistIndex(ctx)` /
  `getFilings(ctx)`, and the repositories limit a manager to their own
  projects. Checked in Chrome as the demo manager (4 of the firm's 12
  projects): both answers named only that manager's companies.
- Panel header says "Your projects · read only" for a manager (`AskPanel.tsx`
  reads the role from `useApp`); admins keep "Firm-wide · read only". The
  `getFirmPulse` tool description no longer promises firm-wide counts.
- Doors kept shut: client Library routes now use their own
  `LIBRARY_ROLES` (client / admin / super) instead of `canUseAsk`; the
  topics route's project preview refuses manager as well as admin; the
  `/api/ask/admin/*` routes already required `isFirmWideAdmin`.
- Tests: `access.test.ts` (new); `pipeline`, `route-guard`, `ask-panel`
  tests now reject only `intern`. Spec table §0.2 updated.
- Pranay (`pranay.k@sbcllp.in`, manager, 2 projects) sees the "Ask VCFO"
  button bottom-right of every manager page after a reload. Dismiss the
  announcement popup first; it sits above the button.
- Not changed: the firm-pulse definition of "active" (the dashboard said
  4 active projects, the answer said 3, because one is in the Compliance
  stage). Pre-existing staff logic, not touched.

## Session 2026-10-23 (evening) — the owner's portal list: EPFO, ESIC, DGFT watchers

- **Owner's PDF of portals** (Income Tax, MCA, GST, PF, ESIC, Professional Tax, IEC/DGFT), each
  probed from this machine. Added watchers (`src/lib/ask/feeds/`): **epfo** (WordPress notices
  RSS `?post_type=notices&feed=rss2`; the old Circulars archive page stopped in 2025; PDF taken
  from `content:encoded`, preferring the link named "circular"; tenders / empanelments /
  postings dropped), **esic** (`/circulars` HTML table: branch · dated · subject PDFs · publish
  date · console serial = id; internal postings dropped), **dgft** (`?opt=notification`,
  `public-notice`, `circular` tables: number · year · description · date · PDF on
  content.dgft.gov.in; nothing filtered). Shared helpers: `feeds/html.ts` (rows, cells, anchors,
  dd-mm-yyyy), `feeds/govt-fetch.ts` (page / PDF reads with browser-like headers).
- **RBI**: items with no feed text (PDF-only notices such as the FEMA compounding delegation)
  now read the notice page and take the `rbidocs.rbi.org.in/rdocs/notification/PDFs/*.PDF`.
- **Backlog horizon**: `MAX_AGE_DAYS = 60` in `poll.ts` — a watcher's archive (DGFT lists 400+
  items, EPFO 1,900) must not flood the review queue; only items published in the last 60 days
  are ever taken, 10 per source per run.
- **Still manual**: Income Tax and MCA (403 to any program; the e-Gazette lists their
  notifications and `https://egazette.gov.in/WriteReadData/<year>/<id>.pdf` serves the PDF by
  gazette id, but its listing needs an ASP.NET session — a possible next step), the GST portal
  news page (anti-robot), Telangana Commercial Taxes (PDFs without a dated list).
- **Live run 2026-10-23**: EPFO 2, ESIC 1, DGFT 10, RBI 1 new items read and queued with review
  PDFs (emails off). Manager page shows Approve / Reject only for `ready` rows.
- Real accounts for the owner's testing (local DB): manager `pranay.k@sbcllp.in`, admin
  `krishna@sbcllp.in`, super admin `abdulfarhath@sbcllp.in`, client `prithish@sbcllp.in`.

## Session 2026-10-23 (later) — manager review gate for official updates (branch `ask-vcfo-rag`)

- **Branches**: portal work committed on `client-dashboard-v7` (`e5306e0`); all chatbot work lives
  on **`ask-vcfo-rag`** (`bc419c1` + this session). Nothing pushed. Owner's plan: finish the
  chatbot here, then PR into `abdulfarhath7/vcfo_suite` main (Farhath merges and deploys).
- **Owner decisions (2026-10-23)**: approver = anyone with the Manager role (admins/super admins
  may look, not decide); clients are notified on approval; watchers run every 30 minutes.
- **Flow**: watcher finds item → saved `review_status='pending'` (migration **0028**: review_status,
  reviewed_by/at, review_note, review_pdf_key) → ingestion reads it, writes the summary, renders a
  **review PDF** (`src/lib/ask/feeds/review-pdf*.ts(x)`: facts, "amends", effective-from, reading
  check, opening text) to S3 next to the source, bells + emails the managers
  (`src/lib/regulatory/notify.ts`) → manager page **`/app/manager/regulatory-updates`** (admin
  copy at `/app/admin/...`; view `src/views/manager/RegulatoryUpdates.tsx`; API
  `/api/regulatory-updates`) → **Approve** sets approved + audience both, posts an Announcement
  (`systemCreateOfficialUpdateAnnouncement`, externalId `ask-document:<id>`), bells everyone,
  emails clients; **Reject** needs a reason and keeps it hidden.
- **Gate in the repository**: every reader query (`searchAskChunks`, `askSourceCoverage`,
  `listRecentOfficialUpdates`) ANDs `approvedForReading()` = upload OR approved. Proven live:
  before approval the client got "can't see any recent GST updates"; after, the beverage-rate
  answer with citation; a still-pending circular was not used even by an admin.
- **Email kill switch**: `REGULATORY_NOTICE_EMAILS=off` (set in the owner's `.env.local` for
  testing — the local DB holds real addresses: `pranay.k@sbcllp.in` is a real manager, and
  `prithish@`, `gautham@`, `abdulfarhathmohd@` are real clients). Bells and announcements still
  fire; emails log "email skipped". **No email was sent in testing.** Set it to `on` (or remove)
  before real use. `ASK_VCFO_FEEDS_AUTO_PUBLISH` was removed — approval is the publish.
- **Rule kept**: `staff.test.ts` forbids any file under `src/lib/ask` from naming an email
  sender, so the notifier lives in `src/lib/regulatory/`, not under ask.
- **Notification kinds** added: `regulatory.review`, `regulatory.approved` (label map updated).
- **Dev server gotchas today**: Turbopack dropped `app/api/ask/admin/documents/[id]` from its
  route table after a restart (HTML 404 with app-code time) — `touch` the file to re-register.
  Earlier: PostCSS worker hang with a 4.3 GB `.next`; clear `.next` and kill leftover node workers.
- **Not automatable (probed 2026-10-23)**: incometaxindia.gov.in and mca.gov.in answer 403 to
  any program; GST portal news needs a browser. EPFO, ESIC, TGCT (Telangana PT) and DGFT pages
  load — watchers for those are the next phase (about a day each).
- Gate: typecheck 0, lint 0 errors on touched files, Ask tests 22 files green.

## Session 2026-10-23 — Ask VCFO watches official GST / RBI updates (uncommitted)

- **What it does**: every morning at 6:30 IST (Inngest `ask-feeds`, `src/jobs/ask-feeds.ts`) and on
  Admin → Ask VCFO → Sources → "Check for updates now" (`POST /api/ask/admin/feeds`), each watcher
  in `src/lib/ask/feeds/registry.ts` lists what its government source published; new items
  (by `feed_id` + `external_id`, unique index) are downloaded, saved as `govt` sources, and read by
  the same ingestion as uploads, plus a two-sentence "what changed" (`ingest/summarize.ts`).
- **Watchers**: `cbic-gst` — CBIC tax information portal JSON (`fetchUpdatesByTaxId/1000001`,
  downloads return base64 PDF; internal endpoints found by watching the site, not a published API);
  `rbi-fema` — RBI notifications RSS filtered to FEMA terms. Not automatable (checked 2026-10-22):
  GST portal news (anti-robot page), Income Tax and MCA (403), EPFO (404) → manual PDF drop.
- **CBIC certificate**: CBIC's server omits the Sectigo OV R36 intermediate; Node (and Linux in
  production) rejects it. `feeds/govt-https.ts` ships that public intermediate and adds it to Node's
  roots for these requests only — verification stays on (test checks fingerprint + signature).
- **Review gate**: new updates are `staff` audience (staff answers at once); "Publish to clients"
  (`action: 'publish'`) sets `both`. `ASK_VCFO_FEEDS_AUTO_PUBLISH=true` skips the gate.
- **Answering**: retrieved pieces are labelled "(official update, published YYYY-MM-DD)"; rule:
  newest source wins, name the number and date; new tool `getRecentOfficialUpdates` (both shells,
  audience-scoped); dates written in retrieved sources now pass the date validator; guard scope now
  names GST rates on any goods (beverages, alcohol) and new notifications / circulars.
- **Verified live (Chrome, dev server)**: CBIC 4 + RBI 3 added and read; a second run added 0. As
  client `prithish@sbcllp.in`: before publishing, no updates visible; after publishing
  01/2026-Central Tax (Rate) the beverage-rate question was answered from it (effective 1 May 2026).
  Admin answered the RBI derivatives question from staff-only notices.
- **Note on RBI filter**: the three RBI notices found are Authorised-Dealer derivative rules — FEMA,
  but mostly for banks. They stay staff-only unless published; tighten `FEMA_TERMS` if noisy.
- **Dev server**: on 2026-10-23 the Tailwind/PostCSS worker hung (4.3 GB `.next` cache, stuck
  worker). Fix: stop the server, kill the leftover `next` node workers, delete `.next`, restart.
- **Production to-do**: apply migration 0027 on RDS; Inngest cloud keys must be set for the cron
  (locally `npm run inngest:dev`); App Runner needs outbound internet to the two sites.
- Gate: typecheck 0; 191 of 192 test files green (the 1 is the pre-existing ask-repositories mock
  test); lint 0 errors on Ask code. New tests: `src/lib/ask/__tests__/feeds.test.ts`.

## Session 2026-10-22 — Ask VCFO: PDF drag-and-drop, real PDF reading, answers from uploads (uncommitted)

- **Drop zone** on Admin → Ask VCFO → Sources (`src/views/admin/ask/AskSources.tsx`): drag a
  file in or click to choose; the file is held in state and appended to the form (a dropped
  file cannot be put into a plain file input). Title auto-fills from the file name; a
  window-level guard stops Chrome opening a PDF dropped beside the box. Shared checks in
  `src/lib/ask/source-file.ts`. The list shows "Ready · n pieces read" (`chunkCount` from
  `countAskChunksByDocument`).
- **PDF reading**: new dependency `unpdf` (server-external in `next.config.mjs`) reads the
  PDF text layer in code — any length, no model cost. Only a scan (fewer than 80 letters per
  page) falls back to the old Haiku transcription, which caps at ~32k output tokens. The
  57-page `docs/VCFO-Suite-Knowledge-Transfer.pdf` indexed into 54 pieces in about 2 minutes.
- **Scope**: the guard refused every question about the firm's own material as off-topic, so
  uploads were never searched. Now (a) the guard's scope names the firm's services, fees,
  policies, processes and documents; (b) an `off_topic` verdict is overridden when one ready
  source chunk the asker may read holds at least 60% and at least 2 of the question's terms
  (`askSourceCoverage` + `isCoveredBySources` in `pipeline.ts`; `unsafe` is never overridden);
  (c) Sonnet's rules and client persona say to answer from the firm's sources.
- **Search**: `searchAskChunks` kept the strict all-terms match, then tops up with chunks
  sharing any term, ranked by shared-term count (word lists compared directly, never
  re-parsed, so `inc-20a` cannot break the syntax). The strict match alone returned 0 pieces
  for most real questions (stems: "owns" ≠ "owner").
- Verified on the dev server with Chrome: drop → Ready → client questions answered from the
  PDF with citations (INR 4,750 fee, "Zebra rule", day-150 escalation, App Runner ap-south-1).
  Python / weather / capital-of-France questions are still refused. Known limit: "Who is the
  owner of VCFO Suite?" answers "not certain" because the cover-page piece does not rank into
  the top 8 — the vector-search step in `docs/specs/ask-vcfo/RAG-UPGRADE-GUIDE.md` fixes that.
- Two test sources sit in the local DB ("sbc inc20a note", "VCFO Suite Knowledge Transfer");
  archive them from the Sources page if unwanted. Inngest dev was not running, so indexing ran
  inline (`401 Event key not found` in the log is expected).
- Gate: typecheck 0; 190 of 191 test files green, the 1 failure is the pre-existing
  ask-repositories mock test from origin/main; lint 0 errors on Ask code.

## Session 2026-10-21 — origin/main merged; client-vs-lead split on Part A (uncommitted)

- **Merge** `origin/main` (client portal v7 build, deployed to AWS 2026-10-19) into
  `client-dashboard-v7` = commit `c1bb1dc`. Both sides had a migration `0024`; the local
  WhatsApp send-log migration was regenerated as **`0026_whatsapp_delivery_variables`**
  (idempotent: `ADD COLUMN IF NOT EXISTS`, guarded FK, `CREATE INDEX IF NOT EXISTS`) and
  origin's `0024_client_portal_v7` / `0025_client_portal_v7_pages` were kept. Local DB
  migrated (rows 26–28). On RDS only 0026 is still to apply. Backup branch before the
  merge: `backup/client-dashboard-v7-pre-main-merge-2026-10-21`.
- **Owner's handwritten notes (photo) implemented, all uncommitted:**
  1. **Client-intake steps** (`CLIENT_INTAKE_STEP_IDS` = pre-1, pre-13, pre-14, pre-15,
     pre-16 in `src/lib/pre-inc-direct-flow.ts`): the lead no longer fills the client's
     part. `canRoleEditField('intern', …)` is true only for the NIC fields and the shared
     `boardResolutionDate` (`LEAD_SHARED_FIELD_IDS`). The lead's copy of the step hides the
     client's answers until the client submits (`redactChecklistSliceForViewer`, viewer
     `lead`; `hasClientSubmittedIntake` = `waitingOnLeadAt` / `clientSubmittedAt` / complete).
     Server: PATCH and submit strip what the actor may not write
     (`stripResponsesNotEditableBy`), a lead submit before the client's returns
     `step_waiting_on_client` (409), and a client gap on a lead submit is a field error
     "The client has not filled this yet." Gate for the lead reads "Waiting on the client…"
     (still openable; NIC editable). Form: client fields read-only on the lead's form with
     "The client fills this. It shows here once they submit."; footer Submit replaced by a
     status line until the client submits (and on pre-13..16 always, since the client's
     submit completes those). Step page notice explains the wait. Verified with Chrome
     (Playwright `channel: 'chrome'`) on the dev server: a client draft seeded in the DB
     never reached the lead's page or `GET /checklist`.
  2. **Authorized Signatory tab now holds the KYC uploads** (Passport, Driving Licence,
     Utility Bill) — the separate "Signatory KYC" tab is gone (`part-a-sections.ts`,
     `checklist-responses.ts`).
  3. **Typing bar on long pick lists**: `src/components/ui/searchable-select.tsx`
     (Popover + cmdk, substring filter) is used by the checklist form for any select with
     ≥ 12 options — countries, Indian states, nationalities.
  4. **Parent entity is the client's**: a Pre-Incorporation subsidiary no longer asks the
     manager for parent name/address at Create project (`stageRequiresParentEntity`,
     `createProjectBodySchema`); the client enters it on the Foreign Entity tab and the
     pre-1 submit copies it onto the engagement row (`syncParentEntityFromPre1`, direct
     `db.update` because the actor is the client). Later starting phases still ask.
  5. **Board-resolution date**: the lead can change it (shared field) — the BR editor shows
     "Date of board resolution: … · Change date" linking to the pre-1 Share Capital tab,
     then "Re-generate from Pre-1".
- **Regression found in the merged client portal v7 and fixed**: its step page
  (`src/components/client-portal/pages/incorporation/StepPage.tsx`) rendered every step as
  a read-only record, so a client could not fill Part A at all. A client-owned direct-flow
  step that is open to the client now mounts the shared `MilestoneResponseForm` (tabs,
  Next/Submit, autosave) inside a `.cp-tw` island — the portal's CSS reverts every style
  outside `.cp-tw`, so without that class the form renders unstyled.
- Gate: typecheck 0; full `npx vitest run --testTimeout=60000` 189 files green, **1
  pre-existing failure from origin/main** (`src/db/repositories/ask-repositories.test.ts ›
  client library › lists only the caller's items` — its fake `db` does not model the new
  `client_library_removals` query; fails identically on the untouched merge). Lint: 0 errors
  on changed files.
- Lead-portal prompt for the browser prototype: `docs/specs/lead-pages/LEAD-PORTAL-PROTOTYPE-PROMPT.md`.
- Screenshots of every lead page + the client Part A form are in the session scratchpad
  only (not committed).

## Client portal redesign (Oct 2026, uncommitted)

- **Home** `src/views/client/Overview.tsx` (prototype functions, 2026-10-14):
  one sheet — hero (Report PDF download → `app/api/client/report`, Ask VCFO;
  "Awaiting you" and "Complete" open `ClientStepsDrill`, a dialog of every step
  filterable by status; Documents / Next deadline link out) → **Needs from you**
  (`ClientNeeds`: Upload / Fill / Correct / Sign tabs from `buildNeeds`; due
  date = the manager's step window `to`) → four phase cards → three columns:
  **Who holds it now** (`ClientWhoHolds`: You / VCFO team / MCA via
  `stepHolder`; MCA = pre-5, pre-11, pre-12), **Important alerts**
  (`ClientAlerts` + `src/lib/client-alerts.ts`: dated client steps + unfiled
  filings, 15 / 30 days, overdue always shown; the overview repo now returns
  unfiled filings up to 60 days overdue as `status: 'overdue'`), Recent
  activity. Sign steps (pre-3, pre-8, pre-9) are listed in `SIGN_STEPS`.
  Each card has "Ask VCFO about this" (`AskAboutThis`, hidden when Ask is off).
  `ClientNextAction`, `ClientBallInCourt`, `ClientAhead` were deleted.
  **Look (2026-10-14, owner: "dull, make it active")**: navy gradient hero
  (`.client-hero` in `globals.css`) with an animated `ProgressRing` and four
  hued KPI tiles (`.client-kpi`, hue via `--kpi`); every card title is
  `CardHeading` (icon tile in the card's hue); `CardTabs` are pills, tinted by
  an optional `hue`; Needs rows are coloured by action (upload sky, fill
  primary, correct danger, sign violet); phase cards carry their phase hue
  (`PHASE_HUE` in `ClientPhaseBars`) and a ring; activity is a violet rail.
  Entrance (`.client-rise`) and pulse (`.client-live`) animations are off
  under `prefers-reduced-motion`. Tailwind 3.4: opacity steps of 5 only.
- **"Your step right now"** `src/components/shell/YourStepNotice.tsx`: one-time
  bar (dismiss stored in `sessionStorage['vcfo.your-step']`) on whoever's turn
  it is — client home, lead Today (`src/views/intern/Today.tsx`), manager
  dashboard (`src/views/admin/Dashboard.tsx`, first `isAwaitingReview` item).
- **Sidebar**: for the client, the mini compliance calendar is replaced by
  "Your team" (`SidebarClientTeam` → `ClientTeamCard`): brand-coloured
  WhatsApp (always), Call (only with a profile phone), Email, Teams. WhatsApp
  opens `wa.me/<their number>`, else `wa.me/<NEXT_PUBLIC_SUPPORT_PHONE_E164>`
  with a message naming the person, else `wa.me/?text=…` (WhatsApp's contact
  picker), always with a prefilled message. A "VCFO support" row uses
  `info@vcfosuite.com` and the support phone if set. Nav counts (client only,
  `ClientNavMeta.tsx`): Updates = unread notifications, Incorporation = done/total,
  Documents = open upload steps. Staff sidebars still show the calendar.
- **Incorporation page** `src/views/client/Incorporation.tsx` uses the same
  `ClientPhaseBars` (built from `buildProgress` / `buildMilestones`), with the
  schedule window and "What's this?" slots. The lead's
  `InternPhaseEntryCards` is untouched.
- **Board resolution**: client pre-2 / pre-3 steps show the document on a
  stage with approval actions under it (`src/components/client/ClientStepDocument.tsx`);
  client `/board-resolution` and the lead editor were restyled (paper margins
  in `board-resolution-doc-preview-classes.ts`).
- **Team page** `src/views/client/ClientTeam.tsx`: Your VCFO team, People from
  your company (Replace = the old Substitute), inline "Give someone else access".
- **Library** `src/views/client/ask/ClientLibrary.tsx`: books only
  (`ReferenceShelf`; PDFs not loaded yet — owner will send them).
- **Saved Ask VCFO answers** (owner chose to keep them, 2026-10-14): button is
  "Save answer"; the Ask VCFO panel home lists "Saved answers" (5 newest);
  each opens `/app/client/library/[id]`, whose back link is "Back to home".
- **Filings** `src/views/compliances/FilingsView.tsx` (shared by every role,
  2026-10-14): Back to home, a glance strip (Overdue / Due in 14 days /
  Upcoming / Filed for the whole FY + "Next filing" → calendar date; helper
  `summariseFilings` in `compliance-scope.ts`), `text-ink` → `text-foreground`.
- **Documents** `src/views/client/Documents.tsx` (2026-10-14): Back to home,
  4-box summary, "Still needed from you" first, files on record as aligned rows
  (name · section · date · file) grouped by milestone, answered requests,
  then the board-resolution card.
- **"Your step right now"** `src/components/shell/YourStepNotice.tsx`: a side
  card (bottom-right, above the floating Ask button), not a full-width banner;
  hides itself after 12 s unless hovered / focused; once per step per session.
- **Timeline** (2026-10-14, prototype `tl_editor.js` behaviour): the chart
  (`TimelineChart.tsx`, used by `ClientTimeline` and staff `ProjectTimeline`)
  is laid out in px over `timelineWorld(model)` — whole months, 2 before and 3
  after the phases. Drag / swipe / shift + scroll / ← → to pan; ‹ Today ›
  buttons; − / + / Fit and ctrl + scroll zoom around the cursor; ruler shows
  month labels plus Days / Weeks / Months ticks. Opens on the old fit view.
  The "Request a change" editor still uses the fixed axis.
- **Notification bell** `src/components/shell/NotificationsBell.tsx`: plain bell
  + red count badge, "N new", Today / Yesterday / Earlier groups, footer link
  "Get these on WhatsApp" → Settings.

## WhatsApp (state on 2026-10-14)

- Transport: **AWS End User Messaging only**. The Twilio sandbox (added
  2026-10-12) was removed from `.env.local` and the code on 2026-10-14 (owner).
  Details and guard order in `notes/aws.md`.
- Local `.env.local`: `WHATSAPP_ENABLED=true` but no `EUM_PHONE_NUMBER_ID`, so
  every WhatsApp records `skipped/disabled` (email unaffected). Never commit
  `WHATSAPP_ENABLED=true`.
- Profiles with number + consent: `prithish@sbcllp.in` (client),
  `abdulfarhath@sbcllp.in` (super admin).
- **No message has been attempted yet** (`notification_deliveries` had no
  WhatsApp rows on 2026-10-14).
- Settings has a **Send test message** button → `POST /api/account/whatsapp-test`
  (sends directly, bypasses Inngest, 30 s cooldown, explains skip reasons).
- Real notices go through Inngest: run `npm run inngest:dev` (port 8288)
  alongside `npm run dev`, or they are dropped with `[whatsapp] queue failed`.
- **LCC parity (2026-10-14, committed)**: WhatsApp now mirrors the email
  of every process event — same recipients (`mailHandlersForEvent`, To + CC,
  minus the actor). Seven dedicated templates (`step_awaiting_approval`,
  `phase_approved`, `client_action_needed`, `documents_shared`,
  `staff_client_submitted`, `staff_client_uploaded`, `staff_change_requested`)
  via `src/lib/notify/process-event-whatsapp.ts`; everything else falls back to
  `process_notice`. One send per event/recipient/day (`whatsappDedupeId`).
  Job throttled 20/min, retries thrown inside the step, status only moves
  forward (`delivery-status.ts`). Manager/admin **Send log** on project detail
  (`SendLogPanel`) with Retry → `POST /api/engagements/[id]/notification-deliveries/[deliveryId]/retry`;
  migration 0024 stores `variables` + `retry_of` (applied locally, not on RDS).
  Template bodies to submit on Meta: `notes/whatsapp-templates.md`. Email
  deliveries are not written to `notification_deliveries`, so the Send log's
  Email filter is empty.
- Owner's next steps: the AWS / Meta setup in `notes/aws.md` (register the
  number, set `EUM_PHONE_NUMBER_ID`, approve the 14 templates) → Settings →
  Send test message → run `inngest:dev` → as lead/manager approve or return a
  step → client gets email + WhatsApp. Diagnose with:
  `select status, skip_reason, error_code, created_at from notification_deliveries where channel='whatsapp' order by created_at desc limit 10;`

## Deferred / open

- Library PDFs (owner to send), Ask VCFO bot face.
- Intern Subscriber Details (pre-16) 404 for the lead — not reproducible on
  2026-10-14 (step routes exist, slug `rootware` valid, no 404 in the dev log);
  waiting for the owner to retry and send the URL if it still happens.
