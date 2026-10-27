# VCFO Suite design tokens, version 1

Date: 21 October 2026. Source of truth: `docs/design/design-tokens.json` (same shape as the Interico token file). This page explains the values; the JSON carries them. `app/globals.css` will be generated from the JSON, so edit the JSON, not the CSS.

VCFO Suite is a compliance and incorporation product. The screens are dense, the numbers matter, and the people reading them are checking whether something is late. The system is therefore quiet: cool neutrals, navy ink, one action blue, one orange highlight that means "this needs you", four status colours that always come with a word, and six chart hues that never leave the charts.

## Decisions

- **Action blue is `#1b4f94`**, the prototype's link blue, not the app's current `#2563EB`. It holds 8.1:1 on white, so the same token is a button fill, a link and 12px text. `#2563EB` is Tailwind's blue-600 and the default of every generated interface; it also sits at 4.9:1, thin for small text. Hover goes darker, to `#163f78`. In dark mode the brand lightens to `#6aa2e8` and text on it is navy, not white.
- **Navy sidebar in light mode.** `side` is the ink navy. It is the one heavy element on the screen, it matches the logo-on-black lockup the portal already uses, and it ends the per-role tinting. In dark mode the sidebar matches the surface and a hairline separates it.
- **Orange is one token family, not a scale.** `highlight` (`#a8520f`) is text-safe and is the only orange that touches words. `highlight-bright` (`#e07a1f`) is for marks with no small text. `highlight-soft` is a chip ground. One orange moment per screen region.
- **Warning is amber, not orange.** The old `--warning` sat at hue 35, which is the accent's hue. Warning moves to hue 73 and is darker, so a due-soon chip and a needs-you highlight never look alike. Both always carry a word.
- **Info is teal** so a note never looks like a button.
- **The orange token is called `highlight`, not `accent`.** shadcn's components own `accent` and `accent-foreground` in this codebase (the hover wash on menus and rows, 70 call sites), so the Interico name would have turned every hover orange. `--accent` stays the shadcn wash, aliased to `brand-soft`.
- **Chart palette** is the dataviz skill's validated set in the order blue, orange, aqua, yellow, violet, green. It passes the colour-vision checks in both themes on our surfaces (worst adjacent pair 9.1 light / 8.4 dark, normal-vision floor 22.9 / 19.8). Aqua and yellow sit below 3:1 on white, so light-mode charts using them need direct labels or a table view.
- **Public Sans for everything, weights 400, 500, 600.** IBM Plex Mono for identifiers. No 700 or 800; weight is replaced by size and colour.
- **Radius scale 6 / 8 / 10 / 12.** Chips and avatars are rounded rectangles. Pills survive only as toggle knobs and progress rings.
- **Borders before shadows.** Every card has a `line` hairline; `shadow-card` only lifts. No gradients, no coloured left borders, no cards inside cards, no blur.

## Colour tokens

