# Overnight M6: drag and drop in Work, the staff calendar, done tasks

Branch `ovn/m4`. Staff only (lead, manager, admin, super admin). Written in ASD-STE100.

## Next action (owner)

| # | Action | Status |
|---|---|---|
| 1 | Apply migration 0032 (below) on local and on RDS before you deploy. | ✗ Not done |
| 2 | Run `npm run db:generate` to write the migration file and the snapshot. Compare it with the SQL below. | ✗ Not done |
| 3 | Do a manual check of drag and drop in a browser. The agent did not run the app (owner testing rule). | ✗ Not done |

## Migration 0032 (needed for G1 order)

| Item | Value |
|---|---|
| Table | `tasks` |
| Change | Add the column `sort_order integer` (nullable, no default). |
| SQL | `ALTER TABLE "tasks" ADD COLUMN "sort_order" integer;` |
| Schema | `src/db/schema.ts`, `tasks.sortOrder`. The agent did not run `db:generate`. |
| Risk | Drizzle reads every column of `tasks`. Before the migration, every task read fails. Apply the migration before you deploy this branch. |
| Rollback | `ALTER TABLE "tasks" DROP COLUMN "sort_order";` |

## G1: drag and drop in Work

| Item | What it does | Where | Status |
|---|---|---|---|
| Board: move between columns | Drag a task card to a column. The task gets the status of that column: Needs action = not started, In progress, Waiting = awaiting client, Done = completed. The save uses `PATCH /api/tasks/:id`. A toast gives Undo. | `src/components/work/WorkBoard.tsx` | ✓ Done |
| Board: order in a column | Drag a task card up or down. The tasks of the column get `sort_order` 1, 2, 3. Only changed rows save. Undo restores the old order. | `src/lib/work/board-moves.ts`, `src/db/repositories/tasks.ts` | ✓ Done (needs migration 0032) |
| Board: which cards move | Only assigned task cards move. Steps and filings use their own workflow, so their cards stay still. | `isBoardDraggable` | ✓ Done |
| Board: task column | A task now shows in the column of its status. Before, every open task showed in Needs action. | `src/lib/intern/intern-work.ts` | ✓ Done |
| Board: keyboard | Tab to a task card. Push Space to pick it up. Use the arrow keys to move it. Push Space or Enter to drop it. Push Escape to cancel. A screen reader hears each step. | `WorkBoard.tsx` | ✓ Done |
| Board: phone | A long push (250 ms) picks up a card, so a swipe still scrolls the page. | `TouchSensor` | ✓ Done |
| Work to Calendar | The Planner shows a "To plan" tray of open Work items. Drag an item onto a day or a time slot. The app makes a one-hour time block there (10 AM on a day cell). The save uses `POST /api/work/time-blocks`. Undo removes the block. | `src/components/work/PlannerCalendar.tsx` | ✓ Done |
| Work to Calendar: keyboard | Push Enter on a tray item. The Time block form opens with the item set. | `PlannerCalendar.tsx` | ✓ Done |
| Packages | `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2 (exact versions). | `package.json` | ✓ Done |

## G2: the calendar works like Google Calendar

| Item | What it does | Where | Status |
|---|---|---|---|
| One calendar surface | `StaffCalendar` wraps FullCalendar (MIT packages only). It has Day, Week and Month views, our own toolbar, and keyboard moves. | `src/components/work/calendar/StaffCalendar.tsx` | ✓ Done |
| Styles | All colours are design tokens (`oklch(var(--token))`). Light and dark follow the theme. Borders use `line-soft`. The today line and today cell use `brand`. Events use status colours. Statutory events use the R-43 regulator colour on the left edge. | `src/components/work/calendar/staff-calendar.css` | ✓ Done |
| Time zone | FullCalendar runs in UTC mode with IST wall-clock values (IST has no daylight saving). No time-zone plug-in is necessary. | `src/lib/work/calendar-moves.ts` | ✓ Done |
| Planner: views | Day and Week show the hours 8 AM to 8 PM. Month shows day cells. | `PlannerCalendar.tsx` | ✓ Done |
| Planner: move and resize | Drag a time block to move it. Drag the bottom edge to change its end. The save uses `PATCH /api/work/time-blocks/:id`. A toast gives Undo. A failed save puts the block back. | `PlannerCalendar.tsx` | ✓ Done |
| Planner: create | Click (or drag over) an empty slot. The Time block form opens with the date and the times set. | `PlannerCalendar.tsx` | ✓ Done |
| Compliance calendar: views | For staff, the "Calendar" tab (was "Month") shows Day, Week and Month day cells. Year, Timeline and By act do not change. A client keeps the old month grid. | `src/views/compliances/staff-compliance-calendar.tsx` | ✓ Done |
| Compliance calendar: tasks | A non-statutory task runs from its start date to its end date. A manager, admin or super admin drags it to move both dates, or drags the right edge to change the end date. The save uses `PATCH /api/compliances/tasks/:id` (action "edit"). A toast gives Undo. | `useMoveTaskDates` in `src/views/compliances/tasks/api.ts` | ✓ Done |
| Compliance calendar: create | A manager, admin or super admin clicks an empty day. The New task form opens with the start and end dates set. | `NewTaskButton` `prefill`, `NewTaskDialog` `prefill` | ✓ Done |
| Compliance calendar: open | Click a filing to open its record. Click a task to open its task page. | `staff-compliance-calendar.tsx` | ✓ Done |
| Kept features | The All / Statutory / Non-statutory filter, the regulator chips, the month picker, the FY chip, the month list, and the side cards (donut, next deadline, coming up). The month picker and the calendar stay on the same month. | `ComplianceCalendarView.tsx` | ✓ Done |
| Keyboard | Tab to an event. Push Enter to open it. Up and Down move it 15 minutes. Left and Right move it one day. Shift with Up or Down changes its end. | `keyboardMove` | ✓ Done |
| Packages | `@fullcalendar/core`, `react`, `daygrid`, `timegrid`, `interaction`, all 6.1.22 (exact). | `package.json` | ✓ Done |

### Move rules

| Event kind | Example | Drag result | Status |
|---|---|---|---|
| `statutory` | A filing due date (Planner all-day row, compliance calendar) | Not draggable. Shown with a lock look and the regulator colour. | ✓ Done |
| `client-agreed` | A step with a manager-set window (the lock icon) | A project lead drags it. The event goes back, and the Request change form opens with the window shifted by the dragged days. Send makes a date-change request through `/api/work/window-requests`. The manager sees it in Date change requests. For a manager or admin it is not draggable. | ✓ Done |
| `planned` | A non-statutory compliance task (start to end) | Moves freely for a manager, admin or super admin. | ✓ Done |
| `block` | A planner time block | Moves and resizes freely for its owner. Read only on a lead page for their manager. | ✓ Done |
| `due` | Another deadline (a step, a request, an assigned task) | Not draggable. Plan a time block for it from the tray. | ✓ Done |

### Interpretation (please confirm)

| Question | Agent decision |
|---|---|
| What is "a date agreed with the client"? | The manager-set window on a step. The DateChangeRequests flow supports only steps and filings, and a filing date in the calendar is the statutory due date. |
| Client-visible compliance tasks (`visibility` client or both) | They move freely for a manager now. The request flow does not support compliance tasks. Tell us if these must use a request. |

## G3: done tasks

| Place | Before | After | Status |
|---|---|---|---|
| Work board card | Strikethrough title | Green tick, Done chip, muted card | ✓ Done |
| Work list row | Strikethrough title | Green tick, muted title, Done chip in the status column | ✓ Done |
| Lead page to-dos (manager) | Strikethrough title | Green tick, Done chip, muted title | ✓ Done |
| Planner to-dos, Lead focus card | Strikethrough title | Checked tick, Done chip, muted title | ✓ Done |
| Drawer checklist, task page checklist, incorporation work items | Strikethrough label | Checked tick, muted label | ✓ Done |
| Shared classes in `src/components/ui/*` | Not changed (M1 owns them) | | ✗ Not in scope |

## Tests (owner testing rule: no app, no browser)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | ✓ Pass |
| `npx eslint` on the changed files | ✓ 0 errors (old warnings only) |
| `src/lib/work/calendar-moves.test.ts` (statutory locked, client-agreed makes a request, free moves, windows, wall clock, keys) | ✓ 15 pass |
| `src/lib/work/board-moves.test.ts` (columns, order, drops) | ✓ 6 pass |
| `src/components/work/PlannerCalendar.test.tsx`, `WorkBoard.test.tsx` | ✓ 8 pass |
| `src/views/compliances/*` (calendar tests changed for the new grid) | ✓ Pass |

## Not done

| Item | Reason |
|---|---|
| Manual drag check in a browser | The owner testing rule does not let the agent run the app. |
| Drag from the Board view onto the Calendar | The Board and the Planner are different views. The Planner tray gives the same result. |
| `docs/context/STATE.md` update | Left for the merge of the overnight branches. |
