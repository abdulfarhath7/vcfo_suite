# Compliances (client) — prototype catalogue for the Next.js rebuild

Source of truth: FINAL prototype
`docs/specs/client-pages/prototype/final-src/s/comp/index.html` (abbrev. **I:**),
`.../final-src/s/comp/cal-views.js` (**CV:**), `.../final-src/comp-route.js` (**CR:**),
shared prototype chrome `.../final-src/proto.js` (**P:**) and `.../final-src/shell.js` (**SH:**).
Older v7 copy: `docs/specs/client-pages/prototype/src/app/s/comp/` (**v7**). Where v7 and FINAL differ, FINAL wins (differences listed in §0.3).
Rules: `docs/specs/client-pages/DESIGN-RULES.md` (rules 14, 15, 16, 17, 18), `docs/specs/client-pages/DECISIONS.md` § Compliances.
Screenshots (v7, so they show the OLD rounded-tile calendar, a Today button and a Full-screen button — do not copy those): `docs/specs/client-pages/prototype/v7-screens/compliances__{390x844,1024x768,1440x900,1920x1080}.png`.

Real app today:
- Routes `app/app/client/compliances/page.tsx` (redirects to `/calendar`), `.../calendar/page.tsx` → `ComplianceCalendarPage`, `.../filings/page.tsx` → `FilingsPage`, both in `src/views/compliances/CompliancePages.tsx`.
- Views `src/views/compliances/ComplianceCalendarView.tsx` (statutory grid + register calendar + month list) and `src/views/compliances/FilingsView.tsx` (FY stepper, cadence / status SegmentedPickers, Monthly/Quarterly/Annual tabs, DashDataTable, PeriodMatrix).
- NOTE: there is **no `src/domain/compliance`** in this repo. The compliance domain lives in `src/lib/compliance/*` (generate-instances, fy-periods, incorporation-state, obligations-seed, types, compliance-store) and the register logic in `src/lib/compliance/filings.ts`.
- Data: `useFilings()` (`src/hooks/use-filings.ts`) → `GET /api/filings` (`app/api/filings/route.ts`) → `getFilings(ctx, {engagementId?, fyStartYear?})` (`src/db/repositories/filings.ts`) over `compliance_instances ⨝ compliance_obligations ⨝ engagements` (`src/db/schema.ts:578`). Window write: `POST /api/filings/[id]/window` (manager roles only) → `setComplianceInstanceWindow` (`src/db/repositories/schedule.ts`).

---

## 0. Orientation

### 0.1 How the prototype is wired

- `I:` builds a design **canvas** of 17 boards (I:950-974). Each board is a `<section id="…">` with an `.ab` artboard (1440 px wide on the canvas).
- When the URL hash names a board (`#cal-redesign`, `#fil-redesign`, `#cal-mobile`, …) the page renders **only that board** (I:970-974) and `CR:` makes it full-screen and fluid: adds `html.comp-live` + `data-comp=<id>`, for `#cal-mobile` also `vp-mobile comp-phone` and frame width 100% (CR:4-10); moves the `.ab` into `#comp-screen`, hides every other body child, scrolls to top, and re-measures every sliding-pill thumb on rAF, on `document.fonts.ready` and on `resize` (CR:17-20). A `hashchange` reloads the page (CR:24).
- Prototype route map (`final-src/routes.js`): `compliances` → desktop `s/comp/index.html#cal-redesign`, mobile `s/comp/index.html#cal-mobile`; `filings` → desktop `#fil-redesign` (no mobile board — Filings on a phone is the fluid desktop board at ≤767 px).
- `SH:` replaces the board's own `.side` sidebar with the shared prototype sidebar (Compliances group with Calendar / Filings children, `SH:95`) and adds the Before/After pill to the top bar. The board's own `sidebar()` (I:515-528) and `topbar()` (I:529-536) are the design reference for the shell; they are the same as every other client page (rule 2) and belong to the app shell, not to this page.
- Fixed demo "today": `TODAY = '2026-10-08'` (Thu) (I:401); picker "now" `NOW = '2026-10'` (CV:248). Client = Northwind Analytics India Pvt Ltd, FY 2026-27.

### 0.2 Board list (every hash view)

| Hash | Board | Function | Live / static | Notes |
|---|---|---|---|---|
| `#cal-current` | Calendar — Current | `calCurrent()` I:562-592 | static | Rebuild of today's app page with 4 yellow notes. Reference only. |
| `#cal-redesign` | Calendar — Redesign | `calRedesign({gridId:'live-grid'})` I:685-696 | **LIVE (the route)** | Default hash. Month/Year/Timeline, picker, area pill, day pop-over, drill-downs, proof preview. |
| `#bot-empty` | Bot empty-state component (rule 16) | `botBoard()` I:915-932 | static | Six bot-speech states + spec strip. |
| `#cal-header-opts` | Calendar header — 5 options A–E | `headerOptions()` I:933-945 | static (chips click → drill-down) | Exploration; owner picked "compact donut" instead (DECISIONS). |
| `#cal-drill` | Calendar — Drill-down pop-up | `calRedesign()` + `openDD(…,'status','over','oct')` I:1031 | static-open | Drill-down pre-opened on "Overdue". |
| `#cal-focus-opts` | Next deadline card — colour options | `focusOptions()` I:652-663 | static | A–D; owner pick **A** (DECISIONS). |
| `#cal-info` | Calendar — (i) pop-over | `calRedesign({infoOpen:true})` I:957 | static | In FINAL `infoOpen` is ignored by `calHeader` (I:672) → renders same as redesign. The (i) pop-over lives in the Next deadline card and the drill-down title. |
| `#cal-day` | Calendar — Day pop-over | `calStatesDay()` I:723-725 | static-open | 15 Oct selected, pop-over anchored right of the cell (I:977-978). |
| `#cal-detail` | Calendar — Filing detail pop-up | `calStatesDetail()` → `detailModal()` I:707-722 | static-open | GSTR-3B · September 2026 centred modal. |
| `#cal-empty` | Calendar — Empty month + loading | `calEmpty()` I:727-738 | static | FEMA filter, May 2027, bot overlay; "All clear" rail bot; skeleton card. Uses the older header (`filterRow`, `calHeader('May 2027')`). |
| `#fil-current` | Filings — Current | `filCurrent()` I:767-779 | static | Today's app page with notes. Reference only. |
| `#fil-redesign` | Filings — Redesign | `filRedesign()` I:803-813 | **LIVE (the route)** | Donut + area bars, area + status pills, table with proof column. |
| `#fil-drill` | Filings — Drill-down | `filRedesign()` + `openDD(demo,'status','due','fil')` I:1032 | static-open | |
| `#fil-detail` | Filings — Filing detail | `filRedesign(filDetail())` I:814-823 | static-open | Right side panel 520 px. |
| `#fil-preview` | Filings — Document preview | `filRedesign(docPreview())` I:824-834 | static-open | Full-screen proof preview. |
| `#improve` | Changes, ideas & open questions | `improvements()` I:839-873 | static | Owner decisions table (9 Oct) — see §0.4. |
| `#cal-mobile` | Calendar — Mobile 390 | `calMobile()` I:739-754 | **LIVE (mobile route)** | Week strip + agenda. Not interactive beyond tooltips/proof. |

### 0.3 FINAL vs v7 differences (FINAL wins)

| Area | v7 | FINAL | Ref |
|---|---|---|---|
| Month grid look | Separate rounded tiles (gap 6 px, radius 10, dashed out-of-month, status-tinted cell backgrounds, solid coloured date square, "● TODAY" label in cell) | **One table with thin 1 px `#9aa8bb` lines between every date**, tinted weekday header row, no status cell tints (cells stay white), date number in a 24×24 4px-radius square that is filled by status, **today = the whole cell with `inset 0 0 0 2px var(--navy)` + `#eef2f8` tint**, today label hidden, event chips tinted `#eef2f8` with no area code | I:358-377 |
| Year view look | Mini-month cards with border/radius, 20 px day cells | Each month is a small lined table (24 px cells, `#d5dce6` inner lines, `#9aa8bb` frame), month header underlines on hover, today cell `inset 2px navy`; last row padded so lines close | I:378-391, CV:110 |
| Month label | Static `<b>October 2026</b>` (min-width 120) | **Month / year picker**: two buttons "October ▾" "2026 ▾" opening a 304 px pop-over (month grid 3×4 or year grid 4×N), Today in footer | I:1-26, I:671, CV:249-305, CV:333 |
| Header layout | Row 1: FY chip · Today · Month/Year/Timeline · Full-screen · Filings; Row 2 (in calendar column): area pill · month nav | **One compact line**: `[month nav][FY 2026-27][area pill]` on the left, `[Month·Year·Timeline][Filings]` on the right. **No Today button, no Full-screen button** (Today is inside the picker) | I:27-40, I:672-680, I:687 |
| Next deadline card A | 4 px navy left bar, padding-left 20 | No left bar; padding `16px 16px 14px` | I:634, v7 diff |
| Copy | "You approve", "your approval", "Your team", "Ask VCFO about these filings" | "Northwind approves", "Northwind's approval", "Northwind's team", "Ask VCFO" | I:715, 719, 522, 705, 985 |
| Dark mode | hard-coded `#fff` in places | `light-dark()` everywhere + `--navy-ink` fallbacks | throughout |

### 0.4 Owner decisions that bind the build (DECISIONS.md § Compliances + I:865-871)

- Tile colour = **status** (green filed · amber due soon · red overdue · navy upcoming). Area = navy mono chip only.
- Areas = **5**: MCA · GST · Income tax · Payroll · FEMA (Labour folds into Payroll, STPI into FEMA; no RERA/TP/STPI legend).
- Week starts **Monday**.
- "Northwind approves" step: **design now, build later** (needs approval data).
- Mobile calendar = **week strip + agenda**.
- Detail view: **Calendar → centred pop-up**; **Filings → right side panel** (keeps table visible).
- Status chips (donut legend etc.) **do not filter the grid**; they open the drill-down only.
- Header = **compact donut, top right above Next deadline** (owner pick).
- Next deadline card = **A · Light card + navy accent**.
- Shared: mobile drill-downs = **bottom sheet** (DECISIONS § Shared) — the comp prototype does not implement it (it shows the centred `.dd` at `width:min(760px,calc(100vw - 24px))`); the build should use a bottom sheet ≤767 px.
- Rules: 14 (every visual explorable: hover tooltip + click drill-down), 15 (portal ↗ + 📎 Proof / amber "Proof pending"), 16 (bot speaks empty states), 17 (every icon has tooltip = aria-label, 120 ms), 18 (solid glyphs).

---

## 1. INVENTORY

Columns: **id | item | exact behaviour | file:line**. Desktop = `#cal-redesign` / `#fil-redesign`; Phone = `#cal-mobile`.

### 1.1 Global / page frame

| id | item | exact behaviour | file:line |
|---|---|---|---|
| G-01 | Page frame | `frame(active,trail,content,extra)` = `.shell` › sidebar + `.main` › topbar + `.page.stag` + Ask VCFO launcher + extra overlays. Trail = `['Compliances','Calendar']` / `['Compliances','Filings']`. | I:538-540 |
| G-02 | Page container | `.page` padding `22px 24px 120px`, column, gap 16. Live: width 100%, max-width 1600 centred, padding `clamp(14px,1.6vw,22px) clamp(12px,1.8vw,24px) 120px`. | I:110, I:306 |
| G-03 | Page entrance stagger | `.stag>*` `fadeUp .25s cubic-bezier(.22,1,.36,1) both`, children 2-5 delayed .06/.12/.18/.24 s; `fadeUp` = opacity 0→1, translateY(6px)→0. | I:220-222 |
| G-04 | Ask VCFO launcher | Bottom-right (right 24, bottom 24), navy label "Ask VCFO" with arrow + 68 px robot face; `botup .45s cubic-bezier(.22,1,.36,1) .4s both` (from translateY(48px), opacity 0); face `bob 2.6s ease-in-out infinite` (translateY 0→-4px). Click opens chat (P: navTarget 'chat'). Shell-level component. | I:214-219, I:537 |
| G-05 | Hover tooltip (rule 14/17) | One fixed `.tipb` (navy, white 600 12px Manrope, 6px 10px, radius 8, arrow 8 px) placed at target's top-centre, `translate(-50%,calc(-100% - 10px))`, opacity transition .12 s with 120 ms delay. Shown for any `[data-tip]` or `button[aria-label].ibtn`; text = `data-tip` or aria-label; hidden when pointer leaves a tip target. Hidden on drill click. | I:239-241, I:256, I:1024-1025 |
| G-06 | Auto tooltips for icon controls | Every icon-only `button/a[aria-label]` gets `data-tip=aria-label`; unlabeled `.ibtn` get Close / Previous / Next / Download / Preview by icon path. | I:1033-1035 |
| G-07 | Count-up | `[data-count]` animates 0→N over 700 ms easeOutCubic (`1-(1-k)^3`) via rAF, skipped under reduced motion. In FINAL only the unused `kpis()` and nothing on the live calendar carry `data-count` — rule 12 still wants count-up on the donut centre number and the FY figure; apply to donut total + legend counts. | I:1036-1037, I:599-606 |
| G-08 | Reduced motion | `@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`; year cards no transition. | I:270, CV:91 |
| G-09 | Sliding pill (`.seg`) | Track `oklch(96.5% .008 250)` + inset 1px border, radius 8, padding 2; navy thumb (radius 6, shadow) slides `transform .42s var(--spring), width .42s var(--spring)`; active label white 600; counts in mono 11px (`.cnt`), active count 72 % white; optional 7 px status dot. Click → moves thumb, sets aria-selected, dispatches `pick` (index). Clicking the already-selected tab → P: toast "Already showing X". | I:129-136, I:543-556, P:288 |
| G-10 | `--spring` easing | `linear(0,0.0637,…,1.0004)` (25 stops, slight overshoot to 1.0036). | I:57 |
| G-11 | Toast | Prototype global toast `#vp-toast` (P:158-165) shows 3.2 s; optional **Undo** button. Used by: Remind me ("Remind me · done" + Undo), Export, Download, timeline drag ("… window · 1 Oct – 6 Oct" + Undo), Fit, Undo. Drill-down rows use the in-page `.toast` (navy pill bottom-centre, 1600 ms). | P:158-165, P:244, I:223-224, I:1020 |
| G-12 | Before / After incorporation | Shell pill in the top bar (`SH:539-581`, P:212-218) toggles `vcfo.after`; on non-Home pages it only toasts "Showing the company after/before incorporation". **The comp boards do not listen to `vcfo-after`; no pre-COI variant is drawn for Compliances.** Build: render the pre-COI state (see E-07). | P:212-218 |
| G-13 | Dark theme | `html[data-theme=dark]` token set in P:38-53 (copied in §3.1). Theme button in top bar. | P:35-53 |
| G-14 | Portal link ↗ (rule 15) | `.pbtn` 18×18 radius 4 icon button (external-link icon 14 px) after a filing name; muted, navy + primary-light bg on hover; `.dark` variant on navy surfaces. `href` from `portalOf(r)`, `target=_blank rel=noopener`, `data-tip="Open <portal>"`, aria-label same, `onclick=stopPropagation`. ≤767: 40×40 hit area with `margin:-11px -6px`. Prototype P: intercepts http links and toasts "Opens Open GST portal in the full app" — the real app must just open the new tab. | I:481-491, I:247-248, I:344 |
| G-15 | Portal map | GST→GST portal `https://www.gst.gov.in/`; MCA→MCA portal `https://www.mca.gov.in/`; IT with /TDS\|TCS/ in name→TRACES `https://www.tdscpc.gov.in/`, else Income-tax portal `https://www.incometax.gov.in/`; PAY with /PF\|ESI/→EPFO `https://unifiedportal-emp.epfindia.gov.in/`, else State PT portal `https://www.tgct.gov.in/`; FEMA with /Softex/→STPI `https://www.stpi.in/`, else RBI FIRMS `https://firms.rbi.org.in/`. | I:482-490 |
| G-16 | Proof chip 📎 (rule 15) | Only for filed rows. If proof missing → amber `chip c-due` "Proof pending", tip "SBC will upload the challan". Else `button.chip.pchip` paperclip 12 px + "Proof", tip "Open proof", `data-proof="<name> · <period>"` → opens the document preview overlay (G-17). ≤767: min-height 32. | I:492-495, I:249, I:345 |
| G-17 | Document preview overlay | Global capture click on `[data-proof]` (also 👁 in side panel) → appends `.pvwrap` (absolute inset 0, z 120; live: fixed, z 2147482600, scrollable column) with dark scrim `oklch(15% .03 264/.72)`, top bar (red "PDF" tile 30×34, file name bold, sub "GSTR-3B · Aug 2026 · filed 18 Sep", "1 / 1", white Download button, ✕), paper page `.pv-page` (600 px, Georgia, light-only island), zoom pill bottom-centre (− 100% +). Close: ✕ or scrim click. No Esc in prototype (add Esc + focus trap). | I:824-834, I:1023, I:288-291, I:318-323 |
| G-18 | Info (i) pop-over (rule 7) | `.info` 20×20 icon button; pop-over ≤280 px under the icon, arrow on top, opens on focus-within (click) or `.open`; fade+slide `.15s`; ends with "🤖 Ask VCFO about this" row (primary, top hairline). | I:137-144, I:541 |
| G-19 | Bot speaks (rule 16) | `botSay(lines,{size,action,secondary})`: avatar circle (size 40/44/48/56, robot SVG at 74 %, `bob 2.6s`) + bubble (radius `10px 10px 10px 4px`, 600 13px/1.4, max 300, tail at left-bottom pointing to bot) + optional actions row: ghost "🤖 Ask VCFO why" (default) and/or one secondary (navy). Avatar tooltip "Ask VCFO". | I:497-501, I:250-253 |
| G-20 | Status chip | `.chip` radius 4, 2px 7px, 700 11px/16px + solid glyph 12 px: Filed `c-ok` ✓ green; Due soon `c-due` navy clock (glyph `prog`); Overdue `c-over` red "!"; Upcoming `c-up` grey empty circle + inset border. Tooltips: "Filed" / "Due within 7 days" / "Late · past the due date" / "Upcoming". | I:118-119, I:429-435 |
| G-21 | Area chip | `.area` 20 px high mono 700 11px navy on `oklch(95% .012 255)` + inset ring; text MCA/GST/IT/PAY/FEMA; tooltip full name: "Ministry of Corporate Affairs", "Goods & Services Tax", "Income tax", "Payroll · PF, ESI, PT", "FEMA · RBI & STPI". | I:120, I:434-436 |
| G-22 | Solid glyphs (rule 18) | `glyph(k,size,tip)` filled circle + white symbol: done green ✓; prog navy + gold clock; you amber person; sbc blue arrow; up light grey empty (inset ring); late red "!". | I:429-431 |
| G-23 | Date tile (`.dtile`) | 44×48 (default) radius 8 white text: big day number (700 18px/1 Space Grotesk) + small 800 11px uppercase weekday/month (opacity .85). Colour = worst status (`--ok/--due/--over`, upcoming = `--navy`). Sizes used: 44×48 rail, 40×44 day pop-over & phone, 38×42 filings table, 56×62 detail/side panel. | I:185-187 |

