# Filings — build progress log

Source of truth: `docs/FILINGS-CONTEXT.md`. This mirrors its §11 backlog and
records decisions plus the data dependencies §7 asks to be flagged rather than
fabricated. Read this first on restart and continue at the first unchecked item.

---

## Repo corrections / confirmations

| Context doc | Repo reality |
|---|---|
| "existing calendar component — reuse it" | `src/components/admin/ComplianceCalendar.tsx`, driven by `ComplianceFiling` from `src/data/compliance.ts`. Reused as-is; register rows are mapped onto that shape, not forked. |
| "canonical table / pill / section header" | `DashDataTable`, `TONE_BADGE` (via `IconChip`), `DashSection` — per `DESIGN-SYSTEM-INVENTORY.md`. All three used unchanged. |
| "compliance instances (Inngest-generated)" | `compliance_instances` joined to `compliance_obligations`. 152 rows across 5 companies, 14 with real `filed_on` dates. Confirmed as the single source; nothing new created. |
| Routes | `…/compliances/calendar` and `…/compliances/filings` — matches the app's pattern. |

---

## DATA DEPENDENCIES (flagged, not fabricated)

**1. There is no `form` column.** `compliance_obligations` has `compliance_area`,
`particular`, `authority`, `frequency` — no dedicated form code. `particular`
carries the form/return name for most rows ("Form AOC-4", "Form MGT-7",
"Director KYC (DIR-3 KYC)", "Annual Return (GSTR-9)") but not all
("Advance Tax Payment Q1"). The column is therefore rendered as **Particular**
and NOT relabelled "Form", which the deck layout asks for. Resolving this
properly means adding a `form` field to the obligation library.
`// TODO(owner):` marked in `src/db/repositories/filings.ts`.

**2. No monthly instances exist anywhere — the Monthly tab is honestly empty.**
Counted in the live database:

| | |
|---|---|
| `compliance_instances` by frequency | annual 82, quarterly 47, half-yearly 23, **monthly 0** |
| `compliance_obligations` by frequency | annual 11, quarterly 8, half-yearly 3, **monthly 4** |
| `engagement_compliance_triggers` rows | **0** |

The library *does* hold four monthly obligations (GSTR-1, GSTR-3B, TDS Payment,
PF ECR), but every one is trigger-driven — `gst_registration_date`,
`tds_liability_start_date`, `pf_registration_date` — and no engagement has any
trigger row at all. So the generator never emits them. The Monthly tab shows the
honest empty state; **no monthly row was invented to fill it.** Resolving this is
upstream: capture the registration dates (they are collected on the checklist)
into `engagement_compliance_triggers` and re-run the generate job.

**3. Export needs a dependency decision (blocks P1).** The repo has
`docxtemplater` + `pizzip` (docx only) and **no xlsx or PDF library**. A
three-tab workbook and a letterhead PDF both need one — either a new dependency
(`exceljs` / a PDF lib) or hand-built OOXML over the existing `pizzip`. Adding a
dependency is an owner call, so P1 export is not started. Everything it needs is
in place: `getFilings` already returns exactly the on-screen rows, so the export
route can hand the same data to whichever generator is chosen.

---

## P0 — client scope, core

- [x] `getFilings` repository + API + `useFilings` hook + scoping test (§7).
- [x] Compliances nav group (Calendar + Filings) for the client.
- [x] Calendar page (client scope) with summary strip + status chips + pre-COI empty state.
- [x] Filings page shell with Monthly / Quarterly / Annual tabs.
- [x] Annual tab, Monthly tab (this-month table), Quarterly tab.
- [x] Consistency audit vs. lead dashboard tables.

## P1 — client scope, links + export

- [x] Cross-links: calendar month → Monthly filings (period param); row → calendar; "Open filings" / "Open calendar". URL carries cadence/period/fy.
- [x] Monthly "Full year" matrix + Quarterly matrix (deck layouts).
- [ ] Export ▾ → PDF (letterhead + signature blocks) and Excel (three tabs). **Blocked on dependency decision — see data dependency 3.**

## P2 — other roles (scope flip)

