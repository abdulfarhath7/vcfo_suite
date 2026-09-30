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
- Pre-existing caveat, NOT changed: the staff filing tracker uses
  `computeAllFilings` (in-memory `generate-instances`), whose `fixed_annual`
  obligations anchor on `'2000-01-01'` when there is no incorporation date, so
  a pre-COI company can show a couple of "generated" rows there while the
  DB-backed `/api/filings` register (what the client sees) has none. Owner call.

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
- Deadline scoping: admin/super see the full master calendar; managers and
  leads only see deadlines that apply to a client in their role-scoped
  portfolio (`deadlineAppliesTo` over `engagements`, which the API scopes).
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
