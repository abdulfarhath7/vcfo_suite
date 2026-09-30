# Checklist, gating, visibility and the step catalog

Gotchas already paid for once. Append when something costs more than a minute to figure out.

## Sequential checklist gate

- Steps unlock only after the previous **active catalog** item is terminal-complete
  (`completed` / `not-applicable` / client submit / deliver). Save-draft does not unlock.
  A lead's **Request manager approval / Submit** (`lead_manager_request` + `reviewing`)
  does not either: the step reads `waiting` (“Waiting on your manager…” for the lead,
  “Waiting on your approval…” for staff) until the manager accepts. Green tick = accepted.
- Rejected or unlocked-for-correction steps re-lock everything after them.
- Helper: `src/lib/checklist-step-gate.ts`. Server save path: `patchChecklistItem`.
- Copy: “This opens after {title} is complete.” / “Waiting on the client…” — never “access denied”.
- Overdue badges only on the current (active/waiting) step, never on locked future steps.
- Client **Progress** nav (`/app/client/progress`) was removed; the gated catalog
  now lives as a Create-project-style flowchart on Incorporation. Old `/progress`
  URLs redirect there. Staff progress CC is unrelated to intern overview.

## Step visibility (who reads what)

- Policy is pure in `src/lib/checklist-visibility.ts` and applied **server-side** in
  every route that returns `checklist_state` (`checklistStateForViewer(ctx, state)` in
  the engagements repository, incl. `/api/checklist-index`). Do not add a route that
  returns the raw blob. Viewers: `lead` (intern, full) · `firm` (admin / manager /
  super_admin) · `client`.
- **Lead → firm** (`isStepReleasedToFirm`): a plain save is the lead's private draft —
  the manager sees no answers, no uploads, no tick — until Request approval / Submit,
  Deliver to client, a client submission, an accept, or completed / N/A.
  A pending `clientFillRequest` alone does not release (the manager still sees the
  request itself and can decide it from the step page).
- **Firm → client** (`isStepReleasedToClient`): a `lead_manager_request` is the client's
  only once `reviewStatus === 'accepted'`. Under review, rejected, or after the client's
  own change request it is redacted to `{ status, approval, clientFillRequest, … }` —
  review trail, lock and `clientSubmittedAt` stripped, a lingering `completed` becomes
  `in-progress` — so the gate reads it as not done. `change_requested` is not a release;
  `pending_client` / `client_approved` are. Redaction is idempotent (test-covered).
- Files follow the owning step: `listDocuments` / `getDocumentById` drop index rows on
  unreleased steps (`checklist_state -> step_id` in SQL, not the whole blob), and
  `/api/milestone-documents/signed-url` 403s by matching a path segment to a field.
- `patchChecklistItem` merges onto the **persisted** row only. The browser's `current`
  copy is accepted and ignored — it is redacted for that role and writing it back would
  wipe another party's data. `patchChecklistItemInDb` no longer sends it.
- Step page: manager on an unreleased step gets the `ClientStepFieldPreview` card with
  the "Your project lead is still preparing this step…" intro plus the review panel;
  client gets the same card until accepted, with only the approval status line
  ("Change requested") and no Approve / Request-a-change buttons.
- Still bypasses the manager on purpose: the incorporation-drafts **share** (pre-7 →
  client downloads) and board-resolution **finalize / Send to client** (pre-2).
  Everything else a lead fills reaches the client only through Accept.

## Company type: Dependent vs Independent

- `engagements.ownership_type` (`subsidiary` default | `independent`), migration 0018.
  Domain `OwnershipType` in `src/data/engagements.ts`; API `ownershipTypeSchema`.
- Create project: **Company type** is the first control in Entity details, above
  “Where should work start?”. Independent hides Parent company details, Subsidiary
  details (any stage) and the Parent entity origin picker (origin forced `domestic`,
  so FEMA/TP calendar rows never apply). `createProjectBodySchema` requires parent
  fields only for `subsidiary`; PATCH accepts `null` to clear them.
- Checklist for independent: pre-1 loses the parent-entity sections (Foreign Entity,
  Foreign Entity Proof, Authorized Signatory, Signatory KYC) and `boardResolutionDate`
  — `fieldsForOwnership` / `isParentEntityField` in `checklist-responses.ts`, applied
  in the form hook (`allFields`), `ClientStepFieldPreview`, rail attachments, and
  `validatePre1Responses(…, { independent })`. pre-2 / pre-3 (parent board
  resolution) are seeded `not-applicable` at creation (`PARENT_ENTITY_ONLY_STEP_IDS`).
- Gate: an N/A step reads `done` wherever it sits (was `locked` until the sequence
  reached it); `deriveChecklistDisplayStatus` returns `not-applicable` for every bucket.
- Editing an existing project to Independent clears parent fields but does not
  retro-mark pre-2/3 N/A — do that by hand if it matters.

## Part A (pre-1), NIC code, manager windows, lead compliance gate (CR 2026-09-15)

