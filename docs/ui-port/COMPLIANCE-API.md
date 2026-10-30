# Compliances API: statutory and non-statutory (30 Oct 2026)

The data agent owns this file. The screen agents build against it. Source of the rules: the
prototype's `docs/COMPLIANCE-MODEL.md` (sections 3 and 7) and `docs/ui-port/COMPLIANCE-BRIEF.md`.
Every route below lives under `app/api/compliances/`. Every route checks the role first, then the
repository checks the engagement scope (`assertEngagementAccess`, `listScopedEngagementIds`). An
item outside the caller's scope reads as `404 { error: 'not_found' }`, never `403`, so nothing leaks
across tenants. A developer gets `403` on every route.

Existing routes that the new screens keep using (unchanged):

| Need | Route |
|---|---|
| Statutory register rows (Obligations, Calendar, Filings) | `GET /api/filings?engagementId=&fy=` (staff), `GET /api/client/compliances` (client) |
| Mark filed or reopen | `PATCH /api/filings/:id/status` |
| Working window | `POST /api/filings/:id/window` |
| Proof files | `GET/POST /api/client/compliances/:id/proofs`, `GET/DELETE /api/client/compliances/:id/proofs/:proofId` |
| Filed facts (ARN, amount, dates) | `PATCH /api/client/compliances/:id/details` |
| From the client / Filled by SBC writes | `POST /api/compliance-inputs` (save, confirm, ask, accept, send-back) |
| Before filing ticks | `GET/POST /api/compliance-checklist` |
| VCFO Assist runs | `/api/assist/engagements/:id/runs` |
| Filing thread | `GET /api/filings/events?ids=` |

## Shared types

```ts
type Stage = 'not-started' | 'ready' | 'in-progress' | 'waiting' | 'review' | 'rework' | 'completed' | 'not-applicable';
type StatusWord = 'Not started' | 'In progress' | 'Waiting' | 'Due soon' | 'Overdue' | 'Done';   // R-13, six words
type Urgency = 'Low' | 'Medium' | 'High' | 'Critical';
type Visibility = 'firm' | 'client' | 'both';                  // statutory is always 'both'
type Repeats = 'one-time' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly';
type WeekGroup = 'This week' | 'Next week' | 'Later' | 'Done'; // S-3, weeks start on Monday
type ReminderKey = 'initial' | 'due-soon' | 'due-date' | 'overdue' | 'escalate-reviewer' | 'escalate-admin';
type Person = { id: string; name: string } | null;
type IsoDate = string;   // 'YYYY-MM-DD'
type IsoTime = string;   // full ISO timestamp
```

Stage labels: Not started, Ready to start, In progress, Waiting for client, Submitted for review,
Rework required, Completed, Not applicable. Every DTO carries `stageLabel` so screens never map it.

Status word (`word`), computed on the server from the stage, the due date and the notify days, on
the server's India date:
`completed` → Done · past due → Overdue · due within `notifyDays` and stage `not-started` or `ready`
→ Due soon · `in-progress`, `review`, `rework` → In progress · `waiting` → Waiting · else Not started.
`not-applicable` rows come back only with `includeNa=1` and carry `hidden: true`.

Urgency bars: Low 1, Medium 2, High 3, Critical 4 (`urgencyBars`).

