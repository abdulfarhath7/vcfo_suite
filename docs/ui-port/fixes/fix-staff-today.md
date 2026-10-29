# fix-staff-today (round 2)

| No. | New status | What you did, or why it stays |
|---|---|---|
| S-001 | ✓ | Fixed by foundations (F-018): one `.bg-wash` rule, the gradient shows. |
| S-002 | ✓ | Fixed by foundations (F-018, dark stops). |
| S-004 | ✓ | Greeting truncates on one line (foundations F-047). |
| S-005 | ✓ | "Wed 29 Oct 2026 · 12:31 PM" in wash-ink-2 (foundations F-048). |
| S-006 | ✓ | Backdrop blur removed from `.wash-tile` (foundations F-020). |
| S-010 | ✓ | LeadHero passes ListChecks, AlertTriangle, User, CalendarDays, CheckCheck; manager and admin homes pass their own icons (stat `icon`). |
| S-013 | ✓ | Lead, manager and admin homes pass `trend` (trendWithLive + useHomeTrends). |
| S-014 | ✓ | Settings button removed from the card (foundations F-050). |
| S-015 | ✓ | Skin picker left the card; skin lives in Profile > Appearance (foundations F-050). |
| S-020 | ✓ | DashSection padding is 16 px, 20 px from 768 px (foundations). |
| S-021 | ✓ | Meta 13 px right after the title (foundations). |
| S-022 | ✓ | Head link is HeadLink "Work ›"; tabs moved to the new `right` slot on my cards (Action queue, To-dos). |
| S-023 | ✓ | Body padding per foundations. |
| S-024 | ◐ | DashSection shows 300 ms L1 shapes on a tab switch (foundations); first-load shapes only where the card has a loading signal (Action queue, Team tasks, Status). |
| S-025 | ✓ | Teal tone now `waiting-soft`/`waiting` (foundations). |
| S-026 | ✓ | Word table has due, reminder, thread, assign, reassign, capacity, pipeline (foundations). |
| S-027 | ✓ | Action queue, Waiting on, My managers and the approvals panel use the dashed EmptyState. |
| S-028 | ✓ | Today grid is main column and rail from lg (1024 px). |
| S-031 | ✓ | Blurple "New to-do" button in the home card. |
| S-032 | ◐ | Dialog with To-do, Cancel and Add and a toast; no Client or Due field (no data: the to-do store keeps a title only). |
| S-034 | ✓ | The five numbers count the scoped items. |
| S-035 | ◐ | no data: these tiles mix step and filing windows and request states that keep no history; no line drawn. |
| S-036 | ◐ | no data: these tiles mix step and filing windows and request states that keep no history; no line drawn. |
| S-037 | ◐ | no data: these tiles mix step and filing windows and request states that keep no history; no line drawn. |
| S-038 | ◐ | no data: these tiles mix step and filing windows and request states that keep no history; no line drawn. |
| S-039 | ✓ | Done today draws a line from step events, tasks.completed_at and filing dates (staff-home-trends.ts). |
| S-040 | ◐ | Done today now has a real line; the other four tiles have no stored history (no data). |
| S-043 | ✓ | Red soft chip "N stuck · client" in the head from 768 px (deriveStuckReason), opens the client. |
| S-044 | ◐ | Columns are 96 px; the words stay the R-13 status words (Overdue, Due soon, In progress, Not started); waiting work is in the Waiting on card. |
| S-047 | ◐ | no data: no client identity colour; neutral tile kept. |
| S-048 | ◐ | Kept the inline panel under the company (remembered per lead); same rows and "N more" link. |
| S-049 | ✓ | Eight companies a page with "1–8 of N" and page buttons. |
| S-050 | ✓ | List adds Step (mono code) and Owner (You, Client, Manager); Due 80 px, Status 130 px. |
| S-051 | ✓ | Action queue, Waiting on, My managers and the approvals panel use the dashed EmptyState. |
| S-052 | ✓ | Phase progress is left out in the Compliance scope and when no company is incorporating. |
| S-053 | ✓ | Incorporating companies only, nearest COI first. |
| S-054 | ✓ | Meta "N incorporating". |
| S-055 | ◐ | Kept the ST5 four-bar track (R-22) instead of three 140 px bars. |
| S-056 | ◐ | Stuck shows as the row's Status chip; the phase bar has no stuck colour, so the legend has no Stuck swatch. |
| S-058 | ✓ | New FilingsMatrix card: clients by up to nine forms due this month, tinted cells with ✓, ! or the due day, legend; hidden in the Incorporating scope. |
| S-059 | ◐ | real only: Overdue filings card kept. |
| S-060 | ✓ | Triage count and My to-dos open count. |
| S-061 | ◐ | Kept five rows and Show all (real thread flow). |
| S-062 | ◐ | real only: triage state tabs kept (G-11). |
| S-063 | ◐ | real only: the row opens its thread with reply and "Open record". |
| S-064 | ✓ | Open, Done and All tabs with counts. |
| S-065 | ✓ | Pinned tag on pinned items, Done tag, remove with Undo toast. |
| S-066 | ✓ | Form at the bottom: New to-do input, From queue, Add. |
| S-067 | ✓ | Triage and its count follow the scope. |
| S-068 | ◐ | real only: the card also holds manager waits, so it keeps the title "Waiting on". |
| S-069 | ◐ | Kept the owner chip and Remind with mail fallback (real reminder flow). |
| S-070 | ◐ | real only: My managers card kept. |
| S-071 | ✓ | Toasts for a new to-do and a removed to-do (with Undo); Remind shows its own state. |
| S-072 | ◐ | Action queue shows shapes while loading; sections get the 300 ms tab-switch shapes from DashSection. |
| S-073 | ◐ | Needs your approval draws a line from engagement_step_events.review_status; Overdue, Waiting, Due this week, Active projects have no history (no data). |
| S-074 | ◐ | Kept: the manager has no work items of their own, so the tiles stay team counts (Active projects, approvals, Overdue, Waiting, Due this week); icons now Briefcase, ShieldCheck, AlertTriangle, User, CalendarDays. |
| S-075 | ◐ | real only: Approvals and New project kept beside Assign task. |
| S-076 | ◐ | Kept Company, Project lead, title and due (a task must name a client and a lead). |
| S-079 | ✓ | Status starts on Open; Lead, Company, Area chips and the clear control kept. |
| S-080 | ◐ | real only: saved views kept (home tiles open them). |
| S-082 | ◐ | no data: neutral tile (no identity colour); Status 136 px kept. |
| S-083 | ◐ | Table scrolls sideways with a sticky first column; columns do not hide under 768 px. |
| S-087 | ✓ | Card title "Approvals" with the count. |
| S-088 | ◐ | Review link to the step kept; approving in place needs the step form. |
| S-089 | ✓ | DashDonut is the 12 px ring with gaps and 22 px total (foundations). |
| S-090 | ◐ | real only: Waiting part kept; Rebalance opens Project leads. |
| S-091 | ✓ | Action queue on manager Today over the leads' items (useTeamWork), with the stuck chip, Work link to /app/manager/work and staff company links. |
| S-092 | ◐ | Rows are incorporating clients only; the journey line, Lead column and "All projects" link stay (real). |
| S-093 | ◐ | Clients × filings matrix added (FilingsMatrix); the Upcoming filings list stays beside it (real). |
| S-094 | ✓ | Inbox card (Triage and My to-dos) in the manager rail, scoped like the cards. |
| S-095 | ✓ | My to-dos is a tab of the Inbox card; the separate Todos card left. |
| S-096 | ✓ | "Waiting on client" rail card with Remind on each row. |
| S-097 | ◐ | real only: Team todos card kept. |
| S-098 | ◐ | Action queue and Team tasks show shapes while loading; tab switches show 300 ms shapes. |
| S-099 | ◐ | Kept Awaiting approval instead of an Overdue tile (it carries the only stored trend line); icons Building2, Rocket, ShieldCheck, AlertTriangle, Clock. |
| S-100 | ◐ | Awaiting approval draws a line (review_status history); Clients, Incorporating, In compliance, Stuck keep no history (no data). |
| S-101 | ✓ | Blurple "Assign task" in the admin home card (AssignTaskDialog over all live clients). |
| S-103 | ◐ | real only: a super admin has their own home; no card here. |
| S-105 | ◐ | Practice cards (components/metrics/practice-cards) not changed this round. |
| S-106 | ◐ | Practice cards not changed this round. |
| S-109 | ◐ | Clients grid (FirmProjectsPanel and views/admin/clients) not changed this round. |
| S-110 | ◐ | Clients grid not changed this round; identity colour is no data. |
| S-111 | ◐ | Clients grid not changed this round. |
| S-112 | ◐ | Clients grid not changed this round. |
| S-113 | ◐ | Columns as S-055 (ST5 track kept). |
| S-114 | ◐ | Home grid rows now open the new Managers page; the full grid with Open tasks is on /app/admin/managers. |
| S-116 | ✓ | Needs your decision: "Assign" on each no-manager row opens the new Assign client dialog (updateEngagement managerId). |
| S-117 | ✓ | Needs your decision: "Assign" on each no-manager row opens the new Assign client dialog (updateEngagement managerId). |
| S-118 | ✓ | Open escalations (/api/super/escalations) listed with age chip and Resolve (note dialog, PATCH). |
| S-119 | ◐ | real only: Portfolio health kept. |
| S-120 | ◐ | real only: Todos and Team todos kept. |
| S-121 | ◐ | Escalations in the decisions card show shapes from their query; the managers grid has no loading flag from the people metrics yet. |
| S-124 | ◐ | Kept: the head counts all open work; the Tasks card meta counts the filtered rows. |
| S-125 | ◐ | Switch order Planner, List, Board; Timeline kept as a fourth view (real). |
| S-126 | ✓ | Opens on Planner unless the URL or the stored view says otherwise. |
| S-129 | ◐ | "…" menu with Export (the shown rows); no Templates (no data). |
| S-130 | ◐ | real only: running session chip kept. |
| S-131 | ✓ | One chip row under the head on every view. |
| S-134 | ✓ | Status chip uses the six words (Overdue, Due soon, In progress, Waiting, Not started, Done); the old focus filter shows as a "View" chip only when a Today link sets it. |
| S-135 | ✓ | Due chip with This week and Next week (IST weeks). |
| S-136 | ◐ | real only: Tag and Day chips kept for Today links. |
| S-138 | ✓ | Saved views sit inside the Tasks card above the table, list view only. |
| S-140 | ✓ | Card title "Tasks" with "N open". |
| S-142 | ◐ | Header reads "Client"; no data: no client identity colour stored. |
| S-143 | ✓ | Step column (mono code; "Filing", "Request", "Task" for the rest). |
| S-144 | ◐ | Area column on the manager Work, one-lead page and admin leads tab; the lead's own list has no filing-authority map in that view. |
| S-145 | ✓ | Due now comes before Status. |
| S-147 | ◐ | The status menu stays on task rows only: steps, filings and requests have no status write from a list. |
| S-148 | ◐ | Sessions start in the drawer (SessionButton needs the item's stored key per row); no Session column. |
| S-149 | ✓ | CTA column removed; row actions on hover, the CTA in the drawer. |
| S-150 | ✓ | Late rows get a soft red fill (rowClassName). |
| S-152 | ✓ | On team pages (manager Work, one lead, admin leads tab): bulk Assign, row Reassign, A key. The lead's own list keeps none: /api/work/reassign admits managers and admins only. |
| S-153 | ✓ | On team pages (manager Work, one lead, admin leads tab): bulk Assign, row Reassign, A key. The lead's own list keeps none: /api/work/reassign admits managers and admins only. |
| S-154 | ✓ | On team pages (manager Work, one lead, admin leads tab): bulk Assign, row Reassign, A key. The lead's own list keeps none: /api/work/reassign admits managers and admins only. |
| S-155 | ✓ | On team pages (manager Work, one lead, admin leads tab): bulk Assign, row Reassign, A key. The lead's own list keeps none: /api/work/reassign admits managers and admins only. |
| S-156 | ✓ | The J/K-focused row gets the soft blurple fill. |
| S-160 | ✓ | 12 rows a page. |
| S-161 | ✓ | EFilingGrid footer with count, arrows and ellipsis (foundations). |
| S-162 | ◐ | Shapes while engagements load; DashSection cards show 300 ms shapes on a tab switch. |
| S-163 | ✓ | "No tasks match these filters" with Clear filters. |
| S-165 | ✓ | Columns Needs action, In progress, Waiting, Done. |
| S-166 | ✓ | Waiting count tag is idle grey. |
| S-168 | ◐ | no data: no client identity dot; full name kept; rest matches. |
| S-169 | ✓ | Dashed "None" area. |
| S-170 | ✓ | Planner is two columns from lg: left Timeline and Calendar, right 360 px To-do. |
| S-171 | ✓ | 14-day style Gantt card (shared GanttTimeline, workTimeline) above the calendar. |
| S-173 | ◐ | Timeline view keeps company group rows. |
| S-174 | ◐ | Bars stay by state; no lock, Mine or repeat bars (no recurring rules, manager dates sit in the drawer's Window). |
| S-175 | ◐ | Bar label stays the state sentence. |
| S-176 | ✓ | Due diamond on the due day: red for filings, ink for steps; legend has Step due and Filing due. |
| S-178 | ◐ | Legend On track, Due soon, Overdue, Done, Step due, Filing due. |
| S-179 | ◐ | Every bar opens the drawer, where Request change sits. |
| S-180 | ◐ | real only: Later list kept. |
| S-181 | ✓ | Calendar head: title, range, Day/Week/Month tabs, previous, next, Today, + Block. |
| S-182 | ✓ | Day and Month views (Month: Monday-first grid, due count, planned hours, two items a day; a day opens its week). |
| S-183 | ◐ | 44 px an hour; range stays 8 AM to 8 PM because the planner's working day and the stored blocks use it. |
| S-184 | ✓ | Weekday over a date box; today's box is filled blurple, today's column has a sunken fill. |
| S-185 | ◐ | real only: day load kept. |
| S-186 | ✓ | "All day" row: items due that day; filings red edge, manager-dated items lock and blurple edge. |
| S-187 | ◐ | no data: no client identity colour. |
| S-188 | ◐ | Red left edge kept for a block after the due date. |
| S-189 | ✓ | Orange now line with an 8 px square at its left end. |
| S-190 | ✓ | Drag to move (across days), drag the bottom edge to resize, arrow keys nudge 15 min (Shift for the end); saves through the time-block route with an Undo toast. |
| S-191 | ◐ | A plain click opens the Time block dialog (Open task inside); drags no longer open it. |
| S-192 | ◐ | real only: click an empty hour to plan a block. |
| S-193 | ◐ | Empty state kept. |
| S-194 | ✓ | Title "To-do" with the item count and New to-do. |
| S-195 | ✓ | Quick-add line at the top of the planner To-dos card. |
| S-196 | ✓ | "Assigned by manager" group: lock, title, client, due chip. |
| S-197 | ◐ | no data: the to-do store keeps a title only (no due chip). |
| S-198 | ✓ | "Waiting on client" group with Remind on each row. |
| S-199 | ◐ | no data: no recurring rules. |
| S-200 | ◐ | Dashed "No to-dos" kept. |
| S-201 | ✓ | "My work · status" donut card under the planner. |
| S-202 | ✓ | By area card with done, pending, overdue and d/n. |
| S-203 | ◐ | no data: the to-do store keeps a title only. |
| S-205 | ✓ | Large dialog "Planning my week", sub "range · N to-dos · N h". |
| S-206 | ◐ | Plans the week shown on the calendar. |
| S-207 | ✓ | Hour grid (9 AM to 6 PM) with planned blocks in grey and suggestions; a click skips one (40 %). |
| S-208 | ✓ | Day/Week tabs with previous and next day. |
| S-209 | ✓ | Options: keep 9 to 11 AM for deep work, overdue and filings first, group by client, allow up to 8 h a day. |
| S-210 | ✓ | Blue info note names the days over 6 h (possible with the 8 h option). |
| S-211 | ✓ | Cancel, Reshuffle, "Add N blocks to calendar". |
| S-212 | ◐ | Empty state kept. |
| S-213 | ✓ | Drawer is the shared SidePanel (480 px, navy scrim, dialog shadow, full width on phones). |
| S-214 | ✓ | SidePanel close button in the head. |
| S-215 | ◐ | no data: neutral company tile instead of an identity dot. |
| S-216 | ✓ | Title 15 px medium (SidePanel). |
| S-217 | ✓ | "Pending with me" on team pages and "Assigned by {name}" from tasks.assigned_by (migration 0028). |
| S-218 | ◐ | Owner fact on team pages; no Area or "Dates set by" facts. |
| S-219 | ✓ | Section heads are 11.5 px capitals with .07em spacing. |
| S-220 | ◐ | Window section kept (Withdraw and refused chip are real). |
| S-221 | ◐ | From, To, Reason kept. |
| S-222 | ✓ | Notes section with the task's note. |
| S-223 | ◐ | Sessions section unchanged. |
| S-224 | ◐ | Checklist keeps add, move and delete (real). |
| S-227 | ◐ | Mark done only where a completion path exists. |
| S-228 | ◐ | Undo only on filings (no reopen route for a step). |
| S-229 | ✓ | SidePanel scrim is the navy token in both themes. |
| S-231 | ✓ | New route /app/manager/work (views/manager/ManagerWork.tsx). Nav item needs the shell agent. |
| S-232 | ◐ | Title, "N open · N companies", Planner/List/Board/Timeline, Plan my week, New to-do. No "…" menu (no Templates data). |
| S-233 | ✓ | Same Timeline, Calendar (own time blocks) and To-do card as the lead. |
| S-234 | ✓ | Person-plus menu on pinned to-dos hands the item to a lead (/api/work/reassign); the row then shows the lead's face. Typed to-dos have no client, so they stay. |
| S-235 | ✓ | "N with project leads" soft blurple badge in the To-dos head. |
| S-236 | ✓ | List with Lead/Area columns, Lead filter, bulk Assign, row Reassign; board cards show "· lead"; drawer with Owner and "Pending with me". |
| S-237 | ✓ | List with Lead/Area columns, Lead filter, bulk Assign, row Reassign; board cards show "· lead"; drawer with Owner and "Pending with me". |
| S-238 | ✓ | List with Lead/Area columns, Lead filter, bulk Assign, row Reassign; board cards show "· lead"; drawer with Owner and "Pending with me". |
| S-239 | ◐ | Route stays /app/admin/projects with the title Work; renaming the sidebar item needs the shell agent. |
| S-240 | ◐ | Tab now lives in ?tab= so the Work filters keep it; still opens on Projects. |
| S-241 | ✓ | Head meta "N open · N companies". |
| S-242 | ✓ | Assign client, New project and a "…" menu with Export. |
| S-243 | ✓ | Clear link after the chips. |
| S-244 | ✓ | Grid 2.4fr and 300 px from lg. |
| S-245 | ◐ | no data: managers' own items are not stored; the grid lists the lead items on each manager's engagements (tasks assigned to a manager now show on their Work). |
| S-246 | ✓ | Second line is the kind (Step, Filing, Document request, Task) and the area. |
| S-247 | ◐ | Neutral company tile and name. |
| S-249 | ◐ | real only: Lead column kept. |
| S-251 | ◐ | Late rows get the red fill; row click still opens the item page. |
| S-252 | ✓ | 13 rows a page. |
| S-253 | ✓ | Status card (donut by status word) over the filtered rows. |
| S-254 | ✓ | Bars sized to the largest load (red overdue, blurple other open) with a legend; a click still filters. |
| S-255 | ◐ | By area card instead of By kind; managers' own item kinds are not stored. |
| S-256 | ✓ | Assign client dialog on the page head. |
| S-258 | ✓ | Project leads tab is now the full WorkScreen (team mode): views, saved views, density, status menu, bulk bar, board, drawer. |
| S-259 | ◐ | Timeline view (14-day Gantt) over all leads; the planner holds the admin's own calendar. |
| S-260 | ✓ | Planner: the admin's own calendar and to-dos. |
| S-261 | ✓ | "Team work · status" and By area cards above the views. |
| S-262 | ✓ | Project leads tab is now the full WorkScreen (team mode): views, saved views, density, status menu, bulk bar, board, drawer. |
| S-263 | ◐ | Bulk Assign added; no Undo (reassign has no undo route). |
| S-264 | ✓ | Project leads tab is now the full WorkScreen (team mode): views, saved views, density, status menu, bulk bar, board, drawer. |
| S-265 | ✓ | Project leads tab is now the full WorkScreen (team mode): views, saved views, density, status menu, bulk bar, board, drawer. |
| S-266 | ✓ | Project leads tab is now the full WorkScreen (team mode): views, saved views, density, status menu, bulk bar, board, drawer. |
| S-267 | ◐ | real only: Projects panel kept for deep links. |
| S-358 | ◐ | Roster stays at /team; count and fold in the sidebar need the shell agent. |
| S-359 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-360 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-361 | ✓ | "Plan the week" opens the manager Work planner on the lead (manager only; admins have no Work planner for a lead). |
| S-362 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-363 | ◐ | Menu with Export and Copy link; no Templates (no data). |
| S-364 | ✓ | Remove lead: DangerConfirm with a target lead; manager/admin route moves open steps and tasks, audited, cross-tenant tested. |
| S-365 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-366 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-367 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-368 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-369 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-370 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-371 | ✓ | New one-lead page /app/{manager,admin}/team/[leadId] (views/manager/LeadPage.tsx): face, name, counts, Planner/List/Board, Company and Show chips, Status and By area cards, Gantt timeline from the shared GanttTimeline. |
| S-372 | ✓ | The lead's page shows their week read-only from a manager-scoped time-block read (cross-tenant tested). |
| S-373 | ◐ | To-do card: tasks assigned to the lead (Open/Overdue/All) and the lead's own to-dos read-only (owner-only writes). |
| S-374 | ◐ | real only: Add project lead form kept. |
| S-375 | ◐ | Open and Late now count the lead's real work items; rest unchanged. |
| S-376 | ✓ | Email under the name instead of the raw id. |
| S-377 | ✓ | Rows open the lead's page. |
| S-379 | ◐ | Cards stack; the grid scrolls sideways. |
| S-380 | ◐ | New route /app/admin/managers; sidebar item with count and fold needs the shell agent. |
| S-381 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-382 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-383 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-384 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-385 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-386 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-387 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-388 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-389 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-390 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-391 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-392 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-393 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-394 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-395 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-396 | ✓ | Managers page (views/admin/managers/ManagersPage.tsx): T1 grid, pick by row (#hash, soft fill, detail below), head with face and counts, capacity line and bar, Assign client, "…" Assign a task / Export, Status and By area, clients grid with Now at and phase bar, expanding leads with Reassign, Escalations (Reassign, Resolve), Assign card, plus project leads without a manager. |
| S-397 | ◐ | real only (People page): Assign project dialog kept; the Managers page has the prototype Assign client dialog. |
| S-398 | ◐ | real only: Reports to select kept on People. |
| S-399 | ◐ | real only: People cards kept. |
| S-400 | ◐ | real only: Create person kept. |
| S-402 | ◐ | Managers page: lead rows hide Late and Load under 768 px; People unchanged. |

Also fixed: the manager/admin Projects board showed a city from a hash of the engagement id (Projects.tsx). It now shows the stored registered address (`subsidiaryRegisteredAddress`) or nothing.

## Files changed
- src/db/repositories/tasks.test.ts, document-requests.test.ts: tests for completed_at / closed_at stamping (stamping code in tasks.ts, document-requests.ts, step-events.ts, lib/metrics/trend-stamps.ts and step-timing.ts came from round 1 and was checked).
- src/db/repositories/home-trends.ts, lib/metrics/staff-home-trends.ts (+tests): round-1 trend lines, checked and kept.
- src/views/intern/MyWork.tsx: split into exported `WorkScreen` (path, head, summary, views, planner, team, extraParams); team mode adds Lead/Area columns, Lead filter, bulk Assign, row Reassign, board owner, drawer owner and "Pending with me"; Step column, Due before Status, late row fill.
- src/components/work/PlannerTodos.tsx: quick-add line, hand-to-lead menu, "N with project leads".
- src/components/intern/InternWorkDrawer.tsx (ownerName, pendingWithMe), InternWorkRow.tsx (owner on board cards), LeadActionQueue/LeadSideRail/LeadManagersCard.tsx (EmptyState).
- src/components/staff/today/AssignTaskDialog.tsx: optional leadKey and title (one-lead page "Assign a to-do").
- src/views/admin/Team.tsx: real Open/Late from work items, Late column, email under name, rows open the lead page.
- src/views/admin/Projects.tsx, ProjectsSections.tsx: hash city removed.
- src/views/admin/FirmProjects.tsx: ?tab=, head meta, Assign client, Export menu.
- src/views/admin/work/FirmWorkPanels.tsx: Managers tab Clear, late rows, Status and By area cards; Project leads tab is the WorkScreen.
- src/views/admin/FirmDecisionsCard.tsx: Assign button, escalations with Resolve. FirmDashboard.tsx: manager rows link to /app/admin/managers. DashboardApprovalsPanel.tsx: EmptyState.
- New: src/views/manager/{team-work.ts, team-work.test.ts, use-team-work.ts, ManagerWork.tsx, LeadPage.tsx, LeadExpandList.tsx, work-summary.tsx}; src/views/admin/managers/{ManagersPage.tsx, managers-dialogs.tsx}.

## New routes
- /app/manager/work
- /app/manager/team/[leadId], /app/admin/team/[leadId]
- /app/admin/managers

## Schema / backend needs
- Managers reading a lead's planner: `listTimeBlocks` for a lead in the caller's scope (S-372).
- Remove lead: a route that moves a lead's open steps and tasks to the manager or another lead (S-364).
- Changing a lead's manager (`profiles.reports_to_manager_id`) after creation: no route; the "Project leads without a manager" list links to the lead page only.
- Optional: `tasks.assigned_by` for the drawer's "Assigned by" chip (S-217).

## Requests for shared files
- Shell (RoleSidebar): manager "Work" → /app/manager/work; admin "Managers" → /app/admin/managers (count, fold of each manager `#<profile id>`); manager "Project leads" fold of each lead → /app/manager/team/<lead key>.
- Foundations: PersonAvatar sizes stop at 36 (prototype face is 44) — fine as is unless a 44 size is wanted.

## Decisions
- One builder (`buildTeamWork`) for all team pages, same rules as `buildTeamTaskRows`.
- A manager's or admin's own assigned tasks appear as their own rows (lead key `profile:<id>`), never as Reassign targets.
- Handing a to-do to a lead works only for pinned work items (they move with /api/work/reassign).
- A lead's own to-dos are read-only on their page (owner-only writes).

Checks: `npx tsc --noEmit -p .` clean at the end (whole project). eslint on all my files: 0 errors (warnings are react-refresh on page files and the pre-existing one in ReassignDialog.tsx). vitest: repositories, lib/metrics, lib/intern, components/intern, views/manager, views/admin all pass.

## Round 3: migration 0028 (assigned_by, holder)

- `tasks.assigned_by`: written by `taskAssignmentPatch` (src/lib/metrics/trend-stamps.ts) in `createTask` and `updateTask` (tasks.ts) whenever the assignee is someone other than the caller (null for self or nobody, untouched when the assignee does not change), and set to the caller in `work-assignments.ts` (manager "Assign task" insert and Reassign of a task). `listTasks` adds `assignedByName` in one profiles query; the Work drawer shows "Assigned by {name}". Not mine and not stamped: `ask-handoff.ts` and `client-change-requests.ts` inserts (a client raises them; their owners may set `assignedBy` to the client's profile if wanted).
- `engagement_step_events.holder`: computed by `stepHolders(state, stepIds)` / `stepHolderOf(state, stepId)` in **src/lib/metrics/step-holder.ts**, from the client home's `buildIncorporationModel`: you/prog → `client`; with → `manager` when awaiting a manager decision, else `lead`; up/next → `sbc`; done → null. Steps outside the model: done or n/a → null, awaiting manager → `manager`, client-owned → `client`, else `lead`. `engagements/write.ts` adds it to each change before `writeStepEvents` (step-events.ts writes `holder`). Values are exactly client|lead|manager|sbc.
- Tests: step-holder.test.ts, trend-stamps.test.ts (taskAssignmentPatch), tasks.test.ts (assigned_by on create and update), step-events.test.ts (holder written).

## Round 3: the rows not reached earlier

Every row in S-001 to S-267 and S-358 to S-402 now has a status above. New files: src/components/intern/FilingsMatrix.tsx (Clients × filings, lead and manager Today), src/lib/metrics/step-holder.ts (+test). Changed: Today.tsx, LeadHero, LeadFocusCard (Open/Done/All, Pinned, Undo, form at the bottom, shared state), LeadInboxCard (counts, scope), LeadActionQueue (stuck chip, paging, Step and Owner, loading, staff links), LeadSideRail, LeadPhaseProgress, DashboardSections (manager Today: icons, Action queue, Inbox, Waiting on client, matrix, lg rail), FirmDashboard (icons, Assign task), DashboardApprovalsPanel (title), MyWork.tsx (Planner first, one filter row, six-word Status and Due chips, Tasks card, export menu, planner Timeline/Status/By area, due diamonds, 12 rows, focus fill), PlannerTodos (groups), PlannerCalendar (date box, today column, now square, 44 px), InternWorkDrawer (shared SidePanel, Notes, Assigned by), DrawerWorkSections (caps heads), FirmWorkPanels (Managers tab bars and legend, kind line, 13 rows, lg layout), TeamTasksCard (Status starts on Open).

Still open (✗): S-182 Day and Month calendar views, S-186 all-day row, S-190 drag and resize of blocks, S-207 to S-209 Plan my week hour grid, Day/Week switch and options, S-364 Remove lead, S-372 a lead's calendar (time blocks readable only by their owner).

Checks: tsc clean; eslint 0 errors on my files; vitest 453 tests pass in the nearby folders.

## Round 4: the ✗ rows

- assigned_by in `ask-handoff.ts` and both inserts of `client-change-requests.ts`: `staffAssignedBy(role, actorId, assignedTo)` (trend-stamps.ts) stamps the acting person only when they are staff and the task goes to someone else (a client raising it is not an assigner). Test in trend-stamps.test.ts.
- S-372 backend: `listLeadTimeBlocks(ctx, leadKey, range)` in time-blocks.ts; `GET /api/work/time-blocks?…&lead=<intern key>`. Admins: any lead. Managers: a lead who reports to them or leads one of their engagements, blocks on the manager's engagements only, free blocks only when the lead reports to them. Others 403. Cross-tenant tests in time-blocks.test.ts. `useTimeBlocks(range, leadKey)` reads it.
- S-182 ✓: PlannerCalendar has Day, Week and Month views (SpectrumTabs). Day steps a day (the Work week follows through `onDate`); Month is a Monday-first grid with due counts, planned hours and two items per day; a day number opens its week.
- S-186 ✓: "All day" row with the items due that day: filings with a red edge, manager-dated items (a window) with a lock and a blurple edge; a click opens the item.
- S-190 ✓: drag a block to move it (also to another day), drag its bottom edge to resize, arrow keys move a focused block 15 min (Shift changes its end); snaps to 15 min; saves through PATCH `/api/work/time-blocks/:id` with an Undo toast. A plain click still opens the Time block dialog.
- S-372 ✓: the lead's page shows their week read-only (`PlannerCalendar leadKey`), from the manager-scoped read above.
- S-207 to S-212 ✓: Plan my week is a large dialog with an hour grid (9 AM to 6 PM): blocks already planned in grey, suggestions in blurple (filings red), a click skips one (40 % opacity); Day/Week switch with previous and next day; options Keep 9 to 11 AM for deep work, Overdue and filings first, Group by client, Allow up to 8 h a day (`suggestWeekBlocks` options, tests in planner.test.ts); a blue note names days over 6 h; Reshuffle starts the plan on a later day; sub line "range · N to-dos · N h".
- S-364 ✓: "Remove lead" (last, red) in the lead page's "…" menu opens a DangerConfirm (type REMOVE) with a "Move open work to…" lead picker. `POST /api/work/remove-lead` (managers and admins) runs `removeLead` (work-assignments.ts): on every engagement the caller may access (`assertEngagementAccess` per engagement), steps reassigned to the lead move to the new lead, the lead is replaced (`replaceEngagementLead`, primary seat included), open tasks move with `assigned_by` = the caller, one `work.lead_removed` audit event per client, a bell row per client for the new lead. The account stays (People deletes accounts). Cross-tenant tests in work-assignments.test.ts (a foreign client is skipped and untouched; a lead on none of the caller's clients is a 404 with no writes).

All ✗ rows of my area are now built. Checks for round 4 are at the end of this file.

Round 4 checks: tsc clean; eslint 0 errors and 0 warnings on the files changed this round; vitest 104 tests pass (lib/work, trend-stamps, time-blocks, work-assignments, ask-handoff, client-change-requests, components/work, views/manager, views/intern, components/intern). The client home files (home-trends.ts, client-holder-trend.ts, pages/home/*) were not touched.
