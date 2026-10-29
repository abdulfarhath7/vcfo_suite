# Gaps: prototype features that needed backend work

On 29 Oct 2026 the owner asked for every gap to be built. All 30 are now built on real stores,
scoped repositories and routes. The schema for all of them is one migration,
`src/db/migrations/0026_gaps_backend.sql`, applied only to the local Docker database. It must be
applied on RDS before this branch is deployed. Nothing on a screen is sample data.

Each row says what was built, and the part that is still not done, with the reason.

| No. | Feature | Built (commit) | Still not done |
|---|---|---|---|
| G-01 | Developer console: Overview, Connections, Messages, Jobs, Logs, Deploys, Access, Data and costs, Audit | `developer` role (guards refuse it everywhere except `requireDeveloper`), nine read-only screens, `dev-*` repositories, AWS and Inngest readers; client recipients are masked (441b0af, 6c07b40) | Write actions (rotate key, retry, roll back) have no backend. Jobs, Logs, Deploys and Costs need `INNGEST_SIGNING_KEY`, `APP_LOG_GROUP`, `APP_RUNNER_SERVICE_ARN`, `AWS_COST_EXPLORER=on` and the IAM rights in `.env.example`. |
| G-02 | Firm settings | `firm_settings`, admin page `/app/admin/firm-settings`, super admin Firm tab, logo upload, audit per field (290b73c) | The default reminder days are stored but do not change when reminders go out yet; both reminder paths use fixed days. |
| G-03 | Client compliance proof upload | Client branch on the proofs route; the filing is never marked filed by it; the lead is notified (e259bbe) | — |
| G-04 | Obligation About, Why it applies, If filed late | `src/data/obligation-texts.ts` for all 26 seeded obligations, a due-rule sentence, scoped read, cards on staff and client records (556eaaf) | The seed has LLP Form 11 due 31 March; the law and the text say 30 May. `src/lib/compliance/` was not edited. |
| G-05 | Registration certificate, renewals and expiry | Signed-URL certificate route, issued, expiry and renewal dates per registration, Renew by with Due soon and Overdue on staff and client screens (556eaaf) | — |
| G-06 | Registration numbers on the staff list | One slim, scoped read across engagements (556eaaf) | — |
| G-07 | DIN rows and the reveal countdown | DINs in the home read; `expiresAt` in the reveal response (e259bbe) | — |
| G-08 | Withdraw a timeline change request | The existing DELETE route, a `mine` flag and the Withdraw button (e259bbe) | — |
| G-09 | Multi-file upload; Message the lead | Up to 10 files per request on both upload routes; `client_messages` and the Messages card (e259bbe, f26603e) | — |
| G-10 | Copied from step n; sub-step progress | Derived from the checklist definitions in `src/lib/client-portal/step-progress.ts` (e259bbe) | The note shows only where the source is knowable from the definitions. |
| G-11 | Lead Inbox Triage | Inbox card on lead Today with New, To do, Done, Ignored and reply (f26603e) | Client messages use the bell kind `request.created`; a `message.received` kind needs an edit in `src/lib/checklist/`. |
| G-12 | Assign task to a lead | Assign mode on `POST /api/tasks` and the dialog on manager Today; tasks show in the lead's Work (f26603e) | A lead who reports to another manager does not appear in this manager's Team tasks. |
| G-13 | Stage splits, days in stage, expected COI, days in step | `engagement_step_events` written in the checklist transaction, `expected_coi_on`, practice cards and step header (e71d89e) | History starts now. `scripts/backfill-step-events.mjs` (dry run by default) seeds it from audit events; it was not run. |
| G-14 | Managers grid: On time, Load, Last active, capacity | From `filed_on` against `due_date`, open items against `profiles.capacity`, `last_seen_at` (e71d89e) | — |
| G-15 | One-click Remind | `POST /api/engagements/<id>/remind`, email first, WhatsApp only when opted in, one per item per day (f26603e) | WhatsApp needs the `client_reminder` template approved by Meta. Without email set up, Remind falls back to Mail. |
| G-16 | Task drawer: sessions, checklist, files, activity, Mark done | All five, on `work_sessions` and `work_checklist_items` (70f3338, f26603e) | Filings are marked filed through `PATCH /api/filings/:id/status` (b2a5edd, 3b755e1), except manager Team tasks rows, which have no instance id. Steps outside the direct flow keep their forms. |
| G-17 | Planner: Plan my week, time blocks, New to-do, date change requests | Planner tab, `time_blocks`, `item_window_requests` with manager approval in Approvals (70f3338, f26603e) | No notification on a new request or a decision (no fitting kind). |
| G-18 | Admin Work Managers tab; reassign | Managers and Project leads tabs; `POST /api/work/reassign` (f26603e) | Filings cannot be reassigned; no repository writes a filing's owner. |
| G-19 | Record tabs Registrations, Obligations, Notes | Underline tabs on the staff record; `engagement_notes` (556eaaf, 4fbcd79) | Fees stay out (R-37). |
| G-20 | Super admin admins, escalations, assign, reassign, notes | Admins table, escalations, super assign route with audit, Reports to admin, Notes tab, Escalate on the staff record (290b73c, 4fbcd79) | — |
| G-21 | Growth pipeline, win rate; saved reports, schedule, PDF | `prospects`, `saved_reports`, a PDF from `@react-pdf/renderer`, a daily Inngest job that emails due reports (ff4842d) | No XLSX export. |
| G-22 | Not needed on the super Registrations tab | Raw status on `SuperJourneyStep` (290b73c) | — |
| G-23 | Email signature, attachments, mail groups | Signature on `outlook_connections`, attachments (3 MB each, 10 MB in all), `mail_groups` (5373af9) | Microsoft Graph may refuse a message over about 4 MB; larger mail needs the upload-session flow and the `Mail.ReadWrite` scope. |
| G-24 | Helpful? vote on staff answers | `POST /api/ask/feedback` and the buttons (62ac1a4) | — |
| G-25 | Staff notifications, two-step sign-in, device sign-out | Notification preferences honoured by WhatsApp, TOTP (RFC 6238), `user_sessions` with `sid` in the JWT (62ac1a4) | No recovery codes (the admin reset is the way back). Tokens from before this change cannot be revoked until they expire. The weekly digest is stored but not sent. |
| G-26 | Vault ZIP, upload, requested files, review, preview | ZIP writer, upload, requests section, review status, same-origin preview (5373af9) | Clients do not see review status in their Documents page. |
| G-27 | Analytics completion, delay, on time, time in step | From step events and filings (e71d89e) | — |
| G-28 | Audit Result and Load older | `audit_events.result`, keyset cursor on staff and client audit (e71d89e) | "Denied" is recorded only where a repository refuses; guards have no context to log against. |
| G-29 | Admin Today registrations split | Done, In progress, Pending per registration type (e71d89e) | — |
| G-30 | Landing click-through; Book a demo | A real Book a demo form at `/contact` with `demo_requests`, Growth list and "Add as prospect"; portal links go to the form (ff4842d) | There are no public demo portals (owner choice). |
