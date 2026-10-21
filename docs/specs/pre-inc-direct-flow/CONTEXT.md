# PRE-INC DIRECT FLOW — build context for Claude Code

Put this file at `docs/specs/pre-inc-direct-flow/CONTEXT.md`.
Start prompt: `Read docs/specs/pre-inc-direct-flow/CONTEXT.md and do all phases in sequence.`

Written 2026-10-12 against commit `723829e` (`docs(ask-vcfo): record production switch-on`).
If `HEAD` is different, do the Phase 0 audit before you trust a file path or a line number.

---

## 0. Global rules

1. Read `CLAUDE.md`, `docs/context/STATE.md` and `docs/context/notes/checklist-workflow.md`, `notifications.md`, `email.md`, `lead-ui.md` first.
2. Read the Next.js guide in `node_modules/next/dist/docs/` before you write route or page code.
3. The repository seam is a hard rule. Only `src/db/repositories/*` imports `db`. Views call API routes. API routes call repositories.
4. Each repository function takes an `AuthContext` and limits data by role.
5. Never show the word "intern" to a user. The UI label is "Project Lead".
6. No new database table. No migration. All new state goes into `engagements.checklist_state` (jsonb).
7. A new key on a step slice has three mandatory edits in `src/lib/checklist/checklist-state-key.ts`: `ITEM_META_KEYS`, `ChecklistItemStateSlice`, and the object that `normalizeChecklistItemSlice` returns. If one edit is missing, the key is silently deleted on the next save.
8. Do not change post-incorporation, registration, FEMA or compliance behaviour. All new rules apply only to the step ids in section 3.
9. Do not change `src/data/checklist.ts` step ids, order or phases.
10. Do not show a board resolution draft to a client. Do not send an email or a notification on autosave.
11. Verification gate after each phase:
    ```bash
    npx tsc --noEmit > /tmp/tc.log 2>&1; grep -c "error TS" /tmp/tc.log   # must print 0
    npx vitest run --reporter=dot
    npm run lint
    ```
12. Commit after each green phase with the commit message given in the phase. Do not stop for permission between phases.
13. If the code is different from this file, the code is correct. Record the difference in the final report and continue with the intent of the decision.
14. When a decision is not in this file, use the option that changes the fewest files, and record it in the final report.

---

## 1. Goal

| # | Outcome |
|---|---|
| G1 | In pre-incorporation, the client and the project lead can fill and submit each step. |
| G2 | Only the project lead can fill the NIC codes. The client sees the NIC codes as read-only text. |
| G3 | Pre-incorporation has one approval only: the manager approves the board resolution (BR) and its data. After approval, the BR goes to the client. |
| G4 | Each submit sends a bell notification to all people on the engagement. |
| G5 | A user can open the next section and the next step. A user cannot submit while a required field is empty. Each empty required field shows a red border. |
| G6 | The project lead can add more than one NIC code with an "Add NIC code" button. |
| G7 | The client dashboard shows directors, authorised share capital, paid-up share capital, share classes and subscribers. |

---

## 2. Repository facts (read on 2026-10-12)

These facts replace the older text in the Claude Project file `CLAUDE-CONTEXT.md`.

