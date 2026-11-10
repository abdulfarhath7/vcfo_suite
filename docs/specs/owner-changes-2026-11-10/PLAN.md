# Owner changes, 10 Nov 2026: plan

Source: the owner's `Changes.txt` (22 items). Each item below says what is wrong today, what we change, and where. Items marked **Ask** wait for an answer from the owner; every other item can start now.

Work goes on one branch from `main`, in five small pull requests, so each can be checked and merged on its own.

## PR 1: Quick fixes (no decisions needed)

| # | Item | Today | Change | Where |
|---|---|---|---|---|
| A1 | Cursor jumps while typing the project name | The name box turns into a title button after the first letter, so focus is lost. | Keep the box open while it has focus; turn into the title only on blur. | `src/components/admin/CreateProjectFormSections.tsx` |
| A2 | Remove "Save as draft", autosave instead | Button saves to the browser only; no autosave. | Remove the button; save the form to the browser automatically a second after each change, and show "Saved". Stop storing the client password in the draft. | `CreateProjectForm.tsx`, `create-project-form-utils.ts` |
| L1 | Highlight the open tab light blue | Open tab has only an underline. | Add the light-blue fill (`bg-brand-soft`) to the open section tab. | `src/views/incorporation/MilestoneResponseFormParts.tsx` |
| L2 | Remove "Draft" from the board resolution page | Chip says "Draft", preview says "Draft Word document". | Chip shows the real stage only once it moves on; preview says "Word document"; "Make the draft again" becomes "Make it again". | `BoardResolutionEditorView.tsx`, `BoardResolutionEditorDocPanel.tsx`, `NocStaffCards.tsx` |
| L3 | Download name `Board-resolution-<company>-<date>.docx` | Always `board-resolution.docx`. | Build the name from the company name and today's date in the download route and the link. Storage key stays the same. | `app/api/engagements/[id]/board-resolution/download/route.ts`, `useBoardResolutionEditorState.tsx` |
| L4 | Company name in capitals in the Word file | Inserted exactly as typed. | Uppercase the parent and proposed company names when filling the Word file. | `src/lib/board-resolution/board-resolution-docx.ts` |
| L6 | Eye icon instead of "What's this" | Text link on each step row and step page. | Eye icon with a "What's this step?" tooltip. | `ChecklistPhaseStepRow.tsx`, `WhatsThisButton.tsx` |
| O5 | Notifications can't be closed, stay 7-8 s | No close button; 4.5 to 7 s. | Add an X to every notification; 4 s for success, 6 s for errors; hover pauses. | `src/components/ui/hot-toast.tsx`, `src/lib/toast-errors.ts` |

## PR 2: Client portal

| # | Item | Today | Change | Where |
|---|---|---|---|---|
| C1 | Two directors by default, "Add director" button | A 2 / 3 / 4 picker. | Show two director blocks, an "Add director" button up to four, and Remove on the third and fourth. Stored data stays the same, so the board resolution keeps working. | `editable-field.tsx` (Part A only), `checklist-responses.ts` |
| C2 | "?" pop-up for Authorised capital | Help text exists but is hidden behind a feature switch. | Show a "?" next to the label with a short explanation, for every field that has help text, not only this one. | `editable-field.tsx`, `src/data/ask/field-help.ts` |
| C3 | Board resolution shows "Bharath" while it waits on someone else | The page always names the project lead. | Name whoever holds the step now: the lead, the manager, or "SBC admin". | `StepPage.tsx`, `PhasePage.tsx`, `ChecklistPhaseStepRow.tsx` |
| C4 | Incorporation in the sidebar opens a list of steps | Plain link. | Make it a group that opens to the four phases, each linking to its page. | `src/components/client-portal/Sidebar.tsx`, `routes.ts` |

## PR 3: Board resolution Word file layout

| # | Item | Change |
|---|---|---|
| L5 | Alignment | **Waiting on the owner's reference Word file.** The layout will be copied from it into `board-resolution-docx-body.ts`, so all three templates follow it. |

## PR 4: Lead URLs `/app/intern` to `/app/lead`

| # | Item | Change |
|---|---|---|
| O4 | URLs say "intern" (owner approved, 10 Nov) | Move the route folder, change the role-to-URL map, update about 135 files, and send every old `/app/intern/...` link to `/app/lead/...` so bookmarks and old emails keep working. The role name in the database stays `intern`. Large but mechanical; kept in its own pull request. |

## PR 5: Larger features

| # | Item | Change |
|---|---|---|
| O1 | Company type options when creating a client | "Standalone" already exists. **Ask:** which other types are needed and what changes "next". |
| O2 | Client enters DIN to check on the MCA portal | Add a DIN box to each Part A director (optional, 8 digits), and a "Check on MCA" link that opens the MCA DIN search. MCA has no public API, so the check is done by a person. |
| O3 | "Send email" button on every step page | Reuse the existing Outlook compose dialog, addressed to the client (owner, 10 Nov), with the step name in the subject and a short note. The lead edits it before sending. |
| O6 | Landing page in dark and light | Add a light palette that follows the visitor's setting, plus a switch. |
| O7 | Landing page without screenshots | **Dropped for now** (owner, 10 Nov: leave it). |
| L7 | Step 4 Name application "changes required" | **Ask:** what should change. Today it has one upload (ROC acknowledgement) and a notes box. |

## Checks for every pull request

Typecheck, lint, the full test suite, and a browser pass on the changed pages at desktop and phone width. `docs/context/STATE.md` gets one line per pull request.
