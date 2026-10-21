# Client portal v7 — build report

Built 2026-10-16 on branch `claude/multi-agent-chat-design-rhtbl4`, from
`prototype/vcfo-client-portal-FINAL.html` (readable sources: `prototype/final-src/`).

| Document | What it holds |
|---|---|
| `BUILD-INVENTORY.md` | Every screen, state, pop-up, hover, animation, empty state, before/after variant and breakpoint of the prototype, mapped to route + component + data source, each ticked |
| `inventory/<area>.md` | The full per-area catalogues (verbatim CSS, markup, logic of every board) |
| `BUILD-GUIDE.md` | How the portal is built (CSS pipeline, shell API, data rules) — read before changing it |
| `/QUESTIONS.md` (repo root) | ~120 decisions and assumptions you may want to change, each with "how to change it" |

**Inventory status:** 1,459 rows — **1,361 built and wired to real data**, **80 built with a part waiting on your decision** (each has a QUESTIONS.md row), **18 deliberately not built** (prototype-only scaffolding or superseded boards; reasons in QUESTIONS.md), **0 open**.

## Not verified — please read first

Your rule for this build was: **no tests, no screenshots, no database runs** — you test. So:

- Nothing was opened in a browser. Pixel fidelity, every interaction and every breakpoint are **unverified**.
- No test suite was run. Three existing test files had their expectations updated where the behaviour changed on purpose (`client-overview.test.ts`: PAN masked for clients; `engagement-clients.test.ts`: only the Primary contact invites, and a client may not attach an existing account). No new tests were written.
- Migrations **0024** and **0025** were generated with drizzle-kit but **not applied** to any database.
- The only automated check run was `npx tsc --noEmit` (TypeScript): **0 errors** on the final tree.
- Two read-only reviews were run on the code (security / access control, and runtime bugs); everything they rated high or medium was fixed (see "Reviews" below).

### To try it

```bash
npm install
npm run db:migrate          # applies 0024 + 0025 (21 new tables, additive only)
npm run db:seed && npm run dev
# sign in as client@vcfo.local / client123 → /app/client
```

Set `CREDENTIALS_ENCRYPTION_KEY` (32 bytes, `openssl rand -base64 32`) before real use — the Credentials vault encrypts with it. Optional: `CLIENT_SUPPORT_*` for the Customer support row.

## What was built

### M0 · Shell and shared runtime
- **Client-only chrome** (`src/components/client-portal/`): navy sidebar — full 248 px on desktop, 72 px icon rail with tooltips and fly-outs on tablet, drawer on phone — with the sliding active pill, Updates / Compliances groups, team contact rows (WhatsApp, call, e-mail, Teams deep links) and the account row with sign-out. Sticky top bar with logo, location trail (pages can set a long trail), Search ⌘K, Before/After pill, Announcements (gold dot), Notifications (badge), theme toggle.
- **Ask VCFO**: the owner's animated visor character on its 20.5 s loop gripping the bottom edge, ducking while scrolling / when it would cover a control; the chat window with the one-time peek, mood antenna (green answered / grey can't answer), suggested questions answered from the client's own data, typed questions sent to Ask VCFO when it is switched on, What's this? answer cards, 👍/👎, hand-off to the project lead, first-visit note once per client.
- Navy toast with Undo, rule-14 drill-down pop-up (bottom sheet on phones), rule-17 icon tooltips, shared (i) pop-over and "bot says" bubble, page-enter motion, True-black dark theme.
- **CSS**: every prototype stylesheet copied verbatim into `css-src/` and scoped under `.cp` by `scripts/cp-css.mjs`, so nothing leaks into the staff app; the prototype's own fonts and logos are self-hosted.
- A super admin opening `/app/client/**` keeps the old staff-style shell.

### M1 · Home (`/app/client/overview`)
Before-COI and after-COI layouts (`.vh-b` / `.vh-a` grids at every breakpoint), the phone board under 700 px (skeleton, bottom sheets, upload sheet), every card (greeting, needs, who holds it now, what is next, alerts, what SBC is doing, timeline, steps, recent documents, activity, compliance donut, company IDs with PAN/TAN reveal, compliance by area, registrations, post-incorporation), drill-downs on every visual, the step and compliance pop-ups, and the live timeline editor (React port of `tl-editor.js`) that sends a timeline change request.

### M2 · Incorporation
Landing (Days-to-COI tile with count-up and SPICe+ ring, This week, timeline gantt + Steps accordion, donuts), **NEW** phase page `/app/client/incorporation/phase/[n]`, step page in FINAL's live layout (answers, requested-file drop zones, NOC blocking with scroll-to-upload, "Approve & submit" deferred until its Undo toast closes, request a change, What's this?), board resolution page with DOCX preview. A shared step model (`src/lib/client-portal/step-model.ts`) derives done / waiting / in progress / with SBC / next / upcoming / late from the real checklist without changing the step gate.

### M3 · Compliances
Calendar with FINAL's grid (thin lines, today box with inset navy border + tint), month/year picker, year and timeline views, day pop-over, detail pop-up with focus track, compact donut, Next-deadline card, phone week strip + agenda; Filings with FY / frequency / area / status filters, side panel, ↗ portal links, 📎 Proof chips and "Proof pending", CSV and .ics export, "Remind me" (daily Inngest job).

### M4 · Documents and Library
Documents explorer (phase → step or by category, remembered), replaced files toggle, dashed missing rows, per-step progress drill-downs, ZIP download, upload against open requests with Undo, phone board with sheets and camera capture; Library bookshelf, recently read, reader (saved / learn) with reading progress; the **shared document viewer** used by every page (prev/next, zoom 50–150 %, PDF / image / DOCX, light paper in dark mode).