Light and dark are two values of one name; nothing has a separate dark token. `{ink}` means the token aliases `ink`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `surface` | `#f7f9fc` | `#0b1521` | Page canvas. Never pure white or black. |
| `surface-raised` | `#ffffff` | `#111d2c` | Cards, tables, dialogs, popovers, top bar. |
| `surface-sunken` | `#eef2f7` | `#070e18` | Wells: table heads, inputs on cards, empty states, skeletons. |
| `line` | `#e1e7ef` | `#1f2d40` | Hairline rows and card frames. |
| `line-strong` | `#7a8ca2` | `#56698a` | Input, checkbox and secondary-button borders (3:1). |
| `rule` | `{ink}` | `{ink}` | 2px rule under page heads and table heads, above totals. |
| `ink` | `#0f2a4a` | `#e9eff6` | Primary text and figures. |
| `ink-muted` | `#4b5b70` | `#a5b4c6` | Secondary text, meta, helper text. |
| `ink-faint` | `#7b8a9e` | `#6f8097` | Placeholders, disabled, locked steps, "Other". Never body text. |
| `brand` | `#1b4f94` | `#6aa2e8` | The one action colour. |
| `brand-strong` | `#163f78` | `#86b6ef` | Hover and pressed brand. |
| `brand-soft` | `#e8f0fa` | `#17304d` | Selected rows, current step, active nav ground. |
| `on-brand` | `#ffffff` | `#0b1521` | Text on a brand fill. |
| `highlight` | `#a8520f` | `#f2a35b` | Text-safe orange highlight. Never a button. |
| `highlight-bright` | `#e07a1f` | `#f08a3a` | Orange marks with no small text. |
| `highlight-soft` | `#fdf0e3` | `#3a2412` | Small orange chip grounds only. |
| `positive` / `positive-soft` | `#0f6e51` / `#e1f3ec` | `#4fc99a` / `#0f3328` | Done, filed, paid. With a word. |
| `warning` / `warning-soft` | `#8a5a06` / `#fbf0d9` | `#f0b84a` / `#3b2a0a` | Due soon, waiting, needs review. With a word. |
| `danger` / `danger-soft` | `#b5302a` / `#fbe7e5` | `#f27b72` / `#3d1512` | Overdue, failed, destructive. With a word. |
| `info` / `info-soft` | `#0f6e8c` / `#e2f1f6` | `#5cc0dc` / `#0d2e3a` | Notes and internal-only bands. |
| `focus-ring` | `#3b82f6` | `#86b6ef` | 2px outline, 2px offset, 3:1 on every surface including `side`. |
| `scrim` | `rgba(15,42,74,.55)` | `rgba(0,0,0,.65)` | Behind dialogs and sheets. |
| `side` | `#0f2a4a` | `#0b1521` | Sidebar ground. |
| `side-ink` | `#e9eff6` | `#e9eff6` | Sidebar labels and icons. |
| `side-muted` | `#9fb0c6` | `#8d9db3` | Sidebar group titles. |
| `side-active` | `#1d3d64` | `#17304d` | Active sidebar item ground. |
| `side-line` | `#23405f` | `#1f2d40` | Sidebar hairlines. |
| `data-1` to `data-6` | `#2a78d6` `#eb6834` `#1baf7a` `#eda100` `#6250d6` `#008300` | `#3987e5` `#d95926` `#199e70` `#c98500` `#9085e9` `#008300` | Charts and the statutory calendar only. Fixed order, never cycled. |

## Contrast

Measured with WCAG 2.1 relative luminance. Text tokens need 4.5:1; UI edges and focus rings need 3:1.

| Text on ground | Min | Light | Dark |
|---|---|---|---|
| ink on surface / raised / sunken | 4.5 | 13.7 / 14.5 / 12.9 | 15.9 / 14.7 / 16.7 |
| ink on every `-soft` ground | 4.5 | 12.2 to 12.9 | 11.6 to 13.8 |
| ink-muted on surface / raised / sunken / brand-soft | 4.5 | 6.6 / 6.9 / 6.2 / 6.0 | 8.7 / 8.1 / 9.2 / 6.4 |
| ink-faint on raised / surface | 3 | 3.5 / 3.3 | 4.2 / 4.6 |
| brand on surface / raised / sunken / brand-soft | 4.5 | 7.7 / 8.1 / 7.2 / 7.1 | 7.0 / 6.4 / 7.3 / 5.1 |
| on-brand on brand / brand-strong | 4.5 | 8.1 / 10.4 | 7.0 / 8.7 |
| highlight on raised / surface / highlight-soft | 4.5 | 5.4 / 5.1 / 4.8 | 8.2 / 8.9 / 7.1 |
| positive on raised / surface / positive-soft | 4.5 | 6.2 / 5.9 / 5.4 | 8.2 / 8.9 / 6.7 |
| warning on raised / surface / warning-soft | 4.5 | 5.9 / 5.6 / 5.2 | 9.4 / 10.2 / 7.7 |
| danger on raised / surface / danger-soft | 4.5 | 6.1 / 5.8 / 5.2 | 6.4 / 6.9 / 6.0 |
| info on raised / surface / info-soft | 4.5 | 5.8 / 5.5 / 5.0 | 8.1 / 8.8 / 6.8 |
| line-strong on surface / raised | 3 | 3.3 / 3.4 | 3.3 / 3.1 |
| focus-ring on surface / raised / sunken / brand-soft / side | 3 | 3.5 / 3.7 / 3.3 / 3.2 / 4.0 | 8.7 / 8.1 / 9.2 / 6.4 / 8.7 |
| side-ink on side / side-active | 4.5 | 12.5 / 9.5 | 15.9 / 11.6 |
| side-muted on side / side-active | 4.5 | 6.6 / 5.0 | 6.7 / 4.9 |
| highlight-bright on raised (mark) | 3 | 3.0 | 6.8 |

