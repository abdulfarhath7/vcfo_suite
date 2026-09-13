# Compliance visible pre-incorporation — report

Phase 1 discovery for the "Calendar + Filings visible before COI" change.
Written 2026-09-07. Phase 5 QA results are appended at the bottom.

---

## 1. The incorporation signal

| Question | Answer |
|---|---|
| Schema column | `engagements.incorporation_date` (`date`, nullable) — Drizzle `engagements.incorporationDate` in `src/db/schema.ts:120`. |
| App-shape property | `Engagement.incorporationDate?: string \| null` (`src/data/engagements.ts:23`), mapped by `toAppEngagement` in `src/db/repositories/engagements.ts:320`. |
| Who writes it | `PATCH /api/engagements/[id]` (`incorporationDate` field). Its origin is the Pre-12 checklist response `dateOfIncorporation` (`src/lib/compliance/extract-triggers.ts`). **Not touched by this change.** |
| What the Inngest job reads | `systemGenerateComplianceInstances` reads `engagement_compliance_triggers.incorporation_date` first and falls back to `engagements.incorporation_date` (`src/db/repositories/compliance.ts:376-414`). Zero trigger rows exist today, so the engagement column is the effective signal. |
| Fallback | Pre-12 (`id: 'pre-12'`, "Certificate of Incorporation") terminal in checklist state, read with the existing `isChecklistStepSequentiallyComplete` from `src/lib/checklist-step-gate.ts`. |

The assumption in the brief holds: the marker is `engagements.incorporationDate`, not a stage value or a separate COI record.

## 2. Does the field already reach each view?

| Surface | Payload | Reaches the view today? |
|---|---|---|
| Client Calendar / Filings (`src/views/compliances/*`) | `useApp().engagements` ← `/api/engagements` ← `listEngagements` → `toAppEngagement` | **Yes.** `findEngagementForClientUser` picks the client's own row; it carries `incorporationDate` and the slim checklist index (`getStateForEngagement`). No repository threading needed. |
| Staff portfolio compliance (`src/views/admin/Compliance.tsx`, admin / manager / intern) | Same `useApp().engagements` | **Yes.** Every engagement in scope carries the field. |
| Super project detail (`/app/super/projects/[id]`) | `getSuperEngagementDetail` → `summarizeEngagement` | **Yes**, already derived as `summary.incorporated` from `row.incorporationDate` (`src/lib/super-overview.ts:395`). Phase 2 points that derivation at the shared helper so there is one source. |
| `/api/filings` (`getFilings`) | `rows` + `companies` | Does not carry the field, and does not need to — the engagement list already does. |

No view needs a new repository call and no `db` import is added anywhere.

## 3. The shared module and where it renders

| Piece | Path |
|---|---|
| Calendar | `src/views/compliances/ComplianceCalendarView.tsx` |
| Filings | `src/views/compliances/FilingsView.tsx` |
| Rendered by | `app/app/client/compliances/calendar/page.tsx`, `app/app/client/compliances/filings/page.tsx` — **client shell only** |

**Repo correction to the brief.** FILINGS-BUILD-PROGRESS P2 ("other roles: scope flip") is unbuilt, so the shared module has no staff call sites yet. What the staff shells render instead:

