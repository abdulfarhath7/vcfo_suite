# Compliance calendar and filings

Gotchas already paid for once. Append when something costs more than a minute to figure out.

## Compliance visible pre-incorporation (2026-09-07)

- `isIncorporated(engagement, checklistState?)` in
  `src/lib/compliance/incorporation-state.ts` is the ONLY source of "COI
  recorded": `engagements.incorporation_date` first, Pre-12 terminal (via
  `isChecklistStepSequentiallyComplete`) as the fallback. The super summary's
  `incorporated` flag now goes through it too. Do not hand-roll the check.
- `PreIncorporationNotice` (`src/components/compliances/`) owns the client /
  staff copy and composes `ui/alert` + `IconChip` + the login info tint. Callers
  decide *whether* from `isIncorporated`. The shared Calendar / Filings views
  take `preIncorporation` and keep their normal layout in its genuine empty
  state — nothing is seeded to fill the space.
- Client route shells are server components, so
  `src/views/client/ClientCompliancePages.tsx` is where the client's engagement
  is resolved and the scope derived. A super admin in the client portal has no
  pinned engagement (`enterAs.client` TODO) → portfolio behaviour, no notice.
- Staff per-engagement compliance = filing tracker / statutory calendar with one
  company picked (P2 staff routes for the shared module are still unbuilt).
  Portfolio views keep real rows + a one-line pre-COI count off the engagement
  list already in hand.
- Fixed 2026-11-12 (owner report, Emburse): the caveat that stood here was the bug. The staff
  screens use `computeAllFilings` (in-memory `generate-instances`), whose `fixed_annual`
  obligations anchor on `'2000-01-01'` when there is no incorporation date, so a pre-COI
  company showed advance tax, DIR-3 KYC, DPT-3 and MSME-1 back 12 months as overdue. Now
  `generateComplianceInstances` takes `incorporated` (callers pass `isIncorporated`) and
  returns nothing without it, and drops any period due, or ending, before the incorporation
  day (`periodAfterIncorporation`). Every register reader adds `filingAfterIncorporation`
  (`src/db/repositories/filing-incorporation.ts`). Stored bad rows: `npm run filings:pre-coi:prod`.

## Compliances nav (2026-09-07)

- The shared compliance views (`src/views/compliances/*`) are the only
  compliance surface for every role, rendered by ONE wrapper
  (`CompliancePages.tsx`) and one `ComplianceScope`. Chrome is identical in
  every shell (statutory grid, full screen, register calendar, cadence +
  status filters); the picker / Company column show only when the roster has
  more than one company (`soleCompany`). `scope.audience` picks notice
  wording and nothing else. Do not add role branches to the views, and do not
  resurrect `views/admin/Compliance.tsx` or `views/client/Compliances.tsx`.
- Where each shell's Compliances pages live is decided once in
  `src/components/shell/compliance-nav.ts` (`compliancesBasePath`,
  `complianceLeaves`). Super admin points at `/app/admin` — there is no
  `/app/super/compliances`. `SidebarComplianceMini` uses the same helper.
- Staff filings state is in the URL: `?company=<engagement id>` and
  `?status=upcoming|due-soon|overdue|filed` alongside `cadence` / `period` /
  `fy` / `view`. The calendar carries `company` across its links.
- `buildMatrix(..., { perCompany: true })` keys rows by engagement; without it
  two companies' identical obligations merge into one row.
- Staff month sheets can be honestly empty: the demo FY 2026-27 register has
  no monthly-frequency instances at all (quarterly / annual / half-yearly only).

## Intern compliance calendar (no page tabs)

- EVERY role's `/compliance` page is now the intern layout: statutory calendar
  only — no PageHeader, no KPI row, no pill tabs, back cluster in the card.
- The filing tracker lives on `<base>/compliance/tracker` for intern, admin,
  and manager alike (header “Filing tracker” link on the calendar). The old
  admin/manager in-page tabs are gone.
- Deadline scoping (changed 2026-11-12, owner): every role, clients included, sees every
  deadline of the year on the statutory calendar, whatever companies they hold and even with
  none. Nothing is filtered by `deadlineAppliesTo` any more; people narrow it themselves with the
  act tabs (All, GST, IT, ...), the legend, and All / Overdue.
- Layout is two panels: the month's deadlines grouped by date on the left
  (`.stat-cal-list`), a compact month navigator + legend on the right
  (`.stat-cal-nav`, sticky from `lg`). The old FY heat strip and the act chip
  toolbar are gone — the legend rows are the category filter now, and they
  still drive `mutedActs` via `toggleMutedAct`.
- **Two colour lanes, never blended.** Category (which law) = `--stat-*` from
  `ACT_SWATCH`, used only on the row's code tag and the calendar dots. Status
  (state of the filing) = danger / accent-teal / primary-light, used only on
  the pill at the right of a row. Act hues are ≥45° apart; do not reuse
  IconChip emerald/teal or rose/pink — those merge as adjacent dots.
