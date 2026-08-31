# Super Admin Dashboard — build progress log

Source of truth for the build: `docs/SUPER-ADMIN-DASHBOARD-CONTEXT.md`.
This file mirrors that backlog (§11) as checkboxes and records decisions and
corrections so the build is resumable across sessions. On restart, read this
first, then continue at the first unchecked item.

Component inventory: `DESIGN-SYSTEM-INVENTORY.md` (built first, per §1).

---

## Repo corrections to the context doc

| Context doc says | Repo actually has |
|---|---|
| Companion `SUPER-ADMIN-DASHBOARD-SPEC.md` (§4–6: screens, chart inventory, KPI computation) | **Does not exist in the repo.** Scope for screens/KPIs was derived from the context doc's own §5/§8/§11 plus the shapes the data layer can actually produce. Every place the missing spec would have decided something is marked `// TODO(owner):`. |
| Companion prototype `SuperAdminDashboard.jsx` | **Does not exist in the repo.** No layout reference was available; composition was mirrored from `src/views/intern/Today.tsx` instead, which §1 says wins anyway. |
| Lead dashboard under `app/app/intern/*` | Route shells only. Real UI: `src/views/intern/Today.tsx` + `src/components/intern/Lead*.tsx`. |
| Super admin under `/app/super/*` | Correct. `app/app/super/{dashboard,announcements,notifications,settings}` exist; view was `src/views/super/SuperDashboard.tsx` (rewritten). |
| ~4 competing KPI components (`AccentKpi`, `KpiCard`, `MetricCard`) | Already removed. What remains is `LeadMetricCard` (unused) and `ClientKpiRow`'s private `KpiTile` fork. Left as-is: the lead keeps its headline numbers in the hero, so this surface needs no metric card and a third shared one would have shipped unused. See the inventory's "Left deliberately un-forked". |
| Reuse `checklist-step-gate.ts` for phase/health/next-action | Correct and used: `gateActiveCatalog(state, 'staff')` + `deriveStuckReason` (`src/lib/project-stuck.ts`). Nothing re-implemented. |
| recharts in the stack | Correct (`recharts@^2.15.4`), and already lazy-loaded in `src/views/admin/AnalyticsCharts.tsx`. The shared chart layer keeps that lazy pattern. |

## Decisions taken (defaults from §3, no owner block)

- **Observatory-only.** No write actions anywhere on this surface in v1.
- **Enter-as = read-only inspection**: plain links into the existing
  `/app/admin/*` and `/app/client/*` shells. No impersonation, no role swap, so
  nothing role-scoped can mutate.
- **Route root** `/app/super/*`; `/app/super/dashboard` is the Overview (L0).
- Built on current tokens + the canonical components in the inventory. No new
  colour system; gold stays the `super-gold-chip` badge in the sidebar.
- Compliance is read firm-wide **inside the super repository** rather than via
  `listComplianceInstances`, whose role branch misses `super_admin`
  (`src/db/repositories/compliance.ts:167`). Noted in the inventory; not fixed
  here to keep the diff inside this surface.

---

## P0 — foundation + consistency spine

- [x] Inventory the lead dashboard → `DESIGN-SYSTEM-INVENTORY.md` (§1).
- [x] Shared chart layer (§9) — `src/components/charts/*`: token-derived colour
      scale, themed tooltip, default axis/grid/bar/line props, lazy recharts
      loader, shared legend and plot frame.
- [x] `getSuperAdminOverview` repository + `/api/super/overview` + `useSuperOverview`
      + scoping test (§7). Pure derivations in `src/lib/super-overview.ts` with
      their own unit tests.
- [x] Shell/nav/breadcrumb for `/app/super/*` — added a Projects entry to
      `superAdminItems`, registered `/app/super/projects` in
      `SHELL_PRIMARY_PATHS`. Breadcrumbs and back already resolve for
      `/app/super/projects/:id` via the existing `projects` branch.
- [x] Overview screen — hero (headline numbers inside it, exactly like the lead),
      stage + journey-throughput charts, needs-attention list, workload, and a
      318px rail with ball-in-court, compliance runway and live activity.
- [x] Consistency audit vs. lead dashboard; drift fixed (see the audit below).

## P1 — core drill path

