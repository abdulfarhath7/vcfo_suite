# fix-staff-compliance (rows S-581 to S-818)

Round 1 built most of Email, Analytics, Settings, Calendar (with the Timeline) and Filings and left
typecheck errors. Round 2 fixed the errors, checked every open row against the code, and built the
Obligations, Obligation, Registrations and Registration rows. Rows in S-581 to S-818 that are not
listed below were ✓ in PROTOTYPE-DIFF.md and are unchanged.

| No. | New status | What you did, or why it stays |
|---|---|---|
| S-583 | ✓ | Email head has no back chevron (R-09); the inline head does not render PageBackButton. |
| S-584 | ✓ | Meta line reads "Signature from Outlook · server-side signature on/off" from the saved signature. |
| S-586 | ✓ (real only) | The Settings button and dialog (signature, mail groups) are a real feature and stay. |
| S-591 | ✓ | Chips read "Name · Org/Team"; client chips take the identity colour (R-35); all chips show. |
| S-592 | ✓ | Pop-down groups Client (5), Team (4), Groups, 24 px avatars, grey first match, Enter picks it. |
| S-593 | ✓ (real only) | Team and Client selects stay; they are real filters with client auto-fill. |
| S-596 | ✓ (real only) | Attachments row (computer and vault) is a real feature and stays. |
| S-597 | ✓ | Footer shows the blurple template tag and the grey style tag. "Write without a template" sits in the Templates card. |
| S-599 | ✓ | Send is off with no recipient, no subject, while sending, or with Outlook not connected. |
| S-600 | ✓ (real only) | "Connect Outlook" link stays when Outlook is not connected. |
| S-603 | ✓ | Template rows read the name, then the style ("SBC branded" or "Plain"). |
| S-605 | ✓ | In-row delete bar on a grey fill with a medium-weight question. |
| S-607 | ✓ | Dialog "New template" / "Edit template", Cancel and "Save template". |
| S-608 | ✓ | Name and Style side by side from sm, Subject, Message with the "Fields: {client}, {name}, {step}" hint. |
| S-609 | ✓ | `views/staff/mail/merge-fields.ts` fills {client}, {name}, {step} from the first client recipient (tested). |
| S-610 | ✓ | With the server signature off, the sender's first name goes under the body on template pick. |
| S-615 | ✓ | Analytics head has no back chevron (inline head, not PlainPageHead). |
| S-616 | ✓ (real only) | Fifth tile "Filed on time · 12 months" is real data and stays. |
| S-617 | ✓ | Local KpiStrip: 13 px label with 15 px muted icon on the left, 26 px value, 1.5 px border, 16 x 14 padding. |
| S-618 | ✓ | Round 3: `kpi_snapshots` (migration 0028). The month-end job `src/jobs/kpi-snapshots.ts` stores the five tile values per scope (the firm, each manager, each lead) with the same rule the page uses (`src/lib/metrics/analytics-kpis.ts`). Analytics shows a green or amber change tag only when last month's snapshot exists (`GET /api/metrics/kpi-snapshot`). |
| S-619 | ✓ | Overdue value turns red above 0. |
| S-620 | ✓ | Steps completed shows the count with "/ total". |
| S-621 | ✓ | Two tiles per row on a phone, auto-fit 170 px from sm. |
| S-622 | ✓ | Card pairs side by side from md. |
| S-624 | ✓ | Y axis from a floor (`completionFloor`) to 100 with faint ticks; X axis keeps a base line. |
| S-629 | ✓ | Row 2 Filings on time + Steps per week; then Time in step beside a 360 px column (Client health, Workload). |
| S-630 | ✓ | Steps bars 28 px maximum. |
| S-631 | ✓ | Columns Step, Median days, Longest (red above 7), Longest client; 8 rows. Meta stays "Open and finished steps" because the metric includes finished steps. |
| S-632 | ◐ | 96 px donut with In progress, Waiting, Overdue, Not started, Done. "Due soon" and "Stuck" need a rule for engagement health that does not exist yet; Done stays because it is real. |
| S-634 | ◐ | Rows per lead with "N clients · N open · N overdue" and a stacked bar. Planned hours per lead have no data. |
| S-636 | ◐ shared | Meta position is in `DashSection` (foundations). Request below. |
| S-638 | ✓ | `/app/{role}/profile` exists (round 1, shared agent) and `/settings` shows the same view. `/settings` is not redirected to `?tab=settings` because `roleSettingsPath` (account row) uses `/settings` to mean the profile. |
| S-639 | ✓ | Page title is screen-reader only; the menu card carries the avatar and name. |
| S-641 | ✓ | "Settings" menu item for admin, manager and lead. |
| S-642 | ✓ | One section at a time; `?tab=` picks it (`account/sections.ts`, tested). |
| S-643 | ✓ | Settings section: two columns from lg (1.15fr / 1fr), Profile left, Security and Outlook right. |
| S-644 | ✓ | Settings section Profile card: always-editable fields and a green "Saved" chip. About you keeps Edit mode (Profile rows belong to the shared agent). |
| S-646 | ✓ | Settings Profile form uses the two-column grid from sm. |
| S-647 | ✓ | WhatsApp box with a green border when on. |
| S-648 | ✓ | Settings Security card: Current, then New and Confirm, "Update password", Updated / Passwords differ chips. |
| S-650 | ✗ no data | No Microsoft sign-in provider in Auth.js and no API token store. Needs backend. |
| S-652 | ◐ kept | Disconnect bar stays truthful: the real Outlook link sends mail; it does not sync Teams. |
| S-653 | ✗ no data | Designation and membership number need columns (below). |
| S-654 | ◐ | Round 3: the reminder days (`remind_days`) now drive "Remind me" emails and client WhatsApp due nudges, and the daily digest time sends a daily digest. The Teams channel is still not built. |
| S-655 | ✓ (backend) | Round 3: an email goes to the engagement's managers with "Approvals waiting" on when a step's review turns to waiting (`src/jobs/staff-alerts.ts`). The toggle itself is on the Profile (shared agent). |
| S-656 | ✓ (backend) | Round 3: an email goes to the assignee, or to every admin and super admin, with "Escalations" on when an escalation opens. The daily digest job sends at each person's digest time. |
| S-657 | ◐ shared | AppearanceSettings is shared with the Profile rows; Density and Text size need foundations tokens. |
| S-658 | ✓ (real only) | `/app/admin/firm-settings` stays. |
| S-662 | ✓ (real only) | A lead with no incorporated client goes to Today; kept (real routing). |
| S-663 | ✓ | Bare flex row, no card. |
| S-664 | ✓ | Plain Select with "All companies" first. |
| S-665 | ✓ | 32 px bordered pill ‹ "October ▾" "2026 ▾" › (`month-nav.tsx`). |
| S-666 | ✓ | 304 px picker: 3 x 4 months, scrolling 4-column years, "Today" link (tested). |
| S-667 | ✓ | "Today" at the foot of the picker. |
| S-668 | ✓ | Stepper invisible outside Month view. |
| S-669 | ✓ | Amber "FY 2026-27" chip after the stepper. |
| S-671 | ✓ | Month / Year / Timeline, plus the real Statutory view. |
| S-673 | ✓ | Timeline view (`filing-windows.tsx`): one lane per filing grouped by area, one bar per due date; drag moves, edges resize, arrow keys move, Shift + arrows resize. Writes through `POST /api/filings/:id/window` for every unfiled client of the bar. Round 2 guarded ResizeObserver. Tested. |
| S-674 | ✓ | Zoom in, zoom out, Fit; orange today line; due mark per bar; a filed bar is locked with a toast; each move gives an Undo toast. Tested. |
| S-675 | ✓ (real only) | Statutory view stays. |
| S-680 | ◐ kept | 13 px weight 500: the real tool caps weight at 500 (foundations type scale). |
| S-683 | ✓ | Day click opens the popover with the date tile, long date and count. |
| S-684 | ✓ | Popover rows: area short tag, filing, client dot and name, status chip, link to the record. The month list stays under the grid. |
| S-685 | ✓ (real only) | Link stays. |
| S-686 | ✓ | Client dot in day rows and popover rows. |
| S-688 | ✓ | Solid `*-mid` fill with mono 10.5 px digits. |
| S-689 | ✓ | Navy inset frame. |
| S-692 | ✓ (real only) | Pre-incorporation notice stays. |
| S-695 | ◐ kept | Six-word set (house rule). |
| S-696 | ✓ | 11 px ink label with the orange square. |
| S-697 | ✓ | Days tile is a button that opens the filing. |
| S-698 | ✓ | 18 px title with the government portal link. |
| S-699 | ✓ | Area short tag, data state chip, client tag. |
| S-700 | ✓ | Chip reads `dataReceivedOn` from the filing facts. |
| S-704 | ✓ | 44 x 48 tile, day over weekday. |
| S-705 | ✓ | Area tag, "Filing · client" or "· n clients", dot-only chip. |
| S-708 | ✓ | 28 px window title with "FY · n filings · n clients". Tests now look for the "Filings" card. |
| S-709 | ✓ | Period controls in the page head. |
| S-710 | ✓ | Monthly shows a two-month window. |
| S-711 | ✓ | Monthly / Quarterly / Annual is a time window. |
| S-712 | ✓ | Two 36 px outline icon buttons. |
| S-713 | ✓ (real only) | FY stepper stays. |
| S-717 | ✓ | KPI sub lines (`tileSubs`). |
| S-718 | ✓ | Due this month is ink. |
| S-719 | ✓ | 260 px search "Search filings or clients". |
| S-720 | ✓ | Status options include "Waiting". |
| S-722 | ✓ | Client filter chip in the chip row. |
| S-725 | ✓ | Band tile takes the soft blurple tile for a later filing (`DateTile accent`). |
| S-726 | ✓ | 26 px identity client tile in filing rows. |
| S-729 | ✓ | Status column uses `boardWord` (Waiting on client data). Round 2 wired it into the All filings grid and CSV too. |
| S-731 | ✓ | "File now" opens the government portal. |
| S-732 | ✓ | 30 px identity client tile on the By client band. |
| S-735 | ✓ | Key hint footer, arrows and "/". |
| S-736 | ✓ (real only) | Extra real columns stay. |
| S-737 | ✓ (real only) | Matrices stay. |
| S-739 | ✓ | Soft "Proof" button with download, amber "Proof pending", editor for writers. Round 2 passes the side-table detail, so the cell shows for readers too. |
| S-740 | ✓ | Read dialog (`FilingProofDialog`) with eyebrow, Filed on, Reference, files, Download all; edit opens from it. |
| S-746 | ✓ | Section card "Filings by status" with period meta. |
| S-749 | ✓ | Waiting number is ink (round 2). |
| S-752 | ✓ | Obligations band uses the accent tile (`FilingBand` > `DateTile accent`). |
| S-753 | ✓ | 26 px identity client tile in each row (round 2). |
| S-754 | ✓ | "Lead" column with a 24 px initials avatar (`PersonCell`, round 2). |
| S-757 | ✓ | Key hint footer, arrow keys and "/" (round 2; off when embedded in the client record). |
| S-758 | ✓ | 360 px rail, 20 px gaps (round 2). |
| S-764 | ✓ | Head names the client when one is in view ("GSTR-1 · Northwind"); across clients the real multi-client record stays. |
| S-765 | ✓ | 52 px `HeadRing`: for one client the four workflow steps (`focusNodes`, the client portal model), across clients the filed share; "✓" when done, "-3d" when late. |
| S-767 | ◐ | Area pill · authority · frequency. No law code is stored per obligation. |
| S-768 | ◐ | The lead shows in the Lead column; client contact and manager per filing are not on the register read. |
| S-769 | ◐ kept | No "Mark next step done": the register has no route that advances a filing step (data received, prepared). Calendar and Open filings stay. |
| S-771 | ✓ | Round 3: `filing_events` (migration 0028). Events are written when a filing is filed (or filed late) or reopened, when staff upload a proof or the client sends one, and when staff or the client move a window. The obligation record shows the "This period" thread: client left, SBC right, weekday and date on the spine (`record-cards.tsx`, `GET /api/filings/events`). |
| S-772 | ✓ (real only) | Clients grid stays. |
| S-773 | ✗ no data | No portal automation backend. |
| S-774 | ✗ no data | No per-filing document requests. |
| S-775 | ◐ kept | ARN and dates are edited in the proof dialog. |
| S-776 | ✓ | Past periods show "Filed late" in amber after the filed date when it is past the due date (round 2). |
| S-777 | ✓ (real only) | Flow card stays. |
| S-778 | ✓ (real only) | Rail lists stay. |
| S-779 | ✓ | About card has a "Find the SOP in the knowledge bank" link (`knowledge-bank?q=<name>`). Worded honestly: no SOP id is stored per obligation. |
| S-782 | ✓ | Own "Due rule" card (round 2). |
| S-783 | ✓ | Round 3: "Before filing" card, staff only, for one client's period. Lines in `src/data/before-filing.ts` (per obligation, else per area); ticks in `compliance_checklist_checks` (`/api/compliance-checklist`). |
| S-785 | ✓ | Strip: Granted, In progress, Waiting on client, Not started, Renewals in 60 days. Overdue stays as a sixth tile (real state). |
| S-786 | ✓ | "Renewals in 60 days" tile filters on the stored expiry (`?state=renewals`). |
| S-790 | ◐ | "Not needed" is a grey chip. "Changed by <manager>" is not stored on the step. |
| S-791 | ✓ | "n clients" and the key hint; list keys on (round 2). |
| S-793 | ✓ | Legend hidden on phone. The Overdue cell stays because the grid draws it. |
| S-795 | ✓ | Rail: Progress, Renewals and expiry, Waiting on client, Recently granted, Next to start, then the real "Due in the next 15 days". |
| S-796 | ✓ | Renewals within 60 days or past; amber within 30, red when expired. |
| S-797 | ✓ | "Next to start": four not-started items. |
| S-798 | ✓ (real only) | Kept, last in the rail. |
| S-799 | ✓ (real only) | Kept. |
| S-800 | ✓ | 52 px `HeadRing`: stages done of three, "-nd" when overdue. |
| S-801 | ✓ | Title "GST registration · <client>". |
| S-802 | ✓ | Mono form code with a dashed underline tip · authority · category. |
| S-803 | ✓ | Status and owner moved from head chips to facts ("Status", "With"). |
| S-804 | ◐ | Lead (and assignee) show with avatars in the facts. The client contact per registration is not stored. |
| S-805 | ◐ kept | No "Mark next step done": the step workspace owns step actions. Certificate, Renewal dates, Open step stay. |
| S-806 | ✓ (real only) | Dialog stays. |
| S-808 | ◐ | Progress card with three ST5 rows. Dated step events per stage are not stored. |
| S-809 | ✗ no data | No portal automation backend. |
| S-810 | ◐ | Required documents list. Per-document status and Accept / Ask again live on the step page. |
| S-811 | ✗ | Answers live on the step page. |
| S-812 | ✓ | About card has the knowledge bank link. |
| S-813 | ✗ no data | No stored reason why a registration applies or is not needed. |
| S-814 | ✗ no data | No mapping from a registration to the obligations it starts. |
| S-816 | ✓ | Round 3: the same card on the registration record, lines by registration category. |
| S-817 | ✓ (real only) | Kept. |

