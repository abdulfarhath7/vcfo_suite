# Compliance nav — nested "Compliances → Calendar / Filings" for every role

Discovery + reconciliation for the staff scope-flip of the shared compliance
module (FILINGS-BUILD-PROGRESS.md P2, previously unbuilt). Everything below is
read from the repo at `27aec09`, not from the brief.

Baseline gate before any change: `npm run typecheck` reports only the
pre-existing `drizzle.config.ts(1,10): TS2305 'defineConfig'` error (the
installed `drizzle-kit@0.18.1` ships a `Config` type and no `defineConfig`
export, so this is a package mismatch, not a one-line fix — left alone);
`npm run test` 100 files / 892 tests green; `npx eslint .` 0 errors, 528
pre-existing warnings.

## 1. Nav definitions per role (`src/components/shell/RoleSidebar.tsx`)

| Array | Base | Compliance entry today | Shape |
|---|---|---|---|
| `firmAdminItems` | hard `/app/admin` | `{ to: '/app/admin/compliance', label: 'Compliance', icon: CalendarCheck }` | flat link |
| `managerItems` (memo in `SidebarNavBody`) | `staffBase` from `useStaffBasePath()` | `{ to: \`${staffBase}/compliance\`, label: 'Compliance' }` | flat link |
| `internItems` | hard `/app/intern` | `{ to: '/app/intern/compliance', label: 'Compliance' }` | flat link |
| `superAdminItems` | mixed (`/app/super/*`, jumps into `/app/admin/*` and `/app/client/*`) | **none** | — |
| `clientItems` | hard `/app/client` | `compliancesGroup('/app/client')` | `SidebarNavGroup` disclosure: Calendar + Filings |

`compliancesGroup(base)` already exists (RoleSidebar.tsx) and is the same
`NavGroupDef` shape as `docsGroup` / `updatesGroup`; `SidebarNavGroup`
renders it. Only the client calls it. `isSidebarGroupActive` matches a child
by exact path or `child.to + '/'`, so the group lights up on both children.

## 2. Route map today

| Role | Route | Renders | Scope |
|---|---|---|---|
| client | `/app/client/compliances` | `redirect('/app/client/compliances/calendar')` | — |
| client | `/app/client/compliances/calendar` | `ClientComplianceCalendarPage` → `ComplianceCalendarView` | own engagement (`getFilings` via `AuthContext`) |
| client | `/app/client/compliances/filings` | `ClientFilingsPage` → `FilingsView` | own engagement |
| admin / manager / intern | `/app/{role}/compliance` | `views/admin/Compliance` (`initialView='statutory'`) → `StatutoryCalendar` | portfolio |
| admin / manager / intern | `/app/{role}/compliance/tracker` | `views/admin/Compliance` (`initialView='tracker'`) → `ComplianceCalendar` + table | portfolio, narrows via `<select>` |
| super | — | no compliance route under `/app/super`; `SuperOverview` "filings due" stat links to `/app/admin/compliance` | firm-wide |

