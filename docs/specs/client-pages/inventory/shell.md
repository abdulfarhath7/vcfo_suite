# Shell & runtime inventory (client portal prototype, FINAL)

Area: the shared shell and runtime used by every client screen. Source of truth:
`docs/specs/client-pages/prototype/final-src/` (paths below are relative to it unless they start with `docs/`, `src/`, `app/` or `public/`).
Line numbers are 1-based and refer to the readable sources (`outer-shell.html` has its base64 font/image payloads stripped in this file but line numbers are the real ones).

How the prototype is put together (read this first, it explains why some things look odd):

- `outer-shell.html` is the page the user opens. It plays the intro (`#vi`) over an `<iframe id="stage">` and builds every screen
  document from a JSON bundle (`<script id="pf">`, stripped from the readable copy; present in `../vcfo-client-portal-FINAL.html`).
  Each screen is a *design-canvas board* (`s/**.dc.html`, rendered by the React-based canvas runtime in `s/docs/support.js`, which is
  just React 18 + the "dc-runtime"; it contains **no** shell UI).
- Every screen loads `routes.js` + `proto.js`. `proto.js` injects `shell.js` (the navy sidebar / rail / drawer + Before|After pill),
  and on Home boards also `tl-editor.js` (timeline editor). So the **real, shared, final** shell is `proto.js` + `shell.js` + `tl-editor.js`
  + the shared CSS in `b/*.css`. The boards draw their own (legacy) sidebar placeholder (`s/team/side.dc.html`, `s/home/v7c_side.dc.html`),
  which `shell.js` hides and covers with `#vp-side`.
- The chat design boards (`s/home/v7chat_*.dc.html`) draw a richer chat panel (`#ask-panel`) than the runtime chat in `proto.js`
  (`#vp-chat`). At runtime `hideBoardBots()` (proto.js:622-631) hides `#ask-panel` and board robots, so what the user *sees* is `#vp-chat`.
  Both are documented: `#vp-chat` = behaviour/motion/avatar spec, `#ask-panel` boards = content spec (home tabs, thinking steps,
  answer card with sources, 👍/👎, "Ask my lead" hand-off form). The owner decisions (`docs/specs/client-pages/DECISIONS.md`) require
  👍/👎 ("Keep"), so the real app needs the board content inside the runtime behaviour.
- Class-name collision to watch: `b/ecdc…css` defines `.tb` as a 36 px top-bar icon button; `b/5f81…css` defines `.tb` as the rule-14
  tooltip bubble. Pages never load both, but a React port that globally merges the CSS must rename one (suggest `.tbar-ib` / `.tt-b`).

Shared CSS files and who uses them:

| File | What it is | Used by |
|---|---|---|
| `b/ecdc4c28c4511de8452c7a5f1e7f79e6.css` (173 lines) | Base tokens + components + Team/Updates/Audit/Settings additions + rule-17 `[data-tip]` tooltip | all `s/team/*.dc.html` (25 boards); the same rules are inlined in every `s/home/*` board |
| `b/5c039baef32b3d6ce261ca5ecdb3d384.css` (189 lines) | Same base + Incorporation additions (`.page`, `.navyband`, `.node`, `.toast`, `.abar`, `.paper`…) | bundled; Incorporation boards inline equivalents |
| `b/5f811734dca85ebd1a2cffd9332ad6b9.css` (17 lines) | Rule 14 shared tooltip (`.tt/.tb`) + drill-down pop-up (`.dpop`) | bundled shared |
| `b/9459a827ed671b33411647c3b49d4711.css` (93 lines) | Flow-chart options A–E (`.fa-*`, `.fb-*`, `.fc-*`, `.fd-*`, `.fe-*`) | Focus-track / timeline visuals |

Already present in the repo (untracked, being written in parallel, so treat as "in progress"):
`src/components/client-portal/css-src/{00-tokens,10-base,11-drill,20-shell,21-runtime}.css` (scoped by `scripts/cp-css.mjs` into
`src/components/client-portal/css/*` under a `.cp` root, dark via `.cp[data-theme="dark"]`), and `public/client-portal/`
(`fonts/*.woff2`, `visor-avatar-animated.svg` (byte-identical to `v7-inputs/`), `vcfo-logo-on-{light,dark,black,white}.webp`,
`vcfo-mark.webp`, `vcfo-icon.webp`, `sbc-logo-top.webp` (= bundle `b/58222daec003642d1a412d8c2b427c36.png`, the top-bar logo),
`sbc-logo-side.webp`). The component `ClientPortalShell` is referenced by `scripts/cp-css.mjs` but does not exist yet.

---

## 1. DESIGN TOKENS

### 1.1 How theming works

- Theme state: `localStorage['vcfo.theme']` = JSON `"light" | "dark" | "system"`; anything else (or missing) = `"light"` (proto.js:8-10).
- Applied as `<html data-theme="light|dark">` plus `html.style.colorScheme = light|dark` (proto.js:11-13). `"system"` follows
  `matchMedia('(prefers-color-scheme: dark)')` live (proto.js:24). A `storage` event re-applies it across tabs (proto.js:25).
- Every `button/a/[role=button]` whose `aria-label` matches `/theme/i` is a theme toggle (capturing click handler, proto.js:30-34);
  its label flips between `Switch to dark theme` / `Switch to light theme`, `aria-pressed` = dark, `data-tip`/`title` follow (proto.js:14-20).
- Dark values come from ONE override block `html[data-theme="dark"]{…}` (proto.js:36-75). There is no `prefers-color-scheme`
  media block for the shell (only the Compliances canvas page has one, for `--cv`).
- Inline colours that are not tokens use CSS `light-dark(LIGHT, DARK)`; that works because `color-scheme` is set on `<html>`
  (`html{color-scheme:light}` / `html[data-theme="dark"]{color-scheme:dark}`).
- "True black" dark: `html[data-theme="dark"], html[data-theme="dark"] body{background:#000}`; the sidebar and board sidebar placeholders
  go `#000!important` with `box-shadow:inset -1px 0 0 oklch(20% 0.008 260)` (proto.js:58-63).
- `[data-paper]` = light-only island inside dark (document previews) (proto.js:67-69). `.tgl::after` knob stays light in dark (proto.js:65).
- Repo today: `next-themes` with `attribute="class"` (`app/providers.tsx:41-46`) and `ThemeToggle` (`src/components/common/ThemeToggle.tsx`,
  labels "Switch to light/dark mode"). The portal CSS keys on `[data-theme="dark"]`, so either set `attribute="data-theme"` for the
  portal subtree or mirror the class onto `.cp[data-theme]`.

### 1.2 Colour tokens: light (`:root`, `b/ecdc…css:3-16`, identical in every board) vs dark (`html[data-theme="dark"]`, proto.js:38-57)

"unset" = the light theme never defines it; components read it with a fallback (e.g. `var(--navy-ink,var(--navy))`,
`var(--primary-fill,var(--primary))`, `var(--navy-deep,var(--navy))`).

| Token | Light (exact) | Dark (exact) |
|---|---|---|
| `--bg` | `oklch(97.4% 0.006 255)` | `#000` |
| `--panel` | `oklch(100% 0 0)` | `oklch(13% 0.006 260)` |
| `--raised` | `oklch(96.6% 0.007 255)` | `oklch(17% 0.008 260)` |
| `--border` | `oklch(92.2% 0.011 255)` | `oklch(24% 0.01 260)` |
| `--hair` | `oklch(94.8% 0.007 255)` | `oklch(19% 0.008 260)` |
| `--fg` | `oklch(21% 0.042 264)` | `oklch(92% 0.005 260)` |
| `--muted` | `oklch(46% 0.028 258)` | `oklch(72% 0.008 260)` |
| `--subtle` | `oklch(55% 0.022 255)` | `oklch(60% 0.01 260)` |
| `--primary` | `oklch(54.6% 0.215 263)` | `oklch(68% 0.16 255)` |
| `--primary-dark` | `oklch(48.8% 0.217 264)` | `oklch(76% 0.13 255)` |
| `--primary-light` | `oklch(96.6% 0.02 260)` | `oklch(22% 0.06 258)` |
| `--primary-chip` | `oklch(52% 0.21 263)` | `oklch(50% 0.17 258)` |
| `--primary-fill` | unset (→ `--primary`) | `oklch(52% 0.19 258)` |
| `--primary-fill-2` | unset (→ `--primary-dark`) | `oklch(58% 0.18 258)` |
| `--navy` | `#0f2a4a` | `oklch(46% 0.15 258)` |
| `--navy-ink` | unset (→ `--navy`) | `oklch(94% 0.008 255)` |
| `--navy-2` | `#17396b` | `oklch(52% 0.15 258)` |
| `--navy-3` | `#1b4f94` | `oklch(56% 0.15 255)` |
| `--navy-deep` | unset (→ `--navy`) | `oklch(19% 0.05 258)` |
| `--navy-2-deep` | unset (→ `--navy-2`) | `oklch(23% 0.07 258)` |
| `--navy-3-deep` | unset (→ `--navy-3`) | `oklch(29% 0.1 255)` |
| `--gold` | `#c9a24b` | `#e0bd66` |
| `--gold-2` | unset in base (Incorporation pages: `#e6c46e`) | `#ecd08a` |
| `--gold-soft` | `#fbf3df` | `oklch(25% 0.05 85)` |
| `--gold-text` | `#6e500f` | `#e8c97d` |
| `--ok` | `oklch(56% 0.13 168)` | `oklch(68% 0.14 165)` |
| `--ok-light` | `oklch(96% 0.028 170)` | `oklch(23% 0.05 165)` |
| `--ok-text` | `oklch(39% 0.09 172)` | `oklch(80% 0.1 165)` |
| `--ok-chip` | `oklch(50% 0.12 168)` | `oklch(50% 0.12 165)` |
| `--due` | `oklch(66% 0.17 48)` | `oklch(74% 0.15 62)` |
| `--due-light` | `oklch(96.8% 0.04 55)` | `oklch(25% 0.06 60)` |
| `--due-text` | `oklch(48% 0.14 42)` | `oklch(84% 0.11 68)` |
| `--due-chip` | `oklch(55% 0.17 42)` | `oklch(54% 0.15 45)` |
| `--over` | `oklch(57% 0.2 22)` | `oklch(66% 0.19 22)` |
| `--over-light` | `oklch(96.4% 0.026 18)` | `oklch(23% 0.07 22)` |
| `--over-text` | `oklch(46% 0.17 20)` | `oklch(80% 0.12 22)` |
| `--over-chip` | `oklch(52% 0.2 22)` | `oklch(52% 0.19 22)` |
| `--prog` | `oklch(55% 0.16 252)` | `oklch(66% 0.15 252)` |
| `--prog-light` | `oklch(96% 0.026 250)` | `oklch(23% 0.06 252)` |
| `--prog-text` | `oklch(43% 0.13 254)` | `oklch(80% 0.1 252)` |
| `--prog-chip` | `oklch(51% 0.17 252)` | `oklch(50% 0.16 252)` |
| `--up` | `oklch(82% 0.018 255)` | `oklch(40% 0.015 255)` |
| `--up-light` | `oklch(96.6% 0.007 255)` | `oklch(18% 0.008 255)` |
| `--up-text` | `oklch(46% 0.028 258)` | `oklch(72% 0.01 255)` |
| `--up-chip` | `oklch(54% 0.026 258)` | `oklch(40% 0.02 258)` |
| `--violet` | `oklch(54% 0.17 292)` | `oklch(68% 0.15 292)` |
| `--violet-light` | `oklch(96.4% 0.032 292)` | `oklch(24% 0.06 292)` |
| `--violet-chip` | `oklch(50% 0.17 292)` | `oklch(52% 0.16 292)` |
| `--violet-text` | unset | `oklch(80% 0.1 292)` |
| `--violet-soft` | unset | `oklch(28% 0.07 292)` |
| `--sky` | `oklch(58% 0.12 228)` | `oklch(68% 0.11 228)` |
| `--sky-light` | `oklch(96.4% 0.026 228)` | `oklch(23% 0.05 228)` |
| `--sky-chip` | `oklch(49% 0.12 230)` | `oklch(52% 0.11 230)` |
| `--teal` | `oklch(55% 0.1 195)` | `oklch(66% 0.1 195)` |
| `--teal-light` | `oklch(96.4% 0.026 195)` | `oklch(23% 0.05 195)` |
| `--teal-chip` | `oklch(47% 0.09 195)` | `oklch(58% 0.09 195)` |
| `--you` | unset in base (Incorporation: `#c8620e`) | `oklch(70% 0.15 55)` |
| `--you-light` | (Incorporation: `#fdf2e6`) | `oklch(25% 0.06 55)` |
| `--you-text` | (Incorporation: `#9a4a08`) | `oklch(84% 0.1 60)` |
| `--with` | (Incorporation: `#2453c7`) | `oklch(66% 0.15 262)` |
| `--with-light` | (Incorporation: `#e9effc`) | `oklch(23% 0.06 262)` |
| `--with-text` | (Incorporation: `#2349a8`) | `oklch(80% 0.1 262)` |
| `--own-you` | (Incorporation: `#fbf0d2`) | `oklch(26% 0.05 85)` |
| `--own-you-t` | (Incorporation: `#7a5a0c`) | `#e8c97d` |
| `--own-sbc` | (Incorporation: `#e8eefb`) | `oklch(23% 0.05 262)` |
| `--own-sbc-t` | (Incorporation: `#2349a8`) | `oklch(80% 0.1 262)` |
| `--folder` | unset | `oklch(72% 0.1 255)` |
| `--folder-open` | unset | `oklch(78% 0.1 255)` |
| `--sk` | unset | `oklch(20% 0.008 260)` |
| `--cv` | Compliances canvas: `oklch(93% 0.008 255)` | `oklch(20% 0.008 260)` (proto.js); Compliances page itself: `oklch(22% 0.02 260)` |
| `--gst` / `--it` / `--mca` / `--fema` / `--labour` | `oklch(52% 0.15 148)` / `oklch(53% 0.16 252)` / `oklch(50% 0.18 300)` / `oklch(55% 0.19 12)` / `oklch(50% 0.12 200)` | not overridden |
| `--cat-tax` / `--cat-labour` / `--cat-business` / `--cat-ip` / `--cat-fema` | `oklch(58% 0.14 70)` / `oklch(50% 0.12 200)` / `oklch(52% 0.17 292)` / `oklch(52% 0.13 230)` / `oklch(55% 0.19 12)` | not overridden |
| `--shadow` | `0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)` | `0 0 0 1px oklch(20% 0.008 260)` |
| `--pop` | Compliances page: `0 16px 40px -12px oklch(21% 0.042 264 / .35)` | `0 18px 44px -12px rgba(0,0,0,.9)` |
| `--spring` | Compliances page: `linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)` | same |
| page background | `html,body{background:var(--bg)}` | `#000` |

Incorporation pages (`s/inc/*.html:8-13`) use a hex light variant of the base set — keep it if you port those pages pixel-exact:
`--bg:#f3f5f9;--panel:#fff;--raised:#f5f7fa;--border:#e2e7ef;--hair:#edf0f5;--fg:#0f1b2d;--muted:#56667d;--subtle:#7b889c;--ok:#15805f;--ok-light:#e5f4ee;--ok-text:#0f6a4e;--over:#cf3a2f;--up:#cfd6e2;--violet:#6b3fc4;--violet-light:#efe9fb;--shadow:0 1px 2px rgba(15,27,45,.04),0 6px 18px -10px rgba(15,27,45,.16);--sw:var(--vp-side-w,248px);--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;--disp:"Space Grotesk",Manrope,system-ui,sans-serif`
(+ `--sw` 72px ≤1279, 0px ≤767).

Credentials page (`s/home/v7p_credentials.dc.html:278,302`) redefines navy to slate: light `--navy:oklch(30% 0.025 255);--navy-2:oklch(37% 0.025 255)`,
dark `--navy:oklch(44% 0.02 255);--navy-2:oklch(50% 0.02 255)`; dark per-authority accents in proto.js:71-74
(`[data-auth=mca|it|gst|oth]` → `--a/--a-bg/--a-fg`).

### 1.3 Shell/runtime custom properties (set by script or used by the shell)

| Property | Value(s) | Set where |
|---|---|---|
| `--vp-side-w` (on `<html>`) | `0px` phone / `72px` tablet / `248px` desktop | shell.js:28-34 (`applyBP`) |
| `--vps-w` | same as `--vp-side-w` | shell.js:34 |
| `--vp-menu-offset` | `56px` when the phone fallback band is shown, else removed | shell.js:527-529 |
| `--vpl-in` | `var(--vp-inset,clamp(14px,1.25vw + 8px,24px))` (launcher/chat inset = page gutter) | proto.js:319 |
| `--vpl-w` | `clamp(96px,4.5vw + 72px,148px)` (launcher character width) | proto.js:319 |
| `--vpk-w` | `clamp(96px,3vw + 72px,128px)` (peek character width on the chat) | proto.js:319 |
| `--vpl-ph` | `36px`; `40px` at ≤767px (Ask VCFO pill height) | proto.js:319,321 |
| `--vp-launch-h` | `calc(var(--vpl-ph) + 2 * var(--vpl-in))`; also `scroll-padding-bottom` on `:root` | proto.js:320 |
| `--vp-launch-w` | `calc(var(--vpl-w) + 4px + 108px + var(--vpl-in))` | proto.js:320 |
| `--vpl-lift` (on `#vp-chat`) | px the launcher sits above the viewport bottom (when a page lifts it over its own sticky bar) | proto.js:563 |
| `--vp-endpad-bg` | colour sampled from the lowest edge-to-edge background (bottom spacer paint) | proto.js:505-523 |
| `--vp-inset` | optional page override of the launcher inset | read at proto.js:319 |
| `--vh-hg` / `--vh-hp` | top bar gap / side padding: `12px`/`16px`; phone `6px`/`10px` | `s/home/v7_before.dc.html:164+` (`.vh-top`) |
| `--tmin` | min table width inside `.vh-x` scrollers (default `520px`) | vh layer |
| `--ac` | KPI accent stripe colour | `.kpi::before` |
| `--stage/--ink/--yellow/--orange/--deep` | intro: `#fff` / `#000` / `#FFC517` / `#F08A21` / `#E76028` | outer-shell.html:15 |

### 1.4 Hard-coded shell palette (not tokens; these stay the same in light and dark unless noted)

| Use | Value |
|---|---|
| Sidebar / rail / drawer background | `#0f2a4a` (dark theme: `#000!important`) |
| Sidebar text default / hover | `#c3cddc` → hover `#fff`, hover bg `rgba(255,255,255,.06)` |
| Sidebar icon default / hover / active | `#9aa8bd` / `#c9d6ea` / `#a9c3ff` |
| Active pill | bg `rgba(255,255,255,.1)`, `box-shadow:inset 0 0 0 1px rgba(110,150,255,.42),inset 0 1px 0 rgba(255,255,255,.12)`; dark-theme active item bg `oklch(17% 0.02 260)` |
| Active rail (3px) | `#6e96ff` |
| Sub-item dot | `#5b6e8a`; active `#8fb0ff` + `box-shadow:0 0 0 3px rgba(110,150,255,.22)`; sub guide line `rgba(255,255,255,.14)` |
| Badges | `rgba(255,255,255,.1)` / hot `#d93a3a`, text `#fff` |
| Chevron | `#8c9ab0` |
| Group label ("Northwind’s team") | `#d8b25a` |
| Contact avatar | bg `rgba(255,255,255,.12)`, ring `0 0 0 1.5px rgba(255,255,255,.22)`, text `#dbe3ef`; role text `#9eadc3` |
| Contact hover-action strip | gradient `linear-gradient(90deg,rgba(22,50,80,0),#163250 14px)`; buttons `rgba(255,255,255,.12)` → hover `.22`; WhatsApp `#1f8f5a` → hover `#25a468` |
| Account avatar | `#2e5cff`; account sub text `#a9b6c9` |
| Separators in the sidebar | `rgba(255,255,255,.08)` (logo, drawer header), `rgba(255,255,255,.1)` (team, account, rail bar) |
| Focus ring in the sidebar | `outline:2px solid #8fb4ff;outline-offset:2px;border-radius:8px` |
| Rail fly-out | bg `#143457`, `box-shadow:0 0 0 1px rgba(255,255,255,.1),0 22px 44px -14px rgba(4,12,28,.75)`; item text `#d5deea`, icon `#9fb0c8`, WhatsApp icon `#4fd08f`; active `inset 3px 0 0 #6e96ff` |
| Rail tooltip | bg `#08192f`, `box-shadow:0 0 0 1px rgba(255,255,255,.14),0 10px 24px -10px rgba(0,0,0,.6)` |
| Scrims | drawer `rgba(8,20,40,.45)`; drill / timeline editor `rgba(8,20,40,.5)`; board `.scrim` `oklch(20% 0.05 258 / .55)`; board `.ov` `oklch(21% 0.042 264 / .42)`; mobile sheet `oklch(20% .05 258 / .45)` |
| Toast | bg `#0f2a4a`, text `#fff`, Undo button bg `rgba(255,255,255,.14)`, text `#e6c46e` |
| Runtime tooltip `#vp-tip` | bg `#0f2a4a`, text `#fff` |
| Launcher pill | `#0f2a4a` → hover `#17396b`; dot `#2DD4BF` + `box-shadow:0 0 0 3px rgba(45,212,191,.22)`; focus `outline:3px solid light-dark(#7DD3FC, oklch(32% 0.1 230.3))` |
| Avatar art | head gradient `#4C8DF8 → #1D4ED8`; hand gradient `#4C8DF8 → #2563EB`; ears/antenna stalk `#1E40AF`; antenna idle `#2DD4BF`, answered `#22C55E` (runtime) / `#34D399` (bot board), cannot `#94A3B8`, thinking (board) `#7DD3FC` pulsing; visor `#0B1736`; eyes + smile `#7DD3FC` with glow filter; chin `#1E3A8A @ .7`; fingers `#1D4ED8` |
| Before/After track / thumb | track `light-dark(#e6eaf1, oklch(22.6% 0.01 261.8))`; thumb `#0f2a4a` + `box-shadow:0 2px 6px -2px rgba(15,42,74,.55)`; labels `light-dark(#4a5a72, oklch(81.4% 0.031 258.3))`, pressed `#fff`; focus `2px solid #2e5cff` |
| Prototype control bar (`#vp-bar`, prototype-only) | `#0f2a4a`, tag `#c9a24b` |

`light-dark()` pairs used by the shell runtime (exact): `#fff ↔ oklch(13% 0 89.9)` (panels), `#0f1b2d ↔ oklch(91.2% 0.028 258.3)` (text),
`#0f2a4a ↔ oklch(88.7% 0.047 254.4)` (navy text), `#f1f4f8 ↔ oklch(18.1% 0.006 255.5)` (raised), `#dde3ec ↔ oklch(25.4% 0.012 258.3)` (chat borders),
`#e3e8ef ↔ oklch(24.8% 0.011 256.7)` (drill/editor borders), `#eef1f5 ↔ oklch(23.7% 0.006 255.5)` (hairlines), `#eef2ff ↔ oklch(18.7% 0.01 272.3)` (suggestion chip bg),
`#2a4fd6 ↔ oklch(80.3% 0.14 266.4)` (suggestion text / card link), `#4a5a70 ↔ oklch(81.5% 0.029 256.4)` ("why" text), `#eef3ff ↔ oklch(18.4% 0.01 267.8)` (drill top strip),
`#f5f7fa ↔ oklch(16.7% 0.005 258.3)` (drill footer / row hover), `#dfe5ee ↔ oklch(25% 0.01 258.3)` (phone frame bg), `#fff ↔ oklch(22% 0 89.9)` (sign-out focus ring),
top bar `oklch(100% 0 0 / .9) ↔ oklch(13% 0 0 / 0.9)`, top bar border `oklch(91.5% 0.012 255 / .6) ↔ oklch(25.4% 0.012 255 / 0.6)`,
search border `oklch(91.5% 0.012 255 / .7) ↔ oklch(25.4% 0.012 255 / 0.7)`, search bg `oklch(96.8% 0.006 250 / .5) ↔ oklch(17.8% 0.006 250 / 0.5)`,
segmented track `oklch(96.5% 0.008 250) ↔ oklch(18.3% 0.008 250)`, segmented hover text `oklch(45% 0.03 255) ↔ oklch(82% 0.021 255)`,
row hover `oklch(96.8% 0.006 250 / .7) ↔ oklch(17.8% 0.006 250 / 0.7)`, unread row `oklch(97.6% 0.014 260) ↔ oklch(16.6% 0.01 260)`,
toggle track `oklch(86% 0.012 255) ↔ oklch(34.2% 0.012 255)`, skeleton mid `oklch(93% 0.01 255) ↔ oklch(23.5% 0.01 255)`,
chat bubble (board) `oklch(93% 0.012 255) ↔ oklch(23.5% 0.01 255)`, bot avatar circle (board) `oklch(97.2% 0.014 255) ↔ oklch(17.2% 0.01 255)`.

### 1.5 Typography

Families (bundle `fonts/*.woff2`, now at `public/client-portal/fonts/`):

| Family | Weights shipped | Use |
|---|---|---|
| Manrope | 400, 500, 600, 700, 800 | All UI (`font-family:Manrope,system-ui,sans-serif`). Note the sidebar uses `font-weight:650` (active item, account name) which synthesises between 600/700. |
| Space Grotesk | 500, 600, 700 | `.metric` (600, `letter-spacing:-.035em`, `tnum`), page `h1` (700 22px/1.2, `-.02em`), date tiles (700 18px) |
| IBM Plex Mono | 500, 600 | `.mono`, `.kbd` (500 10px; 11px in top bar), segmented counts `.cnt` (600 10.5px), drill counts/dates (600 11px / 500 12px), timeline ruler ticks |
| Poppins | 400, 700 (embedded in outer-shell.html:12-13, `font-display:block`) | Intro only; card names use weight 600 (synthesised). |

Text roles (exact `font` shorthands from the source):

| Role | Value |
|---|---|
| Body default (boards) | `13px` Manrope, `-webkit-font-smoothing:antialiased` |
| Sidebar base | `500 13px/1.4 Manrope,system-ui,sans-serif` |
| Sidebar item / sub-item | `13.5px` w500 (active `650`, `#fff`) / `13px`; drawer `14px` / `13.5px` |
| Sidebar badge | `700 11px/1 Manrope` (rail: 11px, 18×18) |
| Sidebar section label | `800 11px Manrope`, `letter-spacing:.12em` (rail `.08em`), uppercase, `#d8b25a` |
| Contact row | name `12.5px/1.3` (`b` 700), role `11.5px #9eadc3`; drawer name `13.5px`, role `12px` |
| Account row | name `13px` w650, sub `11px #a9b6c9` |
| Rail fly-out | header `800 11px/1.3` `.1em` uppercase gold; person header `700 13.5px/1.3` + `500 12px/1.35 #a9b6c9`; items `600 13.5px` |
| Rail tooltip | `700 12px/1.3 Manrope` |
| Top bar crumb | ancestors `13px` w500 `var(--muted)`; current `13px` w600 `var(--fg)`; phone current `15px` w700 |
| Top bar search | `500 13px Manrope`, placeholder "Search", kbd `⌘` `K` (`.kbd` 11px) |
| Top bar notification badge | `700 11px/1 Manrope` (team board, 16×16) / `600 11px` (home, 15×15; `v7x_topbar` board shows 9px) |
| Before / After | `700 12px/1 Manrope`; rail vertical `11.5px`; drawer `13px` |
| Toast | `600 13px Manrope`; Undo `700 12px` |
| Tooltips | runtime `#vp-tip`: `700 12px/1.3`; CSS `[data-tip]`: `700 11.5px/1.25`; rule-14 `.tb`: `700 11.5px/1.3`; `.tipw .tt`: `700 12px/1.3` |
| (i) pop-over | `500 12px/1.45 Manrope`; "Ask VCFO about this" row `font-weight:700`, `var(--primary)` |
| Ask VCFO pill | `700 13px/1 Manrope` |
| Chat window | base `500 13px/1.5`; title `800 14px`; subtitle `11.5px #c7d2e2`; close `400 22px/1`; suggestions `600 12px/1.3`; input `500 14px` (phone `16px`); Send `700 13px`; answer-card title `800 14px/1.35`, body `13.5px/1.55`, why `12.5px/1.5` with label `800 12px`, source `11.5px/1.45 #6b7a90`, button `700 12.5px` |
| Chat board (`#ask-panel`) | title `14px` w700; subtitle `11.5px`; user bubble `13.5px`; answer `14px/1.5`; chips `11px` w700; quick-question rows `500 13px`; buttons `600 12.5px` |
| Drill pop-up | base `500 13px/1.45`; top strip `12px` / link `800 12.5px`; title `700 15px`; sub `500 12px`; tabs `600 12px` + count `600 11px "IBM Plex Mono"`; row `b` w600, `em 500 12px "IBM Plex Mono"`, chip `700 11px`; footer `12px` |
| Timeline editor | `500 13px/1.45`; h2 `800 17px`; buttons `700 13px`; seg `600 12px`; names `700 12.5px`; dates `600 11.5px "IBM Plex Mono"`; ruler month `800 11px`, ticks `600 11px "IBM Plex Mono"` |
| Card section title `.st` | `12px` w800 `.07em` uppercase `var(--navy-ink,var(--navy))` |
| `.lbl` | `10.5px` w800 `.08em` uppercase `var(--muted)` |
| `.chip` | `11px` w700 `.01em` line-height 16px, radius 4px, padding `2px 7px` |
| Intro | wordmark `100` units, `letter-spacing:-2` ("VCFO" 700 + " Suite" 400 `#E76028`); byline "BY" `700 18` `letter-spacing:3.5`; card names `600 15` units; Skip button `700 14px/1 Poppins` `.02em` |

### 1.6 Radii

| Thing | Radius |
|---|---|
| Buttons (`.btn`), icon buttons in boards, chat buttons, drill close, toast Undo | `6px` (owner rule 6: buttons 6 px, badges 4 px, cards ≤12 px, no fully-round buttons) |
| Chips / badges (`.chip`, `.own`, `.kbd`) | `4px` |
| Sidebar items, pill, account row, top-bar icon buttons, search, launcher pill, info pop-over | `8px` |
| Sidebar badge | `6px` (rail `9px`) |
| Before/After track / thumb | `9px` / `7px` |
| Cards `.card`, `.kpi` | `10px` |
| Chat window, drill pop-up, timeline editor, `.dpop`, `.dlg`, rail fly-out | `12px` (chat header `11px 11px 0 0`) |
| Phone sheets | drill `14px 14px 0 0`; chat `16px 16px 0 0` (header `15px 15px 0 0`); mobile `.sheet` `14px 14px 0 0` |
| Chat message bubbles | `10px`, user `10px 10px 2px 10px`, assistant `10px 10px 10px 2px` (board: `12px 12px 4px 12px` / `12px 12px 12px 4px`) |
| Tooltips | `6px` (rail tooltip `7px`) |
| Drawer close button / phone menu button | `10px` |
| Avatars | `50%` / `99px` |

### 1.7 Shadows (exact)

| Element | `box-shadow` |
|---|---|
| `.card` rest (v7.1) | `var(--shadow)` |
| `.card:hover` (v7.1) | `0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)` + `border-color:oklch(54.6% 0.215 263 / .35)`, `translateY(-2px)` |
| Sidebar menu (legacy account menu) | `0 18px 40px -12px rgba(8,20,40,.55)` |
| Drawer | `20px 0 50px -20px rgba(0,0,0,.5)` |
| Toast | `0 18px 40px -14px rgba(8,20,40,.6)` (board `.toast`: `0 16px 40px -14px oklch(21% 0.042 264 / .6)`) |
| Launcher pill | `0 10px 24px -10px rgba(8,20,40,.6),inset 0 0 0 1px rgba(255,255,255,.08)` |
| Chat window | `0 24px 60px -20px rgba(8,20,40,.5)` |
| Chat board panel | `0 2px 4px oklch(32% 0.04 264 / .06),0 18px 48px -12px oklch(21% 0.042 264 / .35)` |
| Answer card | `0 1px 2px rgba(15,27,45,.04),0 8px 20px -14px rgba(15,27,45,.25)` |
| Drill pop-up (runtime) | `0 30px 70px -20px rgba(8,20,40,.6)`; board `oklch(15% 0.05 258 / .6)` |
| Timeline editor | `0 30px 80px -20px rgba(8,20,40,.6)` |
| Info pop-over | `0 12px 32px -12px oklch(21% 0.042 264 / .35)` |
| Rule-14 `.tb` tooltip | `0 8px 20px -8px oklch(15% 0.05 258 / .55)`; `[data-tip]` `0 6px 16px -6px oklch(21% 0.042 264 / .5)` |
| Before/After thumb | `0 2px 6px -2px rgba(15,42,74,.55)` |
| Badge ring on panel | `0 0 0 2px var(--panel)`; rail badge `0 0 0 2px #0f2a4a` (dark `#000`) |

### 1.8 Spacing / sizes (shell)

| Item | Size |
|---|---|
| Sidebar width | `248px` desktop; rail `72px`; drawer `min(320px,88vw)` |
| Sidebar logo row | `64px` high, padding `0 18px`, logo img height `34px` (rail: `58px` row, img `36px` max-w `48px`; drawer header `60px`, img `30px`) |
| Nav padding / gap | `12px 8px` / `2px` (rail `8px 12px`; drawer `10px 8px`) |
| Nav item | height `36px`, padding `0 10px`, gap `11px`, icon 16px (rail: 40px tall, icon 20px; drawer 44px) |
| Sub-item | height `32px`, `padding-left:37px`, `margin-top:2px`; dot 5px at `left:16px`; guide line at `left:18px` (drawer 40px) |
| Team block | `padding:10px 8px 8px`, `margin-top:auto` (rail `8px 12px 4px`) |
| Contact row | height `38px`, padding `0 8px`, gap `9px`, avatar `26px` (rail 40px / avatar 30px; drawer auto, avatar 32px, action buttons 40×40 radius 9) |
| Contact action buttons | `24×24`, radius 6, gap 3, strip `right:6px`, `padding-left:14px` |
| Account row | `padding:8px 10px 12px`; inner `padding:6px`, gap 10; avatar `30px`; sign-out `30×30` radius 7 |
| Top bar | height `52px`, padding `0 16px`, gap `12px`; icon buttons `36×36`; crumb icon tile `24×24` r8 (icon 13px); search `256px×36px` (`196px` ≤1279 team board; collapses to 36px square ≤959 team / ≤1099 home / ≤1279 docs); phone: buttons 40×40, padding `0 12px` (docs `0 8px`), gap 8 |
| Before/After | `168×32`, padding 3, gap via grid `1fr 1fr`; rail vertical `56×66`; drawer full width × `46px`; desktop slot margin `0 6px`, absolute-board placement 10px left of Search |
| Phone fallback band | `56px`, menu button `40×40` r10 navy, mark `28px` high |
| Ask VCFO pill | height `var(--vpl-ph)` (36/40), padding `0 14px 0 12px`, gap 7, margin-bottom `var(--vpl-in)` |
| Chat window | `width:clamp(340px,24vw + 40px,440px)`; `height:min(clamp(480px,62vh,680px),calc(100dvh - var(--vpl-lift,0px) - var(--vpl-in) - var(--vpl-ph) - 26px - var(--vpk-w) * .6))`; bottom `calc(var(--vpl-lift,0px) + var(--vpl-in) + var(--vpl-ph) + 14px)` |
| Toast | bottom `64px` (≤700px: `100px`), `max-width:min(560px,calc(100vw - 32px))`, padding `10px 12px 10px 14px`, gap 12 |
| Drill pop-up | `width:min(600px,100%)`, `max-height:calc(100vh - 120px)`; scrim `padding:max(72px,8vh) 16px 16px` |
| Page padding (boards) | `.pg{padding:24px;gap:16px}` (≤760: 16px); home grid `padding:clamp(12px,2vw,24px)`, gap 16, `max-width:1600px` |

### 1.9 Z-index ladder (exact)

| Layer | z-index |
|---|---|
| Intro `#vi` (outer document, over the iframe) | `5` |
| Pinned board sidebar placeholder (sticky) | `30` |
| Pinned top bar (`[data-vp="top"]`, sticky) | `40` |
| Phone fallback band `.vps-mbar` | `44` |
| Sidebar `.vps` / `#vp-side` | `45` |
| Rail fly-out `.vps-fly` / rail tooltip `.vps-tip` | `60` / `61` |
| Board-level: `.ov` 20, `.toast` 25 (inc 30), focus-within lift 30, `.info .pop` 40, `.tb` tooltip 45, `.scrim` 60, `.tipw .tt` 60, `[data-tip]::after` 70, board drill scrim 200 / dialog 201 | as listed |
| Cards that host a z-201 pop-up | `2147481500` (`transform:none`) |
| Overlays `.ov`, `.ddscrim`, `#vp-drill-scrim` | `2147482000`; `.dd` `2147482001` |
| Launcher `#vp-launch` / chat `#vp-chat` | `2147482500` / `2147482501` |
| Prototype bar `#vp-bar` / `#vp-mini` | `2147483000` |
| Toast `#vp-toast` | `2147483001` |
| Runtime tooltip `#vp-tip` | `2147483002` |
| Drawer scrim / drawer, timeline editor scrim | `2147483100` / `2147483101`, `#tle-scrim` `2147483100` |
| Phone home (`mobile.html`): bar 20, scrim 60, sheet 61, drawer 62 | |

### 1.10 Breakpoints

| Rule | Where |
|---|---|
| **phone ≤767px · tablet 768–1279px · desktop ≥1280px** (`<html data-vp-bp>`; event `vcfo:bp` `{bp, sideW}`) | shell.js:6,30 |
| Rail compaction when `max-height:740px` (items 36px, logo row 52px, hide "Team" label) | shell.js:222 |
| Launcher pill 40px, chat → bottom sheet, prototype bar hidden while chat open | `max-width:767px` (proto.js:321,404-406) |
| Toast moves to `bottom:100px`, prototype bar to top | `max-width:700px` (proto.js:150) |
| Drill pop-up → bottom sheet (`border-radius:14px 14px 0 0;max-height:86vh`) | `max-width:700px` (proto.js:708) |
| "Mobile" device for routing (phone screens) | `innerWidth < 700` unless `vcfo.device` stored (proto.js:94) |
| Top bar search collapses to icon | ≤1279 (docs), ≤1099 (home `.vh-search`), ≤959 (team; 196px wide ≤1279) |
| Home grid | ≥600 two columns, ≥1180 desktop areas, ≥1800 three columns; `.vh-hide-xs` ≤479 |
| Drill board `.vh-dd` wraps tabs, drops date column | ≤640 |
| Timeline editor | ≤1023 (narrower columns), ≤767 (bottom sheet) |
| `.pg` padding 16, `.hide-sm` | ≤760 |
| Touch: (i) hit area +11px | `@media (pointer:coarse)` |
| Intro layout | `innerWidth/innerHeight < 1.05` → square, else wide |

### 1.11 Motion: easings, durations, keyframes (verbatim)

Easings in use:
- Sidebar active pill / rail and Before|After thumb: `cubic-bezier(.22,1.2,.36,1)` .42s (spring-ish overshoot).
- Spring "springSnappy (420/32/0.8)" as CSS `linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)` .42s — segmented-pill thumb (`.seg>.thumb`), board sidebar pill `.spill/.srail`, toggles `.tgl::after`, phone sheet (.38s).
- Standard out: `cubic-bezier(.22,1,.36,1)` (drawer .32s, chat .26s, drill .24s, editor .26s, toast .22s, group expand .3s, chevron .28s, page enter .26s, fly-out .18s).
- Launcher rise back: `cubic-bezier(.34,1.45,.5,1)` .5s; duck: `cubic-bezier(.5,0,.75,.4)` .32s.
- Tooltips: `.12s` opacity/transform (runtime 120 ms show delay); rule-14 `.tb` `.14s`; info pop-over `.15s`.

Reduced motion: every block has a `@media (prefers-reduced-motion: reduce)` counterpart (listed with each excerpt below); the boards also
have the global `*,*::before,*::after{animation:none!important;transition:none!important}`.

All keyframes used by the shell/runtime (verbatim):

```css
/* shell.js:203 · rail fly-out */
@keyframes vpsfly{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
/* proto.js:137 · page enter (html.vp-enter body, .26s cubic-bezier(.22,1,.36,1) both); page leave = html.vp-leave body{opacity:.35;transition:opacity .14s} then navigate after 140 ms */
@keyframes vpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
/* proto.js:349-352 · launcher character loop, 20.5 s, from v7-inputs/visor-avatar-animated.svg (scoped .vpv-loop) */
@keyframes vpvRise{0%,2.4%{transform:translateY(232px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}14.1%,25.4%{transform:translateY(72px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}33.2%,40%{transform:translateY(44px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}48.3%,66.3%{transform:translateY(0);animation-timing-function:ease-in-out}74.6%,80%{transform:translateY(72px);animation-timing-function:cubic-bezier(.5,0,.75,.4)}89.3%,100%{transform:translateY(232px)}}
@keyframes vpvLook{0%,14.1%{transform:translate(0,0)}15.5%,19.5%{transform:translate(-12px,-2px)}21%,24%{transform:translate(12px,-2px)}25.5%,50%{transform:translate(0,0)}51.5%,55%{transform:translate(-12px,3px)}56.5%,60%{transform:translate(12px,-4px)}61.5%,74.6%{transform:translate(0,0)}76%,79%{transform:translate(10px,-3px)}80.5%,100%{transform:translate(0,0)}}
@keyframes vpvBlink{0%,25.6%,26.4%,34.4%,35.2%,35.8%,36.6%,63%,63.8%,100%{transform:scaleY(1)}26%,34.8%,36.2%,63.4%{transform:scaleY(.08)}}
@keyframes vpvGrip{0%{opacity:0;translate:0 14px}2.4%,89.3%{opacity:1;translate:0 0}91.5%,100%{opacity:0;translate:0 16px}}
/* proto.js:371 · typing dots */
@keyframes vpTh{0%,100%{opacity:.3}50%{opacity:1}}
/* proto.js:390-393 · peek over the chat window, once per open */
@keyframes vpvPeek{from{transform:translateY(232px)}to{transform:translateY(0)}}
@keyframes vpvGripIn{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}
@keyframes vpvPeekLook{0%,100%{transform:translate(0,0)}14%,38%{transform:translate(-12px,-2px)}52%,78%{transform:translate(12px,-2px)}}
@keyframes vpvPeekBlink{0%,3%,6%,100%{transform:scaleY(1)}4.5%{transform:scaleY(.08)}}
/* proto.js:399-401 · moods */
@keyframes vpvAnt{50%{opacity:.3}}
@keyframes vpvHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}}
@keyframes vpvDip{0%,100%{transform:translateY(0)}35%,70%{transform:translateY(14px)}}
/* b/ecdc…css:18-19,94-104,118,150,166-167 · board motion */
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes v7fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes v7up{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
@keyframes v7bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes v7react{0%{transform:scale(.9)}45%{transform:scale(1.1) rotate(-4deg)}75%{transform:scale(.98)}100%{transform:none}}
@keyframes v7think{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes v7pulse{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .7)}50%{box-shadow:0 0 0 5px oklch(80% 0.12 85 / 0)}}
@keyframes sk{0%{background-position:-200px 0}100%{background-position:200px 0}}
@keyframes tipin{from{opacity:0;transform:translate(-50%,3px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes tipin2{from{opacity:0}to{opacity:1}}
/* b/5c039…css:186 · Incorporation skeleton */
@keyframes shimmer{to{background-position:-200% 0}}
/* vh responsive layer (home boards) · pop-over / tooltip fade */
@keyframes vhfade{from{opacity:0}to{opacity:1}}
/* s/home/v7c_bot.dc.html:144,146 · static bot moods (board) */
@keyframes vbScan{0%,100%{transform:translateX(-9px)}50%{transform:translateX(9px)}}
@keyframes vbAnt{50%{opacity:.35}}
/* b/9459…css:16-18 · flow charts (Focus track) */
@keyframes flspin{to{transform:rotate(360deg)}}
@keyframes flsheen{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes flring{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .65)}50%{box-shadow:0 0 0 7px oklch(80% 0.12 85 / 0)}}
/* s/home/mobile.html · phone home */
@keyframes rise{from{transform:translateY(120px)}to{transform:none}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes th{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes sh{0%{background-position:-300px 0}100%{background-position:300px 0}}
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
/* s/home/v7x_launcher_concept.dc.html:141 · superseded launcher concept (spring rise) */
@keyframes v7rise{0%{transform:translateY(100%)}55%{transform:translateY(-8%)}75%{transform:translateY(2%)}100%{transform:translateY(0)}}
```

Usage timings: `.card`/`.kpi` `up .5s cubic-bezier(.2,.7,.2,1) backwards`; `.bar>span`/`.stack>span` `grow .9s cubic-bezier(.2,.7,.2,1) .2s backwards`;
`.stag>*` `v7fade .2s cubic-bezier(.22,1,.36,1) both` (staggered .06s by the boards); `.botup` `v7up .45s cubic-bezier(.22,1,.36,1) .5s both`;
`.bob` `v7bob 2.6s ease-in-out infinite`; `.react` `v7react .55s cubic-bezier(.22,1,.36,1) both`; `.dot1/.dot2/.dot3` `v7think 1s` with 0/.2/.4s delays;
`.pulse` `v7pulse 1.8s ease-in-out infinite` (current-step gold pulse); `.sk` `sk 1.2s linear infinite`; `[data-tip]` `tipin .12s ease both`;
`.vb-scan` `vbScan 1.3s ease-in-out infinite`; `.vb-ant` `vbAnt 1s ease-in-out infinite`; `.spin` `flspin 1.4s linear infinite`; `.ringpulse` `flring 1.8s ease-in-out infinite`;
`.fb-seg.cur::after` `flsheen 1.8s ease-in-out infinite`.

Intro (outer-shell.html:65-196) is JS-driven, not CSS keyframes — see §4.10 for the full timeline.

### 1.12 Persisted client state (prototype) → real-app owner

| Key | Storage | Meaning | Real app |
|---|---|---|---|
| `vcfo.theme` | localStorage (JSON) | `light|dark|system` | next-themes storage (keep per-device) |
| `vcfo.navOpen` | localStorage | `{updates:bool, compliances:bool}` group open state | localStorage (per-viewer convenience) |
| `vcfo.after` | localStorage | Before/After incorporation | **derived from data** (`ClientOverview.incorporated`), see B-01 |
| `vcfo.skipIntro` | localStorage raw `'1'` | never play intro | localStorage / profile pref |
| `vcfo.pill-full`, `vcfo.pill-rail` | sessionStorage | last pill y/h, so the pill slides from the previous screen's item | in-memory React state across route changes (layout persists) |
| `vcfo.chat` | sessionStorage | chat log `[{r:'u'|'a', t, w?, h?, k?}]` | `ask_conversations` / `ask_messages` (+ `vcfo.ask.conv.*` session key already used by `AskProvider`) |
| `vcfo.openChat` | localStorage | open chat once on next load | URL param `?ask=1` / AskProvider state |
| `vcfo.device`, `vcfo.barHidden` | localStorage | prototype controls only | drop |
| `vcfo.tl.saved`, `vcfo.tl.pending`, `vcfo.tl.mode` | sessionStorage | timeline editor | `engagements.schedule` + `engagement_change_requests` |

---

## 2 + 3. INVENTORY with proposed mapping

Legend for "Real app": EXISTS = already in the repo (path); ADAPT = exists but needs restyle/behaviour change; NEW = to build (front-end piece / backend piece).
Client routes in the real app: `/app/client/overview` (Home), `/app/client/announcements`, `/app/client/notifications`, `/app/client/incorporation`
(+ `/step/...`), `/app/client/compliances/calendar`, `/app/client/compliances/filings`, `/app/client/documents`, `/app/client/library`
(+ `/[id]`), `/app/client/team`, `/app/client/audit`, `/app/client/settings`, `/app/client/board-resolution`. No `/app/client/credentials` yet.

### 2.1 Intro / splash

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| I-01 | Intro overlay `#vi` | Fixed full-screen white stage (`--stage:#fff`), z 5, grid-centred SVG, padding `max(12px,env(safe-area-inset-*))`. Plays once per page load over the app iframe, which is `inert` + `aria-hidden` until the intro leaves. | outer-shell.html:15-19,28-52,56-63 | NEW `src/components/client-portal/Intro.tsx` mounted by the client layout on first load (sessionStorage flag "played this session" is the natural equivalent of "once per page load"). |
| I-02 | Layout choice | `innerWidth/innerHeight < 1.05` → `square` (viewBox `40 160 720 540`, SVG `min(92vw,640px)×min(78vh,560px)`), else `wide` (viewBox `72 50 1000 400`, SVG `min(92vw,max(62vw,560px),1500px)×min(70vh,560px)`); re-evaluated on resize. | outer-shell.html:18-19,93-96,139-155 | same, in the component |
| I-03 | Timeline (7.0 s, fade at 6.4 s) | Cards 0..2 (Incorporation `#FFC517` text `#3D2A00`, Registrations `#F08A21`, Compliances `#E76028`, white text) grow from the baseline: card i over `[0.35+0.7i, 1.10+0.7i]` s with `easeBack` (c1 1.4) scaleY, opacity `clamp(p*8)`; names fade in over `[0.35+0.5j, 0.75+0.5j]`, are hidden as the next card covers them, all fade out 2.85→3.1 s; stack pulse `1+sin(π·seg(3.15,3.6))·0.04`; white "V" wipes up 3.05→3.5 (easeOut); stack moves/scales to logo position 3.7→4.5 (easeInOut cubic); wordmark "VCFO Suite" reveals left→right 4.1→5.0 (clip 640 units); "BY [SBC logo]" fades/rises 8px 4.8→5.4. Frame clock caps each frame at 50 ms so a busy main thread pauses rather than jumps. | outer-shell.html:65-137,185-191 | port the same JS into a `requestAnimationFrame` hook (keep the math verbatim, §4.10) |
| I-04 | Small-screen start scale | `s0 = max(1, min(L.s1, 11.5/(15·ppu)))` so card names are ≥11.5 CSS px; `s1` = 1.55 wide / 1.8 square | outer-shell.html:152-154 | same |
| I-05 | Skip button `#vi-skip` | Top-right `max(16px,env(safe-area-inset-*))`, `min-height:44px;min-width:72px;padding:0 20px;border-radius:999px;background:#EDEBE7;color:#17140F;font:700 14px/1 Poppins` (hover `#E2DFD9`, focus `3px solid #F08A21` offset 2). Click or `Esc` → jump to the finished logo (`finish()`); hidden (`opacity:0`) once ended. | outer-shell.html:20-23,51,175-183,192,196-198 | same |
| I-06 | Leave | Fades out (`opacity .55s ease`, class `out`) only when the timeline ended AND the first app screen reported ready (`__vcfoIntro.ready()` on iframe load, then +150 ms); a 12 s safety timer forces it. Removes itself after `transitionend` (or 800 ms), restores focus to the app if it held focus. | outer-shell.html:157-183,195,360-370 | "ready" = client layout's first data (overview query) settled |
| I-07 | Opt-out | `localStorage['vcfo.skipIntro']==='1'` → intro never shows | outer-shell.html:59-62 | NEW pref (localStorage) |
| I-08 | Reduced motion | Shows the finished logo still for ~1 s then fades (`transition-duration:.3s`) | outer-shell.html:24,201-205 | same |
| I-09 | Fonts | Poppins 400/700 embedded as data-URI woff2, `font-display:block`; `document.fonts.load` before starting | outer-shell.html:12-13,207 | NEW: add Poppins 400/700 (+600, since names use 600) to `public/client-portal/fonts/` (not there yet) |

### 2.2 Sidebar (desktop 248 px), rail (tablet 72 px), drawer (phone)

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| S-01 | Breakpoint contract | `<html data-vp-bp>` + `--vp-side-w`/`--vps-w` = 0/72/248; `vcfo:bp` event on change; board column `width:var(--vp-side-w,248px);flex:none` | shell.js:5-15,28-38 | ADAPT `src/components/shell/AppShell.tsx` (today it pads `lg:pl-[15.5rem]` for clients); NEW `useBreakpoint()` hook (phone/tablet/desktop) or pure CSS media queries |
| S-02 | Sidebar container `#vp-side.vps` | `position:fixed;top:0;left:0;height:100vh` (`100dvh` where supported); bg `#0f2a4a`; `font:500 13px/1.4 Manrope`; scrolls vertically with hidden scrollbar; z 45. Covers the page's placeholder column (which is hidden). | shell.js:116-124,446-485 | ADAPT `src/components/shell/RoleSidebar.tsx` (client branch) or NEW `ClientSidebar.tsx` inside the portal shell |
| S-03 | Logo row | 64 px, `padding:0 18px`, bottom border `rgba(255,255,255,.08)`; `<img>` `brand/vcfo-logo-on-black.png` height 34 (object-fit contain, left); link → Home, `aria-label="VCFO Suite · Home"` | shell.js:42,125-126,272 | asset EXISTS `public/client-portal/vcfo-logo-on-black.webp` (CHANGES.md #1 says "on-dark" for the navy sidebar: `vcfo-logo-on-dark.webp` is the owner input; the bundle used on-black). Link → `/app/client/overview` |
| S-04 | Nav model | Home · Updates (group: Announcements, Notifications) · Incorporation · Compliances (group: Calendar, Filings) · Documents · Library · Credentials · Team · Audit · Settings. Lucide icons (stroke 2): layout-dashboard, megaphone, building-2, calendar-check, folder-open, library, key-round, users, history, settings. | shell.js:72-102 | ADAPT `clientItems` in `RoleSidebar.tsx:144-153` (add Credentials + Settings, icons as listed, labels as listed; DECISIONS.md says the sidebar name is "Knowledge Bank" but the FINAL shell shows "Library") ; Credentials → NEW route `/app/client/credentials` |
| S-05 | Nav item | `36px` tall, `padding:0 10px`, gap 11, radius 8, `13.5px` w500 `#c3cddc`; icon `#9aa8bd`; hover bg `rgba(255,255,255,.06)`, text `#fff`, icon `#c9d6ea` (.15s). Active (`aria-current=page`): `#fff`, w650, icon `#a9c3ff`. | shell.js:130-136 | style in portal CSS (`20-shell.css` in progress) |
| S-06 | Active pill + rail | One absolutely-positioned pill (`left/right:8px`, h = item height, radius 8, `rgba(255,255,255,.1)` + inset ring) and a 3×20 `#6e96ff` rail at `left:8px`, centred on the item. Both slide with `transform .42s cubic-bezier(.22,1.2,.36,1)` (pill height .3s). On a new screen the pill starts where it was on the previous screen (sessionStorage `vcfo.pill-<mode>`) and slides to the new item two frames later. Hidden if no current item. If the active child's group is collapsed, the pill sits on the group header. | shell.js:128-129,347-361,477-480 | EXISTS `src/components/shell/MotionActivePill.tsx` (framer-motion) — ADAPT to these exact metrics/colours; because the Next layout persists across routes, no sessionStorage needed |
| S-07 | Badges | `min-width:20px;height:20px;padding:0 6px;border-radius:6px;font:700 11px/1`, bg `rgba(255,255,255,.1)`; hot = `#d93a3a`. Updates "3" (hot), Notifications "3" (hot), Incorporation "6/14" before / "14/14" after, Documents "6". | shell.js:93-96,137-138,269-270 | NEW data: Updates/Notifications = unread notifications (EXISTS `/api/notifications?head=1`, `NotificationsBell` already computes `unreadNotificationCount`); Incorporation = SPICe+ steps done/total from `GET /api/client/overview` (`progress`); Documents = open document requests count (EXISTS `/api/requests` / `document-requests.ts`) — confirm meaning with owner |
| S-08 | Groups (Updates, Compliances) | Header button with chevron (`#8c9ab0`, rotates 90° when open, .28s). Open state from `localStorage vcfo.navOpen`, default = open if it holds the current page. Expand/collapse animates `grid-template-rows:0fr→1fr` .3s; collapsed children are `inert`/`tabindex=-1`/`visibility:hidden`. When open the header badge fades/scales out (`opacity:0;scale(.6)`). Pill follows the animation for 20 frames. | shell.js:139-149,284-289,413-419 | EXISTS `src/components/shell/SidebarNavGroup.tsx` — ADAPT visuals (guide line `left:18px`, 5 px dots at `left:16px`, sub items 32 px `padding-left:37px`) |
| S-09 | Clicking current page | Toast "You are already on <label>" (except Home) | shell.js:427 | trivial in the nav component (optional) |
| S-10 | Team section label | "Northwind’s team" (`<company>’s team`), `800 11px` `.12em` uppercase `#d8b25a`, `margin:0 8px 6px`; block `margin-top:auto`, `padding:10px 8px 8px`, top border `rgba(255,255,255,.1)` | shell.js:150-151,294 | company name from `ClientOverview.engagement.companyName` |
| S-11 | Team contact rows | Priya Raman · Project Manager (PR), Arjun Mehta · Project Lead (AM): 38 px row, 26 px initials avatar, `<b>Name</b> <small>· Role</small>` on one ellipsised line (12.5/11.5px). Row is `tabindex=0 role=group aria-label="<name>, <role> · contact"`. | shell.js:105-109,152-157,295-299 | EXISTS data: `ClientOverview.team` (`loadTeam` in `src/db/repositories/client-overview.ts:90-113`: name, email, role 'Project Manager' / 'Project Lead'). NEW: phone (`profiles.phoneE164`) + avatar (`profiles.avatarObjectKey`, EXISTS `/api/account/avatar`) must be added to the team DTO |
| S-12 | Contact hover actions | On row hover or focus-within, a strip fades in at the right (`opacity .15s`) over a gradient `linear-gradient(90deg,rgba(22,50,80,0),#163250 14px)`: 24×24 r6 buttons WhatsApp (green `#1f8f5a`, hover `#25a468`), Call, Email, Teams (hover `rgba(255,255,255,.22)`, active `scale(.94)`); each `aria-label="<Verb> <Name>"`. Click → toast "Opening <Verb> <Name>…". | shell.js:110,158-163,274 | NEW behaviour: WhatsApp `https://wa.me/<E164 digits>`, Call `tel:`, Email `mailto:`, Teams `https://teams.microsoft.com/l/chat/0/0?users=<email>`; hide a verb when its datum is missing. Pure front-end once the DTO has phone. |
| S-13 | Customer support row | "Customer support · SBC help desk" (headset icon avatar), verbs order WhatsApp, Email, Teams, Call (`aria-label "... support"`). Legacy board shows "Farhat · +91 90597 90014". | shell.js:108,273,274 | NEW config: support contact from env (`SUPPORT_WHATSAPP_E164`, `SUPPORT_EMAIL`, `SUPPORT_TEAMS_UPN`, `SUPPORT_PHONE`) exposed via a small `GET /api/client/support-contact` or server-rendered prop (never hard-code, golden rule 4) |
| S-14 | Account row | 30 px `#2e5cff` initials avatar "RK", **Rohan Kumar** / "Northwind · Client" (13px w650 / 11px `#a9b6c9`) + 30×30 sign-out icon button (`aria-label`/`data-tip` "Sign out"; hover bg `rgba(255,255,255,.12)`, `#fff`). Read-only (the old menu with Settings / Help · Ask VCFO / Sign out is still in code, unused on desktop). | shell.js:111,164-176,300-303 | EXISTS session user (`useApp().user`), Auth.js `signOut()`; avatar via `UserFace` (`src/components/common/UserFace.tsx`) |
| S-15 | Sign out | Prototype: toast "Signed out · this is a prototype, so you stay on the page" | shell.js:424 | `signOut({ callbackUrl: '/login' })` |
| S-16 | Rail (tablet) | 72 px; logo row 58 px with `brand/vcfo-mark.png` (36 px, max-w 48); items 40 px icon-only (20 px icons), labels visually hidden; badges become 18 px dots at `top:3px;left:calc(50% + 3px)` with `0 0 0 2px #0f2a4a` ring; groups show a 5 px corner triangle (`#7f90a9`). Under the nav: vertical Before/After (56×66). Team block: label "Team" (centred, `.08em`), each person = 40 px button with a 30 px avatar. Account = avatar + sign-out stacked. `max-height:740px` compaction. | shell.js:183-200,221-225,308-329 | NEW rail variant of the client sidebar (MotionActivePill reused) |
| S-17 | Rail tooltips | Every rail control has `data-tip`; hover/`:focus-visible` shows `.vps-tip` 8 px to the right of the rail, vertically centred, `opacity/transform .12s` (`translateX(-4px)` → none); hidden on scroll, pointerdown, leave, and while a fly-out is open for that button. Tip texts: "Home", "Updates · 3 new", "Incorporation · 6/14 steps", "Documents · 6", "<Name> · <Role>", "Sign out", "Show the company before or after incorporation". | shell.js:212-213,315-326,386-404 | ADAPT `src/components/ui/tooltip.tsx` (Radix) with `side="right"`, 8 px offset, rail-tip styling |
| S-18 | Rail fly-outs | Groups, people and account open a `role=menu` fly-out (`#143457`, r12, min-w 212) 8 px right of the rail, top aligned to the button −6 px (account: bottom-aligned), clamped to the viewport; `vpsfly .18s`. Group fly-out: gold header + child links (active = `inset 3px 0 0 #6e96ff`). Person fly-out: name/role header + 40 px rows "WhatsApp / Call / Email / Teams" with icons. Opened by keyboard → focus first item; Esc closes and returns focus; click outside / scroll closes. Toggling the same button closes. | shell.js:201-211,330-344,364-383,433-436 | NEW (Radix `DropdownMenu` with `side="right"` fits: EXISTS `src/components/ui/dropdown-menu.tsx`) |
| S-19 | Phone drawer | `#vp-drawer` `width:min(320px,88vw)`, slides `translateX(-102%)→0` `.32s cubic-bezier(.22,1,.36,1)`, shadow `20px 0 50px -20px rgba(0,0,0,.5)`; scrim `rgba(8,20,40,.45)` fades .25s. `role=dialog aria-modal`, `inert` while closed, focus moves to the × on open, Tab is trapped, Esc / scrim / × close and focus returns to the opener. Header 60 px: logo (30 px) + 40×40 r10 × button. Then the full-width Before/After (46 px). Items 44 px (sub 40 px). Contact rows show name + role on two lines and the verb buttons always visible (40×40 r9). Opens from any `[data-vp-menu]` / `aria-label="Open menu"` button or `window.vcfoOpenSide()`. Closes automatically when the viewport leaves phone size. | shell.js:230-251,278-305,487-516,595-597 | EXISTS `MobileNavSheet` in `RoleSidebar.tsx` + `src/components/ui/sheet.tsx` (Radix Dialog) — ADAPT to these metrics |
| S-20 | Phone fallback band | If a phone screen has no visible menu button, a 56 px white band (`light-dark(#fff, oklch(13% 0 89.9))`, `box-shadow:0 1px 0 #e3e8ef`) is added with a 40×40 navy menu button + VCFO mark (28 px); body padded by `--vp-menu-offset`. | shell.js:252-257,518-530 | not needed if the real top bar always renders the phone menu button (T-02) |
| S-21 | Phone VCFO mark next to the hamburger | `img.vp-mlogo` (26 px high, max-w 44) inserted after the board's menu button if within the top 80 px | shell.js:260,532-537 | part of the phone top bar (T-02) |
| S-22 | Favicon | `brand/vcfo-icon.png` | shell.js:266 | `app/icon.*` / metadata (asset EXISTS `public/client-portal/vcfo-icon.webp`) |
| S-23 | Sidebar focus ring | `outline:2px solid #8fb4ff;outline-offset:2px;border-radius:8px` | shell.js:123 | portal CSS |
| S-24 | Reduced motion | pill, rail, sub, chevron, drawer, menu, B/A thumb, tips: `transition:none`; fly-out no animation | shell.js:261 | same |
| S-25 | Sidebar + top bar stay fixed while the page scrolls | `pinNav()` makes the board sidebar sticky (`top:0;height:100vh;z 30`) and the top header sticky (`top:0;z 40`), un-clipping overflow ancestors | proto.js:634-658 | EXISTS: AppShell already has `sticky top-0` top bar and a fixed sidebar |
| S-26 | Dark theme on the sidebar | `#000!important`, `inset -1px 0 0 oklch(20% 0.008 260)`, active item bg `oklch(17% 0.02 260)`, rail badge ring `#000` | proto.js:60-63 | portal CSS (already in `00-tokens.css` generated file) |

### 2.3 Top bar

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| T-01 | Bar | `height:52px;display:flex;align-items:center;gap:12px;padding:0 16px`; bottom border `light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6))`; bg `light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))` + `backdrop-filter:saturate(1.4) blur(10px)` (team board); sticky z 40. Order: [phone menu] · SBC logo · location trail · (right) [Before/After] · Search ⌘K · Announcements · Notifications · Theme. **No profile, no Ask VCFO button** (DESIGN-RULES rule 2). | s/team/topbar.dc.html:15-46,50-69; s/home/v7_before.dc.html:249; s/docs/topbar.dc.html:22-53 | ADAPT `src/components/shell/TopBar.tsx` for the client role: remove `AskLauncher` and profile/UserFace from the client top bar; keep `AnnouncementsBell`, `NotificationsBell`, `ThemeToggle`, `CommandPalette` |
| T-02 | Phone menu button | ≤767 only: 40×40 r8, transparent, `margin-left:-6px`, hamburger 20 px (`M4 6h16 M4 12h16 M4 18h16`), `data-vp-menu`, `aria-label="Open menu"`; opens the drawer. On phone the logo, crumb icon, ancestors and theme toggle hide; current page title shows at `15px` w700; right buttons become 40×40 and the search box becomes a transparent 40 px icon. | s/team/topbar.dc.html:16-18,37-46,51 | ADAPT TopBar (EXISTS `MobileNavSheet` trigger) |
| T-03 | Logo | `<a aria-label="SBC home">` img height 26 (`b/58222…png` = `public/client-portal/sbc-logo-top.webp`); tooltip "SBC home" is suppressed as obvious; phone docs board 22 px | s/team/topbar.dc.html:52 | EXISTS `src/components/brand/SbcLogo.tsx` — check it renders this same art; link → Home |
| T-04 | Location trail | `nav[aria-label=Location]`: 24×24 r8 icon tile (`--primary-light` bg, `--primary` icon, 13 px Lucide-style page icon) + `ol` crumbs: ancestors `13px` w500 `--muted` (links), separators `/` in `--subtle` (team/docs boards) or a 12 px chevron `M9 6l6 6-6 6` in `light-dark(oklch(45% 0.03 255 / .45), oklch(82% 0.021 255 / 0.45))` (home `v7x_topbar` board), current page `13px` w600 `--fg`, `aria-current=page`. Long trails truncate each crumb (`min-width:28px`, current `min-width:48px`, ellipsis); the right group never moves. Pattern: Home / [mid] / Current. | s/team/topbar.dc.html:53-61,72-87; s/home/v7x_topbar.dc.html:144 ("Long trail") | EXISTS `src/components/shell/shell-crumbs.ts` (+ tests) — ADAPT rendering |
| T-05 | Search ⌘K | Button `aria-label="Search (⌘K)"`, 256×36 r8, border/bg per §1.4, 14 px search icon in `oklch(54.6% 0.215 263 / .8)`, "Search" label + `⌘` `K` kbd chips; `cursor:text`. Collapses to a 36 px icon at the breakpoints in §1.10. In the prototype desktop click only shows the toast "Search · type to find steps, filings and documents"; on the phone home it opens a bottom sheet "Search" with a 44 px input ("Search steps, filings, documents") and 3 result rows (step / document / filing) that navigate. | s/team/topbar.dc.html:26-28,31-34,63; proto.js:245; s/home/mobile.html:375-376 | EXISTS `src/components/shell/CommandPalette.tsx` (cmdk, client group at :391-399, knowledge-bank search) — ADAPT trigger styling; on phone render the palette as a bottom sheet |
| T-06 | Announcements | 36×36 r8 icon button (megaphone, duo-tone fill `.26`); active page = `--primary-light` bg + `--primary` icon; an 8 px gold dot (`top/right:6px`, ring `0 0 0 2px var(--panel)`) when there is something new and you're not on Announcements. Click → Announcements page. | s/team/topbar.dc.html:64; proto.js:231 | EXISTS `src/components/shell/AnnouncementsBell.tsx` (unread count, popover) + `/api/announcements` — ADAPT: gold dot instead of count, navigate to `/app/client/announcements` |
| T-07 | Notifications | 36×36 bell; when unread: `--primary-light` bg / `--primary` icon (stroke 2.25) and a badge (16×16 r99 `--primary-fill` bg, `700 11px/1`, ring `0 0 0 2px var(--panel)`, `top/right:3px` team / `4px` home); `aria-label="Notifications, 3 new"`. Click → Notifications page. | s/team/topbar.dc.html:30,65; s/home/v7_before.dc.html:249 | EXISTS `src/components/shell/NotificationsBell.tsx` + `/api/notifications` — ADAPT visuals |
| T-08 | Theme toggle | 36×36 r8, `1px solid var(--border)`, `--panel` bg, `--muted`, 16 px sun icon (stroke 1.7); hidden on phone (lives nowhere else on phone). Toggles light↔dark (see §1.1). | s/team/topbar.dc.html:66; proto.js:7-34 | EXISTS `src/components/common/ThemeToggle.tsx` — ADAPT size/icon + `data-theme` attribute |
| T-09 | Top-bar tooltips | `data-tip` + `data-tip-below` (tooltip under the button); obvious labels (SBC home, Search (⌘K), Announcements, Notifications…) have tooltips removed by `tidyTips()` | s/team/topbar.dc.html:52-66; proto.js:661-674 | Radix tooltip only on the theme toggle |

### 2.4 Before | After incorporation pill

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| B-01 | Pill (desktop) | `role=group aria-label="Before or after incorporation"`, 168×32 track (r9, padding 3) with a sliding navy thumb (`translateX(100%)` when After, `.42s cubic-bezier(.22,1.2,.36,1)`), two `aria-pressed` buttons "Before" / "After" (`700 12px/1`, pressed `#fff`, `.25s` colour). Inserted in the top bar right before Announcements (`#vp-ba-top.vp-ba-slot`, margin `0 6px`); on absolutely-positioned top bars it is placed 10 px left of Search. Re-checked every 600 ms. | shell.js:215-226,539-583 | **Decision needed.** In the real app "before/after" is a fact of the engagement (`ClientOverview.incorporated` = CIN or incorporation date present, `src/db/repositories/client-overview.ts:252`). Proposed: no user toggle for clients; render the pill only for staff previewing a client (super-admin preview already exists in Ask: `AskPreview`) or behind a demo flag. If kept, NEW `useIncorporationView()` context that defaults to the real state. |
| B-02 | Tablet variant | Vertical 56×66 in the rail under the nav (`.vps-bar`, tooltip "Show the company before or after incorporation"), thumb moves `translateY(100%)`, labels 11.5 px | shell.js:221,223-225,320 | same decision |
| B-03 | Phone variant | Top of the drawer, full width × 46 px, labels 13 px, under the header with a bottom border | shell.js:227-229,280 | same decision |
| B-04 | Click | Same value → toast "Already showing the company before/after incorporation"; else store `vcfo.after`, sync all pills + Incorporation badge (6/14 ↔ 14/14), dispatch `document` event `vcfo-after` (pages re-render in place). On Home it navigates to the other Home board (fade 140 ms); elsewhere toast "Showing the company after/before incorporation". | shell.js:544-553,576-582; proto.js:196-219 | n/a if derived; if kept: React context + router refresh |

### 2.5 Ask VCFO launcher (bottom-right, every route)

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| L-01 | Container `#vp-launch` | `position:fixed;right:var(--vpl-in);bottom:0;z-index:2147482500;display:flex;align-items:flex-end;gap:4px;pointer-events:none`. Children: the character (`.vpl-char`, width `--vpl-w`, height `--vpl-w*200/340`, overflow hidden = clipped at the screen edge) and the pill. | proto.js:326-330,565-570 | ADAPT `src/components/ask/AskLauncher.tsx` (today a top-bar text button + ⌘J; the client portal wants this bottom-right launcher instead, keep ⌘J shortcut) |
| L-02 | Character loop | `charSVG('vpv-loop')` = `v7-inputs/visor-avatar-animated.svg` rebuilt inline with per-instance ids; head `vpvRise 20.5s infinite` (rises from 232 → 72 → 44 → 0 (fully up, 48.3–66.3%) → 72 → 232 units), eyes `vpvLook 20.5s ease-in-out`, eyes blink `vpvBlink 20.5s`, hands `vpvGrip 20.5s ease-out` (right hand +.09s, `fill-mode:backwards`). Head is clickable (`pointer-events:visiblePainted`) and toggles the chat. | proto.js:341-352,449-476,568,581 | NEW `src/components/client-portal/VcfoAvatar.tsx` (props `variant: 'loop' | 'peek' | 'head'`, unique ids via `useId()`), CSS from §4.6 |
| L-03 | Ducks ("yield") | `.vpl-lift` translates `0 → 100%` (`.32s cubic-bezier(.5,0,.75,.4)`) while: the page is scrolling (any scroll container; 650 ms after the last scroll it rises back with `.5s cubic-bezier(.34,1.45,.5,1)`), the chat is open, `body.sheet-open`, or the character would cover a control (a 6×4 sample grid of `elementsFromPoint`; a control overlapping >20% of its own area counts). Head is not clickable while yielded. Re-checked every 1 s and on resize. | proto.js:331-333,482-499,558-564,572-574 | NEW hook `useLauncherYield()` (scroll listener capture:true + interval) |
| L-04 | "Ask VCFO" pill | Always visible: `height:var(--vpl-ph)` (36/40), `padding:0 14px 0 12px`, gap 7, r8, `#0f2a4a`, `#fff`, `700 13px/1`, shadow per §1.7, hover `#17396b`, active `scale(.97)`, focus 3 px sky ring. Content: 8 px teal dot (`#2DD4BF`, `0 0 0 3px rgba(45,212,191,.22)`) + "Ask VCFO". Open state: shows a 14 px × + "Close" instead; `aria-label` "Open Ask VCFO chat" / "Close Ask VCFO chat", `aria-expanded`, `aria-controls="vp-chat"`. Hidden (opacity 0) while a phone sheet is open. | proto.js:334-340,569-570,599-609 | ADAPT AskLauncher |
| L-05 | Bottom spacer | `html.vp-endpad body::after` adds a 1 px-wide block of height `--vp-launch-h` (painted with `--vp-endpad-bg`) so the last row can scroll clear of the pill; only switched on when the page scrolls or a control sits under a pill; inner scroll panels ending under a pill get `.vp-endpad-box::after`. `:root{scroll-padding-bottom:var(--vp-launch-h)}`. | proto.js:320,322-324,500-557 | Simplify: `padding-bottom: var(--vp-launch-h)` on the portal `<main>` |
| L-06 | Lift above a sticky action bar | If a page lifts the launcher (launcher bottom > 1 px above the viewport bottom) the spacer is skipped and the chat follows via `--vpl-lift` | proto.js:528-530,563 | expose a CSS var the step page's sticky `.abar` can set |
| L-07 | Board robots hidden | Every board-drawn robot / `#ask-panel` is hidden (`.vp-hide-bot`) so only one launcher exists | proto.js:402,622-631 | n/a |
| L-08 | Phone home owns its chat | `window.__vcfoOwnChat=true` on `s/home/mobile.html`: the pill/character clicks forward to the page's own `#botBtn`, which opens its bottom-sheet chat | proto.js:315,575,595; s/home/mobile.html:382 | one implementation in the real app (C-12 sheet) |
| L-09 | Reduced motion | Static, fully-risen head, hands visible, no loop, no transitions | proto.js:408 | same |
| L-10 | Older concepts (superseded) | `v7x_launcher_concept` (108 px avatar, spring rise 600 ms after load, 50 px peek while scrolling), `v7chat_launcher` (68 px round button + "Ask VCFO" speech tag + first-visit bubble "Hello. Ask me anything…" with 2 quick questions, appears at .9s) | s/home/v7x_launcher_concept.dc.html; s/home/v7chat_launcher.dc.html:144 | The first-visit bubble is still an owner decision ("First-visit bot note: Once per client") — NEW `ask_client_prefs.first_note_seen_at` (or reuse `askClientPrefs`) |

### 2.6 Ask VCFO chat panel

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| C-01 | Window `#vp-chat` | `section role=dialog aria-label="Ask VCFO chat"`; fixed above the pill (sizes §1.8), r12, `1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3))`, shadow §1.7, `500 13px/1.5`. Closed: `translateY(12px) scale(.96)`, opacity 0, hidden; open (`.on`): none/1/visible, `transform .26s cubic-bezier(.22,1,.36,1), opacity .18s`, origin bottom-right. Opening focuses the input (60 ms), Esc closes, closing returns focus to the pill. While open, `html.vp-chat-on` and the launcher character ducks. | proto.js:354-355,565-610 | EXISTS `src/components/ask/AskPanel.tsx` (Radix Dialog, framer-motion, side-panel/push layout via `use-ask-layout.ts`) — ADAPT to a floating window anchored to the launcher for the client portal |
| C-02 | Header | Navy `#0f2a4a` bar `padding:12px 12px 12px 14px`, gap 10: 36 px white circle with the static head (`headSVG`, 31×39 offset 9 px down), "Ask VCFO" (`800 14px`) / "Answers from Northwind’s project data" (`11.5px #c7d2e2`), 36×36 r6 × button (`rgba(255,255,255,.12)`, `400 22px`). Board variant: back button (in thread), bot avatar with mood, subtitle "Answers from verified sources" with a 7 px green dot `oklch(72% 0.15 160)`, "Expand to side panel" + "Close Ask VCFO" 32×32 buttons. | proto.js:356-359,577; s/home/v7chat_answer.dc.html:144 | ADAPT AskPanel `Header` (subtitle already "Answers from verified sources"); expand-to-side-panel = existing push layout (`AskPushColumn`) |
| C-03 | Peek character | `.vpc-pk` above the window's top edge (`right:clamp(16px,6%,30px)`, width `--vpk-w`, overlapping by `16/340`): once per open the hands grip in (`vpvGripIn .32s ease-out .08s`, right +.09s), the head rises (`vpvPeek .95s cubic-bezier(.3,.75,.35,1) .22s`), looks left/right (`vpvPeekLook 2.2s ease-in-out 1.25s`), then blinks every 6.5 s from 3.5 s (`vpvPeekBlink`). | proto.js:380-393,577 | VcfoAvatar `variant="peek"` |
| C-04 | Moods (never the mouth) | Antenna `.vpv-ant` `transition:fill .3s`: thinking = antenna pulse `vpvAnt 1s infinite`; answered (`vpc-ok`) = `#22C55E` + head hop `vpvHop .7s cubic-bezier(.3,1.5,.5,1)`; can't answer (`vpc-nan`) = `#94A3B8` + dip `vpvDip 1.2s ease-in-out`. Mood replays on every new answer. | proto.js:394-401,443-448 | map to `AnswerEnvelope.origin` (`reviewed|generated|deterministic` → ok, `refusal` → nan) |
| C-05 | Home state (runtime) | First assistant bubble "Hello. Ask me anything about Northwind’s setup, or pick a question below." + suggestion chips (before COI: "What is my next step?", "Where is my incorporation now?", "Which documents are missing?"; after: "What is due next?", "Which registrations are pending?", "When is FC-GPR due?") in a wrap row (`max-height:40%`, scroll) above the composer. | proto.js:366-367,411-420,427,578 | EXISTS `AskHome.tsx` + `GET /api/ask/suggestions` (`use-ask-suggestions.ts`) |
| C-06 | Home state (board) | Navy hero "Hello, / Northwind Technologies" (`.metric 21px`), overlapping project card (Northwind’s project · chip "SPICe+ Part B" · current step "Registered Office Address" · 5 px progress bar · "7 of 38 steps done"), "Quick questions" with a 2-tab navy sliding pill ("About Northwind’s project 2" / "Learn the basics 4") and 40 px question rows with → icon, "Pick up where Northwind left off" rows (Last conversation, Northwind’s Library, Monthly status brief) each with an (i). | s/home/v7chat_home.dc.html:144; s/home/v7chat_answer.dc.html:144 (`isHome`) | EXISTS AskHome (suggestions), `/api/ask/library`, `/api/ask/brief` (`StatusBriefButton.tsx`), `/api/ask/conversations/[id]`, overview progress |
| C-07 | Ask → thinking | User bubble (navy, right, `10px 10px 2px 10px`) then a typing bubble with three 6 px `#7a889c` dots (`vpTh 1s`, .2/.4s delays); window gets `vpc-think`; answer after 900 ms (0 with reduced motion). Board thinking state: three primary dots + a step list "Checking Northwind’s project…" (done, green) / "Finding sources…" (spinner) / "Writing…" (pending, dashed), `aria-live` "Finding sources…". | proto.js:365,611-619; s/home/v7chat_thinking.dc.html:144 | EXISTS streaming `POST /api/ask/chat` (`streamChat` in `src/hooks/ask/ask-api.ts`, `status` in AskContext) — show the board's step list from stream status events |
| C-08 | Answer (runtime) | Assistant bubble (`light-dark(#f1f4f8, …)`, `10px 10px 10px 2px`) with the canned text; unknown questions → "I can’t answer that one yet. I can pass it to Northwind’s project lead." + button "Hand off to Arjun Mehta". | proto.js:361-364,612-617 | EXISTS `AskAnswerCard.tsx`, `AskThread.tsx` |
| C-09 | Answer (board, the content spec) | Avatar 28 px with `react` pop; card: chip "Reviewed by SBC" (`--ok-light`/`--ok-text`, or "AI answer · check with Northwind’s lead" grey for uncertain), answer `14px/1.5` with superscript source number, a phase mini-visual (2×2 grid of clickable phase tiles with tooltips → drill-down), gold-ruled "Why it matters to Northwind", action buttons ("Open Incorporation", "Open Registered Office Address"), "Sources" row (chips "1 Northwind’s project"). Under the card: "Ask my lead" button, "Helpful?" + 👍 / 👎 30×30 icon buttons. | s/home/v7chat_answer.dc.html:144 | EXISTS `AskAnswerCard.tsx` (envelope with visuals `src/components/ask/visuals/*`, `TrustBadge.tsx`, `AskLinkButton.tsx`). **NEW** 👍/👎: `POST /api/ask/messages/[id]/feedback` + column `ask_messages.feedback` (`'up'|'down'|null`) + `feedback_at`; repository fn in `src/db/repositories/ask-messages.ts` scoped to the conversation owner |
| C-10 | What's this? answer card | `.vpc-card` (r10, border, shadow §1.7): title `800 14px`, text `13.5px/1.55`, "Why it matters to Northwind" block, "Source: …" (`11.5px #6b7a90`), button "Open this step" / "Open <page>" with → icon (`1px solid #2e5cff`, `700 12.5px`, hover `light-dark(#eef2ff, …)`). Data from `window.vcfoWhatsThis(q)` = `{title,text,why,source,go}` provided by the Incorporation pages for questions shaped `What’s this: <step title>?`. | proto.js:372-379,435-442,616; s/inc/board.html:1143-1155 | EXISTS `WhatsThisButton.tsx`, `GlossaryTerm.tsx`, `/api/ask/topics/[slug]`, `/api/ask/glossary` |
| C-11 | Hand-off to a human | Runtime: "Hand off to Arjun Mehta" → assistant "Sent to Arjun Mehta. You will get a reply by email within 1 working day." + toast "Handed off to Arjun Mehta" with Undo. Board (`v7chat_handoff`): uncertain answer + "Ask my lead" (primary-tinted) → inline form card (3 px primary top border): lead avatar + "Arjun Mehta (i: Project Lead · replies by email)" / "Project Lead", label "Ask Northwind’s project lead" (i: "The last 4 messages go with it, so they have the context."), textarea prefilled with the question, Cancel / "Send to lead"; sent state: green status "Sent to Northwind’s project lead. They’ll reply by email." + Close. | proto.js:429,587; s/home/v7chat_handoff.dc.html:144 | EXISTS `AskHandoffForm.tsx` + `POST /api/ask/handoff` (creates a task for the lead; `src/db/repositories/ask-handoff.ts`) |
| C-12 | Composer | Runtime: `form` with input "Type a question" (40 px, r8; phone 44 px / 16 px) + navy "Send" (40 px, r6, `700 13px`). Empty submit → focus + toast "Type a question first, or pick one above". Board: input "Ask about Northwind’s setup…" (38 px) + (i) ("Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions.") + 38×38 primary send icon (40% opacity when empty). | proto.js:368-370,589; s/home/v7chat_answer.dc.html:144 | EXISTS `AskComposer.tsx` |
| C-13 | Phone: bottom sheet | ≤767: `left:0;right:0;bottom:0;width:auto;height:min(640px,calc(100dvh - 20px - var(--vpk-w) * .6))`, `border-radius:16px 16px 0 0`, top border only, `padding-bottom:env(safe-area-inset-bottom)`, closed `translateY(24px)`; all buttons ≥40×40; prototype bar hidden while open. | proto.js:404-406 | ADAPT AskPanel (EXISTS `src/components/ui/sheet.tsx`) |
| C-14 | Open from anywhere | `window.vcfoChat(q)` opens and optionally asks; any control labelled "Ask VCFO about this" / "Ask VCFO why" / "Open Ask VCFO" opens the chat with "Tell me about <nearest heading>"; `#chat` in the URL or `vcfo.openChat` opens it 500 ms after load. | proto.js:233,247-253,273,592,620 | EXISTS `useAskOptional().ask({message,context})`, `AskFocusHandler.tsx`, `useAskFocus` |
| C-15 | Persistence | Log kept in `sessionStorage vcfo.chat` and re-rendered on every open; scroll to bottom | proto.js:421-434 | EXISTS conversations in DB + session key in `AskProvider` |
| C-16 | Reduced motion | No typing animation, no peek motion, instant open; mood still shown by colour | proto.js:408,618 | same |

### 2.7 Feedback, tooltips, pop-overs

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| N-01 | Toast `#vp-toast` | One toast at a time, `role=status`, bottom-centre (`bottom:64px`; ≤700px `100px`), `#0f2a4a`, `600 13px`, r8, shadow §1.7; enters from `translate(-50%,12px)`/opacity 0 (`opacity .18s, transform .22s cubic-bezier(.22,1,.36,1)`); auto-hides after **3200 ms** (timer restarts on each toast). Optional **Undo** button (`rgba(255,255,255,.14)` bg, `#e6c46e`, `700 12px`, 28 px, r6) runs the callback and shows "Undone". | proto.js:130-132,158-166 | EXISTS `react-hot-toast` via `src/components/ui/hot-toast.tsx` — ADD a portal "navy" variant + `toastUndo(msg, onUndo)` helper |
| N-02 | Fallback feedback (prototype-only) | Any control that changes nothing within 380 ms shows a toast from its label (download/zip/upload/copy/contact/portal/approve…/search) | proto.js:237-258,287-292 | drop (every control is real) |
| N-03 | Runtime icon tooltip `#vp-tip` (rule 17) | For icon-only controls (`aria-label`, ≤2 chars text, no own tooltip, not "obvious"): navy `#0f2a4a` bubble `700 12px/1.3`, `padding:5px 9px`, r6, centred 32 px above the control (below it when < 4 px from the top), clamped 8 px from the edges; appears **120 ms** after hover (`opacity/transform .12s`, from `translateY(3px)`); hidden on pointerdown and any scroll. `role=tooltip`. Obvious labels (WhatsApp/Call/Email/Teams/About/More actions/Notifications/Close/Ask VCFO/SBC home/Search (⌘K)/Details/Open/Open menu/Announcements/file types…) get no tooltip. `title` attributes are converted to `aria-label` and removed. | proto.js:133-134,295-311,660-674 | ADAPT `src/components/ui/tooltip.tsx` (Radix) to navy styling, `delayDuration={120}`; one `TooltipProvider` already in `app/providers.tsx` |
| N-04 | CSS tooltip `[data-tip]` | `::after` bubble `bottom:calc(100% + 9px)`, navy, `700 11.5px/1.25`, `padding:5px 9px`, r6, z 70, `tipin .12s`; 8 px rotated-square arrow `::before` at `calc(100% + 5px)`; `[data-tip-below]` flips under. | b/ecdc…css:165-173 | same Radix tooltip (side top/bottom) |
| N-05 | Rule-14 tooltip `.tt > .tb` | Navy bubble `700 11.5px/1.3` over its part, `translate(-50%,4px)→(-50%,0)`, `.14s`; `.tm` meta at 600/.72; `.below` variant; `.tt.show` forces it (touch) | b/5f811734…css:2-7 | Radix tooltip / chart tooltip (EXISTS `src/components/charts/ChartTooltip.tsx`) |
| N-06 | `.tipw .tt` (home boards) | Same navy bubble `700 12px/1.3`, `.12s`; `.l` = left side; `.w` = white variant (`light-dark(#fff, …)`, navy text) | s/home/v7x_drilldown.dc.html:128-135 | same |
| N-07 | (i) info pop-over | Trigger: 18×18 button (15 px circle-i icon `circle r9 + M12 11v5M12 8h.01`, stroke 2), `oklch(62% 0.02 255)`, navy on hover/focus/open; touch hit area +11 px (`pointer:coarse`). Pop-over: under the icon (`top:calc(100% + 8px)`, centred), `min-width:200px;max-width:280px` (`min(280px,calc(100vw - 24px))`), `padding:10px 12px`, r8, border, shadow §1.7, `500 12px/1.45`, 10 px rotated-square arrow; opens on click / Enter / Space (`.info.open` or `:focus-within`), `.15s` fade+slide (`translate(-50%,-4px)`→0); closes on outside click, Esc, Tab out; one open at a time; on phone it is nudged to stay 8 px inside the viewport. Last row: 16 px bot avatar + "Ask VCFO about this" (border-top `--hair`, `--primary` w700) → opens the chat with the row's title as the question. Build note on the board: "Radix Popover, role="dialog" when it holds the link". | b/ecdc…css:108-116; s/home/v7x_info_popover.dc.html (spec list); s/home/v7_before.dc.html:164+ (`.info .pop` max-width/display rules); s/home/mobile.html:216,338 | EXISTS `src/components/ui/popover.tsx` (Radix) + `FieldHelpButton.tsx` / `GlossaryTerm.tsx` — NEW shared `InfoPopover` component with the "Ask VCFO about this" row calling `useAskOptional().ask(...)` |
| N-08 | Bot speech bubble (rule 16) | `.bot` flex gap 12: 40 px `--primary-light` circle with the static head (`window.vcfoBotSVG`, 34×43, 9 px down) + `.bub` (`--with-light` bg, r10, `9px 12px`, `12.5px/1.5`) with an optional 30 px button ("Ask VCFO why" → chat, or `data-go`) | s/inc/board.html:75-79,597; proto.js:477-480 | NEW `BotSays` component (uses VcfoAvatar `variant="head"`) |
| N-09 | Static bot (board `v7c_bot`) | 4 states, same head SVG in a `0 -40 240 240` box: idle (antenna `#2DD4BF`), thinking (antenna `#7DD3FC` + `vbAnt` pulse, eyes `vbScan` side-to-side), answered (`#34D399`), cannot (`#94A3B8`); `role=img` labels "Ask VCFO assistant[, thinking|, answered|, cannot answer]" | s/home/v7c_bot.dc.html:141-150 | VcfoAvatar `variant="head" mood=…` |

### 2.8 Drill-down pop-up, bottom sheet, dialogs

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| D-01 | Runtime drill `window.vcfoDrill(cfg)` | `cfg = {title, sub?, link?:{lead,text,where,go|onClick}, tabs:[{label, color?, n?, rows:[[name, meta, status, statusColour, route?]]}], active}`. Scrim `#vp-drill-scrim` (`rgba(8,20,40,.5)`, z 2147482000, `opacity .18s`, content top-aligned at `max(72px,8vh)`); dialog `#vp-drill` (`role=dialog aria-modal`, `aria-labelledby`), `translateY(10px) scale(.98)`→none `.24s`. Optional top strip (`light-dark(#eef3ff, …)`, "These items live in X" + "Open X →" link `#2e5cff 800 12.5px`). Header: title `700 15px` + sub, 32×32 × button. Tabs: segmented control (`light-dark(#f1f4f8, …)` track with `inset 0 0 0 1px #e3e8ef`, 30 px buttons `600 12px`, optional 8 px colour square, count in IBM Plex Mono; selected = `#0f2a4a` bg white text). List rows: grid `minmax(0,1fr) auto auto 16px`, name (ellipsis) · mono meta · coloured status chip (`700 11px`, white on the given colour) · `→` in `#2e5cff`; hover `light-dark(#f5f7fa, …)`. Footer "Showing n of m · the full list is in X" / "Showing all n". Close: scrim click, ×, Esc (capturing); focus moves to × and returns to the opener; row click → `go(route)` or toast "Opening <name>…". ≤700 px: bottom sheet (`align-items:flex-end`, full width, `14px 14px 0 0`, `max-height:86vh`). | proto.js:683-739 | NEW `DrillDown` component (Radix Dialog = EXISTS `src/components/ui/dialog.tsx`; `Sheet` on phone). The board variant (D-02) is the pixel reference. |
| D-02 | Drill board `v7x_drilldown` (the owner's component) | 600 px (`min(600px,calc(100vw - 24px))`), `max-height:min(560px,calc(100dvh - 24px))`, r12, shadow `0 30px 70px -20px oklch(15% 0.05 258 / .6)`; top strip `--primary-light` "These items live in {Incorporation|Filings|Notifications|Documents|Team|Compliances}" + "Open … →" (derived from the title); header 15 px + 30×30 ×; **navy sliding pill** (`.seg` with `.thumb` width `calc((100% - 4px)/n)`, `translateX(i*100%)`, spring `.42s linear(…)`) whose first tab may be "All"; rows `.ddrow` grid `minmax(0,1fr) 62px 116px 16px` (name · mono date · full-width status chip `--{ok|prog|due|up|over}-chip` · → arrow); empty "Nothing here."; footer `--raised` "Showing n of m" + "Open full list". ≤640: tabs wrap without the thumb (selected = navy), date column hidden. Spec: hover a part → tooltip "name + count/date"; click/tap/Enter → pop-up with that part pre-selected; each part is a real button with an aria-label. Reduced motion: pill jumps, no fade. | s/home/v7x_drilldown.dc.html:142-238; s/home/v7x_drilldown_spec.dc.html | same NEW `DrillDown` (+ EXISTS `src/components/charts/*` for the parts) |
| D-03 | Shared `.dpop` (rule 14 pop-up, gradient header) | 640×≤720, r12, `v7up .3s`; header `linear-gradient(115deg,var(--navy-deep,var(--navy)),var(--navy-2-deep,var(--navy-2)) 70%,var(--navy-3-deep,var(--navy-3)))` with a 3 px gold fade underline; rows `.drow` 10px 18px, hairline separators, hover `light-dark(oklch(96.8% 0.006 250 / .8), oklch(17.8% 0.006 250 / 0.8))` | b/5f811734…css:10-16 | variant of DrillDown (used by Incorporation/Compliances pages) |
| D-04 | Phone bottom sheet (mobile home) | Scrim `oklch(20% .05 258 / .45)` (z 60, `.2s`); sheet z 61 `width:min(100%,560px)`, `max-height:min(82vh,calc(100dvh - 24px))`, r `14px 14px 0 0`, shadow `0 -16px 40px -20px oklch(15% .05 258 / .5)`, slides `translate(-50%,105%)→(-50%,0)` `.38s var(--spring)`; grab handle 40×4 `--border`; header `800 16px` + 44 px close; body scrolls; opening adds `body.sheet-open` (launcher ducks + pill hides, prototype bar hidden); Esc / scrim / × close; focus to × then back. Same toggle closes. Used for drill-downs (with a sliding segmented control), search, uploads ("Choose a file" / "Take a photo"), password reveal, chat. | s/home/mobile.html:144-152,182,202,301-312 | EXISTS `src/components/ui/sheet.tsx` (side="bottom") — ADAPT styling; DECISIONS.md: "Mobile drill-downs: Bottom sheet" |
| D-05 | Board overlays `.ov` / `.dlg` | `.ov` scrim `oklch(21% 0.042 264 / .42)`; `.dlg` 460 px r12, header/body/footer paddings `16px 18px` / footer `12px 18px` on `--raised`. Runtime forces `.ov`, `.ddscrim` fixed full-screen at z 2147482000 and `.dd` at `top:max(72px,8vh)`, `max-height:calc(100vh - 110px)`; any card containing a z 201 pop-up is lifted (`transform:none`, z 2147481500) so pop-ups escape their card. | b/ecdc…css:145-149; proto.js:143-146 | EXISTS `dialog.tsx` / `alert-dialog.tsx` (portalled, so the stacking hack is unnecessary) |

### 2.9 Runtime glue (routing, transitions, scrollbars, theme)

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| R-01 | Route table | `routes.js`: route key → `{d: desktop board, m: phone board, t: title, hide}`; `home` resolves to `home-after` when After; phone device uses `m` | routes.js:1; proto.js:88-116 | Next app router (`app/app/client/**`) |
| R-02 | Page transitions | Leave: `html.vp-leave body{opacity:.35;transition:opacity .14s}` then navigate after 140 ms. Enter: `html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1) both}` (class removed after 400 ms). | proto.js:108-115,135-137,154,748 | EXISTS `src/components/shell/PageTransition.tsx`, `Stagger.tsx` — set to `vpIn` metrics |
| R-03 | No visible scrollbars | `html,body,*{scrollbar-width:none!important}` + `::-webkit-scrollbar{display:none}` | proto.js:141-142 | portal CSS (already in generated `00-tokens.css`) |
| R-04 | Theme | §1.1 | proto.js:6-77 | ThemeToggle + next-themes |
| R-05 | Already-on-page | `go(route)` to the current route → toast "You are already on <title>"; selected tab clicked again → "Already showing <tab>" | proto.js:111,288 | optional |
| R-06 | `data-go` tiles | Any `[data-go]` tile navigates, but inner controls (links, buttons, inputs, `.info`) keep their own click | proto.js:264-269 | `<Link>` wrappers with `stopPropagation` in inner buttons |
| R-07 | External links | `https?:` links → toast "Opens <label> in the full app"; `window.open` stubbed | proto.js:278, outer-shell.html:288 | real `target="_blank" rel="noopener"` (portal links ↗, rule 15) |
| R-08 | Prototype control bar | Bottom-centre navy toolbar (Before COI/After COI, Desktop/Mobile 390, page select, ×) or "PROTOTYPE" mini button | proto.js:121-129,169-193 | **drop** (prototype-only) |

### 2.10 Timeline editor pop-up (`tl-editor.js`)

| id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|
| E-01 | Open | From Home card "Timeline" → "Edit" (proto.js:274), phone `[data-tledit]`, or `window.vcfoOpenTimeline()`. Scrim `#tle-scrim` `rgba(8,20,40,.5)` z 2147483100 (`.18s`), dialog `#tle` `width:min(1080px,100%)`, `max-height:calc(100dvh - 32px)`, r12, `translateY(10px) scale(.98)`→none `.26s`. Focuses the first unlocked bar. Esc / scrim / × / Cancel close. | tl-editor.js:28-33,106-140; proto.js:274,678-682 | NEW `TimelineEditor` dialog (EXISTS data: `engagements.schedule` via `normalizeEngagementSchedule`; EXISTS change requests `src/db/repositories/client-change-requests.ts` + `app/api/client/change-requests`, `engagement-change-requests.ts` + `/api/engagement-change-requests`) |
| E-02 | Mode switch | Segmented "Manager · direct edit" / "Client · change request" (prototype shows both; remembered in `vcfo.tl.mode`). Client mode: title "Request a timeline change", reason textarea "Why do you need this change?" (placeholder "For example: our director is travelling until 14 Oct, so the KYC video call has to move."), error "Add a short reason so Northwind’s project manager can approve it.", primary "Send request", warning "Priya Raman (Project Manager) approves requests. Northwind’s dates stay as they are until then." Manager: "Edit timeline", "Save timeline", "Saving updates the dashboard for everyone on Northwind." | tl-editor.js:111-118,251-258 | role decides the mode: client → change request only |
| E-03 | Phases | Phase 1 · Name Application 12–24 Sep (done → locked, hatched, 🔒, toast "Phase 1 is done, so its dates are locked"), Phase 2 · Incorporation 25 Sep–20 Oct (`--navy-3`), MCA review 20–28 Oct (`oklch(70% .03 255)`), COI 28 Oct milestone (gold diamond, 18 px rotated 45°). Axis world 1 Aug–31 Dec 2026, default fit 12 Sep–8 Nov; Today line 6 Oct (red `#d64545` with label "Today 6 Oct"). | tl-editor.js:5-18,62-82 | data from schedule |
| E-04 | Drag / resize / keyboard | Bars are `role=slider` (aria-valuetext "12 Sep – 24 Sep · 12 days"); drag body = move, 12 px edge handles = resize start/end; snaps to days (to weeks when < 8 px/day); readout bubble above the bar while dragging/hovering/focused; ghost dashed outline of the saved position; cascade: a phase never starts before the previous one ends, later phases keep their gaps and shift with it. Keyboard ←/→ move by the snap; Shift+←/→ resize the end. Undo stack (60), Reset. | tl-editor.js:68-80,141-142,229-298 | NEW (pure front-end, logic copied verbatim) |
| E-05 | Zoom / pan | −/+ buttons (×1.5), range slider (log scale), level label Days/Weeks/Months, Fit; Ctrl/⌘+wheel zooms at the cursor; wheel scrolls horizontally when zoomed in; mouse drag on empty lanes pans; two-finger pinch zooms | tl-editor.js:63-67,144-228 | same |
| E-06 | Summary + compare | "COI 28 Oct → 31 Oct" + pill `late` (`light-dark(#fde8e6, oklch(25.2% 0.066 24.1))`/`#b42318` "Slipped by 3 days"), `early` (`light-dark(#e3f6ee, …)`/`#0f7a55` "Pulled in by n days"), `same` ("No change to the COI date"); hint "MCA review and the COI move with Phase 2. The client is told by email and WhatsApp." Before/After lists side by side; per-row "+n d"/"−n d" chips. | tl-editor.js:83-91,229-250 | same |
| E-07 | Save / request + Undo toast | Manager: save + toast "Timeline saved · COI 31 Oct · slipped by 3 d" with Undo; client: store pending + toast "Change request sent to Priya Raman" with Undo; no change → toast "No changes to save". Home card bars animate to the new dates (`left/width .5s cubic-bezier(.22,1,.36,1)`); pending chip "Change request pending · COI <date>" (`light-dark(#fdecd3, …)` / `light-dark(#8a4b0f, …)`, `800 11px`, r4, 24 px) before the Edit button; clicking it toasts "Waiting for Priya Raman to approve · “<reason>”". | tl-editor.js:98,299-342 | client: `POST /api/client/change-requests` (EXISTS) with `{kind:'timeline', proposed, reason}`; manager: `PATCH /api/engagements/[id]` schedule (EXISTS route; confirm schedule field) ; Undo = delete the request / restore previous schedule |
| E-08 | Phone | ≤767: bottom sheet (`14px 14px 0 0`, `max-height:92dvh`), dates column hidden, 96 px names column, 40 px buttons, wrapped header | tl-editor.js:99-100 | same |

---

## 3. Mapping summary: what the real app needs

Front-end (new or adapted), all inside the client portal shell (`app/app/client/layout.tsx` → today `AppShell requireRole="client"`):

1. **ClientPortalShell** (NEW, `src/components/client-portal/ClientPortalShell.tsx`): `.cp` root with `data-theme`, breakpoint attr, fonts; renders
   ClientSidebar (full / rail / drawer), ClientTopBar, `<main>` with `padding-bottom:var(--vp-launch-h)`, the Ask launcher + chat, toaster.
   Replace `AppShell` for `requireRole="client"` only (staff shells untouched). CSS: the in-progress `src/components/client-portal/css/*`.
2. **ClientSidebar** (ADAPT `RoleSidebar.tsx` client branch or NEW): nav model S-04, pill S-06 (reuse `MotionActivePill`), groups S-08 (reuse
   `SidebarNavGroup`), team rows S-11/12/13, account row S-14, rail S-16/17/18, drawer S-19 (reuse `MobileNavSheet`/`sheet.tsx`).
3. **ClientTopBar** (ADAPT `TopBar.tsx`): T-01…T-09; reuse `shell-crumbs.ts`, `AnnouncementsBell`, `NotificationsBell`, `ThemeToggle`, `CommandPalette`.
4. **VcfoAvatar** (NEW): loop / peek / head variants + moods (verbatim SVG + CSS §4.6).
5. **AskLauncher + floating AskPanel** (ADAPT `AskLauncher.tsx`, `AskPanel.tsx`, `AskHome.tsx`, `AskAnswerCard.tsx`, `AskHandoffForm.tsx`, `AskComposer.tsx`).
6. **Shared primitives**: `PortalToast` (+Undo) on react-hot-toast, `PortalTooltip` (navy, 120 ms) on Radix, `InfoPopover` (Radix Popover +
   "Ask VCFO about this"), `DrillDown` (Dialog / bottom Sheet + navy sliding pill), `BotSays`, `Intro`, `TimelineEditor`.

Backend (repositories + routes; golden rules: only repositories touch `db`, every function takes `AuthContext`, add a cross-tenant test):

| Need | Repository | Route | Notes |
|---|---|---|---|
| Team contacts with phone + avatar (S-11/12) | EXTEND `loadTeam` in `src/db/repositories/client-overview.ts` (add `phoneE164`, `avatarUrl`) | EXISTS `GET /api/client/overview` | Client may only see contacts of their own engagement (already enforced by `assertEngagementAccess`). Consider honouring a "show phone to client" flag. |
| Support contact (S-13) | none (config) | NEW `GET /api/client/support-contact` or server prop | env vars, never hard-coded |
| Sidebar badges (S-07) | EXISTS `notifications.ts`, `document-requests.ts`, `client-overview.ts` | EXISTS `/api/notifications?head=1`, `/api/requests`, `/api/client/overview` | optionally NEW `GET /api/client/shell-counts` returning `{unreadNotifications, newAnnouncements, incSteps:{done,total}, openDocRequests}` in one call (one repository fn per count, each scoped) |
| Announcements "new" dot (T-06) | EXISTS `announcements.ts` | EXISTS `/api/announcements?head=1` | read-state lives client-side today (`readIds` in `AnnouncementsBell`) |
| 👍/👎 on answers (C-09) | EXTEND `src/db/repositories/ask-messages.ts`: `setMessageFeedback(ctx, messageId, 'up'|'down'|null)` — only the conversation's `profileId` may write | NEW `POST /api/ask/messages/[id]/feedback` | migration: `ask_messages.feedback text`, `feedback_at timestamptz`; surface counts in the existing admin gaps view (`/api/ask/admin/gaps`) |
| First-visit bot note "once per client" (L-10) | EXTEND `src/db/repositories/ask-client-prefs.ts` (`firstNoteSeenAt`) | EXTEND `/api/ask/nudge` or `/api/ask/status` | migration: `ask_client_prefs.first_note_seen_at` |
| Timeline change request (E-07) | EXISTS `client-change-requests.ts` / `engagement-change-requests.ts` | EXISTS `POST /api/client/change-requests`, `/api/engagement-change-requests/[id]` | verify a `timeline` kind exists; manager direct edit → engagement schedule update |
| Credentials page (nav item) | NEW (out of this area) | NEW `/app/client/credentials` | listed in the FINAL nav |
| Intro opt-out (I-07) | none (localStorage) | — | or a profile pref later |
| Before/After (B-01) | none | — | derived from `ClientOverview.incorporated`; owner decision whether clients ever see the toggle |

---

## 4. VERBATIM REFERENCE SNIPPETS

### 4.1 Sidebar, rail, drawer, Before|After — `shell.js` (full, verbatim; this is the whole component)

Icons + nav model + team + account data (shell.js:46-111):

```js
  /* ---------- icons (same strokes as the boards) ---------- */
  function svg(d, s) { return '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d.split('|').map(function (p) { return '<path d="' + p + '"/>'; }).join('') + '</svg>'; }
  var I = {
    home: 'M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z',
    updates: 'M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5',
    inc: 'M3.5 20.5h17 M5.5 20.5V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15.5 M14.5 9.5h3a1 1 0 0 1 1 1v10 M8.5 7.8h3 M8.5 11.3h3 M8.5 14.8h3',
    comp: 'M6 5.5h12A1.5 1.5 0 0 1 19.5 7v11.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 6 5.5Z M4.5 10h15 M8.5 3.5v4 M15.5 3.5v4 M8 13.5h2 M8 16.5h2 M12.5 13.5h3.5',
    docs: 'M3.5 18V6A1.5 1.5 0 0 1 5 4.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z',
    lib: 'M5.5 19V5A1.5 1.5 0 0 1 7 3.5h11.5v14H7A1.5 1.5 0 0 0 5.5 19a1.5 1.5 0 0 0 1.5 1.5h11.5 M9 7.5h6',
    team: 'M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M15.5 5.7a3.3 3.3 0 0 1 0 6.4 M17.5 15.3c1.9.6 3.1 2.1 3.5 4.7',
    audit: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9 M4.5 4.5V9H9 M12 8v4.2l2.8 1.8',
    chev: 'M9 6l6 6-6 6',
    up: 'M6 15l6-6 6 6',
    wa: 'M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z M9.2 8.8c.2-.4.6-.4.9-.2l.8 1.4c.1.3 0 .6-.2.8l-.4.4c.4.9 1.2 1.7 2.1 2.1l.4-.4c.2-.2.5-.3.8-.2l1.4.8c.3.2.3.6.1.9-.5.8-1.4 1.1-2.3.7a7 7 0 0 1-3.7-3.7c-.4-.9-.1-1.8.1-2.6Z',
    call: 'M7 4h2.2l1.3 3.6-1.8 1.2a10 10 0 0 0 6.5 6.5l1.2-1.8L20 14.8V17a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 2-2Z',
    mail: 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5',
    teams: 'M3.5 7h10v10h-10Z M6.5 10h4 M8.5 10v5 M16.5 9.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4Z M15.5 11h5v4.5a2.5 2.5 0 0 1-5 0',
    person: 'M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8Z M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
    head: 'M4.5 14v-2a7.5 7.5 0 0 1 15 0v2 M4.5 14h2.5v5H6a1.5 1.5 0 0 1-1.5-1.5Z M19.5 14H17v5h1a1.5 1.5 0 0 0 1.5-1.5Z',
    gear: 'M12 15a3 3 0 1 0 0-6a3 3 0 1 0 0 6Z M19.4 13.5l1.1.9-1.6 2.8-1.4-.5a7 7 0 0 1-1.6.9l-.2 1.5h-3.2l-.2-1.5a7 7 0 0 1-1.6-.9l-1.4.5-1.6-2.8 1.1-.9a7 7 0 0 1 0-1.9l-1.1-.9 1.6-2.8 1.4.5a7 7 0 0 1 1.6-.9l.2-1.5h3.2l.2 1.5a7 7 0 0 1 1.6.9l1.4-.5 1.6 2.8-1.1.9a7 7 0 0 1 0 1.9Z',
    out: 'M10 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h4 M14 8l4 4-4 4 M18 12H8.5',
    help: 'M12 20.5a8.5 8.5 0 1 0 0-17a8.5 8.5 0 1 0 0 17Z M9.6 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6 M12 17h.01',
    x: 'M6 6l12 12 M18 6L6 18'
  };

  /* ---------- Lucide line icons (lucide-static, ISC): stroke 2, round caps and joins ---------- */
  var LU = {
    "layout-dashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\"/><rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"/>",
    "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\"/><path d=\"M16.5 7.5h.01\"/>",
    "megaphone": "<path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\"/><path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\"/><path d=\"M8 6v8\"/>",
    "building-2": "<path d=\"M10 12h4\"/><path d=\"M10 8h4\"/><path d=\"M14 21v-3a2 2 0 0 0-4 0v3\"/><path d=\"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2\"/><path d=\"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16\"/>",
    "calendar-check": "<path d=\"M8 2v3\"/><path d=\"M16 2v3\"/><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 9h18\"/><path d=\"m9 15 2 2 4-4\"/>",
    "calendar": "<path d=\"M8 2v3\"/><path d=\"M16 2v3\"/><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 9h18\"/>",
    "file-check": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5\"/><path d=\"m9 15 2 2 4-4\"/>",
    "folder-open": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/>",
    "library": "<path d=\"m16 6 4 14\"/><path d=\"M12 6v14\"/><path d=\"M8 8v12\"/><path d=\"M4 4v16\"/>",
    "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/>",
    "history": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/><path d=\"M12 7v5l4 2\"/>",
    "settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "user-round": "<circle cx=\"12\" cy=\"8\" r=\"5\"/><path d=\"M20 21a8 8 0 0 0-16 0\"/>"
  };
  function lu(k, s) { return '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + LU[k] + '</svg>'; }
  I.menu = 'M4 7h16 M4 12h16 M4 17h16';

  /* ---------- the one navigation model ---------- */
  var NAV = [
    { k: 'home', t: 'Home', i: 'layout-dashboard' },
    { g: 'updates', t: 'Updates', i: 'megaphone', badge: '3', hot: true, kids: [{ k: 'announcements', t: 'Announcements' }, { k: 'notifications', t: 'Notifications', badge: '3', hot: true }] },
    { k: 'incorporation', t: 'Incorporation', i: 'building-2', badge: 'inc' },
    { g: 'compliances', t: 'Compliances', i: 'calendar-check', kids: [{ k: 'compliances', t: 'Calendar' }, { k: 'filings', t: 'Filings' }] },
    { k: 'documents', t: 'Documents', i: 'folder-open', badge: '6' },
    { k: 'knowledge-bank', t: 'Library', i: 'library' },
    { k: 'credentials', t: 'Credentials', i: 'key-round' },
    { k: 'team', t: 'Team', i: 'users' },
    { k: 'audit', t: 'Audit', i: 'history' },
    { k: 'settings', t: 'Settings', i: 'settings' }
  ];
  var ALIAS = { 'inc-phase-a': 'incorporation', 'inc-phase-3': 'incorporation', 'inc-phase-4': 'incorporation', 'credentials': 'credentials', 'home-after': 'home', 'home-chat': 'home', 'ids-password': 'home', 'inc-phase': 'incorporation', 'inc-step7': 'incorporation', 'inc-step10': 'incorporation', 'board-resolution': 'incorporation', 'doc-viewer': 'documents', 'kb-reader': 'knowledge-bank' };
  function active() { var h = window.vcfoHere ? window.vcfoHere() : null; if (/^inc-step/.test(h || '')) return 'incorporation'; return ALIAS[h] || h; }
  var TEAM = [
    { n: 'Priya Raman', r: 'Project Manager', ini: 'PR', c: ['wa', 'call', 'mail', 'teams'] },
    { n: 'Arjun Mehta', r: 'Project Lead', ini: 'AM', c: ['wa', 'call', 'mail', 'teams'] },
    { n: 'Customer support', r: 'SBC help desk', ini: 'CS', sup: true, c: ['wa', 'mail', 'teams', 'call'] }
  ];
  var VERB = { wa: 'WhatsApp', call: 'Call', mail: 'Email', teams: 'Teams' };
  var ME = { n: 'Rohan Kumar', r: 'Northwind · Client', ini: 'RK' };
```

All sidebar / rail / drawer / Before|After / fallback CSS (shell.js:113-263):

```js
  /* ---------- styles ---------- */
  var css = document.createElement('style'); css.id = 'vp-shell-css';
  css.textContent = [
    '.vps{position:fixed;top:0;z-index:45;height:100vh;display:flex;flex-direction:column;background:#0f2a4a;color:#fff;font:500 13px/1.4 Manrope,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;box-sizing:border-box}',
    '@supports (height:100dvh){#vp-side,#vp-drawer{height:100dvh}}',
    '.vps::-webkit-scrollbar{display:none}',
    '.vps div,.vps span,.vps a,.vps button,.vps b,.vps small,.vps nav,.vps img,.vps svg{margin:0;padding:0;border:0;background:none;box-shadow:none;position:static;float:none;min-width:0;max-width:none;letter-spacing:normal;text-transform:none;text-decoration:none;font-style:normal;box-sizing:border-box;opacity:1;filter:none}',
    '.vps svg{flex:0 0 auto;display:block}',
    '.vps a,.vps button{font:inherit;color:inherit;text-decoration:none}',
    '.vps button{border:0;background:none;cursor:pointer;padding:0}',
    '.vps :focus-visible{outline:2px solid #8fb4ff;outline-offset:2px;border-radius:8px}',
    '#vp-side{left:0;width:var(--vp-side-w,248px)}',
    '.vps .vps-logo{flex:0 0 auto;height:64px;display:flex;align-items:center;padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08)}',
    '.vps .vps-logo img{display:block;height:34px;width:auto;max-width:100%;object-fit:contain;object-position:left center}',
    '.vps .vps-nav{position:relative;display:flex;flex-direction:column;gap:2px;padding:12px 8px}',
    '.vps .vps-pill{position:absolute;left:8px;right:8px;top:0;height:36px;border-radius:8px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(110,150,255,.42),inset 0 1px 0 rgba(255,255,255,.12);pointer-events:none;will-change:transform;transition:transform .42s cubic-bezier(.22,1.2,.36,1),height .3s cubic-bezier(.22,1,.36,1),opacity .2s}',
    '.vps .vps-rail{position:absolute;left:8px;top:0;width:3px;height:20px;border-radius:99px;background:#6e96ff;pointer-events:none;will-change:transform;transition:transform .42s cubic-bezier(.22,1.2,.36,1)}',
    '.vps .vps-i{position:relative;z-index:1;display:flex;align-items:center;gap:11px;width:100%;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;font-weight:500;color:#c3cddc;text-align:left;transition:background .15s,color .15s}',
    '.vps .vps-i:hover{background:rgba(255,255,255,.06);color:#fff}',
    '.vps .vps-i .vps-ic{display:flex;color:#9aa8bd;transition:color .15s}',
    '.vps .vps-i:hover .vps-ic{color:#c9d6ea}',
    '.vps .vps-i .vps-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.vps .vps-i[aria-current=page],.vps .vps-i[data-cur]{color:#fff;font-weight:650}',
    '.vps .vps-i[aria-current=page] .vps-ic,.vps .vps-i[data-cur] .vps-ic{color:#a9c3ff}',
    '.vps .vps-b{flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:6px;display:grid;place-items:center;font:700 11px/1 Manrope,sans-serif;background:rgba(255,255,255,.1);color:#fff;transition:opacity .2s,transform .2s}',
    '.vps .vps-b.hot{background:#d93a3a}',
    '.vps .vps-cv{display:flex;color:#8c9ab0;transition:transform .28s cubic-bezier(.22,1,.36,1)}',
    '.vps .vps-g[aria-expanded=true] .vps-cv{transform:rotate(90deg)}',
    '.vps .vps-g[aria-expanded=true] .vps-b{opacity:0;transform:scale(.6)}',
    '.vps .vps-sub{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.22,1,.36,1)}',
    '.vps .vps-sub.open{grid-template-rows:1fr}',
    '.vps .vps-sub>div{overflow:hidden;position:relative}',
    '.vps .vps-sub:not(.open)>div{visibility:hidden}',
    '.vps .vps-sub>div:before{content:"";position:absolute;left:18px;top:4px;bottom:4px;width:1px;background:rgba(255,255,255,.14)}',
    '.vps .vps-sub .vps-i{height:32px;padding-left:37px;font-size:13px;margin-top:2px}',
    '.vps .vps-sub .vps-i:after{content:"";position:absolute;left:16px;top:50%;width:5px;height:5px;margin-top:-2.5px;border-radius:50%;background:#5b6e8a;transition:background .15s,box-shadow .15s}',
    '.vps .vps-sub .vps-i[aria-current=page]:after{background:#8fb0ff;box-shadow:0 0 0 3px rgba(110,150,255,.22)}',
    '.vps .vps-team{margin-top:auto;padding:10px 8px 8px;border-top:1px solid rgba(255,255,255,.1)}',
    '.vps .vps-lbl{font:800 11px Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#d8b25a;margin:0 8px 6px}',
    '.vps .vps-p{position:relative;display:flex;align-items:center;gap:9px;height:38px;padding:0 8px;border-radius:8px;transition:background .15s}',
    '.vps .vps-p:hover,.vps .vps-p:focus-within{background:rgba(255,255,255,.06)}',
    '.vps .vps-av{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);box-shadow:0 0 0 1.5px rgba(255,255,255,.22);color:#dbe3ef;font:700 11px Manrope,sans-serif}',
    '.vps .vps-nm{flex:1;min-width:0;display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12.5px;line-height:1.3;color:#fff}',
    '.vps .vps-nm b{font-weight:700;color:#fff}',
    '.vps .vps-nm small{display:inline;font-size:11.5px;color:#9eadc3}',
    '.vps .vps-c{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;gap:3px;padding-left:14px;background:linear-gradient(90deg,rgba(22,50,80,0),#163250 14px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .15s,visibility 0s}',
    '.vps .vps-p:hover .vps-c,.vps .vps-p:focus-within .vps-c{opacity:1;visibility:visible;pointer-events:auto}',
    '.vps .vps-c button{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;background:rgba(255,255,255,.12);color:#fff;transition:background .15s,transform .15s}',
    '.vps .vps-c button:hover{background:rgba(255,255,255,.22)}',
    '.vps .vps-c button:active{transform:scale(.94)}',
    '.vps .vps-c button.wa{background:#1f8f5a}.vps .vps-c button.wa:hover{background:#25a468}',
    '.vps .vps-me{position:relative;padding:8px 10px 12px;border-top:1px solid rgba(255,255,255,.1)}',
    '.vps .vps-meb{width:100%;display:flex;align-items:center;gap:10px;padding:6px;border-radius:8px;text-align:left;transition:background .15s}',
    /* the account row is read-only now: the only control in it is sign out */
    '.vps .vps-mest{width:100%;display:flex;align-items:center;gap:10px;padding:6px;border-radius:8px}',
    '.vps .vps-mest .vps-nm{flex:1;min-width:0}.vps .vps-mest .vps-nm b{display:block;font-size:13px;font-weight:650}.vps .vps-mest .vps-nm small{display:block;font-size:11px;color:#a9b6c9}',
    '.vps .vps-out{flex:none;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:7px;color:#a9b6c9;transition:background .15s,color .15s}',
    '.vps .vps-out:hover{background:rgba(255,255,255,.12);color:#fff}',
    '.vps .vps-out:focus-visible{outline:2px solid light-dark(#fff, oklch(22% 0 89.9));outline-offset:2px}',
    '.vps.vps-icons .vps-mest-rail{flex-direction:column;gap:6px;padding:0}',
    '.vps .vps-meb:hover,.vps .vps-meb[aria-current=page]{background:rgba(255,255,255,.08)}',
    '.vps .vps-a{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#2e5cff;font:800 11px Manrope,sans-serif;color:#fff;flex:0 0 auto}',
    '.vps .vps-meb .vps-nm{flex:1;min-width:0}.vps .vps-meb .vps-nm b{display:block;font-size:13px;font-weight:650}.vps .vps-meb .vps-nm small{display:block;font-size:11px;color:#a9b6c9}',
    '.vps .vps-meb .vps-cv{transform:rotate(-90deg)}.vps .vps-meb[aria-expanded=true] .vps-cv{transform:rotate(90deg)}',
    '.vps .vps-menu{position:absolute;left:10px;right:10px;bottom:calc(100% - 4px);padding:6px;border-radius:10px;background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));box-shadow:0 18px 40px -12px rgba(8,20,40,.55);transform-origin:50% 100%;transform:translateY(6px) scale(.97);opacity:0;visibility:hidden;transition:transform .2s cubic-bezier(.22,1,.36,1),opacity .15s}',
    '.vps .vps-menu.on{transform:none;opacity:1;visibility:visible}',
    '.vps .vps-menu button{width:100%;display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:7px;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))!important;font-weight:600}',
    '.vps .vps-menu button:hover{background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5))}',
    '.vps .vps-menu button svg{color:#5b6b82}',
    '.vps .vps-sr,.vps.vps-icons .vps-i .vps-t{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}',
    /* tablet: the 72 px icon rail */
    '.vps.vps-icons .vps-logo{justify-content:center;height:58px;padding:0}',
    '.vps.vps-icons .vps-logo img{height:36px;max-width:48px;object-position:center}',
    '.vps.vps-icons .vps-nav{padding:8px 12px}',
    '.vps.vps-icons .vps-i{justify-content:center;gap:0;height:40px;padding:0}',
    '.vps.vps-icons .vps-pill{left:12px;right:12px}',
    '.vps.vps-icons .vps-rail{left:12px}',
    '.vps.vps-icons .vps-i .vps-b{position:absolute;top:3px;left:calc(50% + 3px);min-width:18px;height:18px;padding:0 5px;border-radius:9px;font-size:11px;box-shadow:0 0 0 2px #0f2a4a}',
    '.vps.vps-icons .vps-g:after{content:"";position:absolute;right:5px;bottom:5px;border-style:solid;border-width:0 0 5px 5px;border-color:transparent transparent #7f90a9 transparent}',
    '.vps.vps-icons .vps-i[aria-expanded=true]{background:rgba(255,255,255,.1);color:#fff}',
    '.vps .vps-bar{flex:0 0 auto;padding:8px;border-top:1px solid rgba(255,255,255,.1)}',
    '.vps.vps-icons .vps-team{display:flex;flex-direction:column;gap:2px;padding:8px 12px 4px}',
    '.vps.vps-icons .vps-lbl{margin:0 0 4px;text-align:center;letter-spacing:.08em}',
    '.vps.vps-icons .vps-pa{height:40px}',
    '.vps.vps-icons .vps-pa .vps-av{width:30px;height:30px}',
    '.vps.vps-icons .vps-me{padding:6px 12px 8px}',
    '.vps.vps-icons .vps-meb{justify-content:center;height:44px;padding:0}',
    '.vps.vps-icons .vps-meb .vps-a{width:32px;height:32px}',
    '.vps .vps-fly{position:fixed;z-index:60;left:80px;top:8px;display:flex;flex-direction:column;gap:2px;min-width:212px;max-width:calc(100vw - 96px);max-height:calc(100vh - 16px);overflow:auto;padding:6px;border-radius:12px;background:#143457;box-shadow:0 0 0 1px rgba(255,255,255,.1),0 22px 44px -14px rgba(4,12,28,.75);animation:vpsfly .18s cubic-bezier(.22,1,.36,1)}',
    '.vps .vps-fly[hidden]{display:none}',
    '@keyframes vpsfly{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}',
    '.vps .vps-fh{padding:8px 10px 6px;font:800 11px/1.3 Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#d8b25a}',
    '.vps .vps-fh.who{font:700 13.5px/1.3 Manrope,sans-serif;letter-spacing:normal;text-transform:none;color:#fff}',
    '.vps .vps-fh.who small{display:block;margin-top:1px;font:500 12px/1.35 Manrope,sans-serif;color:#a9b6c9}',
    '.vps .vps-fi{position:relative;display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:0 10px;border-radius:8px;font-size:13.5px;font-weight:600;color:#d5deea;text-align:left;white-space:nowrap;transition:background .15s,color .15s}',
    '.vps .vps-fi:hover{background:rgba(255,255,255,.08);color:#fff}',
    '.vps .vps-fi[aria-current=page]{background:rgba(255,255,255,.13);color:#fff;box-shadow:inset 3px 0 0 #6e96ff}',
    '.vps .vps-fi .vps-ft{flex:1;min-width:0}',
    '.vps .vps-fi svg{color:#9fb0c8}.vps .vps-fi.wa svg{color:#4fd08f}',
    '.vps .vps-tip{position:fixed;z-index:61;left:80px;top:0;max-width:calc(100vw - 96px);overflow:hidden;text-overflow:ellipsis;padding:6px 10px;border-radius:7px;background:#08192f;color:#fff;font:700 12px/1.3 Manrope,system-ui,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transform:translateX(-4px);transition:opacity .12s,transform .12s;box-shadow:0 0 0 1px rgba(255,255,255,.14),0 10px 24px -10px rgba(0,0,0,.6)}',
    '.vps .vps-tip.on{opacity:1;transform:none}',
    /* Before | After: horizontal in the top bar and the drawer, vertical in the rail */
    '.vp-ba,.vps .vp-ba{position:relative;display:grid;grid-template-columns:1fr 1fr;flex:none;width:168px;height:32px;margin:0;padding:3px;border:0;border-radius:9px;background:light-dark(#e6eaf1, oklch(22.6% 0.01 261.8));box-sizing:border-box}',
    '.vp-ba-th,.vps .vp-ba-th{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);margin:0;padding:0;border-radius:7px;background:#0f2a4a;box-shadow:0 2px 6px -2px rgba(15,42,74,.55);transition:transform .42s cubic-bezier(.22,1.2,.36,1);pointer-events:none}',
    '.vp-ba[data-on="1"] .vp-ba-th,.vps .vp-ba[data-on="1"] .vp-ba-th{transform:translateX(100%)}',
    '.vp-ba button,.vps .vp-ba button{position:relative;z-index:1;height:100%;margin:0;padding:0;border:0;border-radius:7px;background:none;box-shadow:none;font:700 12px/1 Manrope,system-ui,sans-serif;letter-spacing:normal;text-transform:none;color:light-dark(#4a5a72, oklch(81.4% 0.031 258.3));cursor:pointer;white-space:nowrap;transition:color .25s}',
    '.vp-ba button[aria-pressed="true"],.vps .vp-ba button[aria-pressed="true"]{color:#fff}',
    '.vp-ba button:focus-visible,.vps .vp-ba button:focus-visible{outline:2px solid #2e5cff;outline-offset:2px}',
    '.vps .vp-ba.vp-ba-v{grid-template-columns:1fr;grid-template-rows:1fr 1fr;width:56px;height:66px;margin:0 auto}',
    '@media (max-height:740px){.vps.vps-icons .vps-i,.vps.vps-icons .vps-pa{height:36px}.vps.vps-icons .vps-logo{height:52px}.vps.vps-icons .vps-lbl{display:none}}',
    '.vps .vp-ba.vp-ba-v .vp-ba-th{left:3px;right:3px;top:3px;bottom:auto;width:auto;height:calc(50% - 3px)}',
    '.vps .vp-ba.vp-ba-v[data-on="1"] .vp-ba-th{transform:translateY(100%)}',
    '.vps .vp-ba.vp-ba-v button{font-size:11.5px}',
    '.vp-ba-slot{display:inline-flex;align-items:center;vertical-align:middle;flex:none;margin:0 6px}',
    '.vps .vp-ba-drawer{padding:4px 12px 14px;margin:0;border-bottom:1px solid rgba(255,255,255,.08)}',
    '.vps .vp-ba-drawer .vp-ba{width:100%;height:46px}',
    '.vps .vp-ba-drawer .vp-ba button{font-size:13px}',
    /* the drawer (phone; any size through vcfoOpenSide) */
    '#vp-drawer-scrim{position:fixed;inset:0;z-index:2147483100;background:rgba(8,20,40,.45);opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s}',
    '#vp-drawer-scrim.on{opacity:1;visibility:visible}',
    '#vp-drawer{z-index:2147483101;left:0;width:min(320px,88vw);transform:translateX(-102%);visibility:hidden;transition:transform .32s cubic-bezier(.22,1,.36,1),visibility 0s linear .32s;box-shadow:20px 0 50px -20px rgba(0,0,0,.5);will-change:transform;overscroll-behavior:contain}',
    '#vp-drawer:not(.on) *{visibility:hidden!important}',
    '#vp-drawer.on{transform:none;visibility:visible;transition:transform .32s cubic-bezier(.22,1,.36,1),visibility 0s}',
    '#vp-drawer .vps-hd{flex:0 0 auto;display:flex;align-items:center;gap:8px;height:60px;padding:0 10px 0 0;border-bottom:1px solid rgba(255,255,255,.08)}',
    '#vp-drawer .vps-hd .vps-logo{flex:1;min-width:0;height:100%;padding:0 0 0 16px;border:0}',
    '#vp-drawer .vps-hd .vps-logo img{height:30px}',
    '#vp-drawer .vps-x{flex:none;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.08)}',
    '#vp-drawer .vps-nav{padding:10px 8px}',
    '#vp-drawer .vps-i{height:44px;font-size:14px}',
    '#vp-drawer .vps-sub .vps-i{height:40px;font-size:13.5px}',
    '#vp-drawer .vps-team{padding:12px 8px 8px}',
    '#vp-drawer .vps-p{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:6px 10px;height:auto;padding:8px}',
    '#vp-drawer .vps-p .vps-av{width:32px;height:32px}',
    '#vp-drawer .vps-p .vps-nm{white-space:normal}',
    '#vp-drawer .vps-p .vps-nm b{display:block;font-size:13.5px}#vp-drawer .vps-p .vps-nm small{display:block;font-size:12px}',
    '#vp-drawer .vps-c{grid-column:2;position:static;transform:none;opacity:1;visibility:visible;pointer-events:auto;padding:0;background:none;gap:6px}',
    '#vp-drawer .vps-c button{width:40px;height:40px;border-radius:9px}',
    '#vp-drawer .vps-meb{min-height:48px}',
    '#vp-drawer .vps-menu button{height:44px}',
    /* phone fallback menu band (only when a board has no [data-vp-menu]) */
    '.vps.vps-mbar{top:0;left:0;right:0;width:auto;height:var(--vp-menu-offset,56px);z-index:44;flex-direction:row;align-items:center;gap:10px;padding:0 8px;overflow:visible;background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4));box-shadow:0 1px 0 #e3e8ef}',
    '.vps .vps-mb{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:#0f2a4a;color:#fff}',
    '.vps .vps-mbl{display:block;height:28px;width:auto;max-width:120px;object-fit:contain}',
    'html[data-vp-menu-fallback] body{padding-top:var(--vp-menu-offset,56px)!important}',
    'html[data-vp-menu-fallback] [data-vp="top"]{top:var(--vp-menu-offset,56px)!important}',
    'body:has(#vp-side) #vp-mini{left:calc(var(--vps-w,248px) + 16px)}',
    'body:has(#vp-side) [data-vp="side"]:not(.vps){visibility:hidden}',
    '.vp-mlogo{display:block;height:26px;width:auto;max-width:44px;object-fit:contain;margin:0 2px 0 0;flex:0 0 auto}',
    '@media (prefers-reduced-motion: reduce){.vps-pill,.vps-rail,.vps-sub,.vps-cv,#vp-drawer,.vps-menu,.vp-ba-th,.vp-ba button,.vps-tip{transition:none!important}.vps-fly{animation:none!important}}'
  ].join('\n');
  document.head.appendChild(css);
```

Markup builders (full sidebar + drawer, rail, fly-outs) and the sliding pill (shell.js:268-361):

```js
  /* ---------- build ---------- */
  function incBadge() { return ls('after') === true ? '14/14' : '6/14'; }
  function badge(b, hot) { return b ? '<span class="vps-b' + (hot ? ' hot' : '') + '">' + b + '</span>' : ''; }
  function openGroups() { return ls('navOpen') || {}; }
  function logoA() { return '<a class="vps-logo" href="#" data-go="home" aria-label="VCFO Suite · Home"><img src="' + B(LOGO) + '" alt="VCFO Suite by SBC" height="34"></a>'; }
  function avatar(p) { return p.sup ? svg(I.head, 14) : p.ini; }
  function contactBtn(p, c, cls) { var who = p.sup ? 'support' : p.n; return '<button type="button" class="' + c + (cls ? ' ' + cls : '') + '" data-contact="' + VERB[c] + ' ' + who + '" aria-label="' + VERB[c] + ' ' + who + '">' + svg(I[c], cls ? 16 : 14) + (cls ? '<span class="vps-ft">' + VERB[c] + '</span>' : '') + '</button>'; }
  function meMenu() { return '<button type="button" role="menuitem" data-go="settings">' + lu('settings') + 'Settings</button><button type="button" role="menuitem" data-chat>' + svg(I.help) + 'Help · Ask VCFO</button><button type="button" role="menuitem" data-signout>' + svg(I.out) + 'Sign out</button>'; }

  /* full sidebar (desktop) and drawer */
  function build(drawerMode) {
    var act = active(), og = openGroups();
    var h = drawerMode ? '<div class="vps-hd">' + logoA() + '<button type="button" class="vps-x" data-close aria-label="Close menu">' + svg(I.x, 18) + '</button></div><div class="vp-ba-drawer">' + baHTML() + '</div>' : logoA();
    h += '<nav class="vps-nav" aria-label="Main"><span class="vps-pill" aria-hidden="true"></span><span class="vps-rail" aria-hidden="true"></span>';
    NAV.forEach(function (n) {
      if (n.kids) {
        var has = n.kids.some(function (c) { return c.k === act; });
        var open = og[n.g] === undefined ? has : og[n.g];
        h += '<button type="button" class="vps-i vps-g" data-group="' + n.g + '" aria-expanded="' + open + '"' + (has && !open ? ' data-holds="1"' : '') + '><span class="vps-ic">' + lu(n.i) + '</span><span class="vps-t">' + n.t + '</span>' + badge(n.badge, n.hot) + '<span class="vps-cv">' + svg(I.chev, 14) + '</span></button>';
        h += '<div class="vps-sub' + (open ? ' open' : '') + '" data-sub="' + n.g + '"><div' + (open ? '' : ' inert') + '>';
        n.kids.forEach(function (c) { h += '<a href="#" class="vps-i" data-go="' + c.k + '"' + (c.k === act ? ' aria-current="page"' : '') + (open ? '' : ' tabindex="-1"') + '><span class="vps-t">' + c.t + '</span>' + badge(c.badge, c.hot) + '</a>'; });
        h += '</div></div>';
      } else {
        h += '<a href="#" class="vps-i" data-go="' + n.k + '"' + (n.k === act ? ' aria-current="page"' : '') + '><span class="vps-ic">' + lu(n.i) + '</span><span class="vps-t">' + n.t + '</span>' + badge(n.badge === 'inc' ? incBadge() : n.badge) + '</a>';
      }
    });
    h += '</nav><div class="vps-team"><div class="vps-lbl">Northwind’s team</div>';
    TEAM.forEach(function (p) {
      h += '<div class="vps-p"' + (drawerMode ? '' : ' tabindex="0" role="group" aria-label="' + p.n + ', ' + p.r + ' · contact"') + '><span class="vps-av">' + avatar(p) + '</span><span class="vps-nm"><b>' + p.n + '</b> <small>' + (drawerMode ? '' : '· ') + p.r + '</small></span><span class="vps-c">';
      p.c.forEach(function (c) { h += contactBtn(p, c); });
      h += '</span></div>';
    });
    h += '</div><div class="vps-me"><div class="vps-mest">' +
      '<span class="vps-a">' + ME.ini + '</span><span class="vps-nm"><b>' + ME.n + '</b><small>' + ME.r + '</small></span>' +
      '<button type="button" class="vps-out" data-signout aria-label="Sign out" data-tip="Sign out">' + svg(I.out, 16) + '</button>' +
      '</div></div>';
    return h;
  }

  /* tablet rail: icons only; each item has a tooltip (data-tip); groups, people and the account open a fly-out */
  function buildRail() {
    var act = active();
    var h = '<a class="vps-logo" href="#" data-go="home" aria-label="VCFO Suite · Home" data-tip="VCFO Suite · Home">' + markImg('', 'VCFO Suite') + '</a>';
    h += '<nav class="vps-nav" aria-label="Main"><span class="vps-pill" aria-hidden="true"></span><span class="vps-rail" aria-hidden="true"></span>';
    NAV.forEach(function (n) {
      if (n.kids) {
        var has = n.kids.some(function (c) { return c.k === act; });
        h += '<button type="button" class="vps-i vps-g" data-fly="g:' + n.g + '" aria-haspopup="true" aria-expanded="false"' + (has ? ' data-cur="1"' : '') + ' data-tip="' + n.t + (n.badge ? ' · ' + n.badge + ' new' : '') + '"><span class="vps-ic">' + lu(n.i, 20) + '</span><span class="vps-t">' + n.t + '</span>' + badge(n.badge, n.hot) + '</button>';
      } else {
        h += '<a href="#" class="vps-i" data-go="' + n.k + '"' + (n.k === act ? ' aria-current="page"' : '') + ' data-tip="' + n.t + (n.badge === 'inc' ? ' · ' + incBadge() + ' steps' : n.badge ? ' · ' + n.badge : '') + '"><span class="vps-ic">' + lu(n.i, 20) + '</span><span class="vps-t">' + n.t + (n.badge === 'inc' ? ' · ' + incBadge() + ' steps' : '') + '</span>' + (n.badge && n.badge !== 'inc' ? badge(n.badge) : '') + '</a>';
      }
    });
    h += '</nav><div class="vps-bar" data-tip="Show the company before or after incorporation">' + baHTML(true) + '</div>';
    h += '<div class="vps-team"><div class="vps-lbl" aria-hidden="true">Team</div>';
    TEAM.forEach(function (p, i) {
      h += '<button type="button" class="vps-i vps-pa" data-fly="p:' + i + '" aria-haspopup="true" aria-expanded="false" aria-label="' + p.n + ', ' + p.r + ' · contact" data-tip="' + p.n + ' · ' + p.r + '"><span class="vps-av">' + avatar(p) + '</span></button>';
    });
    h += '</div><div class="vps-me"><div class="vps-mest vps-mest-rail"><span class="vps-a" role="img" aria-label="' + ME.n + ', ' + ME.r + '" data-tip="' + ME.n + ' · ' + ME.r + '">' + ME.ini + '</span>' +
      '<button type="button" class="vps-out" data-signout aria-label="Sign out" data-tip="Sign out">' + svg(I.out, 16) + '</button></div></div>';
    h += '<div class="vps-fly" role="menu" hidden></div><div class="vps-tip" aria-hidden="true"></div>';
    return h;
  }
  function flyHTML(key) {
    var act = active(), h = '', p;
    if (key.indexOf('g:') === 0) {
      var n = NAV.filter(function (x) { return x.g === key.slice(2); })[0];
      h = '<div class="vps-fh">' + n.t + '</div>';
      n.kids.forEach(function (c) { h += '<a href="#" class="vps-fi" role="menuitem" data-go="' + c.k + '"' + (c.k === act ? ' aria-current="page"' : '') + '><span class="vps-ft">' + c.t + '</span>' + badge(c.badge, c.hot) + '</a>'; });
    } else if (key.indexOf('p:') === 0) {
      p = TEAM[+key.slice(2)];
      h = '<div class="vps-fh who">' + p.n + '<small>' + p.r + '</small></div>';
      p.c.forEach(function (c) { h += contactBtn(p, c, 'vps-fi').replace('<button ', '<button role="menuitem" '); });
    } else {
      h = '<div class="vps-fh who">' + ME.n + '<small>' + ME.r + '</small></div>' + meMenu().replace(/<button type="button" role="menuitem"/g, '<button type="button" role="menuitem" class="vps-fi"').replace(/data-go="settings"/, 'data-go="settings"' + (act === 'settings' ? ' aria-current="page"' : ''));
    }
    return h;
  }

  /* active pill: slides from where it was on the last screen to the current item */
  function placePill(root, animate) {
    var nav = root.querySelector('.vps-nav'); if (!nav) return;
    var pill = nav.querySelector('.vps-pill'), rail = nav.querySelector('.vps-rail');
    var a = nav.querySelector('[aria-current=page]') || nav.querySelector('[data-cur]');
    if (a && a.closest('.vps-sub') && !a.closest('.vps-sub').classList.contains('open')) a = a.closest('.vps-sub').previousElementSibling;
    if (!a) { pill.style.opacity = '0'; rail.style.opacity = '0'; return; }
    var y = Math.round(a.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop), hgt = a.offsetHeight;
    if (!animate) { pill.style.transition = rail.style.transition = 'none'; }
    pill.style.opacity = rail.style.opacity = '1';
    pill.style.height = hgt + 'px';
    pill.style.transform = 'translateY(' + y + 'px)';
    rail.style.transform = 'translateY(' + (y + (hgt - 20) / 2) + 'px)';
    if (!animate) { pill.offsetWidth; pill.style.transition = rail.style.transition = ''; }
    if (root.id === 'vp-side') ss('pill-' + root.getAttribute('data-mode'), { y: y, h: hgt });
  }
```

Fly-outs, rail tooltips, click wiring, Esc + focus trap (shell.js:363-444):

```js
  /* ---------- fly-outs (rail) ---------- */
  var flyBtn = null;
  function closeFly(keepFocus) {
    if (!flyBtn) return;
    var b = flyBtn, root = b.closest('.vps'), fly = root && root.querySelector('.vps-fly');
    flyBtn = null;
    quiet(function () { b.setAttribute('aria-expanded', 'false'); if (fly) { fly.hidden = true; fly.innerHTML = ''; } });
    if (keepFocus) b.focus({ preventScroll: true });
  }
  function openFly(root, btn, kb) {
    if (flyBtn === btn) { closeFly(kb); return; }
    closeFly(); hideTip(root);
    var fly = root.querySelector('.vps-fly'), key = btn.getAttribute('data-fly');
    fly.innerHTML = flyHTML(key); fly.hidden = false; flyBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect(), sr = root.getBoundingClientRect(), fh = fly.offsetHeight;
    var top = key === 'me' ? r.bottom - fh : r.top - 6;
    fly.style.left = Math.round(sr.right + 8) + 'px';
    fly.style.top = Math.round(Math.max(8, Math.min(innerHeight - fh - 8, top))) + 'px';
    if (kb) { var f = fly.querySelector('a,button'); f && f.focus({ preventScroll: true }); }
  }

  /* ---------- rail tooltips ---------- */
  function hideTip(root) { var t = root && root.querySelector('.vps-tip'); if (t && t.classList.contains('on')) quiet(function () { t.classList.remove('on'); }); }
  function showTip(root, el) {
    var t = root.querySelector('.vps-tip'); if (!t || !el || el === flyBtn) return hideTip(root);
    quiet(function () {
      t.textContent = el.getAttribute('data-tip');
      var r = el.getBoundingClientRect(), sr = root.getBoundingClientRect();
      t.style.left = Math.round(sr.right + 8) + 'px';
      t.style.top = Math.round(Math.max(4, Math.min(innerHeight - t.offsetHeight - 4, r.top + r.height / 2 - t.offsetHeight / 2))) + 'px';
      t.classList.add('on');
    });
  }
  function wireTips(root) {
    root.addEventListener('mouseover', function (e) { var el = e.target.closest('[data-tip]'); if (el && !el.closest('.vps-fly')) showTip(root, el); else hideTip(root); });
    root.addEventListener('mouseleave', function () { hideTip(root); });
    root.addEventListener('focusin', function (e) { var el = e.target.closest('[data-tip]'); var fv = false; try { fv = e.target.matches(':focus-visible'); } catch (x) {} if (el && fv && !el.closest('.vps-fly')) showTip(root, el); });
    root.addEventListener('focusout', function () { hideTip(root); });
    root.addEventListener('scroll', function () { hideTip(root); closeFly(); }, { passive: true });
    root.addEventListener('pointerdown', function () { hideTip(root); });
  }

  function wire(root) {
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-fly],[data-go],[data-group],[data-contact],.vps-meb,[data-close],[data-signout],[data-chat]');
      if (!t) { if (!e.target.closest('.vps-fly')) { closeMenu(root); closeFly(); } return; }
      e.preventDefault(); e.stopPropagation();
      if (!t.classList.contains('vps-meb')) closeMenu(root);
      if (t.hasAttribute('data-fly')) { openFly(root, t, e.detail === 0); return; }
      if (t.hasAttribute('data-group')) {
        var g = t.getAttribute('data-group'), sub = root.querySelector('[data-sub="' + g + '"]'), open = t.getAttribute('aria-expanded') !== 'true';
        t.setAttribute('aria-expanded', String(open)); sub.classList.toggle('open', open); sub.firstElementChild.toggleAttribute('inert', !open);
        [].forEach.call(sub.querySelectorAll('a'), function (x) { open ? x.removeAttribute('tabindex') : x.setAttribute('tabindex', '-1'); });
        var og = openGroups(); og[g] = open; ls('navOpen', og);
        var steps = 0; (function follow() { placePill(root, true); if (++steps < 20) requestAnimationFrame(follow); })();
        return;
      }
      if (t.classList.contains('vps-meb')) { var m = root.querySelector('.vps-menu'); if (!m) return; var on = !m.classList.contains('on'); m.classList.toggle('on', on); m.toggleAttribute('inert', !on); t.setAttribute('aria-expanded', String(on)); return; }
      if (t.hasAttribute('data-close')) { closeDrawer(); return; }
      if (t.hasAttribute('data-contact')) { closeFly(); toast('Opening ' + t.getAttribute('data-contact') + '…'); return; }
      if (t.hasAttribute('data-signout')) { closeMenu(root); closeFly(); toast('Signed out · this is a prototype, so you stay on the page'); return; }
      if (t.hasAttribute('data-chat')) { closeMenu(root); closeFly(); closeDrawer(); if (window.vcfoChat) window.vcfoChat(); return; }
      var k = t.getAttribute('data-go'); closeMenu(root); closeFly();
      if (t.getAttribute('aria-current') === 'page' && k !== 'home') { toast('You are already on ' + t.textContent.replace(/\s·\s.*$/, '').replace(/\d+(\/\d+)?$/, '').trim()); return; }
      closeDrawer(); go(k);
    });
  }
  function closeMenu(root) { var m = root.querySelector('.vps-menu'); if (m && m.classList.contains('on')) { m.classList.remove('on'); m.setAttribute('inert', ''); root.querySelector('.vps-meb').setAttribute('aria-expanded', 'false'); } }
  document.addEventListener('click', function (e) { [side, drawer].forEach(function (r) { if (r && !r.contains(e.target)) closeMenu(r); }); if (side && !side.contains(e.target)) closeFly(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (flyBtn) { closeFly(true); return; }
      [side, drawer].forEach(function (r) { r && closeMenu(r); }); closeDrawer();
    } else if (e.key === 'Tab' && drawer && drawer.classList.contains('on')) {   // focus trap
      var f = [].filter.call(drawer.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (x) { return x.getAttribute('tabindex') !== '-1' && x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden'; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !drawer.contains(a))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !drawer.contains(a))) { e.preventDefault(); first.focus(); }
    }
  });
```

Mounting over the board column, drawer, fallback band, mobile logo, Before|After placement, breakpoint resize (shell.js:446-604):

```js
  /* ---------- desktop + tablet: cover the board's sidebar placeholder, pinned to the left edge ---------- */
  var side = null, drawer = null, scrim = null, holder = null;
  var NAVY = /^rgba?\(15, 42, 74/;
  function findHolder() {
    var s = document.querySelector('[data-vp="side"]:not(.vps)'); if (s) return s;
    var c = [].filter.call(document.querySelectorAll('[style*="--vp-side-w"]'), function (e) { return /(^|[;\s])width\s*:\s*var\(--vp-side-w/.test(e.getAttribute('style')) && !e.closest('.vps'); })[0];
    if (c) return c;
    var w = SW[BP]; if (!w) return null;
    var all = document.body ? document.body.querySelectorAll('div,aside,nav,section') : [];
    for (var i = 0; i < all.length; i++) {
      var e = all[i], r = e.getBoundingClientRect();
      if (Math.abs(r.width - w) <= 2 && r.left <= 2 && r.height >= Math.min(400, innerHeight * .6) && !e.closest('.vps') && NAVY.test(getComputedStyle(e).backgroundColor)) return e;
    }
    return null;
  }
  function boardSide() {
    if (window.__vcfoSideBox) { var x = window.__vcfoSideBox(); if (!x) return null; return { el: x.el || document.querySelector('[data-vp="side"]:not(.vps)') }; }
    if (holder && !document.contains(holder)) holder = null;
    holder = holder || findHolder();
    return holder ? { el: holder } : null;
  }
  function unmountSide() { if (!side) return; closeFly(); var s = side; side = null; quiet(function () { s.remove(); }); }
  function mountSide() {
    if (BP === 'phone') { unmountSide(); return false; }
    var b = boardSide(); if (!b) return false;
    var mode = BP === 'tablet' ? 'rail' : 'full';
    quiet(function () {
      if (side && side.getAttribute('data-mode') !== mode) { closeFly(); side.remove(); side = null; }
      if (!side) {
        side = document.createElement('aside'); side.id = 'vp-side'; side.className = 'vps' + (mode === 'rail' ? ' vps-icons' : ''); side.setAttribute('data-mode', mode); side.setAttribute('aria-label', 'Sidebar');
        side.innerHTML = mode === 'rail' ? buildRail() : build(false); document.body.appendChild(side); wire(side); if (mode === 'rail') wireTips(side);
        var prev = ss('pill-' + mode); var pill = side.querySelector('.vps-pill'), rail = side.querySelector('.vps-rail');
        if (prev && !reduce) { pill.style.transition = rail.style.transition = 'none'; pill.style.height = prev.h + 'px'; pill.style.transform = 'translateY(' + prev.y + 'px)'; rail.style.transform = 'translateY(' + (prev.y + (prev.h - 20) / 2) + 'px)'; pill.offsetWidth; pill.style.transition = rail.style.transition = ''; requestAnimationFrame(function () { requestAnimationFrame(function () { side && placePill(side, true); }); }); }
        else placePill(side, false);
        var img = side.querySelector('.vps-logo img'); if (img && !img.complete) img.addEventListener('load', function () { side && placePill(side, false); });
      }
      if (b.el && b.el.style.visibility !== 'hidden') b.el.style.visibility = 'hidden';
    });
    return true;
  }

  /* ---------- the drawer: phone menu, opened by any [data-vp-menu] (or a legacy "Open menu") button ---------- */
  function ensureDrawer() {
    if (drawer) return;
    quiet(function () {
      scrim = document.createElement('div'); scrim.id = 'vp-drawer-scrim'; scrim.addEventListener('click', closeDrawer);
      drawer = document.createElement('aside'); drawer.id = 'vp-drawer'; drawer.className = 'vps'; drawer.setAttribute('aria-label', 'Menu'); drawer.setAttribute('inert', ''); drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-hidden', 'true');
      drawer.innerHTML = build(true); document.body.appendChild(scrim); document.body.appendChild(drawer); wire(drawer);
    });
  }
  var lastFocus = null;
  function openDrawer() {
    ensureDrawer(); closeFly(); if (drawer.classList.contains('on')) return;
    lastFocus = document.activeElement;
    drawer.removeAttribute('inert'); scrim.classList.add('on'); drawer.classList.add('on'); drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.setAttribute('data-vp-drawer', 'open');   // outside quiet(): the board sees that the click did something
    requestAnimationFrame(function () { placePill(drawer, false); var f = drawer.querySelector('[data-close]'); f && f.focus({ preventScroll: true }); });
  }
  function closeDrawer() {
    if (!drawer || !drawer.classList.contains('on')) return;
    [drawer, side].forEach(function (r) { r && closeMenu(r); }); drawer.classList.remove('on'); scrim.classList.remove('on'); drawer.setAttribute('aria-hidden', 'true'); drawer.setAttribute('inert', '');
    document.documentElement.removeAttribute('data-vp-drawer');
    lastFocus && lastFocus.focus && document.contains(lastFocus) && lastFocus.focus({ preventScroll: true });
  }
  window.vcfoOpenSide = openDrawer; window.vcfoCloseSide = closeDrawer;
  var MENU_SEL = '[data-vp-menu],[aria-label="Open menu"],[aria-label="Menu"]';
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest(MENU_SEL);
    if (!b || b.closest('.vps')) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); openDrawer();
  }, true);

  /* phone: a board without a visible menu button gets a fallback band at the top */
  function boardMenu() { return [].filter.call(document.querySelectorAll(MENU_SEL), function (b) { if (b.closest('.vps')) return false; var r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden'; })[0] || null; }
  function ensureMenu() {
    var bar = document.getElementById('vp-mbar'), need = BP === 'phone' && !!document.body && !boardMenu();
    if (need && !bar) quiet(function () {
      bar = document.createElement('div'); bar.id = 'vp-mbar'; bar.className = 'vps vps-mbar';
      bar.innerHTML = '<button type="button" class="vps-mb" aria-label="Open menu" aria-haspopup="dialog">' + svg(I.menu, 20) + '</button>' + markImg('vps-mbl', 'VCFO Suite');
      bar.querySelector('.vps-mb').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openDrawer(); });
      document.body.appendChild(bar);
      document.documentElement.style.setProperty('--vp-menu-offset', '56px'); document.documentElement.setAttribute('data-vp-menu-fallback', '');
    });
    else if (!need && bar) quiet(function () { bar.remove(); document.documentElement.removeAttribute('data-vp-menu-fallback'); document.documentElement.style.removeProperty('--vp-menu-offset'); });
  }

  /* the VCFO mark next to the board's hamburger in phone top bars */
  function mobileLogo() {
    if (BP !== 'phone' || document.querySelector('.vp-mlogo')) return;
    var b = boardMenu(); if (!b || b.getBoundingClientRect().top > 80 || (b.parentElement && b.parentElement.querySelector('img'))) return;
    quiet(function () { var t = document.createElement('div'); t.innerHTML = markImg('vp-mlogo', 'VCFO Suite'); b.insertAdjacentElement('afterend', t.firstChild); });
  }

  /* Before | After: one sliding pill. Desktop: in the top bar before Announcements. Tablet: in the rail. Phone: top of the drawer. State: vcfo.after */
  function baHTML(vertical) {
    var on = ls('after') === true;
    return '<div class="vp-ba' + (vertical ? ' vp-ba-v' : '') + '" role="group" aria-label="Before or after incorporation" data-on="' + (on ? 1 : 0) + '"><span class="vp-ba-th" aria-hidden="true"></span><button type="button" data-ba="0" aria-pressed="' + (!on) + '">Before</button><button type="button" data-ba="1" aria-pressed="' + on + '">After</button></div>';
  }
  function syncBA() {
    var on = ls('after') === true;
    [].forEach.call(document.querySelectorAll('.vps [data-go="incorporation"] .vps-b'), function (b) { b.textContent = incBadge(); });
    [].forEach.call(document.querySelectorAll('.vps-icons [data-go="incorporation"]'), function (a) { a.setAttribute('data-tip', 'Incorporation · ' + incBadge() + ' steps'); var t = a.querySelector('.vps-t'); if (t) t.textContent = 'Incorporation · ' + incBadge() + ' steps'; });
    [].forEach.call(document.querySelectorAll('.vp-ba'), function (g) {
      g.setAttribute('data-on', on ? '1' : '0');
      [].forEach.call(g.querySelectorAll('button'), function (b, i) { b.setAttribute('aria-pressed', String((i === 1) === on)); });
    });
  }
  window.vcfoSyncBA = syncBA;
  /* top-bar slot: flow boards get the pill before Announcements; absolute boards get it just left of Search, re-placed on change */
  function placeTopSlot(slot, ann) {
    var par = ann.parentElement, pr = par.getBoundingClientRect();
    var anchor = [].filter.call(par.querySelectorAll('[aria-label^="Search"]'), function (x) { return x.parentElement === par; })[0] || ann;
    var ar = anchor.getBoundingClientRect(), W = slot.offsetWidth || 168, H = slot.offsetHeight || 32;
    var s = 'position:absolute;margin:0;left:' + Math.round(ar.left - pr.left - (par.clientLeft || 0) - W - 10) + 'px;top:' + Math.round(ar.top + ar.height / 2 - pr.top - (par.clientTop || 0) - H / 2) + 'px';
    if (slot.getAttribute('style') !== s) slot.setAttribute('style', s);
  }
  function topWanted() { return BP === 'desktop' || (BP === 'tablet' && !side); }
  function mountBA() {
    var slot = document.getElementById('vp-ba-top');
    if (!topWanted()) { if (slot) quiet(function () { slot.remove(); }); return; }
    if (slot) { if (slot.getAttribute('data-abs') === '1') { var an = [].filter.call(document.querySelectorAll('[aria-label="Announcements"]'), function (x) { return x.closest('#vp-ba-top') === null && x.parentElement === slot.parentElement; })[0]; if (an) quiet(function () { placeTopSlot(slot, an); }); } return; }
    var ann = [].filter.call(document.querySelectorAll('[aria-label="Announcements"]'), function (x) { return !x.closest('.vps,#vp-drawer,#vp-chat,#vp-bar') && x.getBoundingClientRect().top < 90 && x.getClientRects().length && x.parentElement; })[0];
    if (!ann) return;
    var abs = /absolute|fixed/.test(getComputedStyle(ann).position);
    quiet(function () {
      var w = document.createElement('div'); w.id = 'vp-ba-top'; w.className = 'vp-ba-slot'; w.innerHTML = baHTML();
      if (abs) { w.setAttribute('data-abs', '1'); ann.parentElement.appendChild(w); placeTopSlot(w, ann); }
      else ann.parentElement.insertBefore(w, ann);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.vp-ba button[data-ba]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var v = b.getAttribute('data-ba') === '1';
    if (v === (ls('after') === true)) { toast('Already showing the company ' + (v ? 'after' : 'before') + ' incorporation'); return; }
    if (window.vcfoSetAfter) window.vcfoSetAfter(v); else { ls('after', v); syncBA(); }
  });
  setInterval(function () { if (side) mountSide(); mountBA(); ensureMenu(); }, 600);   // re-hides a board sidebar that re-rendered   // boards may re-render their top bar; this only inserts when the pill is missing

  var tries = 0;
  function tick() {
    if (BP !== 'phone') mountSide(); else { unmountSide(); var b = boardSide(); if (b && b.el && b.el.style.visibility !== 'hidden') quiet(function () { b.el.style.visibility = 'hidden'; }); mobileLogo(); if (tries >= 3) ensureMenu(); }
    if (++tries < 40) setTimeout(tick, 150);
  }
  var rq = 0;
  addEventListener('resize', function () {
    if (rq) return;
    rq = requestAnimationFrame(function () {
      rq = 0; closeFly(); if (side) hideTip(side);
      if (applyBP()) {
        if (BP !== 'phone') closeDrawer();
        holder = null; mountSide(); mountBA(); ensureMenu(); if (BP === 'phone') mobileLogo();
        if (tries >= 40) { tries = 30; tick(); }   // boards re-render after a breakpoint change: look again for a while
      } else if (side) placePill(side, false);
    });
  });
  window.vcfoShell = { openDrawer: openDrawer, closeDrawer: closeDrawer, mount: mountSide, bp: function () { return BP; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
})();
```

Rendered HTML of the desktop sidebar (what `build(false)` produces for Home, Before state; icons shortened to `<svg …lucide k…/>`):

```html
<aside id="vp-side" class="vps" data-mode="full" aria-label="Sidebar">
  <a class="vps-logo" href="#" data-go="home" aria-label="VCFO Suite · Home"><img src="brand/vcfo-logo-on-black.png" alt="VCFO Suite by SBC" height="34"></a>
  <nav class="vps-nav" aria-label="Main">
    <span class="vps-pill" aria-hidden="true"></span><span class="vps-rail" aria-hidden="true"></span>
    <a href="#" class="vps-i" data-go="home" aria-current="page"><span class="vps-ic"><svg …layout-dashboard…/></span><span class="vps-t">Home</span></a>
    <button type="button" class="vps-i vps-g" data-group="updates" aria-expanded="false"><span class="vps-ic"><svg …megaphone…/></span><span class="vps-t">Updates</span><span class="vps-b hot">3</span><span class="vps-cv"><svg …chev 14…/></span></button>
    <div class="vps-sub" data-sub="updates"><div inert>
      <a href="#" class="vps-i" data-go="announcements" tabindex="-1"><span class="vps-t">Announcements</span></a>
      <a href="#" class="vps-i" data-go="notifications" tabindex="-1"><span class="vps-t">Notifications</span><span class="vps-b hot">3</span></a>
    </div></div>
    <a href="#" class="vps-i" data-go="incorporation"><span class="vps-ic"><svg …building-2…/></span><span class="vps-t">Incorporation</span><span class="vps-b">6/14</span></a>
    <button type="button" class="vps-i vps-g" data-group="compliances" aria-expanded="false">…Compliances…<span class="vps-cv">…</span></button>
    <div class="vps-sub" data-sub="compliances"><div inert>…Calendar…Filings…</div></div>
    <a href="#" class="vps-i" data-go="documents">…Documents<span class="vps-b">6</span></a>
    <a href="#" class="vps-i" data-go="knowledge-bank">…Library</a>
    <a href="#" class="vps-i" data-go="credentials">…Credentials</a>
    <a href="#" class="vps-i" data-go="team">…Team</a>
    <a href="#" class="vps-i" data-go="audit">…Audit</a>
    <a href="#" class="vps-i" data-go="settings">…Settings</a>
  </nav>
  <div class="vps-team"><div class="vps-lbl">Northwind’s team</div>
    <div class="vps-p" tabindex="0" role="group" aria-label="Priya Raman, Project Manager · contact">
      <span class="vps-av">PR</span><span class="vps-nm"><b>Priya Raman</b> <small>· Project Manager</small></span>
      <span class="vps-c">
        <button type="button" class="wa" data-contact="WhatsApp Priya Raman" aria-label="WhatsApp Priya Raman"><svg …wa 14…/></button>
        <button type="button" class="call" … aria-label="Call Priya Raman">…</button>
        <button type="button" class="mail" … aria-label="Email Priya Raman">…</button>
        <button type="button" class="teams" … aria-label="Teams Priya Raman">…</button>
      </span>
    </div>
    <div class="vps-p" …>Arjun Mehta · Project Lead …</div>
    <div class="vps-p" … aria-label="Customer support, SBC help desk · contact"><span class="vps-av"><svg …head 14…/></span>… verbs: wa, mail, teams, call (aria "WhatsApp support" …)</div>
  </div>
  <div class="vps-me"><div class="vps-mest">
    <span class="vps-a">RK</span><span class="vps-nm"><b>Rohan Kumar</b><small>Northwind · Client</small></span>
    <button type="button" class="vps-out" data-signout aria-label="Sign out" data-tip="Sign out"><svg …out 16…/></button>
  </div></div>
</aside>
```

### 4.2 Top bar (team board = the responsive reference; home variant below)

`s/team/topbar.dc.html:13-89` (style + markup + logic, verbatim):

```html
<style>body{margin:0}
/* v7 responsive top bar: phone <=767 (menu button, current page only), tablet 768-1279 (narrow search), desktop >=1280 */
.tbar{height:52px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9));-webkit-backdrop-filter:saturate(1.4) blur(10px);backdrop-filter:saturate(1.4) blur(10px);box-sizing:border-box;min-width:0}
.tbar-mw{display:none;flex:none;align-items:center;gap:6px}
.tbar-menu{display:inline-flex;flex:none;width:40px;height:40px;margin-left:-6px;border:0;border-radius:8px;background:transparent;color:var(--fg);align-items:center;justify-content:center;cursor:pointer;padding:0}
.tbar-menu:hover{background:var(--raised)}
.tbar-logo{display:flex;flex:none}
.tbar-nav{flex:1;min-width:0;display:flex;align-items:center;gap:6px;overflow:hidden}
.tbar-ic{flex:none;width:24px;height:24px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center}
.tbar-ol{display:flex;align-items:center;gap:4px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden;font-size:13px}
.tbar-ol li{white-space:nowrap}
.tbar-ol li.tbar-cur{font-weight:600;color:var(--fg);overflow:hidden;text-overflow:ellipsis;min-width:0}
.tbar-r{margin-left:auto;flex:none;display:flex;align-items:center;gap:6px}
.tbar-srch{display:flex;align-items:center;gap:8px;width:256px;height:36px;padding:0 10px 0 12px;box-sizing:border-box;border-radius:8px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope,sans-serif;cursor:text}
.tbar-srch .tbar-sl{flex:1;text-align:left}
.tbar-srch .kbd{font-size:11px}
.tbar-ib{position:relative;flex:none;width:36px;height:36px;border-radius:8px;border:0;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer}
.tbar-badge{position:absolute;top:3px;right:3px;min-width:16px;height:16px;padding:0 3px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font:700 11px/1 Manrope,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)}
@media (max-width:1279px){.tbar-srch{width:196px}}
@media (max-width:959px){
  .tbar-srch{width:36px;padding:0;justify-content:center}
  .tbar-srch .tbar-sl,.tbar-srch .kbd{display:none}
  .tbar-pre{display:none}
}
@media (max-width:767px){
  .tbar{padding:0 12px;gap:8px}
  .tbar-mw{display:inline-flex}
  .tbar-logo,.tbar-ic,.tbar-mid,.tbar-theme{display:none}
  .tbar-ol{font-size:15px}
  .tbar-ol li.tbar-cur{font-weight:700}
  .tbar-r{gap:4px}
  .tbar-srch,.tbar-ib{width:40px;height:40px}
  .tbar-srch{border-color:transparent;background:transparent;color:var(--muted)}
}
</style>
</helmet>
<div style="width:100%;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<header class="tbar">
  <span class="tbar-mw"><button type="button" class="tbar-menu" data-vp-menu="" aria-label="Open menu" onClick="{{openMenu}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16 M4 12h16 M4 18h16"></path></svg></button></span>
  <a href="#" aria-label="SBC home" class="tbar-logo" data-tip="SBC home" data-tip-below=""><img src="vcfo-bin:b/58222daec003642d1a412d8c2b427c36.png" alt="SBC" style="height:26px;width:auto"></a>
  <nav aria-label="Location" class="tbar-nav">
    <span class="tbar-ic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z"></path></svg></span>
    <ol class="tbar-ol">
      <li class="tbar-pre tbar-mid" style="color:var(--muted);font-weight:500">Home</li>
      <sc-if value="{{hasMid}}" hint-placeholder-val="{{true}}"><li aria-hidden="true" class="tbar-pre tbar-mid" style="color:var(--subtle)">/</li><li class="tbar-mid" style="color:var(--muted);font-weight:500">{{mid}}</li></sc-if>
      <li aria-hidden="true" class="{{sepCls}}" style="color:var(--subtle)">/</li>
      <li aria-current="page" class="tbar-cur">{{crumb}}</li>
    </ol>
  </nav>
  <div class="tbar-r">
    <button type="button" class="tbar-srch" aria-label="Search (⌘K)" data-tip="Search (⌘K)" data-tip-below=""><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex:none;color:oklch(54.6% 0.215 263 / .8)"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><span class="tbar-sl">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></button>
    <button type="button" class="tbar-ib" aria-label="Announcements" style="{{annStyle}}" data-tip="Announcements" data-tip-below=""><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14 M8 6v8"></path></svg><sc-if value="{{hasAnn}}" hint-placeholder-val="{{true}}"><span style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:99px;background:var(--gold);box-shadow:0 0 0 2px var(--panel)"></span></sc-if></button>
    <button type="button" class="tbar-ib" aria-label="Notifications" style="{{notStyle}}" data-tip="Notifications" data-tip-below=""><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path><path d="M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg><sc-if value="{{hasNot}}" hint-placeholder-val="{{true}}"><span class="tbar-badge">{{notif}}</span></sc-if></button>
    <button type="button" class="tbar-ib tbar-theme" aria-label="Switch to dark theme" style="border:1px solid var(--border);background:var(--panel);color:var(--muted)" data-tip="Switch to dark theme" data-tip-below=""><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4"></path></svg></button>
    <sc-if value="{{legacy}}" hint-placeholder-val="{{false}}"><a href="#" style="display:flex;align-items:center;gap:6px;height:36px;padding:0 8px;border-radius:8px;color:var(--muted);font-size:13px;font-weight:500"><span class="av" style="width:24px;height:24px;font-size:11px;font-weight:600;background:var(--primary-fill,var(--primary));box-shadow:none">RK</span>Profile</a></sc-if>
  </div>
</header>
</div>
</template></x-dc><script>(function(){var x=document.querySelector("x-dc"),t=x&&x.firstElementChild;if(t&&t.tagName==="TEMPLATE"){x.replaceChildren(document.adoptNode(t.content));}})();</script>
<script type="text/x-dc" data-dc-script data-props='{"crumb":{"editor":"text","default":"Team"},"mid":{"editor":"text","default":""},"notif":{"editor":"int","default":3},"active":{"editor":"enum","options":["","ann","notif"],"default":""},"legacy":{"editor":"boolean","default":false},"$preview":{"width":1192,"height":52}}'>
class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    const n = Number(p.notif ?? 3);
    const on = 'background:var(--primary-light);color:var(--primary)';
    const off = 'background:transparent;color:var(--muted)';
    return {
      crumb: p.crumb ?? 'Team', mid: p.mid ?? '', hasMid: Boolean(p.mid),
      notif: n, hasNot: n > 0, hasAnn: p.active !== 'ann',
      annStyle: p.active === 'ann' ? on : off,
      notStyle: p.active === 'notif' ? on : off,
      legacy: Boolean(p.legacy), sepCls: p.mid ? 'tbar-mid' : 'tbar-pre tbar-mid',
      openMenu: () => { if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell) window.vcfoShell.openDrawer(); }
    };
  }
}
</script>
```

`s/docs/topbar.dc.html:13-68` (Documents variant: menu button inside the bar, search folds below 1280):

```html
<style>
body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:500 10px "IBM Plex Mono",monospace;color:var(--muted)}
.duo{fill:currentColor;stroke:none;opacity:.26}
.tbb{position:relative;width:36px;height:36px;border-radius:6px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer}
.tbb:hover{background:var(--primary-light);color:var(--fg)}
button:focus-visible,a:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px}
/* v7 responsive: phone <=767 shows the menu button; the search box folds to an icon below 1180 px */
.vtb{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:0 16px;min-width:0}
.vtb-menu{display:none}
.vtb-srch{display:flex;align-items:center;gap:8px;width:clamp(180px,18vw,256px);height:36px;padding:0 10px 0 12px;border-radius:6px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope,sans-serif;cursor:text;box-sizing:border-box}
.kbd{font-size:11px}
@media (max-width:1279px){.vtb-srch{width:36px;padding:0;justify-content:center}.vtb-srch .vtb-t,.vtb-srch .kbd{display:none}}
@media (max-width:767px){
  .vtb{gap:6px;padding:0 8px}
  .vtb-menu{display:flex}
  .vtb .tbb,.vtb-srch{width:40px;height:40px}
  .vtb-logo img{height:22px!important}
  .vtb-ci,.vtb-theme{display:none!important}
  .vtb-act{gap:2px!important}
}
</style>
</helmet>
<header class="vtb" style="border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9));font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
  <button type="button" class="tbb vtb-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
  <a href="#" class="vtb-logo" aria-label="SBC home" style="display:flex;flex:none"><img src="vcfo-bin:b/58380a4992a06cfe5c18a947b721abdf.png" alt="SBC" style="height:26px;width:auto"></a>
  <nav aria-label="Location" style="flex:1;min-width:0;display:flex;align-items:center;gap:6px">
    <span class="vtb-ci" style="flex:none;width:24px;height:24px;border-radius:6px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M3.5 8h17v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"></path><path d="M3.5 18V6A1.5 1.5 0 0 1 5 4.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"></path></svg></span>
    <ol style="display:flex;align-items:center;gap:4px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden">
      <li style="font-size:13px;font-weight:{{w1}};color:{{c1}};white-space:nowrap">{{trail}}</li>
      <sc-if value="{{hasLeaf}}" hint-placeholder-val="{{false}}"><li aria-hidden="true" style="color:var(--subtle)">/</li><li aria-current="page" style="min-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fg)">{{leaf}}</li></sc-if>
    </ol>
  </nav>
  <div class="vtb-act" style="margin-left:auto;flex:none;display:flex;align-items:center;gap:6px">
    <button type="button" class="vtb-srch" aria-label="Search (⌘K)" style="{{searchStyle}}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="color:oklch(54.6% 0.215 263 / .8)"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><span class="vtb-t" style="flex:1;text-align:left">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></button>
    <button type="button" class="tbb" aria-label="Announcements"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M4 10h3l8-4.5v13L7 14H4Z"></path><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"></path></svg></button>
    <button type="button" class="tbb" aria-label="Notifications, 3 new" style="background:var(--primary-light);color:var(--primary)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z"></path><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg><span style="position:absolute;top:4px;right:4px;min-width:17px;height:17px;padding:0 3px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)">3</span></button>
    <button type="button" class="vtb-theme" aria-label="Switch to dark theme" style="width:36px;height:36px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="duo" d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z"></path><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4"></path></svg></button>
  </div>
</header>
</template></x-dc><script>(function(){var x=document.querySelector("x-dc"),t=x&&x.firstElementChild;if(t&&t.tagName==="TEMPLATE"){x.replaceChildren(document.adoptNode(t.content));}})();</script>
<script type="text/x-dc" data-dc-script data-props='{"trail":{"editor":"text","default":"Documents"},"leaf":{"editor":"text","default":""},"compact":{"editor":"boolean","default":false},"$preview":{"width":1192,"height":52}}'>
class Component extends DCLogic {
  renderVals() {
    const leaf = this.props.leaf ?? '';
    const has = !!leaf;
    return {
      trail: this.props.trail ?? 'Documents', leaf, hasLeaf: has,
      w1: has ? 500 : 600, c1: has ? 'var(--muted)' : 'var(--fg)',
      searchStyle: this.props.compact ? 'display:none' : '',
      openSide: (e) => { if (e && e.defaultPrevented) return; if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell && window.vcfoShell.openDrawer) window.vcfoShell.openDrawer(); }
    };
  }
}
</script>
```

Home top bar (`s/home/v7_before.dc.html:249`, the `<header class="vh-top">` element only):

```html
<header class="vh-top" style="height:52px;display:flex;align-items:center;gap:var(--vh-hg);padding:0 var(--vh-hp);border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))"><button type="button" class="vh-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16 M4 12h16 M4 17h16"></path></svg></button><a href="#" aria-label="SBC home" style="display:flex;flex:none"><img src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC" style="height:26px;width:auto"></a><nav class="vh-crumb" aria-label="Location" style="flex:1;min-width:0;display:flex;align-items:center;gap:6px"><span style="flex:none;width:24px;height:24px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 4.5h6v7h-6Z M13.5 12.5h6v7h-6Z"></path><path d="M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z"></path></svg></span><ol style="display:flex;align-items:center;gap:4px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden"><li style="flex:0 1 auto;min-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fg)" aria-current="page" title="Home">Home</li></ol></nav><div style="margin-left:auto;flex:none;display:flex;align-items:center;gap:6px"><button type="button" class="vh-search" aria-label="Search (⌘K)" style="display:flex;align-items:center;gap:8px;height:36px;border-radius:8px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope,sans-serif;cursor:text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:oklch(54.6% 0.215 263 / .8)"><path class="duo" d=""></path><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><span style="flex:1;text-align:left">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></button><button type="button" aria-label="Announcements" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4 10h3l8-4.5v13L7 14H4Z"></path><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"></path></svg></button><button type="button" aria-label="Notifications, 3 new" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;background:var(--primary-light);color:var(--primary)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z"></path><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg><span style="position:absolute;top:4px;right:4px;min-width:15px;height:15px;padding:0 2px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)">3</span></button><button type="button" aria-label="Switch to dark theme" style="width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z"></path><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4"></path></svg></button></div></header>
```

Home `v7x_topbar` "Long trail" variant (chevron separators, truncation; `s/home/v7x_topbar.dc.html:144`, second example):

```html
<header style="height:52px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))"><a href="#" aria-label="SBC home" style="display:flex;flex:none"><img src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC" style="height:26px;width:auto"></a><nav aria-label="Location" style="flex:1;min-width:0;display:flex;align-items:center;gap:6px"><span style="flex:none;width:24px;height:24px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 4.5h6v7h-6Z M13.5 12.5h6v7h-6Z"></path><path d="M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z"></path></svg></span><ol style="display:flex;align-items:center;gap:4px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden"><li style="flex:0 1 auto;min-width:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Incorporation"><a href="#" style="font-size:13px;color:var(--muted);font-weight:500">Incorporation</a></li><span aria-hidden="true" style="flex:none;color:light-dark(oklch(45% 0.03 255 / .45), oklch(82% 0.021 255 / 0.45));display:flex"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></span><li style="flex:0 1 auto;min-width:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="SPICe+ Part B"><a href="#" style="font-size:13px;color:var(--muted);font-weight:500">SPICe+ Part B</a></li><span aria-hidden="true" style="flex:none;color:light-dark(oklch(45% 0.03 255 / .45), oklch(82% 0.021 255 / 0.45));display:flex"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></span><li style="flex:0 1 auto;min-width:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Step 7 · Registered Office Address"><a href="#" style="font-size:13px;color:var(--muted);font-weight:500">Step 7 · Registered Office Address</a></li><span aria-hidden="true" style="flex:none;color:light-dark(oklch(45% 0.03 255 / .45), oklch(82% 0.021 255 / 0.45));display:flex"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></span><li style="flex:0 1 auto;min-width:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Documents"><a href="#" style="font-size:13px;color:var(--muted);font-weight:500">Documents</a></li><span aria-hidden="true" style="flex:none;color:light-dark(oklch(45% 0.03 255 / .45), oklch(82% 0.021 255 / 0.45));display:flex"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></span><li style="flex:0 1 auto;min-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fg)" aria-current="page" title="NOC from property owner">NOC from property owner</li></ol></nav><div style="margin-left:auto;flex:none;display:flex;align-items:center;gap:6px"><button type="button" aria-label="Search (⌘K)" style="display:flex;align-items:center;gap:8px;width:256px;height:36px;padding:0 10px 0 12px;border-radius:8px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope,sans-serif;cursor:text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:oklch(54.6% 0.215 263 / .8)"><path class="duo" d=""></path><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><span style="flex:1;text-align:left">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></button><button type="button" aria-label="Announcements" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4 10h3l8-4.5v13L7 14H4Z"></path><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"></path></svg></button><button type="button" aria-label="Notifications, 3 new" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;background:var(--primary-light);color:var(--primary)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z"></path><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg><span style="position:absolute;top:4px;right:4px;min-width:15px;height:15px;padding:0 2px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:9px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)">3</span></button><button type="button" aria-label="Switch to dark theme" style="width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z"></path><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4"></path></svg></button></div></header>
```

Home responsive layer used by the top bar, drill and pop-overs (`s/home/v7x_drilldown.dc.html:142-223`, identical in every home board):

```css
<style data-vh="1">
/* v7 responsive layer (Home) - board root, sidebar column, top bar, card grid */
.vh-root{position:relative;width:100%;min-height:100vh;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.vh-side{width:var(--vp-side-w,248px);flex:none;background:#0f2a4a;overflow:hidden}
.vh-body{flex:1;min-width:0}
.vh-top{--vh-hg:12px;--vh-hp:16px}
.vh-menu{display:none;flex:none;width:40px;height:40px;margin-left:-6px;border:0;border-radius:8px;background:none;color:var(--navy-ink,var(--navy));align-items:center;justify-content:center;cursor:pointer}
.vh-menu:hover{background:var(--primary-light)}
.vh-search{width:256px;padding:0 10px 0 12px}
.vh-main{box-sizing:border-box;width:100%;max-width:1600px;margin-inline:auto;padding:clamp(12px,2vw,24px);display:grid;gap:16px;align-items:start;grid-template-columns:minmax(0,1fr)}
.vh-main>.stag{display:flex;flex-direction:column;gap:16px;min-width:0}
.vh-b{grid-template-areas:"g" "a" "c1" "b" "c2"}
.vh-a{grid-template-areas:"g" "a1" "c1" "a2" "c2" "f" "d" "e"}
@media (min-width:600px){
 .vh-b{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"g g" "a a" "c1 c2" "b b"}
 .vh-a{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"g g" "a1 a1" "c1 a2" "c1 c2" "f f" "d e";grid-template-rows:auto auto auto 1fr}
}
@media (min-width:1180px){
 .vh-b{grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-areas:"g g" "a c1" "a c2" "b c2";grid-template-rows:auto auto 1fr auto}
 .vh-a{grid-template-columns:repeat(6,minmax(0,1fr));grid-template-areas:"g g g g g g" "a1 a1 a1 a1 c1 c1" "a1 a1 a1 a1 c2 c2" "a2 a2 a2 a2 c2 c2" "f f f f f f" "d d d e e e";grid-template-rows:auto auto 1fr auto}
}
@media (min-width:1800px){
 .vh-b{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-areas:"g g g" "a c1 c2" "b b c2";grid-template-rows:auto auto 1fr}
 .vh-a{grid-template-areas:"g g g g g g" "a1 a1 a2 a2 c1 c1" "a1 a1 c2 c2 c1 c1" "f f f f f f" "d d d e e e";grid-template-rows:auto auto 1fr}
}
@media (max-width:1099px){
 .vh-search{width:36px;padding:0;justify-content:center}
 .vh-search>span{display:none!important}
}
@media (max-width:767px){
 .vh-top{--vh-hg:6px;--vh-hp:10px}
 .vh-menu{display:flex}
 .vh-crumb>*{display:none!important}
 .vh-top img{height:22px!important}
 .vh-top button{min-width:40px;min-height:40px}
 .vh-hide-sm{display:none!important}
 .card .btn,.card .seg button{min-height:40px}
 .card:hover{transform:none}
}
@media (max-width:479px){.vh-hide-xs{display:none!important}}
.vh-pbar{display:none}
@media (max-width:767px){
 .vh-pbar{display:flex;position:absolute;left:0;right:0;top:0;height:52px;z-index:4;align-items:center;gap:6px;padding:0 10px;background:light-dark(#fff, oklch(13% 0 89.9));border-bottom:1px solid var(--border);box-sizing:border-box}
 .vh-pbar .vh-menu{display:flex}
 .vh-under-bar{top:52px!important}
 .vh-zoom{bottom:72px!important}
}
/* cards: let long text shrink, headers wrap, tables and charts scroll inside their own box */
.card [style*="flex:1"]{min-width:0}
section.card>div:first-of-type{flex-wrap:wrap;row-gap:8px}
.vh-x{overflow-x:auto;max-width:100%;overscroll-behavior-x:contain}
.vh-x>table{min-width:var(--tmin,520px)}
.vh-tl{overflow-x:auto;overscroll-behavior-x:contain}
.vh-stats{row-gap:8px}
@media (max-width:599px){
 .vh-gtop{flex-wrap:wrap}
 .vh-stats{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px 12px}
 .vh-stat{border-right:0!important;margin-right:0!important;padding-right:0!important}
}
@media (max-width:767px){
 .vh-segwrap{display:flex!important;flex-wrap:wrap;gap:2px}
 .vh-segwrap>.thumb{display:none}
 .vh-segwrap button{flex:1 1 auto}
 .vh-segwrap button.on{background:var(--navy);color:#fff}
}
/* pop-ups always fit the viewport; closed ones take no space (no phantom page scroll) */
.info .pop{max-width:min(280px,calc(100vw - 24px));display:none}
.info:focus-within .pop,.info.open .pop{display:block;animation:vhfade .15s ease-out}
.tipw .tt{display:none}
.tipw:hover>.tt,.tipw:focus-visible>.tt{display:block;animation:vhfade .12s ease-out}
@keyframes vhfade{from{opacity:0}to{opacity:1}}
.vh-dd{width:min(600px,calc(100vw - 24px))!important;max-height:min(560px,calc(100dvh - 24px))!important}
@media (max-width:640px){
 .vh-dd .seg{display:flex!important;flex-wrap:wrap;gap:2px}
 .vh-dd .seg>.thumb{display:none}
 .vh-dd .seg button{flex:1 1 auto}
 .vh-dd .seg button.on{background:var(--navy);color:#fff}
 .vh-dd .ddrow{grid-template-columns:minmax(0,1fr) 116px 16px}
 .vh-dd .ddrow>.mono{display:none}
}
@media (pointer:coarse){.info>button{position:relative}.info>button::after{content:"";position:absolute;inset:-11px}}
</style>
```

### 4.3 Theme + dark tokens + global runtime CSS + toast — `proto.js:6-77` and `118-166`

```js
  /* ---------- theme: light, dark (True black) or follow the system; remembered across pages ---------- */
  (function () {
    var KEY = 'vcfo.theme', mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    function saved() { try { var v = JSON.parse(localStorage.getItem(KEY)); return v === 'dark' || v === 'system' ? v : 'light'; } catch (e) { return 'light'; } }
    function resolved() { var m = saved(); return m === 'system' ? (mq && mq.matches ? 'dark' : 'light') : m; }
    function apply() {
      var t = resolved(), r = document.documentElement;
      r.setAttribute('data-theme', t); r.style.colorScheme = t;
      [].forEach.call(document.querySelectorAll('button[aria-label],a[aria-label],[role="button"][aria-label]'), function (b) {
        if (!/theme/i.test(b.getAttribute('aria-label'))) return;
        var lab = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
        b.setAttribute('aria-label', lab); b.setAttribute('aria-pressed', String(t === 'dark'));
        if (b.hasAttribute('data-tip')) b.setAttribute('data-tip', lab);
        if (b.hasAttribute('title')) b.setAttribute('title', lab);
      });
    }
    window.vcfoSetTheme = function (m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} apply(); };
    window.vcfoToggleTheme = function () { window.vcfoSetTheme(resolved() === 'dark' ? 'light' : 'dark'); };
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (saved() === 'system') apply(); });
    window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
    apply();
    document.addEventListener('DOMContentLoaded', apply);
    window.addEventListener('load', function () { apply(); setTimeout(apply, 400); });
    /* every moon / sun button in the prototype is labelled "...theme..."; one handler for all of them */
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[aria-label],a[aria-label],[role="button"][aria-label]');
      if (!b || !/theme/i.test(b.getAttribute('aria-label'))) return;
      e.preventDefault(); e.stopPropagation(); window.vcfoToggleTheme();
    }, true);
    var ds = document.createElement('style'); ds.id = 'vp-dark';
    ds.textContent = [
      'html{color-scheme:light}',
      'html[data-theme="dark"]{color-scheme:dark;' +
        '--bg:#000;--panel:oklch(13% 0.006 260);--raised:oklch(17% 0.008 260);--border:oklch(24% 0.01 260);--hair:oklch(19% 0.008 260);' +
        '--fg:oklch(92% 0.005 260);--muted:oklch(72% 0.008 260);--subtle:oklch(60% 0.01 260);' +
        '--primary:oklch(68% 0.16 255);--primary-dark:oklch(76% 0.13 255);--primary-light:oklch(22% 0.06 258);--primary-chip:oklch(50% 0.17 258);' +
        '--navy:oklch(46% 0.15 258);--navy-ink:oklch(94% 0.008 255);--navy-2:oklch(52% 0.15 258);--navy-3:oklch(56% 0.15 255);' +
        '--navy-deep:oklch(19% 0.05 258);--navy-2-deep:oklch(23% 0.07 258);--navy-3-deep:oklch(29% 0.1 255);--primary-fill:oklch(52% 0.19 258);--primary-fill-2:oklch(58% 0.18 258);' +
        '--gold:#e0bd66;--gold-2:#ecd08a;--gold-soft:oklch(25% 0.05 85);--gold-text:#e8c97d;' +
        '--ok:oklch(68% 0.14 165);--ok-light:oklch(23% 0.05 165);--ok-text:oklch(80% 0.1 165);--ok-chip:oklch(50% 0.12 165);' +
        '--due:oklch(74% 0.15 62);--due-light:oklch(25% 0.06 60);--due-text:oklch(84% 0.11 68);--due-chip:oklch(54% 0.15 45);' +
        '--over:oklch(66% 0.19 22);--over-light:oklch(23% 0.07 22);--over-text:oklch(80% 0.12 22);--over-chip:oklch(52% 0.19 22);' +
        '--prog:oklch(66% 0.15 252);--prog-light:oklch(23% 0.06 252);--prog-text:oklch(80% 0.1 252);--prog-chip:oklch(50% 0.16 252);' +
        '--up:oklch(40% 0.015 255);--up-light:oklch(18% 0.008 255);--up-text:oklch(72% 0.01 255);--up-chip:oklch(40% 0.02 258);' +
        '--violet:oklch(68% 0.15 292);--violet-light:oklch(24% 0.06 292);--violet-chip:oklch(52% 0.16 292);--violet-text:oklch(80% 0.1 292);--violet-soft:oklch(28% 0.07 292);' +
        '--sky:oklch(68% 0.11 228);--sky-light:oklch(23% 0.05 228);--sky-chip:oklch(52% 0.11 230);' +
        '--teal:oklch(66% 0.1 195);--teal-light:oklch(23% 0.05 195);--teal-chip:oklch(58% 0.09 195);' +
        '--you:oklch(70% 0.15 55);--you-light:oklch(25% 0.06 55);--you-text:oklch(84% 0.1 60);' +
        '--with:oklch(66% 0.15 262);--with-light:oklch(23% 0.06 262);--with-text:oklch(80% 0.1 262);' +
        '--own-you:oklch(26% 0.05 85);--own-you-t:#e8c97d;--own-sbc:oklch(23% 0.05 262);--own-sbc-t:oklch(80% 0.1 262);' +
        '--folder:oklch(72% 0.1 255);--folder-open:oklch(78% 0.1 255);--sk:oklch(20% 0.008 260);--cv:oklch(20% 0.008 260);' +
        '--shadow:0 0 0 1px oklch(20% 0.008 260);--pop:0 18px 44px -12px rgba(0,0,0,.9)}',
      'html[data-theme="dark"],html[data-theme="dark"] body{background:#000}',
      /* the sidebar and the page-level sidebar placeholders are hard-coded navy; True black takes them to black */
      'html[data-theme="dark"] .vps,html[data-theme="dark"] .vh-side,html[data-theme="dark"] .tb-side{background:#000!important}',
      'html[data-theme="dark"] .vps:not(.vps-mbar){box-shadow:inset -1px 0 0 oklch(20% 0.008 260)}',
      'html[data-theme="dark"] .vps .vps-i[aria-current=page]{background:oklch(17% 0.02 260)}',
      'html[data-theme="dark"] .vps.vps-icons .vps-i .vps-b{box-shadow:0 0 0 2px #000}',
      /* switch knobs stay light so on/off reads at a glance */
      'html[data-theme="dark"] .tgl::after{background:oklch(92% 0.005 260)}',
      /* document previews: a light-only island, white paper with the original ink */
      'html[data-theme="dark"] [data-paper]{color-scheme:light;background:#fff!important;color:oklch(21% 0.042 264);' +
        '--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);--hair:oklch(94.8% 0.007 255);' +
        '--border:oklch(92.2% 0.011 255);--raised:oklch(96.6% 0.007 255);--panel:#fff;--navy:#0f2a4a;--navy-ink:#0f2a4a}',
      /* Credentials: per-authority colours, slate accent */
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=mca]{--a:oklch(62% 0.15 278);--a-bg:oklch(24% 0.06 278);--a-fg:oklch(84% 0.08 278)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=it]{--a:oklch(62% 0.1 200);--a-bg:oklch(23% 0.05 200);--a-fg:oklch(84% 0.07 200)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=gst]{--a:oklch(62% 0.12 155);--a-bg:oklch(23% 0.05 155);--a-fg:oklch(84% 0.08 155)}',
      'html[data-theme="dark"] :is(.cr-card,.cr-ctile)[data-auth=oth]{--a:oklch(70% 0.13 72);--a-bg:oklch(25% 0.06 72);--a-fg:oklch(86% 0.09 75)}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(ds);
  })();
```

```js
  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#vp-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:6px;padding:5px;border-radius:10px;background:#0f2a4a;box-shadow:0 12px 30px -10px rgba(8,20,40,.55);font:600 12px Manrope,system-ui,sans-serif;color:#fff}',
    '#vp-bar .vp-tag{padding:0 8px;color:#c9a24b;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:11px}',
    '#vp-bar .vp-seg{position:relative;display:flex;background:rgba(255,255,255,.1);border-radius:7px;padding:2px}',
    '#vp-bar .vp-seg button{position:relative;z-index:1;border:0;background:none;color:rgba(255,255,255,.75);font:600 12px Manrope,sans-serif;height:26px;padding:0 10px;border-radius:5px;cursor:pointer}',
    '#vp-bar .vp-seg button[aria-pressed=true]{background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-bar select{height:30px;border-radius:6px;border:0;background:rgba(255,255,255,.12);color:#fff;font:600 12px Manrope,sans-serif;padding:0 8px;max-width:210px}',
    '#vp-bar select option{color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-bar .vp-x{width:26px;height:26px;border:0;border-radius:6px;background:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:14px}',
    '#vp-mini{position:fixed;left:14px;bottom:14px;z-index:2147483000;border:0;border-radius:8px;background:#0f2a4a;color:#c9a24b;font:800 11px Manrope,sans-serif;letter-spacing:.08em;padding:8px 10px;cursor:pointer;box-shadow:0 8px 20px -8px rgba(8,20,40,.5)}',
    '#vp-toast{position:fixed;left:50%;bottom:64px;transform:translate(-50%,12px);opacity:0;z-index:2147483001;display:flex;align-items:center;gap:12px;max-width:min(560px,calc(100vw - 32px));padding:10px 12px 10px 14px;border-radius:8px;background:#0f2a4a;color:#fff;font:600 13px Manrope,sans-serif;box-shadow:0 18px 40px -14px rgba(8,20,40,.6);transition:opacity .18s,transform .22s cubic-bezier(.22,1,.36,1);pointer-events:none}',
    '#vp-toast.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}',
    '#vp-toast button{border:0;background:rgba(255,255,255,.14);color:#e6c46e;font:700 12px Manrope,sans-serif;height:28px;padding:0 10px;border-radius:6px;cursor:pointer}',
    '#vp-tip{position:fixed;z-index:2147483002;pointer-events:none;background:#0f2a4a;color:#fff;font:700 12px/1.3 Manrope,sans-serif;padding:5px 9px;border-radius:6px;white-space:nowrap;opacity:0;transform:translateY(3px);transition:opacity .12s,transform .12s}',
    '#vp-tip.on{opacity:1;transform:none}',
    'html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1) both}',
    'html.vp-leave body{opacity:.35;transition:opacity .14s}',
    '@keyframes vpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    'html.vp-mobile body{background:light-dark(#dfe5ee, oklch(25% 0.01 258.3))}',
    /* pop-ups always on top: drill-downs and dialogs escape their card's stacking context (rule 14 · item 14) */
    /* no visible scrollbars anywhere; scrolling still works (item 11) */
    'html,body,*{scrollbar-width:none!important}',
    '*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}',
    '.ov{position:fixed!important;inset:0!important;z-index:2147482000!important}',
    '.ddscrim{position:fixed!important;inset:0!important;z-index:2147482000!important}',
    '.dd{position:fixed!important;z-index:2147482001!important;top:max(72px,8vh)!important;max-height:calc(100vh - 110px);overflow:auto!important}',
    ':is(.card,.kpi,section,.stag>*,.sc-host,dc-import):has([style*="z-index:201"],[style*="z-index: 201"]){transform:none!important;z-index:2147481500!important;position:relative}',
    '#vp-drill-scrim{position:fixed;inset:0;z-index:2147482000;background:rgba(8,20,40,.5);display:flex;align-items:flex-start;justify-content:center;padding:max(72px,8vh) 16px 16px;opacity:0;transition:opacity .18s}',
    '#vp-drill-scrim.on{opacity:1}',
    'html.vp-mobile x-dc~div,html.vp-mobile body>div:first-of-type{margin:0 auto}',
    '@media (max-width:700px){#vp-bar{top:62px;bottom:auto;flex-wrap:wrap;justify-content:center;width:calc(100% - 20px)}#vp-bar select{max-width:none;flex:1}#vp-toast{bottom:100px}}',
    '@media (prefers-reduced-motion: reduce){html.vp-enter body{animation:none}#vp-toast,#vp-tip{transition:none}}'
  ].join('\n');
  document.head.appendChild(css);
  document.documentElement.classList.add('vp-enter');
  if (device() === 'mobile' && R[here()] && R[here()].m && curPath().indexOf(R[here()].m.split('#')[0]) >= 0) document.documentElement.classList.add('vp-mobile');

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg, undo, cb) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'vp-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = '';
    var s = document.createElement('span'); s.textContent = msg; toastEl.appendChild(s);
    if (undo) { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo'; b.onclick = function () { if (typeof cb === 'function') cb(); toast('Undone'); }; toastEl.appendChild(b); }
    toastEl.classList.add('on'); toastEl.setAttribute('data-n', String((+toastEl.getAttribute('data-n') || 0) + 1)); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 3200);
  }
  window.vcfoToast = toast;
```

### 4.4 Runtime tooltip (rule 17) + OBVIOUS list + tidyTips — `proto.js:295-311`, `660-674`, `740-745`

```js
  /* ---------- rule 17: icon-only controls explain themselves ---------- */
  var tip;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('a,button,[role="button"]');
    if (!el || el.closest('#vp-bar,.vps,[data-notip]')) return hideTip();
    var txt = (el.textContent || '').trim();
    var lab = el.getAttribute('aria-label');
    if (!lab || txt.length > 2 || el.hasAttribute('data-tip') || el.querySelector('.tt') || OBVIOUS.test(lab)) return hideTip();
    if (!tip) { tip = document.createElement('div'); tip.id = 'vp-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.textContent = lab; var r = el.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = (r.top - 32 < 4 ? r.bottom + 6 : r.top - 32) + 'px';
    clearTimeout(tip._t); tip._t = setTimeout(function () { tip.classList.add('on'); }, 120);
  });
  function hideTip() { if (tip) { clearTimeout(tip._t); tip.classList.remove('on'); } }
  document.addEventListener("pointerdown", hideTip, true);
  document.addEventListener('scroll', hideTip, true);
```

```js
  /* item 13: keep tooltips only where the meaning is not obvious (rule 17 spirit) */
  var OBVIOUS = /^(WhatsApp|Call|Email|Teams|Phone|Message)\b|^About\b|^More actions\b|^Notifications(,|$)|^(More information|Close|Ask VCFO|Open Ask VCFO|SBC home|Search( \(⌘K\))?|Details|Open|Open menu|Announcements|Photo placeholder|PDF file|Word document|Excel (sheet|file)|PowerPoint( deck| file)?|Text file|CSV file|Image \([A-Z]+\))$/i;
  function tidyTips() {
    [].forEach.call(document.querySelectorAll('[data-tip]'), function (e) {
      if (e.closest('.vps')) return;
      var t = e.getAttribute('data-tip') || '', txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (OBVIOUS.test(t) || (txt.length > 2 && txt.toLowerCase().indexOf(t.toLowerCase()) === 0)) { e.removeAttribute('data-tip'); e.classList.remove('tip'); e.setAttribute('data-notip', ''); }
    });
    [].forEach.call(document.querySelectorAll('[title]'), function (e) {
      if (e.closest('svg') || e.tagName === 'IFRAME' || e.tagName === 'LINK' || e.tagName === 'STYLE') return;
      var t = e.getAttribute('title'); if (!e.getAttribute('aria-label') && !(e.textContent || '').trim() && /^(A|BUTTON)$/.test(e.tagName)) e.setAttribute('aria-label', t);
      e.removeAttribute('title');
    });
    [].forEach.call(document.querySelectorAll('a[aria-label],button[aria-label],[role="button"][aria-label]'), function (e) { if (OBVIOUS.test(e.getAttribute('aria-label')) && !e.hasAttribute('data-notip')) e.setAttribute('data-notip', ''); });
  }
```

```js
  /* a tooltip at a point, for charts drawn as pictures (rule 14 hover) */
  window.vcfoTipAt = function (x, y, txt) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'vp-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    if (txt == null) { tip.classList.remove('on'); return; }
    tip.textContent = txt; tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x - tip.offsetWidth / 2)) + 'px'; tip.style.top = (y - 40 < 4 ? y + 18 : y - 40) + 'px'; tip.classList.add('on');
  };
```

CSS tooltip variants (verbatim):

```css
/* b/ecdc4c28c4511de8452c7a5f1e7f79e6.css:165-173 · rule 17 */
/* rule 17: every icon explains itself — navy tooltip (same look as rule 14), 120 ms */
@keyframes tipin{from{opacity:0;transform:translate(-50%,3px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes tipin2{from{opacity:0}to{opacity:1}}
[data-tip]{position:relative}
[data-tip]:hover::after,[data-tip]:focus-visible::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%);background:var(--navy);color:#fff;font:700 11.5px/1.25 Manrope,sans-serif;letter-spacing:0;text-transform:none;padding:5px 9px;border-radius:6px;white-space:nowrap;z-index:70;pointer-events:none;box-shadow:0 6px 16px -6px oklch(21% 0.042 264 / .5);animation:tipin .12s ease both}
[data-tip]:hover::before,[data-tip]:focus-visible::before{content:"";position:absolute;left:50%;bottom:calc(100% + 5px);width:8px;height:8px;margin-left:-4px;background:var(--navy);transform:rotate(45deg);z-index:70;pointer-events:none;animation:tipin2 .12s ease both}
[data-tip-below]:hover::after,[data-tip-below]:focus-visible::after{bottom:auto;top:calc(100% + 9px)}
[data-tip-below]:hover::before,[data-tip-below]:focus-visible::before{bottom:auto;top:calc(100% + 5px)}
@media (prefers-reduced-motion: reduce){[data-tip]::after,[data-tip]::before{animation:none!important}}
/* b/5f811734dca85ebd1a2cffd9332ad6b9.css (whole file) · rule 14 tooltip + .dpop */
/* Rule 14 · shared tooltip + drill-down pop-up */
.tt{position:relative}
.tb{position:absolute;left:50%;bottom:calc(100% + 9px);transform:translate(-50%,4px);z-index:45;background:var(--navy);color:#fff;font:700 11.5px/1.3 Manrope,sans-serif;letter-spacing:0;text-transform:none;text-decoration:none;padding:5px 9px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .14s,transform .14s;box-shadow:0 8px 20px -8px oklch(15% 0.05 258 / .55)}
.tb::after{content:"";position:absolute;left:50%;top:100%;width:8px;height:8px;margin:-4px 0 0 -4px;background:var(--navy);transform:rotate(45deg)}
.tb .tm{font-weight:600;opacity:.72;margin-left:4px}
.tt:hover>.tb,.tt:focus-visible>.tb,.tt.show>.tb{opacity:1;transform:translate(-50%,0)}
.tb.below{bottom:auto;top:calc(100% + 9px)}.tb.below::after{top:auto;bottom:100%;margin:0 0 -4px -4px}
.hot{cursor:pointer;border:0;background:none;padding:0;font:inherit;color:inherit;text-align:inherit}
.hot:hover{filter:brightness(1.06)}
.scrim{position:absolute;inset:0;z-index:60;background:oklch(20% 0.05 258 / .55);border:0;padding:0;cursor:default}
.dpop{width:640px;max-height:720px;display:flex;flex-direction:column;background:var(--panel);border-radius:12px;box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6);overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:var(--fg);animation:v7up .3s cubic-bezier(.22,1,.36,1) both}
.dpop .dh{position:relative;padding:14px 18px 12px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)),var(--navy-2-deep,var(--navy-2)) 70%,var(--navy-3-deep,var(--navy-3)));color:#fff}
.dpop .dh::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)}
.dpop .drow{display:flex;align-items:center;gap:12px;padding:10px 18px;border-top:1px solid var(--hair);color:var(--fg);text-decoration:none;font-weight:600;transition:background .15s}
.dpop .drow:hover{background:light-dark(oklch(96.8% 0.006 250 / .8), oklch(17.8% 0.006 250 / 0.8))}
.dpop .drow:first-child{border-top:0}
@media (prefers-reduced-motion: reduce){.tb,.dpop{transition:none;animation:none}}
```

### 4.5 Info (i) pop-over — CSS + markup

```css
/* b/ecdc4c28c4511de8452c7a5f1e7f79e6.css:108-116 */
.info{position:relative;display:inline-flex;vertical-align:middle;flex:none}
.info>button{width:18px;height:18px;padding:0;border:0;border-radius:4px;background:none;color:oklch(62% 0.02 255);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s}
.info>button:hover,.info:focus-within>button{color:var(--navy-ink,var(--navy))}
.info .pop{position:absolute;left:50%;top:calc(100% + 8px);z-index:40;width:max-content;min-width:200px;max-width:280px;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:0 12px 32px -12px oklch(21% 0.042 264 / .35);font:500 12px/1.45 Manrope,sans-serif;color:var(--fg);text-align:left;white-space:normal;letter-spacing:0;text-transform:none;opacity:0;visibility:hidden;transform:translate(-50%,-4px);transition:opacity .15s,transform .15s,visibility .15s}
.info .pop::before{content:"";position:absolute;left:50%;top:-6px;width:10px;height:10px;background:var(--panel);border-left:1px solid var(--border);border-top:1px solid var(--border);transform:translateX(-50%) rotate(45deg)}
.info:focus-within .pop,.info.open .pop{opacity:1;visibility:visible;transform:translate(-50%,0)}
.info .pop .ask{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--hair);color:var(--primary);font-weight:700}
.stag>*:focus-within,.card:focus-within,section:focus-within{position:relative;z-index:30}
@media (prefers-reduced-motion: reduce){.info .pop{transition:none}}
```

Markup (closed state; add class `open` for the open state). The `<dc-import name="v7c_bot" state="idle" size="16">` is the 16 px static bot head (§4.6 `headSVG`):

```html
<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Electricity or water · Max 2 months old · Asked by Arjun Mehta<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span>
```

Spec text from the board (`s/home/v7x_info_popover.dc.html`):

```text
- Trigger: 15 px (i) icon, 18 px hit area inside a 44 px touch target on mobile; muted grey, navy on hover / focus / open. 
- Pop-over: attached under the icon with a 10 px arrow; 200–280 px wide; 8 px corners; 1 px border; soft shadow. 
- Content: 1–3 short lines, then the meta (for example "Electricity or water · Max 2 months old · Asked by Arjun Mehta"). 
- Bottom row: 16 px bot avatar + "Ask VCFO about this". Opens the chat with the row's title as the question. 
- Opens on click or Enter / Space; closes on outside click, Esc, or Tab out. Only one open at a time. Build: Radix Popover, role="dialog" when it holds the link. 
- Reduced motion: no fade or slide.
```

Phone markup helper + placement fix (`s/home/mobile.html:216` and `:338-339`, inside the click handler):

```js
function info(t){return '<span class="info"><button type="button" aria-label="About this card" data-info>'+ic('info',15)+'</button><span class="pop" role="tooltip">'+t+'<button type="button" class="ask" data-ask>'+'<img src="vcfo-bin:s/home/assets/vcfo-bot-avatar.svg" alt="" width="16" height="16">Ask VCFO about this</button></span></span>';}
 if(el=t.closest('[data-info]')){var w=el.parentNode;$$('.info.open').forEach(function(x){if(x!==w)x.classList.remove('open')});w.classList.toggle('open');var pp=w.querySelector('.pop');if(pp){pp.style.marginLeft='';var pr=pp.getBoundingClientRect(),W=document.documentElement.clientWidth,dx=0;if(pr.right>W-8)dx=W-8-pr.right;if(pr.left+dx<8)dx=8-pr.left;if(dx)pp.style.marginLeft=Math.round(dx)+'px';}return;}
 if(!t.closest('.info'))$$('.info.open').forEach(function(x){x.classList.remove('open')});
```

### 4.6 Ask VCFO launcher + animated avatar + chat window — `proto.js:313-631`

The owner's animated avatar, verbatim (`docs/specs/client-pages/prototype/v7-inputs/visor-avatar-animated.svg`, also `public/client-portal/visor-avatar-animated.svg`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 216" width="340" height="216">
  <style>
    .head { animation: rise 20.5s infinite; }
    .eyes { animation: look 20.5s infinite ease-in-out; }
    .eye { transform-box: fill-box; transform-origin: center; animation: blink 20.5s infinite; }
    .hand { animation: grip 20.5s infinite ease-out; }
    .hand-r { animation-delay: .09s; }
    @keyframes rise {
      0%, 2.4% { transform: translateY(232px); animation-timing-function: cubic-bezier(.3,.75,.35,1); }
      14.1%, 25.4% { transform: translateY(72px); animation-timing-function: cubic-bezier(.3,.75,.35,1); }
      33.2%, 40% { transform: translateY(44px); animation-timing-function: cubic-bezier(.3,.75,.35,1); }
      48.3%, 66.3% { transform: translateY(0); animation-timing-function: ease-in-out; }
      74.6%, 80% { transform: translateY(72px); animation-timing-function: cubic-bezier(.5,0,.75,.4); }
      89.3%, 100% { transform: translateY(232px); }
    }
    @keyframes look {
      0%, 14.1% { transform: translate(0, 0); }
      15.5%, 19.5% { transform: translate(-12px, -2px); }
      21%, 24% { transform: translate(12px, -2px); }
      25.5%, 50% { transform: translate(0, 0); }
      51.5%, 55% { transform: translate(-12px, 3px); }
      56.5%, 60% { transform: translate(12px, -4px); }
      61.5%, 74.6% { transform: translate(0, 0); }
      76%, 79% { transform: translate(10px, -3px); }
      80.5%, 100% { transform: translate(0, 0); }
    }
    @keyframes blink {
      0%, 25.6%, 26.4%, 34.4%, 35.2%, 35.8%, 36.6%, 63%, 63.8%, 100% { transform: scaleY(1); }
      26%, 34.8%, 36.2%, 63.4% { transform: scaleY(.08); }
    }
    @keyframes grip {
      0% { opacity: 0; translate: 0 14px; }
      2.4%, 89.3% { opacity: 1; translate: 0 0; }
      91.5%, 100% { opacity: 0; translate: 0 16px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .head, .eyes, .eye { animation: none; }
      .head { transform: translateY(44px); }
      .hand { animation: none; opacity: 1; }
    }
  </style>
  <defs>
    <linearGradient id="vHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient>
    <linearGradient id="vHand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"/><stop offset="1" stop-color="#2563EB"/></linearGradient>
    <filter id="vGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <clipPath id="vEdge"><rect x="0" y="0" width="340" height="200"/></clipPath>
  <g clip-path="url(#vEdge)"><g transform="translate(50 0)"><g class="head">
    <line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"/>
    <circle cx="120" cy="18" r="8" fill="#2DD4BF"/>
    <rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"/>
    <rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"/>
    <rect x="30" y="44" width="180" height="210" rx="56" fill="url(#vHead)"/>
    <path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"/>
    <rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"/>
    <rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"/>
    <g class="eyes" filter="url(#vGlow)" fill="#7DD3FC">
      <rect class="eye" x="88" y="109" width="22" height="30" rx="11"/>
      <rect class="eye" x="130" y="109" width="22" height="30" rx="11"/>
      <path class="smile" d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"/>
    </g>
    <rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"/>
  </g></g></g>
  <g class="hand" transform="translate(4 178)">
    <rect x="2" y="4" width="46" height="22" rx="11" fill="url(#vHand)" stroke="#1D4ED8" stroke-opacity=".5"/>
    <g fill="#1D4ED8"><rect x="6" y="18" width="8.5" height="17" rx="4.25"/><rect x="16" y="18" width="8.5" height="17" rx="4.25"/><rect x="26" y="18" width="8.5" height="17" rx="4.25"/><rect x="36" y="18" width="8.5" height="17" rx="4.25"/></g>
    <path d="M12 10 h18" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>
  </g>
  <g class="hand hand-r" transform="translate(286 178)">
    <rect x="2" y="4" width="46" height="22" rx="11" fill="url(#vHand)" stroke="#1D4ED8" stroke-opacity=".5"/>
    <g fill="#1D4ED8"><rect x="6" y="18" width="8.5" height="17" rx="4.25"/><rect x="16" y="18" width="8.5" height="17" rx="4.25"/><rect x="26" y="18" width="8.5" height="17" rx="4.25"/><rect x="36" y="18" width="8.5" height="17" rx="4.25"/></g>
    <path d="M12 10 h18" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>
```

How `proto.js` embeds it: it does NOT load the file. It rebuilds the same drawing inline (so it can be animated with page CSS, recoloured by mood
and instanced several times with unique gradient/filter/clip ids):

- `vpvDefs(u, full)` = the file's `<defs>` (`vHead` → `${u}h`, `vHand` → `${u}k`, `vEdge` clip → `${u}c`, `vGlow` → `${u}g`).
- `vpvFace(u)` = the head group content (antenna stalk + `.vpv-ant` circle, ears, head rect with gradient, highlight, visor, glare,
  `.vpv-eyes` group (glow filter) with two `.vpv-eye` rects and the `.vpv-smile` path, chin).
- `vpvHand(u, cls, x)` = a hand at `translate(x 178)` (left x=4, right x=286 with extra class `vpv-hand-r`).
- `charSVG(cls)` = viewBox `0 0 340 216`: clip(0,0,340,200) › `translate(50 0)` › `.vpv-head` › `.vpv-mood` › face; then two hands.
  `cls='vpv-loop'` → the file's 20.5 s keyframes renamed `vpvRise/vpvLook/vpvBlink/vpvGrip`; `cls='vpv-peek'` → one peek per chat open.
- `headSVG(u)` = viewBox `0 0 240 302`, the face only (no clip, no hands) for the chat header (`vpvA`), the bot speech bubbles and
  `window.vcfoBotSVG` (`vpvS`).
- Class mapping file → page: `.head`→`.vpv-head`, `.eyes`→`.vpv-eyes`, `.eye`→`.vpv-eye`, `.hand`→`.vpv-hand`, `.hand-r`→`.vpv-hand-r`,
  `rise/look/blink/grip` → `vpvRise/vpvLook/vpvBlink/vpvGrip`. Reduced motion differs slightly: the file parks the head at
  `translateY(44px)`; the page shows it fully risen (`transform:none`).
- The character sits in `.vpl-char` (height = width·200/340, `overflow:hidden`), inside `.vpl-lift` (height = width·216/340) which is what
  ducks (`translate3d(0,100%,0)`).

Launcher + chat CSS (proto.js:313-410), verbatim:

```js

  /* ---------- Ask VCFO: one launcher + chat window, fixed bottom-right on every route ---------- */
  var CHAT_OWN = !!window.__vcfoOwnChat;
  var ccss = document.createElement('style');
  ccss.textContent = [
    /* sizes shared by the launcher and the chat; the bottom-right inset follows the page gutter (a page or the shell may set --vp-inset on :root) */
    ':root{--vpl-in:var(--vp-inset,clamp(14px,1.25vw + 8px,24px));--vpl-w:clamp(96px,4.5vw + 72px,148px);--vpk-w:clamp(96px,3vw + 72px,128px);--vpl-ph:36px;'+
      '--vp-launch-h:calc(var(--vpl-ph) + 2 * var(--vpl-in));--vp-launch-w:calc(var(--vpl-w) + 4px + 108px + var(--vpl-in));scroll-padding-bottom:var(--vp-launch-h)}',
    '@media (max-width:767px){:root{--vpl-ph:40px}}',
    /* bottom spacer: every screen can scroll its last row clear of the floating pills (Ask VCFO, PROTOTYPE). 1 px wide, so never a horizontal scroll */
    'html.vp-endpad body::after,.vp-endpad-box::after{content:"";display:block;flex:none;grid-column:1/-1;width:1px;height:var(--vp-launch-h);margin:0;padding:0;pointer-events:none}',
    'html.vp-endpad body::after{width:100%;background:var(--vp-endpad-bg,transparent)}',
    /* launcher = the owner character gripping the viewport bottom edge + an always-visible "Ask VCFO" pill in the corner */
    '#vp-launch{position:fixed;right:var(--vpl-in);bottom:0;z-index:2147482500;display:flex;align-items:flex-end;gap:4px;pointer-events:none}',
    '#vp-launch .vpl-char{position:relative;display:block;flex:none;width:var(--vpl-w);height:calc(var(--vpl-w) * 200 / 340);overflow:hidden;pointer-events:none}',
    '#vp-launch .vpl-lift{display:block;width:100%;height:calc(var(--vpl-w) * 216 / 340);transform:translate3d(0,0,0);transition:transform .5s cubic-bezier(.34,1.45,.5,1)}',
    '#vp-launch .vpl-lift>svg{display:block;width:100%;height:100%}',
    '#vp-launch .vpv-head{pointer-events:visiblePainted;cursor:pointer}',
    /* yield: the character ducks under the edge while scrolling, while the chat is open, or when it would cover a control */
    '#vp-launch.yield .vpl-lift,#vp-launch.open .vpl-lift,body.sheet-open #vp-launch .vpl-lift{transform:translate3d(0,100%,0);transition:transform .32s cubic-bezier(.5,0,.75,.4)}',
    '#vp-launch.yield .vpv-head,#vp-launch.open .vpv-head{pointer-events:none}',
    '#vp-launch .vpl-pill{pointer-events:auto;flex:none;position:relative;display:inline-flex;align-items:center;gap:7px;height:var(--vpl-ph);margin:0 0 var(--vpl-in);padding:0 14px 0 12px;border:0;border-radius:8px;background:#0f2a4a;color:#fff;font:700 13px/1 Manrope,system-ui,sans-serif;letter-spacing:0;white-space:nowrap;cursor:pointer;box-shadow:0 10px 24px -10px rgba(8,20,40,.6),inset 0 0 0 1px rgba(255,255,255,.08);-webkit-tap-highlight-color:transparent;transition:background-color .15s,transform .15s,opacity .2s,visibility .2s}',
    '#vp-launch .vpl-pill:hover{background:#17396b}#vp-launch .vpl-pill:active{transform:scale(.97)}',
    '#vp-launch .vpl-pill:focus-visible{outline:3px solid light-dark(#7DD3FC, oklch(32% 0.1 230.3));outline-offset:2px}',
    '#vp-launch .vpl-dot{flex:none;width:8px;height:8px;border-radius:50%;background:#2DD4BF;box-shadow:0 0 0 3px rgba(45,212,191,.22)}',
    '#vp-launch .vpl-c{display:none;align-items:center;gap:6px}#vp-launch .vpl-c svg{width:14px;height:14px}',
    '#vp-launch.open .vpl-t,#vp-launch.open .vpl-dot{display:none}#vp-launch.open .vpl-c{display:inline-flex}',
    'body.sheet-open #vp-launch .vpl-pill{opacity:0;visibility:hidden}',
    /* the character (inputs/visor-avatar-animated.svg): the file keyframes and 20.5 s loop, unchanged, scoped to .vpv-loop */
    '.vpv .vpv-eye{transform-box:fill-box;transform-origin:center}',
    '.vpv-loop .vpv-head{animation:vpvRise 20.5s infinite}',
    '.vpv-loop .vpv-eyes{animation:vpvLook 20.5s infinite ease-in-out}',
    '.vpv-loop .vpv-eye{animation:vpvBlink 20.5s infinite}',
    '.vpv-loop .vpv-hand{animation:vpvGrip 20.5s infinite ease-out}',
    '.vpv-loop .vpv-hand-r{animation-delay:.09s}',
    '.vpv-loop .vpv-hand{animation-fill-mode:backwards}',
    '@keyframes vpvRise{0%,2.4%{transform:translateY(232px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}14.1%,25.4%{transform:translateY(72px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}33.2%,40%{transform:translateY(44px);animation-timing-function:cubic-bezier(.3,.75,.35,1)}48.3%,66.3%{transform:translateY(0);animation-timing-function:ease-in-out}74.6%,80%{transform:translateY(72px);animation-timing-function:cubic-bezier(.5,0,.75,.4)}89.3%,100%{transform:translateY(232px)}}',
    '@keyframes vpvLook{0%,14.1%{transform:translate(0,0)}15.5%,19.5%{transform:translate(-12px,-2px)}21%,24%{transform:translate(12px,-2px)}25.5%,50%{transform:translate(0,0)}51.5%,55%{transform:translate(-12px,3px)}56.5%,60%{transform:translate(12px,-4px)}61.5%,74.6%{transform:translate(0,0)}76%,79%{transform:translate(10px,-3px)}80.5%,100%{transform:translate(0,0)}}',
    '@keyframes vpvBlink{0%,25.6%,26.4%,34.4%,35.2%,35.8%,36.6%,63%,63.8%,100%{transform:scaleY(1)}26%,34.8%,36.2%,63.4%{transform:scaleY(.08)}}',
    '@keyframes vpvGrip{0%{opacity:0;translate:0 14px}2.4%,89.3%{opacity:1;translate:0 0}91.5%,100%{opacity:0;translate:0 16px}}',
    /* chat window: floating card above the pill (tablet/desktop), full-width bottom sheet on phones */
    '#vp-chat{position:fixed;right:var(--vpl-in);bottom:calc(var(--vpl-lift,0px) + var(--vpl-in) + var(--vpl-ph) + 14px);z-index:2147482501;box-sizing:border-box;width:clamp(340px,24vw + 40px,440px);max-width:calc(100vw - 2 * var(--vpl-in));height:min(clamp(480px,62vh,680px),calc(100dvh - var(--vpl-lift,0px) - var(--vpl-in) - var(--vpl-ph) - 26px - var(--vpk-w) * .6));min-height:min(320px,calc(100dvh - 24px));max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:12px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));box-shadow:0 24px 60px -20px rgba(8,20,40,.5);font:500 13px/1.5 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));transform-origin:100% 100%;transform:translateY(12px) scale(.96);opacity:0;visibility:hidden;transition:transform .26s cubic-bezier(.22,1,.36,1),opacity .18s,visibility .18s}',
    '#vp-chat.on{transform:none;opacity:1;visibility:visible}',
    '#vp-chat .vpc-h{position:relative;display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff;border-radius:11px 11px 0 0}',
    '#vp-chat .vpc-av{flex:0 0 auto;width:36px;height:36px;border-radius:50%;background:light-dark(#fff, oklch(13% 0 89.9));display:grid;place-items:center;overflow:hidden}#vp-chat .vpc-av svg{width:31px;height:39px;margin-top:9px}',
    '#vp-chat .vpc-h b{display:block;font:800 14px Manrope,system-ui,sans-serif}#vp-chat .vpc-h small{font-size:11.5px;color:#c7d2e2}',
    '#vp-chat .vpc-h button{margin-left:auto;flex:none;width:36px;height:36px;border-radius:6px;border:0;background:rgba(255,255,255,.12);color:#fff;font:400 22px/1 Manrope,system-ui,sans-serif;cursor:pointer}',
    '#vp-chat .vpc-ms{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px 0}',
    '#vp-chat .vpc-m{margin:6px 14px;max-width:84%;padding:9px 12px;border-radius:10px;overflow-wrap:anywhere}',
    '#vp-chat .vpc-m.vpc-u{margin-left:auto;background:#0f2a4a;color:#fff;border-radius:10px 10px 2px 10px}',
    '#vp-chat .vpc-m.vpc-a{background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));border-radius:10px 10px 10px 2px}',
    '#vp-chat .vpc-m.vpc-a button{margin-top:8px;min-height:32px;padding:0 10px;border-radius:6px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));background:light-dark(#fff, oklch(13% 0 89.9));font:700 12px Manrope,system-ui,sans-serif;cursor:pointer;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-chat .vpc-ty i{display:inline-block;width:6px;height:6px;margin-right:3px;border-radius:50%;background:#7a889c;animation:vpTh 1s infinite}#vp-chat .vpc-ty i:nth-child(2){animation-delay:.2s}#vp-chat .vpc-ty i:nth-child(3){animation-delay:.4s}',
    '#vp-chat .vpc-sg{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;max-height:40%;overflow:auto}',
    '#vp-chat .vpc-sg button{min-height:32px;max-width:100%;padding:4px 10px;border-radius:6px;border:1px solid rgba(46,92,255,.35);background:light-dark(#eef2ff, oklch(18.7% 0.01 272.3));color:light-dark(#2a4fd6, oklch(80.3% 0.14 266.4));font:600 12px/1.3 Manrope,system-ui,sans-serif;text-align:left;cursor:pointer}',
    '#vp-chat form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid light-dark(#eef1f5, oklch(23.7% 0.006 255.5))}',
    '#vp-chat input{flex:1;min-width:0;height:40px;box-sizing:border-box;border-radius:8px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));padding:0 12px;font:500 14px Manrope,system-ui,sans-serif}',
    '#vp-chat form button{flex:none;height:40px;padding:0 14px;border-radius:6px;border:0;background:#0f2a4a;color:#fff;font:700 13px Manrope,system-ui,sans-serif;cursor:pointer}',
    '@keyframes vpTh{0%,100%{opacity:.3}50%{opacity:1}}',
    /* What\u2019s this? answer card (owner board vs_ask): title, explanation, why it matters, source, a way to the step */
    '#vp-chat .vpc-card{margin:6px 14px;padding:12px 14px 14px;border:1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3));border-radius:10px;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 1px 2px rgba(15,27,45,.04),0 8px 20px -14px rgba(15,27,45,.25);overflow-wrap:anywhere}',
    '#vp-chat .vpc-card b.vpc-ct{display:block;font:800 14px/1.35 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));margin:0 0 6px}',
    '#vp-chat .vpc-card p{margin:0;font-size:13.5px;line-height:1.55;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3))}',
    '#vp-chat .vpc-card .vpc-why{margin-top:10px;font-size:12.5px;line-height:1.5;color:light-dark(#4a5a70, oklch(81.5% 0.029 256.4))}#vp-chat .vpc-card .vpc-why b{display:block;font:800 12px Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));margin-bottom:2px}',
    '#vp-chat .vpc-card .vpc-src{margin-top:8px;font-size:11.5px;line-height:1.45;color:#6b7a90}',
    '#vp-chat .vpc-card button{display:inline-flex;align-items:center;gap:6px;margin-top:12px;min-height:34px;max-width:100%;padding:0 12px;border-radius:6px;border:1px solid #2e5cff;background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#2a4fd6, oklch(80.3% 0.14 266.4));font:700 12.5px Manrope,system-ui,sans-serif;text-align:left;cursor:pointer}',
    '#vp-chat .vpc-card button:hover{background:light-dark(#eef2ff, oklch(18.7% 0.01 272.3))}#vp-chat .vpc-card button svg{flex:none;width:14px;height:14px}',
    /* the same character peeks over the top edge of the window once per open: hands grip the edge, head rises, a look around, then a slow blink.
       Moods only through colour and motion: antenna teal = idle, pulsing = thinking, green + hop = answered, grey + dip = cannot answer. The smile never changes. */
    '#vp-chat .vpc-pk{position:absolute;right:clamp(16px,6%,30px);bottom:100%;width:var(--vpk-w);height:calc(var(--vpk-w) * 216 / 340);margin-bottom:calc(var(--vpk-w) * -16 / 340);pointer-events:none;z-index:2}',
    '#vp-chat .vpc-pk>svg{display:block;width:100%;height:100%;overflow:visible}',
    '#vp-chat .vpv-peek .vpv-head{transform:translateY(232px)}',
    '#vp-chat .vpv-peek .vpv-hand{opacity:0}',
    '#vp-chat.on .vpv-peek .vpv-head{animation:vpvPeek .95s cubic-bezier(.3,.75,.35,1) .22s both}',
    '#vp-chat.on .vpv-peek .vpv-hand{animation:vpvGripIn .32s ease-out .08s both}#vp-chat.on .vpv-peek .vpv-hand-r{animation-delay:.17s}',
    '#vp-chat.on .vpv-peek .vpv-eyes{animation:vpvPeekLook 2.2s ease-in-out 1.25s both}',
    '#vp-chat.on .vpv-peek .vpv-eye{animation:vpvPeekBlink 6.5s 3.5s infinite}',
    '@keyframes vpvPeek{from{transform:translateY(232px)}to{transform:translateY(0)}}',
    '@keyframes vpvGripIn{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}',
    '@keyframes vpvPeekLook{0%,100%{transform:translate(0,0)}14%,38%{transform:translate(-12px,-2px)}52%,78%{transform:translate(12px,-2px)}}',
    '@keyframes vpvPeekBlink{0%,3%,6%,100%{transform:scaleY(1)}4.5%{transform:scaleY(.08)}}',
    '#vp-chat .vpv-ant{transition:fill .3s}',
    '#vp-chat.vpc-ok .vpv-ant{fill:#22C55E}#vp-chat.vpc-nan .vpv-ant{fill:#94A3B8}',
    '#vp-chat.vpc-think .vpv-ant{animation:vpvAnt 1s ease-in-out infinite}',
    '#vp-chat.vpc-ok .vpv-peek .vpv-mood{animation:vpvHop .7s cubic-bezier(.3,1.5,.5,1)}',
    '#vp-chat.vpc-nan .vpv-peek .vpv-mood{animation:vpvDip 1.2s ease-in-out}',
    '@keyframes vpvAnt{50%{opacity:.3}}',
    '@keyframes vpvHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}}',
    '@keyframes vpvDip{0%,100%{transform:translateY(0)}35%,70%{transform:translateY(14px)}}',
    '.vp-hide-bot{display:none!important}',
    /* phones: the sheet owns the bottom of the screen, so the prototype control steps aside while it is open */
    '@media (max-width:767px){html.vp-chat-on #vp-mini,html.vp-chat-on #vp-bar{visibility:hidden}}',
    '@media (max-width:767px){#vp-chat{left:0;right:0;bottom:0;width:auto;max-width:none;height:min(640px,calc(100dvh - 20px - var(--vpk-w) * .6));min-height:0;max-height:calc(100dvh - 12px);border-radius:16px 16px 0 0;border-width:1px 0 0;padding-bottom:env(safe-area-inset-bottom);transform-origin:50% 100%;transform:translateY(24px)}' +
      '#vp-chat .vpc-h{border-radius:15px 15px 0 0}#vp-chat .vpc-h button,#vp-chat .vpc-sg button,#vp-chat .vpc-m.vpc-a button,#vp-chat .vpc-card button{min-height:40px;min-width:40px}#vp-chat .vpc-h button{width:40px;height:40px}#vp-chat input{height:44px;font-size:16px}#vp-chat form button{height:44px}}',
    /* reduced motion: a static, fully visible head, no loop, no peek motion (colour still shows the mood) */
    '@media (prefers-reduced-motion: reduce){#vp-launch *,#vp-chat .vpc-ty i,#vp-chat .vpc-pk *{animation:none!important;transition:none!important}#vp-launch .vpv-head,#vp-chat .vpv-peek .vpv-head{transform:none}#vp-launch .vpv-hand,#vp-chat .vpv-peek .vpv-hand{opacity:1}#vp-chat{transition:none}}'
  ].join('\n');
  document.head.appendChild(ccss);
```

Canned answers, log, What's this? card, moods, SVG builders, control-cover test, bottom spacer, yield (proto.js:411-564):

```js
  var AFTER = store.get('after', false);
  var QA = AFTER ? {
    'What is due next?': 'TDS Payment · Oct 2026 is overdue by 1 day. Next are EPF and ESI on 15 Nov.',
    'Which registrations are pending?': 'Two are with SBC: PT Registration (est. 12 Nov) and IEC (est. 14 Nov).',
    'When is FC-GPR due?': '2 Dec 2026, day 6 of the 30-day window. Upload the bank FIRC + KYC letter first.'
  } : {
    'What is my next step?': 'Step 7 · Registered Office Address is waiting for Northwind. Upload the utility bill and the owner NOC by 9 Oct, then approve. Steps 8 Proposed Directors and 9 Subscriber Details are also in progress with Northwind.',
    'Where is my incorporation now?': 'Northwind is in Phase 2 · Incorporation: 1 of 9 steps done, 6 of 14 SPICe+ steps overall (43%). Step 7 is waiting for Northwind, steps 8 and 9 are in progress with Northwind, and step 10 KYC Review & DSC is with SBC. The COI is expected on 28 Oct.',
    'Which documents are missing?': 'Two, both for step 7 · Registered Office Address: the office utility bill and the NOC from the owner. Both are due 9 Oct.'
  };
  function chatLog() { try { return JSON.parse(sessionStorage.getItem('vcfo.chat') || '[]'); } catch (e) { return []; } }
  function saveLog(l) { try { sessionStorage.setItem('vcfo.chat', JSON.stringify(l)); } catch (e) {} }
  var launch, win, lastFocus;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function renderLog() {
    var box = win.querySelector('.vpc-ms'); var l = chatLog();
    box.innerHTML = '<div class="vpc-m vpc-a">Hello. Ask me anything about Northwind’s setup, or pick a question below.</div>' + l.map(function (m) {
      if (m.w) return wtCard(m.w);
      return '<div class="vpc-m ' + (m.r === 'u' ? 'vpc-u' : 'vpc-a') + '">' + esc(m.t) + (m.h ? '<br><button type="button" data-handoff>Hand off to Arjun Mehta</button>' : '') + '</div>';
    }).join('');
    box.scrollTop = 1e6;
    var lastK = l.filter(function (m) { return m.k; }).pop();
    setMood(lastK && lastK.k);
  }
  /* What's this? answers come from the screen (window.vcfoWhatsThis on the Incorporation pages) and render as the answer card */
  function whatsThis(q) { try { var w = typeof window.vcfoWhatsThis === 'function' && window.vcfoWhatsThis(q); return w && (w.title || w.text) ? { title: String(w.title || ''), text: String(w.text || ''), why: String(w.why || ''), source: String(w.source || ''), go: w.go ? String(w.go) : '' } : null; } catch (e) { return null; } }
  function wtCard(w) {
    var lbl = /^inc-step-\d+$/.test(w.go) ? 'Open this step' : 'Open ' + ((R[w.go] && R[w.go].t) || 'this page');
    return '<div class="vpc-card" role="group" aria-label="' + esc(w.title || 'Answer') + '">' + (w.title ? '<b class="vpc-ct">' + esc(w.title) + '</b>' : '') + (w.text ? '<p>' + esc(w.text) + '</p>' : '') +
      (w.why ? '<div class="vpc-why"><b>Why it matters to Northwind</b>' + esc(w.why) + '</div>' : '') + (w.source ? '<div class="vpc-src">Source: ' + esc(w.source) + '</div>' : '') +
      (w.go ? '<button type="button" data-wgo="' + esc(w.go) + '">' + esc(lbl) + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' : '') + '</div>';
  }
  /* mood = antenna colour + a small motion of the peeking character (never the mouth): ok = green + hop, nan = grey + dip */
  function setMood(k, replay) {
    win.classList.remove('vpc-think');
    if (replay) { win.classList.remove('vpc-ok', 'vpc-nan'); void win.offsetWidth; }
    win.classList.toggle('vpc-ok', k === 'ok'); win.classList.toggle('vpc-nan', k === 'nan');
  }
  /* the owner character (inputs/visor-avatar-animated.svg, smile included). Each instance gets its own gradient/filter/clip ids. */
  var VPV = 0;
  function vpvDefs(u, full) {
    return '<defs><linearGradient id="' + u + 'h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient>' +
      (full ? '<linearGradient id="' + u + 'k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"/><stop offset="1" stop-color="#2563EB"/></linearGradient><clipPath id="' + u + 'c"><rect x="0" y="0" width="340" height="200"/></clipPath>' : '') +
      '<filter id="' + u + 'g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  }
  function vpvFace(u) {
    return '<line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"/><circle class="vpv-ant" cx="120" cy="18" r="8" fill="#2DD4BF"/>' +
      '<rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"/><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"/>' +
      '<rect x="30" y="44" width="180" height="210" rx="56" fill="url(#' + u + 'h)"/><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"/><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"/>' +
      '<g class="vpv-eyes" filter="url(#' + u + 'g)" fill="#7DD3FC"><rect class="vpv-eye" x="88" y="109" width="22" height="30" rx="11"/><rect class="vpv-eye" x="130" y="109" width="22" height="30" rx="11"/>' +
      '<path class="vpv-smile" d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"/></g>' +
      '<rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"/>';
  }
  function vpvHand(u, cls, x) {
    return '<g class="' + cls + '" transform="translate(' + x + ' 178)"><rect x="2" y="4" width="46" height="22" rx="11" fill="url(#' + u + 'k)" stroke="#1D4ED8" stroke-opacity=".5"/>' +
      '<g fill="#1D4ED8"><rect x="6" y="18" width="8.5" height="17" rx="4.25"/><rect x="16" y="18" width="8.5" height="17" rx="4.25"/><rect x="26" y="18" width="8.5" height="17" rx="4.25"/><rect x="36" y="18" width="8.5" height="17" rx="4.25"/></g>' +
      '<path d="M12 10 h18" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/></g>';
  }
  /* full character: head clipped at the edge (y = 200), hands gripping it; cls picks the motion (vpv-loop = the file's 20.5 s loop, vpv-peek = one peek) */
  function charSVG(cls) {
    var u = 'vpv' + (++VPV);
    return '<svg class="vpv ' + cls + '" viewBox="0 0 340 216" aria-hidden="true" focusable="false">' + vpvDefs(u, true) +
      '<g clip-path="url(#' + u + 'c)"><g transform="translate(50 0)"><g class="vpv-head"><g class="vpv-mood">' + vpvFace(u) + '</g></g></g></g>' +
      vpvHand(u, 'vpv-hand', 4) + vpvHand(u, 'vpv-hand vpv-hand-r', 286) + '</svg>';
  }
  /* static head (no loop): chat header avatar and window.vcfoBotSVG (empty-state bots on the Incorporation pages). Same 240x302 box as v6. */
  function headSVG(u) { return '<svg class="vpv vpv-s" viewBox="0 0 240 302" aria-hidden="true" focusable="false">' + vpvDefs(u, false) + vpvFace(u) + '</svg>'; }
  var BOT = headSVG('vpvS');
  window.vcfoBotSVG = BOT;
  /* the character never covers a control: it ducks while a button/link/field sits under it, while scrolling, or while the chat is open */
  var ACT = 'a[href],button,[role=button],[role=link],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=menuitem],[role=option],input,select,textarea,summary,label,[data-go],[onclick],[contenteditable=""],[contenteditable=true]';
  function coversControl() {
    var c = launch && launch.querySelector('.vpl-char'); if (!c) return false;
    var r = c.getBoundingClientRect(); if (!r.width || !r.height) return false;
    var seen = [];
    for (var i = 0; i < 6; i++) for (var j = 0; j < 4; j++) {
      var x = r.left + r.width * (0.08 + 0.168 * i), y = r.top + r.height * (0.08 + 0.28 * j);
      var st = document.elementsFromPoint(x, y);
      for (var k = 0; k < st.length; k++) {
        var e = st[k]; if (launch.contains(e)) continue;
        var a = e.closest && e.closest(ACT); if (!a || seen.indexOf(a) >= 0) break; seen.push(a);
        var b = a.getBoundingClientRect(), ow = Math.min(b.right, r.right) - Math.max(b.left, r.left), oh = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
        if (ow > 0 && oh > 0 && (ow * oh) / Math.max(1, b.width * b.height) > 0.2) return true;
        break;
      }
    }
    return false;
  }
  /* bottom spacer, switched on only where it helps: the page already scrolls, a control sits under a floating pill,
     or an inner scroll panel ends under one. Controls inside fixed/sticky layers are left alone (a spacer cannot move them). */
  /* paint the spacer like the background right above it: from the lowest piece of content, the first edge-to-edge
     ancestor with a colour (cards have side margins, so they are skipped). Re-read for the first seconds while the screen renders. */
  var bgTicks = 0;
  function endPadBg() {
    var de = document.documentElement, b = document.body;
    var bg = '', low = null, cand = [];
    [].forEach.call(b.querySelectorAll('*'), function (k) {
      if (/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(k.tagName)) return;
      var rk = k.getBoundingClientRect(); if (rk.height && rk.width) cand.push([Math.round(rk.bottom), k, cand.length]);
    });
    cand.sort(function (x, y) { return y[0] - x[0] || y[2] - x[2]; });   /* ties: the deepest (latest) element first */
    for (var ci = 0; ci < cand.length && ci < 400 && !low; ci++) {   /* lowest in-flow, visible element (not in a fixed/absolute layer such as a sheet) */
      var k = cand[ci][1], ok = getComputedStyle(k).visibility !== 'hidden';
      for (var a = k; ok && a && a !== b; a = a.parentElement) { var pa = getComputedStyle(a).position; if (pa === 'fixed' || pa === 'absolute' || /^vp-/.test(a.id)) ok = false; }
      if (ok) low = k;
    }
    for (var n2 = low; n2 && n2 !== de; n2 = n2.parentElement) {
      var rb = n2.getBoundingClientRect(), c = getComputedStyle(n2).backgroundColor;
      if (rb.right >= innerWidth - 2 && rb.width >= innerWidth * 0.6 && c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
    }
    if (bg && de.style.getPropertyValue('--vp-endpad-bg') !== bg) de.style.setProperty('--vp-endpad-bg', bg);
  }
  var padLock = false;
  function endPad(reset) {
    var de = document.documentElement, b = document.body; if (!b || !launch) return;
    if (reset) { padLock = false; bgTicks = 0; de.classList.remove('vp-endpad'); }
    /* a screen that lifts the launcher above its own bottom bar (sticky action bar) owns its bottom: no root spacer there,
       it would unstick that bar early and slide it under the lifted pill */
    if (innerHeight - launch.getBoundingClientRect().bottom > 1) { padLock = false; if (de.classList.contains('vp-endpad')) de.classList.remove('vp-endpad'); return; }
    var zones = [];
    [launch.querySelector('.vpl-pill'), document.getElementById('vp-mini'), document.getElementById('vp-bar')].forEach(function (e) {
      if (!e) return; var cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return; var r = e.getBoundingClientRect(); if (r.width && r.height) zones.push(r);
    });
    var under = false, boxes = [];
    zones.forEach(function (r) {
      for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) {
        var st = document.elementsFromPoint(r.left + r.width * (0.15 + 0.35 * i), r.top + r.height * (0.25 + 0.5 * j)), e = null;
        for (var k = 0; k < st.length; k++) if (!st[k].closest('#vp-launch,#vp-chat,#vp-mini,#vp-bar,#vp-toast,#vp-tip')) { e = st[k]; break; }
        if (!e || e === b || e === de) continue;
        var fixed = false, sc = null;
        for (var n = e; n && n !== b && n !== de; n = n.parentElement) {
          var cs = getComputedStyle(n);
          if (cs.position === 'fixed' || cs.position === 'sticky') { fixed = true; break; }
          if (!sc && /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.clientHeight > innerHeight * 0.3) sc = n;
        }
        if (fixed) continue;
        if (sc) { if (boxes.indexOf(sc) < 0) boxes.push(sc); } else if (e.closest(ACT)) under = true;
      }
    });
    boxes.forEach(function (n) { if (!n.classList.contains('vp-endpad-box') && getComputedStyle(n, '::after').content === 'none') n.classList.add('vp-endpad-box'); });
    if (de.classList.contains('vp-endpad')) { if (bgTicks++ < 8) endPadBg(); return; }
    if (getComputedStyle(b, '::after').content !== 'none') return;   // the screen uses body::after itself
    if (padLock || under || de.scrollHeight > innerHeight + 1) {
      endPadBg(); padLock = true; de.classList.add('vp-endpad');
    }
  }
  var scrolling = false;
  function updYield() {
    if (!launch) return;
    var y = scrolling || launch.classList.contains('open') || document.body.classList.contains('sheet-open') || coversControl();
    if (launch.classList.contains('yield') !== y) launch.classList.toggle('yield', y);
    if (win) { var lift = Math.max(0, Math.round(innerHeight - launch.getBoundingClientRect().bottom)) + 'px'; if (win.__lift !== lift) { win.__lift = lift; win.style.setProperty('--vpl-lift', lift); } }
  }
```

Building the launcher and chat, open/close/ask, hide board bots (proto.js:565-631):

```js
  function buildChat() {
    if (document.getElementById('vp-launch')) return;
    launch = document.createElement('div'); launch.id = 'vp-launch';
    launch.innerHTML = '<span class="vpl-char" aria-hidden="true"><span class="vpl-lift">' + charSVG('vpv-loop') + '</span></span>' +
      '<button type="button" class="vpl-pill" aria-label="Open Ask VCFO chat" aria-expanded="false"' + (CHAT_OWN ? '' : ' aria-controls="vp-chat"') + ' data-notip>' +
      '<i class="vpl-dot" aria-hidden="true"></i><span class="vpl-t">Ask VCFO</span><span class="vpl-c" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Close</span></button>';
    var pill = launch.querySelector('.vpl-pill'), chr = launch.querySelector('.vpl-char');
    var scrollT, lastTop = new WeakMap(); addEventListener('scroll', function (e) { if (launch.classList.contains('open')) return; var tg = e.target && e.target.nodeType === 1 ? e.target : document.documentElement, top = tg === document.documentElement ? scrollY : tg.scrollTop; if (lastTop.get(tg) === top) return; lastTop.set(tg, top); scrolling = true; updYield(); clearTimeout(scrollT); scrollT = setTimeout(function () { scrolling = false; updYield(); var de = document.documentElement; if (de.classList.contains('vp-endpad') && innerHeight + scrollY >= de.scrollHeight - 240) endPadBg(); }, 650); }, { passive: true, capture: true });
    var rzT; addEventListener('resize', function () { updYield(); clearTimeout(rzT); rzT = setTimeout(function () { endPad(true); }, 250); }); setTimeout(updYield, 60); setTimeout(endPad, 400);
    setInterval(function () { if (!document.hidden) { updYield(); endPad(); } }, 1000);
    if (CHAT_OWN) { document.body.appendChild(launch); var own = function (e) { e.preventDefault(); e.stopPropagation(); var b = document.getElementById('botBtn'); b && b.click(); }; pill.addEventListener('click', own); chr.addEventListener('click', own); return; }
    win = document.createElement('section'); win.id = 'vp-chat'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', 'Ask VCFO chat');
    win.innerHTML = '<span class="vpc-pk" aria-hidden="true">' + charSVG('vpv-peek') + '</span><div class="vpc-h"><span class="vpc-av">' + headSVG('vpvA') + '</span><span><b>Ask VCFO</b><small>Answers from Northwind’s project data</small></span><button type="button" aria-label="Close chat" data-close>×</button></div><div class="vpc-ms" aria-live="polite"></div><div class="vpc-sg">' +
      Object.keys(QA).map(function (q) { return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div><form><input aria-label="Type a question" placeholder="Type a question"><button type="submit">Send</button></form>';
    document.body.appendChild(win); document.body.appendChild(launch);
    var toggle = function (e) { e.preventDefault(); e.stopPropagation(); win.classList.contains('on') ? closeChat() : openChat(); };
    pill.addEventListener('click', toggle); chr.addEventListener('click', toggle);
    win.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('[data-close]')) return closeChat();
      var q = e.target.closest('[data-q]'); if (q) return ask(q.getAttribute('data-q'));
      var wg = e.target.closest('[data-wgo]'); if (wg) { var g = wg.getAttribute('data-wgo'); if (/[\/.]/.test(g)) vcfoNav(g); else go(g); return; }
      if (e.target.closest('[data-handoff]')) { var l = chatLog(); l.push({ r: 'a', t: 'Sent to Arjun Mehta. You will get a reply by email within 1 working day.' }); saveLog(l); renderLog(); toast('Handed off to Arjun Mehta', true); }
    });
    win.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var i = win.querySelector('input'); var v = i.value.trim(); if (v) { ask(v); i.value = ''; } else { i.focus(); toast('Type a question first, or pick one above'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && win.classList.contains('on')) closeChat(); });
    renderLog();
    if (/(^|[#&])chat\b/.test(location.hash) || store.get('openChat', false)) { store.set('openChat', false); setTimeout(openChat, 500); }
  }
  function openChat(q) {
    if (CHAT_OWN) { var b = document.querySelector('[aria-label="Chat with Ask VCFO"]'); b && b.click(); return; }
    if (!launch || !win) buildChat();   // a What's this? click can arrive before boot has built the chat
    if (!launch || !win) return;
    var pill = launch.querySelector('.vpl-pill');
    lastFocus = document.activeElement; win.classList.add('on'); launch.classList.add('open'); document.documentElement.classList.add('vp-chat-on'); updYield();
    pill.setAttribute('aria-expanded', 'true'); pill.setAttribute('aria-label', 'Close Ask VCFO chat');
    renderLog(); setTimeout(function () { win.querySelector('input').focus({ preventScroll: true }); }, 60);
    if (q) ask(q);
  }
  function closeChat() {
    if (!launch || !win) return;
    var pill = launch.querySelector('.vpl-pill');
    win.classList.remove('on'); launch.classList.remove('open'); document.documentElement.classList.remove('vp-chat-on'); updYield();
    pill.setAttribute('aria-expanded', 'false'); pill.setAttribute('aria-label', 'Open Ask VCFO chat');
    pill.focus({ preventScroll: true });
  }
  function ask(q) {
    var l = chatLog(); l.push({ r: 'u', t: q }); saveLog(l); renderLog();
    var box = win.querySelector('.vpc-ms'); box.insertAdjacentHTML('beforeend', '<div class="vpc-m vpc-a vpc-ty"><i></i><i></i><i></i></div>'); box.scrollTop = 1e6;
    win.classList.add('vpc-think');
    setTimeout(function () {
      var w = whatsThis(q), a = QA[q], l2 = chatLog(), m = w ? { r: 'a', t: w.title, w: w, k: 'ok' } : a ? { r: 'a', t: a, k: 'ok' } : { r: 'a', t: 'I can’t answer that one yet. I can pass it to Northwind’s project lead.', h: true, k: 'nan' };
      l2.push(m); saveLog(l2); renderLog(); setMood(m.k, true);
    }, reduce ? 0 : 900);
  }
  window.vcfoChat = function (q) { openChat(q); };
  /* hide robots drawn inside the boards: the global launcher replaces them */
  function hideBoardBots() {
    if (CHAT_OWN) return;
    [].forEach.call(document.querySelectorAll('[aria-label="Open Ask VCFO"], button.face, .bot > .face'), function (b) {
      if (b.closest('#vp-launch')) return;
      var n = b, hop = 0;
      while (n && n !== document.body && hop++ < 8) { var cs = getComputedStyle(n); if (cs.position === 'absolute' || cs.position === 'fixed') break; n = n.parentElement; }
      (n && n !== document.body ? n : b).classList.add('vp-hide-bot');
    });
    [].forEach.call(document.querySelectorAll('[aria-label="Ask VCFO chat"],#ask-panel'), function (p) { if (!p.closest('#vp-chat')) p.classList.add('vp-hide-bot'); });
  }
```

Rendered launcher markup (closed):

```html
<div id="vp-launch">
  <span class="vpl-char" aria-hidden="true"><span class="vpl-lift"><svg class="vpv vpv-loop" viewBox="0 0 340 216" aria-hidden="true" focusable="false">…charSVG…</svg></span></span>
  <button type="button" class="vpl-pill" aria-label="Open Ask VCFO chat" aria-expanded="false" aria-controls="vp-chat" data-notip>
    <i class="vpl-dot" aria-hidden="true"></i><span class="vpl-t">Ask VCFO</span>
    <span class="vpl-c" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>Close</span>
  </button>
</div>
```

Rendered chat window (runtime, before COI, after one answered question):

```html
<section id="vp-chat" role="dialog" aria-label="Ask VCFO chat" class="on vpc-ok">
  <span class="vpc-pk" aria-hidden="true"><svg class="vpv vpv-peek" viewBox="0 0 340 216">…charSVG…</svg></span>
  <div class="vpc-h"><span class="vpc-av"><svg class="vpv vpv-s" viewBox="0 0 240 302">…headSVG…</svg></span>
    <span><b>Ask VCFO</b><small>Answers from Northwind’s project data</small></span>
    <button type="button" aria-label="Close chat" data-close>×</button></div>
  <div class="vpc-ms" aria-live="polite">
    <div class="vpc-m vpc-a">Hello. Ask me anything about Northwind’s setup, or pick a question below.</div>
    <div class="vpc-m vpc-u">What is my next step?</div>
    <div class="vpc-m vpc-a">Step 7 · Registered Office Address is waiting for Northwind. …</div>
  </div>
  <div class="vpc-sg"><button type="button" data-q="What is my next step?">What is my next step?</button>…</div>
  <form><input aria-label="Type a question" placeholder="Type a question"><button type="submit">Send</button></form>
</section>
```

### 4.7 Chat panel content spec — design boards (`#ask-panel`, verbatim, single line as in source)

Answer state with home/thinking branches (`s/home/v7chat_answer.dc.html:144`, the `<section id="ask-panel">…</section>` element; `dc-import v7c_bot`
= the static bot head in the given mood and size; `{{…}}` are canvas bindings):

```html
<section id="ask-panel" aria-label="Ask VCFO" style="position:absolute;right:24px;bottom:104px;width:400px;height:640px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:var(--bg);border:1px solid var(--border);box-shadow:0 2px 4px oklch(32% 0.04 264 / .06),0 18px 48px -12px oklch(21% 0.042 264 / .35);animation:v7up .3s cubic-bezier(.22,1,.36,1) both"><sc-if value="{{isHome}}" hint-placeholder-val="{{false}}"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="idle" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div></sc-if><sc-if value="{{isThink}}" hint-placeholder-val="{{false}}"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><button type="button" aria-label="Back to home" onClick="{{home}}" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="thinking" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div></sc-if><sc-if value="{{isAns}}" hint-placeholder-val="{{true}}"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><button type="button" aria-label="Back to home" onClick="{{home}}" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="answered" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div></sc-if><div style="flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px"><sc-if value="{{isHome}}" hint-placeholder-val="{{false}}"><div style="margin:-14px -14px 0;padding:16px 16px 44px;background:#0f2a4a;color:#fff"><div style="font-size:12px;color:oklch(100% 0 0 / .65)">Hello,</div><div class="metric" style="font-size:21px;color:#fff;margin-top:2px">Northwind Technologies</div></div><div style="margin-top:-40px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 4px 14px -4px oklch(37.9% 0.146 266 / .1)"><div style="display:flex;align-items:center;gap:8px"><span class="lbl">Northwind’s project</span><span class="chip" style="margin-left:auto;background:var(--prog-light);color:var(--prog-text)">SPICe+ Part B</span></div><div style="font-size:13.5px;font-weight:700">Registered Office Address</div><div style="height:5px;border-radius:99px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);overflow:hidden"><div style="width:18%;height:100%;background:var(--primary-fill,var(--primary));border-radius:99px"></div></div><div class="cap">7 of 38 steps done</div></div><div style="display:flex;flex-direction:column;gap:8px"><div class="lbl">Quick questions</div><div class="seg" role="tablist" style="grid-template-columns:repeat(2,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/2);{{thumb}}"></span><button type="button" role="tab" onClick="{{t0}}" class="{{c0}}">About Northwind’s project<span class="cnt">2</span></button><button type="button" role="tab" onClick="{{t1}}" class="{{c1}}">Learn the basics<span class="cnt">4</span></button></div><sc-if value="{{g0}}" hint-placeholder-val="{{true}}"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px"><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is my next step?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button" onClick="{{askWhere}}" style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">Where is my incorporation now?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li></ul></sc-if><sc-if value="{{g1}}" hint-placeholder-val="{{false}}"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px"><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is SPICe+ Part A?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is GST, and do we need it?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What happens after incorporation?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is FC-GPR?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li></ul></sc-if></div><div style="display:flex;flex-direction:column;gap:6px"><div class="lbl">Pick up where Northwind left off</div><a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--fg)"><span style="width:28px;height:28px;border-radius:6px;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a1.5 1.5 0 0 1-1.5-1.5Z M8.5 9h7 M8.5 12h4.5"></path></svg></span><span style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600">Last conversation<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">What is SPICe+ Part A?<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--muted)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></a><a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--fg)"><span style="width:28px;height:28px;border-radius:6px;background:var(--ok-light);color:var(--ok-text);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M5.5 5A1.5 1.5 0 0 1 7 3.5h11.5v14H7A1.5 1.5 0 0 0 5.5 19Z"></path><path d="M5.5 19V5A1.5 1.5 0 0 1 7 3.5h11.5v14H7A1.5 1.5 0 0 0 5.5 19a1.5 1.5 0 0 0 1.5 1.5h11.5 M9 7.5h6"></path></svg></span><span style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600">Northwind’s Library<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Explanations Northwind saved from Ask VCFO<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--muted)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></a><a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--fg)"><span style="width:28px;height:28px;border-radius:6px;background:var(--raised);color:var(--fg);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></span><span style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600">Monthly status brief<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">PDF · October 2026<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span></a></div></sc-if><sc-if value="{{isThink}}" hint-placeholder-val="{{false}}"><div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:flex-end"><p style="margin:0;max-width:82%;border-radius:12px 12px 4px 12px;background:light-dark(oklch(93% 0.012 255), oklch(23.5% 0.01 255));padding:9px 12px;font-size:13.5px">Where is my incorporation now?</p></div><div style="display:flex;gap:8px;align-items:flex-start"><span class="" style="width:28px;height:28px;flex:none;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center"><dc-import name="v7c_bot" state="thinking" size="22" hint-size="22px,22px"></dc-import></span><div style="flex:1;min-width:0"><span style="display:inline-flex;gap:4px;align-items:center;padding:10px 12px;border-radius:12px 12px 12px 4px;background:var(--panel);border:1px solid var(--border)"><span class="dot1" style="width:6px;height:6px;border-radius:99px;background:var(--primary-fill,var(--primary))"></span><span class="dot2" style="width:6px;height:6px;border-radius:99px;background:var(--primary-fill,var(--primary))"></span><span class="dot3" style="width:6px;height:6px;border-radius:99px;background:var(--primary-fill,var(--primary))"></span></span><p aria-live="polite" style="margin:0;position:absolute;width:1px;height:1px;overflow:hidden">Finding sources…</p><ol style="list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px"><li style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ok-text)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M7 12.5l3 3 7-7"></path></svg>Checking Northwind’s project…</li><li style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--fg)"><span class="dot1" style="width:12px;height:12px;display:inline-block;border-radius:99px;border:2px solid var(--primary);border-right-color:transparent"></span>Finding sources…</li><li style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--subtle)"><span style="width:12px;height:12px;display:inline-block;border-radius:99px;border:1.5px dashed var(--border)"></span>Writing…</li></ol></div></div></div></sc-if><sc-if value="{{isAns}}" hint-placeholder-val="{{true}}"><div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:flex-end"><p style="margin:0;max-width:82%;border-radius:12px 12px 4px 12px;background:light-dark(oklch(93% 0.012 255), oklch(23.5% 0.01 255));padding:9px 12px;font-size:13.5px">Where is my incorporation now?</p></div><div style="display:flex;gap:8px;align-items:flex-start"><span class="react" style="width:28px;height:28px;flex:none;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center"><dc-import name="v7c_bot" state="answered" size="22" hint-size="22px,22px"></dc-import></span><div style="flex:1;min-width:0"><article style="border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:12px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:6px"><span style="display:inline-flex;align-items:center;gap:4px;border-radius:4px;background:var(--ok-light);color:var(--ok-text);padding:2px 8px;font-size:11px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"></path><path d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M8.6 12.2l2.3 2.3 4.6-4.8"></path></svg>Reviewed by SBC</span></div><p style="margin:0;font-size:14px;line-height:1.5">7 of 38 steps are complete. You're in SPICe+ Part B, on Registered Office Address.<sup style="font-size:10px;color:var(--primary);font-weight:700;margin-left:2px">1</sup></p><ol aria-label="Incorporation phases" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px"><li class="tipw" role="button" tabindex="0" aria-label="SPICe+ Part A · 5 of 5 done" onClick="{{dd0}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px solid var(--border);background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250))"><span class="tt " role="tooltip">SPICe+ Part A · 5 of 5 done</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="display:inline-flex;align-items:center;gap:4px;color:var(--ok-text)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M7 12.5l3 3 7-7"></path></svg>Done</span></span><span style="font-size:12.5px;font-weight:600">SPICe+ Part A</span><span style="font-size:11.5px;color:var(--muted)">5 of 5</span></li><li class="tipw" role="button" tabindex="0" aria-label="SPICe+ Part B · 2 of 9 done" onClick="{{dd1}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px solid var(--primary);background:var(--primary-light)"><span class="tt " role="tooltip">SPICe+ Part B · 2 of 9 done</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="color:var(--primary)">Northwind is here</span></span><span style="font-size:12.5px;font-weight:600">SPICe+ Part B</span><span style="font-size:11.5px;color:var(--muted)">2 of 9</span></li><li class="tipw" role="button" tabindex="0" aria-label="Post-incorporation · 0 of 11" onClick="{{dd2}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px dashed var(--border);background:var(--panel)"><span class="tt " role="tooltip">Post-incorporation · 0 of 11</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="color:var(--muted)">Next</span></span><span style="font-size:12.5px;font-weight:600">Post-incorporation</span><span style="font-size:11.5px;color:var(--muted)">0 of 11</span></li><li class="tipw" role="button" tabindex="0" aria-label="Registration · 0 of 13" onClick="{{dd3}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px dashed var(--border);background:var(--panel)"><span class="tt " role="tooltip">Registration · 0 of 13</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="color:var(--muted)">Next</span></span><span style="font-size:12.5px;font-weight:600">Registration</span><span style="font-size:11.5px;color:var(--muted)">0 of 13</span></li></ol><div style="border-left:2px solid var(--gold);padding-left:10px"><div style="font-size:12px;font-weight:700">Why it matters to Northwind</div><div style="font-size:12.5px;color:var(--muted)">Each phase unlocks the next, so this is the step that moves Northwind forward.</div></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--primary);border:1px solid oklch(54.6% 0.215 263 / .5);font:600 12.5px Manrope,sans-serif;cursor:pointer;">Open Incorporation<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg></button><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--fg);border:1px solid var(--border);font:600 12.5px Manrope,sans-serif;cursor:pointer;">Open Registered Office Address<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg></button></div><div style="display:flex;align-items:center;gap:6px;border-top:1px solid var(--hair);padding-top:8px"><span class="lbl" style="font-size:10px">Sources</span><a href="#" style="display:inline-flex;align-items:center;gap:4px;border-radius:4px;background:var(--raised);padding:2px 6px;font-size:11px;font-weight:600;color:var(--fg)"><span style="color:var(--primary)">1</span>Northwind’s project</a></div></article><div style="display:flex;align-items:center;gap:6px;margin-top:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--fg);border:1px solid var(--border);font:600 12.5px Manrope,sans-serif;cursor:pointer;min-height:30px;font-size:12px">Ask my lead</button><span style="margin-left:auto;font-size:11.5px;color:var(--muted)">Helpful?</span><button type="button" aria-label="Helpful" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H4V10Zm0 0 4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.2 21H7"></path></svg></button><button type="button" aria-label="Not helpful" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(180deg)"><path d="M7 10v11H4V10Zm0 0 4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.2 21H7"></path></svg></button></div></div></div></div></sc-if></div><div style="border-top:1px solid var(--border);background:var(--panel);padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px"><form style="display:flex;align-items:center;gap:8px"><label for="ask-composer" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Ask VCFO</label><input id="ask-composer" placeholder="Ask about Northwind’s setup…" style="flex:1;height:38px;border-radius:6px;border:1px solid var(--border);padding:0 12px;font:500 13px Manrope,sans-serif;color:var(--fg);background:var(--panel)"><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><button type="button" aria-label="Send" style="width:38px;height:38px;flex:none;border-radius:6px;border:0;background:var(--primary-fill,var(--primary));color:#fff;display:flex;align-items:center;justify-content:center;opacity:.4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button></form></div></section>
```

Hand-off state (`s/home/v7chat_handoff.dc.html:144`, `<section id="ask-panel">…</section>`):

```html
<section id="ask-panel" aria-label="Ask VCFO" style="position:absolute;right:24px;bottom:104px;width:400px;height:640px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:var(--bg);border:1px solid var(--border);box-shadow:0 2px 4px oklch(32% 0.04 264 / .06),0 18px 48px -12px oklch(21% 0.042 264 / .35);animation:v7up .3s cubic-bezier(.22,1,.36,1) both"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><button type="button" aria-label="Back to home" onClick="{{home}}" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="cannot" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:flex-end"><p style="margin:0;max-width:82%;border-radius:12px 12px 4px 12px;background:light-dark(oklch(93% 0.012 255), oklch(23.5% 0.01 255));padding:9px 12px;font-size:13.5px">Can our registered office be a co-working space?</p></div><div style="display:flex;gap:8px;align-items:flex-start"><span class="" style="width:28px;height:28px;flex:none;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center"><dc-import name="v7c_bot" state="cannot" size="22" hint-size="22px,22px"></dc-import></span><div style="flex:1;min-width:0"><article style="border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:12px;display:flex;flex-direction:column;gap:8px"><span style="align-self:flex-start;display:inline-flex;align-items:center;gap:4px;border-radius:4px;background:var(--raised);color:var(--muted);padding:2px 8px;font-size:11px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M11 4c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5C8.8 10 10.5 8.3 11 4Z"></path><path d="M11 4c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5C8.8 10 10.5 8.3 11 4Z M18 15.5c.2 1.5.9 2.2 2.5 2.5-1.6.3-2.3 1-2.5 2.5-.2-1.5-.9-2.2-2.5-2.5 1.6-.3 2.3-1 2.5-2.5Z"></path></svg>AI answer · check with Northwind’s lead</span><p style="margin:0;font-size:14px;line-height:1.5">I’m not certain about this one. Northwind’s project lead can answer it.</p></article><div style="margin-top:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--fg);border:1px solid var(--border);font:600 12.5px Manrope,sans-serif;cursor:pointer;min-height:30px;font-size:12px;background:var(--primary-light);border-color:oklch(54.6% 0.215 263 / .35);color:var(--primary)">Ask my lead</button></div></div></div><sc-if value="{{notSent}}" hint-placeholder-val="{{true}}"><form style="border-radius:10px;background:var(--panel);border:1px solid var(--border);border-top:3px solid var(--primary);padding:12px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:10px"><span style="width:36px;height:36px;border-radius:99px;background:var(--raised);box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted)" title="Photo placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8Z"></path><path d="M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8Z M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"></path></svg></span><div style="flex:1"><div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:4px">Arjun Mehta<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Project Lead · replies by email<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><div class="cap">Project Lead</div></div></div><div style="display:flex;align-items:center;gap:4px"><label for="ask-handoff" style="font-size:12.5px;font-weight:700">Ask Northwind’s project lead</label><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">The last 4 messages go with it, so they have the context.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><textarea id="ask-handoff" rows="3" style="resize:none;border-radius:6px;border:1px solid var(--border);padding:8px 10px;font:500 13px Manrope,sans-serif;color:var(--fg)">Can our registered office be a co-working space?</textarea><div style="display:flex;justify-content:flex-end;gap:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:transparent;color:var(--muted);border:1px solid transparent;font:600 12.5px Manrope,sans-serif;cursor:pointer;">Cancel</button><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--primary-fill,var(--primary));color:#fff;border:1px solid var(--primary);font:600 12.5px Manrope,sans-serif;cursor:pointer;" onClick="{{send}}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4 12 20 4l-4 16-4-6Z"></path><path d="M4 12 20 4l-4 16-4-6Z M12 14l8-10"></path></svg>Send to lead</button></div></form></sc-if><sc-if value="{{sent}}" hint-placeholder-val="{{false}}"><div role="status" style="display:flex;align-items:center;gap:8px;border-radius:10px;background:var(--ok-light);color:var(--ok-text);padding:10px 12px;font-size:12.5px;font-weight:600"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"></path><path d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M8.6 12.2l2.3 2.3 4.6-4.8"></path></svg><span style="flex:1">Sent to Northwind’s project lead. They’ll reply by email.</span><button type="button" style="border:0;background:none;color:inherit;text-decoration:underline;font:inherit">Close</button></div></sc-if></div><div style="border-top:1px solid var(--border);background:var(--panel);padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px"><form style="display:flex;align-items:center;gap:8px"><label for="ask-composer" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Ask VCFO</label><input id="ask-composer" placeholder="Ask about Northwind’s setup…" style="flex:1;height:38px;border-radius:6px;border:1px solid var(--border);padding:0 12px;font:500 13px Manrope,sans-serif;color:var(--fg);background:var(--panel)"><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><button type="button" aria-label="Send" style="width:38px;height:38px;flex:none;border-radius:6px;border:0;background:var(--primary-fill,var(--primary));color:#fff;display:flex;align-items:center;justify-content:center;opacity:.4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button></form></div></section>
```

First-visit launcher bubble (`s/home/v7chat_launcher.dc.html:144`, the `.botup` block):

```html
<div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5"><div role="status" style="position:absolute;right:0;bottom:116px;width:300px;border-radius:10px;background:var(--panel);border:1px solid var(--border);box-shadow:0 12px 32px -12px oklch(21% 0.042 264 / .3);padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;animation:v7up .35s cubic-bezier(.22,1,.36,1) .9s both"><div style="display:flex;gap:8px;align-items:flex-start"><span style="flex:1;font-size:13px;line-height:1.45">Hello. Ask me anything about Northwind’s setup, or pick a question below.</span><button type="button" aria-label="Dismiss" style="width:24px;height:24px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;border-radius:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" style="min-height:30px;padding:0 10px;border-radius:6px;border:1px solid oklch(54.6% 0.215 263 / .35);background:var(--primary-light);color:var(--primary);font:600 12px Manrope,sans-serif">What is my next step?</button><button type="button" style="min-height:30px;padding:0 10px;border-radius:6px;border:1px solid oklch(54.6% 0.215 263 / .35);background:var(--primary-light);color:var(--primary);font:600 12px Manrope,sans-serif">Where is my incorporation now?</button></div></div><span style="background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px;position:relative">Ask VCFO<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span><button type="button" aria-label="Open Ask VCFO" aria-expanded="false" aria-controls="ask-panel" style="width:68px;height:68px;border-radius:99px;border:0;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span class="bob" style="display:flex"><dc-import name="v7c_bot" state="idle" size="50" hint-size="50px,50px"></dc-import></span></button></div>
```

Static bot in 4 moods (`s/home/v7c_bot.dc.html:141-150`):

```html
</style><style>
/* owner character, static head. Moods: antenna colour (idle teal, answered green, cannot grey); thinking = antenna pulse + eyes scan. The smile never changes. */
.vb-scan{animation:vbScan 1.3s ease-in-out infinite}
@keyframes vbScan{0%,100%{transform:translateX(-9px)}50%{transform:translateX(9px)}}
.vb-ant{animation:vbAnt 1s ease-in-out infinite}
@keyframes vbAnt{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.vb-scan,.vb-ant{animation:none}}
</style>
</helmet>
<div style="{{box}}"><sc-if value="{{idle}}" hint-placeholder-val="{{true}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="" cx="120" cy="18" r="8" fill="#2DD4BF"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if><sc-if value="{{thinking}}" hint-placeholder-val="{{false}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, thinking"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="vb-ant" cx="120" cy="18" r="8" fill="#7DD3FC"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="vb-scan" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if><sc-if value="{{answered}}" hint-placeholder-val="{{false}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, answered"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="" cx="120" cy="18" r="8" fill="#34D399"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if><sc-if value="{{cannot}}" hint-placeholder-val="{{false}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, cannot answer"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="" cx="120" cy="18" r="8" fill="#94A3B8"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if></div>
```

### 4.8 Toast — `proto.js:130-132` + `158-166` (in §4.3) and the board toast classes

```css
/* b/ecdc…css:152-153 (Team/Updates/Audit/Settings boards) */
.toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:8px;background:var(--navy);color:#fff;font-size:13px;font-weight:600;box-shadow:0 16px 40px -14px oklch(21% 0.042 264 / .6);z-index:25}
.toast a{color:oklch(86% 0.09 85)}
/* b/5c039…css:183-184 (Incorporation boards) */
.toast{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:10px;background:var(--navy);color:#fff;font-weight:600;box-shadow:0 16px 34px -12px oklch(15% 0.05 258 / .6);animation:v7up .4s cubic-bezier(.22,1,.36,1) both}
.toast a{color:var(--gold)}
```

### 4.9 Drill-down pop-up

Runtime component (`proto.js:683-739`):

```js
  /* ---------- one drill-down pop-up for charts drawn outside the boards (rule 14) ---------- */
  var dcss = document.createElement('style');
  dcss.textContent = [
    '#vp-drill{width:min(600px,100%);max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:12px;box-shadow:0 30px 70px -20px rgba(8,20,40,.6);overflow:hidden;font:500 13px/1.45 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));transform:translateY(10px) scale(.98);transition:transform .24s cubic-bezier(.22,1,.36,1)}',
    '#vp-drill-scrim.on #vp-drill{transform:none}',
    '#vp-drill .top{display:flex;align-items:center;gap:8px;padding:9px 18px;background:light-dark(#eef3ff, oklch(18.4% 0.01 267.8));border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));font-size:12px;color:#5a6b82}',
    '#vp-drill .top a{margin-left:auto;font-weight:800;font-size:12.5px;color:#2e5cff;text-decoration:none;white-space:nowrap}',
    '#vp-drill .hd{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7))}',
    '#vp-drill .hd b{flex:1;font:700 15px Manrope;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#vp-drill .hd small{display:block;font:500 12px Manrope;color:#5a6b82}',
    '#vp-drill .x{width:32px;height:32px;border-radius:6px;border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#fff, oklch(13% 0 89.9));color:#5a6b82;cursor:pointer;font-size:18px;line-height:1}',
    '#vp-drill .tabs{display:flex;gap:2px;margin:14px 18px 0;padding:2px;border-radius:8px;background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));box-shadow:inset 0 0 0 1px #e3e8ef}',
    '#vp-drill .tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;border:0;border-radius:6px;background:none;font:600 12px Manrope;color:#5a6b82;cursor:pointer;white-space:nowrap}',
    '#vp-drill .tabs button i{width:8px;height:8px;border-radius:2px;display:inline-block}',
    '#vp-drill .tabs button span{font:600 11px "IBM Plex Mono",monospace;opacity:.75}',
    '#vp-drill .tabs button[aria-selected=true]{background:#0f2a4a;color:#fff}',
    '#vp-drill .list{flex:1;min-height:0;overflow:auto;padding:8px 18px 6px;scrollbar-width:none}',
    '#vp-drill .list::-webkit-scrollbar{display:none}',
    '#vp-drill .r{display:grid;grid-template-columns:minmax(0,1fr) auto auto 16px;align-items:center;gap:12px;padding:9px 10px;margin:0 -10px;border-radius:6px;cursor:pointer;color:inherit;text-decoration:none}',
    '#vp-drill .r:hover{background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3))}',
    '#vp-drill .r b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#vp-drill .r em{font:500 12px "IBM Plex Mono",monospace;font-style:normal;color:#5a6b82;white-space:nowrap}',
    '#vp-drill .r .c{font:700 11px Manrope;padding:2px 7px;border-radius:4px;color:#fff;white-space:nowrap}',
    '#vp-drill .r .a{color:#2e5cff}',
    '#vp-drill .ft{padding:10px 18px;border-top:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3));font-size:12px;color:#5a6b82}',
    '@media (max-width:700px){#vp-drill-scrim{align-items:flex-end;padding:0}#vp-drill{width:100%;border-radius:14px 14px 0 0;max-height:86vh}}'
  ].join('\n');
  document.head.appendChild(dcss);
  function drill(cfg) {
    var old = document.getElementById('vp-drill-scrim'); if (old) old.remove();
    var tab = cfg.active || 0, last = document.activeElement;
    var sc = document.createElement('div'); sc.id = 'vp-drill-scrim';
    sc.innerHTML = '<div id="vp-drill" role="dialog" aria-modal="true" aria-labelledby="vp-drill-t">' +
      (cfg.link ? '<div class="top"><span>' + cfg.link.lead + '</span><a href="#" data-dlink>' + cfg.link.text + '</a></div>' : '') +
      '<div class="hd"><b id="vp-drill-t">' + cfg.title + (cfg.sub ? '<small>' + cfg.sub + '</small>' : '') + '</b><button type="button" class="x" aria-label="Close">×</button></div>' +
      '<div class="tabs" role="tablist"></div><div class="list"></div><div class="ft"></div></div>';
    document.body.appendChild(sc); requestAnimationFrame(function () { sc.classList.add('on'); });
    function paint() {
      sc.querySelector('.tabs').innerHTML = cfg.tabs.map(function (t, i) { return '<button type="button" role="tab" aria-selected="' + (i === tab) + '" data-t="' + i + '">' + (t.color ? '<i style="background:' + t.color + '"></i>' : '') + t.label + '<span>' + (t.n != null ? t.n : t.rows.length) + '</span></button>'; }).join('');
      var t = cfg.tabs[tab], rows = t.rows;
      sc.querySelector('.list').innerHTML = rows.length ? rows.map(function (r, i) { return '<a href="#" class="r" data-r="' + i + '"><b>' + r[0] + '</b><em>' + (r[1] || '') + '</em>' + (r[2] ? '<span class="c" style="background:' + (r[3] || '#5a6b82') + '">' + r[2] + '</span>' : '<span></span>') + '<span class="a">→</span></a>'; }).join('') : '<div style="padding:16px 0;color:#5a6b82">Nothing here.</div>';
      var total = t.n != null ? t.n : rows.length;
      sc.querySelector('.ft').textContent = rows.length < total ? 'Showing ' + rows.length + ' of ' + total + ' · the full list is in ' + (cfg.link ? cfg.link.where || 'the app' : 'the app') : 'Showing all ' + total;
    }
    function close() { document.removeEventListener('keydown', key, true); sc.classList.remove('on'); setTimeout(function () { sc.remove(); }, reduce ? 0 : 160); last && last.focus && last.focus({ preventScroll: true }); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', key, true);
    sc.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target === sc || e.target.closest('.x')) { e.preventDefault(); return close(); }
      var b = e.target.closest('[data-t]'); if (b) { tab = +b.getAttribute('data-t'); paint(); return; }
      if (e.target.closest('[data-dlink]')) { e.preventDefault(); close(); if (cfg.link.go) go(cfg.link.go); else if (cfg.link.onClick) cfg.link.onClick(); return; }
      var r = e.target.closest('[data-r]'); if (r) { e.preventDefault(); var row = cfg.tabs[tab].rows[+r.getAttribute('data-r')]; close(); if (row[4]) go(row[4]); else toast('Opening ' + row[0] + '…'); }
    });
    paint(); setTimeout(function () { var f = sc.querySelector('.x'); f && f.focus({ preventScroll: true }); }, 40);
  }
  window.vcfoDrill = drill;
```

Owner board component with the navy sliding pill (`s/home/v7x_drilldown.dc.html:225-238`; the `.seg`/`.thumb` CSS it relies on is `b/ecdc…css:61-79`, quoted after it):

```html
<div role="dialog" aria-modal="true" aria-label="{{title}}" class="vh-dd" style="width:600px;max-height:560px;display:flex;flex-direction:column;background:var(--panel);border-radius:12px;box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6);overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px"><div class="dd-top" style="display:flex;align-items:center;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)"><span>These items live in {{linkName}}</span><a href="#" data-go="{{linkGo}}" style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap">Open {{linkName}} →</a></div><div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)"><div style="flex:1;font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">{{title}}</div><button type="button" aria-label="Close" onClick="{{close}}" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="padding:14px 18px 0"><div class="seg" role="tablist" style="{{segSt}}"><span class="thumb" style="{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="4"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div><div style="flex:1;min-height:0;overflow:auto;padding:8px 18px 4px"><sc-for list="{{rows}}" as="r" hint-placeholder-count="4"><a class="ddrow" href="#" title="Open"><span style="font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{r.n}}</span><span class="mono" style="font-size:12px;color:var(--muted);white-space:nowrap">{{r.m}}</span><span class="chip" style="{{r.cs}}">{{r.s}}</span><span style="color:var(--primary);display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></a></sc-for><sc-if value="{{empty}}" hint-placeholder-val="{{false}}"><div style="padding:16px 0;color:var(--muted)">Nothing here.</div></sc-if></div><div style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-top:1px solid var(--border);background:var(--raised)"><span style="flex:1;font-size:12px;color:var(--muted)">{{foot}}</span><a href="#" style="font-size:12.5px;font-weight:700">Open full list</a></div></div>
</template></x-dc><script>(function(){var x=document.querySelector("x-dc"),t=x&&x.firstElementChild;if(t&&t.tagName==="TEMPLATE"){x.replaceChildren(document.adoptNode(t.content));}})();</script>
<script type="text/x-dc" data-dc-script data-props='{"title":{"editor":"text","default":"Incorporation steps"},"tabs":{"editor":"text","default":"[[\"All\", 14], [\"Completed\", 6], [\"In progress\", 3], [\"Waiting for Northwind\", 1], [\"Upcoming\", 4]]"},"rows":{"editor":"text","default":"[[\"Client Details\", \"12 Sep\", \"Completed\", \"ok\", 1], [\"Draft Board Resolution\", \"14 Sep\", \"Completed\", \"ok\", 1], [\"Signed Board Resolution\", \"18 Sep\", \"Completed\", \"ok\", 1], [\"Name Application\", \"Part A\", \"Completed\", \"ok\", 1], [\"Name Approval\", \"24 Sep\", \"Completed\", \"ok\", 1], [\"Capital Structure\", \"1 Oct\", \"Completed\", \"ok\", 1], [\"Proposed Directors\", \"6 Oct\", \"In progress\", \"prog\", 2], [\"Subscriber Details\", \"10 Oct\", \"In progress\", \"prog\", 2], [\"Registered Office Address\", \"9 Oct\", \"Waiting for Northwind\", \"due\", 3], [\"KYC Review & DSC\", \"13 Oct\", \"In progress\", \"prog\", 2], [\"SPICe+ Confirmation\", \"16 Oct\", \"Upcoming\", \"up\", 4], [\"SPICe+ Filing\", \"20 Oct\", \"Upcoming\", \"up\", 4], [\"MCA Remarks\", \"24 Oct\", \"Upcoming\", \"up\", 4], [\"Certificate of Incorporation\", \"28 Oct\", \"Upcoming\", \"up\", 4]]"},"active":{"editor":"number","default":1},"$preview":{"width":600,"height":480}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    const p = this.props || {}; let T = [], R = []; try { T = JSON.parse(p.tabs || '[]'); R = JSON.parse(p.rows || '[]'); } catch (e) {}const tab = (s.tab != null) ? s.tab : Number(p.active || 0); const n = T.length || 1; const all = T[0] && T[0][0] === 'All';const tabs = T.map((t, i) => ({ label: t[0], cnt: t[1], cls: i === tab ? 'on' : '', pick: () => this.setState({ tab: i }) }));const rows = R.filter((r) => (all && tab === 0) || r[4] === tab).map((r) => ({ n: r[0], m: r[1], s: r[2], cs: 'background:var(--' + r[3] + '-chip);color:#fff' }));const total = T[tab] ? T[tab][1] : rows.length;const tl = String(p.title || ''); const L = /filings/i.test(tl) ? ['Filings', 'filings'] : /alert/i.test(tl) ? ['Notifications', 'notifications'] : /document/i.test(tl) ? ['Documents', 'documents'] : /team|who/i.test(tl) ? ['Team', 'team'] : /compliance|deadline/i.test(tl) ? ['Compliances', 'compliances'] : ['Incorporation', 'incorporation'];
    return { linkName: L[0], linkGo: L[1], title: p.title || 'Details', tabs, rows, empty: rows.length === 0, segSt: 'grid-template-columns:repeat(' + n + ',minmax(0,1fr));width:100%', thumb: 'width:calc((100% - 4px)/' + n + ');transform:translateX(' + (tab * 100) + '%)', foot: rows.length < total ? 'Showing ' + rows.length + ' of ' + total : 'Showing all ' + total, close: () => { if (typeof p.onclose === 'function') p.onclose(); } };
  }
}
</script>
<script src="../../routes.js"></script><script src="../../proto.js"></script>
</body>
</html>
```

```css
/* b/ecdc4c28c4511de8452c7a5f1e7f79e6.css:61-79 · segmented control + navy sliding pill (v7.1 spring) */
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:4px;border-radius:8px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:4px;bottom:4px;left:4px;border-radius:6px;background:var(--primary-light);box-shadow:inset 0 0 0 1px oklch(54.6% 0.215 263 / 0.28),0 1px 2px oklch(28% 0.06 264 / 0.08);transition:transform .38s cubic-bezier(.3,1.3,.5,1)}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;height:28px;padding:0 12px;border-radius:6px;font:600 12px Manrope,sans-serif;color:var(--muted);cursor:pointer;white-space:nowrap}
.seg button.on{color:var(--navy-ink,var(--navy));font-weight:700}
.seg .cnt{font:600 10.5px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}


/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/shell/motion.ts springSnappy (420/32/0.8) */
.seg{padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{top:2px;bottom:2px;left:2px;border-radius:5px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
/* dark theme: #0f2a4a vanishes on a dark track, so the pill steps up to --navy-3 */
[data-theme="dark"] .seg>.thumb{background:var(--navy-3)}
.seg button{height:28px;padding:0 10px;border-radius:5px;font:500 12px Manrope,sans-serif;color:oklch(55% 0.022 255);transition:color .2s}
.seg button:hover{color:light-dark(oklch(45% 0.03 255), oklch(82% 0.021 255))}
.seg button.on{color:#fff;font-weight:500}
.seg .cnt{color:oklch(55% 0.022 255)}
.seg button.on .cnt{color:oklch(100% 0 0 / .72)}
/* .ddrow + .tipw (s/home/v7x_drilldown.dc.html:128-140) */
.tipw{cursor:pointer}
.tipw .tt{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translate(-50%,4px);z-index:60;background:var(--navy);color:#fff;font:700 12px/1.3 Manrope,sans-serif;letter-spacing:0;text-transform:none;padding:5px 9px;border-radius:6px;white-space:nowrap;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s,transform .12s,visibility .12s}
.tipw .tt::after{content:"";position:absolute;left:50%;top:100%;width:8px;height:8px;background:inherit;transform:translate(-50%,-4px) rotate(45deg)}
.tipw .tt.l{left:auto;right:calc(100% + 10px);bottom:auto;top:50%;transform:translate(4px,-50%)}
.tipw .tt.l::after{left:100%;top:50%;transform:translate(-4px,-50%) rotate(45deg)}
.tipw .tt.w{background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy))}
.tipw:hover>.tt,.tipw:focus-visible>.tt{opacity:1;visibility:visible;transform:translate(-50%,0)}
.tipw:hover>.tt.l,.tipw:focus-visible>.tt.l{transform:translate(0,-50%)}
.ddrow{display:grid;grid-template-columns:minmax(0,1fr) 62px 116px 16px;align-items:center;gap:12px;padding:9px 10px;margin:0 -10px;border-radius:6px;color:var(--fg)}
.ddrow>.mono{text-align:right}
.ddrow>.chip{width:100%;justify-content:center}
.ddrow:hover{background:var(--raised)}
@media (prefers-reduced-motion: reduce){.tipw .tt{transition:none}}
```

Drill-down spec text (`s/home/v7x_drilldown_spec.dc.html`):

```text
- One component for every visual: v7x_drilldown with props title , tabs [[label, count]…], rows [[name, date/meta, status, colour, tab]…], active (the clicked part), onclose . 
- Hover (or keyboard focus) shows the tooltip; click / tap / Enter opens the pop-up. Each part is a real button with an aria-label. 
- Pop-up: 600 px, 12 px corners, dimmed backdrop; navy sliding pill (springSnappy) switches between the parts; rows are links to the real page; footer "Showing n of m" + "Open full list". Closes on backdrop, ×, or Esc. 
- Wired on the dashboard: greeting ring · current-step badges · timeline bars · compliance-by-area bars · What is next · Alerts · post-incorporation bars · chat phase visual. The compliance donut keeps its own pop-up (same pattern). 
- Reduced motion: the pill jumps, no fade.
```

Phone bottom sheet (`s/home/mobile.html:144-152` CSS, 202 markup, 301-312 JS):

```css
/* sheet */
.scrim{position:fixed;inset:0;z-index:60;background:oklch(20% .05 258 / .45);opacity:0;transition:opacity .2s;pointer-events:none}
.scrim.on{opacity:1;pointer-events:auto}
.sheet{visibility:hidden;position:fixed;left:50%;bottom:0;z-index:61;width:min(100%,560px);max-height:min(82vh,calc(100dvh - 24px));display:flex;flex-direction:column;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:14px 14px 0 0;box-shadow:0 -16px 40px -20px oklch(15% .05 258 / .5);transform:translate(-50%,105%);transition:transform .38s var(--spring)}
.sheet.on{visibility:visible;transform:translate(-50%,0)}
.sheet .grab{display:flex;justify-content:center;padding:8px 0 4px}.sheet .grab i{width:40px;height:4px;border-radius:2px;background:var(--border)}
.sheet .sh{display:flex;align-items:center;gap:8px;padding:4px 14px 10px}
.sheet .sh h3{margin:0;font:800 16px Manrope;color:var(--navy-ink,var(--navy));flex:1}
.sheet .body{overflow:auto;padding-bottom:20px}
```

```html
<section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="shT"><div class="grab"><i></i></div><div class="sh"><h3 id="shT"></h3><button class="ib" type="button" aria-label="Close" id="shX"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="body" id="shB"></div></section>
```

```js
/* ---------- bottom sheet (rule 14 on mobile) ---------- */
var sheet=$('#sheet'),scrim=$('#scrim'),lastFocus;
function openSheet(title,html,after){if(sheet.classList.contains('on')&&sheet._t===title&&sheet._h===html){closeSheet();return;}sheet._t=title;sheet._h=html;lastFocus=document.activeElement;$('#shT').textContent=title;$('#shB').innerHTML=html;scrim.classList.add('on');sheet.classList.add('on');document.body.classList.add('sheet-open');$('#launch').classList.add('sink');setTimeout(function(){$$('#shB .seg').forEach(placeThumb);after&&after();$('#shX').focus({preventScroll:true})},30);}
function closeSheet(){document.body.classList.remove('sheet-open');scrim.classList.remove('on');sheet.classList.remove('on');$('#launch').classList.remove('sink');lastFocus&&lastFocus.focus&&lastFocus.focus({preventScroll:true});}
scrim.onclick=closeSheet;$('#shX').onclick=closeSheet;
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeSheet();closeDrawer();}});
function drill(title,parts,sel,rowsFor){var render=function(i){return seg('drill',parts.map(function(p){return [p[0],p[1]]}),i)+'<div id="drillRows">'+rowsFor(i)+'</div>';};
 openSheet(title,render(sel));
 $('#shB').onclick=function(e){var b=e.target.closest('[data-seg=drill] button');if(b){var i=+b.getAttribute('data-i');$$('[data-seg=drill] button').forEach(function(x){x.setAttribute('aria-selected',String(x===b))});placeThumb(b.parentNode);$('#drillRows').innerHTML=rowsFor(i);return;}
  var r=e.target.closest('[data-open]');if(r){closeSheet();go(r.getAttribute('data-open'));}};}
function drow(k,t,s,route){return '<button class="row" type="button" data-open="'+(route||'incorporation')+'">'+si(k)+'<span class="t"><b>'+t+'</b><span>'+s+'</span></span>'+ic('go',14,2.4)+'</button>';}
var STEPS=[['done','Client Details','Step 1 · done 12 Sep'],['done','Draft Board Resolution','Step 2 · done 16 Sep'],['done','Signed Board Resolution','Step 3 · done 20 Sep'],['done','Name Application','Step 4 · done 24 Sep'],['done','Name Approval','Step 5 · done 24 Sep'],['done','Capital Structure','Step 6 · done 1 Oct'],['you','Registered Office Address','Step 7 · Northwind · due 9 Oct'],['you','Proposed Directors','Step 8 · Northwind · in progress'],['you','Subscriber Details','Step 9 · Northwind · in progress'],['sbc','KYC Review & DSC','Step 10 · SBC · in progress · 13 Oct'],['up','SPICe+ Confirmation','Step 11 · 16 Oct'],['up','SPICe+ Filing','Step 12 · 20 Oct'],['up','MCA Remarks','Step 13 · 24 Oct'],['up','Certificate of Incorporation','Step 14 · 28 Oct']];
```

### 4.10 Intro animation — `outer-shell.html` (base64 payloads elided as `…`)

```html
<style>
html,body{margin:0;height:100%;background:#fff;overflow:hidden}
#stage{position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:transparent}
@font-face{font-family:'Poppins';font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,…) format('woff2')}
@font-face{font-family:'Poppins';font-style:normal;font-weight:700;font-display:block;src:url(data:font/woff2;base64,…) format('woff2')}
/* intro: the three-card reveal into "VCFO Suite by SBC" (from the owner's artifact), light stage, plays once per page load */
#vi{--stage:#fff;--ink:#000;--yellow:#FFC517;--orange:#F08A21;--deep:#E76028;position:fixed;inset:0;z-index:5;display:grid;place-items:center;background:var(--stage);transition:opacity .55s ease;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));box-sizing:border-box;overflow:hidden}
#vi.out{opacity:0;pointer-events:none}
#vi svg{display:block;max-width:100%;max-height:100%}
#vi.wide svg{width:min(92vw,max(62vw,560px),1500px);height:min(70vh,560px)}
#vi.square svg{width:min(92vw,640px);height:min(78vh,560px)}
#vi-skip{position:absolute;top:max(16px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right));min-height:44px;min-width:72px;padding:0 20px;border:0;border-radius:999px;background:#EDEBE7;color:#17140F;font:700 14px/1 Poppins,system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;transition:background .15s ease,opacity .3s ease}
#vi-skip:hover{background:#E2DFD9}
#vi-skip:focus-visible{outline:3px solid #F08A21;outline-offset:2px}
#vi.end #vi-skip{opacity:0;pointer-events:none}
@media (prefers-reduced-motion: reduce){#vi{transition-duration:.3s}}
</style>
</head>
<body>
<div id="vi" class="wide">
  <svg id="vi-svg" viewBox="72 50 1000 400" role="img" aria-labelledby="vi-t vi-d">
    <title id="vi-t">VCFO Suite by SBC</title>
    <desc id="vi-d">Three sloped cards for Incorporation, Registrations and Compliances come together into one stack. A V appears on the front card, then the VCFO Suite by SBC name.</desc>
    <defs>
      <clipPath id="vi-wordClip"><rect id="vi-wordClipRect" x="0" y="0" width="0" height="1000"></rect></clipPath>
      <clipPath id="vi-vClip"><rect id="vi-vClipRect" x="0" y="0" width="0" height="0"></rect></clipPath>
    </defs>
    <g id="vi-stack">
      <g id="vi-card0" opacity="0"><polygon class="shape" style="fill:var(--yellow)"></polygon><text class="cname" text-anchor="middle" font-family="Poppins, Segoe UI, sans-serif" font-weight="600" fill="#3D2A00">Incorporation</text></g>
      <g id="vi-card1" opacity="0"><polygon class="shape" style="fill:var(--orange)"></polygon><text class="cname" text-anchor="middle" font-family="Poppins, Segoe UI, sans-serif" font-weight="600" fill="#FFFFFF">Registrations</text></g>
      <g id="vi-card2" opacity="0"><polygon class="shape" style="fill:var(--deep)"></polygon><text class="cname" text-anchor="middle" font-family="Poppins, Segoe UI, sans-serif" font-weight="600" fill="#FFFFFF">Compliances</text>
        <g clip-path="url(#vi-vClip)"><text id="vi-vee" text-anchor="middle" font-family="Poppins, Segoe UI, sans-serif" font-weight="700" fill="#FFFFFF">V</text></g>
      </g>
    </g>
    <g id="vi-word" clip-path="url(#vi-wordClip)">
      <text id="vi-wordText" font-family="Poppins, Segoe UI, sans-serif" font-size="100" letter-spacing="-2"><tspan font-weight="700" style="fill:var(--ink)">VCFO</tspan><tspan font-weight="400" style="fill:var(--deep)"> Suite</tspan></text>
    </g>
    <g id="vi-byline" opacity="0">
      <text id="vi-byText" font-family="Poppins, Segoe UI, sans-serif" font-size="18" font-weight="700" letter-spacing="3.5" style="fill:var(--ink)">BY</text>
      <image id="vi-sbc" href="data:…(stripped)" width="72" height="21.2"></image>
    </g>
  </svg>
  <button id="vi-skip" type="button" aria-label="Skip intro">Skip</button>
</div>
<iframe id="stage" title="VCFO Suite client portal prototype" referrerpolicy="no-referrer"></iframe>
```

```js
<script>
// Intro: the owner's three-card reveal ("A · Build up", from the VCFO three-card reveal artifact), played once per page load.
// The app keeps loading in the iframe underneath; the intro fades out when it has ended AND the first screen has loaded.
(function () {
  var I = document.getElementById('vi'), stageEl = document.getElementById('stage');
  var S = window.__vcfoIntro = { ready: function () {} };
  var off = false;
  try { off = localStorage.getItem('vcfo.skipIntro') === '1'; } catch (e) {}
  if (off || !I) { if (I) I.parentNode.removeChild(I); return; }
  if (stageEl) { stageEl.setAttribute('inert', ''); stageEl.setAttribute('aria-hidden', 'true'); }

  var DUR = 7.0, END = 6.4;   // the artifact's 7 s timeline; the fade starts at 6.4 s so the app is showing by ~7 s
  // Card shape from the sketch (units): each card is 215 wide, the next one 37 right and 62 taller.
  var W = 215, DX = 37, DH = 62, LH = 75, RISE = 135, FULL = LH + RISE + 2 * DH;
  var MARK_H = 220, K = MARK_H / FULL, MARK_W = (W + 2 * DX) * K, NAME_FS = 15;
  var $ = function (id) { return document.getElementById('vi-' + id); };
  var svg = $('svg'), stack = $('stack'), skipBtn = $('skip');
  var cards = [0, 1, 2].map(function (i) { return $('card' + i); });
  var names = [].slice.call(I.querySelectorAll('.cname'));
  var vClipRect = $('vClipRect'), wordClipRect = $('wordClipRect'), wordText = $('wordText');
  var byline = $('byline'), byText = $('byText'), sbc = $('sbc');

  var GEO = [0, 1, 2].map(function (i) {
    var n = 2 - i, x0 = DX * n * K, lh = (LH + DH * n) * K, rh = (LH + RISE + DH * n) * K, w = W * K;
    return { x0: x0, w: w, lh: lh, rh: rh, cx: x0 + w / 2 };
  });
  GEO.forEach(function (g, i) {
    cards[i].querySelector('.shape').setAttribute('points',
      g.x0 + ',0 ' + g.x0 + ',' + (-g.lh) + ' ' + (g.x0 + g.w) + ',' + (-g.rh) + ' ' + (g.x0 + g.w) + ',0');
    var t = names[i];
    t.setAttribute('x', g.cx); t.setAttribute('y', (-Math.min(g.lh, 60) * 0.55).toFixed(1)); t.setAttribute('font-size', NAME_FS);
  });
  var F = GEO[2], vee = $('vee');
  var vx = F.x0 + F.w * 0.52, vbase = -22 * K, vsize = 115 * K;
  vee.setAttribute('x', vx); vee.setAttribute('y', vbase); vee.setAttribute('font-size', vsize);
  vClipRect.setAttribute('x', vx - vsize); vClipRect.setAttribute('width', vsize * 2);

  // wide = the artifact's wide format (landscape screens); square = its square format (portrait screens).
  // vb trims the empty margin of the artifact's frame; s1 = the most the cards may be enlarged at the start (still inside vb).
  var LAYOUTS = {
    wide:   { vb: [72, 50, 1000, 400], cx: 600, cy: 250, fs: 0.72, fo: [220, 340], wx: 371, wy: 287, by: 327, anchor: 'start', s1: 1.55 },
    square: { vb: [40, 160, 720, 540], cx: 400, cy: 400, fs: 0.9, fo: [400 - MARK_W * 0.45, 440], wx: 400, wy: 570, by: 616, anchor: 'middle', s1: 1.8 }
  };
  var L = null, s0 = 1, cur = 0;

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeBack(x) { var c1 = 1.4, c3 = c1 + 1; return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function lerp(a, b, p) { return a + (b - a) * p; }

  function renderAt(t) {
    cur = t;
    // on small screens the cards start larger so their names stay readable (>= 11.5 px), then settle into the logo
    var gx = L.cx - MARK_W * s0 / 2, gy = L.cy + MARK_H * s0 / 2;
    var mv = easeInOut(seg(t, 3.7, 4.5));
    var sc = lerp(s0, L.fs, mv);
    var ox = lerp(gx, L.fo[0], mv), oy = lerp(gy, L.fo[1], mv);
    var pulse = 1 + Math.sin(Math.PI * seg(t, 3.15, 3.6)) * 0.04;
    stack.setAttribute('transform', 'translate(' + ox.toFixed(2) + ' ' + oy.toFixed(2) + ') scale(' + (sc * pulse).toFixed(4) + ')');
    // A · Build up: each card grows up from the baseline like a rising bar, one stage after another
    var arr = [];
    for (var i = 0; i < 3; i++) {
      var a = 0.35 + i * 0.7, p = seg(t, a, a + 0.75);
      cards[i].setAttribute('transform', 'scale(1 ' + Math.max(0.001, easeBack(p)).toFixed(4) + ')');
      cards[i].setAttribute('opacity', clamp(p * 8).toFixed(3));
      arr.push(easeOut(p));
    }
    var nameFade = 1 - seg(t, 2.85, 3.1);
    for (var j = 0; j < 3; j++) {
      var shown = clamp(seg(t, 0.35 + j * 0.5, 0.75 + j * 0.5) * 3);
      var covered = j < 2 ? arr[j + 1] : 0;
      names[j].setAttribute('opacity', (nameFade * (1 - covered) * Math.min(1, shown)).toFixed(3));
    }
    var vp = easeOut(seg(t, 3.05, 3.5));
    vClipRect.setAttribute('y', (vbase - vsize).toFixed(2)); vClipRect.setAttribute('height', (vsize * 1.1 * vp).toFixed(2));
    var wp = easeInOut(seg(t, 4.1, 5.0)), ww = 640 * wp;
    wordClipRect.setAttribute('x', L.anchor === 'middle' ? (L.wx - ww / 2).toFixed(2) : L.wx - 10);
    wordClipRect.setAttribute('width', (wp > 0 ? ww + 20 : 0).toFixed(2));
    var bp = easeOut(seg(t, 4.8, 5.4));
    byline.setAttribute('opacity', bp.toFixed(3));
    byline.setAttribute('transform', 'translate(0 ' + ((1 - bp) * 8).toFixed(2) + ')');
  }

  function setLayout() {
    var name = innerWidth / Math.max(1, innerHeight) < 1.05 ? 'square' : 'wide';
    if (!L || L !== LAYOUTS[name]) {
      L = LAYOUTS[name];
      I.classList.remove('wide', 'square'); I.classList.add(name);
      svg.setAttribute('viewBox', L.vb.join(' '));
      wordText.setAttribute('x', L.wx); wordText.setAttribute('y', L.wy); wordText.setAttribute('text-anchor', L.anchor);
      var bx = L.anchor === 'middle' ? L.wx - 57 : L.wx + 6;
      byText.setAttribute('x', bx); byText.setAttribute('y', L.by);
      sbc.setAttribute('x', bx + 36); sbc.setAttribute('y', (L.by - 0.707 * 21.2).toFixed(2));
    }
    var r = svg.getBoundingClientRect();
    var ppu = Math.min(r.width / L.vb[2], r.height / L.vb[3]) || 1;   // CSS px per SVG unit
    s0 = Math.max(1, Math.min(L.s1, 11.5 / (NAME_FS * ppu)));
    renderAt(cur);
  }

  var appReady = false, ended = false, gone = false, raf = 0, last = -1, t = 0;
  function fadeOut() {
    if (gone) return; gone = true;
    if (raf) cancelAnimationFrame(raf);
    var hadFocus = I.contains(document.activeElement);
    if (stageEl) { stageEl.removeAttribute('inert'); stageEl.removeAttribute('aria-hidden'); }
    I.classList.add('out');
    var done = false;
    function remove() {
      if (done) return; done = true;
      removeEventListener('resize', setLayout); document.removeEventListener('keydown', onKey);
      if (I.parentNode) I.parentNode.removeChild(I);
      if (hadFocus && stageEl) { try { stageEl.focus(); } catch (e) {} }
    }
    I.addEventListener('transitionend', remove);
    setTimeout(remove, 800);
  }
  function maybeLeave() { if (ended && appReady) fadeOut(); }
  // show the finished logo; leave as soon as the first screen is ready (it almost always is by now)
  function finish() {
    if (ended) return; ended = true;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    renderAt(DUR);
    I.classList.add('end');
    maybeLeave();
    setTimeout(function () { appReady = true; maybeLeave(); }, 12000);   // never trap the user behind the intro
  }
  // frame clock: advances by real time but at most 50 ms per frame, so a busy main thread (the app loading underneath)
  // pauses the reveal instead of making it jump
  function tick(now) {
    if (last >= 0) t += Math.min(50, Math.max(0, now - last)) / 1000;
    last = now;
    if (t >= END) { finish(); return; }
    renderAt(t);
    raf = requestAnimationFrame(tick);
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); finish(); } }

  S.time = function () { return ended ? DUR : t; };   // for tests
  S.ready = function () { if (appReady) return; appReady = true; setTimeout(maybeLeave, 150); };
  skipBtn.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  addEventListener('resize', setLayout);
  setLayout();

  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduce) {
    // reduced motion: the finished logo, still, for about a second, then a short fade
    renderAt(DUR);
    setTimeout(finish, 1000);
  } else {
    renderAt(0);
    try { if (document.fonts && document.fonts.load) { document.fonts.load('700 20px Poppins'); document.fonts.load('400 20px Poppins'); } } catch (e) {}
    raf = requestAnimationFrame(tick);
```

### 4.11 Timeline editor — `tl-editor.js` (full, verbatim)

```js
/* Timeline editor (Home card 5): drag / resize phases with day snap, cascade to later phases,
   before/after comparison, undo, manager save or client change request. Mouse, touch and keyboard. */
(function () {
  if (window.vcfoTimeline) return;
  var DAY = 864e5, T0 = Date.UTC(2026, 8, 12), SPAN = 57;            // axis 12 Sep → 8 Nov 2026 (matches the card)
  var TODAY = Date.UTC(2026, 9, 6);
  var W0 = -42, W1 = 110;                                              // zoomable world: 1 Aug → 31 Dec 2026 (days from 12 Sep)
  var ZMAX = 48, zoom = null;                                          // px per day; null = fit 12 Sep → 8 Nov
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function d2s(n) { var d = new Date(T0 + n * DAY); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function day(dd, mm) { return Math.round((Date.UTC(2026, mm - 1, dd) - T0) / DAY); }
  var BASE = [
    { id: 'a', name: 'Phase 1 · Name Application', s: day(12, 9), e: day(24, 9), done: true, color: 'var(--ok,#1f9d7a)' },
    { id: 'b', name: 'Phase 2 · Incorporation', s: day(25, 9), e: day(20, 10), color: 'var(--navy-3,#1b4f94)' },
    { id: 'm', name: 'MCA review', s: day(20, 10), e: day(28, 10), color: 'oklch(70% .03 255)' },
    { id: 'c', name: 'COI', s: day(28, 10), e: day(28, 10), ms: true, color: 'var(--gold,#c9a24b)' }
  ];
  var store = {
    get: function (k, d) { try { var v = sessionStorage.getItem('vcfo.tl.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { sessionStorage.setItem('vcfo.tl.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function clone(a) { return JSON.parse(JSON.stringify(a)); }
  function saved() { return store.get('saved', clone(BASE)); }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function toast(m, u, cb) { if (window.vcfoToast) window.vcfoToast(m, u, cb); }

  var css = document.createElement('style');
  css.textContent = [
    '#tle-scrim{position:fixed;inset:0;z-index:2147483100;background:rgba(8,20,40,.5);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .18s}',
    '#tle-scrim.on{opacity:1}',
    '#tle{width:min(1080px,100%);max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);overflow:auto;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:12px;box-shadow:0 30px 80px -20px rgba(8,20,40,.6);font:500 13px/1.45 Manrope,system-ui,sans-serif;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));transform:translateY(10px) scale(.98);transition:transform .26s cubic-bezier(.22,1,.36,1)}',
    '#tle-scrim.on #tle{transform:none}',
    '#tle .h{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));flex-wrap:wrap}',
    '#tle .h h2{margin:0;font:800 17px Manrope;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4))}',
    '#tle .seg{position:relative;display:inline-flex;padding:2px;border-radius:8px;background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));box-shadow:inset 0 0 0 1px #e3e8ef}',
    '#tle .seg button{position:relative;z-index:1;border:0;background:none;height:30px;padding:0 12px;border-radius:6px;font:600 12px Manrope;color:#5a6b82;cursor:pointer}',
    '#tle .seg button[aria-pressed=true]{background:#0f2a4a;color:#fff}',
    '#tle .x{margin-left:auto;width:36px;height:36px;border-radius:6px;border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#fff, oklch(13% 0 89.9));cursor:pointer;font-size:18px;color:#5a6b82}',
    '#tle .tools{display:flex;align-items:center;gap:8px;padding:12px 18px;flex-wrap:wrap}',
    '#tle .btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:6px;border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));background:light-dark(#fff, oklch(13% 0 89.9));font:700 13px Manrope;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3));cursor:pointer}',
    '#tle .btn:disabled{opacity:.45;cursor:default}',
    '#tle .btn.n{background:#0f2a4a;color:#fff;border-color:#0f2a4a}',
    '#tle .hint{color:#5a6b82;font-size:12px}',
    '#tle .grid{position:relative;margin:4px 18px 0;user-select:none;-webkit-user-select:none;display:grid;grid-template-columns:170px minmax(0,1fr) 150px}',
    '#tle .col-n>div,#tle .col-d>div{height:52px;display:flex;align-items:center;border-top:1px solid light-dark(#eef1f5, oklch(23.7% 0.006 255.5))}',
    '#tle .col-n>.sp,#tle .col-d>.sp{height:44px;border-top:0}',
    '#tle .col-n .n{font:700 12.5px Manrope;gap:6px}',
    '#tle .col-d .d{display:block;font:600 11.5px "IBM Plex Mono",monospace;color:light-dark(#46546b, oklch(82.3% 0.029 260.2));text-align:right;padding:9px 0 0 10px}',
    '#tle .vp{position:relative;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x;cursor:grab;border-radius:6px;box-shadow:inset 1px 0 0 #eef1f5,inset -1px 0 0 #eef1f5}',
    '#tle .vp::-webkit-scrollbar{display:none}',
    '#tle .vp.pan{cursor:grabbing}',
    '#tle .world{position:relative}',
    '#tle .ruler{position:relative;height:44px;border-bottom:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7))}',
    '#tle .ruler .mo{position:absolute;top:4px;font:800 11px Manrope;color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4));white-space:nowrap;padding-left:6px;border-left:1px solid light-dark(#cdd5e0, oklch(27.2% 0.012 256.3));height:16px;line-height:16px}',
    '#tle .ruler .tk{position:absolute;bottom:4px;transform:translateX(-50%);font:600 11px "IBM Plex Mono",monospace;color:#7a889c;white-space:nowrap}',
    '#tle .ruler .tk.we{color:#b3bdca}',
    '#tle .ruler .tk:before{content:"";position:absolute;left:50%;top:-6px;width:1px;height:4px;background:light-dark(#cdd5e0, oklch(33.9% 0.018 256.3))}',
    '#tle .lanes .lane{border-top:1px solid light-dark(#eef1f5, oklch(23.7% 0.006 255.5))}',
    '#tle .row .d b{display:block;font:800 11px Manrope;color:light-dark(#0f1b2d, oklch(91.2% 0.028 258.3))}',
    '#tle .row .d .chg{font:800 11px Manrope;padding:1px 5px;border-radius:4px}',
    '#tle .lane{position:relative;height:52px}',
    '#tle .zoom{display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding:3px;border-radius:8px;background:light-dark(#f1f4f8, oklch(18.1% 0.006 255.5));box-shadow:inset 0 0 0 1px #e3e8ef}',
    '#tle .zoom button{width:30px;height:30px;border:0;border-radius:6px;background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#0f2a4a, oklch(88.7% 0.047 254.4));font:800 16px/1 Manrope;cursor:pointer;box-shadow:0 1px 2px rgba(15,42,74,.12)}',
    '#tle .zoom button.fit{width:auto;padding:0 10px;font-size:12px}',
    '#tle .zoom input{width:120px;accent-color:#0f2a4a}',
    '#tle .zoom .lv{min-width:52px;text-align:center;font:700 11.5px Manrope;color:light-dark(#46546b, oklch(82.3% 0.029 260.2))}',
    '#tle .ghost{position:absolute;top:13px;height:26px;border-radius:5px;border:1.5px dashed #9aa8bb;background:transparent;pointer-events:none}',
    '#tle .bar{position:absolute;top:13px;height:26px;border-radius:5px;cursor:grab;touch-action:none;box-shadow:0 2px 6px -2px rgba(8,20,40,.35);outline:none;transition:left .18s,width .18s}',
    '#tle .bar.drag{cursor:grabbing;transition:none;box-shadow:0 0 0 3px rgba(201,162,75,.55),0 8px 18px -6px rgba(8,20,40,.45)}',
    '#tle .bar:focus-visible{box-shadow:0 0 0 3px rgba(84,112,255,.5)}',
    '#tle .bar.lock{cursor:not-allowed;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.25) 0 6px,transparent 6px 12px)}',
    '#tle .bar .hd{position:absolute;top:0;bottom:0;width:12px;cursor:ew-resize;touch-action:none}',
    '#tle .bar .hd:after{content:"";position:absolute;top:6px;bottom:6px;left:5px;width:2px;border-radius:1px;background:light-dark(rgba(255,255,255,.85), oklch(13% 0 89.9 / 0.85))}',
    '#tle .bar .hd.l{left:-2px}#tle .bar .hd.r{right:-2px}',
    '#tle .bar.ms{width:18px!important;margin-left:-9px;border-radius:3px;transform:rotate(45deg) scale(.78)}',
    '#tle .bar.ms .hd{display:none}',
    '#tle .read{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#0f2a4a;color:#fff;font:700 11.5px Manrope;padding:4px 8px;border-radius:6px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s}',
    '#tle .bar.drag .read,#tle .bar:hover .read,#tle .bar:focus .read{opacity:1}',
    '#tle .bar.ms .read{transform:translateX(-50%) rotate(-45deg)}',
    '#tle .today{position:absolute;top:44px;bottom:0;width:2px;margin-left:-1px;background:#d64545;pointer-events:none;z-index:2}',
    '#tle .today:after{content:"Today 6 Oct";position:absolute;top:3px;left:4px;font:800 11px Manrope;color:#fff;background:#d64545;padding:1px 6px;border-radius:4px;white-space:nowrap}',
    '#tle .sum{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 18px 0;padding:12px 14px;border-radius:8px;background:light-dark(#f5f7fa, oklch(16.7% 0.005 258.3))}',
    '#tle .sum .big{font:800 15px Manrope}',
    '#tle .sum .pill{font:800 12px Manrope;padding:3px 8px;border-radius:5px}',
    '#tle .late{background:light-dark(#fde8e6, oklch(25.2% 0.066 24.1));color:#b42318}#tle .early{background:light-dark(#e3f6ee, oklch(24.6% 0.064 168.7));color:#0f7a55}#tle .same{background:light-dark(#eef1f5, oklch(19.4% 0.006 255.5));color:light-dark(#46546b, oklch(82.3% 0.029 260.2))}',
    '#tle .cmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 18px 0}',
    '#tle .cmp>div{border:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));border-radius:8px;padding:10px 12px}',
    '#tle .cmp h4{margin:0 0 6px;font:800 11px Manrope;letter-spacing:.07em;text-transform:uppercase;color:#7a889c}',
    '#tle .cmp li{list-style:none;display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:12.5px}',
    '#tle .cmp ul{margin:0;padding:0}',
    '#tle .client{margin:12px 18px 0}',
    '#tle .client label{display:block;font:700 12px Manrope;margin-bottom:6px}',
    '#tle .client textarea{width:100%;min-height:70px;box-sizing:border-box;border:1px solid light-dark(#d6dde7, oklch(26.2% 0.012 257.2));border-radius:8px;padding:10px 12px;font:500 13px Manrope;resize:vertical}',
    '#tle .client .err{color:#b42318;font-size:12px;margin-top:4px;display:none}',
    '#tle .f{display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:16px 18px;border-top:1px solid light-dark(#e3e8ef, oklch(24.8% 0.011 256.7));margin-top:16px;flex-wrap:wrap}',
    '#tle .f .warn{margin-right:auto;font-size:12px;color:light-dark(#46546b, oklch(82.3% 0.029 260.2));display:flex;align-items:center;gap:6px}',
    '.tle-pend{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:4px;background:light-dark(#fdecd3, oklch(25% 0.101 77.6));color:light-dark(#8a4b0f, oklch(80.8% 0.076 57.3));font:800 11px Manrope,sans-serif;border:0;cursor:pointer}',
    '@media (max-width:1023px){#tle .grid{grid-template-columns:140px minmax(0,1fr) 120px}}',
    '@media (max-width:767px){#tle .grid{grid-template-columns:96px minmax(0,1fr);margin:4px 12px 0}#tle .col-d{display:none}#tle .col-n .n{font-size:12px;line-height:1.25}#tle .h,#tle .tools,#tle .f{padding-left:12px;padding-right:12px}#tle .sum,#tle .cmp,#tle .client{margin-left:12px;margin-right:12px}#tle .zoom{margin-left:0;flex-wrap:wrap}#tle .zoom input{width:80px}#tle .cmp{grid-template-columns:1fr}#tle-scrim{padding:0;align-items:flex-end}#tle{max-width:100vw;border-radius:14px 14px 0 0;max-height:92dvh}#tle .btn{height:40px}#tle .x{width:40px;height:40px}#tle .zoom button{width:36px;height:36px}#tle .seg button{height:36px;padding:0 10px}#tle .h{row-gap:10px}#tle .h h2{flex:1}#tle .h .seg{order:3;flex:1 1 100%;flex-wrap:wrap;margin:0!important}#tle .h .seg button{flex:1 1 auto}#tle .hint{flex-basis:100%}}',
    '@media (prefers-reduced-motion: reduce){#tle,#tle-scrim,#tle .bar{transition:none}}'
  ].join('\n');
  document.head.appendChild(css);

  var st;   // { mode, ph, hist, base }
  function open(opts) {
    opts = opts || {};
    var base = saved();
    st = { mode: opts.mode || store.get('mode', 'manager'), ph: clone(base), base: clone(base), hist: [] };
    var scrim = document.createElement('div'); scrim.id = 'tle-scrim';
    scrim.innerHTML = '<div id="tle" role="dialog" aria-modal="true" aria-labelledby="tle-t">' +
      '<div class="h"><h2 id="tle-t">Edit timeline</h2><span class="seg" role="group" aria-label="Who is editing"><button type="button" data-mode="manager">Manager · direct edit</button><button type="button" data-mode="client">Client · change request</button></span><button type="button" class="x" aria-label="Close editor">×</button></div>' +
      '<div class="tools"><button type="button" class="btn" data-act="undo" aria-label="Undo last change">↶ Undo</button><button type="button" class="btn" data-act="reset">Reset</button><span class="hint" id="tle-hint"></span><span class="zoom" role="group" aria-label="Zoom the timeline"><button type="button" data-act="zout" aria-label="Zoom out">−</button><input type="range" id="tle-z" min="0" max="1000" aria-label="Zoom level"><button type="button" data-act="zin" aria-label="Zoom in">+</button><span class="lv" id="tle-lv"></span><button type="button" class="fit" data-act="fit">Fit</button></span></div>' +
      '<div class="grid" id="tle-grid"></div>' +
      '<div class="sum" id="tle-sum"></div>' +
      '<div class="cmp" id="tle-cmp"></div>' +
      '<div class="client" id="tle-client"><label for="tle-reason">Why do you need this change?</label><textarea id="tle-reason" placeholder="For example: our director is travelling until 14 Oct, so the KYC video call has to move."></textarea><div class="err" id="tle-err">Add a short reason so Northwind’s project manager can approve it.</div></div>' +
      '<div class="f"><span class="warn" id="tle-warn"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn n" data-act="save" id="tle-save">Save timeline</button></div></div>';
    document.body.appendChild(scrim);
    requestAnimationFrame(function () { scrim.classList.add('on'); });
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim) return close();
      var m = e.target.closest('[data-mode]'); if (m) { st.mode = m.getAttribute('data-mode'); store.set('mode', st.mode); paintMode(); return; }
      if (e.target.closest('.x')) return close();
      var a = e.target.closest('[data-act]'); if (!a) return;
      var k = a.getAttribute('data-act');
      if (k === 'undo') undo(); else if (k === 'reset') { push(); st.ph = clone(st.base); paint(); toast('Reset to the saved timeline'); }
      else if (k === 'cancel') close(); else if (k === 'save') commit();
      else if (k === 'zin') zoomTo(ppd * 1.5); else if (k === 'zout') zoomTo(ppd / 1.5); else if (k === 'fit') { zoomTo(fitPpd(), null, T0d()); }
    });
    document.addEventListener('keydown', esc, true);
    buildGrid(); paint(); paintMode(); wireZoom();
    setTimeout(function () { var f = scrim.querySelector('.bar:not(.lock)'); f && f.focus({ preventScroll: true }); }, 60);
  }
  function esc(e) { if (e.key === 'Escape' && document.getElementById('tle-scrim')) { e.stopPropagation(); close(); } }
  function close() {
    var s = document.getElementById('tle-scrim'); if (!s) return;
    document.removeEventListener('keydown', esc, true);
    s.classList.remove('on'); setTimeout(function () { s.remove(); }, reduce ? 0 : 180);
  }
  function push() { st.hist.push(clone(st.ph)); if (st.hist.length > 60) st.hist.shift(); }
  function undo() { if (!st.hist.length) return toast('Nothing to undo'); st.ph = st.hist.pop(); paint(); }
  function pct(n) { return (n / SPAN * 100) + '%'; }               // dashboard card (fixed 12 Sep → 8 Nov axis)
  var ppd = 12;                                                      // editor: px per day
  function X(n) { return (n - W0) * ppd; }
  function vpW() { var v = document.querySelector('#tle .vp'); return v ? v.clientWidth : 700; }
  function fitPpd() { return Math.max(minPpd(), Math.min(ZMAX, vpW() / SPAN)); }
  function minPpd() { return vpW() / (W1 - W0); }
  function T0d() { return 0; }
  function snap() { return ppd < 8 ? 7 : 1; }
  function level() { return ppd >= 22 ? 'Days' : ppd >= 8 ? 'Weeks' : 'Months'; }
  function dow(n) { return new Date(T0 + n * DAY).getUTCDay(); }

  function buildGrid() {
    var g = document.getElementById('tle-grid');
    var names = '<div class="col-n"><div class="sp"></div>', lanes = '', dates = '<div class="col-d"><div class="sp"></div>';
    st.ph.forEach(function (p, i) {
      names += '<div class="row" data-i="' + i + '"><span class="n">' + (p.done ? '<span aria-label="Done · locked">🔒</span>' : '') + p.name + '</span></div>';
      lanes += '<div class="lane row" data-i="' + i + '"><span class="ghost"></span>' +
        '<span class="bar' + (p.done ? ' lock' : '') + (p.ms ? ' ms' : '') + '" role="slider" tabindex="0" aria-label="' + p.name + '" style="background:' + p.color + '">' +
        '<span class="hd l" data-h="l" aria-hidden="true"></span><span class="hd r" data-h="r" aria-hidden="true"></span><span class="read"></span></span></div>';
      dates += '<div class="row" data-i="' + i + '"><span class="d"></span></div>';
    });
    g.innerHTML = names + '</div><div class="vp" id="tle-vp"><div class="world" id="tle-world"><div class="ruler" id="tle-ruler"></div><div class="lanes">' + lanes + '</div><span class="today"></span></div></div>' + dates + '</div>';
    [].forEach.call(g.querySelectorAll('.bar'), function (b) {
      var i = +b.closest('.row').getAttribute('data-i');
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); startDrag(e, i, b); });
      b.addEventListener('keydown', function (e) { key(e, i); });
    });
    ppd = zoom || fitPpd(); layout(); document.getElementById('tle-vp').scrollLeft = X(0) - 4;
  }
  /* ruler, grid lines, today line: everything rescales with ppd */
  function layout() {
    var w = (W1 - W0) * ppd, world = document.getElementById('tle-world'); if (!world) return;
    world.style.width = w + 'px';
    var r = '', lv = level();
    for (var n = W0; n <= W1; n++) {
      var d = new Date(T0 + n * DAY), x = X(n);
      if (d.getUTCDate() === 1 || n === W0) r += '<span class="mo" style="left:' + x + 'px">' + MON[d.getUTCMonth()] + ' 2026</span>';
      if (lv === 'Days') r += '<span class="tk' + (d.getUTCDay() % 6 === 0 ? ' we' : '') + '" style="left:' + (x + ppd / 2) + 'px">' + (ppd >= 34 ? DOW[d.getUTCDay()].slice(0, 2) + ' ' : '') + d.getUTCDate() + '</span>';
      else if (lv === 'Weeks' && d.getUTCDay() === 1) r += '<span class="tk" style="left:' + x + 'px">' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + '</span>';
      else if (lv === 'Months' && d.getUTCDay() === 1 && ppd * 7 >= 30) r += '<span class="tk we" style="left:' + x + 'px">' + d.getUTCDate() + '</span>';
    }
    document.getElementById('tle-ruler').innerHTML = r;
    var off = ((-W0) % 7 + 7) % 7, line = lv === 'Months' ? ppd * 7 : ppd;      // grid: day lines, or week lines when zoomed out
    var startShift = lv === 'Months' ? (((1 - dow(W0)) + 7) % 7) * ppd : 0;
    [].forEach.call(document.querySelectorAll('#tle .lanes .lane'), function (l) { l.style.backgroundImage = 'repeating-linear-gradient(to right,transparent 0,transparent ' + (line - 1) + 'px,#eef1f5 ' + (line - 1) + 'px,#eef1f5 ' + line + 'px)'; l.style.backgroundPosition = startShift + 'px 0'; });
    document.querySelector('#tle .today').style.left = X((TODAY - T0) / DAY) + 'px';
    var z = document.getElementById('tle-z'); if (z) z.value = Math.round(Math.log(ppd / minPpd()) / Math.log(ZMAX / minPpd()) * 1000);
    var lvEl = document.getElementById('tle-lv'); if (lvEl) lvEl.textContent = lv;
    var hint = document.getElementById('tle-hint'); if (hint) hint.textContent = 'Drag a bar to move it · drag its edges to change dates · snaps to ' + (snap() === 7 ? 'weeks' : 'days') + ' · ctrl + scroll or pinch to zoom';
    var zi = document.querySelector('#tle [data-act=zin]'), zo = document.querySelector('#tle [data-act=zout]');
    if (zi) zi.disabled = ppd >= ZMAX - .01; if (zo) zo.disabled = ppd <= minPpd() + .01;
    if (st) paint();
  }
  /* zoom keeping the date under the anchor (cursor or centre) still */
  function zoomTo(np, anchorPx, anchorDay) {
    var vp = document.getElementById('tle-vp'); if (!vp) return;
    np = Math.max(minPpd(), Math.min(ZMAX, np));
    var ax = anchorPx == null ? vp.clientWidth / 2 : anchorPx;
    var dayAt = anchorDay != null ? anchorDay : (vp.scrollLeft + ax) / ppd + W0;
    ppd = np; zoom = np; layout();
    vp.scrollLeft = anchorDay != null ? X(anchorDay) - 4 : (dayAt - W0) * ppd - ax;
  }
  function wireZoom() {
    var vp = document.getElementById('tle-vp'), z = document.getElementById('tle-z');
    z.addEventListener('input', function () { var np = minPpd() * Math.pow(ZMAX / minPpd(), z.value / 1000); zoomTo(np); });
    vp.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); var r = vp.getBoundingClientRect(); zoomTo(ppd * Math.exp(-e.deltaY * 0.01), e.clientX - r.left); }
      else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && ppd > fitPpd() + .5) { e.preventDefault(); vp.scrollLeft += e.deltaY; }
    }, { passive: false });
    /* pan with a mouse drag on empty lane space; pinch with two fingers */
    var pts = {}, pinch = null, pan = null;
    vp.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = e.clientX; var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]], r = vp.getBoundingClientRect(); pinch = { d: Math.abs(a - b) || 1, p: ppd, mid: (a + b) / 2 - r.left }; pan = null; return; }
      if (e.pointerType === 'mouse' && e.button === 0) { pan = { x: e.clientX, s: vp.scrollLeft }; vp.classList.add('pan'); vp.setPointerCapture && vp.setPointerCapture(e.pointerId); }
    });
    vp.addEventListener('pointermove', function (e) {
      if (pts[e.pointerId] != null) pts[e.pointerId] = e.clientX;
      var ids = Object.keys(pts);
      if (pinch && ids.length === 2) { var d = Math.abs(pts[ids[0]] - pts[ids[1]]) || 1; zoomTo(pinch.p * d / pinch.d, pinch.mid); return; }
      if (pan) vp.scrollLeft = pan.s - (e.clientX - pan.x);
    });
    function end(e) { delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (pan) { pan = null; vp.classList.remove('pan'); } }
    vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end); vp.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse') end(e); });
    addEventListener('resize', function () { if (document.getElementById('tle-vp')) { if (!zoom) ppd = fitPpd(); layout(); } });
  }
  function paint() {
    var lanes = document.querySelectorAll('#tle .lanes .lane'), ds = document.querySelectorAll('#tle .col-d .row');
    st.ph.forEach(function (p, i) {
      var r = lanes[i], b0 = st.base[i];
      var bar = r.querySelector('.bar'), gh = r.querySelector('.ghost');
      bar.style.left = X(p.s) + 'px'; bar.style.width = p.ms ? '' : Math.max(1, p.e - p.s) * ppd + 'px';
      gh.style.left = X(b0.s) + 'px'; gh.style.width = b0.ms ? '18px' : Math.max(1, b0.e - b0.s) * ppd + 'px';
      gh.style.display = (b0.s !== p.s || b0.e !== p.e) ? '' : 'none'; if (b0.ms) gh.style.marginLeft = '-9px';
      bar.querySelector('.read').textContent = p.ms ? d2s(p.s) : d2s(p.s) + ' – ' + d2s(p.e) + ' · ' + (p.e - p.s) + ' days';
      bar.setAttribute('aria-valuetext', bar.querySelector('.read').textContent);
      var dd = p.e - b0.e, chg = dd ? '<span class="chg ' + (dd > 0 ? 'late' : 'early') + '">' + (dd > 0 ? '+' : '') + dd + ' d</span>' : '';
      ds[i].querySelector('.d').innerHTML = '<b>' + (p.ms ? d2s(p.s) : d2s(p.s) + ' – ' + d2s(p.e)) + '</b>' + chg;
    });
    var coi = st.ph[3].s, coi0 = st.base[3].s, slip = coi - coi0;
    var cls = slip > 0 ? 'late' : slip < 0 ? 'early' : 'same';
    var msg = slip > 0 ? 'Slipped by ' + slip + ' day' + (slip > 1 ? 's' : '') : slip < 0 ? 'Pulled in by ' + (-slip) + ' day' + (slip < -1 ? 's' : '') : 'No change to the COI date';
    document.getElementById('tle-sum').innerHTML = '<span class="big">COI ' + d2s(coi0) + (slip ? ' → ' + d2s(coi) : '') + '</span><span class="pill ' + cls + '">' + msg + '</span>' +
      (slip > 0 ? '<span class="hint">MCA review and the COI move with Phase 2. The client is told by email and WhatsApp.</span>' : '');
    var li = function (a) { return '<ul>' + a.map(function (p) { return '<li><span>' + p.name + '</span><b>' + (p.ms ? d2s(p.s) : d2s(p.s) + ' – ' + d2s(p.e)) + '</b></li>'; }).join('') + '</ul>'; };
    document.getElementById('tle-cmp').innerHTML = '<div><h4>Before</h4>' + li(st.base) + '</div><div><h4>After</h4>' + li(st.ph) + '</div>';
    var u = document.querySelector('#tle [data-act=undo]'); if (u) u.disabled = !st.hist.length;
  }
  function paintMode() {
    [].forEach.call(document.querySelectorAll('#tle [data-mode]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === st.mode)); });
    var cl = st.mode === 'client';
    document.getElementById('tle-client').style.display = cl ? '' : 'none';
    document.getElementById('tle-save').textContent = cl ? 'Send request' : 'Save timeline';
    document.getElementById('tle-t').textContent = cl ? 'Request a timeline change' : 'Edit timeline';
    document.getElementById('tle-warn').textContent = cl ? 'Priya Raman (Project Manager) approves requests. Northwind’s dates stay as they are until then.' : 'Saving updates the dashboard for everyone on Northwind.';
  }
  /* cascade: a phase never starts before the previous one ends; later phases keep their gaps */
  function apply(i, ns, ne, mode) {
    var p = st.ph[i]; if (p.done) return;
    var minS = i ? st.ph[i - 1].e : 0;
    if (p.ms) { ns = Math.max(minS, Math.min(W1, ns)); ne = ns; }
    else { ns = Math.max(minS, ns); ne = Math.max(ns + 1, Math.min(W1, ne)); if (mode === 'move') { var w = p.e - p.s; ne = Math.min(W1, ns + w); ns = ne - w; } }
    var shift = ne - p.e; p.s = ns; p.e = ne;
    for (var j = i + 1; j < st.ph.length; j++) {
      var q = st.ph[j], prev = st.ph[j - 1];
      if (shift > 0 || q.s > prev.e) { var w2 = q.e - q.s; q.s = Math.max(prev.e, q.s + shift); q.e = Math.min(W1, q.s + w2); if (q.ms) q.e = q.s; }
      if (q.s < prev.e) { var w3 = q.e - q.s; q.s = prev.e; q.e = q.s + w3; }
    }
  }
  function startDrag(e, i, bar) {
    var p = st.ph[i];
    if (p.done) { toast('Phase 1 is done, so its dates are locked'); return; }
    e.preventDefault(); bar.focus({ preventScroll: true });
    var h = e.target.closest('.hd'), mode = h ? (h.getAttribute('data-h') === 'l' ? 'start' : 'end') : 'move';
    var x0 = e.clientX, s0 = p.s, e0 = p.e, moved = false, sn = snap();
    push(); bar.classList.add('drag'); bar.setPointerCapture && bar.setPointerCapture(e.pointerId);
    function mv(ev) {
      var dd = Math.round((ev.clientX - x0) / ppd / sn) * sn; if (dd) moved = true;
      if (mode === 'move') apply(i, s0 + dd, e0 + dd, 'move');
      else if (mode === 'start') apply(i, Math.min(e0 - 1, s0 + dd), e0, 'start');
      else apply(i, s0, Math.max(s0 + 1, e0 + dd), 'end');
      paint();
    }
    function up() {
      bar.classList.remove('drag'); bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
      if (!moved) st.hist.pop(); paint();
    }
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  }
  function key(e, i) {
    var k = e.key; if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
    e.preventDefault(); var p = st.ph[i]; if (p.done) return toast('Phase 1 is done, so its dates are locked');
    var d = (k === 'ArrowRight' ? 1 : -1) * snap(); push();
    if (e.shiftKey && !p.ms) apply(i, p.s, p.e + d, 'end'); else apply(i, p.s + d, p.e + d, 'move');
    paint();
  }
  function commit() {
    var changed = JSON.stringify(st.ph) !== JSON.stringify(st.base);
    if (!changed) { toast('No changes to save'); return; }
    var slip = st.ph[3].s - st.base[3].s;
    if (st.mode === 'client') {
      var r = document.getElementById('tle-reason');
      if (!r.value.trim()) { document.getElementById('tle-err').style.display = 'block'; r.focus(); return; }
      store.set('pending', { ph: st.ph, reason: r.value.trim(), slip: slip });
      close(); syncCard();
      toast('Change request sent to Priya Raman', true, function () { store.set('pending', null); syncCard(); });
      return;
    }
    var prev = saved(); store.set('saved', st.ph); store.set('pending', null);
    close(); syncCard(true);
    toast('Timeline saved · COI ' + d2s(st.ph[3].s) + (slip ? (slip > 0 ? ' · slipped by ' + slip + ' d' : ' · pulled in by ' + (-slip) + ' d') : ''), true, function () { store.set('saved', prev); syncCard(true); });
  }

  /* ---------- the dashboard card: bars, labels, pending chip ---------- */
  function card() {
    var h = [].find.call(document.querySelectorAll('h3,h2'), function (x) { return /^\s*Timeline\s*$/i.test(x.textContent) && x.closest('section,.card'); });
    return h && h.closest('section,.card');
  }
  function syncCard(anim) {
    var c = card(); if (!c) return;
    var ph = saved(), pend = store.get('pending', null);
    [['Phase 1', 0], ['Phase 2', 1], ['MCA review', 2], ['COI', 3]].forEach(function (m) {
      var bar = c.querySelector('[aria-label="' + m[0] + '"]'); if (!bar) return;
      var p = ph[m[1]]; if (anim && !reduce) bar.style.transition = 'left .5s cubic-bezier(.22,1,.36,1), width .5s cubic-bezier(.22,1,.36,1)';
      bar.style.left = pct(p.s); bar.style.width = p.ms ? '1.76%' : pct(p.e - p.s);
      var tt = bar.querySelector('.tt'); if (tt) tt.textContent = p.ms ? 'COI · expected ' + d2s(p.s) : p.name + ' · ' + d2s(p.s) + ' – ' + d2s(p.e);
      var lab = bar.nextElementSibling;
      if (lab) { lab.style.left = 'calc(' + pct(p.e) + ' + 8px)'; if (m[1] === 3) lab.textContent = d2s(p.s); }
    });
    var head = c.firstElementChild, old = c.querySelector('.tle-pend'); if (old) old.remove();
    if (pend) {
      var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'tle-pend';
      chip.textContent = 'Change request pending · COI ' + d2s(pend.ph[3].s);
      chip.setAttribute('aria-label', 'Change request pending, waiting for Priya Raman');
      chip.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toast('Waiting for Priya Raman to approve · “' + pend.reason.slice(0, 60) + '”'); });
      var edit = [].find.call(head.querySelectorAll('a,button'), function (b) { return /^\s*Edit\s*$/.test(b.textContent); });
      (edit ? edit.parentNode : head).insertBefore(chip, edit || null);
    }
    var pop = c.querySelector('.pop'); if (pop && anim && pop.firstChild && pop.firstChild.nodeType === 3) pop.firstChild.textContent = 'Last changed by Northwind just now';
  }
  window.vcfoTimeline = { open: open, sync: syncCard };
  var tries = 0; (function t() { if (card()) syncCard(); else if (tries++ < 40) setTimeout(t, 150); })();
})();
```

### 4.12 Other shared base CSS (cards, buttons, chips, segmented control, toggles, rows, skeleton) — `b/ecdc…css` full

```css

body{margin:0;-webkit-font-smoothing:antialiased}
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);--primary-chip:oklch(52% 0.21 263);
--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--prog-chip:oklch(51% 0.17 252);
--up:oklch(82% 0.018 255);--up-light:oklch(96.6% 0.007 255);--up-text:oklch(46% 0.028 258);--up-chip:oklch(54% 0.026 258);
--violet:oklch(54% 0.17 292);--violet-light:oklch(96.4% 0.032 292);--violet-chip:oklch(50% 0.17 292);
--sky:oklch(58% 0.12 228);--sky-light:oklch(96.4% 0.026 228);--sky-chip:oklch(49% 0.12 230);
--teal:oklch(55% 0.1 195);--teal-light:oklch(96.4% 0.026 195);--teal-chip:oklch(47% 0.09 195);
--gst:oklch(52% 0.15 148);--it:oklch(53% 0.16 252);--mca:oklch(50% 0.18 300);--fema:oklch(55% 0.19 12);--labour:oklch(50% 0.12 200);
--cat-tax:oklch(58% 0.14 70);--cat-labour:oklch(50% 0.12 200);--cat-business:oklch(52% 0.17 292);--cat-ip:oklch(52% 0.13 230);--cat-fema:oklch(55% 0.19 12);
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
a{color:var(--primary);text-decoration:none;font-weight:700}a:hover{color:var(--primary-dark)}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:0;display:flex;flex-direction:column;transition:transform .25s ease,box-shadow .25s ease;animation:up .5s cubic-bezier(.2,.7,.2,1) backwards}
.card:hover{transform:translateY(-2px);box-shadow:0 2px 4px oklch(25% 0.04 264 / 0.05), 0 14px 28px -12px oklch(28% 0.08 264 / 0.25)}
.card.t::before{content:"";position:absolute;left:18px;top:-1px;width:38px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.ch{display:flex;align-items:center;gap:10px;padding:16px 18px 0;flex-wrap:wrap}
.st{font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--navy-ink,var(--navy));margin:0}
.ic{width:30px;height:30px;border-radius:99px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff}
.circ{width:44px;height:44px;border-radius:99px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff}
.duo{fill:currentColor;stroke:none;opacity:.26}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;letter-spacing:.01em;line-height:16px;white-space:nowrap}
.cap{font-size:11px;color:var(--muted)}
.lbl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.rt{font-size:13px;font-weight:600;color:var(--fg)}
.metric{font-family:"Space Grotesk",Manrope,sans-serif;font-weight:600;letter-spacing:-.035em;color:var(--fg);font-feature-settings:"tnum"}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:6px;font:600 13px Manrope,sans-serif;border:1px solid transparent;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background-color .15s,box-shadow .15s,transform .15s}
.btn:active{transform:scale(.98)}
.btn-p{background:var(--primary-fill,var(--primary));color:#fff;box-shadow:0 1px 2px oklch(30% 0.12 264 / 0.3), inset 0 1px 0 oklch(100% 0 0 / 0.16)}.btn-p:hover{background:var(--primary-fill-2,var(--primary-dark));color:#fff}
.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
.bar{height:8px;border-radius:3px;background:var(--raised);overflow:hidden;flex:1}
.bar>span{display:block;height:100%;border-radius:3px;transform-origin:left;animation:grow .9s cubic-bezier(.2,.7,.2,1) .2s backwards}
.stack{flex:1;display:flex;gap:2px;height:14px;border-radius:4px;overflow:hidden;background:var(--raised)}
.stack>span{transform-origin:left;animation:grow .9s cubic-bezier(.2,.7,.2,1) .2s backwards}
.pct{font-size:11.5px;font-weight:800;width:36px;text-align:right;color:var(--fg);font-feature-settings:"tnum"}
.go{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;margin-top:auto;padding:10px 18px 12px;border-top:1px solid var(--hair);color:var(--primary)}
.av{border-radius:99px;display:flex;align-items:center;justify-content:center;font-weight:800;flex:none;color:#fff;box-shadow:0 0 0 2px var(--panel)}
.kpi{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);padding:14px 14px 0 18px;display:flex;flex-direction:column;gap:10px;overflow:hidden;transition:transform .25s ease;animation:up .5s cubic-bezier(.2,.7,.2,1) backwards}
.kpi:hover{transform:translateY(-2px)}
.kpi::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--ac)}
.kpi .go{padding:9px 0 11px;margin:0}
th{text-align:left;padding:8px;font-size:10.5px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border)}
td{white-space:nowrap;padding:9px 8px;border-top:1px solid var(--hair);vertical-align:middle}
tbody tr:first-child td{border-top:0}
.nv{position:relative;display:flex;align-items:center;gap:11px;min-height:38px;padding:0 10px;border-radius:8px;color:var(--muted);font-weight:600;font-size:13.5px}
.nv:hover{background:var(--raised);color:var(--fg)}
.nv.on{background:var(--primary-light);color:var(--navy-ink,var(--navy));font-weight:800;box-shadow:inset 0 0 0 1px oklch(54.6% 0.215 263 / 0.18)}
.nv.on::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:99px;background:var(--gold)}
.sub{min-height:32px;padding-left:38px;font-size:13px}
.tb{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;color:var(--muted);position:relative;background:none;border:0}
.tb:hover{background:var(--primary-light);color:var(--fg)}
.dtile{width:50px;height:54px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
.box{width:22px;height:22px;border-radius:4px;border:2px solid var(--primary);flex:none;display:flex;align-items:center;justify-content:center;background:var(--panel)}
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:4px;border-radius:8px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:4px;bottom:4px;left:4px;border-radius:6px;background:var(--primary-light);box-shadow:inset 0 0 0 1px oklch(54.6% 0.215 263 / 0.28),0 1px 2px oklch(28% 0.06 264 / 0.08);transition:transform .38s cubic-bezier(.3,1.3,.5,1)}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;height:28px;padding:0 12px;border-radius:6px;font:600 12px Manrope,sans-serif;color:var(--muted);cursor:pointer;white-space:nowrap}
.seg button.on{color:var(--navy-ink,var(--navy));font-weight:700}
.seg .cnt{font:600 10.5px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}


/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/shell/motion.ts springSnappy (420/32/0.8) */
.seg{padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{top:2px;bottom:2px;left:2px;border-radius:5px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
/* dark theme: #0f2a4a vanishes on a dark track, so the pill steps up to --navy-3 */
[data-theme="dark"] .seg>.thumb{background:var(--navy-3)}
.seg button{height:28px;padding:0 10px;border-radius:5px;font:500 12px Manrope,sans-serif;color:oklch(55% 0.022 255);transition:color .2s}
.seg button:hover{color:light-dark(oklch(45% 0.03 255), oklch(82% 0.021 255))}
.seg button.on{color:#fff;font-weight:500}
.seg .cnt{color:oklch(55% 0.022 255)}
.seg button.on .cnt{color:oklch(100% 0 0 / .72)}
/* cardHover (y -2, 0.16 s) + shadow-layered-lg, pressScale 0.98, row hover, focus ring */
.card{transition:transform .16s cubic-bezier(.22,1,.36,1),box-shadow .16s cubic-bezier(.22,1,.36,1),border-color .16s}
.card:hover{transform:translateY(-2px);border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
.btn{transition:transform .12s cubic-bezier(.22,1,.36,1),background .15s}
.btn:active{transform:scale(.98)}
tbody tr{transition:background .15s}
tbody tr:hover{background:light-dark(oklch(96.8% 0.006 250 / .7), oklch(17.8% 0.006 250 / 0.7))}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:500 10px "IBM Plex Mono",monospace;color:var(--muted)}
/* sidebar: active pill + 3 px rail slide with the same spring; hover glass */
.snav a{position:relative;z-index:2}
.snav a:hover{background:oklch(100% 0 0 / .07)}
.spill,.srail{transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
/* page enter: fadeUp (y 6, 0.2 s) staggered 0.06 s */
@keyframes v7fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) both}
/* Ask VCFO bot: pops up from the bottom, idle bob, reaction on answer */
@keyframes v7up{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
@keyframes v7bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes v7react{0%{transform:scale(.9)}45%{transform:scale(1.1) rotate(-4deg)}75%{transform:scale(.98)}100%{transform:none}}
@keyframes v7think{0%,100%{opacity:.35}50%{opacity:1}}
.botup{animation:v7up .45s cubic-bezier(.22,1,.36,1) .5s both}
.bob{animation:v7bob 2.6s ease-in-out infinite}
.react{animation:v7react .55s cubic-bezier(.22,1,.36,1) both}
.dot1{animation:v7think 1s infinite}.dot2{animation:v7think 1s .2s infinite}.dot3{animation:v7think 1s .4s infinite}
@media (prefers-reduced-motion: reduce){.seg>.thumb,.card,.btn,.spill,.srail{transition:none}.card:hover{transform:none}.stag>*,.botup,.bob,.react,.dot1,.dot2,.dot3{animation:none}}


.info{position:relative;display:inline-flex;vertical-align:middle;flex:none}
.info>button{width:18px;height:18px;padding:0;border:0;border-radius:4px;background:none;color:oklch(62% 0.02 255);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:color .15s}
.info>button:hover,.info:focus-within>button{color:var(--navy-ink,var(--navy))}
.info .pop{position:absolute;left:50%;top:calc(100% + 8px);z-index:40;width:max-content;min-width:200px;max-width:280px;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:0 12px 32px -12px oklch(21% 0.042 264 / .35);font:500 12px/1.45 Manrope,sans-serif;color:var(--fg);text-align:left;white-space:normal;letter-spacing:0;text-transform:none;opacity:0;visibility:hidden;transform:translate(-50%,-4px);transition:opacity .15s,transform .15s,visibility .15s}
.info .pop::before{content:"";position:absolute;left:50%;top:-6px;width:10px;height:10px;background:var(--panel);border-left:1px solid var(--border);border-top:1px solid var(--border);transform:translateX(-50%) rotate(45deg)}
.info:focus-within .pop,.info.open .pop{opacity:1;visibility:visible;transform:translate(-50%,0)}
.info .pop .ask{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--hair);color:var(--primary);font-weight:700}
.stag>*:focus-within,.card:focus-within,section:focus-within{position:relative;z-index:30}
@media (prefers-reduced-motion: reduce){.info .pop{transition:none}}

@keyframes v7pulse{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .7)}50%{box-shadow:0 0 0 5px oklch(80% 0.12 85 / 0)}}.pulse{animation:v7pulse 1.8s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.pulse{animation:none}}
/* ---- client pages additions (Team · Updates · Audit · Settings) ---- */
html,body{background:var(--bg)}
.pg{padding:24px;display:flex;flex-direction:column;gap:16px;min-width:0}
.ph{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ph h1{margin:0;font:700 22px/1.2 "Space Grotesk",Manrope,sans-serif;letter-spacing:-.02em;color:var(--navy-ink,var(--navy))}
.ph .acts{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.h3{margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))}
.inp{display:block;width:100%;box-sizing:border-box;height:36px;border:1px solid var(--border);border-radius:6px;padding:0 12px;font:500 13px Manrope,sans-serif;background:var(--panel);color:var(--fg)}
.inp:focus{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:1px}
.fl{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--fg)}
.btn-n{background:var(--navy);color:#fff}.btn-n:hover{background:var(--navy-2);color:#fff}
.btn-g{background:transparent;color:var(--muted);border-color:transparent}.btn-g:hover{background:var(--raised);color:var(--fg)}
.btn-d{background:var(--panel);color:var(--over-text);border-color:oklch(57% 0.2 22 / .35)}
.btn-sm{height:30px;padding:0 10px;font-size:12px}
.ibtn{width:32px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0}
.ibtn:hover{color:var(--navy-ink,var(--navy));border-color:oklch(54.6% 0.215 263 / .35)}
.wa{background:var(--ok);border-color:var(--ok);color:#fff}.wa:hover{color:#fff;background:var(--ok-chip)}
.tgl{position:relative;width:38px;height:22px;border-radius:6px;border:0;background:light-dark(oklch(86% 0.012 255), oklch(34.2% 0.012 255));cursor:pointer;flex:none;padding:0;transition:background .2s}
.tgl::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:4px;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 1px 2px oklch(21% 0.042 264 / .3);transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
.tgl.on{background:var(--navy)}.tgl.on::after{transform:translateX(16px)}
.tgl:disabled{opacity:.45;cursor:not-allowed}
.udot{width:8px;height:8px;border-radius:99px;background:var(--primary-fill,var(--primary));flex:none}
.row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--hair)}
.row:first-child{border-top:0}
.row.unread{background:light-dark(oklch(97.6% 0.014 260), oklch(16.6% 0.01 260))}
.row.unread .rt{font-weight:800}
.ov{position:absolute;inset:0;background:oklch(21% 0.042 264 / .42);display:flex;align-items:center;justify-content:center;z-index:20}
.dlg{width:460px;max-width:calc(100% - 32px);background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(21% 0.042 264 / .5);overflow:hidden}
.dlg-h{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--hair)}
.dlg-b{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.dlg-f{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--hair);background:var(--raised)}
@keyframes sk{0%{background-position:-200px 0}100%{background-position:200px 0}}
.sk{border-radius:4px;background:linear-gradient(90deg,var(--raised) 0,light-dark(oklch(93% 0.01 255), oklch(23.5% 0.01 255)) 50%,var(--raised) 100%);background-size:400px 100%;animation:sk 1.2s linear infinite}
.toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:8px;background:var(--navy);color:#fff;font-size:13px;font-weight:600;box-shadow:0 16px 40px -14px oklch(21% 0.042 264 / .6);z-index:25}
.toast a{color:oklch(86% 0.09 85)}
.tl{position:relative;display:grid;grid-template-columns:64px 28px minmax(0,1fr);column-gap:12px}
.tl .rail{position:absolute;left:89px;top:0;bottom:0;width:2px;background:var(--border)}
.dtile .d{font:700 18px/1 "Space Grotesk",Manrope,sans-serif}
.dtile .m{font:800 9.5px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;margin-top:3px}
.node{width:28px;height:28px;border-radius:99px;display:flex;align-items:center;justify-content:center;color:#fff;position:relative;z-index:1;box-shadow:0 0 0 3px var(--panel)}
.old{font-family:Manrope,system-ui,sans-serif}
.old-card{background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid light-dark(oklch(92% 0.011 255 / .7), oklch(25.2% 0.011 255 / 0.7));border-radius:12px}
.old-pill{display:inline-flex;align-items:center;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;background:var(--raised);color:var(--subtle)}
@media (prefers-reduced-motion: reduce){.tgl,.tgl::after,.sk{transition:none;animation:none}}
@media (max-width:760px){.pg{padding:16px}.hide-sm{display:none!important}}

/* rule 17: every icon explains itself — navy tooltip (same look as rule 14), 120 ms */
@keyframes tipin{from{opacity:0;transform:translate(-50%,3px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes tipin2{from{opacity:0}to{opacity:1}}
[data-tip]{position:relative}
[data-tip]:hover::after,[data-tip]:focus-visible::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%);background:var(--navy);color:#fff;font:700 11.5px/1.25 Manrope,sans-serif;letter-spacing:0;text-transform:none;padding:5px 9px;border-radius:6px;white-space:nowrap;z-index:70;pointer-events:none;box-shadow:0 6px 16px -6px oklch(21% 0.042 264 / .5);animation:tipin .12s ease both}
[data-tip]:hover::before,[data-tip]:focus-visible::before{content:"";position:absolute;left:50%;bottom:calc(100% + 5px);width:8px;height:8px;margin-left:-4px;background:var(--navy);transform:rotate(45deg);z-index:70;pointer-events:none;animation:tipin2 .12s ease both}
[data-tip-below]:hover::after,[data-tip-below]:focus-visible::after{bottom:auto;top:calc(100% + 9px)}
[data-tip-below]:hover::before,[data-tip-below]:focus-visible::before{bottom:auto;top:calc(100% + 5px)}
@media (prefers-reduced-motion: reduce){[data-tip]::after,[data-tip]::before{animation:none!important}}
```

Incorporation additions (`b/5c039…css:119-189`):

```css
/* ===== Client pages — Incorporation additions ===== */
.page{position:relative;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.navyband{position:relative;border-radius:12px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)),var(--navy-2-deep,var(--navy-2)) 70%,var(--navy-3-deep,var(--navy-3)));color:#fff;overflow:hidden}
.navyband::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)}
.navyband .info>button{color:oklch(100% 0 0 / .7)}
.mini{background:oklch(100% 0 0 / .08);border:1px solid oklch(100% 0 0 / .12);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;min-width:0}
.mini .bar{background:oklch(100% 0 0 / .14);height:6px}
.btn-gold{background:var(--gold);color:#1d1606;font-weight:800}.btn-gold:hover{background:oklch(76% 0.11 85);color:#1d1606}
.btn-ghost{background:oklch(100% 0 0 / .1);color:#fff;border-color:oklch(100% 0 0 / .18)}.btn-ghost:hover{background:oklch(100% 0 0 / .18);color:#fff}
.btn-n{background:var(--navy);color:#fff}.btn-n:hover{background:var(--navy-2);color:#fff}
.btn-d{background:var(--panel);color:var(--over-text);border-color:oklch(57% 0.2 22 / .35)}
/* phase map */
.lane{display:flex;flex-direction:column;min-width:0}
.lanehd{display:flex;flex-direction:column;gap:6px;padding:12px 12px 10px;border-radius:10px;background:var(--raised);border:1px solid var(--border);margin-bottom:12px}
.lanehd.on{background:var(--navy);border-color:var(--navy);color:#fff}
.lanehd.ok{background:var(--ok-light);border-color:oklch(56% 0.13 168 / .35)}
.node{position:relative;display:flex;align-items:center;gap:8px;min-height:34px;padding:6px 8px 6px 10px;border-radius:8px;font:700 12.5px Manrope,sans-serif;box-sizing:border-box;text-align:left;width:100%;cursor:pointer;transition:opacity .25s,transform .16s cubic-bezier(.22,1,.36,1),box-shadow .16s}
.node:hover{transform:translateX(2px);box-shadow:0 4px 12px -6px oklch(28% 0.06 264 / .3)}
.node .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.node.done{background:var(--ok-light);color:var(--ok-text);border:1px solid oklch(56% 0.13 168 / .35)}
.node.cur{background:var(--navy);color:#fff;border:1px solid var(--navy);box-shadow:0 0 0 4px oklch(37.9% 0.146 266 / .14)}
.node.sbc{background:var(--prog-light);color:var(--prog-text);border:1px solid oklch(55% 0.16 252 / .35)}
.node.next{background:var(--panel);color:var(--fg);border:1px dashed oklch(54.6% 0.215 263 / .6)}
.node.up{background:var(--panel);color:var(--muted);border:1px dashed light-dark(oklch(82% 0.018 255), oklch(29.2% 0.012 255))}
.node.na{background:var(--raised);color:var(--subtle);border:1px solid var(--hair)}
.node.na .nm{text-decoration:line-through}
.own{flex:none;font-size:10px;font-weight:800;letter-spacing:.02em;padding:1px 5px;border-radius:4px;line-height:15px}
.own.you{background:var(--gold-soft);color:var(--gold-text)}.own.sbc{background:var(--prog-light);color:var(--prog-text)}.own.mca{background:var(--violet-light);color:var(--violet-chip)}.own.na{background:var(--hair);color:var(--subtle)}
.node.cur .own{background:oklch(100% 0 0 / .16);color:#fff}
.node.done .own{background:light-dark(oklch(100% 0 0 / .7), oklch(13% 0 0 / 0.7))}
.num{flex:none;width:18px;height:18px;border-radius:99px;display:flex;align-items:center;justify-content:center;font:700 10px "IBM Plex Mono",monospace}
.node.done .num{background:var(--ok);color:#fff}.node.cur .num{background:var(--gold);color:var(--navy)}.node.sbc .num{background:var(--prog);color:#fff}
.node.next .num,.node.up .num,.node.na .num{border:1.5px dashed oklch(70% 0.03 255);color:var(--subtle)}
.vl{width:2px;height:8px;margin-left:18px;border-radius:2px;flex:none}
.vl.ok{background:var(--ok)}.vl.dash{background:repeating-linear-gradient(180deg,light-dark(oklch(82% 0.018 255), oklch(35.4% 0.018 255)) 0 3px,transparent 3px 6px)}.vl.mix{background:linear-gradient(180deg,var(--ok),var(--navy-deep,var(--navy)))}
.grp{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--subtle);margin:10px 0 6px 2px;display:flex;align-items:center;gap:6px}
.grp:first-child{margin-top:0}
.dim{opacity:.22}
.focus{border-radius:10px;border:1px solid var(--navy);background:var(--panel);box-shadow:0 0 0 4px oklch(37.9% 0.146 266 / .1),0 14px 30px -14px oklch(21% 0.042 264 / .45);overflow:hidden}
.flowarrow{position:absolute;top:22px;width:24px;display:flex;align-items:center;justify-content:center;color:var(--subtle)}
.milestone{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;border-radius:6px;background:var(--gold-soft);color:var(--gold-text);font-weight:800;font-size:11.5px;border:1px solid oklch(78% 0.1 85 / .6)}
/* step page */
.kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}
.kv>div{display:flex;flex-direction:column;gap:3px;padding:10px 0;border-top:1px solid var(--hair);min-width:0}
.kv .k{display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.kv .v{font-size:13.5px;font-weight:600;color:var(--fg)}
.kv .flag{background:var(--over-light);margin:0 -10px;padding:10px;border-radius:6px;border-top-color:transparent;box-shadow:inset 3px 0 0 var(--over)}
.drop{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1.5px dashed oklch(54.6% 0.215 263 / .45);border-radius:10px;background:light-dark(oklch(98.2% 0.008 255), oklch(15.7% 0.008 255));transition:background .15s,border-color .15s}
.drop:hover{background:var(--primary-light);border-color:var(--primary)}
.drop.miss{border-color:oklch(66% 0.17 48 / .65);background:var(--due-light)}
.drop.over{border-color:var(--primary);background:var(--primary-light);box-shadow:0 0 0 4px oklch(54.6% 0.215 263 / .12)}
.file{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--panel);cursor:pointer;transition:border-color .15s,background .15s}
.file:hover{border-color:oklch(54.6% 0.215 263 / .4);background:light-dark(oklch(98.6% 0.004 255), oklch(15.1% 0.004 255))}
.ftile{width:34px;height:40px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:700 9.5px "IBM Plex Mono",monospace;flex:none}
.ibtn{width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0}
.ibtn:hover{color:var(--navy-ink,var(--navy));border-color:oklch(54.6% 0.215 263 / .4);background:var(--primary-light)}
.prog{height:4px;border-radius:2px;background:var(--hair);overflow:hidden}.prog>span{display:block;height:100%;background:var(--primary-fill,var(--primary));border-radius:2px;transform-origin:left;animation:grow 1.2s cubic-bezier(.2,.7,.2,1) backwards}
.abar{position:absolute;left:248px;right:0;bottom:0;z-index:20;display:flex;align-items:center;gap:12px;padding:12px 24px;background:light-dark(oklch(100% 0 0 / .92), oklch(13% 0 0 / 0.92));border-top:1px solid var(--border);box-shadow:0 -10px 24px -16px oklch(21% 0.042 264 / .35);backdrop-filter:blur(8px)}
.banner{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:10px;border:1px solid}
.banner.blue{background:var(--prog-light);border-color:oklch(55% 0.16 252 / .3);color:var(--prog-text)}
.banner.red{background:var(--over-light);border-color:oklch(57% 0.2 22 / .3);color:var(--over-text)}
.banner.green{background:var(--ok-light);border-color:oklch(56% 0.13 168 / .3);color:var(--ok-text)}
.banner .circ{width:34px;height:34px}
.cmt{display:flex;gap:10px;padding:10px 0;border-top:1px solid oklch(57% 0.2 22 / .18)}
.toast{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:10px;background:var(--navy);color:#fff;font-weight:600;box-shadow:0 16px 34px -12px oklch(15% 0.05 258 / .6);animation:v7up .4s cubic-bezier(.22,1,.36,1) both}
.toast a{color:var(--gold)}
.skel{border-radius:6px;background:linear-gradient(90deg,var(--hair),var(--raised),var(--hair));background-size:200% 100%;animation:shimmer 1.4s linear infinite}
@keyframes shimmer{to{background-position:-200% 0}}
.paper{background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);border-radius:6px;box-shadow:0 18px 40px -22px oklch(21% 0.042 264 / .45);padding:36px 40px;font-family:Georgia,"Times New Roman",serif;color:light-dark(#1a1a1a, oklch(91.3% 0 89.9));font-size:11px;line-height:1.6}
.paper .ln{height:7px;border-radius:2px;background:light-dark(oklch(90% 0.006 255), oklch(28% 0.006 255));margin:7px 0}
@media (prefers-reduced-motion: reduce){.node,.toast,.prog>span,.skel{animation:none;transition:none}.node:hover{transform:none}}
```

Flow-chart options (`b/9459…css`, full):

```css
/* ===== Flow chart options A–E (shared frame) ===== */
.ob{width:1440px;box-sizing:border-box;padding:32px;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px;display:flex;flex-direction:column;gap:18px}
.obh{display:flex;align-items:center;gap:14px}
.obl{width:52px;height:52px;border-radius:12px;background:var(--navy);color:var(--gold);display:flex;align-items:center;justify-content:center;font:700 26px "Space Grotesk",sans-serif;flex:none}
.uc{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);padding:14px 20px 20px;min-width:0}
.uch{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.ucn{width:20px;height:20px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:700 11px "IBM Plex Mono",monospace;display:flex;align-items:center;justify-content:center;color:var(--muted)}
.phone{width:390px;box-sizing:border-box;border-radius:30px;border:8px solid #10213a;background:var(--bg);overflow:hidden;flex:none}
.phone .pbar{height:44px;background:#0f2a4a;color:#fff;display:flex;align-items:center;padding:0 16px;font-weight:700;font-size:13px}
.mini-pop{width:420px;border-radius:12px;overflow:hidden;box-shadow:0 24px 50px -24px oklch(15% 0.05 258 / .55);border:1px solid var(--border);background:var(--panel)}
.mini-pop .mh{padding:10px 14px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)),var(--navy-2-deep,var(--navy-2)) 70%,var(--navy-3-deep,var(--navy-3)));color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;gap:8px}
.scale{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600}
.scale b{color:var(--navy-ink,var(--navy))}
.tag{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:1px 6px;font-size:10.5px;font-weight:800;line-height:16px;white-space:nowrap}
.tag.wait{background:var(--due-chip);color:#fff}.tag.block{background:var(--over-chip);color:#fff}.tag.now{background:var(--gold);color:var(--navy)}
@keyframes flspin{to{transform:rotate(360deg)}}
@keyframes flsheen{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes flring{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .65)}50%{box-shadow:0 0 0 7px oklch(80% 0.12 85 / 0)}}
.spin{animation:flspin 1.4s linear infinite;transform-origin:50% 50%}
.ringpulse{animation:flring 1.8s ease-in-out infinite}

/* A · node cards + curved connectors */
.fa-wrap{position:relative}
.fa-svg{position:absolute;left:0;top:0;overflow:visible}
.fa-n{position:absolute;display:flex;align-items:center;gap:10px;padding:10px 12px;box-sizing:border-box;border-radius:10px;background:var(--panel);border:1px solid var(--border);box-shadow:0 1px 2px oklch(25% 0.04 264 / .05),0 10px 22px -14px oklch(28% 0.06 264 / .35)}
.fa-n::before,.fa-n::after{content:"";position:absolute;top:50%;width:8px;height:8px;margin-top:-4px;border-radius:99px;background:var(--panel);border:1.5px solid oklch(75% 0.02 255)}
.fa-n::before{left:-5px}.fa-n::after{right:-5px}
.fa-n.done{border-color:oklch(56% 0.13 168 / .5)}.fa-n.done::before,.fa-n.done::after{border-color:var(--ok)}
.fa-n.cur{background:var(--navy);border-color:var(--navy);color:#fff;box-shadow:0 0 0 4px oklch(37.9% 0.146 266 / .14),0 16px 30px -14px oklch(21% 0.042 264 / .6)}
.fa-n.cur::before,.fa-n.cur::after{border-color:var(--gold);background:var(--navy)}
.fa-n.next{border-style:dashed;background:var(--raised);box-shadow:none;color:var(--muted)}
.fa-n.wait{border-color:oklch(66% 0.17 48 / .6);background:var(--due-light)}
.fa-n.block{border-color:oklch(57% 0.2 22 / .6);background:var(--over-light)}
.fa-t{font-size:13px;font-weight:800;white-space:nowrap}
.fa-s{font-size:11.5px;font-weight:600;color:var(--muted);white-space:nowrap}
.fa-n.cur .fa-s{color:oklch(100% 0 0 / .72)}
.fa-ms{position:absolute;width:40px;height:40px;transform:rotate(45deg);border-radius:6px;background:var(--gold-soft);border:2px dashed var(--gold);box-sizing:border-box}
.fa-msl{position:absolute;font-size:11.5px;font-weight:800;color:var(--gold-text);white-space:nowrap;transform:translateX(-50%)}

/* B · segmented progress bar */
.fb-row{display:flex;gap:6px}
.fb-seg{position:relative;flex:1;height:12px;border-radius:3px;background:var(--hair);overflow:hidden}
.fb-seg.done{background:var(--ok)}
.fb-seg.cur{background:var(--navy)}
.fb-seg.cur::after{content:"";position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,oklch(80% 0.12 85 / .85),transparent);animation:flsheen 1.8s ease-in-out infinite}
.fb-seg.next{background:repeating-linear-gradient(135deg,var(--hair) 0 5px,light-dark(oklch(97% 0.005 255), oklch(17.5% 0.005 255)) 5px 10px);box-shadow:inset 0 0 0 1px var(--border)}
.fb-seg.wait{background:var(--due)}.fb-seg.block{background:var(--over)}
.fb-fill{position:absolute;left:0;top:0;bottom:0;background:var(--navy)}
.fb-lab{flex:1;min-width:0;display:flex;align-items:flex-start;gap:8px;padding-top:10px}
.fb-t{font-size:13px;font-weight:800}.fb-s{font-size:11.5px;font-weight:600;color:var(--muted)}
.fb-lab.next .fb-t{color:var(--muted)}
.fb-lab.cur .fb-t{color:var(--navy-ink,var(--navy))}

/* C · vertical rail timeline */
.fc-i{position:relative;display:grid;grid-template-columns:28px minmax(0,1fr) auto;column-gap:12px;align-items:start;padding-bottom:16px}
.fc-i::before{content:"";position:absolute;left:13px;top:30px;bottom:2px;width:2px;border-radius:2px;background:repeating-linear-gradient(180deg,light-dark(oklch(82% 0.018 255), oklch(35.4% 0.018 255)) 0 4px,transparent 4px 8px)}
.fc-i.ok::before{background:var(--ok)}
.fc-i.mix::before{background:linear-gradient(180deg,var(--navy-deep,var(--navy)),light-dark(oklch(82% 0.018 255), oklch(35.4% 0.018 255)))}
.fc-i.last::before{display:none}
.fc-b{padding:4px 10px 6px;border-radius:8px;margin-top:-2px}
.fc-i.cur .fc-b{background:oklch(37.9% 0.146 266 / .07);box-shadow:inset 0 0 0 1px oklch(37.9% 0.146 266 / .18)}
.fc-t{font-size:13.5px;font-weight:800}.fc-s{font-size:12px;font-weight:600;color:var(--muted)}
.fc-i.next .fc-t{color:var(--muted)}
.fc-time{font:600 11.5px "IBM Plex Mono",monospace;color:var(--subtle);padding-top:5px}

/* D · pipeline graph */
.fd-wrap{position:relative}
.fd-svg{position:absolute;left:0;top:0;overflow:visible}
.fd-stage{position:absolute;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--subtle)}
.fd-n{position:absolute;display:flex;align-items:center;gap:9px;height:42px;padding:0 12px 0 9px;box-sizing:border-box;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:0 1px 2px oklch(25% 0.04 264 / .06)}
.fd-n.cur{border-color:var(--navy);box-shadow:0 0 0 3px oklch(37.9% 0.146 266 / .12)}
.fd-n.next{background:light-dark(oklch(98.6% 0.003 255), oklch(15.1% 0.003 255));color:var(--muted)}
.fd-n.wait{border-color:oklch(66% 0.17 48 / .6)}.fd-n.block{border-color:oklch(57% 0.2 22 / .6)}
.fd-t{font-size:13px;font-weight:700;white-space:nowrap;flex:1}
.fd-d{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle);white-space:nowrap}

/* E · track (metro line) */
.fe-wrap{position:relative}
.fe-svg{position:absolute;left:0;top:0;overflow:visible}
.fe-st{position:absolute;transform:translate(-50%,-50%);border-radius:99px;box-sizing:border-box;display:flex;align-items:center;justify-content:center}
.fe-st.done{width:22px;height:22px;background:var(--ok);color:#fff;box-shadow:0 0 0 3px var(--panel)}
.fe-st.cur{width:34px;height:34px;background:var(--navy);box-shadow:0 0 0 4px var(--panel),0 0 0 6px var(--navy)}
.fe-st.next{width:20px;height:20px;background:var(--panel);border:2.5px solid oklch(78% 0.02 255)}
.fe-st.wait{width:24px;height:24px;background:var(--due);color:#fff;box-shadow:0 0 0 3px var(--panel)}
.fe-st.block{width:24px;height:24px;background:var(--over);color:#fff;box-shadow:0 0 0 3px var(--panel)}
.fe-st.ms{width:30px;height:30px;border-radius:6px;transform:translate(-50%,-50%) rotate(45deg);background:var(--panel);border:3px solid var(--gold)}
.fe-core{width:12px;height:12px;border-radius:99px;background:var(--gold)}
.fe-lab{position:absolute;transform:translateX(-50%);text-align:center;white-space:nowrap}
.fe-t{font-size:13px;font-weight:800}.fe-s{font-size:11.5px;font-weight:600;color:var(--muted)}
.fe-lab.next .fe-t{color:var(--muted)}
.fe-flag{position:absolute;transform:translate(-50%,-100%);background:var(--navy);color:#fff;font-size:11px;font-weight:800;border-radius:4px;padding:3px 8px;white-space:nowrap}
.fe-flag::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;margin-left:-4px;background:var(--navy);transform:rotate(45deg)}
@media (prefers-reduced-motion: reduce){.spin,.ringpulse,.fb-seg.cur::after{animation:none}}
```

### 4.13 Bot speech bubble (rule 16) — `s/inc/board.html:75-79`, `597`

```css
.bot{display:flex;gap:12px;align-items:flex-start}
.bav{flex:none;width:40px;height:40px;border-radius:50%;background:var(--primary-light);display:grid;place-items:center;overflow:hidden}
.bav svg{width:34px;height:43px;margin-top:9px}
.bub{position:relative;flex:1;min-width:0;background:var(--with-light);border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.5;color:var(--fg)}
.bub .btn{margin-top:8px;height:30px;font-size:12px;padding:0 10px}
```

```js
function botSay(text,btn,q,aria,go){return '<div class="bot"><span class="bav" aria-hidden="true">'+(window.vcfoBotSVG||'')+'</span><div class="bub">'+text+(btn?'<br><button type="button" class="btn"'+(go?' data-go="'+go+'"':' data-chatq="'+esc(q)+'"')+' aria-label="'+esc(aria||btn)+'">'+esc(btn)+'</button>':'')+'</div></div>';}
```

---

## 5. Gotchas for the developer

- `.tb` means two different things (top-bar icon button in `ecdc`, tooltip bubble in `5f81`). Rename in the port.
- The sidebar uses `font-weight:650`; with only 600/700 woff2 shipped the browser synthesises; match by loading Manrope as a variable font or accept 600/700.
- `light-dark()` only resolves correctly when `color-scheme` is set on an ancestor; the dark override block must also set `color-scheme:dark`.
- `#vp-chat` sizes depend on `--vpl-lift`, `--vpl-in`, `--vpl-ph`, `--vpk-w`: define them on the portal root, not inside the component.
- The pill/rail positions are measured from the DOM (`getBoundingClientRect`); in React use a layout effect keyed on pathname + group open state, and
  re-measure for ~20 frames while a group animates (shell.js:418), or animate with framer-motion `layoutId` (as `MotionActivePill` does).
- The prototype's "Before | After" toggle, the bottom "PROTOTYPE" bar, the fallback toasts and `window.open` stubs are prototype affordances, not product features.
- Names in the prototype differ between sources: account "Rohan Kumar" (shell.js) vs "Rahul Khanna" (legacy board sidebar, phone drawer). Use real session data.
- The FINAL nav label is "Library"; DECISIONS.md says the sidebar name should be "Knowledge Bank" (route stays `/library`). Confirm with the owner.
- 👍/👎 is required by DECISIONS.md but absent from the runtime chat; it is only in the `v7chat_answer` board.
