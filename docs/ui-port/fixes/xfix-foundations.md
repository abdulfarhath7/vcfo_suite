# Foundations ✗ round (30 Oct 2026)

Prior report: `fix-foundations.md`. Rows F-043 … F-326 from `PROTOTYPE-DIFF.md`.

## Result rows

| No. | New status | What you did, or why it stays |
|---|---|---|
| F-043 | ✓ | Stale. `--hero-gradient` in `app/globals.css` has the five pools over `#e9e7ff`, and `.bg-wash` reads `var(--hero-surface-bg, var(--hero-gradient))`. No `backgroundImage.wash` in `tailwind.config.ts` any more. |
| F-044 | ✓ | Stale. The dark `--hero-gradient` has four pools over `#15132e`. |
| F-071 | ✓ | Manager home: Active projects, Overdue, Waiting on clients and Due this week now draw lines; admin home: Clients, Incorporating, In compliance and Stuck. Their past keeps no history, so the home now stores the number each tile showed on each India day (`kpi_snapshots`, key `tile:<home>:<tile>`, scope = the person's profile id) and draws the stamped days before today plus the live value. Stored only for the whole home (scope All, loaded). Approvals lines stay rebuilt from review history. A new install draws the lines after a day or two. |
| F-072 | ✓ | Lead home: Needs action, Overdue, Waiting on clients and Due this week use the same stamps; Done today stays rebuilt from events. `LeadHero` takes `stamp`; `Today.tsx` passes it for scope All once engagements have loaded. |
| F-073 | ✓ | Stale. `CardsA` asks for client trends whenever there is an engagement, and Waiting, With SBC and Documents in draw lines while incorporating (fda772fa). |
| F-163 | ✓ | Analytics Workload is the shared `ProgressList`: hours each lead planned this week (their planner `time_blocks`, India week), bar sized against the busiest lead, "n h" on the right, the clients/open/overdue line kept under the name. New repository `lead-hours.ts` (cross-tenant test) and `GET /api/metrics/lead-hours`. |
| F-166 | ◐ | Shared `StackedBar` in `@/components/dash/charts` has `title` and `total`. `super-parts.tsx` still keeps its own copy; the super agent is editing that area. Request below. |
| F-173 | ◐ | Shared `AssistSteps` built (`@/components/dash/assist-steps`). The run log is being built by another agent right now (`assist_runs` in `schema-portal-compliances.ts`, `/api/assist/*`, `src/db/repositories/assist-runs.ts`), so I did not add a second one. Request: that agent renders its run steps with `AssistSteps` on `compliances/Detail.tsx`. |
| F-178 | ✗ | `ChangeConfirm` part is ready (round 2). Rotate, disconnect and roll back are developer-console write actions on AWS and Microsoft; the developer agent owns `src/views/dev/` and those routes. Left for them; no part missing. |
| F-183 | ✓ | Stale. CardsA document rows show the size after the date (`sizeOf(d.sizeBytes)`). |
| F-192 | ◐ | Shared `EditableFacts` built: Edit turns each value into a 34 px input; Save hands only the changed rows (before, after) to the parent; Escape and Cancel drop the draft; `locked` rows stay read only. Data path: a client never writes a step answer, so Save should send `factChangeNote(title, changes)` through the existing `POST /api/client/change-requests` (`{ engagementId, stepId, note }`; each registration fact is keyed by its step id). `RegistrationPage.tsx` is the client compliance agent's. Request below. |
| F-199 | ✓ | Stale. `EngagementDetail` renders `RecordTimelineCard` (Gantt) and `SuperProjectDetail` renders `SuperProjectTimeline`. |
| F-202 | ◐ | "No data" was stale: the typical time per step is in the checklist (`getChecklistStepTimelineLabel(item)` in `src/data/checklist.ts`). Shared `PhaseRows` built with the T1 step table (#, Step, Owner chip, Status chip, Typical time, chevron; keyboard toggle). `SuperProjectJourney.tsx` is being edited by the super agent. Request below. |
| F-210 | ✓ | Shared `StageTrack` built (`@/components/dash/stage-track`): four stages, the current one a blurple block with a kicker, green hairlines between done stages, stacks on phones. The prototype uses it on no screen. |
| F-216 | ◐ | Shared `Thread` built (done and current steps show "14 Oct 2026" at the right, upcoming steps faded without dates; `threadDate` helper). `StepPage.tsx` is being edited by the client portal agent; each step already has `doneOn`. Request below. |
| F-221 | ✓ | Shared `WeekStrip` built (`@/components/dash/week-strip`): seven day boxes, count badge, first two items, "+n more", pick and clear, phone dots, legend. The prototype uses it on no screen. |
| F-239 | ✓ | Stale. The staff calendar bar has the amber FY chip after the month (`ComplianceCalendarView.tsx`, `financialYearLabel`). |
| F-252 | ✓ | Stale. The staff calendar has the Timeline view (`filing-windows.tsx`). |
| F-255 | ✓ | Stale. Client `TimelineView` moves bars: drag, edge resize, ← → (Shift resizes), filed bars locked, Undo, saved through `POST /api/client/compliances/:id/window`. Staff `filing-windows.tsx` does the same for managers. |
| F-257 | ◐ | Shared `TimelineEditor` (`@/components/dash/timeline-editor`) has a start and end date input per part (one input for the COI), cascade that keeps later lengths, a ghost of the old place, Undo, Reset, and `mode="client"` with a Reason box and "Send request". The client home `TimelineEditor.tsx` is the client home agent's. Request below. |
| F-259 | ◐ | Manager mode built: `mode="manager"` saves at once ("Save timeline") through `saveTimelineParts(engagementId, parts)` → new `POST /api/engagements/:id/timeline` → `saveEngagementTimeline` (managers and admins only, every window through the scoped `setEngagementWindow`; same phase → window rule as an approved client request; test added). Not yet placed on a staff screen: `TimelineRequestsPanel.tsx` / the staff record belong to the staff records agent. Request below. |
| F-326 | ✓ | Stale. `CommandPalette.tsx` has the key-cap footer (↑ ↓ Move, Enter Open, Esc Close). |

## New shared parts

| Import | What it is |
|---|---|
| `@/components/dash/progress-list` → `ProgressList`, `loadTone` | Rows: name, value text (or `pct%`), sub line, 6 px bar, optional link with chevron, empty state. |
| `@/components/dash/assist-steps` → `AssistSteps` | VCFO Assist steps: ST5 mark (`failed` = red ring), title, note, mono screenshot tag (`shotHref` makes it a link), empty state. |
| `@/components/dash/editable-facts` → `EditableFacts`, `factChangeNote` | Facts card with Edit → 34 px inputs, Save / Cancel, `locked` rows, `readOnlyNote`, `saveLabel`. |
| `@/components/dash/phase-rows` → `PhaseRows` | Phase rows with bar, count and chip; expands to the T1 step table with Typical time. |
| `@/components/dash/stage-track` → `StageTrack` | Four-stage track with the current-stage block. |
| `@/components/dash/thread` → `Thread`, `threadDate` | Step thread with dates on done steps (R-23). |
| `@/components/dash/week-strip` → `WeekStrip` | Seven day boxes. |
| `@/components/dash/timeline-editor` → `TimelineEditor`, `cascadeEdit`, `saveTimelineParts` | Typed-date timeline editor, manager and client modes. |
| `@/hooks/use-stamp-home-tiles` → `useStampHomeTiles(home, values, enabled)` | Stores today's tile values for the trend lines. |
| `@/hooks/use-lead-hours` → `useLeadHours()` | Planned hours per lead this week. |

## Files changed

Changed: `app/api/metrics/home-trends/route.ts` (merges the stamped series; a rebuilt series wins), `src/components/intern/LeadHero.tsx`, `src/views/intern/Today.tsx` (one prop), `src/views/admin/DashboardSections.tsx`, `src/views/admin/FirmDashboard.tsx`, `src/views/admin/Analytics.tsx` (Workload card; the unused `WORKLOAD_SERIES` removed).

New: `src/components/dash/{progress-list,assist-steps,editable-facts,phase-rows,stage-track,thread,week-strip,timeline-editor}.tsx`, `src/components/dash/shared-cards.test.tsx`, `src/lib/metrics/{home-tile-stamps,lead-hours}.ts`, `src/lib/incorporation/timeline-phase-windows.ts`, `src/db/repositories/{home-tile-stamps,lead-hours,engagement-timeline}.ts` with tests, `src/hooks/{use-stamp-home-tiles,use-lead-hours}.ts`, three route files below.

## New routes

- `POST /api/metrics/home-tiles` `{ home: lead|manager|admin, values }`: stores the caller's tile values for today.
- `GET /api/metrics/lead-hours`: `{ weekStart, leads: [{ profileId, internId, name, hours }] }`; admins all leads, a manager their own leads.
- `POST /api/engagements/:id/timeline` `{ parts: [{ id: p1|p2|mca|coi, from, to }] }`: manager saves the timeline at once.

## Schema added

None. The tile stamps reuse `kpi_snapshots` (period = India day, key `tile:<home>:<tile>`, scope = profile id); the monthly Analytics keys in the same table are never read or written by them.

## Env vars

None.

## Requests

- Super agent: replace the local `StackedBar` in `src/components/super/parts/super-parts.tsx` with `StackedBar` from `@/components/dash/charts` (or pass `title` / `total`) (F-166). In `SuperProjectJourney.tsx`, show the phases with `PhaseRows`; each step's `time` is `getChecklistStepTimelineLabel(item)` (F-202).
- Assist runs agent (whoever owns `src/db/repositories/assist-runs.ts`): draw the run steps with `AssistSteps` on the client and staff filing pages (F-173).
- Client compliance agent: `RegistrationPage.tsx` facts card → `EditableFacts editable saveLabel="Send to SBC"`; `onSave` posts `factChangeNote(title, changes)` to `POST /api/client/change-requests` with the fact's step id (F-192).
- Client portal incorporation agent: `StepPage.tsx` phase rail, show "Done 14 Oct" (`threadDate(s.doneOn)`) at the right of done steps, or use `Thread` (F-216).
- Client home agent: add typed start/end date inputs to `pages/home/TimelineEditor.tsx`, or open the shared `TimelineEditor` in `mode="client"` (F-257).
- Staff records agent: on the staff client record (beside `TimelineRequestsPanel`), an "Edit timeline" button for managers opening `TimelineEditor mode="manager"` with the four parts (Phase 1, Phase 2, MCA review, COI from the engagement's step windows) and `onSave={(p) => saveTimelineParts(engagementId, p)}` (F-259).
- Developer agent: use `ChangeConfirm` for rotate, disconnect and roll back when those actions exist (F-178).
- Hub: `decideTimelineRequest` in `client-change-requests.ts` repeats the phase → window rule now in `src/lib/incorporation/timeline-phase-windows.ts`; it can call `timelineWindows()` when that file is free.

## Incident

While building F-173 I wrote `src/db/repositories/assist-runs.ts` without seeing that another agent had created that file three minutes earlier, and my write replaced theirs. I restored their exact content from their own Write call in the session log (11,145 characters, their only write to that file) and removed the `assist_runs` / `assist_run_steps` tables I had added to `schema-work.ts`. `schema-work.ts` is back to how it was. The other agent should check the file once; if they edited it after 02:03 IST through a tool other than Write, that edit would be missing.

## Decisions

- Tiles whose past keeps no history get their lines from stamped values (what the tile really showed), not from a rebuild. A day nobody opened the home is a gap, and the line starts after the last gap.
- Workload bars are sized against the busiest lead, since no weekly hours setting exists; the value shows plain hours.
- `F-178` stays ✗: the part is ready, but cloud write actions belong to the developer console's owner.

## Checks

`npx tsc --noEmit -p .`: clean at the end (earlier runs showed errors in `app/api/dev/*`, `src/auth/*` and `src/lib/firm-settings/*`, which I do not own; they were gone by the last run). Vitest: `src/components/dash/`, the three new repository tests, `home-trends.test.ts`, `src/components/intern`, `src/views/admin`, `src/views/intern`: all pass. ESLint on every changed or new file: 0 errors (warnings are the usual `react-refresh/only-export-components`).
