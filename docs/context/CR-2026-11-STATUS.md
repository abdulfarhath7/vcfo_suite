# VCFO-CR-2026-11: status of the 39 change items

Checked on 11 November 2026 against the code on `main` (9f84ee2b), then updated the same day
after the board resolution fix and the P1 fixes on branch `claude/relaxed-gates-iry9wm`. Every item was checked against the change request's own acceptance points,
not against the notes in `STATE.md`. Where this file and `STATE.md` disagree, this file reflects
what the code does.

## Summary

| Status | Count | Items |
|---|---|---|
| Done | 25 | GL-01\*, GL-04, GL-09\*, NV-01\*, NV-02\*, NV-03, PR-01, PR-02, CD-01, CD-02, CD-03, DR-01, DR-02, DR-03, DR-04, SB-02, SB-03, BR-01\*, BR-03, BR-04\*, BR-06, BR-07, LP-01, LP-02, LP-03 |
| Mostly done, small gaps | 9 | GL-02, GL-05, GL-07\*, NV-04\*, CD-04, SA-01, SB-01, BR-02\*, BR-05\* |
| Real work still needed | 4 | GL-03, GL-06, GL-08, SA-02 |
| Blocked on the owner | 1 | CD-05 |
| **Total** | **39** | 25 complete, 14 still need work |

\* Fixed on 11 November in branch `claude/relaxed-gates-iry9wm`. The fixes are committed and
pushed, but not merged or deployed yet (see the two "fix" sections below).

Of the 8 P1 items, 6 are done (GL-01, GL-09, NV-02, PR-01, BR-03, LP-02). GL-07 waits on one owner
decision, and NV-04 needs one run of the link audit against the demo data (see "P1 fixes").

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

## P1 fixes (11 November)

- **GL-09 name casing:** father's, first and last names, the subscription witness, subscriber
  and corporate subscriber names, the AOA director list, and the board meeting notice and
  resolution now go through the shared `properNameCase`. A new test
  (`src/lib/incorporation-docs/name-casing-templates.test.ts`) builds every document template
  from answers typed in lower case; it caught the AOA director list, which is now fixed.
- **GL-01 notification links:** the client's "drafts shared" and "submission accepted" notices
  open the step, not the Incorporation page. An old notification without a link opens its project
  overview. A step the person may not open sends them to the nearest page with a message that says
  why. `src/lib/notifications/notification-links.test.ts` checks the link of each notification
  type for each role. Emails already used the same step links. The WhatsApp message carries no
  link, because its Meta-approved template has no link field; adding one needs a new template
  approved in Meta.
- **GL-07 emails:** the step card's Send email pop-up can add and remove files (5 files, 10 MB in
  all). Each staff step lists the emails sent from it: who, when, to whom and the subject.
- **GL-07 WhatsApp after the email (12 Nov):** a step event no longer queues the client WhatsApp
  nudge (`coi_issued` when the certificate step is accepted or submitted, `document_delivered` on
  Deliver). The nudge rides on the client email draft (`whatsappEvent`), and `/api/outlook/send` or
  `/api/email/send-draft` queues it once, after the email is sent and after the response, only to
  the clients the email reached (`src/lib/email/step-whatsapp-after-send.ts`). Scheduled reminders,
  digests and the manual Remind keep WhatsApp right after their automatic email.
- **NV-01 / NV-02 sidebar:** the super admin's SPICe+ Part A, Part B, Board resolutions and
  Documents items now open the list in that view. `e2e/incorporation-sidebar.spec.ts` checks, for
  the Lead, Manager and Admin, that one click from a SPICe+ Part A step returns to the
  Incorporation main page with a clean address. It is part of `npm run e2e:smoke`.
- **NV-04 link audit:** `e2e/link-audit.spec.ts` now also opens the breadcrumb and card links of
  every page reached from the home (one level deeper), and every link in the person's
  notifications. It fails a link that lands in a different section from the one it names, as well
  as 404, error, blank and other-role pages. It writes `test-results/link-audit-<role>.csv`.

**Not run yet:** the two browser tests need the app running with the demo data. This cloud session
could not start the database, because the Docker images could not be downloaded and building the
`pgvector` extension was blocked. Run `npm run e2e:smoke` on a machine with Docker, fix any link the
audit fails, and hand the CSV tables to the owner. Typecheck, lint (0 errors) and the unit tests
pass.