## Files changed in round 2

- src/views/compliances/FilingsView.tsx: fixed the call and prop mismatches. `filingsCsv` takes the side-table details (Reference, Proof files, Waiting word); `RegisterTable` takes `details`; Status uses `boardWord`; the Proof column shows for every role.
- src/views/compliances/ObligationView.tsx: Proof cell props; `HeadRing`; title names the client; "Filed late"; knowledge bank link.
- src/views/compliances/ObligationsView.tsx: client tile, Lead avatar, ink Waiting number, key hint and list keys, 360 px rail.
- src/views/compliances/RegistrationsView.tsx: Granted, Renewals in 60 days tile and filter, Not needed chip, key hint and list keys, rail order, Next to start, 360 px rail, legend hidden on phone.
- src/views/compliances/RegistrationView.tsx: `HeadRing`, title with client, mono form, status and owner as facts, Lead avatar, knowledge bank link, 360 px rail.
- src/views/compliances/obligation-about-cards.tsx: own Due rule card, `kbHref` link.
- src/views/compliances/spectrum-parts.tsx: new `HeadRing` (52 px record ring, tokens only).
- src/views/compliances/identity.tsx: new `PersonCell` (24 px initials circle and name).
- src/views/compliances/filing-windows.tsx: ResizeObserver guard.
- src/views/compliances/staff-views.test.tsx, calendar-view.test.tsx: updated to the new markup (card name "Filings", Export in the head, "Income tax" in tab and lane).