Zero failures. `node scripts/design-tokens-check.mjs` reads the JSON and runs every pair above; it exits 1 on a failure.

## Chart palette

Validated with the dataviz skill's `validate_palette.js` against our chart surface (`surface-raised`: `#ffffff` light, `#111d2c` dark).

| Check | Light | Dark |
|---|---|---|
| Lightness band | pass | pass |
| Chroma floor | pass | pass |
| CVD separation, worst adjacent pair | 9.1 (yellow / aqua) | 8.4 (yellow / aqua) |
| Normal-vision floor, worst adjacent pair | 22.9 | 19.8 |
| Contrast vs surface | aqua 2.8 and yellow 2.2 need direct labels or a table view | all six pass 3:1 |
| First three slots, all pairs (scatter, maps) | pass | pass |

Rules: one series takes `data-1` only and needs no legend; two or more get a legend and direct labels on up to four; a series that means good or bad wears the status tokens, never a data slot; text in a chart wears `ink` and `ink-muted`, never the series colour.

## Type

Public Sans for display and body, IBM Plex Mono for identifiers. Figures use tabular numerals; amounts are right-aligned.

| Style | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | 28 / 34 | 600 | -0.015em | One per screen: the greeting, the client's company name. |
| `display` | 22 / 28 | 600 | -0.01em | Page title, above a 2px rule. |
| `title` | 15 / 20 | 600 | 0 | Card, dialog and drawer titles. |
| `heading` | 13 / 18 | 600 | 0 | Group headers inside cards. |
| `body` | 13 / 18 | 400 | 0 | Default UI text, table cells. |
| `body-lg` | 15 / 22 | 400 | 0 | Client portal reading text, phone screens. |
| `body-sm` | 12 / 16 | 400 | 0 | Meta, captions, helper text. |
| `label` | 11 / 16 | 600 | 0.06em, uppercase | Section heads, table heads, stat labels. Written in sentence case. |
| `chip` | 11 / 16 | 600 | 0 | Status and count chips. Sentence case. |
| `figure` | 13 / 18 | 600 | 0 | Amounts in tables. |
| `figure-lg` | 20 / 24 | 600 | -0.01em | Totals, KPI figures. |
| `figure-xl` | 28 / 32 | 600 | -0.015em | The hero stat. |
| `mono` | 12 / 16 | 500 | 0 | CIN, PAN, DIN, GSTIN, file names. |

Money: rupee sign, Indian grouping (`₹9,05,178`), full amounts wherever money is approved or paid, compact (`₹24.6 L`) only on dense overview tiles.

## Spacing, radius, shadow, borders

- **Spacing**, 4px base: `space-1` 4, `space-2` 8, `space-3` 12 (table cells, panel gaps), `space-4` 16 (card padding, mobile gutter), `space-5` 20, `space-6` 24 (section gaps, page margins), `space-8` 32, `space-12` 48.
- **Radius**: `radius-sm` 6 (chips, inputs, thumbnails), `radius-md` 8 (buttons, nav items, icon tiles, avatars), `radius-lg` 10 (cards, dialogs, popovers), `radius-xl` 12 (sheets, hero). `radius-pill` only for toggle knobs and progress rings.
- **Shadow**: `shadow-card` light `0 1px 2px rgba(15,42,74,.06), 0 1px 1px rgba(15,42,74,.04)`, dark `0 1px 2px rgba(0,0,0,.5)`. `shadow-float` light `0 12px 32px -12px rgba(15,42,74,.28)`, dark `0 16px 40px -12px rgba(0,0,0,.7)`. Nothing else.
- **Border width**: `hairline` 1px, `rule-width` 2px, `stat-rule` 3px (top edge of KPI and next-payment cards).
- **States**: hover one step darker (`brand-strong`) or a `surface-sunken` tint; selected rows `brand-soft`; disabled 45% opacity, never a different colour; motion 150ms ease on hover and toggles only.

## Controls and chips

A column of chips or a row of buttons must read as one block, not a zig-zag of widths. Prototype v8 (1) added `min-width: 84px` and centred labels to chips and row buttons; the tokens below make that the rule everywhere.

