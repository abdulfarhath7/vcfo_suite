# Lead portal — v1 canvas

Canvas: https://claude.ai/artifact/FbrWXzQRpXkiiSTn9UGdXd (private; share it from the page's Share menu)

Built 2026-10-16 from `PLAN.md`. All data is fake. The look is taken from the frozen client prototype
(`docs/specs/client-pages/prototype/`): navy greeting card with a gold rule, cards with a radius of 10 px or less,
the navy sliding pill, set-A status glyphs, option-4 icon tiles, a calendar with grid lines and today drawn as a
whole highlighted box, and the smiling Ask VCFO bot. "NEW" badges mark features the code does not have yet.

## Shared pieces

- `Side.dc.html` is the sidebar and `Top.dc.html` is the top bar. Every page imports both, so a change to either
  shows on every board.
- Sidebar order: Today, Work (9), Clients (8, with the client list and client colours), Email, Docs (Vault,
  Knowledge Bank), Updates (Announcements, Notifications), Compliances (Calendar, Filings; only once a client
  has its COI), Analytics, Audit. At the bottom: a mini calendar with due days, Your managers, and the account
  row with pin mode and settings.
- Top bar: SBC logo, location trail, the preview switch (All incorporating · Mixed · All compliance),
  Search (Ctrl K), Announcements, Notifications, Theme.
- Client colours: Brightwave pink, Tidewater teal, Kestrel sky, Halcyon ochre, Northwind violet, Orchid indigo,
  Larkspur green, Juniper slate.

## Pages (canvas page → boards)

| # | Page | Boards | What's on them |
|---|---|---|---|
| 1 | Today | Main (switch works in Play), TodayBefore, TodayAfter, TodayPhone | Greeting card with KPIs and the NEW All/Incorporating/Compliance switch; NEW daily digest from the bot; week strip (option 3) whose day click filters the queue; action queue grouped by company with every CTA and a pin; NEW Ball in court (Me/Client/MCA) with Nudge; phase progress (focus track); NEW client health table with a step tracker; NEW triage (Make task · Done · Snooze); to-dos; compliance health (donut, legend, next 2); Waiting on (top 5); managers with Email. Before COI: phase tracker, phase-bar timeline, stuck steps, Days to COI. After COI: client × filing grid, donut, due-date calendar, one-time "Incorporated" note. |
| 2 | Work | Work (Day/Week/Month work in Play), WorkBoard, WorkPlan, WorkDrawer, WorkPhone | Timeline on top (manager bars locked, my to-do dashed, waiting striped, recurring outlined, filing diamonds read-only, gold line for today); To-do grouped as Assigned by manager / My to-dos / Waiting on client + Nudge / Recurring this month; Google-style calendar with all-day compliance items, client-coloured blocks, a to-do being dragged onto Friday 4:30 PM, and the amber "After task end" warning; Request change pop-over and dialog; Plan my week panel; task drawer; Board view (Needs action / In progress / Waiting / Done this week) and List view with J/K/Enter; Templates, Export, filters. |
| 3 | Clients | Clients | Table with a 4-phase stepper (option 1), stage chip, step now, ball dot, SPICe+ ring. |
| 4 | Engagement overview | Overview | Navy header (client mailto, CC editor, Status brief, Board resolution, Documents, SPICe+ ring 43%, Days to COI). Phase rows Part A / Part B / Post-inc / Registration with tick tracks and document pills; Part B opens in place with set-A glyphs, What's this? and → links. |
| 5 | Step | Step | Window From/To, Open in document pack, Copy for Assist, Forms (Filed / To file) and Activity tabs, upload, Accept/Reject, Send reminder, Request client to fill, Request manager approval, Mark all complete, journey rail, doc-pack readiness, and the What's this? drawer (VCFO Assist profile). |
| 6 | Documents | Documents | Ready / needs inputs / waiting chips, ZIP download, Part A/B filter, per-part progress, a dashed row for missing inputs, preview pane. |
| 7 | Board resolution | BoardRes | Editable .docx preview, save state, Save / Apply latest template / Re-generate from Pre-1 / Download, a 5-stage status rail, Finalize confirm, then Send to client. |
| 8 | Email | Email | Outlook status, recipient picker (People/Team/Client, All teams/All clients), subject, body, templates panel (Create/Edit/Delete, branding). |
| 9 | Vault | Vault | Document and client counts, client list, search, files grouped by step (or by category), preview and download. |
| 10 | Knowledge Bank | Knowledge | Classic shelves, folder path, search, New folder, upload form. Delete is shown as manager-only. |
| 11 | Announcements | Announcements | All/Important/General, Latest list, official portals and circulars. |
| 12 | Notifications | Notifications | All/Today/This week/Earlier × All/Received/Sent, grouped history with option-4 icons. |
| 13 | Compliances | CompCal, Filings | Month grid (company picker, All/Overdue, legend for 5 areas, compact donut, Next deadline card, day pop-up with ↗ portal links); filings register with every filter and column, and a side panel. |
| 14 | Analytics | Analytics | 4 KPIs, completion-rate bars vs the 95% target, filing-delay line vs the 2-day benchmark (sample data). |
| 15 | Audit | Audit | Global/By project, search, role and type filters, an expanded row. |
| 16 | Settings | Settings | Profile, WhatsApp opt-in, password, Outlook, appearance, Sign out. |
| 17 | Shell | Side, Top, Palette, Chat | Sidebar and top bar as standalone boards; Ctrl K palette with the "Project Lead workbench" group; notification and announcement bell drop-downs; Ask VCFO chat with the smiling avatar in its idle, answered and can't-answer states. |

## Defaults taken (no approval asked, per the owner)

- In Work, the Planner view is the default and List and Board stay as tabs. Tasks are created only in To-do; the timeline and the calendar show the same task.
- Work sessions the lead places outside a manager's span are allowed but get an amber warning. Manager dates can only be changed through Request change.
- Clients after their COI count as Compliance, so a client in post-incorporation or registration is under Compliance.
- Phone frames exist for Today and Work only.