Round 1 files in my area (kept): ComplianceCalendarView.tsx, calendar-grids.tsx, month-nav.tsx, filing-windows.tsx, identity.tsx, filing-actions.tsx, filings-board.ts, grouped-grid.tsx, FilingProofDialog.tsx, FilingProofEditor.tsx, ComposeMail.tsx, mail/merge-fields.ts, ComposeRecipientPicker.tsx, ComposeTemplatePanel.tsx, Analytics.tsx, AnalyticsCharts.tsx, AccountSettings.tsx, account/{NotificationsCard,OutlookMailboxCard,PasswordStrength,sections}.

## New routes

None.

## Schema needs

- `profiles.designation text`, `profiles.membership_no text` (S-653).
- A Teams channel for notifications (S-654).
- `registration_triggers (registration_item_id, obligation_id)` and a stored applicability reason (S-813, S-814).
- `engagement_steps.not_needed_by` for "Changed by <manager>" (S-790).

## Requests for shared files

- Foundations: `DashSection` meta right after the title at 13 px (S-636).
- Foundations or shell: Density and Text size rows in Appearance need tokens (S-657).
- Shell or lib: if the owner wants `/settings` to open `?tab=settings` as in the prototype, change `roleSettingsPath` in `src/lib/auth-routes.ts` to `/profile`, then redirect `/settings`.
- `src/components/admin/PlainPageHead.tsx` still draws a back chevron on sidebar paths (Approvals uses it). This is outside my files.