Other call sites of the legacy paths (all keep working through the Phase 3
redirects; the nav-enumerating ones are updated in Phase 4):
`CommandPalette.tsx` (admin / manager / intern entries, intern "Filing
tracker"), `shell-back.ts` `SHELL_PRIMARY_PATHS`, `shell-crumbs.ts`
`PAGE_LABEL`/`PAGE_ICON` (`compliance`, `tracker`), `SidebarComplianceMini`,
`views/super/SuperOverview.tsx:103`, `views/admin/DashboardSecondaryRow.tsx`
(hard `/app/manager/compliance` — pre-existing rule-6 violation),
`views/admin/DashboardSections.tsx` (`${projectBase}/compliance`),
`components/intern/LeadSideRail.tsx`, `lib/intern-work.ts` `internWorkHref`.

## 3. Must-not-lose list — what the shared views lack today

Read from `views/admin/Compliance.tsx` and `components/admin/StatutoryCalendar.tsx`
against `views/compliances/ComplianceCalendarView.tsx` / `FilingsView.tsx`.

| Capability | Where it lives today | Shared view today | Fold plan |
|---|---|---|---|
| Company picker (portfolio → one company) | `CompanyPicker` inside `StatutoryCalendar` (own `companyId` state); raw `<select>` on the tracker | none — client is one engagement | `StatutoryCalendar` gains optional controlled `companyId`/`onCompanyChange`; `FilingsView` staff mode renders the same `CompanyPicker`. The tracker's raw `<select>` is replaced by the `CompanyPicker` the statutory grid already uses (same component, not a new one). |
| Statutory portfolio month grid (`STATUTORY_DEADLINES`, act legend + mutes, All/Overdue scope, keyboard grid, maximize) | `StatutoryCalendar` (+ `StatutoryMaxiCalendar`) | none | Rendered verbatim by `ComplianceCalendarView` in staff mode, above the register calendar. |
| Status filter (All / Due soon / In preparation / Filed / Past due) | tracker `SegmentedPicker` | none (cadence picker only) | `FilingsView` staff mode adds a status `SegmentedPicker` over the register's own `FilingStatus` vocabulary (`upcoming` / `due-soon` / `overdue` / `filed`). |
| Cadence filter (Monthly / Quarterly / Annual) | shared view only | present | unchanged |
| Register month mini-calendar (`ComplianceCalendar`) | tracker left column | already on the Calendar page | unchanged; the staff Calendar page carries it. |
| "GCC project" (company) column | tracker table | none | `FilingsView` staff mode adds a Company column to the register table, mobile rows, and the period matrices (matrix rows keyed per company on "All companies" so obligations of two companies never merge). |
| Authority chip | tracker table | none | staff mode Company column carries the `TONE_BADGE` authority chip inline. |
| "Delivery owner" + "Risk" columns | tracker table, from `computeAllFilings` (in-memory generator: `ownerId = engagement.internId`, `penaltyRisk` is a generator constant) | none | **Not carried.** `useApp().teamMembers` is the empty seed array in `src/data/mockData.ts`, so the owner cell never rendered a name; risk is a generator constant, not a register field (rule 5, fabricate nothing). Recorded as the one deliberate drop. |
| Pre-COI notice, one company narrowed | tracker + statutory | client-only `PreIncorporationNotice` | staff mode: `PreIncorporationNotice({ audience: 'staff', companyName })` when the picked company fails `isIncorporated`. |
| Pre-COI portfolio one-liner | tracker + statutory | none | staff mode: `PreIncorporationPortfolioNote(count)` on "All companies", count read off the engagement list in hand (no query). |
| Back chevron beside the title (`PageBackCluster`) | staff pages | none (client parity) | Not carried: the shared views use the top-bar trail; the staff pages get the same header as the client. |
| Data source | tracker: `computeAllFilings` in-memory generator | `getFilings` DB register (Inngest instances) | Register wins — it is the real data. NOTES.md already records that the in-memory tracker could show generator rows for pre-COI companies; the register never does. |

## 4. `SidebarComplianceMini`

A compact current-month grid under the nav (due days from
`STATUTORY_DEADLINES`, today highlighted, "N due"), rendered for every role
when the rail is expanded, wrapping one `Link` whose target comes from a
private `complianceHref(role, staffBase)` (admin/manager/intern → legacy
`/compliance`; client → `/app/client/compliances`; fallback hard
`/app/manager/compliance`).

**Decision: stays, retargeted.** It is a glanceable widget, not a nav entry,
so it does not duplicate the group. Its link now resolves through the same
base the group uses: `{base}/compliances/calendar`, super → `/app/admin`.
The hard `/app/manager` fallback goes away.

## 5. Decision

- Staff get **new pages** `/app/{admin|manager|intern}/compliances/calendar`
  and `/compliances/filings` rendering the shared views with
  `audience="staff"`; `/compliances` index redirects to the calendar
  (mirrors the client).
- Legacy `/app/{role}/compliance` → `…/compliances/calendar`,
  `/app/{role}/compliance/tracker` → `…/compliances/filings` (server
  `redirect`, bookmarks survive).
- `views/admin/Compliance.tsx` is retired after the fold (every capability
  listed above has a home in the shared staff mode). `StatutoryCalendar`,
  `CompanyPicker`, `ComplianceCalendar`, `SegmentedPicker`,
  `PreIncorporationNotice`, `PreIncorporationPortfolioNote` are reused as is
  (one additive, backward-compatible prop pair on `StatutoryCalendar`).
- Super admin: `compliancesGroup('/app/admin')` — the super rail already
  jumps into the firm scope for Firm / People / Email / Firm log, and
  `getFilings` is firm-wide for `super_admin` via `listScopedEngagementIds`.
  No `/app/super/compliances/*` routes are added (there is no `/app/super`
  project shell either, per NOTES).
- Client mode of both views is unchanged: `audience` defaults to `'client'`,
  no picker, own engagement, existing per-engagement notice.
- Access control untouched: staff pages read the same `/api/filings`; the
  picker filters the already-scoped payload client-side, and the engagement
  list comes from `useApp()` (already scoped).

## 6. Reuse inventory

| Need | Component | Path |
|---|---|---|
| Nested nav group | `SidebarNavGroup` via `compliancesGroup(base)` | `src/components/shell/SidebarNavGroup.tsx`, `RoleSidebar.tsx` |
| Company picker | `CompanyPicker` | `src/components/admin/CompanyPicker.tsx` |
| Portfolio month grid | `StatutoryCalendar` | `src/components/admin/StatutoryCalendar.tsx` |
| Register mini calendar | `ComplianceCalendar` | `src/components/admin/ComplianceCalendar.tsx` |
| Segmented filter | `SegmentedPicker` | `src/components/admin/SegmentedPicker.tsx` |
| Status chip | `FilingStatusPill` (`TONE_BADGE`) | `src/components/compliances/FilingStatusPill.tsx` |
| Pre-COI notice / note | `PreIncorporationNotice`, `PreIncorporationPortfolioNote` | `src/components/compliances/PreIncorporationNotice.tsx` |
| Incorporation truth | `isIncorporated` | `src/lib/compliance/incorporation-state.ts` |
| Panel / table | `DashSection`, `DashDataTable` | `src/components/dash/` |
| Register read | `useFilings` → `/api/filings` → `getFilings(ctx)` | `src/lib/use-filings.ts`, `src/db/repositories/filings.ts` |

## 7. Acceptance QA (Phase 5)

Gate after the final commit: `npm run typecheck` — only the pre-existing
`drizzle.config.ts` error; `npm run test` — 102 files / 904 tests green (baseline
was 100 / 892; the new ones are `staff-scope.test.ts`, `StaffCompliancePages.test.tsx`,
a `buildMatrix` per-company case, and the nav-group / crumbs / back cases);
`npx eslint .` — 0 errors, 528 warnings (the same count as the baseline).
`grep -rn "from '@/db" src/views src/components` returns nothing new.

Real-browser run (playwright, dev server on :3000, demo seed) — 140 / 140
checks passed across the five roles. Script and screenshots live in the
session scratchpad (`qa-nav.js`, `qa-results.json`, `qa-<role>-*.png`).

| Check | client (`client-kestrel@`, pre-COI) | admin (`admin-nadia@`) | manager (`pm-anita@`) | intern / Project Lead (`lead-divya@`) | super (`super@`) |
|---|---|---|---|---|---|
| Sidebar "Compliances" disclosure on the role home | pass | pass | pass | pass | pass (`/app/super/dashboard`) |
| Expanding reveals Calendar + Filings | pass (`/app/client/compliances/*`) | pass (`/app/admin/…`) | pass (`/app/manager/…`) | pass (`/app/intern/…`) | pass (`/app/admin/…`, firm scope) |
| Both children route to a working page | pass | pass | pass | pass | pass |
| Active pill on the child (`aria-current="page"`) | pass | pass | pass | pass | pass |
| Breadcrumb Home › Compliances › Calendar / Filings | pass | pass | pass | pass | pass |
| ⌘K finds "Compliance calendar" and "Filings" and navigates | pass | pass | pass | pass | pass |
| Pre-COI, per-engagement notice | client copy on both pages | staff copy when narrowed to Kestrel on both pages | same | same | same |
| Pre-COI, portfolio one-liner on "All companies" | n/a (no picker) | "6 engagements begin compliance after incorporation." | pass | pass | pass |
| Company picker | absent (correct) | present on both pages | present | present | present |
| Statutory portfolio grid (legend, All/Overdue, full screen) | absent (correct) | present | present | present | present |
| Status filter (All / Due soon / Upcoming / Overdue / Filed) + `?status=` | absent (correct) | pass | pass | pass | pass |
| Cadence filter (Monthly / Quarterly / Annual) | pass | pass | pass | pass | pass |
| Company column + authority chip on "All companies" | n/a | pass (annual sheet, 21 rows) | pass | pass | pass |
| Legacy `/compliance` → `…/compliances/calendar`, `/compliance/tracker` → `…/compliances/filings` | n/a | pass | pass | pass | pass (via `/app/admin`) |
| `…/compliances` index → calendar | pass | pass | pass | pass | pass |
| No page errors in the browser console | pass | pass | pass | pass | pass |

Observations recorded, not changed:

- The monthly sheet on "All companies" for FY 2026-27 is empty in the demo
  DB because every generated instance in that year is quarterly, annual or
  half-yearly (18 / 21 / 7). The quarterly and annual sheets carry the rows.
  That is the register's real content, the same the client sees.
- The statutory grid narrowed to a pre-COI company still lists the master
  deadlines that apply to its legal form (pre-existing `deadlineAppliesTo`
  behaviour) under the staff notice; the register beneath it is honestly empty.
- Super admin reads the firm scope through `getFilings` /
  `listScopedEngagementIds`, so the `listComplianceInstances` `super_admin`
  branch bug noted in DESIGN-SYSTEM-INVENTORY.md is not on this path.
