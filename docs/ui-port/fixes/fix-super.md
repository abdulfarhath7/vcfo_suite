# fix-super: super admin screens (P-001 to P-250), round 2

The rounds covered the brief's priorities: the test type error, the attention list (P-032 to P-040), the Overview tiles and Practice areas grid (P-008 to P-015, P-031), the Gantt on the client record (P-090) and the "1 days" defect. They also closed the Risks rows that round 1 had built and added Team load (P-044). Rows not listed stay as PROTOTYPE-DIFF.md has them. This round did not reach them.

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-005 | ◐ | Assign client is the primary action. Assign task stays as an outline button because it is a real super admin action. |
| P-008 | ✓ | There are now four tiles, as in the prototype: Clients, Registrations open, Filed on time and Filings overdue. Need attention is in the attention card meta. Awaiting review stays in the sidebar or approvals. |
| P-009 | ✓ | The Clients tile has the Building2 icon, a "+N" change against last month from the month-end trend, the trend line and a link to Clients. |
| P-010 | ◐ | Added a "Registrations open" tile: items in progress, waiting or overdue, with the IdCard icon and a link to Practice · Registrations. It has no change text and no trend because registration cells store no dates. |
| P-011 | ✓ | Filed on time has the ShieldCheck icon, "+N pts" from `insights.history.filedOnTime` (round 1), a green trend line and a link to the compliance calendar. |
| P-012 | ✓ | The tile is now "Filings overdue": unfiled filings due in the last 90 days, the same rule as the history. It is red when above 0, has the AlertTriangle icon, a red trend, the change text, and links to Filings. |
| P-013, P-014 | ✓ | These tiles were removed to match the prototype's four. The counts still show elsewhere (the attention card and approvals). |
| P-015 | ◐ | Change against last month is in the `of` text on Clients, Filed on time and Filings overdue. Registrations has no history. |
| P-016 | ✓ | Every tile has its prototype icon. |
| P-031 | ✓ | New `SuperPracticeAreasPanel` with Area, Active clients, Done this month, Overdue, a Health chip (On track, Watch, At risk) and Lead manager. Each row opens the area. Registrations "done this month" is a dash because no finish date is stored. |
| P-032 | ✓ | The attention list is the last card in the main column. |
| P-033 | ✓ | Added a "Clients" head link to the clients list. |
| P-034 | ✓ | Added a 44px `DateTile` (super-parts), tinted by urgency, with the full date as the tooltip. The date is the end of the current step's window (round 1 `currentStepDue`), else the next open filing. A client with neither keeps its initials tile. |
| P-035 | ✓ | Sub line "<step> · <manager>, <lead>". Step codes are not stored, so there is no code prefix. |
| P-036 | ✓ | Removed the phase bars from the rows. |
| P-038 | ✓ | Overdue and blocked rows have a full `bg-danger-soft` tint. |
| P-039 | ✓ | Urgent rows have a navy (`strong`) Open button. Other rows stay whole-row links. |
| P-040 | ✓ | Empty state is the dashed `EmptyState` "None". |
| P-042, P-059 | ◐ | "No lead" now reads "No one assigned". MCA notice and DSC or KYC risks need stored data (no data). |
| P-044 | ✓ | New `SuperTeamLoadPanel` rail card: name, "open of capacity", "N open · N overdue · room for N" and the load bar, from insights plus `/api/metrics/people`. Without a capacity it shows the client count and no bar. |
| P-056 | ✓ | (round 1) No page head. The grid card comes first. |
| P-057 | ✓ | (round 1) The kind tabs are in the card head. |
| P-061 | ✓ | (round 1) The client name links to the record. |
| P-062 | ✓ | (round 1) Manager, with the admin under it. |
| P-063 | ✓ | `riskAgeLabel` gives "Today", "1 day", "N days" and a dash. It now has a unit test. The same "1 days" defect was fixed in the Overview Top risks card and in the avg-days-to-COI cells (Team, Reports). |
| P-064 | ✓ | (round 1) One action per row: Remind, Assign (opens the assign dialog) or Open. After saving, the risk leaves the list; there is no green "Assigned" chip. |
| P-065 | ✓ | (round 1) Grey grid rows. |
| P-090 | ✓ | New `SuperProjectTimeline`: a read-only "Timeline" card with the shared `GanttTimeline` above the step list on the Steps tab. The data is `detail.timeline` (state, schedule, expected COI, certificate date), now returned by `getSuperEngagementDetail`. |

