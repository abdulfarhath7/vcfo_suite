# Compliances: data and server side (data agent, 30 Oct 2026)

Brief: `docs/ui-port/COMPLIANCE-BRIEF.md`. Contract for the screen agents: `docs/ui-port/COMPLIANCE-API.md`
(written first). Source of the rules: the prototype's `docs/COMPLIANCE-MODEL.md` at main e86ce88.
No migration was written or applied, no git command was run, no dependency was added.

## Spec items

| Spec | Status | What I did |
|---|---|---|
| O-10, DR-01 | ✓ | `compliance_activities` table; the 43 rows of the owner's two documents in `src/data/compliance-activities.ts` (copied from the prototype's activity master, which is real data); seeded once and never overwritten. |
| DR-02 | ◐ | Per-occurrence fields: tasks (start, end, urgency, visibility, owner, reviewer, stage, repeats, remind before) and the statutory workflow side table (stage, reviewer, notify days). Per entity-and-activity defaults (one setting for every occurrence of an activity on one client) are not built; see Deferred. |
| DR-03 | ✓ | `kind` and `group` on every activity; `compliance_obligations.activity_id` links the register to the master (23 of the 26 obligations; GSTR-9, LLP Form 11 and LLP Form 8 have no master row). |
| DR-04, S-5 Repeats | ✓ | `repeats` on a task; `compliance-task-repeat` (event `compliance/task.completed`) and `compliance-task-repeat-sweep` (daily 06:15 IST) create the next occurrence; the completion path also creates it inline; unique `(series_id, due_date)` keeps it idempotent. |
| DR-05, DR-06 | ✓ | `start_date` and `due_date` kept apart; `daysToStart`, `daysToDue`, derived Due soon and Overdue. |
| DR-07 to DR-10, DR-21, 3.4 | ✓ | Six reminders per item from `notifyDays` (task: remind before; statutory: occurrence, then activity, then frequency default); per-occurrence overrides (offset, on or off) in `compliance_reminder_overrides`; `compliance-task-reminders` job, daily 08:30 IST. |
| DR-11, 3.5 | ✓ | Admin, super admin, manager create, edit, approve, set reminders, mark not applicable; a lead works, ticks, uploads and submits; a client reads shared tasks, comments and uploads; super admin and admin edit and confirm activities. |
| DR-12, R-13, 3.3 | ✓ | Eight stages, six status words, stage labels, not applicable hidden unless `includeNa=1`. |
| DR-13 | ✓ | Task checklist, comments (internal ones staff only), attachments in S3 with one deliverable. Statutory reuses inputs, SBC fields, details and proofs. |
| DR-14 | ✓ | List filters: engagement, status words, urgency, visibility, activity, date range, done, mine. |
| DR-16 | ✓ | `compliance_task_events` for tasks; statutory workflow changes write `filing_events` rows. |
| DR-19, DR-22 | ✓ | `confirm` shown to admin and super admin only; `confirmed` on PATCH settles it. No reminder goes out until the item has an entity, is applicable, has an owner, a preparation date and a due date, and its activity has no unconfirmed point (`blockedBy` / `remindersBlockedBy`). |
| R-38 | ✓ | Reminders go to the bell (`compliance.reminder`) and one daily email per person; nothing for a page bar. |
| S-1, S-8, C-1, F-1, F-3 | ✓ | `GET /api/compliances/counts` (all, statutory, non-statutory: total, open, done, overdue, due soon). |
| S-3, S-6, S-7 | ✓ | Task rows carry `week`, `urgencyBars`, `visibility`. |
| S-4, K-2 | ✓ | Only admin, super admin and manager reach New task; tested. |
| S-5 | ✓ | `POST /api/compliances/tasks` and `GET /api/compliances/tasks/defaults` (owner and reviewer defaults, pickers, the 11 activities with default repeats and remind-before). |
| D-1 to D-3 | ✓ | `GET /api/compliances/statutory/:instanceId`: header, client inputs, filled by SBC, reminders, rule, history, six progress steps from real dates, stage, owner, reviewer, previous 6 periods, Before filing ticks, Assist runs, proofs. `PATCH` for stage, submit, approve, send back, assign. |
| D-4 | ✓ | A client gets no reviewer, review note, confirm point, escalation reminders, ticks or Assist runs. |
| 4.3 | ✓ | `GET /api/compliances/tasks/:id` with checklist, attachments, comments, reminders, history, five steps, `can` flags; review route. |
| C-3, F-2 | ✓ | Task list by date range (`from`, `to`) and `done=1` with `deliverable`. |
| K-1 | ✓ | A client lists and reads only its own tasks with visibility client or both; a firm-only task is 404. Tested. |
| DR-17, DR-18, DR-20 | ✗ | Out of scope (holidays, dedup is applied in the data file, retention). |

## Files

New:
- `src/data/compliance-activities.ts`, `src/data/compliance-activities.test.ts`
- `src/lib/compliance-tasks/model.ts` (pure model), `model.test.ts`, `events.ts`, `reminder-email.ts`
- `src/db/schema-compliance-tasks.ts`
- `src/db/repositories/compliance-activities.ts`, `compliance-statutory.ts`, `compliance-reminder-schedule.ts`, `compliance-counts.ts`, `compliance-tasks.test.ts`
- `src/db/repositories/compliance-tasks/` (`index.ts`, `shared.ts`, `read.ts`, `write.ts`, `attachments.ts`, `repeat.ts`, `reminder-state.ts`)
- `app/api/compliances/**` (14 route files and `_respond.ts`)
- `src/jobs/compliance-task-reminders.ts`, `src/jobs/compliance-task-repeat.ts`
- `scripts/seed-compliance-activities.ts`

