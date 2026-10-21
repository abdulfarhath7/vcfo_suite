# Pre-incorporation direct flow — Phase 0 audit

Read on 2026-10-12 against `723829e` (the commit `CONTEXT.md` was written for).
`HEAD` matched, so the file paths in `CONTEXT.md` were checked as written.

## 1. Section 2 facts, checked

| Topic | Result | Note |
|---|---|---|
| Active pre-incorporation steps | confirmed | `PRE_INC_PHASES` in `src/data/checklist.ts`: Part A `pre-1`…`pre-5`, Part B `pre-13, pre-14, pre-15, pre-16, pre-7, pre-9, pre-10, pre-11, pre-12`. `pre-6` and `pre-8` are in no phase. |
| NIC code | confirmed | `nicCode` (required, 5 digits) and `nicBusinessType` (derived) in `pre-1`, section "Business Description". Auto-fill in `setField` (`useMilestoneResponseFormState.tsx`). Unknown code is a warning. **Difference:** neither field carries `filledBy: 'intern'` today, so the client already *reads* the NIC code; only `isMilestoneFormReadOnly` stops the client from editing it. |
| Client edit | confirmed | `isMilestoneFormReadOnly` returns `true` for `variant === 'client'`. |
| Client fields | confirmed | `filterFieldsByViewer` drops `filledBy: 'intern'`. Such fields exist on `pre-2`, `pre-3`, `pre-4`, `pre-5` and `pre-10`, `pre-11`, `pre-12` (`src/lib/checklist/checklist-responses.ts`). |
| Server | confirmed | `POST …/checklist` strips review / lock / release keys from a client patch; `POST …/checklist/submit` throws "Only clients may submit checklist items" for other roles. No route runs step validation. |
| Approvals today | confirmed | Four mechanisms as listed. |
| Visibility | confirmed, one difference | **Difference:** `notes` is stripped for the client only while a step is *unreleased* (`redactChecklistSliceForViewer`). A released step hands `notes` to the client today. |
| Gate | confirmed | `gateChecklistSteps` + `internViewerAccess`. |
| Accept side effects | confirmed | `reviewChecklistItem` (accept, `lead_manager_request`) stamps `deliveredToClientAt`; copies `pre-12` `dateOfIncorporation` to `engagements.incorporation_date`. WhatsApp `coi_issued` fires in `notify-engagement-event.ts` on `review_accepted` for `pre-12`. |
| BR | confirmed | One row per engagement. `POST …/board-resolution/finalize` allows `admin, manager, intern, super_admin` and releases to the client. |
| BR generation checks | confirmed | `validateBoardResolutionGeneration` → `STEP1_INCOMPLETE` / `MISSING_FIELDS`. NIC is not in the list. |
| BR and empty NIC | confirmed | `resolveNicCodesClause` falls back to `pre1.nicCodes`, then `DEFAULT_NIC_CODES`. |
| BR for manager | confirmed | Not re-read in depth; the `pre-2` panel shows status text for staff. |
| Form errors | confirmed | `SHOW_INTERN_FORM_ERROR_SUMMARY = false` in `MilestoneResponseFormParts.tsx`; `border-danger` on inputs after a failed Submit; no `aria-invalid`; no tab marker. |
| Validators | confirmed | `runStepValidation` in `milestone-response-form-utils.ts`; the copy is the `liveValidationErrors` if-chain in the hook. |
| Repeat lists | confirmed | `src/lib/checklist/checklist-repeat.ts`, `RepeatGroupEditor.tsx`. |
| Notifications | confirmed | `notifyEngagementEvent` makes bell rows server-side; payload JSON in `notifications.description`; no actor column. |
| Recipients | confirmed | `resolveEngagementRecipients`. |
| Client dashboard | confirmed | `/app/client/overview` → `src/views/client/Overview.tsx`; no directors / capital / subscribers. |
| Dashboard data | confirmed | `readProposedDirectors(state)` in `src/lib/incorporation/proposed-directors.ts`. |

## 2. Readers of approval state (non-test files)