**Owner decision for GL-07:** these emails still go out by themselves. They are not card actions,
so they were left as they are until the owner decides:
- the welcome email when a client or project is added (it carries the client's first password);
- staff-only notices: progress emails to the team, lead-to-manager approval emails, task
  assignment and the board resolution send-back to the Lead;
- the email copy of a message a staff member types and sends in the app.

## Done (25)

| ID | Item | Notes |
|---|---|---|
| GL-01 (P1) | Notification "Open" goes to the exact step | Fixed 11 Nov. The WhatsApp message has no link (needs a new Meta template). |
| GL-04 | (i) help icon replaces "Why this?" | No "Why this?" text remains. No test for the pop-up yet. |
| GL-09 (P1) | Proper letter casing in documents | Fixed 11 Nov, with a test for each template. |
| NV-01 | Incorporation dropdown in the sidebar | Super admin views fixed 11 Nov. |
| NV-02 (P1) | Sidebar "Incorporation" returns to the main page | End-to-end test written 11 Nov; not run yet in this environment. |
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

## Mostly done, small gaps (9)

| ID | Item | What is left |
|---|---|---|
| GL-02 | Toasts | The client portal still uses its own toast (5 s, no pause on hover), not the shared 3 s one. |
| GL-07 (P1) | Manual "Send email" pop-up, no automatic emails | Fixed 11 Nov for card emails: attachments in the step pop-up, and each step shows who emailed and when. Waits on the owner decision above for the welcome email, staff-only notices and message copies. |
| GL-05 | Side panel collapses and expands | Remembered per browser (`localStorage`), not on the user's account. |
| NV-04 (P1) | Audit and fix all wrong redirects | Audit extended 11 Nov (breadcrumbs, card links one level deep, notification links, wrong-section check). It must be run once against the demo data, the failures fixed, and the CSV tables given to the owner. |
| CD-04 | "Paid-up share capital" label | The board resolution text (`src/lib/board-resolution/board-resolution.ts` lines 51 and 95), its `.docx` templates and the NOC templates still say "initial Paid-Up Capital". |
| SA-01 | Acknowledgement number on every application | INC-22, FC-GPR and MGT-4/5/6 have no field. The MCA filing card kept its own separate "SRN" field. |
| SB-01 | Part B follows the MCA form sections | "Proposed directors" (section 7) still comes before "Subscriber details" (sections 5 and 6). The AGILE nominee group has no section number. |
| BR-02 | Signed step shows draft and signed copy | Fixed for the client on 11 Nov. Still missing: who uploaded the signed copy, Open in the document viewer for the draft, and an upload area in the card (it links to the board page). |
| BR-05 | Edit, confirm, Manager, Admin, back to client | Fixed on 11 Nov: the client's buttons are reachable and "Send to the firm" uses the email pop-up. Still missing: a returned document is not added to the Lead's work list. |

## Real work still needed (4)

| ID | Item | What is left |
|---|---|---|
| GL-03 | Active tab clearly highlighted | The `segmented` variant of `SpectrumTabs` and the Radix `TabsTrigger` show the active tab by colour only. About 10 tab bars are hand-written (create project, payroll, saved views, client credentials, team, compliances, documents). |
| GL-06 | "Export to Excel" buttons | The Directors grid has no button. The audit log export holds only the rows already loaded on screen. |
| GL-08 | Standard file name for every download | About 15 downloads still use old names: DIR-2, the board meeting notice and resolution, the document ZIPs, the client compliance CSV, budgets, receivables, labour registers, super admin reports, the client audit export and several browser-side CSV downloads. |
| SA-02 | Name approval expiry date editable | Only the Lead can edit it (the Manager and Admin cannot). No audit record of old and new values. The server does not stop a client from writing it. No expiry reminder uses the new date. |

## Blocked on the owner (1)

| ID | Item | What is needed |
|---|---|---|
| CD-05 | "Existing interest in company" to "Any Indian company" | The owner's field details. Also, the "Any Indian company" label was later replaced by the MCA wording from SB-01 ("Whether the director has interest in other entities (7A(ii))"). The owner must choose which label to keep. |

## Open questions for the owner

- GL-07: whether the welcome email, the staff-only notices and the message copies must also wait
  for a Send click.
- CD-05: the field details and which label to keep.
- SB-03: whether "Body corporate" is for non-individual or for non-Indian subscribers.
- LP-02: the list of landing page sections to keep.
- LP-03: the list of headline words and one visual idea for each.