Edited (small, additive):
- `src/db/schema.ts`: `compliance_obligations.activity_id` and the re-export of the new schema file.
- `src/db/repositories/compliance.ts`: new obligation rows get their `activity_id`.
- `app/api/inngest/route.ts`, `src/lib/dev/jobs-registry.ts`: the three new jobs.
- `src/lib/checklist/checklist-notifications.ts`, `src/lib/notifications/notification-popup.ts`, `src/components/notifications/notification-kind-look.ts`: two notification kinds, `compliance.reminder` and `compliance.task`.
- `src/db/repositories/README.md`, `src/lib/README.md`: one paragraph and one line.

## Routes

All under `/api/compliances`: `activities` (GET), `activities/:id` (PATCH), `tasks` (GET, POST),
`tasks/defaults` (GET), `tasks/:id` (GET, PATCH), `tasks/:id/review` (POST), `tasks/:id/checklist`
(POST), `tasks/:id/checklist/:itemId` (PATCH, DELETE), `tasks/:id/comments` (POST),
`tasks/:id/attachments` (POST), `tasks/:id/attachments/:attachmentId` (GET, DELETE),
`statutory/:instanceId` (GET, PATCH), `reminders` (GET, PUT), `counts` (GET). Shapes in
`docs/ui-port/COMPLIANCE-API.md`.

## Schema for migration 0030 (hub)

All additive. Run `npm run db:generate` after reading `src/db/schema-compliance-tasks.ts`.

- Column `compliance_obligations.activity_id text` (nullable, no foreign key, so the obligation seed never depends on the activity seed).
- `compliance_activities` (text id primary key; name, kind, activity_group, frequency, module, area, due_rule, penalty, applies, owner_role, reviewer_role, notify_days, visibility, note, confirm, confirmed_by, confirmed_at, source, sort, updated_by, updated_at).
- `compliance_tasks` (engagement, activity, name, period_label, start_date, due_date, urgency, visibility, owner, reviewer, stage, repeats, remind_before, series_id, previous_id, review_note, submitted_at, completed_at, approved_by, created_by, timestamps; unique `(series_id, due_date)`).
- `compliance_task_checklist_items`, `compliance_task_comments`, `compliance_task_attachments`, `compliance_task_events`.
- `compliance_instance_workflow` (instance_id primary key; stage, reviewer, notify_days, submitted_at, submitted_by, review_note).
- `compliance_reminder_overrides` (unique `(subject_kind, subject_id, reminder_key)`).
- `compliance_reminder_log` (unique `(subject_kind, subject_id, reminder_key, sent_on, recipient_id)`).

Seed: the app seeds the 43 activities and the obligation links on first use
(`systemEnsureActivitiesSeeded`, called by every activity, task-defaults, statutory and reminder
read). For a migration-time seed, append the output of
`node --conditions=react-server --import tsx scripts/seed-compliance-activities.ts --sql` to 0030
(INSERT … ON CONFLICT DO NOTHING plus the link UPDATEs, with statement breakpoints). Without
`--sql` the script seeds the database `src/db/client.ts` connects to (DATABASE_URL locally, DB_SECRET_ARN and the DB_* vars through the SSM tunnel for RDS).

## Decisions

- Statutory occurrences stay the existing `compliance_instances`; their stage and reviewer sit in a side table so the Inngest regeneration upsert never touches them. A filed instance is always Completed; filing itself stays on `PATCH /api/filings/:id/status`. Approve sets stage In progress and `approvedOn` (the lead files next).
- Statutory preparation date for DR-22 is the working window start, else the period end. Without that rule almost no statutory reminder could ever go out.
- Activities with an open `confirm` point (ACT-009, 011, 012, 022, 028) send no reminders until an admin confirms them (`PATCH /api/compliances/activities/:id { confirmed: true }`). ACT-011 and ACT-012 cover advance tax and TDS returns, so those reminders stay off until then. This follows DR-19 and DR-22 literally; the owner may prefer to confirm them at once.
- The daily overdue reminder stops 30 days after the due date, so years of unfiled generated rows never flood the bell.
- Reminders go to staff only (owner, reviewer, manager, admin), as section 3.4 lists. The client's own "Remind me" job is unchanged.
- Recipients: reviewer falls back to the engagement's manager (admin on a legacy row); the second escalation goes to the engagement's admin, else every active admin.
- Email: one per person per day, sent after the person's quiet hours end; deadline email cannot be switched off (the existing rule). The bell rows are written at once.
- Default owner of a new task is the engagement's project lead, default reviewer its manager; the activity's `ownerRole` and `reviewerRole` are job titles, not people.
- No default checklist is created: the prototype's subtasks were sample data. `checklist` on create takes the labels.
- Form 16 is linked to ACT-012 (the prototype links `tds-24q` there); ESI return to ACT-027; designated partner KYC to ACT-M08.
- A latest occurrence marked Not applicable pauses its series.
- Bell links: tasks `/app/<portal>/compliances/obligations/tasks/<id>`, statutory `/app/<portal>/compliances/obligations/<obligationId>/<instanceId>`, super admin `/app/super/practice`.

## Deferred

- Entity-and-activity settings (one notify-days or owner default for every occurrence of an activity on one client, DR-02). Per-occurrence edits work today.
- A screen to edit the activity master (the PATCH route exists).
- WhatsApp for these reminders (no approved template).

## Checks

- `npx tsc --noEmit -p .`: 0 errors.
- `npx vitest run src/db/repositories src/lib/notifications src/lib/notify src/jobs src/lib/dev src/components/notifications src/lib/compliance-tasks src/data/compliance-activities.test.ts`: all pass (31 new tests: model 11, data 3, cross-tenant 17).
- `npx eslint` on every new and edited file: 0 errors, 0 warnings.
- Not run: migrations, seeds, the jobs against a database (the hub applies 0030 first).