- [x] Projects list (`/app/super/projects`) in the canonical table style, with
      filter chips and a mobile row.
- [x] Project detail (`/app/super/projects/[id]`) — journey timeline off the same
      gate, documents, compliance, activity, ball-in-court donut, team,
      read-only enter-as. Backed by `getSuperEngagementDetail` +
      `/api/super/projects/[id]` + `useSuperProject`.
- [x] Consistency audit on both.

## P2 — remaining domains

- [ ] Compliance · People & workload · Approvals · Activity · Documents.
- [ ] Command palette (⌘K) search across engagements/people/documents.
- [ ] Enter-as-shell (read-only) polish.
- [ ] Consistency audit across all.

## P3 — full polish + convergence pass

- [ ] Light/dark audit across every screen.
- [ ] Responsive/mobile audit.
- [ ] Motion + loading-state audit.
- [ ] Hunt and remove any hardcoded hex or one-off spacing.
- [ ] Confirm no duplicate/forked primitives; note extracted shared components
      for lead/client convergence.
- [ ] Final side-by-side against the lead dashboard for every screen.

---

## Session log

### 2026-08-31 — session 1

- Read the lead dashboard, noir kit, shell, dash kit, gate logic, and the
  client-overview data layer (the freshest repository → route → hook pattern).
- Wrote `DESIGN-SYSTEM-INVENTORY.md`; flagged the two missing companion files.
- Built P0 and P1 (see the checkboxes above).

**Route naming.** The list lives at `/app/super/projects`, not
`/app/super/engagements`: `shell-crumbs.ts` already maps a `projects` segment to
a "Projects" crumb whose parent is `${roleBase}/projects`, so the existing
breadcrumb and back-fallback logic works untouched. `/app/super/engagements`
would have produced a crumb pointing at a `/app/super/projects` that did not
exist.

**Consistency audit — drift found and fixed.**

1. *The Overview printed every headline number twice.* First pass had the lead's
   hero stat row **and** a `.lead-metric` card band under it — the same four
   numbers in both. The lead dashboard has no card band; its hero *is* the metric
   region. Removed the band from the Overview and the detail screen, and deleted
   the shared `DashMetricCard` that had been drafted for it rather than ship an
   unused component (rationale recorded in the inventory).
2. *`DashHero` was not actually the lead hero.* Its docstring claimed to be the
   lead greeting card generalised, but it rendered a sans title and pill-shaped
   stat chips. Corrected to the lead's serif title and hairline-separated
   baseline stat row, which also converges the two admin dashboards that use it.
3. *A row could contradict itself.* `deriveStuckReason` calls an untouched
   project "Lead pending" (a missing checklist slice counts as lead work), while
   the gate says the first step belongs to the client. The chip said one thing
   and the line under it said the other. Added a gate-derived `stateKey` /
   `stateLabel` to the summary and made every row chip use it;
   `stuckReason` stays available and is no longer shown as the primary label.
   `project-stuck.ts` was not modified — the admin dashboards keep their reading.
4. Filter chips were about to be a fourth copy of `MyWork`'s private
   `FilterChip`; extracted `DashFilterChip` instead.

**Verified.** `npm run typecheck` clean, `npm run test` 803 passing (91 files),
`npm run build` clean with `/app/super/projects` and `/app/super/projects/[id]`
registered. Against the running dev server with real seed data, signed in as
`super@vcfo.local`: `/api/super/overview` and `/api/super/projects/[id]` both
200 with live numbers (1 project, 46 steps, 4 staff), the three pages render
without an error boundary, anonymous requests get 401 / a login redirect.

**Demo data.** Added `scripts/seed-demo.ts` (`npm run db:seed-demo`) so the
dashboards have something to show locally: 2 admins, 3 managers, 5 leads, 10
clients and 10 projects spread across every stage, health and gate state, plus
documents, an audit trail, tasks, and compliance filings generated through the
real `systemGenerateComplianceInstances` path rather than fabricated rows. Rows
are tagged (`@demo.vcfo.local` profiles, `demo-` engagement slugs) and a re-run
replaces only those, so hand-made data survives. This is dev-database seed data,
not UI placeholder data — the §6 "real data only" guardrail is about hardcoded
series on shipped screens, and every screen still reads these rows live through
the repository layer.