- **Buttons.** Three heights: `control-sm` 28px (table rows, dense toolbars), `control-md` 32px (default), `control-lg` 40px (form and dialog primaries, every button on a phone). Horizontal padding 10 / 12 / 16px, text 12 / 13 / 14px at weight 600, icon `icon-md` 16px, `radius-md`. Every text button is at least `control-min-width` 84px wide; labels are two words at most and never wrap. Icon-only buttons are square. Variants: primary (`brand` fill, `on-brand` text), secondary (`surface-raised`, `line-strong` border, `ink` text), ghost (no border, `ink-muted` text, `ink` on hover), danger (`danger` fill, white text). One primary per screen region. Buttons in one row share one height; buttons in one table column share one width.
- **Chips.** `chip-height` 22px, padding 0 8px, `radius-sm`, the `chip` type style, icon `icon-sm` 14px. Status chips use the `-soft` ground with the tone's text colour: `positive-soft` / `positive` for done, `warning-soft` / `warning` for waiting, `brand-soft` / `brand` for in progress, `surface-sunken` / `ink-muted` for upcoming. No solid status fills; the word carries the state. Owner chips: SBC is `brand-soft` / `brand`, the client is `highlight-soft` / `highlight`. Count chips are `brand` fill with `on-brand` text. Inside a table column every chip takes `chip-min-width` 88px and centres its label; in running text a chip hugs its content.
- **Rows and tiles.** Table rows are `row-height` 40px with `space-3` cell padding, so a chip sits with 9px above and below. Icon tiles are `tile` 32px, `radius-md`, `surface-sunken` ground, `ink` icon. Sidebar icons are `icon-lg` 20px.

## Deprecated names

Old names stay as aliases of the new tokens until 30 November 2026, then are deleted. Anything still using one after that date fails `scripts/design-tokens-check.mjs`.