- Calendar cells carry up to 3 category dots in catalog order
  (`statutoryCellActs`, cap 3) over three fixed slots so every cell keeps the
  same height. Days with more acts than the cap say the true count in their
  `aria-label` only; the left list is the full record. Clicking a dated cell
  smooth-scrolls `#statutory-agenda-YYYY-MM-DD` and flashes that group.
- `STATUTORY_DEADLINES` has no status, owner, or period column — it is a fixed
  FY master calendar. The list derives all three for display only:
  `statutoryStatus` (past = overdue, ≤7 days = due soon, else upcoming — there
  is no `filed`), `statutoryReturnPeriod` / `statutoryFilingName` (trailing
  parenthetical off the title), and "Mine" = applies to any engagement in the
  passed portfolio via `deadlineAppliesTo`. Do not add these to the data file.
- "Remind me" is deliberately a disabled button — there is no reminder backend
  for statutory deadlines yet. Wire it only alongside real delivery.

## Statutory calendar per financial year (2026-11-11)

- The master calendar is no longer one constant. `src/db/repositories/statutory-calendar.ts`
  serves one calendar per financial year ("2026-27"); FY 2026-27 falls back to the built-in
  `STATUTORY_DEADLINES` until an admin imports it. `FY_LABEL`, `FY_START` and `FY_END` are gone;
  the components take the year from `useStatutoryCalendar` and `fyBounds`.
- APRERA and TGRERA are both the `RERA` category (one colour, one legend row); the row keeps the
  authority in `actLabel`, and the tag shows it. TRANSFER PRICING is `TP`.
- `scope` (Applies To) now works for any act, not only MCA. An MCA row with no scope is still
  company-law, so the template's Instructions sheet says so.
- The template is built and read by `src/lib/statutory-calendar/{template,parse}.ts`. Columns are
  found by header name. One bad row fails the whole import; exact repeats are dropped with a warning.
  The unit test round-trips all 241 built-in rows through the template.
- `deadline.id` stays `sd-<date>-<position>`, so Watch's moved-deadline lines (`withMovedDeadlines`)
  still apply to imported years.

## Full statutory calendar for every role (2026-11-12)

- The owner asked that every role sees every deadline of the file by default. So the SBC
  statutory calendar (`useStatutoryCalendar` for the year in view) is merged into the Month and
  Year views of the staff page (`ComplianceCalendarView`, marks labelled "GST · GSTR-1", a
  `SbcPopRow` in the day popover, rows in the Excel export) and of the client portal
  (`CalendarPage`, as `SbcRow`s from `sbcAsRow` in `tasks.ts`, which open nothing).
- Area tabs: on staff, `statutoryArea` maps an act to the register's area name (IT to "Income
  Tax", MCA to "Companies Act, 2013" or "LLP Act", LABOUR to "Labour Laws", FEMA to "FEMA / RBI");
  STPI/SEZ, RERA and Transfer Pricing keep their own names (`SBC_OWN_AREAS`), because the
  regulator words would show STPI/SEZ as a second "FEMA". On the portal, STPI/SEZ counts under
  FEMA, TP under Income tax, LABOUR under Payroll, and RERA under All only.
- `StatutoryCalendar` (By act) no longer filters by company or role, and has act tabs over its
  list that share `mutedActs` with the legend. A lead with no incorporated client gets the
  Calendar page; the other Compliances pages keep "No incorporated clients yet".
- The import buttons (`StatutoryCalendarImport`, which works out its own default year from the
  GET response) are in the page's top bar, not inside By act, so the admin finds them on Month.
- Timeline keeps filings only: the file's deadlines have no start dates to draw a window from.
- The client's "Your compliances haven't started yet" note shows only on a month with nothing on
  it, as the file's deadlines fill the month before incorporation.

## Admin calendar toolbar (2026-11-12, toolbar idea A)

- The owner chose idea A for the Compliances calendar toolbar, for the admin only ("admin contains
  more options"): row one is the month picker, the FY chip and the view switch; row two is the
  company picker, a Category dropdown, an Acts dropdown (`AreaFilterMenu`: tick several acts, each
  with its dot and count, Clear for all), Filings, and one "Calendar file" menu
  (`StatutoryCalendarImport`) with Download template, Download FY filled in, Import calendar and
  Export to Excel. Every other role keeps the tab toolbar. The switch is `compactBar`
  (`canImport` from GET /api/statutory-calendar), in the same `ComplianceCalendarView`.
- The area filter is a list now (`areaPick`, none = all); the tab toolbar sets one area at a time.
- The app's `DropdownMenuItem` cannot take `asChild` (it appends a shortcut slot after its
  children), so the download items call `window.location.assign` on the template route, which
  answers as an attachment and leaves the page where it is.
- `useExcelExport` (src/hooks/use-excel-export.ts) is the export behind `ExportToExcelButton`, for
  a menu item that exports the same way.
