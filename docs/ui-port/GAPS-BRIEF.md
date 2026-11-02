# Brief for gap agents (building the GAPS.md features)

Read this whole file first, then `docs/ui-port/AGENT-BRIEF.md` (its sources, class-name table
and hard rules still apply, with the changes below), then `docs/ui-port/GAPS.md` for the rows
you own. The owner asked for every gap to be built for real: a working store, a scoped
repository, a route, and the screen that uses it. Nothing on a screen may be sample data.

## What already exists (commit 6c07b40)

The schema for every gap is in place and migrated on the local database. Do not edit
`src/db/schema*.ts` or `src/db/migrations/*`, and do not run migrations. If you truly need a
column that is not there, stop and write it in your report.

- `src/db/schema-firm.ts`: `firm_settings`, `user_sessions`, `escalations`, `prospects`,
  `saved_reports`, `demo_requests`, `mail_groups`, `mail_group_members`.
- `src/db/schema-work.ts`: `engagement_step_events`, `work_sessions`, `work_checklist_items`,
  `time_blocks`, `item_window_requests`, `engagement_notes`, `client_messages`.
- New columns: `profiles.reports_to_admin_id`, `profiles.capacity`, `profiles.last_seen_at`,
  `profiles.totp_secret_enc`, `profiles.totp_enabled_at`; `engagements.expected_coi_on`;
  `audit_events.result` (ok | failed | denied); `documents.review_status`, `reviewed_by`,
  `reviewed_at`, `review_note`; `outlook_connections.signature_enabled`, `signature_text`.
- Role `developer` in `trak_role`, `Role`, `AppRole`. Every guard refuses it except
  `requireDeveloper()` in `src/auth/guards.ts` (developer or super admin). The proxy sends a
  developer to `/app/dev/overview` and keeps them in the `dev` segment.
- `src/lib/work/item-key.ts`: `itemKey()` and `parseItemKey()` for the `item_key` columns.
- Dependencies `@aws-sdk/client-apprunner`, `@aws-sdk/client-cloudwatch-logs`,
  `@aws-sdk/client-cost-explorer` are installed. Add no other dependency.

Useful existing code: `recordAuditEvent` in `src/db/repositories/audit-events.ts` (write one on
every change, R-40), the email path in `src/lib/email/send-email.ts`, WhatsApp in
`src/lib/notify/send-whatsapp.ts` (additive, never blocking email), S3 helpers in
`src/storage/`, credentials encryption in `src/lib/credentials-crypto.ts`, the repository rules
in `src/db/repositories/README.md`, and the recipes in `docs/context/HOW-TO-BUILD.md`.

## Rules that change from AGENT-BRIEF.md

1. You may add repositories, API routes, pages under `app/app/*`, views, components in your
   own folders, and `src/lib/<area>/` helpers. Edit only the files in your scope. Shared files
   (`src/components/{ui,dash,common,shell}/*`, `RoleSidebar.tsx`, the client `Sidebar.tsx`,
   `src/auth/*`, `proxy.ts`, `e2e/smoke.spec.ts`, `app/globals.css`, `tailwind.config.ts`)
   stay closed unless your task names them. Put the nav items, smoke routes and shared-part
   changes you need in your report; the hub adds them.
2. Every repository function takes an `AuthContext` and scopes by role with the helpers in
   `src/lib/auth.ts`. Write a Vitest test for each new repository that proves a person outside
   the scope gets nothing (follow `src/db/repositories/*.test.ts`), and tests for pure logic.
3. Routes validate input with `zod`, return 400 on bad input, and use the guards. Next.js 16:
   read `node_modules/next/dist/docs/` before writing a route (params are a Promise).
4. When a feature needs a secret or an AWS permission that may not be set, read it from an env
   var, and show a plain "Not set up" state when it is missing. Add the env var name (never a
   value) to `.env.example` only if your task names it, otherwise list it in your report.
5. No git commands that change state. The hub commits. Do not open a browser.
6. Before you finish: `npm run typecheck` and `npx vitest run <your test files>` must pass,
   and `npx eslint <your files>` must have 0 errors. Other agents work at the same time; if a
   typecheck error is in a file you do not own, ignore it and say so.

## Contracts between agents

Build exactly these shapes, so the agents that call them can work in parallel.

**Client messages** (built by the messaging agent; the client agent only calls them):
- `GET /api/client/messages?engagementId=<id>`: client of that engagement only. Returns
  `{ messages: Message[] }`, oldest first, and marks staff messages read.
- `POST /api/client/messages` with `{ engagementId, body, itemKey? }`: returns `{ message }`.
- `GET /api/messages?triage=new|todo|done|ignored|all&engagementId?`: staff, scoped like
  engagements. `PATCH /api/messages/<id>` with `{ triage }`. `POST /api/messages` with
  `{ engagementId, body, itemKey? }` for a staff reply.
- `Message = { id, engagementId, companyName, senderSide: 'client' | 'staff', senderName,
  body, itemKey: string | null, readAt: string | null, triage, createdAt }`.

**Engagement notes** (built by the client-record agent):
- `src/db/repositories/engagement-notes.ts`, `GET/POST /api/engagements/<id>/notes`,
  `PATCH/DELETE /api/engagements/<id>/notes/<noteId>` (soft delete, author or admin).
  Staff only, scoped like engagements; super admin sees all.
- `src/components/notes/EngagementNotesPanel.tsx`, props `{ engagementId: string }`. The
  super-admin agent may mount it on the super record once the file exists.

**Step events** (built by the metrics agent): rows in `engagement_step_events` are written
wherever a step's status changes in the repositories, and read through
`src/db/repositories/step-events.ts`.

**Reminders** (built by the messaging agent): `POST /api/engagements/<id>/remind` with
`{ itemKey, note? }` sends the client the reminder email (and WhatsApp when opted in), writes an
audit event, and returns `{ sent: true, channels }`. Rate limit: one per item per 24 hours.

**Firm settings** (built by the super-admin agent): `getFirmSettings(ctx)` in
`src/db/repositories/firm-settings.ts`; any staff role may read.

**Sessions and last seen** (built by the security agent, who owns `src/auth/*` for this):
the JWT carries `sid`; a revoked `user_sessions` row fails `currentContext`; `profiles.last_seen_at`
is written from `currentContext` at most every five minutes.

## Report

End with: files added and changed, routes added (for the smoke list), nav items needed, env
vars needed, decisions you made alone, and anything you could not build and why.