```ts
interface Activity {
  id: string;                    // 'ACT-001-3B', 'ACT-M08'
  name: string;
  kind: 'Statutory' | 'Non-statutory' | 'Policy-based' | 'Configurable';
  group: 'statutory' | 'non-statutory';
  frequency: string;             // 'Monthly', 'Weekly', 'Half-yearly', 'Every 3 years', 'One-time', …
  module: string;
  area: string;                  // 'GST' | 'Income tax' | 'MCA' | 'FEMA' | 'Labour' | 'Payroll' | 'Internal'
  dueRule: string;
  penalty: string;               // '' for internal work
  applies: string;
  ownerRole: string;             // a job title from the master, not a person
  reviewerRole: string;
  notifyDays: number;            // DR-21 default lead time
  visibility: Visibility;
  note: string;
  confirm: string | null;        // ALWAYS null for manager, lead and client (D-4)
  confirmedAt: IsoTime | null;   // set when an admin confirmed the open point
  from: 'master' | 'manual';
}

interface ReminderRow {
  key: ReminderKey;
  label: string;                 // 'First reminder', 'Due soon', 'Due today', 'Overdue, daily', 'Escalation', 'Escalation'
  to: string;                    // 'Owner', 'Owner and reviewer', 'Reviewer or manager', 'Compliance admin'
  offsetDays: number;            // from the due date; negative = before
  date: IsoDate;                 // due date + offsetDays
  enabled: boolean;
  overridden: boolean;           // true when this row has a per-occurrence override
  state: 'scheduled' | 'sent' | 'acknowledged' | 'skipped' | 'blocked';
  sentAt: IsoTime | null;        // the first send of this reminder (overdue: the latest)
  internal: boolean;             // escalations; never returned to a client (D-4)
}

interface Step {                 // ST5 progress list (D-3, 4.3)
  key: string;
  label: string;
  state: 'done' | 'now' | 'next';
  who: string | null;
  when: IsoTime | IsoDate | null;
  evidence: string | null;       // a file name, a reference number, or a short phrase
}

interface HistoryEntry { at: IsoTime; who: string | null; what: string; side?: 'client' | 'sbc' }
```

Reminder state: `blocked` means DR-22 is not met (see `blockedBy` on the reminders payload);
`skipped` means the item was done before an after-due reminder; `acknowledged` means the bell
notification it created was read.

## 1. Activity master

### `GET /api/compliances/activities`

Who: super admin, admin, manager, lead, client.
Query: `group` = `statutory` | `non-statutory` (optional).
Response `200`: `{ activities: Activity[] }` (43 rows, master order).

### `PATCH /api/compliances/activities/:id`

Who: super admin, admin.
Body (all optional): `{ notifyDays?: number (0–120), ownerRole?: string, reviewerRole?: string, visibility?: Visibility (non-statutory only), confirmed?: boolean }`.
`confirmed: true` stamps `confirmedAt` (the open point of section 6 is settled; reminders for that
activity may go live, DR-19, DR-22). Response `200`: `{ activity: Activity }`. `404` unknown id.

## 2. Non-statutory tasks

```ts
interface TaskRow {
  id: string;
  engagementId: string;          // app engagement id
  companyName: string;
  activityId: string | null;     // null for "Other…"
  activityName: string | null;
  name: string;                  // the activity name or the "Other…" name
  periodLabel: string | null;    // 'Oct 2026', 'Week of 12 Oct', 'Q3 2026-27', 'FY 2026-27'; null for one-time
  title: string;                 // name + ' · ' + periodLabel when there is one
  startDate: IsoDate;
  dueDate: IsoDate;              // the end date
  urgency: Urgency;
  urgencyBars: 1 | 2 | 3 | 4;
  visibility: Visibility;
  stage: Stage;
  stageLabel: string;
  word: StatusWord;
  hidden: boolean;               // stage not-applicable
  week: WeekGroup;
  daysToStart: number;           // negative once started (DR-06)
  daysToDue: number;             // negative when overdue
  owner: Person;
  reviewer: Person;              // always null for a client (K-2)
  repeats: Repeats;
  remindBefore: number;          // days; the first reminder
  checklist: { done: number; total: number };
  attachmentCount: number;
  deliverable: { id: string; fileName: string } | null;   // F-2: the file a done task delivers
  completedAt: IsoTime | null;
  createdBy: Person;
  createdAt: IsoTime;
}
```

### `GET /api/compliances/tasks`

Who: super admin, admin, manager, lead (their scope), client (own engagement, and only tasks with
visibility `client` or `both`, K-1).
Query (all optional):

