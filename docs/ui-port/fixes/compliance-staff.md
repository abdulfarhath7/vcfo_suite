# Compliances: staff and super admin screens (30 Oct 2026)

Staff screens agent for `docs/ui-port/COMPLIANCE-BRIEF.md`. Source: the prototype's
`docs/COMPLIANCE-MODEL.md` at e86ce88. Every screen reads only the routes in
`docs/ui-port/COMPLIANCE-API.md` (plus the existing register routes it already used). No sample data,
no new dependencies, no git, no schema or migration changes.

## Spec items

| Spec | Status | What I did |
|---|---|---|
| S-1 | Done | Category switch Statutory (default) · Non-statutory · All with counts in a bar under the Obligations card head (`CategoryTabs`, `?cat=ns\|all`). Group-by tabs moved into the same bar and show only with statutory rows. |
| S-2 | Done | By filing, By frequency and By law kept. A row now opens the statutory detail page of that client's period (`/obligations/<obligationId>/<instanceId>`). The cross-client obligation page stays at `/obligations/<obligationId>`; its Period cells link to each period's detail page. |
| S-3 | Done | T1 task table (Task + client, Start, End, Urgency, Visibility, Owner, Status), grouped This week, Next week, Later, Done from the server's `week`; phones keep Task, End and Status. Not-applicable rows are hidden. Rows open `/obligations/tasks/<id>`. |
| S-4 | Done | "New task" in the card head for admin, super admin and manager (`isAdminOrManager`); not for leads. |
| S-5 | Done | `NewTaskDialog` (M2): Activity (non-statutory rows, Configurable under a group, "Other…" with a name), Task name, Client, Start and End (plain-date fields with the picker), Urgency, Visible to, Owner, Reviewer, Repeats, Remind before. Activity and client fill the defaults (`/api/compliances/tasks/defaults`). Errors show only after a save; Enter in any field or select saves; Esc closes. Save posts `POST /api/compliances/tasks`, toast "Task created", switches to the task list. |
| S-6 | Done | `UrgencyPill`: 88 px neutral pill, 1 to 4 signal bars, Critical bars in `warning-mid`. |
| S-7 | Done | `VisibilityTag`: icon and word (Firm, Client, Both). |
| S-8 | Done | Strip labels and counts follow the category; the rail (flow, due soon, waiting, done recently) follows it too. |
| D-1 | Done | `DetailHeader`: date tile, title, client tile, area pill, "Statutory" tag, status chip, days to due or overdue ("Filed 14 Oct" once filed). Action from `primaryAction`: lead "Submit for review", manager and admin "Approve" (enabled in review), "Send back" with a reason when the route allows it, and an "All clients" link to the obligation page. |
| D-2 | Done | Left column in order: From the client (existing `StaffFromClientCard`, accept and ask again), Filled by SBC (existing `StaffSbcFieldsCard`, locked once filed, now with read-only Period, Filed on and by, Acknowledgement no. and Amount paid), Window and proof (existing cells), Reminders (six rows, sent or scheduled or on hold, DR-22 gaps as one line; "Edit days" when `can.editReminders`, writes `PUT /api/compliances/reminders`), Rule (due rule, applies, penalty, frequency, note; the "To confirm" note only for admin and super admin), Activity, then the filing thread and VCFO Assist (unfiled only). |
| D-3 | Done | `ProgressCard`: the six ST5 steps with who, when and evidence from the route, then stage, owner, reviewer, the review note, and a "Change stage" select (never Completed; Not applicable for admin and manager). Previous periods (last six, On time or Late, each a link) and Before filing sit under it. |
| D-4 | Not mine | Client agent. The staff page relies on the route to null `confirm` for non-admins and also hides it on screen. |
| 4.3 | Done | `TaskDetailView`: head with Start, End, urgency pill, visibility tag, "Non-statutory" tag; Checklist (tick, add item), Attachments (upload, open by signed link, deliverable and client tags), Comments (internal toggle), Reminders (edit days when `can.edit`), Activity; Progress with stage, owner, reviewer, review note and "Change stage". Lead "Submit for review"; manager and admin "Approve" (review route from review, else stage completed) and "Send back". 404 reads "This task is not in your clients". |
| C-1 | Done | `CatFilterTabs` All · Statutory · Non-statutory with counts in the calendar bar (month view counts the month, others the FY). |
| C-2 | Done | Statutory tags keep the status bar and regulator colours. |
| C-3 | Done | Tasks from `GET /api/compliances/tasks?from=&to=` (the FY) sit on their end date with a hollow 8 px `ink-2` square; hover shows "Starts 12 Oct · High"; the day popover and the month list link to the task page. |
| C-4 | Done | Month, year and timeline (tasks as a read-only second timeline, start to end), donut (a done task counts as filed), Next deadline (a task card when the next item is a task) and Coming up all follow the filter. |
| F-1 | Done | Same filter in the Filings toolbar (`?cat=`), counting the window in view. |
| F-2 | Done | Completed tasks (`?done=1` for the FY) become register rows with area "Internal"; the Window cell shows start to end, the Proof cell the deliverable file (opens by signed link); bulk Remind and Mark filed skip them. |
| F-3 | Done | KPI tiles, groups, donut and regulator bars read the filtered rows; an "Internal" line joins the regulator bars when tasks are in view. "On time vs late" stays statutory (as in the prototype). |
| K-1, K-2 | Not mine | Client agent. |