| Topic | Fact | Where |
|---|---|---|
| Active pre-incorporation steps | Part A: `pre-1` to `pre-5`. Part B: `pre-13`, `pre-14`, `pre-15`, `pre-16`, `pre-7`, `pre-9`, `pre-10`, `pre-11`, `pre-12`. `pre-6` and `pre-8` are legacy and are in no phase. | `src/data/checklist.ts` `PRE_INC_PHASES` |
| NIC code | `nicCode` (5 digits, required) and `nicBusinessType` (derived) are in `pre-1`, section "Business Description". This is the "Name Application" phase. | `src/lib/checklist/checklist-responses.ts`, `src/lib/checklist/checklist-pre1-validation.ts`, `src/lib/incorporation/nic-2008.ts` |
| Client edit | The client cannot edit a step today. `isMilestoneFormReadOnly` returns true for `variant === 'client'`. | `src/lib/checklist/checklist-field-access.ts` |
| Client fields | `filterFieldsByViewer` removes each `filledBy: 'intern'` field from the client form. | `src/lib/checklist/checklist-field-access.ts` |
| Server | `POST /api/engagements/:id/checklist` accepts client `responses`. `POST …/checklist/submit` accepts only the client role. No server route does step validation. | `app/api/engagements/[id]/checklist/**` |
| Approvals today | Four mechanisms: lead request to manager (`lead_manager_request`), manager Accept / Reject (`reviewChecklistItem`), client Approve / Request a change (`approval` sub-state), "Request client to fill" (`clientFillRequest`). | `src/lib/checklist/checklist-item-review.ts`, `checklist-step-approval.ts`, `checklist-client-fill.ts`, `src/db/repositories/engagements.ts` |
| Visibility | A lead draft is hidden from the firm until the lead requests approval. A step is hidden from the client until the manager accepts. | `src/lib/checklist/checklist-visibility.ts` |
| Gate | `gateChecklistSteps` gives edit access to one owner party for each step. The lead can open and edit all steps. | `src/lib/checklist/checklist-step-gate.ts` |
| Accept side effects | Manager Accept sets `status: 'completed'`, `deliveredToClientAt`, copies `dateOfIncorporation` from `pre-12` to the engagement, and starts the WhatsApp `coi_issued` message for `pre-12`. | `reviewChecklistItem`, `src/lib/email/notify-engagement-event.ts` |
| BR | One row for each engagement in `engagement_board_resolutions`, status `draft` or `finalized`. The lead can finalize with no manager. Finalize releases the BR to the client. | `src/db/repositories/board-resolution.ts`, `app/api/engagements/[id]/board-resolution/finalize/route.ts` |
| BR generation checks | Generation stops when `pre-1` is not submitted (`STEP1_INCOMPLETE`) or when a field is missing (`MISSING_FIELDS`). NIC code is not in the missing-field list. | `src/lib/api/board-resolution-errors.ts` |
| BR and empty NIC | When `nicCode` is empty, the BR prints `DEFAULT_NIC_CODES` (62099 and 62020). This is a silent wrong value. | `src/lib/board-resolution/board-resolution.ts` `resolveNicCodesClause` |
| BR for manager | A manager cannot open the BR editor. The `pre-2` panel shows status text only. | `src/components/incorporation/Phase1StepPanelRoutePanels.tsx` |
| Form errors | Red border classes exist (`border-danger`). They show only after a failed lead Submit. Tabs have no error marker. `FormErrorSummary` is off in the tab layout (`SHOW_INTERN_FORM_ERROR_SUMMARY = false`). There is no `aria-invalid`. "Request manager approval" does no validation. | `src/views/incorporation/*` |
| Validators | `runStepValidation` is an if-chain in `src/views/incorporation/milestone-response-form-utils.ts`. A copy is in `useMilestoneResponseFormState.tsx`. Steps with no validator return `ok: true`. | same |
| Repeat lists | `type: 'repeat'` exists. Storage: `responses[groupId] = "e1a2b3c4,e5f6a7b8"` and `responses["groupId.entryId.fieldId"]`. Used by `pre-15` `directors` and `pre-16` `subscribers`. | `src/lib/checklist/checklist-repeat.ts`, `src/views/incorporation/RepeatGroupEditor.tsx` |
| Notifications | Bell rows are made on the server in `notifyEngagementEvent`. The `notifications` table has no actor column. The payload is JSON in `description`. | `src/lib/email/notify-engagement-event.ts`, `src/db/repositories/notifications.ts` |
| Recipients | `resolveEngagementRecipients` returns all clients, leads, managers, firm admins and progress-CC addresses. | `src/db/repositories/engagement-recipients.ts` |
| Client dashboard | Home is `/app/client/overview`. It shows no directors, capital or subscribers. | `src/views/client/Overview.tsx`, `src/lib/client/client-overview.ts`, `src/db/repositories/client-overview.ts` |
| Data for the dashboard | Capital: `pre-1` `authorisedShareCapital`, `paidUpShareCapital`, `nominalValuePerEquityShare`. Share classes: `pre-13`. Directors: `readProposedDirectors(state)` in `src/lib/incorporation/proposed-directors.ts`. Subscribers: `pre-16` repeat group `subscribers`. | `src/lib/checklist/checklist-responses.ts` |

---

## 3. Decisions

### 3.1 One policy module

