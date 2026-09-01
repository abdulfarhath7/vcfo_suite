# Filings — build context for Claude Code

**Mission:** Build a shared **Compliances** section with two pages — **Calendar** and **Filings** — that shows a company's statutory filing obligations (the compliance register) as both a forward-looking calendar and formal Monthly / Quarterly / Annual sheets, with PDF and Excel export. Build it **once** as a scope-parameterized feature and render it for **all five roles** (client, lead, manager, admin, super admin); the only thing that differs per role is the data scope.

This is the same discipline as the client and super-admin dashboards: **UI/UX consistency is non-negotiable.** Reuse the canonical components inventoried from the Project Lead dashboard (`DESIGN-SYSTEM-INVENTORY.md`) — the shared calendar, the canonical table, the canonical status pill, the shared section headers. Do **not** create a new calendar, table, or pill variant for this feature.

Work continuously and methodically; maintain a progress file; ship the client scope end-to-end first, then flip on the other roles.

---

## 0. Locked decisions (owner-approved; override only if told)

| Decision | Locked value |
|---|---|
| Section name | **Compliances** group with two children: **Calendar** and **Filings** |
| Register name | **Filings** (do not call it "registers", "status sheets", or "compliance log") |
| Filings default view | **This month**, synced to the calendar; toggle to full year |
| PDF export | Formal letterhead sheet — company banner + firm mark, period title, the register table, **Reporting Manager / Reporting Partner** signature blocks with Date lines |
| Excel export | **Three tabs**: Monthly / Quarterly / Annual |
| Firm-wide export (admin/super, many companies) | **One sheet/PDF per company, zipped** |
| Scope model | One shared module; `AuthContext` scope is the only per-role difference |

---

## 1. Read before you build

1. `DESIGN-SYSTEM-INVENTORY.md` and the **Project Lead dashboard** — for the canonical table, status pill, section header, empty state, skeleton, spacing.
2. The **existing staff compliance screen** and any **calendar component** already in the app — reuse it; do not build a second calendar.
3. The **compliance data**: how instances are generated (Inngest job from obligations + incorporation date) and what fields each instance carries. This feature is a **read** over that existing source of truth — do **not** create a new one.
4. `engagement-recipients.ts`, the document-generation code (docx/pdf), and any Excel/xlsx usage already in the repo — reuse for export.

---

## 2. The shared-feature principle (the core of this build)

Build the Calendar and Filings pages **once**, taking a **scope** resolved from `AuthContext`:

- **Client** → own engagement only.
- **Lead** (code role `intern`, label Project Lead) → assigned engagements.
- **Manager** → owned engagements.
- **Admin** → firm-wide, with a company filter/selector.
- **Super Admin** → firm-wide, everything, with drill-into-any-company.

Same components, same layout, same export, same cross-links for every role. The firm-wide roles add a **company selector**; single-company roles skip it. The register the client downloads and the register super admin inspects are the **same component and the same rows** — nothing to drift.

---

## 3. Navigation & IA