| Old (globals.css and Tailwind classes) | New |
|---|---|
| `--background`, `--surface` | `surface` |
| `--card`, `--panel`, `--popover`, `--ink` (the white one), `--sidebar-bg`, `--sidebar-background` | `surface-raised` |
| `--raised`, `--muted`, `--secondary`, `--table-header`, `--accent` (shadcn) | `surface-sunken` |
| `--border`, `--input`, `--hairline`, `--sidebar-border` | `line` |
| `--divider` | `rule` |
| `--foreground`, `--paper`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground` | `ink` |
| `--muted-foreground`, `--muted-paper`, `--text-secondary`, `--sidebar-foreground` | `ink-muted` |
| `--subtle-paper`, `--text-tertiary` | `ink-faint` |
| `--primary`, `--brand`, `--blue-600`, `--blue-brand`, `--blue-500`, `--gold`, `--gold-hi`, `--orange-*`, `--orange-brand`, `--ring`, `--sidebar-ring`, `--sidebar-primary`, `--role-accent`, `--accent-foreground`, `--hex-loader-primary`, `--hex-loader-gold-hi` | `brand` |
| `--primary-dark`, `--brand-deep`, `--gold-deep`, `--blue-700`, `--blue-800`, `--blue-900`, `--sidebar-foreground-active`, `--role-accent-foreground`, `--sidebar-accent-foreground`, `--hex-loader-gold-deep` | `brand-strong` |
| `--primary-light`, `--blue-50`, `--blue-100`, `--blue-muted`, `--sidebar-active`, `--sidebar-accent`, `--role-accent-soft` | `brand-soft` |
| `--primary-foreground`, `--sidebar-primary-foreground` | `on-brand` |
| `--blue-200`, `--blue-300`, `--blue-400`, `--indigo-*` | removed; use `brand-soft` or `line` |
| `--accent-orange` | `highlight` (UI) or `data-2` (charts) |
| `--accent-orange-soft` | `highlight-soft` |
| `--accent-amber`, `-rose`, `-violet`, `-emerald`, `-sky`, `-teal`, `-pink`, `-cyan`, `-lime` and their `-soft` | removed; chips go neutral or status, charts use `data-1..6` |
| `--success`, `--success-text`, `--success-foreground` | `positive`, `positive`, `on-brand` |
| `--success-light` | `positive-soft` |
| `--warning`, `--warning-text`, `--hex-loader-warning` | `warning` |
| `--warning-light` | `warning-soft` |
| `--danger`, `--danger-text`, `--error`, `--error-text`, `--destructive` | `danger` |
| `--danger-light`, `--error-light` | `danger-soft` |
| `--destructive-foreground`, `--error-foreground`, `--warning-foreground`, `--info-foreground` | `on-brand` (white on a status fill) |
| `--info`, `--info-text` | `info` |
| `--info-light` | `info-soft` |
| `--phase-*` | `brand` (current), `positive` (done), `warning` (waiting), `ink-faint` (locked); `-soft` variants to the matching `-soft` |
| `--stat-gst`, `-it`, `-mca`, `-fema`, `-stpi`, `-labour` | `data-1` to `data-6` |
| `--stat-rera`, `--stat-tp` | `ink-faint` (Other) |
| `--super-gold*` | removed |
| `--hex-loader-muted-paper` | `ink-muted` |
| `--shadow-ink` | folded into `shadow-card` / `shadow-float` |
| `[data-role=...]` override blocks | removed |
| Tailwind `gold`, `orange`, `indigo`, `role`, `phase`, `super-gold`, `accent-*` colour keys; `orange-pulse`, `gold-pulse` animations | removed with the tokens above |

| Old (client portal, `css-src/00-tokens.css` and `10-base.css`) | New |
|---|---|
| `--bg` | `surface` |
| `--panel` | `surface-raised` |
| `--raised` | `surface-sunken` |
| `--border`, `--hair` | `line` |
| `--fg`, `--navy-ink` | `ink` |
| `--muted` | `ink-muted` |
| `--subtle` | `ink-faint` |
| `--primary`, `--prog`, `--folder`, `--folder-open`, `--with`, `--navy`, `--navy-2`, `--navy-3`, `--primary-fill`, `--primary-fill-2`, `--primary-chip`, `--prog-chip` | `brand` |
| `--primary-dark` | `brand-strong` |
| `--primary-light`, `--prog-light`, `--with-light`, `--navy-deep`, `--navy-2-deep`, `--navy-3-deep`, `--own-sbc` | `brand-soft` |
| `--prog-text`, `--with-text`, `--own-sbc-t` | `brand` |
| `--gold`, `--gold-2`, `--gold-text`, `--you`, `--you-text`, `--own-you-t` | `highlight` |
| `--gold-soft`, `--you-light`, `--own-you` | `highlight-soft` |
| `--ok`, `--ok-text`, `--ok-chip` | `positive` |
| `--ok-light` | `positive-soft` |
| `--due`, `--due-text`, `--due-chip` | `warning` |
| `--due-light` | `warning-soft` |
| `--over`, `--over-text`, `--over-chip` | `danger` |
| `--over-light` | `danger-soft` |
| `--up`, `--up-text`, `--up-chip` | `ink-faint` |
| `--up-light` | `surface-sunken` |
| `--violet*`, `--sky*`, `--teal*` | removed; `brand-soft` or `surface-sunken` |
| `[data-auth=mca|it|gst|oth]` `--a`, `--a-bg`, `--a-fg` | one treatment: `brand`, `brand-soft`, `ink` |
| `--shadow` | `shadow-card` |
| `--pop` | `shadow-float` |
| `--sk`, `--cv` | `surface-sunken` |
| `html[data-theme="dark"] { --bg: #000 }` | `surface` dark `#0b1521` |

## Sources and skills

Web references, read on 21 October 2026, with what each contributed:

- Linear, "How we redesigned the Linear UI": themes derived from three inputs (base, accent, contrast) in LCH; surface, text and control colours computed from those, not hand-picked; blue chrome restricted for a more neutral look; text darker in light mode and lighter in dark mode. Taken: derive every surface and text token from one navy and one blue; keep the chrome neutral. (linear.app/blog/how-we-redesigned-the-linear-ui)
- Secondary breakdowns of Stripe and Mercury dashboards (adminlte.io, 925studios.co): colour used only for state, tabular figures and a monospace face for identifiers, status more prominent than amount, warm colours reserved for warnings. Taken: status tokens with a word, `mono` for IDs, `figure` styles with tabular numerals.
- Third-party Linear design-kit analyses (open-design.ai, byq.supply): an almost achromatic palette with one accent, 1px low-contrast hairlines for structure, shadows only for floating layers. Taken: borders before shadows, `shadow-float` only on popovers and sheets.
- Netguru and DXOS on token naming: name by purpose, one name with two theme values, a closed suffix vocabulary, a foreground token for every surface that hosts text. Taken: the `surface` / `ink` / `-soft` / `on-` vocabulary.
- Dynatrace and MiHCM design-system docs on chips and status: never colour alone, a label or icon beside every status colour, 4.5:1 for text and 3:1 for non-text. Taken: the "always with a word" rule and the 3:1 gate on `line-strong`, `focus-ring` and `highlight-bright`.

Skills used: `design-taste-frontend` (general discipline only: one accent, a locked radius scale, no gradients, no em-dashes; it declares dashboards out of scope), `ui-ux-pro-max:design-system` (primitive-to-semantic layering; its `validate-tokens` script will run in step 6), `dataviz` (chart palette and the validator), `web-design-guidelines` and `design:accessibility-review` (the contrast gates above).

Conflicts, resolved in favour of the brief: `design-taste-frontend` discourages Inter-like neutral sans faces and suggests Geist or Satoshi; the brief fixes Public Sans. The dataviz reference palette uses magenta in slot 5; violet replaced it because it validates better here (normal-vision floor 22.9 against 19.6) and reads less like a consumer app.

## Decisions to check before step 3

1. Action blue `#1b4f94` over `#2563EB`.
2. Navy sidebar in light mode (today it is white).
3. Phases lose their five hues; progress state carries the colour.
4. The statutory calendar folds RERA and TP into a grey "Other" so eight acts fit six validated hues.
5. Super Admin gold chip removed.
6. Hero skin picker shrinks to two skins (navy, white); the six gradient skins go.
7. Chips and avatars become 6px and 8px rounded rectangles, not pills.
8. Warning becomes amber (hue 73) so it stops matching the orange accent.
9. Deprecated aliases are deleted on 30 November 2026.
10. Status chips become soft (tinted ground, coloured word); the solid green, orange, blue and grey fills in the prototype's status column go. Chips and row buttons in a table column share one width (prototype v8 (1) rule, now a token).
11. The client portal's gold fills (`--gold`, the prototype's primary CTA) become the brand blue; only `--gold-text` and `--gold-soft` stay orange, so there is never an orange button.
12. In dark mode the portal's navy fills (`--navy`: hero, sidebar, primary buttons) map to `side-active`, a navy one step above the surface, so their light text keeps 11:1.