| Route | View | Nature |
|---|---|---|
| `/app/admin/compliance`, `/app/manager/compliance`, `/app/intern/compliance` | `src/views/admin/Compliance.tsx` → `StatutoryCalendar` (portfolio, with `CompanyPicker`) | Firm-wide / portfolio |
| `…/compliance/tracker` (same three shells) | `src/views/admin/Compliance.tsx` `initialView="tracker"` — `ComplianceCalendar` + table, company `<select>` | Portfolio, narrows to one company |
| `/app/super/projects/[id]` | `src/views/super/SuperProjectDetail.tsx` → `SuperProjectRail.FilingsPanel` | **Per-engagement** (the super admin's inspection of one company) |
| Admin / manager `ProjectDetail`, intern `EngagementDetailClient` | — | No compliance section exists |

Super admin's "Portal" enter-as link (`/app/client/overview`) opens the client shell under the super's own firm-wide `AuthContext` with **no pinned engagement** (`TODO(owner)` in `src/lib/super-overview.ts` `enterAs.client`). In that shell `findEngagementForClientUser` resolves nothing, so the shared module behaves as a portfolio view. The super's per-engagement inspection is the project detail page.

`src/views/client/Compliances.tsx` is the pre-shared-module client view. It has **no importers** (dead file). Left alone; not part of this change.

## 4. Client Compliances nav

`compliancesGroup('/app/client')` in `clientItems` (`src/components/shell/RoleSidebar.tsx:166`) is unconditional. Nothing hides or disables it pre-COI, so Phase 4 has nothing to remove there.

## 5. Export controls

The Filings header has **no Export control** — P1 export is blocked on an owner dependency decision (no xlsx / PDF library; FILINGS-BUILD-PROGRESS "data dependency 3"). There is nothing to disable, and adding a placeholder Export button would be a fabricated control. Skipped; noted here so the brief's step is accounted for.

## 6. Design-system reuse (inventory row added 2026-09-07)

| Need | Reuse | Why |
|---|---|---|
| Top banner | `Alert` (`src/components/ui/alert.tsx`) + `IconChip tone="info"` + the login info-chip tint (`border-l-[3px] border-l-info border-info/20 bg-info-light`, as `LoginFormCard`'s private `AlertBanner` and the login showcase card) | The only exported callout primitive in the tree; the login `AlertBanner` is file-private, so its classes are composed rather than imported. Status colour stays inside the icon tile and border; the panel is a bordered tinted callout, not page fill. `role="status"` (polite), not the default `role="alert"`. |
| Empty state | The module's own genuine empties — `DashDataTable`'s `empty` line, the calendar month rail's "Nothing falls due in this month.", the matrix's `EMPTY_REGISTER` | The brief asks for the normal Calendar / Filings layout in its real empty state. `EmptyStateIllustrated` is the full-page variant and would replace that layout, so it is not used here. |

One copy-only wrapper, `PreIncorporationNotice` in `src/components/compliances/`, owns the two audience strings and composes those primitives — so Calendar, Filings, the staff tracker and the super rail print identical copy. It introduces no new visual primitive.

## 7. Plan for Phase 4, given the above

1. **Client** — route shells stay server components; a thin client wrapper resolves the client's engagement from `useApp`, computes `preIncorporation` with `isIncorporated`, and renders the shared views. Nav untouched.
2. **Project Lead / Manager / Admin** — the per-engagement surface that exists is the filing tracker with one company selected, plus the statutory calendar with one company picked. Both get the staff banner for a pre-COI company. Portfolio ("All companies") keeps its real deadlines / instances; the count of pre-COI engagements is already on the engagement list, so a one-line note is added without any new query.
3. **Super Admin** — `FilingsPanel` on project detail shows the staff banner when the summary says not incorporated; `summarizeEngagement` derives that through `isIncorporated`. Read-only, no mutation.
4. **Firm-wide** — no whole-portfolio banner.

## 8. Preservation check

Not touched: Inngest job + trigger, checklist catalog / validators / gate, board-resolution finalize, email fan-out, the `incorporationDate` write path, auth / scoping / repository filters, WhatsApp / Twilio scaffolding.

---

## Phase 5 — acceptance QA (2026-09-07)

Run in a real browser (Playwright Chromium, repo `node_modules`) against the
running local dev server + Docker Postgres, one fresh session per role, read-only
navigation. Fixtures are the seeded demo data: Kestrel Robotics (pre-COI,
`incorporation_date` null, Pre-12 not started, zero `compliance_instances`) and
Solstice Energy (COI 2025-09-15, 39 instances). Script and screenshots live in
the session scratchpad; nothing was seeded or mocked for the run.

| Role | Engagement state | Expected | Result |
|---|---|---|---|
| Client (`client-kestrel@…`) | pre-COI | Compliances nav visible; banner + empty Calendar / Filings; exports disabled | **Pass.** Calendar + Filings nav links present; notice on both pages; summary strip 0 / 0 / 0, real month grid, month rail "Nothing falls due in this month."; Monthly / Quarterly / Annual tabs with the genuine "No filings recorded for this period." register. No export control exists to disable (see §5). No page or console errors. |
| Client (`client-solstice@…`) | post-COI | Unchanged — real calendar + filings | **Pass.** No notice; summary strip with live counts; Annual FY 2026-27 shows the 8 real rows (Form 16 Issue filed, DPT-3 overdue, …). The automated text probe for the first row timed out while the dev server compiled the route; the screenshot taken immediately after shows the rows, and the no-notice check passed. |
| Project Lead (`lead-divya@…`) | pre-COI engagement | Banner + empty state for that company | **Pass.** Tracker with Kestrel picked shows the staff notice; Solstice picked shows none. Statutory calendar and tracker "All companies" print "1 engagement begins compliance after incorporation." and no whole-portfolio banner. |
| Manager (`pm-anita@…`) | single pre-COI project | Banner + empty state | **Pass.** Kestrel → notice; Solstice → none. |
| Manager | firm-wide portfolio | Real instances, no whole-portfolio banner | **Pass.** "3 engagements begin compliance after incorporation." one-liner; real rows kept; no banner. |
| Admin (`admin-nadia@…`) | single pre-COI project / portfolio | Same as manager | **Pass.** Kestrel → notice; Solstice → none; statutory calendar shows the count line only. (`admin@vcfo.local` from STATE.md is not in the current local DB; the demo firm admin was used.) |
| Super Admin (`super@vcfo.local`) | inspecting pre-COI client | Same as client, no mutation | **Pass.** `/app/super/projects/<kestrel>` rail Compliance panel shows the staff notice over "No filings in the next 90 days."; Solstice shows none. Inspection is read-only — the panel has no actions. The "Client portal" enter-as link opens the portal with no pinned engagement (pre-existing owner TODO), so there the shared views behave as firm-wide and show no notice — recorded, not changed. |

### Invariants confirmed

- **No fabricated instances.** Every empty state above is the real query result; `compliance_instances` was not written to and nothing is seeded, mocked or placeholdered in the UI.
- **Banner uses the inventory callout.** `PreIncorporationNotice` composes `ui/alert` + `IconChip` + the login info tint; no new visual primitive was added (inventory row "Callout / info notice").
- **No status colour as page fill.** The notice is a bordered tinted callout; page and panel backgrounds are untouched.
- **`isIncorporated` is the only source.** Client wrapper, staff tracker, statutory calendar and the super summary all call it; grep for `incorporationDate` in views shows no hand-rolled check.
- **No `db` import in any view.** The signal rides the existing engagement payload; `/api/filings` and the repositories are unchanged.
- **Preservation list untouched:** Inngest job + trigger, checklist catalog / validators / gate, board-resolution finalize, email fan-out, the `incorporationDate` write path, auth / scoping, WhatsApp / Twilio.

### Gate

`npm run test` 100 files / 892 tests green (15 new across the phases: helper 4, notice 6, client wrapper 5). `npx eslint .` 0 errors (528 pre-existing warnings, unchanged). `npm run typecheck` reports exactly one error, pre-existing and unrelated: `drizzle.config.ts` cannot import `defineConfig` because the uncommitted working tree pins `drizzle-kit` to `^0.18.1`; no error is attributable to this change.

### Finding for the owner (not changed here)

The staff filing tracker renders `computeAllFilings`, an in-memory run of the same generator, and `fixed_annual` obligations anchor on `'2000-01-01'` when no incorporation date exists (`src/lib/compliance/generate-instances.ts:45`). A pre-COI company can therefore show a couple of generated rows there (Kestrel: Advance Tax Q2, Director KYC) while the DB-backed register the client sees has none. That is LIFTed domain behaviour and outside this display-only change; it is recorded in `docs/context/NOTES.md`.