## Checks

- `npx tsc --noEmit -p .`: clean in my files. Errors remain in other areas (dev jobs retry route, client compliances spectrum.tsx, team-sections.tsx, super-insights test).
- `npx vitest run` on compliances, compliances components, staff mail, email, settings, admin, timeline: 15 files, 92 tests pass.
- `npx eslint` on my changed files: 0 errors, 14 warnings.

## Decisions

- Kept real features the prototype lacks (Settings dialog, attachments, Statutory view, FY stepper, matrices, Overdue tile, Due in 15 days list, Renewal dates dialog).
- The obligation ring for one client uses the client portal's four workflow steps, so staff and client see the same progress.
- The SOP link is a knowledge bank search, labelled "Find the SOP in the knowledge bank", because no SOP id is stored.
- `/settings` is not redirected (see requests).


## Round 3 (after migration 0028)

Built on the tables the hub added in commit 09d86c7, then on the hub's later requests.

### Files

- New repositories, each with a cross-tenant test:
  - `src/db/repositories/filing-events.ts`: `recordFilingEvent` and `listFilingEvents`.
  - `src/db/repositories/compliance-checklist-checks.ts`: staff-only ticks.
  - `src/db/repositories/kpi-snapshots.ts`: one scope per role, plus the `system*` helpers for the job.
