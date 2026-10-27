# VCFO Suite components

Date: 21 October 2026. Tokens: `docs/design/TOKENS.md`. This page names the one component that owns each pattern, what it replaces, and which callers still need to move. The point is that the manager, admin and super admin dashboards are built from these parts and nothing else, so they come out looking like the lead and client screens without a second design pass.

## The page

Every dashboard is the same skeleton: `AppShell` (navy sidebar, white top bar) around `PageTransition` → `SEO` → `div.flex.flex-col.gap-3` → `DashHero` → a grid of `DashSection` panels, `xl:grid-cols-[minmax(0,1fr)_318px]` when there is a side rail. Panels sit `gap-3` apart, page margins are `space-6`, and nothing else frames the content. The lead Today screen (`src/views/intern/Today.tsx`) is the reference implementation.

| Pattern | Owner | Replaces | Still to move |
|---|---|---|---|
| Shell: sidebar, top bar, mobile sheet | `src/components/shell/AppShell.tsx`, `RoleSidebar.tsx`, `TopBar.tsx`, `SidebarNavGroup.tsx` | Per-role tints (`role-*` classes), the hero and sidebar skin pickers' gradients | Nothing; every role already renders this shell |
| Greeting card with the headline numbers | `src/components/dash/DashHero.tsx` (`LeadHero` and `ClientOverviewHero` are thin wrappers): `hero-gradient` ground, gold underline, gold ring, hot figure in pale red | `LeadMetricCard`, any band of KPI cards under a hero | `src/components/admin/AccentKpi.tsx` (coloured left borders) should become hero stats or a `StatCard` with a 3px top edge |
| Section card | `src/components/dash/DashSection.tsx` (`.surface` + neutral icon tile + label title + optional meta or link) | Hand-rolled `<section className="surface">` headers with coloured tiles | `src/components/intern/LeadSideRail.tsx` keeps one manual section for the `data-intern-waiting-on` hook; client and admin views still hand-roll headers |
| KPI tile outside a hero | To add: `StatCard` (`surface-raised`, `label` + `figure-lg`, 3px `stat-rule` top edge in its tone, optional six-bar trend strip) | `AccentKpi`, `KpiNumber` | Admin and super dashboards |
| Status chip | `CHIP_CLASS` + `TONE_SOLID` (state, solid, in cards and short columns) or `TONE_OWNER` (owner, soft) or `TONE_BADGE` (tag, soft) in `src/components/common/IconChip.tsx`; `STATE_WORD_CLASS` + `TONE_TEXT` for a state in a dense list (coloured word, no ground); `CHIP_DOT_CLASS` for the inline soft-plus-dot form; `Badge` variants `solid-*` and `owner-*` in `badge-variants.ts`; `CHIP_COLUMN_CLASS` inside columns | Pill chips, identity-coloured chips (`toneForKey`) | Client portal CSS chips follow the same split (`.chip.done` solid, `.chip.you` soft) |
| Icon tile | `IconChip` (neutral by default, status tone only when the tile means that status) | Coloured tiles per section | Callers passing categorical tones get neutral automatically |
| Buttons | `Button` + `button-variants.ts`: `default` (brand), `secondary`/`outline` (line-strong border), `ghost`, `destructive`, `link`; sizes `sm` 28 / `default` 32 / `lg` 40, all at least 84px wide | Ad hoc `<button className="rounded-lg bg-primary ...">` | `InternWorkCtaButton` matches by hand; portal `.btn` / `.btnp` in CSS |
| Inputs | shadcn `Input`, `Textarea`, `Select` with `line-strong` border, `control-md` height, `focus-ring` outline | Inputs styled with `ring-1 ring-border` | Lead todo input matches by hand; portal `.inp` in CSS |
| Table | `DashDataTable` (`src/components/dash/DashDataTable.tsx`): uppercase `label` heads on `surface-sunken`, `row-height` rows striped every second row, `line` hairlines, right-aligned `figure` amounts, a state as a coloured word in long lists and as a chip at `chip-min-width` in short ones | Per-view tables | Filings, audit log, people |
| List rows inside a card | `border-t border-line py-2.5 first:border-0` (see `LeadActionQueue`, `LeadFocusCard`) | Cards inside cards (`rounded-xl ring-1 ring-border` rows) | Any view still nesting `.surface` blocks |
| Empty state | In-panel one-liner `text-[12px] text-ink-muted`; full-page `.surface px-6 py-8 text-center`; illustrated `EmptyStateIllustrated` | | |
| Callout | shadcn `Alert` + `IconChip tone="info"` on an `info-soft` ground with a `line` frame | Coloured left-border notices (`LoginFormCard`, `LoginShowcase`, `PreIncorporationNotice`) | Those three files |
| Progress bar | `LeadPhaseProgress` segments: `surface-sunken` track, `brand` fill, 3px corners, gaps mark phases | Per-phase hues | `ClientComplianceRunway`, `JourneyNode` |
| Donut and legend | `DashDonut` + `DashLegendRow` | Private donuts | `LeadSideRail` now uses them |
| Page header and back button | `PageBackCluster` / `PageBackButton` + `shell-crumbs.ts` | | |
| Loading | Per-panel `Skeleton` blocks on `surface-sunken`; `HexgridLoader` for the boot screen | Full-screen spinners | |
| Motion | `src/lib/shell/motion.ts`; 150ms ease on hover and toggles; the hero's ambient twinkle only when the user picks it | | |