| Param | Meaning |
|---|---|
| `engagementId` | One client. Access-checked; a foreign id returns `{ tasks: [] }`. |
| `status` | Comma list of status words: `Overdue,Due soon` |
| `urgency` | Comma list of urgencies |
| `visibility` | Comma list: `firm,client,both` (staff only; ignored for a client) |
| `activityId` | One activity |
| `from`, `to` | Due (end) date range, inclusive, `YYYY-MM-DD` (Calendar month or year) |
| `done` | `1` only completed (Filings F-2), `0` only open |
| `mine` | `1` only tasks I own (lead home) |
| `includeNa` | `1` also return not-applicable rows (`hidden: true`) |

Response `200`: `{ tasks: TaskRow[], today: IsoDate }`, ordered by due date, then title.

### `GET /api/compliances/tasks/defaults?engagementId=`

Who: super admin, admin, manager (the New task form, S-5).
Response `200`:
```ts
{
  owner: Person;                 // the engagement's project lead
  reviewer: Person;              // the engagement's manager (or admin on a legacy row)
  owners: Person[];              // leads, managers and admins who may own it
  reviewers: Person[];           // managers and admins
  activities: Array<{ id: string; name: string; notifyDays: number; repeats: Repeats; visibility: Visibility }>;  // the 11 non-statutory rows
}
```
`404` when the engagement is outside the caller's scope.

### `POST /api/compliances/tasks`

Who: super admin, admin, manager (manager: own or co-managed clients only). Leads and clients `403` (S-4, K-2).
Body:
```ts
{
  engagementId: string;
  activityId: string | null;     // a non-statutory activity id, or null for "Other…"
  name?: string;                 // required when activityId is null (1–120 chars)
  startDate: IsoDate;
  dueDate: IsoDate;              // the end date; must be on or after startDate
  urgency: Urgency;
  visibility: Visibility;
  ownerId?: string | null;       // defaults to the engagement's lead
  reviewerId?: string | null;    // defaults to the engagement's manager
  repeats: Repeats;              // default from the activity frequency
  remindBefore?: number;         // 0–90, default the activity's notifyDays (else 5)
  checklist?: string[];          // optional subtasks, up to 30 labels
}
```
Response `201`: `{ task: TaskDetail }`. `400 { error: 'invalid_body' | 'end_before_start' | 'name_required' | 'unknown_activity' | 'owner_not_staff' }`.
Side effects: a `compliance.task` bell notification to the owner (and reviewer), an activity row.

### `GET /api/compliances/tasks/:id`

Who: staff in scope; a client for its own tasks with visibility `client` or `both` (a firm-only task is `404`).
Response `200`: `{ task: TaskDetail }`:
```ts
interface TaskDetail extends TaskRow {
  activity: Activity | null;
  checklistItems: Array<{ id: string; label: string; done: boolean; doneBy: Person; doneAt: IsoTime | null }>;
  attachments: Array<{ id: string; fileName: string; mime: string | null; sizeBytes: number | null; uploadedBy: Person; uploadedAt: IsoTime; deliverable: boolean; byClient: boolean }>;
  comments: Array<{ id: string; author: Person; authorRole: string; body: string; internal: boolean; at: IsoTime }>;
  reminders: ReminderRow[];      // client: escalations removed
  remindersBlockedBy: string[];  // DR-22 gaps; [] for a client
  history: HistoryEntry[];       // newest first; client: internal rows removed
  steps: Step[];                 // Created → Inputs ready → Work done → Submitted for review → Approved
  reviewNote: string | null;     // the last send-back reason; null for a client
  can: {
    edit: boolean;               // admin, super admin, manager
    changeStage: boolean;        // staff
    submit: boolean;             // owner or staff, when stage is not review or completed
    review: boolean;             // admin, super admin, manager, or the named reviewer, when stage is review
    tick: boolean;               // staff
    comment: boolean;            // everyone who can read it
    upload: boolean;             // everyone who can read it
  };
}
```
A client never receives internal comments, internal history rows, escalation reminders, the review
note or the reviewer.

