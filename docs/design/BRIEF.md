# VCFO Suite design system

You are building a design system for VCFO Suite, a compliance and incorporation product for Indian companies, and applying it to the app. The app is a Next.js App Router project at `~/Documents/vcfo-suite` (Tailwind 3 with OKLCH channel tokens, shadcn-style components). Work there, on a new branch. Do not commit unless I ask.

## Why this matters

The current UI reads as machine-generated. The same meaning gets different colours on different cards. Yellows, oranges, ambers, golds, rose and violet appear on one screen. Some accents are bright while the surfaces beside them are dull. Two token systems coexist and neither is followed. I want one calm, structural system, like the Interico one I already have, so that a reviewer would describe the app as designed by people. Polished and quiet beats clever.

## Decisions already made. Do not reopen them.

- Primary colour is blue. Deep navy for text and weight. Two blues are in play: the prototype uses link blue `#1b4f94` on navy ink `#0f2a4a`; the app's `--primary` is `oklch(54.6% 0.215 263)` (about `#2563EB`). Pick one action blue, say which, and keep the navy for ink.
- Orange is the single highlight. One orange moment per screen region, on chips and small marks. Never an orange button beside a blue one. Never orange as page atmosphere.
- Font is Public Sans for UI and display. IBM Plex Mono for IDs and figures. Manrope, Space Grotesk, Poppins and Plus Jakarta Sans leave the app. The logo keeps its own type and colours; logo colours (`#FFC517`, `#F08A21`, `#E76028`) are logo-only, never UI tokens.
- Status colours: positive, warning, danger, info, each with a `-soft` ground, always paired with a word. Never colour alone.
- Chart palette: six hues, assigned in fixed order, validated for colour-vision deficiency in both themes.
- Structure is copied from Interico, colours are not: semantic token names with light and dark values and a usage note each; borders before shadows; no gradients on cards; no coloured left-border cards; no cards inside cards; one radius scale; hairlines for rows, a 2px rule under page heads and table heads.

## What already exists. Read these before writing anything.

- `docs/context/notes/design-system.md`: the current rules and a canonical-component table. Update this file; do not create a parallel one.
- `app/globals.css` (2,714 lines): light tokens in `:root` around lines 17 to 243, role overrides `[data-role=...]` around 245 to 289, dark tokens under `.dark, [data-theme="dark"]` from line 292. Tokens are OKLCH channel triplets used as `oklch(var(--x) / <alpha-value>)`. `--gold`, `--gold-hi`, `--gold-deep` and the whole `--orange-*` scale are aliases of the blue scale. Ten `--accent-*` categorical hues (amber, orange, rose, violet, emerald, sky, teal, pink, cyan, lime), eight `--stat-*` calendar hues, five `--phase-*` washes, `--role-accent-*`, `--super-gold-*`, `--hex-loader-*` (HSL, not OKLCH).
- `tailwind.config.ts` (277 lines): maps `gold`, `orange` (to blue), `indigo`, `brand`, `primary`, `success`, `warning`, `danger`, `error`, `info`, `destructive`, all ten `accent-*`, `role`, `phase`, `super-gold`, `sidebar`. Animations `orange-pulse` and `gold-pulse` alias `blue-pulse`.
- A second token system: the client portal at `src/components/client-portal/css-src/00-tokens.css` was hand-ported from the prototype with its own names (`--bg --panel --raised --border --hair --fg --muted --subtle --primary --navy --gold --ok --due --over --prog --up --violet --sky --teal --you --with` and more), its own dark theme under `html[data-theme="dark"]`, and self-hosted Manrope and Space Grotesk woff2 files from `public/client-portal/fonts/`. `node scripts/cp-css.mjs` compiles `css-src/` into `src/components/client-portal/css/`; the compiled folder is generated, never edit it. Tailwind preflight is reverted inside the portal (`all: revert`), and `.cp-tw` islands keep Tailwind. The portal must end up on the same tokens as the rest of the app, with its names mapped, not a third system.
- Fonts load in `app/layout.tsx` via `next/font/google`: Manrope as `--font-sans`, Space Grotesk as `--font-serif` (the display hook), IBM Plex Mono as `--font-mono`. The portal CSS hardcodes `font: ... Manrope` in about fifteen rules.
- Canonical components named in the notes: `.surface` and `DashSection` (`src/components/dash/DashSection.tsx`), `DashHero`, `TONE_BADGE` in `src/components/common/IconChip.tsx`, `src/components/intern/intern-tones.ts`, `LeadPhaseProgress`, `PageBackCluster`, `src/components/charts/*`, `src/lib/phase-colors.ts`, `src/lib/motion.ts`.
- Brand files: `docs/specs/brand/logo/README.md` and the three PNGs beside it.