## Rules the owners enforce

- A section is a `DashSection`. Its tile is neutral; a status tone colours the glyph only when the section is about that status.
- A state is a solid chip with a word: `TONE_SOLID.done | progress | waiting | overdue | upcoming` + `CHIP_CLASS`; in a column add `CHIP_COLUMN_CLASS`. An owner is a soft chip: `TONE_OWNER.client | sbc | mca | manager`. A company, a person or a tag is never a colour of its own.
- Buttons in one row share one height; buttons or chips in one column share one width. Labels are two words and never wrap.
- One primary button and one orange moment per screen region.
- Rows inside a card are hairline-separated, never cards.
- The sidebar and the hero are the only navy surfaces; the hero is the one gradient; gold appears only as a mark (greeting card ring, current-step ring, sidebar rail). Everything else is `surface` and `surface-raised` with a `line` frame.
- No gradients, no coloured left borders, no blur, no pills except toggles and progress rings.

## Deprecated, delete on 2026-11-30

- `CATEGORICAL_TONES` and `toneForKey` in `IconChip.tsx` (always neutral now). Client companies get colour from the eight-hue client set instead (TOKENS.md, v1.2); that set needs a home in `design-tokens.json` and one helper keyed by engagement, not by name.
- The nine categorical tone names on `IconChipTone` and `InternChipTone`.
- `.gold-sheen`, `.shadow-layered-lg`, `.text-gold`, `.ring-gold` utilities in `globals.css`.
- `--font-serif` and the `.serif` class (same face as `--font-sans`; move callers to the type styles).
- `SURFACE_GRADIENTS` in `src/lib/shell/shell-appearance.ts` (empty list).
- `src/components/admin/AccentKpi.tsx`, `src/components/intern/LeadMetricCard.tsx` once `StatCard` exists.

## Building a new dashboard

1. Start from `src/views/intern/Today.tsx`: copy the skeleton, keep the grid.
2. Put the four headline numbers in `DashHero` stats. Do not add a KPI band under it.
3. One `DashSection` per question the screen answers, in reading order: what needs me, what is late, what is coming, who is waiting.
4. Status in chips, amounts in `figure` styles, identifiers in `mono`.
5. Run `node scripts/design-tokens-check.mjs` and look at the screen in both themes before calling it done.