### `PATCH /api/compliances/tasks/:id`

Who and body, one of:

| Body | Who |
|---|---|
| `{ action: 'stage', stage: Stage }` | Staff in scope. `review` = submit. `completed` and `not-applicable` need admin, super admin or manager (a lead submits for review instead). |
| `{ action: 'edit', name?, startDate?, dueDate?, urgency?, visibility?, ownerId?, reviewerId?, repeats?, remindBefore? }` | Super admin, admin, manager in scope. |

Response `200`: `{ task: TaskDetail }`. `400 { error: 'invalid_stage' | 'end_before_start' }`, `403 { error: 'forbidden' }`.
Moving to `completed` stamps `completedAt` and, for a repeating task, creates the next occurrence (section 5).

### `POST /api/compliances/tasks/:id/review`

Who: super admin, admin, manager in scope, or the task's named reviewer.
Body: `{ decision: 'approve' | 'send-back', note?: string }` (`note` required for `send-back`, up to 500 chars).
`approve` → stage `completed`; `send-back` → stage `rework` with the note. Only from stage `review`
(`409 { error: 'not_in_review' }` otherwise). Response `200`: `{ task: TaskDetail }`.

### Checklist

- `POST /api/compliances/tasks/:id/checklist` body `{ label: string (1–200) }` → `201 { item }`. Staff in scope.
- `PATCH /api/compliances/tasks/:id/checklist/:itemId` body `{ done: boolean }` → `200 { item }`. Staff in scope.
- `DELETE /api/compliances/tasks/:id/checklist/:itemId` → `200 { ok: true }`. Super admin, admin, manager.

`item` = `{ id, label, done, doneBy: Person, doneAt: IsoTime | null }`.

### Comments

`POST /api/compliances/tasks/:id/comments` body `{ body: string (1–2000), internal?: boolean }` →
`201 { comment }`. Staff and the client (on a task it can see). A client's comment is never internal.
A client comment sends a `compliance.task` bell notification to the owner; a staff comment that is
not internal, on a task the client can see, notifies the client's users.

### Attachments

- `POST /api/compliances/tasks/:id/attachments` multipart: `file` (required, 1 byte to 15 MB),
  `deliverable` (`'1'` marks it the deliverable; staff only). Staff and the client. → `201 { attachment }`.
  Stored in the `engagement-documents` bucket under `<engagementDbId>/compliance-tasks/<taskId>/` through `src/storage/s3.ts`.
- `GET /api/compliances/tasks/:id/attachments/:attachmentId` → `200 { url: string, fileName: string }` (short-lived signed URL).
- `DELETE /api/compliances/tasks/:id/attachments/:attachmentId` → `200 { ok: true }`. Super admin, admin, manager, or the uploader.

## 3. Statutory detail (D-1 to D-4)

### `GET /api/compliances/statutory/:instanceId`

Who: staff in scope; the client for its own engagement. `instanceId` is a `compliance_instances.id`
(the `id` of a `/api/filings` row). Response `200`: `{ detail: StatutoryDetail }`:

```ts
interface StatutoryDetail {
  id: string;
  engagementId: string;          // app engagement id
  companyName: string;
  obligationId: string;          // 'gst-gstr-3b'
  name: string;                  // the obligation's particular ('GSTR-3B Filing')
  periodLabel: string | null;
  fyLabel: string | null;
  title: string;                 // name + ' · ' + periodLabel
  area: string;                  // compliance area ('GST')
  authority: string;             // regulator
  frequency: string;
  periodStart: IsoDate | null;
  periodEnd: IsoDate | null;
  dueDate: IsoDate;
  filedOn: IsoDate | null;
  window: { from: IsoDate; to: IsoDate } | null;
  visibility: 'both';
  stage: Stage;
  stageLabel: string;
  word: StatusWord;
  daysToDue: number;             // negative = days overdue
  owner: Person;
  reviewer: Person;              // null for a client
  primaryAction: 'submit' | 'approve' | 'upload' | null;   // lead submit, manager/admin approve, client upload
  activity: Activity | null;     // via compliance_obligations.activity_id
  clientInputs: SubjectInputsDto | null;   // the existing GET /api/compliance-inputs payload (docs, client fields, submission)
  filledBySbc: {
    fields: Array<{ key: string; label: string; value: string | null }>;   // the 'sbc' side of compliance_subject_fields
    acknowledgementNo: string | null;
    amountPaid: string | null;
    filedBy: string | null;
    dataReceivedOn: IsoDate | null;
    preparingSince: IsoDate | null;
    approvedOn: IsoDate | null;
    locked: boolean;             // true once filed (values read-only)
  };
  proofs: FilingProof[];         // as GET /api/client/compliances/:id/proofs
  reminders: ReminderRow[];      // client: escalations removed
  remindersBlockedBy: string[];  // DR-22 gaps, e.g. ['owner', 'activity not confirmed']; [] when live
  rule: {
    dueRule: string;             // activity dueRule, else the obligation's own rule text
    applies: string;
    penalty: string;
    note: string | null;         // compliance_obligations.applicability_note
    confirm: string | null;      // admin and super admin only
  };
  history: HistoryEntry[];       // newest first: filing_events plus workflow changes
  steps: Step[];                 // Data from client → Prepared → Submitted for review → Approved → Filed or paid → Acknowledged
  checklist: Array<{ itemKey: string; checkedBy: string | null; checkedAt: IsoTime }>;  // Before filing ticks; [] for a client
  assistRuns: Array<{ id: string; form: string | null; state: string; reference: string | null; startedAt: IsoTime; finishedAt: IsoTime | null }>;  // staff only, newest 5
  previous: Array<{ id: string; periodLabel: string | null; dueDate: IsoDate; filedOn: IsoDate | null; late: boolean | null }>;  // last 6 periods of the same obligation; late null = not filed
  reviewNote: string | null;     // staff only
  can: { submit: boolean; approve: boolean; sendBack: boolean; assign: boolean; editReminders: boolean; upload: boolean };
}
```

How the steps are derived (real data only, nothing invented):
Data from client = all asked documents accepted, or `dataReceivedOn` set · Prepared = `preparingSince`
set or the stage passed `in-progress` · Submitted for review = workflow `submittedAt` · Approved =
`approvedOn` · Filed or paid = `filedOn` · Acknowledged = `acknowledgementNo` or an acknowledgement
proof. `who` and `when` come from the same rows.

Stage of a statutory item: the workflow row when one exists, else from the register status
(`filed` → completed, `in-progress` → in-progress, else not-started). A filed instance is always `completed`.

### `PATCH /api/compliances/statutory/:instanceId`

| Body | Who | Effect |
|---|---|---|
| `{ action: 'stage', stage }` | Staff in scope | Any stage except `completed` (use `PATCH /api/filings/:id/status` to file). `not-applicable` needs admin, super admin or manager. |
| `{ action: 'submit' }` | Staff in scope | Stage `review`, stamps `submittedAt`, bell to the reviewer. |
| `{ action: 'approve' }` | Super admin, admin, manager in scope, or the named reviewer | From `review`: stage `in-progress`, `approvedOn` = today (the lead files next). |
| `{ action: 'send-back', note }` | Same as approve | From `review`: stage `rework` with the note. |
| `{ action: 'assign', ownerId?, reviewerId? }` | Super admin, admin, manager | Sets the owner (`compliance_instances.owner_id`) and reviewer. |

Every change writes a `filing_events` row (side `sbc`). Response `200`: `{ detail: StatutoryDetail }`.
`409 { error: 'not_in_review' }` for approve or send-back outside `review`; `409 { error: 'filed' }` for a stage change on a filed item.

## 4. Reminder schedule (section 3.4, D-2.3)

### `GET /api/compliances/reminders?kind=statutory|task&id=`

