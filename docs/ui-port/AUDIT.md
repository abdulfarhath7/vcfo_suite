# UI port audit: VCFO Suite against the VCFO Spectrum prototype

Date: 29 Oct 2026. Prototype: `abdulfarhath7/vcfo-prototype`, branch `design/spectrum` (05e5509).
Real tool: this repo, branch `ui/spectrum`. Screen names come from the prototype's `docs/SCREENS.md`;
real files come from its `docs/REAL-TOOL-MAP.md`, checked again today.

Actions:
- **Restyle**: both have the screen. Keep the real data and actions; take the prototype's look.
- **Keep + restyle**: only the real tool has it. Keep it and draw it with the shared parts.
- **Build**: only the prototype has it, and the backend exists or is small.
- **Gap**: only the prototype has it, and it needs real backend work. See `GAPS.md`.

The foundation (tokens, fonts, shell, buttons, chips, tables, inputs, tabs, overlays, home card)
reaches every row below through the shared tokens and components, so each row's action is the
work left after that.

## Shared parts

| Part | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Tokens, light and dark | `docs/design/design-tokens.json`, `app/globals.css` | `src/styles/tokens.css` | Restyle (done) |
| Fonts | `app/layout.tsx` | `app/layout.tsx` | Restyle (done) |
| Staff sidebar | `src/components/shell/RoleSidebar.tsx`, `SidebarNavGroup.tsx` | `src/components/shell/Sidebar.tsx` | Restyle (done) |
| Staff top bar, search, bells | `src/components/shell/TopBar.tsx`, `CommandPalette.tsx`, `NotificationsBell.tsx`, `AnnouncementsBell.tsx` | `TopBar.tsx`, `Palette.tsx`, `StaffBellMenu.tsx` | Restyle (done) |
| Regulator ribbon | none | `Shell.tsx` (`.spectrum`) | Build (done) |
| Ask VCFO button | `src/components/ask/AskLauncher.tsx`, `src/components/client-portal/AskLauncher.tsx` | `AskButton.tsx`, sidebar button | Restyle (done; floating launcher and mascot hidden) |
| Buttons | `src/components/ui/button-variants.ts` | `src/components/ui/Button.tsx` | Restyle (done) |
| Status chip, owner chip, area pill, tag | `src/components/ui/badge-variants.ts`, `src/components/common/IconChip.tsx`, new `src/components/ui/spectrum-chip.tsx` | `src/components/ui/Chip.tsx` | Restyle + Build (done) |
| Inputs, select, textarea, switch, checkbox | `src/components/ui/*` | `Input.tsx`, `Select.tsx` | Restyle (done) |
| Tabs and segmented switch | `src/components/ui/tabs-*.tsx`, new `spectrum-tabs.tsx` | `Tabs.tsx` | Restyle + Build (done) |
| Tables | `src/components/dash/EFilingGrid.tsx`, `DashDataTable.tsx`, `.grid-table` | `cards/DataGrid.tsx` | Restyle (done) |
| Home card and number tiles | `src/components/dash/DashHero.tsx` | `cards/GreetingCard.tsx` | Restyle (done) |
| Section card head | `src/components/dash/DashSection.tsx`, `src/components/common/CardHeadTile.tsx` | `cards/SectionCard.tsx` | Restyle (done) |
| Steps (ST5), phase bar | none (round markers in each view) | `ui/StepMark.tsx`, `ui/PhaseBar.tsx` | Build (done: `src/components/ui/step-track.tsx`) |
| File badges | per view | `ui/FileBadge.tsx` | Build (done: `src/components/ui/file-badge.tsx`) |
| Menus, tooltips, popovers, dialogs, sheets | `src/components/ui/*` | `ui/ActionMenu.tsx`, `Modal.tsx`, `PopoverCard.tsx`, `SidePanel.tsx` | Restyle (done) |
| Empty and loading states | per view | R-48 | Build (done: `src/components/ui/empty-state.tsx`) |
| Client portal CSS (sidebar, top bar, cards) | `src/components/client-portal/css-src/*` | prototype screens | Restyle (done for radius, weight, sidebar, ribbon) |

## Client portal (`client`)

