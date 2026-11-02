# Prototype design-system audit (v8 to v9)

Date: 22 October 2026. Reference: the design system book v1.1 (https://claude.ai/artifact/PoWkhaBqShy1ruSCtZPwPA).
Source: `~/Documents/reference/vcfo-suite/vcfo-prototype-v8.html` (kept untouched). Fixed copy:
`~/Documents/reference/vcfo-suite/vcfo-prototype-v9.html`, written by
`node docs/specs/landing-page/src/proto-fix/patch.mjs`. The landing build now merges v9 into
`dist/vcfo-suite.html`.

How the audit was done: full-height captures of 24 lead and 15 client screens at 1440 px, and a read of
every screen file in the prototype bundle. Status: **Fixed** in v9, **Partly** fixed, **Open**.

## Bugs

| # | Finding | Status |
|---|---|---|
| 1 | Lead account row showed a sun-shaped "gear" and a PIN chip where the client has Sign out; the row was a link, not a button, with a hidden label | Fixed: real Sign out button with label and toast; Settings moved into the nav |
| 2 | "VCFO Suite home" tooltip over Today | Not a bug: the capture tool's pointer rested on the logo |
| 3 | Sidebar labels underlined on Analytics, Chat and the Work views | Fixed |
| 4 | 31 SVG attributes with unfilled `{{...}}` placeholders log console errors (17 files) | Open |
| 5 | Ask VCFO launcher and toasts cover buttons; clipped columns and breadcrumbs; "97%" over "95% target" | Open |
| 6 | Search, notifications and announcements popovers open at the same time | Open |

## Shell

| # | Finding | Status |
|---|---|---|
| 7 | Nav says "Today", lead breadcrumbs said "Home" | Fixed |
| 8 | Lead nav groups never collapse; client groups do | Open |
| 9 | Lead highlighted the parent ("Docs") when a child was active | Fixed: child only |
| 10 | No Settings item in the lead nav | Fixed |
| 11 | Top bars differ (back button, separators, Ctrl K vs ⌘ K, "SBC" text instead of the logo on client Compliances and Filings) | Open |
| 12 | Theme icon is a sun on some pages, a moon on others | Open |
| 13 | Bell badge navy on lead, blue on client; megaphone only on client | Open |
| 14 | Preview switch labelled on lead, unlabelled on client | Open |
| 15 | Active nav rail gold on lead, blue on client | Fixed: gold on both |
| 16 | Account avatars a gold circle (lead) and a blue circle (client) | Partly: lead neutral rounded tile |

## Foundations

| # | Finding | Status |
|---|---|---|
| 17 | No Public Sans anywhere (Manrope, Space Grotesk, Inter, serifs); mono on dates, counts and heads | Fixed: Public Sans everywhere; mono kept for identifiers only |
| 18 | Lead ran a second palette (149 hex values, 68 percent off the tokens) | Partly: the 25 most used values mapped to tokens |
| 19 | Radii 2, 3, 4, 5, 7, 9, 11 px | Fixed: 6 / 8 / 12 |
| 20 | Button heights 22 to 68 px; 84 px minimum only inside tables | Partly: 32 px default and 84 px minimum on `.btn` |
| 21 | Shadows off the two tokens | Partly: cards only |

## Same component, different look

| # | Finding | Status |
|---|---|---|
| 22 | Tables: Action queue and Clients x filings had no row lines; others had them, all with different heads | Fixed on lead Today (Action queue, Phase progress, Clients x filings, Client health) and every `.tbl` table: sunken head under a 2 px rule, 40 px rows, hairlines, striping. Open on Filings register, Work to-do list, Audit timeline |
| 23 | Soft chips in status columns, widths 47 to 130 px | Partly: 88 px in table columns |
| 24 | In progress navy, waiting grey or blue; Phase legend did not match its cells | Partly: My step and Phase cells now blue, legend matches |
| 25 | Client chips blue on lead, orange on client; "Me" solid navy | Fixed on Client health |
| 26 | Company and person colours (dots, tiles, avatars, calendar blocks) | Owner decision (22 Oct): each client keeps one colour so the lead recognises it; Today now uses the same eight colours as Work, Vault and the sidebar. People stay neutral |
| 27 | Five section header styles | Open |
| 28 | Page heads inconsistent, no 2 px rule | Open |
| 29 | Several primaries per region, navy vs blue primaries, orange outlined buttons | Partly: Triage has one style |
| 30 | Seven progress bar drawings | Open |
| 31 | Initials tiles neutral on Today, coloured elsewhere | Fixed on lead |
| 32 | Date tiles soft pink on lead, solid colour blocks on client | Open |
| 33 | Sidebar mini calendar gold today cell and coloured underlines | Partly: today cell neutral |
| 34 | Four segmented control and filter styles | Open |
| 35 | Counts in five colours | Partly: sidebar counts neutral |
| 36 | NEW badges gold or yellow mono | Fixed: one neutral "New" tag |
| 37 to 41 | Documents lists, callouts, empty states, search fields, Settings forms differ | Open |

## Structure

| # | Finding | Status |
|---|---|---|
| 42 | Gradients beyond the greeting card | Partly: lead client page and step headers flat; client pages open |
| 43 | Coloured left borders | Fixed on lead (Work board, Vault, Palette) and client 3px bars |
| 44 | Cards inside cards | Partly: Ball in court flattened |
| 45 | Gold used as fill or rule | Partly: sidebar, Settings avatar and card stubs removed |
| 46 | Too many orange moments | Partly: NEW badges and sidebar labels neutral |
| 47 | Red on non-destructive actions | Partly: Sign out neutral |
| 48 | Green WhatsApp button on client Team | Open |

## Copy and data

| # | Finding | Status |
|---|---|---|
| 49 | "in N days" for statutory deadlines | Fixed: real dates or "Not filed yet" |
| 50 | "14 Sept", "12:31 PM" | Open |
| 51, 52 | Em and en dashes, emoji | Fixed |
| 53, 54 | Title Case; "BALLIN COURT", "Submit", "Finalize" | Fixed |
| 55, 56 | Today's date and counts disagree across screens | Open |
| 57 | People's names and titles disagree | Partly: client contact is Rohan Kumar everywhere; lead sidebar titles match Team |
| 58, 59 | Lead Filings and Audit single-company; client copy on lead Notifications | Open |

## Manager portal and the 23 October source (v10)

The owner's 23 October file added a Manager portal and a few lead features. v10 is built from it.

| # | Finding | Status |
|---|---|---|
| 60 | Manager screens greeted Kavya and showed her as the account; the nav lists Priya's three leads | Fixed: Priya Raman, Project manager, everywhere in the Manager portal |
| 61 | Manager sidebar kept a "Your managers" block | Fixed: removed; her leads sit under My leads |
| 62 | "My Leads" in title case; lead avatars in four hues; gold "All 3 leads" link | Fixed: "My leads", neutral rounded tiles, neutral link |
| 63 | My leads page title above the lead picker; round picker buttons | Fixed: no title, 8px corners |
| 64 | Team tasks: soft status chips, grey company tiles, round people avatars | Fixed: solid state chips, client colour tiles, rounded people tiles |
| 65 | Client health columns all one width (the source's colgroup is dropped by the template), so the bar sat under its label | Fixed: widths on the heads |
| 66 | Work timeline second line wrapped into the next row after the label column narrowed | Fixed: truncates with the full text on hover |
| 67 | "Plan my week" orange outlined button; "Plan Sneha 's week" spacing | Fixed: secondary button; "Plan the week" |
| 68 | Gold underline under the greeting card | Fixed: removed (book v1.2: gold is only a ring or the nav rail) |
| 69 | My leads repeated the sidebar's lead list as a picker | Fixed: picker removed; the sidebar picks the lead and marks it, and the page opens on the lead's name, counts and actions with the clients filter under them |
| 70 | Picking another lead on My leads did nothing, and the sidebar lead rows never navigated (their text starts with the initials) | Fixed: rows carry a label; on My leads the switch happens in place |
| 71 | Lead and manager primaries navy, selected segments and filters navy, 6px buttons | Fixed: brand blue primary, brand-soft selected option, 8px corners, white secondary on a hairline (book v1.2) |
| 72 | Client home opened on "Needs from Northwind"; the owner wants the timeline and the steps first | Done on both home variants (before and after COI); the phone home is unchanged |
| 73 | Work and My leads showed a nine-chip client row, a three-way Steps or filings segment and a date chip | Fixed: two compact dropdowns (Clients, multi-select with client dots; Show, single choice) beside the view switch; they filter the timeline and the to-dos; the date chip is gone |
| 74 | Team tasks had three native selects | Fixed: Intern and Company dropdowns in the same style; status comes from the legend rows, and the donut opens the breakdown |
| 75 | Four header buttons on Work and My leads | Fixed: Plan and the one primary stay; Templates and Export sit in a More menu |
| 76 | Sidebar Clients and My leads could not fold; an "All 3 leads" link repeated the list above it | Fixed: the real app's chevron folds each group and the choice is remembered; the link is removed |
| 77 | The client page header's three buttons (Status brief, Board resolution, Documents) turned into blank white boxes after the button fix | Fixed: buttons on a navy ground keep their light-on-dark style |
| 78 | Opening a client did not select it in the sidebar | Fixed: the open client's row is selected and Clients stays plain; a client outside the four listed is added while open |

## Admin portal and one set of people (v10, 23 October)

The owner asked for an admin portal and named the people: Krishna is admin, Mithilesh is super admin (not built yet), Pranay is manager and Bharath is project lead. "Intern" is now "project lead" everywhere, with one layer under a manager.

| # | Change | Where |
|---|---|---|
| 79 | Kavya Iyer is Bharath and Priya Raman is Pranay on every screen, including the client portal's team card; initials follow | patch.mjs section 16 |
| 80 | The manager's "My leads" is "Project leads" (Bharath, Sneha Kulkarni, Meera Nair); the interns and Rohan Das are gone, Team tasks drops its Lead column, and every "intern" is "project lead" | section 16 |
| 81 | New Admin portal (routes `admin-*`): Today, Work, Managers, Clients and a read-only client view with Reassign and Assign a task | section 17, `proto-fix/admin/` |
| 82 | Admin Today: every client with stage, step, progress, manager, ball in court, next date and health; managers' load; a pipeline that filters the table; October filings; stuck and overdue | `admin/Main.dc.html` |
| 83 | Admin Work: manager items by default, project leads on a switch, status from the legend, open-by-person and by-area charts; the manager's planner only from a corner button | `admin/Work.dc.html` |
| 84 | One assign dialog for a whole client (with each manager's load) or, rarely, one task | `admin/assign.js` |
| 85 | Three managers to compare: Pranay keeps the 8 clients; Priya Raman and Arjun Mehta each run 3 new demo clients | `admin/data.js` |

Known limit: every client row opens the Northwind client view, as on the lead and manager portals, because the prototype has one client page.
| 86 | "Ball in court" (section titles, table heads, "Ball: me") was sports slang | Fixed everywhere: "Pending with", the term Indian practices use; values stay Client, SBC, MCA or "me" |

## Super admin portal (v10, 23 October)

Mithilesh, the super admin, sees the whole firm: two admins (Krishna and Ritu Agarwal), four managers (Ritu oversees Vikram Shah) and 17 clients. He does not see project-lead detail.

| # | Screen | What it shows |
|---|---|---|
| 87 | Overview | Firm numbers; incorporation, registrations and compliances side by side; admins and managers; top risks; clients needing attention |
| 88 | Clients | All 17 with admin, manager, pending with, fees due and health; Admin, Manager and Stage filters; read-only client view naming admin and manager |
| 89 | Practice areas | Incorporation pipeline, days per stage against target, expected certificates; a registrations grid by client and type; Compliances is the same calendar and filings register as the other portals (owner, 23 Oct) |
| 90 | Team | What each admin did this month and an activity feed; managers' load, on-time rate and days to COI (a row opens that manager's page) |
| 91 | Money | Billed, collected, outstanding and late-fee exposure; fees by service line; collections ageing; overdue filings with their late fees |
| 92 | Risks | Overdue filings, MCA notices, DSC and KYC, clients with no manager, deadlines with no one assigned; Nudge and Assign |
| 93 | Growth | New engagements, the sales pipeline, and room across the managers |
| 94 | Reports | The October partner report on one page with Download PDF |
| 95 | Settings | People and roles, service targets, service catalogue and branding |

Source files: `proto-fix/super/` (screens and `super.css`) and `proto-fix/admin/data.js` (shared data); patch.mjs section 18 wires them in.

## Practice areas on every dashboard (v10, 23 October)

| # | Change |
|---|---|
| 96 | The super admin's three practice cards (incorporation, registrations, compliances) sit under the greeting on every staff home: lead and manager (Pranay's 8 clients), admin (Krishna's 14). One shared component, `proto-fix/shared/Practice.dc.html` |
| 97 | The client home has a Northwind version under Steps: before the certificate it says registrations and filings start after it; after, it shows registrations done and filings due and overdue (`shared/v7c_practice.dc.html`) |

## Developer console (v10, 23 October)

Farhath, Developer, manages SBC's own setup. Every change asks first (`proto-fix/dev/confirm.js`) and lands in the audit list.

| # | Screen | What it shows |
|---|---|---|
| 98 | Overview | Services with uptime and response time; what needs attention, led by the missing `CREDENTIALS_ENCRYPTION_KEY` on App Runner |
| 99 | Connections | 17 connections by group: email, WhatsApp, SMS (DLT), Outlook, Teams, Google Workspace, VCFO Assist, GST API (GSP), Income-tax ERI API, DigiLocker, e-Sign, payments, accounting sync, Ask VCFO, storage, error tracking, webhooks and keys; a panel with settings, a masked secret, Test, Edit and Disconnect |
| 100 | Messages | Every message type with its channel, sending address or number, template and approval, recipients, volume and delivery; Test and Edit; email domain checks; failed messages with Retry |
| 101 | Jobs | Scheduled jobs with last and next run, failures, Run now and Retry |
| 102 | Logs | Errors, failed deliveries and webhooks with Level and Source filters and an opener for detail |
| 103 | Deploys | Environments, feature flags, pending migrations and deploy history with Roll back |
| 104 | Access | Secrets and API keys with expiry and Rotate, sign-in methods, people signed in now |
| 105 | Data and costs | Backups and restore tests, volumes, and cost by service against budget |
| 106 | Audit | Every console change with before and after |

## Less like a slide deck (v10, 23 October)

| # | Change |
|---|---|
| 107 | Every staff portal: card titles in sentence case at 14px with no icon tile; no "New" or stage tags beside titles; flat cards with a hairline; the greeting is a white header, not a navy banner (`ds.css`, `html.ds-staff`) |
| 108 | Lead and manager Today drop four cards that repeat others: Timeline · phase bars, Days to COI, Compliance health, Waiting on (patch.mjs section 23) |
| 109 | Admin Today gains Phase progress (client by phase, days to COI, manager) and drops Pipeline and Filings, which repeated the practice row |
| 110 | Super admin Overview drops Clients needing attention; Top risks takes the full width |

## Fewer cards, denser lists (v10, 23 October, "do all the ideas")

| # | Change |
|---|---|
| 111 | Lead and manager Today: Triage and My to-dos become one Inbox card with two tabs. A triage row shows Make task, Done and Snooze only when it is hovered or focused (patch.mjs section 24) |
| 112 | Lead and manager Today: the Stuck steps card is gone; the first stuck step is one red mark in the Action queue header ("1 stuck · MCA query on SPICe+") that opens the step |
| 113 | Lead and manager Today: This week is a thin strip; each day shows its count and its first item |
| 114 | Manager Today: Team tasks and Task status read as one card with a divider |
| 115 | Manager Today: "Waiting for your approval" at the top of the right rail lists Pranay's approvals and reviews with one Approve or Review button (`proto-fix/shared/Approvals.dc.html`, section 25) |
| 116 | Admin Today: "Needs your decision" between Managers and Stuck and overdue. Lotus Dental (won, no manager) has Assign, which opens the assign dialog with the new client; escalations from Krishna's managers have Decide |
| 117 | Super admin Overview: each number in the strip shows its change against September, green when it is good news and red when it is not |
| 118 | Client home: "Your next action" strip under the greeting (one item and one button); a Fees card with Pay now (Razorpay) and Invoice; "Who holds it now" and its "Steps around Northwind" list are removed because the timeline and Steps cards show the same (section 26) |
| 119 | Developer Overview: each service tile has 30 days of uptime bars (amber for a slow day, red for an outage); an Incidents card beside Needs attention |
| 120 | Every staff table: 36px rows; a filled state chip inside a table cell becomes a coloured word with a dot (the design layer's `words()` sweep in patch.mjs) |
| 121 | Admin Today drops Stuck and overdue: the clients table already shows Stuck and Overdue in its Health column, and Phase progress marks stuck phases. Managers and Needs your decision now share the last row |

## Round 3 (v10, 26 October): fixes, Registrations, Obligations, Profile

| # | Change |
|---|---|
| 122 | Client Steps card: the count chips line up (fixed 116px) and the "done / in progress / upcoming" words are gone; Phase 4 leaves the card (patch.mjs section 27) |
| 123 | Client home: two independent columns (left wide, right 360px), so a tall right column no longer leaves gaps on the left; the practice row, the Fees card and the registrations table leave the home |
| 124 | Greeting on every staff home: navy band with the date and name, numbers in a white strip under it (label above the number), faint layered peaks in the band; numbers roll in once (sections 28, design layer) |
| 125 | "Nudge" is gone from every screen: Remind, Send reminder, Reminder due, WhatsApp reminders (section 29) |
| 126 | Super admin: no money anywhere (Money page, collected, late-fee exposure, fees due, rupee impact, pipeline values, fee tables and rates removed) |
| 127 | Lead and manager Today: nine blocks to five. This week, Pending with and Client health removed; practice row is a strip of three numbers; Waiting on client joins the Inbox rail; Phase progress drops the Registration column; Clients × filings keeps only clients with an overdue or due-soon filing (section 30) |
| 128 | Task rows (manager Team tasks, admin Work): a checkbox and one status icon (circle, half, clock, tick); a late task shows a red due date (section 31) |
| 129 | Every staff table: pale navy head in sentence case; state as a soft pill with a dot (the font-options artifact) |
| 130 | Registrations page for the client and every staff portal: risk strip as filter, groups by category (Tax, Labour, Business, IP, FEMA) with authority, number, status and date; staff get a client dropdown and a List / Grid switch; right rail with progress flow, renewals, waiting on client, recently granted and next to start. Data from the SBC manual (`proto-fix/shared/regcat.js`, `Register.dc.html`) |
| 131 | Registration page: deadline band (ring, dates, people on it, one action that shows working then done), the two-sided thread (authority left, SBC right, date tiles on the spine), From the client (Accept, Ask again with a reason popover, drop area), Filled by SBC, About with the SOP link, Applies because, What it starts, Renewal, and a staff-only Before filing list (`Item.dc.html`) |
| 132 | Obligations page (Compliances › Calendar · Filings · Obligations): By frequency / By law switch, law chips, penalty on the page and in the tooltip of a red date, "Started by GST registration", past periods |
| 133 | VCFO Assist on staff registration and obligation pages: a live step list with a screenshot per portal page, and a replay kept in Audit; a live status pill at the top of the screen while work runs |
| 134 | Profile on every portal, opened from the account row at the sidebar foot; Settings leaves the lead and manager sidebars; admin and super admin keep "Firm settings" (section 33) |
| 135 | Staff Vault is the client Documents explorer (tree, preview, toolbar) with a client dropdown first (section 34) |
| 136 | Inbox: a new item slides in at the top; Ask VCFO opens on "What can I do for you?" with four quick-start chips (sections 35, 36) |
| 137 | Library: the SBC SOPs are a shelf of books; spines slide in; the hovered book comes forward and the rest dim (section 37) |
| 138 | Email: "Signature from Outlook · server-side signature on" beside Outlook connected; a dashed note under the draft says the Outlook signature and SBC footer are added on send (section 38) |
| 139 | Client step pop-up: the stage chips become the vertical stepper; Phase 4 leaves the staff Overview phase list and admin Phase progress; staff client page gets record tabs (Incorporation, Registrations, Obligations, Documents, Notes) (sections 39 to 41) |
| 140 | Landing: a soft spotlight and slow beams behind the hero; layered peaks on the sign-in card; "25 steps in every incorporation" |

## Portal refresh (v10, 26 October): rules from claude.ai/artifact/RhNoYnFXSJgV1TU4fFrFws

| # | Change |
|---|---|
| 141 | Refresh palette on every screen: canvas #F5F6F8, ink #16212F, muted #667180, line #E3E6EB, primary blue #2563A8, sidebar navy #15263B, statuses green #1E7F55, amber #A35F00, red #BE3434, idle #56627A, each with a soft tint (patch.mjs section 42 remaps every payload file) |
| 142 | Status as quiet chips everywhere, client portal included: anything painted as a solid block with white text (chips, date tiles, grid cells, heatmap counts) becomes a soft tint with a dot and text of the same hue; real buttons, the sidebar and the one navy band stay |
| 143 | One typeface: Public Sans for everything, identifiers included, with tabular figures (Roboto dropped: the document picks Public Sans) |
| 144 | Brand orange only for small highlights: the sidebar's active marker, the timeline's Today line and pill |
| 145 | Primary buttons and the selected tab in every toggle in navy (#1F3B5C); table heads pale navy; card head icon tiles back at 28px in soft tints |
| 146 | Sentence case everywhere: uppercase labels and headings rewritten, keeping acronyms, months and names |
| 147 | Client summary card: navy name band, the five numbers in a white strip with a thin colour line; the 43% SPICe+ ring goes (one progress number) |
| 148 | Greeting strips on staff homes get the thin colour line and a tinted marker before each label |
| 149 | Charts: Task status and the practice Compliances card use one stacked bar with a legend instead of a donut |
| 150 | Ctrl K instead of ⌘ K; the Ask VCFO mascot no longer covers the page (one small launcher) |
| 151 | Sidebars in priority order on every portal: daily work, then dated work, then communication, reference and reports; the client sidebar puts Incorporation first while incorporating and Compliances first once incorporated |
| 152 | No decorative colour lines: the gradient line on greeting strips, the tinted label markers, the gold fade under page heads and the orange line on top of cards are gone; table heads have a hairline, not a dark rule |
| 153 | Developer console in the lcc Settings shape: a section rail, then cards of label-and-value rows that save as they change |
| 154 | Developer Connections: every connection in the rail with a status dot; WhatsApp shows account, number, quality, limit, credentials, event webhook, templates, delivery and failure codes, rules, a test send and disconnect; Email, SMS, Outlook, Teams, extension, payments, Ask VCFO, storage, error tracking and API keys in the same detail |
| 155 | Developer Overview, Messages, Jobs, Logs, Deploys, Access, Data and costs and Audit redrawn the same way (uptime per service, routes, schedules, flags, secrets, sessions, costs) |
| 156 | Every card head: 52px, hairline under it, 14.5px title and a tinted icon tile chosen from the title; existing tiles are recoloured by the same rule |
| 157 | Greeting numbers get a tinted icon tile; label above the number |
| 158 | Segmented controls are small inline buttons with the picked one in navy; no sliding thumb; Needs tabs sit in the card head |
| 159 | Client Steps: flat phase rows with a 6px progress bar and the count chip |
| 160 | What SBC is doing: bars in category colours, no info icons or link buttons |
| 161 | Incorporation: the four charts sit in one strip; timeline rows open steps with a small chevron and the phase from its name (no Steps or Open buttons) |
| 162 | Compliance calendar: hairline grid, tinted day badges and date tiles, today in soft blue |
| 163 | Important alerts and What is next follow the refresh attention list: full-width rows with hairlines, a 44px date tile tinted by urgency, chips on the right, and the urgent row as a soft red wash with a red edge and a small navy action; no info icons |
| 164 | Card-head tabs never wrap; when a head is too narrow the counts drop out (Recent activity) |
| 165 | Client Incorporation: refresh COI card (white number, quiet label, soft chip, no ring or info button, one bar split by phase); 25 steps in 3 phases, Registration row gone from its timeline |
| 166 | Main buttons are navy on every portal (Approve, Review, Fill now, Upload and the rest) |
| 167 | Dark mode is slate (#111821 canvas, #18202B panels); the refresh colours have dark twins so titles, chips, tiles and tabs read |
| 168 | Phone home: navy band with the name and actions, then a white number strip; sentence-case card heads; no ring, no orange tab on cards |
| 169 | Client home timeline in the Gantt shape: 46px rows, status circles, 16px rounded bars, orange COI diamond; the COI row is ticked once incorporated |
| 170 | Client Compliance status: the total and one stacked bar instead of the donut |
| 171 | Company IDs: quiet "Private" chip and soft show button; Recent documents and Post-incorporation rows run full width with hairlines; owner chips are 96px with a dot everywhere |
| 172 | Incorporation timeline: axis ends in November, refresh bars and status circles; This week owner chips with a dot |
| 173 | Action queue: blank empty cells and soft count chips; Phase progress: a 6px bar per phase; Clients × filings: blank cells for not applicable |
| 174 | Wide staff tables fit their cards (admin Clients, super admin Clients); "Pranay's clients" heading spacing fixed |
| 175 | Staff client list: three phases and 25 steps (the P4 registration column is gone) |
| 176 | Team page: WhatsApp buttons are soft green |