### 1.2 Calendar — desktop (`#cal-redesign`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| C-01 | Header row | `.row-wrap` (flex, nowrap when it holds `.calbar`, z 6): left `.calbar` = `[data-calnavr]` month nav · FY chip · area pill (scrolls horizontally); right `.end` (flex none) = view pill Month/Year/Timeline + "Filings" button. All controls 28 px high. | I:27-40, I:672-680, I:687 |
| C-02 | Month navigator | Bordered pill (panel bg, 1px border, radius 6, padding 2): ‹ (`.ibtn` 24×28 borderless, aria "Previous month") · month button `.mpk-b` "October ▾" · year button "2026 ▾" · › ("Next month"). ‹/› step ±1 month across year boundaries (`stepMonth`). Hidden (`visibility:hidden`) when view ≠ Month. | I:671, CV:243, CV:322, CV:331-332 |
| C-03 | Month / year picker | Click month or year button → `.mpk-pop` dialog (304 px, radius 14, padding 12, shadow `0 18px 40px -16px`), anchored under the nav, **left-aligned** (`left:0`), 8 px gap. Header: ‹ (`Previous year` / `Earlier years`) · `[October ▾][2026 ▾]` mode switch (active = raised bg) · ›. Month mode: 3-col grid of Jan…Dec 42 px buttons; current selection `.on` navy/white; real current month `.now` inset 1px navy ring. Year mode: 4-col grid of 32 years (base = viewY-10 aligned to 4), max-height 240 scroll, auto-scroll selected to centre; mono 13.5 px. Footer (hairline top): "Today" → sets 2026-10 (i.e. current month). Picking a month sets month + closes; picking a year keeps the month + closes. Same button again toggles closed; outside pointerdown closes; Esc closes and returns focus to opener; focus moves to selected cell on open; `aria-expanded` on the opener. | I:1-26, I:39-40, CV:249-305 |
| C-04 | FY chip | Mono 10.5 px (calbar override) gold-soft bg / gold-text, radius 7, padding 0 8, stretches to row height. Static "FY 2026-27" — should follow the viewed month's FY. | I:32, I:687 |
| C-05 | Area pill (5 areas) | `.seg` All 13 · MCA 2 · GST 3 · Income tax 4 · Payroll 2 · FEMA 2 (counts = rows in the month data). Calbar size: 28 px buttons, padding 0 9, 12 px font, 10 px counts. Pick → re-renders current view filtered to that area (Month: grid with only that area's rows; Year; Timeline). Additionally on the live grid it first dims non-matching `.ev` chips to opacity .18 (then CV re-render replaces them). Filter persists across view switches and month changes. | I:557, I:687, I:989-990, CV:328-329 |
| C-06 | View pill | Month · Year · Timeline (`[data-calview]`). Switches the calendar card body (`[data-calbody]`), sets `data-view`. Month nav hidden for Year/Timeline. | I:677, CV:306-339 |
| C-07 | "Filings" button | `btn btn-o btn-s` navy text, file icon 14 + "Filings" → navigates to Filings page (real: `<base>/filings`, carry period/area). | I:678 |
| C-08 | Layout | `.cal-layout` grid `minmax(0,1fr) 340px`, gap 16, align start. Left = calendar card; right = rail (donut, Next deadline, Coming up), gap 12. | I:688-693, I:309-310 |
| C-09 | Calendar card | `.card.t` (white, 1px border, radius 10, shadow, gold 38×3 tab at left 18) padding 12, holds the grid (`[data-calbody]`). | I:691, I:112-113 |
| C-10 | Month grid structure | 7 columns Mon…Sun (Monday first: `start=(getDay()+6)%7`); header row `.dow` (MON…SUN, 800 11px uppercase .08em, `#eef2f8` bg, bottom line); leading days of previous month and trailing days of next month as `.day.out` (date only, colour `#a9b4c4`, not clickable — rendered as `<div>`); in-month days are `<button class="day">` with `data-iso`. Number of rows = what the month needs (5 for Oct 2026). Wrapped in `.cal-scroll` (overflow-x auto) with `.cal` min-width 540. | I:609-627, I:275-276, I:358-367 |
| C-11 | Grid lines | **Thin 1 px `#9aa8bb` lines between every date** (cell right + bottom borders; 7n has no right border; outer frame 1px, radius 8, overflow hidden, no bottom frame since cells draw it). Cells white, height 96, padding `7px 8px`. Weekend cells NOT tinted in FINAL (override). | I:358-368 |
| C-12 | Date number | `.dt` 24×24 radius 4, 700 13px Manrope. Empty day: plain number. Day with filings: filled square by **worst** status of its rows (rank over > due > up > ok): `s-over` red, `s-due` amber, `s-ok` green, `s-up` navy — white number. | I:164, I:168-171, I:370, I:423-426 |
| C-13 | Count badge | If a day has >1 filing: mono 11 px muted count at the right of the date row. | I:620 |
| C-14 | Event chips (tiles) | Up to 2 per day: `.ev` 20 px, radius 3, `#eef2f8` bg, 600 11px, left 3 px colour bar = the row's status colour (`--ok/--due/--over/--up`), name ellipsis. Area code hidden in FINAL (`.cal .ev .a{display:none}`). >2 → "+N more" (800 11px primary). Each chip carries `data-s=<status>`. | I:176-180, I:375-377, I:621-622 |
| C-15 | Today | Whole cell: `box-shadow: inset 0 0 0 2px var(--navy)` + background `#eef2f8` (dark: `oklch(19% .009 258.3)`). "Today" label + gold pulse hidden in FINAL grid. Today+selected: `inset 0 0 0 2px navy, inset 0 0 0 4px primary`. | I:371-374 |
| C-16 | Day hover | Background → `#f7f9fc` (transition .15s). No lift/shadow in FINAL. Cursor pointer on in-month days. Tooltip on days with filings: "Thu 15 Oct · 2 filings". aria-label "Thursday, 15 October, 2 filings". | I:363-369, I:619 |
| C-17 | Day selected | Click → `.sel` (inset 2px primary). Only one selected; closing the pop-over removes it. | I:373, I:983, I:987 |
| C-18 | Narrow cell | `@container (max-width:96px)` on `.day`: hide Today text and area code. | I:282-284 |
| C-19 | Day pop-over | See P-01. | I:983-987 |
| C-20 | Year view | `.yv` grid `repeat(auto-fill,minmax(min(100%,196px),1fr))` gap 12 of 12 FY months Apr 2026 … Mar 2027. Each month = `button.ym` (no border in FINAL) with header (`Oct 2026` 800 12.5px + mono count) + lined 7-col mini-grid (Mon first, 24 px cells; days with filings filled by worst status colour `--ok/--due/--over/--navy`, white 800 numbers, tooltip "Wed 7 Oct · TDS/TCS challan, ECB-2 return" (max 3 names + "+N"); today cell inset 2px navy (with a 1px white inner ring if also filled)) + summary line of coloured dots with counts (over, due, ok, up order; "Nothing due" if none). Hover: month title primary + underline. Click a month → switches to Month view of that month (programmatically clicks the Month tab). aria-label "Oct 2026 · 13 filings · open the month". | CV:44-56, CV:98-115, CV:334-338, I:378-391 |
| C-21 | Timeline view | See T-01…T-14. | CV:117-238 |
| C-22 | Donut card (compact donut) | `.card.t.donut` padding `12px 16px`, flex gap 16: 88×88 SVG donut (r 35, stroke 11, segments ok→due→over→up in that order, each `len-2` dash so 2 px gaps, rotated -90°), centre total (Space Grotesk 600 20) + month label ("October", Manrope 600 11 muted); legend grid `repeat(auto-fit,minmax(118px,1fr))` gap `6px 16px`: 10×10 radius-3 swatch · label · mono count. Live width: `clamp(88px,5.6vw,112px)`. Every segment, the centre hole (`data-k=all`, tip "All filings · 13") and every legend row is a drill-down trigger (status). Segment hover: stroke 11→15 (.15s). Legend row hover: brightness 1.06 + 2px primary/.25 ring. Tooltips "Filed · 1" etc. Colours: up = `--up` (light grey) here (not navy). | I:780-786, I:236-238, I:314 |
| C-23 | Next deadline card (A) | `.card` padding `16px 16px 14px`, overflow hidden. Eyebrow: gold pulse + "NEXT DEADLINE" (800 11px .08em navy). Row: navy 58×62 tile (radius 10) "3" (Space Grotesk 28) + "DAYS" (800 11px) — drill trigger (status due) tip "GSTR-1 · due Sun 11 Oct"; title "GSTR-1 · Sep 2026" (700 18px Space Grotesk) + portal ↗ + (i) pop-over ("GSTR-1 for Sep 2026 · due Sun 11 Oct · filed on the GSTN portal. Sales data received 3 Oct." + Ask row); chips: area chip GST + green "✓ Data received". Buttons: navy "Open filing →" (flex 1) + ghost "Remind me". Footer strip (full-bleed, hairline top, padding 10 16): red 8 px dot · **ECB-2 return** · red "1 day late" · chevron right → drill trigger (status over) tip "Overdue · 1". | I:629-651, I:693 |
| C-24 | Coming up rail | `.card` padding `14px 16px 6px`: title "COMING UP" (`.st`) + mono count; rows grouped by date: `.dtile` coloured by the date's worst status (upcoming navy) + list of items (area chip · name ellipsis · status chip). Data = month rows with due ≥ 7 Oct (TODAY-1), first 7 rows. | I:664-670, I:693 |
| C-25 | Rail at ≤1179 | Rail becomes `grid repeat(auto-fit,minmax(min(100%,300px),1fr))` below the calendar; last child (Coming up) spans full width. | I:328-333 |
| C-26 | "Open filing" | No handler in prototype (P: fallback toast). Build: go to Filings with the side panel open on that filing, OR open the calendar detail pop-up (P-02). Decision says calendar detail = pop-up → recommend Next deadline "Open filing" opens P-02. | I:647 |
| C-27 | "Remind me" | P: toast "Remind me · done" + Undo. Real app note (`docs/context/notes/compliance.md`): "Remind me is deliberately disabled — no reminder backend". Needs NEW backend (see §2). | I:647, P:244 |
| C-28 | Legend (status) | Old filterRow legend (Overdue/Due soon/Filed/Upcoming swatches) only in `#cal-empty`/header options; the live board uses the donut legend instead. | I:681-684 |
| C-29 | Loading state | Skeleton card: 3 rows of 44×48 raised tile + two raised bars (80 %, 50 %), `animation: sk 1.2s infinite` (keyframes `sk` defined in P:/shell, a shimmer). | I:735 |
| C-30 | Header options A–E | Static exploration (navy band; segmented status bar; counts in pills; next-deadline hero; status chips → drill-down `.schip`). Not built; owner chose the compact donut. | I:876-945 |
| C-31 | Next-deadline colour options A–D | Static exploration; A chosen. | I:628-663 |

### 1.3 Calendar pop-ups

| id | item | exact behaviour | file:line |
|---|---|---|---|
| P-01 | Day pop-over (`.dpop`) | Click an in-month date → removes any previous pop-over + `.sel`, selects the cell, appends `.dpop` (320 px or `innerWidth-24`, radius 12, padding 12, `--pop` shadow, 12 px rotated arrow) inside the artboard. **Placement**: right of the cell (`left = cell.right+12`, `top = cell.top-8`) if it fits within the viewport minus 12; else left of the cell (`.flip`, arrow on the right side); else centred below the cell (`.below`, no arrow, `top = cell.bottom+8`, clamped 12 from edges). Content: header = date tile (40×44, worst status colour, upcoming navy) + "Thursday 15 October" (14 px bold) + "2 filings" / "Free day" (11.5 px muted 700; static board: amber "2 filings · in 7 days") + ✕ (`data-x`). Body: `dayRow` per filing (P-01a) + "🤖 Ask VCFO" row; free day → `botSay('Nothing is due on this day.', 40 px, no action)`. Close: ✕ only (also removes `.sel`). No outside-click / Esc in prototype — add both. | I:983-987, I:194-195, I:285-286, I:700-706 |
| P-01a | Day pop-over row | `dayRow(r)`: bordered 1px, radius 8, padding `9px 10px`, mb 6, cursor pointer: area chip · name + ↗ portal (bold 12.5) / period (11 muted) · proof chip (if filed) · status chip. Row click not wired → build: opens P-02 for that filing. | I:699 |
| P-02 | Filing detail pop-up (calendar) | Scrim (`oklch(21% .042 264/.38)` + 2px blur, z 50) + centred `.modal` 600 px at top 90, radius 12. Header (padding 18 20, hairline): navy 56×62 date tile "20 / OCT · TUE"; chips row: area GST · status Upcoming · blue `c-prog` "🕑 12 days left"; title "GSTR-3B · September 2026" (700 22px Space Grotesk) + ↗; ✕ (bordered ibtn). Body (padding 18 20, gap 18): **Focus track** 4 nodes (P-04): ✓ Data received 2 Oct → NOW navy card "SBC preparing · Since 4 Oct · Arjun Mehta" (gold icon tile, gold pulse) → dotted → ○ Northwind approves "by 18 Oct" → ○ Filed "due 20 Oct". 4-col facts grid (raised tiles, 800 10px labels): Authority GSTN · Frequency Monthly · Period 1–30 Sep 2026 · Penalty risk [amber "Medium"]. Gold-soft notice row: person icon + "SBC will send the draft for Northwind's approval by 17 Oct." Footer (hairline): "🤖 Ask VCFO about GSTR-3B" (flex 1) · ghost "📅 Add to my calendar" · navy "Open in filings →". Opening it from the live grid is not wired in the prototype. | I:707-722, I:192-193 |
| P-03 | Drill-down pop-up (rule 14) | See D-01…D-10. | I:993-1021 |
| P-04 | Focus track (flow chart) | Done/upcoming nodes = 28 px solid glyph + label below (11.5 px 700, sub 11 px muted, max 100 px); current node = navy hero card (min 188, max 230, padding `10px 14px 10px 10px`, radius 12, shadow) with 32×32 gold icon tile, eyebrow "NOW · 2 OF 4" (800 11px #f3d58a), bold label 14, sub 11.5; pulsing gold ring `ftpulse 1.9s ease-out infinite` (box-shadow 0→9px). Lines: 5 px tall, radius 9; solid green when both ends done/current, else dotted (radial-gradient dots 9 px pitch). Node tooltips: "Done · 2 Oct", "With SBC · Arjun Mehta", "Upcoming · waiting on Northwind from 17 Oct". | I:257-269, I:504-513 |

### 1.4 Drill-down (rule 14) — one component for calendar and filings

| id | item | exact behaviour | file:line |
|---|---|---|---|
| D-01 | Triggers | Any element with `data-dd=status\|area`, `data-k=<key>`, `data-set=oct\|fil\|fy` (click; tooltip on hover). Calendar: donut segments, donut hole, donut legend rows, Next-deadline days tile (due), overdue strip (over). Filings: donut segments/hole/legend (status), area-bar labels and every bar segment (area). Clicks inside an open `.dd` ignored. | I:1026, I:599-606, I:639-648, I:783-785, I:789 |
| D-02 | Scrim + panel | `.ddscrim` `oklch(20% .05 258/.55)`; `.dd` 760 px, radius 12, shadow `0 24px 60px -20px`, `fadeUp .2s`. Live: fixed, centred (`left:50%; translate:-50% 0`), `top:max(12px,8vh)`, `width:min(760px,calc(100vw - 24px))`, max-height to viewport, scroll. (P: forces top `max(72px,8vh)`.) role=dialog aria-modal. | I:242-245, I:315-316, P:144-145 |
| D-03 | Top bar | primary-light strip: "These filings live in Compliances · Filings" + right link: on Calendar "Open Filings →" (navigates); on Filings "Show in the Filings list ↓" (closes + smooth-scrolls to the table). Wraps ≤767. | I:1005, I:1019, I:347 |
| D-04 | Title row | "Compliances · October 2026" / "Filings · Sep–Oct 2026" / "Compliances · FY 2026-27" (700 15px navy) + (i) "As of 8 Oct 2026." + ✕. | I:995, I:1006 |
| D-05 | Tabs | Full-width navy sliding pill (equal columns). Status: All · Filed · Due soon · Overdue · Upcoming. Area: All · MCA · GST · Income tax · Payroll · FEMA. Each with count. **Clicked part pre-selected.** Min width 480 (scrolls). | I:994, I:1007, I:244, I:281 |
| D-06 | Table | Columns Filing (name + ↗ + proof chip) · Period · Area chip · Due / filed (mono, right; "Filed 6 Oct" or "15 Oct") · Status (SOLID chip: white text on `--ok-chip/--due-chip/--over-chip/oklch(54% .026 258)`) · chevron. Sorted by due asc, **max 7 rows**. Row hover: primary name. Min width 560 (scrolls). | I:996, I:1008, I:1013, I:245, I:280 |
| D-07 | Footer line | "Showing 7 of N · full list in Filings" when more, else "Showing all N" (11 px muted). For `fy` set totals come from FY counts. Hidden when empty. | I:1014-1015 |
| D-08 | Empty tab | Table hidden; `botSay` 44 px: Overdue → "Nothing overdue. Nice work." (no action); else "No filings here yet." + "🤖 Ask VCFO why". | I:1012 |
| D-09 | Footer bar | raised bg, top border: ghost "Open Filings". | I:1010 |
| D-10 | Row click / close | Row click → toast "Opening <name> in Filings…" 1.6 s (build: go to Filings with side panel open on that row). Close: ✕ or scrim click (add Esc). Mobile: bottom sheet per DECISIONS. | I:1018, I:1020 |

### 1.5 Timeline view (`tlv-*`, in the calendar card)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| T-01 | Range | Fixed window 1 Sep 2026 → 31 Mar 2027 (`W0`,`W1`), rows filtered to that range and to the area pill. | CV:118, CV:125 |
| T-02 | Lanes | Grouped by area in order MCA, GST, IT, PAY, FEMA (area header lane 24 px, raised, uppercase label "Income tax" etc.), then one 30 px lane per distinct filing name; left name column `clamp(110px,14vw,150px)`. | CV:126-131, CV:135 |
| T-03 | Toolbar | `↶ Undo` (disabled when no history) · hint text ("Drag a filing window to move it · drag its edges to resize · snaps to weeks/days · ctrl + scroll or pinch to zoom") · zoom group: − / range slider (0–1000, log scale) / + / level label (Months/Weeks/Days) / Fit. | CV:133-134, CV:166-170 |
| T-04 | Ruler | 40 px: month labels at day 1 ("Oct 2026", left border); ticks by level: Days → every day number; Weeks → Mondays "5 Oct"; Months → "15". | CV:146-154, CV:75-77 |
| T-05 | Bars | Per filing: bar from window start to end, 16 px high at top 7, radius 4, colour = filed green else status colour (`--ok/--due/--over/--navy`). Default window when none saved: due − PREP days → due, PREP = Monthly 5, Quarterly 10, Half-yearly 10, Annual 21. Due marker: 11 px navy diamond (red if late), white 2 px ring. Late (window ends after due, not filed) → diagonal white stripes + red diamond. Filed → `.lock` (opacity .75, cursor default). Lane background grid lines every day (or every week at Months level). | CV:119, CV:143, CV:156-164, CV:80-87 |
| T-06 | Today line | 2 px red `#d64545` vertical line from below the ruler, with "Today" label tag. | CV:88-89, CV:165 |
| T-07 | Initial zoom | `fitP` = max(min, min(40, width/61)) ≈ 2 months on screen, scrolled to 1 Oct. | CV:139, CV:177 |
| T-08 | Zoom | +/− ×1.5, slider, ctrl/⌘+wheel (anchored at pointer), two-finger pinch; clamp [width/NDAYS, 40 px/day]; buttons disabled at limits. Fit → re-fit from October; if already fitted, toast "Timeline fitted to the screen · from October". Resize re-fits unless user zoomed. | CV:172-185, CV:201, CV:216, CV:237 |
| T-09 | Pan | Mouse drag on empty area pans (cursor grab/grabbing); touch pans natively (`touch-action:pan-x`); scrollbar hidden. | CV:71-73, CV:202, CV:217 |
| T-10 | Drag move / resize | Pointer on a bar: body = move, 8 px edges = resize start/end; snaps 7 days when < 7 px/day else 1 day; min 1 day; clamped to range. While dragging: gold ring + shadow, floating navy read-out "1 Oct – 6 Oct · 5 days · after the due date" (fixed, above pointer). On release (if moved): save, toast "<name> window · 1 Oct – 6 Oct (· ends after the due date)" + Undo. Filed → toast "<name> is already filed, so its window is locked". | CV:189-229, CV:90 |
| T-11 | Keyboard | Bars are `role=slider tabindex=0`; ←/→ move by snap; Shift+←/→ resize end. Focus ring `0 0 0 3px rgba(84,112,255,.55)`. | CV:230-236, CV:82 |
| T-12 | Undo | History stack per session; Undo button / toast Undo restores. | CV:183, CV:224 |
| T-13 | Persistence | `sessionStorage['vcfo.calwin']` = {id:[startDay,endDay]}. Real data = `compliance_instances.window_from/window_to` (manager-only writes). | CV:122-123 |
| T-14 | Tooltip | Bar `data-tip`/aria-label: "GSTR-1 · Sep 2026 · window 6 Oct – 11 Oct · due 11 Oct (· filed \| · ends N d after the due date)". | CV:161 |

### 1.6 Filings — desktop (`#fil-redesign`)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| F-01 | Header row | Left: FY stepper pill (‹ "FY 2026-27" mono 12 bold min-width 84 ›; 28×28 borderless ibtns). Right: cadence pill Monthly · Quarterly · Annual (scrolls) · ghost "⬇ Export" · ghost navy "📅 Calendar" (→ calendar page). | I:805-807 |
| F-02 | KPI row | `.fil-kpis` grid `360px 1fr` (live `minmax(300px,360px) minmax(0,1fr)`), gap 16: donut card (C-22) over **all** filings in view with label "filings" (total 18: Filed 6 · Due soon 4 · Overdue 1 · Upcoming 7) + "BY AREA · SEP–OCT" card. ≤1179 single column. | I:787-793, I:313, I:332 |
| F-03 | Area bars | Per area (MCA, GST, Income tax, Payroll, FEMA): 74 px label (drill: area) · 12 px stacked bar radius 4 on raised track, gap 2: filed green · overdue red · due amber · upcoming `--up` (flex = counts; each segment its own drill trigger + tooltip "GST · 2 filed") · mono "f/total" (34 px, right). Demo: MCA 1/3, GST 2/5, Income tax 2/5, Payroll 1/3, FEMA 0/2. | I:789, I:792 |
| F-04 | Filter row | Area pill (All 18 · MCA 3 · GST 5 · Income tax 5 · Payroll 3 · FEMA 2) left; status pill right: All · ● Overdue · ● Due soon · ● Upcoming · ● Filed (coloured dots, no counts). Both scroll horizontally on narrow screens. **Not wired** in the prototype (thumb moves only) — build: filter the table (status pills DO filter the table here; DECISIONS' "status chips don't filter" refers to the calendar donut chips). | I:809 |
| F-05 | Table card | `.card` overflow hidden. Head `.fil-head` (padding 12 16, bottom border): ‹ · "Sep – Oct 2026" (700 15 Space Grotesk) · › · mono "17 filings" · ghost "Full year" (right). Wraps ≤767. | I:810 |
| F-06 | Table | `.tbl-scroll` (min-width 720). Columns: Due (56 px; 38×42 date tile, colour by status, upcoming navy, day + month "Oct") · Area (70 px; area chip) · Filing (name 700 13 + ↗; period 11 muted) · Frequency (muted) · Filed on (filed → "6 Oct" 600; overdue → red "N day late"; else muted "in N days") · Status (chip) · Proof (right: filed → [📎 Proof][⬇ ibtn "Download"]; proof pending → amber "Proof pending" only; not filed → subtle "—"). Rows sorted by due asc, filtered to due ≥ 15 Sep (the Sep–Oct window). Row hover tint; cursor pointer. th: 800 11px uppercase subtle, `9px 10px`; td `10px`, hairline top. | I:794-802, I:806-811, I:206-212 |
| F-07 | Row click → side panel | Not wired live (static board `#fil-detail`). Build: row click opens F-10 side panel; proof chip / download / ↗ stop propagation. | I:814-823 |
| F-08 | Export | Ghost button; P: toast "Download started…"/fallback. Build: CSV/XLSX of current filter (NEW). | I:807 |
| F-09 | "Full year" / period stepper | Prototype shows a 2-month window "Sep – Oct 2026" with ‹ › and a "Full year" toggle. Real app has month stepper + Full year matrix. Recommend: ‹ › step the window by month (window = previous + current month), Full year = whole FY list. | I:810, FilingsView.tsx:495-585 |
| F-10 | Filing detail side panel | Scrim + `.modal` pinned right: `right:24px; top:24px; bottom:24px; width:520px`, column. Header: green 56×62 tile "20 / SEP"; chips: GST · Filed · 📎 Proof · green "2 days early"; title "GSTR-3B · August 2026" (700 21) + ↗; ✕. Body (scrolls, gap 18): focus track all done (Data 3 Sep → Prepared 12 Sep → Northwind approved 16 Sep → Filed 18 Sep, tip "Done · 18 Sep · 2 days early"); 2-col facts: ARN `AA3609261847215` (mono) · Tax paid "₹ 4,82,310" (metric 16) · Due date 20 Sep 2026 · Filed by "Arjun Mehta · SBC"; "PROOF" list: file cards (red PDF tile 34×40, name bold 12.5, "142 KB · 18 Sep", 👁 Preview → G-17, ⬇ Download); first (primary) card highlighted primary-light with primary/.4 border. Footer: "🤖 Ask VCFO about this filing". | I:814-823 |
| F-11 | Drill from Filings | Donut/legend (status, set `fil`) and area bars (area, set `fil`); top link "Show in the Filings list ↓". | I:1005, I:1019 |
| F-12 | Empty register | `botSay('No filings yet for FY 2027-28.<br>They appear as each registration goes live.', 48 px, default action "Ask VCFO why")`. | I:923 |

### 1.7 Calendar — phone (`#cal-mobile`, 390 px)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| M-01 | Root | `.cm-root` 100 % width, min-height 100dvh, bg `--bg`, 13 px. Comp-route: `.ab` width 100 %, `html.comp-phone`. | I:351-357, CR:10 |
| M-02 | Top bar | 56 px, white, bottom border: ☰ menu (40×40) · "SBC" (800 15 Space Grotesk navy) · "/ **Calendar**" (ellipsis) · 🔍 · 🔔 with badge 3 (primary-light). (Replaced by the shared phone shell in SH.) | I:744 |
| M-03 | Month / week nav | Right-aligned: ‹ ("Previous week") · "Oct 2026" (700 13 Space Grotesk) · › ("Next week"). Not wired. | I:746 |
| M-04 | KPI cards | 3-col grid gap 8: white cards radius 10 padding 10 with 3 px top border colour: "3 / Due in 7 days" (amber) · "1 / Overdue" (red) · "44% / FY filed" (green). Values hard-coded (desktop donut says Due soon 4 — build must compute; see §2). | I:747 |
| M-05 | Area pill | Same 6 pills with counts, 40 px buttons, horizontally scrollable strip bleeding to the screen edges (`margin:0 -16px; padding:0 16px`, hidden scrollbar). Not wired. | I:748, I:355-357 |
| M-06 | Week strip | 7-col grid gap 4, Mon 5 … Sun 11 Oct: tiles 58 px radius 8; day with filings = solid worst-status colour (upcoming navy) + white text, no border; empty = white + 1px border. Content: weekday letter (800 11, .8), day number (700 16 Space Grotesk), then up to 3 "●" dots (count of filings) — **today** shows a gold pulse dot instead and gets `box-shadow:0 0 0 2px var(--navy)`. Not clickable in prototype (build: tap = select day → filter agenda / scroll to it). | I:749 |
| M-07 | Agenda | Column gap 8: cards (min-height 56, white, border, radius 10, padding 8): 40×44 date tile (status colour, upcoming navy) · name (700 13 ellipsis) + area chip + status chip · chevron. Rows = due ≥ 7 Oct, first 6. Tap → should open the filing detail (bottom sheet). | I:750 |
| M-08 | Ask VCFO | Launcher scaled .8 at right 14 bottom 14. | I:752 |
| M-09 | Missing on phone | No donut, no Next-deadline card, no month grid, no Year/Timeline (by decision). | DECISIONS |

### 1.8 Empty / edge states (bot speaks)

| id | item | exact behaviour | file:line |
|---|---|---|---|
| E-01 | Empty month for an area filter | Over the (empty) grid: overlay `inset:44px 14px 14px` (below the weekday header), `oklch(97.4% .006 255/.7)` + 1px blur, radius 10, centred `botSay('No FEMA deadlines in May.<br>The next one is Softex on 30 Jun.', 56 px, actions: "🤖 Ask VCFO why" + navy "Show all areas")`. "Show all areas" → reset area pill to All. Copy needs next-occurrence lookup for that area. | I:727-733 |
| E-02 | All clear (rail) | Card with `botSay('All clear this month.<br>Nothing due, nothing overdue.', 40 px, no action)` — replaces Next deadline / donut when nothing due and nothing overdue. | I:734 |
| E-03 | No overdue (drill tab) | `botSay('Nothing overdue. Nice work.', 44)`. | I:920, I:1012 |
| E-04 | Free day (day pop-over) | `botSay('Nothing is due on this day.', 40)`. | I:921, I:985 |
| E-05 | Empty register (Filings) | `botSay('No filings yet for FY 2027-28.<br>They appear as each registration goes live.', 48)` + "Ask VCFO why". | I:923 |
| E-06 | First-time tip | `botSay('Tip: click any date to see its filings.', 40, secondary ghost "Got it")` — once per user (persist dismissal; per-viewer localStorage is fine). | I:924 |
| E-07 | Pre-incorporation (NOT drawn) | Not in the prototype. Real app shows `PreIncorporationNotice` (`src/components/compliances/PreIncorporationNotice.tsx`, client copy "Your compliance calendar and filings begin once your company is incorporated…"). Per rule 16 render it as a bot bubble (56 px) on both pages: "Your calendar starts after incorporation.<br>Nothing is due yet." with "Ask VCFO why"; keep the grid in its genuine empty state (no generated rows). Driven by `scope.preIncorporationIds` / `isIncorporated()`. | — |
| E-08 | Bot spec | Avatar 40/44/48/56 px idle bob; bubble 1–2 lines 13 px, max 300 px, tail to the bot; optional ghost "🤖 Ask VCFO why" or one navy action; never for errors/warnings (keep red/amber). Error state (Filings "Could not load the register") stays a plain error. | I:926-931 |

### 1.9 Breakpoints (live routes; `html.comp-live`)

| id | width | behaviour | file:line |
|---|---|---|---|
| B-01 | ≥1280 | Sidebar 248 px; search `clamp(180px,18vw,256px)`. | I:298, I:305 |
| B-02 | ≤1279 | Sidebar 72 px icon rail; search collapses to a 36 px icon button. | I:299, I:324-327 |
| B-03 | ≤1179 | `.cal-layout` → single column; rail = auto-fit grid (min 300 px cols), Coming up full width; `.fil-kpis` → single column. | I:328-333 |
| B-04 | ≤767 | Sidebar hidden (menu ☰ shown); top bar gap 6 / padding 0 8, 40 px buttons, no theme button, crumb icon + parent hidden; `.row-wrap>.end` margin-left 0; seg buttons, `.btn`, `.btn-s` 40 px; `.ibtn` 40×40; `.pbtn` 40×40 (negative margin); `.pchip` min-height 32; donut wraps; dd top bar & filings head wrap. Phones use the `#cal-mobile` design for the calendar. | I:300, I:334-349 |
| B-05 | any | Calendar grid min-width 540 inside a horizontal scroller; tables 720 (filings) / 560 (drill) min-width; drill tabs 480 min. | I:272-281 |
| B-06 | header | `.row-wrap:has(.calbar)` never wraps; the area pill shrinks and scrolls (`.seg-scroll`, hidden scrollbar). | I:28-38, I:272-274 |

---

## 2. DATA shown → real app mapping

Legend: **EXISTS** (use as is) · **ADAPT** (exists, needs a change) · **NEW** (build it; backend piece named).

### 2.1 The row model

Prototype row (I:406-420): `{id, due, area, name, period, filed, freq, auth}`; status derived (`status()` I:423).
Real row: `FilingRow` (`src/lib/compliance/filings.ts:23-46`): `id, engagementId, companyName, compliance (obligation.compliance_area), particular, authority, frequency, dueDate, filedOn, periodLabel, fyLabel, rawStatus, obligationId, windowFrom, windowTo`. Delivered by `useFilings({fyStartYear})` → `/api/filings?fy=` → `getFilings()`.

| prototype field | real source | status |
|---|---|---|
| `id` | `FilingRow.id` (compliance_instances.id) | EXISTS |
| `due` | `FilingRow.dueDate` | EXISTS |
| `name` | `FilingRow.particular` (e.g. "GSTR-3B Filing", "Form AOC-4", "Advance Tax Payment Q1") | ADAPT — the prototype shows short names ("GSTR-3B", "AOC-4 (financial statements)"). Add a display-name helper (strip " Filing"), or a `short_name` column on `compliance_obligations` (NEW, preferred; no form column exists — see TODO in `src/db/repositories/filings.ts:66-70`). |
| `area` (MCA/GST/IT/PAY/FEMA) | `complianceGroupForAuthority(row.authority)` in `src/lib/client/client-overview.ts:265` → 'GST' \| 'Income tax' \| 'Payroll' \| 'MCA' \| 'FEMA' \| 'Other' | EXISTS (+ NEW tiny map group→short code MCA/GST/IT/PAY/FEMA and full-name tooltip). Decide where 'Other' goes (seed authorities IT, GST, MCA, EPFO, ESIC, RBI all map; none fall to Other today). |
| `period` ("Sep 2026", "Jul–Sep 2026", "FY 2025-26") | `FilingRow.periodLabel` — formats vary: "Sep 2026" (monthly), "ITR FY 2025-26", "<particular> FY 2025-26", "<particular> 2026" (`src/lib/compliance/generate-instances.ts:109,132,161,172,182`) | ADAPT — select `period_start`/`period_end` too (columns exist, `schema.ts:589-590`, not selected in `getFilings`) and format consistently: same month → "Sep 2026"; multi-month → "Jul–Sep 2026"; FY → "FY 2025-26". Pure helper in `src/lib/compliance/filings.ts`. |
| `filed` | `FilingRow.filedOn` | EXISTS |
| `freq` | `FilingRow.frequency` (lower-case: monthly \| quarterly \| half-yearly \| annual \| one-time) | EXISTS (capitalise for display) |
| `auth` ("GSTN", "Income Tax Dept", "EPFO · ESIC", "RBI", "STPI", "State PT Dept") | `FilingRow.authority` (codes: IT, GST, MCA, EPFO, ESIC, RBI) | ADAPT — display map code → authority name. |
| status ok/due/over/up | `filingStatus(row, now)` → 'filed' \| 'due-soon' \| 'overdue' \| 'upcoming' (`src/lib/compliance/filings.ts:147`) | ADAPT — **threshold mismatch**: real `DUE_SOON_DAYS = 14` (`filings.ts:140`); prototype = **7** ("Due in 7 days", tooltip "Due within 7 days", I:423, I:433). Owner call: change the constant (also affects staff views/tests) or add a `dueSoonDays` option. Statutory list uses 7 (`statutoryStatus`). Key names map: ok→filed, due→due-soon, over→overdue, up→upcoming. |
| worst-of-day | — | NEW pure helper `worstStatus(rows)` (rank overdue > due-soon > upcoming > filed) in `src/lib/compliance/filings.ts`. |
| company (multi-company scope) | `FilingRow.companyName`, `scope.engagements`, `soleCompany`, `CompanyPicker` | EXISTS — client has one company → no picker (keep the existing rule). |

### 2.2 Calendar page

| UI element | data | real source | status |
|---|---|---|---|
| Month grid rows | rows of the viewed month | `useFilings({fyStartYear: financialYearForDate(month).startYear})` + `rowsInMonth(rows, monthKey)` (`filings.ts:211`) | EXISTS. Note: a month view straddling FY boundary is fine (month is wholly in one FY). Leading/trailing out-of-month days show no rows (prototype shows none). |
| Month grid geometry (Mon first, out days) | — | `buildStatutoryMonthGrid` in `src/components/admin/statutory-calendar-utils.ts:23` is **Sunday-first, 6 weeks** | NEW Monday-first helper (rows = needed weeks only) — keep pure + tested. |
| Selected month / view / area in URL | — | Calendar view already reads `?date=` (`ComplianceCalendarView.tsx:67`) | ADAPT — add `?view=month\|year\|timeline`, `?area=` (all\|mca\|gst\|it\|pay\|fema), keep `?date=`. |
| Area pill counts | rows per area in the viewed month | client-side count over month rows | EXISTS (derive) |
| FY chip | FY of viewed month | `financialYearLabel(financialYearForDate(month).startYear)` (`filings.ts:58-67`) | EXISTS |
| Month/year picker "now" ring + Today | current month | `new Date()` | EXISTS |
| Donut (month) | counts by status of month rows; total; month name | `rowsInMonth` + `filingStatus`; `summarise()` (`filings.ts:179`) gives due/overdue/filed but not upcoming/due-soon | ADAPT — add `countByStatus(rows, now)` helper. **Decision needed**: prototype donut is fixed to October (the demo month). Recommend donut = viewed month. |
| Next deadline (title, period, days left, area, portal) | first unfiled row with due ≥ today (sorted) | `sortByDueDate` + `filingStatus` | EXISTS (derive). Note prototype picks GSTR-1 (11 Oct) while PT payment 10 Oct is earlier → the prototype's pick is demo data; build: earliest unfiled due ≥ today. Should be relative to TODAY, not the viewed month. |
| Next deadline "✓ Data received" chip | whether the client sent the data for this filing | none | **NEW** — link instance ↔ document request (`document_requests` table exists, `schema.ts:673`) or a `data_received_at` column on `compliance_instances`. Until then hide the chip. |
| Next deadline (i) text | "GSTR-1 for Sep 2026 · due Sun 11 Oct · filed on the GSTN portal. Sales data received 3 Oct." | derived sentence | ADAPT (template from row) + NEW for "data received" date. "Ask VCFO about this" = `useAskOptional().ask({context:{kind:'compliance', ref: obligationId, label}})` (`src/components/ask/ask-context.ts:14-39`; `WhatsThisButton` already does this, `src/components/ask/WhatsThisButton.tsx`). |
| Overdue strip ("ECB-2 return · 1 day late") | earliest overdue row + days late (+count if >1) | `filingStatus === 'overdue'` | EXISTS (derive) |
| "Open filing" | open detail of that filing | — | NEW route state `?filing=<id>` (calendar pop-up) / Filings `?filing=<id>` (side panel) |
| "Remind me" | per-user reminder for one filing | none (notes: deliberately disabled). WhatsApp nudges exist only as a system cron (`systemListComplianceNudges`, `src/db/repositories/compliance.ts:290`) | **NEW** — `compliance_reminders` table (user_id, instance_id, remind_on, channels) + `POST/DELETE /api/filings/[id]/reminder` + repository with AuthContext scope + Inngest delivery via the existing email/WhatsApp dispatchers (`src/lib/email/send-email.ts`, `src/lib/notify/send-whatsapp.ts`). Until built: hide or keep disabled (owner). |
| Coming up rail | month rows with due ≥ today−1, first 7, grouped by date | derive | EXISTS (derive). Recommend: unfiled + recently filed from today−1. |
| Day pop-over rows | rows due that date | derive | EXISTS |
| Proof chip / Proof pending | filed + has proof? | `compliance_instances.evidence_url` exists (`schema.ts:598`) but is **not selected** by `getFilings` and is one URL only | ADAPT/NEW — see §2.4. |
| Portal ↗ | portal per filing | URLs exist as private constants in `src/lib/notifications/announcement-portals.ts:41-66` (GST_LOGIN, IT_FO, MCA_FO, EPFO, ESIC, TGCT, FIRMS, FLAIR, STPI); TRACES missing | **NEW** helper `portalFor(row)` (prefer obligation-level: add `portal_key`/`portal_url` column on `compliance_obligations`, seeded in `src/lib/compliance/obligations-seed.ts`; fallback rules from I:483-490). Export the constants rather than duplicating. |
| Detail pop-up facts: Authority, Frequency, Period, Penalty risk | | authority/frequency in FilingRow; period → period_start/end; `compliance_obligations.penalty_risk` exists (`schema.ts:555`) but not selected | ADAPT — add `penaltyRisk`, `periodStart`, `periodEnd` to `getFilings` select + `FilingRow`. |
| Detail pop-up "12 days left" | due − today | derive | EXISTS |
| Focus track (Data received → SBC preparing (since, who) → Northwind approves (by) → Filed) | workflow steps + dates + owner | `rawStatus` (`upcoming\|in-progress\|filed\|overdue`) and `owner_id` exist; no step dates, no approval | **NEW (build later per decision)** — `compliance_instance_events` (instance_id, step: data_received \| preparing \| sent_for_approval \| approved \| filed, at, by) or columns; owner display name via `profiles`. Show as design only until data exists — minimal honest version: Filed ✓ (filed_on) else "With SBC" if rawStatus=in-progress. |
| Gold notice "SBC will send the draft for Northwind's approval by 17 Oct." | approval due date | none | NEW (with approval workflow) |
| "Add to my calendar" (.ics) | single filing ICS | none (no `.ics` code in repo) | NEW `GET /api/filings/[id]/ics` (and FY feed) — pure ICS builder in `src/lib`. |
| Year view | FY rows (12 months Apr–Mar) | `useFilings({fyStartYear})` + `financialYearMonths` (`filings.ts:94`) | EXISTS |
| Timeline windows | window start/end per filing | `FilingRow.windowFrom/windowTo` (`compliance_instances.window_from/to`), write `POST /api/filings/[id]/window` (manager roles only; `setFilingWindowInDb`, `ScheduleWindowControl` in `src/components/schedule/`) | EXISTS for read. **Conflict**: prototype lets the client drag windows (sessionStorage). Clients cannot write windows. Recommend: client timeline read-only (bars locked, no drag/Undo, tooltip "Set by SBC"); default window when null = due − PREP days. If the owner wants client edits → NEW permission + audit. Timeline range: prototype Sep→Mar fixed; build: whole FY or current FY from previous month. |
| Empty month bot "next one is Softex on 30 Jun" | next row of that area after this month | needs rows beyond the FY sometimes | derive from FY rows; if none in FY say "No FEMA deadlines this year." |
| Pre-incorporation | | `scope.preIncorporationIds`, `isIncorporated()` (`src/lib/compliance/incorporation-state.ts:47`), `PreIncorporationNotice` copy | EXISTS — restyle as bot bubble. |

### 2.3 Filings page

| UI element | data | real source | status |
|---|---|---|---|
| FY stepper | FY start year | `?fy=`, `financialYearLabel`, next-FY cap `currentFy+2` (`FilingsView.tsx:286`) | EXISTS |
| Cadence pill Monthly/Quarterly/Annual | | `?cadence=`, `rowsForCadence` (`filings.ts:202`; quarterly includes half-yearly; annual includes one-time) | EXISTS |
| Donut (filings) | status counts of rows in view | derive | ADAPT (`countByStatus`) |
| By area bars | per area filed/overdue/due/upcoming, f/total | derive via `complianceGroupForAuthority` | EXISTS (derive) |
| Area pill | | NEW `?area=` param + filter | NEW (client) |
| Status pill (All · Overdue · Due soon · Upcoming · Filed) | | `?status=`, `FILING_STATUS_FILTERS` (`compliance-scope.ts:303`; order all, due-soon, upcoming, overdue, filed), `rowsForStatus` | EXISTS — reorder labels to prototype order. |
| Period window "Sep – Oct 2026" ‹ › | | `?period=` month + `stepMonth` (`FilingsView.tsx:141-145`) | ADAPT (2-month window) — or keep 1 month; owner call. |
| "Full year" | | `?view=year` | EXISTS (but redesign shows a list, not the matrix) |
| Table columns | due tile, area, name+period, frequency, filed on / in N days / N days late, status, proof | all from FilingRow + derive | EXISTS except proof (§2.4). Drop the manager "Window" column for clients (prototype note I:776). |
| Export | | none | NEW `GET /api/filings/export?fy=&cadence=&area=&status=` (CSV first; XLSX later). |
| Side panel facts: ARN, Tax paid, Filed by | | none (`filed_note` free text exists `schema.ts:597`) | **NEW columns** on `compliance_instances`: `acknowledgement_no` (ARN/SRN/CIN/token), `amount_paid` (numeric, INR), `filed_by` (uuid → profiles) — written by staff when marking filed. |
| Side panel "2 days early" | due − filed_on | derive | EXISTS |
| Side panel proof list (name, size, date, preview, download) | | see §2.4 | NEW |
| Calendar link | | `<base>/calendar?date=` | EXISTS |

### 2.4 Proof files (rule 15) — NEW backend

- Today: single `compliance_instances.evidence_url` text (and `compliance_events.evidence_url`) — never surfaced to clients (prototype note I:777).
- Needed: **many files per filing** (acknowledgement + challan). Recommend new table `compliance_instance_proofs` (id, instance_id FK cascade, storage_path, file_name, mime, size_bytes, kind: acknowledgement\|challan\|certificate\|other, uploaded_by, uploaded_at) stored in S3 bucket `engagement-documents` via `src/storage/s3.ts` (`putObject`, `signedDownloadUrl`, `bucketKey`). Repository `src/db/repositories/compliance-proofs.ts` (AuthContext: client read own engagement; staff write per RLS table in `src/db/repositories/README.md`) + cross-tenant test. Routes: `GET /api/filings/[id]/proofs` (list + signed URLs), `POST` (staff upload), `GET /api/filings/[id]/proofs/[proofId]` (redirect to signed URL / stream for preview).
- `FilingRow` gains `proofCount` (or `hasProof`) so the register can show "📎 Proof" vs amber "Proof pending" without a second query. Proof pending = `filedOn && proofCount === 0`. Migrate any existing `evidence_url` into one proof row.
- Preview: reuse the shared document preview overlay used by Documents (rule 9) — there is no shared preview component in `src/components` yet (G-17 is NEW UI).

### 2.5 Things the prototype data has that the real register does not generate

`obligations-seed.ts` (26 obligations) has no: Professional tax payment, TCS return/challan (separate), ECB-2, Softex, ITC-04, PF & ESI combined monthly (it has EPF monthly + ESI half-yearly). Demo screens will look sparser than the prototype; do not fabricate rows (notes: "Nothing here fabricates"). Adding obligations = seed change + `generate-instances` rules (owner call). Also notes: "the demo FY 2026-27 register has no monthly-frequency instances at all" — seed demo data must be fixed for a realistic pilot.

### 2.6 Hooks / functions to add (pure, in `src/lib/compliance/filings.ts` or `src/lib/compliance-ui.ts`)

`worstStatus`, `countByStatus`, `areaOf(row)` (wraps `complianceGroupForAuthority` → short code), `AREA_LABEL/AREA_FULL`, `displayName(row)`, `displayPeriod(row)`, `authorityName(code)`, `daysLeft(due, now)`, `nextDeadline(rows, now)`, `firstOverdue(rows, now)`, `comingUp(rows, now, n=7)`, `mondayMonthGrid(monthKey)`, `defaultWindow(row)` (PREP days), `portalFor(row)`. All with unit tests (golden rule 5).

---

## 3. LAYOUT AND CSS

Fonts in the real app already load Manrope (`--font-sans`), Space Grotesk (`--font-serif` hook), IBM Plex Mono (`--font-mono`) (`app/layout.tsx:2-23`). The real `app/globals.css` has **no `--navy`, `--gold*`, `--ok/--due/--over/--up` tokens** — add them (light + dark) exactly as below; map `--ok` ≈ existing `--success`, etc., only if the values match.

### 3.1 Tokens (verbatim)

Light (I:46-58):

```css
:root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
--primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);
--navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
--ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
--due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
--over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
--prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);
--up:oklch(82% 0.018 255);--up-light:oklch(96.6% 0.007 255);--up-text:oklch(46% 0.028 258);
--violet:oklch(54% 0.17 292);--violet-light:oklch(96.4% 0.032 292);
--shadow:0 1px 2px oklch(25% 0.04 264 / .04),0 6px 18px -10px oklch(28% 0.06 264 / .18);
--pop:0 16px 40px -12px oklch(21% 0.042 264 / .35);
--spring:linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004);
/* canvas chrome */--cv:oklch(93% 0.008 255)}
```

`--navy-ink` (text that is navy in light mode) defaults to `--navy`; `--primary-fill` defaults to `--primary`.

Dark (`html[data-theme="dark"]`, P:38-53, relevant subset verbatim):

```css
--bg:#000;--panel:oklch(13% 0.006 260);--raised:oklch(17% 0.008 260);--border:oklch(24% 0.01 260);--hair:oklch(19% 0.008 260);
--fg:oklch(92% 0.005 260);--muted:oklch(72% 0.008 260);--subtle:oklch(60% 0.01 260);
--primary:oklch(68% 0.16 255);--primary-dark:oklch(76% 0.13 255);--primary-light:oklch(22% 0.06 258);--primary-chip:oklch(50% 0.17 258);
--navy:oklch(46% 0.15 258);--navy-ink:oklch(94% 0.008 255);--navy-2:oklch(52% 0.15 258);--navy-3:oklch(56% 0.15 255);
--navy-deep:oklch(19% 0.05 258);--navy-2-deep:oklch(23% 0.07 258);--navy-3-deep:oklch(29% 0.1 255);--primary-fill:oklch(52% 0.19 258);--primary-fill-2:oklch(58% 0.18 258);
--gold:#e0bd66;--gold-2:#ecd08a;--gold-soft:oklch(25% 0.05 85);--gold-text:#e8c97d;
--ok:oklch(68% 0.14 165);--ok-light:oklch(23% 0.05 165);--ok-text:oklch(80% 0.1 165);--ok-chip:oklch(50% 0.12 165);
--due:oklch(74% 0.15 62);--due-light:oklch(25% 0.06 60);--due-text:oklch(84% 0.11 68);--due-chip:oklch(54% 0.15 45);
--over:oklch(66% 0.19 22);--over-light:oklch(23% 0.07 22);--over-text:oklch(80% 0.12 22);--over-chip:oklch(52% 0.19 22);
--prog:oklch(66% 0.15 252);--prog-light:oklch(23% 0.06 252);--prog-text:oklch(80% 0.1 252);--prog-chip:oklch(50% 0.16 252);
--up:oklch(40% 0.015 255);--up-light:oklch(18% 0.008 255);--up-text:oklch(72% 0.01 255);--up-chip:oklch(40% 0.02 258);
--shadow:0 0 0 1px oklch(20% 0.008 260);--pop:0 18px 44px -12px rgba(0,0,0,.9)
/* document previews are a light-only island: [data-paper]{color-scheme:light;background:#fff!important; …light tokens…} */
```

Hard-coded grid-line colours in FINAL that need a dark counterpart: `#9aa8bb` (lines; not themed in the prototype — use e.g. `light-dark(#9aa8bb, oklch(32% .012 258))`), `#eef2f8` header/today/chip tint → dark `oklch(19% 0.009 258.3)`, `#f7f9fc` hover → dark `oklch(15.8% 0.005 258.3)`, `#a9b4c4` out-of-month digits, `#d5dce6` year inner lines → dark `oklch(26.3% 0.012 257.2)`.

### 3.2 Key component CSS (verbatim, grouped)

Cards, chips, buttons, pills (I:112-136):

```css
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:0;position:relative}
.card.t::before{content:"";position:absolute;left:18px;top:-1px;width:38px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
.st{font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--navy-ink,var(--navy));margin:0}
.metric{font-family:"Space Grotesk",Manrope;font-weight:600;letter-spacing:-.035em;font-feature-settings:"tnum"}
.mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px;white-space:nowrap}
.c-ok{background:var(--ok-light);color:var(--ok-text)}.c-due{background:var(--due-light);color:var(--due-text)}.c-over{background:var(--over-light);color:var(--over-text)}.c-up{background:var(--up-light);color:var(--up-text);box-shadow:inset 0 0 0 1px var(--border)}.c-prog{background:var(--prog-light);color:var(--prog-text)}
.area{display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:4px;font:700 11px "IBM Plex Mono";letter-spacing:.02em;color:var(--navy-ink,var(--navy));background:light-dark(oklch(95% 0.012 255), oklch(20.5% 0.01 255));box-shadow:inset 0 0 0 1px oklch(88% 0.02 255)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:6px;font:600 13px Manrope;border:1px solid transparent;cursor:pointer;white-space:nowrap;transition:transform .12s,background .15s}
.btn:active{transform:scale(.98)}
.btn-n{background:var(--navy);color:#fff}.btn-n:hover{background:var(--navy-2)}
.btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
.btn-s{height:30px;padding:0 10px;font-size:12px}
.ibtn{width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:grid;place-items:center;cursor:pointer}
.ibtn:hover{color:var(--navy-ink,var(--navy));border-color:oklch(54.6% 0.215 263 / .35)}
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:auto;padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
.seg>.thumb{position:absolute;top:2px;bottom:2px;left:0;border-radius:6px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s var(--spring),width .42s var(--spring)}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;gap:6px;border:0;background:none;height:30px;padding:0 12px;border-radius:6px;font:500 12.5px Manrope;color:light-dark(oklch(50% 0.022 255), oklch(80% 0.015 255));cursor:pointer;white-space:nowrap;transition:color .2s}
.seg button.on{color:#fff;font-weight:600}
.seg .cnt{font:600 11px "IBM Plex Mono";color:oklch(55% 0.022 255)}
.seg button.on .cnt{color:oklch(100% 0 0 / .72)}
.seg .dot{width:7px;height:7px;border-radius:99px}
```

Calendar header line (I:27-40):

```css
.row-wrap:has(.calbar){flex-wrap:nowrap!important;position:relative;z-index:6}
.row-wrap:has(.calbar)>.end{flex:none}
.calbar{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0}
.calbar>[data-calnavr]{flex:none;position:relative;z-index:30}
.calbar>.mono{flex:none;align-self:stretch;display:inline-flex;align-items:center;font-size:10.5px!important;padding:0 8px!important;border-radius:7px!important}
.calbar>.seg-scroll{flex:0 1 auto;min-width:0}
.row-wrap:has(.calbar) .seg button{height:28px;padding:0 9px;font-size:12px;gap:4px}
.row-wrap:has(.calbar) .seg .cnt{font-size:10px}
.calbar [data-calnavr] .ibtn{width:24px!important;height:28px!important}
.calbar .mpk-lbl{min-width:0}
.calbar .mpk-b{height:28px;padding:0 6px;font-size:13px}
.mpk-pop{left:0;right:auto}
```

Header markup (I:671, I:672-680, I:687 — rendered):

```html
<div class="row-wrap" style="display:flex;align-items:center;gap:12px">
  <div data-calnav class="calbar">
    <div data-calnavr>
      <div style="display:flex;align-items:center;gap:2px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:2px">
        <button class="ibtn" style="border:0;width:28px;height:28px" aria-label="Previous month">‹(chevL 15)</button>
        <span class="mpk-lbl">
          <button type="button" class="mpk-b" data-pk="m" aria-haspopup="dialog" aria-label="Choose month"><span>October</span><svg 12 chevD/></button>
          <button type="button" class="mpk-b" data-pk="y" aria-haspopup="dialog" aria-label="Choose year"><span>2026</span><svg 12 chevD/></button>
        </span>
        <button class="ibtn" style="border:0;width:28px;height:28px" aria-label="Next month">›(chevR 15)</button>
      </div>
    </div>
    <span class="mono" style="flex:none;font-size:11px;font-weight:600;padding:5px 8px;border-radius:5px;background:var(--gold-soft);color:var(--gold-text)">FY 2026-27</span>
    <div class="seg-scroll"><div class="seg" role="tablist"><span class="thumb"></span>
      <button role="tab" class="on" aria-selected="true">All<span class="cnt">13</span></button> … MCA 2 · GST 3 · Income tax 4 · Payroll 2 · FEMA 2
    </div></div>
  </div>
  <div class="end" style="margin-left:auto;display:flex;align-items:center;gap:8px">
    <span data-calview style="display:contents"><div class="seg" role="tablist">Month · Year · Timeline</div></span>
    <a class="btn btn-o btn-s" style="color:var(--navy-ink,var(--navy))">(file 14) Filings</a>
  </div>
</div>
```

Month / year picker (I:2-26):

```css
.mpk-lbl{display:flex;align-items:center;justify-content:center;min-width:150px}
.mpk-b{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border:0;border-radius:6px;background:none;font:700 14px 'Space Grotesk',Manrope,sans-serif;color:var(--fg);cursor:pointer}
.mpk-b svg{color:var(--muted)}
.mpk-b:hover,.mpk-b[aria-expanded=true]{background:var(--raised)}
.mpk-b:focus-visible{outline:2px solid var(--navy);outline-offset:1px}
[data-calnavr]{position:relative}
.mpk-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:304px;background:var(--panel);border:1px solid var(--border);border-radius:14px;box-shadow:0 18px 40px -16px oklch(21% 0.042 264 / .35);padding:12px;box-sizing:border-box}
.mpk-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:10px}
.mpk-mid{display:flex;align-items:center;gap:4px}
.mpk-ar{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--navy-ink,var(--navy));display:grid;place-items:center;cursor:pointer;flex:none}
.mpk-ar:hover{background:var(--raised)}
.mpk-hb{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:0;border-radius:8px;background:none;font:700 14px 'Space Grotesk',Manrope,sans-serif;color:var(--fg);cursor:pointer}
.mpk-hb svg{color:var(--muted)}
.mpk-hb.on,.mpk-hb:hover{background:var(--raised)}
.mpk-g{display:grid;gap:4px}
.mpk-g.m{grid-template-columns:repeat(3,minmax(0,1fr))}
.mpk-g.y{grid-template-columns:repeat(4,minmax(0,1fr));max-height:240px;overflow:auto;scrollbar-width:thin}
.mpk-g button{height:42px;border:0;border-radius:9px;background:none;color:var(--navy-ink,var(--navy));font:500 14px 'Space Grotesk',Manrope,sans-serif;cursor:pointer}
.mpk-g.y button{font:500 13.5px 'IBM Plex Mono',monospace}
.mpk-g button:hover{background:var(--raised)}
.mpk-g button.now{box-shadow:inset 0 0 0 1px var(--navy)}
.mpk-g button.on{background:var(--navy);color:#fff;box-shadow:none}
.mpk-g button:focus-visible,.mpk-ar:focus-visible,.mpk-hb:focus-visible{outline:2px solid var(--navy);outline-offset:1px}
.mpk-ft{display:flex;justify-content:flex-end;border-top:1px solid var(--hair);margin-top:10px;padding-top:9px}
.mpk-ft button{border:0;background:none;color:var(--navy-ink,var(--navy));font:600 13px Manrope,system-ui,sans-serif;cursor:pointer;padding:2px 4px;border-radius:5px}
```

Picker markup (CV:262-277): `.mpk-hd` › `button.mpk-ar[data-mv=-1]` (15 px chevron-left) · `span.mpk-mid` › `button.mpk-hb(.on)[data-md=m]` "October⌄" + `button.mpk-hb[data-md=y]` "2026⌄" · `button.mpk-ar[data-mv=1]`; then `.mpk-g.m[role=grid]` of 12 `button[data-m]` "Jan…Dec" (`.on` + `aria-current=date` / `.now`) or `.mpk-g.y` of 32 `button[data-y]`; then `.mpk-ft` › `button[data-today]` "Today".

**Month grid — base rules then FINAL overrides (the overrides win; replicate the final computed result)**

Base (I:153-181):

```css
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.dow{font:800 11px Manrope;letter-spacing:.08em;text-transform:uppercase;color:var(--subtle);padding:0 6px 2px}
.day{position:relative;min-width:0;overflow:hidden;font:inherit;color:inherit;height:96px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:7px;display:flex;flex-direction:column;gap:4px;cursor:pointer;transition:transform .16s,box-shadow .16s,border-color .16s;text-align:left}
.day.out{background:transparent;border-style:dashed;border-color:light-dark(oklch(90% 0.01 255), oklch(26% 0.01 255));cursor:default}
.dn{display:flex;align-items:center;gap:6px}
.dt{min-width:26px;height:26px;border-radius:6px;display:grid;place-items:center;font:700 13px "Space Grotesk";color:var(--fg)}
.day.s-up .dt{background:var(--navy);color:#fff}
.day.s-over .dt{background:var(--over);color:#fff}
.day.s-due .dt{background:var(--due);color:#fff}
.day.s-ok .dt{background:var(--ok);color:#fff}
.ev{display:flex;align-items:center;gap:5px;height:20px;padding:0 6px 0 0;border-radius:4px;background:light-dark(oklch(100% 0 0 / .75), oklch(13% 0 0 / 0.75));font-size:11px;font-weight:700;color:var(--fg);overflow:hidden;white-space:nowrap}
.ev i{width:3px;align-self:stretch;flex:none;border-radius:4px 0 0 4px}
.ev .a{font:700 11px "IBM Plex Mono";color:var(--muted);flex:none}
.ev .t{overflow:hidden;text-overflow:ellipsis}
.more{font-size:11px;font-weight:800;color:var(--primary);padding-left:2px}
.pulse{width:7px;height:7px;border-radius:99px;background:var(--gold);animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .7)}50%{box-shadow:0 0 0 5px oklch(80% 0.12 85 / 0)}}
.day{container-type:inline-size}
.tlabel .tl-t{overflow:hidden}
@container (max-width:96px){.tlabel .tl-t{display:none}.ev .a{display:none}}
.cal-scroll{overflow-x:auto;padding:4px;margin:-4px}
.cal-scroll>.cal{min-width:540px}
```

FINAL grid-lines override (I:358-377) — **this is the look to build**:

```css
/* ---------- calendar · grid lines (Calendar Date Separation, option 1) ----------
   one table: thin lines between every date, tinted weekday header, today = the whole navy-outlined box */
.cal{gap:0;border:1px solid #9aa8bb;border-bottom:0;border-radius:8px;overflow:hidden;background:var(--panel)}
.cal .dow{padding:7px 8px;background:light-dark(#eef2f8, oklch(19% 0.009 258.3));border-bottom:1px solid #9aa8bb;color:var(--muted)}
.cal .dow.we{color:var(--muted)}
.cal .day{height:96px;border:0;border-radius:0;border-right:1px solid #9aa8bb;border-bottom:1px solid #9aa8bb;background:var(--panel);padding:7px 8px;transition:background .15s}
.cal>:nth-child(7n){border-right:0}
.cal .day:hover{transform:none;box-shadow:none;border-color:#9aa8bb;background:light-dark(#f7f9fc, oklch(15.8% 0.005 258.3))}
.cal .day.out,.cal .day.out:hover{background:var(--panel);border-style:solid;border-color:#9aa8bb}
.cal .day.out .dt{color:#a9b4c4}
.cal .day.we:not(.out),.cal .day.s-over,.cal .day.s-due,.cal .day.s-ok{background:var(--panel);border-color:#9aa8bb}
.cal .day.we:not(.out):hover,.cal .day.s-over:hover,.cal .day.s-due:hover,.cal .day.s-ok:hover{background:light-dark(#f7f9fc, oklch(15.8% 0.005 258.3))}
.cal .dt{min-width:24px;height:24px;border-radius:4px;font:700 13px Manrope,sans-serif}
.cal .day.today{box-shadow:inset 0 0 0 2px var(--navy);background:light-dark(#eef2f8, oklch(19% 0.009 258.3))}
.cal .day.today .tlabel{display:none}
.cal .day.sel{box-shadow:inset 0 0 0 2px var(--primary);z-index:auto}
.cal .day.today.sel{box-shadow:inset 0 0 0 2px var(--navy),inset 0 0 0 4px var(--primary)}
.cal .ev{height:20px;padding:0 6px 0 0;gap:6px;border-radius:3px;background:light-dark(#eef2f8, oklch(19% 0.009 258.3));font-weight:600}
.cal .ev i{border-radius:3px 0 0 3px}
.cal .ev .a{display:none}
```

Computed FINAL cell, for a Tailwind/CSS-module port:
- Grid: 7 equal columns, no gap, outer 1px `#9aa8bb` on top/left/right, radius 8, clip; each cell draws its own right (except col 7) and bottom 1px `#9aa8bb`.
- Header cells: padding 7px 8px, `#eef2f8`, 800 11px Manrope uppercase .08em, `--muted`.
- Day cell: 96 px tall, padding 7px 8px, column flex gap 4, white; hover `#f7f9fc` (.15s); text-left; it's a `<button>` (in-month) or `<div>` (out-of-month).
- `.dn` row: flex, gap 6: `.dt` (24×24, radius 4, 700 13 Manrope) + optional count at right (mono 11 muted, `margin-left:auto`).
- Event chip: 20 px, radius 3, `#eef2f8`, 600 11px, gap 6, `<i>` 3 px status bar flush left (radius `3px 0 0 3px`), ellipsis name.
- "+N more": 800 11 primary.

Day markup (I:619-623, rendered for 15 Oct):

```html
<button class="day s-due" data-iso="2026-10-15" data-tip="Thu, 15 Oct · 2 filings" aria-label="Thursday, 15 October, 2 filings">
  <div class="dn"><span class="dt">15</span><span class="mono" style="margin-left:auto;font-size:11px;color:var(--muted)">2</span></div>
  <span class="ev" data-s="due"><i style="background:var(--due)"></i><span class="a">PAY</span><span class="t">PF &amp; ESI payment</span></span>
  <span class="ev" data-s="due"><i style="background:var(--due)"></i><span class="a">IT</span><span class="t">TCS return Q2</span></span>
</button>
```

(Weekend columns get class `we`, today gets `today` — no Today label visible in FINAL.)

Agenda / date tile (I:182-190):

```css
.ag-date{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--hair)}
.ag-date:first-child{border-top:0}
.dtile{width:44px;height:48px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;color:#fff}
.dtile b{font:700 18px/1 "Space Grotesk"}
.dtile small{font:800 11px Manrope;letter-spacing:.03em;text-transform:uppercase;opacity:.85;margin-top:2px}
.ag-items{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.ag-it{display:flex;align-items:center;gap:8px;min-width:0}
.ag-it .nm{font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
```

Coming up markup (I:667-668): `.card` padding `14px 16px 6px` › header flex gap 8 mb 4: `p.st` flex 1 "Coming up" + `span.mono` 11 muted count › `.ag-date` × N (`.dtile` bg = status var, upcoming navy; `.ag-items` › `.ag-it` = `.area` + `span.nm` + `.chip`).

Donut card (I:780-786; live width I:314):

```html
<div class="card t donut" style="padding:12px 16px;display:flex;gap:16px;align-items:center">
  <svg width="88" height="88" viewBox="0 0 88 88">
    <!-- for s in ok,due,over,up: len = C*count/total, C = 2π·35 -->
    <circle data-dd="status" data-k="ok" data-set="oct" data-tip="Filed · 1" cx="44" cy="44" r="35" fill="none" stroke="var(--ok)" stroke-width="11" stroke-dasharray="{max(len-2,0)} {C}" stroke-dashoffset="{-acc}" transform="rotate(-90 44 44)"/>
    … due (var(--due)), over (var(--over)), up (var(--up)) …
    <circle data-dd="status" data-k="all" data-set="oct" data-tip="All filings · 13" cx="44" cy="44" r="29" fill="transparent"/>
    <text pointer-events="none" x="44" y="42" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="20" fill="var(--fg)">13</text>
    <text pointer-events="none" x="44" y="57" text-anchor="middle" font-family="Manrope" font-weight="600" font-size="11" fill="var(--muted)">October</text>
  </svg>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:6px 16px;flex:1 1 220px;min-width:0">
    <div data-dd="status" data-k="ok" data-set="oct" data-tip="Filed · 1" style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600">
      <i style="width:10px;height:10px;border-radius:3px;background:var(--ok)"></i><span style="flex:1">Filed</span><b class="mono">1</b></div>
    … Due soon 4 · Overdue 1 · Upcoming 7 (swatch var(--up)) …
  </div>
</div>
```

```css
html.comp-live .donut svg{width:clamp(88px,5.6vw,112px);height:auto;flex:none}
[data-dd]{cursor:pointer}
span[data-dd]:hover,div[data-dd]:not(.kpi):hover{filter:brightness(1.06);box-shadow:0 0 0 2px oklch(54.6% 0.215 263 / .25)}
circle[data-dd]{transition:stroke-width .15s}circle[data-dd]:hover{stroke-width:15}
```

Next deadline card A (I:629-651, v='A' resolved):

```html
<div class="card" style="background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:16px 16px 14px;color:var(--fg);overflow:hidden">
  <div style="display:flex;align-items:center;gap:6px;font:800 11px Manrope;letter-spacing:.08em;text-transform:uppercase;color:var(--navy)"><span class="pulse"></span>Next deadline</div>
  <div style="display:flex;gap:14px;align-items:center;margin-top:10px">
    <div data-dd="status" data-k="due" data-set="oct" data-tip="GSTR-1 · due Sun 11 Oct" style="width:58px;height:62px;border-radius:10px;background:var(--navy);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none">
      <b class="metric" style="font-size:28px;line-height:1;color:inherit">3</b><small style="font:800 11px Manrope;letter-spacing:.04em;opacity:.85">DAYS</small></div>
    <div style="min-width:0;flex:1">
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;font:700 18px 'Space Grotesk';letter-spacing:-.02em">GSTR-1 · Sep 2026 [portal ↗ .pbtn] [(i) .info]</div>
      <div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:6px"><span class="area">GST</span><span class="chip c-ok">✓(11) Data received</span></div>
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:14px">
    <button class="btn btn-s" style="background:var(--navy);color:#fff;flex:1">Open filing →(13)</button>
    <button class="btn btn-s" style="background:var(--panel);color:var(--fg);border-color:var(--border)">Remind me</button>
  </div>
  <div data-dd="status" data-k="over" data-set="oct" data-tip="Overdue · 1" style="margin:14px -16px -14px;padding:10px 16px;border-top:1px solid var(--hair);display:flex;align-items:center;gap:8px;font-size:12.5px">
    <i style="width:8px;height:8px;border-radius:99px;background:var(--over);flex:none"></i><b style="font-weight:700">ECB-2 return</b>
    <span style="color:var(--over-text);font-weight:700">1 day late</span><span style="margin-left:auto;color:var(--muted);display:flex">›(14)</span></div>
</div>
```

Day pop-over (I:194-195, I:285-286; live content I:985; row I:699):

```css
.dpop{position:absolute;z-index:45;width:min(320px,calc(100vw - 24px));background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--pop);padding:12px}
.dpop::before{content:"";position:absolute;left:-7px;top:34px;width:12px;height:12px;background:var(--panel);border-left:1px solid var(--border);border-bottom:1px solid var(--border);transform:rotate(45deg)}
.dpop.flip::before{left:auto;right:-7px;transform:rotate(-135deg)}
.dpop.below::before{display:none}
```

```html
<div class="dpop" style="left:{cell.right+12}px;top:{cell.top-8}px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
    <div class="dtile" style="background:var(--due);width:40px;height:44px"><b style="font-size:16px">15</b><small>Thu</small></div>
    <div style="flex:1"><b style="font-size:14px">Thursday 15 October</b><div style="font-size:11.5px;color:var(--muted);font-weight:700">2 filings</div></div>
    <button class="ibtn" style="border:0" aria-label="Close" data-x>✕(14)</button>
  </div>
  <!-- dayRow -->
  <div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;cursor:pointer">
    <span class="area">PAY</span>
    <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12.5px"><span style="display:inline-flex;align-items:center;gap:4px">PF &amp; ESI payment [.pbtn ↗]</span></div><div style="font-size:11px;color:var(--muted)">Sep 2026</div></div>
    [proof chip if filed] <span class="chip c-due">[glyph prog 12] Due soon</span>
  </div>
  …
  <div class="ask">🤖 Ask VCFO</div>
</div>
```

`.ask{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--hair);color:var(--primary);font-weight:700}` (I:144).

Detail pop-up (calendar) and side panel (filings) (I:192-193, I:707-722, I:814-823):

```css
.scrim{position:absolute;inset:0;background:oklch(21% 0.042 264 / .38);backdrop-filter:blur(2px);z-index:50}
.modal{position:absolute;z-index:60;background:var(--panel);border-radius:12px;box-shadow:0 30px 70px -20px oklch(21% 0.042 264 / .55);border:1px solid var(--border)}
```
- Calendar pop-up: `.modal` inline `left:50%;top:90px;transform:translateX(-50%);width:600px`; header `padding:18px 20px;border-bottom:1px solid var(--hair);display:flex;gap:14px;align-items:flex-start`; tile `.dtile` 56×62 navy `b` 24 px, `small` "Oct · Tue"; chips row `display:flex;gap:6px;margin-bottom:6px`; title `font:700 22px 'Space Grotesk';letter-spacing:-.02em;display:flex;align-items:center;gap:6px`; body `padding:18px 20px;display:flex;flex-direction:column;gap:18px`; facts `display:grid;grid-template-columns:repeat(4,1fr);gap:10px`, each `padding:10px;border-radius:8px;background:var(--raised)`, label `font:800 10px Manrope;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)`, value `font-weight:700;margin-top:4px`; notice `display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--gold-soft);color:var(--gold-text);font-weight:600;font-size:12.5px`; footer `padding:12px 20px;border-top:1px solid var(--hair);display:flex;gap:8px;align-items:center`.
- Filings side panel: `.modal` inline `right:24px;top:24px;bottom:24px;width:520px;display:flex;flex-direction:column`; title 21 px; body `flex:1;overflow:auto`; facts 2 columns; proof row `display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px` (first: `border-color:oklch(54.6% 0.215 263 / .4);background:var(--primary-light)`), PDF tile `width:34px;height:40px;border-radius:4px;background:var(--over);color:#fff;font:800 9px Manrope`. In the live app make the panel `position:fixed`, full-height on phones, slide-in from right (prototype has no slide animation; suggest 200 ms translateX with the `fadeUp` easing `cubic-bezier(.22,1,.36,1)`).

Focus track (I:257-269):

```css
.ft{display:flex;align-items:center;padding:4px 18px 38px}
.ft-st{position:relative;flex:none;width:28px;height:28px}
.ft-l{position:absolute;top:34px;left:50%;transform:translateX(-50%);width:max-content;max-width:100px;text-align:center;font-size:11.5px;font-weight:700;line-height:1.2;display:flex;flex-direction:column}
.ft-l small{font-weight:500;color:var(--muted);font-size:11px}.ft-l.muted{color:var(--muted)}
.ft-line{flex:1;min-width:22px;height:5px;border-radius:9px;margin:0 6px}
.ft-line.done{background:var(--ok)}
.ft-line.todo{background:radial-gradient(circle,light-dark(oklch(80% 0.015 255), oklch(36% 0.015 255)) 2.2px,transparent 2.6px) 0 50%/9px 5px repeat-x}
.ft-cur{flex:none;display:flex;align-items:center;gap:10px;min-width:188px;max-width:230px;padding:10px 14px 10px 10px;border-radius:12px;background:var(--navy);color:#fff;box-shadow:0 8px 22px -6px oklch(21% 0.042 264 / .45);position:relative}
.ft-cur::after{content:"";position:absolute;inset:-1px;border-radius:inherit;animation:ftpulse 1.9s ease-out infinite;pointer-events:none}
@keyframes ftpulse{0%{box-shadow:0 0 0 0 var(--gold)}100%{box-shadow:0 0 0 9px transparent}}
.ft-ic{flex:none;width:32px;height:32px;border-radius:8px;background:var(--gold);color:#1d1600;display:grid;place-items:center}
.ft-eye{font:800 11px Manrope;letter-spacing:.08em;text-transform:uppercase;color:#f3d58a}
.ft-cur b{font-size:14px;line-height:1.2}.ft-cur small{font-size:11.5px;opacity:.85}
```

Drill-down (I:242-245, I:279-281, I:315-316):

```css
.ddscrim{position:absolute;inset:0;background:oklch(20% 0.05 258 / .55);z-index:90}
.dd{position:absolute;z-index:91;left:calc(50% - 380px);top:120px;width:760px;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / .55);overflow:hidden;animation:fadeUp .2s cubic-bezier(.22,1,.36,1) both}
.dd .seg{display:grid;grid-auto-columns:minmax(0,1fr);width:100%}.dd .seg button{justify-content:center}
.dd tbody tr td:first-child{font-weight:600}.dd tbody tr:hover td:first-child{color:var(--primary)}
.dd-tw{overflow-x:auto}
.dd-tw>table{min-width:560px}
.dd-segw>.seg{min-width:480px}
html.comp-live .ddscrim{position:fixed;z-index:2147482600}
html.comp-live .dd{position:fixed;z-index:2147482601;left:50%;top:max(12px,8vh);translate:-50% 0;width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 24px - max(12px,8vh));overflow:auto}
```

Drill-down markup (I:1005-1010, row I:1013):

```html
<div class="dd" role="dialog" aria-modal="true">
  <div class="dd-top" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)">
    <span>These filings live in Compliances · Filings</span>
    <a href="#" data-go="filings" style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap;color:var(--primary)">Open Filings →</a></div>
  <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)">
    <div style="flex:1;font:700 15px Manrope;color:var(--navy-ink,var(--navy));display:flex;align-items:center;gap:4px">Compliances · October 2026 [(i) "As of 8 Oct 2026."]</div>
    <button class="ibtn" data-close aria-label="Close">✕(13)</button></div>
  <div style="padding:16px 18px">
    <div class="seg-scroll dd-segw">[seg: All 13 · Filed 1 · Due soon 4 · Overdue 1 · Upcoming 7]</div>
    <div class="dd-tw"><table style="margin-top:12px;font-size:12.5px"><thead><tr><th>Filing</th><th>Period</th><th>Area</th><th style="text-align:right">Due / filed</th><th>Status</th><th></th></tr></thead>
      <tbody><tr data-open="ECB-2 return"><td>ECB-2 return [↗] [proof]</td><td style="color:var(--muted)">Jul–Sep 2026</td><td><span class="area">FEMA</span></td>
        <td class="mono" style="text-align:right;font-size:12px">7 Oct</td><td><span class="chip" style="background:var(--over-chip);color:#fff">Overdue</span></td><td style="color:var(--subtle)">›(14)</td></tr></tbody></table></div>
    <div data-foot style="font-size:11px;color:var(--muted);margin-top:8px">Showing all 1</div></div>
  <div style="display:flex;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--raised)"><button class="btn btn-o btn-s">Open Filings</button></div>
</div>
```

Solid chip colours in the drill table (I:996): `ok: var(--ok-chip)`, `due: var(--due-chip)`, `over: var(--over-chip)`, `up: oklch(54% 0.026 258)`; text white.

Table (I:206-212):

```css
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:9px 10px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:10px;border-top:1px solid var(--hair);vertical-align:middle;white-space:nowrap}
tbody tr{transition:background .15s;cursor:pointer}
tbody tr:hover{background:light-dark(oklch(96.8% 0.006 250 / .7), oklch(17.8% 0.006 250 / 0.7))}
tbody tr:first-child td{border-top:0}
.tbl-scroll{overflow-x:auto;max-width:100%}
.tbl-scroll>table{min-width:720px}
```

Filings row markup (I:796-801, rendered for a filed GSTR-3B Aug):

```html
<tr data-id="s1">
  <td><div class="dtile" style="width:38px;height:42px;background:var(--ok)"><b style="font-size:15px">20</b><small>Sep</small></div></td>
  <td><span class="area">GST</span></td>
  <td><div style="font-weight:700;font-size:13px"><span style="display:inline-flex;align-items:center;gap:4px">GSTR-3B [↗]</span></div><div style="font-size:11px;color:var(--muted)">Aug 2026</div></td>
  <td style="color:var(--muted)">Monthly</td>
  <td><span style="font-weight:600">18 Sep</span></td>   <!-- or <span style="color:var(--over-text);font-weight:700">1 day late</span> / <span style="color:var(--muted)">in 12 days</span> -->
  <td><span class="chip c-ok">[✓] Filed</span></td>
  <td style="text-align:right"><span style="display:inline-flex;gap:6px;align-items:center"><button class="chip pchip" data-proof="GSTR-3B · Aug 2026" data-tip="Open proof">📎(12) Proof</button><button class="ibtn" data-tip="Download" aria-label="Download proof">⬇(15)</button></span></td>
</tr>
```

Filings header + KPI + filter + card head (I:805-810):

```html
<div class="row-wrap" style="display:flex;align-items:center;gap:12px">
  <div style="display:flex;align-items:center;gap:2px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:2px"><button class="ibtn" style="border:0;width:28px;height:28px">‹</button><b class="mono" style="font-size:12px;min-width:84px;text-align:center">FY 2026-27</b><button class="ibtn" style="border:0;width:28px;height:28px">›</button></div>
  <div class="end" style="margin-left:auto;display:flex;gap:8px;align-items:center"><div class="seg-scroll">[Monthly · Quarterly · Annual]</div><button class="btn btn-o btn-s">⬇(14) Export</button><a class="btn btn-o btn-s" style="color:var(--navy-ink,var(--navy))">📅(14) Calendar</a></div></div>
<div class="fil-kpis" style="display:grid;grid-template-columns:360px 1fr;gap:16px">[donut card label "filings"]
  <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:9px"><p class="st" style="margin-bottom:2px">By area · Sep–Oct</p>
    <div style="display:flex;align-items:center;gap:10px">
      <span data-dd="area" data-k="GST" data-set="fil" data-tip="GST · 5 filings" style="width:74px;flex:none;font-size:12px;font-weight:700">GST</span>
      <span style="flex:1;display:flex;gap:2px;height:12px;border-radius:4px;overflow:hidden;background:var(--raised)">
        <span data-dd="area" … style="flex:2;background:var(--ok)"></span><span … style="flex:1;background:var(--due)"></span><span … style="flex:2;background:var(--up)"></span></span>
      <span class="mono" style="width:34px;flex:none;text-align:right;font-size:11px;color:var(--muted)">2/5</span></div> …
  </div></div>
<div class="row-wrap" style="display:flex;gap:12px;align-items:center"><div class="seg-scroll">[All 18 · MCA 3 · GST 5 · Income tax 5 · Payroll 3 · FEMA 2]</div><div class="end seg-scroll" style="margin-left:auto">[All · ●Overdue · ●Due soon · ●Upcoming · ●Filed]</div></div>
<div class="card" style="overflow:hidden">
  <div class="fil-head" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)"><button class="ibtn" style="border:0">‹</button><b style="font:700 15px 'Space Grotesk'">Sep – Oct 2026</b><button class="ibtn" style="border:0">›</button><span class="mono" style="font-size:11px;color:var(--muted)">17 filings</span><button class="btn btn-o btn-s" style="margin-left:auto">Full year</button></div>
  <div class="tbl-scroll"><table><thead><tr><th style="width:56px">Due</th><th style="width:70px">Area</th><th>Filing</th><th>Frequency</th><th>Filed on</th><th>Status</th><th style="text-align:right">Proof</th></tr></thead>…</table></div></div>
```

Portal / proof / bot / tooltip / info (I:137-144, I:239-241, I:247-255):

```css
.info{position:relative;display:inline-flex;vertical-align:middle}
.info>button{width:20px;height:20px;border:0;border-radius:4px;background:none;color:oklch(62% 0.02 255);display:grid;place-items:center;cursor:pointer;padding:0}
.info>button:hover{color:var(--navy-ink,var(--navy))}
.info .pop{position:absolute;left:50%;top:calc(100% + 8px);z-index:40;width:min(280px,calc(100vw - 24px));padding:10px 12px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--pop);font:500 12px/1.45 Manrope;color:var(--fg);opacity:0;visibility:hidden;transform:translate(-50%,-4px);transition:.15s}
.info .pop::before{content:"";position:absolute;left:50%;top:-6px;width:10px;height:10px;background:var(--panel);border-left:1px solid var(--border);border-top:1px solid var(--border);transform:translateX(-50%) rotate(45deg)}
.info:focus-within .pop,.info.open .pop{opacity:1;visibility:visible;transform:translate(-50%,0)}
.tipb{position:fixed;z-index:200;pointer-events:none;background:var(--navy);color:#fff;font:600 12px Manrope;padding:6px 10px;border-radius:8px;white-space:nowrap;transform:translate(-50%,calc(-100% - 10px));box-shadow:0 8px 20px -8px oklch(15% 0.05 258 / .5);opacity:0;transition:opacity .12s}
.tipb.on{opacity:1}.tipb::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)}
.tipb.on{transition-delay:120ms}
.pbtn{width:18px;height:18px;border-radius:4px;display:inline-grid;place-items:center;color:var(--subtle);flex:none;transition:color .15s,background .15s}
.pbtn:hover{color:var(--navy-ink,var(--navy));background:var(--primary-light)}.pbtn.dark{color:oklch(80% 0.03 255)}.pbtn.dark:hover{color:#fff;background:oklch(100% 0 0 / .12)}
.pchip{border:0;cursor:pointer;background:var(--primary-light);color:var(--navy-ink,var(--navy));font-family:inherit;box-shadow:inset 0 0 0 1px oklch(54.6% 0.215 263 / .25)}.pchip:hover{background:light-dark(oklch(93% 0.04 260), oklch(26.2% 0.106 260))}
.botsay{display:flex;align-items:flex-end;gap:10px;text-align:left}
.bface{border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 6px 16px -8px oklch(25% 0.06 258 / .45),0 0 0 1px var(--border);display:grid;place-items:center;flex:none;animation:bob 2.6s ease-in-out infinite}
.bubble{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px 10px 10px 4px;padding:9px 12px;font:600 13px/1.4 Manrope;color:var(--fg);box-shadow:var(--shadow);max-width:300px}
.bubble::before{content:"";position:absolute;left:-6px;bottom:10px;width:10px;height:10px;background:var(--panel);border-left:1px solid var(--border);border-bottom:1px solid var(--border);transform:rotate(45deg)}
.gly{display:inline-grid;place-items:center;border-radius:99px;flex:none;vertical-align:middle}
.chip .gly{margin-left:-3px}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
```

Portal icon path (14 px, stroke 2): `M14 5h5v5M19 5l-8 8M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10`. Paperclip (12 px): `M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.5 8.5l5.8-5.8`. In React use lucide `ExternalLink` / `Paperclip` (DECISIONS: Lucide everywhere) at the same sizes.

Bot markup (I:498-501): `div.botsay` › `span.bface` (size×size, robot SVG at size·0.74, tip "Ask VCFO") + `div.bubble` › `<div>lines</div>` + optional `<div style="display:flex;gap:6px;margin-top:8px">` with `button.btn.btn-o.btn-s` (height 28) "🤖 Ask VCFO why" and/or a secondary (`btn btn-n btn-s` height 28). Robot SVG = I:479 (`BOT`), same as the dashboard robot asset in `docs/specs/client-dashboard/assets/`.

Empty-month overlay (I:732): `position:absolute;inset:44px 14px 14px;display:grid;place-items:center;background:light-dark(oklch(97.4% 0.006 255 / .7), oklch(16.9% 0.006 255 / 0.7));border-radius:10px;backdrop-filter:blur(1px)` inside the calendar card (`position:relative`, padding 14).

Year view (CV:44-56 base + I:378-391 FINAL override):

```css
.yv{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,196px),1fr));gap:12px}
.ym{border:1px solid var(--border);border-radius:10px;padding:10px 10px 8px;background:var(--panel);cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;text-align:left;font:inherit;color:inherit}
.ym-h{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.ym-h b{font:700 12.5px Manrope;color:var(--navy-ink,var(--navy));flex:1}
.ym-h .n{font:600 11px "IBM Plex Mono",monospace;color:var(--muted)}
.ym-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.ym-g span{height:20px;display:grid;place-items:center;font:500 11px "IBM Plex Mono",monospace;letter-spacing:-.03em;color:var(--subtle);border-radius:4px;min-width:0}
.ym-g span.f{color:#fff;font-weight:700}
.ym-s{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:7px;font:600 11px Manrope;color:var(--muted)}
.ym-s i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px;vertical-align:0}
/* FINAL: each month a small table with the same lines */
.yv .ym{border:0;padding:0;background:none;border-radius:0;display:flex;flex-direction:column;justify-content:flex-start;align-self:start}
.yv .ym:hover{box-shadow:none;transform:none}
.yv .ym:hover .ym-h b{color:var(--primary);text-decoration:underline}
.yv .ym.now{box-shadow:none}
.yv .ym-h b{font:800 12.5px Manrope,sans-serif;color:var(--fg)}
.yv .ym-g{gap:0;border:1px solid #9aa8bb;border-bottom:0;border-right:0}
.yv .ym-g span{height:24px;border-radius:0;border-right:1px solid light-dark(#d5dce6, oklch(26.3% 0.012 257.2));border-bottom:1px solid light-dark(#d5dce6, oklch(26.3% 0.012 257.2));font:500 11px Manrope,sans-serif;letter-spacing:0;color:var(--fg)}
.yv .ym-g span:nth-child(7n){border-right:1px solid #9aa8bb}
.yv .ym-g span.f{color:#fff;font-weight:800}
.yv .ym-g span.t{box-shadow:inset 0 0 0 2px var(--navy);color:var(--navy-ink,var(--navy));font-weight:800;background:var(--panel)}
.yv .ym-g span.f.t{box-shadow:inset 0 0 0 2px var(--navy),inset 0 0 0 3px light-dark(#fff, oklch(13% 0.006 260))}
.yv .ym-g{border-bottom:1px solid #9aa8bb}
.yv .ym-g span:nth-last-child(-n+7){border-bottom:0}
```
Note: in the FINAL `.ym-g` there is **no weekday header row** in a mini month (only day numbers), Monday first, blank leading/trailing `<span>`s (filled so the last row closes, CV:110). Filled day bg is inline `style="background:<STC colour>"` where `STC = {ok:var(--ok), due:var(--due), over:var(--over), up:var(--navy)}` (CV:11).

Timeline (CV:58-90, verbatim):

```css
.tlv{display:flex;flex-direction:column;gap:10px}
.tlv-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tlv-tools .hint{font-size:11.5px;color:var(--muted);flex:1 1 200px;min-width:0}
.tlv-z{display:inline-flex;align-items:center;gap:6px;padding:3px;border-radius:8px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)}
.tlv-z button{width:28px;height:28px;border:0;border-radius:6px;background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy));font:800 15px/1 Manrope;cursor:pointer;box-shadow:0 1px 2px rgba(15,42,74,.12)}
.tlv-z button:disabled{opacity:.4;cursor:default}
.tlv-z button.fit{width:auto;padding:0 9px;font-size:11.5px}
.tlv-z input{width:clamp(70px,10vw,110px);accent-color:#0f2a4a}
.tlv-z .lv{min-width:50px;text-align:center;font:700 11px Manrope;color:var(--muted)}
.tlv-g{display:grid;grid-template-columns:clamp(110px,14vw,150px) minmax(0,1fr);user-select:none;-webkit-user-select:none;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.tlv-n>div{height:30px;display:flex;align-items:center;padding:0 10px;font:600 12px Manrope;border-top:1px solid var(--hair);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tlv-n>div.ar{height:24px;font:800 11px Manrope;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);background:var(--raised)}
.tlv-n>.sp{height:40px;border-top:0}
.tlv-vp{position:relative;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x;cursor:grab;border-left:1px solid var(--border)}
.tlv-vp::-webkit-scrollbar{display:none}
.tlv-vp.pan{cursor:grabbing}
.tlv-w{position:relative}
.tlv-r{position:relative;height:40px;border-bottom:1px solid var(--border);background:var(--panel)}
.tlv-r .mo{position:absolute;top:4px;padding-left:6px;border-left:1px solid var(--border);font:800 11px Manrope;color:var(--navy-ink,var(--navy));white-space:nowrap;height:14px;line-height:14px}
.tlv-r .tk{position:absolute;bottom:4px;transform:translateX(-50%);font:600 11px "IBM Plex Mono",monospace;color:var(--subtle);white-space:nowrap}
.tlv-l{position:relative;height:30px;border-top:1px solid var(--hair)}
.tlv-l.ar{height:24px;background:var(--raised)}
.tlv-b{position:absolute;top:7px;height:16px;border-radius:4px;cursor:grab;touch-action:none;box-shadow:0 1px 3px -1px rgba(8,20,40,.35);outline:none;transition:box-shadow .15s}
.tlv-b.drag{cursor:grabbing;box-shadow:0 0 0 3px rgba(201,162,75,.55),0 8px 16px -6px rgba(8,20,40,.45);z-index:3}
.tlv-b:focus-visible{box-shadow:0 0 0 3px rgba(84,112,255,.55)}
.tlv-b.late{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.35) 0 4px,transparent 4px 8px)!important}
.tlv-b.lock{cursor:default;opacity:.75}
.tlv-b .hd{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize}
.tlv-b .hd.l{left:-2px}.tlv-b .hd.r{right:-2px}
.tlv-d{position:absolute;top:9px;width:11px;height:11px;margin-left:-5.5px;transform:rotate(45deg);border-radius:2px;background:var(--navy);box-shadow:0 0 0 2px light-dark(#fff, oklch(13% 0.006 260));pointer-events:none;z-index:2}
.tlv-today{position:absolute;top:40px;bottom:0;width:2px;margin-left:-1px;background:#d64545;pointer-events:none;z-index:4}
.tlv-today:after{content:"Today";position:absolute;top:2px;left:4px;font:800 11px Manrope;color:#fff;background:#d64545;padding:1px 5px;border-radius:3px}
.tlv-read{position:fixed;z-index:2147483002;pointer-events:none;background:var(--navy);color:#fff;font:700 11.5px Manrope;padding:4px 8px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-130%)}
```
Lane background (CV:158): `repeating-linear-gradient(to right,transparent 0,transparent {line-1}px,var(--hair) {line-1}px,var(--hair) {line}px)` where `line = ppd` (or `ppd*7` at Months level).

Document preview (I:288-291, I:318-323, I:824-834):

```css
.pv-page{position:absolute;z-index:60;left:50%;top:76px;transform:translateX(-50%);width:min(600px,calc(100% - 24px));min-height:min(790px,calc(100% - 140px));box-sizing:border-box;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:4px;box-shadow:0 30px 60px -20px #000;padding:clamp(20px,5vw,46px) clamp(16px,5vw,54px);font-family:Georgia,serif;color:light-dark(#222, oklch(89.9% 0 89.9))}
.pv-page table td{white-space:normal}
.pv-top{position:absolute;z-index:60;left:0;right:0;top:0;min-height:56px;display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:8px clamp(12px,2vw,20px);color:#fff}
.pv-top>div{min-width:0}
html.comp-live .pvwrap{position:fixed!important;inset:0;z-index:2147482600!important;overflow:auto}
html.comp-live .pvwrap .scrim{position:fixed}
html.comp-live .pvwrap{display:flex;flex-direction:column;align-items:center}
html.comp-live .pvwrap .pv-top{position:relative;align-self:stretch;flex:none}
html.comp-live .pvwrap .pv-page{position:relative;left:auto;top:auto;transform:none;flex:none;margin:8px auto 84px}
html.comp-live .pvwrap .pv-zoom{position:fixed!important;background:var(--navy)!important;box-shadow:0 8px 20px -8px rgba(0,0,0,.5)}
```
Real proof files are PDFs/images: render with the browser PDF viewer / `<img>` inside the same chrome (dark scrim `oklch(15% 0.03 264 / .72)`, top bar, zoom pill); the paper page above is only a mock of a GST acknowledgement.

Toast (in-page) (I:223-224): `.toast{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);background:var(--navy);color:#fff;border-radius:8px;padding:10px 14px;display:flex;gap:14px;align-items:center;font-weight:600;box-shadow:var(--pop);z-index:70}` `.toast a{color:#f3d58a}`; live: fixed (I:317).

Page / shell bits (I:101-110, I:293-310):

```css
.top{height:52px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.page{padding:22px 24px 120px;display:flex;flex-direction:column;gap:16px}
html.comp-live .page{width:100%;max-width:1600px;margin-inline:auto;padding:clamp(14px,1.6vw,22px) clamp(12px,1.8vw,24px) 120px;min-width:0}
html.comp-live .row-wrap{display:flex;align-items:center;gap:10px 12px!important;flex-wrap:wrap}
html.comp-live .row-wrap>.end{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;max-width:100%}
html.comp-live .cal-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
html.comp-live .cal-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
html.comp-live [data-calnav] .seg button{padding:0 10px}
html.comp-live [data-calnavr] b{min-width:108px!important}
html.comp-live .fil-kpis{display:grid;grid-template-columns:minmax(300px,360px) minmax(0,1fr)!important;gap:16px}
.seg-scroll{min-width:0;max-width:100%;overflow-x:auto;scrollbar-width:none;border-radius:8px}
.seg-scroll::-webkit-scrollbar{display:none}
.seg-scroll>.seg{display:inline-grid;vertical-align:top}
```

### 3.3 Breakpoint CSS (verbatim, I:298-349)

```css
html.comp-live .side{width:var(--vp-side-w,248px);flex:none;overflow:hidden}
@media (max-width:1279px){html.comp-live .side{width:var(--vp-side-w,72px)}}
@media (max-width:767px){html.comp-live .side{width:var(--vp-side-w,0px);visibility:hidden}}
html.comp-live .search{width:clamp(180px,18vw,256px)}
@media (max-width:1279px){
  html.comp-live .search{width:36px;padding:0;justify-content:center}
  html.comp-live .search>span,html.comp-live .search .kbd{display:none}
}
@media (max-width:1179px){
  html.comp-live .cal-layout{grid-template-columns:minmax(0,1fr)!important}
  html.comp-live .cal-rail{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));align-items:start}
  html.comp-live .cal-rail>:last-child{grid-column:1/-1}
  html.comp-live .fil-kpis{grid-template-columns:minmax(0,1fr)!important}
}
@media (max-width:767px){
  html.comp-live .top{gap:6px;padding:0 8px}
  html.comp-live .vm-menu{display:grid}
  html.comp-live .top .tb,html.comp-live .search{width:40px;height:40px}
  html.comp-live .top .tb[aria-label="Theme"]{display:none}
  html.comp-live .crumb .ci,html.comp-live .crumb>span{display:none}
  html.comp-live .row-wrap>.end{margin-left:0!important}
  html.comp-live .seg button{height:40px}
  html.comp-live .btn-s,html.comp-live .btn{height:40px}
  html.comp-live .ibtn{width:40px!important;height:40px!important}
  html.comp-live .pbtn{width:40px;height:40px;margin:-11px -6px}
  html.comp-live .chip.pchip{min-height:32px}
  html.comp-live .donut{flex-wrap:wrap}
  html.comp-live .dd-top{flex-wrap:wrap}
  html.comp-live .fil-head{flex-wrap:wrap}
}
```
Caveat: at ≤767 the `.ibtn{40px!important}` rule outranks `.calbar [data-calnavr] .ibtn{24×28!important}` only by source order/specificity — in the prototype the calbar rule (higher specificity, earlier) wins on the calendar header; on the phone the separate `#cal-mobile` layout is used anyway.

### 3.4 Phone calendar (verbatim, I:351-357 + I:743-753)

```css
html.comp-phone #comp-screen .ab{min-height:0}
.cm-root{width:100%;min-height:100vh;min-height:100dvh;background:var(--bg);position:relative;overflow:hidden;font-size:13px}
.cm-root .tb{width:40px;height:40px}
.cm-root .ibtn{width:40px;height:40px}
.cm-seg{overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.cm-seg::-webkit-scrollbar{display:none}
.cm-seg .seg button{height:40px}
```

```html
<div class="cm-root">
  <header style="height:56px;display:flex;align-items:center;gap:6px;padding:0 8px;background:light-dark(#fff, oklch(13% 0 89.9));border-bottom:1px solid var(--border)"> ☰ · SBC · / Calendar · 🔍 · 🔔3 </header>
  <div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;align-items:center;gap:8px"><span style="margin-left:auto;display:flex;align-items:center;gap:2px"><button class="ibtn" style="border:0" aria-label="Previous week">‹</button><b style="font:700 13px 'Space Grotesk'">Oct 2026</b><button class="ibtn" style="border:0" aria-label="Next week">›</button></span></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
      <div style="background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);border-radius:10px;padding:10px;border-top:3px solid var(--due)"><div class="metric" style="font-size:22px">3</div><div style="font-size:11px;font-weight:700;color:var(--muted)">Due in 7 days</div></div>
      … (1 · Overdue · --over) (44% · FY filed · --ok)
    </div>
    <div class="cm-seg"><div style="width:max-content">[area seg with counts]</div></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">
      <!-- per day; s = worst status or '' ; t = today -->
      <div style="height:58px;border-radius:8px;background:{s? var(status|navy) : #fff};color:{s?'#fff':'var(--fg)'};border:1px solid {s?'transparent':'var(--border)'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;{t?'box-shadow:0 0 0 2px var(--navy)':''}">
        <small style="font:800 11px Manrope;opacity:.8">W</small><b style="font:700 16px 'Space Grotesk'">7</b>
        {t ? '<span class="pulse"></span>' : '<small style="font-size:11px;line-height:7px;height:7px;letter-spacing:-1px">●●</small>'}
      </div> …
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;gap:10px;align-items:center;min-height:56px;background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);border-radius:10px;padding:8px">
        <div class="dtile" style="background:var(--ok);width:40px;height:44px"><b style="font-size:16px">7</b><small>Wed</small></div>
        <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">TDS/TCS challan</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:3px"><span class="area">IT</span><span class="chip c-ok">✓ Filed</span></div></div>
        ›(15)
      </div> …
    </div>
  </div>
  <div class="bot" style="right:14px;bottom:14px;transform:scale(.8);transform-origin:bottom right">…</div>
</div>
```
Note: the empty week-strip day uses a hard-coded `#fff` — use `var(--panel)` for dark mode.

### 3.5 Animation & timing summary

| what | timing | ref |
|---|---|---|
| Sliding pill thumb | transform + width `.42s var(--spring)`; label colour `.2s` | I:131-132 |
| Page children stagger | `fadeUp .25s cubic-bezier(.22,1,.36,1)`, +60 ms each (to 5th) | I:220-222 |
| Drill-down open | `fadeUp .2s cubic-bezier(.22,1,.36,1)` | I:243 |
| Tooltip | opacity `.12s`, 120 ms delay | I:239, I:256 |
| Info pop-over | all `.15s`, translateY -4→0 | I:141-143 |
| Day cell hover | background `.15s` | I:363 |
| Donut segment hover | stroke-width `.15s` (11→15) | I:238 |
| Table row hover | background `.15s` | I:210 |
| Button press | `transform .12s` scale .98; bg `.15s` | I:121-122 |
| Gold pulse dot | `pulse 1.8s ease-in-out infinite` (ring 0→5px) | I:174-175 |
| Focus-track current | `ftpulse 1.9s ease-out infinite` (ring 0→9px gold) | I:265-266 |
| Bot avatar | `bob 2.6s ease-in-out infinite` (−4 px) | I:217-219, I:251 |
| Launcher entrance | `botup .45s cubic-bezier(.22,1,.36,1) .4s` | I:214, I:218 |
| Count-up | 700 ms easeOutCubic | I:1037 |
| Year card hover (base) | `.15s` border/shadow/transform (FINAL: only title underline) | CV:45-46, I:380-381 |
| Timeline bar | box-shadow `.15s`; drag readout live | CV:80-81 |
| Skeleton | `sk 1.2s infinite` | I:735 |
| Toast | 3.2 s (global) / 1.6 s (drill row) | P:164, I:1020 |
| Reduced motion | all animation/transition off; count-up skipped | I:270, I:1037 |

---

## 4. Gaps, bugs and decisions to raise with the owner

1. **Due-soon threshold** 7 days (prototype) vs 14 (`src/lib/compliance/filings.ts:140`).
2. **Donut / rail month**: prototype rail is fixed to the demo month while the grid navigates. Recommend donut follows the viewed month; Next deadline + overdue strip always relative to today; Coming up = next 7 from today−1.
3. **Client timeline editing**: prototype allows dragging windows (sessionStorage); real windows are manager-only. Recommend read-only for clients.
4. **Proof files**: need the new proofs table + S3 + APIs (§2.4). Until then, filed rows show "Proof pending".
5. **ARN / tax paid / filed by / workflow steps / data received / approval**: no columns today → NEW, or hide those blocks for v1 ("design now, build later").
6. **Remind me / Add to calendar / Export**: no backend today → NEW or hide.
7. **Obligations coverage**: seed lacks PT payment, TCS, ECB-2, Softex, ITC-04 → demo will be thinner; demo seed has no monthly instances (notes).
8. **Pre-incorporation**: not designed for Compliances; use bot bubble + empty grid (E-07).
9. Prototype bugs not to copy: "N day late" not pluralised (I:799, I:649); mobile KPI "3 Due in 7 days" hard-coded vs 4 computed (I:747); live day pop-over reads only October rows after month navigation (I:983 uses `OCT`); `#cal-info` ignores `infoOpen`; day pop-over has no Esc/outside close; drill-down/preview have no Esc/focus trap; Filings area/status pills not wired; Next deadline picks GSTR-1 though PT payment (10 Oct) is earlier.
10. **Phone drill-downs** = bottom sheet (DECISIONS § Shared) — not drawn in the comp prototype.
11. The month nav label in the live CSS `html.comp-live [data-calnavr] b{min-width:108px}` targets the old `<b>` label (v7) — irrelevant now that the label is the picker buttons.
12. Existing staff features in the shared views (company picker, statutory master calendar, window column, period matrix) must stay for staff shells; the redesign is the client look. CompliancePages is shared by every role — decide whether staff get the new look too (notes say "Do not add role branches to the views").

---

## Appendix A — verbatim source extracts

The exact source of every style block and the key render functions, copied from the FINAL files so the developer does not need the prototype open. Line numbers are the source file's.

### A.1 `s/comp/index.html` lines 1-41 (picker + calendar-header CSS, FINAL-only)
```css
   1  <!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:light-dark(#fff, oklch(13% 0 89.9));color:light-dark(#000, oklch(100% 0 0))}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}/* month / year picker on the calendar nav */
   2  .mpk-lbl{display:flex;align-items:center;justify-content:center;min-width:150px}
   3  .mpk-b{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border:0;border-radius:6px;background:none;font:700 14px 'Space Grotesk',Manrope,sans-serif;color:var(--fg);cursor:pointer}
   4  .mpk-b svg{color:var(--muted)}
   5  .mpk-b:hover,.mpk-b[aria-expanded=true]{background:var(--raised)}
   6  .mpk-b:focus-visible{outline:2px solid var(--navy);outline-offset:1px}
   7  [data-calnavr]{position:relative}
   8  .mpk-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:304px;background:var(--panel);border:1px solid var(--border);border-radius:14px;box-shadow:0 18px 40px -16px oklch(21% 0.042 264 / .35);padding:12px;box-sizing:border-box}
   9  .mpk-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:10px}
  10  .mpk-mid{display:flex;align-items:center;gap:4px}
  11  .mpk-ar{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--navy-ink,var(--navy));display:grid;place-items:center;cursor:pointer;flex:none}
  12  .mpk-ar:hover{background:var(--raised)}
  13  .mpk-hb{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:0;border-radius:8px;background:none;font:700 14px 'Space Grotesk',Manrope,sans-serif;color:var(--fg);cursor:pointer}
  14  .mpk-hb svg{color:var(--muted)}
  15  .mpk-hb.on,.mpk-hb:hover{background:var(--raised)}
  16  .mpk-g{display:grid;gap:4px}
  17  .mpk-g.m{grid-template-columns:repeat(3,minmax(0,1fr))}
  18  .mpk-g.y{grid-template-columns:repeat(4,minmax(0,1fr));max-height:240px;overflow:auto;scrollbar-width:thin}
  19  .mpk-g button{height:42px;border:0;border-radius:9px;background:none;color:var(--navy-ink,var(--navy));font:500 14px 'Space Grotesk',Manrope,sans-serif;cursor:pointer}
  20  .mpk-g.y button{font:500 13.5px 'IBM Plex Mono',monospace}
  21  .mpk-g button:hover{background:var(--raised)}
  22  .mpk-g button.now{box-shadow:inset 0 0 0 1px var(--navy)}
  23  .mpk-g button.on{background:var(--navy);color:#fff;box-shadow:none}
  24  .mpk-g button:focus-visible,.mpk-ar:focus-visible,.mpk-hb:focus-visible{outline:2px solid var(--navy);outline-offset:1px}
  25  .mpk-ft{display:flex;justify-content:flex-end;border-top:1px solid var(--hair);margin-top:10px;padding-top:9px}
  26  .mpk-ft button{border:0;background:none;color:var(--navy-ink,var(--navy));font:600 13px Manrope,system-ui,sans-serif;cursor:pointer;padding:2px 4px;border-radius:5px}
  27  /* calendar header: navigator, FY and filters on one compact line */
  28  .row-wrap:has(.calbar){flex-wrap:nowrap!important;position:relative;z-index:6}
  29  .row-wrap:has(.calbar)>.end{flex:none}
  30  .calbar{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0}
  31  .calbar>[data-calnavr]{flex:none;position:relative;z-index:30}
  32  .calbar>.mono{flex:none;align-self:stretch;display:inline-flex;align-items:center;font-size:10.5px!important;padding:0 8px!important;border-radius:7px!important}
  33  .calbar>.seg-scroll{flex:0 1 auto;min-width:0}
  34  .row-wrap:has(.calbar) .seg button{height:28px;padding:0 9px;font-size:12px;gap:4px}
  35  .row-wrap:has(.calbar) .seg .cnt{font-size:10px}
  36  .calbar [data-calnavr] .ibtn{width:24px!important;height:28px!important}
  37  .calbar .mpk-lbl{min-width:0}
  38  .calbar .mpk-b{height:28px;padding:0 6px;font-size:13px}
  39  /* the picker opens from a left-hand control, so it hangs to the right */
  40  .mpk-pop{left:0;right:auto}
  41  </style></head><body>
```

### A.2 `s/comp/index.html` lines 45-392 (all page CSS, incl. responsive and FINAL grid-lines overrides)
```css
  45  <style>
  46  :root{--bg:oklch(97.4% 0.006 255);--panel:oklch(100% 0 0);--raised:oklch(96.6% 0.007 255);--border:oklch(92.2% 0.011 255);--hair:oklch(94.8% 0.007 255);--fg:oklch(21% 0.042 264);--muted:oklch(46% 0.028 258);--subtle:oklch(55% 0.022 255);
  47  --primary:oklch(54.6% 0.215 263);--primary-dark:oklch(48.8% 0.217 264);--primary-light:oklch(96.6% 0.02 260);
  48  --navy:#0f2a4a;--navy-2:#17396b;--navy-3:#1b4f94;--gold:#c9a24b;--gold-soft:#fbf3df;--gold-text:#6e500f;
  49  --ok:oklch(56% 0.13 168);--ok-light:oklch(96% 0.028 170);--ok-text:oklch(39% 0.09 172);--ok-chip:oklch(50% 0.12 168);
  50  --due:oklch(66% 0.17 48);--due-light:oklch(96.8% 0.04 55);--due-text:oklch(48% 0.14 42);--due-chip:oklch(55% 0.17 42);
  51  --over:oklch(57% 0.2 22);--over-light:oklch(96.4% 0.026 18);--over-text:oklch(46% 0.17 20);--over-chip:oklch(52% 0.2 22);
  52  --prog:oklch(55% 0.16 252);--prog-light:oklch(96% 0.026 250);--prog-text:oklch(43% 0.13 254);
  53  --up:oklch(82% 0.018 255);--up-light:oklch(96.6% 0.007 255);--up-text:oklch(46% 0.028 258);
  54  --violet:oklch(54% 0.17 292);--violet-light:oklch(96.4% 0.032 292);
  55  --shadow:0 1px 2px oklch(25% 0.04 264 / .04),0 6px 18px -10px oklch(28% 0.06 264 / .18);
  56  --pop:0 16px 40px -12px oklch(21% 0.042 264 / .35);
  57  --spring:linear(0,0.0637,0.2021,0.3619,0.5141,0.6451,0.7506,0.8315,0.8909,0.9328,0.9613,0.9799,0.9914,0.9981,1.0016,1.0032,1.0036,1.0034,1.0029,1.0023,1.0018,1.0013,1.0009,1.0006,1.0004);
  58  /* canvas chrome */--cv:oklch(93% 0.008 255)}
  59  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--cv:oklch(22% 0.02 260)}}
  60  :root[data-theme="dark"]{--cv:oklch(22% 0.02 260);color-scheme:dark}
  61  *{box-sizing:border-box}
  62  body{margin:0;background:var(--cv);font-family:Manrope,system-ui,sans-serif;color:var(--fg);font-size:13px;-webkit-font-smoothing:antialiased}
  63  a{color:var(--primary);text-decoration:none;font-weight:700}
  64  button{font-family:inherit}
  65  /* ---------- canvas ---------- */
  66  .canvas{padding:40px 40px 80px;display:flex;flex-direction:column;gap:56px;min-width:1520px}
  67  .cv-head{display:flex;align-items:flex-end;gap:16px}
  68  .cv-head h1{margin:0;font:700 26px "Space Grotesk",Manrope;color:var(--fg);letter-spacing:-.02em}
  69  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .cv-head h1,:root:not([data-theme="light"]) .ab-label{color:#e6ecf5}}
  70  .cv-nav{display:flex;gap:6px;flex-wrap:wrap}
  71  .cv-nav a{font:600 12px Manrope;padding:5px 10px;border-radius:6px;background:var(--panel);border:1px solid var(--border);color:var(--navy-ink,var(--navy))}
  72  .ab-label{font:700 15px Manrope;color:var(--navy-ink,var(--navy));margin:0 0 10px;display:flex;gap:10px;align-items:center}
  73  .ab-label .tag{font:600 11px "IBM Plex Mono";padding:2px 7px;border-radius:4px;background:var(--panel);border:1px solid var(--border);color:var(--muted)}
  74  .ab{width:1440px;background:var(--bg);border-radius:4px;box-shadow:0 30px 60px -30px oklch(20% 0.04 264 / .45);overflow:hidden;position:relative}
  75  .row-abs{display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap}
  76  
  77  /* ---------- shell ---------- */
  78  .shell{display:flex;min-height:900px;position:relative}
  79  .side{width:248px;flex:none;background:var(--navy);color:#fff;display:flex;flex-direction:column}
  80  .side .brand{height:52px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid oklch(100% 0 0 / .08);font-weight:700}
  81  .side .logo{width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,light-dark(#fff, oklch(13% 0 89.9)),light-dark(#c9d6ea, oklch(33.8% 0.031 258.9)));color:var(--navy);display:grid;place-items:center;font:800 11px Manrope}
  82  .snav{display:flex;flex-direction:column;gap:2px;padding:12px 8px}
  83  .snav a{display:flex;align-items:center;gap:11px;height:36px;padding:0 10px;border-radius:8px;font-size:13.5px;font-weight:500;color:oklch(82% 0.02 255);position:relative}
  84  .snav a svg{color:oklch(72% 0.03 255)}
  85  .snav a.on{background:oklch(100% 0 0 / .1);box-shadow:inset 0 0 0 1px oklch(66% 0.16 262 / .45);color:#fff;font-weight:600}
  86  .snav a.on::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:99px;background:oklch(66% 0.16 262)}
  87  .snav a.on svg{color:oklch(80% 0.1 255)}
  88  .snav a.sub{height:32px;padding-left:40px;font-size:13px}
  89  .snav a.sub.on{background:oklch(100% 0 0 / .06);box-shadow:none}
  90  .snav a.sub.on::before{background:var(--gold)}
  91  .snav .n{margin-left:auto;font:600 11px "IBM Plex Mono";background:oklch(100% 0 0 / .12);border-radius:4px;padding:1px 6px;color:#fff}
  92  .sblock{margin:auto 8px 0;padding:12px 6px 0;border-top:1px solid oklch(100% 0 0 / .08)}
  93  .scap{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:oklch(72% 0.03 255);padding:0 6px 8px}
  94  .person{display:flex;align-items:center;gap:10px;padding:6px}
  95  .ph{width:32px;height:32px;border-radius:99px;flex:none;display:grid;place-items:center;font:700 11px Manrope;color:#fff;box-shadow:0 0 0 2px oklch(100% 0 0 / .15)}
  96  .person b{display:block;font-size:12.5px;font-weight:600}
  97  .person small{font-size:11px;color:oklch(72% 0.03 255)}
  98  .icons{display:flex;gap:4px;padding:0 6px 8px 48px}
  99  .icons span{width:24px;height:24px;border-radius:6px;background:oklch(100% 0 0 / .08);display:grid;place-items:center;color:oklch(85% 0.03 255)}
 100  .acct{display:flex;align-items:center;gap:10px;padding:12px 14px;border-top:1px solid oklch(100% 0 0 / .08);margin-top:6px}
 101  .top{height:52px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid light-dark(oklch(91.5% 0.012 255 / .6), oklch(25.4% 0.012 255 / 0.6));background:light-dark(oklch(100% 0 0 / .9), oklch(13% 0 0 / 0.9))}
 102  .crumb{display:flex;align-items:center;gap:6px;flex:1;font-size:13px;color:var(--muted)}
 103  .crumb b{color:var(--fg);font-weight:600}
 104  .crumb .ci{width:24px;height:24px;border-radius:8px;background:var(--primary-light);color:var(--primary);display:grid;place-items:center}
 105  .search{display:flex;align-items:center;gap:8px;width:256px;height:36px;padding:0 10px 0 12px;border-radius:8px;border:1px solid light-dark(oklch(91.5% 0.012 255 / .7), oklch(25.4% 0.012 255 / 0.7));background:light-dark(oklch(96.8% 0.006 250 / .5), oklch(17.8% 0.006 250 / 0.5));color:var(--muted);font:500 13px Manrope}
 106  .kbd{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:4px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border);font:500 11px "IBM Plex Mono";color:var(--muted)}
 107  .tb{width:36px;height:36px;border-radius:8px;border:0;background:transparent;color:var(--muted);display:grid;place-items:center;position:relative}
 108  .tb .badge{position:absolute;top:3px;right:3px;min-width:17px;height:17px;padding:0 3px;border-radius:99px;background:var(--primary-fill,var(--primary));color:#fff;font-size:11px;font-weight:600;display:grid;place-items:center;box-shadow:0 0 0 2px var(--panel)}
 109  .main{flex:1;min-width:0;display:flex;flex-direction:column}
 110  .page{padding:22px 24px 120px;display:flex;flex-direction:column;gap:16px}
 111  /* ---------- components ---------- */
 112  .card{background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);min-width:0;position:relative}
 113  .card.t::before{content:"";position:absolute;left:18px;top:-1px;width:38px;height:3px;border-radius:0 0 3px 3px;background:var(--gold)}
 114  .st{font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--navy-ink,var(--navy));margin:0}
 115  .h1{font:700 24px "Space Grotesk",Manrope;letter-spacing:-.025em;margin:0;color:var(--fg)}
 116  .metric{font-family:"Space Grotesk",Manrope;font-weight:600;letter-spacing:-.035em;font-feature-settings:"tnum"}
 117  .mono{font-family:"IBM Plex Mono",monospace;font-feature-settings:"tnum"}
 118  .chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;line-height:16px;white-space:nowrap}
 119  .c-ok{background:var(--ok-light);color:var(--ok-text)}.c-due{background:var(--due-light);color:var(--due-text)}.c-over{background:var(--over-light);color:var(--over-text)}.c-up{background:var(--up-light);color:var(--up-text);box-shadow:inset 0 0 0 1px var(--border)}.c-prog{background:var(--prog-light);color:var(--prog-text)}
 120  .area{display:inline-flex;align-items:center;height:20px;padding:0 6px;border-radius:4px;font:700 11px "IBM Plex Mono";letter-spacing:.02em;color:var(--navy-ink,var(--navy));background:light-dark(oklch(95% 0.012 255), oklch(20.5% 0.01 255));box-shadow:inset 0 0 0 1px oklch(88% 0.02 255)}
 121  .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:6px;font:600 13px Manrope;border:1px solid transparent;cursor:pointer;white-space:nowrap;transition:transform .12s,background .15s}
 122  .btn:active{transform:scale(.98)}
 123  .btn-n{background:var(--navy);color:#fff}.btn-n:hover{background:var(--navy-2)}
 124  .btn-p{background:var(--primary-fill,var(--primary));color:#fff}
 125  .btn-o{background:var(--panel);color:var(--fg);border-color:var(--border)}
 126  .btn-s{height:30px;padding:0 10px;font-size:12px}
 127  .ibtn{width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--muted);display:grid;place-items:center;cursor:pointer}
 128  .ibtn:hover{color:var(--navy-ink,var(--navy));border-color:oklch(54.6% 0.215 263 / .35)}
 129  /* sliding pill */
 130  .seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:auto;padding:2px;border-radius:8px;background:light-dark(oklch(96.5% 0.008 250), oklch(18.3% 0.008 250));box-shadow:inset 0 0 0 1px var(--border)}
 131  .seg>.thumb{position:absolute;top:2px;bottom:2px;left:0;border-radius:6px;background:var(--navy);box-shadow:0 1px 2px oklch(21% 0.042 264 / .25);transition:transform .42s var(--spring),width .42s var(--spring)}
 132  .seg button{position:relative;z-index:1;display:inline-flex;align-items:center;gap:6px;border:0;background:none;height:30px;padding:0 12px;border-radius:6px;font:500 12.5px Manrope;color:light-dark(oklch(50% 0.022 255), oklch(80% 0.015 255));cursor:pointer;white-space:nowrap;transition:color .2s}
 133  .seg button.on{color:#fff;font-weight:600}
 134  .seg .cnt{font:600 11px "IBM Plex Mono";color:oklch(55% 0.022 255)}
 135  .seg button.on .cnt{color:oklch(100% 0 0 / .72)}
 136  .seg .dot{width:7px;height:7px;border-radius:99px}
 137  /* info popover */
 138  .info{position:relative;display:inline-flex;vertical-align:middle}
 139  .info>button{width:20px;height:20px;border:0;border-radius:4px;background:none;color:oklch(62% 0.02 255);display:grid;place-items:center;cursor:pointer;padding:0}
 140  .info>button:hover{color:var(--navy-ink,var(--navy))}
 141  .info .pop{position:absolute;left:50%;top:calc(100% + 8px);z-index:40;width:min(280px,calc(100vw - 24px));padding:10px 12px;border-radius:8px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--pop);font:500 12px/1.45 Manrope;color:var(--fg);opacity:0;visibility:hidden;transform:translate(-50%,-4px);transition:.15s}
 142  .info .pop::before{content:"";position:absolute;left:50%;top:-6px;width:10px;height:10px;background:var(--panel);border-left:1px solid var(--border);border-top:1px solid var(--border);transform:translateX(-50%) rotate(45deg)}
 143  .info:focus-within .pop,.info.open .pop{opacity:1;visibility:visible;transform:translate(-50%,0)}
 144  .ask{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--hair);color:var(--primary);font-weight:700}
 145  /* KPI */
 146  .kpis{display:grid;grid-template-columns:repeat(4,1fr) 1.25fr;gap:12px}
 147  .kpi{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow);padding:14px 14px 14px 18px;display:flex;align-items:center;gap:12px;overflow:hidden;cursor:pointer;transition:transform .16s}
 148  .kpi:hover{transform:translateY(-2px)}
 149  .kpi::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--ac)}
 150  .kpi .circ{width:40px;height:40px;border-radius:99px;display:grid;place-items:center;color:#fff;flex:none;background:var(--ac)}
 151  .kpi .v{font-size:28px;line-height:1}
 152  .kpi .l{font-size:11.5px;font-weight:700;color:var(--muted);margin-top:3px}
 153  /* month grid */
 154  .cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
 155  .dow{font:800 11px Manrope;letter-spacing:.08em;text-transform:uppercase;color:var(--subtle);padding:0 6px 2px}
 156  .dow.we{color:oklch(68% 0.02 255)}
 157  .day{position:relative;min-width:0;overflow:hidden;font:inherit;color:inherit;height:96px;border-radius:10px;background:var(--panel);border:1px solid var(--border);padding:7px;display:flex;flex-direction:column;gap:4px;cursor:pointer;transition:transform .16s,box-shadow .16s,border-color .16s;text-align:left}
 158  .day:hover{transform:translateY(-2px);border-color:oklch(54.6% 0.215 263 / .35);box-shadow:0 8px 22px -8px oklch(37.9% 0.146 266 / .18)}
 159  .day.out{background:transparent;border-style:dashed;border-color:light-dark(oklch(90% 0.01 255), oklch(26% 0.01 255));cursor:default}
 160  .day.out:hover{transform:none;box-shadow:none}
 161  .day.out .dn{color:oklch(75% 0.015 255)}
 162  .day.we:not(.out){background:light-dark(oklch(98.6% 0.004 255), oklch(15.1% 0.004 255))}
 163  .dn{display:flex;align-items:center;gap:6px}
 164  .dt{min-width:26px;height:26px;border-radius:6px;display:grid;place-items:center;font:700 13px "Space Grotesk";color:var(--fg)}
 165  .day.s-over{background:var(--over-light);border-color:light-dark(oklch(85% 0.07 20), oklch(32% 0.1 20))}
 166  .day.s-due{background:var(--due-light);border-color:light-dark(oklch(87% 0.08 60), oklch(32% 0.1 60))}
 167  .day.s-ok{background:var(--ok-light);border-color:light-dark(oklch(86% 0.06 170), oklch(32% 0.1 170))}
 168  .day.s-up .dt{background:var(--navy);color:#fff}
 169  .day.s-over .dt{background:var(--over);color:#fff}
 170  .day.s-due .dt{background:var(--due);color:#fff}
 171  .day.s-ok .dt{background:var(--ok);color:#fff}
 172  .day.today{box-shadow:0 0 0 2px var(--navy)}
 173  .day.today .tlabel{font:800 11px Manrope;letter-spacing:.04em;min-width:0;white-space:nowrap;text-transform:uppercase;color:var(--navy-ink,var(--navy));display:flex;align-items:center;gap:4px}
 174  .pulse{width:7px;height:7px;border-radius:99px;background:var(--gold);animation:pulse 1.8s ease-in-out infinite}
 175  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 oklch(80% 0.12 85 / .7)}50%{box-shadow:0 0 0 5px oklch(80% 0.12 85 / 0)}}
 176  .ev{display:flex;align-items:center;gap:5px;height:20px;padding:0 6px 0 0;border-radius:4px;background:light-dark(oklch(100% 0 0 / .75), oklch(13% 0 0 / 0.75));font-size:11px;font-weight:700;color:var(--fg);overflow:hidden;white-space:nowrap}
 177  .ev i{width:3px;align-self:stretch;flex:none;border-radius:4px 0 0 4px}
 178  .ev .a{font:700 11px "IBM Plex Mono";color:var(--muted);flex:none}
 179  .ev .t{overflow:hidden;text-overflow:ellipsis}
 180  .more{font-size:11px;font-weight:800;color:var(--primary);padding-left:2px}
 181  .day.sel{box-shadow:0 0 0 2px var(--primary),0 10px 24px -10px oklch(37.9% 0.146 266 / .3);z-index:2}
 182  /* agenda */
 183  .ag-date{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--hair)}
 184  .ag-date:first-child{border-top:0}
 185  .dtile{width:44px;height:48px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;color:#fff}
 186  .dtile b{font:700 18px/1 "Space Grotesk"}
 187  .dtile small{font:800 11px Manrope;letter-spacing:.03em;text-transform:uppercase;opacity:.85;margin-top:2px}
 188  .ag-items{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
 189  .ag-it{display:flex;align-items:center;gap:8px;min-width:0}
 190  .ag-it .nm{font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
 191  /* popovers / modals */
 192  .scrim{position:absolute;inset:0;background:oklch(21% 0.042 264 / .38);backdrop-filter:blur(2px);z-index:50}
 193  .modal{position:absolute;z-index:60;background:var(--panel);border-radius:12px;box-shadow:0 30px 70px -20px oklch(21% 0.042 264 / .55);border:1px solid var(--border)}
 194  .dpop{position:absolute;z-index:45;width:min(320px,calc(100vw - 24px));background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--pop);padding:12px}
 195  .dpop::before{content:"";position:absolute;left:-7px;top:34px;width:12px;height:12px;background:var(--panel);border-left:1px solid var(--border);border-bottom:1px solid var(--border);transform:rotate(45deg)}
 196  /* timeline chips */
 197  .tl{display:flex;align-items:center;gap:0}
 198  .node{display:flex;flex-direction:column;align-items:center;gap:6px;width:110px;text-align:center}
 199  .node .c{width:30px;height:30px;border-radius:99px;display:grid;place-items:center;color:#fff;font-weight:800}
 200  .node.done .c{background:var(--ok)}
 201  .node.cur .c{background:var(--navy);box-shadow:0 0 0 3px var(--gold-soft)}
 202  .node.next .c{background:var(--panel);border:2px dashed oklch(78% 0.02 255);color:var(--muted)}
 203  .node b{font-size:12px}.node small{font-size:11px;color:var(--muted)}
 204  .link{flex:1;height:2px;background:var(--ok);margin-top:-30px;min-width:24px}
 205  .link.dash{background:repeating-linear-gradient(90deg,light-dark(oklch(80% 0.02 255), oklch(36% 0.02 255)) 0 5px,transparent 5px 9px)}
 206  /* table */
 207  table{width:100%;border-collapse:collapse}
 208  th{text-align:left;padding:9px 10px;font-size:11px;font-weight:800;color:var(--subtle);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border);white-space:nowrap}
 209  td{padding:10px;border-top:1px solid var(--hair);vertical-align:middle;white-space:nowrap}
 210  tbody tr{transition:background .15s;cursor:pointer}
 211  tbody tr:hover{background:light-dark(oklch(96.8% 0.006 250 / .7), oklch(17.8% 0.006 250 / 0.7))}
 212  tbody tr:first-child td{border-top:0}
 213  /* bot */
 214  .bot{position:absolute;right:24px;bottom:24px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:30;animation:botup .45s cubic-bezier(.22,1,.36,1) .4s both}
 215  .bot .lab{background:var(--navy);color:#fff;font-size:12px;font-weight:700;border-radius:6px;padding:4px 10px;position:relative}
 216  .bot .lab::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)}
 217  .bot .face{width:68px;height:68px;border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 10px 24px -8px oklch(25% 0.06 258 / .45),0 0 0 1px var(--border);display:grid;place-items:center;animation:bob 2.6s ease-in-out infinite}
 218  @keyframes botup{from{opacity:0;transform:translateY(48px)}to{opacity:1;transform:none}}
 219  @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
 220  @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
 221  .stag>*{animation:fadeUp .25s cubic-bezier(.22,1,.36,1) both}
 222  .stag>*:nth-child(2){animation-delay:.06s}.stag>*:nth-child(3){animation-delay:.12s}.stag>*:nth-child(4){animation-delay:.18s}.stag>*:nth-child(5){animation-delay:.24s}
 223  .toast{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);background:var(--navy);color:#fff;border-radius:8px;padding:10px 14px;display:flex;gap:14px;align-items:center;font-weight:600;box-shadow:var(--pop);z-index:70}
 224  .toast a{color:#f3d58a}
 225  /* current-page (old look) */
 226  .old .h-serif{font:600 22px "Source Serif 4",Georgia,serif;letter-spacing:-.01em;margin:0}
 227  .old .surface{background:var(--panel);border:1px solid var(--border);border-radius:12px}
 228  .old .pill-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:99px;padding:4px 12px;font-size:11px;font-weight:700;color:var(--primary)}
 229  .old .sp{display:inline-grid;grid-auto-flow:column;padding:2px;border-radius:8px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)}
 230  .old .sp span{padding:4px 10px;border-radius:6px;font-size:11.5px;font-weight:600;color:var(--muted)}
 231  .old .sp span.on{background:var(--panel);color:var(--fg);box-shadow:0 1px 2px oklch(21% 0.042 264 / .12)}
 232  .old .rpill{display:inline-flex;border-radius:99px;padding:2px 10px;font-size:11px;font-weight:800}
 233  .note{position:absolute;z-index:80;background:light-dark(#fff7d6, oklch(23.6% 0.115 95.8));border:1px solid light-dark(#e9d68a, oklch(32% 0.1 95.8));color:light-dark(#5c4a0f, oklch(83.3% 0.054 90.8));border-radius:6px;padding:6px 9px;font:600 11.5px/1.35 Manrope;max-width:230px;box-shadow:0 6px 16px -8px oklch(30% 0.05 80 / .4)}
 234  .note::before{content:attr(data-n);display:inline-grid;place-items:center;width:17px;height:17px;border-radius:99px;background:#c9a24b;color:#fff;font-size:10px;margin-right:6px}
 235  
 236  [data-dd]{cursor:pointer}
 237  span[data-dd]:hover,div[data-dd]:not(.kpi):hover{filter:brightness(1.06);box-shadow:0 0 0 2px oklch(54.6% 0.215 263 / .25)}
 238  circle[data-dd]{transition:stroke-width .15s}circle[data-dd]:hover{stroke-width:15}
 239  .tipb{position:fixed;z-index:200;pointer-events:none;background:var(--navy);color:#fff;font:600 12px Manrope;padding:6px 10px;border-radius:8px;white-space:nowrap;transform:translate(-50%,calc(-100% - 10px));box-shadow:0 8px 20px -8px oklch(15% 0.05 258 / .5);opacity:0;transition:opacity .12s}
 240  .tipb.on{opacity:1}.tipb::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;background:var(--navy);transform:translateX(-50%) rotate(45deg)}
 241  .tipb.static{position:absolute;opacity:1}
 242  .ddscrim{position:absolute;inset:0;background:oklch(20% 0.05 258 / .55);z-index:90}
 243  .dd{position:absolute;z-index:91;left:calc(50% - 380px);top:120px;width:760px;background:var(--panel);border-radius:12px;box-shadow:0 24px 60px -20px oklch(15% 0.05 258 / .55);overflow:hidden;animation:fadeUp .2s cubic-bezier(.22,1,.36,1) both}
 244  .dd .seg{display:grid;grid-auto-columns:minmax(0,1fr);width:100%}.dd .seg button{justify-content:center}
 245  .dd tbody tr td:first-child{font-weight:600}.dd tbody tr:hover td:first-child{color:var(--primary)}
 246  
 247  .pbtn{width:18px;height:18px;border-radius:4px;display:inline-grid;place-items:center;color:var(--subtle);flex:none;transition:color .15s,background .15s}
 248  .pbtn:hover{color:var(--navy-ink,var(--navy));background:var(--primary-light)}.pbtn.dark{color:oklch(80% 0.03 255)}.pbtn.dark:hover{color:#fff;background:oklch(100% 0 0 / .12)}
 249  .pchip{border:0;cursor:pointer;background:var(--primary-light);color:var(--navy-ink,var(--navy));font-family:inherit;box-shadow:inset 0 0 0 1px oklch(54.6% 0.215 263 / .25)}.pchip:hover{background:light-dark(oklch(93% 0.04 260), oklch(26.2% 0.106 260))}
 250  .botsay{display:flex;align-items:flex-end;gap:10px;text-align:left}
 251  .bface{border-radius:99px;background:light-dark(oklch(97.2% 0.014 255), oklch(17.2% 0.01 255));box-shadow:0 6px 16px -8px oklch(25% 0.06 258 / .45),0 0 0 1px var(--border);display:grid;place-items:center;flex:none;animation:bob 2.6s ease-in-out infinite}
 252  .bubble{position:relative;background:var(--panel);border:1px solid var(--border);border-radius:10px 10px 10px 4px;padding:9px 12px;font:600 13px/1.4 Manrope;color:var(--fg);box-shadow:var(--shadow);max-width:300px}
 253  .bubble::before{content:"";position:absolute;left:-6px;bottom:10px;width:10px;height:10px;background:var(--panel);border-left:1px solid var(--border);border-bottom:1px solid var(--border);transform:rotate(45deg)}
 254  .gly{display:inline-grid;place-items:center;border-radius:99px;flex:none;vertical-align:middle}
 255  .chip .gly{margin-left:-3px}
 256  .tipb.on{transition-delay:120ms}
 257  .ft{display:flex;align-items:center;padding:4px 18px 38px}
 258  .ft-st{position:relative;flex:none;width:28px;height:28px}
 259  .ft-l{position:absolute;top:34px;left:50%;transform:translateX(-50%);width:max-content;max-width:100px;text-align:center;font-size:11.5px;font-weight:700;line-height:1.2;display:flex;flex-direction:column}
 260  .ft-l small{font-weight:500;color:var(--muted);font-size:11px}.ft-l.muted{color:var(--muted)}
 261  .ft-line{flex:1;min-width:22px;height:5px;border-radius:9px;margin:0 6px}
 262  .ft-line.done{background:var(--ok)}
 263  .ft-line.todo{background:radial-gradient(circle,light-dark(oklch(80% 0.015 255), oklch(36% 0.015 255)) 2.2px,transparent 2.6px) 0 50%/9px 5px repeat-x}
 264  .ft-cur{flex:none;display:flex;align-items:center;gap:10px;min-width:188px;max-width:230px;padding:10px 14px 10px 10px;border-radius:12px;background:var(--navy);color:#fff;box-shadow:0 8px 22px -6px oklch(21% 0.042 264 / .45);position:relative}
 265  .ft-cur::after{content:"";position:absolute;inset:-1px;border-radius:inherit;animation:ftpulse 1.9s ease-out infinite;pointer-events:none}
 266  @keyframes ftpulse{0%{box-shadow:0 0 0 0 var(--gold)}100%{box-shadow:0 0 0 9px transparent}}
 267  .ft-ic{flex:none;width:32px;height:32px;border-radius:8px;background:var(--gold);color:#1d1600;display:grid;place-items:center}
 268  .ft-eye{font:800 11px Manrope;letter-spacing:.08em;text-transform:uppercase;color:#f3d58a}
 269  .ft-cur b{font-size:14px;line-height:1.2}.ft-cur small{font-size:11.5px;opacity:.85}
 270  @media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
 271  /* ---------- shared bits used by the live screens ---------- */
 272  .seg-scroll{min-width:0;max-width:100%;overflow-x:auto;scrollbar-width:none;border-radius:8px}
 273  .seg-scroll::-webkit-scrollbar{display:none}
 274  .seg-scroll>.seg{display:inline-grid;vertical-align:top}
 275  .cal-scroll{overflow-x:auto;padding:4px;margin:-4px}
 276  .cal-scroll>.cal{min-width:540px}
 277  .tbl-scroll{overflow-x:auto;max-width:100%}
 278  .tbl-scroll>table{min-width:720px}
 279  .dd-tw{overflow-x:auto}
 280  .dd-tw>table{min-width:560px}
 281  .dd-segw>.seg{min-width:480px}
 282  .day{container-type:inline-size}
 283  .tlabel .tl-t{overflow:hidden}
 284  @container (max-width:96px){.tlabel .tl-t{display:none}.ev .a{display:none}}
 285  .dpop.flip::before{left:auto;right:-7px;transform:rotate(-135deg)}
 286  .dpop.below::before{display:none}
 287  .vm-menu{display:none}
 288  .pv-page{position:absolute;z-index:60;left:50%;top:76px;transform:translateX(-50%);width:min(600px,calc(100% - 24px));min-height:min(790px,calc(100% - 140px));box-sizing:border-box;background:light-dark(#fff, oklch(13% 0 89.9));border-radius:4px;box-shadow:0 30px 60px -20px #000;padding:clamp(20px,5vw,46px) clamp(16px,5vw,54px);font-family:Georgia,serif;color:light-dark(#222, oklch(89.9% 0 89.9))}
 289  .pv-page table td{white-space:normal}
 290  .pv-top{position:absolute;z-index:60;left:0;right:0;top:0;min-height:56px;display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:8px clamp(12px,2vw,20px);color:#fff}
 291  .pv-top>div{min-width:0}
 292  /* ---------- v7 responsive: the live screen (comp-route.js adds html.comp-live) ---------- */
 293  html.comp-live,html.comp-live body{background:var(--bg)}
 294  html.comp-live .canvas{min-width:0;padding:0;gap:0}
 295  html.comp-live .ab-label{display:none}
 296  html.comp-live #comp-screen .ab{width:100%;border-radius:0;box-shadow:none;overflow:visible;min-height:100vh;min-height:100dvh}
 297  html.comp-live .shell{min-height:100vh;min-height:100dvh}
 298  html.comp-live .side{width:var(--vp-side-w,248px);flex:none;overflow:hidden}
 299  @media (max-width:1279px){html.comp-live .side{width:var(--vp-side-w,72px)}}
 300  @media (max-width:767px){html.comp-live .side{width:var(--vp-side-w,0px);visibility:hidden}}
 301  html.comp-live .top{min-width:0}
 302  html.comp-live .crumb{min-width:0;overflow:hidden;white-space:nowrap}
 303  html.comp-live .crumb>*{flex:none}
 304  html.comp-live .crumb b{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
 305  html.comp-live .search{width:clamp(180px,18vw,256px)}
 306  html.comp-live .page{width:100%;max-width:1600px;margin-inline:auto;padding:clamp(14px,1.6vw,22px) clamp(12px,1.8vw,24px) 120px;min-width:0}
 307  html.comp-live .row-wrap{display:flex;align-items:center;gap:10px 12px!important;flex-wrap:wrap}
 308  html.comp-live .row-wrap>.end{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;max-width:100%}
 309  html.comp-live .cal-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
 310  html.comp-live .cal-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
 311  html.comp-live [data-calnav] .seg button{padding:0 10px}
 312  html.comp-live [data-calnavr] b{min-width:108px!important}
 313  html.comp-live .fil-kpis{display:grid;grid-template-columns:minmax(300px,360px) minmax(0,1fr)!important;gap:16px}
 314  html.comp-live .donut svg{width:clamp(88px,5.6vw,112px);height:auto;flex:none}
 315  html.comp-live .ddscrim{position:fixed;z-index:2147482600}
 316  html.comp-live .dd{position:fixed;z-index:2147482601;left:50%;top:max(12px,8vh);translate:-50% 0;width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 24px - max(12px,8vh));overflow:auto}
 317  html.comp-live .toast{position:fixed;z-index:2147482602;max-width:calc(100vw - 24px);box-sizing:border-box}
 318  html.comp-live .pvwrap{position:fixed!important;inset:0;z-index:2147482600!important;overflow:auto}
 319  html.comp-live .pvwrap .scrim{position:fixed}
 320  html.comp-live .pvwrap{display:flex;flex-direction:column;align-items:center}
 321  html.comp-live .pvwrap .pv-top{position:relative;align-self:stretch;flex:none}
 322  html.comp-live .pvwrap .pv-page{position:relative;left:auto;top:auto;transform:none;flex:none;margin:8px auto 84px}
 323  html.comp-live .pvwrap .pv-zoom{position:fixed!important;background:var(--navy)!important;box-shadow:0 8px 20px -8px rgba(0,0,0,.5)}
 324  @media (max-width:1279px){
 325    html.comp-live .search{width:36px;padding:0;justify-content:center}
 326    html.comp-live .search>span,html.comp-live .search .kbd{display:none}
 327  }
 328  @media (max-width:1179px){
 329    html.comp-live .cal-layout{grid-template-columns:minmax(0,1fr)!important}
 330    html.comp-live .cal-rail{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));align-items:start}
 331    html.comp-live .cal-rail>:last-child{grid-column:1/-1}
 332    html.comp-live .fil-kpis{grid-template-columns:minmax(0,1fr)!important}
 333  }
 334  @media (max-width:767px){
 335    html.comp-live .top{gap:6px;padding:0 8px}
 336    html.comp-live .vm-menu{display:grid}
 337    html.comp-live .top .tb,html.comp-live .search{width:40px;height:40px}
 338    html.comp-live .top .tb[aria-label="Theme"]{display:none}
 339    html.comp-live .crumb .ci,html.comp-live .crumb>span{display:none}
 340    html.comp-live .row-wrap>.end{margin-left:0!important}
 341    html.comp-live .seg button{height:40px}
 342    html.comp-live .btn-s,html.comp-live .btn{height:40px}
 343    html.comp-live .ibtn{width:40px!important;height:40px!important}
 344    html.comp-live .pbtn{width:40px;height:40px;margin:-11px -6px}
 345    html.comp-live .chip.pchip{min-height:32px}
 346    html.comp-live .donut{flex-wrap:wrap}
 347    html.comp-live .dd-top{flex-wrap:wrap}
 348    html.comp-live .fil-head{flex-wrap:wrap}
 349  }
 350  /* phone calendar (cal-mobile) */
 351  html.comp-phone #comp-screen .ab{min-height:0}
 352  .cm-root{width:100%;min-height:100vh;min-height:100dvh;background:var(--bg);position:relative;overflow:hidden;font-size:13px}
 353  .cm-root .tb{width:40px;height:40px}
 354  .cm-root .ibtn{width:40px;height:40px}
 355  .cm-seg{overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
 356  .cm-seg::-webkit-scrollbar{display:none}
 357  .cm-seg .seg button{height:40px}
 358  /* ---------- calendar · grid lines (Calendar Date Separation, option 1) ----------
 359     one table: thin lines between every date, tinted weekday header, today = the whole navy-outlined box */
 360  .cal{gap:0;border:1px solid #9aa8bb;border-bottom:0;border-radius:8px;overflow:hidden;background:var(--panel)}
 361  .cal .dow{padding:7px 8px;background:light-dark(#eef2f8, oklch(19% 0.009 258.3));border-bottom:1px solid #9aa8bb;color:var(--muted)}
 362  .cal .dow.we{color:var(--muted)}
 363  .cal .day{height:96px;border:0;border-radius:0;border-right:1px solid #9aa8bb;border-bottom:1px solid #9aa8bb;background:var(--panel);padding:7px 8px;transition:background .15s}
 364  .cal>:nth-child(7n){border-right:0}
 365  .cal .day:hover{transform:none;box-shadow:none;border-color:#9aa8bb;background:light-dark(#f7f9fc, oklch(15.8% 0.005 258.3))}
 366  .cal .day.out,.cal .day.out:hover{background:var(--panel);border-style:solid;border-color:#9aa8bb}
 367  .cal .day.out .dt{color:#a9b4c4}
 368  .cal .day.we:not(.out),.cal .day.s-over,.cal .day.s-due,.cal .day.s-ok{background:var(--panel);border-color:#9aa8bb}
 369  .cal .day.we:not(.out):hover,.cal .day.s-over:hover,.cal .day.s-due:hover,.cal .day.s-ok:hover{background:light-dark(#f7f9fc, oklch(15.8% 0.005 258.3))}
 370  .cal .dt{min-width:24px;height:24px;border-radius:4px;font:700 13px Manrope,sans-serif}
 371  .cal .day.today{box-shadow:inset 0 0 0 2px var(--navy);background:light-dark(#eef2f8, oklch(19% 0.009 258.3))}
 372  .cal .day.today .tlabel{display:none}
 373  .cal .day.sel{box-shadow:inset 0 0 0 2px var(--primary);z-index:auto}
 374  .cal .day.today.sel{box-shadow:inset 0 0 0 2px var(--navy),inset 0 0 0 4px var(--primary)}
 375  .cal .ev{height:20px;padding:0 6px 0 0;gap:6px;border-radius:3px;background:light-dark(#eef2f8, oklch(19% 0.009 258.3));font-weight:600}
 376  .cal .ev i{border-radius:3px 0 0 3px}
 377  .cal .ev .a{display:none}
 378  /* year view: each month a small table with the same lines */
 379  .yv .ym{border:0;padding:0;background:none;border-radius:0;display:flex;flex-direction:column;justify-content:flex-start;align-self:start}
 380  .yv .ym:hover{box-shadow:none;transform:none}
 381  .yv .ym:hover .ym-h b{color:var(--primary);text-decoration:underline}
 382  .yv .ym.now{box-shadow:none}
 383  .yv .ym-h b{font:800 12.5px Manrope,sans-serif;color:var(--fg)}
 384  .yv .ym-g{gap:0;border:1px solid #9aa8bb;border-bottom:0;border-right:0}
 385  .yv .ym-g span{height:24px;border-radius:0;border-right:1px solid light-dark(#d5dce6, oklch(26.3% 0.012 257.2));border-bottom:1px solid light-dark(#d5dce6, oklch(26.3% 0.012 257.2));font:500 11px Manrope,sans-serif;letter-spacing:0;color:var(--fg)}
 386  .yv .ym-g span:nth-child(7n){border-right:1px solid #9aa8bb}
 387  .yv .ym-g span.f{color:#fff;font-weight:800}
 388  .yv .ym-g span.t{box-shadow:inset 0 0 0 2px var(--navy);color:var(--navy-ink,var(--navy));font-weight:800;background:var(--panel)}
 389  .yv .ym-g span.f.t{box-shadow:inset 0 0 0 2px var(--navy),inset 0 0 0 3px light-dark(#fff, oklch(13% 0.006 260))}
 390  .yv .ym-g{border-bottom:1px solid #9aa8bb}
 391  .yv .ym-g span:nth-last-child(-n+7){border-bottom:0}
 392  </style>
```

### A.3 `s/comp/index.html` lines 396-557 (data, status, chips, portal, proof, bot, shell, pill)
```js
 396  /* =========================================================
 397     DATA — FY 2026-27, client = Northwind Analytics India Pvt Ltd
 398     Today = Thu 8 Oct 2026. Rows follow src/data/statutory-calendar-fy2627.ts
 399     and the FilingRow shape (compliance · particular · dueDate · filedOn · period).
 400     ========================================================= */
 401  const TODAY = '2026-10-08';
 402  const AREAS = [
 403    {id:'all',label:'All'},{id:'MCA',label:'MCA'},{id:'GST',label:'GST'},
 404    {id:'IT',label:'Income tax'},{id:'PAY',label:'Payroll'},{id:'FEMA',label:'FEMA'}];
 405  const AREA_SHORT = {MCA:'MCA',GST:'GST',IT:'IT',PAY:'PAY',FEMA:'FEMA'};
 406  const OCT = [
 407    ['2026-10-07','IT','TDS/TCS challan','Sep 2026','2026-10-06','Monthly','Income Tax Dept'],
 408    ['2026-10-07','FEMA','ECB-2 return','Jul–Sep 2026',null,'Quarterly','RBI'],
 409    ['2026-10-10','PAY','Professional tax payment','Sep 2026',null,'Monthly','State PT Dept'],
 410    ['2026-10-11','GST','GSTR-1','Sep 2026',null,'Monthly','GSTN'],
 411    ['2026-10-15','PAY','PF & ESI payment','Sep 2026',null,'Monthly','EPFO · ESIC'],
 412    ['2026-10-15','IT','TCS return Q2','Jul–Sep 2026',null,'Quarterly','Income Tax Dept'],
 413    ['2026-10-20','GST','GSTR-3B','Sep 2026',null,'Monthly','GSTN'],
 414    ['2026-10-25','GST','ITC-04','Apr–Sep 2026',null,'Half-yearly','GSTN'],
 415    ['2026-10-29','MCA','AOC-4 (financial statements)','FY 2025-26',null,'Annual','MCA'],
 416    ['2026-10-30','MCA','MSME-1','Apr–Sep 2026',null,'Half-yearly','MCA'],
 417    ['2026-10-30','FEMA','Softex filing','Sep 2026',null,'Monthly','STPI'],
 418    ['2026-10-31','IT','TDS return Q2','Jul–Sep 2026',null,'Quarterly','Income Tax Dept'],
 419    ['2026-10-31','IT','Income tax return (ITR-6)','FY 2025-26',null,'Annual','Income Tax Dept'],
 420  ].map(([due,area,name,period,filed,freq,auth],i)=>({id:'o'+i,due,area,name,period,filed,freq,auth}));
 421  const SEP_FILED = 14, FY_TOTAL = 118, FY_FILED = 52;
 422  
 423  function status(r){ if(r.filed) return 'ok'; const d=(new Date(r.due)-new Date(TODAY))/864e5; if(d<0) return 'over'; if(d<=7) return 'due'; return 'up'; }
 424  const ST = {ok:{l:'Filed',c:'c-ok',v:'--ok'},due:{l:'Due soon',c:'c-due',v:'--due'},over:{l:'Overdue',c:'c-over',v:'--over'},up:{l:'Upcoming',c:'c-up',v:'--up'}};
 425  const RANK = {over:3,due:2,up:1,ok:0};
 426  const worst = rs => rs.reduce((w,r)=>RANK[status(r)]>RANK[w]?status(r):w,'ok');
 427  const fmt = (iso,o={day:'numeric',month:'short'}) => new Date(iso+'T00:00').toLocaleDateString('en-IN',o);
 428  const dow = iso => new Date(iso+'T00:00').toLocaleDateString('en-IN',{weekday:'short'});
 429  /* rule 18 · set A "Solid glyphs": filled circle + white symbol */
 430  const GLYPH={done:['var(--ok)','<path d="M7 12.5l3.2 3.2L17 9"/>','#fff'],prog:['var(--navy)','<circle cx="12" cy="12" r="5"/><path d="M12 9.5V12l1.8 1.2"/>','#f3d58a'],you:['var(--due)','<circle cx="12" cy="9.5" r="2.6"/><path d="M7.5 17c.6-2.4 2.4-3.8 4.5-3.8s3.9 1.4 4.5 3.8"/>','#fff'],sbc:['var(--prog)','<path d="M7 12h10M13 8l4 4-4 4"/>','#fff'],up:['oklch(93% 0.008 255)','','#fff'],late:['var(--over)','<path d="M12 7.5v5.5M12 16.3v.2"/>','#fff']};
 431  const glyph=(k,size=16,tip='')=>{const [bg,path,fg]=GLYPH[k];return `<span class="gly" ${tip?`data-tip="${tip}" aria-label="${tip}" role="img"`:''} style="width:${size}px;height:${size}px;background:${bg};${k==='up'?'box-shadow:inset 0 0 0 1.5px oklch(84% 0.015 255);':''}">${path?`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`:''}</span>`;};
 432  const ST_GLYPH={ok:'done',due:'prog',over:'late',up:'up'};
 433  const ST_TIP={ok:'Filed',due:'Due within 7 days',over:'Late · past the due date',up:'Upcoming'};
 434  const AREA_FULL={MCA:'Ministry of Corporate Affairs',GST:'Goods & Services Tax',IT:'Income tax',PAY:'Payroll · PF, ESI, PT',FEMA:'FEMA · RBI & STPI'};
 435  const chip = s => `<span class="chip ${ST[s].c}" data-tip="${ST_TIP[s]}" aria-label="${ST_TIP[s]}">${glyph(ST_GLYPH[s],12)}${ST[s].l}</span>`;
 436  const areaChip = a => `<span class="area" data-tip="${AREA_FULL[a]}" aria-label="${AREA_FULL[a]}">${AREA_SHORT[a]}</span>`;
 437  const daysLeft = iso => Math.round((new Date(iso)-new Date(TODAY))/864e5);
 438  
 439  /* ---------- icons (duotone, matching the dashboard) ---------- */
 440  const sv=(p,s=16,w=2)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
 441  const I={
 442   home:s=>sv('<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z"/>',s),
 443   bell:s=>sv('<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"/>',s),
 444   mega:s=>sv('<path d="M4 10h3l8-4.5v13L7 14H4Z M7 14l1.5 5.5H11L10 14 M18 9.5a3.5 3.5 0 0 1 0 5"/>',s,1.7),
 445   sun:s=>sv('<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',s,1.7),
 446   search:s=>sv('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',s),
 447   cal:s=>sv('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',s),
 448   file:s=>sv('<path d="M7 3.5h7l4 4V20.5H7Z M14 3.5v4h4 M9.5 12.5h6 M9.5 16h6"/>',s),
 449   shield:s=>sv('<path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6Z M9 12l2 2 4-4"/>',s),
 450   steps:s=>sv('<path d="M5 6h14M5 12h14M5 18h9"/>',s),
 451   folder:s=>sv('<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',s),
 452   book:s=>sv('<path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3Z M17 7.5h2v12"/>',s),
 453   users:s=>sv('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5 M15.5 5.5a3 3 0 0 1 0 6 M17.5 14c1.7.5 2.8 2.2 3.1 5"/>',s),
 454   audit:s=>sv('<path d="M5 4h14v16H5Z M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',s),
 455   info:s=>sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.2"/>',s),
 456   chevL:s=>sv('<path d="M15 6l-6 6 6 6"/>',s),
 457   chevR:s=>sv('<path d="M9 6l6 6-6 6"/>',s),
 458   chevD:s=>sv('<path d="M6 9l6 6 6-6"/>',s),
 459   x:s=>sv('<path d="M6 6l12 12M18 6 6 18"/>',s),
 460   check:s=>sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>',s,2.6),
 461   alert:s=>sv('<path d="M12 7.5v6M12 16.8v.2"/><circle cx="12" cy="12" r="9"/>',s,2.4),
 462   clock:s=>sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',s),
 463   eye:s=>sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',s),
 464   down:s=>sv('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',s),
 465   max:s=>sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',s),
 466   arrow:s=>sv('<path d="M5 12h14M13 6l6 6-6 6"/>',s),
 467   spark:s=>sv('<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8Z"/>',s),
 468   wa:s=>sv('<path d="M5 19l1-3.2A7.5 7.5 0 1 1 9 18.6Z"/>',s,1.8),
 469   phone:s=>sv('<path d="M6.5 4h3l1.5 4-2 1.2a10 10 0 0 0 5.8 5.8L16 13l4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"/>',s,1.8),
 470   mail:s=>sv('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',s,1.8),
 471   teams:s=>sv('<rect x="4" y="6" width="11" height="12" rx="2"/><path d="M7 9.5h5M9.5 9.5V15 M17 9h2.5a1 1 0 0 1 1 1v4a3 3 0 0 1-3 3"/>',s,1.8),
 472   menu:s=>sv('<path d="M4 7h16M4 12h16M4 17h16"/>',s),
 473   filter:s=>sv('<path d="M4 6h16M7 12h10M10 18h4"/>',s),
 474   cal2:s=>sv('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h3v3H8Z"/>',s),
 475   list:s=>sv('<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',s,2.4),
 476   user:s=>sv('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',s),
 477   bank:s=>sv('<path d="M3.5 9.5 12 4.5l8.5 5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 20h17"/>',s),
 478  };
 479  const BOT = `<svg …robot avatar: viewBox="0 -40 240 240" 50x50, gradient #4C8DF8→#1D4ED8 head, #0B1736 visor, #7DD3FC eyes, #2DD4BF antenna tip…>` (see source for the full SVG)
 480  
 481  /* ---------- rule 15: portal ↗ + proof 📎 ---------- */
 482  const PORTALS={gst:['GST portal','https://www.gst.gov.in/'],it:['Income-tax portal','https://www.incometax.gov.in/'],traces:['TRACES','https://www.tdscpc.gov.in/'],mca:['MCA portal','https://www.mca.gov.in/'],epfo:['EPFO portal','https://unifiedportal-emp.epfindia.gov.in/'],pt:['State PT portal','https://www.tgct.gov.in/'],firms:['RBI FIRMS','https://firms.rbi.org.in/'],stpi:['STPI portal','https://www.stpi.in/']};
 483  function portalOf(r){
 484    if(r.area==='GST') return PORTALS.gst;
 485    if(r.area==='MCA') return PORTALS.mca;
 486    if(r.area==='IT') return /TDS|TCS/.test(r.name)?PORTALS.traces:PORTALS.it;
 487    if(r.area==='PAY') return /PF|ESI/.test(r.name)?PORTALS.epfo:PORTALS.pt;
 488    if(r.area==='FEMA') return /Softex/.test(r.name)?PORTALS.stpi:PORTALS.firms;
 489    return PORTALS.gst;
 490  }
 491  const portalBtn=(r,dark=false)=>{const [n,u]=portalOf(r);return `<a class="pbtn${dark?' dark':''}" href="${u}" target="_blank" rel="noopener" data-tip="Open ${n}" aria-label="Open ${n}" onclick="event.stopPropagation()">${sv('<path d="M14 5h5v5M19 5l-8 8M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',14,2)}</a>`;};
 492  /* Filed with no proof uploaded yet: TDS/TCS challan (filed 6 Oct). */
 493  const PROOF_PENDING=new Set(['o0']);
 494  const proofChip=r=>{ if(!r.filed) return ''; if(PROOF_PENDING.has(r.id)) return `<span class="chip c-due" data-tip="SBC will upload the challan">Proof pending</span>`;
 495    return `<button class="chip pchip" data-proof="${r.name} · ${r.period}" data-tip="Open proof">${sv('<path d="M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.5 8.5l5.8-5.8"/>',12,2)}Proof</button>`;};
 496  const nameWithLinks=(r,dark)=>`<span style="display:inline-flex;align-items:center;gap:4px">${r.name}${portalBtn(r,dark)}</span>`;
 497  /* ---------- rule 16: the bot speaks ---------- */
 498  function botSay(lines,{size=48,action='Ask VCFO why',secondary=''}={}){
 499    const bot=BOT.replace('width="50" height="50"',`width="${Math.round(size*.74)}" height="${Math.round(size*.74)}"`);
 500    return `<div class="botsay"><span class="bface" data-tip="Ask VCFO" aria-label="Ask VCFO" style="width:${size}px;height:${size}px">${bot}</span><div class="bubble"><div>${lines}</div>${action||secondary?`<div style="display:flex;gap:6px;margin-top:8px">${action?`<button class="btn btn-o btn-s" style="height:28px">🤖 ${action}</button>`:''}${secondary}</div>`:''}</div></div>`;
 501  }
 502  
 503  
 504  /* Flow = style E "Focus track" (Design Lab pick): current step is a navy hero card; other steps are set-A glyph dots; metro line (solid green done, dotted to do). */
 505  function focusTrack(nodes){
 506    const total=nodes.length; let h='';
 507    nodes.forEach((n,i)=>{
 508      if(i){const prevDone=nodes[i-1].st==='done'&&(n.st==='done'||n.st==='cur');h+=`<span class="ft-line ${prevDone?'done':'todo'}"></span>`;}
 509      if(n.st==='cur') h+=`<div class="ft-cur" data-tip="${n.tip}" aria-label="${n.tip}"><span class="ft-ic">${n.icon}</span><span style="display:flex;flex-direction:column;min-width:0"><span class="ft-eye">Now · ${i+1} of ${total}</span><b>${n.label}</b><small>${n.sub}</small></span></div>`;
 510      else h+=`<div class="ft-st">${glyph(n.st==='done'?'done':n.st==='you'?'you':'up',28,n.tip)}<span class="ft-l ${n.st==='done'?'':'muted'}">${n.label}<small>${n.sub}</small></span></div>`;
 511    });
 512    return `<div class="ft">${h}</div>`;
 513  }
 514  /* ---------- shell ---------- */
 515  function sidebar(active){
 516    const nav=[['home','Home'],['bell','Updates',3],['steps','Incorporation'],['shield','Compliances'],['folder','Documents',6],['book','Library'],['users','Team'],['audit','Audit']];
 517    let h=`<aside class="side"><div class="brand"><span class="logo">V</span>VCFO Suite</div><nav class="snav" aria-label="Main">`;
 518    nav.forEach(([ic,l,n])=>{
 519      h+=`<a href="#" class="${l==='Compliances'?'on':''}">${I[ic](17)}${l}${n?`<span class="n">${n}</span>`:''}</a>`;
 520      if(l==='Compliances'){h+=`<a href="#" class="sub ${active==='cal'?'on':''}">Calendar</a><a href="#" class="sub ${active==='fil'?'on':''}">Filings</a>`;}
 521    });
 522    h+=`</nav><div class="sblock"><div class="scap">Northwind’s team</div>
 523    ${person('PR','Priya Raman','Project Manager','#4b6fae')}${person('AM','Arjun Mehta','Project Lead','#7b5aa6')}
 524    <div class="scap" style="padding-top:8px">Customer support</div>${person('F','Farhat','+91 90597 90014','#2f7f74')}
 525    </div><div class="acct"><span class="ph" style="background:#c9a24b;color:var(--navy)">RK</span><div style="flex:1"><b style="font-size:12.5px;font-weight:600;display:block">Rahul Kapoor</b><small style="font-size:11px;color:oklch(72% 0.03 255)">Northwind Analytics</small></div>${I.chevD(14)}</div></aside>`;
 526    return h;
 527  }
 528  function person(ini,n,r,c){return `<div class="person"><span class="ph" style="background:${c}">${ini}</span><div><b>${n}</b><small>${r}</small></div></div><div class="icons"><span>${I.wa(13)}</span><span>${I.phone(13)}</span><span>${I.mail(13)}</span><span>${I.teams(13)}</span></div>`;}
 529  function topbar(trail){
 530    return `<header class="top"><button class="tb vm-menu" data-vp-menu aria-label="Open menu">${I.menu(20)}</button><span style="font:800 15px 'Space Grotesk';color:var(--navy-ink,var(--navy));letter-spacing:-.02em">SBC</span>
 531    <nav class="crumb" aria-label="Location"><span class="ci">${I.shield(13)}</span>${trail.map((t,i)=>i===trail.length-1?`<b>${t}</b>`:`<span>${t}</span><span style="opacity:.5">/</span>`).join('')}</nav>
 532    <div class="search">${I.search(14)}<span style="flex:1">Search</span><span class="kbd">⌘</span><span class="kbd">K</span></div>
 533    <button class="tb" aria-label="Announcements">${I.mega(18)}</button>
 534    <button class="tb" aria-label="Notifications, 3 new" style="background:var(--primary-light);color:var(--primary)">${I.bell(18)}<span class="badge">3</span></button>
 535    <button class="tb" aria-label="Theme" style="border:1px solid var(--border);background:var(--panel)">${I.sun(16)}</button></header>`;
 536  }
 537  const botLauncher = `<div class="bot"><span class="lab">Ask VCFO</span><button class="face" aria-label="Open Ask VCFO" style="border:0">${BOT}</button></div>`;
 538  function frame(active,trail,content,extra=''){
 539    return `<div class="shell">${sidebar(active)}<div class="main">${topbar(trail)}<div class="page stag">${content}</div></div>${botLauncher}${extra}</div>`;
 540  }
 541  const infoBtn = (text,open=false)=>`<span class="info ${open?'open':''}"><button aria-label="About this" data-tip="About this">${I.info(16)}</button><span class="pop">${text}<span class="ask">🤖 Ask VCFO about this</span></span></span>`;
 542  
 543  /* ---------- segmented sliding pill ---------- */
 544  let segN=0;
 545  function seg(opts,on,{counts,dots}={}){
 546    const id='seg'+(segN++);
 547    return `<div class="seg" id="${id}" role="tablist"><span class="thumb"></span>${opts.map((o,i)=>`<button role="tab" class="${i===on?'on':''}" aria-selected="${i===on}">${dots&&dots[i]?`<span class="dot" style="background:${dots[i]}"></span>`:''}${o}${counts&&counts[i]!=null?`<span class="cnt">${counts[i]}</span>`:''}</button>`).join('')}</div>`;
 548  }
 549  function wireSegs(root){
 550    root.querySelectorAll('.seg').forEach(s=>{
 551      const th=s.querySelector('.thumb'), bs=[...s.querySelectorAll('button')];
 552      const place=b=>{th.style.width=b.offsetWidth+'px';th.style.transform=`translateX(${b.offsetLeft}px)`;};
 553      const cur=bs.find(b=>b.classList.contains('on'))||bs[0]; requestAnimationFrame(()=>place(cur));
 554      bs.forEach(b=>b.addEventListener('click',()=>{bs.forEach(x=>{x.classList.remove('on');x.setAttribute('aria-selected','false')});b.classList.add('on');b.setAttribute('aria-selected','true');place(b);s.dispatchEvent(new CustomEvent('pick',{detail:bs.indexOf(b),bubbles:true}));}));
 555    });
 556  }
 557  const areaCounts = AREAS.map(a=>a.id==='all'?OCT.length:OCT.filter(r=>r.area===a.id).length);
```

### A.4 `s/comp/index.html` lines 594-754 (calendar redesign: donut-less KPIs, month grid, Next deadline, agenda, header, day pop-over, detail modal, empty, mobile)
```js
 594  /* =========================================================
 595     2 · CALENDAR — REDESIGN
 596     ========================================================= */
 597  function kpis(){
 598    const c={due:0,over:0,ok:0,up:0}; OCT.forEach(r=>c[status(r)]++);
 599    const k=(v,l,ac,ic,key)=>`<div class="kpi" style="--ac:${ac}" data-dd="status" data-k="${key}" data-set="oct" data-tip="${l} · ${v}"><span class="circ">${ic}</span><div><div class="metric v" data-count="${v}">${v}</div><div class="l">${l}</div></div></div>`;
 600    const pct=Math.round(FY_FILED/FY_TOTAL*100), C=2*Math.PI*22;
 601    return `<div class="kpis">
 602     ${k(OCT.length,'Due in October','var(--navy)',I.cal(18),'all')}
 603     ${k(c.due,'Due in 7 days','var(--due)',I.clock(18),'due')}
 604     ${k(c.over,'Overdue','var(--over)',I.alert(18),'over')}
 605     ${k(c.ok+SEP_FILED,'Filed (Sep–Oct)','var(--ok)',I.check(18),'ok')}
 606     <div class="kpi" style="--ac:var(--gold)" data-dd="status" data-k="ok" data-set="fy" data-tip="FY 2026-27 · 52 of 118 filed"><svg width="56" height="56" viewBox="0 0 56 56" style="flex:none"><circle cx="28" cy="28" r="22" fill="none" stroke="var(--raised)" stroke-width="7"/><circle cx="28" cy="28" r="22" fill="none" stroke="var(--ok)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C*pct/100} ${C}" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="13" fill="var(--fg)">${pct}%</text></svg><div><div class="metric" style="font-size:20px"><span data-count="${FY_FILED}">${FY_FILED}</span><span style="color:var(--subtle);font-size:14px"> / ${FY_TOTAL}</span></div><div class="l">FY 2026-27 filed</div></div></div>
 607    </div>`;
 608  }
 609  function monthGrid({month='2026-10',rows=OCT,sel=null,empty=false}={}){
 610    const [y,m]=month.split('-').map(Number); const first=new Date(y,m-1,1); const days=new Date(y,m,0).getDate();
 611    const start=(first.getDay()+6)%7; // Monday first
 612    const byDate={}; rows.forEach(r=>(byDate[r.due]=byDate[r.due]||[]).push(r));
 613    let h=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>`<div class="dow ${i>4?'we':''}">${d}</div>`).join('');
 614    const prevDays=new Date(y,m-1,0).getDate();
 615    for(let i=0;i<start;i++) h+=`<div class="day out"><div class="dn"><span class="dt">${prevDays-start+1+i}</span></div></div>`;
 616    for(let d=1;d<=days;d++){
 617      const iso=`${month}-${String(d).padStart(2,'0')}`; const it=byDate[iso]||[]; const wd=(start+d-1)%7;
 618      const s=it.length?worst(it):''; const isToday=iso===TODAY;
 619      h+=`<button class="day ${wd>4?'we':''} ${s?'s-'+s:''} ${isToday?'today':''} ${sel===iso?'sel':''}" data-iso="${iso}" ${it.length?`data-tip="${fmt(iso,{weekday:'short',day:'numeric',month:'short'})} · ${it.length} filing${it.length>1?'s':''}"`:''} aria-label="${fmt(iso,{weekday:'long',day:'numeric',month:'long'})}, ${it.length} filings">
 620        <div class="dn"><span class="dt">${d}</span>${isToday?`<span class="tlabel"><span class="pulse"></span><span class="tl-t">Today</span></span>`:''}${it.length>1?`<span class="mono" style="margin-left:auto;font-size:11px;color:var(--muted)">${it.length}</span>`:''}</div>
 621        ${it.slice(0,2).map(r=>`<span class="ev" data-s="${status(r)}"><i style="background:var(${ST[status(r)].v})"></i><span class="a">${AREA_SHORT[r.area]}</span><span class="t">${r.name}</span></span>`).join('')}
 622        ${it.length>2?`<span class="more">+${it.length-2} more</span>`:''}
 623      </button>`;
 624    }
 625    const tail=(7-((start+days)%7))%7; for(let i=1;i<=tail;i++) h+=`<div class="day out"><div class="dn"><span class="dt">${i}</span></div></div>`;
 626    return `<div class="cal-scroll"><div class="cal">${h}</div></div>`;
 627  }
 628  /* Next deadline card — colour options (owner: too many loud colours). One strong accent max; red only for the overdue dot/text. */
 629  function focusCard(v='A'){
 630    const INFO=infoBtn('GSTR-1 for Sep 2026 · due Sun 11 Oct · filed on the GSTN portal. Sales data received 3 Oct.');
 631    const dark=v==='B';
 632    const fg=dark?'#fff':'var(--fg)', mut=dark?'oklch(82% 0.03 255)':'var(--muted)', hair=dark?'oklch(100% 0 0 / .12)':'var(--hair)';
 633    const tile={A:'background:var(--navy);color:#fff',B:'background:var(--navy-3);color:#f3d58a',C:'background:var(--due);color:#fff',D:'background:var(--raised);color:var(--navy);box-shadow:inset 0 0 0 1px var(--border)'}[v];
 634    const card={A:'background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:16px 16px 14px',B:'background:var(--navy);border:1px solid var(--navy);padding:16px',C:'background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:16px',D:'background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:16px'}[v];
 635    const chipS=dark?'background:transparent;color:#fff;box-shadow:inset 0 0 0 1px oklch(100% 0 0 / .3)':'';
 636    const okChip=dark?`<span class="chip" style="${chipS}">${I.check(11)} Data received</span>`:v==='A'?`<span class="chip c-ok">${I.check(11)} Data received</span>`:`<span class="chip c-up">${I.check(11)} Data received</span>`;
 637    const primary=dark?'background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy))':'background:var(--navy);color:#fff';
 638    const ghost=dark?'background:transparent;color:#fff;border-color:oklch(100% 0 0 / .28)':'background:var(--panel);color:var(--fg);border-color:var(--border)';
 639    const bar=v==='D'?`<div data-dd="status" data-k="due" data-set="oct" data-tip="GSTR-1 · 3 of 7 days left" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-top:12px">${[1,2,3,4,5,6,7].map(i=>`<span style="height:6px;border-radius:2px;background:${i<=4?'var(--navy)':'var(--raised)'};${i===4?'box-shadow:0 0 0 2px var(--gold-soft)':''}"></span>`).join('')}</div><div style="display:flex;justify-content:space-between;font:600 11px 'IBM Plex Mono';color:var(--muted);margin-top:4px"><span>4 Oct</span><span style="color:var(--gold-text)">today</span><span>11 Oct</span></div>`:'';
 640    return `<div class="card" style="${card};color:${fg};overflow:hidden">
 641      <div style="display:flex;align-items:center;gap:6px;font:800 11px Manrope;letter-spacing:.08em;text-transform:uppercase;color:${dark?'#f3d58a':'var(--navy)'}">${v==='C'||v==='D'?'':'<span class="pulse"></span>'}Next deadline</div>
 642      <div style="display:flex;gap:14px;align-items:center;margin-top:10px">
 643        ${v==='D'?`<div data-dd="status" data-k="due" data-set="oct" data-tip="GSTR-1 · due Sun 11 Oct" style="min-width:56px"><b class="metric" style="font-size:40px;line-height:1;color:var(--navy-ink,var(--navy))">3</b><div style="font:800 11px Manrope;letter-spacing:.04em;color:var(--muted)">DAYS LEFT</div></div>`:
 644        `<div data-dd="status" data-k="due" data-set="oct" data-tip="GSTR-1 · due Sun 11 Oct" style="width:58px;height:62px;border-radius:10px;${tile};display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none"><b class="metric" style="font-size:28px;line-height:1;color:inherit">3</b><small style="font:800 11px Manrope;letter-spacing:.04em;opacity:.85">DAYS</small></div>`}
 645        <div style="min-width:0;flex:1"><div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;font:700 18px 'Space Grotesk';letter-spacing:-.02em">GSTR-1 · Sep 2026 ${portalBtn({area:'GST',name:'GSTR-1'},dark)}${INFO}</div><div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:6px">${dark?`<span class="chip" style="${chipS}">GST</span>`:areaChip('GST')}${okChip}</div></div>
 646      </div>${bar}
 647      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-s" style="${primary};flex:1">Open filing ${I.arrow(13)}</button><button class="btn btn-s" style="${ghost}">Remind me</button></div>
 648      <div data-dd="status" data-k="over" data-set="oct" data-tip="Overdue · 1" style="margin:14px -16px -14px;padding:10px 16px;border-top:1px solid ${hair};display:flex;align-items:center;gap:8px;font-size:12.5px">
 649        <i style="width:8px;height:8px;border-radius:99px;background:var(--over);flex:none"></i><b style="font-weight:700">ECB-2 return</b><span style="color:${dark?'oklch(80% 0.1 22)':'var(--over-text)'};font-weight:700">1 day late</span><span style="margin-left:auto;color:${mut};display:flex">${I.chevR(14)}</span></div>
 650    </div>`;
 651  }
 652  function focusOptions(){
 653    const O=[['A','Light card + navy accent ★ owner pick','White card, navy left bar, navy date tile, soft-tint chips. Overdue = red dot + red text row.'],
 654             ['B','Navy monochrome','Keeps navy. Tile in navy-3 with gold number, ghost chips. Overdue = red dot only, hairline row.'],
 655             ['C','Urgency tile only','Neutral white card. Only the tile carries colour: amber ≤ 3 days, red if overdue, else navy. Matches the date tile in the grid.'],
 656             ['D','Countdown bar','No coloured tile: a big navy number + a 7-day bar with a gold “today” mark. Calmest.']];
 657    const rail=v=>`<div style="display:flex;flex-direction:column;gap:16px">${focusCard(v)}${agendaRail(OCT.filter(r=>r.due>='2026-10-07').slice(0,3),{title:'Coming up'})}</div>`;
 658    return `<div style="padding:28px 32px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;align-items:start">${O.map(([k,t,d])=>`<section style="display:flex;flex-direction:column;gap:10px">
 659      <div style="display:flex;align-items:center;gap:8px"><span style="width:26px;height:26px;border-radius:6px;background:var(--navy);color:#fff;display:grid;place-items:center;font:700 13px 'Space Grotesk'">${k}</span><b style="font-size:14px">${t}</b></div>
 660      <div style="font-size:12px;color:var(--muted);min-height:48px">${d}</div>
 661      <div style="background:var(--bg);border:1px dashed var(--border);border-radius:10px;padding:12px">${rail(k)}</div></section>`).join('')}</div>
 662     <div style="padding:0 32px 28px"><div class="card t" style="padding:14px 18px;font-size:13px"><b>Owner pick: A</b> (applied to the Calendar Redesign). Designer suggestion was C.</div></div>`;
 663  }
 664  function agendaRail(rows=OCT,{title='Agenda · October'}={}){
 665    const byDate={}; rows.forEach(r=>(byDate[r.due]=byDate[r.due]||[]).push(r));
 666    const upcoming=Object.keys(byDate).sort();
 667    return `<div class="card" style="padding:14px 16px 6px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><p class="st" style="flex:1">${title}</p><span class="mono" style="font-size:11px;color:var(--muted)">${rows.length}</span></div>
 668     ${upcoming.map(d=>{const s=worst(byDate[d]);return `<div class="ag-date"><div class="dtile" style="background:var(${ST[s].v});${s==='up'?'background:var(--navy)':''}"><b>${+d.slice(8)}</b><small>${dow(d)}</small></div><div class="ag-items">${byDate[d].map(r=>`<div class="ag-it">${areaChip(r.area)}<span class="nm">${r.name}</span>${chip(status(r))}</div>`).join('')}</div></div>`}).join('')}
 669    </div>`;
 670  }
 671  const monthNav=(month='October 2026')=>`<div style="display:flex;align-items:center;gap:2px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:2px"><button class="ibtn" style="border:0;width:28px;height:28px" aria-label="Previous month">${I.chevL(15)}</button><span class="mpk-lbl"><button type="button" class="mpk-b" data-pk="m" aria-haspopup="dialog" aria-label="Choose month"><span>${month.split(' ')[0]}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></button><button type="button" class="mpk-b" data-pk="y" aria-haspopup="dialog" aria-label="Choose year"><span>${month.split(' ')[1]}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></button></span><button class="ibtn" style="border:0;width:28px;height:28px" aria-label="Next month">${I.chevR(15)}</button></div>`;
 672  function calHeader(month='October 2026',infoOpen=false,withNav=true,lead=''){
 673    return `<div class="row-wrap" style="display:flex;align-items:center;gap:12px">
 674      ${lead}
 675      <div class="end" style="margin-left:auto;display:flex;align-items:center;gap:8px">
 676        ${withNav?monthNav(month):''}
 677        <span data-calview style="display:contents">${seg(['Month','Year','Timeline'],0,{dots:null})}</span>
 678        <a class="btn btn-o btn-s" style="color:var(--navy-ink,var(--navy))">${I.file(14)} Filings</a>
 679      </div></div>`;
 680  }
 681  function filterRow(on=0){
 682    return `<div style="display:flex;align-items:center;gap:12px">${seg(AREAS.map(a=>a.label),on,{counts:areaCounts})}
 683     <div style="margin-left:auto;display:flex;gap:14px;align-items:center;font-size:11.5px;font-weight:700;color:var(--muted)">${['over','due','ok','up'].map(s=>`<span style="display:flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:3px;background:var(${s==='up'?'--navy':ST[s].v})"></i>${ST[s].l}</span>`).join('')}</div></div>`;
 684  }
 685  function calRedesign(opts={}){
 686    /* Owner layout (9 Oct): area pill + month nav on top of the calendar column; donut moves into the right rail above Next deadline; whole month fits at 1440×900. */
 687    const content=`${calHeader('October 2026',opts.infoOpen,false,`<div data-calnav class="calbar"><div data-calnavr>${monthNav('October 2026')}</div><span class="mono" style="flex:none;font-size:11px;font-weight:600;padding:5px 8px;border-radius:5px;background:var(--gold-soft);color:var(--gold-text)">FY 2026-27</span><div class="seg-scroll">${seg(AREAS.map(a=>a.label),0,{counts:areaCounts})}</div></div>`)}
 688     <div class="cal-layout" style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start">
 689       <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
 690         
 691         <div class="card t" data-calbody style="padding:12px" id="${opts.gridId||''}">${monthGrid({sel:opts.sel})}</div>
 692       </div>
 693       <div class="cal-rail" style="display:flex;flex-direction:column;gap:12px">${donutCard(OCT,'oct','October')}${focusCard()}${agendaRail(OCT.filter(r=>r.due>='2026-10-07').slice(0,7),{title:'Coming up'})}</div>
 694     </div>`;
 695    return frame('cal',['Compliances','Calendar'],content,opts.extra||'');
 696  }
 697  
 698  /* ---------- key states ---------- */
 699  const dayRow=r=>`<div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;cursor:pointer">${areaChip(r.area)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12.5px">${nameWithLinks(r)}</div><div style="font-size:11px;color:var(--muted)">${r.period}</div></div>${proofChip(r)}${chip(status(r))}</div>`;
 700  function dayPopover(){
 701    const rows=OCT.filter(r=>r.due==='2026-10-15');
 702    return `<div class="dpop" style="left:var(--x);top:var(--y)">
 703     <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div class="dtile" style="background:var(--due);width:40px;height:44px"><b style="font-size:16px">15</b><small>Thu</small></div><div style="flex:1"><b style="font-size:14px">Thursday 15 October</b><div style="font-size:11.5px;color:var(--due-text);font-weight:700">2 filings · in 7 days</div></div><button class="ibtn" style="border:0" aria-label="Close">${I.x(14)}</button></div>
 704     ${rows.map(dayRow).join('')}
 705     <div class="ask">🤖 Ask VCFO</div></div>`;
 706  }
 707  function detailModal(){
 708    const r=OCT.find(x=>x.name==='GSTR-3B');
 709    return `<div class="scrim"></div><div class="modal" style="left:50%;top:90px;transform:translateX(-50%);width:600px">
 710     <div style="padding:18px 20px;border-bottom:1px solid var(--hair);display:flex;gap:14px;align-items:flex-start">
 711       <div class="dtile" style="background:var(--navy);width:56px;height:62px"><b style="font-size:24px">20</b><small>Oct · Tue</small></div>
 712       <div style="flex:1"><div style="display:flex;gap:6px;margin-bottom:6px">${areaChip('GST')}${chip('up')}<span class="chip c-prog">${I.clock(11)} 12 days left</span></div><div style="font:700 22px 'Space Grotesk';letter-spacing:-.02em;display:flex;align-items:center;gap:6px">GSTR-3B · September 2026 ${portalBtn(r)}</div></div>
 713       <button class="ibtn" aria-label="Close">${I.x(15)}</button></div>
 714     <div style="padding:18px 20px;display:flex;flex-direction:column;gap:18px">
 715       ${focusTrack([{st:'done',label:'Data received',sub:'2 Oct',tip:'Done · 2 Oct'},{st:'cur',label:'SBC preparing',sub:'Since 4 Oct · Arjun Mehta',tip:'With SBC · Arjun Mehta',icon:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>'},{st:'next',label:'Northwind approves',sub:'by 18 Oct',tip:'Upcoming · waiting on Northwind from 17 Oct'},{st:'next',label:'Filed',sub:'due 20 Oct',tip:'Upcoming · due 20 Oct'}])}
 716       <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
 717        ${[['Authority','GSTN'],['Frequency','Monthly'],['Period','1–30 Sep 2026'],['Penalty risk','<span class="chip c-due">Medium</span>']].map(([k,v])=>`<div style="padding:10px;border-radius:8px;background:var(--raised)"><div style="font:800 10px Manrope;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${k}</div><div style="font-weight:700;margin-top:4px">${v}</div></div>`).join('')}
 718       </div>
 719       <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--gold-soft);color:var(--gold-text);font-weight:600;font-size:12.5px">${I.user(16)}<span style="flex:1">SBC will send the draft for Northwind’s approval by 17 Oct.</span></div>
 720     </div>
 721     <div style="padding:12px 20px;border-top:1px solid var(--hair);display:flex;gap:8px;align-items:center"><span class="ask" style="border:0;margin:0;padding:0;flex:1">🤖 Ask VCFO about GSTR-3B</span><button class="btn btn-o btn-s">${I.cal(14)} Add to my calendar</button><button class="btn btn-n btn-s">Open in filings ${I.arrow(13)}</button></div></div>`;
 722  }
 723  function calStatesDay(){
 724    return calRedesign({sel:'2026-10-15',extra:`<div class="dpop" id="dpop-anchor" style="left:780px;top:520px">${dayPopover().replace(/^<div class="dpop"[^>]*>/,'').replace(/<\/div>$/,'')}</div>`});
 725  }
 726  function calStatesDetail(){ return calRedesign({extra:detailModal()}); }
 727  function calEmpty(){
 728    const content=`${calHeader('May 2027')}
 729     ${filterRow(5)}
 730     <div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start">
 731      <div class="card t" style="padding:14px;position:relative">${monthGrid({month:'2027-05',rows:[]})}
 732        <div style="position:absolute;inset:44px 14px 14px;display:grid;place-items:center;background:light-dark(oklch(97.4% 0.006 255 / .7), oklch(16.9% 0.006 255 / 0.7));border-radius:10px;backdrop-filter:blur(1px)">
 733         ${botSay('No FEMA deadlines in May.<br>The next one is Softex on 30 Jun.',{size:56,secondary:'<button class="btn btn-n btn-s" style="height:28px">Show all areas</button>'})}</div></div>
 734      <div style="display:flex;flex-direction:column;gap:16px"><div class="card" style="padding:14px">${botSay('All clear this month.<br>Nothing due, nothing overdue.',{size:40,action:''})}</div>
 735      <div class="card" style="padding:14px 16px"><p class="st" style="margin-bottom:10px">Loading state</p>${[1,2,3].map(()=>`<div style="display:flex;gap:10px;margin-bottom:10px"><div style="width:44px;height:48px;border-radius:8px;background:var(--raised);animation:sk 1.2s infinite"></div><div style="flex:1;display:flex;flex-direction:column;gap:6px;justify-content:center"><div style="height:10px;border-radius:4px;background:var(--raised);width:80%"></div><div style="height:10px;border-radius:4px;background:var(--raised);width:50%"></div></div></div>`).join('')}</div></div>
 736     </div>`;
 737    return frame('cal',['Compliances','Calendar'],content);
 738  }
 739  function calMobile(){
 740    const week=['05','06','07','08','09','10','11'];
 741    const byDate={}; OCT.forEach(r=>(byDate[r.due]=byDate[r.due]||[]).push(r));
 742    const rows=OCT.filter(r=>r.due>='2026-10-07');
 743    return `<div class="cm-root">
 744     <header style="height:56px;display:flex;align-items:center;gap:6px;padding:0 8px;background:light-dark(#fff, oklch(13% 0 89.9));border-bottom:1px solid var(--border)"><button class="tb" data-vp-menu aria-label="Menu">${I.menu(20)}</button><span style="font:800 15px 'Space Grotesk';color:var(--navy-ink,var(--navy))">SBC</span><span style="flex:1;min-width:0;font-weight:600;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">/ <b style="color:var(--fg)">Calendar</b></span><button class="tb" aria-label="Search">${I.search(18)}</button><button class="tb" aria-label="Notifications, 3 new" style="background:var(--primary-light);color:var(--primary)">${I.bell(18)}<span class="badge">3</span></button></header>
 745     <div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">
 746      <div style="display:flex;align-items:center;gap:8px"><span style="margin-left:auto;display:flex;align-items:center;gap:2px"><button class="ibtn" style="border:0" aria-label="Previous week">${I.chevL(15)}</button><b style="font:700 13px 'Space Grotesk'">Oct 2026</b><button class="ibtn" style="border:0" aria-label="Next week">${I.chevR(15)}</button></span></div>
 747      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${[['3','Due in 7 days','--due'],['1','Overdue','--over'],['44%','FY filed','--ok']].map(([v,l,c])=>`<div style="background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);border-radius:10px;padding:10px;border-top:3px solid var(${c})"><div class="metric" style="font-size:22px">${v}</div><div style="font-size:11px;font-weight:700;color:var(--muted)">${l}</div></div>`).join('')}</div>
 748      <div class="cm-seg"><div style="width:max-content">${seg(AREAS.map(a=>a.label),0,{counts:areaCounts})}</div></div>
 749      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">${week.map((d,i)=>{const iso='2026-10-'+d;const it=byDate[iso]||[];const s=it.length?worst(it):'';const bg=s?`var(${s==='up'?'--navy':ST[s].v})`:'#fff';const t=iso===TODAY;return `<div style="height:58px;border-radius:8px;background:${bg};color:${s?'#fff':'var(--fg)'};border:1px solid ${s?'transparent':'var(--border)'};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;${t?'box-shadow:0 0 0 2px var(--navy)':''}"><small style="font:800 11px Manrope;opacity:.8">${['M','T','W','T','F','S','S'][i]}</small><b style="font:700 16px 'Space Grotesk'">${+d}</b>${t?'<span class="pulse"></span>':`<small style="font-size:11px;line-height:7px;height:7px;letter-spacing:-1px">${it.length?'●'.repeat(Math.min(it.length,3)):''}</small>`}</div>`}).join('')}</div>
 750      <div style="display:flex;flex-direction:column;gap:8px">${rows.slice(0,6).map(r=>{const s=status(r);return `<div style="display:flex;gap:10px;align-items:center;min-height:56px;background:light-dark(#fff, oklch(13% 0 89.9));border:1px solid var(--border);border-radius:10px;padding:8px"><div class="dtile" style="background:var(${s==='up'?'--navy':ST[s].v});width:40px;height:44px"><b style="font-size:16px">${+r.due.slice(8)}</b><small>${dow(r.due)}</small></div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:3px">${areaChip(r.area)}${chip(s)}</div></div>${I.chevR(15)}</div>`}).join('')}</div>
 751     </div>
 752     <div class="bot" style="right:14px;bottom:14px;transform:scale(.8);transform-origin:bottom right"><span class="lab">Ask VCFO</span><span class="face">${BOT}</span></div>
 753    </div>`;
 754  }
```

### A.5 `s/comp/index.html` lines 756-834 (filings data, donut, KPIs, row, page, side panel, preview)
```js
 756  /* =========================================================
 757     FILINGS
 758     ========================================================= */
 759  const FIL = [
 760    ...OCT,
 761    {id:'s1',due:'2026-09-20',area:'GST',name:'GSTR-3B',period:'Aug 2026',filed:'2026-09-18',freq:'Monthly',auth:'GSTN'},
 762    {id:'s2',due:'2026-09-11',area:'GST',name:'GSTR-1',period:'Aug 2026',filed:'2026-09-10',freq:'Monthly',auth:'GSTN'},
 763    {id:'s3',due:'2026-09-30',area:'MCA',name:'AGM held (Sec 96)',period:'FY 2025-26',filed:'2026-09-26',freq:'Annual',auth:'MCA'},
 764    {id:'s4',due:'2026-09-15',area:'IT',name:'Advance tax Q2',period:'Jul–Sep 2026',filed:'2026-09-14',freq:'Quarterly',auth:'Income Tax Dept'},
 765    {id:'s5',due:'2026-09-15',area:'PAY',name:'PF & ESI payment',period:'Aug 2026',filed:'2026-09-12',freq:'Monthly',auth:'EPFO · ESIC'},
 766  ];
 767  function filCurrent(){
 768    const rows=OCT.map(r=>`<tr><td>${({MCA:'MCA',GST:'GST',IT:'Income Tax',PAY:'Labour',FEMA:'FEMA'})[r.area]}</td><td style="font-weight:600">${r.name} <span style="color:var(--subtle)">${I.info(12)}</span></td><td><a style="font-weight:500">${fmt(r.due,{day:'2-digit',month:'short',year:'numeric'})}</a></td><td style="color:var(--muted)">${r.filed?fmt(r.filed,{day:'2-digit',month:'short',year:'numeric'}):'—'}</td><td style="color:var(--muted)">${r.freq.toLowerCase()}</td><td style="color:var(--muted)">—</td><td><span class="rpill ${ST[status(r)].c}">${ST[status(r)].l}</span></td></tr>`).join('');
 769    const content=`<div class="old" style="display:flex;flex-direction:column;gap:12px">
 770      <div style="display:flex;align-items:center;gap:8px"><h1 class="h-serif" style="flex:1">Filings</h1><span style="display:flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:99px;padding:2px 6px">${I.chevL(13)}<b class="mono" style="font-size:11.5px">FY 2026-27</b>${I.chevR(13)}</span><span class="pill-btn">${I.cal(13)} Open calendar</span></div>
 771      <div style="display:flex;align-items:center"><span class="sp"><span class="on">Monthly</span><span>Quarterly</span><span>Annual</span></span><span class="sp" style="margin-left:auto"><span class="on">All</span><span>Filed</span><span>Overdue</span><span>Due soon</span><span>Upcoming</span></span></div>
 772      <div class="surface" style="overflow:hidden"><div style="display:flex;align-items:center;padding:12px 14px;gap:10px"><span style="width:28px;height:28px;border-radius:8px;background:var(--primary-fill,var(--primary));color:#fff;display:grid;place-items:center">${I.file(14)}</span><b style="flex:1">Monthly · October 2026</b><span style="border:1px solid var(--border);border-radius:99px;padding:2px 10px;font-size:11px;font-weight:700;color:var(--primary)">Full year</span></div>
 773      <div style="display:flex;justify-content:space-between;padding:8px 14px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--muted)"><span>‹ Sep</span><span class="mono" style="color:var(--fg)">Oct 2026</span><span>Nov ›</span></div>
 774      <table><thead><tr><th>Compliance</th><th>Particular</th><th>Due Date</th><th>Filed Date</th><th>Frequency</th><th>Window</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
 775    const notes=`<div class="note" data-n="1" style="left:860px;top:150px">Two pickers, both grey; the active one barely shows.</div>
 776    <div class="note" data-n="2" style="left:1180px;top:330px">“Window” is empty for clients (manager-only data).</div>
 777    <div class="note" data-n="3" style="left:320px;top:820px">No way to see the filed proof (ARN / challan) — evidence_url exists in the DB but is not shown.</div>`;
 778    return frame('fil',['Compliances','Filings'],content,notes);
 779  }
 780  function donutCard(rows,set,label){
 781    const c={ok:0,due:0,over:0,up:0}; rows.forEach(r=>c[status(r)]++);
 782    const tot=rows.length; let acc=0; const C=2*Math.PI*35;
 783    const seg2=['ok','due','over','up'].map(s=>{const len=C*c[s]/tot; const el=`<circle data-dd="status" data-k="${s}" data-set="${set}" data-tip="${ST[s].l} · ${c[s]}" cx="44" cy="44" r="35" fill="none" stroke="var(${s==='up'?'--up':ST[s].v})" stroke-width="11" stroke-dasharray="${Math.max(len-2,0)} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 44 44)"/>`; acc+=len; return el;}).join('');
 784    return `<div class="card t donut" style="padding:12px 16px;display:flex;gap:16px;align-items:center"><svg width="88" height="88" viewBox="0 0 88 88">${seg2}<circle data-dd="status" data-k="all" data-set="${set}" data-tip="All filings · ${tot}" cx="44" cy="44" r="29" fill="transparent"/><text pointer-events="none" x="44" y="42" text-anchor="middle" font-family="Space Grotesk" font-weight="600" font-size="20" fill="var(--fg)">${tot}</text><text pointer-events="none" x="44" y="57" text-anchor="middle" font-family="Manrope" font-weight="600" font-size="11" fill="var(--muted)">${label}</text></svg>
 785      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:6px 16px;flex:1 1 220px;min-width:0">${['ok','due','over','up'].map(s=>`<div data-dd="status" data-k="${s}" data-set="${set}" data-tip="${ST[s].l} · ${c[s]}" style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600"><i style="width:10px;height:10px;border-radius:3px;background:var(${s==='up'?'--up':ST[s].v})"></i><span style="flex:1">${ST[s].l}</span><b class="mono">${c[s]}</b></div>`).join('')}</div></div>`;
 786  }
 787  function filKpis(){
 788    const all=FIL; const c={ok:0,due:0,over:0,up:0}; all.forEach(r=>c[status(r)]++);
 789    const areaBars=['MCA','GST','IT','PAY','FEMA'].map(a=>{const rs=all.filter(r=>r.area===a); const f=rs.filter(r=>r.filed).length; const o=rs.filter(r=>status(r)==='over').length; const d=rs.filter(r=>status(r)==='due').length; return `<div style="display:flex;align-items:center;gap:10px"><span data-dd="area" data-k="${a}" data-set="fil" data-tip="${AREAS.find(x=>x.id===a).label} · ${rs.length} filings" style="width:74px;flex:none;font-size:12px;font-weight:700">${AREAS.find(x=>x.id===a).label}</span><span style="flex:1;display:flex;gap:2px;height:12px;border-radius:4px;overflow:hidden;background:var(--raised)">${f?`<span data-dd="area" data-k="${a}" data-set="fil" data-tip="${AREAS.find(x=>x.id===a).label} · ${f} filed" style="flex:${f};background:var(--ok)"></span>`:''}${o?`<span data-dd="area" data-k="${a}" data-set="fil" data-tip="${AREAS.find(x=>x.id===a).label} · ${o} overdue" style="flex:${o};background:var(--over)"></span>`:''}${d?`<span data-dd="area" data-k="${a}" data-set="fil" data-tip="${AREAS.find(x=>x.id===a).label} · ${d} due soon" style="flex:${d};background:var(--due)"></span>`:''}<span data-dd="area" data-k="${a}" data-set="fil" data-tip="${AREAS.find(x=>x.id===a).label} · ${rs.length-f-o-d} upcoming" style="flex:${rs.length-f-o-d};background:var(--up)"></span></span><span class="mono" style="width:34px;flex:none;text-align:right;font-size:11px;color:var(--muted)">${f}/${rs.length}</span></div>`}).join('');
 790    return `<div class="fil-kpis" style="display:grid;grid-template-columns:360px 1fr;gap:16px">
 791     ${donutCard(FIL,'fil','filings')}
 792     <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:9px"><p class="st" style="margin-bottom:2px">By area · Sep–Oct</p>${areaBars}</div></div>`;
 793  }
 794  function filRow(r){
 795    const s=status(r);
 796    return `<tr data-id="${r.id}"><td><div class="dtile" style="width:38px;height:42px;background:var(${s==='up'?'--navy':ST[s].v})"><b style="font-size:15px">${+r.due.slice(8)}</b><small>${fmt(r.due,{month:'short'})}</small></div></td>
 797     <td>${areaChip(r.area)}</td><td><div style="font-weight:700;font-size:13px">${nameWithLinks(r)}</div><div style="font-size:11px;color:var(--muted)">${r.period}</div></td>
 798     <td style="color:var(--muted)">${r.freq}</td>
 799     <td>${r.filed?`<span style="font-weight:600">${fmt(r.filed)}</span>`:s==='over'?`<span style="color:var(--over-text);font-weight:700">${-daysLeft(r.due)} day late</span>`:`<span style="color:var(--muted)">in ${daysLeft(r.due)} days</span>`}</td>
 800     <td>${chip(s)}</td>
 801     <td style="text-align:right">${r.filed?(PROOF_PENDING.has(r.id)?proofChip(r):`<span style="display:inline-flex;gap:6px;align-items:center">${proofChip(r)}<button class="ibtn" data-tip="Download" aria-label="Download proof">${I.down(15)}</button></span>`):`<span style="color:var(--subtle);font-size:11px">—</span>`}</td></tr>`;
 802  }
 803  function filRedesign(extra=''){
 804    const rows=[...FIL].sort((a,b)=>a.due<b.due?-1:1).filter(r=>r.due>='2026-09-15');
 805    const content=`<div class="row-wrap" style="display:flex;align-items:center;gap:12px">
 806      <div style="display:flex;align-items:center;gap:2px;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:2px"><button class="ibtn" style="border:0;width:28px;height:28px">${I.chevL(15)}</button><b class="mono" style="font-size:12px;min-width:84px;text-align:center">FY 2026-27</b><button class="ibtn" style="border:0;width:28px;height:28px">${I.chevR(15)}</button></div>
 807      <div class="end" style="margin-left:auto;display:flex;gap:8px;align-items:center"><div class="seg-scroll">${seg(['Monthly','Quarterly','Annual'],0)}</div><button class="btn btn-o btn-s">${I.down(14)} Export</button><a class="btn btn-o btn-s" style="color:var(--navy-ink,var(--navy))">${I.cal(14)} Calendar</a></div></div>
 808     ${filKpis()}
 809     <div class="row-wrap" style="display:flex;gap:12px;align-items:center"><div class="seg-scroll">${seg(AREAS.map(a=>a.label),0,{counts:AREAS.map(a=>a.id==='all'?FIL.length:FIL.filter(r=>r.area===a.id).length)})}</div><div class="end seg-scroll" style="margin-left:auto">${seg(['All','Overdue','Due soon','Upcoming','Filed'],0,{dots:[null,'var(--over)','var(--due)','var(--up)','var(--ok)']})}</div></div>
 810     <div class="card" style="overflow:hidden"><div class="fil-head" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)"><button class="ibtn" style="border:0">${I.chevL(15)}</button><b style="font:700 15px 'Space Grotesk'">Sep – Oct 2026</b><button class="ibtn" style="border:0">${I.chevR(15)}</button><span class="mono" style="font-size:11px;color:var(--muted)">${rows.length} filings</span><button class="btn btn-o btn-s" style="margin-left:auto">Full year</button></div>
 811     <div class="tbl-scroll"><table><thead><tr><th style="width:56px">Due</th><th style="width:70px">Area</th><th>Filing</th><th>Frequency</th><th>Filed on</th><th>Status</th><th style="text-align:right">Proof</th></tr></thead><tbody>${rows.map(filRow).join('')}</tbody></table></div></div>`;
 812    return frame('fil',['Compliances','Filings'],content,extra);
 813  }
 814  function filDetail(){
 815    return `<div class="scrim"></div><div class="modal" style="right:24px;top:24px;bottom:24px;width:520px;display:flex;flex-direction:column">
 816     <div style="padding:18px 20px;border-bottom:1px solid var(--hair);display:flex;gap:14px;align-items:flex-start"><div class="dtile" style="background:var(--ok);width:56px;height:62px"><b style="font-size:24px">20</b><small>Sep</small></div><div style="flex:1"><div style="display:flex;gap:6px;margin-bottom:6px">${areaChip('GST')}${chip('ok')}${proofChip({filed:'x',id:'s1',name:'GSTR-3B',period:'Aug 2026'})}<span class="chip c-ok">2 days early</span></div><div style="font:700 21px 'Space Grotesk';letter-spacing:-.02em;display:flex;align-items:center;gap:6px">GSTR-3B · August 2026 ${portalBtn({area:'GST',name:'GSTR-3B'})}</div></div><button class="ibtn">${I.x(15)}</button></div>
 817     <div style="padding:18px 20px;display:flex;flex-direction:column;gap:18px;flex:1;overflow:auto">
 818      ${focusTrack([{st:'done',label:'Data',sub:'3 Sep',tip:'Done · 3 Sep'},{st:'done',label:'Prepared',sub:'12 Sep',tip:'Done · 12 Sep'},{st:'done',label:'Northwind approved',sub:'16 Sep',tip:'Done · 16 Sep'},{st:'done',label:'Filed',sub:'18 Sep',tip:'Done · 18 Sep · 2 days early'}])}
 819      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${[['ARN','<span class="mono">AA3609261847215</span>'],['Tax paid','<span class="metric" style="font-size:16px">₹ 4,82,310</span>'],['Due date','20 Sep 2026'],['Filed by','Arjun Mehta · SBC']].map(([k,v])=>`<div style="padding:10px;border-radius:8px;background:var(--raised)"><div style="font:800 10px Manrope;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${k}</div><div style="font-weight:700;margin-top:4px">${v}</div></div>`).join('')}</div>
 820      <div><p class="st" style="margin-bottom:8px">Proof</p>${[['GSTR-3B acknowledgement.pdf','142 KB'],['Challan PMT-06 (CIN).pdf','88 KB']].map(([n,s],i)=>`<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid ${i===0?'oklch(54.6% 0.215 263 / .4)':'var(--border)'};border-radius:8px;margin-bottom:6px;${i===0?'background:var(--primary-light)':''}"><span style="width:34px;height:40px;border-radius:4px;background:var(--over);color:#fff;display:grid;place-items:center;font:800 9px Manrope">PDF</span><div style="flex:1"><b style="font-size:12.5px">${n}</b><div style="font-size:11px;color:var(--muted)">${s} · 18 Sep</div></div><button class="ibtn" data-proof="GSTR-3B · Aug 2026" data-tip="Preview">${I.eye(15)}</button><button class="ibtn" data-tip="Download">${I.down(15)}</button></div>`).join('')}</div>
 821     </div>
 822     <div style="padding:12px 20px;border-top:1px solid var(--hair);display:flex"><span class="ask" style="border:0;margin:0;padding:0">🤖 Ask VCFO about this filing</span></div></div>`;
 823  }
 824  function docPreview(){
 825    return `<div class="scrim" style="background:oklch(15% 0.03 264 / .72)"></div>
 826    <div class="pv-top"><span style="width:30px;height:34px;border-radius:4px;background:var(--over);display:grid;place-items:center;font:800 11px Manrope;flex:none">PDF</span><div style="flex:1 1 180px"><b>GSTR-3B acknowledgement.pdf</b><div style="font-size:11px;opacity:.7">GSTR-3B · Aug 2026 · filed 18 Sep</div></div><span class="mono" style="opacity:.8">1 / 1</span><button class="btn btn-s" style="background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy))">${I.down(14)} Download</button><button class="ibtn" data-close-pv style="background:oklch(100% 0 0 / .1);border-color:oklch(100% 0 0 / .2);color:#fff">${I.x(15)}</button></div>
 827    <div class="pv-page">
 828      <div style="text-align:center;border-bottom:2px solid #222;padding-bottom:12px"><div style="font:700 13px Manrope;letter-spacing:.1em">GOODS AND SERVICES TAX</div><div style="font:700 18px Georgia;margin-top:6px">Acknowledgement</div><div style="font:12px Manrope;color:light-dark(#555, oklch(82% 0 89.9));margin-top:2px">Form GSTR-3B · Return filed successfully</div></div>
 829      <table style="margin-top:22px;font:13px Manrope">${[['GSTIN','36AAKCN4821M1Z5'],['Legal name','Northwind Analytics India Pvt Ltd'],['Return period','August 2026'],['Financial year','2026-27'],['ARN','AA3609261847215'],['Date of filing','18/09/2026 17:42'],['Tax paid (cash + ITC)','₹ 4,82,310.00'],['Status','Filed']].map(([k,v])=>`<tr style="cursor:default"><td style="border-top:1px solid light-dark(#e6e6e6, oklch(25% 0 89.9));padding:9px 0;color:light-dark(#555, oklch(82% 0 89.9));width:46%">${k}</td><td style="border-top:1px solid light-dark(#e6e6e6, oklch(25% 0 89.9));padding:9px 0;font-weight:700">${v}</td></tr>`).join('')}</table>
 830      <div style="margin-top:28px;margin-bottom:110px;font:12px/1.6 Manrope;color:light-dark(#555, oklch(82% 0 89.9))">This is a system-generated acknowledgement. The return for the above period has been filed and is available on the common portal.</div>
 831      <div style="position:absolute;right:clamp(16px,5vw,54px);bottom:clamp(16px,4vw,46px);width:96px;height:96px;border:3px solid oklch(56% 0.13 168);border-radius:99px;color:light-dark(oklch(45% 0.12 168), oklch(82% 0.084 168));display:grid;place-items:center;font:800 13px Manrope;transform:rotate(-12deg)">FILED</div>
 832    </div>
 833    <div class="pv-zoom" style="position:absolute;z-index:60;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:6px;background:oklch(100% 0 0 / .12);border-radius:8px;padding:4px"><button class="ibtn" style="border:0;background:transparent;color:#fff">−</button><span style="color:#fff;font:600 12px 'IBM Plex Mono';align-self:center">100%</span><button class="ibtn" style="border:0;background:transparent;color:#fff">+</button></div>`;
 834  }
```

### A.6 `s/comp/index.html` lines 836-873 (improvements + owner decisions board)
```js
 836  /* =========================================================
 837     IMPROVEMENTS + OPEN QUESTIONS
 838     ========================================================= */
 839  function improvements(){
 840    const T=(head,rows)=>`<table style="font-size:13px"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr style="cursor:default">${r.map((c,i)=>`<td style="white-space:normal;${i===0?'font-weight:700':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 841    return `<div style="padding:32px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
 842     <div class="card t" style="padding:18px 20px"><p class="st" style="margin-bottom:12px">What changed — Calendar</p>${T(['Before','After'],[
 843      ['Two calendars + a repeated month list','One big month grid + one agenda rail'],
 844      ['Small dots coloured by act (8 acts)','Big date tiles coloured by status (red · amber · green · navy)'],
 845      ['Text-only summary line','4 KPI tiles with count-up + FY donut'],
 846      ['Legend toggles, All / Overdue picker','Navy sliding pill: All · MCA · GST · Income tax · Payroll · FEMA'],
 847      ['Click day → scroll list','Click day → day pop-over; click filing → detail pop-up'],
 848      ['No “what’s next” focus','Navy due-soon focus card + overdue alert strip'],
 849      ['Helper text under titles','(i) pop-over with “Ask VCFO about this”']])}</div>
 850     <div class="card t" style="padding:18px 20px"><p class="st" style="margin-bottom:12px">What changed — Filings</p>${T(['Before','After'],[
 851      ['Plain table, grey pickers','Date tiles + area chips + status chips, navy pills'],
 852      ['No overview','Status donut + stacked bars per area'],
 853      ['Empty “Window” column for clients','Removed for client; “Filed on / in N days / N days late” instead'],
 854      ['Filed proof not shown','👁 Preview · ⬇ Download on every filed row (uses evidence_url)'],
 855      ['No filing detail','Detail panel: 4-step timeline, ARN, tax paid, proof files'],
 856      ['Status filter only','Area pill + status pill with coloured dots']])}</div>
 857     <div class="card" style="padding:18px 20px"><p class="st" style="margin-bottom:12px">Other small improvements (proposed)</p>${T(['#','Idea','Effort'],[
 858      ['1','“Add to my calendar” (.ics) on a filing and for the whole FY','S'],
 859      ['2','“Remind me” → email + WhatsApp nudge 3 days before (uses the existing notify path)','M'],
 860      ['3','Keyboard: ← → months, T = today, 1-6 = area filter','S'],
 861      ['4','Remember the last area filter per user (localStorage, per-viewer)','S'],
 862      ['5','Export filings to Excel / PDF for the auditor','M'],
 863      ['6','“Northwind approves” step: client approves a draft return from the detail pop-up','L'],
 864      ['7','Hide empty areas from the pill when the client has none (e.g. no FEMA)','S']])}</div>
 865     <div class="card" style="padding:18px 20px"><p class="st" style="margin-bottom:12px">Decisions · owner approved the picks (9 Oct)</p>${T(['Question','Decision'],[
 866      ['Tile colour = status or area?','<b>Status</b> (rule 4: one meaning per colour). Area = navy mono chip.'],
 867      ['Keep the 8-act legend (STPI, RERA, TP)?','<b>No</b> for clients — use the 5 areas; fold Labour into Payroll, STPI into FEMA.'],
 868      ['Week starts Sunday (today) or Monday?','<b>Monday</b> — Indian business norm; weekends grouped at the end.'],
 869      ['Show “Northwind approves” step now?','<b>Show as design</b>, build later (needs approval data).'],
 870      ['Mobile: month grid or week strip?','<b>Week strip + agenda</b> — grid too small at 390.'],
 871      ['Detail as pop-up or side panel?','<b>Calendar: pop-up</b>; <b>Filings: side panel</b> (keeps the table visible).']])}</div>
 872    </div>`;
 873  }
```

### A.7 `s/comp/index.html` lines 915-932 (bot empty-state board)
```js
 915  function botBoard(){
 916    const cell=(t,html)=>`<div class="card" style="padding:18px;display:flex;flex-direction:column;gap:14px"><p class="st">${t}</p><div style="flex:1;display:grid;place-items:center;min-height:150px;background:var(--bg);border-radius:8px;padding:16px">${html}</div></div>`;
 917    return `<div style="padding:28px 32px;display:flex;flex-direction:column;gap:20px">
 918     <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
 919      ${cell('Empty month · area filter (56 px)',botSay('No FEMA deadlines in May.<br>The next one is Softex on 30 Jun.',{size:56,secondary:'<button class="btn btn-n btn-s" style="height:28px">Show all areas</button>'}))}
 920      ${cell('No overdue (drill-down tab, 44 px)',botSay('Nothing overdue. Nice work.',{size:44,action:''}))}
 921      ${cell('Free day (day pop-over, 40 px)',botSay('Nothing is due on this day.',{size:40,action:''}))}
 922      ${cell('All clear (right rail, 40 px)',botSay('All clear this month.<br>Nothing due, nothing overdue.',{size:40,action:''}))}
 923      ${cell('Empty register (Filings)',botSay('No filings yet for FY 2027-28.<br>They appear as each registration goes live.',{size:48}))}
 924      ${cell('First-time tip',botSay('Tip: click any date to see its filings.',{size:40,action:'',secondary:'<button class="btn btn-o btn-s" style="height:28px">Got it</button>'}))}
 925     </div>
 926     <div class="card t" style="padding:14px 18px;font-size:13px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
 927      <div><b>Avatar</b><div style="color:var(--muted)">Dashboard robot, 40 / 44 / 48 / 56 px, idle bob</div></div>
 928      <div><b>Bubble</b><div style="color:var(--muted)">1–2 lines, 13 px, tail points at the bot, max 300 px</div></div>
 929      <div><b>Action</b><div style="color:var(--muted)">Optional: “🤖 Ask VCFO why” (ghost) or one navy action</div></div>
 930      <div><b>Not for</b><div style="color:var(--muted)">Errors and warnings: they keep red / amber</div></div>
 931     </div></div>`;
 932  }
```

### A.8 `s/comp/index.html` lines 947-1040 (mount, live wiring, day pop-over placement, drill-down, proof preview, tooltips, count-up)
```js
 947  /* =========================================================
 948     MOUNT
 949     ========================================================= */
 950  const BOARDS=[
 951   ['cal-current','Calendar — Current','/app/client/compliances/calendar',calCurrent],
 952   ['cal-redesign','Calendar — Redesign','click a pill, hover a date',()=>calRedesign({gridId:'live-grid'})],
 953   ['bot-empty','Bot empty-state component (rule 16)','used on every friendly empty state',botBoard],
 954   ['cal-header-opts','Calendar header — 5 options (A–E)','replaces the KPI tiles + FY donut',headerOptions],
 955   ['cal-drill','Calendar — Drill-down pop-up (rule 14)','click the Overdue tile / chip',()=>calRedesign()],
 956   ['cal-focus-opts','Next deadline card — colour options','A–D in the right rail · owner pick A',focusOptions],
 957   ['cal-info','Calendar — (i) pop-over','rule 7',()=>calRedesign({infoOpen:true})],
 958   ['cal-day','Calendar — Day pop-over','click on 15 Oct',calStatesDay],
 959   ['cal-detail','Calendar — Filing detail pop-up','click GSTR-3B',calStatesDetail],
 960   ['cal-empty','Calendar — Empty month + loading','FEMA · May 2027',calEmpty],
 961   ['fil-current','Filings — Current','/app/client/compliances/filings',filCurrent],
 962   ['fil-redesign','Filings — Redesign','hover shown on the GST bar · click any part',()=>filRedesign()],
 963   ['fil-drill','Filings — Drill-down pop-up (rule 14)','click “Due soon” on the donut · hover a bar',()=>filRedesign()],
 964   ['fil-detail','Filings — Filing detail','side panel',()=>filRedesign(filDetail())],
 965   ['fil-preview','Filings — Document preview','👁 on a filed row',()=>filRedesign(docPreview())],
 966   ['improve','Changes, ideas & open questions','',improvements],
 967  ];
 968  const cv=document.getElementById('canvas');
 969  /* v7: a live route (#cal-redesign, #fil-redesign, #cal-mobile) renders only its own board; comp-route.js shows it full screen and fluid */
 970  const WANT=(location.hash||'#cal-redesign').slice(1), ONE=WANT==='cal-mobile'||BOARDS.some(b=>b[0]===WANT);
 971  if(ONE) document.documentElement.classList.add('comp-live');
 972  cv.innerHTML=(ONE?'':`<div class="cv-head"><h1>Client pages — Compliances</h1><div class="cv-nav">${BOARDS.map(b=>`<a href="#${b[0]}">${b[1]}</a>`).join('')}<a href="#cal-mobile">Calendar — Mobile 390</a></div></div>`)+
 973   BOARDS.filter(b=>!ONE||b[0]===WANT).map(([id,t,tag,fn])=>`<section id="${id}"><p class="ab-label">${t}${tag?`<span class="tag">${tag}</span>`:''}</p><div class="ab">${fn()}</div></section>`).join('')+
 974   (!ONE||WANT==='cal-mobile'?`<section id="cal-mobile"><p class="ab-label">Calendar — Mobile 390 <span class="tag">week strip + agenda</span></p><div class="row-abs"><div class="ab" style="width:390px">${calMobile()}</div></div></section>`:'');
 975  wireSegs(cv);
 976  // position day pop-over next to the 15 Oct cell
 977  const pop=document.getElementById('dpop-anchor');
 978  if(pop){const ab=pop.closest('.ab'),cell=ab.querySelector('.day[data-iso="2026-10-15"]');if(cell){const a=ab.getBoundingClientRect(),c=cell.getBoundingClientRect();pop.style.left=(c.right-a.left+12)+'px';pop.style.top=(c.top-a.top-8)+'px';}}
 979  // live board: click a date → pop-over; area pill filters the grid
 980  const live=document.getElementById('live-grid');
 981  if(live){
 982    const ab=live.closest('.ab'); let p=null;
 983    live.addEventListener('click',e=>{const d=e.target.closest('.day[data-iso]');if(!d)return;const rows=OCT.filter(r=>r.due===d.dataset.iso);p&&p.remove();live.querySelectorAll('.sel').forEach(x=>x.classList.remove('sel'));d.classList.add('sel');
 984      p=document.createElement('div');p.className='dpop';const a=ab.getBoundingClientRect(),c=d.getBoundingClientRect();const PW=Math.min(320,innerWidth-24),VW=Math.min(a.right,innerWidth)-a.left;const right=c.right-a.left+12+PW<=VW-12,left=c.left-a.left-PW-12>=12;const right0=right;if(right){p.style.left=(c.right-a.left+12)+'px';p.style.top=(c.top-a.top-8)+'px';}else if(left){p.style.left=(c.left-a.left-PW-12)+'px';p.style.top=(c.top-a.top-8)+'px';p.classList.add('flip');}else{p.style.left=Math.max(12,Math.min(VW-PW-12,c.left-a.left+c.width/2-PW/2))+'px';p.style.top=(c.bottom-a.top+8)+'px';p.classList.add('below');}
 985      const s=rows.length?worst(rows):'up';p.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div class="dtile" style="background:var(${s==='up'?'--navy':ST[s].v});width:40px;height:44px"><b style="font-size:16px">${+d.dataset.iso.slice(8)}</b><small>${dow(d.dataset.iso)}</small></div><div style="flex:1"><b style="font-size:14px">${fmt(d.dataset.iso,{weekday:'long',day:'numeric',month:'long'})}</b><div style="font-size:11.5px;color:var(--muted);font-weight:700">${rows.length?rows.length+' filing'+(rows.length>1?'s':''):'Free day'}</div></div><button class="ibtn" style="border:0" aria-label="Close" data-x>${I.x(14)}</button></div>${rows.length?rows.map(dayRow).join('')+'<div class="ask">🤖 Ask VCFO</div>':botSay('Nothing is due on this day.',{size:40,action:''})}`;
 986      if(!right0){p.style.setProperty('--flip','1');}
 987      ab.appendChild(p);p.querySelector('[data-x]').onclick=()=>{p.remove();d.classList.remove('sel')};});
 988    ab.querySelector('.seg[role=tablist]:not(:first-of-type)');
 989    const pills=[...ab.querySelectorAll('.seg')].find(s=>s.textContent.includes('Payroll'));
 990    pills&&pills.addEventListener('pick',e=>{const id=AREAS[e.detail].id;live.querySelectorAll('.ev').forEach(ev=>{const a=ev.querySelector('.a').textContent;ev.style.opacity=(id==='all'||AREA_SHORT[id]===a)?'1':'.18';});});
 991  }
 992  
 993  /* ---------- rule 14: hover tooltip + click drill-down (one component everywhere) ---------- */
 994  const DD_TABS={status:[['all','All'],['ok','Filed'],['due','Due soon'],['over','Overdue'],['up','Upcoming']],area:[['all','All'],['MCA','MCA'],['GST','GST'],['IT','Income tax'],['PAY','Payroll'],['FEMA','FEMA']]};
 995  const DD_TITLE={oct:'Compliances · October 2026',fil:'Filings · Sep–Oct 2026',fy:'Compliances · FY 2026-27'};
 996  const SOLID={ok:'var(--ok-chip)',due:'var(--due-chip)',over:'var(--over-chip)',up:'oklch(54% 0.026 258)'};
 997  function openDD(ab,kind,key,set){
 998    ab.querySelectorAll('.ddscrim,.dd').forEach(x=>x.remove());
 999    const rows=set==='oct'?OCT:FIL, tabs=DD_TABS[kind];
1000    const match=(r,k)=>k==='all'||(kind==='status'?status(r)===k:r.area===k);
1001    const on=Math.max(0,tabs.findIndex(t=>t[0]===key));
1002    const sc=document.createElement('div');sc.className='ddscrim';
1003    const d=document.createElement('div');d.className='dd';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
1004    const onFil=/fil/.test(location.hash);
1005    const topBar=`<div class="dd-top" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:9px 18px;background:var(--primary-light);border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)"><span>These filings live in Compliances · Filings</span><a href="#" ${onFil?'data-ddlist':'data-go="filings"'} style="margin-left:auto;font-weight:800;font-size:12.5px;white-space:nowrap;color:var(--primary)">${onFil?'Show in the Filings list ↓':'Open Filings →'}</a></div>`;
1006    d.innerHTML=topBar+`<div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)"><div style="flex:1;font:700 15px Manrope;color:var(--navy-ink,var(--navy));display:flex;align-items:center;gap:4px">${DD_TITLE[set]}${infoBtn('As of 8 Oct 2026.')}</div><button class="ibtn" data-close aria-label="Close">${I.x(13)}</button></div>
1007     <div style="padding:16px 18px"><div class="seg-scroll dd-segw">${seg(tabs.map(t=>t[1]),on,{counts:tabs.map(t=>rows.filter(r=>match(r,t[0])).length)})}</div>
1008     <div class="dd-tw"><table style="margin-top:12px;font-size:12.5px"><thead><tr><th>Filing</th><th>Period</th><th>Area</th><th style="text-align:right">Due / filed</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>
1009     <div data-foot style="font-size:11px;color:var(--muted);margin-top:8px"></div></div>
1010     <div style="display:flex;gap:8px;padding:12px 18px;border-top:1px solid var(--border);background:var(--raised)"><button class="btn btn-o btn-s">Open Filings</button></div>`;
1011    const render=i=>{const k=tabs[i][0];const list=rows.filter(r=>match(r,k)).sort((a,b)=>a.due<b.due?-1:1);
1012      d.querySelector('table').style.display=list.length?'':'none';let eb=d.querySelector('.ddempty');if(!eb){eb=document.createElement('div');eb.className='ddempty';eb.style.padding='18px 4px 6px';d.querySelector('table').after(eb);}eb.innerHTML=list.length?'':botSay(k==='over'?'Nothing overdue. Nice work.':'No filings here yet.',{size:44,action:k==='over'?'':'Ask VCFO why'});
1013      d.querySelector('tbody').innerHTML=list.slice(0,7).map(r=>{const st=status(r);return `<tr data-open="${r.name}"><td>${nameWithLinks(r)} ${proofChip(r)}</td><td style="color:var(--muted)">${r.period}</td><td>${areaChip(r.area)}</td><td class="mono" style="text-align:right;font-size:12px">${r.filed?'Filed '+fmt(r.filed):fmt(r.due)}</td><td><span class="chip" style="background:${SOLID[st]};color:#fff">${ST[st].l}</span></td><td style="color:var(--subtle)">${I.chevR(14)}</td></tr>`}).join('');
1014      const full=set==='fy'?(k==='all'?FY_TOTAL:k==='ok'?FY_FILED:list.length):list.length;
1015      d.querySelector('[data-foot]').hidden=!list.length;d.querySelector('[data-foot]').textContent=list.length>7||full>list.length?`Showing ${Math.min(7,list.length)} of ${full} · full list in Filings`:`Showing all ${list.length}`;};
1016    ab.append(sc,d);wireSegs(d);render(on);
1017    d.querySelector('.seg').addEventListener('pick',e=>{e.stopPropagation();render(e.detail)});
1018    const close=()=>{sc.remove();d.remove()};sc.onclick=close;d.querySelector('[data-close]').onclick=close;
1019    const dl=d.querySelector('[data-ddlist]');if(dl)dl.onclick=e=>{e.preventDefault();close();const t=document.querySelector('#fil-redesign table')||document.querySelector('table');t&&t.scrollIntoView({behavior:'smooth',block:'start'});};
1020    d.addEventListener('click',e=>{const tr=e.target.closest('tr[data-open]');if(tr){const t=document.createElement('div');t.className='toast';t.innerHTML=`Opening ${tr.dataset.open} in Filings…`;ab.appendChild(t);setTimeout(()=>t.remove(),1600);}});
1021  }
1022  
1023  document.addEventListener('click',e=>{const pv=e.target.closest&&e.target.closest('[data-proof]');if(pv){e.stopPropagation();e.preventDefault();const ab=pv.closest('.ab');const w=document.createElement('div');w.className='pvwrap';w.style.cssText='position:absolute;inset:0;z-index:120';w.innerHTML=docPreview();ab.appendChild(w);w.querySelector('[data-close-pv]').onclick=()=>w.remove();w.querySelector('.scrim').onclick=()=>w.remove();return;}},true);
1024  const tipEl=document.createElement('div');tipEl.className='tipb';document.body.appendChild(tipEl);
1025  document.addEventListener('mouseover',e=>{const t=e.target.closest&&e.target.closest('[data-tip],button[aria-label].ibtn');if(!t){tipEl.classList.remove('on');return;}const r=t.getBoundingClientRect();tipEl.textContent=t.dataset.tip||t.getAttribute('aria-label');tipEl.style.left=(r.left+r.width/2)+'px';tipEl.style.top=r.top+'px';tipEl.classList.add('on');});
1026  document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-dd]');if(!t||t.closest('.dd'))return;tipEl.classList.remove('on');openDD(t.closest('.ab'),t.dataset.dd,t.dataset.k,t.dataset.set);});
1027  // static demo board: Filings donut "Due soon" clicked + a hover tooltip on the area bars
1028  const demo=document.querySelector('#fil-drill .ab');
1029  const tipHost=document.querySelector('#fil-redesign .ab');
1030  if(demo){/* v5: no static demo tooltip on the live Filings page */
1031    const cdemo=document.querySelector('#cal-drill .ab');if(cdemo)openDD(cdemo,'status','over','oct');
1032    openDD(demo,'status','due','fil');}
1033  // rule 17: every icon-only control explains itself (tooltip = aria-label)
1034  document.querySelectorAll('button[aria-label]:not([data-tip]),a[aria-label]:not([data-tip])').forEach(b=>{if(!b.textContent.trim()||b.querySelector('svg')&&b.textContent.trim().length<2)b.dataset.tip=b.getAttribute('aria-label');});
1035  document.querySelectorAll('.ibtn:not([aria-label]):not([data-tip])').forEach(b=>{const t=b.innerHTML.includes('M6 6l12 12')?'Close':b.innerHTML.includes('M15 6l-6 6')?'Previous':b.innerHTML.includes('M9 6l6 6')?'Next':b.innerHTML.includes('M12 4v11')?'Download':b.innerHTML.includes('M2.5 12S6')?'Preview':'';if(t){b.dataset.tip=t;b.setAttribute('aria-label',t);}});
1036  // count-up
1037  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('[data-count]').forEach(el=>{const t=+el.dataset.count;let s=null;const step=ts=>{s=s||ts;const k=Math.min(1,(ts-s)/700);el.textContent=Math.round(t*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)});}
1038  </script>
1039  
1040  <script src="cal-views.js"></script><script src="../../comp-route.js"></script><script src="../../routes.js"></script><script src="../../proto.js"></script>
```

### A.9 `s/comp/cal-views.js` (whole file: Year view, Timeline, month/year picker, view/area wiring)
```js
   1  /* Compliances calendar · v5: view pill Month · Year · Timeline.
   2     Year = 12 mini months with coloured dots and counts. Timeline = Gantt-like strip of filing windows,
   3     edited inline (drag / resize) with the same zoomable ruler as the Home timeline editor.
   4     Uses the page's own data and helpers (OCT, FIL, AREAS, ST, status, monthGrid, fmt, TODAY). */
   5  (function () {
   6    var DAY = 864e5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
   7    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
   8    function iso(d) { return d.toISOString().slice(0, 10); }
   9    function D(s) { return new Date(s + 'T00:00:00Z'); }
  10    function toast(m, u, cb) { if (window.vcfoToast) window.vcfoToast(m, u, cb); }
  11    var STC = { ok: 'var(--ok)', due: 'var(--due)', over: 'var(--over)', up: 'var(--navy)' };
  12  
  13    /* ---------- a full FY of deadlines: October is the page's real data, the rest follows the statutory pattern ---------- */
  14    var YEAR = (function () {
  15      var out = [], id = 0;
  16      function add(y, m, d, area, name, freq, auth, period) {
  17        var due = new Date(Date.UTC(y, m, Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())));
  18        var s = iso(due); if (s.slice(0, 7) === '2026-10') return;            // October comes from OCT
  19        var past = s < TODAY;
  20        out.push({ id: 'y' + (id++), due: s, area: area, name: name, period: period || MON[(m + 11) % 12] + ' ' + (m === 0 ? y - 1 : y), filed: past ? iso(new Date(due - 2 * DAY)) : null, freq: freq, auth: auth });
  21      }
  22      for (var k = 0; k < 12; k++) {
  23        var m = (3 + k) % 12, y = 2026 + (3 + k >= 12 ? 1 : 0);
  24        add(y, m, 7, 'IT', 'TDS/TCS challan', 'Monthly', 'Income Tax Dept');
  25        add(y, m, 10, 'PAY', 'Professional tax payment', 'Monthly', 'State PT Dept');
  26        add(y, m, 11, 'GST', 'GSTR-1', 'Monthly', 'GSTN');
  27        add(y, m, 15, 'PAY', 'PF & ESI payment', 'Monthly', 'EPFO · ESIC');
  28        add(y, m, 20, 'GST', 'GSTR-3B', 'Monthly', 'GSTN');
  29        add(y, m, 30, 'FEMA', 'Softex filing', 'Monthly', 'STPI');
  30      }
  31      [[2026, 5, 15, 'IT', 'Advance tax Q1', 'Quarterly'], [2026, 8, 15, 'IT', 'Advance tax Q2', 'Quarterly'], [2026, 11, 15, 'IT', 'Advance tax Q3', 'Quarterly'], [2027, 2, 15, 'IT', 'Advance tax Q4', 'Quarterly'],
  32       [2026, 6, 31, 'IT', 'TDS return Q1', 'Quarterly'], [2027, 0, 31, 'IT', 'TDS return Q3', 'Quarterly'],
  33       [2026, 3, 30, 'MCA', 'MSME-1', 'Half-yearly'], [2026, 5, 30, 'MCA', 'DPT-3', 'Annual'], [2026, 6, 15, 'FEMA', 'FLA return', 'Annual'],
  34       [2026, 8, 30, 'MCA', 'DIR-3 KYC', 'Annual'], [2026, 10, 28, 'MCA', 'MGT-7 (annual return)', 'Annual'], [2027, 0, 7, 'FEMA', 'ECB-2 return', 'Quarterly'], [2026, 3, 25, 'GST', 'ITC-04', 'Half-yearly']
  35      ].forEach(function (r) { add(r[0], r[1], r[2], r[3], r[4], r[5], r[3] === 'MCA' ? 'MCA' : r[3] === 'FEMA' ? 'RBI' : r[3] === 'GST' ? 'GSTN' : 'Income Tax Dept', r[4].indexOf('Q') > 0 ? 'FY 2026-27' : 'FY 2025-26'); });
  36      return out.concat(OCT).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
  37    })();
  38    function rowsFor(area) { return YEAR.filter(function (r) { return area === 'all' || r.area === area; }); }
  39    function worstOf(list) { var o = ['over', 'due', 'up', 'ok']; for (var i = 0; i < o.length; i++) if (list.some(function (r) { return status(r) === o[i]; })) return o[i]; return ''; }
  40  
  41    /* ---------- styles ---------- */
  42    var css = document.createElement('style');
  43    css.textContent = [
  44      '.yv{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,196px),1fr));gap:12px}',
  45      '.ym{border:1px solid var(--border);border-radius:10px;padding:10px 10px 8px;background:var(--panel);cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;text-align:left;font:inherit;color:inherit}',
  46      '.ym:hover{border-color:oklch(54.6% 0.215 263 / .45);box-shadow:0 8px 20px -12px oklch(28% 0.08 264 / .35);transform:translateY(-1px)}',
  47      '.ym.now{box-shadow:inset 0 0 0 2px var(--navy)}',
  48      '.ym-h{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
  49      '.ym-h b{font:700 12.5px Manrope;color:var(--navy-ink,var(--navy));flex:1}',
  50      '.ym-h .n{font:600 11px "IBM Plex Mono",monospace;color:var(--muted)}',
  51      '.ym-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}',
  52      '.ym-g span{height:20px;display:grid;place-items:center;font:500 11px "IBM Plex Mono",monospace;letter-spacing:-.03em;color:var(--subtle);border-radius:4px;min-width:0}',
  53      '.ym-g span.f{color:#fff;font-weight:700}',
  54      '.ym-g span.t{box-shadow:inset 0 0 0 1.5px var(--navy);color:var(--navy-ink,var(--navy));font-weight:700}',
  55      '.ym-s{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:7px;font:600 11px Manrope;color:var(--muted)}',
  56      '.ym-s i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px;vertical-align:0}',
  57      /* timeline */
  58      '.tlv{display:flex;flex-direction:column;gap:10px}',
  59      '.tlv-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  60      '.tlv-tools .hint{font-size:11.5px;color:var(--muted);flex:1 1 200px;min-width:0}',
  61      '.tlv-z{display:inline-flex;align-items:center;gap:6px;padding:3px;border-radius:8px;background:var(--raised);box-shadow:inset 0 0 0 1px var(--border)}',
  62      '.tlv-z button{width:28px;height:28px;border:0;border-radius:6px;background:light-dark(#fff, oklch(13% 0 89.9));color:var(--navy-ink,var(--navy));font:800 15px/1 Manrope;cursor:pointer;box-shadow:0 1px 2px rgba(15,42,74,.12)}',
  63      '.tlv-z button:disabled{opacity:.4;cursor:default}',
  64      '.tlv-z button.fit{width:auto;padding:0 9px;font-size:11.5px}',
  65      '.tlv-z input{width:clamp(70px,10vw,110px);accent-color:#0f2a4a}',
  66      '.tlv-z .lv{min-width:50px;text-align:center;font:700 11px Manrope;color:var(--muted)}',
  67      '.tlv-g{display:grid;grid-template-columns:clamp(110px,14vw,150px) minmax(0,1fr);user-select:none;-webkit-user-select:none;border:1px solid var(--border);border-radius:8px;overflow:hidden}',
  68      '.tlv-n>div{height:30px;display:flex;align-items:center;padding:0 10px;font:600 12px Manrope;border-top:1px solid var(--hair);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  69      '.tlv-n>div.ar{height:24px;font:800 11px Manrope;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);background:var(--raised)}',
  70      '.tlv-n>.sp{height:40px;border-top:0}',
  71      '.tlv-vp{position:relative;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;touch-action:pan-x;cursor:grab;border-left:1px solid var(--border)}',
  72      '.tlv-vp::-webkit-scrollbar{display:none}',
  73      '.tlv-vp.pan{cursor:grabbing}',
  74      '.tlv-w{position:relative}',
  75      '.tlv-r{position:relative;height:40px;border-bottom:1px solid var(--border);background:var(--panel)}',
  76      '.tlv-r .mo{position:absolute;top:4px;padding-left:6px;border-left:1px solid var(--border);font:800 11px Manrope;color:var(--navy-ink,var(--navy));white-space:nowrap;height:14px;line-height:14px}',
  77      '.tlv-r .tk{position:absolute;bottom:4px;transform:translateX(-50%);font:600 11px "IBM Plex Mono",monospace;color:var(--subtle);white-space:nowrap}',
  78      '.tlv-l{position:relative;height:30px;border-top:1px solid var(--hair)}',
  79      '.tlv-l.ar{height:24px;background:var(--raised)}',
  80      '.tlv-b{position:absolute;top:7px;height:16px;border-radius:4px;cursor:grab;touch-action:none;box-shadow:0 1px 3px -1px rgba(8,20,40,.35);outline:none;transition:box-shadow .15s}',
  81      '.tlv-b.drag{cursor:grabbing;box-shadow:0 0 0 3px rgba(201,162,75,.55),0 8px 16px -6px rgba(8,20,40,.45);z-index:3}',
  82      '.tlv-b:focus-visible{box-shadow:0 0 0 3px rgba(84,112,255,.55)}',
  83      '.tlv-b.late{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.35) 0 4px,transparent 4px 8px)!important}',
  84      '.tlv-b.lock{cursor:default;opacity:.75}',
  85      '.tlv-b .hd{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize}',
  86      '.tlv-b .hd.l{left:-2px}.tlv-b .hd.r{right:-2px}',
  87      '.tlv-d{position:absolute;top:9px;width:11px;height:11px;margin-left:-5.5px;transform:rotate(45deg);border-radius:2px;background:var(--navy);box-shadow:0 0 0 2px light-dark(#fff, oklch(13% 0.006 260));pointer-events:none;z-index:2}',
  88      '.tlv-today{position:absolute;top:40px;bottom:0;width:2px;margin-left:-1px;background:#d64545;pointer-events:none;z-index:4}',
  89      '.tlv-today:after{content:"Today";position:absolute;top:2px;left:4px;font:800 11px Manrope;color:#fff;background:#d64545;padding:1px 5px;border-radius:3px}',
  90      '.tlv-read{position:fixed;z-index:2147483002;pointer-events:none;background:var(--navy);color:#fff;font:700 11.5px Manrope;padding:4px 8px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-130%)}',
  91      '@media (prefers-reduced-motion: reduce){.ym{transition:none}}',
  92      /* comp-route.js sets inline display:none on every body child; the shared hover tooltip (.tipb) is one of them, so keep it on */
  93      'body>.tipb{display:block!important}'
  94    ].join('\n');
  95    document.head.appendChild(css);
  96  
  97    /* ---------- Year ---------- */
  98    function yearView(area) {
  99      var rows = rowsFor(area), h = '<div class="yv">';
 100      for (var k = 0; k < 12; k++) {
 101        var m = (3 + k) % 12, y = 2026 + (3 + k >= 12 ? 1 : 0), key = y + '-' + String(m + 1).padStart(2, '0');
 102        var mr = rows.filter(function (r) { return r.due.slice(0, 7) === key; });
 103        var c = { ok: 0, due: 0, over: 0, up: 0 }; mr.forEach(function (r) { c[status(r)]++; });
 104        var first = new Date(Date.UTC(y, m, 1)), start = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
 105        var g = ''; for (var i = 0; i < start; i++) g += '<span></span>';
 106        for (var d = 1; d <= days; d++) {
 107          var di = key + '-' + String(d).padStart(2, '0'), it = mr.filter(function (r) { return r.due === di; }), w = it.length ? worstOf(it) : '';
 108          g += '<span class="' + (w ? 'f' : '') + (di === TODAY ? ' t' : '') + '"' + (w ? ' style="background:' + STC[w] + '" data-tip="' + fmt(di, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + it.map(function (r) { return r.name; }).slice(0, 3).join(', ') + (it.length > 3 ? ' +' + (it.length - 3) : '') + '"' : '') + '>' + d + '</span>';
 109        }
 110        for (var q = (start + days) % 7; q && q < 7; q++) g += '<span></span>';   /* fill the last row so the lines close */
 111        var sum = ['over', 'due', 'ok', 'up'].filter(function (s) { return c[s]; }).map(function (s) { return '<span><i style="background:' + STC[s] + '"></i>' + c[s] + '</span>'; }).join('');
 112        h += '<button type="button" class="ym' + (key === TODAY.slice(0, 7) ? ' now' : '') + '" data-month="' + key + '" aria-label="' + MON[m] + ' ' + y + ' · ' + mr.length + ' filings · open the month"><div class="ym-h"><b>' + MON[m] + ' ' + y + '</b><span class="n">' + mr.length + '</span></div><div class="ym-g">' + g + '</div><div class="ym-s">' + (sum || '<span>Nothing due</span>') + '</div></button>';
 113      }
 114      return h + '</div>';
 115    }
 116  
 117    /* ---------- Timeline (editable, zoomable) ---------- */
 118    var W0 = Date.UTC(2026, 8, 1), W1 = Date.UTC(2027, 2, 31), NDAYS = Math.round((W1 - W0) / DAY), ZMAX = 40;
 119    var PREP = { Monthly: 5, Quarterly: 10, 'Half-yearly': 10, Annual: 21 };
 120    function dayN(s) { return Math.round((D(s) - W0) / DAY); }
 121    function nStr(n) { var d = new Date(W0 + n * DAY); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
 122    function saved() { try { return JSON.parse(sessionStorage.getItem('vcfo.calwin')) || {}; } catch (e) { return {}; } }
 123    function store(o) { try { sessionStorage.setItem('vcfo.calwin', JSON.stringify(o)); } catch (e) {} }
 124    function timelineView(host, area) {
 125      var rows = rowsFor(area).filter(function (r) { return r.due >= '2026-09-01' && r.due <= '2027-03-31'; });
 126      var AREA_ORDER = ['MCA', 'GST', 'IT', 'PAY', 'FEMA'], names = {}, lanes = [];
 127      AREA_ORDER.forEach(function (a) {
 128        var inA = rows.filter(function (r) { return r.area === a; }); if (!inA.length) return;
 129        lanes.push({ ar: a });
 130        inA.forEach(function (r) { var k = a + '|' + r.name; if (!names[k]) { names[k] = { name: r.name, items: [] }; lanes.push(names[k]); } names[k].items.push(r); });
 131      });
 132      var W = saved(), hist = [], ppd = 0, zoomed = false;
 133      host.innerHTML = '<div class="tlv"><div class="tlv-tools"><button type="button" class="btn btn-o btn-s" data-tl="undo" disabled>↶ Undo</button><span class="hint" data-tl="hint"></span>' +
 134        '<span class="tlv-z" role="group" aria-label="Zoom the timeline"><button type="button" data-tl="out" aria-label="Zoom out">−</button><input type="range" min="0" max="1000" data-tl="z" aria-label="Zoom level"><button type="button" data-tl="in" aria-label="Zoom in">+</button><span class="lv" data-tl="lv"></span><button type="button" class="fit" data-tl="fit">Fit</button></span></div>' +
 135        '<div class="tlv-g"><div class="tlv-n"><div class="sp"></div>' + lanes.map(function (l) { return l.ar ? '<div class="ar">' + (AREAS.find(function (a) { return a.id === l.ar; }) || {}).label + '</div>' : '<div title="">' + l.name + '</div>'; }).join('') + '</div>' +
 136        '<div class="tlv-vp"><div class="tlv-w"><div class="tlv-r"></div>' + lanes.map(function (l, li) { return '<div class="tlv-l' + (l.ar ? ' ar' : '') + '" data-li="' + li + '"></div>'; }).join('') + '<span class="tlv-today"></span></div></div></div></div>';
 137      var vp = host.querySelector('.tlv-vp'), world = host.querySelector('.tlv-w');
 138      function minP() { return vp.clientWidth / NDAYS; }
 139      function fitP() { return Math.max(minP(), Math.min(ZMAX, vp.clientWidth / 61)); }
 140      function X(n) { return n * ppd; }
 141      function snap() { return ppd < 7 ? 7 : 1; }
 142      function lv() { return ppd >= 20 ? 'Days' : ppd >= 7 ? 'Weeks' : 'Months'; }
 143      function win(r) { var w = W[r.id], due = dayN(r.due), p = PREP[r.freq] || 5; return w ? { s: w[0], e: w[1], due: due } : { s: due - p, e: due, due: due }; }
 144      function paint() {
 145        world.style.width = X(NDAYS) + 'px';
 146        var R = '', level = lv();
 147        for (var n = 0; n <= NDAYS; n++) {
 148          var d = new Date(W0 + n * DAY);
 149          if (d.getUTCDate() === 1) R += '<span class="mo" style="left:' + X(n) + 'px">' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '</span>';
 150          if (level === 'Days') R += '<span class="tk" style="left:' + (X(n) + ppd / 2) + 'px">' + d.getUTCDate() + '</span>';
 151          else if (level === 'Weeks' && d.getUTCDay() === 1) R += '<span class="tk" style="left:' + X(n) + 'px">' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + '</span>';
 152          else if (level === 'Months' && d.getUTCDate() === 15) R += '<span class="tk" style="left:' + X(n) + 'px">15</span>';
 153        }
 154        host.querySelector('.tlv-r').innerHTML = R;
 155        var line = level === 'Months' ? ppd * 7 : ppd;
 156        lanes.forEach(function (l, li) {
 157          var el = world.querySelector('[data-li="' + li + '"]'); if (l.ar) { el.innerHTML = ''; return; }
 158          el.style.backgroundImage = 'repeating-linear-gradient(to right,transparent 0,transparent ' + (line - 1) + 'px,var(--hair) ' + (line - 1) + 'px,var(--hair) ' + line + 'px)';
 159          el.innerHTML = l.items.map(function (r) {
 160            var w = win(r), st = status(r), late = w.e > w.due && !r.filed, col = r.filed ? 'var(--ok)' : STC[st];
 161            var tip = r.name + ' · ' + r.period + ' · window ' + nStr(w.s) + ' – ' + nStr(w.e) + ' · due ' + nStr(w.due) + (r.filed ? ' · filed' : late ? ' · ends ' + (w.e - w.due) + ' d after the due date' : '');
 162            return '<span class="tlv-b' + (late ? ' late' : '') + (r.filed ? ' lock' : '') + '" role="slider" tabindex="0" data-id="' + r.id + '" aria-label="' + tip + '" data-tip="' + tip + '" style="left:' + X(w.s) + 'px;width:' + Math.max(6, X(w.e - w.s)) + 'px;background:' + col + '"><span class="hd l" data-h="l"></span><span class="hd r" data-h="r"></span></span><span class="tlv-d" style="left:' + X(w.due) + 'px;background:' + (late ? 'var(--over)' : 'var(--navy)') + '"></span>';
 163          }).join('');
 164        });
 165        host.querySelector('.tlv-today').style.left = X(dayN(TODAY)) + 'px';
 166        var z = host.querySelector('[data-tl=z]'); z.value = Math.round(Math.log(ppd / minP()) / Math.log(ZMAX / minP()) * 1000);
 167        host.querySelector('[data-tl=lv]').textContent = level;
 168        host.querySelector('[data-tl=hint]').textContent = 'Drag a filing window to move it · drag its edges to resize · snaps to ' + (snap() === 7 ? 'weeks' : 'days') + ' · ctrl + scroll or pinch to zoom';
 169        host.querySelector('[data-tl=in]').disabled = ppd >= ZMAX - .01; host.querySelector('[data-tl=out]').disabled = ppd <= minP() + .01;
 170        host.querySelector('[data-tl=undo]').disabled = !hist.length;
 171      }
 172      function zoomTo(np, ax, anchorDay) {
 173        np = Math.max(minP(), Math.min(ZMAX, np)); ax = ax == null ? vp.clientWidth / 2 : ax;
 174        var dayAt = anchorDay != null ? anchorDay : (vp.scrollLeft + ax) / ppd;
 175        ppd = np; zoomed = true; paint(); vp.scrollLeft = anchorDay != null ? X(anchorDay) - 4 : dayAt * ppd - ax;
 176      }
 177      ppd = fitP(); paint(); vp.scrollLeft = X(dayN('2026-10-01')) - 4;
 178      host.querySelector('[data-tl=z]').addEventListener('input', function () { zoomTo(minP() * Math.pow(ZMAX / minP(), this.value / 1000)); });
 179      host.addEventListener('click', function (e) {
 180        var b = e.target.closest('[data-tl]'); if (!b || b.tagName === 'INPUT') return;
 181        var k = b.getAttribute('data-tl');
 182        if (k === 'in') zoomTo(ppd * 1.5); else if (k === 'out') zoomTo(ppd / 1.5); else if (k === 'fit') { var fitted = Math.abs(ppd - fitP()) < .01; zoomTo(fitP(), null, dayN('2026-10-01')); if (fitted) toast('Timeline fitted to the screen · from October'); }
 183        else if (k === 'undo' && hist.length) { W = hist.pop(); store(W); paint(); toast('Undone'); }
 184      });
 185      vp.addEventListener('wheel', function (e) { if (e.ctrlKey || e.metaKey) { e.preventDefault(); var r = vp.getBoundingClientRect(); zoomTo(ppd * Math.exp(-e.deltaY * 0.01), e.clientX - r.left); } }, { passive: false });
 186      /* drag a window (move / resize), or pan / pinch the strip */
 187      var pts = {}, pinch = null, pan = null, drag = null, read = null;
 188      function readout(x, y, t) { if (!read) { read = document.createElement('div'); read.className = 'tlv-read'; document.body.appendChild(read); } read.textContent = t; read.style.left = x + 'px'; read.style.top = y + 'px'; }
 189      vp.addEventListener('pointerdown', function (e) {
 190        var bar = e.target.closest('.tlv-b');
 191        if (bar) {
 192          var r = YEAR.find(function (x) { return x.id === bar.getAttribute('data-id'); });
 193          if (r.filed) { toast(r.name + ' is already filed, so its window is locked'); return; }
 194          e.preventDefault(); e.stopPropagation(); bar.focus({ preventScroll: true });
 195          var h = e.target.closest('.hd'), w = win(r);
 196          drag = { id: r.id, r: r, mode: h ? (h.getAttribute('data-h') === 'l' ? 'start' : 'end') : 'move', x0: e.clientX, s0: w.s, e0: w.e, moved: false, sn: snap() };
 197          hist.push(JSON.parse(JSON.stringify(W))); vp.setPointerCapture && vp.setPointerCapture(e.pointerId); bar.classList.add('drag');
 198          return;
 199        }
 200        pts[e.pointerId] = e.clientX; var ids = Object.keys(pts);
 201        if (ids.length === 2) { var rr = vp.getBoundingClientRect(); pinch = { d: Math.abs(pts[ids[0]] - pts[ids[1]]) || 1, p: ppd, mid: (pts[ids[0]] + pts[ids[1]]) / 2 - rr.left }; pan = null; return; }
 202        if (e.pointerType === 'mouse' && e.button === 0) { pan = { x: e.clientX, s: vp.scrollLeft }; vp.classList.add('pan'); }
 203      });
 204      vp.addEventListener('pointermove', function (e) {
 205        if (drag) {
 206          var dd = Math.round((e.clientX - drag.x0) / ppd / drag.sn) * drag.sn; if (dd) drag.moved = true;
 207          var s = drag.s0, en = drag.e0;
 208          if (drag.mode === 'move') { s += dd; en += dd; } else if (drag.mode === 'start') s = Math.min(en - 1, s + dd); else en = Math.max(s + 1, en + dd);
 209          s = Math.max(0, s); en = Math.min(NDAYS, en); W[drag.id] = [s, en]; paint();
 210          var nb = world.querySelector('.tlv-b[data-id="' + drag.id + '"]'); nb && nb.classList.add('drag');
 211          var due = dayN(drag.r.due); readout(e.clientX, e.clientY, nStr(s) + ' – ' + nStr(en) + ' · ' + (en - s) + ' days' + (en > due ? ' · after the due date' : ''));
 212          return;
 213        }
 214        if (pts[e.pointerId] != null) pts[e.pointerId] = e.clientX;
 215        var ids = Object.keys(pts);
 216        if (pinch && ids.length === 2) { zoomTo(pinch.p * (Math.abs(pts[ids[0]] - pts[ids[1]]) || 1) / pinch.d, pinch.mid); return; }
 217        if (pan) vp.scrollLeft = pan.s - (e.clientX - pan.x);
 218      });
 219      function end(e) {
 220        if (drag) {
 221          var d = drag; drag = null; if (read) { read.remove(); read = null; }
 222          if (!d.moved) { hist.pop(); paint(); return; }
 223          store(W); paint(); var w = win(d.r);
 224          toast(d.r.name + ' window · ' + nStr(w.s) + ' – ' + nStr(w.e) + (w.e > w.due ? ' · ends after the due date' : ''), true, function () { if (hist.length) { W = hist.pop(); store(W); paint(); } });
 225          return;
 226        }
 227        delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (pan) { pan = null; vp.classList.remove('pan'); }
 228      }
 229      vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
 230      vp.addEventListener('keydown', function (e) {
 231        var bar = e.target.closest && e.target.closest('.tlv-b'); if (!bar || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
 232        var r = YEAR.find(function (x) { return x.id === bar.getAttribute('data-id'); }); if (r.filed) return;
 233        e.preventDefault(); var w = win(r), d = (e.key === 'ArrowRight' ? 1 : -1) * snap(); hist.push(JSON.parse(JSON.stringify(W)));
 234        W[r.id] = e.shiftKey ? [w.s, Math.max(w.s + 1, w.e + d)] : [w.s + d, w.e + d]; store(W); paint();
 235        var nb = world.querySelector('.tlv-b[data-id="' + r.id + '"]'); nb && nb.focus({ preventScroll: true });
 236      });
 237      addEventListener('resize', function () { if (!host.isConnected) return; if (!zoomed) ppd = fitP(); paint(); });
 238    }
 239  
 240    /* ---------- wiring: the view pill swaps the calendar card; the area pill filters every view ---------- */
 241    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
 242    function monthLabel(key) { var p = key.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
 243    function stepMonth(key, k) { var p = key.split('-'), t = (+p[0]) * 12 + (+p[1] - 1) + k; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); }
 244    var SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 245    var CHEV = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
 246    var ARL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>';
 247    var ARR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';
 248    var NOW = '2026-10';   /* the prototype's fixed "today" */
 249    /* a month grid or a year grid, opened from the month or year button on the calendar nav */
 250    function picker(anchor, get, set) {
 251      var pop = null, mode = 'm', viewY = 0, base = 0, opener = null;
 252      function close(back) {
 253        if (!pop) return; pop.remove(); pop = null;
 254        [].forEach.call(anchor.querySelectorAll('[data-pk]'), function (b) { b.setAttribute('aria-expanded', 'false'); });
 255        document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', key, true);
 256        if (back && opener) opener.focus();
 257      }
 258      function outside(e) { if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest('[data-pk]'))) close(); }
 259      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(true); } }
 260      function draw() {
 261        var cur = get(), cy = +cur.split('-')[0], cm = +cur.split('-')[1] - 1, ny = +NOW.split('-')[0], nm = +NOW.split('-')[1] - 1;
 262        var h = '<div class="mpk-hd"><button type="button" class="mpk-ar" data-mv="-1" aria-label="' + (mode === 'm' ? 'Previous year' : 'Earlier years') + '">' + ARL + '</button>' +
 263          '<span class="mpk-mid"><button type="button" class="mpk-hb' + (mode === 'm' ? ' on' : '') + '" data-md="m">' + MONTHS[cm] + CHEV + '</button>' +
 264          '<button type="button" class="mpk-hb' + (mode === 'y' ? ' on' : '') + '" data-md="y">' + viewY + CHEV + '</button></span>' +
 265          '<button type="button" class="mpk-ar" data-mv="1" aria-label="' + (mode === 'm' ? 'Next year' : 'Later years') + '">' + ARR + '</button></div>';
 266        if (mode === 'm') {
 267          h += '<div class="mpk-g m" role="grid" aria-label="Months of ' + viewY + '">' + SHORT.map(function (s, k) {
 268            var on = viewY === cy && k === cm, now = viewY === ny && k === nm;
 269            return '<button type="button" data-m="' + k + '" aria-label="' + MONTHS[k] + ' ' + viewY + '"' + (on ? ' class="on" aria-current="date"' : now ? ' class="now"' : '') + '>' + s + '</button>';
 270          }).join('') + '</div>';
 271        } else {
 272          h += '<div class="mpk-g y" role="grid" aria-label="Years">';
 273          for (var y = base; y < base + 32; y++) h += '<button type="button" data-y="' + y + '"' + (y === cy ? ' class="on" aria-current="date"' : y === ny ? ' class="now"' : '') + '>' + y + '</button>';
 274          h += '</div>';
 275        }
 276        h += '<div class="mpk-ft"><button type="button" data-today>Today</button></div>';
 277        pop.innerHTML = h;
 278        var g = pop.querySelector('.mpk-g.y'), on = pop.querySelector('.mpk-g .on');
 279        if (g && on) g.scrollTop = on.offsetTop - g.clientHeight / 2 + on.offsetHeight / 2;
 280      }
 281      function open(m, btn) {
 282        var cur = get(); viewY = +cur.split('-')[0]; base = viewY - 10 - ((viewY - 10) % 4 + 4) % 4; mode = m; opener = btn;
 283        if (!pop) {
 284          pop = document.createElement('div'); pop.className = 'mpk-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Choose month and year');
 285          anchor.appendChild(pop); pop.addEventListener('click', pick);
 286          document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', key, true);
 287        }
 288        [].forEach.call(anchor.querySelectorAll('[data-pk]'), function (b) { b.setAttribute('aria-expanded', String(b === btn)); });
 289        draw(); var f = pop.querySelector('.mpk-g .on') || pop.querySelector('.mpk-g button'); f && f.focus({ preventScroll: true });
 290      }
 291      function pick(e) {
 292        e.stopPropagation();
 293        var b = e.target.closest('button'); if (!b) return;
 294        if (b.hasAttribute('data-md')) { mode = b.getAttribute('data-md'); draw(); return; }
 295        if (b.hasAttribute('data-mv')) { var d = +b.getAttribute('data-mv'); if (mode === 'm') viewY += d; else base += d * 32; draw(); return; }
 296        if (b.hasAttribute('data-y')) { var m = get().split('-')[1]; set(b.getAttribute('data-y') + '-' + m); close(true); return; }
 297        if (b.hasAttribute('data-m')) { set(viewY + '-' + String(+b.getAttribute('data-m') + 1).padStart(2, '0')); close(true); return; }
 298        if (b.hasAttribute('data-today')) { set(NOW); close(true); }
 299      }
 300      anchor.addEventListener('click', function (e) {
 301        var t = e.target.closest && e.target.closest('[data-pk]'); if (!t) return;
 302        e.stopPropagation(); var m = t.getAttribute('data-pk');
 303        if (pop && mode === m) close(); else open(m, t);
 304      });
 305    }
 306    function wire() {
 307      [].forEach.call(document.querySelectorAll('[data-calview]'), function (pill) {
 308        if (pill.__wired) return; pill.__wired = true;
 309        /* a pill binds only to the calendar in its own .shell; a bare header option (no shell) must not drive the first calendar on the page */
 310        var frame = pill.closest('.shell'); if (!frame) return;
 311        var body = frame.querySelector('[data-calbody]'), nav = frame.querySelector('[data-calnav]');
 312        if (!body) return;
 313        var month0 = body.innerHTML, view = 0, area = 'all', month = '2026-10';
 314        var monthNavEl = frame.querySelector('[data-calnavr]');
 315        var monthLbl = monthNavEl && monthNavEl.querySelector('b');
 316        var prevBtn = monthNavEl && monthNavEl.querySelector('[aria-label="Previous month"]');
 317        var nextBtn = monthNavEl && monthNavEl.querySelector('[aria-label="Next month"]');
 318        function render() {
 319          if (view === 0) body.innerHTML = (area === 'all' && month === '2026-10') ? month0 : monthGrid({ month: month, rows: rowsFor(area) });
 320          else if (view === 1) body.innerHTML = yearView(area);
 321          else timelineView(body, area);
 322          if (monthNavEl) monthNavEl.style.visibility = view === 0 ? '' : 'hidden';
 323          if (monthLbl) monthLbl.textContent = monthLabel(month);
 324          [].forEach.call(monthNavEl ? monthNavEl.querySelectorAll('[data-pk]') : [], function (b) { var s = b.querySelector('span'); if (s) s.textContent = b.getAttribute('data-pk') === 'm' ? MONTHS[+month.split('-')[1] - 1] : month.split('-')[0]; });
 325          body.setAttribute('data-view', ['month', 'year', 'timeline'][view]);
 326        }
 327        pill.addEventListener('pick', function (e) { e.stopPropagation(); view = e.detail; render(); });
 328        var areaSeg = nav && nav.querySelector('.seg');
 329        if (areaSeg) areaSeg.addEventListener('pick', function (e) { e.stopPropagation(); area = AREAS[e.detail].id; render(); });
 330        /* previous / next month: +/-1 across year boundaries (Dec 2026 -> Jan 2027) */
 331        if (prevBtn) prevBtn.addEventListener('click', function () { month = stepMonth(month, -1); render(); });
 332        if (nextBtn) nextBtn.addEventListener('click', function () { month = stepMonth(month, 1); render(); });
 333        if (monthNavEl && monthNavEl.querySelector('[data-pk]')) picker(monthNavEl, function () { return month; }, function (k) { month = k; render(); });
 334        body.addEventListener('click', function (e) {
 335          var m = e.target.closest('[data-month]'); if (!m) return;
 336          month = m.getAttribute('data-month'); view = 0;
 337          var bs = pill.querySelectorAll('button'); bs[0] && bs[0].click();
 338        });
 339      });
 340    }
 341    window.vcfoCalViews = { wire: wire };
 342    var n = 0; (function t() { wire(); if (n++ < 20) setTimeout(t, 150); })();
 343  })();