- [ ] Lead / Manager scope (the repository already scopes them; needs the nav group + routes).
- [ ] Admin + Super scopes: firm-wide + company selector + drill-into-company.
- [ ] Firm-wide export: per-company sheets, zipped.

## P3 — polish

- [ ] Light/dark + responsive/mobile audit.
- [ ] Status/motion/loading audit.
- [ ] Final consistency audit across all roles.

---

## What was built

**One scope-parameterized module, per §2.** `getFilings(ctx, …)` scopes off
`listScopedEngagementIds(ctx)` — the same predicate the rest of the app uses — so
the identical function serves all five roles and the only per-role difference is
the id list. `FilingsView` / `ComplianceCalendarView` take a `basePath` so links
stay inside the calling role's shell; nothing else is role-aware. Wiring the
other four roles (P2) is a route + nav change, not new components.

| Piece | Path |
|---|---|
| Pure logic (Indian FY, periods, status, matrices, URL params) | `src/lib/filings.ts` |
| Repository (scoped read) | `src/db/repositories/filings.ts` |
| API | `app/api/filings/route.ts` |
| Hook | `src/lib/use-filings.ts` |
| Status pill (canonical `TONE_BADGE`, filing wording) | `src/components/compliances/FilingStatusPill.tsx` |
| Filings page | `src/views/compliances/FilingsView.tsx` |
| Calendar page | `src/views/compliances/ComplianceCalendarView.tsx` |
| Client routes | `app/app/client/compliances/{calendar,filings}/page.tsx` |

**Status is derived, never stored as fiction.** `filingStatus()` reads a real
`filed_on` first; otherwise it is a function of the due date against today
(overdue / due soon within 14 days / upcoming). An instance with no filed date
and a future due date is simply "upcoming" — no fabricated state.

**Indian FY throughout.** Apr→Mar, Q1 = Apr-Jun, matching the board deck. The
matrix columns and the FY stepper are built on `financialYearMonths` /
`financialYearQuarters`.

---

## Verification (2026-09-01)

- `npm run typecheck` clean; `npm run test` green including 26 new tests
  (`src/lib/filings.test.ts` 18, `src/db/repositories/filings.test.ts` 8).
- **Scoping, live in the browser.** Signed in as `client-solstice@demo.vcfo.local`:
  `GET /api/filings?fy=2026` → 14 rows, `companies: ["Solstice Energy India Pvt Ltd"]`
  only. `GET /api/filings?engagementId=<another uuid>` → **0 rows**. The unit test
  additionally proves the foreign id never reaches the database.
- **Annual tab** renders the real register — Sl No / Compliance / Particular /
  Due Date / Filed Date / Frequency / Status, with genuine filed dates
  (Form 16 Issue filed 15 Jun 2026, FLA Return filed 15 Jul 2026) and an Overdue
  pill on the unfiled DPT-3.
- **Quarterly tab** renders the deck matrix: due/filing sub-rows, Q1–Q4 columns
  with month ranges, current quarter tinted, em dashes where nothing is due.
- **Monthly tab** shows the honest empty state (see data dependency 2).
- **Calendar** shows the summary strip ("2 due this month · 2 overdue · 0 filed"),
  the reused calendar with status day chips, and the month list with canonical pills.
- **Cross-links + URL state.** "View this month's filings" →
  `…/filings?cadence=monthly&period=2026-09&fy=2026`, and that URL survives a hard
  refresh. A row's due date → `…/calendar?date=2026-06-15`.
- **Pre-COI.** As `bharath@sbcllp.in` (Emburse, no instances) both pages show the
  honest empty state — the calendar says the register starts at COI.
- **Nav.** The client's single Compliances entry is now a group; expanding the
  rail shows Calendar and Filings.
- No console or page errors on any of the above.

### Consistency audit

`DashDataTable` renders the Annual/Monthly tables, so header type scale, row
height, `border-t border-border` dividers and `hover:bg-raised/70` are the lead
dashboard's by construction. Status chips are `TONE_BADGE` at
`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold`. Section headers are
`DashSection`. The quarterly/full-year matrix is the one thing without a
canonical equivalent (no matrix exists in the inventory); it reuses the same
header type scale, border token and pill rather than inventing a second style.
Status colour appears only in chips and the current-period column tint — never
as page or cell fill.