Who: staff in scope (client: escalations removed, `editable: false`).
Response `200`: `{ notifyDays: number, rows: ReminderRow[], blockedBy: string[], editable: boolean }`.

### `PUT /api/compliances/reminders`

Who: super admin, admin, manager in scope.
Body:
```ts
{
  kind: 'statutory' | 'task';
  id: string;
  notifyDays?: number;           // 0–120; moves First reminder and Due soon
  rows?: Array<{ key: ReminderKey; offsetDays?: number (-120..60); enabled?: boolean }>;
  reset?: boolean;               // drop every override of this item
}
```
Response `200`: the same shape as GET.

Default schedule from `notifyDays` (N): First reminder −N (owner) · Due soon −max(1, round(N/3))
(owner and reviewer) · Due today 0 (owner and reviewer) · Overdue +1, then daily up to 30 days
(owner) · Escalation +2 (reviewer, else the engagement's manager) · Escalation +5 (the engagement's
admin, else every firm admin).

DR-22 (`blockedBy`): no reminder goes out until the item has an engagement, is applicable (stage not
`not-applicable`), has an owner, a preparation date (task: start date; statutory: the working window
start, else the period end) and a due date, and its activity has no unconfirmed `confirm` point.

## 5. Counts (S-1, S-8, C-1, F-1, F-3)

### `GET /api/compliances/counts`

Who: every role in scope (client: own engagement, client-visible tasks only).
Query: `engagementId?`, `from?`, `to?` (due date range, default the current Indian FY).
Response `200`:
```ts
{
  range: { from: IsoDate; to: IsoDate };
  all:          { total: number; open: number; done: number; overdue: number; dueSoon: number };
  statutory:    { total: number; open: number; done: number; overdue: number; dueSoon: number };
  nonStatutory: { total: number; open: number; done: number; overdue: number; dueSoon: number };
}
```
Obligations and Calendar show `total` per category; Filings shows `done`. Not-applicable rows are
left out. Statutory `done` = filed instances; non-statutory `done` = completed tasks.

The non-statutory items for Calendar (end date, start date, urgency, word) and Filings (done, with
`deliverable`) come from `GET /api/compliances/tasks?from=&to=` and `?done=1`.

## 6. Background jobs (no route)

- `compliance-task-reminders` (Inngest, daily 08:30 India time, Run now from the developer console):
  the six reminders for open tasks and open statutory instances. Bell notification (kind
  `compliance.reminder`, R-38) to each recipient, and one email per recipient per day listing their
  reminders (the system of record). Skips when "Pause all jobs" is on; waits out each recipient's
  quiet hours before the email; never sends a reminder twice on the same day.
- `compliance-task-repeat` (event `compliance/task.completed`, plus a daily sweep): creates the next
  occurrence of a repeating task with the same activity, client, owner, reviewer, urgency,
  visibility, remind-before and checklist labels (unticked), shifted by one interval.

## 7. Bell links

Notifications use two new kinds: `compliance.reminder` (the six reminders, label "Reminder") and
`compliance.task` (assigned, ready for review, approved, sent back, comment, client file; label
"Task"). Their `href` follows the recipient's portal (`<portal>` is admin, manager, intern or
client), so the screens must serve these paths:

| Item | href |
|---|---|
| Task | `/app/<portal>/compliances/obligations/tasks/<taskId>` |
| Statutory item | `/app/<portal>/compliances/obligations/<obligationId>/<instanceId>` |
| Either, for a super admin | `/app/super/practice` |

## 8. Errors

Every route returns `{ error: string }` with the status: `400` (`invalid_body`, `invalid_json`,
`invalid_query`, `invalid_date`, `end_before_start`, `name_required`, `note_required`,
`unknown_activity`, `owner_not_staff`, `invalid_stage`, `invalid_days`, `file_required`,
`file_size`), `401`/`403` (`forbidden` or the guard's message), `404` (`not_found`), `409`
(`not_in_review`, `filed`), `500` (`server_error`).