### M5 · Team, Announcements, Notifications, Audit, Settings
Team (SBC cards with photos, colleagues, Primary-only invite, hand off your seat), Announcements with read state, Notifications with Mark all read + real Undo, client-safe Audit (staff by name and role only, 14-day summary, CSV), Settings (profile, password, WhatsApp with real Undo, notification preferences with the locked e-mail categories, theme).

### M6 · Credentials, PAN/TAN reveal, intro
**NEW** `/app/client/credentials`: the five-sheet vault (Address, Login credentials, Registrations, Directors KYC, Other), secrets encrypted at rest (AES-256-GCM), every Preview / Edit / Reveal needs a 6-digit code **sent to the Project Manager** (3 wrong codes lock 60 s, resend every 30 s, 10-minute access with countdown), inline edits with Undo, values auto-filled from the checklist until edited, access-log drawer. PAN/TAN reveal on Home with the client's own password (60 s). The entry animation, once per client.

### Staff screens added so the portal has real data
- Staff step page: **Request files from the client** (feeds the drop zones and NOC blocking).
- Staff Filings register: **Proof** button — upload/remove proofs, ARN, tax paid, focus-track dates.
- Admin / manager project page: **Client asked for a timeline change** (Approve writes the dates into the schedule) and **What SBC is doing** (work items with % done).

## NEW backend pieces

**21 tables** (migrations `0024_client_portal_v7`, `0025_client_portal_v7_pages`, additive only):
`client_portal_prefs`, `announcement_reads`, `ask_answer_feedback`, `client_need_meta`, `client_work_items`, `client_timeline_requests`, `client_file_requests`, `compliance_instance_proofs`, `compliance_instance_details`, `compliance_reminders`, `document_request_details`, `document_request_files`, `client_library_reads`, `client_library_removals`, `client_invites`, `notification_prefs`, `client_account_meta`, `engagement_credentials`, `credential_otps`, `credential_access_grants`, `identifier_reveal_attempts`.

**Repositories** (Path A, each scoped by `AuthContext`): `client-portal`, `announcement-reads`, `ask-feedback`, `client-home`, `client-incorporation`, `client-compliances`, `client-documents`, `client-library-portal`, `client-team`, `client-audit`, `client-notifications`, `notification-prefs`, `credentials`; extended `client-change-requests` (timeline kind, staff decision), `engagement-clients` (Primary-only invites), `document-requests`, `client-library`, `client-overview` (PAN/TAN masked for clients).

**API routes**: `app/api/client/{portal,portal/prefs,portal/answer,portal/search,portal/feedback,portal/announcements-unread,portal/team-photo/[id],handoff,home,home/needs/[id],home/needs/[id]/upload,home/work-items,incorporation,steps/[stepId]/files,compliances,…/[id]/{details,ics,proofs,proofs/[proofId],reminder},compliances/{export,ics},documents,documents/{file,zip},documents/requests/[id]/upload,library/{reads,topic,[id]/remove},team,announcements/reads,notifications,audit,audit/export,notification-prefs,account/password,credentials,credentials/{otp,otp/resend,otp/verify,lock,cells,rows,log},identifiers/reveal}`, `app/api/engagements/[id]/{file-requests,timeline-requests}/**`, `app/api/requests/[id]/details`, `DELETE /api/client/change-requests/[id]`.

**Other**: Inngest `complianceReminders`; env `CREDENTIALS_ENCRYPTION_KEY`, `CLIENT_SUPPORT_*`; one existing route changed — the client approve route refuses while a requested file is missing.

## Reviews (read-only) and what was fixed

| Finding | Fix |
|---|---|
| H1 a client's Primary contact could attach any existing account (another company's client) to their engagement | Client invites only create new accounts; one generic error; the client's engagement is chosen deterministically |
| H2 credentials OTP could be brute-forced with parallel guesses | Atomic try counter, one live code per person, 6 codes per hour |
| M1 uploads read before any size check | 25 MB cap checked before the body is read |
| M2 staff e-mails / internal audit text on the client Home and credentials log | Client-safe allowlist + e-mail scrubbing |
| M3 upload Undo could delete older documents | Tied to that upload, 10-minute window |
| M4 invite restore could re-enable a removed account | Only undoes its own cancellation |
| Runtime: viewer under compliance modals, phone sheets under the launcher, Search document links, phone pop-up styles | Fixed |
| Low findings left as they are | Listed in QUESTIONS.md › Shell (L1, L3, L4, L5, L7, L8) |

## Decisions worth your attention first (all in QUESTIONS.md)

1. **Before / After pill** shows the real COI state; the client may flip it to preview the other layout (remembered per client).
2. **One active step at a time** — the step gate is unchanged; the prototype's parallel "in progress" steps show as Next / Upcoming.
3. **Client answers stay read-only** on step pages (DECISIONS: "Answers stay read-only"); the client approves, asks for changes and uploads requested files.
4. **Invites use a temporary password** until set-password links exist; only the Primary contact invites.
5. **Credentials OTP goes by e-mail only** (the WhatsApp sender only sends pre-approved templates).
6. **Notification preferences are saved but not yet read by the senders**; no weekly summary job yet.
7. **"Library"** (as FINAL shows) rather than "Knowledge Bank" in the sidebar; route `/library` unchanged.
8. **Search ⌘K** is a real palette (the prototype only toasted).
9. **Compliances due-soon = 7 days** in the portal (the staff app keeps 14); client timeline of filings is read-only.
10. The obligations seed lacks PT payment, TCS, ECB-2, Softex, ITC-04 — the calendar will look thinner than the prototype until the seed or real data has them.