```

### A.10 `comp-route.js` (whole file)
```js
   1  /* Compliances page: show one board of the design page as a full screen, chosen by #section-id.
   2     v7: the board is fluid (html.comp-live switches on the responsive rules in s/comp/index.html). */
   3  (function () {
   4    function pick() {
   5      var id = (location.hash || '#cal-redesign').slice(1), s = document.getElementById(id);
   6      if (!s) return false;
   7      var frame = s.querySelector('.ab'); if (!frame) return false;
   8      var de = document.documentElement;
   9      de.classList.add('comp-live'); de.setAttribute('data-comp', id);
  10      if (id === 'cal-mobile') { de.classList.add('vp-mobile', 'comp-phone'); frame.style.width = '100%'; }
  11      var side = frame.querySelector('.side'); if (side) side.setAttribute('data-vp', 'side');
  12      var keep = document.createElement('div'); keep.id = 'comp-screen'; keep.appendChild(frame);
  13      [].slice.call(document.body.children).forEach(function (c) { if (c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE' && c.tagName !== 'LINK') c.style.display = 'none'; });
  14      document.body.insertBefore(keep, document.body.firstChild);
  15      document.body.style.margin = '0'; document.body.style.padding = '0';
  16      window.scrollTo(0, 0);
  17      /* the sliding pills measured their buttons inside the wide design canvas: measure again in place */
  18      function replace() { [].forEach.call(keep.querySelectorAll('.seg'), function (sg) { var th = sg.querySelector('.thumb'), on = sg.querySelector('button.on') || sg.querySelector('button'); if (th && on) { th.style.width = on.offsetWidth + 'px'; th.style.transform = 'translateX(' + on.offsetLeft + 'px)'; } }); }
  19      requestAnimationFrame(replace); if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
  20      addEventListener('resize', function () { requestAnimationFrame(replace); });
  21      return true;
  22    }
  23    var n = 0; (function t() { if (!pick() && n++ < 40) setTimeout(t, 50); })();
  24    addEventListener('hashchange', function () { location.reload(); });
  25  })();
```

### A.11 `proto.js` lines 35-53 (dark theme tokens) and 156-166 (toast)
```js
  35      var ds = document.createElement('style'); ds.id = 'vp-dark';
  36      ds.textContent = [
  37        'html{color-scheme:light}',
  38        'html[data-theme="dark"]{color-scheme:dark;' +
  39          '--bg:#000;--panel:oklch(13% 0.006 260);--raised:oklch(17% 0.008 260);--border:oklch(24% 0.01 260);--hair:oklch(19% 0.008 260);' +
  40          '--fg:oklch(92% 0.005 260);--muted:oklch(72% 0.008 260);--subtle:oklch(60% 0.01 260);' +
  41          '--primary:oklch(68% 0.16 255);--primary-dark:oklch(76% 0.13 255);--primary-light:oklch(22% 0.06 258);--primary-chip:oklch(50% 0.17 258);' +
  42          '--navy:oklch(46% 0.15 258);--navy-ink:oklch(94% 0.008 255);--navy-2:oklch(52% 0.15 258);--navy-3:oklch(56% 0.15 255);' +
  43          '--navy-deep:oklch(19% 0.05 258);--navy-2-deep:oklch(23% 0.07 258);--navy-3-deep:oklch(29% 0.1 255);--primary-fill:oklch(52% 0.19 258);--primary-fill-2:oklch(58% 0.18 258);' +
  44          '--gold:#e0bd66;--gold-2:#ecd08a;--gold-soft:oklch(25% 0.05 85);--gold-text:#e8c97d;' +
  45          '--ok:oklch(68% 0.14 165);--ok-light:oklch(23% 0.05 165);--ok-text:oklch(80% 0.1 165);--ok-chip:oklch(50% 0.12 165);' +
  46          '--due:oklch(74% 0.15 62);--due-light:oklch(25% 0.06 60);--due-text:oklch(84% 0.11 68);--due-chip:oklch(54% 0.15 45);' +
  47          '--over:oklch(66% 0.19 22);--over-light:oklch(23% 0.07 22);--over-text:oklch(80% 0.12 22);--over-chip:oklch(52% 0.19 22);' +
  48          '--prog:oklch(66% 0.15 252);--prog-light:oklch(23% 0.06 252);--prog-text:oklch(80% 0.1 252);--prog-chip:oklch(50% 0.16 252);' +
  49          '--up:oklch(40% 0.015 255);--up-light:oklch(18% 0.008 255);--up-text:oklch(72% 0.01 255);--up-chip:oklch(40% 0.02 258);' +
  50          '--violet:oklch(68% 0.15 292);--violet-light:oklch(24% 0.06 292);--violet-chip:oklch(52% 0.16 292);--violet-text:oklch(80% 0.1 292);--violet-soft:oklch(28% 0.07 292);' +
  51          '--sky:oklch(68% 0.11 228);--sky-light:oklch(23% 0.05 228);--sky-chip:oklch(52% 0.11 230);' +
  52          '--teal:oklch(66% 0.1 195);--teal-light:oklch(23% 0.05 195);--teal-chip:oklch(58% 0.09 195);' +
  53          '--you:oklch(70% 0.15 55);--you-light:oklch(25% 0.06 55);--you-text:oklch(84% 0.1 60);' +
 156  
 157    /* ---------- toast ---------- */
 158    var toastEl, toastT;
 159    function toast(msg, undo, cb) {
 160      if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'vp-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
 161      toastEl.innerHTML = '';
 162      var s = document.createElement('span'); s.textContent = msg; toastEl.appendChild(s);
 163      if (undo) { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo'; b.onclick = function () { if (typeof cb === 'function') cb(); toast('Undone'); }; toastEl.appendChild(b); }
 164      toastEl.classList.add('on'); toastEl.setAttribute('data-n', String((+toastEl.getAttribute('data-n') || 0) + 1)); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 3200);
 165    }
 166    window.vcfoToast = toast;
```