- New repositories for the jobs (`system*` only, documented deviations):
  - `src/db/repositories/staff-alerts.ts`: alert recipients (tested).
  - `src/db/repositories/daily-digest.ts`.
- Event writes hooked into:
  - `filing-status.ts`: filed, filed late, reopened.
  - `schedule.ts`: staff and client window moves.
  - `client-compliances.ts`: staff proof and client proof.
- Reminder days:
  - `client-compliances.ts`: "Remind me" stores the person's own day, and the due list honours `remind_days`.
  - `compliance.ts` and `src/jobs/compliance-generate.ts`: client WhatsApp due nudges on each client's own days, else the old 5 (monthly) and 7 (quarterly).
  - `notification-prefs.ts`: `systemGetRemindDays`.
- Alerts are queued from `engagements/write.ts` (a step whose review just turned to waiting) and from `escalations.ts` (raise).
- New jobs, registered in `app/api/inngest/route.ts`:
  - `src/jobs/kpi-snapshots.ts`: 1st of the month at 00:05 IST.
  - `src/jobs/staff-alerts.ts`: on an event; sleeps out quiet hours.
  - `src/jobs/daily-digest.ts`: hourly.
- New pure modules, each with tests:
  - `src/lib/metrics/analytics-kpis.ts`
  - `src/lib/notify/reminder-days.ts`
  - `src/lib/notify/staff-alerts.ts`
  - `src/lib/digest/daily-digest.ts`
