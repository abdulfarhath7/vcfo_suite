# Home + home-folder shared screens: full inventory for the Next.js rebuild

Prototype source of truth: `docs/specs/client-pages/prototype/final-src/` (FINAL). Everything below was read from the files, not from screenshots. The PNGs in `v7-screens/` are OLDER than FINAL in a few places (see section 13, "Screenshot drift"); when they disagree, FINAL wins.

Files covered: `s/home/v7_before.dc.html`, `s/home/v7_after.dc.html`, every `s/home/v7c_*` card, `s/home/mobile.html` (+ `#after`, `#chat`), `s/home/v7chat_*`, `s/home/v7p_*`, `s/home/v7x_*`, `tl-editor.js`, plus the shared runtime they depend on (`proto.js`, `shell.js`, `routes.js`).

Rules applied: `docs/specs/client-pages/DECISIONS.md`, `DESIGN-RULES.md`, `prototype/src/README.md` (responsive contract: phone ≤767, tablet 768–1279, desktop ≥1280; phone FILE swap below 700 px).

Contents
1. How the prototype is built (what is a "board", what runs where)
2. Route keys used by Home and their real Next.js targets
3. Shared components and global behaviours (G-ids)
4. Home BEFORE COI (desktop/tablet board) — layout + per-card inventory
5. Home AFTER COI (desktop/tablet board) — layout + per-card inventory
   (sections 4 and 5 share card sections 5.x; per card: inventory, data, mapping)
6. Phone Home (`mobile.html`, `#after`, `#chat`)
7. Ask VCFO chat (runtime chat + `v7chat_*` design boards)
8. Pop-up boards (`v7p_step`, `v7p_compliance`, `v7p_ids_password`, `v7p_timeline_client`, `v7p_timeline_manager`) + the live timeline editor (`tl-editor.js`)
9. Credentials page (`v7p_credentials`) — full flow, states, OTP, audit, data model
10. `v7x_*` boards (doc viewer, drill-down, info pop-over, top bar, launcher concept, timeline options, before_bare)
11. Layout specs per breakpoint (grid areas, gaps, paddings, card CSS)
12. Backend mapping summary: what exists vs NEW
13. Prototype inconsistencies and open questions for the owner
Appendix A (shared CSS verbatim), Appendix B (every card's markup + CSS + render logic verbatim), Appendix C (phone + Credentials CSS verbatim) are appended at the end of this file in the order A, C, B (B is the largest).

Demo identity used everywhere in the prototype: company **Northwind Technologies India Pvt Ltd** ("Northwind"); signed-in client **Rohan Kumar** (initials RK, "Northwind · Client"); Project Manager **Priya Raman** (PR); Project Lead **Arjun Mehta** (AM); "Customer support · SBC help desk". "Today" is **Tue 6 Oct 2026** in the Before state and **Sun 8 Nov 2026** in the After state. COI expected 28 Oct (before) / issued 24 Oct (after).

Wording rule visible in FINAL: the client is always addressed as the company name ("Waiting on Northwind", "Needs from Northwind", "Steps around Northwind", tab "Northwind"), never "you". The real app must render `engagement.companyName` (short form) in these places. (Older screenshots still say "you".)

---

## 1. How the prototype is built

| id | item | behaviour | file |
|---|---|---|---|
| B-01 | Board | Each `*.dc.html` is a "design canvas" board: a `<template>` whose `<helmet>` holds `<style>` blocks, then markup with `{{bindings}}`, `<sc-for>` loops, `<sc-if>` conditionals, `<dc-import name="x">` embeds (another board from the same folder), and a `<script type="text/x-dc">` class with `constructor` (initial `this.state`) and `renderVals()` (returns the bindings). Treat each `v7c_*` board as one React component; `state` = component state; `props` = component props. | all |
| B-02 | Home before | `v7_before.dc.html` = shell placeholder (`.vh-side` 248 px), top bar `header.vh-top`, `main.vh-main.vh-b` grid with 5 named areas filled by `v7c_*_b` cards, plus a board-local launcher (hidden at runtime; the global launcher replaces it). | v7_before |
| B-03 | Home after | `v7_after.dc.html` = same frame, `main.vh-main.vh-a` grid with 8 areas filled by `_a` cards + after-only cards. | v7_after |
| B-04 | Runtime glue | `proto.js` (theme, routing `data-go`, toasts, rule-17 icon tooltips, the global Ask VCFO launcher + chat window, the generic drill pop-up `window.vcfoDrill`, sticky top bar/sidebar, bottom spacer, fallback toasts so no control is dead). `shell.js` draws the real navy sidebar (`.vps`) over the `.vh-side` placeholder, the Before/After pill, the phone drawer, team contacts. `tl-editor.js` = timeline editor pop-up (Home only; injected by proto.js on any `/s/home/` path). | proto.js, shell.js, tl-editor.js |
| B-05 | Device swap | `proto.js device()`: `innerWidth < 700` → phone file (`routes.js` `m` path) else desktop file `d`. Overridable by `localStorage vcfo.device`. Tablets (700–1279) use the desktop board with the 72 px icon rail. | proto.js |
| B-06 | Before/After state | `localStorage vcfo.after` (JSON bool). Changing it on Home navigates to `home` or `home-after` (route `home` resolves to `home-after` when `vcfo.after` is true). On other pages it dispatches `document` event `vcfo-after` (`detail` bool). In the real app this is NOT a toggle: it is derived from data (`overview.incorporated` = CIN present or `incorporation_date` set). | proto.js `setAfter`, `pathFor` |
| B-07 | Page enter | `html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1)}` (fade + translateY 6px→0). Leaving: `html.vp-leave body{opacity:.35;transition:opacity .14s}` then navigate after 140 ms. Reduced motion: none. | proto.js |
| B-08 | Board fit script | v7_before / v7_after / v7p_ids_password / v7x_doc_viewer each carry an inline script: on `mouseover`/`focusin`/`click` it measures the open `.pop`/`.tt` and shifts it horizontally (`margin-left`) so it stays ≥ 8 px inside the viewport; click on `.info>button` toggles `.info.open`; a click anywhere else closes every open `.info`. | v7_before (script) |

---

## 2. Route keys used by Home and their real targets

| route key (`data-go` / `vcfoGo`) | prototype file | real Next.js route (app/app/client/**) | notes |
|---|---|---|---|
| `home` | v7_before (≥700) / mobile.html | `/app/client/overview` (`/app/client` redirects here) | same URL before and after COI; layout chosen by `overview.incorporated` |
| `home-after` | v7_after / mobile.html#after | `/app/client/overview` | hidden route key, prototype only |
| `home-chat` | v7_before#chat / mobile.html#chat | `/app/client/overview` + open Ask panel | real: `AskProvider` / `AskLauncher` open state (`src/components/ask/*`) |
| `incorporation` | s/inc/incorporation.html | `/app/client/incorporation` | |
| `inc-phase-a` / `inc-phase` / `inc-phase-3` / `inc-phase-4` | s/inc/phase.html#p=1..4 | `/app/client/incorporation?phase=pre-inc-phase-1` … (or a phase sub-route; incorporation agent decides) | Phase 1 Name Application, 2 Incorporation, 3 Post-Incorporation, 4 Registration |
| `inc-step-N` (N = 1…48) | s/inc/step.html#n=N | `/app/client/incorporation/step/...` (folder `app/app/client/incorporation/step` exists) or `clientStepHref(stepId)` = `/app/client/incorporation?step=<id>` (src/lib/client/client-overview.ts) | N → checklist id table in 5.10 |
| `compliances` | s/comp/index.html#cal-redesign | `/app/client/compliances/calendar` (folder exists) | |
| `filings` | s/comp/index.html#fil-redesign | `/app/client/compliances/filings` | |
| `documents` | s/docs/docs_a_refined | `/app/client/documents` | |
| `knowledge-bank` | s/docs/lib_shelf_a | `/app/client/library` | sidebar label "Library" |
| `doc-viewer` | s/home/v7x_doc_viewer | NOT a page in the real app: an overlay/preview component opened in place (rule 9 "click a row → preview overlay"); fetch via `GET /api/documents/[id]/signed-url` or `GET /api/milestone-documents/signed-url` | prototype models it as a route only because it is a separate file |
| `ids-password` | s/home/v7p_ids_password | NOT a page: modal over Home | |
| `credentials` | s/home/v7p_credentials | NEW page `/app/client/credentials` (no folder yet) | sidebar item "Credentials" (icon key-round) sits between Library and Team in `shell.js` NAV |
| `team` / `audit` / `settings` / `announcements` / `notifications` | s/team/* | `/app/client/team`, `/audit`, `/settings`, `/announcements`, `/notifications` | |

---

## 3. Shared components and global behaviours

### 3.1 Inventory

| id | item | exact behaviour / content | file |
|---|---|---|---|
| G-01 | Design tokens | Light tokens on `:root` (Appendix A). Dark ("True black") tokens injected by proto.js into `html[data-theme="dark"]` (bg #000, panel oklch(13% .006 260), navy→oklch(46% .15 258), `--navy-ink`, `--navy-deep`, `--primary-fill`…). Theme stored in `localStorage vcfo.theme` = light/dark/system. Any button whose aria-label contains "theme" toggles; label flips "Switch to dark theme"/"Switch to light theme", `aria-pressed`. | proto.js lines 6–56 |
| G-02 | Card | `section.card`: white panel, 1px `--border`, radius 10px, `--shadow`, flex column. Entry animation `up .5s cubic-bezier(.2,.7,.2,1) backwards` (opacity 0, translateY 10px → 0). Hover (v7.1 override): `translateY(-2px)`, border `oklch(54.6% .215 263 / .35)`, layered shadow; transition `.16s cubic-bezier(.22,1,.36,1)`. Phone (≤767): no hover lift. Header row: `display:flex;align-items:center;gap:8px;padding:14px 16px 0`, title `h3` `font:700 13px Manrope;color:var(--navy-ink,var(--navy))`, right group `margin-left:auto;display:flex;gap:6px`. Headers wrap (`row-gap:8px`). | Appendix A + every v7c |
| G-03 | Sliding pill (`.seg`) | Track: `padding:2px;border-radius:8px;background:light-dark(oklch(96.5% .008 250),oklch(18.3% .008 250));box-shadow:inset 0 0 0 1px var(--border)`; `display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)`. Thumb `.thumb`: absolute, `top/bottom/left:2px`, radius 5px, navy (`--navy-3` in dark), width `calc((100% - 4px)/N)`, `transform:translateX(i*100%)`, transition `.42s` spring `linear(0,0.0637,…,1.0004)` (= springSnappy 420/32/0.8). Buttons: height 28px, padding 0 10px, `font:500 12px Manrope`, color oklch(55% .022 255); active `.on` white, weight 500; counts `.cnt` `600 11px IBM Plex Mono`, active count white 72%. Phone ≤767 with `.vh-segwrap`: becomes flex-wrap, thumb hidden, active button gets navy background. All card buttons ≥40px tall on phone. | Appendix A |
| G-04 | Info (i) pop-over | `span.info > button[aria-label="More information"]` (18×18, 15 px circle-i icon, colour oklch(62% .02 255), navy on hover/focus/open) + `span.pop[role=tooltip]`: below the icon (`top:calc(100% + 8px)`, centred), 200–280px (`max-width:min(280px,100vw-24px)`), radius 8, 1px border, shadow `0 12px 32px -12px`, 12px/1.45 text, 10px arrow (`::before` rotated square). Opens on click/tap (class `.open`) or keyboard focus (`:focus-within`), fade `.15s`; only one open at a time; outside click closes; kept inside viewport by the fit script (B-08). Last row `a.ask`: 16px bot avatar + "Ask VCFO about this" (border-top hair, primary colour, bold) → opens chat with question "Tell me about <closest heading/strong text>" (proto.js `chatQuestion`). Touch: 11px invisible hit-area expansion (`pointer:coarse`). Spec board: v7x_info_popover (section 10). Build: Radix Popover. | Appendix A, v7x_info_popover |
| G-05 | Hover tooltip (`.tipw` + `.tt`) | Navy bubble `font:700 12px/1.3`, padding 5px 9px, radius 6, white text, arrow 8px; above the element (`bottom:calc(100% + 8px)`), `.tt.l` = left side, `.tt.w` = white bubble with navy text (used on the greeting ring). Shows on `:hover`/`:focus-visible` after display, fade `.12s`. Every chart part is a `.tipw role=button tabindex=0 aria-label=<same text>` that opens the drill-down on click/Enter (rule 14). | Appendix A |
| G-06 | Drill-down pop-up | `v7x_drilldown` (section 10.2): 600px (`min(600px,100vw-24px)`), max-height 560px, radius 12, dimmed backdrop `oklch(20% .05 258 / .45)` (fixed, z 200; dialog z 201, centred). Top strip "These items live in {Page}" + "Open {Page} →" (`data-go`), title + × (30px), navy sliding pill of tabs (clicked part pre-selected), list rows `ddrow` (grid `minmax(0,1fr) 62px 116px 16px`: name · mono date · status chip full-width · → arrow), empty "Nothing here.", footer "Showing n of m" / "Showing all n" + "Open full list". ≤640px: pill wraps, date column hidden. Closes on backdrop, ×, Esc. Page link chosen by title regex: /filings/→Filings, /alert/→Notifications, /document/→Documents, /team|who/→Team, /compliance|deadline/→Compliances, else Incorporation. | v7x_drilldown |
| G-07 | Chips | `.chip`: `inline-flex;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px`. Solid status chip = `background:var(--<k>-chip);color:#fff` where k ∈ ok (Completed/Filed/Registered), due (Waiting/Due soon), over (Overdue), prog (In progress/With SBC), up (Upcoming/Not started). Owner chip (light) = `background:var(--due-light);color:var(--due-text)` "Northwind" / `background:var(--prog-light);color:var(--prog-text)` "SBC". Status chips in step lists `min-width:116px;justify-content:center`; owner chips `min-width:88px`. | Appendix A, cards |
| G-08 | Buttons | `.btn` 36px, padding 0 14px, radius 6, `600 13px Manrope`; `.btn-p` primary blue (`--primary-fill`), inset highlight; `.btn-o` white outline. Card-row buttons are compact: `height:30px;padding:0 10px;font-size:12px`. `:active` scale .98 (.12s). Phone: ≥40px. | Appendix A |
| G-09 | Bot avatar (`v7c_bot`) | Props `state` ∈ idle/thinking/answered/cannot, `size` (default 56). SVG head (blue gradient #4C8DF8→#1D4ED8 body, #0B1736 visor, #7DD3FC eyes + smile, antenna). Moods ONLY via antenna colour/motion: idle teal #2DD4BF, thinking #7DD3FC pulsing (`vbAnt 1s`) + eyes scan (`vbScan 1.3s` ±9px), answered green #34D399, cannot grey #94A3B8. Smile never changes (owner decision). Used at 16px (info rows), 28px (empty states / chat avatars), 50px. Unique gradient/filter ids per instance. | v7c_bot |
| G-10 | Global Ask VCFO launcher | `#vp-launch` fixed bottom-right (`right:var(--vpl-in)` = clamp(14px,1.25vw+8px,24px)): animated character gripping the bottom edge (`--vpl-w` clamp(96px,4.5vw+72px,148px), SVG 340×216, 20.5 s loop: rise/look/blink/grip keyframes) + navy pill "● Ask VCFO" (36px tall, 40px on phone; teal dot #2DD4BF with 3px glow). Pill hover #17396b, active scale .97. Character ducks (`translateY(100%)`, .32s ease-in) while scrolling (650 ms debounce), while the chat is open, while a sheet is open, or when it would cover a control (hit-test grid); rises with `.5s cubic-bezier(.34,1.45,.5,1)`. Pill toggles the chat; when open the pill reads "× Close". Board-local launchers (`[aria-label="Open Ask VCFO"]`) are hidden at runtime. | proto.js |
| G-11 | Global chat window | `#vp-chat` (section 7.1). | proto.js |
| G-12 | Toast | `#vp-toast` navy, bottom-centre 64px above bottom (100px on phone), max-width min(560px,100vw-32px), `600 13px`, optional gold "Undo" button; in: opacity + translateY 12→0 (.18s/.22s); auto-hide 3200 ms; "Undone" toast after Undo. | proto.js |
| G-13 | Icon-only tooltip (rule 17) | Any icon-only `a/button` with `aria-label` (text ≤2 chars, no `data-tip`, not "obvious") shows a navy fixed tooltip 120 ms after hover, placed above (or below if no room). Obvious labels (Close, Search, Notifications…, WhatsApp/Call/Email/Teams…) get no tooltip. Hidden on pointerdown/scroll. | proto.js |
| G-14 | `data-go` | Any element with `data-go="<route>"` navigates (with the 140 ms leave fade). Controls nested inside a `data-go` tile (buttons, links, `.info`) handle their own click and do NOT trigger the tile. "You are already on X" toast when re-clicking the current route. | proto.js |
| G-15 | Fallback toasts (prototype only) | Any click that changes nothing within 380 ms shows a toast from its label: /download/→"Download started · …", /zip/→"Preparing the ZIP…", /upload|choose file|take photo/→"Choose a file to upload", /copy/→"Link copied", /whatsapp|call|email|teams/→"Opening …", /portal|↗/→"Opens the official portal in a new tab", /approve|submit|send|save|mark|confirm|request|remind|resend|cancel invite|hand off|turn on|turn off/→"<label> · done" + Undo, /search/→"Search · type to find steps, filings and documents", else the label itself. **These mark controls the board did not wire; the real behaviour is given per control below.** | proto.js |
| G-16 | Stagger | Home columns are `.stag` wrappers; each child has an inline `animation-delay` (0.04 s, 0.10, 0.16 … +0.06 per card) and `animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards` (opacity 0, translateY 6px). | v7_before/after |
| G-17 | Current-step pulse | `.pulse{animation:v7pulse 1.8s ease-in-out infinite}`: gold ring `box-shadow 0 0 0 0 → 0 0 0 5px oklch(80% .12 85 / 0)`. | Appendix A |
| G-18 | Bar grow | `.bar>span` / `.stack>span` `animation:grow .9s cubic-bezier(.2,.7,.2,1) .2s backwards` (scaleX 0→1 from left). | Appendix A |
| G-19 | Reduced motion | `@media (prefers-reduced-motion: reduce)`: all animations/transitions off (cards, pills, stagger, bot bob/react, tooltips, pulse, launcher shows head static and fully visible, chat no peek). | Appendix A, proto.js |
| G-20 | Top bar | `header.vh-top` 52px, `gap:var(--vh-hg)` (12px; 6px on phone), `padding:0 var(--vh-hp)` (16px; 10px phone), border-bottom `oklch(91.5% .012 255 / .6)`, background white 90% (sticky via proto.js `pinNav`, z 40). Left→right: menu button (`.vh-menu`, 40×40, hidden ≥768, opens shell drawer `vcfoOpenSide()`), SBC logo link (26px tall; 22px on phone; aria "SBC home"), location trail `nav.vh-crumb` (24px primary-light tile with dashboard icon + "Home"; hidden ≤767), right group gap 6px: Search button 256px wide (`Search` + ⌘ K kbd; collapses to 36px icon ≤1099px), Before/After pill (inserted by shell.js before Announcements, desktop only), Announcements (36px icon → route `announcements`), Notifications (36px, primary-light tinted, badge "3" 15px circle → route `notifications`), Theme (36px outlined; sun icon; toggles theme). Long trails truncate, the right group never moves (v7x_topbar). | v7_before, v7x_topbar |
| G-21 | Sidebar | Real sidebar is drawn by `shell.js` over the `.vh-side` placeholder (width `var(--vp-side-w)`: 248px desktop ≥1280, 72px icon rail 768–1279, 0 + drawer on phone). NAV: Home · Updates (badge 3, red; children Announcements, Notifications) · Incorporation (badge "6/14" before COI; none after) · Compliances (children Calendar, Filings) · Documents (badge 6) · Library · Credentials · Team · Audit · Settings. Team block: Priya Raman (Project Manager), Arjun Mehta (Project Lead), Customer support (SBC help desk), each with WhatsApp/Call/Email/Teams hover actions. Account row RK "Rohan Kumar · Northwind · Client" with menu (Account settings, Sign out). Before/After pill: top bar on desktop, inside the rail on tablet (vertical 56×66), top of the drawer on phone. (`v7c_side`/`v7c_side_a` are the static board version: 248×900, active pill slides `translateY(i*38px)`, same spring.) Owned by the shell-ui inventory; listed here because Home imports it. | shell.js, v7c_side(_a) |

### 3.2 Shared data shapes used by the cards

The drill-down takes `tabs = [[label, count], …]` and `rows = [[name, meta(date), statusLabel, colourKey, tabIndex], …]`; tab 0 = "All" shows every row when its label is "All". Every card that has a chart builds a `__C` array of drill configs and a `__O` array of `[configIndex, activeTab]` openers; `ddN()` opens opener N. Real app: one `<DrillDown title tabs rows activeTab onClose />` component fed from the same data the card renders, rows linking to their real page.

---

## 4. Home BEFORE COI (`v7_before.dc.html`, route `home`)

### 4.1 Composition

| id | area | card (board) | animation-delay |
|---|---|---|---|
| HB-01 | `g` | Greeting `v7c_greet_b` | 0.04s |
| HB-02 | `a` | Needs from Northwind `v7c_needs_b` | 0.10s |
| HB-03 | `a` | Who holds it now `v7c_current` | 0.16s |
| HB-04 | `c1` | Important alerts `v7c_alerts_b` | 0.22s |
| HB-05 | `c1` | What SBC is doing `v7c_sbc_b` | 0.28s |
| HB-06 | `b` | Timeline `v7c_timeline_b` | 0.34s |
| HB-07 | `b` | Steps `v7c_steps_b` | 0.40s |
| HB-08 | `c2` | Recent documents `v7c_docs_b` | 0.46s |
| HB-09 | `c2` | Recent activity `v7c_activity_b` | 0.52s |
| HB-10 | floating | Ask VCFO launcher (global, G-10) | rises .45s after .5s |
| HB-11 | top | Top bar (G-20) + sidebar (G-21) | — |

Grid areas per breakpoint (section 11 has the CSS): <600px one column `g a c1 b c2`; 600–1179 two columns `g g / a a / c1 c2 / b b`; 1180–1799 `2fr 1fr`: `g g / a c1 / a c2 / b c2`; ≥1800 three columns `g g g / a c1 c2 / b b c2`.

### 4.2 Hash `#chat` (route `home-chat`)

Same board; proto.js opens the global chat 500 ms after load when the hash contains `chat` (or `localStorage vcfo.openChat` is true, then cleared).

---

## 5. Home AFTER COI (`v7_after.dc.html`, route `home-after`)

### 5.0 Composition

| id | area | card (board) | animation-delay |
|---|---|---|---|
| HA-01 | `g` | Greeting `v7c_greet_a` | 0.04s |
| HA-02 | `a1` | Needs from Northwind `v7c_needs_a` | 0.10s |
| HA-03 | `a1` | What is next `v7c_next` | 0.16s |
| HA-04 | `c1` | Important alerts `v7c_alerts_a` | 0.22s |
| HA-05 | `c1` | What SBC is doing `v7c_sbc_a` (hint 240px) | 0.28s |
| HA-06 | `a2` | Compliance status `v7c_comp` (donut) | 0.34s |
| HA-07 | `c2` | Company IDs `v7c_ids` | 0.40s |
| HA-08 | `f` | Compliance by area `v7c_area` | 0.46s |
| HA-09 | `f` | Registrations `v7c_reg` | 0.52s |
| HA-10 | `f` | Post-incorporation setup `v7c_postinc` | 0.58s |
| HA-11 | `f` | Timeline `v7c_timeline_a` (completed) | 0.64s |
| HA-12 | `f` | Steps `v7c_steps_a` | 0.70s |
| HA-13 | `d` | Recent documents `v7c_docs_a` | 0.76s |
| HA-14 | `e` | Recent activity `v7c_activity_a` | 0.82s |

Grid areas: <600 one column `g a1 c1 a2 c2 f d e`; 600–1179 two columns `g g / a1 a1 / c1 a2 / c1 c2 / f f / d e` (rows `auto auto auto 1fr`); 1180–1799 six columns `g×6 / a1×4 c1×2 / a1×4 c2×2 / a2×4 c2×2 / f×6 / d×3 e×3` (rows `auto auto 1fr auto`); ≥1800 `g×6 / a1 a1 a2 a2 c1 c1 / a1 a1 c2 c2 c1 c1 / f×6 / d×3 e×3`. Preview height 3240px at 1440.

---

### 5.1 Greeting card (`v7c_greet_b` before, `v7c_greet_a` after)

Inventory

| id | item | behaviour / content | file |
|---|---|---|---|
| GR-01 | Card | `section.vh-greet`, radius 10, `padding:12px clamp(14px,2vw,18px) 10px`, background `linear-gradient(115deg, navy 0%, navy-2 60%, navy-3 100%)` (dark: `--navy-deep` set), white text, overflow hidden; 3px gold underline at the bottom `linear-gradient(90deg,var(--gold),oklch(78% .1 85 / 0) 70%)`. | greet_b |
| GR-02 | Date | Mono 11px, opacity .65, uppercase: "TUE 6 OCT 2026" / "SUN 8 NOV 2026". | |
| GR-03 | Company name | `h1.metric` Space Grotesk 600, `font-size:clamp(19px,calc(15px + .6vw),24px)`, lh 1.15: "Northwind Technologies India Pvt Ltd". | |
| GR-04 | Report button | `a.btn` 30px, padding 0 10px, translucent white (bg 12%, border 28%), download icon + "Report" (label hidden <480px, `.vh-hide-xs`; aria-label "Report"). Not wired in board (fallback toast "Report"). Phone version: "Download report" → toast "Preparing Northwind’s progress report (PDF)…" then after 1400 ms "Report downloaded · Northwind-progress-6-Oct.pdf". **Real: GET `/api/ask/brief?engagementId=` (C4 monthly status brief PDF) exists → download.** | greet_b, mobile |
| GR-05 | Progress ring | 46×46 conic ring (gold arc on 16% white track), inner 37px navy-2 disc with "43%" (`700 11px Space Grotesk`); label under it "SPICE+" (11px, letter-spacing .1em, .7 opacity). Tooltip (white variant, left side): "Incorporation · 6 of 14 SPICe+ steps". Click/Enter → drill-down "Incorporation steps" tab All (GR-08). After: "64%" ring, label "SETUP", tooltip "Setup · 7 of 11 done", drill "Post-incorporation setup" tab "Open". DECISION: ring = SPICe+ steps only (Phases 1+2) before COI. | |
| GR-06 | Divider | 1px white 14%, margin 8px 0 7px. | |
| GR-07 | Stat strip | `.vh-stats` flex-wrap; each stat = metric 18px + 11.5px label (opacity .75), separated by 1px white-14% border with 16px padding/margin. BEFORE: **4** (colour oklch(86% .09 60) amber) "Waiting on Northwind" · **1** "With SBC" · **1** (oklch(84% .09 20) red) "Overdue" · **4/6** "Documents in" · **28 Oct** "Expected COI". AFTER: **4** amber "Waiting on Northwind" · **1** red "Overdue" · **3** amber "Due soon" · **5/13** "Registrations" · **24 Oct** "Incorporated". <600px: grid `repeat(auto-fill,minmax(118px,1fr))`, gap 8px 12px, no separators. Stats are static on desktop (not clickable); on phone each stat is a button opening a drill (section 6). | |
| GR-08 | Drill (before) | Title "Incorporation steps"; tabs All 14 · Completed 6 · In progress 3 · Waiting for Northwind 1 · Upcoming 4. Rows: Client Details 12 Sep Completed · Draft Board Resolution 14 Sep · Signed Board Resolution 18 Sep · Name Application "Part A" · Name Approval 24 Sep · Capital Structure 1 Oct (all Completed/ok) · Proposed Directors 6 Oct In progress · Subscriber Details 10 Oct In progress · Registered Office Address 9 Oct Waiting (due) · KYC Review & DSC 13 Oct In progress · SPICe+ Confirmation 16 Oct · SPICe+ Filing 20 Oct · MCA Remarks 24 Oct · Certificate of Incorporation 28 Oct (Upcoming). Opened on tab 0. | greet_b |
| GR-09 | Drill (after) | "Post-incorporation setup"; tabs All 11 · Open 4 · Completed 7; rows FC-GPR Filing "day 6 of 30 · 2 Dec" Open(due) · Nominee Shareholder (MGT-4/5/6) "day 15 of 30 · 23 Nov" · Share Certificates (SH-1) "day 15 of 60 · 23 Dec" · Commencement (INC-20A) "day 15 of 180 · 22 Apr" (Open/prog) · Registered Office (INC-22) 25 Oct · First Board Meeting 26 Oct · Company Letterhead 27 Oct · Bank Account Opening 29 Oct · Name Board 30 Oct · Share Capital Infusion 2 Nov · Auditor Appointment (ADT-1) 5 Nov (Completed). Opens on tab 1 (Open). | greet_a |

Data → real app

| field | example | source in real app |
|---|---|---|
| date | TUE 6 OCT 2026 | client clock; `src/hooks/use-client-locale-date.ts` |
| company name | Northwind Technologies India Pvt Ltd | `overview.engagement.companyName` (GET `/api/client/overview`, `useClientOverview()` in `src/lib/use-client-overview.ts`, repo `getClientOverview` in `src/db/repositories/client-overview.ts`) |
| ring % before | 43% = 6/14 | `overview.progress.byPhase` → sum of phases `pre-inc-phase-1` + `pre-inc-phase-2` (done/total). Existing. |
| ring % after | 64% = 7/11 | `overview.progress.byPhase` `post-inc-phase-3`. Existing. |
| Waiting on Northwind | 4 | prototype = number of open items in "Needs from Northwind" (2 upload + 1 fill + 1 correct). Real `overview.ballInCourt.waitingOnClient` counts ACTIVE STEPS, not items → **NEW: item-level needs list (see 5.2); count = its length.** |
| With SBC | 1 | `overview.ballInCourt.waitingOnFirm` (existing; step-level). |
| Overdue | 1 | `overview.progress.byStatus.overdue` (steps) + overdue items; after COI also overdue `compliance_instances` (status `overdue`). Partially existing; needs one combined count (NEW derivation in `src/lib/client/client-overview.ts`). |
| Documents in | 4/6 | NEW: requested-documents fulfilled/total. Closest existing: `overview.documents.counts` (requested/submitted are STEP counts). Needs per-file requests (`document_requests` table + repo `src/db/repositories/document-requests.ts` exist; requests are not yet linked to steps → add `step_id`, `due_date`, `kind` columns, see 5.2). |
| Expected COI | 28 Oct | engagement `schedule.incorporation.to` (manager-set window; `normalizeEngagementSchedule`, `src/lib/projects/schedule-windows.ts`). DECISIONS: "Days to COI before COI count down to the manager-set incorporation window end". Not in overview payload → **add `expectedCoiDate` to `ClientOverview`** (repo already loads `row.schedule`). |
| Incorporated | 24 Oct | `overview.engagement.incorporationDate` (existing). |
| Due soon | 3 | `overview.compliance.upcoming` filtered to due within 15 days and not filed (existing data, new derivation). |
| Registrations | 5/13 | `overview.progress.byPhase['registration-phase-4']` gives done/23 (catalog has 23 phase-4 steps). The prototype's 13 = the curated registrations list of `v7c_reg` (section 5.15). Decide denominator (open question Q3). |
| Report | — | GET `/api/ask/brief` (existing PDF). |
| ring drill rows | step, date, status | `overview.milestones` (id, title, kind, completedOn, ownedByClient) + `windowForStep(schedule, id)` for future dates. Existing data; drill component NEW (UI). |

---

### 5.2 Needs from Northwind (`v7c_needs_b`, `v7c_needs_a`)

| id | item | behaviour / content | file |
|---|---|---|---|
| ND-01 | Header | "Needs from Northwind" (h3 13px/700 navy). No (i) on desktop; phone card has (i): "Items Northwind’s project lead asked for. Upload, fill, correct or sign them here." | needs_b, mobile |
| ND-02 | Tabs | Full-width 4-column sliding pill: Upload · Fill · Correct · Sign with counts. Before: 2·1·1·0. After: 2·1·0·1. Default tab 0. Click switches rows (thumb spring .42s). | |
| ND-03 | Row | `display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--hair)`: 18×18 empty checkbox `.box` (2px primary border, radius 4) · title `.rt` 13px/600 + (i) pop-over with the step name · date chip (solid, colour by urgency) · 30px outline button (min-width 76px) with the verb. | |
| ND-04 | Rows before | Upload: "Utility bill - office" (i "Registered Office Address") chip **9 Oct** due · button Upload; "NOC from owner" (Registered Office Address) 9 Oct due · Upload. Fill: "Director 2 - nationality, ID" (Proposed Directors) **11 Oct** prog · Fill. Correct: "Passport copy - page 2" (Proposed Directors) **Overdue 3d** over · Correct. Sign: none. | needs_b |
| ND-05 | Rows after | Upload: "October salary register" (EPF Return · Oct 2026) **In 5 days** due; "Bank FIRC + KYC letter" (FC-GPR Filing) **In 12 days** prog. Fill: "TDS challan details" (TDS Payment · Oct 2026) **Overdue 1d** over. Correct: none. Sign: "FC-GPR declaration" (FC-GPR Filing) **In 20 days** prog. | needs_a |
| ND-06 | Empty state | Before: "Nothing to sign." (any empty tab shows this exact text — prototype bug; should be "Nothing to <verb>."); after: "Nothing here." Plain `.cap` text in a bordered row. Phone version uses the bot bubble (rule 16): "Nothing to sign right now. You are all caught up here." + "Ask VCFO why". Use the bot bubble everywhere. | |
| ND-07 | Upload button | Desktop: not wired (fallback "Choose a file to upload"). Phone: opens bottom sheet titled with the item name: rows "Choose a file — PDF, JPG or PNG · up to 10 MB" and "Take a photo — Use the phone camera"; choosing → sheet closes, toast "Uploaded · <item>" with Undo. **Real: upload against the open request (DECISIONS: uploads only against open requests).** | mobile |
| ND-08 | Fill / Correct / Sign | Desktop fallback toasts. Phone: Fill → toast "Fill · <item> opened" + go `incorporation`; Fix (overdue) opens the upload sheet. **Real: Fill/Correct → the owning step page (`inc-step-N`); Correct reopens via the rejection note; Sign → the signing flow of that step (DSC / e-sign) or the compliance filing.** | mobile |
| ND-09 | Checkbox | Decorative (no click). | |

Data → real app

| field | example | source |
|---|---|---|
| item title | Utility bill - office | **NEW**: there is no item-level "need" today. Closest: (a) `document_requests` rows (title, detail, status pending/fulfilled, requested_by) — table + repo exist but no step link, due date or kind; (b) per-step required documents from `src/data/checklist.ts` (`infoRequired`) + `src/lib/checklist/checklist-responses.ts` field ids (e.g. pre-14 `registeredOfficeUtilityBill…`); (c) `clientFillRequest` on a step slice (`requestClientFill` in engagements repo); (d) rejected steps (`isReviewRejected`, `rejectionNote`) → "Correct"; (e) after COI: `compliance_instances` needing client input. Proposal: extend `document_requests` with `step_id text`, `compliance_instance_id uuid`, `kind text ('upload'|'fill'|'correct'|'sign')`, `due_date date`, `field_id text`, and add `listOpenClientNeeds(ctx, engagementId)` returning a unified list (requests + fill requests + rejected steps) → include as `overview.needs[]` in `/api/client/overview`. |
| subtitle/(i) | Registered Office Address | step title via `getItem(stepId).title` or obligation `particular` + period. |
| date chip | 9 Oct / Overdue 3d / In 5 days | `due_date` (NEW column) or step schedule window `windowForStep(schedule, stepId).to`; label = relative ("In N days", "Overdue Nd") or absolute date. |
| counts per tab | 2·1·1·0 | group by `kind`. |
| upload action | — | existing upload plumbing: `POST /api/documents` (+ S3 `src/storage/s3.ts`), mark request fulfilled `PATCH /api/requests/[id]`. |

---

### 5.3 Who holds it now (`v7c_current`, BEFORE only)

| id | item | behaviour / content |
|---|---|---|
| WH-01 | Header | "Who holds it now". Phone card: "WHO HOLDS IT NOW" + (i) "Northwind’s current step and the steps around it. Tap a step for its details." + footer "Open step 7 →" (route incorporation). |
| WH-02 | Tabs | 3-column pill (full width): **Northwind 3** · **SBC 1** · **MCA 0**. |
| WH-03 | Holder rows (Northwind tab) | Each a bordered box (`border:1px solid var(--border);border-radius:8px;padding:8px 12px;border-left:3px solid var(--<colour>)`), flex-wrap: title + status chip (wrapped in `.tipw` with tooltip; click opens drill on the matching tab) / caption line / button (30px): ① **Registered Office Address** (bold 800) chip "Waiting for Northwind" (due) tip "Waiting for Northwind · 1 step"; caption "Step 7 · due 9 Oct · 2 files missing"; **primary** button "Continue" → `inc-step-7`. ② Proposed Directors · "In progress" (prog) tip "In progress · 3 steps" · "Step 8 · Director 2 details · Northwind fills this" · outline "Continue" → `inc-step-8`. ③ Subscriber Details · In progress · "Step 9 · 3 fields left · Northwind fills this" · "Continue" → `inc-step-9`. |
| WH-04 | SBC tab | KYC Review & DSC · In progress · "Step 10 · Arjun Mehta · 30% · ready 13 Oct" · outline "Open" → `inc-step-10`. |
| WH-05 | MCA tab (empty) | Dashed box (`border:1px dashed var(--border);border-radius:8px;background:var(--raised);padding:10px 12px`) with 28px idle bot + "Nothing is with MCA yet. SBC files SPICe+ on 20 Oct, then MCA reviews it." (`role=status`). Rule-16 bot empty state. |
| WH-06 | "Steps around Northwind" | `.lbl` navy uppercase label then rows (`padding:7px 0;border-top hair`): mono "Step N" (50px) · step name (current step weight 800; upcoming muted) · owner chip (light, min-width 88) · status chip (min-width 116, inside `.tipw` → drill): Step 6 Capital Structure · Northwind · Completed (tip "Completed · 6 steps") / Step 7 Registered Office Address (bold) · Northwind · Waiting (tip "Waiting for Northwind · 1 step") / Step 8 Proposed Directors · Northwind · In progress (tip "In progress · 3 steps") / Step 9 Subscriber Details · Northwind · In progress / Step 10 KYC Review & DSC · **SBC** · In progress / Step 11 SPICe+ Confirmation (muted) · Northwind · "Not started" (up-light chip, tip "Not started · 4 steps"). Window = 1 done step before the current one through 1 upcoming after. |
| WH-07 | Drill | Same "Incorporation steps" config as GR-08, opened on tab 1 (Completed), 2 (In progress), 3 (Waiting) or 4 (Upcoming) depending on the clicked chip. |

Data → real app

| field | example | source |
|---|---|---|
| holders by party | Northwind 3 / SBC 1 / MCA 0 | `overview.milestones` (kind + `ownedByClient`) + statuses; MCA = steps `pre-10` SPICe+ Filing and `pre-11` MCA Remarks when filed and awaiting MCA (NEW derivation: "with MCA" = SPICe+ filed, COI not issued). |
| caption "due 9 Oct · 2 files missing" | | due = `windowForStep(schedule,'pre-14').to`; files missing = count of open needs for that step (NEW needs list). |
| "Director 2 details · Northwind fills this" | | NEW per-step summary line; can be derived from missing required fields (`src/lib/checklist/checklist-responses.ts` + validation modules `src/lib/checklist-*-validation.ts`). |
| "Arjun Mehta · 30% · ready 13 Oct" | | lead name: `overview.team` (role Project Lead); % NEW (lead-side progress per step — not stored; could be fields filled / required); ready date = schedule window. |
| step N label | Step 7 | global catalog index (table in 5.10). |
| Continue → | inc-step-7 | `clientStepHref('pre-14')`. |
| **Conflict** | steps 7, 8, 9 all "In progress" for the client at once and step 10 with SBC | the real gate (`gateActiveCatalog`, `src/lib/checklist/checklist-step-gate.ts`) is SEQUENTIAL: one active step; later steps are `locked`. See Q1. |

---

### 5.4 What is next (`v7c_next`, AFTER only)

| id | item | behaviour / content |
|---|---|---|
| WN-01 | Header | "What is next" + right: 2-tab pill **15 days 4** · **30 days 6** (default 15). Phone (i): "Filings due in the next 15 or 30 days. ↗ opens the official portal." footer "Open Compliances →". |
| WN-02 | Hero row (overdue) | `.tipw` box (`padding:12px 14px;border-radius:8px;background:var(--over-light);border:1px solid oklch(57% .2 22 / .3);margin-bottom:6px`, flex-wrap gap 10px 14px): big date "07" (metric 30px over-text) / "NOV" label · title **TDS Payment · Oct 2026** (14px) + (i) "Waiting on Northwind · TDS challan details · asked by Priya Raman" + chip "Overdue 1 day" (over) · primary 30px "Fill details" → `compliances`. Hover tooltip "TDS Payment · overdue 1 day"; click → drill tab Overdue. |
| WN-03 | Rows | 44×48 date tile (`border-radius:8px;color:#fff;background:var(--<urgency>)`, metric 18px day + 11px/800 month; `.tipw` tooltip "<name> · DD MON", click → drill tab "Next 15 days" if ≤15 days else "16–30 days") · title + (i) "<period> · <area> · SBC by <date>" · owner chip (Northwind = due-chip / SBC = prog-chip) · urgency chip (width 92). 15-day rows: EPF Return & Payment 15 NOV (Oct 2026 · Payroll · SBC by 13 Nov) Northwind "In 7 days" due; ESI Payment 15 NOV SBC In 7 days; PT Payment 20 NOV SBC "In 12 days" prog. 30-day adds: FC-GPR Filing 02 DEC (Share allotment · FEMA · SBC by 28 Nov) Northwind "In 24 days"; TDS Payment 07 DEC (Nov 2026 · Income tax · SBC by 5 Dec) SBC "In 29 days". The overdue item is always the hero, never in the list. |
| WN-04 | Drill | "What is next": All 6 · Overdue 1 · Next 15 days 3 · 16–30 days 2. Rows TDS Payment · Oct 7 Nov Overdue · EPF Return & Payment · Oct 15 Nov In 7 days · ESI Payment · Oct 15 Nov · PT Payment · Oct 20 Nov In 12 days · FC-GPR Filing 2 Dec In 24 days · TDS Payment · Nov 7 Dec In 29 days. Link strip → Compliances. |
| WN-05 | Portal ↗ (phone, rule 15) | Phone rows carry a 40px ↗ icon link to the official portal (incometax.gov.in, unifiedportal-emp.epfindia.gov.in, esic.gov.in, pt.kar.nic.in) + → button opening the drill. Desktop card has no ↗ — rule 15 says every compliance gets one; add it. |

Data → real app

| field | source |
|---|---|
| filings list, due date, period, area | `overview.compliance.upcoming` (repo `loadComplianceRunway`: `compliance_instances` ⋈ `compliance_obligations`, 90-day horizon, fields title/authority/group/dueDate/status/periodLabel). Existing. Overdue items are EXCLUDED today (query is `dueDate >= today`) → **extend to include `status='overdue'` or `dueDate < today and status != 'filed'`.** Also `GET /api/filings` (`src/db/repositories/filings.ts`) and hook `useComplianceFilings` (`src/hooks/use-compliance-filings.ts`). |
| owner (Northwind/SBC) | `compliance_instances.owner_id` (exists, uuid) → whether owner is a client profile or staff. Needs population (NEW data, no column change). |
| "SBC by 13 Nov" | `compliance_instances.window_to` (manager working window; exists) — set via `setComplianceInstanceWindow` (`src/db/repositories/schedule.ts`) / `PATCH /api/filings/[id]/window`. |
| "asked by Priya Raman" / "TDS challan details" | linked client need (NEW needs list with `compliance_instance_id`). |
| portal URL | NEW static map authority → portal URL (front-end constant). |

---

### 5.5 Important alerts (`v7c_alerts_b`, `v7c_alerts_a`)

| id | item | behaviour / content |
|---|---|---|
| AL-01 | Header | "Important alerts" + 2-tab pill: before **15 days 3 · 30 days 3** (default 15); after **15 days 1 · 30 days 2** (default **30 days**, `state.tab=1`). DECISION: before COI, dated items only. Phone (i): "Dated items only, nearest first." |
| AL-02 | Hero overdue row | Same red box as WN-02 but with a 22px octagon-alert icon (over-text). Before: **Passport copy sent back** + (i) "Proposed Directors · page 2 · waiting on Northwind" + chip "Overdue" + primary "Fix" → `inc-step-8`. Tooltip "Passport copy · overdue 3 days". After: **TDS Payment overdue 1 day** + (i) "Interest runs until paid · waiting on Northwind" + chip Overdue + "Fill details" → `compliances`. Tooltip "TDS Payment · overdue 1 day". Click (not on the button) → drill tab Overdue. |
| AL-03 | Dated rows | 44×48 date tile (bg `var(--<k>)` solid, white) · title + (i) meta · status chip width 92. Before (all ≤15 days, so both tabs show the same 3): 09 OCT "2 office documents" (i "Registered Office Address") "In 3 days" due · 10 OCT "MOA & AOA drafts" (i "Review") "In 4 days" prog · 14 OCT "Approved name expires" (i "File Part B before") "In 8 days" due. Before tiles are NOT clickable; after tiles are `.tipw` (tooltip "<title> · DD MON", click → drill tab ≤15 → 1 else 2). After: 15 NOV "3 payroll dues" (EPF · ESI · PT for Oct 2026) In 7 days due · 02 DEC "FC-GPR due" (Bank FIRC needed) "In 24 days" prog · (23 DEC "Share certificates (SH-1)" 60-day limit… In 45 days — beyond 30, never shown). |
| AL-04 | Drill | "Important alerts" before: All 4 · Overdue 1 · Next 15 days 3 (rows Passport copy sent back 3 Oct Overdue; 2 office documents 9 Oct In 3 days; MOA & AOA drafts 10 Oct In 4 days; Approved name expires 14 Oct In 8 days). After: All 4 · Overdue 1 · Next 15 days 1 · Later 2 (TDS 7 Nov; 3 payroll dues 15 Nov; FC-GPR due 2 Dec In 24 days; Share certificates (SH-1) 23 Dec In 45 days). Drill link → Notifications (title matches /alert/). |
| AL-05 | Phone | Rows are buttons (tile + title + "In N days" + chevron) → drill "Important alerts" with tabs 15 days 3 · 30 days 3. |

Data → real app

| alert | source |
|---|---|
| Passport copy sent back (overdue) | rejected step slice: `isReviewRejected(slice)` + `rejectionNote` on `pre-15` (Proposed Directors); date = review date `reviewedAt`. Existing data. |
| 2 office documents due 9 Oct | open needs for `pre-14` with due date (NEW needs list). |
| MOA & AOA drafts 10 Oct | SBC deliverable with a date: step `pre-9` SPICe+ Confirmation / incorporation docs (`app/api/engagements/[id]/incorporation-docs/share`) + schedule window. NEW: "dated item" derivation. |
| Approved name expires 14 Oct | `pre-5` response `nameApprovalExpiryDate` (exists in `checklist-responses.ts`). Existing data, NEW derivation. |
| TDS overdue / payroll / FC-GPR / SH-1 | `compliance_instances` (status, due_date) + post-inc statutory windows (5.17). |
| Proposal | NEW pure function `buildAlerts(state, schedule, compliance, needs, now)` in `src/lib/client/client-overview.ts` → `overview.alerts[] {id,title,meta,date,severity:'over'|'due'|'prog',href}`. |

---

### 5.6 What SBC is doing (`v7c_sbc_b`, `v7c_sbc_a`)

| id | item | behaviour / content |
|---|---|---|
| SB-01 | Header | "What SBC is doing". Phone (i): "Work the SBC team is doing now. Tap for the detail." |
| SB-02 | Row | `padding:9px 0;border-top hair`: title + (i) "<person> · <step> · ready <date>" · `.pct` (11.5px/800, width 36, right) · 26px outlined link-icon button (aria "Open Step N", → `inc-step-N`) · below: 6px bar (`.bar`, grow animation) filled `var(--prog)` or `var(--up)` at 0%. |
| SB-03 | Rows before | KYC Review & DSC 30% (Arjun Mehta · Step 10 · ready 13 Oct) → inc-step-10 · MOA & AOA drafts 0% (Arjun Mehta · Step 11 · drafts reach Northwind 10 Oct) → inc-step-11 · DSC for both directors 0% (Arjun Mehta · Step 10 · ready 13 Oct) → inc-step-10 · File SPICe+ Part B 0% (Priya Raman · Step 12 · ready 20 Oct) → inc-step-12. |
| SB-04 | Rows after | PT Registration 70% (Arjun Mehta · Registrations · ready 12 Nov) · IEC Registration 50% (Arjun Mehta · Registrations · ready 14 Nov). Link icon aria "Open Registrations", no `data-go` (fallback toast) → real: `inc-phase-4` or the specific step (`reg-7` PT = step 29, `reg-8` IEC = step 33). |
| SB-05 | No tooltip/drill on bars (desktop). Phone rows are buttons → drill "What SBC is doing": tabs In progress / Not started, rows "<n>% · Arjun Mehta" / "Not started yet". Rule 14 says bars should also have hover tooltips; add "<task> · 30% · ready 13 Oct". |

Data → real app

| field | source |
|---|---|
| work items | NEW. Today only step-level: milestones with `ownedByClient=false` and gate `waiting`/in-progress (`overview.milestones`, `ballInCourt.waitingOnFirm`). Sub-tasks like "MOA & AOA drafts", "DSC for both directors" are not modelled → could come from `tasks` (repo `src/db/repositories/tasks.ts`, `GET /api/tasks`) filtered to engagement + client-visible flag (**NEW column `visible_to_client boolean`, `progress_pct int`, `due_at` exists as `deadline`**). |
| person | task assignee → profile name (team). |
| % | NEW (`tasks.progress_pct`) or derive from step field completion. |
| ready date | `tasks.deadline` or `windowForStep(...).to`. |

---

### 5.7 Timeline (`v7c_timeline_b`, `v7c_timeline_a`) + editor

| id | item | behaviour / content |
|---|---|---|
| TL-01 | Header | "Timeline" + (i) "Last changed by Priya Raman on 1 Oct 2026". Right: BEFORE outline button 30px with pencil icon "Edit" → opens the timeline editor (`tl-editor.js`, proto.js intercepts any "Edit" in a card whose h3 is "Timeline"). AFTER: no Edit; chip "Completed" (ok-light/ok-text). When a client change request is pending, a chip button `.tle-pend` "Change request pending · COI <date>" (amber `#fdecd3`/#8a4b0f, 24px, 800 11px) is inserted before Edit; click → toast "Waiting for Priya Raman to approve · “<reason…>”". DECISION: the change-request warning stays visible. |
| TL-02 | Chart frame | `.vh-tl` (horizontal scroll on narrow screens) padding `12px 16px 30px`; inner `min-width:600px`; grid `150px minmax(0,1fr)`. |
| TL-03 | Axis | Mono caption labels at weekly ticks, `translateX(-50%)`: before axis 12 Sep → 7 Nov (12 Sep 0%, 19 Sep 12.28%, 26 Sep 24.56%, 3 Oct 36.84%, 10 Oct 49.12%, 17 Oct 61.4%, 24 Oct 73.68%, 31 Oct 85.96%, 7 Nov 98.25%; span 57 days). After axis 63 days (ticks 0, 11.11 … 88.89%). Vertical 1px hair grid lines at each tick. |
| TL-04 | Today line | 2px `var(--over)` line `top:-4px` + chip at the bottom (`bottom:-20px`, over-chip, padding 0 6px) "Today 6 Oct" (42.11%) / "Today 8 Nov" (90.48%). |
| TL-05 | Rows (30px each) | Label `.rt` 12px · bar (`position:absolute;top:5px;bottom:5px;border-radius:4px`, `.tipw` with tooltip, click → drill on that phase tab) · caption after the bar (`left:calc(<end>% + 8px)`, 700). BEFORE: Phase 1 · Name Application 0–21.05% ok, "Done 24 Sep", tip "Phase 1 · Name Application · 12 Sep – 24 Sep · done" / Phase 2 · Incorporation 22.81%+43.86% `var(--prog)`, "22%", tip "… · 25 Sep – 20 Oct · 22%" / MCA review 66.67%+14.03% `var(--up)`, tip "MCA review · 20 Oct – 28 Oct" / COI 80.7% w 1.76% navy, "28 Oct", tip "COI · expected 28 Oct". AFTER: all ok: Phase 1 0–19.05% "Done 24 Sep"; Phase 2 20.63%+34.93% "Filed 17 Oct" tip "· 25 Sep – 17 Oct · filed"; MCA review 55.56%+11.11% tip "17 Oct – 24 Oct · done"; COI 66.67% "24 Oct" tip "COI · 24 Oct". |
| TL-06 | Drill | "Timeline phases": Phase 1 · Name 5 · Phase 2 · Incorporation 7 · MCA review 1 · COI 1 (no All tab; opens on the clicked phase). Rows = the 14 SPICe+ steps tagged by phase (after: all Completed, MCA Remarks "17–24 Oct"). |
| TL-07 | Editor | Section 8.6. Saving re-animates the card bars (`left/width .5s cubic-bezier(.22,1,.36,1)`), updates tooltips and the COI label, and rewrites the (i) text to "Last changed by Northwind just now". |
| TL-08 | Phone | Card "Timeline" (i) "Planned dates for each phase. The red line is today." + outline "Edit" button (40px) + gantt (section 6) + footer "Open Incorporation →". After: (i) "Incorporation is complete.", no Edit. |

Data → real app

| field | source |
|---|---|
| phase windows | engagement `schedule` jsonb `{ incorporation?: Window, steps?: {[itemId]: Window} }` (`src/lib/projects/schedule-windows.ts`; repo `setEngagementWindow` in `src/db/repositories/schedule.ts`; route `PUT/PATCH /api/engagements/[id]/schedule`). Phase window = min(from)/max(to) of its steps' windows (DECISIONS: "Phase end date = latest step date in the phase"). MCA review = windows of `pre-10`/`pre-11`; COI = `schedule.incorporation.to` (before) or `incorporationDate` (after). |
| % in Phase 2 | `progress.byPhase` pct. |
| "Last changed by …" | latest audit event of action `schedule.*` (`listAuditEvents`), or NEW `schedule_updated_by/at` inside the schedule jsonb. |
| Client change request | **NEW**: `engagement_change_requests.kind` today = delete_project/change_client/change_manager (`src/db/repositories/engagement-change-requests.ts`, routes `/api/engagement-change-requests`). Add kind **`timeline`** with payload `{ phases:[{id,from,to}], coiFrom, coiTo, slipDays }`, `reason` (required), status pending→approved/rejected by the manager; on approve call `setEngagementWindow`. Pending request exposed in overview (`overview.timelineRequest`). Manager direct edit = existing schedule write (role-gated by `canSetScheduleWindows`). Notifications on save: "email and WhatsApp to admin, manager, lead and client" (manager board) → `notifyEngagementEvent` + WhatsApp templates (NEW event `timeline_changed`). |

---

### 5.8 Steps card (`v7c_steps_b`, `v7c_steps_a`)

| id | item | behaviour / content |
|---|---|---|
| ST-01 | Header | "Steps" + right link "Open Incorporation →" (`data-go="incorporation"`, 12px/700). |
| ST-02 | Phase accordions | 4 `<details class="stp-g">` (gap 8px): border 1px, radius 8, overflow hidden. `summary`: flex gap 10, padding 10px 12px, hover raised; chevron 14px rotates 90° when open (.25s); phase name is a link (`a.stp-ph`, inherits colour, 800) → phase page; status chip (min-width 116) "x of y"; mono caption state. Open body animates `stpIn .28s` (opacity, translateY -4px). BEFORE: Phase 1 · Name Application "5 of 5" ok "done" → `inc-phase-a`; **Phase 2 · Incorporation "1 of 9" prog "in progress" (open by default)** → `inc-phase`; Phase 3 · Post-Incorporation "0 of 11" up "upcoming" → `inc-phase-3`; Phase 4 · Registration "0 of 23" up "upcoming" → `inc-phase-4`. AFTER: Phase 1 5/5 done; Phase 2 9/9 ok done; **Phase 3 "7 of 11" prog in progress (open)**; Phase 4 "5 of 23" prog in progress. |
| ST-03 | Table | Inside `.vh-x` (scrolls horizontally inside its box, `--tmin:560px`). Columns: # (mono caption 600) · Step (`.rt` 12.5px) · Owner chip (light; Northwind/SBC) · Status chip (min-width 116) · Timeline (`.stp-tl` 11.5px muted, wraps, 110–190px) · 28px arrow button (`.stp-go`, aria "Open step N · <name>"). Whole row is `data-go="inc-step-N"` (cursor pointer); row hover moves the arrow 2px right with primary-light bg. |
| ST-04 | Rows | 48 rows; full list in 5.10 with owner, status before/after and "Timeline" text (e.g. "2–3 working days", "Within 30 days of incorporation", "No statutory time limit", "14–15 working days from filing (Phase 2 Step 6)"). |

Data → real app

| field | source |
|---|---|
| phases, step titles, owner, timeline text | `src/data/checklist.ts` (`getIncorporationPhases()`; `item.responsibleRole` client→"Northwind", intern→"SBC"; `item.timeline`). Note: client-overview.ts comment says the working-days SLA "is no longer shown" (replaced by the manager window `formatWindow`). Prototype still shows the playbook timeline text → Q4. |
| status | `overview.milestones[].kind` (done/active/waiting/locked) + slice status (`coerceStatusCode`); label map: done→Completed (ok), active→Waiting (due) for client-owned / In progress (prog), waiting→In progress (prog), locked→Upcoming (up), overdue→Overdue. |
| x of y | `progress.byPhase[].done/total`. |
| default open | the phase containing the current step. |

---

### 5.9 Recent documents (`v7c_docs_b`, `v7c_docs_a`)

| id | item | behaviour / content |
|---|---|---|
| RD-01 | Header | "Recent documents" + right link "Documents →" (not wired → real: route `documents`). |
| RD-02 | Group labels | `p.rd-g` 800 10px uppercase subtle + trailing hair line: BEFORE "Last week", "Earlier"; AFTER "This week", "Last week", "Earlier". Grouped by arrival. |
| RD-03 | Row | `.rd-r` (`role=button tabindex=0`, `data-go="doc-viewer"`, title "<name> · <TYPE> · <d Mon yyyy> · from <who>"): file-type badge 20×20 radius 6 (`700 7px/20px IBM Plex Mono`; JPG teal-light/teal-chip, PDF over-light/over-text, DOCX prog-light/prog-text) · name (12.5px/500, ellipsis) · meta "Northwind" (gold-text when uploaded by the client) or "SBC" · "·" · mono date · 26px download icon button (aria "Download <name>", hover primary-light). Row hover raised. Below 330px the "who" and separator hide. DECISION rule 9: row click → preview overlay; actions 👁 Preview · ⬇ Download (the board only shows ⬇; the row itself previews). |
| RD-04 | Rows before | Last week: Director 1 - passport · JPG · Northwind · 2 Oct. Earlier: Name approval letter · PDF · SBC · 24 Sep; Signed Board Resolution · PDF · Northwind · 18 Sep; Draft Board Resolution · DOCX · SBC · 14 Sep. |
| RD-05 | Rows after | This week: Share capital FIRC · PDF · Northwind · 2 Nov. Last week: GST certificate · PDF · SBC · 1 Nov; Board meeting minutes · PDF · SBC · 26 Oct. Earlier: Certificate of Incorporation · PDF · SBC · 24 Oct. |
| RD-06 | Phone | Rows with 38×20 type badge (PDF over, JPG oklch(47% .09 195), DOCX oklch(51% .17 252)), name + date, 40px 👁 (→ doc-viewer) and ⬇ (toast "Download started · <name>") buttons; footer "Open Documents →". Phone (i) "The newest files from Northwind’s project. 👁 previews, ⬇ downloads." (typo in source: "Northwindr"). |

Data → real app

| field | source |
|---|---|
| list | `GET /api/documents?engagementId=` → `listDocuments(ctx)` (`src/db/repositories/documents.ts`; client sees only `shared_with_client=true` and released step files) ordered by `created_at desc`, limit 4–6. Plus firm deliverables `overview.documents.deliverables` (COI, PAN/TAN cards, MOA/AOA, GST/IEC certs) whose files live in `checklist_state` paths. Merge both sources (NEW small server derivation or client merge). |
| who | `uploaded_by` → profile role (client → company short name, staff → "SBC"). |
| type | `content_type`/extension of `file_name`. |
| preview | `GET /api/documents/[id]/signed-url` (S3 presigned) / `GET /api/milestone-documents/signed-url` → doc viewer overlay (10.1). |
| download | same signed URL with `content-disposition: attachment`. |

---

### 5.10 Step number ↔ checklist id ↔ owner/status (used by Steps card, drills, `inc-step-N`)

Global N = position in `getIncorporationPhases()` order (from `prototype/incorporation-steps.json`). Owner: client→"Northwind", intern→"SBC". Status B = before card, A = after card. Timeline = text shown in the Steps card.

| N | id | title | owner | status B | status A | timeline text |
|---|---|---|---|---|---|---|
| 1 | pre-1 | Client Details | Northwind | Completed | Completed | 2–3 working days |
| 2 | pre-2 | Draft Board Resolution | SBC | Completed | Completed | 1–2 working days |
| 3 | pre-3 | Signed Board Resolution | Northwind | Completed | Completed | 3–4 working days |
| 4 | pre-4 | Name Application | SBC | Completed | Completed | 1–2 working days |
| 5 | pre-5 | Name Approval | SBC | Completed | Completed | 5–7 working days |
| 6 | pre-13 | Capital Structure | Northwind | Completed | Completed | 1 working day |
| 7 | pre-14 | Registered Office Address | Northwind | **Waiting** | Completed | 1 working day |
| 8 | pre-15 | Proposed Directors | Northwind | In progress | Completed | 4–5 working days |
| 9 | pre-16 | Subscriber Details | Northwind | In progress | Completed | 1 working day |
| 10 | pre-7 | KYC Review & DSC | SBC | In progress | Completed | 2–3 working days |
| 11 | pre-9 | SPICe+ Confirmation | Northwind | Upcoming | Completed | 2–3 working days |
| 12 | pre-10 | SPICe+ Filing | SBC | Upcoming | Completed | 1–2 working days |
| 13 | pre-11 | MCA Remarks | SBC | Upcoming | Completed | 5–7 working days |
| 14 | pre-12 | Certificate of Incorporation | SBC | Upcoming | Completed | 14–15 working days from filing (Phase 2 Step 6) |
| 15 | post-1 | First Board Meeting | SBC | Upcoming | Completed | Within 30 days of incorporation |
| 16 | post-9 | Company Letterhead | SBC | Upcoming | Completed | Within 30 days of incorporation |
| 17 | post-3 | Bank Account Opening | SBC | Upcoming | Completed | No statutory time limit |
| 18 | post-4 | Share Capital Infusion | SBC | Upcoming | Completed | Within 180 days of incorporation |
| 19 | post-5 | Share Certificates (SH-1) | SBC | Upcoming | In progress | Within 60 days of incorporation |
| 20 | post-6 | Commencement (INC-20A) | SBC | Upcoming | In progress | Within 180 days of incorporation |
| 21 | post-2 | Auditor Appointment (ADT-1) | SBC | Upcoming | Completed | Within 30 days of incorporation |
| 22 | post-7 | FC-GPR Filing | SBC | Upcoming | In progress | Within 30 days of incorporation |
| 23 | post-8 | Nominee Shareholder (MGT-4/5/6) | SBC | Upcoming | In progress | Within 30 days of incorporation |
| 24 | post-11 | Registered Office (INC-22) | SBC | Upcoming | Completed | Within 30 days of incorporation |
| 25 | post-10 | Name Board | SBC | Upcoming | Completed | Within 30 days of incorporation |
| 26 | reg-4 | GST Registration | SBC | Upcoming | Completed | Within 2 weeks of incorporation |
| 27 | reg-1 | PF Registration | SBC | Upcoming | Completed | No statutory time limit |
| 28 | reg-3 | ESI Registration | SBC | Upcoming | Completed | No statutory time limit |
| 29 | reg-7 | PT Registration | SBC | Upcoming | In progress | No statutory time limit |
| 30 | reg-6 | LEI Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| 31 | reg-15 | MSME Registration | SBC | Upcoming | Completed | No statutory time limit |
| 32 | reg-16 | ICEGATE Registrations | SBC | Upcoming | Upcoming | No statutory time limit |
| 33 | reg-8 | IEC Registration | SBC | Upcoming | In progress | No statutory time limit |
| 34 | reg-5 | LUT Filing | SBC | Upcoming | Completed | No statutory time limit |
| 35 | reg-11 | Non-STPI Compliance | SBC | Upcoming | Upcoming | No statutory time limit |
| 36 | reg-9 | Shops & Establishment | SBC | Upcoming | In progress | No statutory time limit |
| 37 | reg-13 | CLRA Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| 38 | reg-14 | POSH / SHE Box | SBC | Upcoming | Upcoming | No statutory time limit |
| 39 | reg-10 | Trade Licence | SBC | Upcoming | Upcoming | No statutory time limit |
| 40 | reg-12 | Trademark Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| 41 | reg-17 | Trademark Renewal | SBC | Upcoming | Upcoming | No statutory time limit |
| 42 | reg-18 | Patent Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| 43 | reg-19 | ICDR Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| 44 | reg-20 | FCGPR Filing | SBC | Upcoming | Upcoming | Within 30 days of incorporation |
| 45 | reg-21 | FDI Reporting | SBC | Upcoming | Upcoming | No statutory time limit |
| 46 | reg-22 | ODI Reporting | SBC | Upcoming | Upcoming | No statutory time limit |
| 47 | reg-23 | FLA Return | SBC | Upcoming | Upcoming | No statutory time limit |
| 48 | reg-24 | FCTRS Filing | SBC | Upcoming | Upcoming | No statutory time limit |

Phase counts: 5 / 9 / 11 / 23. "Step 7 of 14" in the DECISIONS label = SPICe+ numbering (Phases 1+2 = 14 steps); the Steps card numbers 1–48 globally; the phone current step says "Now · step 7 of 14".

---

### 5.11 Recent activity (`v7c_activity_b`, `v7c_activity_a`)

| id | item | behaviour / content |
|---|---|---|
| RA-01 | Header | "Recent activity" + 3-tab pill All · SBC · Northwind (before 4·3·1, after 5·3·1). Phone (i) "Who did what, newest first." |
| RA-02 | Row | grid `96px minmax(0,1fr) auto`, gap 12, padding 8px 0, border-top hair: mono date 12px/600 · text `.rt` 600 · actor caption. |
| RA-03 | Rows before | 5 Oct 2026 · 2 documents requested · Arjun Mehta (sbc) / 4 Oct 2026 · Proposed Directors saved · Northwind (client) / 3 Oct 2026 · Passport copy sent back · Arjun Mehta / 1 Oct 2026 · Capital Structure accepted · Priya Raman. |
| RA-04 | Rows after | 8 Nov 2026 · TDS Payment overdue · VCFO Suite (system; appears only under All) / 5 Nov · TDS details requested · Priya Raman / 3 Nov · ESI registration done · Arjun Mehta / 2 Nov · Share capital received · Northwind / 1 Nov · GST certificate delivered · Arjun Mehta. |
| RA-05 | Filter | SBC = staff actors; Northwind = client actors; All = everything. No empty state designed (use bot bubble "Nothing here yet."). Phone rows prefix a set-A status glyph (done/you/late). |

Data → real app: `overview.activity[]` (id, at, label) from `listAuditEvents(ctx,{engagementId,limit:40})`, 12 newest, internal actions hidden (`HIDDEN_AUDIT_ACTIONS`). Missing: actor name/role → **extend `ClientOverviewActivity` with `actorName` and `actorKind: 'firm'|'client'|'system'`** (columns `actor_name`, `actor_role` already exist in `audit_events`). Alternative source `GET /api/activity` (`listActivity`). System events (overdue) need a writer (compliance job `src/jobs/compliance-generate.ts`) → NEW audit/activity row "TDS Payment overdue".

---

### 5.12 Compliance status donut (`v7c_comp`, AFTER only)

| id | item | behaviour / content |
|---|---|---|
| CS-01 | Header | "Compliance status" + (i) "Hover a slice for its count · click a slice, a legend row or the centre to see the list" + right chip "FY 2026-27" (up-light, min-width 116). |
| CS-02 | Donut | 140×140 `conic-gradient(var(--ok) 0 2.6%, var(--due) 2.6% 10.5%, var(--over) 10.5% 13.2%, var(--up) 13.2% 100%)`; inner 98px white disc is a link (title "Show all") with "38" (metric 28px) + caption "this FY". Body padding `22px 16px 16px`, flex gap 20, align center. |
| CS-03 | Legend | 4 link rows (`padding:6px 8px;margin:0 -8px;border-radius:6px`): 10px square swatch · label (500) · mono "n (p%)": Filed 1 (3%) · **Due soon 3 (8%)** (pre-highlighted `background:var(--raised)`) · Overdue 1 (3%) · Upcoming 33 (87%). |
| CS-04 | Interaction (intended) | The board does NOT wire slices/legend/centre (fallback toast). Intended per (i) text, rule 14 and `v7p_compliance`: hover a slice → tooltip "<status> · n"; click a slice / legend row → compliance pop-up (8.2) with that status tab pre-selected; click centre → same pop-up on "All". (DECISIONS: "The compliance donut keeps its own pop-up (same pattern)".) Phone: SVG donut 110px (r 44, stroke 14, `stroke-dasharray` animates .9s cubic-bezier(.22,1,.36,1)), each arc `role=button` with `<title>` "<status> · n"; legend buttons with Space Grotesk counts; tap → bottom-sheet drill "Compliance status · FY 2026-27" (rows: Filed: ROC · AOC-4 FY25 "Filed 28 Oct"; Due soon: EPF Return & Payment · Oct 15 Nov · Northwind, ESI Payment · Oct 15 Nov · SBC, PT Payment · Oct 20 Nov · SBC; Overdue: TDS Payment · Oct 2026 "Overdue 1 day · Northwind"; Upcoming: GSTR-1 · Nov 11 Dec, GSTR-3B · Nov 20 Dec, FC-GPR 2 Dec, "… 30 more · Open Filings"); rows → `filings`. Footer "Open Filings →". |

Data → real app: counts by status of `compliance_instances` for the engagement in the current FY (`fy_label`). Existing source: `GET /api/filings` (`getFilings` in `src/db/repositories/filings.ts`, hook `useComplianceFilings`). Overview's runway only covers +90 days → either call `/api/filings?engagementId=&fy=` from the card, or **add `overview.compliance.fyCounts {filed,dueSoon,overdue,upcoming,total,fyLabel}`** (NEW aggregate in `client-overview.ts` repo). "Due soon" threshold = due within 15 days and not filed (define as constant; compliances page uses the same).

---

### 5.13 Company IDs (`v7c_ids`, AFTER only) and the PAN/TAN reveal

| id | item | behaviour / content |
|---|---|---|
| ID-01 | Header | "Company IDs" + (i) "PAN and TAN need your password to show" + right link "COI →" (12px/700; not wired → real: open the Certificate of Incorporation in the doc viewer). |
| ID-02 | Rows | grid `62px minmax(0,1fr) auto`, gap 6px 10px, padding 9px 0, border-top hair: `.lbl` key (+ "Private" chip for secrets: navy bg, gold text, padding 0 5px, 11px) · mono 12.5px/600 value · 26px action button. CIN `U72900KA2026FTC198431` + Copy (primary-light square) · PAN `AAKC••••1M` (letter-spacing .06em) + **Show PAN** (navy square, eye icon) · TAN `BLRN••••2D` + **Show TAN** · GSTIN `29AAKCN4821M1Z5` + Copy. Mask rule: first 4 + "••••" + last 2. |
| ID-03 | Copy | Desktop fallback toast "Link copied"; phone: `navigator.clipboard.writeText` + toast "Copied · <value>". Real: clipboard + toast "Copied". |
| ID-04 | Show PAN/TAN (desktop) | Not wired on the card (fallback toast "Show PAN"). The designed modal is `v7p_ids_password` (route key `ids-password`, section 8.3): "Confirm it's you" + account password; "Shown for 60 seconds". |
| ID-05 | Show PAN/TAN (phone) | Bottom sheet "Show PAN": label "Your password" + password input (44px, prefilled ••••••••) + "🔒 Shown for 60 seconds, then hidden again." + navy button "Show PAN". Submit → sheet closes, value replaced by the full value (`AAKCN4821M` for PAN, `BLRN04392D` for TAN — note TAN digits differ from the masked value's source `BLRN04822D` on the Credentials page; demo typo) in `--ok-text` colour, toast "PAN shown for 60 s"; after 60 000 ms it reverts to the masked value. Phone rows also carry a 40px ↗ portal link (MCA, incometax.gov.in, tin-nsdl.com, gst.gov.in) per rule 15. |
| ID-06 | Phone (i) | "PAN and TAN stay hidden. Reveal asks for your password and hides again after 60 s." |

Data → real app

| field | source |
|---|---|
| CIN, PAN, TAN | `overview.identifiers` (`identifiersFromState`: pre-12 responses `cin`, `pan`, `tan`, also `pfCode`, `esiCode`). Existing. **Security change needed:** the overview currently ships PAN/TAN in clear to the browser. For the reveal design, the API must return masked PAN/TAN and expose a NEW `POST /api/client/identifiers/reveal {field:'pan'|'tan', password}` that re-verifies the session user's password (bcrypt against `profiles.password_hash`, same check as `app/api/account/password/route.ts`), rate-limits (3 tries → lock; v7p_ids_password shows "Wrong password. 2 tries left."), writes an audit event (`identifiers.reveal`), and returns the clear value once. Client hides it after 60 s. |
| GSTIN | reg-4 response `gstinNumber` (`src/lib/checklist/checklist-responses.ts`) — not in `identifiersFromState` today → **add `gstin`** (also `iecCode`, `leiNumber`, `pfRegistrationNumber`, `esiRegistrationNumber` for the Registrations card). |
| COI → | `overview.documents.deliverables` entry `pre-12:certificateOfIncorporationFinalUrl` → milestone signed URL. |
| portal ↗ | static map. |

---

### 5.14 Compliance by area (`v7c_area`, AFTER only)

| id | item | behaviour / content |
|---|---|---|
| CA-01 | Header | "Compliance by area" + chip "FY 2026-27 · as of 8 Nov 2026" (up-light). DECISION: 5 areas MCA · GST · Income tax · Payroll · FEMA. |
| CA-02 | Tabs | 6-tab pill full width with `.vh-segwrap` (wraps on phone): All 38 · MCA 2 · GST 10 · Income tax 7 · Payroll 18 · FEMA 1. |
| CA-03 | All tab | Table in `.vh-x` (`--tmin:600px`), 12.5px, margin-top 10: Area · Total · Filed (ok-text) · Due soon (due-text) · Overdue (over-text) · Mix (26% width, 10px `.stack` of segments, each a `.tipw` with tooltip "<Area> · <Status> · n", click → drill "<Area> · filings" on that status tab) · Status chip. Rows: MCA / ROC 2·1·0·0 "Compliant" ok; GST 10·0·0·0 "Upcoming" up; Income tax / TDS 7·0·0·1 "Overdue" over; Payroll (PF / ESI / PT) 18·0·3·0 "Due soon" due; FEMA / RBI 1·0·0·0 "Upcoming" up. Total row (border-top 1.5px, 800): 38 · 1 · 3 · 1. |
| CA-04 | Single-area tab | Summary line: metric 22px area name + caption "<n> filings this FY · f filed · d due soon · o overdue"; table Filing · Period · Due / filed · Status: MCA: ADT-1 (auditor appointment) FY 2026-27 "Filed 5 Nov 2026" Filed; Commencement (INC-20A) One-time 22 Apr 2027 Upcoming. GST: GSTR-1 Nov 2026 11 Dec 2026; GSTR-3B Nov 2026 20 Dec 2026. Income tax: TDS Payment Oct 2026 7 Nov 2026 Overdue; TDS Payment Nov 2026 7 Dec 2026 Upcoming. Payroll: EPF Return & Payment / ESI Payment Oct 2026 15 Nov 2026 Due soon; PT Payment 20 Nov 2026 Due soon. FEMA: FC-GPR Filing "Share allotment" 2 Dec 2026 Upcoming. Footer caption "Showing k of n · full list in Filings" or "Showing all n". |
| CA-05 | Drills | 5 configs (one per area): tabs All · Filed · Due soon · Overdue · Upcoming with area totals; 20 openers (area × status 1..4). Link strip → Filings. |

Data → real app: `compliance_instances` ⋈ `compliance_obligations` grouped by `complianceGroupForAuthority(authority)` (exists in `src/lib/client/client-overview.ts`: GST, Income tax, Payroll, MCA, FEMA, Other). Status buckets from `status` + due date. Source `GET /api/filings` / `getFilings` (existing, FY filter) → NEW grouping helper (pure). "Other" group is not in the design (5 areas) — fold or hide (Q5).

---

### 5.15 Registrations (`v7c_reg`, AFTER only)

| id | item | behaviour / content |
|---|---|---|
| RG-01 | Header | "Registrations" (no right control). |
| RG-02 | Tabs | 6-tab wrapping pill: All 13 · Tax 2 · Labour 4 · Business 4 · IP 1 · FEMA 2. |
| RG-03 | Table | `.vh-x` `--tmin:720px`: Registration · Category · Authority (caption) · Number (mono 11.5px/600, "-" when none) · Date (mono right) · Status chip · download icon (only when Registered; aria "Download certificate", title "Certificate"). Rows: GST Registration · Tax · GSTN · 29AAKCN4821M1Z5 · 1 Nov 2026 · Registered / LUT Filing · Tax · GSTN · AD291126001234X · 3 Nov 2026 · Registered / PF Registration · Labour · EPFO · KNBNG2954118000 · 2 Nov 2026 · Registered / ESI Registration · Labour · ESIC · 53001234560001001 · 3 Nov 2026 · Registered / PT Registration · Labour · Karnataka CTD · – · Est. 12 Nov 2026 · In progress / Shops & Establishment · Labour · Karnataka Labour Dept · – · Est. 15 Nov 2026 · In progress / MSME Registration · Business · Ministry of MSME · UDYAM-KR-03-0123456 · 30 Oct 2026 · Registered / IEC Registration · Business · DGFT · – · Est. 14 Nov 2026 · In progress / Trade Licence · Business · BBMP · Dec 2026 · Upcoming / LEI Registration · Business · LEIL · Dec 2026 · Upcoming / Trademark Registration · IP · IP India · Jan 2027 · Upcoming / FCGPR Filing · FEMA · RBI · FIRMS · By 2 Dec 2026 · Upcoming / FLA Return · FEMA · RBI · By 15 Jul 2027 · Upcoming. |
| RG-04 | Phone | "Registrations" (i) "Every registration with its portal ↗ and its proof 📎." Rows: status glyph · name · "<authority> · <date>" · "📎 Proof" chip button (→ doc-viewer) or amber "Proof pending" chip (filed, no proof) or nothing (not filed) · ↗ portal. Rows: GST (GSTN · 1 Nov, done, proof) · PF (EPFO · 2 Nov, done, proof) · ESI (ESIC · 3 Nov, done, Proof pending) · PT (Karnataka CTD · est. 12 Nov, with SBC) · IEC (DGFT · est. 14 Nov, with SBC) · Trademark (IP India · Jan 2027, upcoming). Rule 15 asks for the same ↗ / 📎 on desktop → add. |

Data → real app: registration steps `reg-*` (phase 4) in `checklist_state`: status (gate), numbers from responses (`gstinNumber`, `lutArn`, `pfRegistrationNumber`, `esiRegistrationNumber`, `iecCode`, `leiNumber`…; MSME/Udyam, PT, S&E have no number fields yet — **NEW fields** in `src/lib/checklist/checklist-responses.ts` for reg-7/reg-9/reg-10/reg-12/reg-15), dates (`gstRegistrationDate`, `pfRegistrationDate`, …), estimated dates = schedule window. Category/authority = NEW static map per step id (front-end). Certificate = step file (e.g. `gstCertificateUrl`, `iecCertificateUrl`) via milestone signed URL. **NEW pure builder `buildRegistrations(state, schedule)` → `overview.registrations[]`.**

---

### 5.16 Post-incorporation setup (`v7c_postinc`, AFTER only)

| id | item | behaviour / content |
|---|---|---|
| PI-01 | Header | "Post-incorporation setup" + chip "Day 15 since COI" (up-light, min 116). |
| PI-02 | Section label | "OPEN · STATUTORY WINDOW USED" (`.lbl` navy). |
| PI-03 | Row | title + (i) · owner chip (Northwind due-light / SBC prog-light) · mono due date (min-width 80, right) / below: 10px track (`background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);radius 3`) as `.tipw` (tooltip "<name> · day d of N · due <date>", click → drill tab Open) with fill = d/N (FC-GPR `var(--due)`, others `var(--prog)`) · mono caption "day d of N". Rows: FC-GPR Filing (i "Within 30 days of share allotment (2 Nov) · Bank FIRC + KYC letter needed") Northwind · 2 Dec 2026 · 20% · day 6 of 30 / Nominee Shareholder (MGT-4/5/6) (i "Within 30 days of incorporation · 50% done") SBC · 23 Nov 2026 · 50% · day 15 of 30 / Share Certificates (SH-1) (i "Within 60 days of incorporation · 60% done") SBC · 23 Dec 2026 · 25% · day 15 of 60 / Commencement (INC-20A) (i "Within 180 days of incorporation · 40% done") SBC · 22 Apr 2027 · 8.3% · day 15 of 180. Note: the bar shows window used, the (i) shows work done. |
| PI-04 | Completed box | Bordered box (radius 8, padding 10px 12px): check icon · "7 completed" (dotted underline, `.tipw` tooltip "Completed · 7 items", click → drill tab Completed) + (i) listing "First Board Meeting · 26 Oct · Registered Office (INC-22) · 25 Oct · Company Letterhead · 27 Oct · Bank Account Opening · 29 Oct · Name Board · 30 Oct · Share Capital Infusion · 2 Nov · Auditor Appointment (ADT-1) · 5 Nov". |
| PI-05 | Drill | = GR-09 config (All 11 · Open 4 · Completed 7). |
| PI-06 | Phone | Card "Post-incorporation setup" (i) "Statutory windows that started on the COI date." Rows buttons: name, "<owner> · <date> · day d of N", 8px bar (`var(--due)` if >45% used else `var(--navy-3)`); tap → drill Open/Completed. |

Data → real app: phase 3 steps `post-*` (`overview.milestones`, `progress.byPhase`), statutory window N from the step's playbook timeline text ("Within 30/60/180 days of incorporation") → NEW parsed constant per step id; day d = today − `incorporationDate` (or share-allotment date for FC-GPR: `post-7` responses `fcgprRemittanceDate`/allotment). Owner from `responsibleRole` (all intern in catalog; FC-GPR shown as Northwind because the client must upload FIRC → derived from open needs). "% done" NEW (step sub-progress). Also the compliance engine already generates event filings (`compliance_events`, e.g. `fc_gpr`) — reuse due dates from there.

---

### 5.17 Card-level empty / loading / error states (real app)

The Home boards show no loading or error states. Use: L1 skeleton (DECISIONS: shown after 150 ms, held ≥300 ms; phone implements it, 6.4) for the whole page; existing `ClientOverviewSkeleton`; error → `EmptyStateIllustrated` "We could not load your dashboard" + "Try again" (existing in `src/views/client/Overview.tsx`); no engagement → "No active engagement". Per-card empties must use the bot bubble (rule 16): MCA tab (WH-05) is the designed example.

---

## 6. Phone Home (`s/home/mobile.html`; routes `home` <700px, `#after`, `#chat`)

One self-contained file (own CSS, own render script; Appendix C). `.app` max-width 560px centred (outside it the page bg is `#dfe5ee`), `padding-bottom:120px`, `overflow-x:clip`. State: `AFTER = location.hash==='#after' || localStorage vcfo.after===true`.

### 6.1 Inventory

| id | item | behaviour / content |
|---|---|---|
| M-01 | Top bar | sticky 56px, white 94% + blur 8px, border-bottom: 44px menu button (`data-vp-menu` → shell drawer `vcfoOpenSide()`, fallback internal drawer M-30) · logo (VCFO icon 23×26) + "Home" (800 15px) · spacer · 44px Search (opens search sheet M-25) · Announcements (→ `announcements`) · Notifications (primary colour, badge "3" 17px) (→ `notifications`). |
| M-02 | Skeleton (L1) | `#app.sk` on load: every `.card` and `.greet` hides its children and shows a shimmer block (`inset:12px;radius 6px`; gradient 600px, `sh 1.2s linear infinite`; greet uses navy shimmer). Removed after 450 ms (0 with reduced motion), then count-up + draw-in. |
| M-03 | Stagger | `.wrap>*{animation:fu .3s cubic-bezier(.22,1,.36,1) both}` (opacity, translateY 8px), delay `i*0.06s`. |
| M-04 | Greeting | `.greet` navy (flat `var(--navy)`, not gradient), radius 12, padding 14px 14px 12px, radial gold glow top-right (180px). Date mono 11px .08em oklch(82% .03 255); h1 700 19px/1.2 max-width 260px. Ring button 62×62 (SVG r 26, stroke 6, track white 14%, gold arc round caps, animates `stroke-dasharray` 1s cubic-bezier(.22,1,.36,1)); value 700 14px Space Grotesk counts up; label "SPICE+"/"SETUP" under it. aria "Incorporation 43% — open steps" → steps drill. |
| M-05 | Stats | Grid 3 columns (first 3 stats) + grid 2 columns (last 2), gap 6, margin-top 16/6: each a button (white 8% bg, radius 8, padding 8) with value (600 20px Space Grotesk; numbers count up 900 ms ease-out-cubic) + label (11.5px). Before: 4 Waiting on Northwind · 1 With SBC · 1 Overdue · 4/6 Docs in · 28 Oct Expected COI. After: 4 Waiting on Northwind · 1 Overdue · 3 Due soon · 5/13 Registrations · 24 Oct Incorporated. Taps: Waiting → steps drill tab "Northwind"; With SBC → steps drill tab "SBC"; Overdue/Due soon → "Due and overdue" drill (tabs Overdue 1 · Due soon 3; before overdue row "Passport copy — Meera Shah · Sent back 3 Oct · fix now" → incorporation; after "TDS Payment · Oct 2026 · Overdue 1 day · Northwind" → compliances; Due soon rows EPF/ESI/PT → compliances); Docs in → "Documents" drill (In 4: Director 1 — passport, Name approval letter, Signed Board Resolution, Capital structure note; Missing 2: Utility bill — office, NOC from the owner, due 9 Oct) → documents; Registrations → "Registrations" drill (Done 5 · With SBC 2 · Upcoming 6); Expected COI / Incorporated → go `incorporation`. |
| M-06 | Greeting buttons | Row of 2 equal 40px buttons: gold "⬇ Download report" (GR-04) and translucent "Open Incorporation" (→ incorporation). |
| M-07 | Card chrome | `.card.t` (gold 34×3 tab at left 14px), header `.ch` padding 14px 14px 10px, title `h2` 800 12px uppercase .07em navy + (i) (24px button, 8px hit expansion; pop 250px max). Optional footer `.go` (full-width, border-top hair, padding 11px 14px, 800 12px primary, chevron). |
| M-08 | Needs | Card "Needs from Northwind" + pill (38px buttons) Upload 2 · Fill 1 · Correct 1 · Sign 0 (after: Upload 2 · Fill 1 · Correct 0 · Sign 1). Rows (52px min): date tile 42×46 (over = red, due = amber, up = raised grey, navy) · title (700 13.5px) + subtitle (11.5px muted) · 40px button (navy if overdue else outline). Before rows: Upload: "Utility bill — office" "Step 7 · asked by Arjun Mehta" 9 OCT; "NOC from the owner" same 9 OCT; Fill: "Subscriber details" "Step 9 · 3 fields left" 10 OCT; Correct: "Passport copy — Meera Shah" "Sent back · blurred scan" 5 OCT over, button "Fix". After: Upload "October salary register" "Payroll · asked by Priya Raman" 13 NOV; "Bank FIRC + KYC letter" "FC-GPR · asked by Arjun Mehta" 20 NOV; Fill "TDS payment details · Oct" "Overdue 1 day" 07 NOV over; Sign "Board minutes — 1st meeting" "Sign with DSC" 12 NOV. Empty tab → bot bubble "Nothing to <verb> right now. You are all caught up here." + "Ask VCFO why" (opens chat). Actions: ND-07/ND-08. (Phone demo data differs from desktop — see Q8.) |
| M-09 | Who holds it now (before) | Focus track (DECISIONS style E): dashed 4px rail at left 25px with green fill animating to 34% height (.9s, delay .2s); "✓ 5 done · Phase 1" green fold chip (→ steps drill Done); step rows with set-A status glyph (24px circles: done green ✓, now navy + gold clock with pulsing gold ring 1.9s, you amber person, sbc blue arrow, up light grey, late red !) + name + caption; current step rendered as a navy card (radius 12, shadow) with gold eyebrow "NOW · STEP 7 OF 14", title, caption "Step 7 · Northwind · due 9 Oct" and sub-step ticks (2 done green, 1 gold, 1 grey); rows: Capital Structure (Step 6 · done 1 Oct) · Registered Office Address (current) · Proposed Directors (Step 8 · Northwind · in progress) · Subscriber Details (Step 9 · Northwind · in progress) · KYC Review & DSC (Step 10 · SBC · in progress) · SPICe+ Confirmation (Step 11 · Northwind · from 16 Oct); bottom fold "+3 more · SPICe+ filing → COI" (→ drill Upcoming). Each row → steps drill on its group. Footer "Open step 7 →" (→ incorporation). Glyph tooltips: "Waiting on Northwind · due 9 Oct", "In progress · You", "With SBC". |
| M-10 | Timeline (before) | Header "Timeline" + (i) + outline "Edit" (opens tl-editor). Gantt rows grid `112px 1fr`, gap 9: label 700 11.5px + 14px track; bars animate scaleX .8s with `i*0.08s` delay: Phase 1 · Name Application 0–18% green; "Phase 2 · 22%" 20–68% navy-3; MCA review 68–86% up; "COI · 28 Oct" 88–90% gold; red "Today" line at 47% with "Today" label. Each row → steps drill. Footer "Open Incorporation →". After: rows all green ("COI · 24 Oct" gold), no Today line, no Edit, (i) "Incorporation is complete." |
| M-11 | Important alerts (before only) | (i) "Dated items only, nearest first." Rows: 09 OCT 2 office documents In 3 days (due) / 10 OCT MOA & AOA drafts In 4 days (due) / 14 OCT Approved name expires In 8 days (up) → drill "Important alerts". No overdue hero on phone. |
| M-12 | What SBC is doing | Rows: glyph (sbc if >0% else up) + name + 8px bar (blue oklch(56% .19 262)) + mono "%"; before KYC Review & DSC 30, MOA & AOA drafts 0, DSC for both directors 0, File SPICe+ Part B 0; after PT Registration 70, IEC Registration 50 → drill. |
| M-13 | What is next (after) | Pill 15 days 4 · 30 days 6 (toast only: "Showing the next 15 days · 4 filings" / "… 30 days · 6 filings"; list does not change — wire it). Rows: tile · title · "<when> · <owner>" · ↗ portal link (new tab) · → drill "Due and overdue". Footer "Open Compliances →". |
| M-14 | Compliance status (after) | 6.1/CS-04. Footer "Open Filings →". |
| M-15 | Company IDs (after) | ID-05. |
| M-16 | Registrations (after) | RG-04. |
| M-17 | Post-incorporation setup (after) | PI-06. |
| M-18 | Recent documents | RD-06; before rows JPG Director 1 — passport 6 Oct · PDF Name approval letter 24 Sep · PDF Signed Board Resolution 18 Sep · DOCX Draft Board Resolution 16 Sep; after PDF Certificate of Incorporation 24 Oct · Board meeting minutes 2 Nov · GST certificate 1 Nov · Share capital FIRC 2 Nov. |
| M-19 | Recent activity | Pill All · SBC · Northwind; rows glyph + text + "<date> · <who>". |
| M-20 | Card order | Before: greet, Needs, Who holds it now, Timeline, Important alerts, What SBC is doing, Recent documents, Recent activity. After: greet, Needs, What is next, Compliance status, Company IDs, Registrations, Post-incorporation setup, What SBC is doing, Timeline, Recent documents, Recent activity. (No Steps card and no Compliance-by-area card on phone.) |
| M-21 | Bottom sheet | `.sheet` fixed bottom, width min(100%,560px), max-height min(82vh,100dvh-24px), radius 14 14 0 0, grab handle 40×4, header h3 800 16px + 44px close; slides `translate(-50%,105%)→0` with the spring (.38s); scrim fades .2s; body `sheet-open` hides the prototype bar and the launcher pill; Esc/scrim/× close; focus returns to the opener; re-tapping the same opener toggles it closed. Used for drills, upload, reveal, search, chat. |
| M-22 | Drill in sheet | Pill of parts (selected = clicked) + rows (`.row` buttons with glyph, title, sub, chevron) → close + go route; empty → bot "Nothing here right now." Steps drill "Incorporation steps": Done 6 · Northwind 3 · SBC 1 · Upcoming 4 with the 14 STEPS (Client Details "Step 1 · done 12 Sep", Draft BR "done 16 Sep", Signed BR "done 20 Sep", Name Application "done 24 Sep", Name Approval "done 24 Sep", Capital Structure "done 1 Oct", Registered Office Address "Step 7 · Northwind · due 9 Oct", Proposed Directors, Subscriber Details, KYC Review & DSC "Step 10 · SBC · in progress · 13 Oct", SPICe+ Confirmation "Step 11 · 16 Oct", SPICe+ Filing 20 Oct, MCA Remarks 24 Oct, Certificate of Incorporation 28 Oct). |
| M-23 | Launcher | The board's own `.launch` is hidden (`display:none!important`); `window.__vcfoOwnChat=true` makes the global pill open THIS file's chat sheet (M-26). The robot sinks while scrolling (`.sink`, 420 ms debounce) — DECISION "Robot while scrolling: sinks down". |
| M-24 | Count-up | `[data-count]` numbers animate 0→N over 900 ms (ease-out cubic) after the skeleton; skipped for non-integers ("4/6", "28 Oct"). |
| M-25 | Search sheet | "Search" sheet: 44px input "Search steps, filings, documents" + sample results Registered Office Address (Step 7 · Incorporation) / Certificate of Incorporation (Document → documents) / GSTR-3B · Oct (Filing → filings). Real: shell command palette (⌘K) — owned by shell agent. |
| M-26 | Chat sheet (`#chat`, launcher) | Sheet "Ask VCFO": bubble "Hello. Ask me anything about Northwind’s setup, or pick a question below." · suggestion buttons (40px, primary-light) · compose (42px input + navy Send). Before Q&A: "What is my next step?", "Where is my incorporation now?", "Which documents are missing?"; after: "What is due next?", "Which registrations are pending?", "When is FC-GPR due?" (answers 7.1). Typing dots 900 ms; unknown → "I can’t answer that one yet. I’ve passed it to Northwind’s project lead." + "Hand off to Arjun Mehta" → toast "Arjun Mehta will reply by email within 1 working day" + Undo. `#chat` hash opens it 700 ms after load. |
| M-27 | Report | GR-04 phone behaviour. |
| M-28 | Proof chip | → `doc-viewer`. |
| M-29 | Download | toast "Download started · <name>". |
| M-30 | Fallback drawer | Only if shell.js is missing: navy drawer (300px) with links Home (current, inset 3px blue bar) / Updates / Incorporation / Compliances / Documents / Library / Team / Audit, "Northwind’s team" (PR Priya Raman Project Manager, AM Arjun Mehta Project Lead, ☎ Customer support "SBC help desk · +91 90597 90014"), account link "Rahul Khanna · Northwind · Client" (name inconsistent with Rohan Kumar, Q9). |

### 6.2 Phone breakpoints
`mobile.html` is used below 700 px. Between 700 and 767 the DESKTOP board renders with phone rules (`max-width:767px` blocks in Appendix A: menu button shown, crumb hidden, 40px touch targets, pills wrap, no card hover lift, `.vh-pbar` 52px bar for pop-up boards). In the real app there is one responsive page: use the phone composition (6.1) below 768 px (README contract says phone ≤767) and drop the 700 px file swap.

---

## 7. Ask VCFO chat

### 7.1 Runtime chat (what users actually get in the prototype; proto.js `#vp-chat`)

| id | item | behaviour / content |
|---|---|---|
| C-01 | Window | Floating card above the launcher pill: `right:var(--vpl-in)`, width clamp(340px,24vw+40px,440px), height min(clamp(480px,62vh,680px), viewport minus pill), radius 12, 1px border, shadow `0 24px 60px -20px`. Opens with `translateY(12px) scale(.96)` → none, opacity, .26s cubic-bezier(.22,1,.36,1) from bottom-right origin. Phone ≤767: full-width bottom sheet, radius 16 16 0 0, height min(640px, 100dvh − 20px − peek), safe-area padding, 40px+ targets, input 16px font. |
| C-02 | Peek character | The robot peeks over the top edge once per open: hands grip in (.32s, right hand +.09s), head rises (.95s cubic-bezier(.3,.75,.35,1), delay .22s), looks left/right (2.2s from 1.25s), then blinks every 6.5s. DECISION "Peek animation plays once when the chat opens". |
| C-03 | Header | Navy bar: 36px white circle with static head · "Ask VCFO" (800 14px) / "Answers from Northwind’s project data" (11.5px #c7d2e2) · 36px "×" close (aria "Close chat"). |
| C-04 | Messages | `aria-live=polite` list: first bot bubble "Hello. Ask me anything about Northwind’s setup, or pick a question below."; user bubbles navy right (radius 10 10 2 10); bot bubbles light (#f1f4f8, radius 10 10 10 2), max 84%. Log persists in `sessionStorage vcfo.chat`. |
| C-05 | Suggestions | Wrap row of chips (32px; primary-light, 1px rgba(46,92,255,.35)): before "What is my next step?" / "Where is my incorporation now?" / "Which documents are missing?"; after "What is due next?" / "Which registrations are pending?" / "When is FC-GPR due?". |
| C-06 | Answers | Before: next step → "Step 7 · Registered Office Address is waiting for Northwind. Upload the utility bill and the owner NOC by 9 Oct, then approve. Steps 8 Proposed Directors and 9 Subscriber Details are also in progress with Northwind." · where → "Northwind is in Phase 2 · Incorporation: 1 of 9 steps done, 6 of 14 SPICe+ steps overall (43%). Step 7 is waiting for Northwind, steps 8 and 9 are in progress with Northwind, and step 10 KYC Review & DSC is with SBC. The COI is expected on 28 Oct." · missing → "Two, both for step 7 · Registered Office Address: the office utility bill and the NOC from the owner. Both are due 9 Oct." After: due next → "TDS Payment · Oct 2026 is overdue by 1 day. Next are EPF and ESI on 15 Nov." · registrations → "Two are with SBC: PT Registration (est. 12 Nov) and IEC (est. 14 Nov)." · FC-GPR → "2 Dec 2026, day 6 of the 30-day window. Upload the bank FIRC + KYC letter first." |
| C-07 | Thinking | Typing bubble with 3 dots (`vpTh 1s`, .2s/.4s delays) for 900 ms; antenna pulses (`vpc-think`). |
| C-08 | Moods | Answered → antenna green #22C55E + hop (.7s); cannot answer → grey #94A3B8 + dip (1.2s). DECISION: green = answered, grey = can't answer; face always smiling. |
| C-09 | Can't answer | "I can’t answer that one yet. I can pass it to Northwind’s project lead." + button "Hand off to Arjun Mehta" → appends "Sent to Arjun Mehta. You will get a reply by email within 1 working day." + toast "Handed off to Arjun Mehta" (Undo). |
| C-10 | What's this? card | When a screen provides `window.vcfoWhatsThis(q)` (Incorporation pages), the answer renders as a card: title, paragraph, "Why it matters to Northwind" block, "Source: …", and a button "Open this step"/"Open <page>" → route. |
| C-11 | Composer | 40px input "Type a question" + navy Send; empty submit → focus + toast "Type a question first, or pick one above". Esc closes. Focus moves to input on open, back to the pill on close. |
| C-12 | "Ask VCFO about this" | From any (i) pop-over → opens chat and asks "Tell me about <heading>". |

Real app: `src/components/ask/*` (AskLauncher, AskPanel, AskComposer, AskHandoffForm, WhatsThisButton, AskProvider), hooks `src/hooks/ask/*` (`use-ask-status`, `use-ask-suggestions`, `ask-api`), routes `POST /api/ask/chat` (NDJSON stream: status labels + one answer), `GET /api/ask/suggestions`, `POST /api/ask/handoff` (→ `createAskHandoff`: task for the lead + bell), `GET /api/ask/status` (launcher enabled), `GET /api/ask/library`, `GET /api/ask/brief`, `GET/POST /api/ask/nudge` (first-visit note "once per client" → `ask_client_prefs`). Spec: `docs/specs/ask-vcfo`. All existing; Home only needs to mount the launcher and pass "Ask VCFO about this" questions.

### 7.2 Design boards `v7chat_*` (1440×900 canvases over `v7_before`)

| id | board | content |
|---|---|---|
| CB-01 | `v7chat_launcher` | Closed state with first-visit note: card 300px (radius 10, shadow) above the launcher, slides up `v7up .35s` after .9s: "Hello. Ask me anything about Northwind’s setup, or pick a question below." + dismiss × (24px) + 2 suggestion chips (30px) "What is my next step?" / "Where is my incorporation now?". Navy "Ask VCFO" label + 68px round launcher (bobbing 2.6s). DECISION: first-visit bot note once per client. |
| CB-02 | `v7chat_home` (state v=home) | Panel 400×640 at right 24 / bottom 104, radius 12, `animation:v7up .3s`. Header navy: 36px avatar · "Ask VCFO" / green dot "Answers from verified sources" · 32px "Expand to side panel" · 32px close. Navy hero "Hello," / "Northwind Technologies" (metric 21px) overlapped by a white project card: "NORTHWIND’S PROJECT" + chip "SPICe+ Part B" (prog) / "Registered Office Address" (700 13.5px) / 5px progress bar 18% / caption "7 of 38 steps done". "QUICK QUESTIONS" + 2-tab pill "About Northwind’s project 2" · "Learn the basics 4"; tab 0: "What is my next step?", "Where is my incorporation now?" (→ thinking → answer after 1600 ms); tab 1: "What is SPICe+ Part A?", "What is GST, and do we need it?", "What happens after incorporation?", "What is FC-GPR?" (40px rows with → arrow). "PICK UP WHERE NORTHWIND LEFT OFF": Last conversation (i "What is SPICe+ Part A?") · Northwind’s Library (i "Explanations Northwind saved from Ask VCFO") · Monthly status brief (i "PDF · October 2026"). DECISION: "Pick up where you left off" = 1 item (board shows 3 links: conversation is the 1 item; Library + brief are shortcuts). Composer: input "Ask about Northwind’s setup…" (38px) + (i) "Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions." + 38px Send (40% opacity when empty). Peek image `vcfo-bot-peek.svg` 132×107 above the panel (white outline drop-shadows). Launcher becomes a navy close button. |
| CB-03 | `v7chat_thinking` (v=thinking) | Header gains a back button. User bubble "Where is my incorporation now?" (right, radius 12 12 4 12, light grey). Bot row: 28px avatar + typing dots + sr-only "Finding sources…" + 3-stage status list: ✓ "Checking Northwind’s project…" (ok-text) · spinner "Finding sources…" · dashed circle "Writing…" (subtle). |
| CB-04 | `v7chat_answer` (v=answer) | Avatar does `react` (.55s scale/rotate). Answer card: chip "✓ Reviewed by SBC" (ok-light) · "7 of 38 steps are complete. You're in SPICe+ Part B, on Registered Office Address.¹" · 2×2 phase grid (each `.tipw`, click → drill "Where Northwind’s incorporation is": SPICe+ Part A 5 · SPICe+ Part B 9 · Post-incorporation 11 · Registration 13): "DONE / SPICe+ Part A / 5 of 5" (grey-tint), "NORTHWIND IS HERE / SPICe+ Part B / 2 of 9" (primary border + primary-light), "NEXT / Post-incorporation / 0 of 11" (dashed), "NEXT / Registration / 0 of 13" (dashed) · gold-ruled "Why it matters to Northwind — Each phase unlocks the next, so this is the step that moves Northwind forward." · buttons "Open Incorporation →" (primary outline) / "Open Registered Office Address →" · "SOURCES ¹ Northwind’s project". Under the card: "Ask my lead" small button · "Helpful?" 👍 👎 (30px). DECISION: keep 👍/👎. |
| CB-05 | `v7chat_handoff` | Question "Can our registered office be a co-working space?" → card chip "AI answer · check with Northwind’s lead" + "I’m not certain about this one. Northwind’s project lead can answer it." + highlighted "Ask my lead". Hand-off form (border-top 3px primary): person row (36px photo placeholder, "Arjun Mehta" + (i) "Project Lead · replies by email", caption Project Lead) · label "Ask Northwind’s project lead" + (i) "The last 4 messages go with it, so they have the context." · textarea (3 rows, prefilled with the question) · Cancel (ghost) / primary "Send to lead". Sent state: green status strip "Sent to Northwind’s project lead. They’ll reply by email." + "Close". |

Inconsistencies: CB-02 says "7 of 38 steps" (= 9-step SPICe+ Part B counted… prototype mixes 38/48 totals); runtime says "6 of 14 SPICe+". Phase 4 shown as 13 here vs 23 in the Steps card. See Q3.

---

## 8. Pop-up boards and the timeline editor

All pop-up boards sit over a dimmed Home (`oklch(20% .05 258 / .55)`), dialog `role=dialog aria-modal=true`, white, radius 12, shadow `0 24px 60px -20px oklch(15% .05 258 / .55)`; header row padding 14px 18px with title `700 15px` navy + (i) + 30px outlined × close; footer bar `padding:12px 18px;border-top;background:var(--raised)`.

### 8.1 Step pop-up (`v7p_step`, 760px wide, top 24px, over v7_before)

Not routed in the prototype (design board). Real use: step detail pop-up opened from Home step rows/chips (rule 13 allows pop-ups for step details); "Continue step" goes to the step page.

| id | item | content |
|---|---|---|
| SP-01 | Hero header | Navy gradient (115deg navy→navy-2 70%→navy-3), padding 16px 20px 14px, gold 3px underline: mono gold eyebrow "STEP 7 OF 14 · PART B" · 32px close (white 12%) · h2 metric 24px "Registered Office Address" + white (i) "Office address for the company, with proof of address and the owner's NOC." · chips: "Waiting on Northwind" (due-chip, min 116) · "Due 9 Oct · 3 days" (over-chip) · "Owner · Northwind" (white 16%). |
| SP-02 | Timeline (option A "Connected chips", picked) | 4 stage chips joined by 2px connectors: **Started** (ok-light, ✓ icon, "2 Oct", (i) "Rohan Kumar started this step on 2 Oct 2026.") —gradient ok→navy— **Submitted** (navy filled, gold pulsing dot, "Due 9 Oct", (i) "Waiting for Northwind. Due 9 Oct 2026, in 3 days.", 4px navy halo) —dashed— **Reviewed** (dashed border, hollow dot, "Arjun Mehta", (i) "Arjun Mehta, Project Lead, checks the documents.") —dashed— **Completed** ("Priya Raman", (i) "Priya Raman, Project Manager, signs off."). |
| SP-03 | Needed from Northwind | Label + count chip "2" (due-chip); amber box (due-light, 1px oklch(66% .17 48 / .35), radius 8): rows checkbox (due border) · "Utility bill for the office" (i "Electricity or water · Max 2 months old · Asked by Arjun Mehta · Due 9 Oct") · outline "⬆ Upload" (30px, min 88); "NOC from property owner" (i "Signed, on plain paper · Asked by Arjun Mehta · Due 9 Oct") · Upload. |
| SP-04 | Documents | Row (title "Open preview", clickable): 32px PDF badge · "Rent agreement" (i "Uploaded by Northwind on 2 Oct 2026.") · chip "Uploaded" (ok) · 28px 👁 Preview / ⬇ Download. Missing rows (dashed rows per DECISIONS "missing files as dashed rows"; here grey icon tile): "Utility bill" (i "Electricity or water · Max 2 months old") chip "Missing" (over) · "NOC from property owner" (i "Signed, on plain paper") Missing. DECISION rule 8: no "Not uploaded" text under a Missing badge. |
| SP-05 | What was provided | 2-column definition grid: Address (span 2) "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103" · State Karnataka · Premises Leased · Owner "—" (i "Not given yet. Northwind adds this when the step is completed.") · Proof of address "—" (same i). |
| SP-06 | Footer | Primary "Continue step →" (→ step page) · outline "🤖 Ask VCFO about this step" (opens chat) · outline "✉ Message Arjun (lead)". |

Data: step slice from `checklist_state` (status, `clientSubmittedAt`, `reviewedAt/By`, `completedOn`), responses via `extractItemResponses` (`src/lib/checklist/checklist-responses.ts`), required docs/needs (NEW needs list), step files (`listDocuments` with `step_id` / milestone paths), schedule window. "Message Arjun" → NEW or existing messaging (`app/app/client/messages` folder exists) / `POST /api/ask/handoff`.

### 8.2 Compliance pop-up (`v7p_compliance`, 760px, over v7_after)

| id | item | content |
|---|---|---|
| CP-01 | Header | "Compliances · FY 2026-27" + (i) "As of 8 Nov 2026" + ×. |
| CP-02 | Tabs | 5-tab pill: All 38 · Filed 1 · Due soon 3 · Overdue 1 · Upcoming 33 (opens on the clicked donut part; board default tab 1 = Filed). |
| CP-03 | Table | Filing · Period · Area · Due / filed (mono right) · Status chip: TDS Payment Oct 2026 Income tax 7 Nov 2026 Overdue · EPF Return & Payment Oct 2026 Payroll 15 Nov 2026 Due soon · ESI Payment … 15 Nov 2026 Due soon · PT Payment … 20 Nov 2026 Due soon · ADT-1 (auditor appointment) FY 2026-27 MCA "Filed 5 Nov 2026" Filed · FC-GPR Filing "Share allotment" FEMA 2 Dec 2026 Upcoming · TDS Payment Nov 2026 7 Dec · GSTR-1 Nov 2026 GST 11 Dec · GSTR-3B Nov 2026 20 Dec · Commencement (INC-20A) One-time MCA 22 Apr 2027 (Upcoming). |
| CP-04 | Footer | caption "Showing k of n · full list in Filings" / "Showing all n" + outline "Open Filings" (→ `filings`). |

Data: `getFilings` (`GET /api/filings?engagementId=&fy=`), status buckets as 5.12.

### 8.3 PAN/TAN password reveal (`v7p_ids_password`, route key `ids-password`, over v7_after)

| id | item | content / behaviour |
|---|---|---|
| IP-01 | Frame | Full-viewport board (`100vh`), dim layer `.vh-under-bar` (starts under the 52px phone bar ≤767); dialog `width:min(400px,100%)` centred, padding 12 around. Phone: `.vh-pbar` (menu + logo + "Home"). |
| IP-02 | Header | "Confirm it's you" + (i) "Enter your password to show your PAN" + × (30px). |
| IP-03 | Field | Label `.lbl` navy "Password"; 40px input row (`border:1.5px solid var(--over)` in the error state shown), `type=password`, value "sbc-demo-pass" read-only in the board, 600 15px, letter-spacing .12em; 30px "Show password" eye toggle (raised bg). |
| IP-04 | Error | `role=alert` over-text 12px/700 with alert icon: "Wrong password. 2 tries left." |
| IP-05 | Link | "Forgot password?" (12px) → account password reset (real: existing auth flow / `app/api/account/password`). |
| IP-06 | Footer | (i) "Shown for 60 seconds" · outline "Cancel" · primary "Confirm". |
| IP-07 | States to build | idle (normal border) → submitting → success (close, value shown in green for 60 s, auto re-mask; toast "PAN shown for 60 s") → wrong (red border + "Wrong password. N tries left.") → locked after 3 wrong (disable, "Too many tries. Try again in m:ss" — copy NEW, mirror credentials lock). Esc / × / Cancel close. |
| IP-08 | Backend | NEW `POST /api/client/identifiers/reveal` (see 5.13). Note the Credentials page uses a DIFFERENT gate (manager OTP) for the same PAN — Q2. |

### 8.4 Timeline change request board (`v7p_timeline_client`, 980px)

| id | content |
|---|---|
| TC-01 | Title "Request a timeline change" + (i) "Northwind Technologies India Pvt Ltd · client request". |
| TC-02 | Info strip (prog-light, 3px prog left border): "The change is a request. Priya Raman (manager) approves or rejects it." |
| TC-03 | Toolbar: Undo / Redo (30px icon buttons) · "Snap" + pill Day · Week · right chip "COI would move 4 days" (due-chip). |
| TC-04 | Chart (rows 40px): navy floating label "24 Oct 2026 · +4 days" above the dragged edge; ghost bars (1.5px dashed subtle, 8% tint) = before; after bars with 2px red outline = critical path; Phase 2 bar has 10px drag handles on both ends (white, primary ring, ew-resize). Legend: Before (dashed) · After (prog) · Critical path (red ring) · Today (red line). |
| TC-05 | Change table: Phase · Before (struck through) · After · Change chip: Phase 2 · Incorporation 25 Sep - 20 Oct → 25 Sep - 24 Oct "+4 days" · MCA review 20 Oct - 28 Oct → 24 Oct - 1 Nov "moved +4" · COI 28 Oct 2026 → 1 Nov 2026 "+4 days". |
| TC-06 | "Reason for the change" textarea (3 rows): "Office NOC from the landlord will arrive on 22 Oct." |
| TC-07 | Footer (i) "Nothing changes until SBC approves" · Cancel · primary "➤ Send request". |

### 8.5 Timeline manager board (`v7p_timeline_manager`, 980px)
Same as 8.4 with: title "Edit timeline" ((i) "… · manager edit"); no info strip; toolbar adds divider, "Zoom" pill Week · Month, chip "COI slipped by 4 days" (over-chip); "Change history" list (mono 110px time · text · actor): 6 Oct 2026 10:42 "Phase 2 end 20 Oct → 24 Oct (draft)" Priya Raman / 1 Oct 2026 16:05 "Phase 1 closed on 24 Sep" Priya Raman / 12 Sep 2026 11:20 "Timeline created" Priya Raman; footer (i) "On save: email and WhatsApp to admin, manager, lead and client" · Cancel · primary "Save changes".

### 8.6 Live timeline editor (`final-src/tl-editor.js`, opened by "Edit" on the Timeline card)

| id | item | behaviour |
|---|---|---|
| TE-01 | Model | Axis origin T0 = 12 Sep 2026, card span 57 days; "world" −42…+110 days (1 Aug → 31 Dec 2026). Phases: a "Phase 1 · Name Application" 12 Sep–24 Sep **done (locked)** ok colour; b "Phase 2 · Incorporation" 25 Sep–20 Oct navy-3; m "MCA review" 20 Oct–28 Oct oklch(70% .03 255); c "COI" 28 Oct milestone (diamond, gold). Saved state in `sessionStorage vcfo.tl.saved`, pending client request in `vcfo.tl.pending`, last mode in `vcfo.tl.mode`. |
| TE-02 | Dialog | Scrim rgba(8,20,40,.5) (fade .18s); `#tle` width min(1080px,100%), max-height 100dvh−32, radius 12, enters `translateY(10px) scale(.98)`→none .26s. Phone ≤767: bottom sheet (radius 14 14 0 0, max-height 92dvh), date column hidden, 40px buttons. |
| TE-03 | Header | h2 "Edit timeline" / "Request a timeline change" (client mode) + mode toggle (aria "Who is editing"): "Manager · direct edit" / "Client · change request" (pressed = navy) + 36px × (aria "Close editor"). In the real app the mode is the user's role (client → request; manager → direct) — no toggle. |
| TE-04 | Tools | "↶ Undo" (disabled when no history; 60-step history) · "Reset" (to saved, toast "Reset to the saved timeline") · hint "Drag a bar to move it · drag its edges to change dates · snaps to days|weeks · ctrl + scroll or pinch to zoom" · zoom group: − / range slider (log scale) / + / level label Days·Weeks·Months / "Fit". |
| TE-05 | Grid | 3 columns `170px | viewport | 150px` (1023px: 140/120; phone 96px + viewport): names (🔒 on done phase), lanes 52px with ruler 44px (month labels at the 1st, day/week ticks by zoom; weekends lighter), dashed ghost of the saved bar, the bar (26px, radius 5, shadow; done = striped + not-allowed), today red line + "Today 6 Oct" tag, right column "d Mon – d Mon" + change chip "+N d" (late red #b42318 on #fde8e6) / "−N d" (early green #0f7a55 on #e3f6ee). |
| TE-06 | Drag | Pointer drag on the bar moves it; on the 12px edge handles resizes start/end; snaps to 1 day (or 7 days when zoomed out <8 px/day); a floating navy read-out above the bar "d Mon – d Mon · N days" (visible on hover/focus/drag). Dragging adds a gold ring. Keyboard: bar is `role=slider` (aria-valuetext = read-out); ←/→ moves by the snap; Shift+←/→ changes the end. Done phase: toast "Phase 1 is done, so its dates are locked". |
| TE-07 | Cascade | A phase never starts before the previous one ends; when a phase grows/moves later, following phases shift by the same amount keeping their lengths; milestone follows. |
| TE-08 | Zoom/pan | ctrl/⌘ + wheel zooms around the cursor; wheel scrolls horizontally when zoomed in; mouse drag on empty lane pans; two-finger pinch zooms; "Fit" = 12 Sep → 8 Nov; min = whole world, max 48 px/day. |
| TE-09 | Summary | Grey box: "COI 28 Oct → 1 Nov" + pill "Slipped by 4 days" (late) / "Pulled in by N days" (early) / "No change to the COI date" (same) + hint when slipped "MCA review and the COI move with Phase 2. The client is told by email and WhatsApp." |
| TE-10 | Compare | Two boxes "BEFORE" / "AFTER" listing each phase and its dates. |
| TE-11 | Client reason | Client mode only: label "Why do you need this change?" + textarea placeholder "For example: our director is travelling until 14 Oct, so the KYC video call has to move." + error (hidden until needed) "Add a short reason so Northwind’s project manager can approve it." |
| TE-12 | Footer | Warning text — manager: "Saving updates the dashboard for everyone on Northwind."; client: "Priya Raman (Project Manager) approves requests. Northwind’s dates stay as they are until then." · Cancel · navy "Save timeline" / "Send request". |
| TE-13 | Commit | No change → toast "No changes to save". Client: reason required → store pending, close, add the pending chip to the card (TL-01), toast "Change request sent to Priya Raman" + Undo (removes the request). Manager: save, close, animate card bars, toast "Timeline saved · COI d Mon · slipped by N d" + Undo (restores previous). Esc / scrim / × close without saving. |

Backend: manager save → existing `setEngagementWindow` (`src/db/repositories/schedule.ts`, route `/api/engagements/[id]/schedule`, role check `canSetScheduleWindows`), store per-phase windows as step windows (first/last step of the phase) or add phase-level keys to `schedule` (NEW shape `schedule.phases[phaseId]`). Client request → NEW `engagement_change_requests` kind `timeline` (5.7) + manager approval UI (manager area). Audit on both. Notifications: email + WhatsApp (NEW notify event `timeline_changed`, templates in `src/lib/notify/templates.ts`, see `docs/context/notes/aws.md`).

---

## 9. Credentials page (`v7p_credentials.dc.html`, route `credentials`)

A full page, not a pop-up. Sidebar item "Credentials" (key-round icon) between Library and Team. Purpose: the company's government-portal IDs, logins and passwords, directors' KYC and addresses, kept as a spreadsheet-like workbook; secret values are masked and every Preview / Edit / Reveal needs a 6-digit OTP that is sent to the client's **Project Manager** (not to the client), and every access is logged.

### 9.1 Layout

| id | item | content |
|---|---|---|
| CR-01 | Page frame | `.cr-page` flex: `.cr-side` placeholder (`--vp-side-w` 248/72/0) + `.cr-main` (`padding-bottom:96px`) → `.cr-wrap` max-width 1600 centred. |
| CR-02 | Top bar | Own copy of the shell bar (`.cr-top` 52px sticky, blur): phone menu · logo (→ home) · trail key icon + "Credentials" · Search (230px; 196 ≤1279; 36px icon ≤959) → toast "Search opens from the shell in the full app" · Announcements → `announcements` · Notifications (badge 3) → `notifications` · Theme. |
| CR-03 | Toolbar | `.cr-bar` (padding 14px 24px 0; 20px ≤959; 16px phone): 32px primary-light key tile · h1 "CREDENTIALS" (800 13px .07em) · Stage pill **Before COI / After COI** (radiogroup; prototype-only, mirrors `vcfo.after`; real app: derived from incorporation, no toggle) · spacer · "🕘 Access log" button · page-level mode buttons: "👁 Preview" + navy "✏ Edit" (when a mode is live: chip "Preview · 9:42" / "Edit · 9:42" countdown + "🔒 Lock"). |
| CR-04 | Identifier tiles ("Six across, tinted") | `section.cr-ids` grid 6 columns gap 8 (3 columns ≤1100, 2 ≤560): tiles `.cr-ctile` tinted by issuing authority (mca indigo, it teal, gst green, oth amber; `--a-bg`/`--a-fg`), radius 9, padding 9px 10px 10px: uppercase name (800 10.5px) + one 22px icon action, value mono 12.5px. Tiles: CIN (mca), PAN (it), TAN (it), GSTIN (gst), Registrations (oth), DSC holders (oth). BEFORE COI every tile shows "Pending COI" (muted). AFTER: CIN `U72900KA2026FTC198431` + Copy; PAN `AAKC••••1M` + 👁 Reveal (OTP) → after reveal full value + Copy + Hide; TAN `BLRN••••2D` same; GSTIN `29AAKCN4821M1Z5` + Copy; Registrations "PF · ESI · PT" + → (opens sheet tab Registrations); DSC holders "4 holders" + → (opens Directors KYC). (Older screenshot shows big cards with a navy bot bubble "Issued after the Certificate of Incorporation"; FINAL replaced them with these tiles; the `.cr-card` CSS for that variant is still in the file.) |
| CR-05 | Workbook | `section.cr-wb` card (margin 14px 24px 0, padding 12px 14px 14px). Header: sheet pill (5 tabs, horizontally scrollable `.cr-segx`; on phone replaced by a `<select>` "Sheet") **Address 3 · Login Credentials 31 · Registrations 20 · Directors KYC 24 · Other credentials 12** (before COI: Other credentials 0) · right: (Directors KYC only) "+ Add director" · sheet-level "👁 Preview sheet" / navy "✏ Edit sheet" / countdown chip + "🔒 Lock". |
| CR-06 | Grid | `.cr-gridbox` (scrolls both ways inside its box, max-height 440px; 58vh phone; 1px border radius 8): spreadsheet table `.cr-t` (`width:max-content;min-width:100%`, 34px rows, 44px on phone): sticky header rows — column letters A, B, C… (22px, mono) · optional navy title rows (Login: "NORTHWIND TECHNOLOGIES INDIA PVT LTD - Login Credentials" and navy-2 "Address: 4B, Northwind House, 12 Sample Road, Indiranagar, Near Demo Metro, Bengaluru, Karnataka 560038, India"; KYC: company name) · column names (uppercase 700 11px; 🔒 gold icon on secret columns). Sticky left gutter 84px (row number, or a live countdown "9:41" in prog colour when the row is in a mode; per-row 👁 Preview row / 🔓 Lock row button (only if the row has secrets) and ✏ Edit row / Lock row button); sticky S.No column (56px) on Login/Registrations; sticky label column (200–240px). Editable cells (in edit mode) are tinted cream and show a 1px blue inset on hover. Row hover light blue. Spacer row in Login (14px raised). Excel-like thin borders on Login and KYC (`.xl`). |
| CR-07 | Cell types | text (or "—" dash when empty) · secret (masked `••••••` mono muted + 🔒 "Reveal <row> · <col>" + ⓘ "About this field" (toast "<label>: masked. Preview or Reveal needs an OTP from Priya Raman.")) · revealed secret (mono value + Copy; if revealed by a single-cell reveal also a "Visible · 9:58" chip + Hide) · status (chip Active ok / Pending due / Expired over / Not applicable grey; in edit mode a 26px select) · certificate ("📎 file.pdf" link → toast "Opens the certificate in the full app"; "Proof pending" amber chip; "—") · chips "Pending COI" / "Not registered yet" (grey) · source chip under auto-filled values: "Auto · from <source>" (prog-light; tooltip e.g. "Filled from the registered office (Incorporation step 7). Edit to override.") or "Edited" (gold) once changed by hand. |
| CR-08 | Sheets | **Address** (3 rows: Registered office, Corporate office, Communication; columns Address type · Door No · Building · Street · Area · Landmark · City · District · State · PIN · Country · Phone · Email · Latitude/Longitude · Ownership · Owner name · NOC (cert) · Utility bill (cert) · Rent agreement (cert); rows 1 and 3 auto from "registered office" (cols B–K) and "client profile" (Phone); no secret columns). **Login Credentials** (31 rows + 1 spacer; columns S.No · Registration · ID 🔒 · Password 🔒 · Mail · Mobile 🔒 · Status): Company CIN, PAN, TAN - Traces Registration, TAN - Income Tax Registration, Employee State Insurance (ESI), Provident Fund (PF), Goods and Service Tax (GST), GST - E-Invoicing, LUT (Letter of Undertaking), HDFC Bank - Bank Logins, Shops and Establishment Act (S&E Act), Professional Tax, Import Export Code (IEC), Mail ID - Company, Non STPI, RBI Entity Logins, RBI Business Logins, FLA, Traces, Zoho Books, Papaya, Pluxee, ADT-1, MCA V3 Logins, NPS, [spacer], CBO, POSH, FLAIR, Address, JPMC logins, Reporting Portal. Mail = compliance@northwind-demo.in, Mobile = +91 98000 00010 for every row (auto "client profile"). BEFORE COI: IDs from the company record show "Pending COI", other IDs empty, passwords empty except Mail ID - Company; statuses mostly Pending (Mail ID/Address Active; Non STPI/FLA/NPS/JPMC Not applicable). AFTER: IDs filled (auto source chips: company record / registration steps / client profile / registered office), passwords demo-pass-NN, statuses Active (LUT/NPS/FLAIR Pending, FLA Expired, Non STPI/JPMC N/A). **Registrations** (20 rows; S.No · Registration · Number · Date of registration · Login ID 🔒 · Password 🔒 · Certificate): GST, PF, ESI, PT, LEI, MSME, ICEGATE, IEC, LUT Filing, Non-STPI Compliance, Shops & Establishment, CLRA, POSH / SHE Box, Trade Licence, Trademark Registration, Trademark Renewal, Patent Registration, ICDR Registration, FCGPR Filing, FDI Reporting (after: numbers/dates/logins/cert files or "Proof pending"; GST/PF/ESI/PT/IEC/LUT numbers auto "registration steps"). BEFORE: Number "Not registered yet" for all, every 3rd Certificate "Proof pending". **Directors KYC** (transposed: 24 "Particulars" rows × one column per director: Rohan Kumar, Meera Iyer, Neha Kapoor, David Clarke; rows DIN, Full Name, First/Middle/Last Name, Date of Birth (secret), Father Name (+ indented First/Middle/Last), Address (tall multi-line), Mobile Number, Mail ID, Passport (secret), Aadhar No (secret), Driving License (secret), PAN (secret), Address Proof (secret), Education Qualification, Category, Duration Of Stay, Place of Birth, Director Role, Aadhar Linked Mobile Number (secret); DIN/name/DOB/address/mobile/mail/PAN auto "incorporation steps"; header cells (director names) editable in edit mode; "+ Add director" adds column "New director"). **Other credentials** (Item · ID 🔒 · Password 🔒 · Linked email · Notes; 12 rows after: Google Workspace admin, Office Wi-Fi admin, Accounting software, Tally licence, Cloud root account, Domain registrar, Team chat admin, Courier account, Office alarm code, Payroll software, Bank token (backup), Website CMS; BEFORE: empty → bot bubble "Nothing here yet. Add a row for any other login Northwind’s team uses."). Login and Other have "+ Add row" under the grid. |
| CR-09 | Access log drawer | Right drawer 400px (100vw phone), slides `cr-slide .26s` (translateX 24px + fade), scrim: header history tile + "Access log" + count chip + "📄 Open in Audit" (→ `audit`) + × ; ordered list newest first: mono time "11 Oct 2026 · 11:40" + text. Seed: "Priya Raman edited Address · Corporate office · Street" (10 Oct 16:12) · "Arjun Mehta started Preview · Registrations · OTP approved by Priya Raman" (11 Oct 09:03) · "Rohan Kumar revealed Rohan Kumar · PAN · OTP approved by Priya Raman" (11 Oct 11:40). Footer caption "Previews, edits and saved changes are logged here and on the Audit page". Stored in `localStorage vcfo.credsAudit` (last 200) — the Audit page reads the same key. Esc closes. |

### 9.2 The OTP flow (Preview / Edit / Reveal)

| step | behaviour |
|---|---|
| Scopes | `page` (toolbar Preview/Edit), `tab:<sheet>` (sheet Preview/Edit), `row:<sheet>|<r>` (gutter buttons), `cell:<sheet>|<r>|<c>` (single Reveal; preview only). A cell is visible if ANY covering scope has a live Preview or Edit; editable if any covering scope has a live Edit (never the S.No column, fixed labels, the `ids` table or spacer rows). |
| Open | Clicking Preview / Edit / Reveal / row buttons when no live grant → OTP dialog. `Add row` / `Add director` on a sheet without Edit → asks for an Edit OTP first, then runs the action. Clicking a cell while not editable → toast "Read-only. Choose Edit and enter the OTP to change values." |
| Dialog | `.cr-dlg` 440px centred (phone: bottom sheet `cr-up .3s`), `cr-pop .22s`: header 34px navy circle (shield-check, or pencil for edit) · "Confirm it’s you" · caption "<Preview|Edit|Reveal> · <scope label>" (e.g. "Reveal · PAN", "Preview · Registrations · GST Registration", "Edit · whole page") · ×. Body: "An OTP has been sent to your manager, **Priya Raman**, at `pr•••••@sbc.in`. Ask them for the code." · six 44×52 digit boxes (40×50 phone; mono 22px; `inputmode=numeric`, first has `autocomplete=one-time-code`) · error line · status line · hint "Prototype demo code: 123456". Footer: "Resend code in 0:29" (disabled countdown, then link "Resend code") · Cancel · navy "Verify" (disabled until 6 digits). |
| Input | Typing a digit advances; Backspace on empty goes back; ←/→ move; Enter verifies; pasting/typing multiple digits fills all boxes; Tab is trapped inside the dialog; focus outside snaps back to the first box. |
| Wrong code | Boxes clear and turn red (`.bad`), error "That code is not right. Try again." + "2 tries left" / "1 try left". Third wrong → locked 60 s: inputs disabled, red box "Too many wrong codes. Try again later. 0:59" counting down; after expiry it resets (tries back to 3). |
| Resend | Allowed every 30 s (not while locked): clears boxes, shows "A new code was sent to Priya Raman." |
| Success | Grant = 10 minutes (`SESSION_MS 600000`) for that scope; dialog closes; toast "Preview for 10 minutes" / "Edit for 10 minutes" / "Visible for 10 minutes"; audit line "Rohan Kumar started Preview · <scope> · OTP approved by Priya Raman" or "Rohan Kumar revealed <scope> · OTP approved by Priya Raman"; focus moves to the matching Lock/Hide control. |
| Countdown | Every live scope shows a mm:ss chip (toolbar, sheet, gutter row number, cell "Visible · m:ss") ticking each second; at 0 the grant ends, any open edit is closed and the grid re-masks. "Lock" ends a scope early; "Hide" ends a single-cell reveal. |
| Editing | Click (or Enter/Space on a focused cell) → inline input (multi-line textarea for the tall Address row; Enter saves, Shift+Enter newline, Esc cancels, blur saves). Empty or unchanged → no save. Save → value stored, auto source flips to "Edited" chip, audit "Rohan Kumar edited <row · column>", toast "Saved" + Undo (restores value and source flag, audit "… undid the change to …"). Status select → saves immediately ("changed <label> to Active"). Add row (status defaults Pending) / Add director (column "New director", grid scrolls right, header cell enters edit) both with Undo toasts and audit lines ("added row N to Login Credentials", "added a director column (F) to Directors KYC"). |
| Copy | Copy buttons write the value to the clipboard (fallback `execCommand`), toast "Copied" or "Copy blocked by this browser". |
| Stage switch | Before/After pill changes which sheets show (Address and KYC shared; Login/Registrations/Other have before variants), closes edits. |

### 9.3 Data model and backend (all NEW — nothing in the repo stores credentials)

| piece | proposal |
|---|---|
| Table `engagement_credentials` | `id uuid pk`, `engagement_id uuid fk cascade`, `sheet text` ('login'|'registrations'|'other'|'address'|'kyc'), `row_key text` (stable key, e.g. step id 'reg-4' or 'custom:<uuid>'), `ordinal int`, `label text`, `fields jsonb` (non-secret cells: mail, mobile, number, date, notes, status, cert document id…), `secret_ciphertext bytea` / `secret_fields jsonb` encrypted (ID, password, login ID, Aadhaar, passport, DOB… — envelope-encrypt with AWS KMS in prod, a local key in dev; never return in list reads), `source jsonb` (per field: 'company record'|'registration steps'|'client profile'|'registered office'|'incorporation steps', and an `edited` flag), `created_at`, `updated_at`, `updated_by`. Directors KYC can be its own table `engagement_director_kyc` (one row per director, fields jsonb + encrypted secrets) or sheet='kyc' with `row_key=director:<id>`. |
| Table `credential_access_grants` | `id`, `engagement_id`, `profile_id` (who asked), `mode` ('preview'|'edit'|'reveal'), `scope text` (page / sheet / row / cell key), `expires_at` (+10 min), `approved_by` (manager profile), `created_at`. Server checks a live grant on every secret read/write. |
| Table `credential_otps` | `id`, `engagement_id`, `requested_by`, `approver_profile_id` (the engagement's manager: `engagements.manager_id` / `engagement_managers`), `mode`, `scope`, `code_hash` (bcrypt/argon2 of 6 digits), `expires_at` (e.g. 10 min), `attempts int`, `locked_until`, `resend_available_at` (+30 s), `consumed_at`. |
| Repository `src/db/repositories/credentials.ts` | `listCredentialSheets(ctx, engagementId)` (masked; client = own engagement via `assertEngagementAccess`; manager/lead per Path A; decide whether leads may see), `requestCredentialOtp(ctx, {engagementId, mode, scope})` → creates OTP, emails/WhatsApps the manager (`src/lib/email/send-email.ts`, `src/lib/notify/send-whatsapp.ts`; NEW template "credential_otp"), returns masked manager email `pr•••••@sbc.in` and resend time; `verifyCredentialOtp(ctx,{otpId, code})` → grant or error {triesLeft, lockedUntil}; `revealCredentialValues(ctx,{scope})` → decrypted values only within a live grant; `updateCredentialCell(ctx,{…})` (requires live edit grant), `addCredentialRow`, `addDirector`, `lockCredentialScope`. Every grant / reveal / edit / undo → `recordAuditEvent` (actions `credentials.otp_requested`, `credentials.preview`, `credentials.edit`, `credentials.reveal`, `credentials.cell_updated`), which also feeds the Access log and the Audit page (DECISIONS: SBC staff by name and role in client Audit). Add cross-tenant tests (golden rule 2). |
| Routes | `GET /api/engagements/[id]/credentials` (masked sheets), `POST /api/engagements/[id]/credentials/otp` (request/resend), `POST /api/engagements/[id]/credentials/otp/verify`, `POST /api/engagements/[id]/credentials/reveal` (values for a scope), `PATCH /api/engagements/[id]/credentials/cells`, `POST /api/engagements/[id]/credentials/rows`, `DELETE …/grants/[id]` (Lock), `GET /api/audit-logs?engagementId=&action=credentials.*` for the drawer (route exists). |
| Auto-fill sources | company record = pre-12 responses (`cin`, `pan`, `tan`); registration steps = reg-* responses (`gstinNumber`, `pfRegistrationNumber`, `esiRegistrationNumber`, `lutArn`, `iecCode`, `leiNumber`…); client profile = pre-1 `companyMailId`, `companyMobileCountryCode/Number`; registered office = pre-14 responses + `engagements.subsidiary_registered_address`; incorporation steps = pre-15 director slots (DIN, names, DOB, address, mobile, mail, PAN). Computed at read time unless overridden ("Edited"). |
| Page | NEW `app/app/client/credentials/page.tsx` + view `src/views/client/Credentials.tsx`; sidebar item in `src/components/shell/RoleSidebar.tsx`. |

---

## 10. `v7x_*` boards

### 10.1 Document viewer (`v7x_doc_viewer`, route `doc-viewer`)

| id | item | content / behaviour |
|---|---|---|
| DV-01 | Overlay | Covers the content area only (`left:var(--vp-side-w)`), dim `oklch(20% .05 258 / .6)`; dialog `width:min(1152px,100%-24px)`, `height:min(720px,100%-24px)`, radius 12, grey canvas `light-dark(oklch(94% .008 255), oklch(22% .008 255))`. |
| DV-02 | Header | 30px type badge (PDF over-light) · file name (700 14px, ellipsis) "Certificate of Incorporation.pdf" + (i) "From SBC · 24 Oct 2026 · Size [size]" · caption position "1 of 4" · outline "⬇ Download" (label hidden on phone) · 32px × "Close preview (Esc)". |
| DV-03 | Page | A4 paper (`aspect-ratio:1/1.414`, width 460px × zoom, white, shadow, radius 2, `data-paper` = always light in dark mode) with sample content + diagonal "SAMPLE" watermark (placeholder for the real PDF render). Padding `28px clamp(12px,6vw,72px) 72px`. |
| DV-04 | Prev/next | 40px round buttons at left/right 16px, vertically centred: "Previous document" / "Next document" cycle the list (Certificate of Incorporation 24 Oct 2026 SBC · Board meeting minutes 26 Oct · GST certificate 1 Nov · Share capital FIRC 2 Nov 2026 Northwind). |
| DV-05 | Zoom bar | Navy floating pill bottom-centre (bottom 16px; 72px on phone): "Page 1 / 1" · divider · − · "100%" · + ; zoom 50–150% in 25% steps; page width animates .2s. |
| DV-06 | Close | Esc or × → back to the opener (`vcfoBack`, else Home). |
| DV-07 | Unsupported type | Second dialog (860px, min-height 380): DOCX badge, "Draft Board Resolution.docx" + (i) "From SBC · 14 Sep 2026 · Size [size]", Download, ×; body 64px DOCX icon tile + "Preview not available for this file type" + primary "⬇ Download". |

Data: `GET /api/documents/[id]/signed-url` (S3) / `GET /api/milestone-documents/signed-url`; PDF render via `<iframe>`/pdf.js; images inline; other types → unsupported state. Size from `documents.size_bytes`. Prev/next = the list the viewer was opened from. Shared preview component is also used by Documents and Incorporation (DECISIONS: "shared preview").

### 10.2 Drill-down (`v7x_drilldown`) — see G-06; spec board `v7x_drilldown_spec` (1300px): "1 · Hover a part" tooltip example "Payroll · Due soon · 3" (navy, 6px corners) + "2 · Click → drill-down pop-up (clicked part pre-selected)" with "Payroll (PF / ESI / PT) · filings" (All 18 · Filed 0 · Due soon 3 · Overdue 0 · Upcoming 15; rows EPF Return & Payment · Oct 15 Nov, ESI Payment · Oct 15 Nov, PT Payment · Oct 20 Nov — Due soon). Notes: one component for every visual; props `title`, `tabs`, `rows`, `active`, `onclose`; hover/focus = tooltip, click/tap/Enter = pop-up; each part is a real button with an aria-label; footer "Showing n of m" + "Open full list"; closes on backdrop/×/Esc; reduced motion: pill jumps, no fade. Wired on: greeting ring · current-step badges · timeline bars · compliance-by-area bars · What is next · Alerts · post-incorporation bars · chat phase visual.

### 10.3 Info pop-over (`v7x_info_popover`, 1340px) — 4 states: Closed ("Title + (i). No grey line under it."), Hover ("Icon turns navy. Nothing opens on hover."), Open ("Click opens the pop-over, attached to the icon."), Keyboard focus ("Focus ring on the icon; Enter opens, Esc closes."). Spec bullets: 15px icon, 18px hit area inside a 44px touch target on mobile; pop-over 200–280px, 10px arrow, 8px corners; content 1–3 short lines then meta; bottom row 16px bot + "Ask VCFO about this" (opens chat with the row's title as the question); opens on click/Enter/Space, closes on outside click, Esc or Tab out; one open at a time; build with Radix Popover, `role="dialog"` when it holds the link; reduced motion no fade/slide. Example content "Electricity or water · Max 2 months old · Asked by Arjun Mehta".

### 10.4 Top bar (`v7x_topbar`, 1192px) — "Short trail" (Home) and "Long trail: it truncates, the right group never moves" (Incorporation › SPICe+ Part B › Step 7 · Registered Office Address › Documents › NOC from property owner; ancestors are muted links 13px/500, separators chevrons at 45% opacity, last item 600 current page, each `li` ellipsis with min-width 28px (last 48px)). See G-20.

### 10.5 Launcher concept (`v7x_launcher_concept`, over `v7x_before_bare`) — superseded by the runtime launcher (G-10) but documents the motion intent: fixed 24px from the right, bottom = window bottom; avatar box 108px (head ~80px, ~100px visible); click opens the 400×640 chat above it and the robot stays risen as its anchor showing moods; while scrolling it sinks to a 50px peek and rises 600 ms after scrolling stops; pages get 96px bottom padding. Storyboard: 1 Hidden (0 ms; starts 600 ms after load) → 2 Springs up (0–400 ms, stiffness 420 damping 32, ~8px overshoot; keyframes `v7rise .4s cubic-bezier(.3,1.4,.5,1) .6s`: 100%→−8%→2%→0) → 3 Settles, looks around (400–700 ms; blink every 4.5 s, glance every 8 s; "Ask VCFO" bubble fades in at 700 ms) → 4 Sinks back (250 ms ease-in when a pop-up/modal opens or while scrolling). Reduced motion: no rise/sink/glance; bubble visible; no blink.

### 10.6 Timeline options (`v7x_timeline_options`, 1100px) — step-timeline styles for the step pop-up: **A "Connected chips" — Picked** (done green ✓, current navy + gold pulse, next dashed; one short line per stage, rest in (i); fits the 760px pop-up), B "Run graph" (cards joined by arrows; rejected: heavy), C "Progress rail" (segmented bar with labels; rejected: current stage stands out less). Use A (= SP-02).

### 10.7 `v7x_before_bare` — the before-COI Home without the launcher, used only as the backdrop for 10.5. Note its older 12-column layout: `main{padding:24px;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}`, greet span 12, left column span 8 (Needs, Who holds it now, Timeline, Steps), right column span 4 (Alerts, SBC, Docs, Activity). Superseded by the `vh-b` grid (section 11).

---

## 11. Layout specs per breakpoint

### 11.1 Page frame (Home desktop/tablet board)

```css
.vh-root{position:relative;width:100%;min-height:100vh;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.vh-side{width:var(--vp-side-w,248px);flex:none;background:#0f2a4a;overflow:hidden}   /* 248 ≥1280 · 72 768–1279 · 0 ≤767 */
.vh-body{flex:1;min-width:0}
.vh-main{box-sizing:border-box;width:100%;max-width:1600px;margin-inline:auto;padding:clamp(12px,2vw,24px);display:grid;gap:16px;align-items:start;grid-template-columns:minmax(0,1fr)}
.vh-main>.stag{display:flex;flex-direction:column;gap:16px;min-width:0}   /* cards stack inside an area with 16px gaps */
```

Note the grid breakpoints are on VIEWPORT width (media queries), independent of the sidebar width. Effective content widths: at 1440 desktop the content is 1440−248 = 1192 minus 2×24 padding = 1144px; at 1024 tablet 1024−72 = 952 − 2×20.48 ≈ 911px; at 390 phone (desktop board only for 700–767) full width − 2×12.

### 11.2 BEFORE grid (`.vh-b`)

| viewport | columns | areas | rows |
|---|---|---|---|
| < 600 | `minmax(0,1fr)` | `"g" "a" "c1" "b" "c2"` | auto |
| 600–1179 | `repeat(2,minmax(0,1fr))` | `"g g" "a a" "c1 c2" "b b"` | auto |
| 1180–1799 | `minmax(0,2fr) minmax(0,1fr)` | `"g g" "a c1" "a c2" "b c2"` | `auto auto 1fr auto` |
| ≥ 1800 | `repeat(3,minmax(0,1fr))` | `"g g g" "a c1 c2" "b b c2"` | `auto auto 1fr` |

(a = Needs + Who holds it now; c1 = Alerts + SBC; b = Timeline + Steps; c2 = Docs + Activity.)

### 11.3 AFTER grid (`.vh-a`)

| viewport | columns | areas | rows |
|---|---|---|---|
| < 600 | 1 | `"g" "a1" "c1" "a2" "c2" "f" "d" "e"` | auto |
| 600–1179 | `repeat(2,minmax(0,1fr))` | `"g g" "a1 a1" "c1 a2" "c1 c2" "f f" "d e"` | `auto auto auto 1fr` |
| 1180–1799 | `repeat(6,minmax(0,1fr))` | `"g g g g g g" "a1 a1 a1 a1 c1 c1" "a1 a1 a1 a1 c2 c2" "a2 a2 a2 a2 c2 c2" "f f f f f f" "d d d e e e"` | `auto auto 1fr auto` |
| ≥ 1800 | 6 | `"g g g g g g" "a1 a1 a2 a2 c1 c1" "a1 a1 c2 c2 c1 c1" "f f f f f f" "d d d e e e"` | `auto auto 1fr` |

(a1 = Needs + What is next; c1 = Alerts + SBC; a2 = Compliance status; c2 = Company IDs; f = Compliance by area + Registrations + Post-inc + Timeline + Steps; d = Docs; e = Activity.)

### 11.4 Responsive rules inside cards (from the `data-vh` style block, verbatim in Appendix A)

| rule | breakpoint |
|---|---|
| Search button collapses to 36px icon | ≤1099 |
| Top bar gap 6 / padding 10; menu button shown; crumb hidden; logo 22px; all top-bar buttons ≥40px; `.vh-hide-sm` hidden; card `.btn` and pill buttons ≥40px; no card hover lift | ≤767 |
| `.vh-hide-xs` hidden (greeting "Report" label) | ≤479 |
| Greeting stats become a grid `repeat(auto-fill,minmax(118px,1fr))` gap 8px 12px, no separators; `.vh-gtop` wraps | ≤599 |
| `.vh-segwrap` pills (Compliance by area, Registrations) wrap, thumb hidden, active = navy bg | ≤767 |
| Tables scroll inside `.vh-x` (`overflow-x:auto;overscroll-behavior-x:contain`; table `min-width:var(--tmin,520px)`: Steps 560, Area 600, Registrations 720); timeline in `.vh-tl` scrolls with min-width 600 | all |
| Drill-down: width min(600px,100vw−24), max-height min(560px,100dvh−24); ≤640 pill wraps, date column hidden (`ddrow` → `minmax(0,1fr) 116px 16px`) | ≤640 |
| Pop-overs max min(280px,100vw−24); closed pop-overs `display:none` (no phantom scroll) | all |
| Coarse pointers: (i) gets an 11px invisible hit-area ring | `pointer:coarse` |
| `.vh-pbar` (52px fixed bar for full-screen pop-up boards), `.vh-under-bar{top:52px}`, `.vh-zoom{bottom:72px}` | ≤767 |
| Phone file swap (`mobile.html`) | <700 (prototype); real app: <768 single responsive page |

### 11.5 Card anatomy (desktop) — exact CSS

```css
/* card shell (Appendix A + v7.1 override) */
.card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:0;display:flex;flex-direction:column;animation:up .5s cubic-bezier(.2,.7,.2,1) backwards;transition:transform .16s cubic-bezier(.22,1,.36,1),box-shadow .16s cubic-bezier(.22,1,.36,1),border-color .16s}
.card:hover{transform:translateY(-2px);border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04), 0 6px 18px -10px oklch(28% 0.06 264 / 0.18)
```

Header (inline in every card):
```html
<div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0">
  <h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Title</h3>
  <!-- optional (i) -->
  <div style="margin-left:auto;display:flex;gap:6px;align-items:center"><!-- pill / chip / link / button --></div>
</div>
```

Card body paddings: Needs `12px 16px 14px` · Who holds it `12px 16px 14px` + inner column gap 12 · Alerts/What is next `10px 16px 12px` · SBC `6px 16px 12px` · Timeline `12px 16px 30px` · Steps `12px 16px 14px` (gap 8) · Docs `10px 16px 14px` · Activity `6px 16px 12px` · Comp `22px 16px 16px` · IDs `4px 16px 10px` · Area/Reg `12px 16px 14px` · Post-inc `8px 16px 4px` + `4px 16px 14px`.

Row rhythm: list rows use `border-top:1px solid var(--hair)` with 7–10px vertical padding (no outer card dividers). Typography: titles `.rt` 13px/600; captions `.cap` 11px muted; labels `.lbl` 11px/800 .08em uppercase; numbers `.metric` Space Grotesk 600 −.035em tabular; dates/IDs `.mono` IBM Plex Mono tabular. Fonts used: Manrope, Space Grotesk, IBM Plex Mono (bundled via @fontsource in the prototype).

Date tile (alerts / what is next): `width:44px;height:48px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;background:var(--<due|over|prog>)` with `.metric` 18px day + `font-size:11px;font-weight:800` month.

Red hero row (overdue): `display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:12px 14px;border-radius:8px;background:var(--over-light);border:1px solid oklch(57% 0.2 22 / 0.3);margin-bottom:6px`.

Holder box (Who holds it now): `border:1px solid var(--border);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-left:3px solid var(--<due|prog>)`.

Greeting: `border-radius:10px;padding:12px clamp(14px,2vw,18px) 10px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 60%,var(--navy-3-deep,var(--navy-3)) 100%);color:#fff;overflow:hidden` + bottom `height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)`.

Full verbatim markup of every card is in Appendix B; the phone CSS in Appendix C.

### 11.6 Phone (`mobile.html`) metrics

`.wrap{padding:14px 14px 0;display:flex;flex-direction:column;gap:12px}` (note: 14px side gutter); top bar 56px; card radius 10, header `14px 14px 10px`, title 800 12px uppercase; pill margin `0 14px 10px`, buttons 38px; rows min-height 52px padding `8px 14px`; icon buttons 40px; date tiles 42×46; greeting radius 12 padding `14px 14px 12px`; ring 62px; stat tiles radius 8 padding 8; buttons 40px. Max content width 560px.

### 11.7 Tablet specifics
768–1279: desktop board, sidebar = 72px icon rail (Before/After pill vertical inside the rail), Search collapses to icon ≤1099, grid uses the 600–1179 two-column template up to 1179 and the 2fr/1fr (before) / 6-col (after) template from 1180. Screenshot `home__1024x768.png` confirms: greeting full width, Needs full width, Who holds it now full width.

---

## 12. Backend mapping summary

### 12.1 Already available

| need | provider |
|---|---|
| One scoped read for the dashboard | `GET /api/client/overview` → `getClientOverview(ctx, engagementId?)` (`src/db/repositories/client-overview.ts`), hook `useClientOverview()` (`src/lib/use-client-overview.ts`), pure builders in `src/lib/client/client-overview.ts` (`buildProgress`, `buildNextAction`, `buildBallInCourt`, `buildDeliverables`, `buildDocumentCounts`, `buildMilestones`, `identifiersFromState`, `complianceGroupForAuthority`, `journeyStations`, `heroStateLine`). |
| Company name, legal form, incorporation date, registered office | `overview.engagement` |
| Before/after switch | `overview.incorporated` |
| Phase progress (ring, Steps card chips, timeline %) | `overview.progress.byPhase` |
| Step list with gate state | `overview.milestones` + `src/data/checklist.ts` |
| CIN/PAN/TAN/PF/ESI codes | `overview.identifiers` |
| Upcoming filings (+90 days) | `overview.compliance.upcoming` |
| Full filings register / FY | `GET /api/filings` (`getFilings`), `useComplianceFilings` |
| Filing working windows | `compliance_instances.window_from/to`, `PATCH /api/filings/[id]/window` |
| Manager date windows (timeline, expected COI) | `engagements.schedule`, `src/lib/projects/schedule-windows.ts`, `/api/engagements/[id]/schedule`, `setEngagementWindow` |
| Team (PM / PL names, email) | `overview.team` |
| Activity | `overview.activity` (audit events) / `GET /api/activity` |
| Documents + preview | `GET /api/documents`, `GET /api/documents/[id]/signed-url`, `GET /api/milestone-documents/signed-url`, deliverables |
| Document requests | `document_requests` + `GET/POST /api/requests`, `PATCH /api/requests/[id]` |
| Client change request on a step | `POST /api/client/change-requests` |
| Client approve step | `POST /api/client/steps/[stepId]/approve` |
| Ask VCFO (chat, suggestions, handoff, brief PDF, nudge, library) | `/api/ask/*`, `src/components/ask/*` |
| Notifications badge | `GET /api/notifications` |
| Shared CSS tokens | `src/components/client-portal/css-src/*` (`.cp`-scoped port of the prototype base CSS) |

### 12.2 NEW backend pieces needed

| # | piece | for |
|---|---|---|
| N1 | `overview.needs[]` — unified client needs (document requests with `step_id`/`compliance_instance_id`/`kind`/`due_date`, fill requests, rejected steps, sign items); columns on `document_requests`: `step_id text`, `compliance_instance_id uuid`, `kind text`, `due_date date`, `field_id text` | Needs card, Waiting-on count, Documents in x/y, step pop-up "Needed from …" |
| N2 | `overview.expectedCoiDate` (from `schedule.incorporation.to`) | greeting "Expected COI", timeline COI |
| N3 | `overview.alerts[]` builder (`buildAlerts`) | Important alerts |
| N4 | Include overdue filings in the runway (`status='overdue'` or past due not filed) + `overview.compliance.fyCounts` + area grouping | What is next hero, donut, compliance by area, stats |
| N5 | Firm work items visible to the client (`tasks.visible_to_client`, `tasks.progress_pct`) or derived per-step progress | What SBC is doing, "30%" captions |
| N6 | `engagement_change_requests.kind = 'timeline'` + manager approve flow + `timeline_changed` notify event; phase-level windows in `schedule` | Timeline editor, pending chip |
| N7 | Activity actor fields (`actorName`, `actorKind`) in `ClientOverviewActivity`; system events from the compliance job | Recent activity tabs |
| N8 | `identifiers.gstin` (+ iec, lei, pf/esi reg numbers) in `identifiersFromState` | Company IDs, Registrations |
| N9 | Masked PAN/TAN in the overview + `POST /api/client/identifiers/reveal` (password re-check, 3-try lock, audit) | Company IDs reveal / `v7p_ids_password` |
| N10 | `overview.registrations[]` builder + category/authority map + missing number fields for PT/S&E/Trade Licence/Trademark/MSME | Registrations card |
| N11 | Post-inc statutory window per step (N days, anchor date) + day counter | Post-incorporation setup |
| N12 | Credentials: tables `engagement_credentials` (+ `engagement_director_kyc`), `credential_otps`, `credential_access_grants`; repo `credentials.ts`; routes under `/api/engagements/[id]/credentials/*`; KMS/local encryption; OTP delivery to the manager (email + WhatsApp template); audit actions `credentials.*`; page `/app/client/credentials` | Credentials page |
| N13 | Report download wired to `/api/ask/brief` (exists) — only a front-end wire | Greeting Report |
| N14 | Portal URL map (front-end constant), file-type → badge colour map | ↗ links, doc badges |

---

## 13. Prototype inconsistencies and open questions

| # | issue | suggestion |
|---|---|---|
| Q1 | Prototype shows several client steps in progress at once (7 Waiting, 8 and 9 In progress) and step 10 with SBC, while the real gate (`src/lib/checklist/checklist-step-gate.ts`) is strictly sequential (one `active`, the rest `locked`). | Owner to confirm: either the Home shows "1 current + upcoming locked" (real data), or the gate relaxes for Phase 2 client steps. |
| Q2 | PAN/TAN reveal uses the **account password, 60 s** on Home (`v7c_ids`, `v7p_ids_password`, phone sheet) but a **manager OTP, 10 min** on the Credentials page for the same PAN. | Pick one model (or keep both and say why). |
| Q3 | Totals disagree: "6 of 14 SPICe+" (greeting, runtime chat) vs "7 of 38 steps" (chat board) vs 48 rows in the Steps card; Registration phase "0 of 23" (Steps) vs "0 of 13" (chat drill, Registrations card 13 rows, greeting "5/13"). | Use catalog counts (5/9/11/23 = 48) everywhere; registrations card = curated subset only if labelled so. |
| Q4 | Steps card shows the playbook "Timeline" text ("2–3 working days"); `src/lib/client/client-overview.ts` says the working-days SLA is no longer shown (replaced by manager windows). | Show `formatWindow(windowForStep(...))` when set, else the playbook text? Owner call. |
| Q5 | Compliance areas: design = 5 (MCA, GST, Income tax, Payroll, FEMA); real grouping adds "Other". | Fold Other into the closest area or show a 6th row only when non-empty. |
| Q6 | Many desktop controls are unwired in the board (fallback toasts): needs Upload/Fill/Correct/Sign, Report, Documents →, COI →, Show PAN/TAN, Copy, donut parts/legend/centre, drill rows and "Open full list", SBC (after) link icons, registrations download. | Real targets are given per control in sections 5.x. |
| Q7 | Empty Needs tab text is always "Nothing to sign." before COI (bug) and plain text instead of the bot bubble. | Use the bot bubble "Nothing to <verb> right now…". |
| Q8 | Phone demo data differs from desktop (e.g. Fill item "Subscriber details" vs "Director 2 - nationality, ID"; Correct "Passport copy — Meera Shah" 5 OCT vs "Passport copy - page 2" Overdue 3d; after Sign "Board minutes — 1st meeting" vs "FC-GPR declaration"; doc dates 6 Oct vs 2 Oct; Draft BR 16 Sep vs 14 Sep). | Irrelevant once data is real; just render the same `overview` on both. |
| Q9 | Phone fallback drawer names the user "Rahul Khanna"; everywhere else "Rohan Kumar". TAN revealed on phone "BLRN04392D" vs Credentials "BLRN04822D". | Demo typos. |
| Q10 | Desktop Alerts before COI tiles are not clickable while after-COI tiles are; desktop SBC bars have no tooltip/drill. Rule 14 says every visual is explorable. | Make all tiles/bars tooltip + drill. |
| Q11 | Rule 15 (portal ↗ / 📎 proof) is implemented on phone (What is next, Company IDs, Registrations) but not on the desktop cards. | Add to desktop. |
| Q12 | "What is next" phone pill only toasts; list does not filter. | Filter 15/30 like desktop. |
| Q13 | `doc-viewer` and `ids-password` are routes in the prototype only because they are separate files. | Overlays in the real app; deep-linkable via query param if needed. |
| Q14 | Before/After toggle (top bar, Credentials stage pill) is a prototype device. | Derive from `overview.incorporated`; no user toggle. |
| Q15 | Screenshot drift (v7-screens older than FINAL): "you"/"Needs from you"/"Steps around you" vs FINAL "Northwind"; Recent documents shown as thumbnail tiles in `home__1920x1080.png` vs FINAL grouped rows; Credentials identifier cards with a bot bubble vs FINAL six tinted tiles; Activity tab "You" vs "Northwind". | Build FINAL. |


---

# Appendix A: shared CSS repeated in every Home board (verbatim)

Every `v7*_*.dc.html` board in `s/home/` carries these `<style>` blocks inside `<helmet>` (tokens, card, chip, btn, seg pill, info pop-over, tooltip, drill-down row, the v7 responsive layer `data-vh`). Port once into the shared client-portal CSS (`src/components/client-portal/css-src/*` already holds a `.cp`-scoped copy of the base file).

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
.lbl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
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
th{text-align:left;padding:8px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border)}
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
.seg .cnt{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}


/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
.btn{transition:transform .12s cubic-bezier(.22,1,.36,1),background .15s}
.btn:active{transform:scale(.98)}
tbody tr{transition:background .15s}
tbody tr:hover{background:light-dark(oklch(96.8% 0.006 250 / .7), oklch(17.8% 0.006 250 / 0.7))}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:500 11px "IBM Plex Mono",monospace;color:var(--muted)}
/* sidebar: active pill + 3 px rail slide with the same spring; hover glass */
.snav a{position:relative;z-index:2}
.snav a:hover{background:oklch(100% 0 0 / .07)}
.spill,.srail{transition:transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
/* page enter: fadeUp (y 6, 0.2 s) staggered 0.06 s */
@keyframes v7fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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

```


---

# Appendix C: phone Home (mobile.html) and Credentials page CSS (verbatim)

## mobile.html `<style>`
```css

:root{--bg:oklch(97.4% 0.006 255);--panel:#fff;--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-light:oklch(96.6% 0.02 260);--navy:#0f2a4a;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--up:oklch(82% 0.018 255);
--violet:oklch(54% 0.17 292);--shadow:0 1px 2px oklch(25% 0.04 264 / .04),0 6px 18px -10px oklch(28% 0.06 264 / .18);--spring:linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)}
*{box-sizing:border-box}
html,body{margin:0;background:light-dark(#dfe5ee, oklch(25% 0.01 258.3))}
body{font:500 13px/1.45 Manrope,system-ui,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit}
.app{position:relative;width:100%;max-width:560px;min-height:100vh;margin:0 auto;background:var(--bg);overflow-x:clip;padding-bottom:120px}
.metric{font-family:"Space Grotesk",Manrope,sans-serif;font-weight:600;letter-spacing:-.03em;font-feature-settings:"tnum"}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
/* top bar */
.bar{position:sticky;top:0;z-index:20;height:56px;display:flex;align-items:center;gap:4px;padding:0 6px;background:light-dark(oklch(100% 0 0 / .94), oklch(13% 0 0 / 0.94));backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.ib{width:44px;height:44px;border:0;background:none;border-radius:6px;display:grid;place-items:center;color:var(--muted);cursor:pointer;position:relative}
.ib:active{background:var(--primary-light)}
.logo{display:flex;align-items:center;gap:8px;font:800 15px Manrope;color:var(--navy-ink,var(--navy))}
.logo i{width:28px;height:28px;border-radius:7px;background:var(--navy);color:var(--gold);display:grid;place-items:center;font:800 11px Manrope;font-style:normal}
.dot{position:absolute;top:6px;right:5px;min-width:17px;height:17px;padding:0 3px;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font:700 11px/1 Manrope;display:grid;place-items:center;box-shadow:0 0 0 2px light-dark(#fff, oklch(13% 0.006 260))}
.wrap{padding:14px 14px 0;display:flex;flex-direction:column;gap:12px}
/* greeting */
.greet{position:relative;border-radius:12px;background:var(--navy);color:#fff;padding:14px 14px 12px;overflow:hidden}
.greet:before{content:"";position:absolute;right:-60px;top:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(closest-side,oklch(80% .12 85 / .18),transparent)}
.greet .d{font:600 11px "IBM Plex Mono",monospace;letter-spacing:.08em;color:oklch(82% .03 255)}
.greet h1{margin:4px 0 0;font:700 19px/1.2 Manrope;max-width:260px}
.greet .top{display:flex;align-items:flex-start;gap:10px}
.ring{position:relative;width:62px;height:62px;flex:none;margin-left:auto;cursor:pointer;border:0;background:none;padding:0;color:#fff}
.ring svg{transform:rotate(-90deg)}
.ring .v{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 14px "Space Grotesk"}
.ring .l{position:absolute;left:-10px;right:-10px;bottom:-16px;text-align:center;font:700 11px Manrope;letter-spacing:.06em;white-space:nowrap;color:oklch(82% .03 255)}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:16px}
.stat{border:0;border-radius:8px;background:oklch(100% 0 0 / .08);padding:8px;text-align:left;color:#fff;cursor:pointer}
.stat b{display:block;font:600 20px "Space Grotesk";letter-spacing:-.03em}
.stat span{font-size:11.5px;line-height:1.25;display:block;color:oklch(85% .02 255)}
.stat.w{grid-column:span 1}
.rep{margin-top:10px;display:flex;gap:8px}
.rep .btn{flex:1 1 0;min-width:0;padding:0 8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 14px;border-radius:6px;border:1px solid transparent;font:700 13px Manrope;cursor:pointer;white-space:nowrap}
.btn-g{background:var(--gold);color:var(--navy)}
.btn-gl{background:oklch(100% 0 0 / .1);color:#fff;border-color:oklch(100% 0 0 / .18)}
.btn-n{background:var(--navy);color:#fff}
.btn-o{background:light-dark(#fff, oklch(13% 0 89.9));color:var(--fg);border-color:var(--border)}
.btn-sm{height:40px;padding:0 12px;font-size:12.5px}
/* cards */
.card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);overflow:visible}
.card.t:before{content:"";position:absolute;left:14px;top:-1px;width:34px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.ch{display:flex;align-items:center;gap:6px;padding:14px 14px 10px}
.ch h2{margin:0;font:800 12px Manrope;letter-spacing:.07em;text-transform:uppercase;color:var(--navy-ink,var(--navy))}
.ch .r{margin-left:auto}
.info{position:relative;display:inline-flex}
.info>button{position:relative;width:24px;height:24px;border:0;background:none;color:oklch(62% .02 255);border-radius:4px;display:grid;place-items:center;cursor:pointer}
.info>button:after{content:"";position:absolute;inset:-8px}
.pr{position:relative}.pr:after{content:"";position:absolute;inset:-8px -2px}
.pop{position:absolute;left:50%;top:calc(100% + 6px);transform:translate(-50%,-4px);z-index:40;width:min(250px,calc(100vw - 24px));padding:10px 12px;border-radius:8px;background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);box-shadow:0 12px 32px -12px oklch(21% .042 264 / .35);font:500 12px/1.45 Manrope;color:var(--fg);opacity:0;visibility:hidden;transition:opacity .15s,transform .15s,visibility .15s;text-transform:none;letter-spacing:0}
.info.open .pop{opacity:1;visibility:visible;transform:translate(-50%,0)}
.pop .ask{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--hair);color:var(--primary);font-weight:700;border-left:0;border-right:0;border-bottom:0;background:none;width:100%;cursor:pointer;padding-left:0}
.go{display:flex;align-items:center;gap:6px;width:100%;border:0;border-top:1px solid var(--hair);background:none;padding:11px 14px;font:800 12px Manrope;color:var(--primary);cursor:pointer;text-align:left;border-radius:0 0 10px 10px}
/* sliding pill */
.seg{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:2px;border-radius:8px;background:light-dark(oklch(96.5% .008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border);margin:0 14px 10px}
.seg .th{position:absolute;top:2px;bottom:2px;left:2px;border-radius:6px;background:var(--navy);transition:transform .42s var(--spring),width .3s}
.seg button{position:relative;z-index:1;border:0;background:none;height:38px;min-width:0;padding:0 4px;border-radius:6px;font:600 12px Manrope;color:light-dark(oklch(50% .022 255), oklch(80% 0.015 255));cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
.seg button[aria-selected=true]{color:#fff}
.seg .c{font:600 11px "IBM Plex Mono";opacity:.75}
/* rows */
.row{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 14px;border-top:1px solid var(--hair);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer;color:inherit}
.row:active{background:var(--raised)}
.row .t{flex:1;min-width:0}
.row .t b{display:block;font:700 13.5px/1.3 Manrope;overflow-wrap:anywhere}
.row .t span{font-size:11.5px;color:var(--muted)}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font:700 11px/16px Manrope;white-space:nowrap}
.tile{width:42px;height:46px;border-radius:8px;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;font:700 16px/1 "Space Grotesk"}
.tile small{font:800 11px Manrope;letter-spacing:.06em;margin-top:2px}
/* status icons · set A (rule 18) */
.si{width:24px;height:24px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff;position:relative}
.si.done{background:oklch(56% .14 150)}.si.now{background:var(--navy);color:var(--gold)}.si.you{background:var(--due)}.si.sbc{background:oklch(56% .19 262)}.si.up{background:light-dark(oklch(95% .008 255), oklch(20.5% 0.008 255));box-shadow:inset 0 0 0 2px oklch(88% .012 255)}.si.late{background:var(--over)}
.si.now:after{content:"";position:absolute;inset:-3px;border-radius:50%;box-shadow:0 0 0 2px var(--gold);animation:pulse 1.9s ease-out infinite}
@keyframes pulse{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.35)}}
/* focus track (style E) */
.ft{padding:4px 14px 12px;position:relative}
.ft .rail{position:absolute;left:25px;top:16px;bottom:24px;width:4px;border-radius:2px;background:repeating-linear-gradient(to bottom,var(--up) 0 3px,transparent 3px 8px)}
.ft .rail i{position:absolute;left:0;top:0;width:4px;border-radius:2px;background:oklch(56% .14 150);height:0;transition:height .9s cubic-bezier(.22,1,.36,1) .2s}
.fs{position:relative;display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:6px 0;text-align:left;cursor:pointer;color:inherit}
.fs .t b{font:700 13px Manrope}.fs .t span{display:block;font-size:11.5px;color:var(--muted)}
.fs.cur{background:var(--navy);color:#fff;border-radius:12px;padding:10px 12px 10px 4px;margin:6px 0;box-shadow:0 10px 24px -10px oklch(21% .042 264 / .55)}
.fs.cur .t span{color:oklch(85% .02 255)}
.fs.cur .eb{font:800 11px Manrope;letter-spacing:.08em;color:var(--gold);text-transform:uppercase}
.fs.cur .si{margin-left:8px}
.fold{display:inline-flex;align-items:center;gap:6px;margin:2px 0 4px 38px;padding:5px 9px;border-radius:6px;border:0;background:var(--ok-light);color:var(--ok-text);font:800 12px Manrope;box-shadow:inset 0 0 0 1.5px oklch(56% .14 150 / .5);cursor:pointer}
.ticks{display:flex;gap:5px;margin:2px 0 0 38px}.ticks i{width:7px;height:7px;border-radius:50%;background:var(--up)}.ticks i.d{background:oklch(56% .14 150)}.ticks i.n{background:var(--gold)}
/* bars */
.pb{height:8px;border-radius:4px;background:var(--raised);overflow:hidden;flex:1}
.pb>i{display:block;height:100%;border-radius:4px;transform-origin:left;transform:scaleX(0);transition:transform .9s cubic-bezier(.2,.7,.2,1)}
.in .pb>i{transform:scaleX(1)}
.gantt{padding:4px 14px 14px;display:flex;flex-direction:column;gap:9px;position:relative}
.gr{display:grid;grid-template-columns:112px 1fr;align-items:center;gap:8px;border:0;background:none;padding:0;text-align:left;cursor:pointer;color:inherit}
.gr span{font:700 11.5px/1.25 Manrope;overflow-wrap:anywhere}
.gt{position:relative;height:14px;border-radius:4px;background:var(--raised)}
.gt i{position:absolute;top:0;bottom:0;border-radius:4px;transform-origin:left;transform:scaleX(0);transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.in .gt i{transform:scaleX(1)}
.today{position:absolute;top:0;bottom:12px;width:2px;background:var(--over);left:calc(14px + 120px + (100% - 148px) * .47)}
.today:before{content:"Today";position:absolute;top:-4px;left:4px;font:800 11px Manrope;color:var(--over-text);white-space:nowrap}
/* donut */
.dn{display:flex;align-items:center;gap:14px;padding:4px 14px 14px}
.dn svg{transform:rotate(-90deg);flex:none}
.dn circle.s{transition:stroke-dasharray .9s cubic-bezier(.22,1,.36,1);cursor:pointer}
.lg{flex:1;display:grid;gap:4px}
.lg button{display:flex;align-items:center;gap:8px;border:0;background:none;padding:6px 6px;border-radius:6px;text-align:left;cursor:pointer;font:600 12.5px Manrope;color:inherit}
.lg button:active{background:var(--raised)}
.lg i{width:10px;height:10px;border-radius:3px}
.lg b{margin-left:auto;font:600 13px "Space Grotesk"}
/* ids */
.idr{display:flex;align-items:center;gap:6px;padding:10px 14px;border-top:1px solid var(--hair)}
.idr .k{width:46px;flex:none;font:800 11px Manrope;letter-spacing:.07em;color:var(--subtle)}
.idr .v{flex:1;min-width:0;font:600 12px "IBM Plex Mono";overflow-wrap:anywhere}
.ic{width:40px;height:40px;border:1px solid var(--border);border-radius:6px;background:light-dark(#fff, oklch(13% 0 89.9));display:grid;place-items:center;color:var(--muted);cursor:pointer;flex:none}
.ic:active{background:var(--primary-light)}
.pr{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 7px;border-radius:4px;border:1px solid var(--border);background:light-dark(#fff, oklch(13% 0 89.9));font:700 11px Manrope;color:var(--navy-ink,var(--navy));cursor:pointer}
.pr.pend{background:var(--due-light);color:var(--due-text);border-color:transparent}
/* bot bubble (rule 16) */
.bot{display:flex;align-items:flex-end;gap:10px;padding:16px 14px 18px}
.bot .bb{position:relative;flex:1;padding:10px 12px;border-radius:10px 10px 10px 2px;background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);box-shadow:0 8px 20px -12px oklch(21% .042 264 / .35)}
.bot .bb b{display:block;font:600 13px/1.45 Manrope}
.bot .bb button{margin-top:6px;border:0;background:none;padding:0;color:var(--primary);font:700 12px Manrope;cursor:pointer}
.av{width:44px;height:44px;flex:none}
/* launcher */
.launch{position:fixed;right:24px;bottom:24px;z-index:30;display:flex;flex-direction:column;align-items:flex-end;gap:6px;animation:rise .55s var(--spring) .5s both}
.launch .lb{background:var(--navy);color:#fff;font:700 12px Manrope;padding:4px 10px;border-radius:6px;position:relative}
.launch .lb:after{content:"";position:absolute;right:27px;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:rotate(45deg)}
.launch button{width:62px;height:62px;border-radius:50%;border:0;background:light-dark(oklch(97.2% .014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% .06 258 / .45),0 0 0 1px var(--border);display:grid;place-items:center;cursor:pointer}
.launch.sink{transform:translateY(70px)}
.launch{transition:transform .35s cubic-bezier(.22,1,.36,1)}
.launch{display:none!important} /* the shared launcher from proto.js replaces it */
@keyframes rise{from{transform:translateY(120px)}to{transform:none}}
.bob{animation:bob 2.6s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
/* sheet */
.scrim{position:fixed;inset:0;z-index:60;background:oklch(20% .05 258 / .45);opacity:0;transition:opacity .2s;pointer-events:none}
.scrim.on{opacity:1;pointer-events:auto}
.sheet{visibility:hidden;position:fixed;left:50%;bottom:0;z-index:61;width:min(100%,560px);max-height:min(82vh,calc(100dvh - 24px));display:flex;flex-direction:column;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:14px 14px 0 0;box-shadow:0 -16px 40px -20px oklch(15% .05 258 / .5);transform:translate(-50%,105%);transition:transform .38s var(--spring)}
.sheet.on{visibility:visible;transform:translate(-50%,0)}
.sheet .grab{display:flex;justify-content:center;padding:8px 0 4px}.sheet .grab i{width:40px;height:4px;border-radius:2px;background:var(--border)}
.sheet .sh{display:flex;align-items:center;gap:8px;padding:4px 14px 10px}
.sheet .sh h3{margin:0;font:800 16px Manrope;color:var(--navy-ink,var(--navy));flex:1}
.sheet .body{overflow:auto;padding-bottom:20px}
/* chat */
.msg{margin:8px 14px;max-width:85%;padding:9px 12px;border-radius:10px;font:500 13px/1.5 Manrope}
.msg.me{margin-left:auto;background:var(--navy);color:#fff;border-radius:10px 10px 2px 10px}
.msg.ai{background:var(--raised);border-radius:10px 10px 10px 2px}
.sug{display:flex;flex-wrap:wrap;gap:6px;padding:4px 14px 10px}
.sug button{min-height:40px;padding:0 10px;border-radius:6px;border:1px solid oklch(54.6% .215 263 / .35);background:var(--primary-light);color:var(--primary);font:600 12px Manrope;cursor:pointer}
.compose{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--hair)}
.compose input{flex:1;height:42px;border-radius:8px;border:1px solid var(--border);padding:0 12px;font:500 14px Manrope}
.typing i{display:inline-block;width:6px;height:6px;margin-right:3px;border-radius:50%;background:var(--subtle);animation:th 1s infinite}.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}
@keyframes th{0%,100%{opacity:.3}50%{opacity:1}}
/* drawer */
.drawer{position:fixed;top:0;bottom:0;left:max(0px,calc(50% - 280px));z-index:62;width:min(300px,calc(100vw - 48px));background:var(--navy);color:#fff;transform:translateX(-105%);visibility:hidden;transition:transform .32s cubic-bezier(.22,1,.36,1),visibility 0s linear .32s;display:flex;flex-direction:column;overflow:auto}
.drawer.on{transform:none;visibility:visible;transition:transform .32s cubic-bezier(.22,1,.36,1)}
.drawer a{display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;color:oklch(85% .02 255);text-decoration:none;font:600 14px Manrope}
.drawer a.on{background:oklch(100% 0 0 / .1);color:#fff;box-shadow:inset 3px 0 0 oklch(66% .16 262)}
.drawer .lbl{padding:14px 16px 6px;font:800 11px Manrope;letter-spacing:.08em;color:var(--gold);text-transform:uppercase}
.drawer .p{display:flex;align-items:center;gap:10px;padding:6px 16px}
.drawer .p i{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font:800 12px Manrope;font-style:normal}
/* skeleton (L1) */
.sk .card,.sk .greet{position:relative}
.sk .card>*,.sk .greet>*{visibility:hidden}
.sk .card:after,.sk .greet:after{content:"";position:absolute;inset:12px;border-radius:6px;background:linear-gradient(90deg,light-dark(oklch(93.5% .008 255), oklch(22.8% 0.008 255)) 0,light-dark(oklch(96.5% .006 255), oklch(18.3% 0.006 255)) 40%,light-dark(oklch(93.5% .008 255), oklch(22.8% 0.008 255)) 80%);background-size:600px 100%;animation:sh 1.2s linear infinite}
.sk .greet:after{background:linear-gradient(90deg,oklch(30% .05 258) 0,oklch(36% .05 258) 40%,oklch(30% .05 258) 80%);background-size:600px 100%}
@keyframes sh{0%{background-position:-300px 0}100%{background-position:300px 0}}
/* enter stagger */
.wrap>*{animation:fu .3s cubic-bezier(.22,1,.36,1) both}
.sk .wrap>*{animation:none}
@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.hide{display:none!important}
body.sheet-open #vp-mini,body.sheet-open #vp-bar{display:none}
:focus-visible{outline:2px solid oklch(54.6% .215 263 / .5);outline-offset:2px}
@media (prefers-reduced-motion: reduce){*,*:before,*:after{animation:none!important;transition:none!important}}

```

## mobile.html markup shell
```html

<div class="app sk" id="app">
  <header class="bar">
    <button class="ib" id="menuBtn" data-vp-menu aria-label="Open menu" type="button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    <span class="logo"><img class="vp-mlogo" src="vcfo-bin:brand/vcfo-icon.png" alt="VCFO Suite" width="23" height="26">Home</span>
    <span style="flex:1"></span>
    <button class="ib" type="button" aria-label="Search" data-act="search"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"/></svg></button>
    <button class="ib" type="button" aria-label="Announcements" data-route="announcements"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"/></svg></button>
    <button class="ib" type="button" aria-label="Notifications, 3 new" data-route="notifications" style="color:var(--primary)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"/></svg><span class="dot">3</span></button>
  </header>
  <main class="wrap" id="main"></main>
</div>

<div class="launch" id="launch"><span class="lb">Ask VCFO</span><button type="button" aria-label="Chat with Ask VCFO" id="botBtn"><span class="bob" style="display:flex"><img class="av" src="vcfo-bin:s/home/assets/vcfo-bot-avatar.svg" alt=""></span></button></div>
<div class="scrim" id="scrim"></div>
<section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="shT"><div class="grab"><i></i></div><div class="sh"><h3 id="shT"></h3><button class="ib" type="button" aria-label="Close" id="shX"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="body" id="shB"></div></section>
<nav class="drawer" id="drawer" aria-label="Main"></nav>


```

## v7p_credentials.dc.html board CSS
```css
<style>
html,body{margin:0;background:light-dark(oklch(97.4% 0.006 255), oklch(16.9% 0.006 255));-webkit-font-smoothing:antialiased}
button,input,select{font:inherit;color:inherit}
button{background:none;border:0;padding:0;cursor:pointer}
:root{--bg:oklch(97.4% 0.006 255);--panel:#fff;--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);
--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);--prog-chip:oklch(51% 0.17 252);
--up:oklch(82% 0.018 255);--up-light:oklch(96.6% 0.007 255);--up-text:oklch(46% 0.028 258);--up-chip:oklch(54% 0.026 258);
--shadow:0 1px 2px oklch(25% 0.04 264 / 0.04),0 6px 18px -10px oklch(28% 0.06 264 / 0.18)}
:root{--vp-side-w:248px}
@media (max-width:1279px){:root{--vp-side-w:72px}}
@media (max-width:767px){:root{--vp-side-w:0px}}
.cr-page{display:flex;width:100%;min-height:100vh;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px;background:var(--bg)}
.cr-side{width:var(--vp-side-w,248px);flex:none;background:#0f2a4a;overflow:hidden}
.cr-main{flex:1;min-width:0;padding-bottom:96px}
.cr-wrap{width:100%;max-width:1600px;margin-inline:auto;box-sizing:border-box}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cr-mono,.cr-vv{font-family:"IBM Plex Mono",ui-monospace,monospace;font-feature-settings:"tnum"}
/* top bar */
.cr-top{height:52px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9));-webkit-backdrop-filter:saturate(1.4) blur(10px);backdrop-filter:saturate(1.4) blur(10px);position:sticky;top:0;z-index:20}
.cr-logo{display:flex;flex:none;align-items:center}
.cr-logo-d{height:26px;width:auto}
.cr-logo-m{display:none}
.cr-mw{display:none;flex:none;align-items:center;gap:6px}
.cr-menu{display:inline-flex}
.cr-trail{flex:1;min-width:0;display:flex;align-items:center;gap:8px;font-weight:600;color:var(--fg);overflow:hidden}
.cr-trail>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-trail-ic{flex:none;width:24px;height:24px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center}
.cr-tr{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}
.cr-srch{display:flex;align-items:center;gap:8px;width:230px;box-sizing:border-box;height:36px;padding:0 10px 0 12px;border-radius:8px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font-weight:500}
.cr-srch span.grow{flex:1;text-align:left}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:500 11px "IBM Plex Mono",monospace;color:var(--muted)}
.cr-ib{position:relative;width:36px;height:36px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--muted);transition:background .15s,color .15s}
.cr-ib:hover{background:var(--primary-light);color:var(--fg)}
.cr-ibs{border:1px solid var(--border);background:var(--panel)}
.cr-badge{position:absolute;top:3px;right:3px;min-width:16px;height:16px;padding:0 3px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:11px;line-height:1;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)}
/* toolbar label (slim, no big heading) */
.cr-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 24px 0}
.cr-tile{width:32px;height:32px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center;flex:none}
.cr-title{margin:0;font:800 13px/1 Manrope,system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--navy-ink,var(--navy))}
.cr-sp{flex:1}
.cr-circ{width:34px;height:34px;border-radius:99px;display:grid;place-items:center;flex:none;color:#fff;background:var(--navy)}
.cr-circ.gold{background:var(--gold)}
.cr-circ.navy{background:var(--navy)}
/* segmented selector: navy active pill with spring */
.cr-seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.cr-seg>.thumb{position:absolute;top:2px;bottom:2px;left:2px;border-radius:5px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s cubic-bezier(.22,1.2,.36,1)}
.cr-seg button{position:relative;z-index:1;height:28px;padding:0 12px;border-radius:5px;font:500 12px Manrope,system-ui,sans-serif;color:oklch(55% 0.022 255);white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:color .2s}
.cr-seg button:hover{color:light-dark(oklch(45% 0.03 255), oklch(82% 0.021 255))}
.cr-seg button.on{color:#fff;font-weight:700}
.cr-seg .cr-cnt{font:600 11px "IBM Plex Mono",monospace;color:oklch(55% 0.022 255)}
.cr-seg button.on .cr-cnt{color:oklch(100% 0 0 / .72)}
.cr-seg5>.thumb{width:calc((100% - 4px)/5)}
.cr-seg:not(.cr-seg5)>.thumb{width:calc(50% - 2px)}
/* buttons */
.cr-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 13px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--fg);font:600 12.5px Manrope,system-ui,sans-serif;white-space:nowrap;transition:background .15s,transform .12s}
.cr-btn:hover{background:var(--raised)}
.cr-btn:active{transform:scale(.98)}
.cr-btn-p{background:var(--navy);border-color:var(--navy);color:#fff}
.cr-btn-p:hover{background:var(--navy-2)}
.cr-btn-p:disabled{background:var(--raised);border-color:var(--border);color:var(--subtle);cursor:not-allowed}
.cr-btn-sm{height:28px;padding:0 9px;font-size:12px}
.cr-link{display:inline-flex;align-items:center;gap:5px;color:var(--primary);font-weight:700;font-size:12px;text-decoration:none;padding:2px 0}
.cr-link:hover{color:var(--primary-dark);text-decoration:underline}
.cr-link:disabled{color:var(--subtle);cursor:not-allowed;text-decoration:none}
button:focus-visible,input:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:2px solid oklch(54.6% .215 263 / .5);outline-offset:2px}
/* chips: one meaning per colour */
.cr-chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font:700 11px/16px Manrope,system-ui,sans-serif;white-space:nowrap;color:#fff;background:var(--up-chip)}
.cr-chip.ok{background:var(--ok-chip)}
.cr-chip.due{background:var(--due-chip)}
.cr-chip.prog{background:var(--prog-chip)}
.cr-chip.up{background:var(--up-chip)}
.cr-chip.lite{background:var(--prog-light);color:var(--prog-text)}
/* identifier cards */
.cr-ids{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,max(240px,calc((100% - 28px) / 3))),1fr));gap:14px;padding:14px 24px 0}
.cr-card{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:0;display:flex;flex-direction:column;transition:border-color .16s,box-shadow .16s}
.cr-card:hover{border-color:oklch(54.6% .215 263 / .35)}
.cr-card::before{content:"";position:absolute;left:18px;top:-1px;width:38px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.cr-ch{display:flex;align-items:center;gap:9px;padding:14px 16px 0;position:relative;flex-wrap:wrap}
.cr-ct{font:800 11.5px Manrope,system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--navy-ink,var(--navy))}
.cr-cb{padding:10px 16px 12px;min-height:58px;display:flex;flex-direction:column;justify-content:center;gap:6px}
.cr-cf{display:flex;align-items:center;gap:8px;padding:10px 16px 12px;border-top:1px solid var(--hair);min-height:50px;flex-wrap:wrap}
.cr-val{font-size:15px;font-weight:700;letter-spacing:.04em}
.cr-mask{font:600 15px "IBM Plex Mono",monospace;color:var(--muted);letter-spacing:.08em}
.cr-sum{font-size:12.5px;font-weight:600;color:var(--fg)}
.cr-vis{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;background:var(--prog-chip);color:#fff;font:700 11px/16px Manrope,system-ui,sans-serif;font-feature-settings:"tnum"}
.cr-ibp{color:var(--primary)}
.cr-tipw{position:relative;display:inline-flex}
.cr-pop{display:none;position:absolute;left:0;top:calc(100% + 6px);z-index:30;width:250px;padding:9px 11px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:0 12px 32px -12px oklch(21% .042 264 / .35);font:500 12px/1.45 Manrope,system-ui,sans-serif;color:var(--fg)}
.cr-tipw.open .cr-pop{display:block}
.cr-ch .cr-tipw .cr-ib{width:24px;height:24px;color:oklch(62% .02 255)}
/* bot empty state (rule 16) */
.cr-bot{display:flex;align-items:center;gap:10px}
.cr-bot svg{flex:none}
.cr-bub{position:relative;display:inline-block;background:var(--navy);color:#fff;border-radius:8px;padding:6px 10px;font:600 12px/1.35 Manrope,system-ui,sans-serif}
/* workbook */
.cr-wb{margin:14px 24px 0;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);padding:12px 14px 14px;min-width:0}
.cr-wbh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.cr-segx{max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;border-radius:8px}
.cr-segx::-webkit-scrollbar{display:none}
.cr-segx>.cr-seg{width:max-content}
.cr-wbb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
.cr-sel{display:none}
.cr-sel select{height:34px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:600 13px Manrope,system-ui,sans-serif;width:100%}
.cr-note{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.cr-cnt{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.cr-gridbox{overflow:auto;max-height:440px;border:1px solid var(--border);border-radius:8px;background:var(--panel);-webkit-overflow-scrolling:touch}
.cr-t{border-collapse:separate;border-spacing:0;font-size:12.5px;width:max-content;min-width:100%}
.cr-t th,.cr-t td{border-right:1px solid var(--hair);border-bottom:1px solid var(--hair);padding:0 9px;height:34px;text-align:left;vertical-align:middle;white-space:nowrap;background:var(--panel);max-width:260px;min-width:120px;font-weight:500}
.cr-t td{overflow:hidden;text-overflow:ellipsis;max-width:360px}
.cr-t thead th{position:sticky;top:0;z-index:3;background:var(--raised);font:700 11px/1 Manrope,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);height:30px}
.cr-t thead tr.cr-letters th{top:0;height:22px;font:600 11px/1 "IBM Plex Mono",monospace;letter-spacing:0;text-transform:none;color:var(--subtle);text-align:center;min-width:120px}
.cr-t thead tr.cr-names th{top:22px}
.cr-t thead tr.cr-letters th.cr-g{width:84px;min-width:84px;max-width:84px}
.cr-t .cr-g,.cr-t .cr-sno{box-sizing:border-box}
.cr-lt{display:block;max-width:236px;white-space:normal;line-height:1.3}
.cr-t thead tr.cr-letters th.cr-sno{width:56px;min-width:56px;max-width:56px}
.cr-t .cr-g{position:sticky;left:0;z-index:2;width:84px;min-width:84px;max-width:84px;text-align:center;background:var(--raised);font:600 11px "IBM Plex Mono",monospace;color:var(--subtle);padding:0 4px}
.cr-gw{display:flex;align-items:center;justify-content:space-between;gap:2px}
.cr-rn{min-width:24px;text-align:center}
.cr-rn.on{color:var(--prog-text);font-weight:700}
.cr-rb{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;color:var(--subtle);flex:none}
.cr-rb:hover{background:var(--primary-light);color:var(--primary)}
.cr-rb.on{background:var(--navy);color:#fff}
.cr-rb-x{width:22px;flex:none}
.cr-t thead .cr-g{z-index:5}
.cr-t .cr-c0{position:sticky;left:84px;z-index:2;font-weight:700;color:var(--fg);min-width:200px;max-width:240px;box-shadow:1px 0 0 var(--hair)}
.cr-t thead .cr-c0{z-index:4}
.cr-t tbody tr:hover td,.cr-t tbody tr:hover th.cr-g{background:light-dark(oklch(96.8% .006 250), oklch(17.8% 0.006 250))}
.cr-t td[data-edit]{cursor:default}
.cr-t td.cr-can,.cr-t th.cr-can{cursor:text}
.cr-t td.cr-can:hover,.cr-t th.cr-can:hover{box-shadow:inset 0 0 0 1px oklch(54.6% .215 263 / .45)}
.cr-t tbody td.cr-can{background:light-dark(oklch(99.2% .008 85), oklch(14.2% 0.008 85))}
.cr-t tbody tr.cr-rowon td{background:light-dark(oklch(97.8% .012 250), oklch(16.3% 0.01 250))}
.cr-stsel{height:26px;border-radius:4px;border:1px solid var(--border);background:var(--panel);font:700 11.5px Manrope,system-ui,sans-serif;padding:0 6px;color:var(--fg)}
.cr-src{display:inline-flex;align-items:center;border-radius:4px;padding:1px 6px;background:var(--prog-light);color:var(--prog-text);font:700 11px/15px Manrope,system-ui,sans-serif;white-space:nowrap;cursor:help;flex:none}
.cr-src.ed{background:light-dark(#fbf3df, oklch(24.1% 0.076 88.7));color:light-dark(#6e500f, oklch(81.9% 0.061 81.3))}
.cr-srcrow{display:block;margin-top:3px;line-height:1}
.cr-t td.cr-has-src{padding-top:6px;padding-bottom:6px}
.cr-cb .cr-src{align-self:flex-start}
.cr-ttl-in{position:sticky;left:84px;display:block;width:var(--vis-w,600px);text-align:center;white-space:normal;line-height:1.35;padding:7px 8px;box-sizing:border-box}
.cr-vis.ed{background:var(--navy)}
.cr-spacer td,.cr-spacer th{height:14px!important;background:var(--raised)!important}
.cr-addrow{padding-top:10px}
.cr-t td.cr-editing{padding:0 4px;box-shadow:inset 0 0 0 2px var(--primary)}
.cr-lk{display:inline-block;vertical-align:-1px;margin-left:4px;color:var(--gold)}
.cr-ed-in{width:100%;height:28px;border:0;outline:0;background:transparent;font:500 12.5px Manrope,system-ui,sans-serif;padding:0 5px}
.cr-td-x{display:inline-flex;align-items:center;gap:6px}
.cr-ib.cr-s{width:24px;height:24px;border-radius:6px;color:var(--muted)}
.cr-ib.cr-s:hover{background:var(--primary-light);color:var(--primary)}
.cr-dash{color:var(--subtle)}
.cr-cellpad{display:inline-flex;align-items:center;gap:6px;vertical-align:middle}
.cr-empty-td{background:var(--panel)!important;padding:18px 16px!important;height:auto!important;white-space:normal!important;max-width:none!important}
.cr-empty{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
/* sticky S.No and label offsets */
.cr-t .cr-sno{position:sticky;left:84px;z-index:2;width:56px;min-width:56px;max-width:56px;text-align:center;font:600 11px "IBM Plex Mono",monospace;color:var(--muted);padding:0 4px}
.cr-t thead .cr-sno{z-index:4}
.cr-t .cr-c0.cr-l96{left:140px}
/* Directors KYC: transposed sheet, Excel-like thin borders */
.cr-t.xl th,.cr-t.xl td{border-right:1px solid light-dark(oklch(86% .012 255), oklch(27.6% 0.012 255));border-bottom:1px solid light-dark(oklch(86% .012 255), oklch(27.6% 0.012 255))}
.cr-t.kyc .cr-eq{width:220px;min-width:220px;max-width:220px}
.cr-t thead tr.cr-ttlrow th{height:30px;padding:0}
.cr-t thead th.cr-ttl{background:var(--navy);color:#fff;text-align:center;font:800 12.5px/1 Manrope,system-ui,sans-serif;letter-spacing:.1em;text-transform:none;max-width:none;z-index:3}
.cr-t thead th.cr-ttl.cr-ttl2{background:var(--navy-2);font:600 12px/1 Manrope,system-ui,sans-serif;letter-spacing:.01em}
.cr-t.kyc thead tr.cr-names th{text-transform:none;font:800 12px/1.2 Manrope,system-ui,sans-serif;color:var(--navy-ink,var(--navy));letter-spacing:0;background:light-dark(oklch(95.5% .012 255), oklch(19.8% 0.01 255))}
.cr-t thead th[data-edit]{cursor:text}
.cr-t thead th[data-edit]:hover{box-shadow:inset 0 0 0 1px oklch(54.6% .215 263 / .35)}
.cr-t th.cr-editing{padding:0 4px;box-shadow:inset 0 0 0 2px var(--primary)}
.cr-t td.cr-ind{padding-left:28px;font-weight:600;color:var(--muted)}
.cr-t td.cr-tall{white-space:pre-line;line-height:1.45;padding:7px 9px;vertical-align:top;height:auto}
.cr-t td.cr-tall .cr-cellpad{align-items:flex-start}
.cr-pre{white-space:pre-line}
.cr-ed-in.cr-ed-ta{height:auto;min-height:62px;resize:vertical;line-height:1.4;padding:4px 5px;white-space:pre-wrap}
/* OTP dialog, drawer, scrim */
.cr-scrim{position:fixed;inset:0;background:oklch(20% .05 258 / .55);z-index:90;animation:cr-fade .2s ease both;z-index:2147483001}
.cr-dlg{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:440px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 24px);overflow:auto;box-sizing:border-box;z-index:2147483001;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% .05 258 / .55);display:flex;flex-direction:column;overflow:hidden;animation:cr-pop .22s cubic-bezier(.22,1,.36,1) both}
.cr-dh{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)}
.cr-dhx{flex:1;min-width:0}
.cr-dt{margin:0;font:700 15px Manrope,system-ui,sans-serif;color:var(--navy-ink,var(--navy))}
.cr-cap{font-size:11.5px;color:var(--muted);margin-top:2px}
.cr-db{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.cr-msg{margin:0;font:500 13px/1.5 Manrope,system-ui,sans-serif;color:var(--fg)}
.cr-digs{display:flex;gap:8px;justify-content:center}
.cr-dig{width:44px;height:52px;border-radius:6px;border:1.5px solid var(--border);background:var(--panel);text-align:center;font:600 22px "IBM Plex Mono",monospace;color:var(--fg);outline:0;transition:border-color .15s,box-shadow .15s}
.cr-dig:focus{border-color:var(--primary);box-shadow:0 0 0 3px oklch(54.6% .215 263 / .18)}
.cr-dig.bad{border-color:var(--over)}
.cr-dig:disabled{background:var(--raised);color:var(--subtle)}
.cr-err{min-height:18px;font-size:12px;font-weight:700;color:var(--over-text);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cr-ei{font-weight:600;color:var(--muted)}
.cr-ok{font-size:12px;font-weight:600;color:var(--prog-text)}
.cr-lock{border-radius:6px;background:var(--over-light);color:var(--over-text);padding:8px 10px;font-size:12px;font-weight:700}
.cr-hint{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.cr-df{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--raised)}
.cr-dfo .cr-btn{height:32px}
#cr-otp,#cr-drawer{font-family:Manrope,system-ui,sans-serif;font-size:13px;color:var(--fg)}
/* access log drawer */
.cr-drawer{position:fixed;top:0;right:0;bottom:0;width:400px;max-width:100vw;z-index:2147483001;background:var(--panel);box-shadow:-20px 0 50px -24px oklch(15% .05 258 / .5);display:flex;flex-direction:column;animation:cr-slide .26s cubic-bezier(.22,1,.36,1) both}
.cr-drawer .cr-dh{border-bottom:1px solid var(--border)}
.cr-log{list-style:none;margin:0;padding:6px 18px;overflow:auto;flex:1}
.cr-log li{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;padding:10px 0;border-top:1px solid var(--hair);font-size:12.5px;line-height:1.4}
.cr-log li:first-child{border-top:0}
.cr-log time{font-size:11px;color:var(--subtle);white-space:nowrap}
.cr-drawer .cr-df{justify-content:space-between}
@keyframes cr-fade{from{opacity:0}to{opacity:1}}
@keyframes cr-pop{from{opacity:0;transform:translate(-50%,-46%)}to{opacity:1;transform:translate(-50%,-50%)}}
@keyframes cr-slide{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
@keyframes cr-up{from{transform:translateY(100%)}to{transform:none}}
/* tablet: narrower search so the top bar never overlaps (the shell may add the Before | After pill before Announcements) */
@media (max-width:1279px){.cr-srch{width:196px}}
@media (max-width:959px){.cr-srch{width:36px;padding:0;justify-content:center}.cr-srch span,.cr-srch .kbd{display:none}.cr-bar{padding:14px 20px 0}.cr-ids{padding:14px 20px 0}.cr-wb{margin:14px 20px 0}}
/* phone: bottom sheet, stacked cards, select tabs, grid scrolls inside its box */
@media (max-width:767px){
  .cr-page{display:block;min-height:0}
  .cr-side{display:none}
  .cr-top{padding:0 12px;gap:8px}
  .cr-mw{display:inline-flex}
  .cr-logo{display:none}
  .cr-theme{display:none}
  .cr-trail-ic{display:none}
  .cr-trail{font-size:15px;font-weight:700}
  .cr-tr{gap:4px}
  .cr-trail{font-size:13px}
  .cr-srch{width:40px;height:40px;padding:0;justify-content:center}
  .cr-srch span,.cr-srch .kbd{display:none}
  .cr-ib,.cr-ibs{width:40px;height:40px}
  .cr-segx{display:none}
  /* touch targets >= 40 px */
  .cr-btn,.cr-btn-sm,.cr-dfo .cr-btn{height:40px}
  .cr-seg button{height:40px}
  .cr-sel select{height:40px}
  .cr-link{min-height:40px}
  .cr-ch .cr-tipw .cr-ib{width:40px;height:40px;margin:-8px}
  .cr-rb{width:40px;height:40px}
  .cr-ib.cr-s{width:40px;height:40px}
  .cr-stsel{height:40px}
  .cr-t th,.cr-t td{height:44px}
  .cr-bar{padding:12px 16px 0}
  .cr-sp{display:none}
  .cr-ids{grid-template-columns:minmax(0,1fr);gap:10px;padding:12px 16px 0}
  .cr-wb{margin:12px 16px 0;padding:10px}
  .cr-seg5{display:none}
  .cr-sel{display:block;width:100%}
  .cr-wbh{gap:8px}
  .cr-wbh .cr-note{width:100%}
  .cr-gridbox{max-height:58vh}
  .cr-dlg{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-width:none;max-height:calc(100dvh - 12px);border-radius:16px 16px 0 0;animation:cr-up .3s cubic-bezier(.22,1,.36,1) both}
  .cr-drawer{width:100vw}
  .cr-dig{width:40px;height:50px}
  .cr-digs{gap:6px}
  .cr-card::before{left:14px}
  .cr-t .cr-c0{min-width:0;white-space:normal}
  .cr-lt{max-width:112px}
  .cr-t.kyc .cr-eq{width:176px;min-width:176px;max-width:176px}
  .cr-t .cr-sno{left:auto}
  .cr-t .cr-c0.cr-l96{left:84px}
}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
}
/* Slate with authority colours: the page accent moves from navy to slate (the sidebar keeps
   SBC navy), each card is coloured by who issues the credential, and the heavy navy note
   bubbles become light strips in the card's own colour */
:root{--navy:oklch(30% 0.025 255);--navy-2:oklch(37% 0.025 255)}
.cr-card[data-auth=mca]{--a:oklch(44% 0.15 275);--a-bg:oklch(96% 0.025 275);--a-fg:oklch(38% 0.13 275)}
.cr-card[data-auth=it]{--a:oklch(48% 0.1 200);--a-bg:oklch(96% 0.025 200);--a-fg:oklch(38% 0.08 200)}
.cr-card[data-auth=gst]{--a:oklch(48% 0.12 155);--a-bg:oklch(96% 0.03 155);--a-fg:oklch(36% 0.09 155)}
.cr-card[data-auth=oth]{--a:oklch(62% 0.13 70);--a-bg:oklch(96.4% 0.04 75);--a-fg:oklch(42% 0.09 62)}
.cr-card[data-auth] .cr-circ{background:var(--a)}
.cr-card[data-auth]::before{left:-1px;right:-1px;width:auto;top:-1px;height:3px;border-radius:10px 10px 0 0;background:var(--a)}
.cr-card[data-auth] .cr-bub{background:var(--a-bg);color:var(--a-fg)}
.cr-card[data-auth]:hover{border-color:color-mix(in oklab,var(--a) 40%,transparent)}
.cr-chip.up{background:light-dark(oklch(95.4% 0.006 250), oklch(19.9% 0.006 250));color:light-dark(oklch(45% 0.015 255), oklch(82% 0.01 255))}
/* Six across, tinted: one row of six small tiles; three per row on tablets, two on phones */
.cr-ids{grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
@media (max-width:1100px){.cr-ids{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.cr-ids{grid-template-columns:repeat(2,minmax(0,1fr))}}
.cr-ctile[data-auth=mca]{--a-bg:oklch(96% 0.025 275);--a-fg:oklch(38% 0.13 275)}
.cr-ctile[data-auth=it]{--a-bg:oklch(96% 0.025 200);--a-fg:oklch(38% 0.08 200)}
.cr-ctile[data-auth=gst]{--a-bg:oklch(96% 0.03 155);--a-fg:oklch(36% 0.09 155)}
.cr-ctile[data-auth=oth]{--a-bg:oklch(96.4% 0.04 75);--a-fg:oklch(42% 0.09 62)}
.cr-ctile{background:var(--a-bg);border-radius:9px;padding:9px 10px 10px;min-width:0;display:flex;flex-direction:column;gap:5px}
.cr-ctt{display:flex;align-items:center;gap:2px;min-height:22px}
.cr-ctn{flex:1;min-width:0;font:800 10.5px Manrope,system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:var(--a-fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-ctile .cr-ib{width:22px;height:22px;color:var(--a-fg)}
.cr-ctv{font:600 12.5px "IBM Plex Mono",monospace;font-feature-settings:"tnum";color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-ctv.cr-cpend{font:600 11.5px Manrope,system-ui,sans-serif;color:var(--muted)}
html[data-theme="dark"]:root{--navy:oklch(44% 0.02 255);--navy-2:oklch(50% 0.02 255)}
</style>
```


---

# Appendix B: verbatim markup + per-board CSS + render logic (FINAL prototype)
Source dir: `docs/specs/client-pages/prototype/final-src/s/home/`. Shared CSS that every board repeats is in Appendix A and is NOT repeated here. `{{x}}` = template binding computed in the board script (shown after the markup). `<sc-for list>` = repeat, `<sc-if value>` = conditional, `<dc-import name>` = embed another board. For `v7c_steps_b` only the first phase block is shown (all 48 rows follow the same row template; see section 5.10). `_a` variants that differ only in data are covered by diffs in the main file.

## v7_before.dc.html

Board-specific CSS:
```css
<style>
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
.lbl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
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
th{text-align:left;padding:8px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border)}
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
.seg .cnt{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
/* Recent documents, grouped by arrival: rows, not boxes; controls appear on hover or focus */
.rd-g{font:800 10px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--subtle);margin:0 0 2px;display:flex;align-items:center;gap:8px}
.rd-g::after{content:"";height:1px;flex:1;background:var(--hair)}
.rd-r+.rd-g{margin-top:12px}
.rd-r{display:flex;align-items:center;gap:9px;padding:7px 2px;border-radius:6px;cursor:pointer;min-width:0}
.rd-r:hover{background:var(--raised)}
.rd-r:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.rd-ft{flex:none;width:20px;height:20px;border-radius:6px;text-align:center;font:700 7px/20px "IBM Plex Mono",monospace;letter-spacing:-.02em}
.rd-n{flex:1;min-width:0;font-size:12.5px;font-weight:500;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-s{flex:none;font:600 11px Manrope,sans-serif;color:var(--subtle);white-space:nowrap}
.rd-s .rd-me{color:var(--gold-text)}
.rd-s .rd-d{font-family:"IBM Plex Mono",monospace;font-weight:500;font-feature-settings:"tnum"}
.rd-s .rd-sep{opacity:.45;margin:0 4px}
.rd-a{display:flex;gap:2px;flex:none}
.rd-b{width:26px;height:26px;padding:0;border:0;border-radius:6px;background:none;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.rd-b:hover{background:var(--primary-light);color:var(--primary)}
.rd-b:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
@media (max-width:330px){.rd-s .rd-who{display:none}.rd-s .rd-sep{display:none}}
/* every status chip is one width, so the column reads as a column and the cell
   beside it keeps the same x on every row */
.stp-row>td:nth-child(4)>.chip{min-width:116px;justify-content:center}
.stp-row>td:nth-child(3)>.chip{min-width:88px;justify-content:center}
</style>
```

Markup:
```html
<div class="vh-root">
  <div class="vh-side" data-vp="side"><dc-import name="v7c_side" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="vh-body"><header class="vh-top" style="height:52px;display:flex;align-items:center;gap:var(--vh-hg);padding:0 var(--vh-hp);border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))"><button type="button" class="vh-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16 M4 12h16 M4 17h16"></path></svg></button><a href="#" aria-label="SBC home" style="display:flex;flex:none"><img src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC" style="height:26px;width:auto"></a><nav class="vh-crumb" aria-label="Location" style="flex:1;min-width:0;display:flex;align-items:center;gap:6px"><span style="flex:none;width:24px;height:24px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 4.5h6v7h-6Z M13.5 12.5h6v7h-6Z"></path><path d="M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z"></path></svg></span><ol style="display:flex;align-items:center;gap:4px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden"><li style="flex:0 1 auto;min-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fg)" aria-current="page" title="Home">Home</li></ol></nav><div style="margin-left:auto;flex:none;display:flex;align-items:center;gap:6px"><button type="button" class="vh-search" aria-label="Search (⌘K)" style="display:flex;align-items:center;gap:8px;height:36px;border-radius:8px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope,sans-serif;cursor:text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:oklch(54.6% 0.215 263 / .8)"><path class="duo" d=""></path><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><span style="flex:1;text-align:left">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></button><button type="button" aria-label="Announcements" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4 10h3l8-4.5v13L7 14H4Z"></path><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"></path></svg></button><button type="button" aria-label="Notifications, 3 new" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;background:var(--primary-light);color:var(--primary)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z"></path><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg><span style="position:absolute;top:4px;right:4px;min-width:15px;height:15px;padding:0 2px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)">3</span></button><button type="button" aria-label="Switch to dark theme" style="width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z"></path><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4"></path></svg></button></div></header>
    <main class="vh-main vh-b"><div class="stag" style="grid-area:g"><div style="animation-delay:0.04s"><dc-import name="v7c_greet_b" hint-size="100%,120px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:a"><div style="animation-delay:0.10s"><dc-import name="v7c_needs_b" hint-size="100%,300px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.16s"><dc-import name="v7c_current" hint-size="100%,420px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:c1"><div style="animation-delay:0.22s"><dc-import name="v7c_alerts_b" hint-size="100%,380px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.28s"><dc-import name="v7c_sbc_b" hint-size="100%,380px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:b"><div style="animation-delay:0.34s"><dc-import name="v7c_timeline_b" hint-size="100%,280px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.40s"><dc-import name="v7c_steps_b" hint-size="100%,500px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:c2"><div style="animation-delay:0.46s"><dc-import name="v7c_docs_b" hint-size="100%,400px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.52s"><dc-import name="v7c_activity_b" hint-size="100%,280px" style="display:block;width:100%"></dc-import></div></div></main>
  </div>
  <div style="position:absolute;top:0;right:0;width:min(420px,100%);height:min(900px,100vh);pointer-events:none;z-index:5"><div style="pointer-events:auto"><div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5"><span style="background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px;position:relative">Ask VCFO<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span><button type="button" aria-label="Open Ask VCFO" aria-expanded="false" aria-controls="ask-panel" style="width:68px;height:68px;border-radius:99px;border:0;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span class="bob" style="display:flex"><dc-import name="v7c_bot" state="idle" size="50" hint-size="50px,50px"></dc-import></span></button></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1608}}'>
class Component extends DCLogic {
  renderVals() { return { openSide: () => { if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell && window.vcfoShell.openDrawer) window.vcfoShell.openDrawer(); } }; }
}
</script>
```

## v7_after.dc.html

Board-specific CSS:
```css
<style>
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
.lbl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
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
th{text-align:left;padding:8px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border)}
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
.seg .cnt{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
/* Recent documents, grouped by arrival: rows, not boxes; controls appear on hover or focus */
.rd-g{font:800 10px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--subtle);margin:0 0 2px;display:flex;align-items:center;gap:8px}
.rd-g::after{content:"";height:1px;flex:1;background:var(--hair)}
.rd-r+.rd-g{margin-top:12px}
.rd-r{display:flex;align-items:center;gap:9px;padding:7px 2px;border-radius:6px;cursor:pointer;min-width:0}
.rd-r:hover{background:var(--raised)}
.rd-r:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.rd-ft{flex:none;width:20px;height:20px;border-radius:6px;text-align:center;font:700 7px/20px "IBM Plex Mono",monospace;letter-spacing:-.02em}
.rd-n{flex:1;min-width:0;font-size:12.5px;font-weight:500;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-s{flex:none;font:600 11px Manrope,sans-serif;color:var(--subtle);white-space:nowrap}
.rd-s .rd-me{color:var(--gold-text)}
.rd-s .rd-d{font-family:"IBM Plex Mono",monospace;font-weight:500;font-feature-settings:"tnum"}
.rd-s .rd-sep{opacity:.45;margin:0 4px}
.rd-a{display:flex;gap:2px;flex:none}
.rd-b{width:26px;height:26px;padding:0;border:0;border-radius:6px;background:none;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.rd-b:hover{background:var(--primary-light);color:var(--primary)}
.rd-b:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
@media (max-width:330px){.rd-s .rd-who{display:none}.rd-s .rd-sep{display:none}}
/* every status chip is one width, so the column reads as a column and the cell
   beside it keeps the same x on every row */
.stp-row>td:nth-child(4)>.chip{min-width:116px;justify-content:center}
.stp-row>td:nth-child(3)>.chip{min-width:88px;justify-content:center}
</style>
```

Markup:
```html
<div class="vh-root">
  <div class="vh-side" data-vp="side"><dc-import name="v7c_side_a" hint-size="248px,900px" style="display:block;width:248px"></dc-import></div>
  <div class="vh-body"><header class="vh-top" style="height:52px;display:flex;align-items:center;gap:var(--vh-hg);padding:0 var(--vh-hp);border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))"><button type="button" class="vh-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16 M4 12h16 M4 17h16"></path></svg></button><a href="#" aria-label="SBC home" style="display:flex;flex:none"><img src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC" style="height:26px;width:auto"></a><nav class="vh-crumb" aria-label="Location" style="flex:1;min-width:0;display:flex;align-items:center;gap:6px"><span style="flex:none;width:24px;height:24px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 4.5h6v7h-6Z M13.5 12.5h6v7h-6Z"></path><path d="M4.5 4.5h6v7h-6Z M13.5 4.5h6v4h-6Z M13.5 12.5h6v7h-6Z M4.5 15.5h6v4h-6Z"></path></svg></span><ol style="display:flex;align-items:center;gap:4px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden"><li style="flex:0 1 auto;min-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--fg)" aria-current="page" title="Home">Home</li></ol></nav><div style="margin-left:auto;flex:none;display:flex;align-items:center;gap:6px"><button type="button" class="vh-search" aria-label="Search (⌘K)" style="display:flex;align-items:center;gap:8px;height:36px;border-radius:8px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope,sans-serif;cursor:text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:oklch(54.6% 0.215 263 / .8)"><path class="duo" d=""></path><path d="M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4"></path></svg><span style="flex:1;text-align:left">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></button><button type="button" aria-label="Announcements" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4 10h3l8-4.5v13L7 14H4Z"></path><path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"></path></svg></button><button type="button" aria-label="Notifications, 3 new" style="position:relative;width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;flex:none;background:var(--primary-light);color:var(--primary)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z"></path><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"></path></svg><span style="position:absolute;top:4px;right:4px;min-width:15px;height:15px;padding:0 2px;box-sizing:border-box;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--panel)">3</span></button><button type="button" aria-label="Switch to dark theme" style="width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z"></path><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M5.6 18.4 7 17 M17 7l1.4-1.4"></path></svg></button></div></header>
    <main class="vh-main vh-a"><div class="stag" style="grid-area:g"><div style="animation-delay:0.04s"><dc-import name="v7c_greet_a" hint-size="100%,120px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:a1"><div style="animation-delay:0.10s"><dc-import name="v7c_needs_a" hint-size="100%,300px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.16s"><dc-import name="v7c_next" hint-size="100%,420px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:c1"><div style="animation-delay:0.22s"><dc-import name="v7c_alerts_a" hint-size="100%,380px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.28s"><dc-import name="v7c_sbc_a" hint-size="100%,240px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:a2"><div style="animation-delay:0.34s"><dc-import name="v7c_comp" hint-size="100%,260px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:c2"><div style="animation-delay:0.40s"><dc-import name="v7c_ids" hint-size="100%,300px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:f"><div style="animation-delay:0.46s"><dc-import name="v7c_area" hint-size="100%,400px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.52s"><dc-import name="v7c_reg" hint-size="100%,600px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.58s"><dc-import name="v7c_postinc" hint-size="100%,500px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.64s"><dc-import name="v7c_timeline_a" hint-size="100%,260px" style="display:block;width:100%"></dc-import></div><div style="animation-delay:0.70s"><dc-import name="v7c_steps_a" hint-size="100%,160px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:d"><div style="animation-delay:0.76s"><dc-import name="v7c_docs_a" hint-size="100%,300px" style="display:block;width:100%"></dc-import></div></div><div class="stag" style="grid-area:e"><div style="animation-delay:0.82s"><dc-import name="v7c_activity_a" hint-size="100%,300px" style="display:block;width:100%"></dc-import></div></div></main>
  </div>
  <div style="position:absolute;top:0;right:0;width:min(420px,100%);height:min(900px,100vh);pointer-events:none;z-index:5"><div style="pointer-events:auto"><div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5"><span style="background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px;position:relative">Ask VCFO<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span><button type="button" aria-label="Open Ask VCFO" aria-expanded="false" aria-controls="ask-panel" style="width:68px;height:68px;border-radius:99px;border:0;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span class="bob" style="display:flex"><dc-import name="v7c_bot" state="idle" size="50" hint-size="50px,50px"></dc-import></span></button></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":3240}}'>
class Component extends DCLogic {
  renderVals() { return { openSide: () => { if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell && window.vcfoShell.openDrawer) window.vcfoShell.openDrawer(); } }; }
}
</script>
```

## v7c_greet_b.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="vh-greet" style="position:relative;border-radius:10px;padding:12px clamp(14px,2vw,18px) 10px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 60%,var(--navy-3-deep,var(--navy-3)) 100%);color:#fff;overflow:hidden"><div class="vh-gtop" style="display:flex;align-items:center;gap:14px"><div style="flex:1;min-width:0"><div class="mono" style="font-size:11px;opacity:.65">TUE 6 OCT 2026</div><h1 class="metric" style="margin:2px 0 0;font-size:clamp(19px,calc(15px + 0.6vw),24px);line-height:1.15;color:#fff">Northwind Technologies India Pvt Ltd</h1></div><a class="btn" href="#" aria-label="Report" style="height:30px;padding:0 10px;background:oklch(100% 0 0 / 0.12);color:#fff;border-color:oklch(100% 0 0 / 0.28)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg><span class="vh-hide-xs">Report</span></a><div style="display:flex;flex-direction:column;align-items:center"><div class="tipw" role="button" tabindex="0" aria-label="Incorporation · 6 of 14 SPICe+ steps" onClick="{{dd0}}" style="position:relative;width:46px;height:46px;border-radius:99px;background:conic-gradient(var(--gold) 0 43%,oklch(100% 0 0 / 0.16) 43% 100%);display:flex;align-items:center;justify-content:center"><span class="tt l w" role="tooltip">Incorporation · 6 of 14 SPICe+ steps</span><div style="width:37px;height:37px;border-radius:99px;background:var(--navy-2);display:flex;align-items:center;justify-content:center;font:700 11px Space Grotesk">43%</div></div><span style="font-size:11px;letter-spacing:.1em;opacity:.7;margin-top:2px;white-space:nowrap">SPICE+</span></div></div><div style="height:1px;background:oklch(100% 0 0 / 0.14);margin:8px 0 7px"></div><div class="vh-stats" style="display:flex;flex-wrap:wrap"><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:oklch(86% 0.09 60)">4</span><span style="font-size:11.5px;opacity:.75">Waiting on Northwind</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:#fff">1</span><span style="font-size:11.5px;opacity:.75">With SBC</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:oklch(84% 0.09 20)">1</span><span style="font-size:11.5px;opacity:.75">Overdue</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:#fff">4/6</span><span style="font-size:11.5px;opacity:.75">Documents in</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:#fff">28 Oct</span><span style="font-size:11.5px;opacity:.75">Expected COI</span></div></div><span style="position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)"></span></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":170}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Incorporation steps", "tabs": [["All", 14], ["Completed", 6], ["In progress", 3], ["Waiting for Northwind", 1], ["Upcoming", 4]], "rows": [["Client Details", "12 Sep", "Completed", "ok", 1], ["Draft Board Resolution", "14 Sep", "Completed", "ok", 1], ["Signed Board Resolution", "18 Sep", "Completed", "ok", 1], ["Name Application", "Part A", "Completed", "ok", 1], ["Name Approval", "24 Sep", "Completed", "ok", 1], ["Capital Structure", "1 Oct", "Completed", "ok", 1], ["Proposed Directors", "6 Oct", "In progress", "prog", 2], ["Subscriber Details", "10 Oct", "In progress", "prog", 2], ["Registered Office Address", "9 Oct", "Waiting", "due", 3], ["KYC Review & DSC", "13 Oct", "In progress", "prog", 2], ["SPICe+ Confirmation", "16 Oct", "Upcoming", "up", 4], ["SPICe+ Filing", "20 Oct", "Upcoming", "up", 4], ["MCA Remarks", "24 Oct", "Upcoming", "up", 4], ["Certificate of Incorporation", "28 Oct", "Upcoming", "up", 4]]}]; const __O = [[0, 0]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    return __d;
  }
}
</script>
```

## v7c_greet_a.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="vh-greet" style="position:relative;border-radius:10px;padding:12px clamp(14px,2vw,18px) 10px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 60%,var(--navy-3-deep,var(--navy-3)) 100%);color:#fff;overflow:hidden"><div class="vh-gtop" style="display:flex;align-items:center;gap:14px"><div style="flex:1;min-width:0"><div class="mono" style="font-size:11px;opacity:.65">SUN 8 NOV 2026</div><h1 class="metric" style="margin:2px 0 0;font-size:clamp(19px,calc(15px + 0.6vw),24px);line-height:1.15;color:#fff">Northwind Technologies India Pvt Ltd</h1></div><a class="btn" href="#" aria-label="Report" style="height:30px;padding:0 10px;background:oklch(100% 0 0 / 0.12);color:#fff;border-color:oklch(100% 0 0 / 0.28)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg><span class="vh-hide-xs">Report</span></a><div style="display:flex;flex-direction:column;align-items:center"><div class="tipw" role="button" tabindex="0" aria-label="Setup · 7 of 11 done" onClick="{{dd0}}" style="position:relative;width:46px;height:46px;border-radius:99px;background:conic-gradient(var(--gold) 0 64%,oklch(100% 0 0 / 0.16) 64% 100%);display:flex;align-items:center;justify-content:center"><span class="tt l w" role="tooltip">Setup · 7 of 11 done</span><div style="width:37px;height:37px;border-radius:99px;background:var(--navy-2);display:flex;align-items:center;justify-content:center;font:700 11px Space Grotesk">64%</div></div><span style="font-size:11px;letter-spacing:.1em;opacity:.7;margin-top:2px;white-space:nowrap">SETUP</span></div></div><div style="height:1px;background:oklch(100% 0 0 / 0.14);margin:8px 0 7px"></div><div class="vh-stats" style="display:flex;flex-wrap:wrap"><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:oklch(86% 0.09 60)">4</span><span style="font-size:11.5px;opacity:.75">Waiting on Northwind</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:oklch(84% 0.09 20)">1</span><span style="font-size:11.5px;opacity:.75">Overdue</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:oklch(86% 0.09 60)">3</span><span style="font-size:11.5px;opacity:.75">Due soon</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:#fff">5/13</span><span style="font-size:11.5px;opacity:.75">Registrations</span></div><div class="vh-stat" style="display:flex;align-items:baseline;gap:6px;padding-right:16px;margin-right:16px;border-right:1px solid oklch(100% 0 0 / 0.14)"><span class="metric" style="font-size:18px;line-height:1;color:#fff">24 Oct</span><span style="font-size:11.5px;opacity:.75">Incorporated</span></div></div><span style="position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)"></span></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":170}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Post-incorporation setup", "tabs": [["All", 11], ["Open", 4], ["Completed", 7]], "rows": [["FC-GPR Filing", "day 6 of 30 \u00b7 2 Dec", "Open", "due", 1], ["Nominee Shareholder (MGT-4/5/6)", "day 15 of 30 \u00b7 23 Nov", "Open", "prog", 1], ["Share Certificates (SH-1)", "day 15 of 60 \u00b7 23 Dec", "Open", "prog", 1], ["Commencement (INC-20A)", "day 15 of 180 \u00b7 22 Apr", "Open", "prog", 1], ["Registered Office (INC-22)", "25 Oct", "Completed", "ok", 2], ["First Board Meeting", "26 Oct", "Completed", "ok", 2], ["Company Letterhead", "27 Oct", "Completed", "ok", 2], ["Bank Account Opening", "29 Oct", "Completed", "ok", 2], ["Name Board", "30 Oct", "Completed", "ok", 2], ["Share Capital Infusion", "2 Nov", "Completed", "ok", 2], ["Auditor Appointment (ADT-1)", "5 Nov", "Completed", "ok", 2]]}]; const __O = [[0, 1]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    return __d;
  }
}
</script>
```

## v7c_needs_b.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Needs from Northwind</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"></div></div><div style="padding:12px 16px 14px"><div class="seg" role="tablist" style="grid-template-columns:repeat(4,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/4);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="4"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div><div style="margin-top:8px"><sc-for list="{{rows}}" as="r" hint-placeholder-count="2"><div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--hair)"><span class="box" style="width:18px;height:18px;"></span><div style="flex:1"><div class="rt" style="display:flex;align-items:center;gap:4px">{{r.t}}<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">{{r.s}}<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><span class="chip" style="{{r.cs}}">{{r.d}}</span><a class="btn btn-o" href="#" style="height:30px;min-width:76px;justify-content:center;padding:0 10px;font-size:12px">{{r.a}}</a></div></sc-for><sc-if value="{{empty}}" hint-placeholder-val="{{false}}"><div class="cap" style="padding:14px 0;border-top:1px solid var(--hair)">Nothing to sign.</div></sc-if></div></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":360}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const N = [["Utility bill - office", "Registered Office Address", "Upload", 0, "9 Oct", "due"], ["NOC from owner", "Registered Office Address", "Upload", 0, "9 Oct", "due"], ["Director 2 - nationality, ID", "Proposed Directors", "Fill", 1, "11 Oct", "prog"], ["Passport copy - page 2", "Proposed Directors", "Correct", 2, "Overdue 3d", "over"]]; const TABS = [['Upload', 2], ['Fill', 1], ['Correct', 1], ['Sign', 0]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const rows = N.filter((n) => n[3] === s.tab).map((n) => ({ t: n[0], s: n[1], a: n[2], d: n[4], cs: 'background:var(--' + n[5] + '-chip);color:#fff' })); return { tabs, thumb, rows, empty: rows.length === 0 };
  }
}
</script>
```

## v7c_alerts_b.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Important alerts</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><div class="seg" role="tablist" style="grid-template-columns:repeat(2,minmax(0,1fr));"><span class="thumb" style="width:calc((100% - 4px)/2);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="2"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div></div><div style="padding:10px 16px 12px"><div class="tipw" role="button" tabindex="0" aria-label="Passport copy · overdue 3 days" onClick="{{dd0}}" style="position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:12px 14px;border-radius:8px;background:var(--over-light);border:1px solid oklch(57% 0.2 22 / 0.3);margin-bottom:6px"><span class="tt " role="tooltip">Passport copy · overdue 3 days</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--over-text)"><path class="duo" d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z"></path><path d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z M12 8v4.6 M12 15.8v.1"></path></svg><div style="flex:1;min-width:150px"><div style="display:flex;gap:6px 8px;align-items:center;flex-wrap:wrap"><span class="rt" style="font-size:14px">Passport copy sent back</span><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Proposed Directors · page 2 · waiting on Northwind<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><span class="chip" style="background:var(--over-chip);color:#fff">Overdue</span></div></div><a class="btn btn-p" href="#" style="height:30px;padding:0 10px;font-size:12px;margin-left:auto" data-go="inc-step-8">Fix</a></div><sc-for list="{{rows}}" as="u" hint-placeholder-count="3"><div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--hair)"><div style="width:44px;height:48px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;flex:none;{{u.tile}}"><span class="metric" style="font-size:18px;line-height:1;color:#fff">{{u.day}}</span><span style="font-size:11px;font-weight:800">{{u.mon}}</span></div><div style="flex:1"><div class="rt" style="display:flex;align-items:center;gap:4px">{{u.t}}<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">{{u.m}}<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><span class="chip" style="width:92px;justify-content:center;{{u.cs}}">{{u.c}}</span></div></sc-for></div></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":340}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Important alerts", "tabs": [["All", 4], ["Overdue", 1], ["Next 15 days", 3]], "rows": [["Passport copy sent back", "3 Oct", "Overdue", "over", 1], ["2 office documents", "9 Oct", "In 3 days", "due", 2], ["MOA & AOA drafts", "10 Oct", "In 4 days", "prog", 2], ["Approved name expires", "14 Oct", "In 8 days", "due", 2]]}]; const __O = [[0, 1], [0, 2], [0, 3]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    const __o = (() => { const A = [["09", "OCT", "2 office documents", "Registered Office Address", "due", "In 3 days", 3], ["10", "OCT", "MOA & AOA drafts", "Review", "prog", "In 4 days", 4], ["14", "OCT", "Approved name expires", "File Part B before", "due", "In 8 days", 8]];const TABS = [["15 days", 3], ["30 days", 3]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const win = s.tab === 0 ? 15 : 30; const rows = A.filter((a) => a[6] <= win).map((a) => ({ day: a[0], mon: a[1], t: a[2], m: a[3], c: a[5], cs: 'background:var(--' + a[4] + '-chip);color:#fff', tile: 'background:var(--' + a[4] + ')', tileSt: 'position:relative;width:44px;height:48px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;flex:none;background:var(--' + a[4] + ')', tt: a[2] + ' · ' + a[0] + ' ' + a[1], o: () => this.setState({ dd: a[6] <= 15 ? 1 : 2 }) }));return { tabs, thumb, rows }; })();
    return Object.assign(__o, __d);
  }
}
</script>
```

## v7c_alerts_a.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Important alerts</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><div class="seg" role="tablist" style="grid-template-columns:repeat(2,minmax(0,1fr));"><span class="thumb" style="width:calc((100% - 4px)/2);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="2"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div></div><div style="padding:10px 16px 12px"><div class="tipw" role="button" tabindex="0" aria-label="TDS Payment · overdue 1 day" onClick="{{dd0}}" style="position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:12px 14px;border-radius:8px;background:var(--over-light);border:1px solid oklch(57% 0.2 22 / 0.3);margin-bottom:6px"><span class="tt " role="tooltip">TDS Payment · overdue 1 day</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--over-text)"><path class="duo" d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z"></path><path d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z M12 8v4.6 M12 15.8v.1"></path></svg><div style="flex:1;min-width:150px"><div style="display:flex;gap:6px 8px;align-items:center;flex-wrap:wrap"><span class="rt" style="font-size:14px">TDS Payment overdue 1 day</span><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Interest runs until paid · waiting on Northwind<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><span class="chip" style="background:var(--over-chip);color:#fff">Overdue</span></div></div><a class="btn btn-p" href="#" style="height:30px;padding:0 10px;font-size:12px;margin-left:auto" data-go="compliances">Fill details</a></div><sc-for list="{{rows}}" as="u" hint-placeholder-count="3"><div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--hair)"><div class="tipw" role="button" tabindex="0" aria-label="{{u.tt}}" onClick="{{u.o}}" style="{{u.tileSt}}"><span class="tt" role="tooltip">{{u.tt}}</span><span class="metric" style="font-size:18px;line-height:1;color:#fff">{{u.day}}</span><span style="font-size:11px;font-weight:800">{{u.mon}}</span></div><div style="flex:1"><div class="rt" style="display:flex;align-items:center;gap:4px">{{u.t}}<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">{{u.m}}<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><span class="chip" style="width:92px;justify-content:center;{{u.cs}}">{{u.c}}</span></div></sc-for></div></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":340}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 1}; }
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Important alerts", "tabs": [["All", 4], ["Overdue", 1], ["Next 15 days", 1], ["Later", 2]], "rows": [["TDS Payment overdue 1 day", "7 Nov", "Overdue", "over", 1], ["3 payroll dues", "15 Nov", "In 7 days", "due", 2], ["FC-GPR due", "2 Dec", "In 24 days", "prog", 3], ["Share certificates (SH-1)", "23 Dec", "In 45 days", "prog", 3]]}]; const __O = [[0, 1], [0, 2], [0, 3]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    const __o = (() => { const A = [["07", "NOV", "TDS Payment overdue 1 day", "Waiting on Northwind \u00b7 Income tax", "over", "Overdue 1 day", -1], ["15", "NOV", "3 payroll dues", "EPF \u00b7 ESI \u00b7 PT for Oct 2026", "due", "In 7 days", 7], ["02", "DEC", "FC-GPR due", "Bank FIRC needed", "prog", "In 24 days", 24], ["23", "DEC", "Share certificates (SH-1)", "60-day limit from incorporation", "prog", "In 45 days", 45]];const TABS = [['15 days', 1], ['30 days', 2]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const win = s.tab === 0 ? 15 : 30; const rows = A.slice(1).filter((a) => a[6] <= win).map((a) => ({ day: a[0], mon: a[1], t: a[2], m: a[3], c: a[5], cs: 'background:var(--' + a[4] + '-chip);color:#fff', tile: 'background:var(--' + a[4] + ')', tileSt: 'position:relative;width:44px;height:48px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;flex:none;background:var(--' + a[4] + ')', tt: a[2] + ' · ' + a[0] + ' ' + a[1], o: () => this.setState({ dd: a[6] <= 15 ? 1 : 2 }) }));return { tabs, thumb, rows }; })();
    return Object.assign(__o, __d);
  }
}
</script>
```

## v7c_current.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Who holds it now</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"></div></div><div style="padding:12px 16px 14px;display:flex;flex-direction:column;gap:12px"><div class="seg" role="tablist" style="grid-template-columns:repeat(3,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/3);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="3"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div><div style="display:flex;flex-direction:column;gap:8px"><sc-for list="{{hold}}" as="h" hint-placeholder-count="3"><div style="{{h.box}}"><div style="flex:1;min-width:150px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="rt" style="{{h.ts}}">{{h.t}}</span><span class="tipw" role="button" tabindex="0" aria-label="{{h.tip}}" onClick="{{h.dd}}" style="position:relative;display:inline-flex"><span class="chip" style="{{h.cs}}">{{h.s}}</span><span class="tt " role="tooltip">{{h.tip}}</span></span></div><div class="cap" style="margin-top:2px">{{h.m}}</div></div><a class="{{h.bc}}" href="#" data-go="{{h.go}}" style="height:30px;padding:0 10px;font-size:12px;flex:none">{{h.a}}</a></div></sc-for><sc-if value="{{holdEmpty}}" hint-placeholder-val="{{false}}"><div role="status" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px dashed var(--border);border-radius:8px;background:var(--raised)"><dc-import name="v7c_bot" state="idle" size="28" hint-size="28px,28px"></dc-import><span style="font-size:12.5px;color:var(--fg)">Nothing is with MCA yet. SBC files SPICe+ on 20 Oct, then MCA reviews it.</span></div></sc-if></div><div><div class="lbl" style="color:var(--navy-ink,var(--navy));margin-bottom:2px">Steps around Northwind</div><div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--hair)"><span class="mono cap" style="width:50px;flex:none">Step 6</span><span class="rt" style="flex:1;">Capital Structure</span><span class="chip" style="background:var(--due-light);color:var(--due-text);min-width:88px;justify-content:center">Northwind</span><span class="tipw" role="button" tabindex="0" aria-label="Completed · 6 steps" onClick="{{dd0}}" style="position:relative;display:inline-flex"><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Completed</span><span class="tt " role="tooltip">Completed · 6 steps</span></span></div><div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--hair)"><span class="mono cap" style="width:50px;flex:none">Step 7</span><span class="rt" style="flex:1;font-weight:800">Registered Office Address</span><span class="chip" style="background:var(--due-light);color:var(--due-text);min-width:88px;justify-content:center">Northwind</span><span class="tipw" role="button" tabindex="0" aria-label="Waiting for Northwind · 1 step" onClick="{{dd2}}" style="position:relative;display:inline-flex"><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">Waiting</span><span class="tt " role="tooltip">Waiting for Northwind · 1 step</span></span></div><div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--hair)"><span class="mono cap" style="width:50px;flex:none">Step 8</span><span class="rt" style="flex:1;">Proposed Directors</span><span class="chip" style="background:var(--due-light);color:var(--due-text);min-width:88px;justify-content:center">Northwind</span><span class="tipw" role="button" tabindex="0" aria-label="In progress · 3 steps" onClick="{{dd1}}" style="position:relative;display:inline-flex"><span class="chip" style="background:var(--prog-chip);color:#fff;min-width:116px;justify-content:center">In progress</span><span class="tt " role="tooltip">In progress · 3 steps</span></span></div><div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--hair)"><span class="mono cap" style="width:50px;flex:none">Step 9</span><span class="rt" style="flex:1;">Subscriber Details</span><span class="chip" style="background:var(--due-light);color:var(--due-text);min-width:88px;justify-content:center">Northwind</span><span class="tipw" role="button" tabindex="0" aria-label="In progress · 3 steps" onClick="{{dd1}}" style="position:relative;display:inline-flex"><span class="chip" style="background:var(--prog-chip);color:#fff;min-width:116px;justify-content:center">In progress</span><span class="tt " role="tooltip">In progress · 3 steps</span></span></div><div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--hair)"><span class="mono cap" style="width:50px;flex:none">Step 10</span><span class="rt" style="flex:1;">KYC Review & DSC</span><span class="chip" style="background:var(--prog-light);color:var(--prog-text);min-width:88px;justify-content:center">SBC</span><span class="tipw" role="button" tabindex="0" aria-label="In progress · 3 steps" onClick="{{dd1}}" style="position:relative;display:inline-flex"><span class="chip" style="background:var(--prog-chip);color:#fff;min-width:116px;justify-content:center">In progress</span><span class="tt " role="tooltip">In progress · 3 steps</span></span></div><div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--hair)"><span class="mono cap" style="width:50px;flex:none">Step 11</span><span class="rt" style="flex:1;color:var(--muted)">SPICe+ Confirmation</span><span class="chip" style="background:var(--due-light);color:var(--due-text);min-width:88px;justify-content:center">Northwind</span><span class="tipw" role="button" tabindex="0" aria-label="Not started · 4 steps" onClick="{{dd3}}" style="position:relative;display:inline-flex"><span class="chip" style="background:var(--up-light);color:var(--up-text);min-width:116px;justify-content:center">Not started</span><span class="tt " role="tooltip">Not started · 4 steps</span></span></div></div></div></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":440}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Incorporation steps", "tabs": [["All", 14], ["Completed", 6], ["In progress", 3], ["Waiting for Northwind", 1], ["Upcoming", 4]], "rows": [["Client Details", "12 Sep", "Completed", "ok", 1], ["Draft Board Resolution", "14 Sep", "Completed", "ok", 1], ["Signed Board Resolution", "18 Sep", "Completed", "ok", 1], ["Name Application", "Part A", "Completed", "ok", 1], ["Name Approval", "24 Sep", "Completed", "ok", 1], ["Capital Structure", "1 Oct", "Completed", "ok", 1], ["Proposed Directors", "6 Oct", "In progress", "prog", 2], ["Subscriber Details", "10 Oct", "In progress", "prog", 2], ["Registered Office Address", "9 Oct", "Waiting", "due", 3], ["KYC Review & DSC", "13 Oct", "In progress", "prog", 2], ["SPICe+ Confirmation", "16 Oct", "Upcoming", "up", 4], ["SPICe+ Filing", "20 Oct", "Upcoming", "up", 4], ["MCA Remarks", "24 Oct", "Upcoming", "up", 4], ["Certificate of Incorporation", "28 Oct", "Upcoming", "up", 4]]}]; const __O = [[0, 1], [0, 2], [0, 3], [0, 4]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    const __o = (() => { const TABS = [['Northwind', 3], ['SBC', 1], ['MCA', 0]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const BOX = 'border:1px solid var(--border);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-left:3px solid var(--';
    const H = [[
      ['Registered Office Address', 'Step 7 · due 9 Oct · 2 files missing', 'Waiting for Northwind', 'due', 'Continue', 'inc-step-7', 2, 'Waiting for Northwind · 1 step', 1],
      ['Proposed Directors', 'Step 8 · Director 2 details · Northwind fills this', 'In progress', 'prog', 'Continue', 'inc-step-8', 1, 'In progress · 3 steps', 0],
      ['Subscriber Details', 'Step 9 · 3 fields left · Northwind fills this', 'In progress', 'prog', 'Continue', 'inc-step-9', 1, 'In progress · 3 steps', 0]
    ], [
      ['KYC Review & DSC', 'Step 10 · Arjun Mehta · 30% · ready 13 Oct', 'In progress', 'prog', 'Open', 'inc-step-10', 1, 'In progress · 3 steps', 0]
    ], []];
    const hold = (H[s.tab] || []).map((h) => ({ t: h[0], m: h[1], s: h[2], cs: 'background:var(--' + h[3] + '-chip);color:#fff', a: h[4], go: h[5], dd: __d['dd' + h[6]], tip: h[7], bc: h[8] ? 'btn btn-p' : 'btn btn-o', ts: h[8] ? 'font-weight:800' : '', box: BOX + h[3] + ')' }));
    return { tabs, thumb, hold, holdEmpty: hold.length === 0 }; })();
    return Object.assign(__o, __d);
  }
}
</script>
```

## v7c_next.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">What is next</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><div class="seg" role="tablist" style="grid-template-columns:repeat(2,minmax(0,1fr));"><span class="thumb" style="width:calc((100% - 4px)/2);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="2"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div></div><div style="padding:10px 16px 12px"><div class="tipw" role="button" tabindex="0" aria-label="TDS Payment · overdue 1 day" onClick="{{dd0}}" style="position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:12px 14px;border-radius:8px;background:var(--over-light);border:1px solid oklch(57% 0.2 22 / 0.3);margin-bottom:6px"><span class="tt " role="tooltip">TDS Payment · overdue 1 day</span><div style="text-align:left"><span class="metric" style="font-size:30px;line-height:1;color:var(--over-text)">07</span><div class="lbl" style="color:var(--over-text)">NOV</div></div><div style="flex:1;min-width:150px"><div style="display:flex;gap:6px 8px;align-items:center;flex-wrap:wrap"><span class="rt" style="font-size:14px">TDS Payment · Oct 2026</span><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Waiting on Northwind · TDS challan details · asked by Priya Raman<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><span class="chip" style="background:var(--over-chip);color:#fff">Overdue 1 day</span></div></div><a class="btn btn-p" href="#" style="height:30px;padding:0 10px;font-size:12px;margin-left:auto" data-go="compliances">Fill details</a></div><sc-for list="{{rows}}" as="u" hint-placeholder-count="4"><div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--hair)"><div class="tipw" role="button" tabindex="0" aria-label="{{u.tt}}" onClick="{{u.o}}" style="{{u.tileSt}}"><span class="tt" role="tooltip">{{u.tt}}</span><span class="metric" style="font-size:18px;line-height:1;color:#fff">{{u.day}}</span><span style="font-size:11px;font-weight:800">{{u.mon}}</span></div><div style="flex:1"><div class="rt" style="display:flex;align-items:center;gap:4px">{{u.t}}<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">{{u.p}} · {{u.a}} · SBC by {{u.sbc}}<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><span class="chip" style="{{u.ws}}">{{u.w}}</span><span class="chip" style="width:92px;justify-content:center;{{u.is}}">{{u.i}}</span></div></sc-for></div></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":460}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "What is next", "tabs": [["All", 6], ["Overdue", 1], ["Next 15 days", 3], ["16\u201330 days", 2]], "rows": [["TDS Payment \u00b7 Oct", "7 Nov", "Overdue", "over", 1], ["EPF Return & Payment \u00b7 Oct", "15 Nov", "In 7 days", "due", 2], ["ESI Payment \u00b7 Oct", "15 Nov", "In 7 days", "due", 2], ["PT Payment \u00b7 Oct", "20 Nov", "In 12 days", "prog", 2], ["FC-GPR Filing", "2 Dec", "In 24 days", "prog", 3], ["TDS Payment \u00b7 Nov", "7 Dec", "In 29 days", "prog", 3]]}]; const __O = [[0, 1], [0, 2], [0, 3]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    const __o = (() => { const U = [["07", "NOV", "TDS Payment", "Oct 2026", "Income tax", "Northwind", "due", "Overdue 1 day", "over", "6 Nov", -1], ["15", "NOV", "EPF Return & Payment", "Oct 2026", "Payroll", "Northwind", "due", "In 7 days", "due", "13 Nov", 7], ["15", "NOV", "ESI Payment", "Oct 2026", "Payroll", "SBC", "prog", "In 7 days", "due", "13 Nov", 7], ["20", "NOV", "PT Payment", "Oct 2026", "Payroll", "SBC", "prog", "In 12 days", "prog", "18 Nov", 12], ["02", "DEC", "FC-GPR Filing", "Share allotment", "FEMA", "Northwind", "due", "In 24 days", "prog", "28 Nov", 24], ["07", "DEC", "TDS Payment", "Nov 2026", "Income tax", "SBC", "prog", "In 29 days", "prog", "5 Dec", 29]];const TABS = [['15 days', 4], ['30 days', 6]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const win = s.tab === 0 ? 15 : 30; const rows = U.slice(1).filter((u) => u[10] <= win).map((u) => ({ day: u[0], mon: u[1], t: u[2], p: u[3], a: u[4], w: u[5], ws: 'background:var(--' + u[6] + '-chip);color:#fff', i: u[7], is: 'background:var(--' + u[8] + '-chip);color:#fff', tile: 'background:var(--' + u[8] + ')', sbc: u[9], tileSt: 'position:relative;width:44px;height:48px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;flex:none;background:var(--' + u[8] + ')', tt: u[2] + ' · ' + u[0] + ' ' + u[1], o: () => this.setState({ dd: u[10] <= 15 ? 1 : 2 }) }));return { tabs, thumb, rows }; })();
    return Object.assign(__o, __d);
  }
}
</script>
```

## v7c_sbc_b.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">What SBC is doing</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"></div></div><div style="padding:6px 16px 12px"><div style="padding:9px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">KYC Review &amp; DSC<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Arjun Mehta · Step 10 · ready 13 Oct<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="pct">30%</span><a href="#" data-go="inc-step-10" aria-label="Open Step 10" title="Open Step 10" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--primary)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></a></div><div style="margin-top:6px"><div class="bar" style="height:6px"><span style="width:30%;background:var(--prog)"></span></div></div></div><div style="padding:9px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">MOA & AOA drafts<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Arjun Mehta · Step 11 · drafts reach Northwind 10 Oct<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="pct">0%</span><a href="#" data-go="inc-step-11" aria-label="Open Step 11" title="Open Step 11" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--primary)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></a></div><div style="margin-top:6px"><div class="bar" style="height:6px"><span style="width:0%;background:var(--up)"></span></div></div></div><div style="padding:9px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">DSC for both directors<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Arjun Mehta · Step 10 · ready 13 Oct<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="pct">0%</span><a href="#" data-go="inc-step-10" aria-label="Open Step 10" title="Open Step 10" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--primary)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></a></div><div style="margin-top:6px"><div class="bar" style="height:6px"><span style="width:0%;background:var(--up)"></span></div></div></div><div style="padding:9px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">File SPICe+ Part B<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Priya Raman · Step 12 · ready 20 Oct<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="pct">0%</span><a href="#" data-go="inc-step-12" aria-label="Open Step 12" title="Open Step 12" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--primary)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></a></div><div style="margin-top:6px"><div class="bar" style="height:6px"><span style="width:0%;background:var(--up)"></span></div></div></div></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":400}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7c_sbc_a.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">What SBC is doing</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"></div></div><div style="padding:6px 16px 12px"><div style="padding:9px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">PT Registration<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Arjun Mehta · Registrations · ready 12 Nov<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="pct">70%</span><a href="#" aria-label="Open Registrations" title="Open Registrations" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--primary)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></a></div><div style="margin-top:6px"><div class="bar" style="height:6px"><span style="width:70%;background:var(--prog)"></span></div></div></div><div style="padding:9px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">IEC Registration<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Arjun Mehta · Registrations · ready 14 Nov<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="pct">50%</span><a href="#" aria-label="Open Registrations" title="Open Registrations" style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--primary)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg></a></div><div style="margin-top:6px"><div class="bar" style="height:6px"><span style="width:50%;background:var(--prog)"></span></div></div></div></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":260}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7c_timeline_b.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Timeline</h3><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Last changed by Priya Raman on 1 Oct 2026<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><a class="btn btn-o" href="#" style="height:30px;padding:0 10px;font-size:12px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M14.5 5.5l4 4L9 19l-4.5 1 1-4.5Z"></path><path d="M15.5 4.5a2 2 0 0 1 2.9 0l1.1 1.1a2 2 0 0 1 0 2.9L9 19l-4.5 1 1-4.5Z M13.5 6.5l4 4"></path></svg>Edit</a></div></div><div class="vh-tl" style="padding:12px 16px 30px"><div style="position:relative;min-width:600px"><div style="display:grid;grid-template-columns:150px minmax(0,1fr)"><span></span><div style="position:relative;height:18px"><span class="mono cap" style="position:absolute;left:0.0%;transform:translateX(-50%);white-space:nowrap">12 Sep</span><span class="mono cap" style="position:absolute;left:12.28%;transform:translateX(-50%);white-space:nowrap">19 Sep</span><span class="mono cap" style="position:absolute;left:24.56%;transform:translateX(-50%);white-space:nowrap">26 Sep</span><span class="mono cap" style="position:absolute;left:36.84%;transform:translateX(-50%);white-space:nowrap">3 Oct</span><span class="mono cap" style="position:absolute;left:49.12%;transform:translateX(-50%);white-space:nowrap">10 Oct</span><span class="mono cap" style="position:absolute;left:61.4%;transform:translateX(-50%);white-space:nowrap">17 Oct</span><span class="mono cap" style="position:absolute;left:73.68%;transform:translateX(-50%);white-space:nowrap">24 Oct</span><span class="mono cap" style="position:absolute;left:85.96%;transform:translateX(-50%);white-space:nowrap">31 Oct</span><span class="mono cap" style="position:absolute;left:98.25%;transform:translateX(-50%);white-space:nowrap">7 Nov</span></div></div><div style="position:relative"><div style="position:absolute;left:150px;right:0;top:0;bottom:0"><span style="position:absolute;left:0.0%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:12.28%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:24.56%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:36.84%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:49.12%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:61.4%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:73.68%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:85.96%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:98.25%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:42.11%;top:-4px;bottom:0;width:2px;background:var(--over)"></span><span class="chip" style="position:absolute;left:42.11%;bottom:-20px;transform:translateX(-50%);background:var(--over-chip);color:#fff;padding:0 6px">Today 6 Oct</span></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:30px"><span class="rt" style="font-size:12px">Phase 1 · Name Application</span><div style="position:relative;height:30px"><span class="tipw" role="button" tabindex="0" aria-label="Phase 1" onClick="{{dd0}}" style="position:absolute;left:0.0%;width:21.05%;top:5px;bottom:5px;border-radius:4px;background:var(--ok);"><span class="tt " role="tooltip">Phase 1 · Name Application · 12 Sep – 24 Sep · done</span></span><span class="cap" style="position:absolute;left:calc(21.05% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap">Done 24 Sep</span></div></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:30px"><span class="rt" style="font-size:12px">Phase 2 · Incorporation</span><div style="position:relative;height:30px"><span class="tipw" role="button" tabindex="0" aria-label="Phase 2" onClick="{{dd1}}" style="position:absolute;left:22.81%;width:43.86%;top:5px;bottom:5px;border-radius:4px;background:var(--prog);"><span class="tt " role="tooltip">Phase 2 · Incorporation · 25 Sep – 20 Oct · 22%</span></span><span class="cap" style="position:absolute;left:calc(66.67% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap">22%</span></div></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:30px"><span class="rt" style="font-size:12px">MCA review</span><div style="position:relative;height:30px"><span class="tipw" role="button" tabindex="0" aria-label="MCA review" onClick="{{dd2}}" style="position:absolute;left:66.67%;width:14.030000000000001%;top:5px;bottom:5px;border-radius:4px;background:var(--up);"><span class="tt " role="tooltip">MCA review · 20 Oct – 28 Oct</span></span><span class="cap" style="position:absolute;left:calc(80.7% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap"></span></div></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:30px"><span class="rt" style="font-size:12px">COI</span><div style="position:relative;height:30px"><span class="tipw" role="button" tabindex="0" aria-label="COI" onClick="{{dd3}}" style="position:absolute;left:80.7%;width:1.759999999999991%;top:5px;bottom:5px;border-radius:4px;background:var(--navy);"><span class="tt " role="tooltip">COI · expected 28 Oct</span></span><span class="cap" style="position:absolute;left:calc(82.46% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap">28 Oct</span></div></div></div></div></div></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":290}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Timeline phases", "tabs": [["Phase 1 \u00b7 Name", 5], ["Phase 2 \u00b7 Incorporation", 7], ["MCA review", 1], ["COI", 1]], "rows": [["Client Details", "12 Sep", "Completed", "ok", 0], ["Draft Board Resolution", "14 Sep", "Completed", "ok", 0], ["Signed Board Resolution", "18 Sep", "Completed", "ok", 0], ["Name Application", "Phase 1", "Completed", "ok", 0], ["Name Approval", "24 Sep", "Completed", "ok", 0], ["Capital Structure", "1 Oct", "Completed", "ok", 1], ["Proposed Directors", "6 Oct", "In progress", "prog", 1], ["Subscriber Details", "10 Oct", "In progress", "prog", 1], ["Registered Office Address", "9 Oct", "Waiting", "due", 1], ["KYC Review & DSC", "13 Oct", "In progress", "prog", 1], ["SPICe+ Confirmation", "16 Oct", "Upcoming", "up", 1], ["SPICe+ Filing", "20 Oct", "Upcoming", "up", 1], ["MCA Remarks", "24 Oct", "Upcoming", "up", 2], ["Certificate of Incorporation", "28 Oct", "Upcoming", "up", 3]]}]; const __O = [[0, 0], [0, 1], [0, 2], [0, 3]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    return __d;
  }
}
</script>
```

## v7c_steps_b.dc.html

Board-specific CSS:
```css
<style>
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
.lbl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
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
th{text-align:left;padding:8px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border)}
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
.seg .cnt{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
/* every status chip is one width, so the column reads as a column and the cell
   beside it keeps the same x on every row */
.stp-row>td:nth-child(4)>.chip{min-width:116px;justify-content:center}
.stp-row>td:nth-child(3)>.chip{min-width:88px;justify-content:center}
</style>
<style>
.stp-g{border:1px solid var(--border);border-radius:8px;overflow:hidden}
.stp-g>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;user-select:none;border-radius:8px;transition:background .15s}
.stp-g>summary::-webkit-details-marker{display:none}
.stp-g>summary:hover{background:var(--raised)}
.stp-g>summary .stp-cv{transition:transform .25s cubic-bezier(.22,1,.36,1);color:var(--muted)}
.stp-g[open]>summary .stp-cv{transform:rotate(90deg)}
.stp-g[open]>summary{border-bottom:1px solid var(--hair);border-radius:8px 8px 0 0}
.stp-g>.vh-x{margin:4px 0 6px}
.stp-g[open]>.vh-x{animation:stpIn .28s cubic-bezier(.22,1,.36,1)}
@keyframes stpIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.stp-row{cursor:pointer}
.stp-row:hover .stp-go{color:var(--primary);background:var(--primary-light);transform:translateX(2px)}
.stp-go{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;color:var(--muted);transition:color .15s,background .15s,transform .15s}
.stp-go:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
@media (prefers-reduced-motion: reduce){.stp-g>summary .stp-cv,.stp-go{transition:none}.stp-g[open]>.vh-x{animation:none}}
</style>
<style>.stp-tl{white-space:normal!important;font-size:11.5px;color:var(--muted);min-width:110px;max-width:190px;line-height:1.35}.stp-ph{color:inherit;font-weight:800}</style>
```

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><style>
.stp-g{border:1px solid var(--border);border-radius:8px;overflow:hidden}
.stp-g>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;user-select:none;border-radius:8px;transition:background .15s}
.stp-g>summary::-webkit-details-marker{display:none}
.stp-g>summary:hover{background:var(--raised)}
.stp-g>summary .stp-cv{transition:transform .25s cubic-bezier(.22,1,.36,1);color:var(--muted)}
.stp-g[open]>summary .stp-cv{transform:rotate(90deg)}
.stp-g[open]>summary{border-bottom:1px solid var(--hair);border-radius:8px 8px 0 0}
.stp-g>.vh-x{margin:4px 0 6px}
.stp-g[open]>.vh-x{animation:stpIn .28s cubic-bezier(.22,1,.36,1)}
@keyframes stpIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.stp-row{cursor:pointer}
.stp-row:hover .stp-go{color:var(--primary);background:var(--primary-light);transform:translateX(2px)}
.stp-go{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;color:var(--muted);transition:color .15s,background .15s,transform .15s}
.stp-go:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
@media (prefers-reduced-motion: reduce){.stp-g>summary .stp-cv,.stp-go{transition:none}.stp-g[open]>.vh-x{animation:none}}
</style><style>.stp-tl{white-space:normal!important;font-size:11.5px;color:var(--muted);min-width:110px;max-width:190px;line-height:1.35}.stp-ph{color:inherit;font-weight:800}</style><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Steps</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><a href="#" data-go="incorporation" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;white-space:nowrap">Open Incorporation <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></div></div><div style="padding:12px 16px 14px;display:flex;flex-direction:column;gap:8px"><details class="stp-g"><summary><svg class="stp-cv" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path d="M9 6l6 6-6 6"></path></svg><span class="rt" style="flex:1"><a href="#" class="stp-ph" data-go="inc-phase-a">Phase 1 · Name Application</a></span><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">5 of 5</span><span class="mono cap">done</span></summary><div class="vh-x" style="--tmin:560px"><table style="width:100%;border-collapse:collapse"><thead><tr><th>#</th><th>Step</th><th>Owner</th><th>Status</th><th>Timeline</th><th style="width:34px"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Open</span></th></tr></thead><tbody><tr class="stp-row" data-go="inc-step-1"><td class="mono cap" style="padding:6px 8px;font-weight:600">1</td><td class="rt" style="padding:6px 8px;font-size:12.5px">Client Details</td><td style="padding:6px 8px"><span class="chip" style="background:var(--due-light);color:var(--due-text)">Northwind</span></td><td style="padding:6px 8px"><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Completed</span></td><td class="stp-tl" style="padding:6px 8px">2–3 working days</td><td style="padding:4px 4px 4px 0;text-align:right"><a href="#" class="stp-go" data-go="inc-step-1" aria-label="Open step 1 · Client Details"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></td></tr><tr class="stp-row" data-go="inc-step-2"><td class="mono cap" style="padding:6px 8px;font-weight:600">2</td><td class="rt" style="padding:6px 8px;font-size:12.5px">Draft Board Resolution</td><td style="padding:6px 8px"><span class="chip" style="background:var(--prog-light);color:var(--prog-text)">SBC</span></td><td style="padding:6px 8px"><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Completed</span></td><td class="stp-tl" style="padding:6px 8px">1–2 working days</td><td style="padding:4px 4px 4px 0;text-align:right"><a href="#" class="stp-go" data-go="inc-step-2" aria-label="Open step 2 · Draft Board Resolution"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></td></tr><tr class="stp-row" data-go="inc-step-3"><td class="mono cap" style="padding:6px 8px;font-weight:600">3</td><td class="rt" style="padding:6px 8px;font-size:12.5px">Signed Board Resolution</td><td style="padding:6px 8px"><span class="chip" style="background:var(--due-light);color:var(--due-text)">Northwind</span></td><td style="padding:6px 8px"><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Completed</span></td><td class="stp-tl" style="padding:6px 8px">3–4 working days</td><td style="padding:4px 4px 4px 0;text-align:right"><a href="#" class="stp-go" data-go="inc-step-3" aria-label="Open step 3 · Signed Board Resolution"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></td></tr><tr class="stp-row" data-go="inc-step-4"><td class="mono cap" style="padding:6px 8px;font-weight:600">4</td><td class="rt" style="padding:6px 8px;font-size:12.5px">Name Application</td><td style="padding:6px 8px"><span class="chip" style="background:var(--prog-light);color:var(--prog-text)">SBC</span></td><td style="padding:6px 8px"><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Completed</span></td><td class="stp-tl" style="padding:6px 8px">1–2 working days</td><td style="padding:4px 4px 4px 0;text-align:right"><a href="#" class="stp-go" data-go="inc-step-4" aria-label="Open step 4 · Name Application"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></td></tr><tr class="stp-row" data-go="inc-step-5"><td class="mono cap" style="padding:6px 8px;font-weight:600">5</td><td class="rt" style="padding:6px 8px;font-size:12.5px">Name Approval</td><td style="padding:6px 8px"><span class="chip" style="background:var(--prog-light);color:var(--prog-text)">SBC</span></td><td style="padding:6px 8px"><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Completed</span></td><td class="stp-tl" style="padding:6px 8px">5–7 working days</td><td style="padding:4px 4px 4px 0;text-align:right"><a href="#" class="stp-go" data-go="inc-step-5" aria-label="Open step 5 · Name Approval"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></td></tr></tbody></table></div></details>
<!-- … phases 2–4 repeat the same <details class="stp-g"> structure; Phase 2 has the `open` attribute … -->
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":520}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7c_docs_b.dc.html

Board-specific CSS:
```css
<style>
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
.lbl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
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
th{text-align:left;padding:8px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border)}
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
.seg .cnt{font:600 11px "IBM Plex Mono",monospace;color:var(--subtle)}
.seg button.on .cnt{color:var(--primary)}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
/* Recent documents, grouped by arrival: rows, not boxes; controls appear on hover or focus */
.rd-g{font:800 10px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--subtle);margin:0 0 2px;display:flex;align-items:center;gap:8px}
.rd-g::after{content:"";height:1px;flex:1;background:var(--hair)}
.rd-r+.rd-g{margin-top:12px}
.rd-r{display:flex;align-items:center;gap:9px;padding:7px 2px;border-radius:6px;cursor:pointer;min-width:0}
.rd-r:hover{background:var(--raised)}
.rd-r:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.rd-ft{flex:none;width:20px;height:20px;border-radius:6px;text-align:center;font:700 7px/20px "IBM Plex Mono",monospace;letter-spacing:-.02em}
.rd-n{flex:1;min-width:0;font-size:12.5px;font-weight:500;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-s{flex:none;font:600 11px Manrope,sans-serif;color:var(--subtle);white-space:nowrap}
.rd-s .rd-me{color:var(--gold-text)}
.rd-s .rd-d{font-family:"IBM Plex Mono",monospace;font-weight:500;font-feature-settings:"tnum"}
.rd-s .rd-sep{opacity:.45;margin:0 4px}
.rd-a{display:flex;gap:2px;flex:none}
.rd-b{width:26px;height:26px;padding:0;border:0;border-radius:6px;background:none;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.rd-b:hover{background:var(--primary-light);color:var(--primary)}
.rd-b:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
@media (max-width:330px){.rd-s .rd-who{display:none}.rd-s .rd-sep{display:none}}
</style>
```

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Recent documents</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><a href="#" style="font-size:12px;font-weight:700;white-space:nowrap">Documents <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></div></div><div style="padding:10px 16px 14px"><p class="rd-g">Last week</p><div class="rd-r" tabindex="0" role="button" title="Director 1 - passport · JPG · 2 Oct 2026 · from Northwind" data-go="doc-viewer"><span class="rd-ft" style="background:var(--teal-light);color:var(--teal-chip)" aria-hidden="true">JPG</span><span class="rd-n">Director 1 - passport</span><span class="rd-s"><span class="rd-who rd-me">Northwind</span><span class="rd-sep">&middot;</span><span class="rd-d">2 Oct</span></span><span class="rd-a"><button type="button" class="rd-b" title="Download" aria-label="Download Director 1 - passport"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></button></span></div><p class="rd-g">Earlier</p><div class="rd-r" tabindex="0" role="button" title="Name approval letter · PDF · 24 Sep 2026 · from SBC" data-go="doc-viewer"><span class="rd-ft" style="background:var(--over-light);color:var(--over-text)" aria-hidden="true">PDF</span><span class="rd-n">Name approval letter</span><span class="rd-s"><span class="rd-who">SBC</span><span class="rd-sep">&middot;</span><span class="rd-d">24 Sep</span></span><span class="rd-a"><button type="button" class="rd-b" title="Download" aria-label="Download Name approval letter"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></button></span></div><div class="rd-r" tabindex="0" role="button" title="Signed Board Resolution · PDF · 18 Sep 2026 · from Northwind" data-go="doc-viewer"><span class="rd-ft" style="background:var(--over-light);color:var(--over-text)" aria-hidden="true">PDF</span><span class="rd-n">Signed Board Resolution</span><span class="rd-s"><span class="rd-who rd-me">Northwind</span><span class="rd-sep">&middot;</span><span class="rd-d">18 Sep</span></span><span class="rd-a"><button type="button" class="rd-b" title="Download" aria-label="Download Signed Board Resolution"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></button></span></div><div class="rd-r" tabindex="0" role="button" title="Draft Board Resolution · DOCX · 14 Sep 2026 · from SBC" data-go="doc-viewer"><span class="rd-ft" style="background:var(--prog-light);color:var(--prog-text)" aria-hidden="true">DOCX</span><span class="rd-n">Draft Board Resolution</span><span class="rd-s"><span class="rd-who">SBC</span><span class="rd-sep">&middot;</span><span class="rd-d">14 Sep</span></span><span class="rd-a"><button type="button" class="rd-b" title="Download" aria-label="Download Draft Board Resolution"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></button></span></div></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":420}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7c_activity_b.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Recent activity</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><div class="seg" role="tablist" style="grid-template-columns:repeat(3,minmax(0,1fr));"><span class="thumb" style="width:calc((100% - 4px)/3);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="3"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div></div><div style="padding:6px 16px 12px"><sc-for list="{{rows}}" as="r" hint-placeholder-count="4"><div style="display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--hair)"><span class="mono" style="font-size:12px;font-weight:600">{{r.d}}</span><span class="rt" style="font-weight:600">{{r.t}}</span><span class="cap">{{r.w}}</span></div></sc-for></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":300}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const A = [["5 Oct 2026", "2 documents requested", "Arjun Mehta", "sbc"], ["4 Oct 2026", "Proposed Directors saved", "Northwind", "you"], ["3 Oct 2026", "Passport copy sent back", "Arjun Mehta", "sbc"], ["1 Oct 2026", "Capital Structure accepted", "Priya Raman", "sbc"]];const TABS = [['All', 4], ['SBC', 3], ['Northwind', 1]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const rows = A.filter((a) => s.tab === 0 || (s.tab === 1 && a[3] === 'sbc') || (s.tab === 2 && a[3] === 'you')).map((a) => ({ d: a[0], t: a[1], w: a[2] }));return { tabs, thumb, rows };
  }
}
</script>
```

## v7c_comp.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Compliance status</h3><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Hover a slice for its count · click a slice, a legend row or the centre to see the list<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><span class="chip" style="background:var(--up-light);color:var(--up-text);min-width:116px;justify-content:center">FY 2026-27</span></div></div><div style="padding:22px 16px 16px;display:flex;gap:20px;align-items:center"><div style="position:relative;width:140px;height:140px;flex:none"><div style="width:140px;height:140px;border-radius:99px;background:conic-gradient(var(--ok) 0.0% 2.6%,var(--due) 2.6% 10.5%,var(--over) 10.5% 13.2%,var(--up) 13.2% 100.0%);display:flex;align-items:center;justify-content:center"><a href="#" title="Show all" style="width:98px;height:98px;border-radius:99px;background:var(--panel);display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--fg)"><span class="metric" style="font-size:28px;line-height:1;color:var(--fg)">38</span><span class="cap" style="">this FY</span></a></div></div><div style="flex:1"><a href="#" style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin:0 -8px;border-radius:6px;color:var(--fg);font-weight:500;"><span style="width:10px;height:10px;border-radius:2px;background:var(--ok)"></span><span class="rt" style="flex:1;font-weight:500">Filed</span><span class="mono" style="font-size:12px;font-weight:600;white-space:nowrap">1 (3%)</span></a><a href="#" style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin:0 -8px;border-radius:6px;color:var(--fg);font-weight:500;background:var(--raised)"><span style="width:10px;height:10px;border-radius:2px;background:var(--due)"></span><span class="rt" style="flex:1;font-weight:500">Due soon</span><span class="mono" style="font-size:12px;font-weight:600;white-space:nowrap">3 (8%)</span></a><a href="#" style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin:0 -8px;border-radius:6px;color:var(--fg);font-weight:500;"><span style="width:10px;height:10px;border-radius:2px;background:var(--over)"></span><span class="rt" style="flex:1;font-weight:500">Overdue</span><span class="mono" style="font-size:12px;font-weight:600;white-space:nowrap">1 (3%)</span></a><a href="#" style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin:0 -8px;border-radius:6px;color:var(--fg);font-weight:500;"><span style="width:10px;height:10px;border-radius:2px;background:var(--up)"></span><span class="rt" style="flex:1;font-weight:500">Upcoming</span><span class="mono" style="font-size:12px;font-weight:600;white-space:nowrap">33 (87%)</span></a></div></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":300}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7c_ids.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Company IDs</h3><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">PAN and TAN need your password to show<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><a href="#" style="font-size:12px;font-weight:700;white-space:nowrap">COI <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a></div></div><div style="padding:4px 16px 10px"><div style="display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:6px 10px;padding:9px 0;border-top:1px solid var(--hair);"><span style="display:flex;flex-direction:column;gap:2px"><span class="lbl">CIN</span></span><span class="mono" style="font-size:12.5px;font-weight:600;overflow-wrap:anywhere">U72900KA2026FTC198431</span><span style="display:flex;gap:4px"><button type="button" aria-label="Copy" style="border:0;background:var(--primary-light);color:var(--primary);border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M9 9h10v11H9Z"></path><path d="M10 8.5h9A1.5 1.5 0 0 1 20.5 10v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 8.5 19v-9A1.5 1.5 0 0 1 10 8.5Z M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"></path></svg></button></span></div><div style="display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:6px 10px;padding:9px 0;border-top:1px solid var(--hair);"><span style="display:flex;flex-direction:column;gap:2px"><span class="lbl">PAN</span><span class="chip" style="padding:0 5px;font-size:11px;background:var(--navy);color:var(--gold)">Private</span></span><span class="mono" style="font-size:12.5px;font-weight:600;letter-spacing:.06em">AAKC••••1M</span><span style="display:flex;gap:4px"><button type="button" aria-label="Show PAN" style="border:0;background:var(--navy);color:#fff;border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path></svg></button></span></div><div style="display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:6px 10px;padding:9px 0;border-top:1px solid var(--hair);"><span style="display:flex;flex-direction:column;gap:2px"><span class="lbl">TAN</span><span class="chip" style="padding:0 5px;font-size:11px;background:var(--navy);color:var(--gold)">Private</span></span><span class="mono" style="font-size:12.5px;font-weight:600;letter-spacing:.06em">BLRN••••2D</span><span style="display:flex;gap:4px"><button type="button" aria-label="Show TAN" style="border:0;background:var(--navy);color:#fff;border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path></svg></button></span></div><div style="display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:6px 10px;padding:9px 0;border-top:1px solid var(--hair);"><span style="display:flex;flex-direction:column;gap:2px"><span class="lbl">GSTIN</span></span><span class="mono" style="font-size:12.5px;font-weight:600;overflow-wrap:anywhere">29AAKCN4821M1Z5</span><span style="display:flex;gap:4px"><button type="button" aria-label="Copy" style="border:0;background:var(--primary-light);color:var(--primary);border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M9 9h10v11H9Z"></path><path d="M10 8.5h9A1.5 1.5 0 0 1 20.5 10v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 8.5 19v-9A1.5 1.5 0 0 1 10 8.5Z M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"></path></svg></button></span></div></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":560,"height":330}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7c_area.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Compliance by area</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><span class="chip" style="background:var(--up-light);color:var(--up-text);min-width:116px;justify-content:center">FY 2026-27 · as of 8 Nov 2026</span></div></div><div style="padding:12px 16px 14px"><div class="seg vh-segwrap" role="tablist" style="grid-template-columns:repeat(6,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/6);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="6"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div><sc-if value="{{isAll}}" hint-placeholder-val="{{true}}"><div class="vh-x" style="--tmin:600px"><table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px"><thead><tr><th>Area</th><th style="text-align:right">Total</th><th style="text-align:right">Filed</th><th style="text-align:right">Due soon</th><th style="text-align:right">Overdue</th><th style="width:26%">Mix</th><th>Status</th></tr></thead><tbody><sc-for list="{{areas}}" as="r" hint-placeholder-count="5"><tr><td class="rt" style="padding:8px">{{r.n}}</td><td class="mono" style="padding:8px;text-align:right">{{r.t}}</td><td class="mono" style="padding:8px;text-align:right;color:var(--ok-text)">{{r.f}}</td><td class="mono" style="padding:8px;text-align:right;color:var(--due-text)">{{r.d}}</td><td class="mono" style="padding:8px;text-align:right;color:var(--over-text)">{{r.o}}</td><td style="padding:8px"><div class="stack" style="height:10px"><sc-for list="{{r.segs}}" as="g" hint-placeholder-count="2"><span class="tipw" role="button" tabindex="0" aria-label="{{g.t}}" onClick="{{g.o}}" style="{{g.s}}"><span class="tt" role="tooltip">{{g.t}}</span></span></sc-for></div></td><td style="padding:8px"><span class="chip" style="{{r.cs}}">{{r.s}}</span></td></tr></sc-for><tr><td class="rt" style="padding:8px;border-top:1.5px solid var(--border);font-weight:800">Total</td><td class="mono" style="padding:8px;text-align:right;font-weight:700;border-top:1.5px solid var(--border)">38</td><td class="mono" style="padding:8px;text-align:right;font-weight:700;border-top:1.5px solid var(--border)">1</td><td class="mono" style="padding:8px;text-align:right;font-weight:700;border-top:1.5px solid var(--border)">3</td><td class="mono" style="padding:8px;text-align:right;font-weight:700;border-top:1.5px solid var(--border)">1</td><td style="border-top:1.5px solid var(--border)"></td><td style="border-top:1.5px solid var(--border)"></td></tr></tbody></table></div></sc-if><sc-if value="{{isOne}}" hint-placeholder-val="{{false}}"><div style="display:flex;align-items:baseline;gap:8px;margin:12px 0 4px"><span class="metric" style="font-size:22px">{{one.t}}</span><span class="cap">{{one.n}} filings this FY · {{one.f}} filed · {{one.d}} due soon · {{one.o}} overdue</span></div><div class="vh-x" style="--tmin:600px"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr><th>Filing</th><th>Period</th><th style="text-align:right">Due / filed</th><th>Status</th></tr></thead><tbody><sc-for list="{{fil}}" as="r" hint-placeholder-count="3"><tr><td class="rt" style="padding:7px 8px">{{r.t}}</td><td class="cap" style="padding:7px 8px">{{r.p}}</td><td class="mono" style="padding:7px 8px;text-align:right;font-size:12px">{{r.d}}</td><td style="padding:7px 8px"><span class="chip" style="{{r.cs}}">{{r.s}}</span></td></tr></sc-for></tbody></table></div><div class="cap" style="margin-top:6px">{{more}}</div></sc-if></div></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":430}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "MCA / ROC \u00b7 filings", "tabs": [["All", 2], ["Filed", 1], ["Due soon", 0], ["Overdue", 0], ["Upcoming", 1]], "rows": [["ADT-1 (auditor appointment)", "Filed 5 Nov", "Filed", "ok", 1], ["Commencement (INC-20A)", "22 Apr 2027", "Upcoming", "up", 4]]}, {"title": "GST \u00b7 filings", "tabs": [["All", 10], ["Filed", 0], ["Due soon", 0], ["Overdue", 0], ["Upcoming", 10]], "rows": [["GSTR-1 \u00b7 Nov", "11 Dec", "Upcoming", "up", 4], ["GSTR-3B \u00b7 Nov", "20 Dec", "Upcoming", "up", 4]]}, {"title": "Income tax / TDS \u00b7 filings", "tabs": [["All", 7], ["Filed", 0], ["Due soon", 0], ["Overdue", 1], ["Upcoming", 6]], "rows": [["TDS Payment \u00b7 Oct", "7 Nov", "Overdue", "over", 3], ["TDS Payment \u00b7 Nov", "7 Dec", "Upcoming", "up", 4]]}, {"title": "Payroll (PF / ESI / PT) \u00b7 filings", "tabs": [["All", 18], ["Filed", 0], ["Due soon", 3], ["Overdue", 0], ["Upcoming", 15]], "rows": [["EPF Return & Payment \u00b7 Oct", "15 Nov", "Due soon", "due", 2], ["ESI Payment \u00b7 Oct", "15 Nov", "Due soon", "due", 2], ["PT Payment \u00b7 Oct", "20 Nov", "Due soon", "due", 2]]}, {"title": "FEMA / RBI \u00b7 filings", "tabs": [["All", 1], ["Filed", 0], ["Due soon", 0], ["Overdue", 0], ["Upcoming", 1]], "rows": [["FC-GPR Filing", "2 Dec", "Upcoming", "up", 4]]}]; const __O = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [3, 4], [4, 1], [4, 2], [4, 3], [4, 4]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    const __o = (() => { const A = [["MCA / ROC", 2, 1, 0, 0, 1, "Compliant", "ok"], ["GST", 10, 0, 0, 0, 10, "Upcoming", "up"], ["Income tax / TDS", 7, 0, 0, 1, 6, "Overdue", "over"], ["Payroll (PF / ESI / PT)", 18, 0, 3, 0, 15, "Due soon", "due"], ["FEMA / RBI", 1, 0, 0, 0, 1, "Upcoming", "up"]]; const F = [["ADT-1 (auditor appointment)", "FY 2026-27", 0, "Filed 5 Nov 2026", "Filed", "ok"], ["Commencement (INC-20A)", "One-time", 0, "22 Apr 2027", "Upcoming", "up"], ["GSTR-1", "Nov 2026", 1, "11 Dec 2026", "Upcoming", "up"], ["GSTR-3B", "Nov 2026", 1, "20 Dec 2026", "Upcoming", "up"], ["TDS Payment", "Oct 2026", 2, "7 Nov 2026", "Overdue", "over"], ["TDS Payment", "Nov 2026", 2, "7 Dec 2026", "Upcoming", "up"], ["EPF Return & Payment", "Oct 2026", 3, "15 Nov 2026", "Due soon", "due"], ["ESI Payment", "Oct 2026", 3, "15 Nov 2026", "Due soon", "due"], ["PT Payment", "Oct 2026", 3, "20 Nov 2026", "Due soon", "due"], ["FC-GPR Filing", "Share allotment", 4, "2 Dec 2026", "Upcoming", "up"]];const TABS = [['All', 38], ['MCA', 2], ['GST', 10], ['Income tax', 7], ['Payroll', 18], ['FEMA', 1]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const __L = ['Filed', 'Due soon', 'Overdue', 'Upcoming'];const segs = (a, ai) => [[a[2], 'ok', 0], [a[3], 'due', 1], [a[4], 'over', 2], [a[5], 'up', 3]].filter((x) => x[0] > 0).map((x) => ({ s: 'position:relative;width:' + (x[0] * 100 / a[1]) + '%;background:var(--' + x[1] + ')', t: a[0] + ' · ' + __L[x[2]] + ' · ' + x[0], o: () => this.setState({ dd: ai * 4 + x[2] }) }));const areas = A.map((a) => ({ n: a[0], t: a[1], f: a[2], d: a[3], o: a[4], s: a[6], cs: 'background:var(--' + a[7] + '-chip);color:#fff', segs: segs(a, A.indexOf(a)) }));const i = s.tab - 1; const a = A[i] || A[0];const fil = F.filter((f) => f[2] === i).map((f) => ({ t: f[0], p: f[1], d: f[3], s: f[4], cs: 'background:var(--' + f[5] + '-chip);color:#fff' }));return { tabs, thumb, areas, isAll: s.tab === 0, isOne: s.tab > 0, one: { t: a[0], n: a[1], f: a[2], d: a[3], o: a[4] }, fil, more: fil.length < a[1] ? 'Showing ' + fil.length + ' of ' + a[1] + ' · full list in Filings' : 'Showing all ' + a[1] }; })();
    return Object.assign(__o, __d);
  }
}
</script>
```

## v7c_reg.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Registrations</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"></div></div><div style="padding:12px 16px 14px"><div class="seg vh-segwrap" role="tablist" style="grid-template-columns:repeat(6,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/6);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="6"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div><div class="vh-x" style="--tmin:720px"><table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px"><thead><tr><th>Registration</th><th>Category</th><th>Authority</th><th>Number</th><th style="text-align:right">Date</th><th>Status</th><th></th></tr></thead><tbody><sc-for list="{{rows}}" as="r" hint-placeholder-count="6"><tr><td class="rt" style="padding:7px 8px">{{r.n}}</td><td style="padding:7px 8px">{{r.c}}</td><td class="cap" style="padding:7px 8px">{{r.au}}</td><td class="mono" style="padding:7px 8px;font-size:11.5px;font-weight:600">{{r.no}}</td><td class="mono" style="padding:7px 8px;text-align:right;font-size:12px">{{r.d}}</td><td style="padding:7px 8px"><span class="chip" style="{{r.cs}}">{{r.s}}</span></td><td style="padding:7px 8px"><sc-if value="{{r.dl}}" hint-placeholder-val="{{true}}"><a href="#" aria-label="Download certificate" title="Certificate" style="color:var(--primary);display:flex"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></a></sc-if></td></tr></sc-for></tbody></table></div></div></section>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":560}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const R = [["GST Registration", "Tax", "Registered", "ok", "29AAKCN4821M1Z5", "1 Nov 2026", "GSTN"], ["LUT Filing", "Tax", "Registered", "ok", "AD291126001234X", "3 Nov 2026", "GSTN"], ["PF Registration", "Labour", "Registered", "ok", "KNBNG2954118000", "2 Nov 2026", "EPFO"], ["ESI Registration", "Labour", "Registered", "ok", "53001234560001001", "3 Nov 2026", "ESIC"], ["PT Registration", "Labour", "In progress", "prog", "", "Est. 12 Nov 2026", "Karnataka CTD"], ["Shops & Establishment", "Labour", "In progress", "prog", "", "Est. 15 Nov 2026", "Karnataka Labour Dept"], ["MSME Registration", "Business", "Registered", "ok", "UDYAM-KR-03-0123456", "30 Oct 2026", "Ministry of MSME"], ["IEC Registration", "Business", "In progress", "prog", "", "Est. 14 Nov 2026", "DGFT"], ["Trade Licence", "Business", "Upcoming", "up", "", "Dec 2026", "BBMP"], ["LEI Registration", "Business", "Upcoming", "up", "", "Dec 2026", "LEIL"], ["Trademark Registration", "IP", "Upcoming", "up", "", "Jan 2027", "IP India"], ["FCGPR Filing", "FEMA", "Upcoming", "up", "", "By 2 Dec 2026", "RBI \u00b7 FIRMS"], ["FLA Return", "FEMA", "Upcoming", "up", "", "By 15 Jul 2027", "RBI"]]; const CATS = ['All', 'Tax', 'Labour', 'Business', 'IP', 'FEMA'];const TABS = CATS.map((c) => [c, c === 'All' ? R.length : R.filter((r) => r[1] === c).length]);
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const rows = R.filter((r) => s.tab === 0 || r[1] === CATS[s.tab]).map((r) => ({ n: r[0], c: r[1], s: r[2], cs: 'background:var(--' + r[3] + '-chip);color:#fff', no: r[4] || '-', d: r[5], au: r[6], dl: r[3] === 'ok' }));return { tabs, thumb, rows };
  }
}
</script>
```

## v7c_postinc.dc.html

Markup:
```html
<div style="width:100%;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<section class="card" style=""><div style="display:flex;align-items:center;gap:8px;padding:14px 16px 0"><h3 style="margin:0;font:700 13px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Post-incorporation setup</h3><div style="margin-left:auto;display:flex;gap:6px;align-items:center"><span class="chip" style="background:var(--up-light);color:var(--up-text);min-width:116px;justify-content:center">Day 15 since COI</span></div></div><div style="padding:8px 16px 4px"><div class="lbl" style="color:var(--navy-ink,var(--navy));margin:4px 0 2px">Open · statutory window used</div><div style="padding:10px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">FC-GPR Filing<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Within 30 days of share allotment (2 Nov) · Bank FIRC + KYC letter needed<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="chip" style="background:var(--due-light);color:var(--due-text)">Northwind</span><span class="mono" style="font-size:12px;font-weight:600;width:auto;min-width:80px;text-align:right;white-space:nowrap">2 Dec 2026</span></div><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><div class="tipw" role="button" tabindex="0" aria-label="FC-GPR Filing" onClick="{{dd0}}" style="flex:1;position:relative;height:10px;border-radius:3px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)"><span class="tt " role="tooltip">FC-GPR Filing · day 6 of 30 · due 2 Dec</span><span style="position:absolute;left:0;top:0;bottom:0;width:20.0%;border-radius:3px;background:var(--due)"></span></div><span class="mono cap" style="width:auto;min-width:80px;text-align:right;white-space:nowrap;font-weight:600">day 6 of 30</span></div></div><div style="padding:10px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">Nominee Shareholder (MGT-4/5/6)<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Within 30 days of incorporation · 50% done<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="chip" style="background:var(--prog-light);color:var(--prog-text)">SBC</span><span class="mono" style="font-size:12px;font-weight:600;width:auto;min-width:80px;text-align:right;white-space:nowrap">23 Nov 2026</span></div><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><div class="tipw" role="button" tabindex="0" aria-label="Nominee Shareholder" onClick="{{dd0}}" style="flex:1;position:relative;height:10px;border-radius:3px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)"><span class="tt " role="tooltip">Nominee Shareholder · day 15 of 30 · due 23 Nov</span><span style="position:absolute;left:0;top:0;bottom:0;width:50.0%;border-radius:3px;background:var(--prog)"></span></div><span class="mono cap" style="width:auto;min-width:80px;text-align:right;white-space:nowrap;font-weight:600">day 15 of 30</span></div></div><div style="padding:10px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">Share Certificates (SH-1)<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Within 60 days of incorporation · 60% done<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="chip" style="background:var(--prog-light);color:var(--prog-text)">SBC</span><span class="mono" style="font-size:12px;font-weight:600;width:auto;min-width:80px;text-align:right;white-space:nowrap">23 Dec 2026</span></div><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><div class="tipw" role="button" tabindex="0" aria-label="Share Certificates (SH-1)" onClick="{{dd0}}" style="flex:1;position:relative;height:10px;border-radius:3px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)"><span class="tt " role="tooltip">Share Certificates (SH-1) · day 15 of 60 · due 23 Dec</span><span style="position:absolute;left:0;top:0;bottom:0;width:25.0%;border-radius:3px;background:var(--prog)"></span></div><span class="mono cap" style="width:auto;min-width:80px;text-align:right;white-space:nowrap;font-weight:600">day 15 of 60</span></div></div><div style="padding:10px 0;border-top:1px solid var(--hair)"><div style="display:flex;align-items:center;gap:8px"><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">Commencement (INC-20A)<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Within 180 days of incorporation · 40% done<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="chip" style="background:var(--prog-light);color:var(--prog-text)">SBC</span><span class="mono" style="font-size:12px;font-weight:600;width:auto;min-width:80px;text-align:right;white-space:nowrap">22 Apr 2027</span></div><div style="display:flex;align-items:center;gap:10px;margin-top:6px"><div class="tipw" role="button" tabindex="0" aria-label="Commencement (INC-20A)" onClick="{{dd0}}" style="flex:1;position:relative;height:10px;border-radius:3px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)"><span class="tt " role="tooltip">Commencement (INC-20A) · day 15 of 180 · due 22 Apr</span><span style="position:absolute;left:0;top:0;bottom:0;width:8.3%;border-radius:3px;background:var(--prog)"></span></div><span class="mono cap" style="width:auto;min-width:80px;text-align:right;white-space:nowrap;font-weight:600">day 15 of 180</span></div></div></div><div style="padding:4px 16px 14px"><div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--ok-text);margin-top:1px"><path class="duo" d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"></path><path d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M8.6 12.2l2.3 2.3 4.6-4.8"></path></svg><div style="flex:1"><div class="rt" style="display:flex;align-items:center;gap:4px"><span class="tipw" role="button" tabindex="0" onClick="{{dd1}}" style="position:relative;text-decoration:underline dotted;text-underline-offset:3px">7 completed<span class="tt " role="tooltip">Completed · 7 items</span></span><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">First Board Meeting · 26 Oct · Registered Office (INC-22) · 25 Oct · Company Letterhead · 27 Oct · Bank Account Opening · 29 Oct · Name Board · 30 Oct · Share Capital Infusion · 2 Nov · Auditor Appointment (ADT-1) · 5 Nov<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div></div></div></section>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":760,"height":560}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Post-incorporation setup", "tabs": [["All", 11], ["Open", 4], ["Completed", 7]], "rows": [["FC-GPR Filing", "day 6 of 30 \u00b7 2 Dec", "Open", "due", 1], ["Nominee Shareholder (MGT-4/5/6)", "day 15 of 30 \u00b7 23 Nov", "Open", "prog", 1], ["Share Certificates (SH-1)", "day 15 of 60 \u00b7 23 Dec", "Open", "prog", 1], ["Commencement (INC-20A)", "day 15 of 180 \u00b7 22 Apr", "Open", "prog", 1], ["Registered Office (INC-22)", "25 Oct", "Completed", "ok", 2], ["First Board Meeting", "26 Oct", "Completed", "ok", 2], ["Company Letterhead", "27 Oct", "Completed", "ok", 2], ["Bank Account Opening", "29 Oct", "Completed", "ok", 2], ["Name Board", "30 Oct", "Completed", "ok", 2], ["Share Capital Infusion", "2 Nov", "Completed", "ok", 2], ["Auditor Appointment (ADT-1)", "5 Nov", "Completed", "ok", 2]]}]; const __O = [[0, 1], [0, 2]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    return __d;
  }
}
</script>
```

## v7c_bot.dc.html

Board-specific CSS:
```css
<style>
/* owner character, static head. Moods: antenna colour (idle teal, answered green, cannot grey); thinking = antenna pulse + eyes scan. The smile never changes. */
.vb-scan{animation:vbScan 1.3s ease-in-out infinite}
@keyframes vbScan{0%,100%{transform:translateX(-9px)}50%{transform:translateX(9px)}}
.vb-ant{animation:vbAnt 1s ease-in-out infinite}
@keyframes vbAnt{50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){.vb-scan,.vb-ant{animation:none}}
</style>
```

Markup:
```html
<div style="{{box}}"><sc-if value="{{idle}}" hint-placeholder-val="{{true}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="" cx="120" cy="18" r="8" fill="#2DD4BF"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if><sc-if value="{{thinking}}" hint-placeholder-val="{{false}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, thinking"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="vb-ant" cx="120" cy="18" r="8" fill="#7DD3FC"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="vb-scan" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if><sc-if value="{{answered}}" hint-placeholder-val="{{false}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, answered"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="" cx="120" cy="18" r="8" fill="#34D399"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if><sc-if value="{{cannot}}" hint-placeholder-val="{{false}}"><svg viewBox="0 -40 240 240" width="100%" height="100%" role="img" aria-label="Ask VCFO assistant, cannot answer"><defs><linearGradient id="{{gid}}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C8DF8"></stop><stop offset="1" stop-color="#1D4ED8"></stop></linearGradient><filter id="{{fid}}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter><clipPath id="{{cid}}"><rect x="-10" y="-40" width="260" height="240"></rect></clipPath></defs><g clip-path="{{curl}}"><line x1="120" y1="46" x2="120" y2="24" stroke="#1E40AF" stroke-width="5" stroke-linecap="round"></line><circle class="" cx="120" cy="18" r="8" fill="#94A3B8"></circle><rect x="14" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="206" y="112" width="20" height="46" rx="10" fill="#1E40AF"></rect><rect x="30" y="44" width="180" height="210" rx="56" fill="{{gurl}}"></rect><path d="M62 56 q30 -10 60 -8" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" fill="none"></path><rect x="50" y="84" width="140" height="82" rx="36" fill="#0B1736"></rect><rect x="64" y="91" width="54" height="7" rx="3.5" fill="#fff" fill-opacity=".08"></rect><g class="" filter="{{furl}}" fill="#7DD3FC"><rect x="88" y="109" width="22" height="30" rx="11"></rect><rect x="130" y="109" width="22" height="30" rx="11"></rect><path d="M103 148 Q120 161 137 148" fill="none" stroke="#7DD3FC" stroke-width="5" stroke-linecap="round"></path></g><rect x="104" y="180" width="32" height="5" rx="2.5" fill="#1E3A8A" fill-opacity=".7"></rect></g></svg></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"state":{"editor":"select","options":["idle","thinking","answered","cannot"],"default":"idle"},"size":{"editor":"number","default":56},"$preview":{"width":56,"height":56}}'>
class Component extends DCLogic {
  renderVals() {
    const p = this.props || {}; const st = p.state || 'idle'; const sz = Number(p.size || 56);if (!this._u) this._u = 'vb' + Math.random().toString(36).slice(2, 8);const u = this._u; const o = { box: 'display:flex;width:' + sz + 'px;height:' + sz + 'px', gid: u + 'h', fid: u + 'g', cid: u + 'c', gurl: 'url(#' + u + 'h)', furl: 'url(#' + u + 'g)', curl: 'url(#' + u + 'c)' }; ['idle','thinking','answered','cannot'].forEach((k) => { o[k] = st === k; }); return o;
  }
}
</script>
```

## v7x_drilldown.dc.html

Markup:
```html
<div role="dialog" aria-modal="true" aria-label="{{title}}" class="vh-dd" style="width:600px;max-height:560px;display:flex;flex-direction:column;background:var(--panel);border-radius:12px;box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6);overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px"><div class="dd-top" style="display:flex;align-items:center;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)"><span>These items live in {{linkName}}</span><a href="#" data-go="{{linkGo}}" style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap">Open {{linkName}} →</a></div><div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)"><div style="flex:1;font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">{{title}}</div><button type="button" aria-label="Close" onClick="{{close}}" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="padding:14px 18px 0"><div class="seg" role="tablist" style="{{segSt}}"><span class="thumb" style="{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="4"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div></div><div style="flex:1;min-height:0;overflow:auto;padding:8px 18px 4px"><sc-for list="{{rows}}" as="r" hint-placeholder-count="4"><a class="ddrow" href="#" title="Open"><span style="font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{r.n}}</span><span class="mono" style="font-size:12px;color:var(--muted);white-space:nowrap">{{r.m}}</span><span class="chip" style="{{r.cs}}">{{r.s}}</span><span style="color:var(--primary);display:flex"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></a></sc-for><sc-if value="{{empty}}" hint-placeholder-val="{{false}}"><div style="padding:16px 0;color:var(--muted)">Nothing here.</div></sc-if></div><div style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-top:1px solid var(--border);background:var(--raised)"><span style="flex:1;font-size:12px;color:var(--muted)">{{foot}}</span><a href="#" style="font-size:12.5px;font-weight:700">Open full list</a></div></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"title":{"editor":"text","default":"Incorporation steps"},"tabs":{"editor":"text","default":"[[\"All\", 14], [\"Completed\", 6], [\"In progress\", 3], [\"Waiting for Northwind\", 1], [\"Upcoming\", 4]]"},"rows":{"editor":"text","default":"[[\"Client Details\", \"12 Sep\", \"Completed\", \"ok\", 1], [\"Draft Board Resolution\", \"14 Sep\", \"Completed\", \"ok\", 1], [\"Signed Board Resolution\", \"18 Sep\", \"Completed\", \"ok\", 1], [\"Name Application\", \"Part A\", \"Completed\", \"ok\", 1], [\"Name Approval\", \"24 Sep\", \"Completed\", \"ok\", 1], [\"Capital Structure\", \"1 Oct\", \"Completed\", \"ok\", 1], [\"Proposed Directors\", \"6 Oct\", \"In progress\", \"prog\", 2], [\"Subscriber Details\", \"10 Oct\", \"In progress\", \"prog\", 2], [\"Registered Office Address\", \"9 Oct\", \"Waiting for Northwind\", \"due\", 3], [\"KYC Review & DSC\", \"13 Oct\", \"In progress\", \"prog\", 2], [\"SPICe+ Confirmation\", \"16 Oct\", \"Upcoming\", \"up\", 4], [\"SPICe+ Filing\", \"20 Oct\", \"Upcoming\", \"up\", 4], [\"MCA Remarks\", \"24 Oct\", \"Upcoming\", \"up\", 4], [\"Certificate of Incorporation\", \"28 Oct\", \"Upcoming\", \"up\", 4]]"},"active":{"editor":"number","default":1},"$preview":{"width":600,"height":480}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    const p = this.props || {}; let T = [], R = []; try { T = JSON.parse(p.tabs || '[]'); R = JSON.parse(p.rows || '[]'); } catch (e) {}const tab = (s.tab != null) ? s.tab : Number(p.active || 0); const n = T.length || 1; const all = T[0] && T[0][0] === 'All';const tabs = T.map((t, i) => ({ label: t[0], cnt: t[1], cls: i === tab ? 'on' : '', pick: () => this.setState({ tab: i }) }));const rows = R.filter((r) => (all && tab === 0) || r[4] === tab).map((r) => ({ n: r[0], m: r[1], s: r[2], cs: 'background:var(--' + r[3] + '-chip);color:#fff' }));const total = T[tab] ? T[tab][1] : rows.length;const tl = String(p.title || ''); const L = /filings/i.test(tl) ? ['Filings', 'filings'] : /alert/i.test(tl) ? ['Notifications', 'notifications'] : /document/i.test(tl) ? ['Documents', 'documents'] : /team|who/i.test(tl) ? ['Team', 'team'] : /compliance|deadline/i.test(tl) ? ['Compliances', 'compliances'] : ['Incorporation', 'incorporation'];
    return { linkName: L[0], linkGo: L[1], title: p.title || 'Details', tabs, rows, empty: rows.length === 0, segSt: 'grid-template-columns:repeat(' + n + ',minmax(0,1fr));width:100%', thumb: 'width:calc((100% - 4px)/' + n + ');transform:translateX(' + (tab * 100) + '%)', foot: rows.length < total ? 'Showing ' + rows.length + ' of ' + total : 'Showing all ' + total, close: () => { if (typeof p.onclose === 'function') p.onclose(); } };
  }
}
</script>
```

## v7p_ids_password.dc.html

Markup:
```html
<div style="width:100%;height:100vh;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="position:relative;width:100%;height:100%;overflow:hidden;background:var(--bg)"><div style="position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_after" hint-size="1440px,900px"></dc-import></div><div class="vh-pbar"><button type="button" class="vh-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16 M4 12h16 M4 17h16"></path></svg></button><img src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC" style="height:22px;width:auto"><span style="margin-left:6px;font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Home</span></div><div class="vh-under-bar" style="position:absolute;inset:0;background:oklch(20% 0.05 258 / 0.55)"></div><div class="vh-under-bar" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px"><div role="dialog" aria-modal="true" style="width:min(400px,100%);max-height:100%;overflow:auto;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / 0.55);overflow:hidden;display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Confirm it's you<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Enter your password to show your PAN<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><button type="button" aria-label="Close" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="padding:16px 18px"><label for="pw" class="lbl" style="color:var(--navy-ink,var(--navy))">Password</label><div style="display:flex;align-items:center;height:40px;border-radius:6px;padding:0 6px 0 12px;margin-top:6px;border:1.5px solid var(--over)"><input id="pw" type="password" value="sbc-demo-pass" readOnly="{{ro}}" style="flex:1;min-width:0;border:0;outline:0;font:600 15px Manrope;letter-spacing:.12em;background:transparent"><button type="button" aria-label="Show password" style="width:30px;height:30px;border:0;border-radius:6px;background:var(--raised);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path></svg></button></div><div role="alert" style="display:flex;align-items:center;gap:6px;color:var(--over-text);font-size:12px;font-weight:700;margin-top:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z"></path><path d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z M12 8v4.6 M12 15.8v.1"></path></svg>Wrong password. 2 tries left.</div><a href="#" style="font-size:12px;display:inline-block;margin-top:8px">Forgot password?</a></div><div style="display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--raised)"><span style="flex:1;display:flex"><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Shown for 60 seconds<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><a class="btn btn-o" href="#" style="">Cancel</a><a class="btn btn-p" href="#" style="">Confirm</a></div></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.state || {};
    return { ro: true, openSide: () => { if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell && window.vcfoShell.openDrawer) window.vcfoShell.openDrawer(); } };
  }
}
</script>
```

## v7p_compliance.dc.html

Board-specific CSS:
```css
<style>
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
</style>
<style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
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
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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
</style>
```

Markup:
```html
<div style="width:1440px;height:900px;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="position:relative;width:1440px;height:900px;overflow:hidden;background:var(--bg)"><div style="position:absolute;left:0;top:0;width:1440px;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_after" hint-size="1440px,900px"></dc-import></div><div style="position:absolute;inset:0;background:oklch(20% 0.05 258 / 0.55)"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div role="dialog" aria-modal="true" style="width:760px;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / 0.55);overflow:hidden;display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Compliances · FY 2026-27<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">As of 8 Nov 2026<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><button type="button" aria-label="Close" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="padding:16px 18px"><div class="seg" role="tablist" style="grid-template-columns:repeat(5,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/5);{{thumb}}"></span><sc-for list="{{tabs}}" as="t" hint-placeholder-count="5"><button type="button" role="tab" onClick="{{t.pick}}" class="{{t.cls}}">{{t.label}}<span class="cnt">{{t.cnt}}</span></button></sc-for></div><table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:12px"><thead><tr><th>Filing</th><th>Period</th><th>Area</th><th style="text-align:right">Due / filed</th><th>Status</th></tr></thead><tbody><sc-for list="{{rows}}" as="r" hint-placeholder-count="4"><tr><td class="rt" style="padding:7px 8px">{{r.t}}</td><td class="cap" style="padding:7px 8px">{{r.p}}</td><td style="padding:7px 8px">{{r.a}}</td><td class="mono" style="padding:7px 8px;text-align:right;font-size:12px">{{r.d}}</td><td style="padding:7px 8px"><span class="chip" style="{{r.cs}}">{{r.s}}</span></td></tr></sc-for></tbody></table><div class="cap" style="margin-top:8px">{{foot}}</div></div><div style="display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--raised)"><a class="btn btn-o" href="#" style="height:30px;padding:0 10px;font-size:12px;">Open Filings</a></div></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"tab": 1}; }
  renderVals() {
    const s = this.state || {};
    const IT = [["TDS Payment", "Oct 2026", "Income tax", "7 Nov 2026", 2], ["EPF Return & Payment", "Oct 2026", "Payroll", "15 Nov 2026", 1], ["ESI Payment", "Oct 2026", "Payroll", "15 Nov 2026", 1], ["PT Payment", "Oct 2026", "Payroll", "20 Nov 2026", 1], ["ADT-1 (auditor appointment)", "FY 2026-27", "MCA", "Filed 5 Nov 2026", 0], ["FC-GPR Filing", "Share allotment", "FEMA", "2 Dec 2026", 3], ["TDS Payment", "Nov 2026", "Income tax", "7 Dec 2026", 3], ["GSTR-1", "Nov 2026", "GST", "11 Dec 2026", 3], ["GSTR-3B", "Nov 2026", "GST", "20 Dec 2026", 3], ["Commencement (INC-20A)", "One-time", "MCA", "22 Apr 2027", 3]]; const TOT = [1, 3, 1, 33]; const NAMES = ['Filed', 'Due soon', 'Overdue', 'Upcoming']; const K = ['ok', 'due', 'over', 'up'];const TABS = [['All', 38], ['Filed', 1], ['Due soon', 3], ['Overdue', 1], ['Upcoming', 33]];
    const tabs = TABS.map((t, i) => ({ label: t[0], cnt: t[1], cls: s.tab === i ? 'on' : '', pick: () => this.setState({ tab: i }) }));
    const thumb = 'transform:translateX(' + (s.tab * 100) + '%)';
const list = IT.filter((r) => s.tab === 0 || r[4] === s.tab - 1).map((r) => ({ t: r[0], p: r[1], a: r[2], d: r[3], s: NAMES[r[4]], cs: 'background:var(--' + K[r[4]] + '-chip);color:#fff' }));const full = s.tab === 0 ? 38 : TOT[s.tab - 1];const foot = list.length < full ? 'Showing ' + list.length + ' of ' + full + ' · full list in Filings' : 'Showing all ' + full;return { tabs, thumb, rows: list, foot };
  }
}
</script>
```

## v7p_step.dc.html

Board-specific CSS:
```css
<style>
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
</style>
<style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
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
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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
</style>
```

Markup:
```html
<div style="position:relative;width:1440px;height:1040px;overflow:hidden;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="position:absolute;left:0;top:0;width:1440px;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_before" hint-size="1440px,1040px"></dc-import></div>
<div style="position:absolute;inset:0;background:oklch(20% 0.05 258 / 0.55)"></div>
<div role="dialog" aria-modal="true" aria-label="Registered Office Address" style="position:absolute;left:50%;top:24px;transform:translateX(-50%);width:760px;display:flex;flex-direction:column;background:var(--panel);border-radius:12px;box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / 0.6)"><div style="position:relative;padding:16px 20px 14px;background:linear-gradient(115deg,var(--navy-deep,var(--navy)),var(--navy-2-deep,var(--navy-2)) 70%,var(--navy-3-deep,var(--navy-3)));color:#fff"><div style="display:flex;align-items:center;gap:10px"><span class="mono" style="font-size:11px;letter-spacing:.06em;color:var(--gold)">STEP 7 OF 14 · PART B</span><button type="button" aria-label="Close" style="margin-left:auto;width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / 0.12);color:#fff;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><h2 class="metric" style="margin:2px 0 8px;font-size:24px;color:#fff;display:flex;align-items:center;gap:6px">Registered Office Address<span style="color:#fff"><span class="info "><button type="button" aria-label="More information" style="color:oklch(100% 0 0 / .75)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Office address for the company, with proof of address and the owner's NOC.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span></h2><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">Waiting on Northwind</span><span class="chip" style="background:var(--over-chip);color:#fff">Due 9 Oct · 3 days</span><span class="chip" style="background:oklch(100% 0 0 / 0.16);color:#fff">Owner · Northwind</span></div><span style="position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)"></span></div><div style="padding:16px 20px;display:flex;flex-direction:column;gap:18px"><section style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:6px"><h3 class="lbl" style="margin:0;color:var(--navy-ink,var(--navy))">Timeline</h3></div><div role="list" aria-label="Step timeline" style="display:flex;align-items:center;gap:6px"><div style="flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--ok-light);color:var(--ok-text);border:1px solid oklch(56% 0.13 168 / .35)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M7 12.5l3 3 7-7"></path></svg><div><div style="display:flex;align-items:center;gap:2px;font-size:12.5px;font-weight:700">Started<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Rohan Kumar started this step on 2 Oct 2026.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><div style="font-size:11.5px;color:var(--ok-text);font-weight:600">2 Oct</div></div></div><span aria-hidden="true" style="flex:1;min-width:16px;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--ok),var(--navy-deep,var(--navy)))"></span><div style="flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--navy);color:#fff;border:1px solid var(--navy);box-shadow:0 0 0 4px oklch(37.9% 0.146 266 / .14)"><span class="pulse" style="width:8px;height:8px;border-radius:99px;background:var(--gold)"></span><div><div style="display:flex;align-items:center;gap:2px;font-size:12.5px;font-weight:700">Submitted<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Waiting for Northwind. Due 9 Oct 2026, in 3 days.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><div style="font-size:11.5px;color:oklch(100% 0 0 / .72);font-weight:600">Due 9 Oct</div></div></div><span aria-hidden="true" style="flex:1;min-width:16px;height:2px;border-radius:2px;background:repeating-linear-gradient(90deg,var(--border) 0 5px,transparent 5px 9px)"></span><div style="flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--panel);color:var(--muted);border:1px dashed var(--border)"><span style="width:8px;height:8px;border-radius:99px;border:1.5px solid var(--subtle)"></span><div><div style="display:flex;align-items:center;gap:2px;font-size:12.5px;font-weight:700">Reviewed<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Arjun Mehta, Project Lead, checks the documents.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><div style="font-size:11.5px;color:var(--subtle);font-weight:600">Arjun Mehta</div></div></div><span aria-hidden="true" style="flex:1;min-width:16px;height:2px;border-radius:2px;background:repeating-linear-gradient(90deg,var(--border) 0 5px,transparent 5px 9px)"></span><div style="flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--panel);color:var(--muted);border:1px dashed var(--border)"><span style="width:8px;height:8px;border-radius:99px;border:1.5px solid var(--subtle)"></span><div><div style="display:flex;align-items:center;gap:2px;font-size:12.5px;font-weight:700">Completed<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Priya Raman, Project Manager, signs off.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><div style="font-size:11.5px;color:var(--subtle);font-weight:600">Priya Raman</div></div></div></div></section><section style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:6px"><h3 class="lbl" style="margin:0;color:var(--navy-ink,var(--navy))">Needed from Northwind</h3><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">2</span></div><div style="border:1px solid oklch(66% 0.17 48 / 0.35);border-radius:8px;padding:0 12px;background:var(--due-light)"><div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid oklch(66% 0.17 48 / 0.2)"><span class="box" style="border-color:var(--due)"></span><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">Utility bill for the office<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Electricity or water · Max 2 months old · Asked by Arjun Mehta · Due 9 Oct<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><a class="btn btn-o" href="#" style="height:30px;min-width:88px;justify-content:center;font-size:12px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 15V4.5 M7.8 8.7 12 4.5l4.2 4.2"></path></svg>Upload</a></div><div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid oklch(66% 0.17 48 / 0.2)"><span class="box" style="border-color:var(--due)"></span><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px">NOC from property owner<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Signed, on plain paper · Asked by Arjun Mehta · Due 9 Oct<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><a class="btn btn-o" href="#" style="height:30px;min-width:88px;justify-content:center;font-size:12px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 15V4.5 M7.8 8.7 12 4.5l4.2 4.2"></path></svg>Upload</a></div></div></section><section style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:6px"><h3 class="lbl" style="margin:0;color:var(--navy-ink,var(--navy))">Documents</h3></div><div title="Open preview" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hair);cursor:pointer"><span class="mono" style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;flex:none;background:var(--over-light);color:var(--over-text)">PDF</span><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px;font-size:13px">Rent agreement<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Uploaded by Northwind on 2 Oct 2026.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="chip" style="background:var(--ok-chip);color:#fff;min-width:116px;justify-content:center">Uploaded</span><span style="display:flex;gap:6px"><button type="button" aria-label="Preview" title="Preview" style="width:28px;height:28px;flex:none;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--primary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"></path></svg></button><button type="button" aria-label="Download" title="Download" style="width:28px;height:28px;flex:none;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--primary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></button></span></div><div  style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hair)"><span style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--raised);color:var(--subtle)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M6 4.5h7.5L18 9v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z"></path><path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z M13.5 3.5v5h5 M8.5 13h7 M8.5 16.5h4.5"></path></svg></span><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px;font-size:13px">Utility bill<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Electricity or water · Max 2 months old<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="chip" style="background:var(--over-chip);color:#fff">Missing</span><span style="width:62px"></span></div><div  style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--hair)"><span style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--raised);color:var(--subtle)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M6 4.5h7.5L18 9v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z"></path><path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z M13.5 3.5v5h5 M8.5 13h7 M8.5 16.5h4.5"></path></svg></span><span class="rt" style="flex:1;display:flex;align-items:center;gap:4px;font-size:13px">NOC from property owner<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Signed, on plain paper<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><span class="chip" style="background:var(--over-chip);color:#fff">Missing</span><span style="width:62px"></span></div></section><section style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:6px"><h3 class="lbl" style="margin:0;color:var(--navy-ink,var(--navy))">What was provided</h3></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:20px"><div style="grid-column:span 2;display:flex;flex-direction:column;gap:2px;padding:8px 0;border-top:1px solid var(--hair)"><span class="lbl" style="font-size:10px">Address</span><span class="rt" style="font-size:13px">4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103</span></div><div style="display:flex;flex-direction:column;gap:2px;padding:8px 0;border-top:1px solid var(--hair)"><span class="lbl" style="font-size:10px">State</span><span class="rt" style="font-size:13px">Karnataka</span></div><div style="display:flex;flex-direction:column;gap:2px;padding:8px 0;border-top:1px solid var(--hair)"><span class="lbl" style="font-size:10px">Premises</span><span class="rt" style="font-size:13px">Leased</span></div><div style="display:flex;flex-direction:column;gap:2px;padding:8px 0;border-top:1px solid var(--hair)"><span class="lbl" style="font-size:10px">Owner</span><span style="display:flex;align-items:center;gap:4px;color:var(--subtle);font-weight:600">—<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Not given yet. Northwind adds this when the step is completed.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span></div><div style="display:flex;flex-direction:column;gap:2px;padding:8px 0;border-top:1px solid var(--hair)"><span class="lbl" style="font-size:10px">Proof of address</span><span style="display:flex;align-items:center;gap:4px;color:var(--subtle);font-weight:600">—<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Not given yet. Northwind adds this when the step is completed.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span></div></div></section></div><div style="display:flex;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--border);background:var(--raised)"><a class="btn btn-p" href="#">Continue step <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></a><a class="btn btn-o" href="#" style="gap:6px"><dc-import name="v7c_bot" state="idle" size="18" hint-size="18px,18px"></dc-import>Ask VCFO about this step</a><a class="btn btn-o" href="#"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a1.5 1.5 0 0 1-1.5-1.5Z M8.5 9h7 M8.5 12h4.5"></path></svg>Message Arjun (lead)</a></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1040}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7p_timeline_client.dc.html

Board-specific CSS:
```css
<style>
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
</style>
<style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
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
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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
</style>
```

Markup:
```html
<div style="width:1440px;height:960px;box-sizing:border-box;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="position:relative;width:1440px;height:960px;overflow:hidden;background:var(--bg)"><div style="position:absolute;left:0;top:0;width:1440px;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_before" hint-size="1440px,960px"></dc-import></div><div style="position:absolute;inset:0;background:oklch(20% 0.05 258 / 0.55)"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div role="dialog" aria-modal="true" style="width:980px;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / 0.55);overflow:hidden;display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font:700 15px Manrope,sans-serif;color:var(--navy-ink,var(--navy))">Request a timeline change<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Northwind Technologies India Pvt Ltd · client request<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><button type="button" aria-label="Close" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="padding:16px 18px"><div style="display:flex;gap:10px;align-items:center;border:1px solid var(--border);border-left:3px solid var(--prog);border-radius:8px;padding:9px 12px;margin-bottom:12px;background:var(--prog-light)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--prog-text)"><path class="duo" d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"></path><path d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M12 11v5 M12 8v.1"></path></svg><span class="rt" style="font-weight:500">The change is a request. Priya Raman (manager) approves or rejects it.</span></div><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><a class="btn btn-o" href="#" aria-label="Undo" title="Undo" style="height:30px;width:30px;padding:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path></svg></a><a class="btn btn-o" href="#" aria-label="Redo" title="Redo" style="height:30px;width:30px;padding:0;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13"></path></svg></a><span class="cap" style="font-weight:700;margin-left:6px">Snap</span><div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr));"><span class="thumb" style="width:calc((100% - 4px)/2);transform:translateX(0%)"></span><button type="button" class="on">Day</button><button type="button" class="">Week</button></div><span style="margin-left:auto"><span class="chip" style="background:var(--due-chip);color:#fff;min-width:116px;justify-content:center">COI would move 4 days</span></span></div><div style="position:relative;border:1px solid var(--border);border-radius:8px;padding:12px 12px 30px"><div style="position:absolute;left:calc(162px + (100% - 174px) * 73.68 / 100);top:4px;transform:translateX(-50%);background:var(--navy);color:#fff;border-radius:6px;padding:4px 8px;font-size:11.5px;font-weight:700;white-space:nowrap;z-index:2">24 Oct 2026 · +4 days</div><div style="position:relative"><div style="display:grid;grid-template-columns:150px minmax(0,1fr)"><span></span><div style="position:relative;height:18px"><span class="mono cap" style="position:absolute;left:0.0%;transform:translateX(-50%);white-space:nowrap">12 Sep</span><span class="mono cap" style="position:absolute;left:12.28%;transform:translateX(-50%);white-space:nowrap">19 Sep</span><span class="mono cap" style="position:absolute;left:24.56%;transform:translateX(-50%);white-space:nowrap">26 Sep</span><span class="mono cap" style="position:absolute;left:36.84%;transform:translateX(-50%);white-space:nowrap">3 Oct</span><span class="mono cap" style="position:absolute;left:49.12%;transform:translateX(-50%);white-space:nowrap">10 Oct</span><span class="mono cap" style="position:absolute;left:61.4%;transform:translateX(-50%);white-space:nowrap">17 Oct</span><span class="mono cap" style="position:absolute;left:73.68%;transform:translateX(-50%);white-space:nowrap">24 Oct</span><span class="mono cap" style="position:absolute;left:85.96%;transform:translateX(-50%);white-space:nowrap">31 Oct</span><span class="mono cap" style="position:absolute;left:98.25%;transform:translateX(-50%);white-space:nowrap">7 Nov</span></div></div><div style="position:relative"><div style="position:absolute;left:150px;right:0;top:0;bottom:0"><span style="position:absolute;left:0.0%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:12.28%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:24.56%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:36.84%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:49.12%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:61.4%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:73.68%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:85.96%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:98.25%;top:0;bottom:0;width:1px;background:var(--hair)"></span><span style="position:absolute;left:42.11%;top:-4px;bottom:0;width:2px;background:var(--over)"></span><span class="chip" style="position:absolute;left:42.11%;bottom:-20px;transform:translateX(-50%);background:var(--over-chip);color:#fff;padding:0 6px">Today 6 Oct</span></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:40px"><span class="rt" style="font-size:12px">Phase 1 · Name Application</span><div style="position:relative;height:40px"><span style="position:absolute;left:0.0%;width:21.05%;top:5px;bottom:5px;border-radius:4px;background:var(--ok);"></span><span class="cap" style="position:absolute;left:calc(21.05% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap"></span></div></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:40px"><span class="rt" style="font-size:12px">Phase 2 · Incorporation</span><div style="position:relative;height:40px"><span style="position:absolute;left:22.81%;width:43.86%;top:5px;bottom:5px;border-radius:4px;border:1.5px dashed var(--subtle);background:oklch(55% 0.02 255 / 0.08)"></span><span style="position:absolute;left:22.81%;width:50.870000000000005%;top:5px;bottom:5px;border-radius:4px;background:var(--prog);box-shadow:0 0 0 2px var(--over)"><span style="position:absolute;left:-5px;top:-3px;bottom:-3px;width:10px;border-radius:3px;background:var(--panel);box-shadow:0 0 0 1.5px var(--primary);display:flex;align-items:center;justify-content:center;color:var(--primary);cursor:ew-resize"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 6v12 M15 6v12"></path></svg></span><span style="position:absolute;right:-5px;top:-3px;bottom:-3px;width:10px;border-radius:3px;background:var(--panel);box-shadow:0 0 0 1.5px var(--primary);display:flex;align-items:center;justify-content:center;color:var(--primary);cursor:ew-resize"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 6v12 M15 6v12"></path></svg></span></span><span class="cap" style="position:absolute;left:calc(73.68% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap"></span></div></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:40px"><span class="rt" style="font-size:12px">MCA review</span><div style="position:relative;height:40px"><span style="position:absolute;left:66.67%;width:14.030000000000001%;top:5px;bottom:5px;border-radius:4px;border:1.5px dashed var(--subtle);background:oklch(55% 0.02 255 / 0.08)"></span><span style="position:absolute;left:73.68%;width:14.039999999999992%;top:5px;bottom:5px;border-radius:4px;background:var(--up);box-shadow:0 0 0 2px var(--over)"></span><span class="cap" style="position:absolute;left:calc(87.72% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap"></span></div></div><div style="display:grid;grid-template-columns:150px minmax(0,1fr);align-items:center;height:40px"><span class="rt" style="font-size:12px">COI</span><div style="position:relative;height:40px"><span style="position:absolute;left:80.7%;width:1.759999999999991%;top:5px;bottom:5px;border-radius:4px;border:1.5px dashed var(--subtle);background:oklch(55% 0.02 255 / 0.08)"></span><span style="position:absolute;left:87.72%;width:1.75%;top:5px;bottom:5px;border-radius:4px;background:var(--navy);box-shadow:0 0 0 2px var(--over)"></span><span class="cap" style="position:absolute;left:calc(89.47% + 8px);top:50%;transform:translateY(-50%);font-weight:700;white-space:nowrap"></span></div></div></div></div></div><div style="display:flex;gap:14px;margin-top:8px"><span class="cap" style="display:inline-flex;gap:6px;align-items:center;font-weight:600;color:var(--fg)"><span style="width:16px;height:8px;border-radius:2px;border:1.5px dashed var(--subtle)"></span>Before</span><span class="cap" style="display:inline-flex;gap:6px;align-items:center;font-weight:600;color:var(--fg)"><span style="width:16px;height:8px;border-radius:2px;background:var(--prog)"></span>After</span><span class="cap" style="display:inline-flex;gap:6px;align-items:center;font-weight:600;color:var(--fg)"><span style="width:16px;height:8px;border-radius:2px;box-shadow:0 0 0 2px var(--over)"></span>Critical path</span><span class="cap" style="display:inline-flex;gap:6px;align-items:center;font-weight:600;color:var(--fg)"><span style="width:2px;height:12px;background:var(--over)"></span>Today</span></div><table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:14px"><thead><tr><th>Phase</th><th>Before</th><th>After</th><th style="text-align:right">Change</th></tr></thead><tbody><tr><td class="rt" style="padding:7px 8px">Phase 2 · Incorporation</td><td class="mono" style="padding:7px 8px;font-size:12px;color:var(--muted);text-decoration:line-through">25 Sep - 20 Oct</td><td class="mono" style="padding:7px 8px;font-size:12px;font-weight:600">25 Sep - 24 Oct</td><td style="padding:7px 8px;text-align:right"><span class="chip" style="background:var(--over-chip);color:#fff">+4 days</span></td></tr><tr><td class="rt" style="padding:7px 8px">MCA review</td><td class="mono" style="padding:7px 8px;font-size:12px;color:var(--muted);text-decoration:line-through">20 Oct - 28 Oct</td><td class="mono" style="padding:7px 8px;font-size:12px;font-weight:600">24 Oct - 1 Nov</td><td style="padding:7px 8px;text-align:right"><span class="chip" style="background:var(--over-chip);color:#fff">moved +4</span></td></tr><tr><td class="rt" style="padding:7px 8px">COI</td><td class="mono" style="padding:7px 8px;font-size:12px;color:var(--muted);text-decoration:line-through">28 Oct 2026</td><td class="mono" style="padding:7px 8px;font-size:12px;font-weight:600">1 Nov 2026</td><td style="padding:7px 8px;text-align:right"><span class="chip" style="background:var(--over-chip);color:#fff">+4 days</span></td></tr></tbody></table><div style="margin-top:14px;display:flex;flex-direction:column;gap:6px"><label for="why" class="lbl" style="color:var(--navy-ink,var(--navy))">Reason for the change</label><textarea id="why" rows="3" style="border:1px solid var(--border);border-radius:6px;padding:8px 10px;font:500 13px Manrope,sans-serif;resize:none">Office NOC from the landlord will arrive on 22 Oct.</textarea></div></div><div style="display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--raised)"><span style="flex:1;display:flex"><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Nothing changes until SBC approves<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><a class="btn btn-o" href="#" style="">Cancel</a><a class="btn btn-p" href="#" style=""><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4 12 20 4l-4 16-4-6Z"></path><path d="M4 12 20 4l-4 16-4-6Z M12 14l8-10"></path></svg>Send request</a></div></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":960}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```

## v7x_doc_viewer.dc.html

Markup:
```html
<div style="font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="width:100%;display:flex;flex-direction:column;gap:32px;background:var(--bg);padding-bottom:32px"><div style="position:relative;width:100%;height:100vh;overflow:hidden"><div style="position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_after" hint-size="1440px,900px"></dc-import></div><div class="vh-pbar"><button type="button" class="vh-menu" data-vp-menu aria-label="Open menu" onClick="{{openSide}}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16 M4 12h16 M4 17h16"></path></svg></button><img src="vcfo-bin:b/6e69009086da4b463a19d1d632abaa20.png" alt="SBC" style="height:22px;width:auto"><span style="margin-left:6px;font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Documents</span></div><div class="vh-under-bar" style="position:absolute;top:0;right:0;bottom:0;left:var(--vp-side-w,248px);background:oklch(20% 0.05 258 / 0.6);display:flex;align-items:center;justify-content:center;z-index:2"><div role="dialog" aria-modal="true" aria-label="Document preview" style="width:min(1152px,calc(100% - 24px));height:min(720px,calc(100% - 24px));display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255));box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6)"><div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border)"><span class="mono" style="width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--over-light);color:var(--over-text)">PDF</span><div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{docFile}}</span><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">{{docMeta}} · Size [size]<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><span class="cap" style="margin-right:6px;font-weight:600;white-space:nowrap;flex:none">{{docPos}}</span><a class="btn btn-o" href="#" aria-label="Download" style="height:32px;padding:0 10px;font-size:12.5px;flex:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg><span class="vh-hide-sm">Download</span></a><button type="button" aria-label="Close preview (Esc)" title="Close (Esc)" onClick="{{close}}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="position:relative;flex:1;min-height:0;overflow:auto;display:flex;justify-content:center;padding:28px clamp(12px,6vw,72px) 72px"><div data-paper style="position:relative;width:{{pageW}};max-width:100%;flex:none;align-self:flex-start;aspect-ratio:1/1.414;background:light-dark(#fff, oklch(13% 0 89.9));box-shadow:0 4px 24px -8px oklch(21% 0.042 264 / .3);border-radius:2px;padding:clamp(20px,5vw,48px) clamp(18px,5vw,52px);box-sizing:border-box;overflow:hidden;transition:width .2s"><div style="font-size:11px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase">Sample · placeholder page</div><div class="metric" style="font-size:22px;margin-top:10px">{{docTitle}}</div><div class="cap" style="margin-top:4px">Northwind Technologies India Pvt Ltd · {{docDate}}</div><div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:92%;margin-top:10px"></div><div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:86%;margin-top:10px"></div><div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:95%;margin-top:10px"></div><div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:70%;margin-top:10px"></div><div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:88%;margin-top:10px"></div><div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:93%;margin-top:10px"></div><div style="height:7px;border-radius:3px;background:light-dark(oklch(90% 0.01 255), oklch(28% 0.01 255));width:60%;margin-top:10px"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"><span style="font:800 clamp(34px,7vw,64px) Manrope,sans-serif;color:oklch(90% 0.01 255);transform:rotate(-24deg);letter-spacing:.1em">SAMPLE</span></div></div><button type="button" aria-label="Previous document" onClick="{{prev}}" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:99px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px -4px oklch(21% 0.042 264 / .25)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><button type="button" aria-label="Next document" onClick="{{next}}" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:99px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px -4px oklch(21% 0.042 264 / .25)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><div class="vh-zoom" style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:4px;border-radius:8px;background:var(--navy);color:#fff;box-shadow:0 8px 20px -8px oklch(15% 0.05 258 / .5)"><span style="padding:0 10px;font:600 12px Manrope,sans-serif;white-space:nowrap">Page 1 / 1</span><span style="width:1px;height:18px;background:oklch(100% 0 0 / .2)"></span><button type="button" aria-label="Zoom out" onClick="{{zoomOut}}" style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:#fff;font:700 16px Manrope;cursor:pointer">−</button><span style="min-width:48px;text-align:center;font:600 12px Manrope,sans-serif">{{zoomLabel}}</span><button type="button" aria-label="Zoom in" onClick="{{zoomIn}}" style="width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:#fff;font:700 16px Manrope;cursor:pointer">+</button></div></div></div></div></div><div style="padding:0 clamp(12px,3vw,32px) 0 calc(var(--vp-side-w,248px) + clamp(12px,2.5vw,32px));display:flex;flex-direction:column;gap:12px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Unsupported file type</div><div role="dialog" aria-modal="true" aria-label="Document preview" style="width:min(860px,100%);min-height:380px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255));box-shadow:0 30px 70px -20px oklch(15% 0.05 258 / .6)"><div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--border)"><span class="mono" style="width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--prog-light);color:var(--prog-text)">DOCX</span><div style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:14px;font-weight:700"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Draft Board Resolution.docx</span><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">From SBC · 14 Sep 2026 · Size [size]<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><a class="btn btn-o" href="#" aria-label="Download" style="height:32px;padding:0 10px;font-size:12.5px;flex:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg><span class="vh-hide-sm">Download</span></a><button type="button" aria-label="Close preview (Esc)" title="Close (Esc)" onClick="{{close}}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--fg);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px 16px"><span style="width:64px;height:64px;border-radius:12px;background:var(--prog-light);color:var(--prog-text);display:flex;align-items:center;justify-content:center"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M6 4.5h7.5L18 9v10.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z"></path><path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z M13.5 3.5v5h5 M8.5 13h7 M8.5 16.5h4.5"></path></svg></span><div style="font-size:15px;font-weight:700">Preview not available for this file type</div><a class="btn btn-p" href="#"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg>Download</a></div></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":1420}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { i: 0, z: 100 }; }
  componentDidMount() {
    this._onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); this.close(); } };
    document.addEventListener('keydown', this._onKey);
  }
  componentWillUnmount() { if (this._onKey) document.removeEventListener('keydown', this._onKey); }
  // Back to the screen that opened the viewer: the shell's back, else Home (the viewer's
  // opener in the prototype), else browser history, else the Home route.
  close() {
    if (typeof window.vcfoBack === 'function') return window.vcfoBack();
    if (typeof window.vcfoNav === 'function') return window.vcfoNav('s/home/v7_before.dc.html');
    if (window.history.length > 1) return window.history.back();
    if (typeof window.vcfoGo === 'function') return window.vcfoGo('home');
  }
  renderVals() {
    const s = this.state || {};
    const D = [["Certificate of Incorporation", "24 Oct 2026", "SBC"], ["Board meeting minutes", "26 Oct 2026", "SBC"], ["GST certificate", "1 Nov 2026", "SBC"], ["Share capital FIRC", "2 Nov 2026", "Northwind"]]; const i = s.i || 0; const d = D[i]; const z = s.z || 100;return { docFile: d[0] + '.pdf', docTitle: d[0], docDate: d[1], docMeta: 'From ' + d[2] + ' · ' + d[1], docPos: (i + 1) + ' of ' + D.length, prev: () => this.setState({ i: (i + D.length - 1) % D.length }), next: () => this.setState({ i: (i + 1) % D.length }), zoomIn: () => this.setState({ z: Math.min(150, z + 25) }), zoomOut: () => this.setState({ z: Math.max(50, z - 25) }), zoomLabel: z + '%', pageW: Math.round(460 * z / 100) + 'px', close: () => this.close(), openSide: () => { if (window.vcfoOpenSide) window.vcfoOpenSide(); else if (window.vcfoShell && window.vcfoShell.openDrawer) window.vcfoShell.openDrawer(); } };
  }
}
</script>
```

## v7chat_home.dc.html

Board-specific CSS:
```css
<style>
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
</style>
<style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
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
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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
</style>
```

Markup:
```html
<div style="width:1440px;height:900px;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="position:relative;width:1440px;height:900px;overflow:hidden;background:var(--bg)"><div style="position:absolute;left:0;top:0;width:1440px;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_before" hint-size="1440px,900px"></dc-import></div><div style="position:absolute;inset:0;z-index:6"><section id="ask-panel" aria-label="Ask VCFO" style="position:absolute;right:24px;bottom:104px;width:400px;height:640px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:var(--bg);border:1px solid var(--border);box-shadow:0 2px 4px oklch(32% 0.04 264 / .06),0 18px 48px -12px oklch(21% 0.042 264 / .35);animation:v7up .3s cubic-bezier(.22,1,.36,1) both"><sc-if value="{{isHome}}" hint-placeholder-val="{{true}}"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="idle" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div></sc-if><sc-if value="{{isThink}}" hint-placeholder-val="{{false}}"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><button type="button" aria-label="Back to home" onClick="{{home}}" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="thinking" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div></sc-if><sc-if value="{{isAns}}" hint-placeholder-val="{{false}}"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><button type="button" aria-label="Back to home" onClick="{{home}}" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="answered" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div></sc-if><div style="flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px"><sc-if value="{{isHome}}" hint-placeholder-val="{{true}}"><div style="margin:-14px -14px 0;padding:16px 16px 44px;background:#0f2a4a;color:#fff"><div style="font-size:12px;color:oklch(100% 0 0 / .65)">Hello,</div><div class="metric" style="font-size:21px;color:#fff;margin-top:2px">Northwind Technologies</div></div><div style="margin-top:-40px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 4px 14px -4px oklch(37.9% 0.146 266 / .1)"><div style="display:flex;align-items:center;gap:8px"><span class="lbl">Northwind’s project</span><span class="chip" style="margin-left:auto;background:var(--prog-light);color:var(--prog-text)">SPICe+ Part B</span></div><div style="font-size:13.5px;font-weight:700">Registered Office Address</div><div style="height:5px;border-radius:99px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);overflow:hidden"><div style="width:18%;height:100%;background:var(--primary-fill,var(--primary));border-radius:99px"></div></div><div class="cap">7 of 38 steps done</div></div><div style="display:flex;flex-direction:column;gap:8px"><div class="lbl">Quick questions</div><div class="seg" role="tablist" style="grid-template-columns:repeat(2,minmax(0,1fr));width:100%"><span class="thumb" style="width:calc((100% - 4px)/2);{{thumb}}"></span><button type="button" role="tab" onClick="{{t0}}" class="{{c0}}">About Northwind’s project<span class="cnt">2</span></button><button type="button" role="tab" onClick="{{t1}}" class="{{c1}}">Learn the basics<span class="cnt">4</span></button></div><sc-if value="{{g0}}" hint-placeholder-val="{{true}}"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px"><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is my next step?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button" onClick="{{askWhere}}" style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">Where is my incorporation now?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li></ul></sc-if><sc-if value="{{g1}}" hint-placeholder-val="{{false}}"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px"><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is SPICe+ Part A?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is GST, and do we need it?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What happens after incorporation?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li><li><button type="button"  style="width:100%;min-height:40px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:6px;border:1px solid var(--border);background:var(--panel);font:500 13px Manrope,sans-serif;color:var(--fg);text-align:left;cursor:pointer"><span style="flex:1">What is FC-GPR?</span><span style="color:var(--primary);display:flex"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M5 12h14 M13 6l6 6-6 6"></path></svg></span></button></li></ul></sc-if></div><div style="display:flex;flex-direction:column;gap:6px"><div class="lbl">Pick up where Northwind left off</div><a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--fg)"><span style="width:28px;height:28px;border-radius:6px;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a1.5 1.5 0 0 1-1.5-1.5Z M8.5 9h7 M8.5 12h4.5"></path></svg></span><span style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600">Last conversation<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">What is SPICe+ Part A?<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--muted)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></a><a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--fg)"><span style="width:28px;height:28px;border-radius:6px;background:var(--ok-light);color:var(--ok-text);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M5.5 5A1.5 1.5 0 0 1 7 3.5h11.5v14H7A1.5 1.5 0 0 0 5.5 19Z"></path><path d="M5.5 19V5A1.5 1.5 0 0 1 7 3.5h11.5v14H7A1.5 1.5 0 0 0 5.5 19a1.5 1.5 0 0 0 1.5 1.5h11.5 M9 7.5h6"></path></svg></span><span style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600">Northwind’s Library<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Explanations Northwind saved from Ask VCFO<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;color:var(--muted)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></a><a href="#" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--panel);border:1px solid var(--border);color:var(--fg)"><span style="width:28px;height:28px;border-radius:6px;background:var(--raised);color:var(--fg);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4.5 15h15v3.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5Z"></path><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2"></path></svg></span><span style="flex:1;min-width:0;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600">Monthly status brief<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">PDF · October 2026<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></span></a></div></sc-if><sc-if value="{{isThink}}" hint-placeholder-val="{{false}}"><div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:flex-end"><p style="margin:0;max-width:82%;border-radius:12px 12px 4px 12px;background:light-dark(oklch(93% 0.012 255), oklch(23.5% 0.01 255));padding:9px 12px;font-size:13.5px">Where is my incorporation now?</p></div><div style="display:flex;gap:8px;align-items:flex-start"><span class="" style="width:28px;height:28px;flex:none;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center"><dc-import name="v7c_bot" state="thinking" size="22" hint-size="22px,22px"></dc-import></span><div style="flex:1;min-width:0"><span style="display:inline-flex;gap:4px;align-items:center;padding:10px 12px;border-radius:12px 12px 12px 4px;background:var(--panel);border:1px solid var(--border)"><span class="dot1" style="width:6px;height:6px;border-radius:99px;background:var(--primary-fill,var(--primary))"></span><span class="dot2" style="width:6px;height:6px;border-radius:99px;background:var(--primary-fill,var(--primary))"></span><span class="dot3" style="width:6px;height:6px;border-radius:99px;background:var(--primary-fill,var(--primary))"></span></span><p aria-live="polite" style="margin:0;position:absolute;width:1px;height:1px;overflow:hidden">Finding sources…</p><ol style="list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px"><li style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ok-text)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M7 12.5l3 3 7-7"></path></svg>Checking Northwind’s project…</li><li style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--fg)"><span class="dot1" style="width:12px;height:12px;display:inline-block;border-radius:99px;border:2px solid var(--primary);border-right-color:transparent"></span>Finding sources…</li><li style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--subtle)"><span style="width:12px;height:12px;display:inline-block;border-radius:99px;border:1.5px dashed var(--border)"></span>Writing…</li></ol></div></div></div></sc-if><sc-if value="{{isAns}}" hint-placeholder-val="{{false}}"><div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:flex-end"><p style="margin:0;max-width:82%;border-radius:12px 12px 4px 12px;background:light-dark(oklch(93% 0.012 255), oklch(23.5% 0.01 255));padding:9px 12px;font-size:13.5px">Where is my incorporation now?</p></div><div style="display:flex;gap:8px;align-items:flex-start"><span class="react" style="width:28px;height:28px;flex:none;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center"><dc-import name="v7c_bot" state="answered" size="22" hint-size="22px,22px"></dc-import></span><div style="flex:1;min-width:0"><article style="border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:12px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:6px"><span style="display:inline-flex;align-items:center;gap:4px;border-radius:4px;background:var(--ok-light);color:var(--ok-text);padding:2px 8px;font-size:11px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"></path><path d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M8.6 12.2l2.3 2.3 4.6-4.8"></path></svg>Reviewed by SBC</span></div><p style="margin:0;font-size:14px;line-height:1.5">7 of 38 steps are complete. You're in SPICe+ Part B, on Registered Office Address.<sup style="font-size:10px;color:var(--primary);font-weight:700;margin-left:2px">1</sup></p><ol aria-label="Incorporation phases" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px"><li class="tipw" role="button" tabindex="0" aria-label="SPICe+ Part A · 5 of 5 done" onClick="{{dd0}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px solid var(--border);background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250))"><span class="tt " role="tooltip">SPICe+ Part A · 5 of 5 done</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="display:inline-flex;align-items:center;gap:4px;color:var(--ok-text)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d=""></path><path d="M7 12.5l3 3 7-7"></path></svg>Done</span></span><span style="font-size:12.5px;font-weight:600">SPICe+ Part A</span><span style="font-size:11.5px;color:var(--muted)">5 of 5</span></li><li class="tipw" role="button" tabindex="0" aria-label="SPICe+ Part B · 2 of 9 done" onClick="{{dd1}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px solid var(--primary);background:var(--primary-light)"><span class="tt " role="tooltip">SPICe+ Part B · 2 of 9 done</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="color:var(--primary)">Northwind is here</span></span><span style="font-size:12.5px;font-weight:600">SPICe+ Part B</span><span style="font-size:11.5px;color:var(--muted)">2 of 9</span></li><li class="tipw" role="button" tabindex="0" aria-label="Post-incorporation · 0 of 11" onClick="{{dd2}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px dashed var(--border);background:var(--panel)"><span class="tt " role="tooltip">Post-incorporation · 0 of 11</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="color:var(--muted)">Next</span></span><span style="font-size:12.5px;font-weight:600">Post-incorporation</span><span style="font-size:11.5px;color:var(--muted)">0 of 11</span></li><li class="tipw" role="button" tabindex="0" aria-label="Registration · 0 of 13" onClick="{{dd3}}" style="position:relative;display:flex;flex-direction:column;gap:2px;border-radius:8px;padding:8px 10px;border:1px dashed var(--border);background:var(--panel)"><span class="tt " role="tooltip">Registration · 0 of 13</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase"><span style="color:var(--muted)">Next</span></span><span style="font-size:12.5px;font-weight:600">Registration</span><span style="font-size:11.5px;color:var(--muted)">0 of 13</span></li></ol><div style="border-left:2px solid var(--gold);padding-left:10px"><div style="font-size:12px;font-weight:700">Why it matters to Northwind</div><div style="font-size:12.5px;color:var(--muted)">Each phase unlocks the next, so this is the step that moves Northwind forward.</div></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--primary);border:1px solid oklch(54.6% 0.215 263 / .5);font:600 12.5px Manrope,sans-serif;cursor:pointer;">Open Incorporation<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg></button><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--fg);border:1px solid var(--border);font:600 12.5px Manrope,sans-serif;cursor:pointer;">Open Registered Office Address<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"></path></svg></button></div><div style="display:flex;align-items:center;gap:6px;border-top:1px solid var(--hair);padding-top:8px"><span class="lbl" style="font-size:10px">Sources</span><a href="#" style="display:inline-flex;align-items:center;gap:4px;border-radius:4px;background:var(--raised);padding:2px 6px;font-size:11px;font-weight:600;color:var(--fg)"><span style="color:var(--primary)">1</span>Northwind’s project</a></div></article><div style="display:flex;align-items:center;gap:6px;margin-top:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--fg);border:1px solid var(--border);font:600 12.5px Manrope,sans-serif;cursor:pointer;min-height:30px;font-size:12px">Ask my lead</button><span style="margin-left:auto;font-size:11.5px;color:var(--muted)">Helpful?</span><button type="button" aria-label="Helpful" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H4V10Zm0 0 4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.2 21H7"></path></svg></button><button type="button" aria-label="Not helpful" style="width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(180deg)"><path d="M7 10v11H4V10Zm0 0 4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.2 21H7"></path></svg></button></div></div></div></div></sc-if></div><div style="border-top:1px solid var(--border);background:var(--panel);padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px"><form style="display:flex;align-items:center;gap:8px"><label for="ask-composer" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Ask VCFO</label><input id="ask-composer" placeholder="Ask about Northwind’s setup…" style="flex:1;height:38px;border-radius:6px;border:1px solid var(--border);padding:0 12px;font:500 13px Manrope,sans-serif;color:var(--fg);background:var(--panel)"><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><button type="button" aria-label="Send" style="width:38px;height:38px;flex:none;border-radius:6px;border:0;background:var(--primary-fill,var(--primary));color:#fff;display:flex;align-items:center;justify-content:center;opacity:.4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button></form></div></section><img src="vcfo-bin:s/home/assets/vcfo-bot-peek.svg" alt="" aria-hidden="true" style="position:absolute;right:264px;bottom:744px;width:132px;height:107px;pointer-events:none;z-index:7;filter:drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 6px 10px oklch(21% 0.042 264 / .25))"><div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5"><button type="button" aria-label="Close Ask VCFO" aria-expanded="true" aria-controls="ask-panel" style="width:68px;height:68px;border-radius:99px;border:0;background:#0f2a4a;box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span style="display:flex;color:#fff"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></span></button></div></div></div>
<sc-if value="{{ddOpen}}" hint-placeholder-val="{{false}}"><div aria-hidden="true" onClick="{{ddClose}}" style="position:fixed;inset:0;z-index:200;background:oklch(20% 0.05 258 / .45)"></div><div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201"><dc-import name="v7x_drilldown" title="{{ddTitle}}" tabs="{{ddTabs}}" rows="{{ddRows}}" active="{{ddActive}}" onclose="{{ddClose}}" hint-size="600px,480px"></dc-import></div></sc-if></div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"v": "home", "tab": 0}; }
  renderVals() {
    const s = this.state || {};
    const __C = [{"title": "Where Northwind’s incorporation is", "tabs": [["SPICe+ Part A", 5], ["SPICe+ Part B", 9], ["Post-incorporation", 11], ["Registration", 13]], "rows": [["Client Details", "12 Sep", "Completed", "ok", 0], ["Draft Board Resolution", "14 Sep", "Completed", "ok", 0], ["Signed Board Resolution", "18 Sep", "Completed", "ok", 0], ["Name Application", "Part A", "Completed", "ok", 0], ["Name Approval", "24 Sep", "Completed", "ok", 0], ["Capital Structure", "1 Oct", "Completed", "ok", 1], ["Proposed Directors", "6 Oct", "In progress", "prog", 1], ["Subscriber Details", "10 Oct", "In progress", "prog", 1], ["Registered Office Address", "9 Oct", "Waiting", "due", 1], ["KYC Review & DSC", "13 Oct", "Upcoming", "up", 1], ["SPICe+ Confirmation", "16 Oct", "Upcoming", "up", 1], ["SPICe+ Filing", "20 Oct", "Upcoming", "up", 1], ["MCA Remarks", "24 Oct", "Upcoming", "up", 1], ["Certificate of Incorporation", "28 Oct", "Upcoming", "up", 1], ["FC-GPR Filing", "\u2014", "Upcoming", "up", 2], ["Nominee Shareholder (MGT-4/5/6)", "\u2014", "Upcoming", "up", 2], ["Share Certificates (SH-1)", "\u2014", "Upcoming", "up", 2], ["Commencement (INC-20A)", "\u2014", "Upcoming", "up", 2], ["Registered Office (INC-22)", "\u2014", "Upcoming", "up", 2], ["First Board Meeting", "\u2014", "Upcoming", "up", 2], ["Company Letterhead", "\u2014", "Upcoming", "up", 2], ["Bank Account Opening", "\u2014", "Upcoming", "up", 2], ["Name Board", "\u2014", "Upcoming", "up", 2], ["Share Capital Infusion", "\u2014", "Upcoming", "up", 2], ["Auditor Appointment (ADT-1)", "\u2014", "Upcoming", "up", 2], ["GST Registration", "\u2014", "Upcoming", "up", 3], ["LUT Filing", "\u2014", "Upcoming", "up", 3], ["PF Registration", "\u2014", "Upcoming", "up", 3], ["ESI Registration", "\u2014", "Upcoming", "up", 3], ["PT Registration", "\u2014", "Upcoming", "up", 3], ["Shops & Establishment", "\u2014", "Upcoming", "up", 3], ["MSME Registration", "\u2014", "Upcoming", "up", 3], ["IEC Registration", "\u2014", "Upcoming", "up", 3], ["Trade Licence", "\u2014", "Upcoming", "up", 3], ["LEI Registration", "\u2014", "Upcoming", "up", 3], ["Trademark Registration", "\u2014", "Upcoming", "up", 3], ["FCGPR Filing", "\u2014", "Upcoming", "up", 3], ["FLA Return", "\u2014", "Upcoming", "up", 3]]}]; const __O = [[0, 0], [0, 1], [0, 2], [0, 3]]; const __k = (s && s.dd != null) ? s.dd : -1; const __c = __k >= 0 ? __C[__O[__k][0]] : null;const __d = { ddOpen: __k >= 0, ddTitle: __c ? __c.title : '', ddTabs: __c ? JSON.stringify(__c.tabs) : '[]', ddRows: __c ? JSON.stringify(__c.rows) : '[]', ddActive: __k >= 0 ? String(__O[__k][1]) : '0', ddClose: () => this.setState({ dd: -1 }) };__O.forEach((o, i) => { __d['dd' + i] = () => this.setState({ dd: i }); });
    const __o = (() => { return { isHome: s.v === 'home', isThink: s.v === 'thinking', isAns: s.v === 'answer', thumb: 'transform:translateX(' + (s.tab * 100) + '%)', c0: s.tab === 0 ? 'on' : '', c1: s.tab === 1 ? 'on' : '', g0: s.tab === 0, g1: s.tab === 1, t0: () => this.setState({ tab: 0 }), t1: () => this.setState({ tab: 1 }), askWhere: () => { this.setState({ v: 'thinking' }); setTimeout(() => this.setState({ v: 'answer' }), 1600); }, home: () => this.setState({ v: 'home' }) }; })();
    return Object.assign(__o, __d);
  }
}
</script>
```

## v7chat_handoff.dc.html

Board-specific CSS:
```css
<style>
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
</style>
<style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
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
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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
</style>
```

Markup:
```html
<div style="width:1440px;height:900px;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="position:relative;width:1440px;height:900px;overflow:hidden;background:var(--bg)"><div style="position:absolute;left:0;top:0;width:1440px;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_before" hint-size="1440px,900px"></dc-import></div><div style="position:absolute;inset:0;z-index:6"><section id="ask-panel" aria-label="Ask VCFO" style="position:absolute;right:24px;bottom:104px;width:400px;height:640px;display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:var(--bg);border:1px solid var(--border);box-shadow:0 2px 4px oklch(32% 0.04 264 / .06),0 18px 48px -12px oklch(21% 0.042 264 / .35);animation:v7up .3s cubic-bezier(.22,1,.36,1) both"><div style="display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:#0f2a4a;color:#fff"><button type="button" aria-label="Back to home" onClick="{{home}}" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(180deg)"><path class="duo" d=""></path><path d="M9 6l6 6-6 6"></path></svg></button><span style="width:36px;height:36px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));display:flex;align-items:center;justify-content:center;flex:none"><dc-import name="v7c_bot" state="cannot" size="30" hint-size="30px,30px"></dc-import></span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">Ask VCFO</div><div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:oklch(100% 0 0 / .72)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(72% 0.15 160)"></span>Answers from verified sources</div></div><button type="button" aria-label="Expand to side panel" title="Expand" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"></path></svg></button><button type="button" aria-label="Close Ask VCFO" style="width:32px;height:32px;border-radius:6px;border:0;background:oklch(100% 0 0 / .1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:flex-end"><p style="margin:0;max-width:82%;border-radius:12px 12px 4px 12px;background:light-dark(oklch(93% 0.012 255), oklch(23.5% 0.01 255));padding:9px 12px;font-size:13.5px">Can our registered office be a co-working space?</p></div><div style="display:flex;gap:8px;align-items:flex-start"><span class="" style="width:28px;height:28px;flex:none;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center"><dc-import name="v7c_bot" state="cannot" size="22" hint-size="22px,22px"></dc-import></span><div style="flex:1;min-width:0"><article style="border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:12px;display:flex;flex-direction:column;gap:8px"><span style="align-self:flex-start;display:inline-flex;align-items:center;gap:4px;border-radius:4px;background:var(--raised);color:var(--muted);padding:2px 8px;font-size:11px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M11 4c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5C8.8 10 10.5 8.3 11 4Z"></path><path d="M11 4c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5C8.8 10 10.5 8.3 11 4Z M18 15.5c.2 1.5.9 2.2 2.5 2.5-1.6.3-2.3 1-2.5 2.5-.2-1.5-.9-2.2-2.5-2.5 1.6-.3 2.3-1 2.5-2.5Z"></path></svg>AI answer · check with Northwind’s lead</span><p style="margin:0;font-size:14px;line-height:1.5">I’m not certain about this one. Northwind’s project lead can answer it.</p></article><div style="margin-top:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--panel);color:var(--fg);border:1px solid var(--border);font:600 12.5px Manrope,sans-serif;cursor:pointer;min-height:30px;font-size:12px;background:var(--primary-light);border-color:oklch(54.6% 0.215 263 / .35);color:var(--primary)">Ask my lead</button></div></div></div><sc-if value="{{notSent}}" hint-placeholder-val="{{true}}"><form style="border-radius:10px;background:var(--panel);border:1px solid var(--border);border-top:3px solid var(--primary);padding:12px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:10px"><span style="width:36px;height:36px;border-radius:99px;background:var(--raised);box-shadow:0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted)" title="Photo placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8Z"></path><path d="M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8Z M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"></path></svg></span><div style="flex:1"><div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:4px">Arjun Mehta<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Project Lead · replies by email<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><div class="cap">Project Lead</div></div></div><div style="display:flex;align-items:center;gap:4px"><label for="ask-handoff" style="font-size:12.5px;font-weight:700">Ask Northwind’s project lead</label><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">The last 4 messages go with it, so they have the context.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div><textarea id="ask-handoff" rows="3" style="resize:none;border-radius:6px;border:1px solid var(--border);padding:8px 10px;font:500 13px Manrope,sans-serif;color:var(--fg)">Can our registered office be a co-working space?</textarea><div style="display:flex;justify-content:flex-end;gap:6px"><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:transparent;color:var(--muted);border:1px solid transparent;font:600 12.5px Manrope,sans-serif;cursor:pointer;">Cancel</button><button type="button" style="display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:6px;background:var(--primary-fill,var(--primary));color:#fff;border:1px solid var(--primary);font:600 12.5px Manrope,sans-serif;cursor:pointer;" onClick="{{send}}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M4 12 20 4l-4 16-4-6Z"></path><path d="M4 12 20 4l-4 16-4-6Z M12 14l8-10"></path></svg>Send to lead</button></div></form></sc-if><sc-if value="{{sent}}" hint-placeholder-val="{{false}}"><div role="status" style="display:flex;align-items:center;gap:8px;border-radius:10px;background:var(--ok-light);color:var(--ok-text);padding:10px 12px;font-size:12.5px;font-weight:600"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;"><path class="duo" d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z"></path><path d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M8.6 12.2l2.3 2.3 4.6-4.8"></path></svg><span style="flex:1">Sent to Northwind’s project lead. They’ll reply by email.</span><button type="button" style="border:0;background:none;color:inherit;text-decoration:underline;font:inherit">Close</button></div></sc-if></div><div style="border-top:1px solid var(--border);background:var(--panel);padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px"><form style="display:flex;align-items:center;gap:8px"><label for="ask-composer" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Ask VCFO</label><input id="ask-composer" placeholder="Ask about Northwind’s setup…" style="flex:1;height:38px;border-radius:6px;border:1px solid var(--border);padding:0 12px;font:500 13px Manrope,sans-serif;color:var(--fg);background:var(--panel)"><span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions.<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span><button type="button" aria-label="Send" style="width:38px;height:38px;flex:none;border-radius:6px;border:0;background:var(--primary-fill,var(--primary));color:#fff;display:flex;align-items:center;justify-content:center;opacity:.4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button></form></div></section><img src="vcfo-bin:s/home/assets/vcfo-bot-peek.svg" alt="" aria-hidden="true" style="position:absolute;right:264px;bottom:744px;width:132px;height:107px;pointer-events:none;z-index:7;filter:drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff) drop-shadow(0 6px 10px oklch(21% 0.042 264 / .25))"><div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5"><button type="button" aria-label="Close Ask VCFO" aria-expanded="true" aria-controls="ask-panel" style="width:68px;height:68px;border-radius:99px;border:0;background:#0f2a4a;box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span style="display:flex;color:#fff"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></span></button></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {"sent": false}; }
  renderVals() {
    const s = this.state || {};
    return { home: () => {}, notSent: !s.sent, sent: !!s.sent, send: () => this.setState({ sent: true }) };
  }
}
</script>
```

## v7chat_launcher.dc.html

Board-specific CSS:
```css
<style>
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
</style>
<style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
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
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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
</style>
```

Markup:
```html
<div style="width:1440px;height:900px;font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="position:relative;width:1440px;height:900px;overflow:hidden;background:var(--bg)"><div style="position:absolute;left:0;top:0;width:1440px;pointer-events:none;z-index:0" aria-hidden="true"><dc-import name="v7_before" hint-size="1440px,900px"></dc-import></div><div style="position:absolute;inset:0;z-index:6"><div class="botup" style="position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5"><div role="status" style="position:absolute;right:0;bottom:116px;width:300px;border-radius:10px;background:var(--panel);border:1px solid var(--border);box-shadow:0 12px 32px -12px oklch(21% 0.042 264 / .3);padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;animation:v7up .35s cubic-bezier(.22,1,.36,1) .9s both"><div style="display:flex;gap:8px;align-items:flex-start"><span style="flex:1;font-size:13px;line-height:1.45">Hello. Ask me anything about Northwind’s setup, or pick a question below.</span><button type="button" aria-label="Dismiss" style="width:24px;height:24px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;border-radius:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" style="min-height:30px;padding:0 10px;border-radius:6px;border:1px solid oklch(54.6% 0.215 263 / .35);background:var(--primary-light);color:var(--primary);font:600 12px Manrope,sans-serif">What is my next step?</button><button type="button" style="min-height:30px;padding:0 10px;border-radius:6px;border:1px solid oklch(54.6% 0.215 263 / .35);background:var(--primary-light);color:var(--primary);font:600 12px Manrope,sans-serif">Where is my incorporation now?</button></div></div><span style="background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px;position:relative">Ask VCFO<span style="position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)"></span></span><button type="button" aria-label="Open Ask VCFO" aria-expanded="false" aria-controls="ask-panel" style="width:68px;height:68px;border-radius:99px;border:0;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / 0.45),0 0 0 1px var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer"><span class="bob" style="display:flex"><dc-import name="v7c_bot" state="idle" size="50" hint-size="50px,50px"></dc-import></span></button></div></div></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = {}; }
  renderVals() {
    const s = this.state || {};
    return {};
  }
}
</script>
```

## v7x_info_popover.dc.html

Board-specific CSS:
```css
<style>
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
</style>
<style>
/* v7.1 - matches src/views/admin/ProjectsSections.tsx proj-view-pill + src/lib/motion.ts springSnappy (420/32/0.8) */
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
.card:hover{border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 2px 4px oklch(32% 0.04 264 / .05),0 8px 22px -6px oklch(37.9% 0.146 266 / .1),0 16px 40px -12px oklch(37.9% 0.146 266 / .08)}
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
.stag>*{animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards}
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
</style>
```

Markup:
```html
<div style="font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px">
<div style="width:1340px;box-sizing:border-box;padding:20px;display:flex;flex-direction:column;gap:20px;background:var(--bg)"><div style="display:flex;gap:16px"><div style="display:flex;flex-direction:column;gap:10px;width:300px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Closed</div><div style="position:relative;height:190px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:16px"><div style="display:flex;align-items:center;gap:4px" class="rt">Utility bill for the office<span class="info "><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Electricity or water · Max 2 months old · Asked by Arjun Mehta<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><div class="cap">Title + (i). No grey line under it.</div></div><div style="display:flex;flex-direction:column;gap:10px;width:300px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Hover</div><div style="position:relative;height:190px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:16px"><div style="display:flex;align-items:center;gap:4px" class="rt">Utility bill for the office<span class="info "><button type="button" style="color:var(--navy-ink,var(--navy))" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Electricity or water · Max 2 months old · Asked by Arjun Mehta<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><div class="cap">Icon turns navy. Nothing opens on hover.</div></div><div style="display:flex;flex-direction:column;gap:10px;width:300px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Open</div><div style="position:relative;height:190px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:16px"><div style="display:flex;align-items:center;gap:4px" class="rt">Utility bill for the office<span class="info open"><button type="button" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Electricity or water · Max 2 months old · Asked by Arjun Mehta<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><div class="cap">Click opens the pop-over, attached to the icon.</div></div><div style="display:flex;flex-direction:column;gap:10px;width:300px"><div class="lbl" style="color:var(--navy-ink,var(--navy))">Keyboard focus</div><div style="position:relative;height:190px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:16px"><div style="display:flex;align-items:center;gap:4px" class="rt">Utility bill for the office<span class="info open"><button type="button" style="color:var(--navy-ink,var(--navy));outline:2px solid oklch(54.6% 0.215 263 / .4);outline-offset:2px" aria-label="More information"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg></button><span class="pop" role="tooltip">Electricity or water · Max 2 months old · Asked by Arjun Mehta<a class="ask" href="#"><dc-import name="v7c_bot" state="idle" size="16" hint-size="16px,16px"></dc-import>Ask VCFO about this</a></span></span></div></div><div class="cap">Focus ring on the icon; Enter opens, Esc closes.</div></div></div><ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.7;color:var(--fg)"><li>Trigger: 15 px (i) icon, 18 px hit area inside a 44 px touch target on mobile; muted grey, navy on hover / focus / open.</li><li>Pop-over: attached under the icon with a 10 px arrow; 200–280 px wide; 8 px corners; 1 px border; soft shadow.</li><li>Content: 1–3 short lines, then the meta (for example "Electricity or water · Max 2 months old · Asked by Arjun Mehta").</li><li>Bottom row: 16 px bot avatar + "Ask VCFO about this". Opens the chat with the row's title as the question.</li><li>Opens on click or Enter / Space; closes on outside click, Esc, or Tab out. Only one open at a time. Build: Radix Popover, role="dialog" when it holds the link.</li><li>Reduced motion: no fade or slide.</li></ul></div>
</div>
```

Render logic:
```js
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1340,"height":420}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
```