| Screen or feature | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Home | `client-portal/pages/home/HomePage.tsx`, `CardsA.tsx`, `CardsB.tsx` | `src/screens/client/HomeScreen.tsx` | Restyle |
| Home · greeting card | `CardsA.tsx` `GreetCard` | `cards/GreetingCard.tsx` | Restyle (wash card) |
| Home · Steps (ST5) | `CardsB.tsx` `StepsCard` | `cards/PhaseRows.tsx`, `ui/PhaseBar.tsx` | Restyle |
| Home · timeline (Gantt) | `CardsB.tsx` `TimelineCard` | `cards/GanttTimeline.tsx` | Restyle |
| Home · needs, alerts, what is next, SBC doing, area, status, IDs, documents, activity, post-incorporation, registrations | `CardsA.tsx`, `CardsB.tsx` | `src/screens/client/home-*.tsx` | Restyle |
| Home · phone | `MobileHome.tsx`, `MobileCardsA.tsx`, `MobileCardsB.tsx` | `HomeScreen.tsx` at 390px | Restyle |
| Incorporation landing | `pages/incorporation/Landing.tsx` | `src/screens/client/IncorporationScreen.tsx` | Restyle (one status card with four bars, ST5) |
| Incorporation phase page | `pages/incorporation/PhasePage.tsx`, `StepTable.tsx` | `PhaseScreen.tsx` | Restyle |
| Incorporation step page | `pages/incorporation/StepPage.tsx` | `StepScreen.tsx` | Restyle (underline tabs) |
| Board resolution | `pages/incorporation/BoardPage.tsx` | `BoardResolutionScreen.tsx` | Restyle |
| Compliances · Calendar | `pages/compliances/CalendarPage.tsx` (+ views) | `CompliancesScreen.tsx` | Restyle |
| Compliances · Filings | `pages/compliances/FilingsPage.tsx` | `FilingsScreen.tsx` | Restyle |
| Compliances · Obligations list and detail | none | `ObligationsScreen.tsx`, `ObligationScreen.tsx` | Build (backend: `compliance_obligations`, `compliance_instances`, `client-compliances` repository) |
| Registrations list and detail | `CardsB.tsx` `RegCard` only | `RegistrationsScreen.tsx`, `RegistrationScreen.tsx` | Build (backend: registration-phase checklist steps and `engagement_credentials`) |
| Documents | `pages/documents/*` | `DocumentsScreen.tsx` | Restyle (file badges) |
| Library and reader | `pages/documents/library/*` | `LibraryScreen.tsx`, `ReaderScreen.tsx` | Restyle (white head) |
| Credentials | `pages/credentials/*` | `CredentialsScreen.tsx` | Restyle |
| Team | `pages/team/TeamPage.tsx` | removed (C-0027): Team is a section in Profile | Keep + restyle (route kept; Profile shows the team) |
| Announcements, Notifications, Audit | `pages/team/*Page.tsx` | `shared/*` | Restyle |
| Settings and Profile | `pages/team/SettingsPage.tsx` | `ProfileScreen.tsx` | Restyle |
| Messages, Progress (`/app/client/messages`, `/progress`) | `app/app/client/{messages,progress}` | none | Keep + restyle |
| Ask VCFO chat | `client-portal/AskLauncher.tsx` | `cards/AskThread.tsx` | Restyle (no mascot) |

## Project lead (`intern`)

| Screen or feature | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Today | `src/views/intern/Today.tsx`, `src/components/intern/*` | `src/screens/staff/TodayScreen.tsx`, `today-parts.tsx` | Restyle (home card; no practice strip) |
| Work: list, board, timeline, planner | `src/views/intern/MyWork.tsx` | `WorkScreen.tsx`, `work-parts.tsx` | Restyle |
| Work · task drawer | none | `cards/TaskDrawer.tsx` | Build (tasks repository exists) |
| Clients | `src/views/intern/Clients.tsx` | `ClientsScreen.tsx` | Restyle |
| Client record (tabs) | `src/views/admin/EngagementDetail*.tsx`, `src/components/incorporation/*` | `ClientRecordScreen.tsx`, `record-parts.tsx` | Restyle (plain head, underline tabs, ST5) |
| Step page | `src/views/engagement/EngagementStepDetail*.tsx` | `StepScreen.tsx` | Restyle |
| Board resolution editor | `src/views/intern/BoardResolutionEditor*.tsx` | `BoardResolutionScreen.tsx` | Restyle |
| Documents (doc pack) | `src/views/engagement/DocPackView*.tsx` | `DocumentsScreen.tsx` | Restyle |
| Email | `src/views/staff/ComposeMail.tsx` | `EmailScreen.tsx` | Restyle |
| Vault | `src/views/vault/DocumentVaultPage.tsx` | `VaultScreen.tsx` | Restyle |
| Knowledge bank | `src/views/knowledge-bank/*` | `KnowledgeScreen.tsx` | Restyle |
| Announcements, Notifications, Audit, Analytics | `src/views/{announcements,notifications}/*`, `src/views/admin/{AuditLog,Analytics}.tsx` | `shared/*`, `AnalyticsScreen.tsx` | Restyle |
| Compliances · Calendar and Filings | `src/views/compliances/*` | `CompliancesScreen.tsx`, `FilingsScreen.tsx` | Restyle |
| Compliances · Obligations, grouped by filing | `src/views/compliances/FilingsView.tsx` (matrix) | `ObligationsScreen.tsx` | Build (same data as Filings) |
| Registrations list and item | none | `RegistrationsScreen.tsx`, `ItemScreen.tsx` | Build (checklist registration steps) |
| Requests (`/app/intern/requests`), compliance tracker | `app/app/intern/{requests,compliance/tracker}` | none | Keep + restyle |
| Settings and Profile | `src/views/settings/*` | `ProfileScreen.tsx` | Restyle |

