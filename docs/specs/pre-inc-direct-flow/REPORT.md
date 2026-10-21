# Pre-incorporation direct flow — report

Built 2026-10-12 → 2026-10-13 from `CONTEXT.md` (written against `723829e`). One commit per phase:

| Phase | Commit | Subject |
|---|---|---|
| 0 | `d514d81` | docs(pre-inc): audit for direct flow |
| 1 | `1dceb74` | feat(pre-inc): direct-flow policy and shared step validation |
| 2 | `7342d1b` | feat(pre-inc): multiple NIC codes and NIC check before BR generation |
| 3 | `cd7e565` | feat(pre-inc): show missing fields on tabs, fields and summary |
| 4 | `fcf8738` | feat(pre-inc): client and project lead fill and submit steps directly |
| 5 | `19f04bb` | feat(pre-inc): one approval only, manager approves the board resolution |
| 6 | `7010db8` | feat(pre-inc): notify all engagement parties on each submit |
| 7 | `01f0a76` | feat(client): company snapshot with directors and share capital |
| 8 | this commit | docs(pre-inc): record direct flow and close the spec |

Final gate: `tsc --noEmit` 0 errors · vitest 168 files / 1587 tests green (baseline 163 / 1491) · lint 0 errors, 163 warnings (baseline 165). No table, column or migration.

## What changed

