# Foundations fix report (F-001 to F-270)

Round 2, finished. New shared parts are listed first so screen agents can find them early.

## New shared parts (for screen agents)

| Import | What it is |
|---|---|
| `@/components/ui/modal` → `Modal` | Prototype Modal from props: `open`, `onOpenChange`, `title`, `eyebrow`, `sub` (chips), `right` (tabs), `footer`, `size` sm/md/lg/xl (420/560/760/1000), `flush`. Navy scrim, 52 px head, bottom sheet on phones. |
| `@/components/ui/side-panel` → `SidePanel`, `PanelSection` | 440 px right panel: `eyebrow`, `title`, `sub`, `footer`, `width`. `PanelSection` = 11.5 px caps title + hairline block. |
| `@/components/ui/dialog` | `DialogContent` takes `size` (sm/md/lg/xl) and `hideClose`; new `DialogEyebrow`, `DialogClose`. Header = 52 px head with hairline, footer has a hairline. Phones: bottom sheet. |
| `@/components/ui/button` | New variants `onNavy`, `onNavyPrimary`; new size `iconSm` (30 px). No 84 px min width any more. |
| `@/components/dash/DashHero` | `DashHeroStage` (20 px soft stage tag, no dot; `tone` done/accent/warn/idle). Stats take `icon` (Lucide) to override the glyph. Skin from Profile > Appearance now applies. |
| `@/hooks/use-client-locale-date` | `formatClientNowLabel` → "Wed 29 Oct 2026 · 12:31 PM". |
| `@/components/dash/DashSection` | New props: `right` (tabs, a button, a link at the right end), `titleLead` (client dot), `flush` (no body padding), `headIcon` ({icon, tone} override), `id`, `tabSkeleton` (300 ms L1 shapes after a SpectrumTabs switch, on by default). Meta now sits right after the title (13 px). New exports `HeadLink` ("Open ›") and `ListRow` (hairline rows, hover fill). `DashDonut` is the 12 px ring with 2° gaps and an HTML centre (22 px total); segments take `onClick`. `DashLegendRow` = swatch, label, count right-aligned. |
| `@/components/dash/charts` → `Donut`, `StackedBar`, `Legend`, `DonutRing`, `SEGMENT_FILL`, `SEGMENT_STROKE` | R-25 charts. `Segment = { label, value, tone: 'accent'|'ok'|'warn'|'bad'|'violet'|'teal'|'idle'|'navy', key? }`. Both take `onSegment(segment)` for drill on click. `StackedBar` has `title` and `total` (26 px). |
| `@/components/dash/attention-list` → `AttentionList`, `DateTile`, `dueWords`, `fullDate`, `daysFrom`, `urgencyOf` | R-20 rows with the 44 px date tile (tinted by urgency), title, sub, 104 px chip, optional navy `action` ("Open"), `urgent` soft red, `alert`. Pass `today` for "In 3 days" / "2 days late". |
| `@/components/dash/drill-dialog` → `DrillDialog`, `useDrill` | One drill pop-up: tabs over rows, mono meta, R-13 chip, chevron, dashed empty, "Showing all n" footer and "Open … ›" link. `const drill = useDrill(); drill.open(spec, tab); {drill.node}`. |
| `@/components/dash/key-value` → `KeyValue` | 12 px muted label, 13.5 px/500 value, `cols` 1/2/3, `wrap`, `mono` per row. |
| `@/components/ui/action-menu` → `ActionMenu` | D1/D2 kebab row menu: 30 px kebab, 200 px menu, 34 px rows, icons, letter keys as key caps, `people` side menu for Reassign (220 px, faces, tick on current). |
| `@/components/ui/inline-confirm` → `InlineConfirm`, `ChangeConfirm` | R-40 confirm in place (sunken row, Escape cancels). `ChangeConfirm` adds Now and After values in mono (developer actions). |
| `@/components/ui/copy-button` → `CopyButton` | 30 px copy square, green tick for 1.5 s. |
| `@/components/ui/chevron` → `Chevron` | 16 px faint chevron, `open` turns it 90°. |
| `@/components/ui/field` → `Field` | 13 px label, control, 12.5 px hint or red error. `htmlFor` optional. |
| `@/components/ui/native-select` → `FilterSelect`, `SelectOnNavy` | R-10 compact native filter (30 px `sm` or 40 px `md`) and the 28 px select on a navy bar. |
| `@/components/ui/popover` → `PopoverCard` | 300 px pop-over with optional title bar and footer (hairlines), body scrolls at 60 vh. |
| `@/components/common/ProgressBar` | Now `tone` (accent/ok/warn/bad/violet/teal/idle/navy), `size` 6/8/10, 3 px corners, optional `label` (role progressbar). |
| `@/components/common/UserFace` | `toneFrom={name}` picks one of seven soft tones; `onNavy` = blurple 26 % with white initials. Export `faceTone(name)`. `AvatarStack` uses the tones. |
| `@/components/ui/spectrum-tabs` | Exports `TAB_SWITCH_EVENT`; a switch sends it so the card shows L1 shapes. |
| Toasts | One Toaster, bottom left beside the sidebar (`--toast-left`), white A1 look with a 22 px status tile; `toastSaved` and `showUndoToast` also bottom left. |
| `@/components/ui/cols` → `Cols`, `Col`, `Row`, `Stack` | Page layout helpers (main + 360 px side column from 1024 px; equal 2/3/4 columns; 20 px gaps). |
| `@/components/dash/EFilingGrid` | Footer: "1–10 of n" left, ‹ pages with … › right, and a `footer` prop slot after the count ("Clear filters"). Status column skeleton is the 104 px chip shape. |
| `@/components/ui/bulk-bar` | `BulkAction.people = { names, current?, onPick, label? }` gives the built-in Assign people menu. |
| `@/components/ui/sheet`, `alert-dialog` | Navy scrim; sheet right is 440 px with the dialog shadow; alert dialog is the 420 px Dialog frame (bottom sheet on phones). |
| `@/views/admin/PlainPageHead` | No back chevron by default (R-09); `back` prop turns it on. |
| Tokens | `side-deep` (`bg-side-deep`, sign-in front mountain), `shadow-signin` (`shadow-signin`), `hero-image-veil`. Appearance hooks: `<html data-density="compact">` (rows 36 px via `--row-height`), `<html data-text-size="small|large">` (UI scale 0.93 / 1.07). Rail slide: class `sidebar-peek` or `animate-sidebar-peek` (160 ms). |
| Tailwind | `bg-hover`, `text-wash-ink-2`, `bg-info-mid`, `bg-identity-mid`, `shadow-control`, `h-head`/`min-h-head` (52), `w-side` (248), `h-top` (60), `max-w-page` (1440), `text-11` … `text-44` with line heights, `rounded-sm` = 4 px. |