- Turn the current single **Compliances / Compliance** nav entry into a **group** with two children — **Calendar** and **Filings** — in every role's nav (mirrors the Updates → Announcements/Notifications pattern). Keep the client Inbox-first ordering otherwise.
- Routes (confirm the app's actual pattern): `…/compliances/calendar` and `…/compliances/filings`.
- **URL carries state** so refresh/share lands correctly: e.g. `…/filings?cadence=monthly&period=2026-04` and `…/calendar?date=2026-04-15`.

---

## 4. Page — Calendar (the radar)

Reuse the existing calendar component, scoped to the resolved engagement(s):

- Month view; each obligation a chip coloured by the canonical status (Filed / Due soon / Overdue / Upcoming). Status colour in **chips only**, never cell/page fill.
- A summary strip above the calendar: "N due this month · N overdue · N filed" — the emotional read first.
- **Cross-links:** a header button "Open filings" → Filings page; and on each month, a small **"View this month's filings"** action → `…/filings?cadence=monthly&period=YYYY-MM` (jumps to the Monthly tab pre-filtered to that month).
- Pre-COI: honest empty state ("Your filing calendar starts the day your Certificate of Incorporation is issued.").

---

## 5. Page — Filings (the ledger)

Three tabs — **Monthly · Quarterly · Annual** — each mirroring the firm's board-deck layout (reference images provided by the owner). Default tab = Monthly, default period = **this month**, synced with the calendar.

**Monthly tab**
- Default: current month, a clean table — **Compliance · Form · Due Date · Filed Date · Frequency · Status**.
- Toggle **"Full year"** → the deck matrix: rows = compliance, columns = months (Apr…Mar of the FY), each cell showing Due / Filed. Current month emphasized.
- Footnote line from the deck: note that physical labour registers are maintained monthly per Indian labour law (only if that data/flag exists — otherwise omit; don't invent it).

**Quarterly tab**
- Deck matrix: rows = compliance (e.g. Form 24Q, 26Q, Advance Tax) with **Due Date / Filing Date** sub-rows; columns = quarters of the FY. Current quarter emphasized.

**Annual tab**
- Flat table: **Sl No · Description · Form · Due Date · Date of Filing · Status** for the current FY.

**Across all tabs**
- "Yet to File" and similar become the **canonical status pill** (Filed = teal, Due soon = coral, Overdue = rose, Upcoming = slate). A faint tint on overdue rows is allowed for scannability (matching how the deck bolds problem rows) — but status is carried by the chip, not row fill.
- Header holds the **Export ▾** button (PDF / Excel) and, for firm-wide roles, the **company selector** and a full-year/period control.
- **Cross-link back:** a row can jump to that date on the Calendar (`…/calendar?date=…`).
- Table uses the **canonical table component** — same row height, hover, dividers, chip usage as the lead dashboard's tables. No new table variant.

---

## 6. Export

- **Export ▾** dropdown on the Filings page header → **PDF** and **Excel**. Generate server-side via API route → repository (no `db` in views); reuse existing document-generation infra where possible.
- **PDF:** the formal letterhead sheet — company-name banner + firm mark, title "Compliance / Activities for {period}", the register table for the current cadence/period, and **Reporting Manager / Reporting Partner** signature blocks with Date lines. Match the attached reference format.
- **Excel:** three tabs — Monthly / Quarterly / Annual — real cells (not an image), so the client's accountant can work in it.
- **Firm-wide (admin/super across companies):** one sheet/PDF **per company**, zipped. (Board sheets are per-company.)
- Export reflects exactly the on-screen rows for the selected scope/period — same data, three faces (screen / PDF / Excel); nothing drifts.

---

## 7. Data layer

- **Source:** the existing compliance instances (Inngest-generated). Do not create a new source of truth.
- **Read:** `getFilings(ctx: AuthContext, { scope, cadence, period, engagementId? })` in a repository under `src/db/repositories/*`, exposed via an API route, consumed by a `useFilings()` TanStack Query hook. The Calendar reads the same instances plotted by due date.
- **Fields needed per instance:** category/compliance name, form, due date, filed date, frequency (monthly/quarterly/annual/one-time), status, period, engagement. **If filed date, form, frequency, or category are not stored on the instance, that is a data dependency to resolve properly — flag it in the progress file; do NOT fabricate values or a status.**
- **Scope enforced in the repository** by `AuthContext`. Required test: a scoping test proving a client sees **only their own** company's filings and cannot read another engagement's.
- Aggregate server-side; paginate the full-year/firm-wide reads.

---

## 8. Design & consistency quality bar (definition of done)

- Uses the canonical calendar, table, status pill, section header, empty state, skeleton — **no new variants**.
- Status colour in chips only (faint overdue-row tint allowed); never cell/page fill.
- Tokens only; zero hardcoded hex or one-off spacing; both light and dark first-class.
- Tables indistinguishable in styling from the lead dashboard's tables.
- Calendar ↔ Filings cross-links work and carry period/tab through the URL.
- **Consistency audit** each phase: open a lead-dashboard table beside a Filings table — a header, a row, and a status chip must be visually identical.

---

## 9. Do-not-break guardrails

- **Client sees only their own company.** Firm-wide scopes are for staff roles only; enforce in the repository, not the view.
- **Real data only** — no demo series; absent data → honest empty state; never a fabricated status or filed date.
- **Repository seam** — no `db` in views; reads via API → repository with `AuthContext`.
- Keep the client **Inbox-first** nav; don't reorder the client's primary navigation beyond adding the Compliances group.
- Reuse the existing calendar and document-generation infra; don't fork parallel versions.
- No secrets in the client bundle.

---

## 10. How to work (continuous protocol)

1. Maintain **`FILINGS-BUILD-PROGRESS.md`** at repo root — mirror the backlog below as checkboxes; log decisions and any data dependencies discovered (§7). Resumable across sessions.
2. Build the data read first, then the pages, one at a time; verify (§11) and run a consistency audit before checking anything off.
3. Ship the **client scope end-to-end** before wiring other roles — it's the one you can fully verify.
4. Don't stop for permission except on a do-not-break guardrail or an unresolved data dependency — pick the safe default, add `// TODO(owner):`, log it, continue.
5. Small, verified commits; keep the branch green.

---

## 11. Build backlog

**P0 — client scope, core**
- [ ] `getFilings` repository + API + `useFilings` hook + scoping test (§7).
- [ ] Compliances nav group (Calendar + Filings) for the client.
- [ ] Calendar page (client scope) with summary strip + status chips + pre-COI empty state.
- [ ] Filings page shell with Monthly / Quarterly / Annual tabs.
- [ ] Annual tab first (simplest, flat), then Monthly (this-month table), then Quarterly.
- [ ] Consistency audit vs. lead dashboard tables.

**P1 — client scope, links + export**
- [ ] Cross-links: calendar month → Monthly filings (period param); row → calendar; "Open filings" button. URL carries cadence/period.
- [ ] Monthly "Full year" matrix + Quarterly matrix (deck layouts).
- [ ] Export ▾ → PDF (letterhead + signature blocks) and Excel (three tabs).

**P2 — other roles (scope flip)**
- [ ] Lead scope (assigned engagements) → Manager scope (owned) — mostly the data filter.
- [ ] Admin + Super scopes: firm-wide + company selector + drill-into-company.
- [ ] Firm-wide export: per-company sheets, zipped.

**P3 — polish**
- [ ] Light/dark + responsive/mobile audit.
- [ ] Status/motion/loading audit; remove any hardcoded hex/spacing.
- [ ] Final consistency audit across all roles; confirm no forked calendar/table/pill.

---

## 12. Verification (after each module)

- `npm run typecheck` and `npm run test` pass (including the scoping test).
- Client (`client@vcfo.local / client123`) sees Calendar + Filings for their own company only; another company's data never appears.
- Calendar ↔ Filings cross-links land on the correct period/tab after refresh.
- PDF matches the letterhead format; Excel has three working tabs; firm-wide export zips per company.
- Pre-COI shows the honest empty state; nothing fabricated.
- Visual consistency check vs. the lead dashboard.

---

## 13. What NOT to do

- Do not create a new calendar, table, or status-pill variant — reuse canonical components.
- Do not fabricate filed dates or statuses; flag missing data instead.
- Do not import `db` in a view or let any role see another company's filings.
- Do not use status colour as cell/page fill.
- Do not build separate per-role copies of these pages — one scope-parameterized module.
- Do not declare done before the per-phase consistency audits and P3 polish.
