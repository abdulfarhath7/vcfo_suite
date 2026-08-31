# Design system inventory — the canonical components

Produced by reading the **Project Lead dashboard** (`src/views/intern/Today.tsx`
plus `src/components/intern/Lead*.tsx`) as required by
`docs/SUPER-ADMIN-DASHBOARD-CONTEXT.md` §1. The lead dashboard is the canonical
design system: where two versions of a primitive exist, the one the lead
dashboard uses wins, and everything else is deprecated for new surfaces.

> Repo correction to the context doc: `app/app/intern/*` holds **route shells
> only** (`export default function Page() { return <InternToday /> }`). The real
> UI lives in `src/views/intern/*` and `src/components/intern/*`.

## The table

| Element | Canonical component | File path |
|---|---|---|
| Metric / KPI region | **The hero stat row** — the lead dashboard's headline numbers live inside the hero panel, not in cards. `LeadMetricCard` (`.lead-metric` shell) is the card shape, currently imported by nothing. **See "KPI drift" below.** | [src/components/intern/LeadHero.tsx](src/components/intern/LeadHero.tsx), [src/components/intern/LeadMetricCard.tsx](src/components/intern/LeadMetricCard.tsx) |
| Panel / card container | `.surface` utility (`@apply noir-card shadow-layered`), wrapped by `DashSection` for the icon-tile + uppercase-title anatomy | [app/globals.css:576](app/globals.css#L576), [src/components/dash/DashSection.tsx](src/components/dash/DashSection.tsx) |
| Section header / title | `DashSection` header: `h-7 w-7` solid tone tile + `text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink` | [src/components/dash/DashSection.tsx](src/components/dash/DashSection.tsx) |
| Status pill / chip | `TONE_BADGE[tone]` on `rounded-full px-2.5 py-0.5 text-[11px] font-extrabold`; lead-side helper `internToneBadge(tone)` | [src/components/common/IconChip.tsx](src/components/common/IconChip.tsx), [src/components/intern/intern-tones.ts](src/components/intern/intern-tones.ts) |
| Progress bar / track | `LeadPhaseProgress` — `h-2.5` flex of `rounded-full bg-raised` segments filled with `bg-[oklch(var(--phase-*))]`, flexed by step count | [src/components/intern/LeadPhaseProgress.tsx](src/components/intern/LeadPhaseProgress.tsx) |
| Progress ring | `DashHeroRing` (hero, white-on-gradient) / `ProgressRing` (on-surface) | [src/components/dash/DashHero.tsx](src/components/dash/DashHero.tsx), [src/components/noir/ProgressRing.tsx](src/components/noir/ProgressRing.tsx) |
| Empty state | In-panel one-liner: `text-[12.5px] text-muted-foreground` (`LeadSideRail`, `LeadPhaseProgress`). Full-page: `.surface px-6 py-8 text-center` with a `serif` line (`MyWork`'s `EmptyWork`). Illustrated variant: `EmptyStateIllustrated` | [src/components/intern/LeadSideRail.tsx](src/components/intern/LeadSideRail.tsx), [src/views/intern/MyWork.tsx](src/views/intern/MyWork.tsx), [src/components/noir/EmptyStateIllustrated.tsx](src/components/noir/EmptyStateIllustrated.tsx) |
| Loading skeleton | Per-panel `animate-pulse rounded-md bg-muted/40` blocks; never a full-screen boot screen | [src/views/admin/AnalyticsCharts.tsx](src/views/admin/AnalyticsCharts.tsx), [src/components/client/overview/ClientOverviewSkeleton.tsx](src/components/client/overview/ClientOverviewSkeleton.tsx) |
| Donut chart | `DashDonut` + `DashLegendRow` (generalised from `LeadSideRail`'s compliance donut) | [src/components/dash/DashSection.tsx](src/components/dash/DashSection.tsx) |
| Cartesian charts | **Was ad hoc** (`AnalyticsCharts.tsx` inlined axis/grid/tooltip props). Now `src/components/charts/*` — see "New canonical pieces" | [src/components/charts/](src/components/charts/) |
| Page header + back button | `PageBackCluster` / `PageBackButton`; crumb text from `shell-crumbs.ts` | [src/components/shell/PageBackButton.tsx](src/components/shell/PageBackButton.tsx), [src/components/shell/shell-crumbs.ts](src/components/shell/shell-crumbs.ts) |
| Page transition wrapper | `PageTransition` (wraps every view) + `SEO` | [src/components/shell/PageTransition.tsx](src/components/shell/PageTransition.tsx) |
| Sidebar / shell / top bar | `AppShell` → `RoleSidebar` (`superAdminItems` nav array) + `TopBar` + `CommandPalette` | [src/components/shell/AppShell.tsx](src/components/shell/AppShell.tsx), [src/components/shell/RoleSidebar.tsx:156](src/components/shell/RoleSidebar.tsx#L156) |
| Greeting card (hero) | `DashHero` — **the only one**. Clock line + settings popover on top, serif title with optional sub-line, ring, hairline, stat strip; hero skin, ambient motion and reduced motion from `useShellAppearance`. `LeadHero` and `ClientOverviewHero` are thin content wrappers around it. | [src/components/dash/DashHero.tsx](src/components/dash/DashHero.tsx), [src/components/dash/DashHeroSettings.tsx](src/components/dash/DashHeroSettings.tsx) |
| Motion | `src/lib/motion.ts` — `cardHover`, `tweenShort`, `fadeUp`, `springSnappy`, `staggerKids`; `layoutId` pills via `MotionActivePill` | [src/lib/motion.ts](src/lib/motion.ts) |
| Phase colours | `phaseKeyFromId` + `PHASE_CLASSES` + `--phase-*` tokens | [src/lib/phase-colors.ts](src/lib/phase-colors.ts) |
| Spacing / radius / typography | Panel gap `gap-3`; panel padding `px-4 pt-3 pb-3 pt-2.5`; radius `var(--radius)`; type scale `10.5 / 11 / 11.5 / 12 / 12.5 / 13 px` with `font-extrabold` labels; serif display for numbers (`.serif`), Manrope UI, IBM Plex Mono for identifiers | [app/globals.css](app/globals.css) |

## Composition rules read off the lead dashboard

- **Page skeleton:** `PageTransition` → `SEO` → `div.flex.flex-col.gap-3` →
  hero → `grid xl:grid-cols-[minmax(0,1fr)_318px]` (main column + fixed side
  rail). Both `Today.tsx` and the current super dashboard use exactly this.
- **KPI placement:** the lead's headline numbers live **inside the hero panel**
  (`LeadHero`'s stat row: serif value + small label, `border-l border-white/20`
  separators, each deep-linking into `/app/intern/tasks?focus=…`). There is no
  card band under the hero — the hero *is* the metric region. A screen that
  shows the same numbers in the hero *and* in a card band prints every number
  twice; the super admin surface follows the lead and keeps them in the hero
  only.
- **Panel anatomy:** `.surface` → header row `px-4 pt-3` with a `h-7 w-7`
  solid-tone icon tile and an uppercase 11.5px title → body `px-4 pb-3 pt-2.5`.
  `DashSection` encodes this exactly; use it rather than hand-rolling.
- **List rows:** `divide-y divide-border` or `border-t border-border`, row body
  `py-2.5`, 13px semibold title, 11px muted meta, status as a `rounded-full`
  `TONE_BADGE` pill, actions right-aligned as `rounded-full border border-border
  px-3 py-1 text-[11px] font-bold` buttons.
- **Status language:** colour appears only in chips, icon tiles, dots and chart
  fills — never as page or panel fill.

## Known duplicate primitives (do not fork further)

The context doc's §0 warning is real. What is actually in the repo:

| Duplicate | Verdict |
|---|---|
| `LeadMetricCard` (`src/components/intern/`) | The lead dashboard's KPI card. **Currently imported by nothing** — the lead hero absorbed the numbers. Kept as the shape reference. |
| `ClientKpiRow`'s private `KpiTile` (`src/components/client/overview/`) | A fork of `LeadMetricCard` with a caption instead of chips. This is the drift §0 describes. |
| `AccentKpi`, `KpiCard`, `MetricCard` | Not present in this tree (already removed). `KpiNumber` (`src/components/noir/`) survives as a number-only primitive. |
| `Surface` (`src/components/noir/Surface.tsx`) vs `.surface` utility | The lead dashboard uses the **`.surface` utility class**. Prefer it. |
| `listComplianceInstances` role branch | Bug, noted not fixed: `src/db/repositories/compliance.ts:167` tests `ctx.role === 'admin'`, so `super_admin` falls through to the client scope. Super-admin compliance reads must not depend on it. |

## New canonical pieces added by the super admin build

Extracted shared, per §2's escape hatch — used by super admin now, available for
lead/client convergence later.

| Piece | Path | Why |
|---|---|---|
| Shared chart layer | [src/components/charts/](src/components/charts/) | Themed tooltip, token-derived colour scale, default axis/grid/bar props, lazy recharts loader with the canonical skeleton. Every chart on every dashboard uses this; `AnalyticsCharts.tsx` should adopt it next. |
| `DashDataTable` | [src/components/dash/DashDataTable.tsx](src/components/dash/DashDataTable.tsx) | The list/table style, factored out of `MyWork`'s `ListView` (same header type scale, `border-t border-border` rows, `hover:bg-raised/70`) so the projects and document lists do not invent a second table. |
| `DashFilterChip` | [src/components/dash/DashFilterChip.tsx](src/components/dash/DashFilterChip.tsx) | The list filter chip, lifted verbatim from `MyWork`'s private `FilterChip`. `MyWork` should adopt it. |
| `DashHero` | [src/components/dash/DashHero.tsx](src/components/dash/DashHero.tsx) | Not new, but **absorbed the other two heroes**. It claimed to be "the lead greeting card, generalised" while rendering a different title face, pill-shaped stats, no clock and no settings. It now carries the lead card's full chrome, and `LeadHero` / `ClientOverviewHero` render it instead of their own copies — so there is one greeting card across all five role shells. |
| `DashHeroSettings` | [src/components/dash/DashHeroSettings.tsx](src/components/dash/DashHeroSettings.tsx) | `LeadHeroSettings`, moved into the dash kit now that every hero carries it. Its settings link resolves from the pathname (`roleFromAppPathname`) rather than the app context, so the hero renders in any shell — and in tests — without a provider. |

### Left deliberately un-forked

`LeadMetricCard` and `ClientKpiRow`'s private `KpiTile` are still two spellings
of the same `.lead-metric` card. A third, shared version was drafted and then
**deleted**: with headline numbers belonging in the hero (see the composition
rules above), the super admin surface has no caller for it, and shipping an
unused canonical component would have made the duplication worse rather than
better. When the lead or client surface next needs a metric card, extract one
shared component from those two and delete both.