Baseline counts across `src/` and `app/` (tsx, ts, css), measured on 21 Oct 2026. Verify with `rg` in a minute, then move on; do not redo the audit from scratch.

- Hex literals: 1,320 in 92 files. `oklch(`: 2,165 in 118 files (236 in `globals.css`). `rgb`/`rgba`: 266 in 23 files.
- Worst hex offenders outside `globals.css`: `client-portal/css-src/incorporation-pages.css` 87, `21-runtime.css` 60, `home-tle.css` 51, `20-shell.css` 42, `src/lib/shell-appearance.ts` 31, `src/lib/email/email-layout.ts` 29.
- Class usage: `primary*` 1,135 in 246 files; `gold*` 242 in 65; `brand*` 120 in 51; `success*` 335; `info*` 264; `danger*` 193; `warning*` 180; `destructive` 41; `phase-*` 116 in 12; `role-*` 94 in 26; `super-gold` 11 in 2; `accent-violet` 24, `accent-sky` 19, `accent-cyan` 15, `accent-amber` 14, `accent-orange` 13, `accent-teal` 13, `accent-pink` 13, `accent-emerald` 11, `accent-rose` 10, `accent-lime` 10. Raw Tailwind palette classes are nearly unused (`blue-*` 105, `emerald-*` 11, `indigo-*` 9, everything else 0 to 2).
- Structure: `bg-gradient-to-*` 22 in 14 files, `linear-gradient(` 92 in 42 files, `border-l-*` 20 in 6 files, `backdrop-blur` 14, `rounded-full` 213 in 108 files.

## References

- Layout reference: `~/Downloads/Lead Dashboard.html` (prototype v8, 11.5 MB, self-contained). Use it for layout, density and information hierarchy of the lead portal. Do not use its palette: it has the same mix (`#cf3a2f` red 116 hits, `#15805f` green 115, `#d9731f` orange 77, `#c9a24b` gold 35, `#fbf3df` cream 40, plus about 424 inline `oklch(` values). Its screens are embedded in `<script type="application/json" id="pf">` as `{text, bin, alias, mime}`: 144 text files, 57 binaries. Lead routes are in `routes.js` (`window.__VCFO_ROUTES`, 24 routes with `role: "lead"`); screens live at `s/lead/*.dc.html`, and `s/lead/Main.dc.html` is the Today screen. Extract into a scratch folder outside the repo with: read the file, regex the `id="pf"` script body, `json.loads`, write each `text` entry to disk. The prototype loads Manrope, Space Grotesk and IBM Plex Mono; the intro animation uses Poppins. Ignore the fonts.
- Structure reference: `~/Documents/interico/interico-design-handoff/design-system/project/README.md` and `tokens.json`. Match the JSON shape exactly: `name`, `version`, `color.themes`, `color.tokens[{name, value: {light, dark}, usage}]`, `type.{fonts, families, groups}`, `spacing.tokens`, `radius.tokens`, `shadow.tokens`, `borderWidth.tokens`. Interico's colour token names are the starting vocabulary: `surface`, `surface-raised`, `surface-sunken`, `line`, `line-strong`, `rule`, `ink`, `ink-muted`, `ink-faint`, `brand`, `brand-strong`, `brand-soft`, `on-brand`, `accent`, `accent-soft`, `on-accent`, `positive`, `positive-soft`, `warning`, `warning-soft`, `danger`, `danger-soft`, `info`, `info-soft`, `side`, `side-ink`, `side-muted`, `side-active`, `side-line`, `focus-ring`, `scrim`, `data-1` to `data-6`.

## Research before you design

Search the web for four to six current, well-regarded references for finance and professional-services dashboards: Stripe Dashboard, Mercury, Ramp, Linear, Attio, Vercel, plus one or two case studies from Dribbble or Awwwards that show real product UI, not marketing pages. Take concrete, named patterns: type scale and weights, row density, border and shadow treatment, how status is shown, how much colour a chart gets. Do not copy visuals. Record every source and what you took from it in the token spec.