- `src/lib/digest/weekly-digest-email.ts`: `buildWeeklyDigestEmail(digest, 'daily')`. It is the same builder, with daily title, intro and footer.
- New data: `src/data/before-filing.ts`.
- New view parts:
  - `src/views/compliances/record-cards.tsx`: `FilingThreadCard`, `BeforeFilingCard`.
  - These are used in `ObligationView.tsx` and `RegistrationView.tsx`.
  - Analytics change tags are in `src/views/admin/Analytics.tsx`.
- Tests updated: the repository tests that stub the database now mock `filing-events`. This fixed `client-compliances.test.ts > addClientFilingProof`, which my event write had broken. Also updated: `escalations.test.ts` (alert queued) and `client-reminder-days.test.ts` (own days win).

### New routes

- `GET /api/filings/events?ids=`: the thread, scoped.
- `GET` and `POST /api/compliance-checklist`: staff only.
- `GET /api/metrics/kpi-snapshot`: the caller's own scope.

### Decisions

- A KPI snapshot is per scope (`firm`, or the profile id of a manager or lead). A manager's tiles are compared with that manager's own numbers, never with the firm's. The "Filed on time" change shows only on the 12-month view, the window the snapshot stores.
- An approval alert goes to managers only (`manager_id`, the legacy `admin_id`, co-managers). An escalation goes to its assignee when it has one, else to every admin and super admin. Both respect the switch: never saved counts as on.
- Quiet hours:
  - Alerts wait out each person's quiet hours with `step.sleepUntil`.
  - A daily digest time inside quiet hours moves to the end of the window.
  - Reminder emails keep their old timing.
- A personal remind day applies to "Remind me" emails and to client WhatsApp due nudges. Without one, the firm default and the old windows stay.
- The SOP link and the checklist lines are plain, real steps; no numbers.

### Checks

- `npx tsc --noEmit -p .`: 0 errors in the whole tree.
- `npx vitest run src/db src/lib src/views src/components/compliances src/components/email src/jobs`: 277 files, 2,704 tests pass.
- `npx eslint` on every file changed in round 3: 0 errors.
