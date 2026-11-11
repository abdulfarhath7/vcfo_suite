# VCFO-CR-2026-11: status of the 39 change items

Checked on 11 November 2026 against the code on `main` (9f84ee2b) plus the board resolution fix
made the same day. Every item was checked against the change request's own acceptance points,
not against the notes in `STATE.md`. Where this file and `STATE.md` disagree, this file reflects
what the code does.

## Summary

| Status | Count | Items |
|---|---|---|
| Done | 21 | GL-04, NV-03, PR-01, PR-02, CD-01, CD-02, CD-03, DR-01, DR-02, DR-03, DR-04, SB-02, SB-03, BR-01\*, BR-03, BR-04\*, BR-06, BR-07, LP-01, LP-02, LP-03 |
| Mostly done, small gaps | 11 | GL-01, GL-02, GL-05, GL-09, NV-01, NV-02, CD-04, SA-01, SB-01, BR-02\*, BR-05\* |
| Real work still needed | 6 | GL-03, GL-06, GL-07, GL-08, NV-04, SA-02 |
| Blocked on the owner | 1 | CD-05 |
| **Total** | **39** | 21 complete, 18 still need work |

\* Fixed on 11 November in branch `claude/relaxed-gates-iry9wm`. The fix is tested locally but is
not committed or deployed yet (see "Board resolution fix" below).

Of the 8 P1 items, 3 are fully done (PR-01, BR-03, LP-02). GL-01, GL-07, GL-09, NV-02 and NV-04
still need work.

## Board resolution fix (11 November)

Before the fix, the client could not reach the board resolution edit at all. The edit, tracked
changes and approval chain were only mounted on a staff screen that portal clients never open.
The fix does four things:

1. The client's Board resolution page (`/app/client/board-resolution`) now has the edit panel:
   Edit draft, Confirm edits, Send to the firm.
2. The client's steps 2 and 3 show a "Draft board resolution" or "Signed board resolution" card with
   the draft preview, the signed copy and, on step 2, the edit panel.
3. The Lead now sees the generated draft (preview and Download) on step 2, and "Generate draft"
   when there is none. Before, the Lead's step returned early and showed nothing.
4. "Send to the firm" now opens the shared "Send email" pop-up (GL-07) with the email to the Lead.
   Cancel sends nothing and keeps the edit with the client. The email is recorded as `email.sent`.

Files: `src/components/client-portal/pages/incorporation/StepBoardResolution.tsx` (new),
`BoardPage.tsx`, `StepPage.tsx`, `src/components/incorporation/BoardResolutionClientEdit.tsx`,
`Phase1StepPanelRoutePanels.tsx`, `src/lib/board-resolution/client-edit-flow.ts` and
`app/api/engagements/[id]/board-resolution/client-edit/route.ts`.

## Done (21)

| ID | Item | Notes |
|---|---|---|
| GL-04 | (i) help icon replaces "Why this?" | No "Why this?" text remains. No test for the pop-up yet. |
| NV-03 | Breadcrumb segments are links | |
| PR-01 | Project name field keeps focus | e2e covers the new-project page only. |
| PR-02 | Download project as ZIP | Staff only; made in the background. |
| CD-01 | "How many directors?" removed | The minimum is a fixed 2 directors. |
| CD-02 | One card per director, "+ Add director" | At most 4 directors. |
| CD-03 | Director grid (spreadsheet layout) | Part A grid has no "Add director" button. |
| DR-01 | DIN verification flow | Manual check, as proposed. |
| DR-02 | Only the client fills Proposed directors | The server drops the Lead's edits silently instead of refusing them. |
| DR-03 | Notify client when Proposed directors starts | In-app notice; the email is manual. |
| DR-04 | "Assign to Lead" for Manager and Admin | |
| SB-02 | Part B directors: same grid and DIN check | The DIN check button shows in Cards view only. |
| SB-03 | Subscriber conditional questions | Built as "Non-individual"; the CR said "Non-Indian" (open question). |
| BR-01 | Draft step shows the generated draft | Fixed 11 Nov (Lead and client). |
| BR-03 | Client sees who holds the work | Uses the owner's 11 Nov wording. |
| BR-04 | Client edits the draft in the app | Fixed 11 Nov (now reachable from the client portal). |
| BR-06 | Notify every participant | In-app only, as GL-07 requires. |
| BR-07 | "Request a change" with "Send to Lead" | |
| LP-01 | Light theme by default, dark toggle | |
| LP-02 | No app screenshots on the landing page | The owner still has to sign off the section list. |
| LP-03 | Hero animation per headline word | The owner still has to confirm the word list. |