Every other row from P-001 to P-250 is unchanged. Rows outside my files (DashHero, RoleSidebar, FilingsView, step and board-resolution views, firm settings) belong to other agents.

## Files changed
- src/components/super/insights/super-insights-model.ts: `overdueFilingsNow`, `openRegistrations`, `buildPracticeAreas`, `areaHealth`, and the risk word "No one assigned" (plus round 1's history and `riskAgeLabel`).
- src/components/super/insights/super-insights-model.test.ts: `currentStepDue` in the fixture (the tsc error), and tests for the new helpers, `changeText` and `riskAgeLabel`.
- src/components/super/parts/super-parts.tsx: `DateTile` and `urgencyOf`.
- src/components/super/overview/SuperAttentionPanel.tsx: R-20 rows.
- src/components/super/overview/SuperPracticeAreasPanel.tsx (new).
- src/components/super/overview/SuperTeamLoadPanel.tsx (new).
- src/components/super/overview/SuperPracticeCards.tsx: Top risks age plural.
- src/components/super/project/SuperProjectTimeline.tsx (new).
- src/views/super/SuperOverview.tsx: tiles, order, new panels.
- src/views/super/SuperProjectDetail.tsx: timeline on the Steps tab.
- src/views/super/SuperTeam.tsx, src/views/super/SuperReports.tsx: "1 day" plural.
- src/views/super/SuperRisks.tsx: round 1 work, kept.
- src/db/repositories/super-overview.ts: `timeline` on the detail read (round 1's month counts and history kept).
- src/db/repositories/super-overview.test.ts: the stub supports `groupBy` (round 1's month counts broke two tests).
- src/lib/super/super-overview.ts: optional `timeline` field on `SuperEngagementDetail`. This is outside my listed files; it is a small additive super-admin type change.

## New routes
None.

## Schema needs
- Registration items need a finish date (for example `checklist state completedAt` per registration step, or a `registrations.completed_at` column). This would give "Done this month" for Registrations and a trend and change for "Registrations open".
- MCA notices and DSC or KYC expiry need storage for those risk kinds.

## Requests for shared files
None required.

## Decisions
- Assign task stays on the home card.
- The Need attention and Awaiting review tiles were dropped to match the four prototype tiles.
- The super record's Gantt is read-only, as in the prototype. Dates are edited on the firm view.
- Area health: On track when nothing is overdue, Watch when up to a fifth of active clients are overdue, At risk above that.

## Checks
- `npx tsc --noEmit -p .`: clean (the whole project, at 22:40).
- `npx eslint` on super files: 0 errors, 3 warnings.
- `npx vitest run` on src/components/super, src/components/timeline, src/db/repositories/super-overview.test.ts and src/lib/super: 52 tests pass.

## Round 2, continued (after ebc1fdc)

### Clients (SuperProjects.tsx)

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-068 | ✓ | Page head removed (R-09). The count is in the grid card head. |
| P-069 | ✓ | Small primary "Assign client" is in the grid card head. |
| P-070 | real only | The state tabs (All, Needs attention, With SBC, With the client) stay. The Overview links land on them through `?filter=`. |
| P-071 | ◐ | Picking an admin now narrows the manager list and clears the manager. The Lead chip stays (real). There is no Area chip because clients store no practice area apart from the stage, which already has a chip. |
| P-074 | ◐ | Step title over the lead. Step codes are not stored. |
| P-076 | ✓ | Admin, then Manager with the avatar. |
| P-078 | ✓ | Next is the end of the current step's window, else the earliest open filing (insights, falling back to the overview window). It is red when past. |
| P-079 | ✓ | One "Health" chip in the six words. The stored health and the reason are in its tooltip. |
| P-080 | real only | "Last move" stays. |
| P-081 | ◐ | The client name is now a real link (opens in a new tab), and the row click still opens the record. A whole-row link needs `EFilingGrid` support (foundations). |
| P-082 | real only | The phone card list stays. It reads better than sideways scrolling. |

### Client record (SuperProjectDetail.tsx, project/*)

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-086 | ✓ | The contact line adds the first client login's email as a mailto link. "Quiet N days" stays (real). |
| P-087 | real only | Firm view, Client portal, Assign task and Escalate are real super admin actions, so they stay next to Reassign and Documents. |
| P-088 | ◐ | Added "Days to COI" (start to certificate) once there is a certificate. Days with the holder needs a stored hand-over date per step (no data). Step codes are not stored. |
| P-089 | ◐ | Tabs renamed to the prototype words where they match: Filings is now "Obligations" and Activity is now "Audit". Steps stays (it covers every phase, not only incorporation). Escalations and Team stay (real). No Fees tab (P-100). |
| P-091 | ✓ | Meta "N of M steps · Step N of T" and a head link "Open current step". |
| P-092 | ◐ | No step codes ("Pre-1–5") because the checklist stores none. |
| P-094, P-095 | ◐ | Collapsible phases and the About panel were not built this round. Step times need per-step done dates in the journey read. |
| P-097 | ◐ | The card is titled "Obligations". The "With" column needs an owner per filing (no data). |
| P-100 | ✗ | No fee data in the schema (no data). It needs fee and invoice tables. |
| P-101 | ✓ | The card and tab are "Audit". |
| P-102 | real only | Stays. |
| P-103 | ✓ | Record-shaped skeleton (head, band, tabs, two cards). |

### Practice · Incorporation and Registrations

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-138, P-152 | ✓ | `SuperPageHead` now has a screen-reader-only h1 (R-09) and shows only the page's actions. This also covers Team (P-176), Growth (P-192), Reports (P-209 head) and every other page that uses it. |
| P-139 | real only | The number strip stays on Incorporation. |
| P-140 | ✓ | The pipeline card has the List icon in a blue (`info`) tile. |
| P-141 | ✓ | Boxes use gap-5. |
| P-142 | ✓ | A ChevronRight sits between the boxes at xl width. |
| P-146 to P-148 | ◐ | They live in `src/components/metrics/practice-cards.tsx` (not my file). The Target column needs stage targets (no data). |
| P-149, P-150 | real only | Stay. |
| P-151, P-065, P-190, P-207 | ✓ | `SuperPageSkeleton` now draws card shapes (head and grey rows) in place of tile shapes. |
| P-153 | ✓ | The Matrix view shows the matrix card alone. The number strip and status bar moved to the Work items view. |
| P-154 | ◐ | Meta stays "x in progress · y waiting". The real tool cannot tell "pending on documents" apart from other waiting. |
| P-161 | ✓ | Work items has two columns: the grid, and a 360px rail with "Registrations by status" and Stuck. |
| P-162 | ◐ | "Due in 7 days" needs a due date per registration item (no data). |
| P-163 | ✓ | New Stuck card: overdue items and items 14 or more days in their step (step events), with client, item · lead · days, a chip, and a dashed "None". There is no date tile because items store no due date. |
| P-164 | ◐ | No Due column (no data). The Lead column stays. |
| P-165 | ✓ | Overdue rows are red (`rowClassName`). |

### Team (SuperTeam.tsx)

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-176 | ✓ | Through `SuperPageHead` (R-09). |
| P-177 | real only | The number strip stays. |
| P-178 | ✓ | "Admins · this month" with the UserCog icon in a violet tile. The People link stays. |
| P-179 | ✓ | "Assign task" (outline) and "Assign client" (primary, UserPlus) are in the admins head and open the shared dialogs. |
| P-180 | ◐ | Added Assigned, Reassigned and Approvals (this month; round 1 audit and review counts), Esc. resolved (this month), Open (red) and Median response (time to resolve, this month) from `/api/super/escalations`. Actions 30 days and Last active stay (real). "Median response" measures time to resolve because escalations store no first-reply time. |
| P-182 | ✓ | Admins at full width, then Managers and Staff on the left with a 360px rail from lg. |
| P-183 | ◐ | Added the Admin column and amber Days to COI over 35. Approvals, Last active and Capacity stay (real). |
| P-184 | ◐ | `LoadCell` is in `src/components/metrics/people-cells.tsx` (not my file). The capacity bands are applied in the new Capacity card. |
| P-185 | ◐ | No Admins tab. The staff grid rows come from the manager and lead insights. Admins have their own grid above. |
| P-186 | real only | Account chip and Capacity stay. |
| P-188 | ✓ | "Capacity" card: Gauge tile, meta "used / total · N clients per manager", one bar per manager against the capacity in the bands (under 70%, 70 to 80%, over 80%), with the legend. "No capacity set" when unset. |
| P-189 | ✗ | No data: suggested moves need a rule or a stored suggestion. Reassign already exists on the client record and in Risks. |

### Growth (SuperGrowth.tsx, growth/*)

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-192 | ◐ | The title is gone (R-09, `SuperPageHead`). "Add prospect" stays because the prospect dialog is real. |
| P-193 | ◐ | Added "Room across the managers": open items left under the managers' capacities, green when above 0, "No capacity set" when no capacity is set. The other real tiles stay. |
| P-194 | ◐ | TrendingUp icon in a blue tile. The win-rate window and Board / List switches stay (real). |
| P-195 to P-201, P-203, P-204 | real only | The real five-stage pipeline, list view, dialogs, demo requests and charts stay. |
| P-197 | ◐ | "Assign a manager" on a won card needs an engagement first. The real flow links the won prospect to an engagement (Convert), and Assign then lives on that client. |
| P-202 | ✓ | "Capacity · can the team take more?" uses the new shared `SuperCapacityCard` (also on Team): per-manager bars in the 70/80% bands against the set capacity. |
| P-205 | ✓ | An empty stage column shows a dashed `EmptyState` "None". |
| P-206 | ◐ | Success and error toasts stay. Undo would need reversible mutations. |
| P-207 | ✓ | Card-shaped page skeleton (shared). A failed pipeline read shows a dashed state with "Try again" in place of red text. |

### Reports (SuperReports.tsx, reports/*)

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-209 | ✓ | One row: month tabs, "Partner report · prepared on <date>", then Print, Save report and Download PDF (primary) at the right end. The H1 is screen-reader only. Print and Save stay (real). |
| P-212 | ✓ | The SBC lockup is on the right of the report header (`/sbc-logo-light.png`). |
| P-213 | ✓ | Dark mode swaps to `/sbc-logo-dark.png` (`dark:block`). |
| P-214 | ◐ | The tiles come from `src/lib/reports/partner-report.ts` (shared with the PDF route, not in my files). Client movement and registrations completed need data the lib does not compute yet. Registrations completed needs a registration finish date. |
| P-216 | ✓ | Added the Admin column (manager's reporting line). Overdue stays (real). |
| P-217 | ✓ | "Top risks for <next month>". |
| P-219 | ◐ | Added a "Period" filter chip (shown when reports span more than one month). There is no Area chip because every saved report is the partner report. |
| P-220 | real only | Send to and Last sent stay. There is no area to show. |
| P-221 | ✓ | "Run" (outline, Play icon) opens the report above. Schedule, Download and Delete stay. |
| P-222 | ✓ | The open saved report row has `bg-brand-soft`. Picking another month tab clears it. |
| P-223 | ✗ | Owner decision R-37: no money in the tool. |
| P-224, P-226, P-227, P-228 | real only | Stay. A print stylesheet for the shell belongs to `app/globals.css` (foundations). |
| P-225 | ✗ | There is no XLSX export and no dependency for it. The rules forbid new dependencies. |

### Firm settings and shared rows

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-229 | ✓ | The H1 is screen-reader only. The Firm / Your profile tabs stay. |
| P-230, P-233 to P-235, P-239, P-240, P-244 | ◐ | These are in `src/views/firm-settings/*`, which other roles share and which is not in my files. The firm-settings owner should take them. |
| P-231, P-232 | real only | People are managed on `/app/admin/people`. Duplicating the roster here would repeat navigation. |
| P-236, P-237 | ✗ | Permissions are code-defined per role (`src/lib/auth.ts`). Editable role permissions need a permissions table and enforcement in every repository. Owner decision. |
| P-238 | ✗ | No data: the firm stores no service targets. It needs a `firm_settings.service_targets` field. |
| P-241 | ✗ | Integrations live per user (Outlook on the profile). A firm-level list needs an integrations store. |
| P-245 | ✓ | `/app/super/profile` already exists (round 1, committed). |
| P-246 | ◐ | Shared `src/lib/ui/card-head-icon.ts` (foundations). I passed explicit icons where my cards needed them (pipeline List, Sales pipeline TrendingUp, Admins UserCog, Capacity Gauge, Team load Users). |
| P-247, P-249 | ◐ | Shared (`DashSection`, `EFilingGrid`): foundations. |
| P-248 | ◐ | `SuperNumberStrip` keeps the 180px minimum and word icons. Not changed this round. |

### Rows in other agents' files (not touched)
P-004, P-006 (DashHero), P-105 to P-110 (step view), P-112 to P-115 (board resolution), P-116 to P-124 and P-167 to P-170 (compliance views), P-129 to P-136 (RoleSidebar), P-146 to P-148 and P-184 (metrics cards).

### Overview, second pass

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-017 | real only | The "How is this counted?" text stays. It explains real counting rules, including what has no history. |
| P-018 | ✓ | Practice cards are three in a row from md, with gap-5. |
| P-019 | ✓ | Incorporation uses the Award icon in a violet tile and the "Open" link. Registrations uses IdCard (violet) and Compliances uses ShieldCheck (green). |
| P-020 | ◐ | Rows are the real checklist phases. The prototype's four stage names do not exist as data. |
| P-021 | ◐ | "· target 30" needs a stored target (no data, see P-238). |
| P-022 to P-024 | ◐ | "Waiting" stays (R-13 six words). The Overdue segment stays because it is real. |
| P-025 | ✓ | Big 26px total. Five segments: Overdue, Filed late, Due this week (open and due within 7 days), Upcoming, Filed on time. |
| P-026 | ◐ | "Most overdue: <authority>" stays because filings store an authority, not a statute. The link opens the real compliance calendar (there is no super compliances route). |
| P-027 | ✓ | Main column plus a 360px rail from lg, with gap-5. |
| P-028 | ✓ | "Admins · this month", UserCog violet tile, "Open team" link to /app/super/team. |
| P-029 | ✓ | Admin (managers under), Clients, Assigned and Approvals (this month, insights), Open esc. (red), and Response (median time to resolve this month). The Managers avatar stack, Open steps and Attention columns were dropped from this card; they remain on Team and Clients. |
| P-030 | ✓ | Manager "under <admin>", Clients, Open, Overdue, On time % and Load (against capacity, red over 80% and amber from 70%, else relative). |
| P-051 | ◐ | The Overview skeleton (`SuperOverviewSkeleton`) still draws five tiles. Not changed. |

## Final checks (round 2, continued)
- `npx tsc --noEmit -p .`: no errors in super files.
- `npx eslint src/views/super src/components/super`: 0 errors, 3 warnings.
- `npx vitest run` on src/components/super, src/components/timeline, src/db/repositories/super-overview.test.ts, src/lib/super and src/lib/reports: 63 tests pass.

## Files changed in this continuation
- src/views/super/SuperProjects.tsx, SuperProjectDetail.tsx, SuperPracticeIncorporation.tsx, SuperPracticeRegistrations.tsx, SuperTeam.tsx, SuperGrowth.tsx, SuperReports.tsx, SuperSettings.tsx, SuperOverview.tsx
- src/components/super/parts/super-parts.tsx (`SuperPageHead` R-09, card-shaped `SuperPageSkeleton`)
- src/components/super/overview/SuperAdminsPanel.tsx, SuperPracticeCards.tsx, SuperCapacityCard.tsx (new)
- src/components/super/project/SuperProjectJourney.tsx, SuperProjectRail.tsx
- src/components/super/growth/PipelineBoard.tsx
- src/components/super/reports/SavedReportsCard.tsx
- src/components/super/insights/super-insights-model.ts and its test (`capacityTone`, `roomAcross`, `medianResponse`)