**Bug the demo data exposed and fixed.** `buildPhaseBars` estimated each phase's
open/locked split proportionally from the project's total open count. With one
open step per project the estimate handed every remaining step to "open" and
reported zero locked steps — the journey-throughput chart was wrong for any
project that was not nearly finished. `summarizeEngagement` now counts gate kinds
per phase and the bars just sum them; regression test in
`src/lib/super-overview.test.ts`.

**One greeting card everywhere (owner request).** The hero was still three
components: `LeadHero`, `ClientOverviewHero` and `DashHero`, and only the lead's
had the clock line and the settings popover. `DashHero` now carries the lead
card's full chrome — live local time top-left, settings popover top-right, hero
skin, ambient motion, serif title, ring, hairline, stat strip — and the other
two are thin content wrappers around it. Knock-ons:

- `LeadHeroSettings` moved to `src/components/dash/DashHeroSettings.tsx`; it
  resolves its settings link from the pathname (`roleFromAppPathname`, new in
  `auth-routes.ts`) instead of `useApp`, so the hero no longer needs a provider
  above it — which is also what let the client hero tests keep passing.
- `kicker` became `subtitle` and now renders under the title, since the top-left
  slot is the clock. Three staff dashboards were passing a formatted date there,
  which the clock now duplicates; those were dropped, along with the
  `headerDateLabel` prop and its `useClientLocaleDate` call in
  `views/admin/Dashboard.tsx`.
- A user's greeting-card skin now follows them across every dashboard rather
  than applying only to the lead's.

**Client-side fixes (owner-reported).**

1. *The client Incorporation page was dead* — it rendered its error boundary
   ("Couldn't load incorporation") for every client. `ChecklistClientFlow`
   imported `motion` from framer-motion while `app/providers.tsx` wraps the app
   in `<LazyMotion features={domMax} strict>`, which throws on any `motion.*`
   component. Swapped to `m.*`, the convention everywhere else in the repo.
   Caught by screenshotting the page rather than by the 200 the route returns —
   the error boundary renders inside a successful response.
2. *Client pages did not fill the window.* `AppShell` capped the client shell at
   `max-w-[1200px]` while the lead dashboard gets `max-w-[1400px]`, leaving a
   visible gutter. Client now matches the lead. The client's wider sidebar
   offset (`lg:pl-[15.5rem]` vs `lg:pl-56`) is correct and was left alone — the
   client sidebar really is 15.5rem.
3. *An incorporated company read "Incorporation date pending".* The header took
   the date from the legacy mock `Client` record instead of
   `engagement.incorporationDate`.

**Client incorporation rebuilt as the lead's two-level drill (owner request).**
`/app/client/incorporation` opened straight into the step wizard. It now shows
the four phase rows first — SPICe+ Part A / Part B / Post-incorporation /
Registration, each with a tick track, `n/m` and a chevron — and `?phase=` opens
that phase's steps. The rows are `InternPhaseEntryCards`, the lead project
page's own component, so the two surfaces are one object. `?step=` email links
still work: the page resolves the phase that owns the step. Sequencing is
untouched — gates still come from `gateActiveCatalog`.

**Explanation copy removed site-wide (owner request: "no explanations, Zoho
feel").** `src/data/checklist.ts` was NOT edited (§6 guardrail); the copy is
simply no longer rendered:

- `ChecklistExpectedTimeline.tsx` deleted. It printed "Expected timeline · 2–3
  working days" beside every status. Replaced by `ChecklistStatusBadge.tsx`
  (`ChecklistStatusBadge` / `ChecklistStatusPill`), status only, across its ten
  call sites.
- Step `description` and `notes` paragraphs dropped from the client wizard, the
  admin phase journey, and the step detail header + "Step notes" block. The
  statutory deadline chip stays — that is data, not prose (`hideTimeline`
  renamed to `hideDeadline`, which is what it now gates).
- Step workspace rail: the "Help" section (description + notes) and the
  "Typical turnaround …" line are gone.
- Client dashboard: the reassurance sentences under "You're all set", under the
  ball-in-court split, and under the team roster are gone. The headline, the
  numbers and the roster stay.

**Not yet done:** the two remaining §12 checks — a human look at the screens in
both light and dark, and the side-by-side against the lead dashboard. Everything
below is still open.