Make `src/lib/incorporation/pre-inc-direct-flow.ts` (pure, no imports from `src/db` or `src/views`). All other files read the policy from this module. Do not write a step id list in a second file.

```ts
/** Steps that the client and the project lead fill and submit with no approval. */
export const DIRECT_FLOW_STEP_IDS: ReadonlySet<string>;
// 'pre-1','pre-3','pre-4','pre-5','pre-13','pre-14','pre-15','pre-16','pre-7','pre-9','pre-10','pre-11','pre-12'

/** The only pre-incorporation step that keeps lead -> manager approval. */
export const MANAGER_APPROVAL_STEP_ID = 'pre-2';

/** Fields that only the project lead can edit. The client reads them. */
export const LEAD_ONLY_FIELD_IDS: Readonly<Record<string, readonly string[]>>;
// { 'pre-1': ['nicCode', 'nicBusinessType', 'additionalNicCodes'] }

/** Whole steps that only the project lead can edit. Empty by owner decision. */
export const LEAD_ONLY_STEP_IDS: ReadonlySet<string>; // new Set()

export function isDirectFlowStep(itemId: string): boolean;
export function isLeadOnlyField(itemId: string, fieldId: string): boolean; // also true for 'additionalNicCodes.<entry>.<field>'
export function canRoleEditField(role: string, itemId: string, fieldId: string): boolean;
export function stripLeadOnlyResponses(itemId: string, responses: Record<string, string>): Record<string, string>;
export function directSubmitPatch(input: { actorId: string; actorName?: string; actorRole: string; now: string }): Partial<ChecklistItemStateSlice>;
export function waitingOnLeadPatch(input: { actorId: string; actorName?: string; now: string }): Partial<ChecklistItemStateSlice>;
export function isAwaitingManagerDecision(itemId: string, slice?: ChecklistItemStateSlice | null): boolean;
```

### 3.2 Who can edit

| Role | Direct-flow step | `pre-2` (BR) |
|---|---|---|
| Client | Edit all fields but lead-only fields. Submit. | Read the BR after manager approval only. |
| Project lead | Edit all fields. Submit. Reopen. | Generate, edit, send for manager approval. |
| Manager, admin, super admin | Read. Reopen. No Accept / Reject. | Approve or send back. |

- `filledBy: 'intern'` no longer hides a field on a direct-flow step. The client sees all fields of the step.
- A lead-only field shows to the client as a read-only record row with the helper text "Your project lead fills this."
- The server must enforce the rule. For the client role, `POST …/checklist` and `POST …/checklist/submit` remove lead-only keys with `stripLeadOnlyResponses` before the merge.

### 3.3 Submit (the new terminal action)

Extend `submitChecklistItem` and `POST /api/engagements/:id/checklist/submit`.

| Caller | Step | Behaviour |
|---|---|---|
| Client or lead | Direct-flow | New behaviour, below. |
| Lead | `pre-2` | Section 3.5. |
| All others | All other steps | Current behaviour. No change. |

New behaviour for a direct-flow step:

1. Merge the sent `responses` on the persisted row (after `stripLeadOnlyResponses` for a client).
2. Do server validation on the merged responses (section 3.6).
3. If a field that the caller can edit has an error: return HTTP 422 `{ error: 'validation_failed', fieldErrors }`. Save nothing but the responses.
4. If the caller is a client and the only errors are on lead-only fields: write `waitingOnLeadPatch`. The step is not complete. The client form becomes read-only. Gate message for the client: "Waiting on your project lead…". Gate kind for the lead: `active`.
5. If there are no errors: write `directSubmitPatch`. The step is complete.

`directSubmitPatch` writes:

```ts
{
  status: 'completed',
  completedOn: now.slice(0, 10),
  locked: true,
  unlockedFields: [],
  clientSubmittedAt: now,          // keeps isPre1SubmittedForBoardResolution true
  deliveredToClientAt: now,        // the step is shared with all parties
  reviewStatus: 'accepted',        // keeps progress boards and the gate green
  reviewSource: undefined,
  reviewedAt: now,
  reviewedBy: actorId,
  rejectionNote: undefined,
  submittedByName, submittedByRole // new slice keys, see rule 0.7
}
```

Do not write `approval` or `clientFillRequest` on a direct-flow step.

Side effects that move from manager Accept to this submit:

| Side effect | Condition |
|---|---|
| Copy `dateOfIncorporation` to `engagements.incorporationDate` | `pre-12` |
| WhatsApp `coi_issued` to clients | `pre-12` |

### 3.4 Reopen after submit

| Who | How | Result |
|---|---|---|
| Lead, manager, admin | Existing unlock route (`unlockChecklistFields`), button label "Reopen step" | All fields open again. Status `in-progress`. Steps after this step lock again through the existing gate rule. |
| Client | Existing "Request a change" (`clientRequestStepChange`) | Same reopen. A task is made for the firm. |

Change `clientRequestStepChange`: for a direct-flow step, the precondition is "the step is complete". The `approval` state is not read.

### 3.5 The one approval: board resolution (`pre-2`)

Keep the existing lead-to-manager mechanism on `pre-2`. Do not make a new state machine.

| Step | Actor | Action | State written |
|---|---|---|---|
| 1 | Lead | Clicks "Generate". Generation checks run (section 3.7). | BR row `draft` |
| 2 | Lead | Clicks "Send for manager approval". Precondition: the BR file exists and the generation checks pass. | `pre-2` slice gets `internLeadManagerRequestPatch`. BR row stays `draft`. |
| 3 | Manager / admin | Opens `pre-2`. Sees the BR preview, a download link, and the `pre-1` data as a read-only record. | none |
| 4a | Manager / admin | Clicks "Approve and send to client". | `finalizeBoardResolution` + the current `pre-2` patch from the finalize route (`completed`, `deliveredToClientAt`, `boardResolutionSharedAt`) + `reviewStatus: 'accepted'`. No `approval` sub-state. |
| 4b | Manager / admin | Clicks "Send back" with a note (mandatory). | `reviewStatus: 'rejected'`, `rejectionNote`. BR row stays `draft`. The lead can edit again. |

Rules:

- `POST …/board-resolution/finalize`: roles `manager`, `admin`, `super_admin` only. It fails with HTTP 409 when `pre-2` is not pending a manager decision. Remove the lead "Finalize for client" / "Send to client" button. Put "Send for manager approval" in its place.
- While `pre-2` is pending, `saveBoardResolutionDraft` and the generate route refuse a change from the lead ("The board resolution is with your manager.").
- `reviewChecklistItem` for `pre-2` calls the same finalize function. Thus Accept in the Approvals inbox and "Approve and send to client" on the step do the same thing.
- A "Send back" on `pre-2` must not send an email or a bell row to a client.
- An independent company has `pre-2` and `pre-3` as `not-applicable`. It has no approval at all.

Manager view of `pre-2` (new UI in `Phase1StepPanelRoutePanels.tsx`): reuse `BoardResolutionDocPreview` and the read-only record renderer. Do not open the lead editor to the manager.

### 3.6 Missing-field behaviour

Make `src/lib/checklist/checklist-step-validation.ts`. Move `runStepValidation` there. The form hook and the server both import it. Delete the copy in the hook.

| Rule | Detail |
|---|---|
| Validator choice | Use the step validator when one exists. Add `validateInternDelivery` for `pre-4` and `pre-5`. For a step with no validator, each visible field with `required === true` must have a value. |
| Visible fields | Apply `fieldsForOwnership`, `applyShowWhen` and repeat expansion before the required check. A hidden field never blocks. |
| Section tabs | Tab click and "Next" always move. No block. |
| Next step | The client can open a locked later step. The form is read-only and shows "This opens after {title} is complete." The server keeps `sequentialLockMessage` for client writes. |
| Submit with errors | No submit. Each field with an error gets `border-danger`, the error text, and `aria-invalid="true"` with `aria-describedby`. |
| Tab marker | Each tab with an error gets a red dot and the text "Needs attention" for screen readers. |
| Error summary | Set `SHOW_INTERN_FORM_ERROR_SUMMARY` to true for the tab layout. Each line is a button that opens the tab and moves focus to the field. |
| Live errors | Before the first Submit, show errors only for tabs that the user left with "Next". After a failed Submit, show errors for all tabs and update them on each change. |
| Server 422 | Map `fieldErrors` from the server to the same display. |

The same form behaviour applies to the client and the lead.

### 3.7 Board resolution generation checks