Load these skills at the points named, and say which you loaded: `design-taste-frontend` for the overall discipline (it declares dashboards out of scope; apply its general rules on accents, radius lock and anti-patterns, nothing else); `ui-ux-pro-max:design-system` for the token layering and its `validate-tokens` script; `dataviz` before choosing chart colours, and run its `scripts/validate_palette.js` on the six data hues in light and dark mode against the real surfaces; `web-design-guidelines` and `design:accessibility-review` for the contrast pass; `frontend-design` when you implement. Where a skill conflicts with the decisions above, the decisions win, and you say so in the spec.

## Deliverables, in this order

1. **Audit** at `docs/design/AUDIT.md`. Every colour family in use, where it appears, which rule it breaks, and which token it maps to. Counts from `rg`, not estimates. One short section on the two token systems and how they merge. About thirty minutes.

2. **Token spec** at `docs/design/TOKENS.md` plus `docs/design/design-tokens.json` in the Interico shape. Cover surfaces, lines, ink, brand, accent, the four statuses, focus ring, scrim, sidebar, and `data-1` to `data-6`. Every token has a light value, a dark value, and a usage sentence. Every text token passes 4.5:1 on each ground its note names, in both themes; show the numbers. Every deprecated alias (`gold`, `orange-*`, `indigo`, `accent-*`, `phase-*`, `role-*`, `super-gold`, `hex-loader-*`, `stat-*`, the portal names) is either removed or listed with its replacement and a removal date. Include the type scale, spacing scale, radius scale, shadow and border-width tokens. **Stop here and ask me to review before touching code.**

3. **Implement the tokens.** Rewrite the token blocks in `app/globals.css` and the colour map in `tailwind.config.ts` to the new names. Keep the old names as temporary aliases that resolve to the new tokens so nothing breaks mid-migration. Swap fonts in `app/layout.tsx` to `Public_Sans` and `IBM_Plex_Mono`; point the portal at the same font variables and remove its hardcoded `Manrope`. Ask before adding or removing a font package. Run `npm run typecheck`.

4. **Migrate call sites in slices**, most visible first, one reviewable change per slice with a list of what moved: the shell (`AppShell`, `RoleSidebar`, `TopBar`), the lead Today screen (`src/views/intern/Today.tsx` and `src/components/intern/*`), the client portal home, Ask VCFO. Replace hardcoded hex and `oklch(` literals with tokens. Remove gradients, coloured left borders and nested cards as you go. Leave `src/lib/email/email-layout.ts` for last; email clients need literals, so give it its own small palette derived from the tokens.

5. **Component doc** at `docs/design/COMPONENTS.md`: the canonical card, KPI tile, status chip, table, empty state, callout, page header, and sidebar item. For each, the one component that owns it, which existing components it replaces, and which callers to migrate. Mark duplicates deprecated in code.

6. **Verify.** `npm run typecheck && npm run test`. Start `npm run dev` and screenshot lead Today, client home and Ask VCFO in light and dark at 1440px and 375px with the built-in browser. Re-run the baseline counts and report before and after. Report contrast failures plainly.

## Constraints

- No new colour families. Blue, neutrals, one orange, four statuses, six chart hues. That is the whole palette.
- Do not touch `src/domain/`, `src/data/checklist.ts`, or any repository code. This is a visual change only.
- Do not delete routes or pages. Do not change the logo files. Do not change `scripts/cp-css.mjs` beyond what the token merge needs.
- The working tree has uncommitted changes on `main` (`scripts/seed-demo.ts`, plus untracked `graphify-out/`, `scripts/seed-demo-extras.ts`, `vcfo-client-portal-prototype-v7.html`). Branch with `git switch -c design/design-system`, leave those files alone, and do not commit them.
- Write prose without em-dashes.

## When you are unsure

If a rule above and the code disagree, follow the rule and note the conflict in the audit. If two components could be canonical, pick the one the lead Today screen uses. If a contrast target cannot be met with the chosen hue, adjust lightness, not hue, and show the before and after values. Ask me only when the answer changes the token names or the fonts; everything else, decide and list the decision.

## What I want back at each stop

The files you created or changed, the audit counts before and after, the contrast table, the screenshots, the sources you used with what each contributed, and a short list of decisions I should check (which blue won, which accent survived, what was deprecated).
