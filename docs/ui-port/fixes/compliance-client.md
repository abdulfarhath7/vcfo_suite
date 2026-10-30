# Compliances, client screens (30 Oct 2026)

Client screens agent for `docs/ui-port/COMPLIANCE-BRIEF.md`. Source: the prototype's
`docs/COMPLIANCE-MODEL.md` at e86ce88 and its client screens. Every screen calls only the routes in
`docs/ui-port/COMPLIANCE-API.md` (plus the client routes the pages already used). When this pass ended,
the new routes under `app/api/compliances/` were not built yet, so the new screens are tested with
mocked fetches. All parsing sits in one file (`task-api.ts`), so a change to the contract touches one place.

## Spec items

| Spec | Status | What I did |
|---|---|---|
| K-1 | Done | Client Obligations has the Statutory · Non-statutory · All switch with counts under the card head (after the certificate only; before it the page is unchanged). Non-statutory lists `GET /api/compliances/tasks` (the route already returns only the client's own engagement and only visibility client or both; rows with `hidden` are dropped too). The table groups by end week (This week, Next week, Later, Done) with Task, Start, End, Urgency, With and Status. It has no Visibility column and no reviewer column. On phones it keeps Task, End and Status. All shows the statutory card, then a "Non-statutory tasks" card. The rail follows the switch: Due in the next 15 days and Waiting on client add the tasks, and Progress flow adds a Tasks bar in the six words. |
| K-2 | Done | No New task button anywhere on the client. The task page has Upload (header and Attachments card; `POST /api/compliances/tasks/:id/attachments`, one file per POST) and a comment form (`POST …/comments` with `{ body }`). Both follow `can.upload` and `can.comment`, and upload stops once the task is done. |
| D-4 | Done | The client statutory record (`/app/client/compliances/obligations/[id]`) keeps every existing part (record head, This period, From the client with upload in place, Filled by SBC, Past periods, About, Why it applies, If filed late, side panel, Remind me, Add to my calendar). It now also reads `GET /api/compliances/statutory/:instanceId` for the open period and adds Progress (steps with who, when and evidence, the stage and the owner, no reviewer), Reminders (escalations dropped, no edit control), Rule (due rule, applies to, penalty, frequency, note; the `confirm` note is never read) and Activity. The head adds "Due in N days" or "Overdue N days" and an Upload button that scrolls to the open asks in From the client. There are no reviewer notes and no staff controls. |
| 4.3 client task page | Done | New route `app/app/client/compliances/obligations/tasks/[id]/page.tsx` renders `TaskPage.tsx`. It has a header card with the end-date tile, the name, the urgency pill, a "Non-statutory" tag, the status chip, "Start 5 Oct · End 20 Oct · Due in 6 days" and Upload. The left column has Checklist (read only, ST5 marks), Attachments (a click opens the signed URL), Comments (internal ones dropped), Reminders (no escalations) and Activity. The right column has Progress with the stage and the owner. A 404 (a firm-only task or another client's task) shows "This task is not shared with you". |
| C-1 | Done | The calendar has an All · Statutory · Non-statutory switch above the bar, with counts for the month in Month view and for the year in Year and Timeline views. `?cat=` keeps it on refresh. The phone calendar has the same switch. |
| C-2 | Done | Statutory events keep their solid stripe. |
| C-3 | Done | Tasks show on their end date. In the month grid, a `.ev.task` has a hollow 8px square in ink-2 and the word "Task"; its hover is "Starts 5 Oct · High". The day pop-over, Coming up, Next deadline and the phone agenda show "Task" with the square, the hover text and the six-word chip. A click opens the task page. |
| C-4 | Done | The switch applies to the month grid, the Year view, the Timeline (a "Non-statutory" lane group with hollow, locked bars from start to end), the donut, Next deadline ("Open task", no Remind me, "Your inputs needed" when waiting) and Coming up. An area pick hides tasks, and Non-statutory hides the area switch. The drill-down opens the task page for a task row. |
| F-1 | Done | Filings has the switch in the head bar, with counts of the rows in the window. `?cat=` keeps it on refresh. |
| F-2 | Done | Non-statutory rows are the completed tasks of the FY (`deliverable` under the name, "Task" in the Area column, no portal link and no VCFO Assist). The proof cell opens the deliverable through `GET …/attachments/:id`. A row opens the task page. |
| F-3 | Done | "Filings by month" and "Progress by area" use the filtered rows. Progress by area adds a "Tasks" bar. Tasks show under the All frequency only, and an area pick hides them. CSV export stays the statutory register. |

## Files

Created:
- `src/components/client-portal/pages/compliances/tasks.ts`: the pure task model: stages, the six words, the calendar state, the week groups, the hover text, the task as a register row (`taskAsRow`, `isTaskRow`), done task rows, and day words.
- `src/components/client-portal/pages/compliances/task-api.ts`: the hooks over COMPLIANCE-API.md (`useClientTasks`, `useClientTask`, `useStatExtras`, `useTaskComment`, `useTaskUpload`, `useTaskRows`, `attachmentUrl`, `taskHref`). Internal comments, escalations and the confirm note are dropped here as a second guard.
- `src/components/client-portal/pages/compliances/task-marks.tsx`: `UrgencyPill`, `VisibilityTag`, `TaskSquare`, `CategoryTabs`, `RowArea`, `RowPortalLink`.
- `src/components/client-portal/pages/compliances/TaskList.tsx`: the client task table.
- `src/components/client-portal/pages/compliances/TaskPage.tsx`: the client task page.
- `src/components/client-portal/pages/compliances/detail-parts.tsx`: the client detail header, the two columns, Reminders, Activity and Progress.
- `src/components/client-portal/pages/compliances/tasks.test.ts`, `task-pages.test.tsx`: 10 tests (pure model, hooks with mocked fetch, the task page with a comment POST, the 404 page, the table).
- `app/app/client/compliances/obligations/tasks/[id]/page.tsx`: the route.

Changed: `ObligationsPage.tsx`, `ObligationPage.tsx`, `CalendarPage.tsx`, `CalendarMobile.tsx`, `TimelineView.tsx`, `FilingsPage.tsx`, `CompDrill.tsx`, `ctx.tsx` (a task row opens its page from the drill-down, opens its deliverable from the proof chip, and takes no reminder or .ics), `index.tsx` (`ClientCompliancesTaskRoute`), `css-src/compliances-board.css` (`.ev.task`, `.tlv-b.task`), then `node scripts/cp-css.mjs`.

## Routes used

`GET /api/compliances/tasks`, `GET /api/compliances/tasks/:id`, `POST /api/compliances/tasks/:id/comments`,
`POST /api/compliances/tasks/:id/attachments`, `GET /api/compliances/tasks/:id/attachments/:attachmentId`,
`GET /api/compliances/statutory/:instanceId`. No schema change.

## Decisions

- A task becomes a `PortalFiling`-shaped row (`taskAsRow`, id `task:<id>`). This lets the existing month grid, Year view, Timeline, donut, rail and Filings grid draw it without a second code path. Its `area` holds a placeholder that every screen replaces with "Task" (`RowArea`), and the area filters drop task rows.
- The calendar and Filings put All first (the prototype's `catTabs`). Obligations puts Statutory first and opens on it (the prototype's `CategoryTabs`).
- The client cannot move a task's timeline bar: SBC sets those dates.
- Tasks are fetched once (all of the client's tasks) and filtered by FY on the client, so `?from=&to=` is not used.
- The client sees the status word computed on the page from the stage and the end date (the same rule as the server's `word`).
- A not-shared task shows an empty state in the portal, not the Next.js 404 page, because the client portal routes render client components.

## Gaps and requests for the hub

- The new `/api/compliances/*` routes were not on disk when I finished, so nothing was checked against a live server. Run the screens once the data agent lands the routes.
- The client statutory record still shows the register's four "This period" steps beside the API's six Progress steps. The owner may want only one.
- `useStatExtras` is called for the open period only. Previous periods keep the existing Past periods grid; the API's `previous` field is parsed but not shown.

## Checks

`npx tsc --noEmit -p .` is clean. `npx eslint src/components/client-portal/pages/compliances/ app/app/client/compliances/obligations/tasks/[id]/page.tsx` shows 0 errors. The warnings are `only-export-components`, plus three existing memoization warnings in `CalendarMobile.tsx`. `npx vitest run src/components/client-portal/pages/compliances/` passes 18 tests.