In `src/lib/api/board-resolution-errors.ts`:

1. Add the NIC code to `collectBoardResolutionMissingFields` (label "NIC code").
2. Add `missingFieldRefs: Array<{ stepId: string; fieldId: string; section?: string; label: string }>` to `BoardResolutionError` and to the API error body. Keep `missingFields: string[]`.
3. `resolveNicCodesClause` keeps `DEFAULT_NIC_CODES` only for a document that is already stored. A new generation never uses the default, because check 1 stops it.

In the BR editor (`src/views/intern/BoardResolutionEditorView.tsx`): show `missingFieldRefs` as a list. Each line is a link to the step and section that has the field. Example: "NIC code — Client Details, Business Description".

Also change the `STEP1_INCOMPLETE` text to: "Submit Client Details first. The board resolution uses this data."

### 3.8 Multiple NIC codes

| Item | Decision |
|---|---|
| Main code | Keep `nicCode` and `nicBusinessType`. No change to stored data. Label: "Main NIC code". |
| More codes | New repeat field in `pre-1`, section "Business Description", after `nicBusinessType`: `id: 'additionalNicCodes'`, `type: 'repeat'`, `entryLabel: 'NIC code'`, `minEntries: 0`, `maxEntries: 9`, `emptyLabel: 'No additional NIC codes.'`. |
| Entry fields | `code` (text, short, required, 5 digits) and `businessType` (derived, read-only). |
| Do not use the id `nicCodes` | `pre1.nicCodes` is an old free-text key that `resolveNicCodesClause` reads. |
| Auto-fill | In `setField`, when the id is `additionalNicCodes.<entry>.code`, fill `additionalNicCodes.<entry>.businessType` from `nicBusinessType()`. Give the input `inputMode="numeric"`, `maxLength={5}`. |
| Validation | Each code: 5 digits (error). Code not in NIC-2008 (warning). A code equal to the main code or to a second entry (error "This NIC code is already in the list."). |
| Reader | Add `readNicCodes(pre1): Array<{ code: string; description: string }>` to `src/lib/incorporation/nic-2008.ts`. Main code first. |
| BR | `resolveNicCodesClause` joins all codes: `62011- Description, & 62020- Description` (same format as `DEFAULT_NIC_CODES`). |
| Assist profile | `src/lib/assist-profile/build.ts` and `types.ts`: keep `company.nicCode`. Add `company.additionalNicCodes`. Update the parity test. |
| Other documents | Search `src/lib/incorporation-docs/` and `src/lib/doc-pack/` for a NIC or main-object placeholder. If one exists, use `readNicCodes`. |
| Access | All three field ids are lead-only (section 3.1). |

### 3.9 Visibility

In `src/lib/checklist/checklist-visibility.ts`: a direct-flow step is released to the firm and to the client at all times. Drafts are shared, because both parties fill the step.

- Keep the redaction of the slice key `notes` (staff notes) for the client.
- `pre-2` keeps the current rules.
- Documents follow the step, as today (`listDocuments`, `/api/milestone-documents/signed-url`).

### 3.10 Gate

In `src/lib/checklist/checklist-step-gate.ts`, for a direct-flow step:

| Viewer | Current step | Later step |
|---|---|---|
| Client | `active`, `canEdit: true`. After `waitingOnLeadPatch`: `waiting`, `canEdit: false`. | `locked`, `canOpen: true`, `canEdit: false` |
| Lead | `active`, `canEdit: true` | open and editable (no change) |
| Manager / admin | `canOpen: true`, `canEdit: false` | no change |

### 3.11 Approvals removed from direct-flow steps

Hide these on a direct-flow step. Keep them on all other steps.

| Surface | File |
|---|---|
| "Request manager approval" / "Email manager again" | `src/components/admin/RequestManagerApproval.tsx` and its 4 mounts |
| Accept / Reject panel | `src/components/admin/ChecklistReviewActions.tsx` |
| "Request client to fill" | `src/components/admin/RequestClientFill.tsx` |
| Client "Approve" | `src/components/client/ClientStepApproveButton.tsx` |
| `step_awaiting_client_approval` and `phase_approved` emails | `notify-engagement-event.ts`, `app/api/client/steps/[stepId]/approve/route.ts` |

