# Client portal v7 — build inventory

Every screen, state, modal, drawer, button, hover, animation, empty state,
before/after-incorporation variant and breakpoint of
`prototype/vcfo-client-portal-FINAL.html`, mapped to the real app.

- **Visual truth:** FINAL (readable sources in `prototype/final-src/`, extracted from the bundle).
  Where FINAL differs from `prototype/src/` (v7), FINAL wins.
- **How to build:** `BUILD-GUIDE.md`. **Owner decisions/assumptions:** `QUESTIONS.md` (repo root).
- **Full per-area catalogues** (verbatim CSS, markup and logic for every board): `inventory/<area>.md`.
- **Status column:** ☐ not built · ☑ built and wired to real data · ◐ built, part of it waits on an
  owner decision (see QUESTIONS.md) · ✗ deliberately not built (reason in QUESTIONS.md).
  Nothing is "verified" — the owner does all testing (owner rule, 2026-10-16).
- **NEW** in a row = a backend or front-end piece that did not exist before this build.

## Route map

| Prototype route key | App route | Page component | Main data source |
|---|---|---|---|
| home / home-after / home-chat | `/app/client/overview` | `client-portal/pages/home` | `/api/client/overview` + `/api/client/home` (NEW) |
| incorporation | `/app/client/incorporation` | `client-portal/pages/incorporation` | `useApp()` checklist state + `/api/client/incorporation` (NEW) |
| inc-phase (#p=1–4) | `/app/client/incorporation/phase/[n]` (NEW route) | `client-portal/pages/incorporation` | same |
| inc-step-1 … 48 | `/app/client/incorporation/step/[stepId]` | `client-portal/pages/incorporation` (step page, live layout) | `useApp()` + existing step APIs |
| board-resolution | `/app/client/board-resolution` | `client-portal/pages/incorporation` (board page) | existing board-resolution API |
| compliances (#cal-redesign / #cal-mobile) | `/app/client/compliances/calendar` | `client-portal/pages/compliances` | `/api/filings` + NEW proof / portal pieces |
| filings (#fil-redesign) | `/app/client/compliances/filings` | `client-portal/pages/compliances` | `/api/filings` |
| documents | `/app/client/documents` | `client-portal/pages/documents` | `/api/client/documents` (NEW aggregate) |
| knowledge-bank | `/app/client/library` | `client-portal/pages/documents` (shelf) | `/api/ask/library` + topics |
| kb-reader | `/app/client/library/[id]`, `/app/client/learn/[slug]` | `client-portal/pages/documents` (reader) | `/api/ask/library/[id]`, `/api/ask/topics/[slug]` |
| doc-viewer | overlay on any page | `client-portal/pages/documents/DocViewer` | signed URLs from `/api/documents` |
| team | `/app/client/team` | `client-portal/pages/team` | engagement-clients + invites |
| announcements | `/app/client/announcements` | `client-portal/pages/team` | `/api/announcements` + `announcement_reads` (NEW) |
| notifications | `/app/client/notifications` | `client-portal/pages/team` | `/api/notifications` |
| audit | `/app/client/audit` | `client-portal/pages/team` | `/api/audit-logs` |
| settings | `/app/client/settings` | `client-portal/pages/team` | `/api/account/*` + notification prefs (NEW) |
| credentials | `/app/client/credentials` (NEW route) | `client-portal/pages/credentials` | NEW credentials vault + OTP to manager |
| ids-password | overlay on Home / Credentials | `client-portal/pages/credentials` | NEW |
| intro | first visit after sign-in | `client-portal/PortalIntro` | `client_portal_prefs.intro_seen_at` (NEW) |

<!-- area:home -->
## Home (before / after COI, phone, chat boards, pop-ups, timeline editor, Credentials, PAN/TAN reveal)

Full catalogue: `inventory/home.md`.

### 2. Route keys used by Home and their real targets

| Done | route key (`data-go` / `vcfoGo`) | prototype file | real Next.js route (app/app/client/**) | notes |
|---|---|---|---|---|
| ☑ | `home` | v7_before (≥700) / mobile.html | `/app/client/overview` (`/app/client` redirects here) | same URL before and after COI; layout chosen by `overview.incorporated` |
| ☑ | `home-after` | v7_after / mobile.html#after | `/app/client/overview` | hidden route key, prototype only |
| ☑ | `home-chat` | v7_before#chat / mobile.html#chat | `/app/client/overview` + open Ask panel | real: `AskProvider` / `AskLauncher` open state (`src/components/ask/*`) |
| ☑ | `incorporation` | s/inc/incorporation.html | `/app/client/incorporation` | |
| ☑ | `inc-phase-a` / `inc-phase` / `inc-phase-3` / `inc-phase-4` | s/inc/phase.html#p=1..4 | `/app/client/incorporation?phase=pre-inc-phase-1` … (or a phase sub-route; incorporation agent decides) | Phase 1 Name Application, 2 Incorporation, 3 Post-Incorporation, 4 Registration |
| ☑ | `inc-step-N` (N = 1…48) | s/inc/step.html#n=N | `/app/client/incorporation/step/...` (folder `app/app/client/incorporation/step` exists) or `clientStepHref(stepId)` = `/app/client/incorporation?step=<id>` (src/lib/client-overview.ts) | N → checklist id table in 5.10 |
| ☑ | `compliances` | s/comp/index.html#cal-redesign | `/app/client/compliances/calendar` (folder exists) | |
| ☑ | `filings` | s/comp/index.html#fil-redesign | `/app/client/compliances/filings` | |
| ☑ | `documents` | s/docs/docs_a_refined | `/app/client/documents` | |
| ☑ | `knowledge-bank` | s/docs/lib_shelf_a | `/app/client/library` | sidebar label "Library" |
| ☑ | `doc-viewer` | s/home/v7x_doc_viewer | NOT a page in the real app: an overlay/preview component opened in place (rule 9 "click a row → preview overlay"); fetch via `GET /api/documents/[id]/signed-url` or `GET /api/milestone-documents/signed-url` | prototype models it as a route only because it is a separate file |
| ☑ | `ids-password` | s/home/v7p_ids_password | NOT a page: modal over Home | |
| ☑ | `credentials` | s/home/v7p_credentials | NEW page `/app/client/credentials` (no folder yet) | sidebar item "Credentials" (icon key-round) sits between Library and Team in `shell.js` NAV |
| ☑ | `team` / `audit` / `settings` / `announcements` / `notifications` | s/team/* | `/app/client/team`, `/audit`, `/settings`, `/announcements`, `/notifications` | |

---

### 3. Shared components and global behaviours

#### 3.1 Inventory

| Done | id | item | exact behaviour / content | file |
|---|---|---|---|---|
| ☑ | G-01 | Design tokens | Light tokens on `:root` (Appendix A). Dark ("True black") tokens injected by proto.js into `html[data-theme="dark"]` (bg #000, panel oklch(13% .006 260), navy→oklch(46% .15 258), `--navy-ink`, `--navy-deep`, `--primary-fill`…). Theme stored in `localStorage vcfo.theme` = light/dark/system. Any button whose aria-label contains "theme" toggles; label flips "Switch to dark theme"/"Switch to light theme", `aria-pressed`. | proto.js lines 6–56 |
| ☑ | G-02 | Card | `section.card`: white panel, 1px `--border`, radius 10px, `--shadow`, flex column. Entry animation `up .5s cubic-bezier(.2,.7,.2,1) backwards` (opacity 0, translateY 10px → 0). Hover (v7.1 override): `translateY(-2px)`, border `oklch(54.6% .215 263 / .35)`, layered shadow; transition `.16s cubic-bezier(.22,1,.36,1)`. Phone (≤767): no hover lift. Header row: `display:flex;align-items:center;gap:8px;padding:14px 16px 0`, title `h3` `font:700 13px Manrope;color:var(--navy-ink,var(--navy))`, right group `margin-left:auto;display:flex;gap:6px`. Headers wrap (`row-gap:8px`). | Appendix A + every v7c |
| ☑ | G-03 | Sliding pill (`.seg`) | Track: `padding:2px;border-radius:8px;background:light-dark(oklch(96.5% .008 250),oklch(18.3% .008 250));box-shadow:inset 0 0 0 1px var(--border)`; `display:inline-grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)`. Thumb `.thumb`: absolute, `top/bottom/left:2px`, radius 5px, navy (`--navy-3` in dark), width `calc((100% - 4px)/N)`, `transform:translateX(i*100%)`, transition `.42s` spring `linear(0,0.0637,…,1.0004)` (= springSnappy 420/32/0.8). Buttons: height 28px, padding 0 10px, `font:500 12px Manrope`, color oklch(55% .022 255); active `.on` white, weight 500; counts `.cnt` `600 11px IBM Plex Mono`, active count white 72%. Phone ≤767 with `.vh-segwrap`: becomes flex-wrap, thumb hidden, active button gets navy background. All card buttons ≥40px tall on phone. | Appendix A |
| ☑ | G-04 | Info (i) pop-over | `span.info > button[aria-label="More information"]` (18×18, 15 px circle-i icon, colour oklch(62% .02 255), navy on hover/focus/open) + `span.pop[role=tooltip]`: below the icon (`top:calc(100% + 8px)`, centred), 200–280px (`max-width:min(280px,100vw-24px)`), radius 8, 1px border, shadow `0 12px 32px -12px`, 12px/1.45 text, 10px arrow (`::before` rotated square). Opens on click/tap (class `.open`) or keyboard focus (`:focus-within`), fade `.15s`; only one open at a time; outside click closes; kept inside viewport by the fit script (B-08). Last row `a.ask`: 16px bot avatar + "Ask VCFO about this" (border-top hair, primary colour, bold) → opens chat with question "Tell me about <closest heading/strong text>" (proto.js `chatQuestion`). Touch: 11px invisible hit-area expansion (`pointer:coarse`). Spec board: v7x_info_popover (section 10). Build: Radix Popover. | Appendix A, v7x_info_popover |
| ☑ | G-05 | Hover tooltip (`.tipw` + `.tt`) | Navy bubble `font:700 12px/1.3`, padding 5px 9px, radius 6, white text, arrow 8px; above the element (`bottom:calc(100% + 8px)`), `.tt.l` = left side, `.tt.w` = white bubble with navy text (used on the greeting ring). Shows on `:hover`/`:focus-visible` after display, fade `.12s`. Every chart part is a `.tipw role=button tabindex=0 aria-label=<same text>` that opens the drill-down on click/Enter (rule 14). | Appendix A |
| ☑ | G-06 | Drill-down pop-up | `v7x_drilldown` (section 10.2): 600px (`min(600px,100vw-24px)`), max-height 560px, radius 12, dimmed backdrop `oklch(20% .05 258 / .45)` (fixed, z 200; dialog z 201, centred). Top strip "These items live in {Page}" + "Open {Page} →" (`data-go`), title + × (30px), navy sliding pill of tabs (clicked part pre-selected), list rows `ddrow` (grid `minmax(0,1fr) 62px 116px 16px`: name · mono date · status chip full-width · → arrow), empty "Nothing here.", footer "Showing n of m" / "Showing all n" + "Open full list". ≤640px: pill wraps, date column hidden. Closes on backdrop, ×, Esc. Page link chosen by title regex: /filings/→Filings, /alert/→Notifications, /document/→Documents, /team|who/→Team, /compliance|deadline/→Compliances, else Incorporation. | v7x_drilldown |
| ☑ | G-07 | Chips | `.chip`: `inline-flex;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px`. Solid status chip = `background:var(--<k>-chip);color:#fff` where k ∈ ok (Completed/Filed/Registered), due (Waiting/Due soon), over (Overdue), prog (In progress/With SBC), up (Upcoming/Not started). Owner chip (light) = `background:var(--due-light);color:var(--due-text)` "Northwind" / `background:var(--prog-light);color:var(--prog-text)` "SBC". Status chips in step lists `min-width:116px;justify-content:center`; owner chips `min-width:88px`. | Appendix A, cards |
| ☑ | G-08 | Buttons | `.btn` 36px, padding 0 14px, radius 6, `600 13px Manrope`; `.btn-p` primary blue (`--primary-fill`), inset highlight; `.btn-o` white outline. Card-row buttons are compact: `height:30px;padding:0 10px;font-size:12px`. `:active` scale .98 (.12s). Phone: ≥40px. | Appendix A |
| ☑ | G-09 | Bot avatar (`v7c_bot`) | Props `state` ∈ idle/thinking/answered/cannot, `size` (default 56). SVG head (blue gradient #4C8DF8→#1D4ED8 body, #0B1736 visor, #7DD3FC eyes + smile, antenna). Moods ONLY via antenna colour/motion: idle teal #2DD4BF, thinking #7DD3FC pulsing (`vbAnt 1s`) + eyes scan (`vbScan 1.3s` ±9px), answered green #34D399, cannot grey #94A3B8. Smile never changes (owner decision). Used at 16px (info rows), 28px (empty states / chat avatars), 50px. Unique gradient/filter ids per instance. | v7c_bot |
| ☑ | G-10 | Global Ask VCFO launcher | `#vp-launch` fixed bottom-right (`right:var(--vpl-in)` = clamp(14px,1.25vw+8px,24px)): animated character gripping the bottom edge (`--vpl-w` clamp(96px,4.5vw+72px,148px), SVG 340×216, 20.5 s loop: rise/look/blink/grip keyframes) + navy pill "● Ask VCFO" (36px tall, 40px on phone; teal dot #2DD4BF with 3px glow). Pill hover #17396b, active scale .97. Character ducks (`translateY(100%)`, .32s ease-in) while scrolling (650 ms debounce), while the chat is open, while a sheet is open, or when it would cover a control (hit-test grid); rises with `.5s cubic-bezier(.34,1.45,.5,1)`. Pill toggles the chat; when open the pill reads "× Close". Board-local launchers (`[aria-label="Open Ask VCFO"]`) are hidden at runtime. | proto.js |
| ☑ | G-11 | Global chat window | `#vp-chat` (section 7.1). | proto.js |
| ☑ | G-12 | Toast | `#vp-toast` navy, bottom-centre 64px above bottom (100px on phone), max-width min(560px,100vw-32px), `600 13px`, optional gold "Undo" button; in: opacity + translateY 12→0 (.18s/.22s); auto-hide 3200 ms; "Undone" toast after Undo. | proto.js |
| ☑ | G-13 | Icon-only tooltip (rule 17) | Any icon-only `a/button` with `aria-label` (text ≤2 chars, no `data-tip`, not "obvious") shows a navy fixed tooltip 120 ms after hover, placed above (or below if no room). Obvious labels (Close, Search, Notifications…, WhatsApp/Call/Email/Teams…) get no tooltip. Hidden on pointerdown/scroll. | proto.js |
| ☑ | G-14 | `data-go` | Any element with `data-go="<route>"` navigates (with the 140 ms leave fade). Controls nested inside a `data-go` tile (buttons, links, `.info`) handle their own click and do NOT trigger the tile. "You are already on X" toast when re-clicking the current route. | proto.js |
| ☑ | G-15 | Fallback toasts (prototype only) | Any click that changes nothing within 380 ms shows a toast from its label: /download/→"Download started · …", /zip/→"Preparing the ZIP…", /upload|choose file|take photo/→"Choose a file to upload", /copy/→"Link copied", /whatsapp|call|email|teams/→"Opening …", /portal|↗/→"Opens the official portal in a new tab", /approve|submit|send|save|mark|confirm|request|remind|resend|cancel invite|hand off|turn on|turn off/→"<label> · done" + Undo, /search/→"Search · type to find steps, filings and documents", else the label itself. **These mark controls the board did not wire; the real behaviour is given per control below.** | proto.js |
| ☑ | G-16 | Stagger | Home columns are `.stag` wrappers; each child has an inline `animation-delay` (0.04 s, 0.10, 0.16 … +0.06 per card) and `animation:v7fade .2s cubic-bezier(.22,1,.36,1) backwards` (opacity 0, translateY 6px). | v7_before/after |
| ☑ | G-17 | Current-step pulse | `.pulse{animation:v7pulse 1.8s ease-in-out infinite}`: gold ring `box-shadow 0 0 0 0 → 0 0 0 5px oklch(80% .12 85 / 0)`. | Appendix A |
| ☑ | G-18 | Bar grow | `.bar>span` / `.stack>span` `animation:grow .9s cubic-bezier(.2,.7,.2,1) .2s backwards` (scaleX 0→1 from left). | Appendix A |
| ☑ | G-19 | Reduced motion | `@media (prefers-reduced-motion: reduce)`: all animations/transitions off (cards, pills, stagger, bot bob/react, tooltips, pulse, launcher shows head static and fully visible, chat no peek). | Appendix A, proto.js |
| ☑ | G-20 | Top bar | `header.vh-top` 52px, `gap:var(--vh-hg)` (12px; 6px on phone), `padding:0 var(--vh-hp)` (16px; 10px phone), border-bottom `oklch(91.5% .012 255 / .6)`, background white 90% (sticky via proto.js `pinNav`, z 40). Left→right: menu button (`.vh-menu`, 40×40, hidden ≥768, opens shell drawer `vcfoOpenSide()`), SBC logo link (26px tall; 22px on phone; aria "SBC home"), location trail `nav.vh-crumb` (24px primary-light tile with dashboard icon + "Home"; hidden ≤767), right group gap 6px: Search button 256px wide (`Search` + ⌘ K kbd; collapses to 36px icon ≤1099px), Before/After pill (inserted by shell.js before Announcements, desktop only), Announcements (36px icon → route `announcements`), Notifications (36px, primary-light tinted, badge "3" 15px circle → route `notifications`), Theme (36px outlined; sun icon; toggles theme). Long trails truncate, the right group never moves (v7x_topbar). | v7_before, v7x_topbar |
| ☑ | G-21 | Sidebar | Real sidebar is drawn by `shell.js` over the `.vh-side` placeholder (width `var(--vp-side-w)`: 248px desktop ≥1280, 72px icon rail 768–1279, 0 + drawer on phone). NAV: Home · Updates (badge 3, red; children Announcements, Notifications) · Incorporation (badge "6/14" before COI; none after) · Compliances (children Calendar, Filings) · Documents (badge 6) · Library · Credentials · Team · Audit · Settings. Team block: Priya Raman (Project Manager), Arjun Mehta (Project Lead), Customer support (SBC help desk), each with WhatsApp/Call/Email/Teams hover actions. Account row RK "Rohan Kumar · Northwind · Client" with menu (Account settings, Sign out). Before/After pill: top bar on desktop, inside the rail on tablet (vertical 56×66), top of the drawer on phone. (`v7c_side`/`v7c_side_a` are the static board version: 248×900, active pill slides `translateY(i*38px)`, same spring.) Owned by the shell-ui inventory; listed here because Home imports it. | shell.js, v7c_side(_a) |

#### 3.2 Shared data shapes used by the cards

The drill-down takes `tabs = [[label, count], …]` and `rows = [[name, meta(date), statusLabel, colourKey, tabIndex], …]`; tab 0 = "All" shows every row when its label is "All". Every card that has a chart builds a `__C` array of drill configs and a `__O` array of `[configIndex, activeTab]` openers; `ddN()` opens opener N. Real app: one `<DrillDown title tabs rows activeTab onClose />` component fed from the same data the card renders, rows linking to their real page.

---

### 4. Home BEFORE COI (`v7_before.dc.html`, route `home`)

#### 4.1 Composition

| Done | id | area | card (board) | animation-delay |
|---|---|---|---|---|
| ☑ | HB-01 | `g` | Greeting `v7c_greet_b` | 0.04s |
| ☑ | HB-02 | `a` | Needs from Northwind `v7c_needs_b` | 0.10s |
| ☑ | HB-03 | `a` | Who holds it now `v7c_current` | 0.16s |
| ☑ | HB-04 | `c1` | Important alerts `v7c_alerts_b` | 0.22s |
| ☑ | HB-05 | `c1` | What SBC is doing `v7c_sbc_b` | 0.28s |
| ☑ | HB-06 | `b` | Timeline `v7c_timeline_b` | 0.34s |
| ☑ | HB-07 | `b` | Steps `v7c_steps_b` | 0.40s |
| ☑ | HB-08 | `c2` | Recent documents `v7c_docs_b` | 0.46s |
| ☑ | HB-09 | `c2` | Recent activity `v7c_activity_b` | 0.52s |
| ☑ | HB-10 | floating | Ask VCFO launcher (global, G-10) | rises .45s after .5s |
| ☑ | HB-11 | top | Top bar (G-20) + sidebar (G-21) | — |

Grid areas per breakpoint (section 11 has the CSS): <600px one column `g a c1 b c2`; 600–1179 two columns `g g / a a / c1 c2 / b b`; 1180–1799 `2fr 1fr`: `g g / a c1 / a c2 / b c2`; ≥1800 three columns `g g g / a c1 c2 / b b c2`.

#### 4.2 Hash `#chat` (route `home-chat`)

Same board; proto.js opens the global chat 500 ms after load when the hash contains `chat` (or `localStorage vcfo.openChat` is true, then cleared).

---

### 5. Home AFTER COI (`v7_after.dc.html`, route `home-after`)

#### 5.0 Composition

| Done | id | area | card (board) | animation-delay |
|---|---|---|---|---|
| ☑ | HA-01 | `g` | Greeting `v7c_greet_a` | 0.04s |
| ☑ | HA-02 | `a1` | Needs from Northwind `v7c_needs_a` | 0.10s |
| ☑ | HA-03 | `a1` | What is next `v7c_next` | 0.16s |
| ☑ | HA-04 | `c1` | Important alerts `v7c_alerts_a` | 0.22s |
| ☑ | HA-05 | `c1` | What SBC is doing `v7c_sbc_a` (hint 240px) | 0.28s |
| ☑ | HA-06 | `a2` | Compliance status `v7c_comp` (donut) | 0.34s |
| ☑ | HA-07 | `c2` | Company IDs `v7c_ids` | 0.40s |
| ☑ | HA-08 | `f` | Compliance by area `v7c_area` | 0.46s |
| ☑ | HA-09 | `f` | Registrations `v7c_reg` | 0.52s |
| ☑ | HA-10 | `f` | Post-incorporation setup `v7c_postinc` | 0.58s |
| ☑ | HA-11 | `f` | Timeline `v7c_timeline_a` (completed) | 0.64s |
| ☑ | HA-12 | `f` | Steps `v7c_steps_a` | 0.70s |
| ☑ | HA-13 | `d` | Recent documents `v7c_docs_a` | 0.76s |
| ☑ | HA-14 | `e` | Recent activity `v7c_activity_a` | 0.82s |

Grid areas: <600 one column `g a1 c1 a2 c2 f d e`; 600–1179 two columns `g g / a1 a1 / c1 a2 / c1 c2 / f f / d e` (rows `auto auto auto 1fr`); 1180–1799 six columns `g×6 / a1×4 c1×2 / a1×4 c2×2 / a2×4 c2×2 / f×6 / d×3 e×3` (rows `auto auto 1fr auto`); ≥1800 `g×6 / a1 a1 a2 a2 c1 c1 / a1 a1 c2 c2 c1 c1 / f×6 / d×3 e×3`. Preview height 3240px at 1440.

---

#### 5.1 Greeting card (`v7c_greet_b` before, `v7c_greet_a` after)

Inventory

| Done | id | item | behaviour / content | file |
|---|---|---|---|---|
| ☑ | GR-01 | Card | `section.vh-greet`, radius 10, `padding:12px clamp(14px,2vw,18px) 10px`, background `linear-gradient(115deg, navy 0%, navy-2 60%, navy-3 100%)` (dark: `--navy-deep` set), white text, overflow hidden; 3px gold underline at the bottom `linear-gradient(90deg,var(--gold),oklch(78% .1 85 / 0) 70%)`. | greet_b |
| ☑ | GR-02 | Date | Mono 11px, opacity .65, uppercase: "TUE 6 OCT 2026" / "SUN 8 NOV 2026". | |
| ☑ | GR-03 | Company name | `h1.metric` Space Grotesk 600, `font-size:clamp(19px,calc(15px + .6vw),24px)`, lh 1.15: "Northwind Technologies India Pvt Ltd". | |
| ☑ | GR-04 | Report button | `a.btn` 30px, padding 0 10px, translucent white (bg 12%, border 28%), download icon + "Report" (label hidden <480px, `.vh-hide-xs`; aria-label "Report"). Not wired in board (fallback toast "Report"). Phone version: "Download report" → toast "Preparing Northwind’s progress report (PDF)…" then after 1400 ms "Report downloaded · Northwind-progress-6-Oct.pdf". **Real: GET `/api/ask/brief?engagementId=` (C4 monthly status brief PDF) exists → download.** | greet_b, mobile |
| ☑ | GR-05 | Progress ring | 46×46 conic ring (gold arc on 16% white track), inner 37px navy-2 disc with "43%" (`700 11px Space Grotesk`); label under it "SPICE+" (11px, letter-spacing .1em, .7 opacity). Tooltip (white variant, left side): "Incorporation · 6 of 14 SPICe+ steps". Click/Enter → drill-down "Incorporation steps" tab All (GR-08). After: "64%" ring, label "SETUP", tooltip "Setup · 7 of 11 done", drill "Post-incorporation setup" tab "Open". DECISION: ring = SPICe+ steps only (Phases 1+2) before COI. | |
| ☑ | GR-06 | Divider | 1px white 14%, margin 8px 0 7px. | |
| ☑ | GR-07 | Stat strip | `.vh-stats` flex-wrap; each stat = metric 18px + 11.5px label (opacity .75), separated by 1px white-14% border with 16px padding/margin. BEFORE: **4** (colour oklch(86% .09 60) amber) "Waiting on Northwind" · **1** "With SBC" · **1** (oklch(84% .09 20) red) "Overdue" · **4/6** "Documents in" · **28 Oct** "Expected COI". AFTER: **4** amber "Waiting on Northwind" · **1** red "Overdue" · **3** amber "Due soon" · **5/13** "Registrations" · **24 Oct** "Incorporated". <600px: grid `repeat(auto-fill,minmax(118px,1fr))`, gap 8px 12px, no separators. Stats are static on desktop (not clickable); on phone each stat is a button opening a drill (section 6). | |
| ☑ | GR-08 | Drill (before) | Title "Incorporation steps"; tabs All 14 · Completed 6 · In progress 3 · Waiting for Northwind 1 · Upcoming 4. Rows: Client Details 12 Sep Completed · Draft Board Resolution 14 Sep · Signed Board Resolution 18 Sep · Name Application "Part A" · Name Approval 24 Sep · Capital Structure 1 Oct (all Completed/ok) · Proposed Directors 6 Oct In progress · Subscriber Details 10 Oct In progress · Registered Office Address 9 Oct Waiting (due) · KYC Review & DSC 13 Oct In progress · SPICe+ Confirmation 16 Oct · SPICe+ Filing 20 Oct · MCA Remarks 24 Oct · Certificate of Incorporation 28 Oct (Upcoming). Opened on tab 0. | greet_b |
| ☑ | GR-09 | Drill (after) | "Post-incorporation setup"; tabs All 11 · Open 4 · Completed 7; rows FC-GPR Filing "day 6 of 30 · 2 Dec" Open(due) · Nominee Shareholder (MGT-4/5/6) "day 15 of 30 · 23 Nov" · Share Certificates (SH-1) "day 15 of 60 · 23 Dec" · Commencement (INC-20A) "day 15 of 180 · 22 Apr" (Open/prog) · Registered Office (INC-22) 25 Oct · First Board Meeting 26 Oct · Company Letterhead 27 Oct · Bank Account Opening 29 Oct · Name Board 30 Oct · Share Capital Infusion 2 Nov · Auditor Appointment (ADT-1) 5 Nov (Completed). Opens on tab 1 (Open). | greet_a |

Data → real app

| Done | field | example | source in real app |
|---|---|---|---|
| ☑ | date | TUE 6 OCT 2026 | client clock; `src/hooks/use-client-locale-date.ts` |
| ☑ | company name | Northwind Technologies India Pvt Ltd | `overview.engagement.companyName` (GET `/api/client/overview`, `useClientOverview()` in `src/lib/use-client-overview.ts`, repo `getClientOverview` in `src/db/repositories/client-overview.ts`) |
| ☑ | ring % before | 43% = 6/14 | `overview.progress.byPhase` → sum of phases `pre-inc-phase-1` + `pre-inc-phase-2` (done/total). Existing. |
| ☑ | ring % after | 64% = 7/11 | `overview.progress.byPhase` `post-inc-phase-3`. Existing. |
| ☑ | Waiting on Northwind | 4 | prototype = number of open items in "Needs from Northwind" (2 upload + 1 fill + 1 correct). Real `overview.ballInCourt.waitingOnClient` counts ACTIVE STEPS, not items → **NEW: item-level needs list (see 5.2); count = its length.** |
| ☑ | With SBC | 1 | `overview.ballInCourt.waitingOnFirm` (existing; step-level). |
| ☑ | Overdue | 1 | `overview.progress.byStatus.overdue` (steps) + overdue items; after COI also overdue `compliance_instances` (status `overdue`). Partially existing; needs one combined count (NEW derivation in `src/lib/client-overview.ts`). |
| ☑ | Documents in | 4/6 | NEW: requested-documents fulfilled/total. Closest existing: `overview.documents.counts` (requested/submitted are STEP counts). Needs per-file requests (`document_requests` table + repo `src/db/repositories/document-requests.ts` exist; requests are not yet linked to steps → add `step_id`, `due_date`, `kind` columns, see 5.2). |
| ☑ | Expected COI | 28 Oct | engagement `schedule.incorporation.to` (manager-set window; `normalizeEngagementSchedule`, `src/lib/schedule-windows.ts`). DECISIONS: "Days to COI before COI count down to the manager-set incorporation window end". Not in overview payload → **add `expectedCoiDate` to `ClientOverview`** (repo already loads `row.schedule`). |
| ☑ | Incorporated | 24 Oct | `overview.engagement.incorporationDate` (existing). |
| ☑ | Due soon | 3 | `overview.compliance.upcoming` filtered to due within 15 days and not filed (existing data, new derivation). |
| ◐ | Registrations | 5/13 | `overview.progress.byPhase['registration-phase-4']` gives done/23 (catalog has 23 phase-4 steps). The prototype's 13 = the curated registrations list of `v7c_reg` (section 5.15). Decide denominator (open question Q3). |
| ☑ | Report | — | GET `/api/ask/brief` (existing PDF). |
| ☑ | ring drill rows | step, date, status | `overview.milestones` (id, title, kind, completedOn, ownedByClient) + `windowForStep(schedule, id)` for future dates. Existing data; drill component NEW (UI). |

---

#### 5.2 Needs from Northwind (`v7c_needs_b`, `v7c_needs_a`)

| Done | id | item | behaviour / content | file |
|---|---|---|---|---|
| ☑ | ND-01 | Header | "Needs from Northwind" (h3 13px/700 navy). No (i) on desktop; phone card has (i): "Items Northwind’s project lead asked for. Upload, fill, correct or sign them here." | needs_b, mobile |
| ☑ | ND-02 | Tabs | Full-width 4-column sliding pill: Upload · Fill · Correct · Sign with counts. Before: 2·1·1·0. After: 2·1·0·1. Default tab 0. Click switches rows (thumb spring .42s). | |
| ☑ | ND-03 | Row | `display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--hair)`: 18×18 empty checkbox `.box` (2px primary border, radius 4) · title `.rt` 13px/600 + (i) pop-over with the step name · date chip (solid, colour by urgency) · 30px outline button (min-width 76px) with the verb. | |
| ☑ | ND-04 | Rows before | Upload: "Utility bill - office" (i "Registered Office Address") chip **9 Oct** due · button Upload; "NOC from owner" (Registered Office Address) 9 Oct due · Upload. Fill: "Director 2 - nationality, ID" (Proposed Directors) **11 Oct** prog · Fill. Correct: "Passport copy - page 2" (Proposed Directors) **Overdue 3d** over · Correct. Sign: none. | needs_b |
| ☑ | ND-05 | Rows after | Upload: "October salary register" (EPF Return · Oct 2026) **In 5 days** due; "Bank FIRC + KYC letter" (FC-GPR Filing) **In 12 days** prog. Fill: "TDS challan details" (TDS Payment · Oct 2026) **Overdue 1d** over. Correct: none. Sign: "FC-GPR declaration" (FC-GPR Filing) **In 20 days** prog. | needs_a |
| ☑ | ND-06 | Empty state | Before: "Nothing to sign." (any empty tab shows this exact text — prototype bug; should be "Nothing to <verb>."); after: "Nothing here." Plain `.cap` text in a bordered row. Phone version uses the bot bubble (rule 16): "Nothing to sign right now. You are all caught up here." + "Ask VCFO why". Use the bot bubble everywhere. | |
| ☑ | ND-07 | Upload button | Desktop: not wired (fallback "Choose a file to upload"). Phone: opens bottom sheet titled with the item name: rows "Choose a file — PDF, JPG or PNG · up to 10 MB" and "Take a photo — Use the phone camera"; choosing → sheet closes, toast "Uploaded · <item>" with Undo. **Real: upload against the open request (DECISIONS: uploads only against open requests).** | mobile |
| ☑ | ND-08 | Fill / Correct / Sign | Desktop fallback toasts. Phone: Fill → toast "Fill · <item> opened" + go `incorporation`; Fix (overdue) opens the upload sheet. **Real: Fill/Correct → the owning step page (`inc-step-N`); Correct reopens via the rejection note; Sign → the signing flow of that step (DSC / e-sign) or the compliance filing.** | mobile |
| ☑ | ND-09 | Checkbox | Decorative (no click). | |

Data → real app

| Done | field | example | source |
|---|---|---|---|
| ☑ | item title | Utility bill - office | **NEW**: there is no item-level "need" today. Closest: (a) `document_requests` rows (title, detail, status pending/fulfilled, requested_by) — table + repo exist but no step link, due date or kind; (b) per-step required documents from `src/data/checklist.ts` (`infoRequired`) + `src/lib/checklist-responses.ts` field ids (e.g. pre-14 `registeredOfficeUtilityBill…`); (c) `clientFillRequest` on a step slice (`requestClientFill` in engagements repo); (d) rejected steps (`isReviewRejected`, `rejectionNote`) → "Correct"; (e) after COI: `compliance_instances` needing client input. Proposal: extend `document_requests` with `step_id text`, `compliance_instance_id uuid`, `kind text ('upload'|'fill'|'correct'|'sign')`, `due_date date`, `field_id text`, and add `listOpenClientNeeds(ctx, engagementId)` returning a unified list (requests + fill requests + rejected steps) → include as `overview.needs[]` in `/api/client/overview`. |
| ☑ | subtitle/(i) | Registered Office Address | step title via `getItem(stepId).title` or obligation `particular` + period. |
| ☑ | date chip | 9 Oct / Overdue 3d / In 5 days | `due_date` (NEW column) or step schedule window `windowForStep(schedule, stepId).to`; label = relative ("In N days", "Overdue Nd") or absolute date. |
| ☑ | counts per tab | 2·1·1·0 | group by `kind`. |
| ☑ | upload action | — | existing upload plumbing: `POST /api/documents` (+ S3 `src/storage/s3.ts`), mark request fulfilled `PATCH /api/requests/[id]`. |

---

#### 5.3 Who holds it now (`v7c_current`, BEFORE only)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | WH-01 | Header | "Who holds it now". Phone card: "WHO HOLDS IT NOW" + (i) "Northwind’s current step and the steps around it. Tap a step for its details." + footer "Open step 7 →" (route incorporation). |
| ☑ | WH-02 | Tabs | 3-column pill (full width): **Northwind 3** · **SBC 1** · **MCA 0**. |
| ☑ | WH-03 | Holder rows (Northwind tab) | Each a bordered box (`border:1px solid var(--border);border-radius:8px;padding:8px 12px;border-left:3px solid var(--<colour>)`), flex-wrap: title + status chip (wrapped in `.tipw` with tooltip; click opens drill on the matching tab) / caption line / button (30px): ① **Registered Office Address** (bold 800) chip "Waiting for Northwind" (due) tip "Waiting for Northwind · 1 step"; caption "Step 7 · due 9 Oct · 2 files missing"; **primary** button "Continue" → `inc-step-7`. ② Proposed Directors · "In progress" (prog) tip "In progress · 3 steps" · "Step 8 · Director 2 details · Northwind fills this" · outline "Continue" → `inc-step-8`. ③ Subscriber Details · In progress · "Step 9 · 3 fields left · Northwind fills this" · "Continue" → `inc-step-9`. |
| ☑ | WH-04 | SBC tab | KYC Review & DSC · In progress · "Step 10 · Arjun Mehta · 30% · ready 13 Oct" · outline "Open" → `inc-step-10`. |
| ☑ | WH-05 | MCA tab (empty) | Dashed box (`border:1px dashed var(--border);border-radius:8px;background:var(--raised);padding:10px 12px`) with 28px idle bot + "Nothing is with MCA yet. SBC files SPICe+ on 20 Oct, then MCA reviews it." (`role=status`). Rule-16 bot empty state. |
| ☑ | WH-06 | "Steps around Northwind" | `.lbl` navy uppercase label then rows (`padding:7px 0;border-top hair`): mono "Step N" (50px) · step name (current step weight 800; upcoming muted) · owner chip (light, min-width 88) · status chip (min-width 116, inside `.tipw` → drill): Step 6 Capital Structure · Northwind · Completed (tip "Completed · 6 steps") / Step 7 Registered Office Address (bold) · Northwind · Waiting (tip "Waiting for Northwind · 1 step") / Step 8 Proposed Directors · Northwind · In progress (tip "In progress · 3 steps") / Step 9 Subscriber Details · Northwind · In progress / Step 10 KYC Review & DSC · **SBC** · In progress / Step 11 SPICe+ Confirmation (muted) · Northwind · "Not started" (up-light chip, tip "Not started · 4 steps"). Window = 1 done step before the current one through 1 upcoming after. |
| ☑ | WH-07 | Drill | Same "Incorporation steps" config as GR-08, opened on tab 1 (Completed), 2 (In progress), 3 (Waiting) or 4 (Upcoming) depending on the clicked chip. |

Data → real app

| Done | field | example | source |
|---|---|---|---|
| ☑ | holders by party | Northwind 3 / SBC 1 / MCA 0 | `overview.milestones` (kind + `ownedByClient`) + statuses; MCA = steps `pre-10` SPICe+ Filing and `pre-11` MCA Remarks when filed and awaiting MCA (NEW derivation: "with MCA" = SPICe+ filed, COI not issued). |
| ☑ | caption "due 9 Oct · 2 files missing" | | due = `windowForStep(schedule,'pre-14').to`; files missing = count of open needs for that step (NEW needs list). |
| ◐ | "Director 2 details · Northwind fills this" | | NEW per-step summary line; can be derived from missing required fields (`src/lib/checklist-responses.ts` + validation modules `src/lib/checklist-*-validation.ts`). |
| ◐ | "Arjun Mehta · 30% · ready 13 Oct" | | lead name: `overview.team` (role Project Lead); % NEW (lead-side progress per step — not stored; could be fields filled / required); ready date = schedule window. |
| ☑ | step N label | Step 7 | global catalog index (table in 5.10). |
| ☑ | Continue → | inc-step-7 | `clientStepHref('pre-14')`. |
| ◐ | **Conflict** | steps 7, 8, 9 all "In progress" for the client at once and step 10 with SBC | the real gate (`gateActiveCatalog`, `src/lib/checklist-step-gate.ts`) is SEQUENTIAL: one active step; later steps are `locked`. See Q1. |

---

#### 5.4 What is next (`v7c_next`, AFTER only)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | WN-01 | Header | "What is next" + right: 2-tab pill **15 days 4** · **30 days 6** (default 15). Phone (i): "Filings due in the next 15 or 30 days. ↗ opens the official portal." footer "Open Compliances →". |
| ☑ | WN-02 | Hero row (overdue) | `.tipw` box (`padding:12px 14px;border-radius:8px;background:var(--over-light);border:1px solid oklch(57% .2 22 / .3);margin-bottom:6px`, flex-wrap gap 10px 14px): big date "07" (metric 30px over-text) / "NOV" label · title **TDS Payment · Oct 2026** (14px) + (i) "Waiting on Northwind · TDS challan details · asked by Priya Raman" + chip "Overdue 1 day" (over) · primary 30px "Fill details" → `compliances`. Hover tooltip "TDS Payment · overdue 1 day"; click → drill tab Overdue. |
| ☑ | WN-03 | Rows | 44×48 date tile (`border-radius:8px;color:#fff;background:var(--<urgency>)`, metric 18px day + 11px/800 month; `.tipw` tooltip "<name> · DD MON", click → drill tab "Next 15 days" if ≤15 days else "16–30 days") · title + (i) "<period> · <area> · SBC by <date>" · owner chip (Northwind = due-chip / SBC = prog-chip) · urgency chip (width 92). 15-day rows: EPF Return & Payment 15 NOV (Oct 2026 · Payroll · SBC by 13 Nov) Northwind "In 7 days" due; ESI Payment 15 NOV SBC In 7 days; PT Payment 20 NOV SBC "In 12 days" prog. 30-day adds: FC-GPR Filing 02 DEC (Share allotment · FEMA · SBC by 28 Nov) Northwind "In 24 days"; TDS Payment 07 DEC (Nov 2026 · Income tax · SBC by 5 Dec) SBC "In 29 days". The overdue item is always the hero, never in the list. |
| ☑ | WN-04 | Drill | "What is next": All 6 · Overdue 1 · Next 15 days 3 · 16–30 days 2. Rows TDS Payment · Oct 7 Nov Overdue · EPF Return & Payment · Oct 15 Nov In 7 days · ESI Payment · Oct 15 Nov · PT Payment · Oct 20 Nov In 12 days · FC-GPR Filing 2 Dec In 24 days · TDS Payment · Nov 7 Dec In 29 days. Link strip → Compliances. |
| ☑ | WN-05 | Portal ↗ (phone, rule 15) | Phone rows carry a 40px ↗ icon link to the official portal (incometax.gov.in, unifiedportal-emp.epfindia.gov.in, esic.gov.in, pt.kar.nic.in) + → button opening the drill. Desktop card has no ↗ — rule 15 says every compliance gets one; add it. |

Data → real app

| Done | field | source |
|---|---|---|
| ☑ | filings list, due date, period, area | `overview.compliance.upcoming` (repo `loadComplianceRunway`: `compliance_instances` ⋈ `compliance_obligations`, 90-day horizon, fields title/authority/group/dueDate/status/periodLabel). Existing. Overdue items are EXCLUDED today (query is `dueDate >= today`) → **extend to include `status='overdue'` or `dueDate < today and status != 'filed'`.** Also `GET /api/filings` (`src/db/repositories/filings.ts`) and hook `useComplianceFilings` (`src/hooks/use-compliance-filings.ts`). |
| ◐ | owner (Northwind/SBC) | `compliance_instances.owner_id` (exists, uuid) → whether owner is a client profile or staff. Needs population (NEW data, no column change). |
| ◐ | "SBC by 13 Nov" | `compliance_instances.window_to` (manager working window; exists) — set via `setComplianceInstanceWindow` (`src/db/repositories/schedule.ts`) / `PATCH /api/filings/[id]/window`. |
| ☑ | "asked by Priya Raman" / "TDS challan details" | linked client need (NEW needs list with `compliance_instance_id`). |
| ☑ | portal URL | NEW static map authority → portal URL (front-end constant). |

---

#### 5.5 Important alerts (`v7c_alerts_b`, `v7c_alerts_a`)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | AL-01 | Header | "Important alerts" + 2-tab pill: before **15 days 3 · 30 days 3** (default 15); after **15 days 1 · 30 days 2** (default **30 days**, `state.tab=1`). DECISION: before COI, dated items only. Phone (i): "Dated items only, nearest first." |
| ☑ | AL-02 | Hero overdue row | Same red box as WN-02 but with a 22px octagon-alert icon (over-text). Before: **Passport copy sent back** + (i) "Proposed Directors · page 2 · waiting on Northwind" + chip "Overdue" + primary "Fix" → `inc-step-8`. Tooltip "Passport copy · overdue 3 days". After: **TDS Payment overdue 1 day** + (i) "Interest runs until paid · waiting on Northwind" + chip Overdue + "Fill details" → `compliances`. Tooltip "TDS Payment · overdue 1 day". Click (not on the button) → drill tab Overdue. |
| ☑ | AL-03 | Dated rows | 44×48 date tile (bg `var(--<k>)` solid, white) · title + (i) meta · status chip width 92. Before (all ≤15 days, so both tabs show the same 3): 09 OCT "2 office documents" (i "Registered Office Address") "In 3 days" due · 10 OCT "MOA & AOA drafts" (i "Review") "In 4 days" prog · 14 OCT "Approved name expires" (i "File Part B before") "In 8 days" due. Before tiles are NOT clickable; after tiles are `.tipw` (tooltip "<title> · DD MON", click → drill tab ≤15 → 1 else 2). After: 15 NOV "3 payroll dues" (EPF · ESI · PT for Oct 2026) In 7 days due · 02 DEC "FC-GPR due" (Bank FIRC needed) "In 24 days" prog · (23 DEC "Share certificates (SH-1)" 60-day limit… In 45 days — beyond 30, never shown). |
| ☑ | AL-04 | Drill | "Important alerts" before: All 4 · Overdue 1 · Next 15 days 3 (rows Passport copy sent back 3 Oct Overdue; 2 office documents 9 Oct In 3 days; MOA & AOA drafts 10 Oct In 4 days; Approved name expires 14 Oct In 8 days). After: All 4 · Overdue 1 · Next 15 days 1 · Later 2 (TDS 7 Nov; 3 payroll dues 15 Nov; FC-GPR due 2 Dec In 24 days; Share certificates (SH-1) 23 Dec In 45 days). Drill link → Notifications (title matches /alert/). |
| ☑ | AL-05 | Phone | Rows are buttons (tile + title + "In N days" + chevron) → drill "Important alerts" with tabs 15 days 3 · 30 days 3. |

Data → real app

| Done | alert | source |
|---|---|---|
| ☑ | Passport copy sent back (overdue) | rejected step slice: `isReviewRejected(slice)` + `rejectionNote` on `pre-15` (Proposed Directors); date = review date `reviewedAt`. Existing data. |
| ☑ | 2 office documents due 9 Oct | open needs for `pre-14` with due date (NEW needs list). |
| ◐ | MOA & AOA drafts 10 Oct | SBC deliverable with a date: step `pre-9` SPICe+ Confirmation / incorporation docs (`app/api/engagements/[id]/incorporation-docs/share`) + schedule window. NEW: "dated item" derivation. |
| ☑ | Approved name expires 14 Oct | `pre-5` response `nameApprovalExpiryDate` (exists in `checklist-responses.ts`). Existing data, NEW derivation. |
| ☑ | TDS overdue / payroll / FC-GPR / SH-1 | `compliance_instances` (status, due_date) + post-inc statutory windows (5.17). |
| ☑ | Proposal | NEW pure function `buildAlerts(state, schedule, compliance, needs, now)` in `src/lib/client-overview.ts` → `overview.alerts[] {id,title,meta,date,severity:'over'|'due'|'prog',href}`. |

---

#### 5.6 What SBC is doing (`v7c_sbc_b`, `v7c_sbc_a`)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ◐ | SB-01 | Header | "What SBC is doing". Phone (i): "Work the SBC team is doing now. Tap for the detail." |
| ◐ | SB-02 | Row | `padding:9px 0;border-top hair`: title + (i) "<person> · <step> · ready <date>" · `.pct` (11.5px/800, width 36, right) · 26px outlined link-icon button (aria "Open Step N", → `inc-step-N`) · below: 6px bar (`.bar`, grow animation) filled `var(--prog)` or `var(--up)` at 0%. |
| ◐ | SB-03 | Rows before | KYC Review & DSC 30% (Arjun Mehta · Step 10 · ready 13 Oct) → inc-step-10 · MOA & AOA drafts 0% (Arjun Mehta · Step 11 · drafts reach Northwind 10 Oct) → inc-step-11 · DSC for both directors 0% (Arjun Mehta · Step 10 · ready 13 Oct) → inc-step-10 · File SPICe+ Part B 0% (Priya Raman · Step 12 · ready 20 Oct) → inc-step-12. |
| ◐ | SB-04 | Rows after | PT Registration 70% (Arjun Mehta · Registrations · ready 12 Nov) · IEC Registration 50% (Arjun Mehta · Registrations · ready 14 Nov). Link icon aria "Open Registrations", no `data-go` (fallback toast) → real: `inc-phase-4` or the specific step (`reg-7` PT = step 29, `reg-8` IEC = step 33). |
| ◐ | SB-05 | No tooltip/drill on bars (desktop). Phone rows are buttons → drill "What SBC is doing": tabs In progress / Not started, rows "<n>% · Arjun Mehta" / "Not started yet". Rule 14 says bars should also have hover tooltips; add "<task> · 30% · ready 13 Oct". |

Data → real app

| Done | field | source |
|---|---|---|
| ◐ | work items | NEW. Today only step-level: milestones with `ownedByClient=false` and gate `waiting`/in-progress (`overview.milestones`, `ballInCourt.waitingOnFirm`). Sub-tasks like "MOA & AOA drafts", "DSC for both directors" are not modelled → could come from `tasks` (repo `src/db/repositories/tasks.ts`, `GET /api/tasks`) filtered to engagement + client-visible flag (**NEW column `visible_to_client boolean`, `progress_pct int`, `due_at` exists as `deadline`**). |
| ☑ | person | task assignee → profile name (team). |
| ◐ | % | NEW (`tasks.progress_pct`) or derive from step field completion. |
| ☑ | ready date | `tasks.deadline` or `windowForStep(...).to`. |

---

#### 5.7 Timeline (`v7c_timeline_b`, `v7c_timeline_a`) + editor

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | TL-01 | Header | "Timeline" + (i) "Last changed by Priya Raman on 1 Oct 2026". Right: BEFORE outline button 30px with pencil icon "Edit" → opens the timeline editor (`tl-editor.js`, proto.js intercepts any "Edit" in a card whose h3 is "Timeline"). AFTER: no Edit; chip "Completed" (ok-light/ok-text). When a client change request is pending, a chip button `.tle-pend` "Change request pending · COI <date>" (amber `#fdecd3`/#8a4b0f, 24px, 800 11px) is inserted before Edit; click → toast "Waiting for Priya Raman to approve · “<reason…>”". DECISION: the change-request warning stays visible. |
| ☑ | TL-02 | Chart frame | `.vh-tl` (horizontal scroll on narrow screens) padding `12px 16px 30px`; inner `min-width:600px`; grid `150px minmax(0,1fr)`. |
| ☑ | TL-03 | Axis | Mono caption labels at weekly ticks, `translateX(-50%)`: before axis 12 Sep → 7 Nov (12 Sep 0%, 19 Sep 12.28%, 26 Sep 24.56%, 3 Oct 36.84%, 10 Oct 49.12%, 17 Oct 61.4%, 24 Oct 73.68%, 31 Oct 85.96%, 7 Nov 98.25%; span 57 days). After axis 63 days (ticks 0, 11.11 … 88.89%). Vertical 1px hair grid lines at each tick. |
| ☑ | TL-04 | Today line | 2px `var(--over)` line `top:-4px` + chip at the bottom (`bottom:-20px`, over-chip, padding 0 6px) "Today 6 Oct" (42.11%) / "Today 8 Nov" (90.48%). |
| ☑ | TL-05 | Rows (30px each) | Label `.rt` 12px · bar (`position:absolute;top:5px;bottom:5px;border-radius:4px`, `.tipw` with tooltip, click → drill on that phase tab) · caption after the bar (`left:calc(<end>% + 8px)`, 700). BEFORE: Phase 1 · Name Application 0–21.05% ok, "Done 24 Sep", tip "Phase 1 · Name Application · 12 Sep – 24 Sep · done" / Phase 2 · Incorporation 22.81%+43.86% `var(--prog)`, "22%", tip "… · 25 Sep – 20 Oct · 22%" / MCA review 66.67%+14.03% `var(--up)`, tip "MCA review · 20 Oct – 28 Oct" / COI 80.7% w 1.76% navy, "28 Oct", tip "COI · expected 28 Oct". AFTER: all ok: Phase 1 0–19.05% "Done 24 Sep"; Phase 2 20.63%+34.93% "Filed 17 Oct" tip "· 25 Sep – 17 Oct · filed"; MCA review 55.56%+11.11% tip "17 Oct – 24 Oct · done"; COI 66.67% "24 Oct" tip "COI · 24 Oct". |
| ☑ | TL-06 | Drill | "Timeline phases": Phase 1 · Name 5 · Phase 2 · Incorporation 7 · MCA review 1 · COI 1 (no All tab; opens on the clicked phase). Rows = the 14 SPICe+ steps tagged by phase (after: all Completed, MCA Remarks "17–24 Oct"). |
| ◐ | TL-07 | Editor | Section 8.6. Saving re-animates the card bars (`left/width .5s cubic-bezier(.22,1,.36,1)`), updates tooltips and the COI label, and rewrites the (i) text to "Last changed by Northwind just now". |
| ☑ | TL-08 | Phone | Card "Timeline" (i) "Planned dates for each phase. The red line is today." + outline "Edit" button (40px) + gantt (section 6) + footer "Open Incorporation →". After: (i) "Incorporation is complete.", no Edit. |

Data → real app

| Done | field | source |
|---|---|---|
| ☑ | phase windows | engagement `schedule` jsonb `{ incorporation?: Window, steps?: {[itemId]: Window} }` (`src/lib/schedule-windows.ts`; repo `setEngagementWindow` in `src/db/repositories/schedule.ts`; route `PUT/PATCH /api/engagements/[id]/schedule`). Phase window = min(from)/max(to) of its steps' windows (DECISIONS: "Phase end date = latest step date in the phase"). MCA review = windows of `pre-10`/`pre-11`; COI = `schedule.incorporation.to` (before) or `incorporationDate` (after). |
| ☑ | % in Phase 2 | `progress.byPhase` pct. |
| ☑ | "Last changed by …" | latest audit event of action `schedule.*` (`listAuditEvents`), or NEW `schedule_updated_by/at` inside the schedule jsonb. |
| ◐ | Client change request | **NEW**: `engagement_change_requests.kind` today = delete_project/change_client/change_manager (`src/db/repositories/engagement-change-requests.ts`, routes `/api/engagement-change-requests`). Add kind **`timeline`** with payload `{ phases:[{id,from,to}], coiFrom, coiTo, slipDays }`, `reason` (required), status pending→approved/rejected by the manager; on approve call `setEngagementWindow`. Pending request exposed in overview (`overview.timelineRequest`). Manager direct edit = existing schedule write (role-gated by `canSetScheduleWindows`). Notifications on save: "email and WhatsApp to admin, manager, lead and client" (manager board) → `notifyEngagementEvent` + WhatsApp templates (NEW event `timeline_changed`). |

---

#### 5.8 Steps card (`v7c_steps_b`, `v7c_steps_a`)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | ST-01 | Header | "Steps" + right link "Open Incorporation →" (`data-go="incorporation"`, 12px/700). |
| ☑ | ST-02 | Phase accordions | 4 `<details class="stp-g">` (gap 8px): border 1px, radius 8, overflow hidden. `summary`: flex gap 10, padding 10px 12px, hover raised; chevron 14px rotates 90° when open (.25s); phase name is a link (`a.stp-ph`, inherits colour, 800) → phase page; status chip (min-width 116) "x of y"; mono caption state. Open body animates `stpIn .28s` (opacity, translateY -4px). BEFORE: Phase 1 · Name Application "5 of 5" ok "done" → `inc-phase-a`; **Phase 2 · Incorporation "1 of 9" prog "in progress" (open by default)** → `inc-phase`; Phase 3 · Post-Incorporation "0 of 11" up "upcoming" → `inc-phase-3`; Phase 4 · Registration "0 of 23" up "upcoming" → `inc-phase-4`. AFTER: Phase 1 5/5 done; Phase 2 9/9 ok done; **Phase 3 "7 of 11" prog in progress (open)**; Phase 4 "5 of 23" prog in progress. |
| ☑ | ST-03 | Table | Inside `.vh-x` (scrolls horizontally inside its box, `--tmin:560px`). Columns: # (mono caption 600) · Step (`.rt` 12.5px) · Owner chip (light; Northwind/SBC) · Status chip (min-width 116) · Timeline (`.stp-tl` 11.5px muted, wraps, 110–190px) · 28px arrow button (`.stp-go`, aria "Open step N · <name>"). Whole row is `data-go="inc-step-N"` (cursor pointer); row hover moves the arrow 2px right with primary-light bg. |
| ☑ | ST-04 | Rows | 48 rows; full list in 5.10 with owner, status before/after and "Timeline" text (e.g. "2–3 working days", "Within 30 days of incorporation", "No statutory time limit", "14–15 working days from filing (Phase 2 Step 6)"). |

Data → real app

| Done | field | source |
|---|---|---|
| ☑ | phases, step titles, owner, timeline text | `src/data/checklist.ts` (`getIncorporationPhases()`; `item.responsibleRole` client→"Northwind", intern→"SBC"; `item.timeline`). Note: client-overview.ts comment says the working-days SLA "is no longer shown" (replaced by the manager window `formatWindow`). Prototype still shows the playbook timeline text → Q4. |
| ☑ | status | `overview.milestones[].kind` (done/active/waiting/locked) + slice status (`coerceStatusCode`); label map: done→Completed (ok), active→Waiting (due) for client-owned / In progress (prog), waiting→In progress (prog), locked→Upcoming (up), overdue→Overdue. |
| ☑ | x of y | `progress.byPhase[].done/total`. |
| ☑ | default open | the phase containing the current step. |

---

#### 5.9 Recent documents (`v7c_docs_b`, `v7c_docs_a`)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | RD-01 | Header | "Recent documents" + right link "Documents →" (not wired → real: route `documents`). |
| ☑ | RD-02 | Group labels | `p.rd-g` 800 10px uppercase subtle + trailing hair line: BEFORE "Last week", "Earlier"; AFTER "This week", "Last week", "Earlier". Grouped by arrival. |
| ☑ | RD-03 | Row | `.rd-r` (`role=button tabindex=0`, `data-go="doc-viewer"`, title "<name> · <TYPE> · <d Mon yyyy> · from <who>"): file-type badge 20×20 radius 6 (`700 7px/20px IBM Plex Mono`; JPG teal-light/teal-chip, PDF over-light/over-text, DOCX prog-light/prog-text) · name (12.5px/500, ellipsis) · meta "Northwind" (gold-text when uploaded by the client) or "SBC" · "·" · mono date · 26px download icon button (aria "Download <name>", hover primary-light). Row hover raised. Below 330px the "who" and separator hide. DECISION rule 9: row click → preview overlay; actions 👁 Preview · ⬇ Download (the board only shows ⬇; the row itself previews). |
| ☑ | RD-04 | Rows before | Last week: Director 1 - passport · JPG · Northwind · 2 Oct. Earlier: Name approval letter · PDF · SBC · 24 Sep; Signed Board Resolution · PDF · Northwind · 18 Sep; Draft Board Resolution · DOCX · SBC · 14 Sep. |
| ☑ | RD-05 | Rows after | This week: Share capital FIRC · PDF · Northwind · 2 Nov. Last week: GST certificate · PDF · SBC · 1 Nov; Board meeting minutes · PDF · SBC · 26 Oct. Earlier: Certificate of Incorporation · PDF · SBC · 24 Oct. |
| ☑ | RD-06 | Phone | Rows with 38×20 type badge (PDF over, JPG oklch(47% .09 195), DOCX oklch(51% .17 252)), name + date, 40px 👁 (→ doc-viewer) and ⬇ (toast "Download started · <name>") buttons; footer "Open Documents →". Phone (i) "The newest files from Northwind’s project. 👁 previews, ⬇ downloads." (typo in source: "Northwindr"). |

Data → real app

| Done | field | source |
|---|---|---|
| ☑ | list | `GET /api/documents?engagementId=` → `listDocuments(ctx)` (`src/db/repositories/documents.ts`; client sees only `shared_with_client=true` and released step files) ordered by `created_at desc`, limit 4–6. Plus firm deliverables `overview.documents.deliverables` (COI, PAN/TAN cards, MOA/AOA, GST/IEC certs) whose files live in `checklist_state` paths. Merge both sources (NEW small server derivation or client merge). |
| ☑ | who | `uploaded_by` → profile role (client → company short name, staff → "SBC"). |
| ☑ | type | `content_type`/extension of `file_name`. |
| ☑ | preview | `GET /api/documents/[id]/signed-url` (S3 presigned) / `GET /api/milestone-documents/signed-url` → doc viewer overlay (10.1). |
| ☑ | download | same signed URL with `content-disposition: attachment`. |

---

#### 5.10 Step number ↔ checklist id ↔ owner/status (used by Steps card, drills, `inc-step-N`)

Global N = position in `getIncorporationPhases()` order (from `prototype/incorporation-steps.json`). Owner: client→"Northwind", intern→"SBC". Status B = before card, A = after card. Timeline = text shown in the Steps card.

| Done | N | id | title | owner | status B | status A | timeline text |
|---|---|---|---|---|---|---|---|
| ☑ | 1 | pre-1 | Client Details | Northwind | Completed | Completed | 2–3 working days |
| ☑ | 2 | pre-2 | Draft Board Resolution | SBC | Completed | Completed | 1–2 working days |
| ☑ | 3 | pre-3 | Signed Board Resolution | Northwind | Completed | Completed | 3–4 working days |
| ☑ | 4 | pre-4 | Name Application | SBC | Completed | Completed | 1–2 working days |
| ☑ | 5 | pre-5 | Name Approval | SBC | Completed | Completed | 5–7 working days |
| ☑ | 6 | pre-13 | Capital Structure | Northwind | Completed | Completed | 1 working day |
| ☑ | 7 | pre-14 | Registered Office Address | Northwind | **Waiting** | Completed | 1 working day |
| ☑ | 8 | pre-15 | Proposed Directors | Northwind | In progress | Completed | 4–5 working days |
| ☑ | 9 | pre-16 | Subscriber Details | Northwind | In progress | Completed | 1 working day |
| ☑ | 10 | pre-7 | KYC Review & DSC | SBC | In progress | Completed | 2–3 working days |
| ☑ | 11 | pre-9 | SPICe+ Confirmation | Northwind | Upcoming | Completed | 2–3 working days |
| ☑ | 12 | pre-10 | SPICe+ Filing | SBC | Upcoming | Completed | 1–2 working days |
| ☑ | 13 | pre-11 | MCA Remarks | SBC | Upcoming | Completed | 5–7 working days |
| ☑ | 14 | pre-12 | Certificate of Incorporation | SBC | Upcoming | Completed | 14–15 working days from filing (Phase 2 Step 6) |
| ☑ | 15 | post-1 | First Board Meeting | SBC | Upcoming | Completed | Within 30 days of incorporation |
| ☑ | 16 | post-9 | Company Letterhead | SBC | Upcoming | Completed | Within 30 days of incorporation |
| ☑ | 17 | post-3 | Bank Account Opening | SBC | Upcoming | Completed | No statutory time limit |
| ☑ | 18 | post-4 | Share Capital Infusion | SBC | Upcoming | Completed | Within 180 days of incorporation |
| ☑ | 19 | post-5 | Share Certificates (SH-1) | SBC | Upcoming | In progress | Within 60 days of incorporation |
| ☑ | 20 | post-6 | Commencement (INC-20A) | SBC | Upcoming | In progress | Within 180 days of incorporation |
| ☑ | 21 | post-2 | Auditor Appointment (ADT-1) | SBC | Upcoming | Completed | Within 30 days of incorporation |
| ☑ | 22 | post-7 | FC-GPR Filing | SBC | Upcoming | In progress | Within 30 days of incorporation |
| ☑ | 23 | post-8 | Nominee Shareholder (MGT-4/5/6) | SBC | Upcoming | In progress | Within 30 days of incorporation |
| ☑ | 24 | post-11 | Registered Office (INC-22) | SBC | Upcoming | Completed | Within 30 days of incorporation |
| ☑ | 25 | post-10 | Name Board | SBC | Upcoming | Completed | Within 30 days of incorporation |
| ☑ | 26 | reg-4 | GST Registration | SBC | Upcoming | Completed | Within 2 weeks of incorporation |
| ☑ | 27 | reg-1 | PF Registration | SBC | Upcoming | Completed | No statutory time limit |
| ☑ | 28 | reg-3 | ESI Registration | SBC | Upcoming | Completed | No statutory time limit |
| ☑ | 29 | reg-7 | PT Registration | SBC | Upcoming | In progress | No statutory time limit |
| ☑ | 30 | reg-6 | LEI Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 31 | reg-15 | MSME Registration | SBC | Upcoming | Completed | No statutory time limit |
| ☑ | 32 | reg-16 | ICEGATE Registrations | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 33 | reg-8 | IEC Registration | SBC | Upcoming | In progress | No statutory time limit |
| ☑ | 34 | reg-5 | LUT Filing | SBC | Upcoming | Completed | No statutory time limit |
| ☑ | 35 | reg-11 | Non-STPI Compliance | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 36 | reg-9 | Shops & Establishment | SBC | Upcoming | In progress | No statutory time limit |
| ☑ | 37 | reg-13 | CLRA Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 38 | reg-14 | POSH / SHE Box | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 39 | reg-10 | Trade Licence | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 40 | reg-12 | Trademark Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 41 | reg-17 | Trademark Renewal | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 42 | reg-18 | Patent Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 43 | reg-19 | ICDR Registration | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 44 | reg-20 | FCGPR Filing | SBC | Upcoming | Upcoming | Within 30 days of incorporation |
| ☑ | 45 | reg-21 | FDI Reporting | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 46 | reg-22 | ODI Reporting | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 47 | reg-23 | FLA Return | SBC | Upcoming | Upcoming | No statutory time limit |
| ☑ | 48 | reg-24 | FCTRS Filing | SBC | Upcoming | Upcoming | No statutory time limit |

Phase counts: 5 / 9 / 11 / 23. "Step 7 of 14" in the DECISIONS label = SPICe+ numbering (Phases 1+2 = 14 steps); the Steps card numbers 1–48 globally; the phone current step says "Now · step 7 of 14".

---

#### 5.11 Recent activity (`v7c_activity_b`, `v7c_activity_a`)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | RA-01 | Header | "Recent activity" + 3-tab pill All · SBC · Northwind (before 4·3·1, after 5·3·1). Phone (i) "Who did what, newest first." |
| ☑ | RA-02 | Row | grid `96px minmax(0,1fr) auto`, gap 12, padding 8px 0, border-top hair: mono date 12px/600 · text `.rt` 600 · actor caption. |
| ☑ | RA-03 | Rows before | 5 Oct 2026 · 2 documents requested · Arjun Mehta (sbc) / 4 Oct 2026 · Proposed Directors saved · Northwind (client) / 3 Oct 2026 · Passport copy sent back · Arjun Mehta / 1 Oct 2026 · Capital Structure accepted · Priya Raman. |
| ☑ | RA-04 | Rows after | 8 Nov 2026 · TDS Payment overdue · VCFO Suite (system; appears only under All) / 5 Nov · TDS details requested · Priya Raman / 3 Nov · ESI registration done · Arjun Mehta / 2 Nov · Share capital received · Northwind / 1 Nov · GST certificate delivered · Arjun Mehta. |
| ☑ | RA-05 | Filter | SBC = staff actors; Northwind = client actors; All = everything. No empty state designed (use bot bubble "Nothing here yet."). Phone rows prefix a set-A status glyph (done/you/late). |

Data → real app: `overview.activity[]` (id, at, label) from `listAuditEvents(ctx,{engagementId,limit:40})`, 12 newest, internal actions hidden (`HIDDEN_AUDIT_ACTIONS`). Missing: actor name/role → **extend `ClientOverviewActivity` with `actorName` and `actorKind: 'firm'|'client'|'system'`** (columns `actor_name`, `actor_role` already exist in `audit_events`). Alternative source `GET /api/activity` (`listActivity`). System events (overdue) need a writer (compliance job `src/jobs/compliance-generate.ts`) → NEW audit/activity row "TDS Payment overdue".

---

#### 5.12 Compliance status donut (`v7c_comp`, AFTER only)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | CS-01 | Header | "Compliance status" + (i) "Hover a slice for its count · click a slice, a legend row or the centre to see the list" + right chip "FY 2026-27" (up-light, min-width 116). |
| ☑ | CS-02 | Donut | 140×140 `conic-gradient(var(--ok) 0 2.6%, var(--due) 2.6% 10.5%, var(--over) 10.5% 13.2%, var(--up) 13.2% 100%)`; inner 98px white disc is a link (title "Show all") with "38" (metric 28px) + caption "this FY". Body padding `22px 16px 16px`, flex gap 20, align center. |
| ☑ | CS-03 | Legend | 4 link rows (`padding:6px 8px;margin:0 -8px;border-radius:6px`): 10px square swatch · label (500) · mono "n (p%)": Filed 1 (3%) · **Due soon 3 (8%)** (pre-highlighted `background:var(--raised)`) · Overdue 1 (3%) · Upcoming 33 (87%). |
| ☑ | CS-04 | Interaction (intended) | The board does NOT wire slices/legend/centre (fallback toast). Intended per (i) text, rule 14 and `v7p_compliance`: hover a slice → tooltip "<status> · n"; click a slice / legend row → compliance pop-up (8.2) with that status tab pre-selected; click centre → same pop-up on "All". (DECISIONS: "The compliance donut keeps its own pop-up (same pattern)".) Phone: SVG donut 110px (r 44, stroke 14, `stroke-dasharray` animates .9s cubic-bezier(.22,1,.36,1)), each arc `role=button` with `<title>` "<status> · n"; legend buttons with Space Grotesk counts; tap → bottom-sheet drill "Compliance status · FY 2026-27" (rows: Filed: ROC · AOC-4 FY25 "Filed 28 Oct"; Due soon: EPF Return & Payment · Oct 15 Nov · Northwind, ESI Payment · Oct 15 Nov · SBC, PT Payment · Oct 20 Nov · SBC; Overdue: TDS Payment · Oct 2026 "Overdue 1 day · Northwind"; Upcoming: GSTR-1 · Nov 11 Dec, GSTR-3B · Nov 20 Dec, FC-GPR 2 Dec, "… 30 more · Open Filings"); rows → `filings`. Footer "Open Filings →". |

Data → real app: counts by status of `compliance_instances` for the engagement in the current FY (`fy_label`). Existing source: `GET /api/filings` (`getFilings` in `src/db/repositories/filings.ts`, hook `useComplianceFilings`). Overview's runway only covers +90 days → either call `/api/filings?engagementId=&fy=` from the card, or **add `overview.compliance.fyCounts {filed,dueSoon,overdue,upcoming,total,fyLabel}`** (NEW aggregate in `client-overview.ts` repo). "Due soon" threshold = due within 15 days and not filed (define as constant; compliances page uses the same).

---

#### 5.13 Company IDs (`v7c_ids`, AFTER only) and the PAN/TAN reveal

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | ID-01 | Header | "Company IDs" + (i) "PAN and TAN need your password to show" + right link "COI →" (12px/700; not wired → real: open the Certificate of Incorporation in the doc viewer). |
| ☑ | ID-02 | Rows | grid `62px minmax(0,1fr) auto`, gap 6px 10px, padding 9px 0, border-top hair: `.lbl` key (+ "Private" chip for secrets: navy bg, gold text, padding 0 5px, 11px) · mono 12.5px/600 value · 26px action button. CIN `U72900KA2026FTC198431` + Copy (primary-light square) · PAN `AAKC••••1M` (letter-spacing .06em) + **Show PAN** (navy square, eye icon) · TAN `BLRN••••2D` + **Show TAN** · GSTIN `29AAKCN4821M1Z5` + Copy. Mask rule: first 4 + "••••" + last 2. |
| ☑ | ID-03 | Copy | Desktop fallback toast "Link copied"; phone: `navigator.clipboard.writeText` + toast "Copied · <value>". Real: clipboard + toast "Copied". |
| ☑ | ID-04 | Show PAN/TAN (desktop) | Not wired on the card (fallback toast "Show PAN"). The designed modal is `v7p_ids_password` (route key `ids-password`, section 8.3): "Confirm it's you" + account password; "Shown for 60 seconds". |
| ☑ | ID-05 | Show PAN/TAN (phone) | Bottom sheet "Show PAN": label "Your password" + password input (44px, prefilled ••••••••) + "🔒 Shown for 60 seconds, then hidden again." + navy button "Show PAN". Submit → sheet closes, value replaced by the full value (`AAKCN4821M` for PAN, `BLRN04392D` for TAN — note TAN digits differ from the masked value's source `BLRN04822D` on the Credentials page; demo typo) in `--ok-text` colour, toast "PAN shown for 60 s"; after 60 000 ms it reverts to the masked value. Phone rows also carry a 40px ↗ portal link (MCA, incometax.gov.in, tin-nsdl.com, gst.gov.in) per rule 15. |
| ☑ | ID-06 | Phone (i) | "PAN and TAN stay hidden. Reveal asks for your password and hides again after 60 s." |

Data → real app

| Done | field | source |
|---|---|---|
| ☑ | CIN, PAN, TAN | `overview.identifiers` (`identifiersFromState`: pre-12 responses `cin`, `pan`, `tan`, also `pfCode`, `esiCode`). Existing. **Security change needed:** the overview currently ships PAN/TAN in clear to the browser. For the reveal design, the API must return masked PAN/TAN and expose a NEW `POST /api/client/identifiers/reveal {field:'pan'|'tan', password}` that re-verifies the session user's password (bcrypt against `profiles.password_hash`, same check as `app/api/account/password/route.ts`), rate-limits (3 tries → lock; v7p_ids_password shows "Wrong password. 2 tries left."), writes an audit event (`identifiers.reveal`), and returns the clear value once. Client hides it after 60 s. |
| ☑ | GSTIN | reg-4 response `gstinNumber` (`src/lib/checklist-responses.ts`) — not in `identifiersFromState` today → **add `gstin`** (also `iecCode`, `leiNumber`, `pfRegistrationNumber`, `esiRegistrationNumber` for the Registrations card). |
| ☑ | COI → | `overview.documents.deliverables` entry `pre-12:certificateOfIncorporationFinalUrl` → milestone signed URL. |
| ☑ | portal ↗ | static map. |

---

#### 5.14 Compliance by area (`v7c_area`, AFTER only)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | CA-01 | Header | "Compliance by area" + chip "FY 2026-27 · as of 8 Nov 2026" (up-light). DECISION: 5 areas MCA · GST · Income tax · Payroll · FEMA. |
| ☑ | CA-02 | Tabs | 6-tab pill full width with `.vh-segwrap` (wraps on phone): All 38 · MCA 2 · GST 10 · Income tax 7 · Payroll 18 · FEMA 1. |
| ☑ | CA-03 | All tab | Table in `.vh-x` (`--tmin:600px`), 12.5px, margin-top 10: Area · Total · Filed (ok-text) · Due soon (due-text) · Overdue (over-text) · Mix (26% width, 10px `.stack` of segments, each a `.tipw` with tooltip "<Area> · <Status> · n", click → drill "<Area> · filings" on that status tab) · Status chip. Rows: MCA / ROC 2·1·0·0 "Compliant" ok; GST 10·0·0·0 "Upcoming" up; Income tax / TDS 7·0·0·1 "Overdue" over; Payroll (PF / ESI / PT) 18·0·3·0 "Due soon" due; FEMA / RBI 1·0·0·0 "Upcoming" up. Total row (border-top 1.5px, 800): 38 · 1 · 3 · 1. |
| ☑ | CA-04 | Single-area tab | Summary line: metric 22px area name + caption "<n> filings this FY · f filed · d due soon · o overdue"; table Filing · Period · Due / filed · Status: MCA: ADT-1 (auditor appointment) FY 2026-27 "Filed 5 Nov 2026" Filed; Commencement (INC-20A) One-time 22 Apr 2027 Upcoming. GST: GSTR-1 Nov 2026 11 Dec 2026; GSTR-3B Nov 2026 20 Dec 2026. Income tax: TDS Payment Oct 2026 7 Nov 2026 Overdue; TDS Payment Nov 2026 7 Dec 2026 Upcoming. Payroll: EPF Return & Payment / ESI Payment Oct 2026 15 Nov 2026 Due soon; PT Payment 20 Nov 2026 Due soon. FEMA: FC-GPR Filing "Share allotment" 2 Dec 2026 Upcoming. Footer caption "Showing k of n · full list in Filings" or "Showing all n". |
| ☑ | CA-05 | Drills | 5 configs (one per area): tabs All · Filed · Due soon · Overdue · Upcoming with area totals; 20 openers (area × status 1..4). Link strip → Filings. |

Data → real app: `compliance_instances` ⋈ `compliance_obligations` grouped by `complianceGroupForAuthority(authority)` (exists in `src/lib/client-overview.ts`: GST, Income tax, Payroll, MCA, FEMA, Other). Status buckets from `status` + due date. Source `GET /api/filings` / `getFilings` (existing, FY filter) → NEW grouping helper (pure). "Other" group is not in the design (5 areas) — fold or hide (Q5).

---

#### 5.15 Registrations (`v7c_reg`, AFTER only)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | RG-01 | Header | "Registrations" (no right control). |
| ☑ | RG-02 | Tabs | 6-tab wrapping pill: All 13 · Tax 2 · Labour 4 · Business 4 · IP 1 · FEMA 2. |
| ☑ | RG-03 | Table | `.vh-x` `--tmin:720px`: Registration · Category · Authority (caption) · Number (mono 11.5px/600, "-" when none) · Date (mono right) · Status chip · download icon (only when Registered; aria "Download certificate", title "Certificate"). Rows: GST Registration · Tax · GSTN · 29AAKCN4821M1Z5 · 1 Nov 2026 · Registered / LUT Filing · Tax · GSTN · AD291126001234X · 3 Nov 2026 · Registered / PF Registration · Labour · EPFO · KNBNG2954118000 · 2 Nov 2026 · Registered / ESI Registration · Labour · ESIC · 53001234560001001 · 3 Nov 2026 · Registered / PT Registration · Labour · Karnataka CTD · – · Est. 12 Nov 2026 · In progress / Shops & Establishment · Labour · Karnataka Labour Dept · – · Est. 15 Nov 2026 · In progress / MSME Registration · Business · Ministry of MSME · UDYAM-KR-03-0123456 · 30 Oct 2026 · Registered / IEC Registration · Business · DGFT · – · Est. 14 Nov 2026 · In progress / Trade Licence · Business · BBMP · Dec 2026 · Upcoming / LEI Registration · Business · LEIL · Dec 2026 · Upcoming / Trademark Registration · IP · IP India · Jan 2027 · Upcoming / FCGPR Filing · FEMA · RBI · FIRMS · By 2 Dec 2026 · Upcoming / FLA Return · FEMA · RBI · By 15 Jul 2027 · Upcoming. |
| ☑ | RG-04 | Phone | "Registrations" (i) "Every registration with its portal ↗ and its proof 📎." Rows: status glyph · name · "<authority> · <date>" · "📎 Proof" chip button (→ doc-viewer) or amber "Proof pending" chip (filed, no proof) or nothing (not filed) · ↗ portal. Rows: GST (GSTN · 1 Nov, done, proof) · PF (EPFO · 2 Nov, done, proof) · ESI (ESIC · 3 Nov, done, Proof pending) · PT (Karnataka CTD · est. 12 Nov, with SBC) · IEC (DGFT · est. 14 Nov, with SBC) · Trademark (IP India · Jan 2027, upcoming). Rule 15 asks for the same ↗ / 📎 on desktop → add. |

Data → real app: registration steps `reg-*` (phase 4) in `checklist_state`: status (gate), numbers from responses (`gstinNumber`, `lutArn`, `pfRegistrationNumber`, `esiRegistrationNumber`, `iecCode`, `leiNumber`…; MSME/Udyam, PT, S&E have no number fields yet — **NEW fields** in `src/lib/checklist-responses.ts` for reg-7/reg-9/reg-10/reg-12/reg-15), dates (`gstRegistrationDate`, `pfRegistrationDate`, …), estimated dates = schedule window. Category/authority = NEW static map per step id (front-end). Certificate = step file (e.g. `gstCertificateUrl`, `iecCertificateUrl`) via milestone signed URL. **NEW pure builder `buildRegistrations(state, schedule)` → `overview.registrations[]`.**

---

#### 5.16 Post-incorporation setup (`v7c_postinc`, AFTER only)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | PI-01 | Header | "Post-incorporation setup" + chip "Day 15 since COI" (up-light, min 116). |
| ☑ | PI-02 | Section label | "OPEN · STATUTORY WINDOW USED" (`.lbl` navy). |
| ☑ | PI-03 | Row | title + (i) · owner chip (Northwind due-light / SBC prog-light) · mono due date (min-width 80, right) / below: 10px track (`background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);radius 3`) as `.tipw` (tooltip "<name> · day d of N · due <date>", click → drill tab Open) with fill = d/N (FC-GPR `var(--due)`, others `var(--prog)`) · mono caption "day d of N". Rows: FC-GPR Filing (i "Within 30 days of share allotment (2 Nov) · Bank FIRC + KYC letter needed") Northwind · 2 Dec 2026 · 20% · day 6 of 30 / Nominee Shareholder (MGT-4/5/6) (i "Within 30 days of incorporation · 50% done") SBC · 23 Nov 2026 · 50% · day 15 of 30 / Share Certificates (SH-1) (i "Within 60 days of incorporation · 60% done") SBC · 23 Dec 2026 · 25% · day 15 of 60 / Commencement (INC-20A) (i "Within 180 days of incorporation · 40% done") SBC · 22 Apr 2027 · 8.3% · day 15 of 180. Note: the bar shows window used, the (i) shows work done. |
| ☑ | PI-04 | Completed box | Bordered box (radius 8, padding 10px 12px): check icon · "7 completed" (dotted underline, `.tipw` tooltip "Completed · 7 items", click → drill tab Completed) + (i) listing "First Board Meeting · 26 Oct · Registered Office (INC-22) · 25 Oct · Company Letterhead · 27 Oct · Bank Account Opening · 29 Oct · Name Board · 30 Oct · Share Capital Infusion · 2 Nov · Auditor Appointment (ADT-1) · 5 Nov". |
| ☑ | PI-05 | Drill | = GR-09 config (All 11 · Open 4 · Completed 7). |
| ☑ | PI-06 | Phone | Card "Post-incorporation setup" (i) "Statutory windows that started on the COI date." Rows buttons: name, "<owner> · <date> · day d of N", 8px bar (`var(--due)` if >45% used else `var(--navy-3)`); tap → drill Open/Completed. |

Data → real app: phase 3 steps `post-*` (`overview.milestones`, `progress.byPhase`), statutory window N from the step's playbook timeline text ("Within 30/60/180 days of incorporation") → NEW parsed constant per step id; day d = today − `incorporationDate` (or share-allotment date for FC-GPR: `post-7` responses `fcgprRemittanceDate`/allotment). Owner from `responsibleRole` (all intern in catalog; FC-GPR shown as Northwind because the client must upload FIRC → derived from open needs). "% done" NEW (step sub-progress). Also the compliance engine already generates event filings (`compliance_events`, e.g. `fc_gpr`) — reuse due dates from there.

---

#### 5.17 Card-level empty / loading / error states (real app)

The Home boards show no loading or error states. Use: L1 skeleton (DECISIONS: shown after 150 ms, held ≥300 ms; phone implements it, 6.4) for the whole page; existing `ClientOverviewSkeleton`; error → `EmptyStateIllustrated` "We could not load your dashboard" + "Try again" (existing in `src/views/client/Overview.tsx`); no engagement → "No active engagement". Per-card empties must use the bot bubble (rule 16): MCA tab (WH-05) is the designed example.

---

### 6. Phone Home (`s/home/mobile.html`; routes `home` <700px, `#after`, `#chat`)

One self-contained file (own CSS, own render script; Appendix C). `.app` max-width 560px centred (outside it the page bg is `#dfe5ee`), `padding-bottom:120px`, `overflow-x:clip`. State: `AFTER = location.hash==='#after' || localStorage vcfo.after===true`.

#### 6.1 Inventory

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | M-01 | Top bar | sticky 56px, white 94% + blur 8px, border-bottom: 44px menu button (`data-vp-menu` → shell drawer `vcfoOpenSide()`, fallback internal drawer M-30) · logo (VCFO icon 23×26) + "Home" (800 15px) · spacer · 44px Search (opens search sheet M-25) · Announcements (→ `announcements`) · Notifications (primary colour, badge "3" 17px) (→ `notifications`). |
| ☑ | M-02 | Skeleton (L1) | `#app.sk` on load: every `.card` and `.greet` hides its children and shows a shimmer block (`inset:12px;radius 6px`; gradient 600px, `sh 1.2s linear infinite`; greet uses navy shimmer). Removed after 450 ms (0 with reduced motion), then count-up + draw-in. |
| ☑ | M-03 | Stagger | `.wrap>*{animation:fu .3s cubic-bezier(.22,1,.36,1) both}` (opacity, translateY 8px), delay `i*0.06s`. |
| ☑ | M-04 | Greeting | `.greet` navy (flat `var(--navy)`, not gradient), radius 12, padding 14px 14px 12px, radial gold glow top-right (180px). Date mono 11px .08em oklch(82% .03 255); h1 700 19px/1.2 max-width 260px. Ring button 62×62 (SVG r 26, stroke 6, track white 14%, gold arc round caps, animates `stroke-dasharray` 1s cubic-bezier(.22,1,.36,1)); value 700 14px Space Grotesk counts up; label "SPICE+"/"SETUP" under it. aria "Incorporation 43% — open steps" → steps drill. |
| ☑ | M-05 | Stats | Grid 3 columns (first 3 stats) + grid 2 columns (last 2), gap 6, margin-top 16/6: each a button (white 8% bg, radius 8, padding 8) with value (600 20px Space Grotesk; numbers count up 900 ms ease-out-cubic) + label (11.5px). Before: 4 Waiting on Northwind · 1 With SBC · 1 Overdue · 4/6 Docs in · 28 Oct Expected COI. After: 4 Waiting on Northwind · 1 Overdue · 3 Due soon · 5/13 Registrations · 24 Oct Incorporated. Taps: Waiting → steps drill tab "Northwind"; With SBC → steps drill tab "SBC"; Overdue/Due soon → "Due and overdue" drill (tabs Overdue 1 · Due soon 3; before overdue row "Passport copy — Meera Shah · Sent back 3 Oct · fix now" → incorporation; after "TDS Payment · Oct 2026 · Overdue 1 day · Northwind" → compliances; Due soon rows EPF/ESI/PT → compliances); Docs in → "Documents" drill (In 4: Director 1 — passport, Name approval letter, Signed Board Resolution, Capital structure note; Missing 2: Utility bill — office, NOC from the owner, due 9 Oct) → documents; Registrations → "Registrations" drill (Done 5 · With SBC 2 · Upcoming 6); Expected COI / Incorporated → go `incorporation`. |
| ☑ | M-06 | Greeting buttons | Row of 2 equal 40px buttons: gold "⬇ Download report" (GR-04) and translucent "Open Incorporation" (→ incorporation). |
| ☑ | M-07 | Card chrome | `.card.t` (gold 34×3 tab at left 14px), header `.ch` padding 14px 14px 10px, title `h2` 800 12px uppercase .07em navy + (i) (24px button, 8px hit expansion; pop 250px max). Optional footer `.go` (full-width, border-top hair, padding 11px 14px, 800 12px primary, chevron). |
| ☑ | M-08 | Needs | Card "Needs from Northwind" + pill (38px buttons) Upload 2 · Fill 1 · Correct 1 · Sign 0 (after: Upload 2 · Fill 1 · Correct 0 · Sign 1). Rows (52px min): date tile 42×46 (over = red, due = amber, up = raised grey, navy) · title (700 13.5px) + subtitle (11.5px muted) · 40px button (navy if overdue else outline). Before rows: Upload: "Utility bill — office" "Step 7 · asked by Arjun Mehta" 9 OCT; "NOC from the owner" same 9 OCT; Fill: "Subscriber details" "Step 9 · 3 fields left" 10 OCT; Correct: "Passport copy — Meera Shah" "Sent back · blurred scan" 5 OCT over, button "Fix". After: Upload "October salary register" "Payroll · asked by Priya Raman" 13 NOV; "Bank FIRC + KYC letter" "FC-GPR · asked by Arjun Mehta" 20 NOV; Fill "TDS payment details · Oct" "Overdue 1 day" 07 NOV over; Sign "Board minutes — 1st meeting" "Sign with DSC" 12 NOV. Empty tab → bot bubble "Nothing to <verb> right now. You are all caught up here." + "Ask VCFO why" (opens chat). Actions: ND-07/ND-08. (Phone demo data differs from desktop — see Q8.) |
| ☑ | M-09 | Who holds it now (before) | Focus track (DECISIONS style E): dashed 4px rail at left 25px with green fill animating to 34% height (.9s, delay .2s); "✓ 5 done · Phase 1" green fold chip (→ steps drill Done); step rows with set-A status glyph (24px circles: done green ✓, now navy + gold clock with pulsing gold ring 1.9s, you amber person, sbc blue arrow, up light grey, late red !) + name + caption; current step rendered as a navy card (radius 12, shadow) with gold eyebrow "NOW · STEP 7 OF 14", title, caption "Step 7 · Northwind · due 9 Oct" and sub-step ticks (2 done green, 1 gold, 1 grey); rows: Capital Structure (Step 6 · done 1 Oct) · Registered Office Address (current) · Proposed Directors (Step 8 · Northwind · in progress) · Subscriber Details (Step 9 · Northwind · in progress) · KYC Review & DSC (Step 10 · SBC · in progress) · SPICe+ Confirmation (Step 11 · Northwind · from 16 Oct); bottom fold "+3 more · SPICe+ filing → COI" (→ drill Upcoming). Each row → steps drill on its group. Footer "Open step 7 →" (→ incorporation). Glyph tooltips: "Waiting on Northwind · due 9 Oct", "In progress · You", "With SBC". |
| ☑ | M-10 | Timeline (before) | Header "Timeline" + (i) + outline "Edit" (opens tl-editor). Gantt rows grid `112px 1fr`, gap 9: label 700 11.5px + 14px track; bars animate scaleX .8s with `i*0.08s` delay: Phase 1 · Name Application 0–18% green; "Phase 2 · 22%" 20–68% navy-3; MCA review 68–86% up; "COI · 28 Oct" 88–90% gold; red "Today" line at 47% with "Today" label. Each row → steps drill. Footer "Open Incorporation →". After: rows all green ("COI · 24 Oct" gold), no Today line, no Edit, (i) "Incorporation is complete." |
| ☑ | M-11 | Important alerts (before only) | (i) "Dated items only, nearest first." Rows: 09 OCT 2 office documents In 3 days (due) / 10 OCT MOA & AOA drafts In 4 days (due) / 14 OCT Approved name expires In 8 days (up) → drill "Important alerts". No overdue hero on phone. |
| ☑ | M-12 | What SBC is doing | Rows: glyph (sbc if >0% else up) + name + 8px bar (blue oklch(56% .19 262)) + mono "%"; before KYC Review & DSC 30, MOA & AOA drafts 0, DSC for both directors 0, File SPICe+ Part B 0; after PT Registration 70, IEC Registration 50 → drill. |
| ☑ | M-13 | What is next (after) | Pill 15 days 4 · 30 days 6 (toast only: "Showing the next 15 days · 4 filings" / "… 30 days · 6 filings"; list does not change — wire it). Rows: tile · title · "<when> · <owner>" · ↗ portal link (new tab) · → drill "Due and overdue". Footer "Open Compliances →". |
| ☑ | M-14 | Compliance status (after) | 6.1/CS-04. Footer "Open Filings →". |
| ☑ | M-15 | Company IDs (after) | ID-05. |
| ☑ | M-16 | Registrations (after) | RG-04. |
| ☑ | M-17 | Post-incorporation setup (after) | PI-06. |
| ☑ | M-18 | Recent documents | RD-06; before rows JPG Director 1 — passport 6 Oct · PDF Name approval letter 24 Sep · PDF Signed Board Resolution 18 Sep · DOCX Draft Board Resolution 16 Sep; after PDF Certificate of Incorporation 24 Oct · Board meeting minutes 2 Nov · GST certificate 1 Nov · Share capital FIRC 2 Nov. |
| ☑ | M-19 | Recent activity | Pill All · SBC · Northwind; rows glyph + text + "<date> · <who>". |
| ☑ | M-20 | Card order | Before: greet, Needs, Who holds it now, Timeline, Important alerts, What SBC is doing, Recent documents, Recent activity. After: greet, Needs, What is next, Compliance status, Company IDs, Registrations, Post-incorporation setup, What SBC is doing, Timeline, Recent documents, Recent activity. (No Steps card and no Compliance-by-area card on phone.) |
| ☑ | M-21 | Bottom sheet | `.sheet` fixed bottom, width min(100%,560px), max-height min(82vh,100dvh-24px), radius 14 14 0 0, grab handle 40×4, header h3 800 16px + 44px close; slides `translate(-50%,105%)→0` with the spring (.38s); scrim fades .2s; body `sheet-open` hides the prototype bar and the launcher pill; Esc/scrim/× close; focus returns to the opener; re-tapping the same opener toggles it closed. Used for drills, upload, reveal, search, chat. |
| ☑ | M-22 | Drill in sheet | Pill of parts (selected = clicked) + rows (`.row` buttons with glyph, title, sub, chevron) → close + go route; empty → bot "Nothing here right now." Steps drill "Incorporation steps": Done 6 · Northwind 3 · SBC 1 · Upcoming 4 with the 14 STEPS (Client Details "Step 1 · done 12 Sep", Draft BR "done 16 Sep", Signed BR "done 20 Sep", Name Application "done 24 Sep", Name Approval "done 24 Sep", Capital Structure "done 1 Oct", Registered Office Address "Step 7 · Northwind · due 9 Oct", Proposed Directors, Subscriber Details, KYC Review & DSC "Step 10 · SBC · in progress · 13 Oct", SPICe+ Confirmation "Step 11 · 16 Oct", SPICe+ Filing 20 Oct, MCA Remarks 24 Oct, Certificate of Incorporation 28 Oct). |
| ☑ | M-23 | Launcher | The board's own `.launch` is hidden (`display:none!important`); `window.__vcfoOwnChat=true` makes the global pill open THIS file's chat sheet (M-26). The robot sinks while scrolling (`.sink`, 420 ms debounce) — DECISION "Robot while scrolling: sinks down". |
| ☑ | M-24 | Count-up | `[data-count]` numbers animate 0→N over 900 ms (ease-out cubic) after the skeleton; skipped for non-integers ("4/6", "28 Oct"). |
| ✗ | M-25 | Search sheet | "Search" sheet: 44px input "Search steps, filings, documents" + sample results Registered Office Address (Step 7 · Incorporation) / Certificate of Incorporation (Document → documents) / GSTR-3B · Oct (Filing → filings). Real: shell command palette (⌘K) — owned by shell agent. |
| ☑ | M-26 | Chat sheet (`#chat`, launcher) | Sheet "Ask VCFO": bubble "Hello. Ask me anything about Northwind’s setup, or pick a question below." · suggestion buttons (40px, primary-light) · compose (42px input + navy Send). Before Q&A: "What is my next step?", "Where is my incorporation now?", "Which documents are missing?"; after: "What is due next?", "Which registrations are pending?", "When is FC-GPR due?" (answers 7.1). Typing dots 900 ms; unknown → "I can’t answer that one yet. I’ve passed it to Northwind’s project lead." + "Hand off to Arjun Mehta" → toast "Arjun Mehta will reply by email within 1 working day" + Undo. `#chat` hash opens it 700 ms after load. |
| ☑ | M-27 | Report | GR-04 phone behaviour. |
| ☑ | M-28 | Proof chip | → `doc-viewer`. |
| ☑ | M-29 | Download | toast "Download started · <name>". |
| ✗ | M-30 | Fallback drawer | Only if shell.js is missing: navy drawer (300px) with links Home (current, inset 3px blue bar) / Updates / Incorporation / Compliances / Documents / Library / Team / Audit, "Northwind’s team" (PR Priya Raman Project Manager, AM Arjun Mehta Project Lead, ☎ Customer support "SBC help desk · +91 90597 90014"), account link "Rahul Khanna · Northwind · Client" (name inconsistent with Rohan Kumar, Q9). |

#### 6.2 Phone breakpoints
`mobile.html` is used below 700 px. Between 700 and 767 the DESKTOP board renders with phone rules (`max-width:767px` blocks in Appendix A: menu button shown, crumb hidden, 40px touch targets, pills wrap, no card hover lift, `.vh-pbar` 52px bar for pop-up boards). In the real app there is one responsive page: use the phone composition (6.1) below 768 px (README contract says phone ≤767) and drop the 700 px file swap.

---

### 7. Ask VCFO chat

#### 7.1 Runtime chat (what users actually get in the prototype; proto.js `#vp-chat`)

| Done | id | item | behaviour / content |
|---|---|---|---|
| ☑ | C-01 | Window | Floating card above the launcher pill: `right:var(--vpl-in)`, width clamp(340px,24vw+40px,440px), height min(clamp(480px,62vh,680px), viewport minus pill), radius 12, 1px border, shadow `0 24px 60px -20px`. Opens with `translateY(12px) scale(.96)` → none, opacity, .26s cubic-bezier(.22,1,.36,1) from bottom-right origin. Phone ≤767: full-width bottom sheet, radius 16 16 0 0, height min(640px, 100dvh − 20px − peek), safe-area padding, 40px+ targets, input 16px font. |
| ☑ | C-02 | Peek character | The robot peeks over the top edge once per open: hands grip in (.32s, right hand +.09s), head rises (.95s cubic-bezier(.3,.75,.35,1), delay .22s), looks left/right (2.2s from 1.25s), then blinks every 6.5s. DECISION "Peek animation plays once when the chat opens". |
| ☑ | C-03 | Header | Navy bar: 36px white circle with static head · "Ask VCFO" (800 14px) / "Answers from Northwind’s project data" (11.5px #c7d2e2) · 36px "×" close (aria "Close chat"). |
| ☑ | C-04 | Messages | `aria-live=polite` list: first bot bubble "Hello. Ask me anything about Northwind’s setup, or pick a question below."; user bubbles navy right (radius 10 10 2 10); bot bubbles light (#f1f4f8, radius 10 10 10 2), max 84%. Log persists in `sessionStorage vcfo.chat`. |
| ☑ | C-05 | Suggestions | Wrap row of chips (32px; primary-light, 1px rgba(46,92,255,.35)): before "What is my next step?" / "Where is my incorporation now?" / "Which documents are missing?"; after "What is due next?" / "Which registrations are pending?" / "When is FC-GPR due?". |
| ☑ | C-06 | Answers | Before: next step → "Step 7 · Registered Office Address is waiting for Northwind. Upload the utility bill and the owner NOC by 9 Oct, then approve. Steps 8 Proposed Directors and 9 Subscriber Details are also in progress with Northwind." · where → "Northwind is in Phase 2 · Incorporation: 1 of 9 steps done, 6 of 14 SPICe+ steps overall (43%). Step 7 is waiting for Northwind, steps 8 and 9 are in progress with Northwind, and step 10 KYC Review & DSC is with SBC. The COI is expected on 28 Oct." · missing → "Two, both for step 7 · Registered Office Address: the office utility bill and the NOC from the owner. Both are due 9 Oct." After: due next → "TDS Payment · Oct 2026 is overdue by 1 day. Next are EPF and ESI on 15 Nov." · registrations → "Two are with SBC: PT Registration (est. 12 Nov) and IEC (est. 14 Nov)." · FC-GPR → "2 Dec 2026, day 6 of the 30-day window. Upload the bank FIRC + KYC letter first." |
| ☑ | C-07 | Thinking | Typing bubble with 3 dots (`vpTh 1s`, .2s/.4s delays) for 900 ms; antenna pulses (`vpc-think`). |
| ☑ | C-08 | Moods | Answered → antenna green #22C55E + hop (.7s); cannot answer → grey #94A3B8 + dip (1.2s). DECISION: green = answered, grey = can't answer; face always smiling. |
| ☑ | C-09 | Can't answer | "I can’t answer that one yet. I can pass it to Northwind’s project lead." + button "Hand off to Arjun Mehta" → appends "Sent to Arjun Mehta. You will get a reply by email within 1 working day." + toast "Handed off to Arjun Mehta" (Undo). |
| ☑ | C-10 | What's this? card | When a screen provides `window.vcfoWhatsThis(q)` (Incorporation pages), the answer renders as a card: title, paragraph, "Why it matters to Northwind" block, "Source: …", and a button "Open this step"/"Open <page>" → route. |
| ☑ | C-11 | Composer | 40px input "Type a question" + navy Send; empty submit → focus + toast "Type a question first, or pick one above". Esc closes. Focus moves to input on open, back to the pill on close. |
| ☑ | C-12 | "Ask VCFO about this" | From any (i) pop-over → opens chat and asks "Tell me about <heading>". |

Real app: `src/components/ask/*` (AskLauncher, AskPanel, AskComposer, AskHandoffForm, WhatsThisButton, AskProvider), hooks `src/hooks/ask/*` (`use-ask-status`, `use-ask-suggestions`, `ask-api`), routes `POST /api/ask/chat` (NDJSON stream: status labels + one answer), `GET /api/ask/suggestions`, `POST /api/ask/handoff` (→ `createAskHandoff`: task for the lead + bell), `GET /api/ask/status` (launcher enabled), `GET /api/ask/library`, `GET /api/ask/brief`, `GET/POST /api/ask/nudge` (first-visit note "once per client" → `ask_client_prefs`). Spec: `docs/specs/ask-vcfo`. All existing; Home only needs to mount the launcher and pass "Ask VCFO about this" questions.

#### 7.2 Design boards `v7chat_*` (1440×900 canvases over `v7_before`)

| Done | id | board | content |
|---|---|---|---|
| ☑ | CB-01 | `v7chat_launcher` | Closed state with first-visit note: card 300px (radius 10, shadow) above the launcher, slides up `v7up .35s` after .9s: "Hello. Ask me anything about Northwind’s setup, or pick a question below." + dismiss × (24px) + 2 suggestion chips (30px) "What is my next step?" / "Where is my incorporation now?". Navy "Ask VCFO" label + 68px round launcher (bobbing 2.6s). DECISION: first-visit bot note once per client. |
| ☑ | CB-02 | `v7chat_home` (state v=home) | Panel 400×640 at right 24 / bottom 104, radius 12, `animation:v7up .3s`. Header navy: 36px avatar · "Ask VCFO" / green dot "Answers from verified sources" · 32px "Expand to side panel" · 32px close. Navy hero "Hello," / "Northwind Technologies" (metric 21px) overlapped by a white project card: "NORTHWIND’S PROJECT" + chip "SPICe+ Part B" (prog) / "Registered Office Address" (700 13.5px) / 5px progress bar 18% / caption "7 of 38 steps done". "QUICK QUESTIONS" + 2-tab pill "About Northwind’s project 2" · "Learn the basics 4"; tab 0: "What is my next step?", "Where is my incorporation now?" (→ thinking → answer after 1600 ms); tab 1: "What is SPICe+ Part A?", "What is GST, and do we need it?", "What happens after incorporation?", "What is FC-GPR?" (40px rows with → arrow). "PICK UP WHERE NORTHWIND LEFT OFF": Last conversation (i "What is SPICe+ Part A?") · Northwind’s Library (i "Explanations Northwind saved from Ask VCFO") · Monthly status brief (i "PDF · October 2026"). DECISION: "Pick up where you left off" = 1 item (board shows 3 links: conversation is the 1 item; Library + brief are shortcuts). Composer: input "Ask about Northwind’s setup…" (38px) + (i) "Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions." + 38px Send (40% opacity when empty). Peek image `vcfo-bot-peek.svg` 132×107 above the panel (white outline drop-shadows). Launcher becomes a navy close button. |
| ☑ | CB-03 | `v7chat_thinking` (v=thinking) | Header gains a back button. User bubble "Where is my incorporation now?" (right, radius 12 12 4 12, light grey). Bot row: 28px avatar + typing dots + sr-only "Finding sources…" + 3-stage status list: ✓ "Checking Northwind’s project…" (ok-text) · spinner "Finding sources…" · dashed circle "Writing…" (subtle). |
| ☑ | CB-04 | `v7chat_answer` (v=answer) | Avatar does `react` (.55s scale/rotate). Answer card: chip "✓ Reviewed by SBC" (ok-light) · "7 of 38 steps are complete. You're in SPICe+ Part B, on Registered Office Address.¹" · 2×2 phase grid (each `.tipw`, click → drill "Where Northwind’s incorporation is": SPICe+ Part A 5 · SPICe+ Part B 9 · Post-incorporation 11 · Registration 13): "DONE / SPICe+ Part A / 5 of 5" (grey-tint), "NORTHWIND IS HERE / SPICe+ Part B / 2 of 9" (primary border + primary-light), "NEXT / Post-incorporation / 0 of 11" (dashed), "NEXT / Registration / 0 of 13" (dashed) · gold-ruled "Why it matters to Northwind — Each phase unlocks the next, so this is the step that moves Northwind forward." · buttons "Open Incorporation →" (primary outline) / "Open Registered Office Address →" · "SOURCES ¹ Northwind’s project". Under the card: "Ask my lead" small button · "Helpful?" 👍 👎 (30px). DECISION: keep 👍/👎. |
| ☑ | CB-05 | `v7chat_handoff` | Question "Can our registered office be a co-working space?" → card chip "AI answer · check with Northwind’s lead" + "I’m not certain about this one. Northwind’s project lead can answer it." + highlighted "Ask my lead". Hand-off form (border-top 3px primary): person row (36px photo placeholder, "Arjun Mehta" + (i) "Project Lead · replies by email", caption Project Lead) · label "Ask Northwind’s project lead" + (i) "The last 4 messages go with it, so they have the context." · textarea (3 rows, prefilled with the question) · Cancel (ghost) / primary "Send to lead". Sent state: green status strip "Sent to Northwind’s project lead. They’ll reply by email." + "Close". |

Inconsistencies: CB-02 says "7 of 38 steps" (= 9-step SPICe+ Part B counted… prototype mixes 38/48 totals); runtime says "6 of 14 SPICe+". Phase 4 shown as 13 here vs 23 in the Steps card. See Q3.

---

### 8. Pop-up boards and the timeline editor

All pop-up boards sit over a dimmed Home (`oklch(20% .05 258 / .55)`), dialog `role=dialog aria-modal=true`, white, radius 12, shadow `0 24px 60px -20px oklch(15% .05 258 / .55)`; header row padding 14px 18px with title `700 15px` navy + (i) + 30px outlined × close; footer bar `padding:12px 18px;border-top;background:var(--raised)`.

#### 8.1 Step pop-up (`v7p_step`, 760px wide, top 24px, over v7_before)

Not routed in the prototype (design board). Real use: step detail pop-up opened from Home step rows/chips (rule 13 allows pop-ups for step details); "Continue step" goes to the step page.

| Done | id | item | content |
|---|---|---|---|
| ☑ | SP-01 | Hero header | Navy gradient (115deg navy→navy-2 70%→navy-3), padding 16px 20px 14px, gold 3px underline: mono gold eyebrow "STEP 7 OF 14 · PART B" · 32px close (white 12%) · h2 metric 24px "Registered Office Address" + white (i) "Office address for the company, with proof of address and the owner's NOC." · chips: "Waiting on Northwind" (due-chip, min 116) · "Due 9 Oct · 3 days" (over-chip) · "Owner · Northwind" (white 16%). |
| ☑ | SP-02 | Timeline (option A "Connected chips", picked) | 4 stage chips joined by 2px connectors: **Started** (ok-light, ✓ icon, "2 Oct", (i) "Rohan Kumar started this step on 2 Oct 2026.") —gradient ok→navy— **Submitted** (navy filled, gold pulsing dot, "Due 9 Oct", (i) "Waiting for Northwind. Due 9 Oct 2026, in 3 days.", 4px navy halo) —dashed— **Reviewed** (dashed border, hollow dot, "Arjun Mehta", (i) "Arjun Mehta, Project Lead, checks the documents.") —dashed— **Completed** ("Priya Raman", (i) "Priya Raman, Project Manager, signs off."). |
| ☑ | SP-03 | Needed from Northwind | Label + count chip "2" (due-chip); amber box (due-light, 1px oklch(66% .17 48 / .35), radius 8): rows checkbox (due border) · "Utility bill for the office" (i "Electricity or water · Max 2 months old · Asked by Arjun Mehta · Due 9 Oct") · outline "⬆ Upload" (30px, min 88); "NOC from property owner" (i "Signed, on plain paper · Asked by Arjun Mehta · Due 9 Oct") · Upload. |
| ☑ | SP-04 | Documents | Row (title "Open preview", clickable): 32px PDF badge · "Rent agreement" (i "Uploaded by Northwind on 2 Oct 2026.") · chip "Uploaded" (ok) · 28px 👁 Preview / ⬇ Download. Missing rows (dashed rows per DECISIONS "missing files as dashed rows"; here grey icon tile): "Utility bill" (i "Electricity or water · Max 2 months old") chip "Missing" (over) · "NOC from property owner" (i "Signed, on plain paper") Missing. DECISION rule 8: no "Not uploaded" text under a Missing badge. |
| ☑ | SP-05 | What was provided | 2-column definition grid: Address (span 2) "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103" · State Karnataka · Premises Leased · Owner "—" (i "Not given yet. Northwind adds this when the step is completed.") · Proof of address "—" (same i). |
| ☑ | SP-06 | Footer | Primary "Continue step →" (→ step page) · outline "🤖 Ask VCFO about this step" (opens chat) · outline "✉ Message Arjun (lead)". |

Data: step slice from `checklist_state` (status, `clientSubmittedAt`, `reviewedAt/By`, `completedOn`), responses via `extractItemResponses` (`src/lib/checklist-responses.ts`), required docs/needs (NEW needs list), step files (`listDocuments` with `step_id` / milestone paths), schedule window. "Message Arjun" → NEW or existing messaging (`app/app/client/messages` folder exists) / `POST /api/ask/handoff`.

#### 8.2 Compliance pop-up (`v7p_compliance`, 760px, over v7_after)

| Done | id | item | content |
|---|---|---|---|
| ☑ | CP-01 | Header | "Compliances · FY 2026-27" + (i) "As of 8 Nov 2026" + ×. |
| ☑ | CP-02 | Tabs | 5-tab pill: All 38 · Filed 1 · Due soon 3 · Overdue 1 · Upcoming 33 (opens on the clicked donut part; board default tab 1 = Filed). |
| ☑ | CP-03 | Table | Filing · Period · Area · Due / filed (mono right) · Status chip: TDS Payment Oct 2026 Income tax 7 Nov 2026 Overdue · EPF Return & Payment Oct 2026 Payroll 15 Nov 2026 Due soon · ESI Payment … 15 Nov 2026 Due soon · PT Payment … 20 Nov 2026 Due soon · ADT-1 (auditor appointment) FY 2026-27 MCA "Filed 5 Nov 2026" Filed · FC-GPR Filing "Share allotment" FEMA 2 Dec 2026 Upcoming · TDS Payment Nov 2026 7 Dec · GSTR-1 Nov 2026 GST 11 Dec · GSTR-3B Nov 2026 20 Dec · Commencement (INC-20A) One-time MCA 22 Apr 2027 (Upcoming). |
| ☑ | CP-04 | Footer | caption "Showing k of n · full list in Filings" / "Showing all n" + outline "Open Filings" (→ `filings`). |

Data: `getFilings` (`GET /api/filings?engagementId=&fy=`), status buckets as 5.12.

#### 8.3 PAN/TAN password reveal (`v7p_ids_password`, route key `ids-password`, over v7_after)

| Done | id | item | content / behaviour |
|---|---|---|---|
| ☑ | IP-01 | Frame | Full-viewport board (`100vh`), dim layer `.vh-under-bar` (starts under the 52px phone bar ≤767); dialog `width:min(400px,100%)` centred, padding 12 around. Phone: `.vh-pbar` (menu + logo + "Home"). |
| ☑ | IP-02 | Header | "Confirm it's you" + (i) "Enter your password to show your PAN" + × (30px). |
| ☑ | IP-03 | Field | Label `.lbl` navy "Password"; 40px input row (`border:1.5px solid var(--over)` in the error state shown), `type=password`, value "sbc-demo-pass" read-only in the board, 600 15px, letter-spacing .12em; 30px "Show password" eye toggle (raised bg). |
| ☑ | IP-04 | Error | `role=alert` over-text 12px/700 with alert icon: "Wrong password. 2 tries left." |
| ☑ | IP-05 | Link | "Forgot password?" (12px) → account password reset (real: existing auth flow / `app/api/account/password`). |
| ☑ | IP-06 | Footer | (i) "Shown for 60 seconds" · outline "Cancel" · primary "Confirm". |
| ☑ | IP-07 | States to build | idle (normal border) → submitting → success (close, value shown in green for 60 s, auto re-mask; toast "PAN shown for 60 s") → wrong (red border + "Wrong password. N tries left.") → locked after 3 wrong (disable, "Too many tries. Try again in m:ss" — copy NEW, mirror credentials lock). Esc / × / Cancel close. |
| ☑ | IP-08 | Backend | NEW `POST /api/client/identifiers/reveal` (see 5.13). Note the Credentials page uses a DIFFERENT gate (manager OTP) for the same PAN — Q2. NEW: `POST /api/client/identifiers/reveal`, table `identifier_reveal_attempts`, `revealIdentifier()` in `src/db/repositories/credentials.ts`. |

#### 8.4 Timeline change request board (`v7p_timeline_client`, 980px)

| Done | id | content |
|---|---|---|
| ☑ | TC-01 | Title "Request a timeline change" + (i) "Northwind Technologies India Pvt Ltd · client request". |
| ☑ | TC-02 | Info strip (prog-light, 3px prog left border): "The change is a request. Priya Raman (manager) approves or rejects it." |
| ☑ | TC-03 | Toolbar: Undo / Redo (30px icon buttons) · "Snap" + pill Day · Week · right chip "COI would move 4 days" (due-chip). |
| ☑ | TC-04 | Chart (rows 40px): navy floating label "24 Oct 2026 · +4 days" above the dragged edge; ghost bars (1.5px dashed subtle, 8% tint) = before; after bars with 2px red outline = critical path; Phase 2 bar has 10px drag handles on both ends (white, primary ring, ew-resize). Legend: Before (dashed) · After (prog) · Critical path (red ring) · Today (red line). |
| ☑ | TC-05 | Change table: Phase · Before (struck through) · After · Change chip: Phase 2 · Incorporation 25 Sep - 20 Oct → 25 Sep - 24 Oct "+4 days" · MCA review 20 Oct - 28 Oct → 24 Oct - 1 Nov "moved +4" · COI 28 Oct 2026 → 1 Nov 2026 "+4 days". |
| ☑ | TC-06 | "Reason for the change" textarea (3 rows): "Office NOC from the landlord will arrive on 22 Oct." |
| ☑ | TC-07 | Footer (i) "Nothing changes until SBC approves" · Cancel · primary "➤ Send request". |

#### 8.5 Timeline manager board (`v7p_timeline_manager`, 980px)
Same as 8.4 with: title "Edit timeline" ((i) "… · manager edit"); no info strip; toolbar adds divider, "Zoom" pill Week · Month, chip "COI slipped by 4 days" (over-chip); "Change history" list (mono 110px time · text · actor): 6 Oct 2026 10:42 "Phase 2 end 20 Oct → 24 Oct (draft)" Priya Raman / 1 Oct 2026 16:05 "Phase 1 closed on 24 Sep" Priya Raman / 12 Sep 2026 11:20 "Timeline created" Priya Raman; footer (i) "On save: email and WhatsApp to admin, manager, lead and client" · Cancel · primary "Save changes".

#### 8.6 Live timeline editor (`final-src/tl-editor.js`, opened by "Edit" on the Timeline card)

| Done | id | item | behaviour |
|---|---|---|---|
| ☑ | TE-01 | Model | Axis origin T0 = 12 Sep 2026, card span 57 days; "world" −42…+110 days (1 Aug → 31 Dec 2026). Phases: a "Phase 1 · Name Application" 12 Sep–24 Sep **done (locked)** ok colour; b "Phase 2 · Incorporation" 25 Sep–20 Oct navy-3; m "MCA review" 20 Oct–28 Oct oklch(70% .03 255); c "COI" 28 Oct milestone (diamond, gold). Saved state in `sessionStorage vcfo.tl.saved`, pending client request in `vcfo.tl.pending`, last mode in `vcfo.tl.mode`. |
| ☑ | TE-02 | Dialog | Scrim rgba(8,20,40,.5) (fade .18s); `#tle` width min(1080px,100%), max-height 100dvh−32, radius 12, enters `translateY(10px) scale(.98)`→none .26s. Phone ≤767: bottom sheet (radius 14 14 0 0, max-height 92dvh), date column hidden, 40px buttons. |
| ☑ | TE-03 | Header | h2 "Edit timeline" / "Request a timeline change" (client mode) + mode toggle (aria "Who is editing"): "Manager · direct edit" / "Client · change request" (pressed = navy) + 36px × (aria "Close editor"). In the real app the mode is the user's role (client → request; manager → direct) — no toggle. |
| ☑ | TE-04 | Tools | "↶ Undo" (disabled when no history; 60-step history) · "Reset" (to saved, toast "Reset to the saved timeline") · hint "Drag a bar to move it · drag its edges to change dates · snaps to days|weeks · ctrl + scroll or pinch to zoom" · zoom group: − / range slider (log scale) / + / level label Days·Weeks·Months / "Fit". |
| ☑ | TE-05 | Grid | 3 columns `170px | viewport | 150px` (1023px: 140/120; phone 96px + viewport): names (🔒 on done phase), lanes 52px with ruler 44px (month labels at the 1st, day/week ticks by zoom; weekends lighter), dashed ghost of the saved bar, the bar (26px, radius 5, shadow; done = striped + not-allowed), today red line + "Today 6 Oct" tag, right column "d Mon – d Mon" + change chip "+N d" (late red #b42318 on #fde8e6) / "−N d" (early green #0f7a55 on #e3f6ee). |
| ☑ | TE-06 | Drag | Pointer drag on the bar moves it; on the 12px edge handles resizes start/end; snaps to 1 day (or 7 days when zoomed out <8 px/day); a floating navy read-out above the bar "d Mon – d Mon · N days" (visible on hover/focus/drag). Dragging adds a gold ring. Keyboard: bar is `role=slider` (aria-valuetext = read-out); ←/→ moves by the snap; Shift+←/→ changes the end. Done phase: toast "Phase 1 is done, so its dates are locked". |
| ☑ | TE-07 | Cascade | A phase never starts before the previous one ends; when a phase grows/moves later, following phases shift by the same amount keeping their lengths; milestone follows. |
| ☑ | TE-08 | Zoom/pan | ctrl/⌘ + wheel zooms around the cursor; wheel scrolls horizontally when zoomed in; mouse drag on empty lane pans; two-finger pinch zooms; "Fit" = 12 Sep → 8 Nov; min = whole world, max 48 px/day. |
| ☑ | TE-09 | Summary | Grey box: "COI 28 Oct → 1 Nov" + pill "Slipped by 4 days" (late) / "Pulled in by N days" (early) / "No change to the COI date" (same) + hint when slipped "MCA review and the COI move with Phase 2. The client is told by email and WhatsApp." |
| ☑ | TE-10 | Compare | Two boxes "BEFORE" / "AFTER" listing each phase and its dates. |
| ☑ | TE-11 | Client reason | Client mode only: label "Why do you need this change?" + textarea placeholder "For example: our director is travelling until 14 Oct, so the KYC video call has to move." + error (hidden until needed) "Add a short reason so Northwind’s project manager can approve it." |
| ◐ | TE-12 | Footer | Warning text — manager: "Saving updates the dashboard for everyone on Northwind."; client: "Priya Raman (Project Manager) approves requests. Northwind’s dates stay as they are until then." · Cancel · navy "Save timeline" / "Send request". |
| ◐ | TE-13 | Commit | No change → toast "No changes to save". Client: reason required → store pending, close, add the pending chip to the card (TL-01), toast "Change request sent to Priya Raman" + Undo (removes the request). Manager: save, close, animate card bars, toast "Timeline saved · COI d Mon · slipped by N d" + Undo (restores previous). Esc / scrim / × close without saving. |

Backend: manager save → existing `setEngagementWindow` (`src/db/repositories/schedule.ts`, route `/api/engagements/[id]/schedule`, role check `canSetScheduleWindows`), store per-phase windows as step windows (first/last step of the phase) or add phase-level keys to `schedule` (NEW shape `schedule.phases[phaseId]`). Client request → NEW `engagement_change_requests` kind `timeline` (5.7) + manager approval UI (manager area). Audit on both. Notifications: email + WhatsApp (NEW notify event `timeline_changed`, templates in `src/lib/notify/templates.ts`, see `docs/context/notes/aws.md`).

---

### 9. Credentials page (`v7p_credentials.dc.html`, route `credentials`)

A full page, not a pop-up. Sidebar item "Credentials" (key-round icon) between Library and Team. Purpose: the company's government-portal IDs, logins and passwords, directors' KYC and addresses, kept as a spreadsheet-like workbook; secret values are masked and every Preview / Edit / Reveal needs a 6-digit OTP that is sent to the client's **Project Manager** (not to the client), and every access is logged.

#### 9.1 Layout

| Done | id | item | content |
|---|---|---|---|
| ☑ | CR-01 | Page frame | `.cr-page` flex: `.cr-side` placeholder (`--vp-side-w` 248/72/0) + `.cr-main` (`padding-bottom:96px`) → `.cr-wrap` max-width 1600 centred. |
| ☑ | CR-02 | Top bar | Own copy of the shell bar (`.cr-top` 52px sticky, blur): phone menu · logo (→ home) · trail key icon + "Credentials" · Search (230px; 196 ≤1279; 36px icon ≤959) → toast "Search opens from the shell in the full app" · Announcements → `announcements` · Notifications (badge 3) → `notifications` · Theme. (shell top bar used — the shell supplies it) |
| ☑ | CR-03 | Toolbar | `.cr-bar` (padding 14px 24px 0; 20px ≤959; 16px phone): 32px primary-light key tile · h1 "CREDENTIALS" (800 13px .07em) · Stage pill **Before COI / After COI** (radiogroup; prototype-only, mirrors `vcfo.after`; real app: derived from incorporation, no toggle) · spacer · "🕘 Access log" button · page-level mode buttons: "👁 Preview" + navy "✏ Edit" (when a mode is live: chip "Preview · 9:42" / "Edit · 9:42" countdown + "🔒 Lock"). |
| ☑ | CR-04 | Identifier tiles ("Six across, tinted") | `section.cr-ids` grid 6 columns gap 8 (3 columns ≤1100, 2 ≤560): tiles `.cr-ctile` tinted by issuing authority (mca indigo, it teal, gst green, oth amber; `--a-bg`/`--a-fg`), radius 9, padding 9px 10px 10px: uppercase name (800 10.5px) + one 22px icon action, value mono 12.5px. Tiles: CIN (mca), PAN (it), TAN (it), GSTIN (gst), Registrations (oth), DSC holders (oth). BEFORE COI every tile shows "Pending COI" (muted). AFTER: CIN `U72900KA2026FTC198431` + Copy; PAN `AAKC••••1M` + 👁 Reveal (OTP) → after reveal full value + Copy + Hide; TAN `BLRN••••2D` same; GSTIN `29AAKCN4821M1Z5` + Copy; Registrations "PF · ESI · PT" + → (opens sheet tab Registrations); DSC holders "4 holders" + → (opens Directors KYC). (Older screenshot shows big cards with a navy bot bubble "Issued after the Certificate of Incorporation"; FINAL replaced them with these tiles; the `.cr-card` CSS for that variant is still in the file.) |
| ☑ | CR-05 | Workbook | `section.cr-wb` card (margin 14px 24px 0, padding 12px 14px 14px). Header: sheet pill (5 tabs, horizontally scrollable `.cr-segx`; on phone replaced by a `<select>` "Sheet") **Address 3 · Login Credentials 31 · Registrations 20 · Directors KYC 24 · Other credentials 12** (before COI: Other credentials 0) · right: (Directors KYC only) "+ Add director" · sheet-level "👁 Preview sheet" / navy "✏ Edit sheet" / countdown chip + "🔒 Lock". |
| ☑ | CR-06 | Grid | `.cr-gridbox` (scrolls both ways inside its box, max-height 440px; 58vh phone; 1px border radius 8): spreadsheet table `.cr-t` (`width:max-content;min-width:100%`, 34px rows, 44px on phone): sticky header rows — column letters A, B, C… (22px, mono) · optional navy title rows (Login: "NORTHWIND TECHNOLOGIES INDIA PVT LTD - Login Credentials" and navy-2 "Address: 4B, Northwind House, 12 Sample Road, Indiranagar, Near Demo Metro, Bengaluru, Karnataka 560038, India"; KYC: company name) · column names (uppercase 700 11px; 🔒 gold icon on secret columns). Sticky left gutter 84px (row number, or a live countdown "9:41" in prog colour when the row is in a mode; per-row 👁 Preview row / 🔓 Lock row button (only if the row has secrets) and ✏ Edit row / Lock row button); sticky S.No column (56px) on Login/Registrations; sticky label column (200–240px). Editable cells (in edit mode) are tinted cream and show a 1px blue inset on hover. Row hover light blue. Spacer row in Login (14px raised). Excel-like thin borders on Login and KYC (`.xl`). |
| ☑ | CR-07 | Cell types | text (or "—" dash when empty) · secret (masked `••••••` mono muted + 🔒 "Reveal <row> · <col>" + ⓘ "About this field" (toast "<label>: masked. Preview or Reveal needs an OTP from Priya Raman.")) · revealed secret (mono value + Copy; if revealed by a single-cell reveal also a "Visible · 9:58" chip + Hide) · status (chip Active ok / Pending due / Expired over / Not applicable grey; in edit mode a 26px select) · certificate ("📎 file.pdf" link → toast "Opens the certificate in the full app"; "Proof pending" amber chip; "—") · chips "Pending COI" / "Not registered yet" (grey) · source chip under auto-filled values: "Auto · from <source>" (prog-light; tooltip e.g. "Filled from the registered office (Incorporation step 7). Edit to override.") or "Edited" (gold) once changed by hand. |
| ☑ | CR-08 | Sheets | **Address** (3 rows: Registered office, Corporate office, Communication; columns Address type · Door No · Building · Street · Area · Landmark · City · District · State · PIN · Country · Phone · Email · Latitude/Longitude · Ownership · Owner name · NOC (cert) · Utility bill (cert) · Rent agreement (cert); rows 1 and 3 auto from "registered office" (cols B–K) and "client profile" (Phone); no secret columns). **Login Credentials** (31 rows + 1 spacer; columns S.No · Registration · ID 🔒 · Password 🔒 · Mail · Mobile 🔒 · Status): Company CIN, PAN, TAN - Traces Registration, TAN - Income Tax Registration, Employee State Insurance (ESI), Provident Fund (PF), Goods and Service Tax (GST), GST - E-Invoicing, LUT (Letter of Undertaking), HDFC Bank - Bank Logins, Shops and Establishment Act (S&E Act), Professional Tax, Import Export Code (IEC), Mail ID - Company, Non STPI, RBI Entity Logins, RBI Business Logins, FLA, Traces, Zoho Books, Papaya, Pluxee, ADT-1, MCA V3 Logins, NPS, [spacer], CBO, POSH, FLAIR, Address, JPMC logins, Reporting Portal. Mail = compliance@northwind-demo.in, Mobile = +91 98000 00010 for every row (auto "client profile"). BEFORE COI: IDs from the company record show "Pending COI", other IDs empty, passwords empty except Mail ID - Company; statuses mostly Pending (Mail ID/Address Active; Non STPI/FLA/NPS/JPMC Not applicable). AFTER: IDs filled (auto source chips: company record / registration steps / client profile / registered office), passwords demo-pass-NN, statuses Active (LUT/NPS/FLAIR Pending, FLA Expired, Non STPI/JPMC N/A). **Registrations** (20 rows; S.No · Registration · Number · Date of registration · Login ID 🔒 · Password 🔒 · Certificate): GST, PF, ESI, PT, LEI, MSME, ICEGATE, IEC, LUT Filing, Non-STPI Compliance, Shops & Establishment, CLRA, POSH / SHE Box, Trade Licence, Trademark Registration, Trademark Renewal, Patent Registration, ICDR Registration, FCGPR Filing, FDI Reporting (after: numbers/dates/logins/cert files or "Proof pending"; GST/PF/ESI/PT/IEC/LUT numbers auto "registration steps"). BEFORE: Number "Not registered yet" for all, every 3rd Certificate "Proof pending". **Directors KYC** (transposed: 24 "Particulars" rows × one column per director: Rohan Kumar, Meera Iyer, Neha Kapoor, David Clarke; rows DIN, Full Name, First/Middle/Last Name, Date of Birth (secret), Father Name (+ indented First/Middle/Last), Address (tall multi-line), Mobile Number, Mail ID, Passport (secret), Aadhar No (secret), Driving License (secret), PAN (secret), Address Proof (secret), Education Qualification, Category, Duration Of Stay, Place of Birth, Director Role, Aadhar Linked Mobile Number (secret); DIN/name/DOB/address/mobile/mail/PAN auto "incorporation steps"; header cells (director names) editable in edit mode; "+ Add director" adds column "New director"). **Other credentials** (Item · ID 🔒 · Password 🔒 · Linked email · Notes; 12 rows after: Google Workspace admin, Office Wi-Fi admin, Accounting software, Tally licence, Cloud root account, Domain registrar, Team chat admin, Courier account, Office alarm code, Payroll software, Bank token (backup), Website CMS; BEFORE: empty → bot bubble "Nothing here yet. Add a row for any other login Northwind’s team uses."). Login and Other have "+ Add row" under the grid. |
| ☑ | CR-09 | Access log drawer | Right drawer 400px (100vw phone), slides `cr-slide .26s` (translateX 24px + fade), scrim: header history tile + "Access log" + count chip + "📄 Open in Audit" (→ `audit`) + × ; ordered list newest first: mono time "11 Oct 2026 · 11:40" + text. Seed: "Priya Raman edited Address · Corporate office · Street" (10 Oct 16:12) · "Arjun Mehta started Preview · Registrations · OTP approved by Priya Raman" (11 Oct 09:03) · "Rohan Kumar revealed Rohan Kumar · PAN · OTP approved by Priya Raman" (11 Oct 11:40). Footer caption "Previews, edits and saved changes are logged here and on the Audit page". Stored in `localStorage vcfo.credsAudit` (last 200) — the Audit page reads the same key. Esc closes. NEW: `GET /api/client/credentials/log` (audit_events `credentials.*`). |

#### 9.2 The OTP flow (Preview / Edit / Reveal)

| Done | step | behaviour |
|---|---|---|
| ☑ | Scopes | `page` (toolbar Preview/Edit), `tab:<sheet>` (sheet Preview/Edit), `row:<sheet>|<r>` (gutter buttons), `cell:<sheet>|<r>|<c>` (single Reveal; preview only). A cell is visible if ANY covering scope has a live Preview or Edit; editable if any covering scope has a live Edit (never the S.No column, fixed labels, the `ids` table or spacer rows). |
| ☑ | Open | Clicking Preview / Edit / Reveal / row buttons when no live grant → OTP dialog. `Add row` / `Add director` on a sheet without Edit → asks for an Edit OTP first, then runs the action. Clicking a cell while not editable → toast "Read-only. Choose Edit and enter the OTP to change values." |
| ☑ | Dialog | `.cr-dlg` 440px centred (phone: bottom sheet `cr-up .3s`), `cr-pop .22s`: header 34px navy circle (shield-check, or pencil for edit) · "Confirm it’s you" · caption "<Preview|Edit|Reveal> · <scope label>" (e.g. "Reveal · PAN", "Preview · Registrations · GST Registration", "Edit · whole page") · ×. Body: "An OTP has been sent to your manager, **Priya Raman**, at `pr•••••@sbc.in`. Ask them for the code." · six 44×52 digit boxes (40×50 phone; mono 22px; `inputmode=numeric`, first has `autocomplete=one-time-code`) · error line · status line · hint "Prototype demo code: 123456". Footer: "Resend code in 0:29" (disabled countdown, then link "Resend code") · Cancel · navy "Verify" (disabled until 6 digits). |
| ☑ | Input | Typing a digit advances; Backspace on empty goes back; ←/→ move; Enter verifies; pasting/typing multiple digits fills all boxes; Tab is trapped inside the dialog; focus outside snaps back to the first box. |
| ☑ | Wrong code | Boxes clear and turn red (`.bad`), error "That code is not right. Try again." + "2 tries left" / "1 try left". Third wrong → locked 60 s: inputs disabled, red box "Too many wrong codes. Try again later. 0:59" counting down; after expiry it resets (tries back to 3). |
| ☑ | Resend | Allowed every 30 s (not while locked): clears boxes, shows "A new code was sent to Priya Raman." |
| ☑ | Success | Grant = 10 minutes (`SESSION_MS 600000`) for that scope; dialog closes; toast "Preview for 10 minutes" / "Edit for 10 minutes" / "Visible for 10 minutes"; audit line "Rohan Kumar started Preview · <scope> · OTP approved by Priya Raman" or "Rohan Kumar revealed <scope> · OTP approved by Priya Raman"; focus moves to the matching Lock/Hide control. |
| ☑ | Countdown | Every live scope shows a mm:ss chip (toolbar, sheet, gutter row number, cell "Visible · m:ss") ticking each second; at 0 the grant ends, any open edit is closed and the grid re-masks. "Lock" ends a scope early; "Hide" ends a single-cell reveal. |
| ☑ | Editing | Click (or Enter/Space on a focused cell) → inline input (multi-line textarea for the tall Address row; Enter saves, Shift+Enter newline, Esc cancels, blur saves). Empty or unchanged → no save. Save → value stored, auto source flips to "Edited" chip, audit "Rohan Kumar edited <row · column>", toast "Saved" + Undo (restores value and source flag, audit "… undid the change to …"). Status select → saves immediately ("changed <label> to Active"). Add row (status defaults Pending) / Add director (column "New director", grid scrolls right, header cell enters edit) both with Undo toasts and audit lines ("added row N to Login Credentials", "added a director column (F) to Directors KYC"). |
| ☑ | Copy | Copy buttons write the value to the clipboard (fallback `execCommand`), toast "Copied" or "Copy blocked by this browser". |
| ☑ | Stage switch | Before/After pill changes which sheets show (Address and KYC shared; Login/Registrations/Other have before variants), closes edits. |

#### 9.3 Data model and backend (all NEW — nothing in the repo stores credentials)

| Done | piece | proposal |
|---|---|---|
| ☑ | Table `engagement_credentials` | `id uuid pk`, `engagement_id uuid fk cascade`, `sheet text` ('login'|'registrations'|'other'|'address'|'kyc'), `row_key text` (stable key, e.g. step id 'reg-4' or 'custom:<uuid>'), `ordinal int`, `label text`, `fields jsonb` (non-secret cells: mail, mobile, number, date, notes, status, cert document id…), `secret_ciphertext bytea` / `secret_fields jsonb` encrypted (ID, password, login ID, Aadhaar, passport, DOB… — envelope-encrypt with AWS KMS in prod, a local key in dev; never return in list reads), `source jsonb` (per field: 'company record'|'registration steps'|'client profile'|'registered office'|'incorporation steps', and an `edited` flag), `created_at`, `updated_at`, `updated_by`. Directors KYC can be its own table `engagement_director_kyc` (one row per director, fields jsonb + encrypted secrets) or sheet='kyc' with `row_key=director:<id>`. NEW: built — see `src/db/schema-portal-credentials.ts`, `src/db/repositories/credentials.ts`, routes `app/api/client/credentials/**` (GET, otp, otp/resend, otp/verify, lock, cells, rows, log), page `app/app/client/credentials/page.tsx` → `client-portal/pages/credentials/CredentialsPage`. |
| ☑ | Table `credential_access_grants` | `id`, `engagement_id`, `profile_id` (who asked), `mode` ('preview'|'edit'|'reveal'), `scope text` (page / sheet / row / cell key), `expires_at` (+10 min), `approved_by` (manager profile), `created_at`. Server checks a live grant on every secret read/write. NEW: built — see `src/db/schema-portal-credentials.ts`, `src/db/repositories/credentials.ts`, routes `app/api/client/credentials/**` (GET, otp, otp/resend, otp/verify, lock, cells, rows, log), page `app/app/client/credentials/page.tsx` → `client-portal/pages/credentials/CredentialsPage`. |
| ☑ | Table `credential_otps` | `id`, `engagement_id`, `requested_by`, `approver_profile_id` (the engagement's manager: `engagements.manager_id` / `engagement_managers`), `mode`, `scope`, `code_hash` (bcrypt/argon2 of 6 digits), `expires_at` (e.g. 10 min), `attempts int`, `locked_until`, `resend_available_at` (+30 s), `consumed_at`. NEW: built — see `src/db/schema-portal-credentials.ts`, `src/db/repositories/credentials.ts`, routes `app/api/client/credentials/**` (GET, otp, otp/resend, otp/verify, lock, cells, rows, log), page `app/app/client/credentials/page.tsx` → `client-portal/pages/credentials/CredentialsPage`. |
| ☑ | Repository `src/db/repositories/credentials.ts` | `listCredentialSheets(ctx, engagementId)` (masked; client = own engagement via `assertEngagementAccess`; manager/lead per Path A; decide whether leads may see), `requestCredentialOtp(ctx, {engagementId, mode, scope})` → creates OTP, emails/WhatsApps the manager (`src/lib/email/send-email.ts`, `src/lib/notify/send-whatsapp.ts`; NEW template "credential_otp"), returns masked manager email `pr•••••@sbc.in` and resend time; `verifyCredentialOtp(ctx,{otpId, code})` → grant or error {triesLeft, lockedUntil}; `revealCredentialValues(ctx,{scope})` → decrypted values only within a live grant; `updateCredentialCell(ctx,{…})` (requires live edit grant), `addCredentialRow`, `addDirector`, `lockCredentialScope`. Every grant / reveal / edit / undo → `recordAuditEvent` (actions `credentials.otp_requested`, `credentials.preview`, `credentials.edit`, `credentials.reveal`, `credentials.cell_updated`), which also feeds the Access log and the Audit page (DECISIONS: SBC staff by name and role in client Audit). Add cross-tenant tests (golden rule 2). NEW: built — see `src/db/schema-portal-credentials.ts`, `src/db/repositories/credentials.ts`, routes `app/api/client/credentials/**` (GET, otp, otp/resend, otp/verify, lock, cells, rows, log), page `app/app/client/credentials/page.tsx` → `client-portal/pages/credentials/CredentialsPage`. |
| ☑ | Routes | `GET /api/engagements/[id]/credentials` (masked sheets), `POST /api/engagements/[id]/credentials/otp` (request/resend), `POST /api/engagements/[id]/credentials/otp/verify`, `POST /api/engagements/[id]/credentials/reveal` (values for a scope), `PATCH /api/engagements/[id]/credentials/cells`, `POST /api/engagements/[id]/credentials/rows`, `DELETE …/grants/[id]` (Lock), `GET /api/audit-logs?engagementId=&action=credentials.*` for the drawer (route exists). NEW: built — see `src/db/schema-portal-credentials.ts`, `src/db/repositories/credentials.ts`, routes `app/api/client/credentials/**` (GET, otp, otp/resend, otp/verify, lock, cells, rows, log), page `app/app/client/credentials/page.tsx` → `client-portal/pages/credentials/CredentialsPage`. |
| ☑ | Auto-fill sources | company record = pre-12 responses (`cin`, `pan`, `tan`); registration steps = reg-* responses (`gstinNumber`, `pfRegistrationNumber`, `esiRegistrationNumber`, `lutArn`, `iecCode`, `leiNumber`…); client profile = pre-1 `companyMailId`, `companyMobileCountryCode/Number`; registered office = pre-14 responses + `engagements.subsidiary_registered_address`; incorporation steps = pre-15 director slots (DIN, names, DOB, address, mobile, mail, PAN). Computed at read time unless overridden ("Edited"). |
| ☑ | Page | NEW `app/app/client/credentials/page.tsx` + view `src/views/client/Credentials.tsx`; sidebar item in `src/components/shell/RoleSidebar.tsx`. NEW: built — see `src/db/schema-portal-credentials.ts`, `src/db/repositories/credentials.ts`, routes `app/api/client/credentials/**` (GET, otp, otp/resend, otp/verify, lock, cells, rows, log), page `app/app/client/credentials/page.tsx` → `client-portal/pages/credentials/CredentialsPage`. |

---

### 10. `v7x_*` boards

#### 10.1 Document viewer (`v7x_doc_viewer`, route `doc-viewer`)

| Done | id | item | content / behaviour |
|---|---|---|---|
| ☐ | DV-01 | Overlay | Covers the content area only (`left:var(--vp-side-w)`), dim `oklch(20% .05 258 / .6)`; dialog `width:min(1152px,100%-24px)`, `height:min(720px,100%-24px)`, radius 12, grey canvas `light-dark(oklch(94% .008 255), oklch(22% .008 255))`. |
| ☐ | DV-02 | Header | 30px type badge (PDF over-light) · file name (700 14px, ellipsis) "Certificate of Incorporation.pdf" + (i) "From SBC · 24 Oct 2026 · Size [size]" · caption position "1 of 4" · outline "⬇ Download" (label hidden on phone) · 32px × "Close preview (Esc)". |
| ☐ | DV-03 | Page | A4 paper (`aspect-ratio:1/1.414`, width 460px × zoom, white, shadow, radius 2, `data-paper` = always light in dark mode) with sample content + diagonal "SAMPLE" watermark (placeholder for the real PDF render). Padding `28px clamp(12px,6vw,72px) 72px`. |
| ☐ | DV-04 | Prev/next | 40px round buttons at left/right 16px, vertically centred: "Previous document" / "Next document" cycle the list (Certificate of Incorporation 24 Oct 2026 SBC · Board meeting minutes 26 Oct · GST certificate 1 Nov · Share capital FIRC 2 Nov 2026 Northwind). |
| ☐ | DV-05 | Zoom bar | Navy floating pill bottom-centre (bottom 16px; 72px on phone): "Page 1 / 1" · divider · − · "100%" · + ; zoom 50–150% in 25% steps; page width animates .2s. |
| ☐ | DV-06 | Close | Esc or × → back to the opener (`vcfoBack`, else Home). |
| ☐ | DV-07 | Unsupported type | Second dialog (860px, min-height 380): DOCX badge, "Draft Board Resolution.docx" + (i) "From SBC · 14 Sep 2026 · Size [size]", Download, ×; body 64px DOCX icon tile + "Preview not available for this file type" + primary "⬇ Download". |

Data: `GET /api/documents/[id]/signed-url` (S3) / `GET /api/milestone-documents/signed-url`; PDF render via `<iframe>`/pdf.js; images inline; other types → unsupported state. Size from `documents.size_bytes`. Prev/next = the list the viewer was opened from. Shared preview component is also used by Documents and Incorporation (DECISIONS: "shared preview").

#### 10.2 Drill-down (`v7x_drilldown`) — see G-06; spec board `v7x_drilldown_spec` (1300px): "1 · Hover a part" tooltip example "Payroll · Due soon · 3" (navy, 6px corners) + "2 · Click → drill-down pop-up (clicked part pre-selected)" with "Payroll (PF / ESI / PT) · filings" (All 18 · Filed 0 · Due soon 3 · Overdue 0 · Upcoming 15; rows EPF Return & Payment · Oct 15 Nov, ESI Payment · Oct 15 Nov, PT Payment · Oct 20 Nov — Due soon). Notes: one component for every visual; props `title`, `tabs`, `rows`, `active`, `onclose`; hover/focus = tooltip, click/tap/Enter = pop-up; each part is a real button with an aria-label; footer "Showing n of m" + "Open full list"; closes on backdrop/×/Esc; reduced motion: pill jumps, no fade. Wired on: greeting ring · current-step badges · timeline bars · compliance-by-area bars · What is next · Alerts · post-incorporation bars · chat phase visual.

#### 10.3 Info pop-over (`v7x_info_popover`, 1340px) — 4 states: Closed ("Title + (i). No grey line under it."), Hover ("Icon turns navy. Nothing opens on hover."), Open ("Click opens the pop-over, attached to the icon."), Keyboard focus ("Focus ring on the icon; Enter opens, Esc closes."). Spec bullets: 15px icon, 18px hit area inside a 44px touch target on mobile; pop-over 200–280px, 10px arrow, 8px corners; content 1–3 short lines then meta; bottom row 16px bot + "Ask VCFO about this" (opens chat with the row's title as the question); opens on click/Enter/Space, closes on outside click, Esc or Tab out; one open at a time; build with Radix Popover, `role="dialog"` when it holds the link; reduced motion no fade/slide. Example content "Electricity or water · Max 2 months old · Asked by Arjun Mehta".

#### 10.4 Top bar (`v7x_topbar`, 1192px) — "Short trail" (Home) and "Long trail: it truncates, the right group never moves" (Incorporation › SPICe+ Part B › Step 7 · Registered Office Address › Documents › NOC from property owner; ancestors are muted links 13px/500, separators chevrons at 45% opacity, last item 600 current page, each `li` ellipsis with min-width 28px (last 48px)). See G-20.

#### 10.5 Launcher concept (`v7x_launcher_concept`, over `v7x_before_bare`) — superseded by the runtime launcher (G-10) but documents the motion intent: fixed 24px from the right, bottom = window bottom; avatar box 108px (head ~80px, ~100px visible); click opens the 400×640 chat above it and the robot stays risen as its anchor showing moods; while scrolling it sinks to a 50px peek and rises 600 ms after scrolling stops; pages get 96px bottom padding. Storyboard: 1 Hidden (0 ms; starts 600 ms after load) → 2 Springs up (0–400 ms, stiffness 420 damping 32, ~8px overshoot; keyframes `v7rise .4s cubic-bezier(.3,1.4,.5,1) .6s`: 100%→−8%→2%→0) → 3 Settles, looks around (400–700 ms; blink every 4.5 s, glance every 8 s; "Ask VCFO" bubble fades in at 700 ms) → 4 Sinks back (250 ms ease-in when a pop-up/modal opens or while scrolling). Reduced motion: no rise/sink/glance; bubble visible; no blink.

#### 10.6 Timeline options (`v7x_timeline_options`, 1100px) — step-timeline styles for the step pop-up: **A "Connected chips" — Picked** (done green ✓, current navy + gold pulse, next dashed; one short line per stage, rest in (i); fits the 760px pop-up), B "Run graph" (cards joined by arrows; rejected: heavy), C "Progress rail" (segmented bar with labels; rejected: current stage stands out less). Use A (= SP-02).

#### 10.7 `v7x_before_bare` — the before-COI Home without the launcher, used only as the backdrop for 10.5. Note its older 12-column layout: `main{padding:24px;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}`, greet span 12, left column span 8 (Needs, Who holds it now, Timeline, Steps), right column span 4 (Alerts, SBC, Docs, Activity). Superseded by the `vh-b` grid (section 11).

---

### 11. Layout specs per breakpoint

#### 11.1 Page frame (Home desktop/tablet board)

```css
.vh-root{position:relative;width:100%;min-height:100vh;display:flex;background:var(--bg);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px}
.vh-side{width:var(--vp-side-w,248px);flex:none;background:#0f2a4a;overflow:hidden}   /* 248 ≥1280 · 72 768–1279 · 0 ≤767 */
.vh-body{flex:1;min-width:0}
.vh-main{box-sizing:border-box;width:100%;max-width:1600px;margin-inline:auto;padding:clamp(12px,2vw,24px);display:grid;gap:16px;align-items:start;grid-template-columns:minmax(0,1fr)}
.vh-main>.stag{display:flex;flex-direction:column;gap:16px;min-width:0}   /* cards stack inside an area with 16px gaps */
```

Note the grid breakpoints are on VIEWPORT width (media queries), independent of the sidebar width. Effective content widths: at 1440 desktop the content is 1440−248 = 1192 minus 2×24 padding = 1144px; at 1024 tablet 1024−72 = 952 − 2×20.48 ≈ 911px; at 390 phone (desktop board only for 700–767) full width − 2×12.

#### 11.2 BEFORE grid (`.vh-b`)

| Done | viewport | columns | areas | rows |
|---|---|---|---|---|
| ☑ | < 600 | `minmax(0,1fr)` | `"g" "a" "c1" "b" "c2"` | auto |
| ☑ | 600–1179 | `repeat(2,minmax(0,1fr))` | `"g g" "a a" "c1 c2" "b b"` | auto |
| ☑ | 1180–1799 | `minmax(0,2fr) minmax(0,1fr)` | `"g g" "a c1" "a c2" "b c2"` | `auto auto 1fr auto` |
| ☑ | ≥ 1800 | `repeat(3,minmax(0,1fr))` | `"g g g" "a c1 c2" "b b c2"` | `auto auto 1fr` |

(a = Needs + Who holds it now; c1 = Alerts + SBC; b = Timeline + Steps; c2 = Docs + Activity.)

#### 11.3 AFTER grid (`.vh-a`)

| Done | viewport | columns | areas | rows |
|---|---|---|---|---|
| ☑ | < 600 | 1 | `"g" "a1" "c1" "a2" "c2" "f" "d" "e"` | auto |
| ☑ | 600–1179 | `repeat(2,minmax(0,1fr))` | `"g g" "a1 a1" "c1 a2" "c1 c2" "f f" "d e"` | `auto auto auto 1fr` |
| ☑ | 1180–1799 | `repeat(6,minmax(0,1fr))` | `"g g g g g g" "a1 a1 a1 a1 c1 c1" "a1 a1 a1 a1 c2 c2" "a2 a2 a2 a2 c2 c2" "f f f f f f" "d d d e e e"` | `auto auto 1fr auto` |
| ☑ | ≥ 1800 | 6 | `"g g g g g g" "a1 a1 a2 a2 c1 c1" "a1 a1 c2 c2 c1 c1" "f f f f f f" "d d d e e e"` | `auto auto 1fr` |

(a1 = Needs + What is next; c1 = Alerts + SBC; a2 = Compliance status; c2 = Company IDs; f = Compliance by area + Registrations + Post-inc + Timeline + Steps; d = Docs; e = Activity.)

#### 11.4 Responsive rules inside cards (from the `data-vh` style block, verbatim in Appendix A)

| Done | rule | breakpoint |
|---|---|---|
| ☑ | Search button collapses to 36px icon | ≤1099 |
| ☑ | Top bar gap 6 / padding 10; menu button shown; crumb hidden; logo 22px; all top-bar buttons ≥40px; `.vh-hide-sm` hidden; card `.btn` and pill buttons ≥40px; no card hover lift | ≤767 |
| ☑ | `.vh-hide-xs` hidden (greeting "Report" label) | ≤479 |
| ☑ | Greeting stats become a grid `repeat(auto-fill,minmax(118px,1fr))` gap 8px 12px, no separators; `.vh-gtop` wraps | ≤599 |
| ☑ | `.vh-segwrap` pills (Compliance by area, Registrations) wrap, thumb hidden, active = navy bg | ≤767 |
| ☑ | Tables scroll inside `.vh-x` (`overflow-x:auto;overscroll-behavior-x:contain`; table `min-width:var(--tmin,520px)`: Steps 560, Area 600, Registrations 720); timeline in `.vh-tl` scrolls with min-width 600 | all |
| ☑ | Drill-down: width min(600px,100vw−24), max-height min(560px,100dvh−24); ≤640 pill wraps, date column hidden (`ddrow` → `minmax(0,1fr) 116px 16px`) | ≤640 |
| ☑ | Pop-overs max min(280px,100vw−24); closed pop-overs `display:none` (no phantom scroll) | all |
| ☑ | Coarse pointers: (i) gets an 11px invisible hit-area ring | `pointer:coarse` |
| ☑ | `.vh-pbar` (52px fixed bar for full-screen pop-up boards), `.vh-under-bar{top:52px}`, `.vh-zoom{bottom:72px}` | ≤767 |
| ☑ | Phone file swap (`mobile.html`) | <700 (prototype); real app: <768 single responsive page |

#### 11.5 Card anatomy (desktop) — exact CSS

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

#### 11.6 Phone (`mobile.html`) metrics

`.wrap{padding:14px 14px 0;display:flex;flex-direction:column;gap:12px}` (note: 14px side gutter); top bar 56px; card radius 10, header `14px 14px 10px`, title 800 12px uppercase; pill margin `0 14px 10px`, buttons 38px; rows min-height 52px padding `8px 14px`; icon buttons 40px; date tiles 42×46; greeting radius 12 padding `14px 14px 12px`; ring 62px; stat tiles radius 8 padding 8; buttons 40px. Max content width 560px.

#### 11.7 Tablet specifics
768–1279: desktop board, sidebar = 72px icon rail (Before/After pill vertical inside the rail), Search collapses to icon ≤1099, grid uses the 600–1179 two-column template up to 1179 and the 2fr/1fr (before) / 6-col (after) template from 1180. Screenshot `home__1024x768.png` confirms: greeting full width, Needs full width, Who holds it now full width.

---

### 12. Backend mapping summary

#### 12.1 Already available

| Done | need | provider |
|---|---|---|
| ☑ | One scoped read for the dashboard | `GET /api/client/overview` → `getClientOverview(ctx, engagementId?)` (`src/db/repositories/client-overview.ts`), hook `useClientOverview()` (`src/lib/use-client-overview.ts`), pure builders in `src/lib/client-overview.ts` (`buildProgress`, `buildNextAction`, `buildBallInCourt`, `buildDeliverables`, `buildDocumentCounts`, `buildMilestones`, `identifiersFromState`, `complianceGroupForAuthority`, `journeyStations`, `heroStateLine`). |
| ☑ | Company name, legal form, incorporation date, registered office | `overview.engagement` |
| ☑ | Before/after switch | `overview.incorporated` |
| ☑ | Phase progress (ring, Steps card chips, timeline %) | `overview.progress.byPhase` |
| ☑ | Step list with gate state | `overview.milestones` + `src/data/checklist.ts` |
| ☑ | CIN/PAN/TAN/PF/ESI codes | `overview.identifiers` |
| ☑ | Upcoming filings (+90 days) | `overview.compliance.upcoming` |
| ☑ | Full filings register / FY | `GET /api/filings` (`getFilings`), `useComplianceFilings` |
| ☑ | Filing working windows | `compliance_instances.window_from/to`, `PATCH /api/filings/[id]/window` |
| ☑ | Manager date windows (timeline, expected COI) | `engagements.schedule`, `src/lib/schedule-windows.ts`, `/api/engagements/[id]/schedule`, `setEngagementWindow` |
| ☑ | Team (PM / PL names, email) | `overview.team` |
| ☑ | Activity | `overview.activity` (audit events) / `GET /api/activity` |
| ☑ | Documents + preview | `GET /api/documents`, `GET /api/documents/[id]/signed-url`, `GET /api/milestone-documents/signed-url`, deliverables |
| ☑ | Document requests | `document_requests` + `GET/POST /api/requests`, `PATCH /api/requests/[id]` |
| ☑ | Client change request on a step | `POST /api/client/change-requests` |
| ☑ | Client approve step | `POST /api/client/steps/[stepId]/approve` |
| ☑ | Ask VCFO (chat, suggestions, handoff, brief PDF, nudge, library) | `/api/ask/*`, `src/components/ask/*` |
| ☑ | Notifications badge | `GET /api/notifications` |
| ☑ | Shared CSS tokens | `src/components/client-portal/css-src/*` (`.cp`-scoped port of the prototype base CSS) |

#### 12.2 NEW backend pieces needed

| Done | # | piece | for |
|---|---|---|---|
| ☑ | N1 | `overview.needs[]` — unified client needs (document requests with `step_id`/`compliance_instance_id`/`kind`/`due_date`, fill requests, rejected steps, sign items); columns on `document_requests`: `step_id text`, `compliance_instance_id uuid`, `kind text`, `due_date date`, `field_id text` | Needs card, Waiting-on count, Documents in x/y, step pop-up "Needed from …" |
| ☑ | N2 | `overview.expectedCoiDate` (from `schedule.incorporation.to`) | greeting "Expected COI", timeline COI |
| ☑ | N3 | `overview.alerts[]` builder (`buildAlerts`) | Important alerts |
| ☑ | N4 | Include overdue filings in the runway (`status='overdue'` or past due not filed) + `overview.compliance.fyCounts` + area grouping | What is next hero, donut, compliance by area, stats |
| ◐ | N5 | Firm work items visible to the client (`tasks.visible_to_client`, `tasks.progress_pct`) or derived per-step progress | What SBC is doing, "30%" captions |
| ◐ | N6 | `engagement_change_requests.kind = 'timeline'` + manager approve flow + `timeline_changed` notify event; phase-level windows in `schedule` | Timeline editor, pending chip |
| ◐ | N7 | Activity actor fields (`actorName`, `actorKind`) in `ClientOverviewActivity`; system events from the compliance job | Recent activity tabs |
| ☑ | N8 | `identifiers.gstin` (+ iec, lei, pf/esi reg numbers) in `identifiersFromState` | Company IDs, Registrations |
| ☑ | N9 | Masked PAN/TAN in the overview + `POST /api/client/identifiers/reveal` (password re-check, 3-try lock, audit) | Company IDs reveal / `v7p_ids_password` |
| ◐ | N10 | `overview.registrations[]` builder + category/authority map + missing number fields for PT/S&E/Trade Licence/Trademark/MSME | Registrations card |
| ◐ | N11 | Post-inc statutory window per step (N days, anchor date) + day counter | Post-incorporation setup |
| ☑ | N12 | Credentials: tables `engagement_credentials` (+ `engagement_director_kyc`), `credential_otps`, `credential_access_grants`; repo `credentials.ts`; routes under `/api/engagements/[id]/credentials/*`; KMS/local encryption; OTP delivery to the manager (email + WhatsApp template); audit actions `credentials.*`; page `/app/client/credentials` | Credentials page |
| ☑ | N13 | Report download wired to `/api/ask/brief` (exists) — only a front-end wire | Greeting Report |
| ☑ | N14 | Portal URL map (front-end constant), file-type → badge colour map | ↗ links, doc badges |

---

#### NEW backend pieces built by the Home builder
- NEW tables (`src/db/schema-portal-home.ts`): `client_need_meta` (request_id pk → document_requests, engagement_id, step_id, compliance_instance_id, kind upload|fill|correct|sign, due_date, field_id, updated_at); `client_work_items` (id, engagement_id, step_id, title, assignee_id, progress_pct, ready_on, status active|done|hidden, created_by, timestamps); `client_timeline_requests` (id, engagement_id, task_id, requested_by(+name), reason, payload {phases, coiFrom, coiTo, slipDays}, status pending|approved|rejected|withdrawn, decided_by/at, decision_note, timestamps).
- NEW repository `src/db/repositories/client-home.ts` (getClientHome aggregate, needUploadTarget / recordNeedUpload / undoNeedUpload, setNeedMeta, upsertWorkItem) + timeline functions in `client-change-requests.ts` (createClientTimelineRequest, withdrawClientTimelineRequest).
- NEW routes: `GET /api/client/home`, `POST|DELETE /api/client/home/needs/[id]/upload`, `PATCH /api/client/home/needs/[id]` (staff), `POST /api/client/home/work-items` (staff), `POST /api/client/change-requests` now accepts `kind:'timeline'`, `DELETE /api/client/change-requests/[id]` (withdraw).
- Shapes: `src/lib/client-home.ts`. UI: `src/components/client-portal/pages/home/*`, CSS `css-src/home-base.css`, `home-tle.css`, `home-m.css`.

<!-- /area:home -->

<!-- area:shell -->
## Shell, chrome and shared runtime (every page)

Full catalogue (verbatim CSS, markup, logic): `inventory/shell.md`.

### 2 + 3. INVENTORY with proposed mapping

Legend for "Real app": EXISTS = already in the repo (path); ADAPT = exists but needs restyle/behaviour change; NEW = to build (front-end piece / backend piece).
Client routes in the real app: `/app/client/overview` (Home), `/app/client/announcements`, `/app/client/notifications`, `/app/client/incorporation`
(+ `/step/...`), `/app/client/compliances/calendar`, `/app/client/compliances/filings`, `/app/client/documents`, `/app/client/library`
(+ `/[id]`), `/app/client/team`, `/app/client/audit`, `/app/client/settings`, `/app/client/board-resolution`. No `/app/client/credentials` yet.

#### 2.1 Intro / splash

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | I-01 | Intro overlay `#vi` | Fixed full-screen white stage (`--stage:#fff`), z 5, grid-centred SVG, padding `max(12px,env(safe-area-inset-*))`. Plays once per page load over the app iframe, which is `inert` + `aria-hidden` until the intro leaves. | outer-shell.html:15-19,28-52,56-63 | NEW `src/components/client-portal/Intro.tsx` mounted by the client layout on first load (sessionStorage flag "played this session" is the natural equivalent of "once per page load"). |
| ☑ | I-02 | Layout choice | `innerWidth/innerHeight < 1.05` → `square` (viewBox `40 160 720 540`, SVG `min(92vw,640px)×min(78vh,560px)`), else `wide` (viewBox `72 50 1000 400`, SVG `min(92vw,max(62vw,560px),1500px)×min(70vh,560px)`); re-evaluated on resize. | outer-shell.html:18-19,93-96,139-155 | same, in the component |
| ☑ | I-03 | Timeline (7.0 s, fade at 6.4 s) | Cards 0..2 (Incorporation `#FFC517` text `#3D2A00`, Registrations `#F08A21`, Compliances `#E76028`, white text) grow from the baseline: card i over `[0.35+0.7i, 1.10+0.7i]` s with `easeBack` (c1 1.4) scaleY, opacity `clamp(p*8)`; names fade in over `[0.35+0.5j, 0.75+0.5j]`, are hidden as the next card covers them, all fade out 2.85→3.1 s; stack pulse `1+sin(π·seg(3.15,3.6))·0.04`; white "V" wipes up 3.05→3.5 (easeOut); stack moves/scales to logo position 3.7→4.5 (easeInOut cubic); wordmark "VCFO Suite" reveals left→right 4.1→5.0 (clip 640 units); "BY [SBC logo]" fades/rises 8px 4.8→5.4. Frame clock caps each frame at 50 ms so a busy main thread pauses rather than jumps. | outer-shell.html:65-137,185-191 | port the same JS into a `requestAnimationFrame` hook (keep the math verbatim, §4.10) |
| ☑ | I-04 | Small-screen start scale | `s0 = max(1, min(L.s1, 11.5/(15·ppu)))` so card names are ≥11.5 CSS px; `s1` = 1.55 wide / 1.8 square | outer-shell.html:152-154 | same |
| ☑ | I-05 | Skip button `#vi-skip` | Top-right `max(16px,env(safe-area-inset-*))`, `min-height:44px;min-width:72px;padding:0 20px;border-radius:999px;background:#EDEBE7;color:#17140F;font:700 14px/1 Poppins` (hover `#E2DFD9`, focus `3px solid #F08A21` offset 2). Click or `Esc` → jump to the finished logo (`finish()`); hidden (`opacity:0`) once ended. | outer-shell.html:20-23,51,175-183,192,196-198 | same |
| ☑ | I-06 | Leave | Fades out (`opacity .55s ease`, class `out`) only when the timeline ended AND the first app screen reported ready (`__vcfoIntro.ready()` on iframe load, then +150 ms); a 12 s safety timer forces it. Removes itself after `transitionend` (or 800 ms), restores focus to the app if it held focus. | outer-shell.html:157-183,195,360-370 | "ready" = client layout's first data (overview query) settled |
| ◐ | I-07 | Opt-out | `localStorage['vcfo.skipIntro']==='1'` → intro never shows | outer-shell.html:59-62 | NEW pref (localStorage) |
| ◐ | I-08 | Reduced motion | Shows the finished logo still for ~1 s then fades (`transition-duration:.3s`) | outer-shell.html:24,201-205 | same |
| ☑ | I-09 | Fonts | Poppins 400/700 embedded as data-URI woff2, `font-display:block`; `document.fonts.load` before starting | outer-shell.html:12-13,207 | NEW: add Poppins 400/700 (+600, since names use 600) to `public/client-portal/fonts/` (not there yet) |

#### 2.2 Sidebar (desktop 248 px), rail (tablet 72 px), drawer (phone)

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | S-01 | Breakpoint contract | `<html data-vp-bp>` + `--vp-side-w`/`--vps-w` = 0/72/248; `vcfo:bp` event on change; board column `width:var(--vp-side-w,248px);flex:none` | shell.js:5-15,28-38 | ADAPT `src/components/shell/AppShell.tsx` (today it pads `lg:pl-[15.5rem]` for clients); NEW `useBreakpoint()` hook (phone/tablet/desktop) or pure CSS media queries |
| ☑ | S-02 | Sidebar container `#vp-side.vps` | `position:fixed;top:0;left:0;height:100vh` (`100dvh` where supported); bg `#0f2a4a`; `font:500 13px/1.4 Manrope`; scrolls vertically with hidden scrollbar; z 45. Covers the page's placeholder column (which is hidden). | shell.js:116-124,446-485 | ADAPT `src/components/shell/RoleSidebar.tsx` (client branch) or NEW `ClientSidebar.tsx` inside the portal shell |
| ☑ | S-03 | Logo row | 64 px, `padding:0 18px`, bottom border `rgba(255,255,255,.08)`; `<img>` `brand/vcfo-logo-on-black.png` height 34 (object-fit contain, left); link → Home, `aria-label="VCFO Suite · Home"` | shell.js:42,125-126,272 | asset EXISTS `public/client-portal/vcfo-logo-on-black.webp` (CHANGES.md #1 says "on-dark" for the navy sidebar: `vcfo-logo-on-dark.webp` is the owner input; the bundle used on-black). Link → `/app/client/overview` |
| ☑ | S-04 | Nav model | Home · Updates (group: Announcements, Notifications) · Incorporation · Compliances (group: Calendar, Filings) · Documents · Library · Credentials · Team · Audit · Settings. Lucide icons (stroke 2): layout-dashboard, megaphone, building-2, calendar-check, folder-open, library, key-round, users, history, settings. | shell.js:72-102 | ADAPT `clientItems` in `RoleSidebar.tsx:144-153` (add Credentials + Settings, icons as listed, labels as listed; DECISIONS.md says the sidebar name is "Knowledge Bank" but the FINAL shell shows "Library") ; Credentials → NEW route `/app/client/credentials` |
| ☑ | S-05 | Nav item | `36px` tall, `padding:0 10px`, gap 11, radius 8, `13.5px` w500 `#c3cddc`; icon `#9aa8bd`; hover bg `rgba(255,255,255,.06)`, text `#fff`, icon `#c9d6ea` (.15s). Active (`aria-current=page`): `#fff`, w650, icon `#a9c3ff`. | shell.js:130-136 | style in portal CSS (`20-shell.css` in progress) |
| ☑ | S-06 | Active pill + rail | One absolutely-positioned pill (`left/right:8px`, h = item height, radius 8, `rgba(255,255,255,.1)` + inset ring) and a 3×20 `#6e96ff` rail at `left:8px`, centred on the item. Both slide with `transform .42s cubic-bezier(.22,1.2,.36,1)` (pill height .3s). On a new screen the pill starts where it was on the previous screen (sessionStorage `vcfo.pill-<mode>`) and slides to the new item two frames later. Hidden if no current item. If the active child's group is collapsed, the pill sits on the group header. | shell.js:128-129,347-361,477-480 | EXISTS `src/components/shell/MotionActivePill.tsx` (framer-motion) — ADAPT to these exact metrics/colours; because the Next layout persists across routes, no sessionStorage needed |
| ☑ | S-07 | Badges | `min-width:20px;height:20px;padding:0 6px;border-radius:6px;font:700 11px/1`, bg `rgba(255,255,255,.1)`; hot = `#d93a3a`. Updates "3" (hot), Notifications "3" (hot), Incorporation "6/14" before / "14/14" after, Documents "6". | shell.js:93-96,137-138,269-270 | NEW data: Updates/Notifications = unread notifications (EXISTS `/api/notifications?head=1`, `NotificationsBell` already computes `unreadNotificationCount`); Incorporation = SPICe+ steps done/total from `GET /api/client/overview` (`progress`); Documents = open document requests count (EXISTS `/api/requests` / `document-requests.ts`) — confirm meaning with owner |
| ☑ | S-08 | Groups (Updates, Compliances) | Header button with chevron (`#8c9ab0`, rotates 90° when open, .28s). Open state from `localStorage vcfo.navOpen`, default = open if it holds the current page. Expand/collapse animates `grid-template-rows:0fr→1fr` .3s; collapsed children are `inert`/`tabindex=-1`/`visibility:hidden`. When open the header badge fades/scales out (`opacity:0;scale(.6)`). Pill follows the animation for 20 frames. | shell.js:139-149,284-289,413-419 | EXISTS `src/components/shell/SidebarNavGroup.tsx` — ADAPT visuals (guide line `left:18px`, 5 px dots at `left:16px`, sub items 32 px `padding-left:37px`) |
| ☑ | S-09 | Clicking current page | Toast "You are already on <label>" (except Home) | shell.js:427 | trivial in the nav component (optional) |
| ☑ | S-10 | Team section label | "Northwind’s team" (`<company>’s team`), `800 11px` `.12em` uppercase `#d8b25a`, `margin:0 8px 6px`; block `margin-top:auto`, `padding:10px 8px 8px`, top border `rgba(255,255,255,.1)` | shell.js:150-151,294 | company name from `ClientOverview.engagement.companyName` |
| ☑ | S-11 | Team contact rows | Priya Raman · Project Manager (PR), Arjun Mehta · Project Lead (AM): 38 px row, 26 px initials avatar, `<b>Name</b> <small>· Role</small>` on one ellipsised line (12.5/11.5px). Row is `tabindex=0 role=group aria-label="<name>, <role> · contact"`. | shell.js:105-109,152-157,295-299 | EXISTS data: `ClientOverview.team` (`loadTeam` in `src/db/repositories/client-overview.ts:90-113`: name, email, role 'Project Manager' / 'Project Lead'). NEW: phone (`profiles.phoneE164`) + avatar (`profiles.avatarObjectKey`, EXISTS `/api/account/avatar`) must be added to the team DTO |
| ☑ | S-12 | Contact hover actions | On row hover or focus-within, a strip fades in at the right (`opacity .15s`) over a gradient `linear-gradient(90deg,rgba(22,50,80,0),#163250 14px)`: 24×24 r6 buttons WhatsApp (green `#1f8f5a`, hover `#25a468`), Call, Email, Teams (hover `rgba(255,255,255,.22)`, active `scale(.94)`); each `aria-label="<Verb> <Name>"`. Click → toast "Opening <Verb> <Name>…". | shell.js:110,158-163,274 | NEW behaviour: WhatsApp `https://wa.me/<E164 digits>`, Call `tel:`, Email `mailto:`, Teams `https://teams.microsoft.com/l/chat/0/0?users=<email>`; hide a verb when its datum is missing. Pure front-end once the DTO has phone. |
| ☑ | S-13 | Customer support row | "Customer support · SBC help desk" (headset icon avatar), verbs order WhatsApp, Email, Teams, Call (`aria-label "... support"`). Legacy board shows "Farhat · +91 90597 90014". | shell.js:108,273,274 | NEW config: support contact from env (`SUPPORT_WHATSAPP_E164`, `SUPPORT_EMAIL`, `SUPPORT_TEAMS_UPN`, `SUPPORT_PHONE`) exposed via a small `GET /api/client/support-contact` or server-rendered prop (never hard-code, golden rule 4) |
| ☑ | S-14 | Account row | 30 px `#2e5cff` initials avatar "RK", **Rohan Kumar** / "Northwind · Client" (13px w650 / 11px `#a9b6c9`) + 30×30 sign-out icon button (`aria-label`/`data-tip` "Sign out"; hover bg `rgba(255,255,255,.12)`, `#fff`). Read-only (the old menu with Settings / Help · Ask VCFO / Sign out is still in code, unused on desktop). | shell.js:111,164-176,300-303 | EXISTS session user (`useApp().user`), Auth.js `signOut()`; avatar via `UserFace` (`src/components/common/UserFace.tsx`) |
| ☑ | S-15 | Sign out | Prototype: toast "Signed out · this is a prototype, so you stay on the page" | shell.js:424 | `signOut({ callbackUrl: '/login' })` |
| ☑ | S-16 | Rail (tablet) | 72 px; logo row 58 px with `brand/vcfo-mark.png` (36 px, max-w 48); items 40 px icon-only (20 px icons), labels visually hidden; badges become 18 px dots at `top:3px;left:calc(50% + 3px)` with `0 0 0 2px #0f2a4a` ring; groups show a 5 px corner triangle (`#7f90a9`). Under the nav: vertical Before/After (56×66). Team block: label "Team" (centred, `.08em`), each person = 40 px button with a 30 px avatar. Account = avatar + sign-out stacked. `max-height:740px` compaction. | shell.js:183-200,221-225,308-329 | NEW rail variant of the client sidebar (MotionActivePill reused) |
| ☑ | S-17 | Rail tooltips | Every rail control has `data-tip`; hover/`:focus-visible` shows `.vps-tip` 8 px to the right of the rail, vertically centred, `opacity/transform .12s` (`translateX(-4px)` → none); hidden on scroll, pointerdown, leave, and while a fly-out is open for that button. Tip texts: "Home", "Updates · 3 new", "Incorporation · 6/14 steps", "Documents · 6", "<Name> · <Role>", "Sign out", "Show the company before or after incorporation". | shell.js:212-213,315-326,386-404 | ADAPT `src/components/ui/tooltip.tsx` (Radix) with `side="right"`, 8 px offset, rail-tip styling |
| ☑ | S-18 | Rail fly-outs | Groups, people and account open a `role=menu` fly-out (`#143457`, r12, min-w 212) 8 px right of the rail, top aligned to the button −6 px (account: bottom-aligned), clamped to the viewport; `vpsfly .18s`. Group fly-out: gold header + child links (active = `inset 3px 0 0 #6e96ff`). Person fly-out: name/role header + 40 px rows "WhatsApp / Call / Email / Teams" with icons. Opened by keyboard → focus first item; Esc closes and returns focus; click outside / scroll closes. Toggling the same button closes. | shell.js:201-211,330-344,364-383,433-436 | NEW (Radix `DropdownMenu` with `side="right"` fits: EXISTS `src/components/ui/dropdown-menu.tsx`) |
| ☑ | S-19 | Phone drawer | `#vp-drawer` `width:min(320px,88vw)`, slides `translateX(-102%)→0` `.32s cubic-bezier(.22,1,.36,1)`, shadow `20px 0 50px -20px rgba(0,0,0,.5)`; scrim `rgba(8,20,40,.45)` fades .25s. `role=dialog aria-modal`, `inert` while closed, focus moves to the × on open, Tab is trapped, Esc / scrim / × close and focus returns to the opener. Header 60 px: logo (30 px) + 40×40 r10 × button. Then the full-width Before/After (46 px). Items 44 px (sub 40 px). Contact rows show name + role on two lines and the verb buttons always visible (40×40 r9). Opens from any `[data-vp-menu]` / `aria-label="Open menu"` button or `window.vcfoOpenSide()`. Closes automatically when the viewport leaves phone size. | shell.js:230-251,278-305,487-516,595-597 | EXISTS `MobileNavSheet` in `RoleSidebar.tsx` + `src/components/ui/sheet.tsx` (Radix Dialog) — ADAPT to these metrics |
| ✗ | S-20 | Phone fallback band | If a phone screen has no visible menu button, a 56 px white band (`light-dark(#fff, oklch(13% 0 89.9))`, `box-shadow:0 1px 0 #e3e8ef`) is added with a 40×40 navy menu button + VCFO mark (28 px); body padded by `--vp-menu-offset`. | shell.js:252-257,518-530 | not needed if the real top bar always renders the phone menu button (T-02) |
| ☑ | S-21 | Phone VCFO mark next to the hamburger | `img.vp-mlogo` (26 px high, max-w 44) inserted after the board's menu button if within the top 80 px | shell.js:260,532-537 | part of the phone top bar (T-02) |
| ☑ | S-22 | Favicon | `brand/vcfo-icon.png` | shell.js:266 | `app/icon.*` / metadata (asset EXISTS `public/client-portal/vcfo-icon.webp`) |
| ☑ | S-23 | Sidebar focus ring | `outline:2px solid #8fb4ff;outline-offset:2px;border-radius:8px` | shell.js:123 | portal CSS |
| ☑ | S-24 | Reduced motion | pill, rail, sub, chevron, drawer, menu, B/A thumb, tips: `transition:none`; fly-out no animation | shell.js:261 | same |
| ☑ | S-25 | Sidebar + top bar stay fixed while the page scrolls | `pinNav()` makes the board sidebar sticky (`top:0;height:100vh;z 30`) and the top header sticky (`top:0;z 40`), un-clipping overflow ancestors | proto.js:634-658 | EXISTS: AppShell already has `sticky top-0` top bar and a fixed sidebar |
| ☑ | S-26 | Dark theme on the sidebar | `#000!important`, `inset -1px 0 0 oklch(20% 0.008 260)`, active item bg `oklch(17% 0.02 260)`, rail badge ring `#000` | proto.js:60-63 | portal CSS (already in `00-tokens.css` generated file) |

#### 2.3 Top bar

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | T-01 | Bar | `height:52px;display:flex;align-items:center;gap:12px;padding:0 16px`; bottom border `light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6))`; bg `light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))` + `backdrop-filter:saturate(1.4) blur(10px)` (team board); sticky z 40. Order: [phone menu] · SBC logo · location trail · (right) [Before/After] · Search ⌘K · Announcements · Notifications · Theme. **No profile, no Ask VCFO button** (DESIGN-RULES rule 2). | s/team/topbar.dc.html:15-46,50-69; s/home/v7_before.dc.html:249; s/docs/topbar.dc.html:22-53 | ADAPT `src/components/shell/TopBar.tsx` for the client role: remove `AskLauncher` and profile/UserFace from the client top bar; keep `AnnouncementsBell`, `NotificationsBell`, `ThemeToggle`, `CommandPalette` |
| ☑ | T-02 | Phone menu button | ≤767 only: 40×40 r8, transparent, `margin-left:-6px`, hamburger 20 px (`M4 6h16 M4 12h16 M4 18h16`), `data-vp-menu`, `aria-label="Open menu"`; opens the drawer. On phone the logo, crumb icon, ancestors and theme toggle hide; current page title shows at `15px` w700; right buttons become 40×40 and the search box becomes a transparent 40 px icon. | s/team/topbar.dc.html:16-18,37-46,51 | ADAPT TopBar (EXISTS `MobileNavSheet` trigger) |
| ☑ | T-03 | Logo | `<a aria-label="SBC home">` img height 26 (`b/58222…png` = `public/client-portal/sbc-logo-top.webp`); tooltip "SBC home" is suppressed as obvious; phone docs board 22 px | s/team/topbar.dc.html:52 | EXISTS `src/components/brand/SbcLogo.tsx` — check it renders this same art; link → Home |
| ☑ | T-04 | Location trail | `nav[aria-label=Location]`: 24×24 r8 icon tile (`--primary-light` bg, `--primary` icon, 13 px Lucide-style page icon) + `ol` crumbs: ancestors `13px` w500 `--muted` (links), separators `/` in `--subtle` (team/docs boards) or a 12 px chevron `M9 6l6 6-6 6` in `light-dark(oklch(45% 0.03 255 / .45), oklch(82% 0.021 255 / 0.45))` (home `v7x_topbar` board), current page `13px` w600 `--fg`, `aria-current=page`. Long trails truncate each crumb (`min-width:28px`, current `min-width:48px`, ellipsis); the right group never moves. Pattern: Home / [mid] / Current. | s/team/topbar.dc.html:53-61,72-87; s/home/v7x_topbar.dc.html:144 ("Long trail") | EXISTS `src/components/shell/shell-crumbs.ts` (+ tests) — ADAPT rendering |
| ☑ | T-05 | Search ⌘K | Button `aria-label="Search (⌘K)"`, 256×36 r8, border/bg per §1.4, 14 px search icon in `oklch(54.6% 0.215 263 / .8)`, "Search" label + `⌘` `K` kbd chips; `cursor:text`. Collapses to a 36 px icon at the breakpoints in §1.10. In the prototype desktop click only shows the toast "Search · type to find steps, filings and documents"; on the phone home it opens a bottom sheet "Search" with a 44 px input ("Search steps, filings, documents") and 3 result rows (step / document / filing) that navigate. | s/team/topbar.dc.html:26-28,31-34,63; proto.js:245; s/home/mobile.html:375-376 | EXISTS `src/components/shell/CommandPalette.tsx` (cmdk, client group at :391-399, knowledge-bank search) — ADAPT trigger styling; on phone render the palette as a bottom sheet |
| ☑ | T-06 | Announcements | 36×36 r8 icon button (megaphone, duo-tone fill `.26`); active page = `--primary-light` bg + `--primary` icon; an 8 px gold dot (`top/right:6px`, ring `0 0 0 2px var(--panel)`) when there is something new and you're not on Announcements. Click → Announcements page. | s/team/topbar.dc.html:64; proto.js:231 | EXISTS `src/components/shell/AnnouncementsBell.tsx` (unread count, popover) + `/api/announcements` — ADAPT: gold dot instead of count, navigate to `/app/client/announcements` |
| ☑ | T-07 | Notifications | 36×36 bell; when unread: `--primary-light` bg / `--primary` icon (stroke 2.25) and a badge (16×16 r99 `--primary-fill` bg, `700 11px/1`, ring `0 0 0 2px var(--panel)`, `top/right:3px` team / `4px` home); `aria-label="Notifications, 3 new"`. Click → Notifications page. | s/team/topbar.dc.html:30,65; s/home/v7_before.dc.html:249 | EXISTS `src/components/shell/NotificationsBell.tsx` + `/api/notifications` — ADAPT visuals |
| ☑ | T-08 | Theme toggle | 36×36 r8, `1px solid var(--border)`, `--panel` bg, `--muted`, 16 px sun icon (stroke 1.7); hidden on phone (lives nowhere else on phone). Toggles light↔dark (see §1.1). | s/team/topbar.dc.html:66; proto.js:7-34 | EXISTS `src/components/common/ThemeToggle.tsx` — ADAPT size/icon + `data-theme` attribute |
| ☑ | T-09 | Top-bar tooltips | `data-tip` + `data-tip-below` (tooltip under the button); obvious labels (SBC home, Search (⌘K), Announcements, Notifications…) have tooltips removed by `tidyTips()` | s/team/topbar.dc.html:52-66; proto.js:661-674 | Radix tooltip only on the theme toggle |

#### 2.4 Before | After incorporation pill

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | B-01 | Pill (desktop) | `role=group aria-label="Before or after incorporation"`, 168×32 track (r9, padding 3) with a sliding navy thumb (`translateX(100%)` when After, `.42s cubic-bezier(.22,1.2,.36,1)`), two `aria-pressed` buttons "Before" / "After" (`700 12px/1`, pressed `#fff`, `.25s` colour). Inserted in the top bar right before Announcements (`#vp-ba-top.vp-ba-slot`, margin `0 6px`); on absolutely-positioned top bars it is placed 10 px left of Search. Re-checked every 600 ms. | shell.js:215-226,539-583 | **Decision needed.** In the real app "before/after" is a fact of the engagement (`ClientOverview.incorporated` = CIN or incorporation date present, `src/db/repositories/client-overview.ts:252`). Proposed: no user toggle for clients; render the pill only for staff previewing a client (super-admin preview already exists in Ask: `AskPreview`) or behind a demo flag. If kept, NEW `useIncorporationView()` context that defaults to the real state. |
| ☑ | B-02 | Tablet variant | Vertical 56×66 in the rail under the nav (`.vps-bar`, tooltip "Show the company before or after incorporation"), thumb moves `translateY(100%)`, labels 11.5 px | shell.js:221,223-225,320 | same decision |
| ☑ | B-03 | Phone variant | Top of the drawer, full width × 46 px, labels 13 px, under the header with a bottom border | shell.js:227-229,280 | same decision |
| ☑ | B-04 | Click | Same value → toast "Already showing the company before/after incorporation"; else store `vcfo.after`, sync all pills + Incorporation badge (6/14 ↔ 14/14), dispatch `document` event `vcfo-after` (pages re-render in place). On Home it navigates to the other Home board (fade 140 ms); elsewhere toast "Showing the company after/before incorporation". | shell.js:544-553,576-582; proto.js:196-219 | n/a if derived; if kept: React context + router refresh |

#### 2.5 Ask VCFO launcher (bottom-right, every route)

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | L-01 | Container `#vp-launch` | `position:fixed;right:var(--vpl-in);bottom:0;z-index:2147482500;display:flex;align-items:flex-end;gap:4px;pointer-events:none`. Children: the character (`.vpl-char`, width `--vpl-w`, height `--vpl-w*200/340`, overflow hidden = clipped at the screen edge) and the pill. | proto.js:326-330,565-570 | ADAPT `src/components/ask/AskLauncher.tsx` (today a top-bar text button + ⌘J; the client portal wants this bottom-right launcher instead, keep ⌘J shortcut) |
| ☑ | L-02 | Character loop | `charSVG('vpv-loop')` = `v7-inputs/visor-avatar-animated.svg` rebuilt inline with per-instance ids; head `vpvRise 20.5s infinite` (rises from 232 → 72 → 44 → 0 (fully up, 48.3–66.3%) → 72 → 232 units), eyes `vpvLook 20.5s ease-in-out`, eyes blink `vpvBlink 20.5s`, hands `vpvGrip 20.5s ease-out` (right hand +.09s, `fill-mode:backwards`). Head is clickable (`pointer-events:visiblePainted`) and toggles the chat. | proto.js:341-352,449-476,568,581 | NEW `src/components/client-portal/VcfoAvatar.tsx` (props `variant: 'loop' | 'peek' | 'head'`, unique ids via `useId()`), CSS from §4.6 |
| ☑ | L-03 | Ducks ("yield") | `.vpl-lift` translates `0 → 100%` (`.32s cubic-bezier(.5,0,.75,.4)`) while: the page is scrolling (any scroll container; 650 ms after the last scroll it rises back with `.5s cubic-bezier(.34,1.45,.5,1)`), the chat is open, `body.sheet-open`, or the character would cover a control (a 6×4 sample grid of `elementsFromPoint`; a control overlapping >20% of its own area counts). Head is not clickable while yielded. Re-checked every 1 s and on resize. | proto.js:331-333,482-499,558-564,572-574 | NEW hook `useLauncherYield()` (scroll listener capture:true + interval) |
| ☑ | L-04 | "Ask VCFO" pill | Always visible: `height:var(--vpl-ph)` (36/40), `padding:0 14px 0 12px`, gap 7, r8, `#0f2a4a`, `#fff`, `700 13px/1`, shadow per §1.7, hover `#17396b`, active `scale(.97)`, focus 3 px sky ring. Content: 8 px teal dot (`#2DD4BF`, `0 0 0 3px rgba(45,212,191,.22)`) + "Ask VCFO". Open state: shows a 14 px × + "Close" instead; `aria-label` "Open Ask VCFO chat" / "Close Ask VCFO chat", `aria-expanded`, `aria-controls="vp-chat"`. Hidden (opacity 0) while a phone sheet is open. | proto.js:334-340,569-570,599-609 | ADAPT AskLauncher |
| ☑ | L-05 | Bottom spacer | `html.vp-endpad body::after` adds a 1 px-wide block of height `--vp-launch-h` (painted with `--vp-endpad-bg`) so the last row can scroll clear of the pill; only switched on when the page scrolls or a control sits under a pill; inner scroll panels ending under a pill get `.vp-endpad-box::after`. `:root{scroll-padding-bottom:var(--vp-launch-h)}`. | proto.js:320,322-324,500-557 | Simplify: `padding-bottom: var(--vp-launch-h)` on the portal `<main>` |
| ☑ | L-06 | Lift above a sticky action bar | If a page lifts the launcher (launcher bottom > 1 px above the viewport bottom) the spacer is skipped and the chat follows via `--vpl-lift` | proto.js:528-530,563 | expose a CSS var the step page's sticky `.abar` can set |
| ✗ | L-07 | Board robots hidden | Every board-drawn robot / `#ask-panel` is hidden (`.vp-hide-bot`) so only one launcher exists | proto.js:402,622-631 | n/a |
| ☑ | L-08 | Phone home owns its chat | `window.__vcfoOwnChat=true` on `s/home/mobile.html`: the pill/character clicks forward to the page's own `#botBtn`, which opens its bottom-sheet chat | proto.js:315,575,595; s/home/mobile.html:382 | one implementation in the real app (C-12 sheet) |
| ☑ | L-09 | Reduced motion | Static, fully-risen head, hands visible, no loop, no transitions | proto.js:408 | same |
| ☑ | L-10 | Older concepts (superseded) | `v7x_launcher_concept` (108 px avatar, spring rise 600 ms after load, 50 px peek while scrolling), `v7chat_launcher` (68 px round button + "Ask VCFO" speech tag + first-visit bubble "Hello. Ask me anything…" with 2 quick questions, appears at .9s) | s/home/v7x_launcher_concept.dc.html; s/home/v7chat_launcher.dc.html:144 | The first-visit bubble is still an owner decision ("First-visit bot note: Once per client") — NEW `ask_client_prefs.first_note_seen_at` (or reuse `askClientPrefs`) |

#### 2.6 Ask VCFO chat panel

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | C-01 | Window `#vp-chat` | `section role=dialog aria-label="Ask VCFO chat"`; fixed above the pill (sizes §1.8), r12, `1px solid light-dark(#dde3ec, oklch(25.4% 0.012 258.3))`, shadow §1.7, `500 13px/1.5`. Closed: `translateY(12px) scale(.96)`, opacity 0, hidden; open (`.on`): none/1/visible, `transform .26s cubic-bezier(.22,1,.36,1), opacity .18s`, origin bottom-right. Opening focuses the input (60 ms), Esc closes, closing returns focus to the pill. While open, `html.vp-chat-on` and the launcher character ducks. | proto.js:354-355,565-610 | EXISTS `src/components/ask/AskPanel.tsx` (Radix Dialog, framer-motion, side-panel/push layout via `use-ask-layout.ts`) — ADAPT to a floating window anchored to the launcher for the client portal |
| ✗ | C-02 | Header | Navy `#0f2a4a` bar `padding:12px 12px 12px 14px`, gap 10: 36 px white circle with the static head (`headSVG`, 31×39 offset 9 px down), "Ask VCFO" (`800 14px`) / "Answers from Northwind’s project data" (`11.5px #c7d2e2`), 36×36 r6 × button (`rgba(255,255,255,.12)`, `400 22px`). Board variant: back button (in thread), bot avatar with mood, subtitle "Answers from verified sources" with a 7 px green dot `oklch(72% 0.15 160)`, "Expand to side panel" + "Close Ask VCFO" 32×32 buttons. | proto.js:356-359,577; s/home/v7chat_answer.dc.html:144 | ADAPT AskPanel `Header` (subtitle already "Answers from verified sources"); expand-to-side-panel = existing push layout (`AskPushColumn`) |
| ☑ | C-03 | Peek character | `.vpc-pk` above the window's top edge (`right:clamp(16px,6%,30px)`, width `--vpk-w`, overlapping by `16/340`): once per open the hands grip in (`vpvGripIn .32s ease-out .08s`, right +.09s), the head rises (`vpvPeek .95s cubic-bezier(.3,.75,.35,1) .22s`), looks left/right (`vpvPeekLook 2.2s ease-in-out 1.25s`), then blinks every 6.5 s from 3.5 s (`vpvPeekBlink`). | proto.js:380-393,577 | VcfoAvatar `variant="peek"` |
| ☑ | C-04 | Moods (never the mouth) | Antenna `.vpv-ant` `transition:fill .3s`: thinking = antenna pulse `vpvAnt 1s infinite`; answered (`vpc-ok`) = `#22C55E` + head hop `vpvHop .7s cubic-bezier(.3,1.5,.5,1)`; can't answer (`vpc-nan`) = `#94A3B8` + dip `vpvDip 1.2s ease-in-out`. Mood replays on every new answer. | proto.js:394-401,443-448 | map to `AnswerEnvelope.origin` (`reviewed|generated|deterministic` → ok, `refusal` → nan) |
| ☑ | C-05 | Home state (runtime) | First assistant bubble "Hello. Ask me anything about Northwind’s setup, or pick a question below." + suggestion chips (before COI: "What is my next step?", "Where is my incorporation now?", "Which documents are missing?"; after: "What is due next?", "Which registrations are pending?", "When is FC-GPR due?") in a wrap row (`max-height:40%`, scroll) above the composer. | proto.js:366-367,411-420,427,578 | EXISTS `AskHome.tsx` + `GET /api/ask/suggestions` (`use-ask-suggestions.ts`) |
| ☑ | C-06 | Home state (board) | Navy hero "Hello, / Northwind Technologies" (`.metric 21px`), overlapping project card (Northwind’s project · chip "SPICe+ Part B" · current step "Registered Office Address" · 5 px progress bar · "7 of 38 steps done"), "Quick questions" with a 2-tab navy sliding pill ("About Northwind’s project 2" / "Learn the basics 4") and 40 px question rows with → icon, "Pick up where Northwind left off" rows (Last conversation, Northwind’s Library, Monthly status brief) each with an (i). | s/home/v7chat_home.dc.html:144; s/home/v7chat_answer.dc.html:144 (`isHome`) | EXISTS AskHome (suggestions), `/api/ask/library`, `/api/ask/brief` (`StatusBriefButton.tsx`), `/api/ask/conversations/[id]`, overview progress |
| ☑ | C-07 | Ask → thinking | User bubble (navy, right, `10px 10px 2px 10px`) then a typing bubble with three 6 px `#7a889c` dots (`vpTh 1s`, .2/.4s delays); window gets `vpc-think`; answer after 900 ms (0 with reduced motion). Board thinking state: three primary dots + a step list "Checking Northwind’s project…" (done, green) / "Finding sources…" (spinner) / "Writing…" (pending, dashed), `aria-live` "Finding sources…". | proto.js:365,611-619; s/home/v7chat_thinking.dc.html:144 | EXISTS streaming `POST /api/ask/chat` (`streamChat` in `src/hooks/ask/ask-api.ts`, `status` in AskContext) — show the board's step list from stream status events |
| ☑ | C-08 | Answer (runtime) | Assistant bubble (`light-dark(#f1f4f8, …)`, `10px 10px 10px 2px`) with the canned text; unknown questions → "I can’t answer that one yet. I can pass it to Northwind’s project lead." + button "Hand off to Arjun Mehta". | proto.js:361-364,612-617 | EXISTS `AskAnswerCard.tsx`, `AskThread.tsx` |
| ☑ | C-09 | Answer (board, the content spec) | Avatar 28 px with `react` pop; card: chip "Reviewed by SBC" (`--ok-light`/`--ok-text`, or "AI answer · check with Northwind’s lead" grey for uncertain), answer `14px/1.5` with superscript source number, a phase mini-visual (2×2 grid of clickable phase tiles with tooltips → drill-down), gold-ruled "Why it matters to Northwind", action buttons ("Open Incorporation", "Open Registered Office Address"), "Sources" row (chips "1 Northwind’s project"). Under the card: "Ask my lead" button, "Helpful?" + 👍 / 👎 30×30 icon buttons. | s/home/v7chat_answer.dc.html:144 | EXISTS `AskAnswerCard.tsx` (envelope with visuals `src/components/ask/visuals/*`, `TrustBadge.tsx`, `AskLinkButton.tsx`). **NEW** 👍/👎: `POST /api/ask/messages/[id]/feedback` + column `ask_messages.feedback` (`'up'|'down'|null`) + `feedback_at`; repository fn in `src/db/repositories/ask-messages.ts` scoped to the conversation owner |
| ☑ | C-10 | What's this? answer card | `.vpc-card` (r10, border, shadow §1.7): title `800 14px`, text `13.5px/1.55`, "Why it matters to Northwind" block, "Source: …" (`11.5px #6b7a90`), button "Open this step" / "Open <page>" with → icon (`1px solid #2e5cff`, `700 12.5px`, hover `light-dark(#eef2ff, …)`). Data from `window.vcfoWhatsThis(q)` = `{title,text,why,source,go}` provided by the Incorporation pages for questions shaped `What’s this: <step title>?`. | proto.js:372-379,435-442,616; s/inc/board.html:1143-1155 | EXISTS `WhatsThisButton.tsx`, `GlossaryTerm.tsx`, `/api/ask/topics/[slug]`, `/api/ask/glossary` |
| ☑ | C-11 | Hand-off to a human | Runtime: "Hand off to Arjun Mehta" → assistant "Sent to Arjun Mehta. You will get a reply by email within 1 working day." + toast "Handed off to Arjun Mehta" with Undo. Board (`v7chat_handoff`): uncertain answer + "Ask my lead" (primary-tinted) → inline form card (3 px primary top border): lead avatar + "Arjun Mehta (i: Project Lead · replies by email)" / "Project Lead", label "Ask Northwind’s project lead" (i: "The last 4 messages go with it, so they have the context."), textarea prefilled with the question, Cancel / "Send to lead"; sent state: green status "Sent to Northwind’s project lead. They’ll reply by email." + Close. | proto.js:429,587; s/home/v7chat_handoff.dc.html:144 | EXISTS `AskHandoffForm.tsx` + `POST /api/ask/handoff` (creates a task for the lead; `src/db/repositories/ask-handoff.ts`) |
| ☑ | C-12 | Composer | Runtime: `form` with input "Type a question" (40 px, r8; phone 44 px / 16 px) + navy "Send" (40 px, r6, `700 13px`). Empty submit → focus + toast "Type a question first, or pick one above". Board: input "Ask about Northwind’s setup…" (38 px) + (i) ("Northwind can see questions asked here. Ask VCFO explains; it doesn’t give legal advice. Northwind’s project lead confirms decisions.") + 38×38 primary send icon (40% opacity when empty). | proto.js:368-370,589; s/home/v7chat_answer.dc.html:144 | EXISTS `AskComposer.tsx` |
| ☑ | C-13 | Phone: bottom sheet | ≤767: `left:0;right:0;bottom:0;width:auto;height:min(640px,calc(100dvh - 20px - var(--vpk-w) * .6))`, `border-radius:16px 16px 0 0`, top border only, `padding-bottom:env(safe-area-inset-bottom)`, closed `translateY(24px)`; all buttons ≥40×40; prototype bar hidden while open. | proto.js:404-406 | ADAPT AskPanel (EXISTS `src/components/ui/sheet.tsx`) |
| ☑ | C-14 | Open from anywhere | `window.vcfoChat(q)` opens and optionally asks; any control labelled "Ask VCFO about this" / "Ask VCFO why" / "Open Ask VCFO" opens the chat with "Tell me about <nearest heading>"; `#chat` in the URL or `vcfo.openChat` opens it 500 ms after load. | proto.js:233,247-253,273,592,620 | EXISTS `useAskOptional().ask({message,context})`, `AskFocusHandler.tsx`, `useAskFocus` |
| ☑ | C-15 | Persistence | Log kept in `sessionStorage vcfo.chat` and re-rendered on every open; scroll to bottom | proto.js:421-434 | EXISTS conversations in DB + session key in `AskProvider` |
| ☑ | C-16 | Reduced motion | No typing animation, no peek motion, instant open; mood still shown by colour | proto.js:408,618 | same |

#### 2.7 Feedback, tooltips, pop-overs

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | N-01 | Toast `#vp-toast` | One toast at a time, `role=status`, bottom-centre (`bottom:64px`; ≤700px `100px`), `#0f2a4a`, `600 13px`, r8, shadow §1.7; enters from `translate(-50%,12px)`/opacity 0 (`opacity .18s, transform .22s cubic-bezier(.22,1,.36,1)`); auto-hides after **3200 ms** (timer restarts on each toast). Optional **Undo** button (`rgba(255,255,255,.14)` bg, `#e6c46e`, `700 12px`, 28 px, r6) runs the callback and shows "Undone". | proto.js:130-132,158-166 | EXISTS `react-hot-toast` via `src/components/ui/hot-toast.tsx` — ADD a portal "navy" variant + `toastUndo(msg, onUndo)` helper |
| ✗ | N-02 | Fallback feedback (prototype-only) | Any control that changes nothing within 380 ms shows a toast from its label (download/zip/upload/copy/contact/portal/approve…/search) | proto.js:237-258,287-292 | drop (every control is real) |
| ☑ | N-03 | Runtime icon tooltip `#vp-tip` (rule 17) | For icon-only controls (`aria-label`, ≤2 chars text, no own tooltip, not "obvious"): navy `#0f2a4a` bubble `700 12px/1.3`, `padding:5px 9px`, r6, centred 32 px above the control (below it when < 4 px from the top), clamped 8 px from the edges; appears **120 ms** after hover (`opacity/transform .12s`, from `translateY(3px)`); hidden on pointerdown and any scroll. `role=tooltip`. Obvious labels (WhatsApp/Call/Email/Teams/About/More actions/Notifications/Close/Ask VCFO/SBC home/Search (⌘K)/Details/Open/Open menu/Announcements/file types…) get no tooltip. `title` attributes are converted to `aria-label` and removed. | proto.js:133-134,295-311,660-674 | ADAPT `src/components/ui/tooltip.tsx` (Radix) to navy styling, `delayDuration={120}`; one `TooltipProvider` already in `app/providers.tsx` |
| ☑ | N-04 | CSS tooltip `[data-tip]` | `::after` bubble `bottom:calc(100% + 9px)`, navy, `700 11.5px/1.25`, `padding:5px 9px`, r6, z 70, `tipin .12s`; 8 px rotated-square arrow `::before` at `calc(100% + 5px)`; `[data-tip-below]` flips under. | b/ecdc…css:165-173 | same Radix tooltip (side top/bottom) |
| ☑ | N-05 | Rule-14 tooltip `.tt > .tb` | Navy bubble `700 11.5px/1.3` over its part, `translate(-50%,4px)→(-50%,0)`, `.14s`; `.tm` meta at 600/.72; `.below` variant; `.tt.show` forces it (touch) | b/5f811734…css:2-7 | Radix tooltip / chart tooltip (EXISTS `src/components/charts/ChartTooltip.tsx`) |
| ☑ | N-06 | `.tipw .tt` (home boards) | Same navy bubble `700 12px/1.3`, `.12s`; `.l` = left side; `.w` = white variant (`light-dark(#fff, …)`, navy text) | s/home/v7x_drilldown.dc.html:128-135 | same |
| ☑ | N-07 | (i) info pop-over | Trigger: 18×18 button (15 px circle-i icon `circle r9 + M12 11v5M12 8h.01`, stroke 2), `oklch(62% 0.02 255)`, navy on hover/focus/open; touch hit area +11 px (`pointer:coarse`). Pop-over: under the icon (`top:calc(100% + 8px)`, centred), `min-width:200px;max-width:280px` (`min(280px,calc(100vw - 24px))`), `padding:10px 12px`, r8, border, shadow §1.7, `500 12px/1.45`, 10 px rotated-square arrow; opens on click / Enter / Space (`.info.open` or `:focus-within`), `.15s` fade+slide (`translate(-50%,-4px)`→0); closes on outside click, Esc, Tab out; one open at a time; on phone it is nudged to stay 8 px inside the viewport. Last row: 16 px bot avatar + "Ask VCFO about this" (border-top `--hair`, `--primary` w700) → opens the chat with the row's title as the question. Build note on the board: "Radix Popover, role="dialog" when it holds the link". | b/ecdc…css:108-116; s/home/v7x_info_popover.dc.html (spec list); s/home/v7_before.dc.html:164+ (`.info .pop` max-width/display rules); s/home/mobile.html:216,338 | EXISTS `src/components/ui/popover.tsx` (Radix) + `FieldHelpButton.tsx` / `GlossaryTerm.tsx` — NEW shared `InfoPopover` component with the "Ask VCFO about this" row calling `useAskOptional().ask(...)` |
| ☑ | N-08 | Bot speech bubble (rule 16) | `.bot` flex gap 12: 40 px `--primary-light` circle with the static head (`window.vcfoBotSVG`, 34×43, 9 px down) + `.bub` (`--with-light` bg, r10, `9px 12px`, `12.5px/1.5`) with an optional 30 px button ("Ask VCFO why" → chat, or `data-go`) | s/inc/board.html:75-79,597; proto.js:477-480 | NEW `BotSays` component (uses VcfoAvatar `variant="head"`) |
| ☑ | N-09 | Static bot (board `v7c_bot`) | 4 states, same head SVG in a `0 -40 240 240` box: idle (antenna `#2DD4BF`), thinking (antenna `#7DD3FC` + `vbAnt` pulse, eyes `vbScan` side-to-side), answered (`#34D399`), cannot (`#94A3B8`); `role=img` labels "Ask VCFO assistant[, thinking|, answered|, cannot answer]" | s/home/v7c_bot.dc.html:141-150 | VcfoAvatar `variant="head" mood=…` |

#### 2.8 Drill-down pop-up, bottom sheet, dialogs

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | D-01 | Runtime drill `window.vcfoDrill(cfg)` | `cfg = {title, sub?, link?:{lead,text,where,go|onClick}, tabs:[{label, color?, n?, rows:[[name, meta, status, statusColour, route?]]}], active}`. Scrim `#vp-drill-scrim` (`rgba(8,20,40,.5)`, z 2147482000, `opacity .18s`, content top-aligned at `max(72px,8vh)`); dialog `#vp-drill` (`role=dialog aria-modal`, `aria-labelledby`), `translateY(10px) scale(.98)`→none `.24s`. Optional top strip (`light-dark(#eef3ff, …)`, "These items live in X" + "Open X →" link `#2e5cff 800 12.5px`). Header: title `700 15px` + sub, 32×32 × button. Tabs: segmented control (`light-dark(#f1f4f8, …)` track with `inset 0 0 0 1px #e3e8ef`, 30 px buttons `600 12px`, optional 8 px colour square, count in IBM Plex Mono; selected = `#0f2a4a` bg white text). List rows: grid `minmax(0,1fr) auto auto 16px`, name (ellipsis) · mono meta · coloured status chip (`700 11px`, white on the given colour) · `→` in `#2e5cff`; hover `light-dark(#f5f7fa, …)`. Footer "Showing n of m · the full list is in X" / "Showing all n". Close: scrim click, ×, Esc (capturing); focus moves to × and returns to the opener; row click → `go(route)` or toast "Opening <name>…". ≤700 px: bottom sheet (`align-items:flex-end`, full width, `14px 14px 0 0`, `max-height:86vh`). | proto.js:683-739 | NEW `DrillDown` component (Radix Dialog = EXISTS `src/components/ui/dialog.tsx`; `Sheet` on phone). The board variant (D-02) is the pixel reference. |
| ☑ | D-02 | Drill board `v7x_drilldown` (the owner's component) | 600 px (`min(600px,calc(100vw - 24px))`), `max-height:min(560px,calc(100dvh - 24px))`, r12, shadow `0 30px 70px -20px oklch(15% 0.05 258 / .6)`; top strip `--primary-light` "These items live in {Incorporation|Filings|Notifications|Documents|Team|Compliances}" + "Open … →" (derived from the title); header 15 px + 30×30 ×; **navy sliding pill** (`.seg` with `.thumb` width `calc((100% - 4px)/n)`, `translateX(i*100%)`, spring `.42s linear(…)`) whose first tab may be "All"; rows `.ddrow` grid `minmax(0,1fr) 62px 116px 16px` (name · mono date · full-width status chip `--{ok|prog|due|up|over}-chip` · → arrow); empty "Nothing here."; footer `--raised` "Showing n of m" + "Open full list". ≤640: tabs wrap without the thumb (selected = navy), date column hidden. Spec: hover a part → tooltip "name + count/date"; click/tap/Enter → pop-up with that part pre-selected; each part is a real button with an aria-label. Reduced motion: pill jumps, no fade. | s/home/v7x_drilldown.dc.html:142-238; s/home/v7x_drilldown_spec.dc.html | same NEW `DrillDown` (+ EXISTS `src/components/charts/*` for the parts) |
| ☑ | D-03 | Shared `.dpop` (rule 14 pop-up, gradient header) | 640×≤720, r12, `v7up .3s`; header `linear-gradient(115deg,var(--navy-deep,var(--navy)),var(--navy-2-deep,var(--navy-2)) 70%,var(--navy-3-deep,var(--navy-3)))` with a 3 px gold fade underline; rows `.drow` 10px 18px, hairline separators, hover `light-dark(oklch(96.8% 0.006 250 / .8), oklch(17.8% 0.006 250 / 0.8))` | b/5f811734…css:10-16 | variant of DrillDown (used by Incorporation/Compliances pages) |
| ☑ | D-04 | Phone bottom sheet (mobile home) | Scrim `oklch(20% .05 258 / .45)` (z 60, `.2s`); sheet z 61 `width:min(100%,560px)`, `max-height:min(82vh,calc(100dvh - 24px))`, r `14px 14px 0 0`, shadow `0 -16px 40px -20px oklch(15% .05 258 / .5)`, slides `translate(-50%,105%)→(-50%,0)` `.38s var(--spring)`; grab handle 40×4 `--border`; header `800 16px` + 44 px close; body scrolls; opening adds `body.sheet-open` (launcher ducks + pill hides, prototype bar hidden); Esc / scrim / × close; focus to × then back. Same toggle closes. Used for drill-downs (with a sliding segmented control), search, uploads ("Choose a file" / "Take a photo"), password reveal, chat. | s/home/mobile.html:144-152,182,202,301-312 | EXISTS `src/components/ui/sheet.tsx` (side="bottom") — ADAPT styling; DECISIONS.md: "Mobile drill-downs: Bottom sheet" |
| ☑ | D-05 | Board overlays `.ov` / `.dlg` | `.ov` scrim `oklch(21% 0.042 264 / .42)`; `.dlg` 460 px r12, header/body/footer paddings `16px 18px` / footer `12px 18px` on `--raised`. Runtime forces `.ov`, `.ddscrim` fixed full-screen at z 2147482000 and `.dd` at `top:max(72px,8vh)`, `max-height:calc(100vh - 110px)`; any card containing a z 201 pop-up is lifted (`transform:none`, z 2147481500) so pop-ups escape their card. | b/ecdc…css:145-149; proto.js:143-146 | EXISTS `dialog.tsx` / `alert-dialog.tsx` (portalled, so the stacking hack is unnecessary) |

#### 2.9 Runtime glue (routing, transitions, scrollbars, theme)

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | R-01 | Route table | `routes.js`: route key → `{d: desktop board, m: phone board, t: title, hide}`; `home` resolves to `home-after` when After; phone device uses `m` | routes.js:1; proto.js:88-116 | Next app router (`app/app/client/**`) |
| ☑ | R-02 | Page transitions | Leave: `html.vp-leave body{opacity:.35;transition:opacity .14s}` then navigate after 140 ms. Enter: `html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1) both}` (class removed after 400 ms). | proto.js:108-115,135-137,154,748 | EXISTS `src/components/shell/PageTransition.tsx`, `Stagger.tsx` — set to `vpIn` metrics |
| ☑ | R-03 | No visible scrollbars | `html,body,*{scrollbar-width:none!important}` + `::-webkit-scrollbar{display:none}` | proto.js:141-142 | portal CSS (already in generated `00-tokens.css`) |
| ☑ | R-04 | Theme | §1.1 | proto.js:6-77 | ThemeToggle + next-themes |
| ☑ | R-05 | Already-on-page | `go(route)` to the current route → toast "You are already on <title>"; selected tab clicked again → "Already showing <tab>" | proto.js:111,288 | optional |
| ☑ | R-06 | `data-go` tiles | Any `[data-go]` tile navigates, but inner controls (links, buttons, inputs, `.info`) keep their own click | proto.js:264-269 | `<Link>` wrappers with `stopPropagation` in inner buttons |
| ☑ | R-07 | External links | `https?:` links → toast "Opens <label> in the full app"; `window.open` stubbed | proto.js:278, outer-shell.html:288 | real `target="_blank" rel="noopener"` (portal links ↗, rule 15) |
| ✗ | R-08 | Prototype control bar | Bottom-centre navy toolbar (Before COI/After COI, Desktop/Mobile 390, page select, ×) or "PROTOTYPE" mini button | proto.js:121-129,169-193 | **drop** (prototype-only) |

#### 2.10 Timeline editor pop-up (`tl-editor.js`)

| Done | id | element / state / interaction | exact behaviour | prototype file:line | Real app |
|---|---|---|---|---|---|
| ☑ | E-01 | Open | From Home card "Timeline" → "Edit" (proto.js:274), phone `[data-tledit]`, or `window.vcfoOpenTimeline()`. Scrim `#tle-scrim` `rgba(8,20,40,.5)` z 2147483100 (`.18s`), dialog `#tle` `width:min(1080px,100%)`, `max-height:calc(100dvh - 32px)`, r12, `translateY(10px) scale(.98)`→none `.26s`. Focuses the first unlocked bar. Esc / scrim / × / Cancel close. | tl-editor.js:28-33,106-140; proto.js:274,678-682 | NEW `TimelineEditor` dialog (EXISTS data: `engagements.schedule` via `normalizeEngagementSchedule`; EXISTS change requests `src/db/repositories/client-change-requests.ts` + `app/api/client/change-requests`, `engagement-change-requests.ts` + `/api/engagement-change-requests`) |
| ☑ | E-02 | Mode switch | Segmented "Manager · direct edit" / "Client · change request" (prototype shows both; remembered in `vcfo.tl.mode`). Client mode: title "Request a timeline change", reason textarea "Why do you need this change?" (placeholder "For example: our director is travelling until 14 Oct, so the KYC video call has to move."), error "Add a short reason so Northwind’s project manager can approve it.", primary "Send request", warning "Priya Raman (Project Manager) approves requests. Northwind’s dates stay as they are until then." Manager: "Edit timeline", "Save timeline", "Saving updates the dashboard for everyone on Northwind." | tl-editor.js:111-118,251-258 | role decides the mode: client → change request only |
| ☑ | E-03 | Phases | Phase 1 · Name Application 12–24 Sep (done → locked, hatched, 🔒, toast "Phase 1 is done, so its dates are locked"), Phase 2 · Incorporation 25 Sep–20 Oct (`--navy-3`), MCA review 20–28 Oct (`oklch(70% .03 255)`), COI 28 Oct milestone (gold diamond, 18 px rotated 45°). Axis world 1 Aug–31 Dec 2026, default fit 12 Sep–8 Nov; Today line 6 Oct (red `#d64545` with label "Today 6 Oct"). | tl-editor.js:5-18,62-82 | data from schedule |
| ☑ | E-04 | Drag / resize / keyboard | Bars are `role=slider` (aria-valuetext "12 Sep – 24 Sep · 12 days"); drag body = move, 12 px edge handles = resize start/end; snaps to days (to weeks when < 8 px/day); readout bubble above the bar while dragging/hovering/focused; ghost dashed outline of the saved position; cascade: a phase never starts before the previous one ends, later phases keep their gaps and shift with it. Keyboard ←/→ move by the snap; Shift+←/→ resize the end. Undo stack (60), Reset. | tl-editor.js:68-80,141-142,229-298 | NEW (pure front-end, logic copied verbatim) |
| ☑ | E-05 | Zoom / pan | −/+ buttons (×1.5), range slider (log scale), level label Days/Weeks/Months, Fit; Ctrl/⌘+wheel zooms at the cursor; wheel scrolls horizontally when zoomed in; mouse drag on empty lanes pans; two-finger pinch zooms | tl-editor.js:63-67,144-228 | same |
| ☑ | E-06 | Summary + compare | "COI 28 Oct → 31 Oct" + pill `late` (`light-dark(#fde8e6, oklch(25.2% 0.066 24.1))`/`#b42318` "Slipped by 3 days"), `early` (`light-dark(#e3f6ee, …)`/`#0f7a55` "Pulled in by n days"), `same` ("No change to the COI date"); hint "MCA review and the COI move with Phase 2. The client is told by email and WhatsApp." Before/After lists side by side; per-row "+n d"/"−n d" chips. | tl-editor.js:83-91,229-250 | same |
| ☑ | E-07 | Save / request + Undo toast | Manager: save + toast "Timeline saved · COI 31 Oct · slipped by 3 d" with Undo; client: store pending + toast "Change request sent to Priya Raman" with Undo; no change → toast "No changes to save". Home card bars animate to the new dates (`left/width .5s cubic-bezier(.22,1,.36,1)`); pending chip "Change request pending · COI <date>" (`light-dark(#fdecd3, …)` / `light-dark(#8a4b0f, …)`, `800 11px`, r4, 24 px) before the Edit button; clicking it toasts "Waiting for Priya Raman to approve · “<reason>”". | tl-editor.js:98,299-342 | client: `POST /api/client/change-requests` (EXISTS) with `{kind:'timeline', proposed, reason}`; manager: `PATCH /api/engagements/[id]` schedule (EXISTS route; confirm schedule field) ; Undo = delete the request / restore previous schedule |
| ☑ | E-08 | Phone | ≤767: bottom sheet (`14px 14px 0 0`, `max-height:92dvh`), dates column hidden, 96 px names column, 40 px buttons, wrapped header | tl-editor.js:99-100 | same |

---

### 3. Mapping summary: what the real app needs

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

| Done | Need | Repository | Route | Notes |
|---|---|---|---|---|
| ☑ | Team contacts with phone + avatar (S-11/12) | EXTEND `loadTeam` in `src/db/repositories/client-overview.ts` (add `phoneE164`, `avatarUrl`) | EXISTS `GET /api/client/overview` | Client may only see contacts of their own engagement (already enforced by `assertEngagementAccess`). Consider honouring a "show phone to client" flag. |
| ☑ | Support contact (S-13) | none (config) | NEW `GET /api/client/support-contact` or server prop | env vars, never hard-coded |
| ☑ | Sidebar badges (S-07) | EXISTS `notifications.ts`, `document-requests.ts`, `client-overview.ts` | EXISTS `/api/notifications?head=1`, `/api/requests`, `/api/client/overview` | optionally NEW `GET /api/client/shell-counts` returning `{unreadNotifications, newAnnouncements, incSteps:{done,total}, openDocRequests}` in one call (one repository fn per count, each scoped) |
| ☑ | Announcements "new" dot (T-06) | EXISTS `announcements.ts` | EXISTS `/api/announcements?head=1` | read-state lives client-side today (`readIds` in `AnnouncementsBell`) |
| ☑ | 👍/👎 on answers (C-09) | EXTEND `src/db/repositories/ask-messages.ts`: `setMessageFeedback(ctx, messageId, 'up'|'down'|null)` — only the conversation's `profileId` may write | NEW `POST /api/ask/messages/[id]/feedback` | migration: `ask_messages.feedback text`, `feedback_at timestamptz`; surface counts in the existing admin gaps view (`/api/ask/admin/gaps`) |
| ☑ | First-visit bot note "once per client" (L-10) | EXTEND `src/db/repositories/ask-client-prefs.ts` (`firstNoteSeenAt`) | EXTEND `/api/ask/nudge` or `/api/ask/status` | migration: `ask_client_prefs.first_note_seen_at` |
| ☑ | Timeline change request (E-07) | EXISTS `client-change-requests.ts` / `engagement-change-requests.ts` | EXISTS `POST /api/client/change-requests`, `/api/engagement-change-requests/[id]` | verify a `timeline` kind exists; manager direct edit → engagement schedule update |
| ☑ | Credentials page (nav item) | NEW (out of this area) | NEW `/app/client/credentials` | listed in the FINAL nav |
| ☑ | Intro opt-out (I-07) | none (localStorage) | — | or a profile pref later |
| ☑ | Before/After (B-01) | none | — | derived from `ClientOverview.incorporated`; owner decision whether clients ever see the toggle |

---
<!-- /area:shell -->

<!-- area:incorporation -->
## Incorporation (landing, phase, step, board resolution)

Full catalogue (verbatim CSS, markup, logic): `inventory/incorporation.md`.

### 1. INVENTORY

ID prefixes: `SH` shell, `LD` landing, `PH` phase page, `ST` step page, `BR` board resolution, `OV` overlays (drill, pop-over, brief, tooltip, toast, chat, editor), `AN` animation, `LS` loading/empty, `BA` Before/After, `BP` breakpoints.
Files: L = `final-src/s/inc/incorporation.html` (`x/incorporation.app.js`), P = `phase.html` (`x/phase.app.js`), S = `step.html` (`x/step.app.js`), B = `board.html`, PJ = `final-src/proto.js`, SJ = `final-src/shell.js`, TL = `final-src/tl-editor.js`.

#### 1.1 Shell (every incorporation page)

| Done | id | item | exact behaviour / content | file |
|---|---|---|---|---|
| ☑ | SH-01 | Sidebar | Navy `#0f2a4a`, fixed. 248 px at ≥1280, a 72 px icon rail at 768–1279, a drawer at ≤767 (`--vp-side-w`). Items: Home · Updates (badge 3) · **Incorporation (badge "6/14" Before, "14/14" After, i.e. SPICe+ done/14)** · Compliances ▸ · Documents (6) · Library · Credentials · Team · Audit · Settings. Then "NORTHWIND'S TEAM": Priya Raman · Project Manager, Arjun Mehta · Project Lead, Customer support · SBC help desk (compact rows, hover actions). Then the account row: Rohan Kumar · Northwind · Client. | SJ (`incBadge()` l.269) |
| ☑ | SH-02 | Top bar | 52 px tall, white, bottom border. Menu button (phone only) · SBC logo 28 px · breadcrumb · spacer · Search ⌘K (240 px, collapses to a 40 px icon below 1280) · **Before / After sliding pill** (desktop top bar; inside the rail on tablet; at the top of the drawer on phone) · Announcements · Notifications (badge 3, tinted primary-light) · Theme toggle. No profile, no Ask button. | `*.body`, SJ |
| ◐ | SH-03 | Breadcrumb | Landing: `Home / **Incorporation**`. Phase: `Home / Incorporation / **Phase 2 · Incorporation**` (uses PH names). Step: `Home / Incorporation / **SPICe+ Part B** / **<step title>**` (`crumbPhase()` inserts the PHN phase link). Board: `Home / Incorporation / **Board resolution**`. Phone: only the bold current crumb, navy 14.5 px. | body + S `crumbPhase` |
| ☑ | SH-04 | Ask VCFO launcher | Bottom-right robot and "Ask VCFO" pill. It sinks while you scroll. When the step action bar is present it lifts above it (`.has-act #vp-launch{bottom:var(--acth)}`). | PJ, template CSS |
| ✗ | SH-05 | Prototype bar | Bottom-centre "PROTOTYPE" control (Before COI / After COI, Desktop / Mobile 390, page select). **Prototype-only, do not build.** | PJ `buildBar` |
| ☑ | SH-06 | Page title | `document.title`: "Incorporation · VCFO Suite", "Phase N · <PH> · Incorporation · VCFO Suite", "<step title> · Incorporation · VCFO Suite", "Board resolution · Incorporation · VCFO Suite". | L/P/S/B |
| ☑ | SH-07 | Theme | Every colour uses `light-dark(light, dark)`. Dark = "True black" (proto.js `#vp-dark`). It is already ported as tokens in the uncommitted `src/components/client-portal/css/00-tokens.css`. | all CSS |

#### 1.2 Landing (`/app/client/incorporation`)

| Done | id | item | exact behaviour / content | file |
|---|---|---|---|---|
| ☑ | LD-01 | Layout | `.wrap` (max 1600, gap 16). Row 1 `.r2` = auto-fit grid `minmax(min(100%,400px),1fr)`: COI tile + This week. Row 2 = Timeline card. Row 3 = 4 donut cards (`.dg`: 4 cols → 2 cols ≤1279 → 1 col ≤767). | L `renderLanding` |
| ☑ | LD-02 | Days-to-COI tile (Before) | Navy gradient `linear-gradient(120deg,#0f2a4a,#173f74)`, radius 12, gold 3 px bottom strip. Big button: **"22" + "days to COI"** (number in Space Grotesk 34–42 px tabular; label gold-2 15–18 px). Tooltip "Expected Wed 28 Oct 2026 · window set by Arjun Mehta" ⚠ only a manager can set windows in the real app, so this should name Priya Raman / the manager. Click → SPICe+ drill (`drillRing`). | L `coiTile` |
| ☑ | LD-03 | (i) on COI | `.ibtn` white 75%. Pop-over title "Days to COI": "Counts down to the end of the incorporation window Northwind's manager set (Wed 28 Oct 2026). After the Certificate of Incorporation it shows the real incorporation date." + "Ask VCFO about this" row. | L `INFO.coi` |
| ☑ | LD-04 | "At risk · step 7" chip | Amber `.chip.risk`, link to the first step whose status is `you`. aria "At risk · step 7 · Registered Office Address". Tooltip "Step 7 is waiting on Northwind · due 9 Oct". Shown only Before, and only if a `you` step exists. | L |
| ☑ | LD-05 | SPICe+ ring (inside tile, `.tr1`) | 46 px ring, 5 px stroke, gold `#e6c46e` arc on a white-16% track, "43%" in the middle, "SPICe+" mono caption. Tooltip "SPICe+ · 6 of 14 steps done". Click → drill "SPICe+ progress · Phases 1 and 2 · 6 of 14 steps done", tabs by status, active "Waiting", top link "SPICe+ ends with the Certificate of Incorporation · Open Phase 2 →". DECISIONS: the ring counts SPICe+ steps only. | L `ringBtn`, `drillRing` |
| ☑ | LD-06 | Sub line | Before: "Northwind Technologies India Pvt Ltd · expected Wed 28 Oct". After: "Northwind Technologies India Pvt Ltd · incorporated Sat 24 Oct" + mono "· CIN, PAN and TAN issued" + gold link **"Open certificate"** (→ document viewer). | L |
| ☑ | LD-07 | Steps pill | Full-width bar button: "6 / 48 steps", a 7 px green gradient track (`#1fb488→#2fd3a0`, min width 2%), "13%". Click → drill "All 48 steps · 6 done · 42 to go", tabs Done/Waiting/In progress/With SBC/Upcoming, active "Waiting" (Before) or "With SBC" (After). | L `drillAll` |
| ☑ | LD-08 | COI tile (After) | Big "24 Oct" + "incorporated". Green chip "4 days early" (= days(COI, window end)), tooltip "Window ended Wed 28 Oct". (i) is titled "About the incorporation date". Ring 100%. No count-up. | L |
| ☑ | LD-09 | This week card | Header "THIS WEEK" + mono range "6 – 12 Oct" (After "9 – 15 Nov"). Bot (26 px robot) + bubble "MCA: nothing pending this week." (After "Nothing is waiting on Northwind this week."). Rows (grid 80 px · 1fr · auto, 7 px padding, hairline top border, hover raised): owner chip · text · mono date. Before (fixed): Northwind "Upload NOC · requested by Arjun" 9 Oct → step 7; Northwind "Check & approve step 7" 9 Oct → 7; SBC "KYC review & DSC" now → 10; SBC "Draft MOA & AOA" 12 Oct → 11. After: computed — steps whose status is with/you/prog, sorted by date, first 4, date shows "now" if ≤ today+3 days. Each row links to its step. | L `weekCard` |
| ◐ | LD-10 | Timeline card header | `.card.acc` (gold 30×3 px tab top-left). "TIMELINE" + (i) ("The timeline": "Each bar is the planned window of a phase. The fill is the share of steps done; red is time past the plan. The red line is today; the gold diamond is the COI."). Right: mono "6 of 48 steps · Sep – Dec 2026" + **Edit** button (pencil, 30 px tall) → timeline editor modal (OV-08). | L `phasesCard` |
| ☑ | LD-11 | Gantt axis | Weekly mono labels from 15 Sep to 22 Dec, positioned by `pos(d)` on the AX0–AX1 scale. Every 2nd label hides when a week is under 58 px (`e2`), 3 of 4 hide under 29 px (`e4`). Hidden in simple mode. | L `axis`, `layoutGantt` |
| ☑ | LD-12 | Phase row | Grid `72px | minmax(120px,180px) | 1fr | 84px`, gap 14, min height 58, padding 12 18, hairline top. Cells: **Steps** toggle (`btn sm stb`, chevron-right) · status glyph XL (26 px) + phase name (14 px 700) · lane · **Open →** link button to the phase page (tooltip = PH_TIP, e.g. "SPICe+ Part A · name approval with MCA"). | L `phaseRow` |
| ☑ | LD-13 | Phase bar | `<button class="gbar">` absolutely placed from plan start to max(plan end, actual end). 20 px tall, radius 5. **done** = green fill 100%, plus a red right segment sized `daysLate/(phase duration)`. **active** = `--with-light` background, 1.5 px navy inset outline, navy fill = pct, and the label "Now · step 7" in with-text 11 px at `left: calc(fill% + 6px)`. **up** = hatched `repeating-linear-gradient(135deg,#e3e8ef 0 4px,#f3f5f8 4px 8px)`. Phase 2 gets the **gold diamond** (16 px rotated square, gold, 2 px white ring) at its right end = COI. Hover/focus: brightness 1.08 + 3 px primary 25% ring. Tooltip "SPICe+ Part B · 1 of 9 done · 29 Sep → 28 Oct". Click → phase drill (OV-01) with the link "Every step of this phase · Open the phase page →". | L `phBar`, `drillPhase` |
| ☑ | LD-14 | Bar label | `.glab`: "**100%**" (Space Grotesk 17) + "5 / 5 steps" + an extra: done → "3 days late" (red) or "4 days early" (green); active/up → nothing (FINAL removed "Ends 28 Oct"). JS places it to the right of the bar if it fits, else to the left, else switches the whole card to **simple mode**. White background pill so it can sit over the today line. | L `phLabel`, `layoutGantt` |
| ☑ | LD-15 | Today line | 2 px red vertical button spanning each lane (top/bottom −13 px), 12 px invisible hit area. On the last row when it is closed, a red "Today" tag under it (`.phr:last-of-type:not(.open) .today:after`). Tooltip "Today · Tue 6 Oct". Click → toast "Today · Tue 6 Oct 2026". | L `todayLine` |
| ☑ | LD-16 | Simple mode | Triggered when the lane is under 500 px wide (true at 1024 and 390) or no label fits. Axis and today line hide. The bar goes full width on row 2 and the label wraps under it. | L `layoutGantt`, CSS `.phc.simple` |
| ☑ | LD-17 | Accordion | **Steps** toggles that phase's step table in place. Only one is open at a time (`openPh`). When open: row background `#f7f9fc`, the Steps button turns navy with white text, the chevron rotates 90°, `aria-expanded=true`, aria "Hide the steps of SPICe+ Part B" (otherwise "Show the steps of …"). The body animates `fin .2s ease-out` (opacity 0 / −4 px → 0). The body is `role=region`, aria "SPICe+ Part B steps". DECISIONS: "steps open in place; the phase name still links to the phase page" (FINAL: the Open → button does this). | L `togglePh` |
| ☑ | LD-18 | Landing step table header | Mono uppercase 11 px: (glyph) (#) STEP · OWNER · STATUS · DATE · PORTAL · PROOF · (open). Columns `22px 26px 1fr 88px 128px 112px 112px 76px`. | L `stepTable` |
| ☑ | LD-19 | Step row | Status glyph (set A, tooltip `ltip`) · mono number · title (13.5 px 600, ellipsis, + red "Urgent" tag if `urgent`) · owner chip (Northwind gold `#fbf0d2/#7a5a0c`, SBC blue `#e8eefb/#2349a8`, MCA violet) · status chip (Done green / Waiting amber / In progress navy / With SBC blue / Upcoming outline / **Next** grey `#eef1f5` outline) · date (mono: "Done 4 Oct", "Due 9 Oct", "since 6 Oct", "exp. 28 Oct" for step 14, "—" for Next/Upcoming) · Portal ↗ (SBC/MCA-owned steps except step 2; tooltip "<form> · official portal"; toast "Opens <form> on the official portal in a new tab") + **📎 Proof** chip when such a step is done (opens preview) · **Open →** (`btn sm so`) to the step page. Row with status `you` gets background `#fffdf8` and a 3 px gold inset left bar. | L `stepTable` |
| ☑ | LD-20 | Registration grouping | Phase 4 only: blue uppercase sub-headers General, Customs, Foreign Trade, Labour, Local Compliance, IP/Brand, FEMA, from `regGroup(title)`. The same regexes exist in `internRegistrationHeadingForTitle` in `src/lib/intern-overview-progress.ts`. DECISIONS: check the names against the code. They match the code's `INTERN_REGISTRATION_HEADING_ORDER`. | L `regGroup` |
| ☑ | LD-21 | Not-started phase bubble | When a phase is all `up` and has a PH_WAIT text, the table starts with a bot bubble: P3 "Post-incorporation starts once the Certificate of Incorporation is issued." / P4 "Registrations start after the Certificate of Incorporation. GST comes first." + button "Ask VCFO when it starts" → chat "When does Post-incorporation start?". | L |
| ☑ | LD-22 | Donut "Documents from Northwind" | 96 px donut, 13 px stroke (16 on hover), 1.2 px gaps, centre total. Legend buttons: Submitted 8 `#15805f` · Under review 1 `#2453c7` · Pending 2 `#d9731f` · Sent back 1 `#cf3a2f` (After 11/0/1/0). Each segment/legend → drill with tabs per segment, rows = document names ("From Northwind"), link "Every document, with versions · Open Documents →". | L `donut`, `segData`, `drillSeg` |
| ☑ | LD-23 | Donut "Documents SBC prepares" | Generated 5 `#2f6fd0` · Pending 7 `#dfe4ec` · Signed by Northwind 2 `#15805f` (After 14/5/3), with document names (see code). | L |
| ☑ | LD-24 | Donut "Who's working on what" | Not-done steps by owner: Northwind 4 `#c9a24b` · SBC 36 `#2f6fd0` · MCA 2 `#6b3fc4` (After 0/22/0). Drill rows = steps. | L |
| ☑ | LD-25 | Donut "On plan vs overdue" | Active steps (you/prog/with): On time 3 · At risk 1 (the `you` steps) · Overdue 0 (After 7/0/0). | L |
| ✗ | LD-26 | Removed in FINAL | Navy landing hero (company h1 "Northwind Technologies India Pvt Ltd", eyebrow "INCORPORATION · 4 PHASES", meta "6/48 · COI expected 28 Oct 2026", buttons "Monthly status brief" + "Board resolution ✓ Ready", ring). See §0.1. | L `heroLanding` (dead code) |

#### 1.3 Phase page (`phase.html#p=1..4`) — NEW route

| Done | id | item | exact behaviour / content | file |
|---|---|---|---|---|
| ☑ | PH-01 | Hero | Navy gradient band (`100deg #0f2a4a→#14386a→#1b4f94`, radius 12, gold 3 px bottom gradient). Back button 34 px → landing. Eyebrow mono gold "INCORPORATION · PHASE 2 OF 4". h1 (Space Grotesk 19–23) = PH name ("Name Application" / "Incorporation" / "Post-Incorporation" / "Registration" — ⚠ the landing calls these "SPICe+ Part A/B…"; pick one naming). **What's this?** button (robot mini + text, white-12% fill) → chat "What's this: Phase 2 · Incorporation?". Meta mono: "1/9 · 29 Sep → 28 Oct · ends 28 Oct 2026" ("finished …" when done). Right: prev/next phase buttons ("‹ Phase 1 · Name Application", "Phase 3 · Post-Incorporation ›", max 240 px, ellipsis) + a 50 px phase ring (gold, or green `#2fd3a0` when done) with "Phase 2" caption → phase drill. | P `renderPhase` |
| ☑ | PH-02 | Progress card | `.card.acc.psum`: "PROGRESS" + (i) (title "Phase 2 · Incorporation", text = PH_INFO). Mono "1 of 9 steps". Inline 12 px bar (same `phBar`, inline) + label "11% 1 / 9 steps Ends 28 Oct". Key-date chips (`.kd span` raised, radius 6): "Starts **29 Sep**" · "Ends **28 Oct**" (or Finished) · "Now **Step 7 · Registered Office Address**" (link, not when done) · "COI **28 Oct (expected)**" (phase 2 only) · "Reviewer **Arjun Mehta**". | P |
| ☑ | PH-03 | Steps card | "STEPS" + "9 steps". The generator `stepTable(p, focus)`: columns glyph · # · Step · Owner · Status · Date · ↗·📎 icon header · (?) What's this · → open. 6/7 show 📎 (attachments → step). SBC steps with forms show ↗ portal. The focus row has `.cur` (primary-light background). Statuses use the real KD (no "Next"). | P `stepTable` |
| ☑ | PH-04 | Journey rail (Focus track) | `.card.acc.rail`. Title "INCORPORATION · JOURNEY" (11.5 px) + chip "1 / 9". Rows: glyph · "8 · Proposed Directors" + railSub ("Done · 4 Oct", "Waiting on Northwind · due 9 Oct", "In progress · due 16 Oct", "With Northwind's project lead · since 6 Oct", "Opens later") + sub-step dots (active rows, up to 6 dots: green done, blue current, ring todo) + owner chip. Connectors: dotted `#cfd6e2`, solid green between two done rows. **Focus card** (`.rh`) for the focus step: navy, 4 px `#f3e7c6` halo, "NOW · STEP 7" gold mono, title, railSub, white (?) button, sub-step track (12 px dots, green done, gold current with halo, labels when ≤4 labels of ≤14 chars, otherwise "x of n sub-steps done"). Phases with more than 11 steps show a 9-step window around the focus + "Show all 23 steps" / "Show fewer steps". | P `rail`, `railHero` |
| ☑ | PH-05 | Who's doing it | `.card.acc.team`: a 12 px owner bar split by flex (Northwind `#c9a24b` 5, SBC `#2f6fd0` 4), tooltip "Northwind · 5 of 9 steps", + legend buttons → drill "Who's doing it · Phase 2". | P |
| ☑ | PH-06 | Focus rule | Focus = first step `you`, else first not done, else last. | P |
| ☑ | PH-07 | Phone prev/next | `.pn` bar (phone only) with "← Phase 1" / "Phase 3 →" (or "All phases"). | P |
| ☑ | PH-08 | Grid | `.sgrid` = `1fr minmax(280px,320px)`. At ≤999 one column; the side column becomes an auto-fit grid (≥300 px). | CSS |

#### 1.4 Step page (`/app/client/incorporation/step/[slug]`, FINAL `renderLive`)

| Done | id | item | exact behaviour / content | file |
|---|---|---|---|---|
| ☑ | ST-01 | Layout | `.wrap.na` (max 1360). Title row `.nah`: back chevron (32 px ghost → phase page, aria "Back to SPICe+ Part B") · h1 22 px Manrope 700 · **"(?) What's this?"** ghost link 12 px subtle → Ask VCFO with "What's this: <title>?". Grid `.nag`: `1fr minmax(260px,296px)`, gap 20. One column at ≤999 (the rail drops below). | S `renderLive` |
| ☑ | ST-02 | Answers card — not approved | `.card.nac` (no shadow). `.nain` intro 14 px muted (`liveIntro`): `you` "Northwind's team filled this step. Check it, then approve & submit by 9 Oct." · `with` "Northwind's team is preparing this step (due 19 Oct). Here is what it captures." · `prog` "Fill this step and submit by 16 Oct. Here is what it captures." · `up` SBC-owned "Northwind's team prepares this step. Here is what it captures." / client-owned "Northwind fills this step once step 10 · KYC Review & DSC is done. Here is what it captures." Then the `dl.nakv` rows (label 12.5 muted / value 14 fg, column grid `minmax(140px,224px) 1fr`, hairline separators, "—" subtle when empty). "Remarks (optional) —" is always appended. | S `liveIntro`, `liveRows` |
| ☑ | ST-03 | Answers card — approved (done) | Tab strip `.natabs` with one selected tab (✓ + tab name, e.g. "Capital structure", primary underline 2 px, 44 px tall). Green `.naok` box: circle-check + "**Approved**" + "Accepted after submission on 4 Oct 2026." (`fmtS`: "27 Sept 2026" style). Then `dl` with values, or "Provided · 4 Oct" for generic done fields. Below the card, right-aligned: **"Request a change"** (primary-tinted outline) → chat "I want to request a change to step N · title". | S |
| ☑ | ST-04 | Step 5 special | Rows: Approved company name "Northwind Technologies India Private Limited" · Name approval date "1 October 2026" · Name approval expiry date (+20 days) "21 October 2026" · MCA name approval letter = link button "↗ Name_Approval_Letter.pdf" (preview) · Remarks —. Banner text "Accepted after submission on 27 Sept 2026" (date of step 4). | S `liveRows` |
| ☑ | ST-05 | Prototype answer data | Step 6: Authorised ₹10,00,000 · Paid-up ₹1,00,000 · Face value ₹10 · 10,000 shares · Shareholding Northwind Inc. 9,999 · nominee 1. Step 7: address "Plot 42, 3rd Floor, Cyber Towers, HITEC City, Madhapur, Hyderabad 500081" · Telangana · Electricity bill · TSSPDCL 1102 4587 66. Step 8 Before/After, step 10 Before/After: see `X` in the code (§5). All other steps: rows = `infoRequired` labels (value "—", or "Provided · date" when done). | S `X`, `fields` |
| ☑ | ST-06 | Documents card (step 7) | `.card.acc#docs`: "DOCUMENTS" + (i) ("Files this step needs. SBC checks each one before it goes into the MCA filing.") + count chip "**1 of 2**" amber → "2 of 2" green. Request line `.dreq`: 16 px `you` glyph + "No-objection certificate from the owner · requested by Arjun". **Drop zone** `.drop` (1.5 px dashed `#e7a463`, `--you-light` fill, radius 10): 38 px amber round upload button · "**NOC from property owner** (i)" (NOC info: "A no-objection certificate signed by the owner of the premises, needed when the company does not own the registered office.") · "Drop a file here or **browse**" · amber chip "Due 9 Oct". Second requirement: green glyph + "Copy of utility bill (not older than two months)" + file row (PDF tile `#fdecec/#c0392b`, "Utility bill · September", mono "tsspdcl-sep-2026.pdf · 301 KB · Arjun · 5 Oct", chip "Uploaded", 👁 preview, ⬇ download). | S `docsCard`, `fileRow` |
| ☑ | ST-07 | NOC upload | Click the upload button or "browse" → (prototype) mark uploaded, re-render: the drop zone becomes a file row "NOC from property owner · noc-plot42-owner.pdf · 188 KB · Northwind · just now · Uploaded". The request glyph turns green, the chip shows "2 of 2". Toast **with Undo**: "NOC from property owner uploaded · Arjun will check it". DECISIONS: "Client uploads: only files the lead asked for. Answers stay read-only." | S click handler `[data-upload]` |
| ☑ | ST-08 | Documents card (step 6) | "DOCUMENTS" + "1 file": XLSX tile `#e6f4ee` "Cap table · northwind-cap-table.xlsx · Northwind · 2 Oct · Checked". Steps with no requested/attached docs show no Documents card. | S |
| ☑ | ST-09 | Phase step list (`naRail`) | `aside.card.narail`, sticky `top:72px`, list scrolls inside (`max-height: calc(100vh - 160px)`). Heading mono 11 px uppercase muted "SPICE+ PART B". Rows (grid `24px 1fr 32px 32px`, padding 8 4, radius 8): status glyph 24 px (set A; **upcoming = a numbered circle showing the position in the phase**) · step name link (13 px; current = 700 + `aria-current=page`, row background `#f3f6fb`, glyph ring `0 0 0 3px #f3f6fb, 0 0 0 5px #b9cdf5`) · owner icon 13 px (user glyph, blue for SBC, subtle grey for Northwind, tooltip "SBC owns this step"/"Northwind owns this step") · ⋮ "More" (toast "Step N · title · more actions in the full app") · (?) What's this. Connector: 2 px green under done rows, 1 px `--up` otherwise. | S `naRail` |
| ☑ | ST-10 | Sticky action bar | Only when status = `you`. `position:sticky; bottom:0`, white 96% + 6 px blur, top border, shadow. Left: 22 px `you` glyph + "**Awaiting Northwind's approval**" + a 200×4 px progress bar (primary fill = done need-items %, min 6%; step 7 = 1/3 before the NOC, 2/3 after). Right: **Request a change** (outline, message icon) + **Approve & submit** (primary, check icon). Phone: buttons share the width at 40 px with icons hidden. It sets `--acth` so the launcher sits above it. | S `actBar` |
| ☑ | ST-11 | Approve & submit | DECISIONS: one button with Undo. Prototype: step 7 with no NOC → toast "Upload the NOC first · it is still needed from Northwind" (DECISIONS: "Approve without NOC — Blocked; scroll to the upload". The build must also scroll to and focus `#docs .drop`). Otherwise the button becomes "✓ Submitted" (disabled) + toast **with Undo** "Approved & submitted · Arjun Mehta files it next". | S `[data-approve]` |
| ☑ | ST-12 | Request a change | Prototype → Ask VCFO chat pre-filled "I want to request a change to step 7 · Registered Office Address". Real: `ClientChangeRequestButton` dialog → `POST /api/client/change-requests` (note required). | S |
| ☑ | ST-13 | Phone prev/next | `.pn`: "← 6 · Capital Structure" / "8 · Proposed Directors →" (first/last → "All phases"). | S |
| ✗ | ST-14 | Not rendered in FINAL (kept for reference) | Navy step hero (eyebrow "PHASE 2 · INCORPORATION · STEP 2 OF 9", What's this?, meta "You · 1 working day · due 9 Oct · reviewer Arjun Mehta", prev/next, status glyph), 4-stage lifecycle tracker (Started → Submitted → Reviewed → Completed with a navy "Now" card + amber "Waiting on you" tag), bot banner, answers card with tab + "Pre-filled from project setup" + form chips (SPICe+ Part B ↗, INC-22 ↗), Timeline card, Focus-track rail, "Needed from you" checklist (Upload NOC / Check the answers / Approve & submit with checkboxes, "2 left"), team card (Arjun / Priya with message buttons). The v7 screenshot `inc-step-7__*.png` shows this layout. | S `renderStep` body after `renderLive(x);return;` |

#### 1.5 Board resolution page (`/app/client/board-resolution`)

| Done | id | item | exact behaviour / content | file |
|---|---|---|---|---|
| ☑ | BR-01 | Hero | Back → Phase 1 page. Eyebrow "PHASE 1 · NAME APPLICATION · STEPS 2–3". h1 "Board resolution" + What's this? (→ chat; answer: "Northwind's parent board authorises the India subsidiary. SBC drafts it, a director signs it, and Northwind uploads the signed copy." Why: "The name application in step 4 cannot be filed without it."). Chips: green "Signed copy received · 30 Sep", translucent "Certified true copy". Right: "2 · Draft Board Resolution ›", "3 · Signed Board Resolution ›", done glyph XL (tooltip "Done · received 30 Sep"). | B `renderBoard` |
| ☑ | BR-02 | Tracker | `.card.trk` `.lc`: ✓ Drafted "SBC · 26 Sep" — ✓ Released "28 Sep" — ✓ Signed "Northwind · 30 Sep" — green "now" card: tile ✓ "RECEIVED / Received by SBC / Arjun · 30 Sep". Green connectors. Phone: vertical. | B |
| ☑ | BR-03 | Preview card | `.card.prv` (raised background). Header "PREVIEW" + mono "page 1 of 2 · 100%" + buttons − / + (zoom 60–160% in 10% steps, `transform: scale()` with a .2s transition) + ⛶ full screen (toast "opens the document viewer"). Paper 440 px wide, Georgia 12/1.6, padding 34/38/30: centred bold title "CERTIFIED TRUE COPY OF THE RESOLUTION PASSED BY THE BOARD OF DIRECTORS OF NORTHWIND INC. ON 24 SEPTEMBER 2026", grey placeholder lines, "RESOLVED THAT", "RESOLVED FURTHER THAT", signature "J. Carter" in script + "Director, Northwind Inc.", a blue round stamp "NORTHWIND INC." rotated −12°. | B |
| ☑ | BR-04 | Files card | "FILES" + "2 files": DOCX "Draft · Word · board-resolution.docx · SBC · 26 Sep · Released" · PDF "Signed copy · br-signed-northwind.pdf · Northwind · 30 Sep · Received" (each with 👁 ⬇). Blue drop zone: refresh icon "**Replace signed copy** · Drop a PDF or browse" + mono "PDF · DOCX". | B |
| ☑ | BR-05 | What happens with it | Bot: "Northwind's parent board authorised the India subsidiary. SBC drafted it, J. Carter signed it, and it went with the name application in step 4." + button "Open step 3". | B |
| ☑ | BR-06 | Grid | `.brg` = `1.35fr 1fr`. One column at ≤999. Same in Before and After. | CSS |

#### 1.6 Overlays and shared components

| Done | id | item | exact behaviour / content | file |
|---|---|---|---|---|
| ☑ | OV-01 | Drill pop-up (rule 14) | Scrim `rgba(8,20,40,.5)`, fades in .18s. Panel `#vp-drill` min(600px,100%), radius 12, slides `translateY(10px) scale(.98)→none` .24s `cubic-bezier(.22,1,.36,1)`, top `max(72px,8vh)`. Optional top link strip (light blue `#eef3ff`): lead text + bold link "Open the phase page →". Header: title (navy 15/700) + sub (12) + × (32 px). Tabs: grey track pill, one tab per non-empty segment (colour square + label + mono count), active = navy. List rows: grid `1fr auto auto 16px` → name · mono date · coloured status chip · "→". A row → navigate to its step. Footer "Showing all N". Esc / scrim / × close (160 ms) and return focus. Phone ≤700: bottom sheet, radius 14 top, max 86vh. Already ported as CSS in the uncommitted `src/components/client-portal/css/11-drill.css`. | PJ `drill` |
| ☑ | OV-02 | Info pop-over (rule 7) | `.ip-pop`: absolute, 290 px (max 100vw−24), white, radius 10, shadow, padding 12, text 12.5/1.5. Ends with a hairline row "🤖 Ask VCFO about this" (primary 700) → chat "What's this: <title>?". Anchored under the (i): left = clamp(12, btn.left−8, vw−w−12), top = btn.bottom+8. Toggles on the same button. Closes on outside click, Esc or resize. Keys: coi, phases (title "The timeline"), docs, noc, timeline, answers (step description), phase (PH_INFO). | L/P/S `openInfo` |
| ☑ | OV-03 | Tooltip (rules 14 + 17) | `#ip-tt` fixed, navy, white 600 12/1.35, padding 6 9, radius 6, nowrap, ellipsis at 100vw−16. Opacity + translateY(3px) .12s. **Show delay 100 ms**. Placed above the element (8 px gap), flips below if there is no room. SVG donut segments use the pointer position. Shows on keyboard focus only for `:focus-visible`. Hides on scroll, pointerdown or focusout. Touch: long-press 450 ms shows it for 1.8 s. Every glyph has `role=img` + an aria-label equal to the tooltip. | L/P/S tooltip block |
| ☑ | OV-04 | Toast + Undo | `#vp-toast` bottom 64 px centred (100 px on phone), navy, white 600 13, radius 8, max min(560px,100vw−32). Enters with opacity .18s + translate .22s. **Auto-hides after 3200 ms.** The Undo button is gold text `#e6c46e` on white-14%, 28 px tall. Undo → runs the callback, then toast "Undone". | PJ `toast` |
| ☑ | OV-05 | Ask VCFO chat + What's this answer | `window.vcfoChat(q)` opens the launcher chat, posts q, shows a typing indicator for 900 ms (0 with reduced motion), then the answer card from `window.vcfoWhatsThis(q)`: **title** (step title), **text** (step description), "**Why it matters to Northwind**" (You-owned: "Northwind owns this step: Northwind's answers and documents go into the <first form>." SBC: "SBC does this step for you; you see the result and approve it."), "Source: <forms> · VCFO Suite checklist, step N", button "Open this step →". Phase answers use PH_INFO/PH_WHY/PH_SRC. Unknown → "I can't answer that one yet. I can pass it to Northwind's project lead." (grey antenna mood). DECISIONS: "What's this? opens the Ask VCFO drawer (as in the code)". | PJ `whatsThis`, L/P/S `vcfoWhatsThis` |
| ◐ | OV-06 | Monthly status brief drawer | (no entry point in FINAL, see §0.1) Right drawer `#ip-brief` min(420px,100%), scrim .32. Slides from `translateX(28px)` .26s. Phone: bottom sheet, max 88dvh. Header: prog glyph + "Monthly status brief" + "Northwind Technologies India Pvt Ltd · as of 6 Oct 2026" + ×. Body: highlight "**22 days** to the expected COI (Wed 28 Oct). SPICe+ is **43%** done: 6 of 14 steps." (After: "Incorporated on **24 Oct 2026**. SPICe+ is **100%** done. Post-incorporation and Registration are under way.") · PHASES: 4 rows (glyph, "Phase N · name", mono "d of t · ends/done date", a 5 px green mini bar, status chip) → phase page · WAITING ON NORTHWIND (rows, or bot "Nothing is waiting on Northwind.") · IN PROGRESS (rows). Footer: "Copy brief" (clipboard text) + primary "Download PDF". Focus goes to × on open; Esc closes and returns focus. | L/P `openBrief` |
| ☑ | OV-07 | Glyph set A (rule 18) | 22 px circles (26 px XL; 24 px in the rail; 18 px in kv; 16 px in requests): done green + white check (stroke 3.6) · you amber `#c8620e` + white user-round · prog navy + **gold `#e6c46e` clock** · with blue `#2453c7` + white trending-up · up white with a 1.5 px `#cfd6e2` ring, empty · late red `#cf3a2f` + white x (CSS only, never produced). Tooltips via `tipTxt`: "Done · 4 Oct", "Waiting · due 9 Oct", "In progress · due 16 Oct", "With SBC · since 6 Oct · due 19 Oct", "Upcoming · planned 20 Oct", "Next · planned 16 Oct". | all `si()` |
| ◐ | OV-08 | Timeline editor (landing "Edit") | Modal `#tle` min(1080px), drag/resize phase bars with day snap, cascade, before/after compare, undo. Manager: "Save timeline" ("Saving updates the dashboard for everyone on Northwind."). Client: "Request a timeline change" → "Send request" → "Change request sent to Priya Raman" / "Waiting for Priya Raman to approve". The same editor as the Home card. | TL, PJ l.274 |
| ☑ | OV-09 | Bot speech bubble (rule 16) | 40 px avatar circle primary-light + robot SVG; bubble `--with-light`, radius 10, 12.5 px, optional 30 px button. Mini robot 18 px inline. | all `botSay` |

#### 1.7 Loading, empty, error, animation

| Done | id | item | behaviour | file |
|---|---|---|---|---|
| ☑ | LS-01 | L1 skeleton | DECISIONS: "shown after 150 ms, held at least 300 ms". The incorporation prototype pages render synchronously and have no skeleton. The reference implementation is `final-src/s/home/mobile.html` l.171–177 and l.376 (class `.sk` on the app root: every `.card`/hero child `visibility:hidden` + `:after` shimmer inset 12 px, radius 6, `linear-gradient(90deg, #e9edf3 0, #f3f5f8 40%, #e9edf3 80%)` 600 px wide, `sh` 1.2 s linear infinite; navy cards use `oklch(30% .05 258)`/`oklch(36% .05 258)`; on reveal `.wrap>*` play `fu .3s cubic-bezier(.22,1,.36,1)`). Build: a timer starts the skeleton only if data is still pending at 150 ms; once shown, keep it ≥300 ms. Replace the current `HexgridLoader` / "Loading checklist…" fallbacks. The real app has `src/components/client/overview/ClientOverviewSkeleton.tsx` to reuse. | mobile.html |
| ☑ | LS-02 | No engagement | Real view: `EmptyStateIllustrated` "No active engagement" — restyle as a bot bubble (rule 16). | real `Incorporation.tsx` |
| ☑ | LS-03 | Phase not started | Bot bubble LD-21. | L |
| ☑ | LS-04 | Nothing waiting | This week bot "MCA: nothing pending this week." / brief "Nothing is waiting on Northwind." | L |
| ☑ | LS-05 | Drill empty tab | "Nothing here." (only non-empty tabs are rendered). | PJ |
| ☑ | LS-06 | Error | Real `app/app/client/incorporation/error.tsx` and `step/[stepId]/error.tsx` exist; keep them. | real |
| ☑ | AN-01 | COI count-up | First paint, Before only, not with reduced motion: 0 → 22 over **650 ms**, easeOutCubic `1-(1-k)^3`, `requestAnimationFrame`. | L |
| ☑ | AN-02 | Page enter/leave | `html.vp-enter body{animation:vpIn .26s cubic-bezier(.22,1,.36,1)}` (from opacity 0 / +6 px), class removed after 400 ms. Leave `opacity:.35` .14s before navigating. | PJ |
| ☑ | AN-03 | Accordion | `.phr.open .phb{animation:fin .2s ease-out}`; chevron `transform .2s` rotate(90deg). | CSS |
| ☑ | AN-04 | Buttons | `.btn` transition transform .12s, background .15s; `:active` scale(.98). | CSS |
| ☑ | AN-05 | Donut hover | `circle.sg` stroke-width 13→16, .15s. | CSS |
| ☑ | AN-06 | Step row | `.str` background transition .3s. | CSS |
| ☑ | AN-07 | Brief / drill / pop-up | see OV-01, OV-06. | |
| ☑ | AN-08 | Board zoom | `.paper` transform .2s. | CSS |
| ☑ | AN-09 | Reduced motion | `@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}`; count-up skipped; chat typing 0 ms; brief close 0 ms. | CSS / JS |
| ✗ | AN-10 | Current-step pulse (rule 10/12) | Not in the incorporation pages (the gold halo on the Focus card is static). | — |

#### 1.8 Before / After (model.js) and breakpoints

| Done | id | item | behaviour | file |
|---|---|---|---|---|
| ☑ | BA-01 | Toggle | One stored state `vcfo.after` (localStorage), shared by the top-bar pill, the rail, the drawer and the prototype bar. Incorporation pages re-render in place on the `vcfo-after` event + toast "Showing the company after/before incorporation". Real equivalent: uncommitted `clientPortalPrefs.viewState` = `auto | before | after` (`auto` follows the real COI state) via `/api/client/portal/prefs`. | PJ `setAfter`, SJ |
| ☑ | BA-02 | What changes | Status arrays (BEFORE/AFTER), dates (`DATES_B` vs `DATES_A`: after = actual dates; before = planned, steps 15+ +4 days), today (6 Oct vs 12 Nov), COI tile (countdown vs "24 Oct incorporated" + early chip + certificate link), This week rows + bot text, donut data, sidebar badge 6/14 → 14/14, step 7/8/10 data (fB/fA, timelines), board page unchanged. After, the gantt shows P3 and P4 active with "Now · step 19" and "Now · step 29" labels, P2 done "4 days early". | model.js, L/P/S |
| ☑ | BP-01 | Desktop ≥1280 | 248 px sidebar; search box 240 px; donuts 4 across. | CSS, SJ |
| ☑ | BP-02 | Tablet 768–1279 | 72 px icon rail (tooltips + fly-outs, Before/After pill inside the rail); search becomes a 40 px icon button; donuts 2 across; landing gantt goes into simple mode (1024 lane under 500 px). | CSS |
| ☑ | BP-03 | ≤999 | `.sgrid`, `.brg`, `.nag` single column; `.scol.side2` → auto-fit grid of ≥300 px cards. | CSS |
| ☑ | BP-04 | Phone ≤767 | No sidebar (drawer from the menu button); top bar 56 px, padding 0 6, gap 4; only search icon + notifications + menu; crumb = current page in navy 14.5. `main` padding 14 12 120. Hero padding 14; back 40 px (margin-top 18); hero buttons drop labels (40 px icon); `.hnav` hidden → `.pn` prev/next bar shown. Cards padding 14. kv one column. Tracker vertical (connectors 2×14 px). Rail rows ≥44 px. All icon buttons 40 px; invisible hit-area expansion (`::after inset -9px`) on (i), the risk chip and "browse"; gantt bars get ±15 px hit area. Action bar full-width buttons, no icons. Brief → bottom sheet. Drill → bottom sheet (≤700). Step table container queries (`.stt`): ≤720 px hides Date and Portal; ≤520 px hides header, Owner and Status, rows `22 22 1fr 76px`, 40 px Open. Donut card container ≤250 px: 72 px donut. | CSS |
| ☑ | BP-05 | ≤370 | SBC logo 20 px. | CSS |

---

### 2. DATA per screen → real app

Legend: **EXISTS** = use as-is · **ADAPT** = exists, needs a new projection or field · **NEW** = build it (backend piece named).
All data reaches client views through repositories behind `requireAuth()` + `AuthContext`, never `db` (CLAUDE.md rule 1). Client checklist state is already redacted per viewer by `checklistStateForViewer` → `redactChecklistStateForViewer('client', …)` (`src/lib/checklist-visibility.ts`).

Note on paths: the brief says `src/domain/checklist*`. There is no `src/domain` in this tree; all checklist domain logic lives in `src/lib/checklist-*.ts`.

#### 2.0 Existing building blocks (found by grep)

| Done | Need | Real piece | Where |
|---|---|---|---|
| ☑ | Engagement for signed-in client | `findEngagementForClientUser(engagements, user)`; `useApp().engagements`, `engagementsLoading`; server `getMyEngagement(ctx)` | `src/lib/checklist-state-key.ts`, `src/context/AppContext.tsx`, `src/db/repositories/engagements.ts:450` |
| ☑ | Checklist state | `useApp().getStateForEngagement(eng)`, `refreshEngagementChecklist(id)`; `GET /api/engagements/[id]/checklist` | `src/context/use-app-provider-value.ts`, `app/api/engagements/[id]/checklist/route.ts` |
| ☑ | 48 steps, phases, owners, forms, infoRequired, description, urgent | `getIncorporationPhases()`, `getActiveCatalogItems()`, `ChecklistItem.responsibleRole ('client'|'intern')`, `.forms`, `.infoRequired`, `.description`, `.urgent` | `src/data/checklist.ts` |
| ☑ | Client phase labels "SPICe+ Part A…" | `internOverviewPhaseTitle()` / `PHASE_LABEL` in client-overview | `src/lib/intern-overview-progress.ts:25`, `src/lib/client-overview.ts` |
| ☑ | Sequential gate (done/active/waiting/locked) | `gateActiveCatalog(state,'client')`, `getStepGate`, `isChecklistStepSequentiallyComplete`, `gateDisplayStatus` | `src/lib/checklist-step-gate.ts` |
| ☑ | Display status | `deriveChecklistDisplayStatus(itemId,item,slice,brSnapshot)` | `src/lib/checklist-display-status.ts` |
| ☑ | Approval sub-state | `approvalStateOf`, `isAwaitingClientApproval`, `stepApprovalLabel`, `clientApproveBlockedReason`, `phaseCompletedByApproval` | `src/lib/checklist-step-approval.ts` |
| ☑ | Client fill request | `isClientFillAwaitingClient`, `clientFillLabel` | `src/lib/checklist-client-fill.ts` |
| ☑ | Release / redaction | `isStepReleasedToClient`, `redactChecklistSliceForViewer` | `src/lib/checklist-visibility.ts` |
| ☑ | Progress per phase / overall, ball in court, next action, milestones, documents counts, deliverables, incorporated flag, team | `getClientOverview(ctx)` → `GET /api/client/overview` → `useClientOverview()`; builders `buildProgress`, `buildNextAction`, `buildBallInCourt`, `buildMilestones`, `buildDocumentCounts`, `buildDeliverables`, `identifiersFromState` | `src/db/repositories/client-overview.ts`, `app/api/client/overview/route.ts`, `src/lib/use-client-overview.ts`, `src/lib/client-overview.ts` |
| ☑ | Date windows | `engagement.schedule` (`EngagementSchedule {incorporation?, steps?}`), `windowForStep(schedule,itemId)`, `formatWindow`; write `PATCH /api/engagements/[id]/schedule` (manager/admin only) | `src/lib/schedule-windows.ts`, `src/db/repositories/schedule.ts`, `app/api/engagements/[id]/schedule/route.ts` |
| ☑ | Incorporation date | `engagements.incorporation_date` (`Engagement.incorporationDate`); CIN/PAN/TAN from pre-12 (`identifiersFromState`) | `src/db/schema.ts`, `src/lib/client-overview.ts` |
| ☑ | Step attachments (file fields + uploaded?) | `getStepAttachmentRequirements(item, responses, ownershipType)` | `src/lib/checklist-step-attachments.ts` |
| ☑ | Client-visible fields + answers | `getClientResponseFields(item)`, `filterFieldsByViewer(…,'client')`, `extractItemResponses(item,slice)` | `src/lib/checklist-responses.ts`, `src/lib/checklist-field-access.ts` |
| ☑ | Upload a file to a field | `POST /api/engagements/[id]/milestone-documents` (multipart `fieldId`, `stepId`, `file`) → S3 via `putObject`; for a client it does NOT create a `documents` index row | `app/api/engagements/[id]/milestone-documents/route.ts` |
| ☑ | Signed URL / preview | `GET /api/milestone-documents/signed-url`, `GET /api/documents/[id]/signed-url` | `app/api/...` |
| ☑ | Client approve | `POST /api/client/steps/[stepId]/approve` {engagementId} → `clientApproveStep(ctx, …)`; phase-approved email; `ClientStepApproveButton` | `app/api/client/steps/[stepId]/approve/route.ts`, `src/db/repositories/engagements.ts:1039`, `src/components/client/ClientStepApproveButton.tsx` |
| ☑ | Client request a change | `POST /api/client/change-requests` {engagementId, stepId, note} → `createClientChangeRequest` + `clientRequestStepChange` (reopens via `changeRequestReopenPatch`) + email; `ClientChangeRequestButton` | `app/api/client/change-requests/route.ts`, `src/components/client/ClientChangeRequestButton.tsx` |
| ☑ | What's this? | `WhatsThisButton kind='step'|'field'|'compliance'|'document'` → `ask.ask({context:{kind,ref,label}})` (`useAskOptional`) | `src/components/ask/WhatsThisButton.tsx` |
| ☑ | Status brief | `StatusBriefButton` → `GET /api/ask/brief?engagementId=` (PDF, flag C4, client only); `buildStatusBrief` (phases, done this month, next, upcoming) | `src/components/ask/StatusBriefButton.tsx`, `app/api/ask/brief/route.ts`, `src/lib/ask/status-brief.ts` |
| ☑ | Board resolution | `fetchBoardResolutionInDb(id)` → `GET /api/engagements/[id]/board-resolution`; `BoardResolutionDoc {status draft|finalized, storagePath, draftedAt, finalizedAt, finalizedBy, updatedAt, signedStoragePath, signedUploadedAt, signedUploadedBy}`; download `…/board-resolution/download`, `…/download-signed`; upload `…/upload-signed` (`uploadSignedBoardResolution`); live updates `useRealtimeBoardResolution`; preview `BoardResolutionDocPreview` | `src/lib/engagements-db.ts`, `src/db/repositories/board-resolution.ts`, `src/views/client/BoardResolutionView.tsx`, `src/components/board-resolution/*` |
| ☑ | Phase rows (current view) | `InternPhaseEntryCards`, `internOverviewPhases()`, `internOverviewCurrentItemInPhase`, `internPhaseStepCounts`, `phaseWindowMeta` | `src/components/incorporation/InternOverviewProgress.tsx`, `src/lib/intern-overview-progress.ts` |
| ☑ | Step page (current) | `EngagementStepDetail` (client route `/app/client/incorporation/step/[stepId]`), `StepDetailContent viewer='client'`, `ChecklistJourneyRail` (phase list with `JourneyNode`, `ResponsibleRoleBadge`, attachment kebab), `journeyRailItems()` | `src/views/engagement/EngagementStepDetail.tsx`, `src/components/incorporation/ChecklistJourneyRail.tsx` |
| ☑ | Paths | `clientIncorporationPath()`, `clientIncorporationStepPath(item)` (slug), `clientBoardResolutionPath()` | `src/lib/project-step-path.ts` |
| ☑ | Team (PM / lead) | `ClientOverview.team`; uncommitted `getClientPortalShell(ctx).team` (`ClientPortalContact`) | `client-overview.ts`, `src/db/repositories/client-portal.ts` (WIP) |
| ☑ | Shell (sidebar, Before/After, badges, companyShort "Northwind", incorporated) | **Uncommitted WIP in the working tree**: `GET /api/client/portal`, `/api/client/portal/prefs`, `src/db/repositories/client-portal.ts`, `src/lib/client-portal/types.ts`, `clientPortalPrefs` table (schema.ts diff), `src/components/client-portal/{routes.ts,Visor.tsx,css/*}` (tokens, drill CSS, shell CSS), `public/client-portal/fonts` | `git status` |
| ☑ | Activity | `activity` table, `listActivity(ctx)`, `createActivity`; `GET /api/activity` | `src/db/repositories/activity.ts` |
| ☑ | Document requests (free text) | `document_requests (engagement_id, requested_by, title, detail, status)`, `listDocumentRequests`, `createDocumentRequest`, `updateDocumentRequest`; `/api/requests` | `src/db/repositories/document-requests.ts` |
| ☑ | Tasks | `tasks.ts` repository, `/api/tasks` (TaskInstance with `checklistKey`) | `src/db/repositories/tasks.ts` |
| ◐ | Doc pack (staff only) | `useDocPack`, `GET /api/engagements/[id]/doc-pack` (statuses ready / needs-inputs / waiting-release); `docPackVisible = !isClientRoute` | `src/lib/doc-pack/*`, `src/hooks/use-doc-pack.ts` |

#### 2.1 Landing data map

| Done | UI datum | Prototype source | Real source | Status |
|---|---|---|---|---|
| ☑ | Company name / short name | constants | `engagement.companyName`; `ClientPortalShell.companyShort` (WIP) | EXISTS / WIP |
| ☑ | Days to COI (before) | `days(TODAY, WIN_END)` | `engagement.schedule.incorporation.to` minus today (IST calendar days). If no window: hide the number, bot "Your manager hasn't set the incorporation window yet". | ADAPT (pure fn `daysToCoi(schedule, today)`) |
| ☑ | "window set by …" tooltip | "Arjun Mehta" | `schedule.incorporation.setBy` → profile name (repository join) | ADAPT (resolve the name server-side, add it to the overview) |
| ☑ | Incorporated date (after) | `DT(14)` | `engagement.incorporationDate` ?? `state['pre-12'].completedOn/deliveredToClientAt`; flag `ClientOverview.incorporated` | EXISTS |
| ☑ | "4 days early" | `days(DT14, WIN_END)` | `incorporation.to − incorporationDate` | ADAPT (pure) |
| ☑ | "CIN, PAN and TAN issued" | static | `identifiersFromState(state)` → cin/pan/tan present | EXISTS |
| ☑ | "Open certificate" | doc-viewer | `ClientOverview.documents.deliverables` kind certificate (`pre-12:certificateOfIncorporationFinalUrl`) → signed-url preview | EXISTS |
| ☑ | At risk · step N | first KD `you` | first step whose derived status is `you` (§3) + its due date | ADAPT |
| ☑ | SPICe+ ring 43% | phases 1–2 done/14 | `buildProgress(state).byPhase` P1+P2 done/total | EXISTS |
| ☑ | Steps pill 6/48 13% | `doneN(STEPS)` | `buildProgress(state)` done/total/overallPct | EXISTS |
| ☑ | All-48 drill tabs | `tabsFor(STEPS)` | derived status per step (§3) + date (§3.4) | ADAPT (pure `deriveClientStepStatus`) |
| ☑ | This week rows | WEEK_B (fixed) / computed | union of: (a) open file requests for the client (NEW, §2.3), (b) steps with `approval.state === 'pending_client'` ("Check & approve step 7"), (c) steps with status with/prog whose due date (window `to`) falls in Mon–Sun of this week, (d) firm tasks (`tasks` with checklistKey) — date "now" when due ≤ today+3 | NEW (`buildThisWeek(state, schedule, requests, tasks, today)` in `src/lib/client-incorporation.ts` + a field on the overview response) |
| ☑ | This week bot line | "MCA: nothing pending this week." | "MCA" items = steps owned by MCA (pre-11 MCA Remarks, pre-12 COI; see owner below) with the status `with` due this week; otherwise the generic text | NEW |
| ☑ | Week range "6 – 12 Oct" | constant | Monday–Sunday of today (IST) — DECISIONS (Compliances) "Week starts Monday" | ADAPT |
| ☑ | Timeline count "6 of 48 · Sep – Dec 2026" | constant | done/total + min/max month of all phase windows | ADAPT |
| ◐ | Phase plan window (bar left/right) | PLAN 1/2, [coi, phEnd] for 3/4 | P1+P2: real has ONE window `schedule.incorporation` for Part A+B. Options: (1) split by the step windows of pre-5 (Part A end) if set, (2) **NEW** `schedule.phases[phaseId]` windows. P3/P4: from `coiDate` to the max `windowForStep(…).to` of the phase's steps (DECISIONS: "Phase end date (Post-inc., Registration) = latest step date in the phase"). | NEW (extend `EngagementSchedule` with `phases?: Record<phaseId, ScheduleWindow>` or derive) |
| ☑ | Phase actual end / late / early | `phEnd(p)` = latest step date | latest completion date of the phase's steps (`completedOn` ?? `deliveredToClientAt` ?? `approval.clientApprovedAt`) vs the plan end | ADAPT (pure) |
| ☑ | "Now · step N" on the bar | first step with you/prog/with | the gate's current step (index of the first incomplete step) in that phase | EXISTS (`internOverviewCurrentItemInPhase(items, gates)`) |
| ☑ | Today line | TODAY | `new Date()` in Asia/Kolkata (`indiaDay` used in status-brief) | EXISTS |
| ☑ | COI diamond | phase 2 bar end | `schedule.incorporation.to` (before) / incorporationDate (after) | EXISTS |
| ◐ | Edit (timeline editor) | tl-editor.js | Manager: `PATCH /api/engagements/[id]/schedule`. Client: "Request a timeline change" → NEW kind on `/api/engagement-change-requests` (current kinds: delete_project, change_client, change_manager) or a client change request with stepId null | NEW (shared with the Home card build) |
| ☑ | Step table rows | STEPS + lkind | `getIncorporationPhases()` items + derived status + date + owner | ADAPT |
| ☑ | Owner chip Northwind / SBC / MCA | `x.o` + `LOWN` | `responsibleRole` ('client' → company short name, 'intern' → firm name "SBC"); **MCA is NEW**: add `actor?: 'mca'` to `ChecklistItem` for pre-11 (MCA Remarks) and pre-12 (COI) — or a client-side map `CLIENT_OWNER_OVERRIDE = {'pre-11':'MCA','pre-12':'MCA'}` in the presentation layer (do not touch the LIFTed `checklist.ts` unless agreed) | NEW (presentation map) |
| ☑ | Portal ↗ | `x.f[0]` | `item.forms[0]` + NEW portal URL map form → portal (MCA V3, GST, EPFO, ESIC, …). Rule 15 list. `src/lib/announcement-portals.ts` already has a portal table per registration — reuse/extend | ADAPT |
| ☑ | 📎 Proof | done SBC/MCA step | a NEW per-step "proof" pointer: the first firm-uploaded file field of the step (`getStepAttachmentRequirements(...).find(uploaded)`) or a deliverable; a missing proof → amber "Proof pending" chip (rule 15) | NEW (pure selector + signed-url) |
| ☑ | Urgent tag | `x.u` | `item.urgent` | EXISTS |
| ☑ | Registration groups | `regGroup` | `internRegistrationHeadingForTitle` / `internRegistrationHeadingGroups` | EXISTS |
| ☑ | PH_WAIT bubble | constant | static copy, keyed by phase id | static |
| ☑ | Donut "Documents from Northwind" | DOCS_B/A | per client-owned file field across released steps: `getStepAttachmentRequirements` + slice review state → Submitted (uploaded & step accepted/approved/completed) · Under review (uploaded & `reviewStatus==='reviewing'`) · Pending (required, not uploaded, step active/requested) · Sent back (`reviewStatus==='rejected'`, field in `unlockedFields`). Row names = field labels (+ director name for repeat fields via `repeatFieldLabel`). | NEW (pure `buildClientDocumentBreakdown(state, ownershipType)` + overview field) |
| ◐ | Donut "Documents SBC prepares" | DOCS_B/A | firm-generated docs: doc-pack definitions (`src/lib/doc-pack/registry.ts`, statuses ready/needs-inputs/waiting-release → Generated/Pending) + board resolution (`finalized` → Generated; `signedStoragePath` → Signed by Northwind) + DIR-2 signed etc. The doc pack is staff-only today (`docPackVisible=!isClientRoute`) → expose a **client-safe count/name summary** (no inputs, no blockers) | NEW (repository fn `getClientPreparedDocsSummary(ctx, engId)` reusing `evaluate.ts`) |
| ☑ | Donut "Who's working on what" | not-done by owner | not-done steps (gate ≠ done) grouped by owner (with the MCA map) | ADAPT (pure) |
| ☑ | Donut "On plan vs overdue" | active: at risk = you | active steps (gate active/waiting): Overdue = due date < today or status `overdue`; At risk = status `you` (or due within 2 days); On time = rest | ADAPT (pure) |
| ☑ | Donut drill "Open Documents →" | documents route | `/app/client/documents` | EXISTS |

#### 2.2 Phase page data map

| Done | UI datum | Real source | Status |
|---|---|---|---|
| ☑ | Route `phase.html#p=N` | NEW route `app/app/client/incorporation/phase/[phase]/page.tsx` (`phase` = `part-a|part-b|post-incorporation|registration` or the phase id). Legacy `?phase=` handling already exists in `Incorporation.tsx`: update it to go to the phase page instead of the current step. | NEW |
| ☑ | Title / eyebrow / prev-next | `getIncorporationPhases()` index + `internOverviewPhaseTitle` | EXISTS |
| ☑ | Meta "1/9 · 29 Sep → 28 Oct · ends …" | phase window (§2.1 phase plan) + `internPhaseStepCounts(items,gates)` | ADAPT |
| ☑ | Phase ring % | `internPhaseProgressPercent` | EXISTS |
| ☑ | Key dates: Starts / Ends / Now step / COI / Reviewer | window; current step (`internOverviewCurrentItemInPhase`); COI date; reviewer = engagement lead name (`ClientOverview.team` role Project Lead) | ADAPT |
| ☑ | What's this? (phase) | `WhatsThisButton` has no `phase` kind → **NEW** `kind:'phase'` in `WhatsThisButton` + the Ask context resolver (`src/lib/ask/*`) with PH_INFO/PH_WHY/PH_SRC copy | NEW |
| ☑ | Steps table | as landing, plus (?) per row (`WhatsThisButton kind='step' compact`) | ADAPT |
| ☑ | Journey rail (Focus track) | `ChecklistJourneyRail` exists (lead style) — needs the Focus-track variant: Focus card, sub-step ticks, dots | NEW component (`FocusTrackRail`); data: derived status, `railSub`, sub-steps (§2.4) |
| ☑ | Sub-steps (ticks/dots) | prototype `SUBS` for 6/7/8/10 + infoRequired otherwise | the real fields' `section` values per step (`getClientResponseFields(item)` grouped by `section`) with filled state from responses (each section done when its required fields are filled), or `item.infoRequired`. For released steps only. | ADAPT (pure `stepSubSteps(item, responses, status)`) |
| ☑ | Who's doing it | count of phase items by owner (+ MCA map) | ADAPT |

#### 2.3 Step page data map

| Done | UI datum | Real source | Status |
|---|---|---|---|
| ☑ | Title, back, crumbs (Home / Incorporation / SPICe+ Part B / title) | `EngagementStepDetail` (`PageBackButton`, h1) + `phaseForStep(itemId)` for the crumb | EXISTS / ADAPT (crumb) |
| ☑ | What's this? | `WhatsThisButton kind="step" refId={item.id} label={item.title}` — already in the title row | EXISTS |
| ☑ | Intro sentence (`liveIntro`) | derived status (§3) + due date + previous step title | ADAPT (pure `clientStepIntro`) |
| ☑ | Approved banner + date | `approval.clientApprovedAt` ?? `clientSubmittedAt`/`reviewedAt` when accepted ?? `deliveredToClientAt` ?? `completedOn` | ADAPT |
| ☑ | Answer rows | `StepDetailContent viewer='client'` + `ClientStepFieldPreview` (fields from `getClientResponseFields` filtered for the client, answers via `extractItemResponses`, released only) — restyle as `dl.nakv` | EXISTS (restyle) |
| ☑ | "What this step captures" for unreleased steps | `clientNothingYet` path in `EngagementStepDetail` | EXISTS |
| ◐ | Documents card — "only files the lead asked for" | file fields = `getStepAttachmentRequirements(item, responses, ownershipType)`. **Which ones the lead asked the client for** has no model: `ClientFillRequest` is step-level, `document_requests` has no step/field link. NEW: either (a) add `stepId text, fieldId text, dueDate date` columns to `document_requests` (+ requested_by name join) and a lead UI "Request this file from the client", or (b) add `clientFileRequests?: {fieldId, requestedBy, requestedByName, requestedAt, dueAt?, fulfilledAt?}[]` to `ChecklistItemStateSlice` (same pattern as `clientFillRequest`/`approval`, lives in `checklist_state` jsonb). (b) fits existing redaction/approval code; (a) fits the Documents page ("Upload on the Documents page: only against open requests"). Recommend (a) so Documents + This week + step page share one list. | NEW (repository + migration + lead UI + client read) |
| ☑ | "requested by Arjun" | request.requestedBy → profile name | NEW (with the above) |
| ☑ | Count chip "1 of 2" | requested + already-attached file requirements: uploaded / total | ADAPT |
| ☑ | File rows (name, file name, size, uploader, date, status chip) | path in responses → `fileNameFromStoragePath`; size/uploader/date NOT stored for client uploads (the milestone route skips `createDocument` for clients) → NEW: create the `documents` row for client uploads too (with `stepId`), then read it via `listDocuments(ctx, …)` filtered by stepId | ADAPT route + NEW read |
| ☑ | Preview 👁 / Download ⬇ | `/api/milestone-documents/signed-url` + shared preview overlay | EXISTS |
| ☑ | Client upload of a requested file | `POST /api/engagements/[id]/milestone-documents` then write `responses[fieldId]=path`. A client cannot write a step that is `pending_client` today (answers read-only; only `unlockedFields`). NEW server path: `POST /api/client/steps/[stepId]/files` {engagementId, fieldId, path} → repository `clientAttachRequestedFile(ctx, …)` that checks the field is in an open request for this client, writes only that response key, marks the request fulfilled, and logs activity. | NEW |
| ☑ | Undo on upload toast | delete/restore the previous response value: same repository fn with `path: previous`; keep the S3 object | NEW (small) |
| ☑ | Approve & submit | `ClientStepApproveButton` → `POST /api/client/steps/[stepId]/approve`. Enabled only when `approval.state === 'pending_client'`; `clientApproveBlockedReason` gives the disabled reason. | EXISTS |
| ☑ | "with Undo" | the real approve is immediate and can send the phase-approved email. NEW: defer the POST. Optimistic "Submitted" state + toast with Undo; fire the POST when the toast closes (≈5 s; prototype toast 3.2 s); Undo cancels it. No server change needed. If the owner wants a server-side undo: add `POST /api/client/steps/[stepId]/unapprove` allowed only within N minutes and only if no phase email was sent — not recommended. | NEW (client hook `useDeferredAction`) |
| ☑ | NOC blocking | prototype: toast. NEW: (1) UI: the Approve button stays clickable; if any open file request for this step is unfulfilled → scroll `#docs` drop zone into view, focus "browse", amber pulse, toast "Upload the NOC first"; (2) server: `clientApproveStep` rejects with `requested_files_missing` when open requests exist for the step (defence in depth). | NEW |
| ☑ | Progress bar in the action bar | prototype: need-items done/total | `(fulfilled file requests + 1 if answers checked) / (requests + 2)` — or simply fulfilled requests / requests; define with the owner | NEW (pure) |
| ☑ | Request a change | `ClientChangeRequestButton` (dialog, required note) → `/api/client/change-requests` | EXISTS |
| ☑ | Phase step list (right) | `ChecklistJourneyRail` + `journeyRailItems()` (gate, status, attachments, windowLabel) — restyle to `naRail`: set-A glyphs (numbered circle for upcoming), owner user icon (blue SBC / grey client), ⋮ attachment menu (`showAttachmentMenu` = "Attachments required" list), (?) `WhatsThisButton compact` | EXISTS (restyle) |
| ☑ | Registration groups in rail | `internRegistrationHeadingGroups` (already in `EngagementStepDetail`) | EXISTS |
| ☑ | Prev / next step (phone) | catalog order `getActiveCatalogItems()` | EXISTS |
| ☑ | Locked step access | the real client route opens every step for viewing; the gate controls actions (`EngagementStepDetail` comment) | EXISTS |

#### 2.4 Board resolution page data map

| Done | UI datum | Real source | Status |
|---|---|---|---|
| ☑ | Visibility | client sees it only when `doc.status==='finalized' && storagePath` (`ClientBoardResolutionCard`, `BoardResolutionView`) | EXISTS |
| ☑ | Tracker: Drafted (SBC · date) | `doc.draftedAt` | EXISTS |
| ☑ | Released (date) | `doc.finalizedAt` (+ `finalizedBy` name) | EXISTS |
| ☑ | Signed (Northwind · date) | `doc.signedUploadedAt` (+ `signedUploadedBy` name) | EXISTS |
| ☑ | Received by SBC (Arjun · date) | no field: NEW — either `pre-3` step accepted (`state['pre-3'].reviewStatus==='accepted'`/`approval` / `completedOn` + `reviewedBy`), or treat upload = received. Use pre-3 acceptance (`isChecklistStepSequentiallyComplete` on pre-3) and its `reviewedAt/reviewedBy`. | ADAPT |
| ☑ | Chips "Signed copy received · 30 Sep", "Certified true copy" | as above | ADAPT |
| ☑ | Preview (zoom − / + / full screen) | `BoardResolutionDocPreview` (docx render) — add zoom controls; full screen = shared doc viewer | ADAPT |
| ☑ | Files: Draft · Word (Released) / Signed copy (Received) | `…/board-resolution/download` (docx) + `…/download-signed`; sizes not stored (omit, or read `HEAD` from S3) | EXISTS |
| ☑ | Replace signed copy (drop zone, PDF·DOCX) | `uploadSignedBoardResolution` + `validateSignedBoardResolutionFile` | EXISTS |
| ☑ | Prev/next to steps 2 / 3 | `clientIncorporationStepPath('pre-2'|'pre-3')` | EXISTS |
| ◐ | Header entry from the landing | prototype hero button (dead in FINAL) — the real `ClientBoardResolutionCard` "Board resolution ready" link exists; decide placement (§0.1) | decision |
| ☑ | Ownership independent → BR steps N/A | `deriveChecklistDisplayStatus` returns not-applicable → hide the BR page/links | EXISTS |

#### 2.5 Status brief

| Done | UI datum | Real source | Status |
|---|---|---|---|
| ☑ | Download PDF | `GET /api/ask/brief?engagementId=` (C4 flag) | EXISTS |
| ☑ | Drawer body (phases, waiting on client, in progress) | `buildStatusBrief` gives phases, done-this-month, next, upcoming; the drawer needs per-step lists → reuse `buildProgress` + derived statuses | ADAPT (`GET /api/client/incorporation` payload covers it) |
| ☑ | Copy brief | client-side text from the same payload | NEW (pure) |

#### 2.6 Recommended single read for all incorporation screens

NEW `GET /api/client/incorporation?engagementId=` → repository `getClientIncorporation(ctx, engagementId?)` in `src/db/repositories/client-incorporation.ts`. It runs `assertEngagementAccess` and composes `checklistStateForViewer`, the schedule, the board-resolution row, file requests, the team and tasks, plus a pure builder `src/lib/client-incorporation.ts` returning:
`{ engagement{id, companyName, companyShort, incorporated, incorporationDate, window{from,to,setByName}}, today, phases[{id,label,plan{from,to}, actualEnd, lateDays, done,total,pct, state:'done'|'active'|'up', currentStepId}], steps[{id, n, phaseId, title, slug, owner:'client'|'firm'|'mca', status:'done'|'you'|'prog'|'with'|'up'|'next'|'late', date, dateKind:'done'|'due'|'since'|'planned'|'expected', forms, urgent, portalUrl?, proof?{path}|'pending', subSteps[{label, state}] }], thisWeek[], donuts{fromClient, firmPrepares, who, plan}, boardResolution{...}, brief{...} }` plus a hook `useClientIncorporation()` (TanStack Query, `staleTime 30s` like `useClientOverview`). Add a cross-tenant test (CLAUDE.md rule 2).

---

### 3. Step-status model

#### 3.1 How the prototype computes it (`x/*.app.js`)

```
ST(n)  = (AFTER_ON ? AFTER : BEFORE)[n-1]          // 'done' | 'you' | 'prog' | 'up'  (model.js)
KD(n)  = ST(n)==='prog' && STEPS[n-1].o!=='You' ? 'with' : ST(n)   // in-progress SBC step = "With SBC"
lkind(x) (landing table only): KD!=='prog' ? KD : (first 'prog' step of the phase ? 'next' : 'up')
       → a client-owned step that is in progress but not the client's turn shows "Next" (the first) or "Upcoming"; its date shows "—"
phState(p) = all done ? 'done' : all 'up' ? 'up' : 'active';   phKind: done|up|prog (glyph)
'late'  : CSS + glyph exist (.si.late red ×, .chip.late), never produced; "Overdue" donut = 0
'at risk' (COI tile chip, plan donut) = KD === 'you'
```
Labels `KL = {done:'Done', you:'Waiting', prog:'In progress', with:'With SBC', up:'Upcoming', next:'Next'}` (rail/brief text says "Waiting on Northwind"). Colours `KCOL = {done:#15805f, you:#c8620e, prog:#0f2a4a, with:#2453c7, up:#8a97a8}`. Order of drill tabs `done, you, prog, with, up`.
Date cell `dateCell(n)`: done → "Done 4 Oct"; you/prog → "Due 9 Oct"; with → "since " + `since(n)` (= due − 5 days, capped at today); up → "—" (step 14 → "exp. 28 Oct" = COI date). Tooltip `tipTxt`: "<label> · <date>" (with: "With SBC · since 6 Oct · due 19 Oct"; up: "Upcoming · planned 20 Oct").
Sub-steps `subList(x)`: labels SUBS[6]=Share classes/Shares/Face value/Holding; [7]=Office address/State/NOC/Utility bill; [8]=Directors/DIN · DSC/ID proofs/Address proofs/Interests; [10]=KYC data/KYC review/DSC; otherwise `short(infoRequired label)`. States: done → all done; up → all todo; Before + SUBK_B (7: done,done,now,done · 8: done,done,now,todo,todo · 10: done,now,todo); else you → n−1 done + now; prog/with → floor(n/2) done + now.

#### 3.2 Derivation from real checklist state (client viewer)

Inputs per step: `item` (catalog), `slice = redacted state[item.id]` (from `checklistStateForViewer`), `gate = getStepGate(gateActiveCatalog(state,'client'), item.id)`, `approval = approvalStateOf(slice)`, `fill = slice.clientFillRequest`, `requests = open file requests for this step` (NEW), `due = windowForStep(schedule,item.id)?.to`, `today` (IST).

Proposed pure function `deriveClientStepStatus(...)` (put it in `src/lib/client-incorporation.ts`; tests next to it), evaluated in this order:

| Done | # | Prototype status | Condition on real state | Notes |
|---|---|---|---|---|
| ☑ | 1 | **done** | `gate.kind === 'done'` (i.e. `isChecklistStepSequentiallyComplete` and before the current step), or `slice.status === 'not-applicable'` (render N/A as a done glyph with tooltip "Not needed for Northwind", or hide the row) | `gateDisplayStatus` already turns a re-requested `completed` into in-progress |
| ☑ | 2 | **you** ("Waiting on Northwind") | `approval === 'pending_client'` (manager approved, the client must Approve & submit), OR open file request for the client on this step (NEW), OR `isClientFillAwaitingClient(fill)`, OR (`gate.kind === 'active'` && `item.responsibleRole === 'client'` && (`no client responses yet` OR `isReviewRejected(slice)`)) | "Check & approve step 7" in This week = the `pending_client` case |
| ☑ | 3 | **prog** ("In progress", client-owned) | `gate.kind === 'active'` && owner client && the client has started (any client response saved, `slice.status === 'in-progress'`) && not submitted | |
| ☑ | 4 | **with** ("With SBC") | `gate.kind === 'waiting'` (owner firm, or `isLeadRequestPending` → "Waiting on your project lead…"), OR `approval === 'pending_manager'` (label "Awaiting your team"), OR `approval === 'change_requested'` ("Your team is working on the change you asked for."), OR a client submission under review (`reviewStatus==='reviewing' && reviewSource==='client_submission'`) | "since" date: see 3.4 |
| ☑ | 5 | **next** (landing table only) | the first `gate.kind==='locked'` step right after the current step **in the same phase** | prototype rule = the first not-yet-their-turn step |
| ☑ | 6 | **up** ("Upcoming") | `gate.kind === 'locked'` | tooltip "Upcoming · planned <window to>"; gate message "This opens after X is complete." can be the long tooltip |
| ☑ | overlay | **late** (red ×) | not done && ((`slice.status === 'overdue'`) or (`due` && `due < today`)) | rule 17 tooltip "Late by N days"; feeds the "Overdue" donut and the red late segment on phase bars |

**Important divergence (decide before building):** the real gate is strictly sequential across all 48 steps. `gateChecklistSteps` makes exactly ONE step `active`/`waiting` (the first incomplete one) and every later step `locked`. The prototype shows several concurrent active steps: Before has 7 you + 8/9/10 in progress; After has P3 and P4 running in parallel (19, 20, 22, 23, 29, 33, 36). With today's gate, the real landing can never show "8 · In progress" while 7 waits, nor parallel registrations. Options: (a) accept a single active step (the extra rows show Next/Upcoming — FINAL's landing table already turns 8/9 into Next/Upcoming through `lkind`, so it is close); (b) relax the gate for Post-incorporation and Registration so steps after the COI run in parallel (a change in `checklist-step-gate.ts`, which is LIFTed code, so it needs owner sign-off + tests); (c) show `with` for locked steps the lead has already released (`isStepReleasedToClient(slice)` and status `in-progress`) — this is display-only and touches no gate. Recommendation: (a) for SPICe+ (matches FINAL), (c) for P3/P4, and raise (b) with the owner.

#### 3.3 Phase state

`done` = every item gate done (or N/A); `up` = every item locked and no released activity; else `active`. Glyph: done → done, active → prog (navy + gold clock), up → up. `currentStepId` = `internOverviewCurrentItemInPhase(items, gates)`.

#### 3.4 Dates per step

| Done | Kind | Real field |
|---|---|---|
| ☑ | Done date | `approval.clientApprovedAt` ?? `slice.completedOn` ?? `slice.deliveredToClientAt` ?? `slice.reviewedAt` (accepted) ?? `slice.clientSubmittedAt` |
| ☑ | Due date | `windowForStep(schedule, itemId)?.to`. Part A/B steps all inherit the single incorporation window, so they would all show "Due 28 Oct". Prototype per-step dues (7 → 9 Oct, 8 → 16 Oct) need per-step windows: `schedule.steps[itemId]` already supports any item at the repository level (`applyScheduleWindow` with `{kind:'step'}`); only the UI hides the control for Part A/B (`!isIncorporationWindowStep`). Allow managers to set per-step windows inside the incorporation window → NEW UI only. |
| ☑ | "since" date (With SBC) | NEW: no timestamp records when a step moved to the firm. Use the latest of `clientSubmittedAt`, `approval.changeRequestedAt`, the previous step's done date (the gate opened then), else the `activity` row for that step. Pure helper `withFirmSince(itemId, state)` — the previous step's done date is a good default. |
| ☑ | Planned (upcoming) | `windowForStep(...)?.to` (or `.from` for "opens ~") |
| ☑ | Expected COI | `schedule.incorporation.to` |
| ☑ | Request due (NOC "Due 9 Oct") | NEW `dueAt` on the file request |

#### 3.5 What the current client Incorporation view does (to replace)

`src/views/client/Incorporation.tsx`: header = `PageBackButton` + serif h1 company name + mono "done/total · incorporationDate" + `StatusBriefButton` + `ProgressRing` (all 48 steps — DECISIONS wants SPICe+ only). Body = `ClientBoardResolutionCard` ("Board resolution ready", only when finalized) + `InternPhaseEntryCards` (4 phase rows: tick track, n/m, window meta for SPICe+ rows via `phaseWindowMeta`, What's this per phase = the current step's `WhatsThisButton`), and each row links to the phase's current step (`internOverviewCurrentItemInPhase` → `clientIncorporationStepPath`). Done counts use `isChecklistStepSequentiallyComplete`. `?step=`/`?phase=` query params redirect into the step workspace (keep `?step=` for email links; point `?phase=` at the NEW phase page). Loading = `HexgridLoader`; no engagement = `EmptyStateIllustrated`. `app/app/client/progress/page.tsx` redirects to incorporation (keep it, DECISIONS).

---

NEW (incorporation build): table `client_file_requests` (`src/db/schema-portal-incorporation.ts`: id, engagement_id, step_id, field_id, label, note, due_date, requested_by, requested_at, fulfilled_at/by/path, previous_path, file_name, size_bytes, content_type, cancelled_at, created_at) · repository `src/db/repositories/client-incorporation.ts` (list/create/cancel requests, `openFileRequestsForStep`, `clientAttachRequestedFile`, `clientUndoRequestedFile`, `getClientIncorporationExtras`) · routes `GET /api/client/incorporation`, `POST /api/client/steps/[stepId]/files`, `GET|POST /api/engagements/[id]/file-requests`, `DELETE /api/engagements/[id]/file-requests/[requestId]` · approve route returns 409 `requested_files_missing` while a requested file is open · NEW page route `/app/client/incorporation/phase/[n]` · pages in `src/components/client-portal/pages/incorporation/` · CSS `css-src/incorporation-{pages,landing,extra}.css`.

<!-- /area:incorporation -->

<!-- area:compliances -->
## Compliances (calendar, filings)

Full catalogue (verbatim CSS, markup, logic): `inventory/compliances.md`.

### 1. INVENTORY

Columns: **id | item | exact behaviour | file:line**. Desktop = `#cal-redesign` / `#fil-redesign`; Phone = `#cal-mobile`.

#### 1.1 Global / page frame

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | G-01 | Page frame | `frame(active,trail,content,extra)` = `.shell` › sidebar + `.main` › topbar + `.page.stag` + Ask VCFO launcher + extra overlays. Trail = `['Compliances','Calendar']` / `['Compliances','Filings']`. | I:538-540 |
| ☑ | G-02 | Page container | `.page` padding `22px 24px 120px`, column, gap 16. Live: width 100%, max-width 1600 centred, padding `clamp(14px,1.6vw,22px) clamp(12px,1.8vw,24px) 120px`. | I:110, I:306 |
| ☑ | G-03 | Page entrance stagger | `.stag>*` `fadeUp .25s cubic-bezier(.22,1,.36,1) both`, children 2-5 delayed .06/.12/.18/.24 s; `fadeUp` = opacity 0→1, translateY(6px)→0. | I:220-222 |
| ☑ | G-04 | Ask VCFO launcher | Bottom-right (right 24, bottom 24), navy label "Ask VCFO" with arrow + 68 px robot face; `botup .45s cubic-bezier(.22,1,.36,1) .4s both` (from translateY(48px), opacity 0); face `bob 2.6s ease-in-out infinite` (translateY 0→-4px). Click opens chat (P: navTarget 'chat'). Shell-level component. | I:214-219, I:537 |
| ☑ | G-05 | Hover tooltip (rule 14/17) | One fixed `.tipb` (navy, white 600 12px Manrope, 6px 10px, radius 8, arrow 8 px) placed at target's top-centre, `translate(-50%,calc(-100% - 10px))`, opacity transition .12 s with 120 ms delay. Shown for any `[data-tip]` or `button[aria-label].ibtn`; text = `data-tip` or aria-label; hidden when pointer leaves a tip target. Hidden on drill click. | I:239-241, I:256, I:1024-1025 |
| ☑ | G-06 | Auto tooltips for icon controls | Every icon-only `button/a[aria-label]` gets `data-tip=aria-label`; unlabeled `.ibtn` get Close / Previous / Next / Download / Preview by icon path. | I:1033-1035 |
| ☑ | G-07 | Count-up | `[data-count]` animates 0→N over 700 ms easeOutCubic (`1-(1-k)^3`) via rAF, skipped under reduced motion. In FINAL only the unused `kpis()` and nothing on the live calendar carry `data-count` — rule 12 still wants count-up on the donut centre number and the FY figure; apply to donut total + legend counts. | I:1036-1037, I:599-606 |
| ☑ | G-08 | Reduced motion | `@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`; year cards no transition. | I:270, CV:91 |
| ☑ | G-09 | Sliding pill (`.seg`) | Track `oklch(96.5% .008 250)` + inset 1px border, radius 8, padding 2; navy thumb (radius 6, shadow) slides `transform .42s var(--spring), width .42s var(--spring)`; active label white 600; counts in mono 11px (`.cnt`), active count 72 % white; optional 7 px status dot. Click → moves thumb, sets aria-selected, dispatches `pick` (index). Clicking the already-selected tab → P: toast "Already showing X". | I:129-136, I:543-556, P:288 |
| ☑ | G-10 | `--spring` easing | `linear(0,0.0637,…,1.0004)` (25 stops, slight overshoot to 1.0036). | I:57 |
| ☑ | G-11 | Toast | Prototype global toast `#vp-toast` (P:158-165) shows 3.2 s; optional **Undo** button. Used by: Remind me ("Remind me · done" + Undo), Export, Download, timeline drag ("… window · 1 Oct – 6 Oct" + Undo), Fit, Undo. Drill-down rows use the in-page `.toast` (navy pill bottom-centre, 1600 ms). | P:158-165, P:244, I:223-224, I:1020 |
| ☑ | G-12 | Before / After incorporation | Shell pill in the top bar (`SH:539-581`, P:212-218) toggles `vcfo.after`; on non-Home pages it only toasts "Showing the company after/before incorporation". **The comp boards do not listen to `vcfo-after`; no pre-COI variant is drawn for Compliances.** Build: render the pre-COI state (see E-07). | P:212-218 |
| ☑ | G-13 | Dark theme | `html[data-theme=dark]` token set in P:38-53 (copied in §3.1). Theme button in top bar. | P:35-53 |
| ☑ | G-14 | Portal link ↗ (rule 15) | `.pbtn` 18×18 radius 4 icon button (external-link icon 14 px) after a filing name; muted, navy + primary-light bg on hover; `.dark` variant on navy surfaces. `href` from `portalOf(r)`, `target=_blank rel=noopener`, `data-tip="Open <portal>"`, aria-label same, `onclick=stopPropagation`. ≤767: 40×40 hit area with `margin:-11px -6px`. Prototype P: intercepts http links and toasts "Opens Open GST portal in the full app" — the real app must just open the new tab. | I:481-491, I:247-248, I:344 |
| ☑ | G-15 | Portal map | GST→GST portal `https://www.gst.gov.in/`; MCA→MCA portal `https://www.mca.gov.in/`; IT with /TDS\|TCS/ in name→TRACES `https://www.tdscpc.gov.in/`, else Income-tax portal `https://www.incometax.gov.in/`; PAY with /PF\|ESI/→EPFO `https://unifiedportal-emp.epfindia.gov.in/`, else State PT portal `https://www.tgct.gov.in/`; FEMA with /Softex/→STPI `https://www.stpi.in/`, else RBI FIRMS `https://firms.rbi.org.in/`. | I:482-490 |
| ☑ | G-16 | Proof chip 📎 (rule 15) | Only for filed rows. If proof missing → amber `chip c-due` "Proof pending", tip "SBC will upload the challan". Else `button.chip.pchip` paperclip 12 px + "Proof", tip "Open proof", `data-proof="<name> · <period>"` → opens the document preview overlay (G-17). ≤767: min-height 32. | I:492-495, I:249, I:345 |
| ☑ | G-17 | Document preview overlay | Global capture click on `[data-proof]` (also 👁 in side panel) → appends `.pvwrap` (absolute inset 0, z 120; live: fixed, z 2147482600, scrollable column) with dark scrim `oklch(15% .03 264/.72)`, top bar (red "PDF" tile 30×34, file name bold, sub "GSTR-3B · Aug 2026 · filed 18 Sep", "1 / 1", white Download button, ✕), paper page `.pv-page` (600 px, Georgia, light-only island), zoom pill bottom-centre (− 100% +). Close: ✕ or scrim click. No Esc in prototype (add Esc + focus trap). | I:824-834, I:1023, I:288-291, I:318-323 |
| ☑ | G-18 | Info (i) pop-over (rule 7) | `.info` 20×20 icon button; pop-over ≤280 px under the icon, arrow on top, opens on focus-within (click) or `.open`; fade+slide `.15s`; ends with "🤖 Ask VCFO about this" row (primary, top hairline). | I:137-144, I:541 |
| ☑ | G-19 | Bot speaks (rule 16) | `botSay(lines,{size,action,secondary})`: avatar circle (size 40/44/48/56, robot SVG at 74 %, `bob 2.6s`) + bubble (radius `10px 10px 10px 4px`, 600 13px/1.4, max 300, tail at left-bottom pointing to bot) + optional actions row: ghost "🤖 Ask VCFO why" (default) and/or one secondary (navy). Avatar tooltip "Ask VCFO". | I:497-501, I:250-253 |
| ☑ | G-20 | Status chip | `.chip` radius 4, 2px 7px, 700 11px/16px + solid glyph 12 px: Filed `c-ok` ✓ green; Due soon `c-due` navy clock (glyph `prog`); Overdue `c-over` red "!"; Upcoming `c-up` grey empty circle + inset border. Tooltips: "Filed" / "Due within 7 days" / "Late · past the due date" / "Upcoming". | I:118-119, I:429-435 |
| ☑ | G-21 | Area chip | `.area` 20 px high mono 700 11px navy on `oklch(95% .012 255)` + inset ring; text MCA/GST/IT/PAY/FEMA; tooltip full name: "Ministry of Corporate Affairs", "Goods & Services Tax", "Income tax", "Payroll · PF, ESI, PT", "FEMA · RBI & STPI". | I:120, I:434-436 |
| ☑ | G-22 | Solid glyphs (rule 18) | `glyph(k,size,tip)` filled circle + white symbol: done green ✓; prog navy + gold clock; you amber person; sbc blue arrow; up light grey empty (inset ring); late red "!". | I:429-431 |
| ☑ | G-23 | Date tile (`.dtile`) | 44×48 (default) radius 8 white text: big day number (700 18px/1 Space Grotesk) + small 800 11px uppercase weekday/month (opacity .85). Colour = worst status (`--ok/--due/--over`, upcoming = `--navy`). Sizes used: 44×48 rail, 40×44 day pop-over & phone, 38×42 filings table, 56×62 detail/side panel. | I:185-187 |

#### 1.2 Calendar — desktop (`#cal-redesign`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | C-01 | Header row | `.row-wrap` (flex, nowrap when it holds `.calbar`, z 6): left `.calbar` = `[data-calnavr]` month nav · FY chip · area pill (scrolls horizontally); right `.end` (flex none) = view pill Month/Year/Timeline + "Filings" button. All controls 28 px high. | I:27-40, I:672-680, I:687 |
| ☑ | C-02 | Month navigator | Bordered pill (panel bg, 1px border, radius 6, padding 2): ‹ (`.ibtn` 24×28 borderless, aria "Previous month") · month button `.mpk-b` "October ▾" · year button "2026 ▾" · › ("Next month"). ‹/› step ±1 month across year boundaries (`stepMonth`). Hidden (`visibility:hidden`) when view ≠ Month. | I:671, CV:243, CV:322, CV:331-332 |
| ☑ | C-03 | Month / year picker | Click month or year button → `.mpk-pop` dialog (304 px, radius 14, padding 12, shadow `0 18px 40px -16px`), anchored under the nav, **left-aligned** (`left:0`), 8 px gap. Header: ‹ (`Previous year` / `Earlier years`) · `[October ▾][2026 ▾]` mode switch (active = raised bg) · ›. Month mode: 3-col grid of Jan…Dec 42 px buttons; current selection `.on` navy/white; real current month `.now` inset 1px navy ring. Year mode: 4-col grid of 32 years (base = viewY-10 aligned to 4), max-height 240 scroll, auto-scroll selected to centre; mono 13.5 px. Footer (hairline top): "Today" → sets 2026-10 (i.e. current month). Picking a month sets month + closes; picking a year keeps the month + closes. Same button again toggles closed; outside pointerdown closes; Esc closes and returns focus to opener; focus moves to selected cell on open; `aria-expanded` on the opener. | I:1-26, I:39-40, CV:249-305 |
| ☑ | C-04 | FY chip | Mono 10.5 px (calbar override) gold-soft bg / gold-text, radius 7, padding 0 8, stretches to row height. Static "FY 2026-27" — should follow the viewed month's FY. | I:32, I:687 |
| ☑ | C-05 | Area pill (5 areas) | `.seg` All 13 · MCA 2 · GST 3 · Income tax 4 · Payroll 2 · FEMA 2 (counts = rows in the month data). Calbar size: 28 px buttons, padding 0 9, 12 px font, 10 px counts. Pick → re-renders current view filtered to that area (Month: grid with only that area's rows; Year; Timeline). Additionally on the live grid it first dims non-matching `.ev` chips to opacity .18 (then CV re-render replaces them). Filter persists across view switches and month changes. | I:557, I:687, I:989-990, CV:328-329 |
| ☑ | C-06 | View pill | Month · Year · Timeline (`[data-calview]`). Switches the calendar card body (`[data-calbody]`), sets `data-view`. Month nav hidden for Year/Timeline. | I:677, CV:306-339 |
| ☑ | C-07 | "Filings" button | `btn btn-o btn-s` navy text, file icon 14 + "Filings" → navigates to Filings page (real: `<base>/filings`, carry period/area). | I:678 |
| ☑ | C-08 | Layout | `.cal-layout` grid `minmax(0,1fr) 340px`, gap 16, align start. Left = calendar card; right = rail (donut, Next deadline, Coming up), gap 12. | I:688-693, I:309-310 |
| ☑ | C-09 | Calendar card | `.card.t` (white, 1px border, radius 10, shadow, gold 38×3 tab at left 18) padding 12, holds the grid (`[data-calbody]`). | I:691, I:112-113 |
| ☑ | C-10 | Month grid structure | 7 columns Mon…Sun (Monday first: `start=(getDay()+6)%7`); header row `.dow` (MON…SUN, 800 11px uppercase .08em, `#eef2f8` bg, bottom line); leading days of previous month and trailing days of next month as `.day.out` (date only, colour `#a9b4c4`, not clickable — rendered as `<div>`); in-month days are `<button class="day">` with `data-iso`. Number of rows = what the month needs (5 for Oct 2026). Wrapped in `.cal-scroll` (overflow-x auto) with `.cal` min-width 540. | I:609-627, I:275-276, I:358-367 |
| ☑ | C-11 | Grid lines | **Thin 1 px `#9aa8bb` lines between every date** (cell right + bottom borders; 7n has no right border; outer frame 1px, radius 8, overflow hidden, no bottom frame since cells draw it). Cells white, height 96, padding `7px 8px`. Weekend cells NOT tinted in FINAL (override). | I:358-368 |
| ☑ | C-12 | Date number | `.dt` 24×24 radius 4, 700 13px Manrope. Empty day: plain number. Day with filings: filled square by **worst** status of its rows (rank over > due > up > ok): `s-over` red, `s-due` amber, `s-ok` green, `s-up` navy — white number. | I:164, I:168-171, I:370, I:423-426 |
| ☑ | C-13 | Count badge | If a day has >1 filing: mono 11 px muted count at the right of the date row. | I:620 |
| ☑ | C-14 | Event chips (tiles) | Up to 2 per day: `.ev` 20 px, radius 3, `#eef2f8` bg, 600 11px, left 3 px colour bar = the row's status colour (`--ok/--due/--over/--up`), name ellipsis. Area code hidden in FINAL (`.cal .ev .a{display:none}`). >2 → "+N more" (800 11px primary). Each chip carries `data-s=<status>`. | I:176-180, I:375-377, I:621-622 |
| ☑ | C-15 | Today | Whole cell: `box-shadow: inset 0 0 0 2px var(--navy)` + background `#eef2f8` (dark: `oklch(19% .009 258.3)`). "Today" label + gold pulse hidden in FINAL grid. Today+selected: `inset 0 0 0 2px navy, inset 0 0 0 4px primary`. | I:371-374 |
| ☑ | C-16 | Day hover | Background → `#f7f9fc` (transition .15s). No lift/shadow in FINAL. Cursor pointer on in-month days. Tooltip on days with filings: "Thu 15 Oct · 2 filings". aria-label "Thursday, 15 October, 2 filings". | I:363-369, I:619 |
| ☑ | C-17 | Day selected | Click → `.sel` (inset 2px primary). Only one selected; closing the pop-over removes it. | I:373, I:983, I:987 |
| ☑ | C-18 | Narrow cell | `@container (max-width:96px)` on `.day`: hide Today text and area code. | I:282-284 |
| ☑ | C-19 | Day pop-over | See P-01. | I:983-987 |
| ☑ | C-20 | Year view | `.yv` grid `repeat(auto-fill,minmax(min(100%,196px),1fr))` gap 12 of 12 FY months Apr 2026 … Mar 2027. Each month = `button.ym` (no border in FINAL) with header (`Oct 2026` 800 12.5px + mono count) + lined 7-col mini-grid (Mon first, 24 px cells; days with filings filled by worst status colour `--ok/--due/--over/--navy`, white 800 numbers, tooltip "Wed 7 Oct · TDS/TCS challan, ECB-2 return" (max 3 names + "+N"); today cell inset 2px navy (with a 1px white inner ring if also filled)) + summary line of coloured dots with counts (over, due, ok, up order; "Nothing due" if none). Hover: month title primary + underline. Click a month → switches to Month view of that month (programmatically clicks the Month tab). aria-label "Oct 2026 · 13 filings · open the month". | CV:44-56, CV:98-115, CV:334-338, I:378-391 |
| ☑ | C-21 | Timeline view | See T-01…T-14. | CV:117-238 |
| ☑ | C-22 | Donut card (compact donut) | `.card.t.donut` padding `12px 16px`, flex gap 16: 88×88 SVG donut (r 35, stroke 11, segments ok→due→over→up in that order, each `len-2` dash so 2 px gaps, rotated -90°), centre total (Space Grotesk 600 20) + month label ("October", Manrope 600 11 muted); legend grid `repeat(auto-fit,minmax(118px,1fr))` gap `6px 16px`: 10×10 radius-3 swatch · label · mono count. Live width: `clamp(88px,5.6vw,112px)`. Every segment, the centre hole (`data-k=all`, tip "All filings · 13") and every legend row is a drill-down trigger (status). Segment hover: stroke 11→15 (.15s). Legend row hover: brightness 1.06 + 2px primary/.25 ring. Tooltips "Filed · 1" etc. Colours: up = `--up` (light grey) here (not navy). | I:780-786, I:236-238, I:314 |
| ☑ | C-23 | Next deadline card (A) | `.card` padding `16px 16px 14px`, overflow hidden. Eyebrow: gold pulse + "NEXT DEADLINE" (800 11px .08em navy). Row: navy 58×62 tile (radius 10) "3" (Space Grotesk 28) + "DAYS" (800 11px) — drill trigger (status due) tip "GSTR-1 · due Sun 11 Oct"; title "GSTR-1 · Sep 2026" (700 18px Space Grotesk) + portal ↗ + (i) pop-over ("GSTR-1 for Sep 2026 · due Sun 11 Oct · filed on the GSTN portal. Sales data received 3 Oct." + Ask row); chips: area chip GST + green "✓ Data received". Buttons: navy "Open filing →" (flex 1) + ghost "Remind me". Footer strip (full-bleed, hairline top, padding 10 16): red 8 px dot · **ECB-2 return** · red "1 day late" · chevron right → drill trigger (status over) tip "Overdue · 1". | I:629-651, I:693 |
| ☑ | C-24 | Coming up rail | `.card` padding `14px 16px 6px`: title "COMING UP" (`.st`) + mono count; rows grouped by date: `.dtile` coloured by the date's worst status (upcoming navy) + list of items (area chip · name ellipsis · status chip). Data = month rows with due ≥ 7 Oct (TODAY-1), first 7 rows. | I:664-670, I:693 |
| ☑ | C-25 | Rail at ≤1179 | Rail becomes `grid repeat(auto-fit,minmax(min(100%,300px),1fr))` below the calendar; last child (Coming up) spans full width. | I:328-333 |
| ☑ | C-26 | "Open filing" | No handler in prototype (P: fallback toast). Build: go to Filings with the side panel open on that filing, OR open the calendar detail pop-up (P-02). Decision says calendar detail = pop-up → recommend Next deadline "Open filing" opens P-02. | I:647 |
| ◐ | C-27 | "Remind me" | P: toast "Remind me · done" + Undo. Real app note (`docs/context/notes/compliance.md`): "Remind me is deliberately disabled — no reminder backend". Needs NEW backend (see §2). | I:647, P:244 |
| ✗ | C-28 | Legend (status) | Old filterRow legend (Overdue/Due soon/Filed/Upcoming swatches) only in `#cal-empty`/header options; the live board uses the donut legend instead. | I:681-684 |
| ☑ | C-29 | Loading state | Skeleton card: 3 rows of 44×48 raised tile + two raised bars (80 %, 50 %), `animation: sk 1.2s infinite` (keyframes `sk` defined in P:/shell, a shimmer). | I:735 |
| ✗ | C-30 | Header options A–E | Static exploration (navy band; segmented status bar; counts in pills; next-deadline hero; status chips → drill-down `.schip`). Not built; owner chose the compact donut. | I:876-945 |
| ✗ | C-31 | Next-deadline colour options A–D | Static exploration; A chosen. | I:628-663 |

#### 1.3 Calendar pop-ups

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | P-01 | Day pop-over (`.dpop`) | Click an in-month date → removes any previous pop-over + `.sel`, selects the cell, appends `.dpop` (320 px or `innerWidth-24`, radius 12, padding 12, `--pop` shadow, 12 px rotated arrow) inside the artboard. **Placement**: right of the cell (`left = cell.right+12`, `top = cell.top-8`) if it fits within the viewport minus 12; else left of the cell (`.flip`, arrow on the right side); else centred below the cell (`.below`, no arrow, `top = cell.bottom+8`, clamped 12 from edges). Content: header = date tile (40×44, worst status colour, upcoming navy) + "Thursday 15 October" (14 px bold) + "2 filings" / "Free day" (11.5 px muted 700; static board: amber "2 filings · in 7 days") + ✕ (`data-x`). Body: `dayRow` per filing (P-01a) + "🤖 Ask VCFO" row; free day → `botSay('Nothing is due on this day.', 40 px, no action)`. Close: ✕ only (also removes `.sel`). No outside-click / Esc in prototype — add both. | I:983-987, I:194-195, I:285-286, I:700-706 |
| ☑ | P-01a | Day pop-over row | `dayRow(r)`: bordered 1px, radius 8, padding `9px 10px`, mb 6, cursor pointer: area chip · name + ↗ portal (bold 12.5) / period (11 muted) · proof chip (if filed) · status chip. Row click not wired → build: opens P-02 for that filing. | I:699 |
| ◐ | P-02 | Filing detail pop-up (calendar) | Scrim (`oklch(21% .042 264/.38)` + 2px blur, z 50) + centred `.modal` 600 px at top 90, radius 12. Header (padding 18 20, hairline): navy 56×62 date tile "20 / OCT · TUE"; chips row: area GST · status Upcoming · blue `c-prog` "🕑 12 days left"; title "GSTR-3B · September 2026" (700 22px Space Grotesk) + ↗; ✕ (bordered ibtn). Body (padding 18 20, gap 18): **Focus track** 4 nodes (P-04): ✓ Data received 2 Oct → NOW navy card "SBC preparing · Since 4 Oct · Arjun Mehta" (gold icon tile, gold pulse) → dotted → ○ Northwind approves "by 18 Oct" → ○ Filed "due 20 Oct". 4-col facts grid (raised tiles, 800 10px labels): Authority GSTN · Frequency Monthly · Period 1–30 Sep 2026 · Penalty risk [amber "Medium"]. Gold-soft notice row: person icon + "SBC will send the draft for Northwind's approval by 17 Oct." Footer (hairline): "🤖 Ask VCFO about GSTR-3B" (flex 1) · ghost "📅 Add to my calendar" · navy "Open in filings →". Opening it from the live grid is not wired in the prototype. | I:707-722, I:192-193 |
| ☑ | P-03 | Drill-down pop-up (rule 14) | See D-01…D-10. | I:993-1021 |
| ☑ | P-04 | Focus track (flow chart) | Done/upcoming nodes = 28 px solid glyph + label below (11.5 px 700, sub 11 px muted, max 100 px); current node = navy hero card (min 188, max 230, padding `10px 14px 10px 10px`, radius 12, shadow) with 32×32 gold icon tile, eyebrow "NOW · 2 OF 4" (800 11px #f3d58a), bold label 14, sub 11.5; pulsing gold ring `ftpulse 1.9s ease-out infinite` (box-shadow 0→9px). Lines: 5 px tall, radius 9; solid green when both ends done/current, else dotted (radial-gradient dots 9 px pitch). Node tooltips: "Done · 2 Oct", "With SBC · Arjun Mehta", "Upcoming · waiting on Northwind from 17 Oct". | I:257-269, I:504-513 |

#### 1.4 Drill-down (rule 14) — one component for calendar and filings

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | D-01 | Triggers | Any element with `data-dd=status\|area`, `data-k=<key>`, `data-set=oct\|fil\|fy` (click; tooltip on hover). Calendar: donut segments, donut hole, donut legend rows, Next-deadline days tile (due), overdue strip (over). Filings: donut segments/hole/legend (status), area-bar labels and every bar segment (area). Clicks inside an open `.dd` ignored. | I:1026, I:599-606, I:639-648, I:783-785, I:789 |
| ☑ | D-02 | Scrim + panel | `.ddscrim` `oklch(20% .05 258/.55)`; `.dd` 760 px, radius 12, shadow `0 24px 60px -20px`, `fadeUp .2s`. Live: fixed, centred (`left:50%; translate:-50% 0`), `top:max(12px,8vh)`, `width:min(760px,calc(100vw - 24px))`, max-height to viewport, scroll. (P: forces top `max(72px,8vh)`.) role=dialog aria-modal. | I:242-245, I:315-316, P:144-145 |
| ☑ | D-03 | Top bar | primary-light strip: "These filings live in Compliances · Filings" + right link: on Calendar "Open Filings →" (navigates); on Filings "Show in the Filings list ↓" (closes + smooth-scrolls to the table). Wraps ≤767. | I:1005, I:1019, I:347 |
| ☑ | D-04 | Title row | "Compliances · October 2026" / "Filings · Sep–Oct 2026" / "Compliances · FY 2026-27" (700 15px navy) + (i) "As of 8 Oct 2026." + ✕. | I:995, I:1006 |
| ☑ | D-05 | Tabs | Full-width navy sliding pill (equal columns). Status: All · Filed · Due soon · Overdue · Upcoming. Area: All · MCA · GST · Income tax · Payroll · FEMA. Each with count. **Clicked part pre-selected.** Min width 480 (scrolls). | I:994, I:1007, I:244, I:281 |
| ☑ | D-06 | Table | Columns Filing (name + ↗ + proof chip) · Period · Area chip · Due / filed (mono, right; "Filed 6 Oct" or "15 Oct") · Status (SOLID chip: white text on `--ok-chip/--due-chip/--over-chip/oklch(54% .026 258)`) · chevron. Sorted by due asc, **max 7 rows**. Row hover: primary name. Min width 560 (scrolls). | I:996, I:1008, I:1013, I:245, I:280 |
| ☑ | D-07 | Footer line | "Showing 7 of N · full list in Filings" when more, else "Showing all N" (11 px muted). For `fy` set totals come from FY counts. Hidden when empty. | I:1014-1015 |
| ☑ | D-08 | Empty tab | Table hidden; `botSay` 44 px: Overdue → "Nothing overdue. Nice work." (no action); else "No filings here yet." + "🤖 Ask VCFO why". | I:1012 |
| ☑ | D-09 | Footer bar | raised bg, top border: ghost "Open Filings". | I:1010 |
| ☑ | D-10 | Row click / close | Row click → toast "Opening <name> in Filings…" 1.6 s (build: go to Filings with side panel open on that row). Close: ✕ or scrim click (add Esc). Mobile: bottom sheet per DECISIONS. | I:1018, I:1020 |

#### 1.5 Timeline view (`tlv-*`, in the calendar card)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | T-01 | Range | Fixed window 1 Sep 2026 → 31 Mar 2027 (`W0`,`W1`), rows filtered to that range and to the area pill. | CV:118, CV:125 |
| ☑ | T-02 | Lanes | Grouped by area in order MCA, GST, IT, PAY, FEMA (area header lane 24 px, raised, uppercase label "Income tax" etc.), then one 30 px lane per distinct filing name; left name column `clamp(110px,14vw,150px)`. | CV:126-131, CV:135 |
| ☑ | T-03 | Toolbar | `↶ Undo` (disabled when no history) · hint text ("Drag a filing window to move it · drag its edges to resize · snaps to weeks/days · ctrl + scroll or pinch to zoom") · zoom group: − / range slider (0–1000, log scale) / + / level label (Months/Weeks/Days) / Fit. | CV:133-134, CV:166-170 |
| ☑ | T-04 | Ruler | 40 px: month labels at day 1 ("Oct 2026", left border); ticks by level: Days → every day number; Weeks → Mondays "5 Oct"; Months → "15". | CV:146-154, CV:75-77 |
| ☑ | T-05 | Bars | Per filing: bar from window start to end, 16 px high at top 7, radius 4, colour = filed green else status colour (`--ok/--due/--over/--navy`). Default window when none saved: due − PREP days → due, PREP = Monthly 5, Quarterly 10, Half-yearly 10, Annual 21. Due marker: 11 px navy diamond (red if late), white 2 px ring. Late (window ends after due, not filed) → diagonal white stripes + red diamond. Filed → `.lock` (opacity .75, cursor default). Lane background grid lines every day (or every week at Months level). | CV:119, CV:143, CV:156-164, CV:80-87 |
| ☑ | T-06 | Today line | 2 px red `#d64545` vertical line from below the ruler, with "Today" label tag. | CV:88-89, CV:165 |
| ☑ | T-07 | Initial zoom | `fitP` = max(min, min(40, width/61)) ≈ 2 months on screen, scrolled to 1 Oct. | CV:139, CV:177 |
| ☑ | T-08 | Zoom | +/− ×1.5, slider, ctrl/⌘+wheel (anchored at pointer), two-finger pinch; clamp [width/NDAYS, 40 px/day]; buttons disabled at limits. Fit → re-fit from October; if already fitted, toast "Timeline fitted to the screen · from October". Resize re-fits unless user zoomed. | CV:172-185, CV:201, CV:216, CV:237 |
| ☑ | T-09 | Pan | Mouse drag on empty area pans (cursor grab/grabbing); touch pans natively (`touch-action:pan-x`); scrollbar hidden. | CV:71-73, CV:202, CV:217 |
| ✗ | T-10 | Drag move / resize | Pointer on a bar: body = move, 8 px edges = resize start/end; snaps 7 days when < 7 px/day else 1 day; min 1 day; clamped to range. While dragging: gold ring + shadow, floating navy read-out "1 Oct – 6 Oct · 5 days · after the due date" (fixed, above pointer). On release (if moved): save, toast "<name> window · 1 Oct – 6 Oct (· ends after the due date)" + Undo. Filed → toast "<name> is already filed, so its window is locked". | CV:189-229, CV:90 |
| ◐ | T-11 | Keyboard | Bars are `role=slider tabindex=0`; ←/→ move by snap; Shift+←/→ resize end. Focus ring `0 0 0 3px rgba(84,112,255,.55)`. | CV:230-236, CV:82 |
| ✗ | T-12 | Undo | History stack per session; Undo button / toast Undo restores. | CV:183, CV:224 |
| ✗ | T-13 | Persistence | `sessionStorage['vcfo.calwin']` = {id:[startDay,endDay]}. Real data = `compliance_instances.window_from/window_to` (manager-only writes). | CV:122-123 |
| ☑ | T-14 | Tooltip | Bar `data-tip`/aria-label: "GSTR-1 · Sep 2026 · window 6 Oct – 11 Oct · due 11 Oct (· filed \| · ends N d after the due date)". | CV:161 |

#### 1.6 Filings — desktop (`#fil-redesign`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | F-01 | Header row | Left: FY stepper pill (‹ "FY 2026-27" mono 12 bold min-width 84 ›; 28×28 borderless ibtns). Right: cadence pill Monthly · Quarterly · Annual (scrolls) · ghost "⬇ Export" · ghost navy "📅 Calendar" (→ calendar page). | I:805-807 |
| ☑ | F-02 | KPI row | `.fil-kpis` grid `360px 1fr` (live `minmax(300px,360px) minmax(0,1fr)`), gap 16: donut card (C-22) over **all** filings in view with label "filings" (total 18: Filed 6 · Due soon 4 · Overdue 1 · Upcoming 7) + "BY AREA · SEP–OCT" card. ≤1179 single column. | I:787-793, I:313, I:332 |
| ☑ | F-03 | Area bars | Per area (MCA, GST, Income tax, Payroll, FEMA): 74 px label (drill: area) · 12 px stacked bar radius 4 on raised track, gap 2: filed green · overdue red · due amber · upcoming `--up` (flex = counts; each segment its own drill trigger + tooltip "GST · 2 filed") · mono "f/total" (34 px, right). Demo: MCA 1/3, GST 2/5, Income tax 2/5, Payroll 1/3, FEMA 0/2. | I:789, I:792 |
| ☑ | F-04 | Filter row | Area pill (All 18 · MCA 3 · GST 5 · Income tax 5 · Payroll 3 · FEMA 2) left; status pill right: All · ● Overdue · ● Due soon · ● Upcoming · ● Filed (coloured dots, no counts). Both scroll horizontally on narrow screens. **Not wired** in the prototype (thumb moves only) — build: filter the table (status pills DO filter the table here; DECISIONS' "status chips don't filter" refers to the calendar donut chips). | I:809 |
| ☑ | F-05 | Table card | `.card` overflow hidden. Head `.fil-head` (padding 12 16, bottom border): ‹ · "Sep – Oct 2026" (700 15 Space Grotesk) · › · mono "17 filings" · ghost "Full year" (right). Wraps ≤767. | I:810 |
| ☑ | F-06 | Table | `.tbl-scroll` (min-width 720). Columns: Due (56 px; 38×42 date tile, colour by status, upcoming navy, day + month "Oct") · Area (70 px; area chip) · Filing (name 700 13 + ↗; period 11 muted) · Frequency (muted) · Filed on (filed → "6 Oct" 600; overdue → red "N day late"; else muted "in N days") · Status (chip) · Proof (right: filed → [📎 Proof][⬇ ibtn "Download"]; proof pending → amber "Proof pending" only; not filed → subtle "—"). Rows sorted by due asc, filtered to due ≥ 15 Sep (the Sep–Oct window). Row hover tint; cursor pointer. th: 800 11px uppercase subtle, `9px 10px`; td `10px`, hairline top. | I:794-802, I:806-811, I:206-212 |
| ☑ | F-07 | Row click → side panel | Not wired live (static board `#fil-detail`). Build: row click opens F-10 side panel; proof chip / download / ↗ stop propagation. | I:814-823 |
| ☑ | F-08 | Export | Ghost button; P: toast "Download started…"/fallback. Build: CSV/XLSX of current filter (NEW). | I:807 |
| ☑ | F-09 | "Full year" / period stepper | Prototype shows a 2-month window "Sep – Oct 2026" with ‹ › and a "Full year" toggle. Real app has month stepper + Full year matrix. Recommend: ‹ › step the window by month (window = previous + current month), Full year = whole FY list. | I:810, FilingsView.tsx:495-585 |
| ☑ | F-10 | Filing detail side panel | Scrim + `.modal` pinned right: `right:24px; top:24px; bottom:24px; width:520px`, column. Header: green 56×62 tile "20 / SEP"; chips: GST · Filed · 📎 Proof · green "2 days early"; title "GSTR-3B · August 2026" (700 21) + ↗; ✕. Body (scrolls, gap 18): focus track all done (Data 3 Sep → Prepared 12 Sep → Northwind approved 16 Sep → Filed 18 Sep, tip "Done · 18 Sep · 2 days early"); 2-col facts: ARN `AA3609261847215` (mono) · Tax paid "₹ 4,82,310" (metric 16) · Due date 20 Sep 2026 · Filed by "Arjun Mehta · SBC"; "PROOF" list: file cards (red PDF tile 34×40, name bold 12.5, "142 KB · 18 Sep", 👁 Preview → G-17, ⬇ Download); first (primary) card highlighted primary-light with primary/.4 border. Footer: "🤖 Ask VCFO about this filing". | I:814-823 |
| ☑ | F-11 | Drill from Filings | Donut/legend (status, set `fil`) and area bars (area, set `fil`); top link "Show in the Filings list ↓". | I:1005, I:1019 |
| ☑ | F-12 | Empty register | `botSay('No filings yet for FY 2027-28.<br>They appear as each registration goes live.', 48 px, default action "Ask VCFO why")`. | I:923 |

#### 1.7 Calendar — phone (`#cal-mobile`, 390 px)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | M-01 | Root | `.cm-root` 100 % width, min-height 100dvh, bg `--bg`, 13 px. Comp-route: `.ab` width 100 %, `html.comp-phone`. | I:351-357, CR:10 |
| ☑ | M-02 | Top bar | 56 px, white, bottom border: ☰ menu (40×40) · "SBC" (800 15 Space Grotesk navy) · "/ **Calendar**" (ellipsis) · 🔍 · 🔔 with badge 3 (primary-light). (Replaced by the shared phone shell in SH.) | I:744 |
| ☑ | M-03 | Month / week nav | Right-aligned: ‹ ("Previous week") · "Oct 2026" (700 13 Space Grotesk) · › ("Next week"). Not wired. | I:746 |
| ☑ | M-04 | KPI cards | 3-col grid gap 8: white cards radius 10 padding 10 with 3 px top border colour: "3 / Due in 7 days" (amber) · "1 / Overdue" (red) · "44% / FY filed" (green). Values hard-coded (desktop donut says Due soon 4 — build must compute; see §2). | I:747 |
| ☑ | M-05 | Area pill | Same 6 pills with counts, 40 px buttons, horizontally scrollable strip bleeding to the screen edges (`margin:0 -16px; padding:0 16px`, hidden scrollbar). Not wired. | I:748, I:355-357 |
| ☑ | M-06 | Week strip | 7-col grid gap 4, Mon 5 … Sun 11 Oct: tiles 58 px radius 8; day with filings = solid worst-status colour (upcoming navy) + white text, no border; empty = white + 1px border. Content: weekday letter (800 11, .8), day number (700 16 Space Grotesk), then up to 3 "●" dots (count of filings) — **today** shows a gold pulse dot instead and gets `box-shadow:0 0 0 2px var(--navy)`. Not clickable in prototype (build: tap = select day → filter agenda / scroll to it). | I:749 |
| ☑ | M-07 | Agenda | Column gap 8: cards (min-height 56, white, border, radius 10, padding 8): 40×44 date tile (status colour, upcoming navy) · name (700 13 ellipsis) + area chip + status chip · chevron. Rows = due ≥ 7 Oct, first 6. Tap → should open the filing detail (bottom sheet). | I:750 |
| ☑ | M-08 | Ask VCFO | Launcher scaled .8 at right 14 bottom 14. | I:752 |
| ☑ | M-09 | Missing on phone | No donut, no Next-deadline card, no month grid, no Year/Timeline (by decision). | DECISIONS |

#### 1.8 Empty / edge states (bot speaks)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | E-01 | Empty month for an area filter | Over the (empty) grid: overlay `inset:44px 14px 14px` (below the weekday header), `oklch(97.4% .006 255/.7)` + 1px blur, radius 10, centred `botSay('No FEMA deadlines in May.<br>The next one is Softex on 30 Jun.', 56 px, actions: "🤖 Ask VCFO why" + navy "Show all areas")`. "Show all areas" → reset area pill to All. Copy needs next-occurrence lookup for that area. | I:727-733 |
| ☑ | E-02 | All clear (rail) | Card with `botSay('All clear this month.<br>Nothing due, nothing overdue.', 40 px, no action)` — replaces Next deadline / donut when nothing due and nothing overdue. | I:734 |
| ☑ | E-03 | No overdue (drill tab) | `botSay('Nothing overdue. Nice work.', 44)`. | I:920, I:1012 |
| ☑ | E-04 | Free day (day pop-over) | `botSay('Nothing is due on this day.', 40)`. | I:921, I:985 |
| ☑ | E-05 | Empty register (Filings) | `botSay('No filings yet for FY 2027-28.<br>They appear as each registration goes live.', 48)` + "Ask VCFO why". | I:923 |
| ☑ | E-06 | First-time tip | `botSay('Tip: click any date to see its filings.', 40, secondary ghost "Got it")` — once per user (persist dismissal; per-viewer localStorage is fine). | I:924 |
| ☑ | E-07 | Pre-incorporation (NOT drawn) | Not in the prototype. Real app shows `PreIncorporationNotice` (`src/components/compliances/PreIncorporationNotice.tsx`, client copy "Your compliance calendar and filings begin once your company is incorporated…"). Per rule 16 render it as a bot bubble (56 px) on both pages: "Your calendar starts after incorporation.<br>Nothing is due yet." with "Ask VCFO why"; keep the grid in its genuine empty state (no generated rows). Driven by `scope.preIncorporationIds` / `isIncorporated()`. | — |
| ☑ | E-08 | Bot spec | Avatar 40/44/48/56 px idle bob; bubble 1–2 lines 13 px, max 300 px, tail to the bot; optional ghost "🤖 Ask VCFO why" or one navy action; never for errors/warnings (keep red/amber). Error state (Filings "Could not load the register") stays a plain error. | I:926-931 |

#### 1.9 Breakpoints (live routes; `html.comp-live`)

| Done | id | width | behaviour | file:line |
|---|---|---|---|---|
| ☑ | B-01 | ≥1280 | Sidebar 248 px; search `clamp(180px,18vw,256px)`. | I:298, I:305 |
| ☑ | B-02 | ≤1279 | Sidebar 72 px icon rail; search collapses to a 36 px icon button. | I:299, I:324-327 |
| ☑ | B-03 | ≤1179 | `.cal-layout` → single column; rail = auto-fit grid (min 300 px cols), Coming up full width; `.fil-kpis` → single column. | I:328-333 |
| ☑ | B-04 | ≤767 | Sidebar hidden (menu ☰ shown); top bar gap 6 / padding 0 8, 40 px buttons, no theme button, crumb icon + parent hidden; `.row-wrap>.end` margin-left 0; seg buttons, `.btn`, `.btn-s` 40 px; `.ibtn` 40×40; `.pbtn` 40×40 (negative margin); `.pchip` min-height 32; donut wraps; dd top bar & filings head wrap. Phones use the `#cal-mobile` design for the calendar. | I:300, I:334-349 |
| ☑ | B-05 | any | Calendar grid min-width 540 inside a horizontal scroller; tables 720 (filings) / 560 (drill) min-width; drill tabs 480 min. | I:272-281 |
| ☑ | B-06 | header | `.row-wrap:has(.calbar)` never wraps; the area pill shrinks and scrolls (`.seg-scroll`, hidden scrollbar). | I:28-38, I:272-274 |

---

### 2. DATA shown → real app mapping

Legend: **EXISTS** (use as is) · **ADAPT** (exists, needs a change) · **NEW** (build it; backend piece named).

#### 2.1 The row model

Prototype row (I:406-420): `{id, due, area, name, period, filed, freq, auth}`; status derived (`status()` I:423).
Real row: `FilingRow` (`src/lib/filings.ts:23-46`): `id, engagementId, companyName, compliance (obligation.compliance_area), particular, authority, frequency, dueDate, filedOn, periodLabel, fyLabel, rawStatus, obligationId, windowFrom, windowTo`. Delivered by `useFilings({fyStartYear})` → `/api/filings?fy=` → `getFilings()`.

| Done | prototype field | real source | status |
|---|---|---|---|
| ☑ | `id` | `FilingRow.id` (compliance_instances.id) | EXISTS |
| ☑ | `due` | `FilingRow.dueDate` | EXISTS |
| ☑ | `name` | `FilingRow.particular` (e.g. "GSTR-3B Filing", "Form AOC-4", "Advance Tax Payment Q1") | ADAPT — the prototype shows short names ("GSTR-3B", "AOC-4 (financial statements)"). Add a display-name helper (strip " Filing"), or a `short_name` column on `compliance_obligations` (NEW, preferred; no form column exists — see TODO in `src/db/repositories/filings.ts:66-70`). |
| ☑ | `area` (MCA/GST/IT/PAY/FEMA) | `complianceGroupForAuthority(row.authority)` in `src/lib/client-overview.ts:265` → 'GST' \| 'Income tax' \| 'Payroll' \| 'MCA' \| 'FEMA' \| 'Other' | EXISTS (+ NEW tiny map group→short code MCA/GST/IT/PAY/FEMA and full-name tooltip). Decide where 'Other' goes (seed authorities IT, GST, MCA, EPFO, ESIC, RBI all map; none fall to Other today). |
| ☑ | `period` ("Sep 2026", "Jul–Sep 2026", "FY 2025-26") | `FilingRow.periodLabel` — formats vary: "Sep 2026" (monthly), "ITR FY 2025-26", "<particular> FY 2025-26", "<particular> 2026" (`src/lib/compliance/generate-instances.ts:109,132,161,172,182`) | ADAPT — select `period_start`/`period_end` too (columns exist, `schema.ts:589-590`, not selected in `getFilings`) and format consistently: same month → "Sep 2026"; multi-month → "Jul–Sep 2026"; FY → "FY 2025-26". Pure helper in `src/lib/filings.ts`. |
| ☑ | `filed` | `FilingRow.filedOn` | EXISTS |
| ☑ | `freq` | `FilingRow.frequency` (lower-case: monthly \| quarterly \| half-yearly \| annual \| one-time) | EXISTS (capitalise for display) |
| ☑ | `auth` ("GSTN", "Income Tax Dept", "EPFO · ESIC", "RBI", "STPI", "State PT Dept") | `FilingRow.authority` (codes: IT, GST, MCA, EPFO, ESIC, RBI) | ADAPT — display map code → authority name. |
| ☑ | status ok/due/over/up | `filingStatus(row, now)` → 'filed' \| 'due-soon' \| 'overdue' \| 'upcoming' (`src/lib/filings.ts:147`) | ADAPT — **threshold mismatch**: real `DUE_SOON_DAYS = 14` (`filings.ts:140`); prototype = **7** ("Due in 7 days", tooltip "Due within 7 days", I:423, I:433). Owner call: change the constant (also affects staff views/tests) or add a `dueSoonDays` option. Statutory list uses 7 (`statutoryStatus`). Key names map: ok→filed, due→due-soon, over→overdue, up→upcoming. |
| ☑ | worst-of-day | — | NEW pure helper `worstStatus(rows)` (rank overdue > due-soon > upcoming > filed) in `src/lib/filings.ts`. |
| ☑ | company (multi-company scope) | `FilingRow.companyName`, `scope.engagements`, `soleCompany`, `CompanyPicker` | EXISTS — client has one company → no picker (keep the existing rule). |

#### 2.2 Calendar page

| Done | UI element | data | real source | status |
|---|---|---|---|---|
| ☑ | Month grid rows | rows of the viewed month | `useFilings({fyStartYear: financialYearForDate(month).startYear})` + `rowsInMonth(rows, monthKey)` (`filings.ts:211`) | EXISTS. Note: a month view straddling FY boundary is fine (month is wholly in one FY). Leading/trailing out-of-month days show no rows (prototype shows none). |
| ☑ | Month grid geometry (Mon first, out days) | — | `buildStatutoryMonthGrid` in `src/components/admin/statutory-calendar-utils.ts:23` is **Sunday-first, 6 weeks** | NEW Monday-first helper (rows = needed weeks only) — keep pure + tested. |
| ☑ | Selected month / view / area in URL | — | Calendar view already reads `?date=` (`ComplianceCalendarView.tsx:67`) | ADAPT — add `?view=month\|year\|timeline`, `?area=` (all\|mca\|gst\|it\|pay\|fema), keep `?date=`. |
| ☑ | Area pill counts | rows per area in the viewed month | client-side count over month rows | EXISTS (derive) |
| ☑ | FY chip | FY of viewed month | `financialYearLabel(financialYearForDate(month).startYear)` (`filings.ts:58-67`) | EXISTS |
| ☑ | Month/year picker "now" ring + Today | current month | `new Date()` | EXISTS |
| ☑ | Donut (month) | counts by status of month rows; total; month name | `rowsInMonth` + `filingStatus`; `summarise()` (`filings.ts:179`) gives due/overdue/filed but not upcoming/due-soon | ADAPT — add `countByStatus(rows, now)` helper. **Decision needed**: prototype donut is fixed to October (the demo month). Recommend donut = viewed month. |
| ☑ | Next deadline (title, period, days left, area, portal) | first unfiled row with due ≥ today (sorted) | `sortByDueDate` + `filingStatus` | EXISTS (derive). Note prototype picks GSTR-1 (11 Oct) while PT payment 10 Oct is earlier → the prototype's pick is demo data; build: earliest unfiled due ≥ today. Should be relative to TODAY, not the viewed month. |
| ◐ | Next deadline "✓ Data received" chip | whether the client sent the data for this filing | none | **NEW** — link instance ↔ document request (`document_requests` table exists, `schema.ts:673`) or a `data_received_at` column on `compliance_instances`. Until then hide the chip. |
| ☑ | Next deadline (i) text | "GSTR-1 for Sep 2026 · due Sun 11 Oct · filed on the GSTN portal. Sales data received 3 Oct." | derived sentence | ADAPT (template from row) + NEW for "data received" date. "Ask VCFO about this" = `useAskOptional().ask({context:{kind:'compliance', ref: obligationId, label}})` (`src/components/ask/ask-context.ts:14-39`; `WhatsThisButton` already does this, `src/components/ask/WhatsThisButton.tsx`). |
| ☑ | Overdue strip ("ECB-2 return · 1 day late") | earliest overdue row + days late (+count if >1) | `filingStatus === 'overdue'` | EXISTS (derive) |
| ☑ | "Open filing" | open detail of that filing | — | NEW route state `?filing=<id>` (calendar pop-up) / Filings `?filing=<id>` (side panel) |
| ◐ | "Remind me" | per-user reminder for one filing | none (notes: deliberately disabled). WhatsApp nudges exist only as a system cron (`systemListComplianceNudges`, `src/db/repositories/compliance.ts:290`) | **NEW** — `compliance_reminders` table (user_id, instance_id, remind_on, channels) + `POST/DELETE /api/filings/[id]/reminder` + repository with AuthContext scope + Inngest delivery via the existing email/WhatsApp dispatchers (`src/lib/email/send-email.ts`, `src/lib/notify/send-whatsapp.ts`). Until built: hide or keep disabled (owner). |
| ☑ | Coming up rail | month rows with due ≥ today−1, first 7, grouped by date | derive | EXISTS (derive). Recommend: unfiled + recently filed from today−1. |
| ☑ | Day pop-over rows | rows due that date | derive | EXISTS |
| ◐ | Proof chip / Proof pending | filed + has proof? | `compliance_instances.evidence_url` exists (`schema.ts:598`) but is **not selected** by `getFilings` and is one URL only | ADAPT/NEW — see §2.4. |
| ☑ | Portal ↗ | portal per filing | URLs exist as private constants in `src/lib/announcement-portals.ts:41-66` (GST_LOGIN, IT_FO, MCA_FO, EPFO, ESIC, TGCT, FIRMS, FLAIR, STPI); TRACES missing | **NEW** helper `portalFor(row)` (prefer obligation-level: add `portal_key`/`portal_url` column on `compliance_obligations`, seeded in `src/lib/compliance/obligations-seed.ts`; fallback rules from I:483-490). Export the constants rather than duplicating. |
| ☑ | Detail pop-up facts: Authority, Frequency, Period, Penalty risk | | authority/frequency in FilingRow; period → period_start/end; `compliance_obligations.penalty_risk` exists (`schema.ts:555`) but not selected | ADAPT — add `penaltyRisk`, `periodStart`, `periodEnd` to `getFilings` select + `FilingRow`. |
| ☑ | Detail pop-up "12 days left" | due − today | derive | EXISTS |
| ◐ | Focus track (Data received → SBC preparing (since, who) → Northwind approves (by) → Filed) | workflow steps + dates + owner | `rawStatus` (`upcoming\|in-progress\|filed\|overdue`) and `owner_id` exist; no step dates, no approval | **NEW (build later per decision)** — `compliance_instance_events` (instance_id, step: data_received \| preparing \| sent_for_approval \| approved \| filed, at, by) or columns; owner display name via `profiles`. Show as design only until data exists — minimal honest version: Filed ✓ (filed_on) else "With SBC" if rawStatus=in-progress. |
| ◐ | Gold notice "SBC will send the draft for Northwind's approval by 17 Oct." | approval due date | none | NEW (with approval workflow) |
| ☑ | "Add to my calendar" (.ics) | single filing ICS | none (no `.ics` code in repo) | NEW `GET /api/filings/[id]/ics` (and FY feed) — pure ICS builder in `src/lib`. |
| ☑ | Year view | FY rows (12 months Apr–Mar) | `useFilings({fyStartYear})` + `financialYearMonths` (`filings.ts:94`) | EXISTS |
| ☑ | Timeline windows | window start/end per filing | `FilingRow.windowFrom/windowTo` (`compliance_instances.window_from/to`), write `POST /api/filings/[id]/window` (manager roles only; `setFilingWindowInDb`, `ScheduleWindowControl` in `src/components/schedule/`) | EXISTS for read. **Conflict**: prototype lets the client drag windows (sessionStorage). Clients cannot write windows. Recommend: client timeline read-only (bars locked, no drag/Undo, tooltip "Set by SBC"); default window when null = due − PREP days. If the owner wants client edits → NEW permission + audit. Timeline range: prototype Sep→Mar fixed; build: whole FY or current FY from previous month. |
| ☑ | Empty month bot "next one is Softex on 30 Jun" | next row of that area after this month | needs rows beyond the FY sometimes | derive from FY rows; if none in FY say "No FEMA deadlines this year." |
| ☑ | Pre-incorporation | | `scope.preIncorporationIds`, `isIncorporated()` (`src/lib/compliance/incorporation-state.ts:47`), `PreIncorporationNotice` copy | EXISTS — restyle as bot bubble. |

#### 2.3 Filings page

| Done | UI element | data | real source | status |
|---|---|---|---|---|
| ☑ | FY stepper | FY start year | `?fy=`, `financialYearLabel`, next-FY cap `currentFy+2` (`FilingsView.tsx:286`) | EXISTS |
| ☑ | Cadence pill Monthly/Quarterly/Annual | | `?cadence=`, `rowsForCadence` (`filings.ts:202`; quarterly includes half-yearly; annual includes one-time) | EXISTS |
| ☑ | Donut (filings) | status counts of rows in view | derive | ADAPT (`countByStatus`) |
| ☑ | By area bars | per area filed/overdue/due/upcoming, f/total | derive via `complianceGroupForAuthority` | EXISTS (derive) |
| ☑ | Area pill | | NEW `?area=` param + filter | NEW (client) |
| ☑ | Status pill (All · Overdue · Due soon · Upcoming · Filed) | | `?status=`, `FILING_STATUS_FILTERS` (`compliance-scope.ts:303`; order all, due-soon, upcoming, overdue, filed), `rowsForStatus` | EXISTS — reorder labels to prototype order. |
| ☑ | Period window "Sep – Oct 2026" ‹ › | | `?period=` month + `stepMonth` (`FilingsView.tsx:141-145`) | ADAPT (2-month window) — or keep 1 month; owner call. |
| ☑ | "Full year" | | `?view=year` | EXISTS (but redesign shows a list, not the matrix) |
| ☑ | Table columns | due tile, area, name+period, frequency, filed on / in N days / N days late, status, proof | all from FilingRow + derive | EXISTS except proof (§2.4). Drop the manager "Window" column for clients (prototype note I:776). |
| ☑ | Export | | none | NEW `GET /api/filings/export?fy=&cadence=&area=&status=` (CSV first; XLSX later). |
| ◐ | Side panel facts: ARN, Tax paid, Filed by | | none (`filed_note` free text exists `schema.ts:597`) | **NEW columns** on `compliance_instances`: `acknowledgement_no` (ARN/SRN/CIN/token), `amount_paid` (numeric, INR), `filed_by` (uuid → profiles) — written by staff when marking filed. |
| ☑ | Side panel "2 days early" | due − filed_on | derive | EXISTS |
| ◐ | Side panel proof list (name, size, date, preview, download) | | see §2.4 | NEW |
| ☑ | Calendar link | | `<base>/calendar?date=` | EXISTS |

#### 2.4 Proof files (rule 15) — NEW backend

- Today: single `compliance_instances.evidence_url` text (and `compliance_events.evidence_url`) — never surfaced to clients (prototype note I:777).
- Needed: **many files per filing** (acknowledgement + challan). Recommend new table `compliance_instance_proofs` (id, instance_id FK cascade, storage_path, file_name, mime, size_bytes, kind: acknowledgement\|challan\|certificate\|other, uploaded_by, uploaded_at) stored in S3 bucket `engagement-documents` via `src/storage/s3.ts` (`putObject`, `signedDownloadUrl`, `bucketKey`). Repository `src/db/repositories/compliance-proofs.ts` (AuthContext: client read own engagement; staff write per RLS table in `src/db/repositories/README.md`) + cross-tenant test. Routes: `GET /api/filings/[id]/proofs` (list + signed URLs), `POST` (staff upload), `GET /api/filings/[id]/proofs/[proofId]` (redirect to signed URL / stream for preview).
- `FilingRow` gains `proofCount` (or `hasProof`) so the register can show "📎 Proof" vs amber "Proof pending" without a second query. Proof pending = `filedOn && proofCount === 0`. Migrate any existing `evidence_url` into one proof row.
- Preview: reuse the shared document preview overlay used by Documents (rule 9) — there is no shared preview component in `src/components` yet (G-17 is NEW UI).

#### 2.5 Things the prototype data has that the real register does not generate

`obligations-seed.ts` (26 obligations) has no: Professional tax payment, TCS return/challan (separate), ECB-2, Softex, ITC-04, PF & ESI combined monthly (it has EPF monthly + ESI half-yearly). Demo screens will look sparser than the prototype; do not fabricate rows (notes: "Nothing here fabricates"). Adding obligations = seed change + `generate-instances` rules (owner call). Also notes: "the demo FY 2026-27 register has no monthly-frequency instances at all" — seed demo data must be fixed for a realistic pilot.

#### 2.6 Hooks / functions to add (pure, in `src/lib/filings.ts` or `src/lib/compliance-ui.ts`)

`worstStatus`, `countByStatus`, `areaOf(row)` (wraps `complianceGroupForAuthority` → short code), `AREA_LABEL/AREA_FULL`, `displayName(row)`, `displayPeriod(row)`, `authorityName(code)`, `daysLeft(due, now)`, `nextDeadline(rows, now)`, `firstOverdue(rows, now)`, `comingUp(rows, now, n=7)`, `mondayMonthGrid(monthKey)`, `defaultWindow(row)` (PREP days), `portalFor(row)`. All with unit tests (golden rule 5).

---

**Build notes (compliances builder):**
- NEW: tables `compliance_instance_proofs`, `compliance_instance_details`, `compliance_reminders` (`src/db/schema-portal-compliances.ts`).
- NEW: repository `src/db/repositories/client-compliances.ts` (Path A: read = `listScopedEngagementIds`; proofs/details write = staff in scope; reminders = caller's own row).
- NEW: routes `GET /api/client/compliances?fy=`, `/export` (CSV), `/ics?fy=`, `/:id/ics`, `/:id/proofs` (GET/POST), `/:id/proofs/:proofId` (GET signed URL or redirect, DELETE), `/:id/reminder` (POST/DELETE), `/:id/details` (PATCH, staff).
- NEW: Inngest cron `src/jobs/compliance-reminders.ts` (needs registering in `app/api/inngest/route.ts`).
- NEW: pure view-model `src/lib/client-portal/compliances.ts` (7-day due soon, areas, portal map, Monday grid, focus track, CSV/ICS).
- ✗ T-10/T-12/T-13: client timeline is read-only (owner rule; QUESTIONS.md). ◐ items wait on staff data entry (details/proofs) or the reminder job registration.

<!-- /area:compliances -->

<!-- area:documents -->
## Documents, Knowledge Bank, reader, document viewer

Full catalogue (verbatim CSS, markup, logic): `inventory/documents.md`.

### 1.1 Documents — page frame & toolbar (desktop/tablet board `docs_a_refined.dc.html`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | D-01 | Page root `.vdoc` | Full viewport flex row: sidebar column + content column. `height:100vh/100dvh; min-height:560px`; bg `--bg`; Manrope 13px. **No page H1** on the redesign (title lives only in the top-bar trail "Documents"). | docs_a_refined.dc.html:90,127 |
| ☐ | D-02 | Sidebar column `.vp-sidecol` | 248 px (desktop), 72 px (≤1279), 0 + hidden (≤767). Navy `#0f2a4a`. Holds the shell sidebar (active = Documents). | :87-89,128 |
| ☐ | D-03 | Top bar | `dc-import topbar trail="Documents"`, 52 px. Logo · folder crumb icon · "Documents" · Search ⌘K · Announcements · Notifications (3) · Theme. See S-01..S-08. | :130; topbar.dc.html:37-53 |
| ☐ | D-04 | Main `.vdoc-main` | max-width 1600, centred, padding `clamp(12px,1.6vw,20px) clamp(12px,1.8vw,24px) clamp(12px,1.8vw,24px)`, column gap 14. | :92,131 |
| ☐ | D-05 | Explorer card `section[aria-label="Document explorer"]` | One white card: radius 10, 1 px border, `--shadow`, flex column, fills height. Contains toolbar + body (tree | pane) + toast layer (position:relative). | :132 |
| ☐ | D-06 | Toolbar `.vdoc-tools` | min-height 52, padding 9/12, wraps (`gap:8px 6px`), bottom border. Order: Filter · Status toggle · Replaced toggle · Arrange-by pill · spacer · Download all (ZIP) · Upload · N requested. | :93,133-140 |
| ☐ | D-07 | Filter input | `label.vdoc-q` 32 px tall, search glyph 14 px, `input[type=search]` placeholder **"Filter documents"**, aria-label same; right side mono 11 px counter **`{shown}/{total}`** files (e.g. "15/17"; total counts every file node incl. missing + replaced; shown applies the Replaced toggle and the query). Typing filters live (onInput). Flex `1 1 200px`, min 200, max 300 (≤999: full row). | :94,134,311-313,371 |
| ☐ | D-08 | Filter behaviour | Case-insensitive `includes` on the **row name** (not file name). While a query is set: every folder is forced open (chevrons at 90°), folders with no matching visible file are removed, missing rows match too. | :311-312,323,327-328 |
| ☐ | D-09 | "Status" toggle `.tg` | 32 px pill button, icon = three 6 px dots (green `--ok`, blue `--prog`, amber `--due`), label "Status". `aria-pressed`. **Default ON**. ON → `.tg.on` (primary-light bg, navy text, border primary/35%). Shows/hides the per-file status glyph (DT-14). Tooltip (data-tip) "Show status icons" — note: `.tg` has no `.tip` class, so the tip renders through proto's rule-17 tooltip only if icon-only; label is visible so effectively none. | :33-34,135,346,372-374 |
| ☐ | D-10 | "Replaced" toggle (the "h toggle") | Same `.tg` style, eye-off icon 14 px + "Replaced". **Default OFF** (DECISIONS: replaced files shown but hidden by default). ON reveals replaced rows (DT-11). data-tip "Show files that were replaced". | :136,312,374 |
| ☐ | D-11 | Arrange-by sliding pill `.seg` | `role=tablist aria-label="Arrange by"`, width 190, two tabs **"By step" / "By category"**; navy thumb slides `translateX(view*100%)` with spring (A-01). Active label white. **Default By step.** DECISIONS: "the choice is remembered" — prototype does **not** persist it (state only) → must persist (localStorage per user, or user pref). Switching closes any open menu. | :35-38,137,375-376 |
| ☐ | D-12 | Spacer | `.vdoc-sp` flex 1 (hidden ≤999). | :95,138 |
| ☐ | D-13 | "Download all (ZIP)" button `.btn.btn-o` | 32 px outline button, download glyph + "Download all (ZIP)". Starts ZIP toast for **"Northwind documents.zip"** with total = all files that are not Missing and not Replaced (demo 16). DECISIONS: ZIP uses real step names in folder paths. | :139,366,377 |
| ☐ | D-14 | "Upload · 2 requested" button `.btn.btn-n` | Navy 32 px, upload glyph + **"Upload · {n} requested"** where n = open requests (demo 2: DIR-2 + lease deed). Opens the Upload dialog (U-08). DECISIONS: upload **only against open requests** — no free upload; hide/disable when n = 0. | :139; docs_upload.dc.html:88-109 |
| ☐ | D-15 | Tablet button height | ≤1279: toolbar `.btn` height 36. | :103 |

### 1.2 Documents — tree rows (`role=tree`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | DT-01 | Tree container `.vdoc-tree` | `role=tree aria-label="Folders and files"`, width `clamp(300px,44%,440px)`, right border, own scroll, padding 6/0. ≤999: full width, `max-height:52vh`, bottom border. | :98,107,143 |
| ☐ | DT-02 | Row `.tr` | `role=treeitem`, `aria-expanded` on folders, `aria-selected`. Height 36 (44 on ≤767), 13 px. Inner full-width `<button class="main">` (click target) + optional progress bar link + kebab. Hover bg `--raised`. | :39-46,145-146 |
| ☐ | DT-03 | Indent guides `.gd` | One 16 px column per depth with a 1 px left border (`--border`), margin-left 7. Phase depth 0, step 1, file 2. | :47,147,297,337 |
| ☐ | DT-04 | Chevron | 12 px chevron in a 16/20 px slot, folders only; rotates 0°→90° when open, `transition:transform .15s`. | :148,341 |
| ☐ | DT-05 | Folder glyph | 16 px folder SVG inside a 20×20 r6 tile (tint `light-dark(oklch(94.5% 0.015 255), oklch(21.3% 0.01 255))`), glyph scaled to 12 px. Fill `--folder` (#0f2a4a) closed, `--folder-open` (#1b4f94) open. Inner line `M3 9.2h18` white/35%. Selected row: fill white, line navy. | :48,119-124,149,340 |
| ☐ | DT-06 | Phase folder row | Label e.g. "Phase 1 — Name application". Right side: mono 11 px **count** = non-replaced files under it (incl. missing). No progress bar. Default open: p1, p2, p3. | :156,261-287,342 |
| ☐ | DT-07 | Step folder row | Label "**{step no} · {step name}**" e.g. "6 · Director KYC" (DECISIONS: readable real step names). Right side **per-step progress bar** (DT-08). Default open: s3, s6, s8, s17, s22; **s21 closed**. | :241,331,343 |
| ☐ | DT-08 | Per-step progress bar `a.pb` | 56×4 px track (`--hair`), 1 px gaps, three segments in order **ok (green `--ok`) · in review (blue `--prog`) · missing (amber `--due`)** widths = share of non-replaced files. Then mono frac **"{ok}/{total}"**. Hover: bg primary/8%, navy tooltip above-right (`::after`, max 240, 11.5 px/600) text **"{Step name without number} · {ok} received · {rv} in review · {ms} missing"** (e.g. "Director KYC · 4 received · 0 in review · 1 missing"); tooltip shows on hover **and** focus-visible, `.12s` no delay. **Click → progress drill-down dialog (DD-*)**. aria-label "{tip}. Open the list". Only rendered if total > 0. | :55-59,158,330,343-345 |
| ☐ | DT-09 | Category folder row (By category view) | 5 categories, flat (no phases): **Identity & KYC (c1) · Office address (c2) · Company records (c3) · Certificates (c4) · Banking & capital (c5)**; each file is re-parented under its category (keeps `step` for "Open step N"). Category rows get the same progress bar + frac as steps. Default open c1–c4, **c5 closed**. | :288,291-294,332,343 |
| ☐ | DT-10 | File row | Type tile (DT-12) · name (`.lb` 600, ellipsis) · optional chips · status glyph (DT-14). Click → selects file (navy row) and shows it in the preview pane; closes menus. (Rule 9 says "click a row → preview overlay" — FINAL desktop shows it in the right pane; the pane's page/eye opens the overlay viewer.) | :150-155,355 |
| ☐ | DT-11 | Replaced row `.tr.hid` | Only when Replaced toggle ON. Text `--subtle`, label italic, **no status glyph**; shows eye-off icon (14 px) with tooltip **"Replaced by a newer file"**. Excluded from counts/progress and from ZIP totals. Status text in pane "Replaced" (raised bg, muted). Demo: "Board resolution (draft v1)" DOCX, "Address proof — Ravi (June bill)". | :43-44,154,264,270,312,329 |
| ☐ | DT-12 | File-type tile `.ft` | 20×20, r6, `font:700 7px/20px IBM Plex Mono`, letter-spacing −.02em. Colours (tint + ink): **PDF** `--over-light`/`--over-text`; **JPG** `--teal-light`/`--teal-chip`; **DOCX** `--prog-light`/`--prog-text`. Tooltip + aria-label: "PDF file" · "Image (JPG)" · "Word document". DECISIONS: file-type colour only as a thin band/tile; **status is always a separate badge**. (PNG/HEIC not in demo — add PNG = JPG colours, "Image (PNG)".) | :51,119-120,150,298,301 |
| ☐ | DT-13 | Missing (requested, not uploaded) row | DECISIONS "missing files as dashed rows": dashed 14×14 r3 1.5 px `--due` square inside a 20 px slot (instead of the type tile) · name · status glyph (person amber / ! red) · **due chip**: "Due 12 Nov" (`--due-chip` white) or **"Overdue"** (`--over-chip` white), 18 px tall. Click → selects; pane shows drop zone. Never counted in ZIP. | :151,155,272,276,348 |
| ☐ | DT-14 | Status glyph `.sg` (rule 18, set A) | 20×20 r6 filled tile, white 10 px glyph. Shown when Status toggle ON and row not replaced (missing rows show it too). Mapping: Approved/Final → **done** green check (`--ok-chip`); In review → **SBC** blue arrow-up-right (`oklch(55% 0.2 262)`); Missing due → **you** amber person (`--due-chip`); Missing overdue → **late** red "!" (`--over-chip`). Tooltip/aria: "Done · approved {date}", "Done · from SBC {date}", "With SBC · in review since {date}", "Waiting on Northwind · due {date}", "Late · was due {date}". Selected row: 1.5 px white ring. (`now` navy clock glyph defined but unused.) | :82-83,121,155,302-310,346-347 |
| ☐ | DT-15 | "Older than 2 months" stale chip | DECISIONS "stale-proof flag". Amber chip (`--due-light`/`--due-text`, 18 px, 11 px) after the name of a dated proof older than 2 months (demo: Address proof electricity bill). Tooltip **"Bill is older than 2 months. SBC may ask for a newer one."** | :154,269,346 |
| ☐ | DT-16 | Board resolution row | DECISIONS: **a row with a "Final" badge, no separate card**. Demo: Phase 1 › "3 · Signed Board Resolution" › "Board resolution (final)" PDF, status Final, From "SBC · Arjun Mehta". Older draft is a Replaced DOCX. Replaces today's `ClientBoardResolutionCard`. | :262-264 |
| ☐ | DT-17 | Kebab `.kb` (⋮) | 28×28 transparent, **opacity 0 until row hover / focus-within / menu open** (always visible ≤767 at 40×40). Hover bg primary/12% (on selected navy row: white/16%). aria "More actions for {label}", `aria-haspopup=menu`, `aria-expanded`. Toggles that row's menu (only one open at a time). | :60-64,117,159,349,352 |
| ☐ | DT-18 | Selected row `.tr.sel` | Navy bg, white text, **3 px gold left bar** (`::before`), guides white/20%, counts white/70%, folder glyph white. Default selection **f9 Certificate of Incorporation**. | :41-42,48-49,54,241 |
| ☐ | DT-19 | Folder click | Toggles open/closed (`aria-expanded`), closes menus. Folders don't select. | :355 |
| ☐ | DT-20 | Empty filter result | When no rows: bot (40 px, idle) + speech bubble **"No document matches “{q}”."** + text button **"Clear filter"** (clears q) + link **"Ask VCFO why"** (opens chat). | :186,370 |
| ☐ | DT-21 | Row "id" naming | Rows use human names ("PAN card — Ravi Kumar"); actual file name only in pane "File" row (DECISIONS "readable row names"). | :267,213 |

### 1.3 Documents — row menus (pop-over, `role=menu`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | DM-01 | Menu container `.menu` | Absolute under the row (`right:6px; top:34px`), 236 px (max `100vw-24px`), padding 4, r8, border, shadow `0 16px 36px -12px`. z 70. Items 34 px, 12.5 px/600, icon 15 px, hover/focus primary-light + navy. `hr` hairline. Right-aligned mono hint `.k`. | :65-69,161 |
| ☐ | DM-02 | Folder menu (phase, step or category) | 1 **Download folder as ZIP** — hint "{n} files" (non-missing, non-replaced) → ZIP toast "{folder name without number}.zip" (DECISIONS: real step names). 2 **Expand all** (opens folder + all sub-folders). 3 **Collapse all**. — hr — 4 **Copy link to folder** → toast "Link copied". | :162-168,351,356-359 |
| ☐ | DM-03 | File menu | 1 **Download** (closes menu; real: signed URL download). 2 **Preview** (= row click/select; real: open viewer V). 3 **Open step {N}** (N = step number of the owning step, also in category view) → navigate to `/app/client/incorporation/step/{N}` (prototype only closes). — hr — 4 **Copy link** → "Link copied" toast. | :169-175,350,360 |
| ☐ | DM-04 | Missing-row menu | 1 **Upload** (selects row → pane drop zone; real: open upload for that request). 2 **Open step {N}**. — hr — 3 **Copy link**. | :176-181 |
| ☐ | DM-05 | Close behaviour | Esc inside menu (onKeyDown on menu) closes; picking any item closes; clicking another kebab swaps; switching view closes. **No outside-click close in prototype — add it.** Focus does not move into the menu in the prototype — add roving focus (↑/↓) for a11y. | :161,318,352-353 |
| ☐ | DM-06 | Prototype states board | `docs_a_states.dc.html` shows two 1440 boards side by side: folder menu open on "6 · Director KYC" + ZIP preparing (3 of 4); file menu open on COI + ZIP done. | docs_a_states.dc.html:15-16; docs_a_refined.dc.html:236,243-246 |

### 1.4 Documents — ZIP / copy toast

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | DZ-01 | Toast container | Absolute, bottom 20, centred, width `min(360px,100%-24px)`, navy, r8, padding 10/12, `role=status aria-live=polite`, enter animation A-04. | :74-76,219-230 |
| ☐ | DZ-02 | Preparing state | 22 px round white/14% badge with zip glyph · **"Preparing {name}.zip…"** · mono "{n} of {total}" (75% opacity) · dismiss ✕ (24 px). Below: 4 px track white/18% with **gold** fill `width:n/total`, `transition:width .25s`. Prototype ticks 1 file / **260 ms**. | :77-78,223-228,248-257,380-382 |
| ☐ | DZ-03 | Done state | Green 22 px check badge (`--ok-chip`) · **"Downloaded {name}.zip"** · "{total} files". No bar. Stays until dismissed (prototype). Real: auto-hide ~3–4 s like the global toast (3200 ms, `proto.js:164`). | :222,380-381 |
| ☐ | DZ-04 | Copy state | "Link copied", no count, no bar, check badge. | :319,380 |
| ☐ | DZ-05 | Dismiss ✕ | aria "Dismiss"; clears timer and toast. | :226,383 |

### 1.5 Documents — preview pane (right)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | DP-01 | Pane header | 52 px, padding 0 12 0 16, bottom border: type tile (min-width 34, 20 tall, 11 px text, tooltip) · name 700 14 px ellipsis · **status badge** · (files only) **Preview** eye icon button `.ib` (tooltip "Preview") → viewer; **Download** icon button (tooltip "Download"). Missing → type tile shows "—" on `--due-chip`, tooltip "Not uploaded yet". | :190-195,378 |
| ☐ | DP-02 | Status badge colours | Approved: `--ok-light`/`--ok-text`. **Final: navy bg white** (BR, COI, MoA, SH-1). In review: `--prog-light`/`--prog-text`. Replaced: `--raised`/`--muted`. Missing: `--due-chip` white. 20 px, r4, 11 px/700. | :27,300 |
| ☐ | DP-03 | Preview area `.vdoc-pv` | `--raised` bg, centred, padding 20. **File**: paper card `.vdoc-page` (`data-paper`, always light paper even in dark mode), `width:min(340px,100%)`, `aspect-ratio:340/440`, padding 34/36, shadow. Content placeholder: "SAMPLE · PLACEHOLDER PAGE" 11 px caps · title 18 px Space Grotesk · company 11.5 px · 4 grey lines. **Whole page is a link → opens the document viewer (V)**. Real: first-page thumbnail (PDF/image) or docx render. | :100-101,196-204 |
| ☐ | DP-04 | Missing drop zone `.vdoc-drop` | `min(360px,100%)×220`, dashed 1.5 px `--due`, r10, `--due-light` bg, 40 px `--due-chip` round upload badge, "Drop the file or **browse**". Link → upload (U). Real: drag & drop target + file picker for that request. | :102,205-207 |
| ☐ | DP-05 | Key-value rows `.kv` | 36 px rows, hairline top border, label muted 500 / value 600 right-aligned. **Step** "17 · Certificate of Incorporation" · **From** "SBC · Arjun Mehta" / "Northwind" / for missing "Asked by Arjun Mehta" · **Date** (mono 12) or **Due** for missing · **File** mono 12/500 (actual filename, "—" if missing) · **Verify** (only for some docs) portal link + ↗ 12 px, opens new tab, tooltip "Open {portal}", sr "(opens in a new tab)". Demo portals: COI & MoA → "MCA portal" `https://www.mca.gov.in`; PAN → "Income-tax e-filing" `https://www.incometax.gov.in`. (Rule 15.) | :70-73,209-215,363-368,378 |
| ☐ | DP-06 | ≤999 stacking | Pane goes under the tree; preview height `clamp(260px,42vh,420px)`; page uses `height:100%; width:auto`. | :104-112 |

### 1.6 Documents — progress drill-down dialog (`docs_a_drill.dc.html`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | DD-01 | Trigger | Click a step/category progress bar `a.pb` (DT-08). Rule 14: hover a part → tooltip; click → pop-up listing the items, with sliding pill, clicked part pre-selected. | docs_a_refined.dc.html:158 |
| ☐ | DD-02 | Scrim | Full-screen `oklch(20% 0.05 258 / .55)`, dialog centred. | docs_a_drill.dc.html:46 |
| ☐ | DD-03 | Dialog | 640 px, r12, shadow `0 24px 60px -20px`, `role=dialog aria-modal`, aria-label "{step} documents". Pop animation A-05. | :47 |
| ☐ | DD-04 | Context strip `.dd-top` | primary-light bar 9/18 px, 12 px muted: "These documents are for **Director KYC** in **Incorporation**" + right link **"Open Incorporation →"** (800, 12.5) → incorporation page (real: the step page). | :47 |
| ☐ | DD-05 | Header | 56 px: navy folder 18 px · H2 "6 · Director KYC" 700 15 · mini bar 80×5 (ok/missing split) · mono "4/5" · close `.ib` ✕ (tooltip "Close"). | :48-54 |
| ☐ | DD-06 | Status pill | `.seg` full width, 4 tabs **All · Received · In review · Missing** each with mono count (`.c` 10.5 px; white/72% when active). Thumb slides (A-01). Prototype opens on **Received** (t=1). Real: open on the segment that was hovered/clicked; default All. | :56,78,88-92 |
| ☐ | DD-07 | List rows `.row` | 44 px, hairline top, hover raised: type tile (or dashed square) · name link (600; file → viewer, missing → upload) · mono date (11.5, `--subtle`; missing shows "Due 12 Nov") · status badge · action `.ib`: eye **Preview** (files) or amber-bordered **Upload** (missing). | :59-69,93 |
| ☐ | DD-08 | Empty tab | Bot 40 px + bubble "Nothing in this group yet." + "Ask VCFO why". | :70,94 |
| ☐ | DD-09 | Close | ✕ link; Esc and scrim click must also close (proto `vcfoDrill` pattern: Esc + scrim, focus returns to trigger, focus moves to ✕ on open — `proto.js:711-739`). | :53; proto.js:726-734 |
| ☐ | DD-10 | Phone | Drill becomes a bottom sheet (DECISIONS "Mobile drill-downs = Bottom sheet"; `proto.js:743` `@media (max-width:700px)` sheet, radius 14 top, max 86vh). | proto.js:708 |

### 1.7 Documents — page states

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | DS-01 | Loading skeleton | `main[aria-busy=true]`. Toolbar skeletons: 300×32 (filter), 84×32, 96×32, 220×32 r8 (pill), spacer, 170×32. Tree (420 px): rows 36 px with 16 px icon + bar; step rows indented 36 px with 56×4 bar at right; file rows indented 60 px with 22×16 r3 tile. Pane: header skeleton (26×20, 240×12, two 32 px squares), page 340×440 r2, two kv rows (60/180, 50/120). Shimmer A-06. Rule: show after 150 ms, hold ≥ 300 ms (DECISIONS Incorporation "Loading L1"). **Note**: loading/empty boards still show an H1 "Documents" (22 px) above the card — the refined page has none; drop the H1 for consistency. | docs_a_loading.dc.html:13-20,22-54 |
| ☐ | DS-02 | Empty (no documents at all) | Toolbar at 50% opacity with "Filter documents 0/0". Tree shows the three phase folders greyed (`--subtle`, folder fill-opacity .3, count 0). Right side (raised): bot **56 px** + bubble **"No documents yet. Northwind’s files will appear here as each step is done."** + "Ask VCFO why"; buttons **Upload a document** (navy; only if open requests exist) · **Open incorporation** (outline). Replaces today's `return null` (improve #6). | docs_a_empty.dc.html:13-25,27-50 |
| ☐ | DS-03 | No match | DT-20. | docs_a_refined.dc.html:186 |
| ☐ | DS-04 | Error | Not drawn. Use rule 16 exception: errors keep red style. Suggest red card in the tree area with "Could not load documents" + Retry. | — |

### 1.8 Documents — phone (`docs_a_mobile.dc.html`, menu-sheet variant `docs_a_mobile_menu.dc.html`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | M-01 | Root | `width:100%; height:100dvh; min-height:520px`, column, bg `--bg`. | docs_a_mobile.dc.html:46 |
| ☐ | M-02 | Header | 56 px white, border-bottom: menu `.tbb` 44×44 (`data-vp-menu` → opens shell drawer) · SBC logo 24 px · spacer · bell 44×44 (primary colour, aria "Notifications, 3 new"). | :47-52 |
| ☐ | M-03 | Back row (drilled levels only) | min-height 44: back chevron `.tbb` (margin-left −10, navy, aria "Back to {parent label}") · crumb mono 11 px `--subtle` ("Documents / Phase 2") · **H1 19 px/700 navy** = current folder name (ellipsis). Hidden at root (screenshot root shows no title). | :54-57,146-147 |
| ☐ | M-04 | Filter + level kebab | 44 px filter (search 15 px, input 14 px, counter "14/16") + 44×44 bordered kebab for the **current level** → bottom sheet with the folder actions. (Menu variant: kebab in the title row, filter on its own row; crumb 10.5 px.) | :58-61; docs_a_mobile_menu.dc.html:53-58 |
| ☐ | M-05 | List card | Card r10 border shadow, `role=list`; enter animation A-08 on each level change. | :63-64 |
| ☐ | M-06 | Folder row | min-height 56: folder 20 px (navy fill) · label 14/600 · **step folders**: under the label a 64×4 progress track (ok/rv/ms) + mono frac "4/5"; **phase folders**: right mono count · chevron 14 px. Tap → drill into folder (push to path). Kebab 44×44 → sheet. | :66-79,129 |
| ☐ | M-07 | File row | Type tile · label 14/600 · under it **status badge + mono date** (missing: dashed 16 px square, badge "Missing", date "Due 12 Nov"/"Overdue"). Tap: **no-op in prototype** → must open the phone preview sheet (MP). Kebab → sheet. | :69-74,127 |
| ☐ | M-08 | Bottom sheet (actions) | Scrim button (aria "Close menu", `oklch(20% 0.05 258 / .45)`) + sheet (`role=menu`), r12 top, handle 40×4, title row 14/700 navy with hairline, items 52 px 14/600 with 18 px navy icons, mono right hint. Padding bottom **76 px** (clears the Ask VCFO pill; menu variant 20 px). Animation A-07. | :83-90 |
| ☐ | M-09 | Sheet items — folder | **Download folder as ZIP** ("{n} files") → toast; **Copy link to folder**. | :140-141 |
| ☐ | M-10 | Sheet items — file | **Download · Preview · Open step {N} · Copy link**. | :138 |
| ☐ | M-11 | Sheet items — missing | **Take photo** (camera glyph — DECISIONS "camera capture" → `<input type=file accept="image/*" capture="environment">`) · **Choose file** · **Open step {N}** · **Copy link**. | :137 |
| ☐ | M-12 | Toast | Absolute left/right 16, bottom 20, navy r8: text + mono count + gold bar while busy. Text "Preparing {name}.zip…" → "Downloaded {name}.zip", count "n of total" → "{total} files". 260 ms ticks. | :91-96,104-108,150 |
| ☐ | M-13 | Missing on phone | No Status / Replaced toggles, no By step/category pill, no Download all, no Upload button on phone. Recommend: put "Download all (ZIP)" + "Upload · N requested" in the root-level kebab sheet; keep replaced hidden. | — |
| ☐ | M-14 | Tap targets | All interactive ≥ 44 px (rows 56, kebabs 44). | :22-29 |

### 1.9 Upload flow (`docs_upload.dc.html` — specimen board, 1440×900)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | U-01 | Request card (waiting) | `.card.t` (gold 38×3 tab at top-left): title 13/700 "Signed DIR-2 — Meera Shah" + due chip right (min-width 116, centred) · drop strip `.drop` (dashed amber/55%, amber-light/50% bg, r8): 32 px white round upload badge with amber ring · "Drop the file or **browse**". | docs_upload.dc.html:24-25,32,47-53 |
| ☐ | U-02 | Dragging over | Drop strip turns **solid navy border**, primary-light bg, 4 px primary/12% ring, centred, padding 18/12; badge navy filled; text **"Release to upload"** 700 navy. | :54-60 |
| ☐ | U-03 | Uploading | Inner box: tiny mono "PDF" tag (9 px, over tint) · filename 12.5/600 ellipsis · mono "64%" · cancel ✕ (aria "Cancel upload") · 6 px bar navy fill (prototype animates 8→64% loop A-11; real: real progress). | :34-36,61-70 |
| ☐ | U-04 | Done | The new row moves into the list: row with 28×34 file glyph (tint body + coloured **bottom band** "PDF" — the "thin band" look) · name · chip **In review**; row bg glows ok-light → panel (A-12, prototype loops; real: once). Toast **"Sent to Arjun for review"** with green check + gold **Undo** (800 12.5). Toast enter A-13. | :38-40,71-85 |
| ☐ | U-05 | Error — file refused | Red alert box (1.5 px over/50% border, over-light bg): 28 px red "!" badge · "{file} · this file type can't be opened" (over-text 600) · outline **Try again** (28 px). Title chip "Overdue · 6 Nov". | :110-119 |
| ☐ | U-06 | Re-upload asked by SBC | Card title + red chip **"Re-upload"** · note row (raised bg r6): navy mono initials tag "AM" + quoted reason "“Bill is older than 2 months. Please send the latest one.”" · drop strip "Drop the new file or **browse**". | :120-125 |
| ☐ | U-07 | Accepted types caption | mono 11 px "PDF · JPG · PNG · DOCX · up to 10 MB". Real limit is `MAX_UPLOAD_MB` (default 50, env) and `MILESTONE_DOCUMENT_EXTENSIONS` → print from config. | :104; src/lib/upload-limits.ts:7,19,91 |
| ☐ | U-08 | Upload dialog (from toolbar button) | `role=dialog aria-label="Upload a document"`, r12: header "Upload a document" 700 15 navy + close 30 px · body: label **"For"** + 2-col grid of request cards (button; selected = 2 px navy border + primary-light; each shows name + due chip "Overdue"/"Due 12 Nov") · large drop zone (dashed primary/45%, primary-light/50%, r10, padding 28): 44 px navy upload badge, "Drop files here or **browse**", type caption · footer (raised): **Cancel** (outline) · **Upload** (navy). Only open requests are listed. | :88-109 |
| ☐ | U-09 | After upload | Request turns into a file row (In review) in its step; "N requested" count decrements; email to lead (existing `client_uploaded` event). | — |

### 1.10 Shared document viewer (overlay) — `s/home/v7x_doc_viewer.dc.html` (routed) / `s/docs/v7x_doc_viewer.dc.html`

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | V-01 | Opened from | Pane eye button, pane paper click, drill eye, file menu "Preview", reader "Documents for this" row, Home docs widget. DECISIONS "shared preview" = one component everywhere. | docs_a_refined.dc.html:194,198 |
| ☐ | V-02 | Scrim | `oklch(20% 0.05 258 / .6)`; in the routed version it starts at `left: var(--vp-side-w,248px)` (sidebar stays visible) and `top:52px` on phone under a mini bar (`.vh-pbar` with menu button, logo, "Documents"). | s/home/v7x_doc_viewer.dc.html:226 |
| ☐ | V-03 | Dialog | `width:min(1152px,100%-24px)`, `height:min(720px,100%-24px)`, r12, bg `light-dark(oklch(94% 0.008 255), oklch(22% 0.008 255))`, shadow `0 30px 70px -20px`. `role=dialog aria-modal aria-label="Document preview"`. | :226 |
| ☐ | V-04 | Header bar | white, padding 10/14: 30×30 r6 type tile (mono 11/700 PDF tint) · file name 14/700 ellipsis · **(i) info** 18 px → pop-over (≤280 px, arrow) "From SBC · 24 Oct 2026 · Size [size]" + row "🤖 Ask VCFO about this" · position "1 of 4" (cap 600) · **Download** outline 32 px (label hidden ≤767, aria "Download") · **Close** 32 px ✕ (aria "Close preview (Esc)", title "Close (Esc)"). | :226 |
| ☐ | V-05 | Page area | scroll, padding `28px clamp(12px,6vw,72px) 72px`; paper `data-paper` width `{pageW}` = 460 px × zoom, `aspect-ratio:1/1.414`, padding `clamp(20px,5vw,48px) clamp(18px,5vw,52px)`, `transition:width .2s`; demo content + rotated "SAMPLE" watermark (prototype only). | :226 |
| ☐ | V-06 | Prev / Next document | 40 px round buttons at left/right 16, vertically centred, shadow; aria "Previous document"/"Next document"; cycles through the **current list** (wraps). Real: the visible tree order (or drill list). | :226,247 |
| ☐ | V-07 | Zoom bar | navy floating pill bottom centre: "Page 1 / 1" · divider · − (aria "Zoom out") · "{zoom}%" · + (aria "Zoom in"). Range **50–150 %, step 25**, default 100. Phone: bar lifted to bottom 72 px (`.vh-zoom`). | :226,247 |
| ☐ | V-08 | Unsupported type state | Same chrome (no position, no prev/next): centred 64 px r12 prog-tint tile with doc glyph · "Preview not available for this file type" 15/700 · primary **Download** button. Example "Draft Board Resolution.docx". Real app **can** render DOCX (`IncorporationDocxPreview`, `docx-preview` dep) → use this state only for HEIC/ZIP/other. | :227-230 |
| ☐ | V-09 | Close | ✕ button or **Esc** (`keydown` on document, `preventDefault`) → back to the opener (shell back, else history.back). | :232-244 |
| ☐ | V-10 | Dark mode | `[data-paper]` stays white paper with light ink in dark theme (`proto.js:67-69`). | proto.js:66-69 |

### 1.11 Phone preview sheet (`docs_mobile_preview.dc.html`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | MP-01 | Sheet | Dark backdrop `oklch(20% 0.05 258)`; sheet from `top:28px` to bottom, r12 top, handle 40×4, enter A-09. `role=dialog aria-modal aria-label="Preview: {name}"`. | docs_mobile_preview.dc.html:26-28 |
| ☐ | MP-02 | Header | H2 15/700 navy ellipsis; under it chips **Final** (navy) · **SBC** (gold-soft/gold-text source chip) · mono date; close 44×44 ✕ (aria "Close preview"). | :29-32 |
| ☐ | MP-03 | Page | grey well `light-dark(oklch(93.5% 0.01 255), oklch(22.8% 0.01 255))`, paper 330×466 serif (Source Serif 4) demo COI. | :33-39 |
| ☐ | MP-04 | Pager | dots (active 18×4 navy, inactive 6×4) + mono "Page 1 of 2 · swipe" → horizontal swipe between pages. | :40 |
| ☐ | MP-05 | Footer | 2-col: **Ask VCFO** outline (18 px bot) · **Download** navy, 44 px. | :41-44 |

### 1.12 Before / after incorporation (Documents)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | BA-01 | Toggle | Prototype bar "Before COI / After COI" + top-bar pill; Documents board unchanged; toast only. | proto.js:182,213-219 |
| ☐ | BA-02 | Real-app variant | Driven by data: before COI → Phase 3/4 folders absent (no files), COI/MoA rows absent, more dashed missing rows in Phases 1–2; empty state DS-02 for a brand-new client. After COI → COI, MoA/AoA, SH-1 are **Final** rows with MCA "Verify" links. | docs_a_refined.dc.html:277-286 |

### 1.13 Knowledge Bank — bookshelf (`lib_shelf_a.dc.html`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | L-01 | Page frame `.vlib` | sidebar column (active = Library/Knowledge Bank) + column with topbar `trail="Library"` (→ "Knowledge Bank") + main (max 1600, padding `clamp(12px,1.6vw,20px) clamp(12px,1.8vw,24px) 96px`, gap 16). No H1. | lib_shelf_a.dc.html:66-68,95-99 |
| ☐ | L-02 | Toolbar `.vlib-tools` | wraps, gap 10: category pill · "{n} books" chip · **Monthly status brief** (outline 34 px) · **PDF brief** (outline + download glyph) · search. | :69,100-103 |
| ☐ | L-03 | Category pill | `role=tablist aria-label="Category"`; 6 tabs **All 15 · Incorporation 4 · Foreign inv. 3 · Tax 3 · Compliance 3 · Northwind’s project 2** (label + mono count); buttons 30 px; wrapper `flex:1 1 680px; max-width:740px` with hidden-scrollbar horizontal scroll, pill min-width 680. Thumb slides (A-01). Selecting filters shelves (only that category's shelf shown). | :24-29,70-72,101,158-162 |
| ☐ | L-04 | "{n} books" chip | `--primary-chip` bg white 11/700 — total saved items (not filtered). (`--primary-chip` is defined in proto dark tokens and side.dc.html: `oklch(52% 0.21 263)`.) | :101,160 |
| ☐ | L-05 | Monthly status brief | → `/api/ask/brief?engagementId=` PDF (existing `StatusBriefButton`). | :101 |
| ☐ | L-06 | PDF brief | Exports the shown books → `/api/ask/library/export?ids=`. | :101 |
| ☐ | L-07 | Search | 34 px (44 on phone), placeholder/aria **"Search books"**, live filter on book title (case-insensitive). | :102,156-157 |
| ☐ | L-08 | Recently read strip `.vlib-recent` | H2 "RECENTLY READ" (800 11 px, .1em caps, navy, 110 px wide; full row ≤1279) + up to **3 mini cards** `.mini` (min 230, `flex:1 1 200px; max 360`): 30×42 cover in book colour (inset 4 px spine shade; Northwind's-project covers get a **gold** spine) · title link (12.5 px → reader) · progress bar 5 px (`.pbar`; hover adds 2 px primary/25% ring) with tooltip **"70% read · 2 of 3 sections"** / **"Finished · read on 8 Nov"** / "35% read · 1 of 3 sections"; bar click → Recently-read drill (LD). | :41-45,74-78,105-110 |
| ☐ | L-09 | Shelves card | One white card r10, padding 6/0/18, gap 6. One `section` per category with ≥1 visible book, in fixed order: **Incorporation, Foreign investment, Tax, Compliance, Northwind’s project**. | :112-129,142-148,157 |
| ☐ | L-10 | Shelf header | 10×10 r3 colour dot · H2 13/700 navy (category title) · mono count. Padding 14/28/0. | :115 |
| ☐ | L-11 | Shelf `.shelf` | flex-wrap, gap 18 (row-gap 40), padding 22/28/0, `perspective:900px`, min-height 186; repeating plank background every 212 px (so wrapped rows each get a plank). Plank `.plank` 14 px gradient + shadow below the last row (margin 0 16). | :30-31,79,116,127 |
| ☐ | L-12 | Book `a.book` | 128×172, padding 16/12/12/22, r `2 6 6 2`, bg `--bc` (category colour), white; spine shading (`::before` 11 px gradient), page edges (`::after` 5 px striped, right −5). Gold top band `.bk-band` 5 px. 28 px round white/18% icon disc with category glyph (15 px). Title `.bk-t` 700 13/1.32, **2-line clamp** (6 lines on hover). Bottom `.bk-c` short category 11/700 caps .04em 80% opacity. aria "Open {title}" → reader. | :32-39,56-60,118-124 |
| ☐ | L-13 | Book hover/focus | Lift + tilt: `translate3d(0,-14px,0) rotate(-2.5deg)`, deeper shadow, title unclamps to 6 lines; active (press) `translate(0,-10px) rotate(-1.5deg) scale(.985)`. Timing A-14. | :56-60 |
| ☐ | L-14 | "Updated" ribbon `.rib` | DECISIONS **"Updated" chip = blue**: 14×22 bookmark ribbon at top-right (right 8), `--prog-chip` (blue), clip-path notch; `title="Updated"` (needs a real tooltip + aria per rule 17: "Updated since you saved it"). Shown when the topic version is newer than the saved copy. Demo: "FC-GPR after share allotment". | :40,120,152 |
| ☐ | L-15 | Category colours & glyphs | Incorporation `var(--navy-3)` building glyph, short "Incorp." · Foreign investment `oklch(45% 0.16 14)` globe, "FDI" · Tax `oklch(50% 0.12 62)` receipt, "Tax" · Compliance `oklch(42% 0.08 200)` shield-check, "Compliance" · Northwind’s project `var(--navy)` flag, "Northwind’s project". (Real categories also include **labour** — needs a colour, e.g. `oklch(50% 0.12 200)` `--cat-labour`.) | :142-148; src/lib/ask/categories.ts |
| ☐ | L-16 | No match | Bot 40 + "No book matches “{q}”." + **Clear search** (clears q **and** resets category to All) + "Ask VCFO why". | :130,162 |
| ☐ | L-17 | Ask VCFO launcher | Bottom-right floating launcher (boards draw a 68 px round bot button + "Ask VCFO" label; the real one is the shared launcher, `proto.js:~312-…`). | :134 |

### 1.14 Knowledge Bank — recently-read drill (`lib_recent_drill.dc.html`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | LD-01 | Dialog | Over the shelf, scrim .55, 600 px r12, pop A-05, aria "Recently read". Context strip "These guides live in the Library" + "Open Library →". Header H2 "Recently read" + close. | lib_recent_drill.dc.html:36-43 |
| ☐ | LD-02 | Pill | **All 3 · In progress 2 · Finished 1**; opens on In progress. | :44,61,68 |
| ☐ | LD-03 | Rows `a.row` | 56 px: 30×42 cover · title 700 · 140×5 bar · mono 56 px right "70%" / "Done". Row → reader. | :25-29,46-53,70 |

### 1.15 Knowledge Bank — empty (`lib_empty.dc.html`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | LE-01 | Layout | H1 "Library" (→ "Knowledge Bank") 22 px; card min-height 580 centred. | lib_empty.dc.html:31-33 |
| ☐ | LE-02 | Book illustration | 200×110 with 3 px violet-soft floor; 4 books rise in (A-15) staggered 0/.08/.16/.24 s; last one leaning 12°. | :21-24,34-40 |
| ☐ | LE-03 | Bot message | Bot 48 + bubble **"Northwind’s library is empty. Save an answer from Ask VCFO and it lands here as a book."** + "Ask VCFO why". | :41 |
| ☐ | LE-04 | CTA | Navy **Ask VCFO** (opens chat). | :42 |
| ☐ | LE-05 | Suggested topics | violet-tint chips (32 px, r6) "What is SPICe+?" · "What happens after the COI?" · "When do I need GST?" → `/app/client/learn/{slug}`. | :20,43-45 |
| ☐ | LE-06 | Loading | Not drawn; improve #13 asks for **skeleton books** + error card "Back to library". | improve.dc.html:43 |

### 1.16 Knowledge Bank — reader (`lib_reader.dc.html`, mode `saved` | `learn`)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | R-01 | Frame | Topbar `trail="Library"` + `leaf="{title}"` (crumb Library / title). Grid `minmax(0,780px) minmax(260px,340px)` gap 20 centred; ≤1100 one column with side cards in an auto-fit grid (min 240). | lib_reader.dc.html:56-71,93-94 |
| ☐ | R-02 | Hero `.vrd-hero` | r10 padding 22/24/20, gradient `115deg navy → navy-2 62% → oklch(38% 0.12 292)`, white. 3 px gold underline gradient at bottom. | :96,104 |
| ☐ | R-03 | Hero chips | Category chip (white/14% + inset ring) "Foreign investment" · **"✓ Reviewed by SBC"** (`--ok-chip`, min 116) · **"Updated 6 Nov"** (`--prog-chip` blue, min 116, saved mode only). | :97 |
| ☐ | R-04 | Title | H1 white `clamp(22px,1.2vw + 14px,30px)/1.2` 700. | :61,98 |
| ☐ | R-05 | Depth pill | `role=group aria-label="Depth"`, **Simpler · Normal · More detail**, white thumb on translucent track, active label navy 700, inactive white/78%; `aria-pressed`. Default Normal. Changes the lead line and (More detail) shows the facts grid (R-09). | :100,168,179-181 |
| ☐ | R-06 | Read time + official link | mono "3 min read" (70%) · pill link **"Official link · RBI FIRMS ↗"** (white/12% + ring, 30 px, new tab). | :102 |
| ☐ | R-07 | Lead paragraph | 17 px/1.6 500, max 68ch (16 px on phone). | :108 |
| ☐ | R-08 | Timeline visual | primary-light panel r10: label "TIMELINE" violet-text; 3 nodes 170 px: done (green ✓ 40 px) "Shares allotted · Day 0 · 2 Nov" — green link — **current** (navy "2" + 3 px gold ring + pulse A-16) "FIRC + KYC from bank · Now" — dashed link — next (dashed primary ring) "File FC-GPR on FIRMS · By day 30 · 2 Dec". Phone: vertical, links 3×22. (Rule 10 / Focus track.) | :41-45,109-118,76-80 |
| ☐ | R-09 | Facts grid (More detail) | 3 raised tiles: WHO FILES "SBC, for Northwind" · LATE FEE "LSF, per RBI" · PORTAL "RBI FIRMS". 1 column on phone. | :119 |
| ☐ | R-10 | Why it matters | gold-soft box, 28 px gold star disc, H2 "Why it matters to Northwind" (gold-text) + 13.5 px text. | :120-123 |
| ☐ | R-11 | Sources | label "SOURCES" + chips (26 px raised + ring) with ↗. | :124-130 |
| ☐ | R-12 | Action row | top border: saved → green **"✓ Saved to library"** (static `.btn-ok`) · learn → navy **"Save to library"** (bookmark) · **PDF brief** · **Ask a follow-up** (18 px bot) · spacer · saved → trash `.ib` (aria "Remove from library", hover red tint). improve #11: removal = toast with **Undo** (soft delete). | :131-138 |
| ☐ | R-13 | Side: In Northwind’s project | `.card.t`: H2 · date tile 50×54 amber "DEC 2" · "FC-GPR filing" + chips "24 days left" (due tint) · "SBC files" · link "Open in Compliances". | :143-150 |
| ☐ | R-14 | Side: Related | H2 "Related in Northwind’s library" + rows (28 px primary-light icon tile + title) with hairlines. | :151-155 |
| ☐ | R-15 | Side: Documents for this | H2 + row: PDF tag · "FIRC from the bank" · chip Approved → opens the shared viewer. (improve #16, DECISIONS "topic → documents link"). | :156-159 |
| ☐ | R-16 | Launcher | Ask VCFO launcher bottom-right with label arrow. | :163 |
| ☐ | R-17 | Phone | hero/body padding 18/16, buttons 40, `.ib` 40, pill buttons 36, source chips wrap min 40. | :72-87 |

### 1.17 Shell, top bar, bot, prototype-wide behaviours

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☐ | S-01 | Top bar `.vtb` | 52 px, white/90% + hairline. Menu (phone only) · logo 26 px (22 phone) · location trail (24 px primary-light folder tile hidden on phone; trail 13 px; with leaf: trail muted 500 / "/" / leaf 600) · right: Search button (`clamp(180px,18vw,256px)`, collapses to 36 px icon ≤1279, 40 ≤767) with kbd ⌘ K · Announcements · Notifications (badge 17 px "3", primary tint active) · Theme (hidden on phone). | topbar.dc.html:21-53 |
| ☐ | S-02 | Search ⌘K | Visual only in the prototype (no key handler; click → toast "Search · type to find steps, filings and documents"). Real: command palette (`src/components/shell/CommandPalette.tsx` already fetches `/api/documents`). | proto.js:245 |
| ☐ | S-03 | Theme | light / dark (True black) / system, stored `vcfo.theme`; any button whose aria contains "theme" toggles. | proto.js:6-75 |
| ☐ | S-04 | Rule-17 tooltip | Icon-only controls get a navy tooltip after **120 ms** (`#vp-tip`), unless `data-tip` exists (then CSS `.tip::after` with 120 ms delay). | proto.js:297-310,661 |
| ☐ | S-05 | Fallback toasts | 3200 ms toast for dead controls: "Download started · …", "Preparing the ZIP…", "Choose a file to upload", "Link copied", "Opens the official portal in a new tab". Real app must do the real action. | proto.js:159-166,237-245 |
| ☐ | S-06 | Page transitions | enter `vpIn .26s` (y 6 → 0), leave `.14s` opacity .35. | proto.js:135-137 |
| ☐ | S-07 | Bot avatar | `v7c_bot` states idle / thinking (antenna pulse 1 s + eye scan 1.3 s) / answered (green antenna) / cannot (grey); sizes used: 16, 18, 40, 48, 56. Smile never changes. | v7c_bot.dc.html:128-141 |
| ☐ | S-08 | Speech bubble (rule 16) | max 320, padding 10/14, r `10 10 10 2`, panel + border + shadow `0 8px 20px -12px`; text 600 13/1.45; action links 12/700 primary. | docs_a_refined.dc.html:186 |
| ☐ | S-09 | Scrollbars | Hidden everywhere (`scrollbar-width:none`) — prototype choice. | proto.js:141-142 |

### 1.18 Keyboard

| Done | id | key | behaviour | file:line |
|---|---|---|---|---|
| ☐ | K-01 | Esc in row menu | closes menu | docs_a_refined.dc.html:353 |
| ☐ | K-02 | Esc in viewer | closes viewer → opener | s/home/v7x_doc_viewer.dc.html:232-235 |
| ☐ | K-03 | Esc in drill pop-up | closes, focus back to trigger | proto.js:726-728 |
| ☐ | K-04 | Esc / Tab in phone drawer | closes drawer / focus trap | shell.js:433-445 |
| ☐ | K-05 | Tab / Shift-Tab | all controls are buttons/links with `:focus-visible` 2 px primary/50% ring (offset 2; tree `.main` offset −2). Kebab becomes visible on focus. Progress tooltip shows on focus-visible. | docs_a_refined.dc.html:46,64,84 |
| ☐ | K-06 | ⌘K | displayed only (S-02) | topbar.dc.html:48 |
| ☐ | K-07 | Tree arrows | **Not implemented** in prototype; `role=tree/treeitem` promises it → implement WAI tree keys (↑/↓ move, →/← expand/collapse, Enter select, Home/End). | docs_a_refined.dc.html:143-145 |
| ☐ | K-08 | Viewer ←/→, +/− | Not wired; recommended to mirror prev/next + zoom buttons. | — |

### 1.19 Animations & timings

| Done | id | what | spec | file:line |
|---|---|---|---|---|
| ☐ | A-01 | Sliding pill thumb | `transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)` (= `springSnappy` 420/32/0.8); label colour `.2s` | docs_a_refined.dc.html:36-37 |
| ☐ | A-02 | Tree chevron | `transform .15s` 0→90° | :341 |
| ☐ | A-03 | Tooltips | `.tip::after` opacity/transform/visibility `.12s` **delay .12s**, from `translate(-50%,3px)`; progress-bar tip `.12s` no delay | :58-59,80-81 |
| ☐ | A-04 | Docs toast in | `tin .25s cubic-bezier(.22,1,.36,1)` from `translate(-50%,10px)` opacity 0; progress fill `width .25s`; ZIP tick 260 ms/file | :74-78,256 |
| ☐ | A-05 | Dialog pop (drill, recent drill) | `pop .22s cubic-bezier(.22,1,.36,1)` from `translateY(8px) scale(.985)` opacity 0 | docs_a_drill.dc.html:31-32 |
| ☐ | A-06 | Skeleton shimmer | `sh 1.3s linear infinite`, gradient bg 600 px wide moving −300→300 px | docs_a_loading.dc.html:16-17 |
| ☐ | A-07 | Phone action sheet | `up .25s cubic-bezier(.22,1,.36,1)` from `translateY(40px)` opacity 0 | docs_a_mobile.dc.html:32-33 |
| ☐ | A-08 | Phone level change | `sl .2s cubic-bezier(.22,1,.36,1)` from `translateX(14px)` opacity 0 | :34-35 |
| ☐ | A-09 | Phone preview sheet | `sheet .28s cubic-bezier(.22,1,.36,1)` from `translateY(40px)` | docs_mobile_preview.dc.html:21-22 |
| ☐ | A-10 | Viewer zoom | paper `width .2s` | s/home/v7x_doc_viewer.dc.html:226 |
| ☐ | A-11 | Upload bar (specimen) | `fill 1.6s cubic-bezier(.2,.7,.2,1) infinite alternate` 8%→64% | docs_upload.dc.html:35-36 |
| ☐ | A-12 | New row glow | `glow 2.4s ease-out` ok-light → panel (prototype infinite; ship once) | :39-40 |
| ☐ | A-13 | Upload toast | `toast .3s cubic-bezier(.22,1,.36,1) .3s both` from y 10 | :37-38 |
| ☐ | A-14 | Book hover | `transform .42s cubic-bezier(.34,1.45,.5,1)`, `box-shadow .3s cubic-bezier(.22,1,.36,1)`, `will-change:transform` | lib_shelf_a.dc.html:56 |
| ☐ | A-15 | Empty-library books rise | `rise .6s cubic-bezier(.22,1,.36,1)` scaleY .2→1, delays 0/.08/.16/.24 s | lib_empty.dc.html:22-23,35-38 |
| ☐ | A-16 | Current-node pulse | `v7pulse 1.8s ease-in-out infinite` gold ring 0→7 px | lib_reader.dc.html:44-45 |
| ☐ | A-17 | Ask VCFO launcher | `v7up .45s cubic-bezier(.22,1,.36,1) .5s` from y 48; `v7bob 2.6s ease-in-out infinite` (−4 px) | lib_shelf_a.dc.html:48-51 |
| ☐ | A-18 | Reduced motion | every board: `@media (prefers-reduced-motion: reduce)` disables all animations/transitions; books `transform:none` | docs_a_refined.dc.html:85; lib_shelf_a.dc.html:52,61 |

### 1.20 Breakpoint variants

| Done | id | width | Documents | Knowledge Bank | Reader | file:line |
|---|---|---|---|---|---|---|
| ☐ | B-01 | ≥1280 | sidebar 248; tree `clamp(300px,44%,440px)` + pane side by side; toolbar one line | seg wrapper 680–740; "Recently read" label inline | 2 columns | docs_a_refined.dc.html:87,98 |
| ☐ | B-02 | 1000–1279 | sidebar 72 (icon rail; Before/After pill moves into rail in screenshot); toolbar buttons 36 px and wrap to 2nd line (screenshot 1024) | "Recently read" heading full row | 2 cols until 1100 | :88,103; lib_shelf_a.dc.html:77 |
| ☐ | B-03 | ≤1100 | — | — | single column; side cards in auto-fit grid min 240 | lib_reader.dc.html:68-71 |
| ☐ | B-04 | ≤999 | page grows (height auto); tree above pane (max 52vh); preview fixed `clamp(260px,42vh,420px)`; filter full row; spacer hidden | — | — | docs_a_refined.dc.html:104-112 |
| ☐ | B-05 | ≤767 | sidebar hidden (drawer); toolbar controls 40, pill buttons 36, rows 44, kebabs 40 always visible — **but the router serves the phone board (M-*) instead** | seg full row, buttons 40, search 44, shelf = grid `repeat(auto-fill,128px)` centred, gap 40/18; mini cards full width, links 40 | hero/body padding 16, timeline vertical, facts 1 col, buttons 40 | :113-118; lib_shelf_a.dc.html:80-92; lib_reader.dc.html:72-87 |
| ☐ | B-06 | phone board | M-01…M-14, MP-* | (no dedicated phone board for the shelf; uses B-05 rules) | | docs_a_mobile.dc.html |

---

## 2. DATA — what each board shows, mapped to the real app

Legend: **EXISTS** = hook / API / repository already in the repo · **PARTIAL** = exists but must be extended ·
**NEW** = must be built (with the backend piece named). Paths relative to `/home/user/vcfo_suite/`.
Golden rule from `CLAUDE.md`: only `src/db/repositories/*` may import `db`; every new query = a repository
function taking `AuthContext`, plus a cross-tenant test.

### 2.0 What the real pages use today

| Done | Page | Today's code | Data today |
|---|---|---|---|
| ☐ | `/app/client/documents` | `app/app/client/documents/page.tsx` → `src/views/client/Documents.tsx` (149 lines) | `useApp()` → `engagements`, `requests`, `getStateForEngagement`; `collectVaultDocuments` / `groupVaultDocuments` (`src/lib/vault-documents.ts`) build milestone → section → doc lists from `checklist_state`; each row fetches its own signed URL on mount via `MilestoneDocumentLink` (`src/components/common/MilestoneDocumentLink.tsx` → `getMilestoneDocumentSignedUrl` → `GET /api/milestone-documents/signed-url?path=`); `ClientBoardResolutionCard` (`fetchBoardResolutionInDb` → `GET /api/engagements/[id]/board-resolution`); legacy requests split into "on file" / "Still needed" lists. Returns `null` with no engagement. |
| ☐ | `/app/client/library` | `src/views/client/ask/ClientLibrary.tsx` | `useQuery(['ask','library'], fetchLibrary)` → `GET /api/ask/library` → `listLibraryItems(ctx)` (`src/db/repositories/client-library.ts:33`) → `toLibraryView` (`src/lib/ask/library.ts`) giving `{id,title,category,topicSlug,updated,savedAt,answer}`; `StatusBriefButton` → `/api/ask/brief`; export → `/api/ask/library/export?ids=`. |
| ☐ | `/app/client/library/[id]` | `src/views/client/ask/ClientLibraryItem.tsx` → `AskReader` | `fetchLibraryItem(id)` → `GET /api/ask/library/[id]` (`{item, notice}`); delete → `DELETE /api/ask/library/[id]` (`deleteLibraryItem` repo) then router push. Export `/api/ask/library/[id]/export`. |
| ☐ | `/app/client/learn/[slug]` | `src/views/client/ask/ClientLearnTopic.tsx` → `AskReader` | `fetchTopicAnswer(slug,{depth,engagementId})` → `GET /api/ask/topics/[slug]`; depth switch re-fetches; save → `POST /api/ask/library` (`saveToLibrary`). |
| ☐ | Staff vault (reference only) | `src/views/vault/DocumentVaultPage.tsx` | `useIndexedDocuments` (`src/lib/use-vault-documents.ts`) → `GET /api/documents`; `getIndexedDocumentSignedUrl` → `GET /api/documents/[id]/signed-url`. |
| ☐ | Firm Knowledge Bank (staff) | `src/db/repositories/knowledge-bank.ts`, `app/api/knowledge-bank/**` | **Staff-only** (`requireAnyRole('admin','manager','intern')`). Not the client "Knowledge Bank": the client one is the Ask VCFO library (`client_library_items`) + topics (`src/data/ask/topics/*.json`). Do not expose firm KB files to clients. |

### 2.1 Documents — one unified "document node" model (NEW view-model, existing sources)

The board's data rows (`docs_a_refined.dc.html:260-287`) are
`[id, parent, label, type, status, from, date, fileName, categoryId, replaced?, dueKind?, stale?]`.
Recommend a single server endpoint that returns this already merged and scoped:

**NEW** `GET /api/client/documents?engagementId=` → `{ phases:[{id,label,steps:[{itemId,no,label,categoryIds,files:[DocNode]}]}], openRequests:n, totals }`
built by a **NEW repository** `src/db/repositories/client-documents.ts` → `listClientDocumentTree(ctx, engagementId)` that merges:

| Done | Source | Gives | Existing function |
|---|---|---|---|
| ☐ | Checklist uploads (paths in `engagements.checklist_state[*].responses`) | milestone files per step/field, upload timestamp from the path | `collectVaultDocuments` / `extractItemResponses` / `uploadTimestampFromStoragePath` / `fileNameFromStoragePath` (`src/lib/vault-documents.ts`, `src/lib/milestone-document-storage.ts:123-142`) — move server-side; client release filter via `isStepReleasedTo` (`src/lib/checklist-visibility.ts:67`) like `listDocuments` does |
| ☐ | Indexed documents table | SBC-delivered files (COI, MoA, SH-1…), category, `stepId`, `contentType`, `sizeBytes`, `uploadedBy`, `sharedWithClient` | `listDocuments(ctx, engagementId)` (`src/db/repositories/documents.ts:130`) — client sees `shared_with_client = true` + released steps only |
| ☐ | Board resolution | final / signed BR file | `fetchBoardResolutionForApi` (`src/lib/api/board-resolution-access.ts`) / `GET /api/engagements/[id]/board-resolution` (client allowed) + `download` / `download-signed` routes (client allowed) |
| ☐ | Incorporation drafts shared with client | DOCX drafts | `filterClientVisibleIncorpDrafts` (`src/lib/incorporation-docs/share.ts`) as used in `incorporation-docs/download-all/route.ts` |
| ☐ | Open requests | dashed "missing" rows | `listDocumentRequests(ctx)` (`src/db/repositories/document-requests.ts:58`) filtered `status==='pending'` + engagement |
| ☐ | Step / phase structure | phase → step tree, step names | `getIncorporationPhases()` (`src/data/checklist.ts:1071`) + `CLIENT_PROGRESS_PHASE_TITLES` (`src/lib/client-progress-board.ts:21-26`: "Phase 1 — Name Application", "Phase 2 — Incorporation", "Phase 3 — Post-Incorporation", "Phase 4 — Registration") |

### 2.2 Documents — field-by-field mapping

| Done | UI datum (id) | Prototype value | Real source | Status |
|---|---|---|---|---|
| ☐ | Phase folder label (DT-06) | "Phase 2 — Incorporation" | `CLIENT_PROGRESS_PHASE_TITLES[phase.id]` | EXISTS (casing differs: board uses sentence case "Name application", "Post-incorporation"; pick the app's string or lower-case second word consistently) |
| ☐ | Phase count (DT-06) | 10 | count of non-replaced DocNodes under phase (incl. missing) | NEW (derived) |
| ☐ | Step folder label (DT-07) "N · Name" | "6 · Director KYC" | step number = 1-based position of the item in the client step order (`getIncorporationPhases()` flattened), name = `item.title` | PARTIAL (number helper: reuse whatever the Incorporation page uses to print "Step 7 of 14"; else NEW tiny helper in `src/lib/`) |
| ☐ | Per-step progress ok/rv/ms (DT-08) | 4 / 0 / 1 | ok = files with status Approved or Final; rv = In review; ms = Missing rows | NEW (derived in repo) |
| ☐ | Category folders (DT-09) | Identity & KYC, Office address, Company records, Certificates, Banking & capital | `documents.category` today holds `documents|images|reports|deliverables` or a field `section` / vault phase (`milestone-documents/route.ts:141`) — **not** these 5 | NEW: a `CLIENT_DOC_CATEGORY` map `fieldId/stepId → c1..c5` in `src/lib/` (static, like `vaultPhaseForItem`) |
| ☐ | Row name (DT-21) | "PAN card — Ravi Kumar" | field label (`getClientResponseFields(item)[].label`, repeat label via `repeatFieldLabel`) + person name for director repeats (`resolvePre6DisplayNameForPrefix`) ; indexed rows: a human title | PARTIAL (VaultDocument.fieldLabel exists; person suffix NEW) |
| ☐ | Type tile (DT-12) | PDF / JPG / DOCX | `contentType` (indexed) or extension of `fileName` (`resolveUploadExtension`, `src/lib/upload-limits.ts:125`) | EXISTS |
| ☐ | Status Approved (DT-14) | green | step slice `getReviewStatus(slice)==='accepted'` (`src/lib/checklist-item-review.ts:11-25`) or request `status==='approved'` | EXISTS |
| ☐ | Status In review | blue | `isAwaitingReview(slice)` / request `uploaded` | EXISTS |
| ☐ | Status Final | navy badge | SBC-delivered: indexed doc uploaded by staff & shared, or `isDeliveredToClient(slice)` (`src/lib/checklist-state-key.ts:187`), BR `status==='finalized'`/signed (`boardResolutionProgressFromDoc`, `client-progress-board.ts:33`) | EXISTS (rule to combine = NEW) |
| ☐ | Status Replaced (DT-11) | greyed, hidden by default | older uploads for the same field. Today only the **latest** path is kept in `checklist_state` (improve #7), but every upload is a new S3 object `{eng}/{fieldId}/{ts}-{name}` (`milestoneDocumentObjectPath`) | **NEW**: keep history — either a `document_versions` table (doc_id, object_key, replaced_at, replaced_by) or index every upload in `documents` with `replaced_by_id`; repo fn `listFieldVersions(ctx, engagementId, fieldId)`. Alternative: S3 `ListObjectsV2` on the prefix → **NEW** `listObjects(prefix)` in `src/storage/s3.ts` (only the repo may call it) |
| ☐ | Missing row (DT-13) | "Signed DIR-2 — Meera Shah", due 12 Nov | pending `document_requests` row (title) | EXISTS (title) |
| ☐ | Due date / Overdue | "Due 12 Nov" / "Overdue" | `DocRequest.dueAt` exists in the type and in `createDocumentRequest` input, **but `document_requests` has no due column** (`src/db/schema.ts:673-683`) — dropped on insert | **NEW**: migration `document_requests.due_at timestamptz`, `step_id text`, `field_id text`, `object_key text`, `file_name text`, `uploaded_at timestamptz`, `review_note text`; map in repo |
| ☐ | "Asked by Arjun Mehta" (DP-05) | requester name | `document_requests.requested_by` → profiles name | NEW join in `listDocumentRequests` (return `requestedByName`) |
| ☐ | "From" (DP-05) | "SBC · Arjun Mehta" / "Northwind" | indexed `documents.uploaded_by` → profile name + role (staff → "SBC · {name}", client → company name); milestone uploads by the client → company name | PARTIAL (uploaded_by exists for indexed rows; milestone path has no uploader → store `uploadedBy` in the response slice or index client uploads too) |
| ☐ | Date (DP-05) | "24 Oct 2026" | indexed `createdAt`; milestone `uploadTimestampFromStoragePath`; format `dd MMM yyyy` (`formatUploadDate` in Documents.tsx uses `en-IN` "24 Oct 2026") | EXISTS |
| ☐ | File (DP-05) | `COI-Northwind.pdf` | `fileName` / `fileNameFromStoragePath` | EXISTS |
| ☐ | Verify portal (DP-05) | MCA portal / Income-tax e-filing | map by document kind → portal (rule 15). Portal URL constants exist in `src/lib/announcement-portals.ts` (MCA, etc.) | NEW map `src/lib/document-portals.ts` (kind → {label,url}) |
| ☐ | Stale flag "Older than 2 months" (DT-15) | address-proof bill | needs the **bill date** (document date), not upload date. Fields: utility bill / bank statement / address proof | NEW: rule table `{fieldId → maxAgeDays: 60}` + use an entered "bill date" response if the step captures it, else upload date as fallback; flag computed in repo |
| ☐ | Board resolution row (DT-16) | Phase 1 › step "Signed Board Resolution" › "Board resolution (final)" Final + replaced draft | `fetchBoardResolutionForApi` → `storagePath` (draft docx) + `signedStoragePath` (signed) + `status` | EXISTS (merge into tree = NEW); delete `ClientBoardResolutionCard` usage on this page |
| ☐ | Toolbar counter "15/17" (D-07) | shown/total files | client-side from the tree | derived |
| ☐ | "Upload · 2 requested" (D-14) | open request count | pending requests for the engagement | EXISTS (`requests` in `useApp()` or the new endpoint) |
| ☐ | Arrange-by remembered (D-11) | By step | — | NEW: `localStorage['vcfo.docs.view']` (per-viewer convenience) or `ask-client-prefs`-style user pref repo (`src/db/repositories/ask-client-prefs.ts` exists as a pattern) |
| ☐ | Status / Replaced toggles | on / off | — | client state (optionally remembered) |
| ☐ | Open state of folders | default map | — | client state; default open all except collapsed long steps |
| ☐ | Selected file | f9 | — | client state; deep link `?doc=` (for "Copy link") NEW |

### 2.3 Documents — actions mapping

| Done | Action | Prototype | Real backend | Status |
|---|---|---|---|---|
| ☐ | Preview (pane page, eye, menu Preview, drill eye) | opens `v7x_doc_viewer` | signed URL **on click only** (improve #1): milestone → `GET /api/milestone-documents/signed-url?path=` ; indexed → `GET /api/documents/[id]/signed-url` ; BR → `GET /api/engagements/[id]/board-resolution/download(-signed)`; render PDF in `<iframe>`/`<object>` or pdf.js, images `<img>`, DOCX via `IncorporationDocxPreview` (`src/components/incorporation/IncorporationDocxPreview.tsx`, dep `docx-preview`) as `DocPackPreviewDialog` does | EXISTS (endpoints) / NEW (shared `DocumentViewer` component) |
| ☐ | Pane thumbnail (DP-03) | placeholder page | first page of PDF / the image / docx render, lazy | NEW (client render from signed URL) |
| ☐ | Download (icon, menu, viewer) | toast | same signed URLs with `Content-Disposition: attachment` (add `?download=1` → `signedDownloadUrl(key, ttl, {filename})`) | PARTIAL — `signedDownloadUrl(key, expiresIn)` (`src/storage/s3.ts:75-84`) has **no** `ResponseContentDisposition`; NEW optional `{ downloadName }` param → `GetObjectCommand({…, ResponseContentDisposition: 'attachment; filename="…"'})` |
| ☐ | Download folder as ZIP / Download all (ZIP) | 260 ms ticking toast | **NEW** route `GET /api/client/documents/zip?engagementId=&folder={phaseId|itemId|categoryId|all}` — streams a zip with **real step names as folders** ("Phase 2 — Incorporation/6 · Director KYC/PAN card — Ravi Kumar.pdf"); reuse `pizzip` like `src/lib/incorporation-docs/zip.ts`; read bytes via `getObjectBuffer` (`src/storage/s3.ts:63`) inside a repository-side helper; audit with `recordAuditEvent` (`doc_pack.download_zip` pattern in `app/api/engagements/[id]/doc-pack/zip/route.ts`). Progress: real toast can show indeterminate → done, or stream with `Content-Length`. Staff doc-pack zip is **staff-only** (`src/lib/api/doc-pack.ts:50`) — do not reuse for clients. | NEW |
| ☐ | Copy link / Copy link to folder | "Link copied" toast | `navigator.clipboard.writeText(origin + '/app/client/documents?doc=' + id)` / `?folder=` | NEW (URL param handling in page) |
| ☐ | Open step N | — | `router.push('/app/client/incorporation/step/{stepId}')` (route `app/app/client/incorporation/step/[stepId]/page.tsx` takes the checklist **item id**, not the display number) | EXISTS (route) |
| ☐ | Upload against a request (U-*, DP-04, M-11) | specimen | **NEW** `POST /api/requests/[id]/upload` (multipart) → validate (`validateMilestoneUploadFile`, `MILESTONE_DOCUMENT_EXTENSIONS`), `putObject(bucketKey(...))`, then `updateDocumentRequest(ctx,id,{status:'uploaded',fileName,uploadedAt})` + store `object_key` (new column) → fires existing `client_uploaded` email (`app/api/requests/[id]/route.ts`). When the request is tied to a checklist field, call the existing `POST /api/engagements/[id]/milestone-documents` (fieldId + file) instead, then PATCH the request. Today `uploadDoc` in `src/context/use-app-provider-value.ts:927-942` only records a file **name** — no bytes are stored. | NEW |
| ☐ | Undo after upload (U-04) | gold Undo | NEW `DELETE /api/requests/[id]/upload` within N s (soft: revert status to pending, delete object) | NEW |
| ☐ | Re-upload note (U-06) | "AM: Bill is older…" | `document_requests.detail` today mixes message + `file:`/`uploadedAt:` lines (`document-requests.ts:135-148`) — fragile | NEW `review_note` column (or reuse step `reviewStatus==='rejected'` + reviewer note) |
| ☐ | Take photo (M-11) | sheet item | `<input type="file" accept="image/*" capture="environment">` → same upload route | NEW (UI only) |
| ☐ | Accepted types caption (U-07) | "PDF · JPG · PNG · DOCX · up to 10 MB" | `MILESTONE_DOCUMENT_EXTENSIONS` + `maxUploadSizeLabel()` (`src/lib/upload-limits.ts:25,91`, default 50 MB) | EXISTS — print from config, don't hard-code 10 MB |
| ☐ | Upload error (U-05) | ".heic · this file type can't be opened" | route returns `validateMilestoneUploadFile` error | EXISTS |
| ☐ | Ask VCFO why / Ask VCFO about this | opens chat | `useAskOptional()` → `ask.setOpen(true)`; context `{kind:'document', ref, label}` exists in `ChatBody.context` (`src/hooks/ask/ask-api.ts:62-70`) | EXISTS |
| ☐ | Open incorporation (empty state, drill link) | — | `/app/client/incorporation` | EXISTS |

### 2.4 Shared document viewer (V-*) data

| Done | Datum | Source | Status |
|---|---|---|---|
| ☐ | File name, type tile | DocNode | from 2.2 |
| ☐ | (i) "From SBC · 24 Oct 2026 · Size [size]" | `uploadedBy` name, date, `sizeBytes` (`formatUploadFileSize`, `src/lib/upload-limits.ts:35`) — milestone uploads have no size → S3 `HeadObject` NEW or store size at upload | PARTIAL |
| ☐ | "1 of 4" + prev/next | the ordered list the viewer was opened from (tree order / drill tab) | client |
| ☐ | Page n / N, zoom | PDF renderer page count | NEW (pdf.js or browser viewer) |
| ☐ | Unsupported state | types other than pdf/jpg/png/docx | client |

### 2.5 Knowledge Bank shelf (L-*)

| Done | UI datum | Prototype | Real source | Status |
|---|---|---|---|---|
| ☐ | Books | 15 saved items | `fetchLibrary()` → `LibraryItemView[]` (`src/hooks/ask/ask-api.ts:119-145`) | EXISTS |
| ☐ | Book title | "FC-GPR after share allotment" | `item.title` | EXISTS |
| ☐ | Shelf / category | 5 shelves | `item.category` ∈ `incorporation · tax · foreign-investment · labour · compliance · your-project` (`src/lib/ask/categories.ts`); label via `categoryLabel` but **"your-project" must render as "{Company}’s project"** (company from `ask.engagementId` → engagement name) | EXISTS (+ label tweak) ; add **labour** shelf colour |
| ☐ | Category order | Incorporation, Foreign investment, Tax, Compliance, Northwind’s project | static order array in the view | NEW (const) |
| ☐ | Category pill counts | All 15 · … | count per category of loaded items | derived |
| ☐ | "{n} books" chip | 15 | `items.length` | derived |
| ☐ | Updated ribbon (L-14) | blue ribbon | `item.updated` (`isLibraryItemUpdated`, `src/lib/ask/library.ts`) — today rendered as an **amber** "Updated" chip in `ClientLibrary.tsx:119-121` → change to blue ribbon | EXISTS (restyle) |
| ☐ | Book glyph | per category | static per category | NEW (const) |
| ☐ | Search "Search books" | title includes | today searches `title + answer.line` (`ClientLibrary.tsx:34-38`) | EXISTS |
| ☐ | Monthly status brief | button | `StatusBriefButton` → `/api/ask/brief?engagementId=` | EXISTS |
| ☐ | PDF brief | button | `/api/ask/library/export?ids=` | EXISTS |
| ☐ | Recently read (L-08) + drill (LD-*) | 3 items, % read, "2 of 3 sections", "read on 8 Nov", In progress/Finished | — | **NEW**: table `client_library_reads (profile_id, item_id | topic_slug, progress_pct int, sections_read int, sections_total int, last_read_at, finished_at)`; repo `src/db/repositories/library-reads.ts` (`listRecentReads(ctx, limit)`, `recordReadProgress(ctx, …)`) scoped to `ctx.userId`; API `GET/POST /api/ask/library/reads`; reader reports scroll progress (IntersectionObserver per section) |
| ☐ | Suggested chips (LE-05) | 3 topic titles | `fetchSuggestions('client', engagementId)` → `GET /api/ask/suggestions` or published topics list (`src/lib/ask/topics.ts`) linking to `/app/client/learn/{slug}` | EXISTS |
| ☐ | Empty state | bot text | `items.length===0` | EXISTS |
| ☐ | Loading | skeleton books | `query.isLoading` | EXISTS (UI NEW) |
| ☐ | Error | error card + "Back to library" | `query.isError` | EXISTS (UI NEW) |

### 2.6 Reader (R-*)

| Done | UI datum | Prototype | Real source | Status |
|---|---|---|---|---|
| ☐ | Category chip | "Foreign investment" | `categoryLabel(item.category)` | EXISTS |
| ☐ | "Reviewed by SBC" | green chip | `TrustBadge` logic (`src/components/ask/TrustBadge.tsx`): topic answers with `reviewedBy` and not `draft` | EXISTS |
| ☐ | "Updated 6 Nov" (blue) | saved mode | `item.updated` + `notice` (`UPDATED_SINCE_SAVED`) ; date = topic `reviewedAt` (topic schema) | PARTIAL (date not in `LibraryItemView` → add `topicReviewedAt`) |
| ☐ | Title | H1 | `item.title` / `topic.title` | EXISTS |
| ☐ | Depth pill | Simpler · Normal · More detail | `AnswerDepth` `simple|normal|detail`; learn page re-fetches (`onDepth`); saved item: snapshot has only one depth → NEW: re-fetch topic at chosen depth when `topicSlug` present (call `fetchTopicAnswer`) ; for generated answers hide the pill | PARTIAL |
| ☐ | "3 min read" | read time | NEW derived: words(line + why + visual text) / 200 wpm, min 1 |
| ☐ | Official link · RBI FIRMS | hero pill | first `answer.citations[]` with `url` of a govt source, or NEW portal map per topic | PARTIAL |
| ☐ | Lead line | 17 px | `answer.line` | EXISTS |
| ☐ | Timeline visual | 3 nodes | `answer.visual` type `timeline` → `VisualRenderer` (`src/components/ask/visuals/`) — restyle to Focus-track nodes (done ✓ / current navy+gold pulse / next dashed) | EXISTS (restyle) |
| ☐ | Facts grid (More detail) | Who files / Late fee / Portal | `visual.type==='keyFacts'` (`{k,v}[]`) at detail depth | EXISTS (data shape) |
| ☐ | Why it matters to Northwind | gold box | `answer.why` (title must use company name) | EXISTS |
| ☐ | Sources chips | 2 | `answer.citations[]` | EXISTS |
| ☐ | Save / Saved / Remove | buttons | `saveToLibrary` / `deleteLibraryItem` — Remove needs **toast + Undo** (improve #11): soft delete → NEW `deleted_at` column on `client_library_items` + restore endpoint, or delay the DELETE 5 s client-side | NEW (undo) |
| ☐ | PDF brief | button | `/api/ask/library/[id]/export` (saved) | EXISTS (learn mode: NEW export by slug or hide) |
| ☐ | Ask a follow-up | button | `ask.setOpen(true); ask.showTopic(slug, depth, 'Tell me more about …')` | EXISTS |
| ☐ | In Northwind’s project (R-13) | FC-GPR filing 2 Dec, 24 days left, SBC files, Open in Compliances | topic slug ↔ compliance obligation (topics `obligation-*.json` exist; FC-GPR topic `fc-gpr.json`) → `getFilings(ctx, …)` (`src/db/repositories/filings.ts:65`) / `useComplianceFilings` (`src/hooks/use-compliance-filings.ts:10`) filtered by obligation | NEW mapping topic→obligation id (static) + reuse filings |
| ☐ | Related in library (R-14) | 2 rows | `topic.related[]` (max 3 slugs, `src/data/ask/schema.ts` topicSchema) → saved item if exists else `/learn/{slug}` | EXISTS (data) |
| ☐ | Documents for this (R-15) | FIRC from the bank · Approved | `topic.stepIds[]` → DocNodes in those steps (new tree endpoint, filter by `stepId`) → opens shared viewer | NEW (join) |
| ☐ | Trail leaf | title | page | EXISTS |

### 2.7 Shell & shared

| Done | Item | Real source | Status |
|---|---|---|---|
| ☐ | Sidebar badge "Documents 6" | open requests + new files? (prototype hard-codes "6") — define as pending requests count | NEW (definition) |
| ☐ | Notifications badge | existing notifications repo | EXISTS |
| ☐ | Bot avatar | existing launcher/assets (`src/components/ask/AskLauncher.tsx`) | EXISTS |
| ☐ | Theme | existing `ThemeToggle` | EXISTS |

### 2.8 Access-control notes for new pieces (Path A)

* All new document reads for clients: `assertEngagementAccess(ctx, engagementId)` + `shared_with_client` + `isStepReleasedTo('client', slice)` exactly as `listDocuments` (`documents.ts:96-118`) and `milestone-documents/signed-url/route.ts:52-66`.
* ZIP route must apply the same filters per entry (never zip an unreleased step's file).
* Request upload: client may only upload to **its own engagement's pending requests**; flip status only to `uploaded` (`updateDocumentRequest` already enforces, `document-requests.ts:131-133`).
* Library reads: private to `ctx.userId` like `client_library_items`.
* Cross-tenant tests for: `listClientDocumentTree`, zip builder, request upload, library reads.

### 2.9 improve.dc.html — problem → fix list the redesign answers (verbatim summary)

| Done | # | Problem today | Fix (in FINAL) |
|---|---|---|---|
| ☐ | 1 | Each row fetches its own signed link on load; new tab; "(link unavailable)" | fetch only on 👁/⬇, open shared in-app viewer |
| ☐ | 2 | No search/filter/sort | filter, source filter, group switch |
| ☐ | 3 | "Still needed" has no upload | drop zone per request |
| ☐ | 4 | Raw dates / raw status words | one date format; In review / Approved / Re-upload |
| ☐ | 5 | Requests and files in two lists | one list; requests become rows/badges on their step |
| ☐ | 6 | No engagement → blank | friendly empty state |
| ☐ | 7 | Only latest file; no reason for re-upload | keep versions; Replaced greyed (h toggle); SBC note |
| ☐ | 8 | No bulk download | Download ZIP / Download all |
| ☐ | 9 | No stale-proof sign | amber "older than" chip |
| ☐ | 10 | Library cards are text | book covers by category |
| ☐ | 11 | Remove deletes at once | toast with Undo |
| ☐ | 12 | Learn topic "Loading…" forever without engagement | show topic without project facts / clear message |
| ☐ | 13 | "Loading…" text, dead-end errors | skeleton books; error card "Back to library" |
| ☐ | 14 | "Updated" chip amber | blue ribbon |
| ☐ | 15 | No recently read / suggestions | Recently read strip; suggested topics |
| ☐ | 16 | Topic never links to filings/docs | reader side panel "In {Company}’s project" + "Documents for this" |

Source: `final-src/s/docs/improve.dc.html:22-45`.

---

## 3. LAYOUT & CSS — verbatim excerpts per board and breakpoint

Everything below is copied byte-for-byte from the FINAL sources (only the fences are added).
Template syntax: `{{x}}` = value from the board's `renderVals()`; `<sc-for list as>` = map; `<sc-if value>` = conditional;
`<dc-import name="v7c_bot" …>` = the bot avatar component; `<dc-import name="side|topbar">` = shell placeholders.
`light-dark(a, b)` = light value, dark value. Fonts: **Manrope** (UI), **IBM Plex Mono** (`.mono`, counts, dates, file names, type tiles),
**Space Grotesk** (preview titles / metrics), **Source Serif 4** (phone preview paper only).
<!-- /area:documents -->

<!-- area:team -->
## Team, Announcements, Notifications, Audit, Settings

Full catalogue (verbatim CSS, markup, logic): `inventory/team.md`.

### 1. INVENTORY

Columns: **id | item | exact behaviour | file:line**. Colours are CSS tokens from CSS:3-16 (light) and PJ:36-60 (dark, "True black").

#### 1.0 Shared chrome (all five pages)

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | SH-01 | Page frame | `.tb-root` flex row, min-height 100vh, bg `--bg`, Manrope 13 px, `--fg`. Left: sidebar placeholder `.tb-side` width `var(--vp-side-w)` (248 desktop / 72 tablet / 0 phone), bg `#0f2a4a`. Right: `.tb-main` flex 1. Content `<main class="pg tb-wrap">`: width 100%, **max-width 1600 px, centred**, padding `clamp(16px,2vw,24px)` sides/top and **96 px bottom** (phone: `16px 16px 104px`), flex column, gap 16. | TR:15-22, CSS:121, TR:38-40 |
| ☑ | SH-02 | Breakpoints | phone ≤ 767 px · tablet 768-1279 px (72 px icon rail) · desktop ≥ 1280 px. shell.js sets `<html data-vp-bp>` and `--vp-side-w` and fires `vcfo:bp`. Extra page breakpoints: 959 (grids stack, top-bar search becomes an icon), 520 (notification kind chip), 700/760 (proto bar, `.pg` padding). | TR:14-17, SJ:28-37, TB:31-46 |
| ☑ | SH-03 | Top bar | `<header class="tbar">` 52 px, sticky (pinned by `pinNav`, z 40), bottom border, bg white/90 % (dark 13 %/90 %) with `backdrop-filter:saturate(1.4) blur(10px)`. Left: SBC logo (26 px high, tooltip "SBC home" below — suppressed G13) → Home. Location trail: 24 px icon tile (primary-light) + `Home / [mid /] crumb`; current item 600 weight, ellipsis. Right group gap 6: Search button (256 px; 196 px ≤1279; 36 px icon only ≤959; 40 px borderless icon on phone) with "Search" + ⌘ K kbd; Announcements icon button 36 px; Notifications icon button 36 px with count badge; Theme button (bordered, hidden on phone). | TB:15-69 |
| ☑ | SH-04 | Top bar per page | Team: crumb "Team". Announcements: mid "Updates", crumb "Announcements", Announcements button active (bg `--primary-light`, colour `--primary`) and its gold dot hidden. Notifications: mid "Updates", crumb "Notifications", Notifications button active, badge = live unread count. Audit: crumb "Audit". Settings: crumb "Settings". | TR:66, AR:67, NR:82, UR:86, SR:85, TB:76-85 |
| ☑ | SH-05 | Announcements button | 36×36, radius 8, no border; megaphone (duo fill .26). **Gold 8 px dot** top 6 right 6 with 2 px panel ring when there are unread announcements and the page is not Announcements. Click → `/app/client/announcements`. | TB:64, PJ:231 |
| ☑ | SH-06 | Notifications button | 36×36 bell (duo). Badge `.tbar-badge`: absolute top 3 right 3, min-width 16, height 16, radius 99, bg `--primary-fill`, white 700 11 px, ring 2 px panel. Hidden when count 0. Click → `/app/client/notifications`. | TB:30, TB:65 |
| ☑ | SH-07 | Theme button | Sun icon 16 px, 36×36, 1 px border, bg panel, muted. Label/tooltip "Switch to dark theme" / "Switch to light theme" (kept in sync, `aria-pressed`). Click toggles light ↔ dark; stored (`vcfo.theme`). Hidden on phone (theme lives in Settings › Appearance and the drawer). | TB:66, PJ:7-35 |
| ☑ | SH-08 | Phone menu button | Phone only: 40×40 hamburger at the far left (`data-vp-menu`), logo + trail icon + "Home /" hidden, crumb 15 px 700. Click opens the shell drawer. | TB:37-46, TB:51, TB:85 |
| ☑ | SH-09 | Before / After pill | Shell inserts a 168×32 two-segment pill (navy thumb, `.42s cubic-bezier(.22,1.2,.36,1)`) in the desktop top bar before Announcements; inside the rail on tablet; at the top of the drawer on phone. Switching on these pages only toasts "Showing the company after/before incorporation". | SJ:12-13, SJ:215-225, SJ:540-546, PJ:213-218 |
| ☑ | SH-10 | Sidebar (production = shell.js) | Navy sidebar replaces the board placeholder. Items: Home · **Updates ▸** (Announcements, Notifications badge "3" hot) · Incorporation (badge 6/14, 14/14 after COI) · **Compliances ▸** (Calendar, Filings) · Documents (badge 6) · Library · Credentials · Team · Audit · Settings. Then "Northwind’s team" (Priya Raman · Project Manager, Arjun Mehta · Project Lead, Customer support · SBC help desk) with WhatsApp/Call/Email/Teams hover actions; account row (RK, "Rahul Khanna", "Northwind · Client") with a Sign out icon button (tooltip "Sign out"); account menu items Settings / Help · Ask VCFO / Sign out. Tablet: 72 px icon rail with tooltips and fly-outs. Phone: drawer. Active item: navy glass pill + 3 px rail, spring .42 s. | SJ:91-110, SJ:275-306 |
| ☑ | SH-11 | Sidebar (board placeholder) | Board version for reference: Home, Updates (red count chip), Incorporation 7/14, Compliances, Documents 6, Library, Team, Audit; team block with 40 px avatars and 32×30 contact buttons; account row (active on Settings, `active=8` hides the pill). Active pill moves `translateY(index*38px)`. | SD:16-99 |
| ☑ | SH-12 | Ask VCFO launcher | One global launcher fixed bottom-right (`#vp-launch`): character gripping the bottom edge (20.5 s loop) + navy pill "Ask VCFO" (36 px, 40 px phone) with teal dot. Character ducks while scrolling, while chat is open or when over a control. Board launchers (LA, `.tb-launch` at top 870) are hidden at runtime. Chat opens above the pill (desktop) / bottom sheet (phone). | PJ:314-480, PJ:622-633, LA:16-19 |
| ☑ | SH-13 | "Ask VCFO why" / "Ask VCFO about this" | Any link with that text opens the chat; "…about this" pre-asks "Tell me about <nearest heading>". | PJ:233, PJ:249-255 |
| ☑ | SH-14 | Icon tooltips (CSS) | `[data-tip]` hover/focus-visible: navy bubble above (`bottom:calc(100% + 9px)`), white 700 11.5/1.25 px, padding 5×9, radius 6, nowrap, z 70, shadow, 8 px rotated-square arrow; `tipin .12s`. `[data-tip-below]` puts it under. Reduced motion: no animation. | CSS:165-173 |
| ☑ | SH-15 | Icon tooltips (JS) | Icon-only `a/button` with `aria-label` and no `data-tip` (and not "obvious", G13) get `#vp-tip` (navy, 12 px 700, 5×9, radius 6) after **120 ms**, placed 32 px above (or 6 px below near the top), clamped 8 px from the edges; hides on pointerdown/scroll. | PJ:295-311, PJ:133-134 |
| ☑ | SH-16 | Toast (global) | `#vp-toast`: fixed, centred, bottom 64 px (100 px under 700 px wide), navy, white 600 13 px, radius 8, padding 10 12 10 14, max-width min(560, 100vw − 32). Optional "Undo" button (gold `#e6c46e` text on white/14 %). In: opacity .18 s + translate .22 s `cubic-bezier(.22,1,.36,1)`. Auto-hide after **3200 ms**. Undo → callback then toast "Undone". | PJ:130-132, PJ:159-167 |
| ☑ | SH-17 | Toast (page) | `.toast.tb-toast` (Notifications, Settings): fixed, bottom 24 px, centred on the main column (`left:calc(50% + var(--vp-side-w)/2)`), navy, gap 12, z 61; link "Undo" in `oklch(86% 0.09 85)`. Phone: centred on the screen, bottom 96 px. | CSS:152-153, TR:36, TR:46 |
| ☑ | SH-18 | Fallback feedback | In the prototype any control without its own behaviour toasts after 380 ms: download → "Download started · …"; copy → "Link copied"; WhatsApp/Call/Email/Teams → "Opening …"; portal/↗ → "Opens the official portal in a new tab"; approve/submit/send/save/mark/confirm/request/remind/resend/cancel invite/hand off/turn on/turn off → "<label> · done" **with Undo**; search → "Search · type to find…"; external `https:` links → "Opens … in the full app". Use these as the intended success messages. | PJ:237-247, PJ:257-292 |
| ☑ | SH-19 | Page transitions | Enter: `body` `vpIn .26s cubic-bezier(.22,1,.36,1)` (opacity 0 → 1, translateY 6 → 0). Leave: opacity .35 over .14 s, then navigate after 140 ms. Team main also staggers children (`.stag>*` `v7fade .2s`). Cards: `up .5s cubic-bezier(.2,.7,.2,1) backwards`. | PJ:110-118, PJ:135-137, CSS:20, CSS:93-95 |
| ☑ | SH-20 | Card hover | `.card:hover` translateY(-2 px), border `oklch(54.6% 0.215 263 / .35)`, layered shadow, `.16s cubic-bezier(.22,1,.36,1)`. `.card.t` = 38×3 gold tab at top-left (left 18). | CSS:20-22, CSS:80-82 |
| ☑ | SH-21 | Sliding pill (`.seg`) | Track: padding 2, radius 8, `light-dark(oklch(96.5% .008 250), oklch(18.3% .008 250))`, inset 1 px border. Thumb: absolute top/bottom/left 2, radius 5, **navy** (dark: `--navy-3`), `transition: transform .42s linear(…spring…)`; width `calc((100% - 4px)/N)`, moved by `translateX(index*100%)`. Buttons 28 px (40 px phone), padding 0 10, radius 5, 500 12 px, colour `oklch(55% .022 255)` → hover darker; active white. Counts `.cnt` IBM Plex Mono 11 px (`html .seg .cnt`), active `oklch(100% 0 0 / .72)`. On phones wrapped in `.tb-segx` (horizontal scroll, no scrollbar). | CSS:61-79, TR:24-26, TR:30, TR:51 |
| ☑ | SH-22 | Toggle (`.tgl`) | 38×22, radius 6, off bg `light-dark(oklch(86% .012 255), oklch(34.2% .012 255))`, on bg navy; knob 16×16 radius 4 at 3/3, on = translateX(16 px), spring .42 s; bg .2 s; disabled opacity .45 + not-allowed. Phone: invisible hit area extended 9 px above/below. Dark: knob stays light. | CSS:136-139, TR:52-53, PJ:51 |
| ☑ | SH-23 | (i) pop-over (`.info`) | 18×18 button, colour `oklch(62% .02 255)` → navy on hover/focus. Pop: absolute under the icon (+8 px), 200-280 px wide, padding 10×12, radius 8, panel, 1 px border, shadow, 500 12/1.45 px, arrow; fades/slides in .15 s on `:focus-within` (click focuses the button). Ends with "🤖 Ask VCFO about this" row (border-top, primary 700). Phone: 40×40 hit area. | CSS:108-116, TR:54 |
| ☑ | SH-24 | Bot speech bubble (rule 16) | Flex row aligned to the bottom, centred, gap 10: bot avatar (`v7c_bot`, 48-52 px, state idle / answered) + bubble `role=status` max-width 300, panel, 1 px border, radius **10 10 10 3**, padding 10×12, shadow; first line `.rt` 700; optional `.cap`; actions row (gap 10, margin-top 8): `btn btn-o btn-sm` + text link 12 px "Ask VCFO why". | TR:101-107, AR:84-91, NR:91-97, UR:111-117 |
| ☑ | SH-25 | Dialog anatomy | Scrim `.ov` `oklch(21% 0.042 264 / .42)`, flex centre. `.dlg` 460 px default (custom widths below), radius 12, big shadow, overflow hidden. `.dlg-h` flex gap 10 padding 16×18 bottom hairline; `.dlg-b` padding 16×18 column gap 12; `.dlg-f` right-aligned gap 8 padding 12×18, top hairline, bg `--raised`. Live dialogs use `.tb-ov` (fixed, inset 0, z 60, padding 12, scrollable; `.tb-top` aligns to top at `min(120px,12vh)` on desktop, centred on phone); `.dlg` max-width `100vw − 24`, max-height `100dvh − top − 12`. Close = borderless `.ibtn` with ✕ 16 px. | CSS:145-149, TR:33-35, TR:45 |
| ☑ | SH-26 | Buttons | `.btn` 36 px, padding 0 14, radius 6, 600 13 px, press scale .98 (.12 s). `.btn-n` navy → `--navy-2` hover; `.btn-o` panel + border; `.btn-g` transparent → raised hover; `.btn-sm` 30 px, 0 10, 12 px; `.ibtn` 32×30, radius 6, 1 px border, muted → navy-ink + tinted border on hover; `.wa` green fill. Phone: `.btn`/`.btn-sm` 40 px, `.ibtn` 40×40. Focus ring 2 px `oklch(54.6% .215 263 / .4)` offset 2. | CSS:34-37, CSS:83-87, CSS:129-135, TR:49-50 |
| ☑ | SH-27 | No text under 11 px | `.lbl` 11 px, `.seg .cnt` and `.kbd` 11 px, `.dtile .m` 11 px letter-spacing .06em on these pages. | TR:28-31 |
| ☑ | SH-28 | No visible scrollbars | `scrollbar-width:none` everywhere; scrolling still works. | PJ:140-141 |
| ☑ | SH-29 | Reduced motion | All animations and transitions off (`*{animation:none;transition:none}`), card hover lift off, stagger off, tooltips instant, launcher static. | CSS:67, CSS:105, CSS:116, CSS:162, CSS:173, PJ:151 |
| ☑ | SH-30 | Dark theme | Tokens replaced by the "True black" set (bg #000, panel 13 %, navy → `oklch(46% .15 258)`, navy-ink near white…). Sidebar and `.tb-side` go black. Seg thumb uses `--navy-3`. | PJ:36-60 |

#### 1.1 Team — `/app/client/team`

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | TM-01 | Page head | No H1 (the crumb is the title, rule 7). `.ph` row holds only the right-aligned actions. | TR:68-70, CSS:122-124 |
| ☑ | TM-02 | **Invite** button | `btn btn-n` (navy, 36 px; 40 px phone) with user-plus icon 15 px + "Invite". Tooltip "Only the Primary contact can invite". Click → opens Invite pop-up (TM-14). Primary contact only (G6). | TR:69 |
| ☑ | TM-03 | SBC team cards grid | `.tb-cards` grid `repeat(auto-fit,minmax(min(100%,250px),1fr))`, gap 16 → 3 across on desktop, 2 or 1 as width shrinks. One card per SBC person: Project Manager, Project Lead(s), then Customer support. Stagger-in (`.stag`). | TR:56, TR:72-91, TR:133-137 |
| ☑ | TM-04 | SBC card | `article.card.t` padding 18, gap 14, gold top tab. Row: avatar 60×60 circle (initials, 700 18 px Space Grotesk, white) with ring `0 0 0 3px var(--panel), 0 0 0 5px <ring>` (gold for SBC staff, `--border` for support); `aria`/title "Photo placeholder" (real photo when available). Text: role chip (Project Manager / Project Lead: navy + white; Customer support: `--prog-light`/`--prog-text`); name 700 16 px navy-ink, margin-top 6; line mono 11 px muted, margin-top 2, `overflow-wrap:anywhere` (email; support: "support@sbc.in · +91 90597 90014"). | TR:74-82, TR:134-136 | ☑ photo from shell `avatarUrl`, initials otherwise
| ☑ | TM-05 | SBC contact buttons | Grid of 4 equal columns, gap 8. Each `a.btn` height 38 (40 phone), padding 0, icon 17 px stroke 1.8: **WhatsApp** (`.wa` green fill, white), **Call** (`.btn-o`, navy-ink), **Email** (`.btn-o`, navy-ink), **Teams** (`.btn-o`, `light-dark(oklch(48% .14 280), oklch(80.8% .098 280))`). `aria-label` "WhatsApp {name}" / "Call {name}" / "Email {name}" / "Teams {name}"; tooltips suppressed (G13). Click: WhatsApp → `https://wa.me/<digits>`; Call → `tel:`; Email → `mailto:`; Teams → `https://teams.microsoft.com/l/chat/0/0?users=<email>` (all new tab except tel/mailto). Prototype toast "Opening WhatsApp Priya Raman…". | TR:83-88, PJ:242 |
| ☑ | TM-06 | People card | `section.card` (no gold tab). Header `.tb-ph` (flex, gap 10, padding 14×16, wraps): violet `.ic` 30 px with users icon 15 px; `h2.h3` "People from Northwind" (13 px 700 navy-ink); pill pushed right. | TR:93-98, TR:58-59 |
| ☑ | TM-07 | People filter pill | 4 tabs (`role=tablist`, `role=tab`): **All 4 · Primary 1 · Members 2 · Invited 1** (count = rows matching). Thumb `calc((100% - 4px)/4)`. Phone: pill takes a full-width row (`flex:1 1 100%`). Already-active tab click → proto toast "Already showing …". | TR:97, TR:144-147, TR:60, PJ:282 |
| ☑ | TM-08 | People rows | List under a hairline. `.row` (flex, gap 12, padding 12×16, top hairline). Avatar 36 px initials 12 px (colour per person; pending invite = `--up` bg + `--fg` text). Name `.rt`. Current user: extra gold-soft/gold-text chip "Northwind" (G7). Email mono 11 px muted, one line, ellipsis. **Desktop**: role chip (Primary = navy/white · Member = raised/muted · Invite sent = due-light/due-text) + date column 110 px right-aligned mono 11.5 px muted ("Since 2 Sep", "Sent 6 Oct"). **Phone**: role chip moves next to the name, date moves under the email (mono 11 px). Actions column min-width 76, right-aligned, gap 6. | TR:109-120, TR:139-150 |
| ☑ | TM-09 | Pending invite actions | Rows with status "Invite sent": two `.ibtn`: **Resend** (circular-arrows icon; label + tooltip "Resend invite to {email}") and **Cancel invite** (✕; tooltip "Cancel invite"). Resend → new link email, toast "Invite sent again · Undo"-style (proto "Resend invite to … · done" + Undo). Cancel → removes the row with toast + Undo (proto "Cancel invite · done" + Undo). | TR:116, PJ:244 |
| ☑ | TM-10 | Substitute / hand off | Member and Primary rows: one `.ibtn` swap-arrows icon, label + tooltip "Substitute {name}". Own row → Hand-off pop-up (TM-15). Other row → substitute dialog (G8). | TR:117 |
| ☑ | TM-11 | Empty filter state | When a tab has no rows: bot (idle, 48) + bubble, padding 32×16. Text "No pending invites." (Invited tab) or "No one here yet."; buttons **Invite** (`btn-o btn-sm`, same action as TM-02) and link "Ask VCFO why" (opens chat). | TR:100-108, TR:151 |
| ☑ | TM-12 | Loading state (not drawn) | Boards draw no loader. Rule 12 + Incorporation decision: skeleton shown after 150 ms, held ≥ 300 ms. Use `.sk` shimmer (1.2 s linear) in the card/row shapes. | CSS:150-151, DECISIONS "Loading" |
| ☑ | TM-13 | Card motion | Cards rise in (`up .5s`), stagger `.2s` steps; hover lift (SH-20). | CSS:20, CSS:95 |
| ◐ | TM-14 | **Invite pop-up** | Dialog 460 px. Header: navy `.ic` user-plus + `h2` "Invite a colleague" (700 16 px navy-ink, `id=inv-t`, `aria-labelledby`) + Close. Body: 2-column grid gap 12: **Name** input, **Work email** input (`type=email`) (labels `.fl` 12 px 700). **Sign-in** block: label "Sign-in", bordered box (radius 8, padding 10×12) with navy link icon, "Set-password link by email" (`.rt`) + cap "Expires in 7 days", and `.ibtn` "Copy the link" (copy icon, tooltip). Role strip (bg raised, radius 8, padding 10×12): chip "Member" (raised/muted + inset border) + "Sees everything on Northwind. Cannot invite." (600 12 px). Footer: **Cancel** (`btn-g`) + **Send invite** (`btn-n`, paper-plane icon). Behaviour: validate email; Send → pending row appears under Invited (count +1), dialog closes, toast "Invite sent to {email}" + Undo (= cancel invite). Copy → copies the link, toast "Link copied" (only after the invite exists; before Send it should be disabled or create the invite first). Esc / scrim / ✕ / Cancel close. Until the set-password link ships, the box shows the temporary password instead (DECISIONS). | TI:17-46 | ◐ temporary password instead of set-password link (DECISIONS interim) — NEW client_invites + /api/client/team
| ◐ | TM-15 | **Hand-off pop-up** | Dialog **500 px**. Header: `.ic` red (`--over-chip`) swap icon + "Hand off your seat" + Close. Body: (1) 3-column grid `1fr 28px 1fr` gap 10: **from** card (1 px border, radius 8, padding 10; avatar 34 px "RK" primary-fill; "Rahul Khanna" / cap "Primary · Northwind") → arrow 24 px in `--over` → **to** card (1.5 px **dashed** `--navy-3`, bg `--primary-light`; avatar 34 px navy initials from the typed name; name / cap "New Primary"). (2) Warning strip: bg `--over-light`, text `--over-text`, 700 12.5 px, radius 8, triangle icon: "You lose access to Northwind right after this." (3) Name + Work email (2 columns). (4) "Sign-in for {first name}" + set-password link box + Copy. (5) Checkbox 16 px, `accent-color:navy`: "I understand I will be signed out". Footer: Cancel (`btn-g`) + **Hand off & leave** (bg `--over-chip`, white). Behaviour: the "to" card mirrors the typed name live; submit enabled only when email valid and box ticked; on success the server replaces the user, emails both, and the client is signed out (toast "Handed off to {name}"). | TH:17-52 | ◐ temporary password instead of set-password link; via existing substitute route
| ☑ | TM-16 | Kept from current page | Current page: client list + inline invite form (Name optional, Email, Temporary password, "Add client to project") + per-row "⇄ Substitute" dialog (Replacement name/email/temporary password; "Hand off & leave" when replacing yourself). Redesign keeps invite + substitute, moves invite to a pop-up, adds SBC people, pending state, set-password link. | `team_current.dc.html`, `src/views/client/ClientTeam.tsx:181-363` |

#### 1.2 Announcements — `/app/client/announcements`

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | AN-01 | Top bar | Home / Updates / **Announcements**; Announcements icon active, gold dot hidden. Sidebar: Updates ▸ Announcements. | AR:65-67, TB:81-83 |
| ☑ | AN-02 | Next-deadline banner | `section.tb-focus`: flex, centre, gap 16, padding 14×18, radius 10, bg `--due-light`, border 1 px `oklch(66% 0.17 48 / .35)`. Date tile `.dtile` 50×54 bg `--due-chip` white: "20" (700 18 px Space Grotesk) / "OCT" (11 px uppercase). Text: `.lbl` in `--due-text` "Next deadline · in 12 days"; title 700 16 px `--fg` "GSTR-3B for September" (margin-top 3). Right: `a.btn.btn-o.btn-sm` **Open** → that filing (`/app/client/compliances/filings` with the item open). Hidden in the empty variant and when there is no upcoming deadline (G10). Phone: wraps, padding 12×14, Open pushed to the right edge. | AR:69-75, AR:61 |
| ☑ | AN-03 | Layout grid | `.tb-g12` 12 columns, gap 16, align start. Latest card `span 8`; Official portals card `span 4`. ≤959 px both full width (portals below). | AR:56-60, AR:77 |
| ☑ | AN-04 | Latest card header | `.tb-hd` (flex, gap 10, padding 12×16, bottom hairline, wraps): `h2.h3` "Latest" + pill pushed right (`aria-label="Filter announcements"`): **All 6 · Important 2 · General 4**. Phone: pill takes a full row. | AR:79-82, AR:58-59, TR:47 |
| ☑ | AN-05 | Filter rules | Important = kind Deadline or Compliance. General = all others (G9). Counts from the loaded list. | AR:150-153 |
| ☑ | AN-06 | Announcement row | Whole row is a link `a.row` (inherit colour/weight, no underline). Date tile 50×54: Deadline → bg `--due-light` text `--due-text`; others → bg `--primary-light`, text navy-ink. Middle: line 1 (flex wrap, gap 4×8): kind chip (Deadline `--due-chip`/white; Compliance `--prog-chip`/white; MCA/Tax/GST/Post-Incorp/others neutral: raised bg, navy-ink text, inset 1 px border), caption "From Priya Raman" or "Official feed", and on phone the source host chip; line 2 title `.rt` **14 px**, weight **800 if unread, 600 if read**, margin-top 4. Right (desktop): source host chip ("mca.gov.in", raised/muted + inset border). Far right: unread dot `.udot` 8 px `--primary-fill` (`role=img`, label + tooltip "Unread"). Unread row bg `light-dark(oklch(97.6% .014 260), oklch(16.6% .01 260))`. | AR:93-103, AR:155-161, CSS:140-144 |
| ☑ | AN-07 | Row click | Prevent default, mark read (dot disappears, title to 600, tint removed, topbar gold dot updates), open Detail pop-up (AN-10) at that item. | AR:94, AR:160 |
| ☑ | AN-08 | Empty filter state | Bot idle 52 + bubble, padding 56×16×64: "No important updates right now." + cap "Deadlines will show up here first." + **See all** (`btn-o btn-sm`, switches pill to All) + "Ask VCFO why". Shown when the active filter has no rows (AE: Important with no deadline/compliance items; banner hidden). | AR:83-92, AR:139, AR:166-167, AE |
| ☑ | AN-09 | Official portals card | `section.card.t` span 4. Header (padding 14×16): navy `.ic` with bank icon + `h2.h3` "Official portals". Pill full width (2 columns) **Setup 8 · Recurring 4**. Groups (padding 0 16 14, gap 12): `.lbl` heading (Incorporation / Registrations / FEMA; Monthly / Quarterly) then rows: flex gap 8, padding 6 0, top hairline: name `.rt` flex 1; `.ibtn` **↗** (14 px arrow; label + tooltip "Open portal for {name}"; opens the official site in a new tab); `.ibtn` **circular** (document icon; "Read circular for {name}"; opens the circular in a new tab). | AR:106-126, AR:162-169 |
| ☑ | AN-10 | **Detail pop-up** | Scrim aligned to the top (padding-top 140 px on the board; live: `.tb-ov.tb-top`). Dialog **560 px**. Header (align start): date tile (Deadline colours) + chips row ("Deadline" `--due-chip` white **min-width 116 px centred**; "Important" raised/muted) + `h2` 700 **18/1.3 px Space Grotesk** navy-ink, margin-top 6 + Close. Body 13.5/1.6 px: message paragraph; author strip (raised, radius 8, padding 10×12): avatar 30 px "PR", "Priya Raman" + cap "Project Manager · 8 Oct, 09:05", `.ibtn.wa` "WhatsApp Priya Raman", `.ibtn` "Email Priya Raman"; link "🤖 Ask VCFO about this" (bot 18 px, 12.5 px). Footer `space-between`: ‹ Previous / › Next `.ibtn` (tooltips "Previous announcement" / "Next announcement") + mono cap "1 / 6"; **Got it** (`btn-n`) closes. Prev/Next walk the current filtered list and mark each shown item read. For feed items: show source host + "Open on mca.gov.in ↗" instead of the author strip. | AD:17-41 |
| ☑ | AN-11 | Kept from current page | Kind chips, "From …" attribution, live board updates (4 s head poll), firm-wide feed items, portal + circular links per task. Staff-only (not on client): compose, remove, RSS feed management. Current portals list (collapsible groups, "Portal ↗ Circular ↗" text links) becomes the compact card. | `ann_current.dc.html`, `src/views/announcements/AnnouncementsPage.tsx:242-432` |

#### 1.3 Notifications — `/app/client/notifications`

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | NT-01 | Top bar + sidebar | Home / Updates / **Notifications**; Notifications icon active; badge = unread count (3). Sidebar Updates chip = unread count (red, `--over-chip`). Both update live when items are read. | NR:80-82, NR:269 |
| ☑ | NT-02 | Layout grid | `.tb-g12`: list card `span 9`; side column `span 3` (flex column, gap 16). ≤959: list full width; side column becomes `repeat(auto-fit,minmax(min(100%,240px),1fr))` grid under it. | NR:56-58, NR:85 |
| ☑ | NT-03 | Filter pill | Card header `.tb-hd` (no title): pill 6 tabs, `aria-label="Filter notifications"`, `aria-selected`: **All 11 · Unread 3 · Documents 2 · Steps 4 · Deadlines 1 · Messages 4**. Thumb `(100%-4px)/6`. Phone: horizontal scroll inside `.tb-segx`. (Add "Mark all read" at right, G1.) | NR:87-89, NR:234-235 |
| ☑ | NT-04 | Groups | Day groups: **Today · Earlier this week · Earlier** (`.lbl` navy-ink, padding 12 16 6). Empty groups hidden. | NR:99-101, NR:238-243 |
| ◐ | NT-05 | Row | `.row` (unread → tinted, `.row.unread`). (1) Icon tile `.nic` 32×32 radius 8, bg = type tint, glyph 18 px stroke 2 in the type colour, `role=img` + `aria-label` = type tooltip. (2) Text column: title link `a.rt.nt` (800 if unread / 600; hover `--primary` + underline offset 2) → item page; body line `.nb` (12 px muted, one line, ellipsis) made of parts joined by " · ", link parts `--primary` 600 (hover underline), external links open a new tab; phone: "who · time" line (mono 11 px) under the body. (3) Kind chip column `.nkind` **104 px** fixed (so chips align; ≤520 px: auto width, right-aligned). (4) Desktop "who · time" column `.tb-d` **168 px** right-aligned mono 11 px muted nowrap; who = link to Team for SBC people / colleagues (`.nwho` muted 500 → primary + underline on hover), plain text for "VCFO Suite"/"SBC". (5) Unread: `button.udot.pulse` 8 px (pulse 1.8 s gold ring), label "Unread · mark as read", click → marks read; read rows get an 8 px spacer. (6) `.ibtn` → arrow 15 px, label "Open {title}" → item page. | NR:103-115, NR:59-77, CSS:118 | ◐ no "who" (notifications have no actor column)
| ☑ | NT-06 | Types (icon, chip, tooltip) | `doc` file-text · chip "Request" due-light/due-text · "Document request". `back` file-text · "Sent back" over-light/over-text · "Document sent back · fix needed". `step` circle-check · "Step" ok-light/ok-text · "Step done". `time` circle-check · "Timeline" prog-light/prog-text · "Timeline changed". `deadline` calendar-clock · "Deadline" amber `light-dark(oklch(96.8% .05 85), oklch(23.9% .12 85))` / `light-dark(oklch(45% .12 70), oklch(82% .084 70))` · "Deadline coming up". `mail` mail · "Email" sky-light/sky-chip · "Email sent to Northwind". `ann` megaphone · "Announcement" orange · "Announcement". `team` users · "Team" blue · "Team change". Filter groups: Documents = doc+back; Steps = step+time; Deadlines = deadline; Messages = mail+ann+team. Icon colours/tints: §3.6. | NR:186-213 |
| ◐ | NT-07 | Demo rows (deep links, rule/idea #9) | Today: "2 documents requested" (Utility bill for the office → step 7, Board resolution → board resolution; Arjun Mehta 10:42, unread → Documents) · "Passport copy sent back" (reason text · "Open the document" → document viewer; 09:15, unread) · "GSTR-1 due in 3 days" (Sun 11 Oct · GST → Filings; "GST portal ↗" external; VCFO Suite 09:00) · "Phase 2 end date moved to 28 Oct" (Approved by Priya Raman → Team; See the timeline → Home; 08:30, unread → phase page). Earlier this week: "Capital Structure accepted" (Step 6 of 14 is complete → step 6) · "Name approved by MCA" (company name · Name approval letter → viewer) · "MCA V3 portal down 11–12 Oct" (Official feed → Announcements; mca.gov.in ↗) · "Email sent: Documents requested" (To rahul@… · Email settings → Settings). Earlier: "Meera Iyer joined the project" (Director · invited by Northwind → Team) · "DIN allotted to both directors" (names · Step 4 · DIN) · "Email sent: Welcome to VCFO Suite" (Open Home). | NR:214-226 | ◐ one body line + href per notification; per-part deep links need a links column
| ☑ | NT-08 | Mark one read | Dot click → read; counts update everywhere (Unread tab, topbar badge, sidebar chip). Opening the row (title/arrow) should also mark it read (current app does this). | NR:112, NR:241-242 |
| ☑ | NT-09 | Mark all read + Undo | Sets every item read, shows page toast "All marked read" + **Undo** (restores the previous read set). Trigger missing in the board (G1). | NR:151, NR:277-278 |
| ☑ | NT-10 | Empty — all caught up | Unread tab with nothing unread (NE): bot state **answered** 52 px wrapped in `.react` (`v7react .55s` pop) + bubble "All caught up. Nothing unread." + **See all** (switches to All). Same component for any empty filter. | NR:90-98, NR:279, NE |
| ☑ | NT-11 | Donut card "This month" | `section.card.t` padding 16, gap 12, centred. `h2.st` "This month" (12 px 800 uppercase .07em). SVG 140×140 rotated −90°: track circle r 54 stroke 18 `--raised`; 4 segments in order Documents (`--due-chip`), Steps (`--prog-chip`), Deadlines (`oklch(70% 0.15 80)`), Messages (`--sky-chip`), each `stroke-dasharray = (len−2) (C−len+2)`, `stroke-dashoffset = −sum(previous)`, C = 2π·54. **Hover a segment** → its stroke-width 18 → **24** (`transition: stroke-width .15s`) + navy tooltip at the top centre "Steps · 4" (700 12 px, padding 4×9, radius 6, arrow). **Click a segment** → drill-down with that type preselected. Centre: round button inset 26 px, panel bg: total `metric` 30 px "11" + cap "this month"; hover → tooltip "All · 11"; click → drill-down on All. | NR:122-134, NR:246-264, NR:272-273 |
| ☑ | NT-12 | Donut legend | 4 buttons (flex column gap 2): 10×10 swatch radius 3, label (600 12 px), mono count; padding 5×6, radius 6; hover/linked-hover bg `--raised` and highlights the matching segment; click → drill-down preselected. Phone min-height 40. | NR:135-137, NR:261-262, NR:62 |
| ☑ | NT-13 | **Drill-down pop-up** | `.ov.tb-ov.tb-top`; dialog **600 px** column. Top strip `.dd-top` (bg `--primary-light`, bottom border, padding 9×18, 12 px muted, wraps): lead + right link 800 12.5 px: All → "These live in Northwind’s Notifications list" / "Show in the list ↓" (closes, then after 60 ms smooth-scrolls to y = 200); Documents → "These items live in Documents" / "Open Documents →"; Steps → "These steps live in Incorporation" / "Open Incorporation →"; Deadlines → "These deadlines live in Compliances · Filings" / "Open Filings →"; Messages → "These messages live in Announcements" / "Open Announcements →". Header: navy `.ic` bell + "Notifications this month" + Close. Pill (padding 12 18 0) 5 tabs **All 11 · Documents 2 · Steps 4 · Deadlines 1 · Messages 4**, clicked part preselected, `aria-label="Filter by type"`. List (padding 8 0 10, **max-height min(420px, 52dvh)**, scroll): `a.row` padding 10×18 → item page: icon tile, title `.rt` + mono cap "who · time", kind chip, primary arrow. Close: ✕, Esc, scrim. Phone: bottom sheet (G11). | NR:153-174, NR:265-275, ND |
| ☑ | NT-14 | "Northwind gets these by" card | `section.card` padding 14×16 gap 10: `h2.h3`; chips "✓ Email" (prog-light/prog-text, padding 4×8) and "✓ WhatsApp" (ok-light/ok-text) — show only the channels that are on; link "Change in Settings →" (12 px) → `/app/client/settings#notifications`. | NR:139-146 |
| ☑ | NT-15 | Dropped vs current | Current: date pill (All/Today/This week/Earlier) + direction pill (All/Received/Sent), row expands to show IST time, "Clear from inbox" ✕. Redesign: one type pill; day groups replace the date pill; sent emails appear as kind "Email" under Messages; row opens the item instead of expanding. History still includes items cleared from the bell inbox. | `notif_current.dc.html`, `NotificationHistoryPage.tsx:27-46,97-114` |

#### 1.4 Audit — `/app/client/audit`

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | AU-01 | Top bar + sidebar | Home / **Audit**; sidebar Audit active. | UR:84-86 |
| ☑ | AU-02 | Header actions | `.ph .acts` (right): search `label.tb-srch` (flex 0 1 240, width 240, min 150) with magnifier at left 10/top 10 (`--subtle`) and `input.inp` padding-left 32, placeholder "Search", `aria-label="Search the audit log"` — filters by action, subject, person. The board input has no handler; build: client-side filter over loaded rows, ~200 ms debounce. **Export** `btn btn-o` with download icon → downloads the filtered log (CSV; PDF optional, idea #3). Phone: actions take a full row, search flexes `1 1 150px`. | UR:88-93, UR:56, UR:78-79 |
| ☑ | AU-03 | "Last 14 days" card | `section.card.t` padding 14 18 12, gap 10. Header: `h2.st` "Last 14 days", total `metric` 20 px pushed right ("20") + cap "events". Bars: 14-column grid gap 6 (3 on phone), height 64, items aligned to the bottom; each bar is a `button` (full height, transparent) containing a span with height `max(count×14, 3)` px, radius 3 3 0 0: today `--navy` opacity 1; days with events `--navy-3` opacity .55 (1 when hovered, `.15s`); empty days `--border`, button **disabled**. Grow-in `.9s cubic-bezier(.2,.7,.2,1)` (G12). Hover → navy tooltip above the bar, centred at `(i+.5)/14` of the width: "Thu 8 Oct · 3 events" / "· 1 event". Click (non-empty) → day drill-down. Labels row: 14-col grid, mono 11 px centred; today navy-ink 700, others `--subtle`. | UR:95-102, UR:220-241, UR:252 |
| ☑ | AU-04 | Filters | `.tb-hd` with two pills: **type** (`aria-label="Filter by type"`) All · Documents · Milestones · Team · Email · Credentials, with counts that respect the "who" filter; **who** (`aria-label="Filter by who"`) Everyone · SBC · Northwind (no counts), pushed right (`margin-left:auto`). Wraps; phone: both full width, left-aligned. | UR:104-108, UR:205-210, UR:59, UR:69 |
| ☑ | AU-05 | Day group | `.tb-day` grid `72px | 1fr`, gap 16, padding-top 14. Day header: date tile **60×62** (today navy/white; other days primary-light/navy) + weekday cap 700 centred under it ("Today", "Wed", "Tue"). Timeline rail `.tb-vl` 2 px `--border` at left 79 px (71 ≤959, 67 phone) from top 14 to bottom 14. Phone: header becomes a row (tile 50×52 + caption 12 px) above the events. | UR:119-123, UR:60-61, UR:70-73 |
| ☑ | AU-06 | Event row | `.tb-ev` grid `52px 28px 1fr 190px 32px` gap 12, padding 8 0 (≤959: `48 28 1fr 150 32`, gap 10; phone: `44 28 1fr 40`, who moves to row 2 under the text). Cells: time mono 12 600 navy-ink; status node 28 px circle (white glyph stroke 2.6, set A; 3 px panel ring) with tooltip + `aria-label`; text: action 700 + muted " · subject"; who: avatar 24 px (11 px initials, no ring) + name 12 600 ellipsis + role chip (SBC: navy/white — "Lead", "Manager", "System"; client people: gold-soft/gold-text "Client"); **Details** `.ibtn` with chevron 14 px (`aria-expanded`, rotates 180° when open). | UR:126-131, UR:62, UR:66, UR:74-75 |
| ☑ | AU-07 | Status nodes (rule 18) | req (person, amber `oklch(66% .17 55)`, filled glyph) "Waiting on Northwind" · back (!, `--over-chip`) "Sent back · fix needed" · up (trend arrow, blue `oklch(55% .2 262)`) "With SBC · to review" · ok (✓, green `oklch(58% .15 155)`) "Done" · time (blue) "With SBC · timeline" · mail (`--sky-chip`) "Email" · team (navy, user-plus) "Team change". | UR:185-187 |
| ☑ | AU-08 | Details (expand) | One open at a time. `.tb-facts` under the row: margin `0 0 8px 92px` (86 ≤959, 0 phone), padding 12×14, radius 8, bg raised, grid 3 columns gap 10×16 (phone `auto-fit,minmax(120px,1fr)`): key `.lbl` / value `.rt` (wrap anywhere). Full-width CTA `a.btn.btn-o.btn-sm`: "Open request", "Upload again", "View timeline", "Preview file", "View email", "Open step", "Open Team", "Open Credentials" → the real page. Facts are plain language; **no emails or internal metadata** (decision). | UR:133-138, UR:192-201, UR:63-64, UF |
| ☑ | AU-09 | Empty filter state | "Nothing matches these filters yet." + **Clear filters** (resets both pills to All/Everyone) + "Ask VCFO why"; padding 40×16×24. | UR:110-118, UR:250 |
| ☑ | AU-10 | Load older | Centred `btn btn-o btn-sm` "Load older" after the list (padding-top 16) → next page (keyset cursor). Hide when no more. | UR:144 |
| ☑ | AU-11 | **Day drill-down pop-up** | `.ov.tb-ov.tb-top`, dialog **760 px**. Top strip: "These events live in the Audit log" / "Show in the Audit log ↓" (closes, after 60 ms smooth-scrolls to y = 280). Header: date tile navy/white (day/month), `h2` 700 16 px "Mon, 5 Oct" ("Today, 8 Oct" for today) + cap "2 events" + Close. Pill of **days that have events, newest first**, with counts, buttons padding 0 8 (`aria-label="Pick a day"`), clicked day preselected. List max-height `min(420px,52dvh)`: `a.row` padding 10×18: time (44 px mono 12 600), node (no ring), text (action 700 · subject), desktop who (12 600) + role chip, primary ↗ icon; phone: who + role under the text. Phone: bottom sheet (G11). | UR:150-173, UR:242-258, UD |
| ◐ | AU-12 | Demo data | Today (8 Oct): 10:42 Documents requested · Utility bill, Board resolution (Arjun Mehta, Lead) [Items 2 · Due 12 Oct · Step 4 · Registered office → Open request]; 09:15 Document sent back · Passport copy (Arjun) [Reason Photo page is blurred · Uploaded by Meera Iyer · File passport_meera.pdf → Upload again]; 08:30 Timeline change approved · Phase 2 ends 28 Oct (Priya Raman, Manager) [Before 24 Oct · After 28 Oct · Slipped 4 days]. Wed 7: 18:20 Document uploaded · Passport copy (Meera Iyer, Client); 16:05 Change request sent · Phase 2 +4 days (Northwind = RK, Client) [Reason Directors travelling · Asked 24 → 28 Oct · Status Approved]; 11:30 Email sent · Documents requested (VCFO Suite, System) [To Northwind · Delivered · Also sent WhatsApp nudge]. Tue 6: 15:10 Step accepted · Capital Structure (Priya) [Step 6 of 14 · Submitted 4 Oct · Turnaround 2 days]; 12:00 Colleague invited · Ananya Rao (Northwind) [Invited · Access Member · Status Invite sent]. Older days feed the bars and drill-down only. Total 20. | UR:192-232 | ◐ real events; document-request/credentials producers not yet writing audit events
| ☑ | AU-13 | Dropped vs current | Current: "Global logs / By project" tabs, search + role select + type select, table When/What/Who (role pill + name + **email**)/Target (company + id hash)/▾ raw metadata. Redesign: one project, pills instead of selects, timeline by day, no emails, no ids, facts in plain words, 14-day chart, export. | `audit_current.dc.html`, `AuditLog.tsx:459-650` |

#### 1.5 Settings — `/app/client/settings`

| Done | id | item | exact behaviour | file:line |
|---|---|---|---|---|
| ☑ | ST-01 | Top bar + sidebar | Home / **Settings**; sidebar account row highlighted (glass bg + inset ring), nav pill hidden. | SR:83-85, SD:93-95 |
| ☑ | ST-02 | Layout | `.tb-g12`: left column `span 5` (flex column gap 16) = hero, Profile, Security; right `span 7` = Notifications, Appearance. ≤959: one column, in that order. Sections are anchors `#profile #security #notifications #appearance`. | SR:56-58, SR:88-164 |
| ☑ | ST-03 | Identity hero | Section radius 10, padding 18, gradient `linear-gradient(115deg, navy-deep 0%, navy-2-deep 60%, navy-3-deep 100%)`, white, gap 16, 3 px gold fade line at the bottom. Avatar 72 px circle `--primary-fill`, initials 700 22 px Space Grotesk, ring 3 px white/25 %. **Change photo** button: absolute right −4 bottom −4, 28×28, radius 6, bg gold, navy camera icon 14 px, tooltip "Change photo" (phone hit area +6 px) → upload / remove photo menu. Text: name `metric` 22 px white; email mono 11 px .75 opacity; chips "Primary" (gold bg, navy text) or "Member", and company "Northwind Technologies" (white/14 %). | SR:90-94, SR:66 |
| ◐ | ST-04 | Profile card | `section.card#profile`. Header `.ch` (padding 16 18 4): navy `.ic` person + `h2.h3` "Profile" + **Edit** (`btn-g btn-sm`, right) → inline edit form (name, email + current password, phone, WhatsApp number + consent), Save/Cancel. Rows `.kv` (grid `110px 1fr auto`, gap 10, padding 10 0, top hairline except first; key 12 px 700 muted): **Full name**; **Email** (mono 12) + (i) pop-over "Changing email needs your password. Sign-in moves to the new address." + Ask VCFO (pop anchored right: `left:auto;right:-8px;transform:none`); **Phone** (mono); **WhatsApp** (number or "Not set up") + chip "Verified" (ok-light/ok-text) or "Off" (raised/muted). Phone: key column 92 px. | SR:96-104, SR:75-77, SR:67 | ◐ WhatsApp chip "Verified" only when whatsapp_status=verified, else "On"
| ◐ | ST-05 | Security card | `section.card#security`: navy `.ic` lock + "Security". Row **Password**: mono `••••••••` + cap "changed 2 Sep" (nowrap) + **Change** (`btn-o btn-sm`, hidden while the form is open). Row **This device**: "Chrome on Windows · Hyderabad" + chip "Active now" (ok). | SR:106-122 | ◐ device from user agent; no city / other sessions
| ☑ | ST-06 | Change-password form | Inline under the Password row (SP): form bg raised, radius 8, padding 12, gap 10, margin 4 0 8. Fields `.fl`: Current password (`autocomplete=current-password`), New password (`new-password`); strength meter = 4 bars (flex gap 4, height 5, radius 2; filled with `--ok` for strong; use due/over colours for weaker), `aria-label="Strength: strong"`; requirement chips "✓ 8+ characters", "✓ Number", "✓ Symbol" (ok-light/ok-text when met) + verdict chip "Strong" (`--ok-chip` white, min-width 116 centred); Confirm new password (border `--ok` when it matches). Buttons right: Cancel (`btn-g btn-sm`) + **Save password** (`btn-n btn-sm`). Save → closes form, toast "Password changed" (green check). Errors: wrong current password inline. | SR:109-118, SR:225-226, SP |
| ☑ | ST-07 | Notifications card header | `section.card.t#notifications`: navy `.ic` bell + "Notifications" + (i) "Email is Northwind’s record and stays on for anything that needs action. WhatsApp is a quick nudge on top." + Ask VCFO about this. | SR:126-129 |
| ☑ | ST-08 | Channel cards | `.tb-ch2` grid `auto-fit,minmax(min(100%,270px),1fr)` gap 12, padding 12 18 6 (phone 12). Each: flex gap 12 padding 12 radius 8 1 px border. **Email**: `.circ` 44 px `--prog-chip` mail icon 20; "Email" 800 + mono cap address; chip "Always on" (prog-light). **WhatsApp**: `.circ` `--ok` WhatsApp icon; "WhatsApp" 800 + mono cap number; on → `.tgl.on` (tooltip + label "WhatsApp is on · click to turn off"); off → card bg raised + **Turn on** `btn-n btn-sm`. | SR:130-142, SR:59, SR:227-230 |
| ◐ | ST-09 | Preference matrix | Header `.mx` (grid `34px 1fr 84px 84px`, gap 12, padding 10×16, top hairline): blank, `.lbl` "Tell me when", "Email" (centred), "WhatsApp" (centred). 7 rows, icon `.ic` 30 px coloured: Documents requested or sent back (`--due-chip`) — Email **locked On** · WhatsApp on; Step accepted or needs changes (`--ok-chip`) — locked · on; Deadlines and reminders (`--over-chip`) — locked · on; Timeline changes (`--prog-chip`) — locked · on; Announcements from SBC (`--navy-3`) — Email toggle **on** · WhatsApp off; Official feed news (MCA, GST, Tax) (`--sky-chip`) — Email **off** · WhatsApp off; Weekly summary · Monday 9 am (`--violet-chip`) — Email **on** · WhatsApp "—" (no WhatsApp). Locked cell = chip with lock icon 11 px + "On" (raised/muted + inset border), tooltip "Always on · email is Northwind’s record". Toggles: tooltip/label "Email on · {row}" / "WhatsApp off · {row}"; when WhatsApp is off all WhatsApp toggles are disabled with tooltip "Turn on WhatsApp first". The board only flips local state (no toast); build: save each change at once (optimistic, revert on error). Phone: icon column hidden, columns `1fr 60px 76px`, gap 10, padding 10×12. | SR:143-151, SR:196-219, SR:78, SR:68-69 | ◐ saved in NEW notification_prefs; dispatchers do not read it yet
| ◐ | ST-10 | Quiet hours row | Last `.mx` row, bg raised, radius 0 0 10 10: `.ic` `--navy-2` moon + "Quiet hours · no WhatsApp 9 pm – 8 am" + toggle in the WhatsApp column (default on; tooltip "Quiet hours on/off"; disabled + "Turn on WhatsApp first" when WhatsApp is off). | SR:152, SR:232-233 | ◐ saved; WhatsApp sender does not defer yet
| ☑ | ST-11 | Turn WhatsApp off | Toggle click → WhatsApp off at once, toast "WhatsApp turned off" + Undo (must restore, G4); Profile chip → "Off"; matrix WhatsApp column disabled; Notifications page card drops "✓ WhatsApp". | SR:230 |
| ◐ | ST-12 | **Turn on WhatsApp pop-up** | `.ov.tb-ov` centred, dialog **460 px**. Header: `.ic` `--ok` WhatsApp + "Turn on WhatsApp" + Close. Body: 3-step track (flex, gap 8): node 24 `--ok-chip` ✓ "Number" — 2 px `--ok` line — node 24 navy **pulsing** "2" "Code" — 2 px dashed `--border` line — node 24 panel/muted inset border "3" "Done" (labels 700 12 px; last muted). Field "WhatsApp number": prefix box `+91` (70 px, mono) + number input (mono). "Code sent to WhatsApp": 6 one-digit inputs in a 6-column grid gap 8, **44 px high, 18 px, centred, mono**; the active digit has a navy border; typing advances, backspace goes back, paste fills all. Consent checkbox (16 px, navy accent): "Send me WhatsApp updates about Northwind. Reply STOP to stop." Footer: Cancel (`btn-g`) + **Verify & turn on** (`btn-n`). Success → closes, WhatsApp on, toast "WhatsApp is on". Wrong code → inline error under the digits; "Resend code" link after 30 s (not drawn, recommended). | SR:168-181, SR:231, SW | ◐ no 6-digit code (no WhatsApp verification template); number + consent via existing opt-in
| ☑ | ST-13 | Appearance card | `section.card#appearance`: navy `.ic` palette + "Appearance". `.tb-app` grid 2 columns gap 16×24, padding 12 18 16 (phone 1 column, padding 12): **Theme** `.lbl` + 3-tab pill Light · Dark · System (applies at once, remembered); **Reduce motion** `.lbl` + toggle (tooltip "Reduce motion on/off"). | SR:155-162, SR:220, SR:234 |
| ☑ | ST-14 | Toast | `.toast.tb-toast`: green check 16 px (`oklch(80% .12 160)`) + text + "Undo" link. Texts: "Password changed", "WhatsApp turned off", "WhatsApp is on". | SR:167, SR:235 |
| ☑ | ST-15 | Dropped vs current | Current page: big avatar card + Upload photo/Remove, Profile & Security cards with ✎ Edit, Role row, Appearance with Greeting-card and Sidebar swatches + Reduce motion, red **Sign out** footer button. Redesign: hero card with Change photo, no Role row (chip in hero), WhatsApp row + verified chip, device row, notification matrix, theme pill, no swatches (G3), **no Sign out button on the page** (it lives in the sidebar account row/menu). Staff-only Outlook card stays staff-only. | `settings_current.dc.html`, `AccountSettings.tsx:245-585` |

#### 1.6 State matrix (every board state)

| Done | Board / prop | State shown |
|---|---|---|
| ☑ | TR | Team, All tab; tabs 0-3 by click; empty bubble when a tab is empty (needs data) |
| ☑ | TI | Team + Invite dialog (filled: Ananya Rao / ananya@northwind.in) |
| ☑ | TH | Team + Hand-off dialog (Rahul → Kavya Sen, checkbox ticked) |
| ☑ | AR `tab=0..2` | Announcements All / Important / General; banner on |
| ☑ | AE (`tab=1, empty=true`) | Important filter empty (deadline/compliance removed), banner hidden; See all resets |
| ☑ | AD | Detail pop-up on item 1 of 6 (Deadline) |
| ☑ | NR `tab=0..5` | All / Unread / Documents / Steps / Deadlines / Messages |
| ☑ | NR `allRead=true` + `tab=1` = NE | All caught up bubble (answered bot) |
| ☑ | NR `drill=0..4` (ND = 1) | Drill-down on All / Documents / Steps / Deadlines / Messages |
| ☑ | NR hover states | Segment hover (`hv` 1-4), centre hover (`hv` 0), legend highlight |
| ☑ | NR toast | "All marked read · Undo" (state only) |
| ☑ | UR `tab=0..4` | Type filter (note: 6 types, prop enumerates 0-4) |
| ☑ | UR `openId=n` (UF = tab 1, openId 2) | Documents filter with "Document sent back" details open |
| ☑ | UR `drillDay=13/12/11/10` (UD = 10) | Day drill-down |
| ☑ | UR who pill (state only) | Everyone / SBC / Northwind; empty state with Clear filters |
| ☑ | SR default (`section=2`) | Settings, WhatsApp on |
| ☑ | SP (`section=1, pwOpen`) | Change-password form open |
| ☑ | SW (`section=2, waOff, waDialog`) | WhatsApp off + Turn-on dialog |
| ☑ | SR `toast="…"` | Toast with text |

#### 1.7 Breakpoint variants

| Done | Width | Shell | Team | Announcements | Notifications | Audit | Settings |
|---|---|---|---|---|---|---|---|
| ☑ | ≥1280 desktop | 248 px sidebar; full top bar (search 256) | 3 SBC cards per row; role chip + date columns | 8/4 grid | 9/3 grid | full grid `52 28 1fr 190 32` | 5/7 grid |
| ☑ | 960-1279 tablet | 72 px rail (board sidebar children hidden), search 196 | cards auto-fit (≥250 px each) | 8/4 | 9/3 | as desktop | 5/7 |
| ☑ | 768-959 | rail; search icon-only; "Home /" hidden | cards auto-fit | stacked (portals under) | stacked; side cards auto-fit min 240 | `48 28 1fr 150 32`, rail at 71, facts margin 86 | stacked |
| ☑ | ≤767 phone | no rail, drawer via ☰; top bar shows ☰ + current page + search/ann/notif icons (40 px), theme hidden; content padding 16 16 104; toasts at bottom 96 | contact buttons 40 px; pill full row; role chip inline, date under email | banner wraps (Open right); host chip inline; pill full row | who·time under body; right column hidden; dot hit area +16 px; legend 40 px | day header horizontal (tile 50×52); grid `44 28 1fr 40`, who on row 2; facts full width auto-fit 120; search full row; bars gap 3; drill rows show who+role under text | kv key 92 px; matrix icon column hidden `1fr 60 76`; appearance 1 column; card paddings 14/12; Change photo hit area |
| ☑ | ≤520 | | | | kind chip auto width, right-aligned | | |
| ☑ | any phone | touch targets ≥ 40 px: `.btn`, `.btn-sm`, `.ibtn`, `.seg button`, `.tgl` hit area, `.info>button` | | | | | |

Source: TR:14-60, AR:56-61, NR:56-68, UR:56-80, SR:56-73, TB:31-46.

#### 1.8 Before / after incorporation

No variant on any of the five pages (G15). Effects only through the shell: Incorporation badge `6/14` → `14/14` (SJ:269), Before/After pill (SH-09) and a toast. Data-driven differences in the real app: next-deadline banner and "Deadlines" notifications only exist once compliance items exist (usually after COI); Team/Audit/Settings are identical.

#### 1.9 Animation and timing catalogue

| Done | Name | Spec | Used on | Source |
|---|---|---|---|---|
| ☑ | Card enter `up` | opacity 0 → 1, translateY 10 → 0, `.5s cubic-bezier(.2,.7,.2,1) backwards` | every `.card` | CSS:18, CSS:20 |
| ☑ | Stagger `v7fade` | opacity 0, y 6 → 0, `.2s cubic-bezier(.22,1,.36,1) both` on `.stag>*` | Team main | CSS:94-95, TR:67 |
| ☑ | Card hover | translateY(−2 px) + shadow + border, `.16s cubic-bezier(.22,1,.36,1)` | all cards | CSS:81-82 |
| ☑ | Pill thumb spring | `transform .42s linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004)` (= framer spring 420/32/0.8) | all pills | CSS:72 |
| ☑ | Pill label colour | `color .2s` | all pills | CSS:75 |
| ☑ | Toggle knob | same spring .42 s; track bg `.2s` | Settings | CSS:136-138 |
| ☑ | Button press | scale .98, `.12s cubic-bezier(.22,1,.36,1)`; bg `.15s` | all buttons | CSS:83-84 |
| ☑ | Tooltip in | `tipin .12s ease` (opacity + 3 px rise); arrow `tipin2 .12s` | `[data-tip]` | CSS:166-170 |
| ☑ | JS tooltip | delay 120 ms, opacity/transform `.12s` | aria-label icons | PJ:133-134, PJ:307 |
| ☑ | (i) pop-over | opacity/transform/visibility `.15s`, −4 px → 0 | Settings (i) | CSS:111-113 |
| ☑ | Unread pulse `v7pulse` | box-shadow 0 → 5 px gold ring `oklch(80% .12 85 / .7 → 0)`, `1.8s ease-in-out infinite` | Notifications unread dot; WhatsApp stepper node 2 | CSS:118 |
| ☑ | Bot react `v7react` | scale .9 → 1.1 (rotate −4°) → .98 → 1, `.55s cubic-bezier(.22,1,.36,1)` | "All caught up" bot | CSS:99, CSS:103 |
| ☑ | Bot idle | `bob 2.6s ease-in-out infinite` (−4 px), `botup .45s` delay .5 s | launcher | CSS:97-102 |
| ☑ | Bar grow | `grow .9s cubic-bezier(.2,.7,.2,1) backwards` (scaleX, G12); opacity `.15s` | Audit 14-day bars | CSS:19, UR:98 |
| ☑ | Donut segment | `stroke-width .15s` (18 → 24) | Notifications donut | NR:127-130 |
| ☑ | Skeleton | `sk 1.2s linear infinite` shimmer | loading (rule 12) | CSS:150-151 |
| ☑ | Page enter / leave | `vpIn .26s cubic-bezier(.22,1,.36,1)`; leave opacity .35 `.14s` then navigate at 140 ms | every navigation | PJ:135-137, PJ:116 |
| ☑ | Toast | in `.18s` opacity + `.22s cubic-bezier(.22,1,.36,1)` 12 px rise; shown 3200 ms | global toast | PJ:130-131, PJ:166 |
| ☑ | Drill "Show in the list ↓" | close, wait 60 ms, `window.scrollTo({top:200 | 280, behavior:'smooth'})` | Notifications / Audit drill | NR:275, UR:258 |
| ☑ | Launcher | lift `.5s cubic-bezier(.34,1.45,.5,1)`; duck `.32s cubic-bezier(.5,0,.75,.4)`; pill bg `.15s` | global | PJ:328-334 |
| ☑ | Reduced motion | everything above off | all | SH-29 |

---

### 2. DATA — what each element shows and where it comes from in the real app

Legend: **EXISTS** = usable today; **PARTIAL** = exists but needs a change; **NEW** = must be built (with the backend piece named). Every new repository must take an `AuthContext`, scope by role (Path A, `src/db/repositories/README.md`) and get a cross-tenant test (CLAUDE.md golden rules). Only repositories import `db`.

#### 2.0 Shared

| Done | UI | Source | Status |
|---|---|---|---|
| ☑ | Current user (name, initials, email, role, avatar) | `useApp().user`; `GET /api/account/profile` → `getOwnProfile` (`src/db/repositories/profiles.ts:505`) | EXISTS |
| ☑ | Client company name ("Northwind", "Northwind Technologies") | `useApp().engagements[0].companyName` (client has one engagement); short name = first word, or add `shortName` | PARTIAL (short name derived) |
| ☑ | Primary or member | `GET /api/engagements/:id/clients` → `listEngagementClients` → `memberRole: 'owner' | 'member'`; owner also = `engagements.clientUserId` | EXISTS |
| ☑ | Topbar notifications badge / sidebar Updates count | `useApp().unreadNotificationCount` (from `/api/notifications`, head poll) | EXISTS |
| ☑ | Topbar announcements gold dot | `AnnouncementsBell` + `readAnnouncementIds` (localStorage) | PARTIAL → server read state (§2.2) |
| ☑ | Theme | `next-themes` (`ThemeToggle`); schema `client_portal_prefs.theme` (light/dark/system) exists but has **no repository** | PARTIAL → NEW `client-portal-prefs` repository + `GET/PATCH /api/account/portal-prefs` |
| ☑ | Ask VCFO chat | `src/components/ask/*` (`AskLauncher`, `AskPanel`, `AskProvider`) | EXISTS |
| ☑ | Base CSS (tokens, `.card`, `.seg`, `.tgl`, `.dlg`, tooltips…) | `src/components/client-portal/css/10-base.css` (verbatim port of CSS, scoped `.cp`), `11-drill.css` | EXISTS (generated by `scripts/cp-css.mjs`) |
| ☑ | Sliding pill motion | `src/components/shell/MotionActivePill.tsx`, `src/components/admin/SegmentedPicker.tsx` | EXISTS (restyle to navy thumb) |
| ☑ | Bot avatar + bubble (rule 16) | no shared component in `src/components` | NEW `BotSays` component (avatar 40-56 + bubble + action) |

#### 2.1 Team

| Done | UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|---|
| ☑ | SBC cards: name, role | Priya Raman · Project Manager; Arjun Mehta · Project Lead | `useClientOverview()` → `GET /api/client/overview` → `getClientOverview` → `loadTeam()` (`src/db/repositories/client-overview.ts:90`) → `ClientOverviewTeamMember {id,name,email,role}` (managers then leads, never "intern") | EXISTS |
| ☑ | SBC card line (email) | priya.raman@sbc.in | same, `email` | EXISTS |
| ☑ | SBC photo | initials placeholder | `profiles.avatarObjectKey` exists but `loadTeam` does not return it; avatar route serves own avatar only (`getOwnAvatarObjectKey`) | NEW: add `avatarUrl` to team member + a route that serves staff avatars to clients on the same engagement (scoped) | photo via /api/client/portal/team-photo/[id] (shell avatarUrl)
| ☑ | WhatsApp / Call buttons | wa.me / tel: | `profiles.phoneE164` exists (EngagementParty has it, `engagement-recipients.ts:12-23`) but not passed to `ClientOverviewTeamMember` | PARTIAL: add `phoneE164` to the team member type; hide WA/Call when null |
| ☑ | Teams button | Teams deep link | no Teams field anywhere (`outlookConnections.msEmail` is staff Graph mailbox) | NEW: use `outlookConnections.msEmail` or `email` for `https://teams.microsoft.com/l/chat/0/0?users=` (decide) | email used for Teams deep link
| ☑ | Customer support card | Farhat · support@sbc.in · +91 90597 90014 | nothing in code (no constant) | NEW: config (`SUPPORT_NAME`, `SUPPORT_EMAIL`, `SUPPORT_PHONE_E164`, `SUPPORT_TEAMS`) read server-side and returned with the overview (also used by the sidebar "Customer support" row) |
| ☑ | People rows (name, email, Primary/Member, "Since …") | 3 people | `GET /api/engagements/:id/clients` (`app/api/engagements/[id]/clients/route.ts:23`) → `listEngagementClients` → `{userId,email,name,memberRole,invitedBy,createdAt}` | EXISTS ("Since" = `createdAt`, format `d MMM`) |
| ☑ | Avatar colour per person | fixed demo colours | — | NEW (client-side: hash userId → palette) |
| ☑ | Pending invite rows ("Invite sent", "Sent 6 Oct") | Ananya Rao | `invites` table exists (`schema.ts:685`: token, email, role, engagementId, acceptedAt, expiresAt, createdAt) and `src/db/repositories/invites.ts`, **but** `createInvite` throws for clients (`invites.ts:62-64`) and today's client invite (`inviteEngagementClient`, `engagement-clients.ts:154`) creates the account immediately with a temporary password | NEW: invite flow for clients — add `name`, `invitedBy`, `revokedAt` columns (migration); `createClientInvite(ctx, {engagementId, email, name})` (Primary only), `listPendingInvites(ctx, engagementId)` (accepted IS NULL, not revoked, not expired), `resendInvite` (new token, new expiry, email), `revokeInvite`; return pending rows with `/clients` GET or a new `GET /api/engagements/:id/invites` |
| ☑ | Invite permission "Primary contact only" | tooltip | `inviteEngagementClient` lets **any** client on the engagement invite (`engagement-clients.ts:165-170`) | PARTIAL: enforce `memberRole==='owner' || eng.clientUserId===ctx.userId` for `ctx.role==='client'`; staff unchanged; test it (cross-tenant + member-denied) |
| ◐ | Set-password link ("Expires in 7 days", Copy) | link by email | none: `src/views/auth/ResetPassword.tsx` says Auth.js credentials issue no recovery tokens; `/invite/[token]` (`src/views/auth/InviteAccept.tsx`) is the old localStorage demo | NEW: token issue (7-day expiry, hashed), `/invite/[token]` real page (set name + password → create profile + `engagement_clients` row → sign in), `POST /api/invites/accept`; email template (DB-backed email system, Resend/SES). **Interim (decision):** keep the temporary password (`DEFAULT_CLIENT_TEMP_PASSWORD`) and show it in the Sign-in box | temp password interim
| ☑ | Invite email | — | `sendWelcomeEmail` (`src/lib/email/welcome-email.ts`) with `clientPassword` | PARTIAL: new template for link; keep `toastEmailDispatch` result handling |
| ☑ | Substitute / hand-off | Rahul → Kavya | `POST /api/engagements/:id/clients/substitute` (`substitute/route.ts:30`) → `substituteEngagementClient` (`engagement-clients.ts:316`) returns `actorLostAccess`, `becamePrimary`; outgoing person notified by `sendClientEmailChangedEmail` | EXISTS (switch password → set-password link later); client then `signOut()` as `ClientTeam.tsx:160-167` |
| ☑ | Who may substitute | any row | repo: any client on the project may substitute anyone (`engagement-clients.ts:396-402`) | DECIDE: Primary only (consistent with invite) or self only for members |
| ☑ | Audit trail of invite / substitute | — | `recordAuditEvent` `client.invite`, `client.substitute` already written | EXISTS (+ add `client.invite_resend`, `client.invite_revoke`) |
| ☑ | Tab counts, empty texts | — | client-side | — |

#### 2.2 Announcements

| Done | UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|---|
| ☑ | List | 6 items | `useAnnouncements()` (`src/lib/use-announcements.ts`) → `GET /api/announcements` → `listAnnouncements` (`src/db/repositories/announcements.ts:67`, firm-wide, newest first, cap 80/120) → `Announcement {id,title,body,kind,origin,sourceName,sourceUrl,authorId,authorName,authorRole,publishedAt}`; live head poll every 4 s (`?head=1` → `getAnnouncementBoardHead`) | EXISTS |
| ☑ | Kind chip text | Deadline, MCA, Compliance, Tax, GST, Post-Incorp | `ANNOUNCEMENT_KIND_LABEL` (`src/lib/announcements.ts`) | EXISTS (colours per AN-06) |
| ☑ | Date tile | 8 OCT | `publishedAt` in IST (`announcementYmdIst`) | EXISTS |
| ☑ | "From Priya Raman" / "Official feed" | | `announcementAttribution` returns "From VCFOSuite" for feed | PARTIAL: feed → "Official feed" |
| ☑ | Host chip ("mca.gov.in") | | `sourceUrl` → `new URL().hostname` minus `www.`; `sourceName` fallback | EXISTS (derive) |
| ☑ | Filter All/Important/General | 6/2/4 | `announcementMatchesFilter` | PARTIAL (G9) |
| ☑ | Unread dot / bold / tint / topbar dot | ids 1, 2 unread | `readAnnouncementIds(userId)` / `writeAnnouncementReadIds` in **localStorage** (`vcfo.announcements.read.<userId>`), event `ANNOUNCEMENT_READ_EVENT` | NEW (idea #1): table `announcement_reads(profile_id uuid fk, announcement_id uuid fk, read_at timestamptz, pk(profile_id, announcement_id))`; repo `listReadAnnouncementIds(ctx)`, `markAnnouncementsRead(ctx, ids[])` (own rows only); `GET /api/announcements?withRead=1` returns `read:boolean` per item, `POST /api/announcements/read {ids}`; migrate localStorage ids once on first load |
| ☑ | Detail body | message text | `body` (fallback `title`) | EXISTS |
| ☑ | Detail author block (photo, role, time, WhatsApp/Email) | Priya Raman · Project Manager · 8 Oct, 09:05 | `authorName`, `authorRole` (map role → "Project Manager"/"Project Lead"), `publishedAt`; no author phone/email/avatar | NEW (small): join `profiles` on `authorId` for `avatarUrl`, `email`, `phoneE164` **only when the author is on the client's engagement team** (else hide contact buttons) |
| ☑ | Next-deadline banner | GSTR-3B for September · 20 Oct · in 12 days | `useClientOverview()` → `overview.compliance.upcoming[0]` `{id,title,authority,group,dueDate,status,periodLabel}` (`loadComplianceRunway`) | EXISTS (days = dueDate − today IST; title = `title` + period) |
| ☑ | Official portals | Setup 8 / Recurring 4 | `groupedVcfoPortalTasks()` / `VCFO_PORTAL_TASKS` (`src/lib/announcement-portals.ts`); setup = non-recurring heads, recurring = Monthly/Quarterly/Half-yearly/Yearly (`OfficialPortalsDirectory.tsx:11-16`); links `portalUrl`, `circularUrl` | EXISTS (counts = real task counts; hide an icon when its URL is null) |
| ☑ | Compose / feeds | not shown to clients | `canWriteAnnouncements`, `canManageAnnouncementSources` | EXISTS (staff only, unchanged) |

#### 2.3 Notifications

| Done | UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|---|
| ☑ | Rows (title, body, time, read) | 11 items | `useNotificationHistory()` (`src/lib/use-notification-history.ts`) → `GET /api/notifications?history=1` → `listNotifications(ctx,{includeDismissed:true})` → `AppNotification {id,kind,title,body,engagementId,companyName,itemId,href,createdAt,read,dismissedAt}` | EXISTS |
| ☑ | Day groups | Today / Earlier this week / Earlier | `groupNotificationsForHistory` (`src/lib/notification-dismiss.ts`) | EXISTS |
| ☑ | Type → icon/chip/filter | doc, back, step, time, deadline, mail, ann, team | `NotificationKind` = checklist.deliver/submit/review/unlock, docs.share, request.created/uploaded, team.assigned/removed, email.sent/skipped/failed (`src/lib/checklist-notifications.ts:14-27`) | PARTIAL: map existing kinds → request.created → Request; checklist.review (rejected) / request sent back → Sent back; checklist.review (accepted)/deliver → Step; email.* → Email; team.* → Team. **NEW kinds**: `request.sent_back`, `timeline.changed`, `compliance.due` (deadline), `announcement.posted`, `team.joined` (+ producers: schedule/change-request approval, compliance digest job `src/jobs/compliance-generate.ts`, announcement create, invite accept) |
| ◐ | Body parts with deep links (idea #9) | "Utility bill for the office" → step 7 … | only one `href` per notification today | NEW: optional `links jsonb` column on `notifications` (`[{label, href, external?}]`) filled by producers; fallback to `body` text + `href` | single href
| ◐ | "who" (actor) + link to Team | Arjun Mehta | no actor on `notifications` | NEW: `actor_id uuid` (+ `actor_name` snapshot) column; client sees staff names only (no emails) | not shown
| ☑ | Mark one read | dot | `useApp().markNotificationRead(id)` → `POST /api/notifications {action:'mark_read', id}` | EXISTS |
| ☑ | Mark all read | (G1) | `useApp().markAllNotificationsRead()` → `{action:'mark_all_read'}` | EXISTS |
| ☑ | Undo mark all read | toast Undo | no "mark unread" | NEW: `{action:'mark_unread', ids}` → `markNotificationsUnread(ctx, ids)` (own rows) |
| ☑ | Donut "This month" counts | 11 · 2/4/1/4 | client-side from history (createdAt in current IST month) | EXISTS (derive) |
| ☑ | "Northwind gets these by" | ✓ Email ✓ WhatsApp | email always; WhatsApp = `getOwnProfile().whatsappOptIn` (+ `whatsappStatus`) | EXISTS (derive) |
| ☑ | Delivery log ("Email sent: …") | Email rows | `notification_deliveries` (`listDeliveriesByEngagement`, staff route `/api/engagements/:id/notification-deliveries`) | OPTIONAL: email.* notifications already exist; no change needed |

#### 2.4 Audit

| Done | UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|---|
| ☑ | Events | time, action, subject, who, role | `GET /api/audit-logs?limit=…` → `listAuditEvents` (`src/db/repositories/audit-events.ts:80`; client scope = own engagements) → `AuditEventRow {id,created_at,actor_user_id,actor_role,actor_email,actor_name,engagement_id,action,summary,metadata}` | EXISTS (scope) |
| ☑ | Client-safe projection (decision + idea #2) | name + role, no emails, no internal metadata | route returns `actor_email` and raw `metadata` to clients today | NEW: `listClientAuditEvents(ctx, {before, limit})` (or a `view:'client'` branch) that (a) whitelists client-visible actions, (b) drops `actor_email`, ids and raw metadata, (c) maps `actor_role` → "Manager"/"Lead"/"Client"/"System" (never "intern"), (d) builds `facts[]` + `cta {label, href}` server-side per action |
| ☑ | Categories (Documents · Milestones · Team · Email · Credentials) | pill | `getAuditActionCategory` (`src/lib/audit-log.ts:137`) → engagement/checklist/documents/admin/email/other | PARTIAL: client map — Documents = board_resolution, dir_2, incorporation_docs, milestone_document, document_request.*; Milestones = checklist.*, engagement change requests / schedule (timeline); Team = client.*; Email = welcome_email.*, email_templates.fire; Credentials = credentials.* |
| ☑ | Who pill (SBC / Northwind) | | `actor_role` (client vs staff/system) | EXISTS (derive) |
| ◐ | Missing producers | "Documents requested", "Document sent back", "Document uploaded", credentials views | `document-requests.ts` create/update record **no** audit event; credentials page has no audit (prototype uses `localStorage vcfo.credsAudit`) | NEW: `recordAuditEvent` in `createDocumentRequest` / `updateDocumentRequest` (`document_request.create/sent_back/upload`) and in the credentials reveal/copy route (`credentials.reveal`, `credentials.copy`) | other areas
| ☑ | 14-day bars + total | 20 events | none | NEW (light): `GET /api/audit-logs?summary=14d` → counts per IST day for the scoped engagement (or compute client-side from the first page if ≤ 500) |
| ☑ | Search | text | client-side over loaded rows (current `AuditLog.tsx:88` does a haystack filter) | EXISTS (pattern) |
| ☑ | Load older | button | `listAuditEvents` supports `before` (keyset) but the route ignores it | PARTIAL: accept `?before=<iso>` in `app/api/audit-logs/route.ts` |
| ☑ | Export CSV/PDF (idea #3) | button | none | NEW: `GET /api/audit-logs/export?format=csv` streaming the client-safe projection |
| ☑ | Day drill-down | per-day events | client-side from loaded rows (or `?day=YYYY-MM-DD`) | EXISTS / small |

#### 2.5 Settings

| Done | UI element | Prototype value | Real source | Status / backend needed |
|---|---|---|---|---|
| ☑ | Hero (name, email, avatar, Primary chip, company) | Rahul Khanna | `GET /api/account/profile` → `getOwnProfile` (`profiles.ts:505`: id,name,email,phone,phoneE164,whatsappOptIn,whatsappStatus,role,avatarUrl); Primary from §2.0; company from engagement | EXISTS |
| ☑ | Change photo | camera | `POST/DELETE /api/account/avatar` (`AccountSettings.tsx:625-690`, `IdentityCard`); Outlook photo staff only | EXISTS |
| ☑ | Profile rows + Edit | name, email, phone, WhatsApp | `PATCH /api/account/profile` (name, phone, phoneE164, whatsappOptIn, email + currentPassword) → `updateOwnProfile` | EXISTS |
| ☑ | WhatsApp "Verified" chip | Verified | `profiles.whatsappStatus` enum unknown/verified/failed | PARTIAL: set `verified` only after OTP (below) |
| ☑ | Password "changed 2 Sep" | | no column | NEW: `profiles.password_changed_at` set by `updateOwnPassword` and invite acceptance |
| ☑ | Change password | form | `POST /api/account/password {currentPassword,newPassword}` → `updateOwnPassword` (min 8) | EXISTS (strength meter client-side: 8+ chars, number, symbol) |
| ◐ | "This device · Chrome on Windows · Hyderabad · Active now" (idea #8) | | Auth.js JWT sessions; no session table | NEW: `user_sessions` (id, profile_id, user_agent, ip_city, created_at, last_seen_at, revoked_at) written on sign-in/refresh; repo `listOwnSessions`, `revokeOtherSessions`; city via IP lookup (optional) | UA only
| ☑ | Email "Always on" | | — | static |
| ☑ | WhatsApp on/off | toggle | `PATCH /api/account/profile {whatsappOptIn:false}` → sets `whatsappOptOutAt`; on requires number + consent | EXISTS (off) |
| ◐ | Turn on WhatsApp with code | 6-digit code via WhatsApp | no OTP; consent is a tick box only (`AccountSettings.tsx:383-398`) | NEW: `POST /api/account/whatsapp/start {phoneE164}` (sends an OTP template via `src/lib/notify/send-whatsapp.ts` → EUM; new template e.g. `verify_code`), `POST /api/account/whatsapp/verify {code}` (sets `phoneE164`, `whatsappOptInAt`, `whatsappStatus='verified'`); store hashed code + expiry (10 min) + attempt count (table `whatsapp_verifications` or columns). WhatsApp failures must never affect email (CLAUDE.md) | no code
| ☑ | Per-category Email / WhatsApp matrix (idea #6) | 7 rows | nothing: `NOTIFY_EVENTS` = welcome, coi_issued, document_delivered, compliance_due_monthly, compliance_due_quarterly, compliance_overdue (`src/lib/notify/types.ts`) | NEW: table `notification_prefs(profile_id pk/fk, email jsonb, whatsapp jsonb, quiet_hours boolean default true, quiet_start time '21:00', quiet_end time '08:00', tz text 'Asia/Kolkata', updated_at)`; categories `docs, steps, deadlines, timeline` (email locked true, server ignores false), `announcements`, `feed`, `weekly_digest` (email only); repo `getOwnNotificationPrefs` / `updateOwnNotificationPrefs` (own row only); `GET/PATCH /api/account/notification-prefs`; dispatchers (`send-email.ts`, `send-whatsapp.ts`) consult prefs per event→category; skip reason `disabled` already exists in `SkipReason` |
| ◐ | Quiet hours | 9 pm – 8 am | none | NEW: in `notification_prefs`; WhatsApp sends during quiet hours are deferred (Inngest delay) or skipped with reason `quiet_hours` (add to `SkipReason`) | stored only
| ◐ | Weekly summary · Monday 9 am | email | no digest for clients | NEW: Inngest cron (`src/jobs/`) Monday 09:00 IST, respects prefs | stored only, no job
| ☑ | Theme Light/Dark/System | pill | `next-themes`; `client_portal_prefs.theme` (schema only) | PARTIAL: persist via NEW portal-prefs repository |
| ☑ | Reduce motion | toggle | `useShellAppearance()` (`src/lib/use-shell-appearance.ts`, localStorage) `prefs.reduceMotion` | EXISTS (local; optionally add `reduce_motion` to `client_portal_prefs`) |
| ☑ | Sign out | (not on page) | `useApp().signOut()`; shell account row | EXISTS |

---

NEW (team builder): tables `client_invites`, `notification_prefs`, `client_account_meta` (src/db/schema-portal-team.ts); repositories `client-team.ts`, `client-audit.ts`, `client-notifications.ts`, `notification-prefs.ts`; routes `/api/client/team`, `/api/client/announcements/reads`, `/api/client/notifications`, `/api/client/audit` (+ `/export`), `/api/client/notification-prefs`, `/api/client/account/password`; `isPrimaryClient` + Primary-only invite/substitute-others in `engagement-clients.ts`.

<!-- /area:team -->