| Symbol | Files |
|---|---|
| `reviewStatus` | `app/api/engagements/[id]/checklist/route.ts`, `src/context/AppContext.tsx`, `src/db/repositories/engagements.ts`, `src/lib/api/board-resolution-errors.ts`, `src/lib/api/incorporation-docs-errors.ts`, `src/lib/checklist/checklist-item-review.ts`, `src/lib/checklist/checklist-notifications.ts`, `src/lib/checklist/checklist-pre6-validation.ts`, `src/lib/checklist/checklist-responses.ts`, `src/lib/checklist/checklist-state-key.ts`, `src/lib/checklist/checklist-step-approval.ts`, `src/lib/checklist/checklist-visibility.ts`, `src/lib/email/lead-manager-request-notify.ts`, `src/lib/incorporation-docs/share.ts`, `src/lib/project-stuck.ts`, `src/views/incorporation/useMilestoneResponseFormState.tsx` |
| `reviewSource` | `app/api/engagements/[id]/checklist/route.ts`, `src/components/admin/ChecklistReviewActions.tsx`, `src/components/admin/RequestManagerApproval.tsx`, `src/context/AppContext.tsx`, `src/context/use-app-provider-value.ts`, `src/db/repositories/engagements.ts`, `src/lib/ask/tools/staff.ts`, `src/lib/checklist/checklist-item-review.ts`, `src/lib/checklist/checklist-notifications.ts`, `src/lib/checklist/checklist-state-key.ts`, `src/lib/checklist/checklist-step-approval.ts`, `src/lib/checklist/checklist-visibility.ts`, `src/lib/email/lead-manager-request-notify.ts`, `src/lib/intern-work.ts`, `src/lib/pending-approvals.ts` |
| `approval` (slice key) | `src/db/repositories/engagements.ts`, `src/lib/checklist/checklist-item-review.ts`, `src/lib/checklist/checklist-state-key.ts`, `src/lib/checklist/checklist-step-approval.ts`, `src/lib/email/engagement-event-fanout.ts`, `src/lib/incorporation/registration-workflow.ts` |
| `clientFillRequest` | `app/api/engagements/[id]/checklist/route.ts`, `src/components/admin/RequestClientFill.tsx`, `src/context/AppContext.tsx`, `src/db/repositories/engagements.ts`, `src/lib/checklist/checklist-state-key.ts`, `src/lib/pending-approvals.ts` |
| `isAwaitingReview` | `src/components/admin/ChecklistReviewActions.tsx`, `src/components/admin/RequestManagerApproval.tsx`, `src/components/admin/StepWorkspaceRail.tsx`, `src/lib/checklist/checklist-item-review.ts`, `src/lib/client-progress-board.ts`, `src/lib/intern-dashboard.ts`, `src/lib/pending-approvals.ts`, `src/lib/project-stuck.ts`, `src/lib/super-overview.ts`, `src/views/admin/Dashboard.tsx`, `src/views/admin/FirmDashboard.tsx` |
| `isLeadRequestPending` | `src/lib/checklist/checklist-item-review.ts`, `src/lib/checklist/checklist-step-gate.ts` |
| `approvalStateOf` | `src/db/repositories/engagements.ts`, `src/lib/checklist/checklist-step-approval.ts`, `src/lib/checklist/checklist-visibility.ts` |
| `filledBy` | `src/components/client/ClientStepFieldPreview.tsx`, `src/data/checklist.ts`, `src/lib/checklist/checklist-field-access.ts`, `src/lib/checklist/checklist-responses.ts` |
| `isMilestoneFormReadOnly` | `src/lib/checklist/checklist-field-access.ts`, `src/views/incorporation/useMilestoneResponseFormState.tsx` |
| `filterFieldsByViewer` | `src/components/admin/StepWorkspaceRail.tsx`, `src/lib/checklist/checklist-field-access.ts`, `src/lib/checklist/checklist-step-attachments.ts`, `src/views/engagement/EngagementStepDetail.tsx`, `src/views/incorporation/useMilestoneResponseFormState.tsx` |

Mounts of the approval controls: `RequestManagerApproval` ×4 (`InternStepActionBar`, `StepDetailContentSections` ×2, `StepWorkspaceRail`), `ChecklistReviewActions` ×3, `RequestClientFill` ×5, `ClientStepApproveButton` ×1 and `ClientChangeRequestButton` ×1 (both in `EngagementStepDetail`).

## 3. Differences from `CONTEXT.md`

1. `nicCode` / `nicBusinessType` are not `filledBy: 'intern'` today (see §1). The lead-only rule is new data in the policy module, not a change to the field catalog.
2. `notes` reaches the client on released steps today. The direct flow strips `notes` for the client on every direct-flow step (the intent of §3.9).
3. `super-overview.ts`, `src/views/admin/Dashboard.tsx` and `StepWorkspaceRail.tsx` also read `isAwaitingReview`; §3.11 does not list them. They move to `isAwaitingManagerDecision` too, so a direct-flow step never counts as pending anywhere.
4. There is no `pending-approvals.test.ts`; the `pending-approvals` tests named in Phase 5 are added as a new file.
5. `unlockChecklistFields` writes only `unlockedFields`; it does not set `status: 'in-progress'`. The reopen in §3.4 adds that for direct-flow steps only.
6. `board-resolution-errors.ts` checks legacy `pre-1` director slots (`directorCount` …), which the Part B restructure moved to `pre-15`. Out of scope; recorded, not changed.