Server: `requestClientFill`, `decideClientFillRequest`, `clientApproveStep` and `reviewChecklistItem` refuse a direct-flow step with a clear error.

Every reader of a pending manager decision must use `isAwaitingManagerDecision(itemId, slice)`. It returns false for a direct-flow step. Readers: `src/lib/projects/pending-approvals.ts`, `src/lib/projects/project-stuck.ts`, `src/lib/intern/intern-work.ts`, `src/lib/intern/intern-dashboard.ts`, `src/lib/client/client-progress-board.ts`, `src/views/admin/FirmDashboard.tsx`, `src/lib/ask/tools/staff.ts`.

### 3.12 Steps that are in approval now (old data)

No database migration. Use read-time rules for a direct-flow step:

| Stored state | Reads as |
|---|---|
| `reviewStatus: 'accepted'` or `status: 'completed'` | complete (no change) |
| Lead request pending (`reviewing` + `lead_manager_request`) | complete |
| Client submit pending (`reviewing` + `client_submission`) | complete |
| `reviewStatus: 'rejected'` or `unlockedFields` not empty | open for edit (no change) |
| `approval` in any state, `clientFillRequest` in any state | ignored |

Put these rules in `isChecklistStepSequentiallyComplete` through the policy module. Add a test for each row.

### 3.13 Notifications

New event `step_submitted` for a direct-flow step. It replaces `client_submitted` and `lead_requested_review` on these steps.

| Event | Fired by | Bell | Email | WhatsApp |
|---|---|---|---|---|
| `step_submitted` | Submit that completes a direct-flow step | All clients, leads, managers and firm admins. Not the actor. | Client actor: Resend to leads and managers. Staff actor: direct send to clients, CC managers. | `coi_issued` for `pre-12` only |
| `step_waiting_on_lead` | Client submit that waits for lead-only fields | Leads and managers | Resend to leads | none |
| `step_reopened` | Reopen (section 3.4) | All clients, leads, managers and firm admins. Not the actor. | none | none |
| `lead_requested_review` (existing) | Lead sends the BR for approval | Managers and firm admins | Managers (existing path) | none |
| `board_resolution_shared` (existing) | Manager approves the BR | All clients, leads, managers and firm admins | Clients (existing path) | none |
| `review_rejected` on `pre-2` | Manager sends the BR back | Leads only | Resend to leads only | none |

- Bell text format: title `{Step title} submitted`, body `{Actor name} ({Client | Project Lead}) submitted this step for {Company}.` Put the actor name in the body. Do not add a column.
- Use the existing notification kinds (`checklist.submit`, `checklist.review`, `checklist.unlock`). Add a kind only if no existing kind fits.
- Each recipient gets the `href` for their own shell (client, lead, staff). Follow the pattern that `review_accepted` uses for admins.
- Autosave sends nothing. Keep the guard in `lead-manager-request-notify.ts`. Add a test that a client autosave on a direct-flow step sends nothing.
- A WhatsApp failure must never change the email path.

### 3.14 Client dashboard: Company snapshot

| Item | Decision |
|---|---|
| Component | New `src/components/client/overview/ClientCompanySnapshot.tsx`, built with `ClientCard`. |
| Position | In `src/views/client/Overview.tsx`, main column, first card, before `ClientPhaseBars`. Shown before and after incorporation. |
| Data | Add `company` to `ClientOverview` in `src/lib/client/client-overview.ts`. Build it in `src/db/repositories/client-overview.ts` from the state after `checklistStateForViewer`. |
| Design | Do the design-system audit in `docs/context/notes/design-system.md` first. Use existing tokens and `ClientCard`. No new colours. |

```ts
company: {
  directors: Array<{ name: string; indiaResident: boolean | null; din: string | null }>;
  capital: {
    authorised: string | null;        // pre-1 authorisedShareCapital
    paidUp: string | null;            // pre-1 paidUpShareCapital
    nominalValue: string | null;      // pre-1 nominalValuePerEquityShare
    shareClasses: Array<{ kind: 'equity' | 'preference'; quantity: string; nominalValue: string; total: string }>; // pre-13
  };
  subscribers: Array<{ name: string; shares: string | null }>; // pre-16
  links: { directors: string; capital: string; shareClasses: string; subscribers: string }; // step URLs
}
```

