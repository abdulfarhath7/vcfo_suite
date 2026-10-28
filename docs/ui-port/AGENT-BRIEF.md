# Brief for screen agents (UI port to VCFO Spectrum)

Read this whole file first. It is the shared part of every screen agent's task.

## Goal

VCFO Suite (`/home/farhath/Documents/vcfo-suite`, branch `ui/spectrum`) is the real app. Make your
screens look like the prototype's VCFO Spectrum screens, keep every real feature, data source,
API call, permission check and action, and build prototype-only features when the backend
already supports them. Never fake data to match a screen. Never remove working functionality.

## Sources (read only)

- Prototype: `/home/farhath/Documents/vcfo-prototype-ref` (branch `design/spectrum`). Never edit it.
  - `docs/RULES.md` is the design authority (rules R-01 to R-48).
  - `docs/REAL-TOOL-MAP.md` maps each prototype screen to the real file.
  - `src/screens/<portal>/*`, `src/components/cards/*`, `src/components/ui/*` are the screens and parts.
  - `src/data/*` is FAKE sample data. Never copy it into the real tool.
- Real tool context: `CLAUDE.md`, `docs/context/STATE.md`, `docs/ui-port/AUDIT.md`, `docs/ui-port/DECISIONS.md`.

## Already done (do not redo)

The foundation is ported: tokens (light and dark), Roboto fonts, the staff and client shell
(sidebar, top bar, ribbon, Ask VCFO button), buttons, chips, inputs, tabs, overlays, tables
(`EFilingGrid` now draws clean T1 rows), `DashHero` (the home card on the colour wash with
floating number tiles) and `DashSection` (52px head with the icon tile from the title).

Shared Spectrum parts you should use (do not fork them):
- `@/components/ui/spectrum-chip`: `Chip` (status, auto tone from the word, six words), `OwnerChip`, `AreaPill`, `Tag`, `toneFor`, `statusWord`, `regOf`.
- `@/components/ui/step-track`: `StepMark` (ST5 done/now/next square), `PhaseBar` (four bars sized by step count).
- `@/components/ui/spectrum-tabs`: `SpectrumTabs` (segmented filter switch, or `variant="underline"` record tabs).
- `@/components/ui/file-badge`: `FileBadge`, `fileType`.
- `@/components/ui/empty-state`: `EmptyState` (dashed area with the action), `SkeletonRows`.
- `@/components/ui/button` (`variant`: default = blurple main, `strong` = navy, `secondary`/`outline`, `ghost`, `quiet`, `soft`, `destructive`, `link`).
- `@/components/dash/DashHero`, `DashSection`, `EFilingGrid`, `StatCard`; `@/components/common/CardHeadTile`.

## Class names: prototype to real tool

The prototype's Tailwind names differ. Translate them like this:

| Prototype | Real tool |
|---|---|
| `bg-canvas` | `bg-surface` |
| `bg-surface` | `bg-surface-raised` |
| `bg-raised`, `bg-hover` | `bg-surface-sunken` |
| `border-line`, `border-line-soft` | same |
| `border-line-2` | `border-line-strong` |
| `text-ink`, `text-ink-2` | same |
| `text-muted` | `text-ink-muted` |
| `text-faint` | `text-ink-faint` |
| `bg-primary`, `hover:bg-primary-hover`, `text-primary-on` | `bg-brand`, `hover:bg-brand-strong`, `text-on-brand` |
| `text-accent`, `bg-accent-soft`, `accent-line`, `accent-mid` | `text-brand-text`, `bg-brand-soft`, `brand-line`, `brand` |
| `ok`, `ok-soft`, `ok-mid` | `positive`, `positive-soft`, `positive-mid` |
| `warn*` | `warning*` |
| `bad*` | `danger*` (danger button fill: `bg-danger-fill`) |
| `teal*` | `waiting*` |
| `idle*` | `upcoming*` (`upcoming-mid` for dots and bars) |
| `violet*` | `identity*` |
| `info*`, `caution*`, `reg-*` | same |
| `bg-navy` (sidebar navy, never flips) | `bg-side` (`bg-navy` in the real tool is the strong colour that flips in dark mode) |
| `brand` (orange, logo and today line only) | `highlight-bright` |
| `bg-wash`, `shadow-tile`, `shadow-float`, `shadow-dialog`, `shadow-shine`, `rounded-bar`, `rounded-mark`, `border-1.5` | same |
| `text-12`, `text-13`, `text-14`, ... | `text-[12px]`, `text-[13px]`, `text-[14px]`, ... |

Never write hex or rgb colour values in components. Use the tokens above.

## Hard rules

1. Do not run any git command that changes state (no commit, add, stash, checkout, reset, restore). The hub commits your work.
2. Edit only the files in your scope (listed in your task). Do not edit `src/components/{ui,dash,common,shell}/*`, `app/globals.css`, `tailwind.config.ts`, `docs/design/*`, `src/components/shell/RoleSidebar.tsx` or `src/components/client-portal/Sidebar.tsx`. If you need a change there (a new nav item, a fix in a shared part), write it in your final report instead.
3. The seam: only `src/db/repositories/*` may import `db`. Every repository function takes an `AuthContext` and scopes by role; use the role helpers in `src/lib/auth.ts`. New API routes follow `docs/context/HOW-TO-BUILD.md`.
4. Do not edit `src/data/checklist.ts`, `src/lib/checklist/*`, `src/lib/compliance/*`, the docx generators, or any migration. Do not run migrations, seeds or SQL. Do not add dependencies.
5. Never delete a feature, route, API, test or permission check. Moving and restyling are fine. If a test fails because markup changed, update the test to the new markup; never delete it.
6. Client portal CSS: edit `src/components/client-portal/css-src/*.css`, then run `node scripts/cp-css.mjs`. Never edit `css/` by hand.
7. Writing on screen (R-05, R-06, R-29, R-38): sentence case, plain dates ("14 Oct"), no helper sentences under buttons, no "Your next action" bars, no mascots, no "please" or "successfully".
8. Comments and docs: plain full sentences, matching the density of the surrounding code.
9. Next.js 16 differs from your training data. Before you write a new route, read the relevant guide in `node_modules/next/dist/docs/`.
10. Do not open a browser. The owner tests later.

## Checks before you finish

- `npx tsc --noEmit -p .` must be clean.
- `npx eslint <the files you changed>` must show no errors.
- `npx vitest run <the test folders near your files>` must pass.

## Final report (your last message)

1. Files changed and created, one line each.
2. Screens restyled, and screens or features built.
3. Gaps: prototype features you did not build because they need backend work. One line each: what is missing and what is needed.
4. Requests for the hub: nav items to add, shared-part fixes, anything outside your scope.
5. Decisions you made alone.