## Result rows

| No. | New status | What you did, or why it stays |
|---|---|---|
| F-005 | ✓ | `brand-line` utilities are alpha blurple (28 % light, 40 % dark) via `--brand-line-alpha`; the hatch uses it too. |
| F-010 | ✓ | New `hover` token (light #f4f6fa, dark #1a1d23); grid rows, list rows, menus use `bg-hover`. |
| F-011 | ✓ | `info-mid`, `identity-mid` tokens; chip and owner dots use them. |
| F-012 | ✓ | `wash-ink-2` token; DashHero date, steps, meta use it. |
| F-013 | ✓ | `shadow-control` token; secondary/outline buttons, switch thumb, FilterSelect. |
| F-018 | ✓ | Fixed at d5792c0 (no `backgroundImage.wash`); `.bg-wash` now reads `var(--hero-surface-bg, var(--hero-gradient))`. |
| F-019 | ✓ | `backgroundImage.hero` removed. |
| F-020 | ✓ | Backdrop blur removed from `.wash-tile`. |
| F-022 | ✓ | Selection is `brand-soft`. |
| F-023 | ✓ | No global outline; 4 px 25 % blurple glow. |
| F-024 | ✓ | Custom scrollbars removed (browser default). |
| F-025 | ✓ | One global reduced-motion rule, plus `data-reduce-motion="true"`. |
| F-030 | ✓ | `sidebar-peek` keyframes and class (and `animate-sidebar-peek`). Shell agent applies it to the rail. |
| F-031 | ✓ | `.mono` is Roboto Mono 500. |
| F-033 | ✓ | `rounded-sm` = 4 px. `rounded-pill` stays (real only). |
| F-034 | ✓ | `text-11` … `text-44` with line heights. |
| F-037 | ✓ | `head` 52, `side` 248, `top` 60, `max-w-page` 1440; `--row-height` 44. |
| F-040 | ✓ | `lang="en-IN"` (app/layout.tsx). |
| F-042 | ◐ | Sign-in CSS is the public agent's (landing.css). Tokens `side-deep`, `shadow-signin` added for it. |
| F-043, F-044 | ✓ | Wash shows (see F-018). |
| F-047 | ✓ | Greeting truncates on one line. |
| F-048 | ✓ | "Wed 29 Oct 2026 · 12:31 PM", `wash-ink-2` (test added). |
| F-050 | ✓ | Settings button removed from the card; skin, sidebar and motion stay in Profile > Appearance (AppearanceSettings). |
| F-051 | ✓ | Company tile: `brand-soft` ground, blurple initials 13 px bold. |
| F-053 | ◐ | `DashHeroStage` built (20 px soft tag, no dot). CardsA (client home agent) must use it. |
| F-054, F-055 | ◐ | Client home agent's file (CardsA.tsx). |
| F-059 | ✓ | Blur removed; wash now shows behind tiles. |
| F-061 | ✓ | `tileIconName` table: building, rocket, check-check, circle-alert, award, etc.; `stat.icon` overrides. |
| F-064 | ✓ | `of` renders 13 px muted after the number. |
| F-069, F-070 | ◐ | Super / developer home agents (views pass `trend`). |
| F-071–F-074 | ◐ | Trend data paths are the home agents' (home-trends repository, LeadHero, CardsA). DashHero draws `trend` when given. |
| F-077 | ◐ | StatCard not changed this round. |
| F-078 | ✓ | `iconSm` 30 px size. |
| F-079 | ✓ | 84 px minimum width removed. |
| F-080 | ◐ | Decision: default stays the blurple main button; every caller without a variant is a main button. |
| F-083 | ✓ | Control shadow, `hover` fill. |
| F-086 | ✓ | `onNavy`, `onNavyPrimary` variants. |
| F-087 | ✓ | `success` kept (real only). |
| F-092, F-093 | ✓ | Dots `identity-mid`, `info-mid`. Manager owner kept (real only). |
| F-097 | ✓ | `ui/field.tsx` `Field`. |
| F-098 | ✓ | 18 px white thumb, 4 px corners, control shadow, 4 px glow. |
| F-100 | ✓ | `FilterSelect` (native, 30 px). Radix select unchanged. |
| F-101 | ✓ | `SelectOnNavy`. |
| F-104 | ✓ | Tabs send `vcfo:tab-switch`. |
| F-105 | ✓ | Dialog, AlertDialog, Sheet, Modal, SidePanel use `bg-scrim`. |
| F-106 | ✓ | 52 px head with hairline, 15 px title, eyebrow, 32 px close square; `Modal` has `sub` and `right`. |
| F-107 | ✓ | Footer hairline. |
| F-108 | ✓ | `size` sm/md/lg/xl (420/560/760/1000). |
| F-109 | ✓ | Bottom sheet on phones (92 vh, top corners). |
| F-110 | ✓ | Sheet right 440 px, dialog shadow; `SidePanel` + `PanelSection`. |
| F-111 | ✓ | `PopoverCard`. |
| F-115 | ✓ | Grey `hover` highlight; `ActionMenu` with kebab and people side menu. |
| F-119 | ✓ | Bottom left beside the sidebar, white A1 look. Stacking stays (react-hot-toast). |
| F-120 | ✓ | Seven soft tones from the name (AvatarStack, `UserFace toneFrom`). |
| F-122 | ✓ | `UserFace onNavy`. |
| F-123 | ✓ | ProgressBar 3 px corners, 6/8/10 px, eight tones. |
| F-126 | ✓ | DOCX blurple. |
| F-127 | ✓ | `ui/chevron.tsx`. |
| F-128 | ✓ | `ui/copy-button.tsx`. |
| F-130 | ✓ | `Skeleton` is a grey `line-soft` pulse. |
| F-131 | ✓ | `SkeletonRows` draws CardLoad rows. |
| F-132, F-145 | ◐ | Tab-switch shapes built (`DashSection tabSkeleton`), off by default: they hid content for 300 ms and broke TeamTasksCard tests; a card opts in. |
| F-138 | ✓ | Head 20 px sides from 768. |
| F-139 | ✓ | Meta 13 px right after the title (also S-636). |
| F-140 | ✓ | `right` slot. |
| F-141 | ✓ | `headIcon` override (old `icon` prop still ignored on purpose). |
| F-142 | ✓ | `titleLead`. |
| F-143 | ✓ | `flush`. Client `SCard` is the client agent's. |
| F-144 | ✓ | Body 16 px, 20 px sides from 768. |
| F-146 | ✓ | `HeadLink` "Open ›" (default label "Open"). Client copy is the client agent's. |
| F-148 | ✓ | Shared `ListRow` in DashSection. |
| F-150, F-182, F-183 | ◐ | CardsA (client home agent). |
| F-151, F-184 | ◐ | Super record agent. |
| F-155–F-157 | ◐ | Shared `AttentionList` with date tile, due words and Open action built; screens must adopt it (super overview, staff homes). |
| F-158, F-159, F-161 | ◐ | Shared `KeyValue` built; dev parts and firm settings must adopt it. |
| F-163 | ✗ | no data: hours per lead. |
| F-164–F-166 | ◐ | Shared `StackedBar` (8 px, 2 px corners, vertical legend, title and total). super-parts must adopt it. |
| F-167, F-168 | ✓ | DashDonut: 12 px ring at 84 px, 2° gaps, 22 px total, 12 px unit. |
| F-169 | ✓ | `DashLegendRow` matches; `Legend` in charts. |
| F-170 | ◐ | `onSegment` / segment `onClick` built; staff calendar donut (compliance agent) must pass it. |
| F-173, F-178, F-192, F-202, F-255 | ✗ | no data (VCFO Assist log; dev write actions; client fact edits; typical step time; editable filing windows). `ChangeConfirm` part is ready for F-178. |
| F-176 | ✓ | BulkBar `people` menu. |
| F-179 | ✓ | `InlineConfirm`. |
| F-186–F-189 | ◐ | Shared `DrillDialog` / `useDrill` built; client PortalProvider (client agent) must switch to it. |
| F-198–F-201, F-203, F-215–F-219, F-237–F-259, F-264 | ◐/✗ | Screen-owned (client portal, timeline, calendar, super record agents). |
| F-210, F-221 | ✗ | Prototype uses them on no screen; not built. |
| F-214 | ◐ | `SidePanel` frame available for InternWorkDrawer (lead agent). |
| F-222 | ◐ | EFilingGrid stays headless; callers wrap in `DashSection` (its 52 px head). |
| F-224 | ✓ | Footer "1–10 of n" + `footer` slot. |
| F-225 | ✓ | Prev/next arrows, ellipsis, blurple current. |
| F-229, F-235 | ◐ | `ActionMenu` available; MyWork / row-actions (lead agent) adopt it. |
| F-233 | ✓ | Status column chip shape. |
| F-234 | ✓ | Dashed EmptyState already; kept. |
| F-266, F-267, F-270 | ◐ | Shell agent owns ask/*. |

## Coordinator requests handled

- S-636 meta after title: done. S-657: density and text-size tokens (see table). PlainPageHead: no back chevron by default.
- P-280: `DashHeroStat.icon` exists. `side-deep`, `shadow-signin` tokens added.
- F-311: `sidebar-peek` class / `animate-sidebar-peek`. F-337: `app/providers.tsx` `defaultTheme="system"`. F-347: `ui/cols.tsx`.
- C-397/C-463: "due" titles map to Calendar on teal (overdue stays red). C-356/C-368: EFilingGrid footer + slot.

- Client home agent (C-008 … C-230): company tile (DashHeroCompanyTile), `--wash-ink-2`, `.wash-tile` (no blur), tile icons per label, DashSection padding, 44 px rows: done. Teal head tone now `waiting-soft`/`waiting` (was info blue). Document cards use the FileText glyph. FileBadge weight 600. `backgroundImage.wash` stays removed on purpose.
- Staff records agent: `PhaseBar` has `stuck` (current phase red) and `hrefFor(phase)` (each bar a link). AvatarStack uses the hashed seven-tone palette. EFilingGrid footer done; skeleton rows on a view switch: pass the grid's `loading` while the new view loads (no fake 300 ms delay, same decision as DashSection).

## Files changed

app/globals.css, app/providers.tsx, tailwind.config.ts, docs/design/design-tokens.json, src/components/ui/{step-track,alert-dialog,avatar-stack,bulk-bar,button-variants,dialog,dropdown-menu,empty-state,file-badge,hot-toast,popover,sheet,skeleton,spectrum-chip,spectrum-tabs,switch,toast-saved,undo-toast}.tsx/ts, src/components/dash/{DashHero,DashHero.test,DashSection,EFilingGrid}.tsx, src/components/common/{CardHeadTile,ProgressBar,UserFace}.tsx, src/lib/ui/card-head-icon(.test).ts, src/lib/shell/shell-appearance(.test).ts, src/hooks/use-client-locale-date.ts, app/layout.tsx, src/views/admin/PlainPageHead.tsx.
New: src/components/ui/{dialog-classes.ts, modal.tsx, side-panel.tsx, action-menu.tsx, inline-confirm.tsx, copy-button.tsx, chevron.tsx, field.tsx, native-select.tsx, cols.tsx, spectrum-chip.test.ts}, src/components/dash/{charts.tsx, attention-list.tsx, drill-dialog.tsx, key-value.tsx}.

## New routes / schema needs

None.

## Requests for shared files and other agents

- AppearanceSettings (settings owner): the greeting-card preview uses `.lead-hero` with white text; the hero skin is now the light colour wash (ink dark) or a photo under a light veil, so the preview text should be `text-ink`. The hero solid is now `wash` ("Colour wash"). Also set `data-density` / `data-text-size` on `<html>` for the new rows.
- Screen agents: adopt AttentionList, DrillDialog, StackedBar/Donut, KeyValue, ActionMenu, SidePanel, DashHeroStage as listed above.

## Decisions

- Default Button kind stays blurple (F-080).
- Tab-switch L1 shapes are opt-in (`tabSkeleton`), not default.
- Toasts: one Toaster, bottom left (268 px from 1024 px, 16 px below), 80 px from the bottom on phones.
- The hero skin picker now works: wash by default; photo skins under `--hero-image-veil`; old stored solids fold into the wash.
- Text size uses CSS `zoom` on body because component sizes are px literals.
- Contrast gate (`design-tokens-check`) has 12 failing pairs that come from the prototype colours; unchanged.