- **Policy** — `src/lib/incorporation/pre-inc-direct-flow.ts`: step list, lead-only fields, role rules, submit / waiting / reopen / last-edited patches, read-time completion for old data, `isAwaitingManagerDecision`.
- **Validation** — `src/lib/checklist/checklist-step-validation.ts` (`runStepValidation`, `requiredFieldErrors`, `validateStepAgainstState`); the form hook and `submitDirectFlowStep` both use it. The hook's copy of the if-chain is gone.
- **Slice keys** — `submittedByName`, `submittedByRole`, `waitingOnLeadAt`, `waitingOnLeadByName`, `lastEditedAt`, `lastEditedByName`, `lastEditedByRole` (all three edits in `checklist-state-key.ts`; also on `AppContext`'s `ChecklistItemState`).
- **NIC** — "Main NIC code" + `additionalNicCodes` repeat (max 9, auto business type, duplicate / format / unknown checks), `readNicCodes`, BR clause joins all codes, Assist profile `company.additionalNicCodes`, "Add NIC code" keeps the acronym.
- **BR checks** — NIC code is a missing field; `missingFieldRefs` in the error and API body; editor lists each as a link to the step + tab; new `STEP1_INCOMPLETE` text.
- **Form** — errors per tab after Next, all tabs after a failed Submit (live); red dot + "Needs attention" on tabs; `aria-invalid` / `aria-describedby`; clickable summary; client gets the tabbed form + Next/Submit on direct-flow steps; lead-only rows read-only with "Your project lead fills this."
- **Server** — `submitDirectFlowStep` (422 / waiting / submitted), client patch rules + 409 on submitted steps, lead patches cannot stamp review keys on direct-flow steps or `pre-2`, reopen via unlock route and client change request, `step_has_no_approval` refusals, visibility / gate rules.
- **BR approval** — `requestBoardResolutionApproval`, `approveBoardResolution`, `assertLeadMayEdit` (board-resolution repository); finalize route manager/admin/super only + 409; review route dispatches `pre-2`; editor "Send for manager approval" with lock and sent-back note; `ManagerBoardResolutionReview` on the `pre-2` panel; inbox kind "Board resolution".
- **Notifications** — `step_submitted`, `step_waiting_on_lead`, `step_reopened`; `directFlowBellAudience` / `directFlowEmailPlan` / `isBoardResolutionSendBack`; client-side diff toasts; WhatsApp `coi_issued` on `pre-12` submit.
- **Client home** — `ClientCompanySnapshot` (first card of the main column), `buildCompanySnapshot` from the client's redacted state, INR grouping helpers.
- **UI extras** — "Reopen step" button (lead / manager / admin / super admin), "Last edited by …" line, gate notice and lead "client submitted their part" notice under the step title.

## Differences from CONTEXT.md (rule 0.13)

1. `nicCode` / `nicBusinessType` were never `filledBy: 'intern'`; the lead-only rule lives only in the policy module.
2. A released step used to hand `notes` to the client; the direct flow strips it on every direct-flow step.
3. `super-overview.ts`, `views/admin/Dashboard.tsx` and `StepWorkspaceRail.tsx` also read pending decisions; they now use `isAwaitingManagerDecision` too.
4. No `pending-approvals.test.ts` existed — added as a new file.
5. `reviewChecklistItem` itself does not call finalize (the board-resolution repository imports the engagements repository, so the reverse import would be a cycle). The review route dispatches `pre-2` to `approveBoardResolution`, which is the same function the finalize route calls — Accept in the inbox and "Approve and send to client" do the same thing.
6. `isChecklistStepSequentiallyComplete` had no item id; it gained an optional third parameter and every caller passes it.
7. The legacy pre-1 director slots in `collectBoardResolutionMissingFields` are left as they are (they read the `pre-15` overlay); their refs point at `pre-15` "Directors".

## Decisions taken under rule 0.14

1. The generic required check runs only on direct-flow steps without a bespoke validator (`pre-3`, `pre-4`, `pre-5`); post-incorporation and registration keep passing as before (rule 0.8).
2. `waitingOnLeadPatch` does not set `clientSubmittedAt` (the gate would read it as complete).
3. `directReopenPatch` clears the submit stamps and sets `locked: false` instead of listing `unlockedFields` — a field list cannot name repeat entry ids, so it would keep director / subscriber entries locked.
4. Managers see the current direct-flow step as `waiting` with "Waiting on the client or the project lead…".
5. `RequestManagerApproval`, `ChecklistReviewActions`, `RequestClientFill` and `ClientStepApproveButton` are also hidden on `pre-2`; its approval runs only through the BR editor and the manager panel (so the generation checks always run before a manager sees it).
6. A client's "Request a change" on a submitted direct-flow step reopens it and fires `step_reopened` in addition to the existing `client_change_requested` mail.
7. `pushNotif` now writes at most one row per person per event (someone who is lead and manager no longer gets two).
8. Ask VCFO: only field-help changed (`pre-1:nicCode`, new `pre-1:additionalNicCodes`); suggestions and glossary had no pre-incorporation approval text.
9. Document generators: no NIC / main-object placeholder exists in `src/lib/incorporation-docs/` or `src/lib/doc-pack/` (only the BR), so nothing else reads `readNicCodes`.
10. Client uploads on direct-flow steps go through the existing route (it already accepted any field); as before, client uploads are not indexed into the vault.

## Tests changed and why

| Test | Change | Why |
|---|---|---|
| `step-approval-scope.test.ts` | Three-party approval cases moved from `pre-1` to the first post-incorporation step, fixtures fill earlier steps; direct-flow cases added (cross-tenant submit, NIC stripping, already-submitted, approve refused, change-request reopen) | `pre-1` no longer has an approval |
| `checklist-field-access.test.ts` | "locks client view" uses `post-1`; direct-flow edit + field filter cases | `pre-5` is client-editable now |
| `intern-work.test.ts`, `intern-dashboard.test.ts` | Approval-era kinds asserted on `pre-2` with `pre-1` complete | `pre-1` completes on Submit |
| `checklist-notifications.test.ts` | Existing cases use `post-1`; direct-flow toast cases added | `pre-1` emits one "submitted" toast now |
| `topic-review.test.ts` | Field-help count 24 → 25 | new `additionalNicCodes` line |
| `board-resolution-errors.test.ts` | Complete fixture gains `nicCode`; NIC / refs / message cases | NIC is a required BR input |
| `assist-profile/parity.test.ts`, `build.test.ts` | `company.additionalNicCodes[]` informational path + fixture | new profile key |
| New | `pre-inc-direct-flow.test.ts`, `checklist-step-validation.test.ts`, `MilestoneResponseForm.errors.test.tsx`, `board-resolution-approval.test.ts`, `pending-approvals.test.ts`; added cases in gate, visibility, nic-2008, board-resolution, fan-out, lead-manager-request-notify, client-overview, Overview | each section of the spec |

## Manual check (section 5), local dev, 2026-10-13

Run with Playwright against `next dev` on the seeded demo data (`demo-quarry-digital`: client `client-quarry@`, lead `lead-sneha@`, manager `pm-anita@`; `demo-kestrel-robotics` for the missing-NIC case). Some client answers and the `pre-15` directors were seeded through the API rather than typed.

| # | Result |
|---|---|
| 1 | pass — Next always moves; the left tab shows a red dot |
| 2 | pass — no submit; 17-line summary of buttons; `aria-invalid` on fields; dots on 9 tabs |
| 3 | pass — NIC fields read-only with "Your project lead fills this."; a client API patch with `nicCode` stored nothing |
| 4 | pass — "Waiting on your project lead…", form read-only, "Last edited by Quarry Client (Client) …"; bell to lead + manager |
| 5 | pass — two "Add NIC code" rows; "This NIC code is already in the list." |
| 6 | pass — step complete, moved to the BR step; bell to client, manager, admins with "Sneha Kulkarni (Project Lead)" |
| 7 | pass — no BR; "NIC code" listed with a link to Client Details, Business Description |
| 8 | pass — editor locked ("with your manager"), lead PUT 409, lead finalize 403; manager + admins belled |
| 9 | pass — client BR GET returns null, download 403 |
| 10 | pass — inbox row "Draft Board Resolution · Board resolution"; preview, download and Client Details record on the step |
| 11 | pass — lead sees the note; no client bell |
| 12 | pass — client reads the finalized BR; 62011, 62020, 62099 in the text; bell to everyone |
| 13 | pass (spot check) — Signed Board Resolution step editable with Submit, no Approve button; later step shows "This opens after …" |
| 14 | pass — no Quarry row left in Approvals |
| 15 | pass — Company snapshot with directors and ₹10,00,000 |
| 16 | not run in the browser — no post-incorporation step was pending a review in the demo data; covered by the unit tests (`isAwaitingManagerDecision` keeps post steps, components only return early for direct-flow ids and `pre-2`) |

The QA run left `demo-quarry-digital` with Part A complete and its board resolution approved in the local database.