| Block | Empty state | Link label |
|---|---|---|
| Board of directors | "No directors added yet." | "Add directors" or "View directors" |
| Share capital | "Not entered yet." | "Enter share capital" or "View share capital" |
| Subscribers | "No subscribers added yet." | "Add subscribers" or "View subscribers" |

Show amounts as INR with Indian digit grouping. No new step and no new step field is necessary: the data is in `pre-1`, `pre-13`, `pre-15` and `pre-16`.

---

## 4. Phases

Each phase has a preservation list. Do not change an item on the list.

### Phase 0 — Audit (no code change)

1. Confirm each row of section 2 against the code.
2. List each file that reads `reviewStatus`, `reviewSource`, `approval`, `clientFillRequest`, `isAwaitingReview`, `isLeadRequestPending`, `approvalStateOf`, `filledBy`, `isMilestoneFormReadOnly`, `filterFieldsByViewer`.
3. Write the list and each difference from section 2 to `docs/specs/pre-inc-direct-flow/AUDIT.md`.

Commit: `docs(pre-inc): audit for direct flow`

### Phase 1 — Policy module and shared validation

1. Add `src/lib/incorporation/pre-inc-direct-flow.ts` with tests (`pre-inc-direct-flow.test.ts`).
2. Add `src/lib/checklist/checklist-step-validation.ts`. Move `runStepValidation`. Add the generic required check. Remove the copy in the hook.
3. Add the new slice keys (rule 0.7).

Preserve: all validator results for current test fixtures. `src/data/checklist.ts`.

Commit: `feat(pre-inc): direct-flow policy and shared step validation`

### Phase 2 — Multiple NIC codes and BR generation checks

1. Section 3.8.
2. Section 3.7.

Preserve: stored `nicCode` and `nicBusinessType` values. BR legal wording. A finalized BR file.

Tests: `checklist-pre1-validation.test.ts`, `nic-2008.test.ts`, `board-resolution.test.ts`, `board-resolution-errors.test.ts`, `assist-profile/build.test.ts`, `assist-profile/parity.test.ts`.

Commit: `feat(pre-inc): multiple NIC codes and NIC check before BR generation`

### Phase 3 — Missing-field display

Section 3.6, form side only (lead form).

Preserve: autosave timing (600 ms) and payload. Section order from `part-a-sections.ts`. The record layout for read-only viewers.

Tests: `milestone-response-form-utils.test.ts`, `milestone-section-completion.test.ts`, `intern-section-tab-strip.test.ts`. Add a component test for the red border, the tab marker and the summary links.

Commit: `feat(pre-inc): show missing fields on tabs, fields and summary`

### Phase 4 — Client and lead fill and submit

1. Sections 3.2, 3.3, 3.4, 3.9, 3.10.
2. Client step page: the editable form for a direct-flow step. Autosave for the client uses the existing client path.
3. File upload: confirm that `app/api/engagements/[id]/milestone-documents/route.ts` accepts a client upload for each file field of a direct-flow step that is not lead-only.
4. Show "Last edited by {name} ({role}), {time}" under the step title. Write `lastEditedAt`, `lastEditedByName`, `lastEditedByRole` on each save.

Preserve: `patchChecklistItem` merges on the persisted row only. `sequentialLockMessage` for client writes. `pre-2` rules. All post-incorporation and registration behaviour.

Tests: `checklist-step-gate.test.ts`, `checklist-visibility.test.ts`, `checklist-field-access.test.ts`, `checklist-item-review.test.ts`, `client-progress-board.test.ts`, `client-overview.test.ts`, `step-approval-scope.test.ts`. Add a cross-tenant test: a client of engagement A cannot submit a step of engagement B. Add a test: a client patch cannot write `nicCode` or `additionalNicCodes.*`.

Commit: `feat(pre-inc): client and project lead fill and submit steps directly`

### Phase 5 — Remove approvals, add BR manager approval

1. Sections 3.5, 3.11, 3.12.
2. Approvals inbox (`src/views/admin/ApprovalsInbox.tsx`): a `pre-2` row shows the kind "Board resolution".

Preserve: the client never reads a BR draft. `repairBoardResolutionStorage`. The signed-copy upload (`pre-3`). Approvals for post-incorporation and registration steps.

