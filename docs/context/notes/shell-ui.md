# App shell, sidebar, motion and copy

Gotchas already paid for once. Append when something costs more than a minute to figure out.

## Shell sidebar skin vs `fixed`

- `.shell-sidebar-skin` must **not** set `position`. Unlayered `globals.css`
  overrides Tailwind `fixed` on the desktop `aside` (and the mobile sheet),
  so the rail re-enters flow: icons in a horizontal row at the top-left and
  the page drops below a full-height gap. `::before` overlay still works —
  `fixed`/`relative` on the host is already a containing block. Settings
  preview keeps Tailwind `relative` on the sample tile.
- Do **not** add an opaque `::after` floor of `oklch(var(--panel))`. Negative
  z-index still paints *above* the host `background`, hiding
  `--sidebar-surface-bg` so appearance skins (and photos) look stuck on
  Glass/white. Skin stays on the host. Glass is opaque `oklch(var(--panel))`
  (follows light/dark) — not `panel / 0.88` and not a viewport-sized blur.

## Unified sidebar disclosure row

- Clients, Docs, Updates (and any `SidebarNavGroup`) share `SidebarNavDisclosure`
  in `SidebarNavGroup.tsx`. Intern Clients is not a second trigger style.
- Chevron is Lucide `ChevronDown` (stroke, `fill-none`) in
  `.sidebar-nav-disclosure-meta` (`margin-left: auto`). Count badge sits
  immediately before the chevron; My work uses the same badge chip without a
  chevron. Active pill/rail only when that section’s route is current — open
  but inactive groups do not get a rectangular box. Child indent is
  `SidebarNavGroupRail`. Do not set `position` on `.shell-sidebar-skin`.

## Shell location trail + attached search

- Top bar trail is a full path from `shellBreadcrumb` (`shell-crumbs.ts`):
  **Home › …** then every real nested segment. Intern engagement step example:
  `Home › Clients › DemoCo › SPICe+ Part B › Director KYC`. Phase labels come
  from `internOverviewPhaseForItem` / intern overview titles (`SPICe+ Part A/B`,
  Post-incorporation, Registration) — Director KYC is Part B in the catalog.
  Intern Registration also inserts the rail sub-header (General, FEMA, …).
- Home links to the role home (`/app/intern/today`, staff dashboard, client
  Inbox). Every non-leaf crumb is a `Link`. Phase → first catalog step of that
  part (`…/step/{slug}`); company → engagement/project page; Docs → Vault;
  Updates → Announcements. The leaf is `aria-current` (not a link). Separator
  is `›` (ChevronRight), never ASCII `->`.
- Page H1 stays the leaf. `PageBackButton` sits beside the H1 on every AppShell
  page except the true home (Today / dashboards / client Inbox).
- Search sits to the right of crumbs and shrinks (`max-w-xs`) so long trails
  can grow; crumbs scroll horizontally inside the fixed-height top bar rather
  than middle-ellipsis. Cmd/Ctrl+K still focuses the TopBar input. Do not mount
  a second `CommandPalette` in AppShell.

## Shell titles vs crumbs

- Top-bar crumbs are the location. `PageHeader` drops the giant H1 / icon
  lockup when `pageTitleRepeatsTrail(title, pathname)` (case-insensitive).
  Keep a visually hidden H1 so the page still has a heading. Unique extras
  (counts, actions, compose footer, Outlook eyebrow) stay in a slim toolbar.
- Card/section titles that add information stay visible — intern calendar
  H1 is **Statutory calendar** + FY, not “Compliance calendar”. Back sits
  beside that section title (`PageBackCluster`), not in a second billboard.
  Filing tracker on `/compliance/tracker` is the same pattern.
- Do not gut in-card form headings (Profile, Security). Do not set
  `position` on `.shell-sidebar-skin`.

## Intern / lead motion

- Sidebar active item uses Framer `layoutId` (`sidebar-*-active` / `-rail`) with `springSnappy`.
  Client **sub-rows** use a nested pair (`*-client-active` / `*-client-rail`) so the pill slides
  between companies and View all without stealing the parent Clients highlight.
- Lead dashboard motion lives in intern-only surfaces (Today, My work, Clients, InternClientsNav,
  InternPhaseTabs, intern journey rail via `allowLockedOpen`). Shared
  Analytics / Compliance / Mail / Audit keep their existing PageTransition only.
- Reuse `src/lib/motion.ts` presets and `MotionActivePill`. Always respect `useReducedMotion`.
  Prefer `m` (LazyMotion) over `motion`.
- `LazyMotion` in `app/providers.tsx` must use `domMax`, not `domAnimation`.
  `m` + `layoutId` is a silent no-op without the layout feature — the sidebar pill
  never slides. `domAnimation` covers fade / stagger / hover / tap only.
  Keep `strict` so `m` does not search for features on every component.
  Do **not** import `_feature-registry` / `ui/_registry` from `providers.tsx` —
  that pulls the entire component catalog into the root client bundle and
  freezes the main thread.
- AppContext value identity must stay stable across the 4s live poll. Empty
  `internOptions` is a module-level constant (never `?? []` in render). Copy
  TanStack lists into reducer state only when item refs actually change.
- Never put CSS `transform` / `transition-transform` / `active:scale` / Framer
  `whileTap` scale on a node that hosts or wraps a `layoutId` pill. Projection
  uses transform; a competing transform kills the shared-element spring. Press
  feedback on those hosts: color / opacity only. Nested client-row stagger must
  stay opacity-only for the same reason (`y` on the row ancestor isolates pills).
- Hover-peek state is **local to `RoleSidebar`**, never `ShellNavContext` (that
  re-rendered the whole workspace). Item hover glass is local to `SidebarNavBody`
  (`useSidebarHoverFollow` + `data-sidebar-hover`); skip `setState` when the
  hovered id has not changed. Do not remount Popover vs accordion on peek —
  keep both trees with `hidden`. No full-height `backdrop-filter` on the
  width-animating rail; hover glass is tint/ring only. `will-change: width`
  only for the peek transition, then drop it. Keep `useInternPortfolio` in
  `InternMyWorkBadge` (memo) so hover does not rebuild the intern queue.

## App copy — no instructional chrome

- Do not add helper lines that restate a control (e.g. Sign out: “End this
  session on this device”). PageHeader `subtitle` is for live counts/dates/
  company names, not a second sentence of the H1. Empty states: title only,
  or one short line. Keep `aria-label` / `sr-only`. Do not set `position` on
  `.shell-sidebar-skin`.

## SBC lockups (login / marketing)

- Canonical files: `public/sbc-logo-light.png` (black mark, light UI) and
  `public/sbc-logo-dark.png` (white mark, dark UI). Source exports were JPEG
  with an opaque black artboard — near-black was knocked to alpha so they
  don't sit as a black rectangle on a white page. `html.dark` swaps via
  `dark:hidden` / `hidden dark:block` (`variant="lockup"`). Always-dark blue
  auth heroes pass `surface="dark"`.
- `[data-role="admin"]` pins a light `--background` that beats `html.dark`.
  Login + marketing wrappers add `public-lockup-theme` so dark mode actually
  darkens those surfaces (otherwise the white lockup lands on a pale panel).
- Do not change `variant="navbar"` / TopBar / RoleSidebar from this work —
  shell owns those. Left `public/sbc-logo.png` to the shell agent.