## Prototype v8 (1)

`~/Downloads/Lead Dashboard (1).html` differs from v8 in two ways. Every lead screen gained one rule: chips and buttons inside table cells and list rows get `min-width: 84px` with a centred label, so columns line up. That rule is now `chip-min-width` and `control-min-width`. The Work screen also gained a time-block editor (drag handles on calendar blocks and a "Change time" popover with 15-minute steppers). That is a feature, not a system change; it is noted for the Work slice in step 4.

## v1.1, 22 October: simple but colourful

v1 over-corrected: it took the colour out of the status chips, the hero and the brand marks, so the app read flat next to the prototype. v1.1 puts colour back where the prototype puts it, under rules. Everything v1 fixed stays fixed.

### Two intensities

- A **state** is a solid chip: the fill is the status colour, the text is `on-status` (white in light, navy in dark). Five states: `positive` done or filed, `brand` in progress, `warning` waiting or due (the prototype's orange, `#be4400`), `danger` overdue or stuck, `upcoming` not started or queued (`#656f7e`). In a column every state chip takes `chip-min-width` and centres its label.
- An **owner** or a **tag** is a soft tint with a text-safe colour: `owner-client` on `owner-client-soft` (orange), `owner-sbc` (blue), `owner-mca` (teal), `owner-manager` (violet); tags and counts stay neutral or brand. Never a solid owner chip, never a soft state chip in a status column.
- A state mentioned inline (a link, a sentence) may wear the soft tint with a 6px dot in the solid colour, the SBC-Track pattern.
- In a dense list (more than about eight rows, a full-page table) a state is the word alone in its colour at 600 with no ground, the LeetCode pattern (`STATE_WORD_CLASS` + `TONE_TEXT`). Three forms, one rule: the busier the list, the lighter the mark.

### Gold, the brand mark

`gold` (`#c9a24b` light, `#e0bd66` dark) is only ever a mark: the progress ring on the greeting card, the ring around the current step, the sidebar's active rail, a card's top tab. Not an underline: a gold rule under the greeting read as a yellow line and was removed. It holds 3:1 on navy, not on white, so it never carries text. `gold-text` (`#7a5a12` / `#e8c97d`) is the one gold that touches words.

### The one gradient

`hero-gradient`, navy to blue at 115 degrees (`#0f2a4a` to `#17396b` to `#1b4f94`; dark `#0b1521` to `#17304d`), is the greeting card's ground and the only gradient in the product. The hot figure on it is `#ff9b8f` in light (the prototype's pale red) and `highlight` in dark.