Tests: `pending-approvals`, `intern-work.test.ts`, `intern-dashboard.test.ts`, `checklist-step-approval.test.ts`, `checklist-client-fill.test.ts`, `tests/ask/evals/golden.ts` (the `listPendingApprovals` tool). Add tests: a lead cannot finalize; finalize fails when `pre-2` is not pending; "Send back" notifies no client; each row of section 3.12.

Commit: `feat(pre-inc): one approval only, manager approves the board resolution`

### Phase 6 — Notifications

Section 3.13.

Preserve: no notification on autosave. The WhatsApp path stays additive. Events for steps that are not direct-flow.

Tests: `engagement-event-fanout.test.ts`, `lead-manager-request-notify.test.ts`, `checklist-notifications.test.ts`. Add a table test for each row of section 3.13.

Commit: `feat(pre-inc): notify all engagement parties on each submit`

### Phase 7 — Client dashboard

Section 3.14.

Preserve: the current card order for all other cards. `Overview.test.tsx` cases.

Tests: extend `Overview.test.tsx`, `client-overview.test.ts`, `client-overview-modules.test.tsx`.

Commit: `feat(client): company snapshot with directors and share capital`

### Phase 8 — Documents and final check

1. Update `docs/context/notes/checklist-workflow.md` (new section "Pre-incorporation direct flow"), `notifications.md`, `email.md`, `lead-ui.md`, `STATE.md`.
2. Update Ask VCFO help text that describes pre-incorporation approvals: `src/data/ask/field-help.ts`, `src/data/ask/suggestions.ts`, `src/data/ask/glossary.ts`.
3. Do the full gate. Then do the manual check in section 5.
4. Write `docs/specs/pre-inc-direct-flow/REPORT.md`: what changed, each difference from this file, each decision under rule 0.14, each test that was changed and why.

Commit: `docs(pre-inc): record direct flow and close the spec`

---

## 5. Manual check (seed logins)

| # | Login | Action | Expected result |
|---|---|---|---|
| 1 | client | Open Client Details. Click "Next" on each tab with empty fields. | Each tab opens. Tabs with empty required fields show a red dot. |
| 2 | client | Click Submit with an empty required field. | No submit. Red borders. Summary list with links. |
| 3 | client | Look at the NIC fields. | Read-only. Text "Your project lead fills this." |
| 4 | client | Fill all client fields. Submit. | Step shows "Waiting on your project lead…". Lead and manager get a bell row. |
| 5 | intern | Open Client Details. Click "Add NIC code" two times. Enter a code that is already in the list. | Two rows. Error on the equal code. |
| 6 | intern | Enter valid codes. Submit. | Step complete. Client, manager and admin get a bell row with the lead name. |
| 7 | intern | Open the BR editor on a second project with no NIC code. Click Generate. | No BR. List shows "NIC code" with a link to the field. |
| 8 | intern | Generate the BR on the first project. Click "Send for manager approval". | BR locked for the lead. Manager gets a bell row and an email. |
| 9 | client | Open the board resolution page. | "Not available yet". |
| 10 | manager | Open Approvals. Open the "Board resolution" row. | BR preview, download link and Client Details data show. |
| 11 | manager | Click "Send back" with a note. | Lead gets the note. Client gets nothing. |
| 12 | intern, then manager | Send again. Manager clicks "Approve and send to client". | Client sees the BR. All parties get a bell row. All NIC codes are in the BR text. |
| 13 | client | Open the next steps one at a time and submit each. | No Approve button. No manager Accept is necessary. |
| 14 | manager | Open Approvals after step 13. | No row for a direct-flow step. |
| 15 | client | Open Home. | Company snapshot shows directors, authorised capital, paid-up capital and subscribers with links. |
| 16 | manager | Open a post-incorporation step. | Accept / Reject and "Request manager approval" work as before. |

---

## 6. Do not do

- Do not add a table, a column or a migration.
- Do not show a BR draft to a client.
- Do not send an email or a bell row on autosave.
- Do not remove the client sequence lock on the server.
- Do not change approvals outside the pre-incorporation steps in section 3.1.
- Do not write a step id list outside `src/lib/incorporation/pre-inc-direct-flow.ts`.
- Do not import `db` in a view, a component or a `src/lib` file.
- Do not delete `pre-6`, `pre-8` or `reg-2` from the catalog.