## Files

Created
- `src/components/compliances/TaskMarks.tsx` — `UrgencyPill`, `VisibilityTag`.
- `src/components/compliances/CategoryTabs.tsx` — `CategoryTabs` (Obligations), `CatFilterTabs` (Calendar, Filings).
- `src/components/compliances/NewTaskDialog.tsx`, `new-task-form.ts` — the dialog; pure date parsing and checks.
- `src/views/compliances/tasks/task-model.ts` — stages, six words, week groups, strip matching, reminder offsets (view helpers).
- `src/views/compliances/tasks/api.ts` — React Query hooks and DTO types for every route in COMPLIANCE-API.md.
- `src/views/compliances/tasks/task-list.tsx` — task columns, week groups, `statHref`, `taskHref`.
- `src/views/compliances/tasks/task-calendar.ts` — FY range, task calendar status, task as a read-only register row.
- `src/views/compliances/tasks/new-task.tsx` — `NewTaskButton` (data and toast around the dialog).
- `src/views/compliances/detail/detail-parts.tsx`, `detail-model.ts` — header, columns, KV, Reminders, Activity, Progress; route mappers.
- `src/views/compliances/StatDetailView.tsx`, `TaskDetailView.tsx` — the two detail pages.
- Tests: `src/components/compliances/NewTaskDialog.test.tsx`, `src/views/compliances/tasks/task-model.test.ts`, `src/views/compliances/detail-views.test.tsx` (mocked fetches).

Changed
- `src/views/compliances/ObligationsView.tsx` — category switch, task table, New task, strip and rail by category, statutory rows to the detail page.
- `src/views/compliances/ComplianceCalendarView.tsx`, `calendar-grids.tsx` — filter, hollow task marks, task rows in popover, list, rail and timeline; `hrefs` override for super admin.
- `src/views/compliances/FilingsView.tsx` — filter, done tasks as rows with deliverable, Internal bar; `hrefs` override.
- `src/views/compliances/ObligationView.tsx` — Period cells link to the detail page.
- `src/views/compliances/grouped-grid.tsx` — optional `bar` row under the head.
- `src/views/compliances/input-cards.tsx` — `StaffSbcFieldsCard` takes read-only `facts`.
- `src/views/compliances/CompliancePages.tsx` — `SuperComplianceCalendarPage`, `SuperFilingsPage`.
- Tests updated for the new hrefs and filters: `staff-views.test.tsx`, `calendar-view.test.tsx`.

## Routes (pages)

- `app/app/{intern,manager,admin}/compliances/obligations/tasks/[id]/page.tsx` — non-statutory task.
- `app/app/{intern,manager,admin}/compliances/obligations/[id]/[instanceId]/page.tsx` — statutory detail (obligation id, then the `compliance_instances.id`). Matches the bell links in COMPLIANCE-API.md section 7.
- `app/app/super/practice/compliances/page.tsx` — Practice · Compliances calendar with the filter.
- `app/app/super/practice/filings/page.tsx` — Practice · Filings with the filter.
- `app/app/super/practice/calendar/page.tsx` — redirect to `practice/compliances` (the shared views link to `<base>/calendar`).

## Decisions

- The statutory detail route nests under the obligation (`/obligations/<obligationId>/<instanceId>`), so the existing cross-client page keeps `/obligations/<obligationId>` and the data agent's bell links resolve.
- The calendar view tab that opens the firm's act grid (`StatutoryCalendar`) is relabelled "By act" (key unchanged) so it does not read like the new "Statutory" filter beside it. The feature is unchanged.
- A task's area filter: tasks have no regulator, so they show only under the "All" area on the calendar and are left out when a regulator is picked on Filings.
- On the timeline, tasks are a second, read-only `FilingWindows` (start to end) so no task bar can write through the filings window route.
- Manager or admin "Approve" on a task outside review closes it (`stage: completed`); in review it uses the review route.
- Super admin has no obligation or task pages; on its calendar and filings a filing or task opens `/app/super/projects/<engagementId>`.
- New task is offered to super admin too (same rights as admin in the API), wherever the Obligations list renders.

## Gaps

- `DELETE` of checklist items and attachments, task `edit` (name, dates, owner, urgency after creation), `assign` on a statutory item, and per-row reminder overrides (`rows`, `reset`) have routes but no screen yet.
- `GET /api/compliances/counts` is not used: the screens count the rows they already hold, which keeps the counts in step with the client and area filters.

## Requests for the hub

- Sidebar (`RoleSidebar.tsx`, super admin Practice group): add "Compliances" → `/app/super/practice/compliances` (and optionally "Filings" → `/app/super/practice/filings`).
- `shell-back.ts`: add `/app/super/practice/compliances` and `/app/super/practice/filings` beside the other Practice pages if the back target needs them.
- Bell links for a super admin point at `/app/super/practice`, which redirects to Incorporation; `/app/super/practice/compliances` would land on the filter.
- `src/lib/search/staff-search.ts` still opens the cross-client obligation page; that is fine, but it could open a period's detail page now.

## Checks

- `npx tsc --noEmit -p .` clean.
- `npx eslint` on every file above: 0 errors (warnings are the existing `react-refresh` kind in older files).
- `npx vitest run` whole suite: 354 files, 3388 tests pass (compliance views and components: 89).