## Mostly done, small gaps (11)

| ID | Item | What is left |
|---|---|---|
| GL-01 (P1) | Notification "Open" goes to the exact step | Two client notifications (`docs.share`, `checklist.review` in `src/lib/checklist/checklist-notifications.ts`) still open the Incorporation page. When the user cannot open the step, no reason is shown. Old notifications have no Open button. |
| GL-02 | Toasts | The client portal still uses its own toast (5 s, no pause on hover), not the shared 3 s one. |
| GL-05 | Side panel collapses and expands | Remembered per browser (`localStorage`), not on the user's account. |
| GL-09 (P1) | Proper letter casing in documents | Father's names, the witness name, corporate subscriber names and the board meeting documents are not cased. |
| NV-01 | Incorporation dropdown in the sidebar | For the super admin, every sub-item opens the same page (`SuperPracticeIncorporation.tsx` ignores `?view=`). |
| NV-02 (P1) | Sidebar "Incorporation" returns to the main page | Works; the required end-to-end test is missing. |
| CD-04 | "Paid-up share capital" label | The board resolution text (`src/lib/board-resolution/board-resolution.ts` lines 51 and 95), its `.docx` templates and the NOC templates still say "initial Paid-Up Capital". |
| SA-01 | Acknowledgement number on every application | INC-22, FC-GPR and MGT-4/5/6 have no field. The MCA filing card kept its own separate "SRN" field. |
| SB-01 | Part B follows the MCA form sections | "Proposed directors" (section 7) still comes before "Subscriber details" (sections 5 and 6). The AGILE nominee group has no section number. |
| BR-02 | Signed step shows draft and signed copy | Fixed for the client on 11 Nov. Still missing: who uploaded the signed copy, Open in the document viewer for the draft, and an upload area in the card (it links to the board page). |
| BR-05 | Edit, confirm, Manager, Admin, back to client | Fixed on 11 Nov: the client's buttons are reachable and "Send to the firm" uses the email pop-up. Still missing: a returned document is not added to the Lead's work list. |

## Real work still needed (6)

| ID | Item | What is left |
|---|---|---|
| GL-03 | Active tab clearly highlighted | The `segmented` variant of `SpectrumTabs` and the Radix `TabsTrigger` show the active tab by colour only. About 10 tab bars are hand-written (create project, payroll, saved views, client credentials, team, compliances, documents). |
| GL-06 | "Export to Excel" buttons | The Directors grid has no button. The audit log export holds only the rows already loaded on screen. |
| GL-07 (P1) | Manual "Send email" pop-up, no automatic emails | Still automatic: staff progress emails and lead-to-manager emails (`src/lib/email/notify-engagement-event.ts`), welcome emails when a client or project is added, staff-to-client message emails (`src/lib/messages/notify-messages.ts`) and task assignment (`src/lib/work/assign-task.ts`). The step card's compose pop-up cannot add or remove attachments. No card shows who sent the email and when. |
| GL-08 | Standard file name for every download | About 15 downloads still use old names: DIR-2, the board meeting notice and resolution, the document ZIPs, the client compliance CSV, budgets, receivables, labour registers, super admin reports, the client audit export and several browser-side CSV downloads. |
| NV-04 (P1) | Audit and fix all wrong redirects | `e2e/link-audit.spec.ts` only opens links on each role's home page. Deeper pages, breadcrumbs and notification links are not checked, and no audit table was delivered. |
| SA-02 | Name approval expiry date editable | Only the Lead can edit it (the Manager and Admin cannot). No audit record of old and new values. The server does not stop a client from writing it. No expiry reminder uses the new date. |

## Blocked on the owner (1)

| ID | Item | What is needed |
|---|---|---|
| CD-05 | "Existing interest in company" to "Any Indian company" | The owner's field details. Also, the "Any Indian company" label was later replaced by the MCA wording from SB-01 ("Whether the director has interest in other entities (7A(ii))"). The owner must choose which label to keep. |

## Open questions for the owner

- CD-05: the field details and which label to keep.
- SB-03: whether "Body corporate" is for non-individual or for non-Indian subscribers.
- LP-02: the list of landing page sections to keep.
- LP-03: the list of headline words and one visual idea for each.