## Manager

| Screen or feature | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Today | `src/views/admin/Dashboard.tsx`, `DashboardSections.tsx` | `TodayScreen.tsx` (manager board) | Restyle |
| Today · Team tasks (filter chips, List/Board) | `src/components/staff/TeamTodosPanel.tsx` | `today-parts.tsx` | Restyle |
| Today · Waiting for your approval | `DashboardApprovalsPanel.tsx`, `ApprovalsInbox.tsx` | `today-parts.tsx` | Restyle |
| Today · Task status donut, Workload by lead | `PhaseTimeline.tsx` | `today-parts.tsx` | Build (task counts exist) |
| Project leads | `src/views/admin/Team.tsx` | `LeadsScreen.tsx` | Restyle |
| People | `src/views/admin/FirmPeople.tsx` | none (folded into Leads) | Keep + restyle |
| Work and projects, new, edit | `src/views/admin/Projects*.tsx`, `ProjectsNew.tsx`, `ProjectEdit.tsx` | `WorkScreen.tsx` | Restyle |
| Client page, step page, documents | `ProjectDetail.tsx`, `StepDetailPage.tsx`, `DocPackViewClient.tsx` | `ClientRecordScreen.tsx`, `StepScreen.tsx` | Restyle |
| Approvals page | `app/app/manager/approvals` → `ApprovalsInbox.tsx` | in Today | Keep + restyle |
| Shared screens (email, vault, knowledge, announcements, notifications, calendar, filings, analytics, audit, settings) | as for the lead | as for the lead | Restyle |
| Registrations, Obligations | none | as for the lead | Build |

## Admin

| Screen or feature | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Today | `src/views/admin/FirmDashboard.tsx`, `FirmProjectsPanel.tsx` | `TodayScreen.tsx` (admin) | Restyle |
| Today · Phase progress, Needs your decision | none as cards | `today-parts.tsx` | Build (engagement and approval data exist) |
| Managers | `src/views/admin/FirmPeople.tsx`, `firm-people/*` | `ManagersScreen.tsx` | Restyle |
| Project leads | `src/views/admin/Team.tsx` | `LeadsScreen.tsx` | Restyle |
| Work, new, edit, recycle bin | `FirmProjects.tsx`, `ProjectsNew.tsx`, `ProjectEdit.tsx`, `ProjectRecycleBin.tsx` | `WorkScreen.tsx` | Restyle |
| Firm settings | `AccountSettings.tsx` | `FirmSettingsScreen.tsx` | Gap (no firm settings store) |
| Ask VCFO sources and gaps | `src/views/admin/ask/*` | none | Keep + restyle |
| Compliance tracker, engagements list, overview | `app/app/admin/{compliance/tracker,engagements,overview}` | none | Keep + restyle |
| Shared screens | as for the lead | as for the lead | Restyle |

## Super admin

| Screen or feature | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Overview | `src/views/super/SuperOverview.tsx`, `src/components/super/overview/*` | `src/screens/super/OverviewScreen.tsx` | Restyle |
| Clients and client record | `SuperProjects.tsx`, `SuperProjectDetail.tsx` | `ClientsScreen.tsx`, record | Restyle |
| Practice · Incorporation | none | `PracticeIncorporationScreen.tsx` | Build (engagement and checklist data) |
| Practice · Registrations | none | `PracticeRegistrationsScreen.tsx` | Build (registration-phase steps) |
| Practice · Compliances (calendar, filings) | admin routes | super screens | Restyle (links stay on admin routes) |
| Team | admin People page | `TeamScreen.tsx` | Build (profiles and engagement memberships) |
| Risks | `SuperAttentionPanel.tsx` | `RisksScreen.tsx` | Build (overdue steps and filings) |
| Growth, Reports | none | `GrowthScreen.tsx`, `ReportsScreen.tsx` | Build from engagement dates and compliance counts; money stays out (R-37) |
| Firm settings | `AccountSettings.tsx` | `SettingsScreen.tsx` | Gap |
| Announcements, notifications | `app/app/super/{announcements,notifications}` | bells | Keep + restyle |

## Developer console

| Screen or feature | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Overview, Connections, Messages, Jobs, Logs, Deploys, Access, Data and costs, Audit | only `app/api/outlook/connect` | `src/screens/dev/*` | Gap (no developer role, no job or log store). Connections, Messages and Audit could read `outlook_connections`, `notification_deliveries`, `email_send_log` and `audit_events` once a role exists. |

## Public pages

| Screen or feature | In VCFO Suite (file) | In prototype (file) | Action |
|---|---|---|---|
| Landing | `app/page.tsx`, `src/components/marketing/*` | `src/screens/public/LandingScreen.tsx`, `LandingParts.tsx` | Restyle (v6 navy landing, comparison section) |
| Sign in | `app/login`, `src/components/auth/*` | `src/screens/public/SignInScreen.tsx` | Restyle |
