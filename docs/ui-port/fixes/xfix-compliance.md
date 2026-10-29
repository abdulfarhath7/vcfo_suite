# X-fix: obligation and registration data, VCFO Assist (30 Oct 2026)

Area: obligation and registration records on both portals, and VCFO Assist status. Built on
the X-BRIEF rules: every row now has a real data path (schema for migration 0029, a
role-scoped repository with a cross-tenant test, a route, the UI). No sample numbers anywhere.

| No. | New status | What you did, or why it stays |
|---|---|---|
| C-324 | ✓ | The calendar filing dialog (`DetailModal` → `FilingBody`) has the "VCFO Assist" block: heading, state chip (Not started, Requested, Assist running, Needs you, Filed by Assist, Stopped, or Not set up), the steps as ST5 rows (the extension's own steps, else the five default ones) and "View replay" once the run kept screenshots. Data: `assist_runs` through `GET /api/assist/runs`. |
| C-363 | ✓ | Filings grid has a 140 px "VCFO Assist" column with the state chip of the newest run per filing (one query for the client's engagement, `latestBySubject`). |
| C-377 | ✓ | Same block as C-324 in the Filings side panel (shared `FilingBody`). |
| C-395 | ✓ | Before the certificate the Obligations list shows tiles of the obligations to come (by frequency or by law, with search), each "After the certificate" and "after <registration>" when a registration starts it. Data: `GET /api/registrations/applicability` → `upcoming` (static obligation library kept to the engagement's legal form and its stored questionnaire answers). |
| C-411 | ✓ | People stack (client, project lead, manager; 30 px, ringed `AvatarStack`) on the obligation head, from the portal shell's `me` and `team`. `RecordHead` got a `people` slot. |
| C-415 | ✓ | "From the client" card on the obligation: the documents asked for the current period with Asked, To review, Accepted, Sent back chips, "N of M accepted", Upload or Download, then the client's details as inputs with "Submit details" → "Submitted" (and "Confirmed by" once staff confirm). Data: `/api/compliance-inputs`. |
| C-416 | ✓ | Upload opens the Documents upload dialog (`documents/UploadDialog`, reused, not forked) with only the open requests of this period; files go to the existing client upload route. |
| C-417 | ✓ | "Filled by SBC" card, read only: Reference, Tax paid and Filed by from the register, then the obligation's SBC fields from `compliance_subject_fields`; identifiers in mono. |
| C-426 | ✓ | Obligation page before the certificate: the record head (Not started, area, "Started by <registration>" link or "Every company", "Next due: After the certificate", people stack), the client fields and SBC fields read only and empty, and About. The prototype's Tally-export period is sample data and is not shown. |
| C-475 | ✓ | Before the certificate every registration reads "Not started" with no date (`buildRegistrations(..., { beforeCoi })`), on the list and the record. |
| C-481 | ✓ | People stack on the registration head (same source as C-411). |
| C-491 | ✓ | Registration "From the client": documents linked to the step (new subject link, or the step id already on the request) with status chips and Upload / Download, plus the step's needs not asked yet ("SBC asks when this starts"). Replaces "What the step needs"; every need still shows. |
| C-492 | ✓ | Client details form on the registration (190 px label column, "Submit details", then "Submitted"). |
| C-493 | ✓ | Upload dialog on the registration (same dialog as C-416). |
| C-494 | ✓ | After an upload: the A1 white toast with the green tile, "N files uploaded", sub "SBC reviews them next." (`toast(..., { kind: 'uploaded' })`). |
| C-500 | ✓ | "Applies because" card: "Applies to <company> because: …", the client's stored questionnaire answers, "Rule: …"; "Not needed" variant with the reason when the step is not applicable or the answers say No. "What it starts" falls back to the static list with the stored trigger date when the register has none yet. |
| S-773 | ✓ | Staff obligation (one client's period in view): "File with VCFO Assist" with the steps, "Start filing" (stores a requested run the extension picks up), state while it runs, "View replay" dialog with the kept screenshots, the portal reference. "VCFO Assist is not set up" while `VCFO_ASSIST_ENABLED` is off. |
| S-774 | ✓ | Staff "From the client": documents with chips, Accept, "Ask again" with a required reason ("Enter a reason first"), Download, "Ask for a document", the client's details with "Confirm" and "Confirmed by". |
| S-809 | ✓ | Same Assist card on the staff registration record (form from the checklist item). |
| S-811 | ✓ | Staff "Filled by SBC" on the registration: click a value to edit, Enter or blur saves (R-40). Also on the obligation period, locked after filing. |
| S-813 | ✓ | Staff "Applies because" / "Not needed" card with the stored answers and the rule. |
| S-814 | ✓ | Staff "What it starts": the obligations the registration starts, linked to the obligation record for that client, with the stored start date. |

## Files changed

- `src/db/schema-portal-compliances.ts` — two tables (below).
- `src/db/schema-portal-documents.ts` — two columns and an index on `document_request_details`.
- `src/data/compliance-inputs.ts` (new) — client and SBC field lists per obligation and registration.
- `src/data/registration-rules.ts` (new) — why, rule, questionnaire questions, not-needed reason, trigger date and started obligations per registration step.
- `src/lib/assist-runs/runs.ts` (new) — run types, state words, default steps, ingest schema, `assistSetUp`.
- `src/lib/assist-runs/ingest-route.ts` (new) — the shared ingest handler.
- `src/lib/assist-runs/runs.test.ts` (new).
- `src/db/repositories/compliance-subject-scope.ts` (new) — the one access check (engagement scope, subject belongs to engagement).
- `src/db/repositories/assist-runs.ts` (new) — list, start, ingest (screenshots to S3), read a screenshot.
- `src/db/repositories/compliance-inputs.ts` (new) — documents and fields of a subject; save, confirm, ask, accept, send back.
- `src/db/repositories/registration-applicability.ts` (new) — applicability, what it starts, obligations to come.
- `src/db/repositories/compliance-subjects.test.ts` (new) — 16 cross-tenant and role tests.
- `src/components/compliances/use-compliance-records.ts` (new) — React Query hooks for both portals.
- `src/components/compliances/AssistParts.tsx` (new) — `AssistChip`, `AssistPanelBlock`, `AssistCard` (uses the foundations agent's `dash/assist-steps`).
- `src/views/compliances/input-cards.tsx` (new) — `StaffFromClientCard`, `StaffSbcFieldsCard`, `AppliesCard`, `StartsCard`.
- `src/views/compliances/ObligationView.tsx`, `RegistrationView.tsx` — the new cards.
- `src/components/client-portal/pages/compliances/inputs.tsx` (new) — client `FromClientCard`, `SbcFieldsCard`, `useRecordPeople`.
- `src/components/client-portal/pages/compliances/{Detail,FilingsPage,ObligationPage,ObligationsPage,spectrum}.tsx` — Assist block and column, people, inputs, before-COI.
- `src/components/client-portal/pages/registrations/{model.ts,RegistrationPage.tsx,RegistrationsPage.tsx}` — before-COI, people, inputs, applicability.
- `.env.example` — `VCFO_ASSIST_ENABLED`.

## New routes

- `GET /api/assist/runs?engagementId=&kind=filing|registration&key=` — runs newest first plus `setUp`; a client reads its own engagement.
- `POST /api/assist/runs { engagementId, kind, key, form? }` — "Start filing" (staff).
- `GET /api/assist/runs/[id]/shots/[index]` — one screenshot of the replay.
- `GET|POST /api/assist/engagements/[id]/runs` — the extension's side (list runs; post progress or result).
- `POST /api/assist/engagements/[id]/result` — the extension's existing result path, same handler.
- `GET|POST /api/compliance-inputs` — documents and fields; actions save, confirm, ask, accept, send-back.
- `GET /api/registrations/applicability?engagementId=` — applicability, what each registration starts, the obligations to come.

## Schema added (for migration 0029)

- `document_request_details.subject_kind text` — 'obligation' or 'registration'; null for other requests.
- `document_request_details.subject_key text` — compliance instance id or registration step id.
- index `document_request_details_subject_idx (engagement_id, subject_kind, subject_key)`.
- table `compliance_subject_fields`: `id uuid pk default random`, `engagement_id uuid not null → engagements on delete cascade`, `subject_kind text not null`, `subject_key text not null`, `field_key text not null`, `side text not null` ('client' | 'sbc'), `value text`, `updated_by uuid → profiles set null`, `updated_at timestamptz not null default now()`, `submitted_at timestamptz`, `confirmed_by uuid → profiles set null`, `confirmed_at timestamptz`; unique `compliance_subject_fields_uq (engagement_id, subject_kind, subject_key, field_key)`.
- table `assist_runs`: `id uuid pk default random`, `engagement_id uuid not null → engagements on delete cascade`, `subject_kind text not null` ('filing' | 'registration'), `subject_key text not null`, `form text`, `state text not null default 'requested'`, `steps jsonb not null default '[]'`, `reference text`, `fields_written integer`, `mismatches jsonb not null default '[]'`, `error text`, `idempotency_key text`, `versions text`, `started_by uuid → profiles set null`, `started_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `finished_at timestamptz`; index `assist_runs_subject_idx (engagement_id, subject_kind, subject_key, started_at)`; unique `assist_runs_idempotency_idx (engagement_id, idempotency_key)`.

## Env vars

- `VCFO_ASSIST_ENABLED` — "on" turns the Assist parts and routes on. Empty: the parts say "Not set up", the extension routes and "Start filing" answer 503.

## What the VCFO Assist extension must send (not edited here)

The extension already runs every Suite request inside a signed-in Suite tab (`suiteRequest`,
`credentials: 'include'`), so the lead's own session authorises the post; clients are refused.

1. Find work: `GET /api/assist/engagements/{engagementId}/runs` → `{ runs: [...] }`; a run
   with `state: 'requested'` was asked for with "Start filing" (`subjectKind`, `subjectKey`,
   `form`). Keep its `id` as `runId`.
2. Progress, as often as useful: `POST /api/assist/engagements/{engagementId}/runs` with
   JSON `{ runId, state: 'running' | 'paused', steps: [{ title, state: 'done'|'run'|'wait', at?: ISO, shot?: 'data:image/png;base64,…' }] }`.
   The posted steps replace the stored list; a screenshot is kept per step (png, jpeg or webp,
   up to 1.5 MB each, 12 MB per post). Use `paused` at the human gate (sign, pay, submit).
   Without a `runId`, send `subjectKind: 'filing' | 'registration'` and `subjectKey` (the
   compliance instance id, or the registration step id such as `reg-4`); the open run of
   that subject is updated, or a new run starts.
3. Result: the existing `postResult` to `/api/assist/engagements/{id}/result` works as is
   (`SuiteResult`: `form`, `srn`, `status`, `capturedAt`, `fieldsWritten`, `mismatches`,
   `recipeVersion`, `fieldMapVersion`, with the `Idempotency-Key` header). It must add
   `runId` (or `subjectKind` + `subjectKey`) so Suite knows which filing or registration it
   belongs to; a body with `srn` and no `state` closes the run as done. `state: 'failed'` with
   `error` records a stop.
4. Answers: 201 (new run) or 200 with `{ run }`; 400 names the bad field; 401/403 as the
   profile route; 404 when the engagement or subject is outside the caller's scope; 503 while
   `VCFO_ASSIST_ENABLED` is off. Panel 5 (Q29, Q42) can be shown again once this is deployed.

## Requests

- Hub: write migration 0029 from "Schema added" and set `VCFO_ASSIST_ENABLED` on App Runner
  when the extension is ready.
- Foundations: `src/components/dash/assist-steps.tsx` names a route `GET /api/filings/:id/assist-runs`
  in its comment; the real read is `GET /api/assist/runs?kind=filing&key=<id>`. The component
  itself is used as is.
- Docs agent: the client obligation and registration pages import `documents/UploadDialog` and
  `css/documents-boards.css`; please keep the `UploadDialog` props stable.

## Decisions

- Obligation inputs key on the current period (compliance instance id), the same key the
  "Before filing" ticks use; registrations key on the step id.
- Registration documents also match requests whose `step_id` is the registration step, so
  requests made before 0029 still show.
- Suite never simulates the portal: "Start filing" only stores a requested run; the steps move
  only when the extension posts. Default step titles follow the extension's human boundary
  (the person signs in and submits).
- The client replay opens inline under the steps (the calendar dialog is already a modal);
  staff get a dialog.
- "Applies because" reads the compliance questionnaire stored on the engagement; with no answer
  the card says it is not answered rather than guessing.

## Checks

- `npx tsc --noEmit -p .` — clean (whole project at the time of the run).
- `npx vitest run` on `src/views/compliances`, `src/components/client-portal/pages/{compliances,registrations}`,
  `src/components/compliances`, `src/lib/assist-runs`, `src/db/repositories/compliance-subjects.test.ts`,
  plus the document request and checklist-tick repository tests — all pass.
- `npx eslint` on every file above — 0 errors (warnings are the existing `only-export-components` kind).

## Coordinator follow-up (30 Oct, after the rows)

- Overwrite check: `src/db/repositories/assist-runs.ts` matches my one Write (exports
  `AssistForbiddenError`, `listAssistRuns`, `requestAssistRun`, `decodeShot`,
  `ingestAssistRun`, `readAssistShot`); I never edited it after that Write. My tables live in
  `schema-portal-compliances.ts` (`compliance_subject_fields`, `assist_runs`) and my columns in
  `schema-portal-documents.ts`; nothing of mine was in `schema-work.ts`, and no
  `assist_run_steps` table exists or is needed (steps are the `assist_runs.steps` jsonb).
- F-173: the run steps were already drawn with the shared `src/components/dash/assist-steps.tsx`
  (`AssistSteps`) in `AssistPanelBlock` and `AssistCard`; nothing else draws them.
- F-192: the client registration page's "Filled by SBC" is now the shared `EditableFacts`
  (number, date of registration, certificate locked, issue and expiry, then the SBC fields).
  "Send to SBC" posts `factChangeNote(...)` to the existing `POST /api/client/change-requests`
  with the registration step id; the client never writes a value. The client obligation page
  keeps the read-only `SbcFieldsCard`.
- `src/db/repositories/credentials/registrations.ts`: the documents read now has
  `isNull(documents.deletedAt)` (the only documents read in that file).
- Checks after the follow-up: `npx tsc --noEmit -p .` clean; eslint 0 errors on the two files;
  vitest on `src/db/repositories/credentials`, the registrations pages and the 0029 repository
  tests pass (60 tests).