### Other changes

- `warning` moves from amber (hue 73) to the prototype's orange (hue 41). It no longer clashes with `highlight`; the two differ in lightness and in job (warning is a state, highlight a figure or mark).
- Every dark `-soft` ground is two points lighter so chips read against `surface-raised`.
- Secondary buttons drop the `line-strong` border for `line` plus `shadow-card`.
- `DashSection` takes `size="lg"` (13px sentence-case title) for a page's first section.
- `StatCard` takes `tinted` (soft fill of its tone behind the 3px edge).
- Charts on a dashboard use the five state colours or one brand ramp; `data-1..6` is for analytics pages only.

### What this takes from the references

- **Prototype v8:** solid state chips at one column width; soft owner tints; the gradient greeting card with the gold underline and gold ring; 8px status dots on the week strip; the action heatmap; the 22px health bar; grey section tiles and white cards so colour sits only in small marks.
- **SBC-Track (sbcllp/SBC-Track):** status triples at matched lightness; the dot inside a soft chip; tinted KPI tiles; layered low-alpha shadows; the sliding active nav pill; colour only where it carries meaning.
- **LeetCode (problemset, read live on 22 October):** colour sits in words and small icons, never in blocks. Difficulty is a coloured word (teal `hsl(180 74% 42%)`, yellow `hsl(43 100% 50%)`, red `hsl(0 91% 59%)`) with no chip ground; topic chips are neutral pills with a coloured 14px icon; counts are neutral grey badges; long tables stripe every second row; text is an opacity ladder on one neutral (our `ink`, `ink-muted`, `ink-faint`); surfaces are three flat layers; the brand orange appears only on the logo and one button; radius 8px. Taken: the coloured-word form of a state for dense lists, striped table rows, neutral count badges outside the sidebar, colour in icons rather than fills.
- **Left behind:** the prototype's inline hex values and gold fills; SBC-Track's warm cream ground, serif figures, orange brand and raw Tailwind badges.

The token source is `scripts/design-tokens-source.mjs` (`node scripts/design-tokens-source.mjs > docs/design/design-tokens.json`, then `node scripts/design-tokens-css.mjs --write`). The contrast gate has 75 pairs, 0 failures.

## v1.2, 23 October: rules from the prototype review

The owner reviewed the clickable prototype (v9, built by `docs/specs/landing-page/src/proto-fix/patch.mjs`) on 22 and 23 October. These decisions came out of it; the design book (`vcfo-design-system.html`, v1.2) shows each one.

- **Client colours.** Each client company owns one colour for good, so a project lead running eight companies knows a company by its colour before reading the name. The set has eight hues, each with a dot colour, a soft tile ground and a dark tile text: violet `#7c3aed`, indigo `#4f46e5`, green `#16a34a`, slate `#64748b`, pink `#db2777`, teal `#0d9488`, sky `#0284c7`, amber `#a16207`. They appear as the 8px dot beside the company name and the 26px initials tile, on every screen. People, tags and nav items stay neutral, and a client colour never stands in for a state. This replaces the v1 rule that identity never gets a colour. The set is not in `design-tokens.json` yet.
- **No page titles.** The breadcrumb and the active nav item name the page. The first row of a page is its controls, starting at the left edge; actions sit on the right.
- **Navigation that works.** Every breadcrumb segment except the current page is a link. Back returns to the previous screen and never leaves the product; on the first screen it does nothing.
- **One table look, grids included.** Sunken head under the 2px ink rule, 40px rows, a hairline between rows. A grid (heatmap, phase progress, clients by filings) is the same table; each cell holds a 28px box with 6px corners, 6px from its neighbours. Done green, current brand blue, due or waiting orange, overdue red, next dashed, not applicable hatched.
- **Account row.** Every portal ends the sidebar with the person and a Sign out button. Settings is a nav item. The active nav rail is gold on both portals, and only the active child is highlighted, not its parent.
- **Gold.** No card tabs or stubs any more; gold is the greeting card ring, the current-step ring and the nav rail.
- **One Ask VCFO launcher**, the visor character beside a navy pill with a teal dot, on the landing page and in both portals.
- **Smaller rules.** "New" is one neutral tag; counts are neutral badges, red only for an overdue count; mono only on identifiers; statutory deadlines show a real date, never "in N days".