- **Part A sections** live in one helper: `src/lib/part-a-sections.ts` — `PART_A_SECTION_ORDER`
  (MCA order), `partAsectionsFor(ownershipType)`, `partAFieldsFor(fields, ownershipType)`,
  `isParentEntityField`. `fieldsForOwnership` in `checklist-responses.ts` delegates to it for
  pre-1 only. The form hook, client preview, rail attachments and completeness all read the
  returned field list; `validatePre1Responses(responses, { visibleFieldIds })` requires only
  what is rendered. Never hard-code a tab list or count.
- Parent entity (name / reg no. / address / trademark / proof) is captured in Part A only
  (Dependent). The create/edit project form no longer asks it; `createProjectBodySchema`
  treats `parentEntityName/Address` as optional seeds. Generators still read
  `resolveParentEntity*` (Part A first, engagement row fallback).
- **NIC**: `nicCode` (5 digits, required, `PRE1_BASE_REQUIRED_TEXT_IDS`), `nicBusinessType`
  auto-filled in `setField` from `src/lib/nic-2008.ts` (1,302 sub-classes, official MSME PDF
  parse — `src/data/nic-2008.json` is `[code, subclass, class]`). Unknown code = warning, not
  error. `nicBusinessType` renders read-only (like pre-5 expiry) and is stored in responses.
- **Windows**: `src/lib/schedule-windows.ts` (`windowForStep`, `applyScheduleWindow`,
  `formatWindow`, `canSetScheduleWindows`). Repo `src/db/repositories/schedule.ts`
  (`setEngagementWindow`, `setComplianceInstanceWindow`; manager/admin/super only, throws
  otherwise). Routes `POST /api/engagements/:id/schedule`, `POST /api/filings/:id/window`.
  `engagements.schedule` jsonb (own column — `normalizeEngagementChecklistState` would treat a
  `schedule` key as a step) + `compliance_instances.window_*` (migration 0019; outside the
  regeneration upsert SET clause). UI: `ScheduleWindowControl` (writers) /
  `ScheduleWindowMeta` (readers); incorporation window on staff project page, step windows on
  non-Part-A/B staff step pages, compliance windows in the Filings register Window column.
  Today filings join DB windows by `${engagementId}:${obligationId}:${dueDate}:${periodLabel}`
  (= the client-side filing id). After a save, invalidate `['engagements']` / `['filings']`.
  SLA "Typically takes N working days" (client next-action) is gone; the window shows instead.
- **Lead compliance gate**: `isIncorporated` now also true when `stage !== 'Pre-Incorporation'`.
  `complianceEngagementsForRole('intern', …)` filters to incorporated engagements — used by the
  sidebar (Compliances group hidden when empty), `useInternPortfolio` (filings on Today), and
  `CompliancePages` (redirect to `/app/intern/today` when the lead has none). Other roles untouched.
- Cross-tenant repository tests for the schedule accessor remain in the deferred bucket
  (DB-backed tests are run manually — see STATE.md).

## SPICe+ Part B restructure (2026-09-16)

- Repeating lists (`type: 'repeat'`) live inside the step's flat `responses`, not a new column: `responses[groupId]` is the comma-joined ordered entry-id list and each answer is `responses["group.entryId.field"]`. Entry ids are `e` + 8 hex. Removing an entry writes `''` to its keys (the patch merge keeps unknown keys, so a delete must be an explicit blank). Never key anything by entry index — ids survive reorders and removals.
- `showWhen` / `labelWhen` inside an entry template name the *sibling* relative id; `expandRepeatEntry` re-points them to the concrete dotted id. Call `applyShowWhen` then `resolveFieldLabels` on the expanded fields wherever they render (editor, read-only record, repeat cards, attachments).
- Repeat-group errors: min/max on the group id, per-field on the dotted id. Section completion treats a group as pending when any error key equals the group id or starts with `${groupId}.`.
- `pre-6` Director KYC stays in the `checklist` array (labels, vault, old responses) but is in no phase — same pattern as `reg-2`. Do not delete it; `readProposedDirectors` needs it to rebuild pre-restructure engagements.
- Generators still consume the legacy `pre1` / `pre6` shapes. Do not pass raw step responses to them — go through `directorResponsesFromState(state)`, which overlays `pre-15` entries (as `director{n}*` and `residentDirector*` / `nrDirector*` slots) and `pre-14` registered office. `directorsAccepted` in `incorporation-docs-errors.ts` is the acceptance gate (pre-15 accepted with entries, else legacy pre-6 accepted).
- `pre-14` seeds once from `engagement.subsidiaryRegisteredAddress` (else legacy pre-6 / pre-8) via `updateItem(..., { clientResponsesOnly: true })`, gated on the form being open (`contentReady`) so a partial checklist load cannot wipe a saved address.
- `pre-16` submits validly with zero subscribers — "No subscribers to add" is a real terminal path, not a missing-field state. `minEntries: 0` + `emptyLabel`.
- Pre-8 file labels carry MCA form numbers (INC-33 MOA, INC-34 AOA, INC-35 AGILE-PRO-S) but the field ids did not change; stored uploads and `PRE8_REQUIRED_FILE_IDS` keep resolving.
